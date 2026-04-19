"""
Agnes — Enrichment Pipeline
Run once at hackathon start to populate the Dify knowledge base with
supplier specs, certifications, and regulatory data for all 876 raw materials.
Also writes enrichment data to SQLite enrichment_cache so the live workflow
(main.py) reads pre-warmed data instead of scraping on first request.

Usage:
    python scrape_enrich.py

    # Dry run (no Dify upload or SQLite write, just prints what would happen):
    python scrape_enrich.py --dry-run

    # Enrich a single SKU only:
    python scrape_enrich.py --sku RM-C28-vitamin-d3-cholecalciferol-8956b79c

Requirements:
    pip install firecrawl-py httpx python-dotenv

Environment variables (loaded from .env automatically):
    FIRECRAWL_API_KEY   — from app.firecrawl.dev
    DIFY_API_KEY        — from Dify > Knowledge Base > API
    DIFY_DATASET_ID     — from Dify > Knowledge Base > Settings
    DIFY_BASE_URL       — Dify API base (default: https://api.dify.ai/v1)
    DB_PATH             — path to db.sqlite (default: ./db.sqlite)
"""

import argparse
import json
import os
import sqlite3
import time
from datetime import datetime

import httpx
import parse_spec
import enrich as enrich_module
from dotenv import load_dotenv
from firecrawl import FirecrawlApp


# ── LOAD .env ─────────────────────────────────────────────────────────────────

load_dotenv()

# ── CONFIG ────────────────────────────────────────────────────────────────────

FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY", "")
DIFY_API_KEY      = os.getenv("DIFY_API_KEY", "")
DIFY_DATASET_ID   = os.getenv("DIFY_DATASET_ID", "")
DIFY_BASE_URL     = os.getenv("DIFY_BASE_URL", "https://api.dify.ai/v1")
DB_PATH           = os.getenv("DB_PATH", "./db.sqlite")

SCRAPE_DELAY = 1.2   # seconds between Firecrawl calls

# ── SOURCES ───────────────────────────────────────────────────────────────────

def build_urls(ingredient: str) -> list[dict]:
    q = ingredient.replace(" ", "+")
    return [
        {"url": f"https://www.purebulk.com/search?type=product&q={q}",             "source": "PureBulk",        "confidence": "confirmed"},
        {"url": f"https://www.prinova.com/en/ingredient-finder/?search={q}",        "source": "Prinova USA",     "confidence": "confirmed"},
        {"url": f"https://www.bulksupplements.com/search?type=product&q={q}",       "source": "BulkSupplements", "confidence": "confirmed"},
        {"url": f"https://www.fda.gov/food/generally-recognized-safe-gras/gras-substances-scogs-database", "source": "FDA GRAS", "confidence": "confirmed"},
        {"url": f"https://efsa.europa.eu/en/search/site/{q}",                       "source": "EFSA",            "confidence": "confirmed"},
        {"url": f"https://www.nsf.org/certified-products-systems?search={q}",       "source": "NSF Certified",   "confidence": "confirmed"},
        {"url": f"https://pubchem.ncbi.nlm.nih.gov/#query={q}",                       "source": "PubChem",         "confidence": "confirmed"},
        {"url": f"https://www.sigmaaldrich.com/US/en/search#q={q}&t=all",             "source": "Sigma-Aldrich SDS","confidence": "confirmed"},
    ]

# ── SKU PARSING ───────────────────────────────────────────────────────────────

def parse_sku(sku: str) -> dict:
    # RM-C28-vitamin-d3-cholecalciferol-8956b79c -> ingredient: vitamin d3 cholecalciferol
    parts = sku.split("-")
    company_id       = parts[1].lstrip("C")
    ingredient_slug  = "-".join(parts[2:-1])
    ingredient_name  = ingredient_slug.replace("-", " ")
    return {"sku": sku, "company_id": company_id,
            "ingredient_slug": ingredient_slug, "ingredient_name": ingredient_name}

# ── DATABASE ──────────────────────────────────────────────────────────────────

def get_raw_materials(db_path: str, single_sku: str = None) -> list[str]:
    conn = sqlite3.connect(db_path)
    if single_sku:
        rows = conn.execute(
            "SELECT SKU FROM Product WHERE Type='raw-material' AND SKU=?", (single_sku,)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT SKU FROM Product WHERE Type='raw-material' ORDER BY SKU"
        ).fetchall()
    conn.close()
    return [r[0] for r in rows]

# ── FIRECRAWL ─────────────────────────────────────────────────────────────────

def scrape_url(fc: FirecrawlApp, url: str) -> str | None:
    if fc is None:
        return f"[dry-run] mock content for {url}"
    try:
        result = fc.scrape_url(url, params={
            "formats": ["markdown"],
            "onlyMainContent": True,
            "waitFor": 1000,
        })
        content = result.get("markdown", "")
        if len(content.strip()) < 300:
            return None
        return content
    except Exception as e:
        print(f"    [scrape error] {url}: {e}")
        return None

# ── SPEC EXTRACTION ───────────────────────────────────────────────────────────

def extract_structured(ingredient: str, raw_markdown: str) -> dict:
    """
    Deterministic compliance extraction via parse_spec (regex only, zero LLM).
    Consistent with the extraction used by enrich.py at runtime.
    """
    return parse_spec.extract(ingredient, raw_markdown)

# ── DIFY UPLOAD ───────────────────────────────────────────────────────────────

def push_to_dify(
    sku: str,
    ingredient_name: str,
    source_name: str,
    source_url: str,
    raw_content: str,
    structured: dict,
    confidence: str,
    dry_run: bool = False,
) -> bool:
    doc_name    = f"{ingredient_name} — {source_name}"
    scraped_at  = datetime.utcnow().isoformat() + "Z"

    structured_block = ""
    if structured:
        structured_block = (
            f"\n## Extracted Data\n\n"
            f"- **Certifications:** {', '.join(structured.get('certifications') or []) or 'none found'}\n"
            f"- **Purity:** {structured.get('purity_percent') or 'not specified'}\n"
            f"- **Grade:** {structured.get('grade') or 'not specified'}\n"
            f"- **Regulatory status:** {', '.join(structured.get('regulatory_status') or []) or 'not specified'}\n"
            f"- **Allergen free:** {', '.join(structured.get('allergen_free') or []) or 'not specified'}\n"
            f"- **Available forms:** {', '.join(structured.get('available_forms') or []) or 'not specified'}\n"
            f"- **Min order qty:** {structured.get('min_order_qty') or 'not specified'}\n"
            f"- **Notes:** {structured.get('notes') or ''}\n"
        )

    full_text = (
        f"# {doc_name}\n\n"
        f"**Ingredient:** {ingredient_name}  \n"
        f"**SKU:** {sku}  \n"
        f"**Source:** {source_name} ({source_url})  \n"
        f"**Confidence:** {confidence}  \n"
        f"**Scraped:** {scraped_at}  \n"
        f"{structured_block}\n"
        f"---\n\n"
        f"## Raw Page Content\n\n"
        f"{raw_content}"
    )

    if dry_run:
        print(f"    [dry-run] would upload: {doc_name} ({len(full_text)} chars)")
        if structured:
            print(f"    [gemini extracted] {json.dumps(structured, indent=6)[:300]}")
        return True

    try:
        resp = httpx.post(
            f"{DIFY_BASE_URL}/datasets/{DIFY_DATASET_ID}/document/create_by_text",
            headers={
                "Authorization": f"Bearer {DIFY_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "name": doc_name,
                "text": full_text,
                "indexing_technique": "high_quality",
                "process_rule": {"mode": "automatic"},
            },
            timeout=30,
        )
        if resp.status_code in (200, 201):
            return True
        print(f"    [dify error] {resp.status_code}: {resp.text[:200]}")
        return False
    except Exception as e:
        print(f"    [dify upload error] {e}")
        return False

# ── MISSING MARKER ────────────────────────────────────────────────────────────

def mark_as_missing(sku: str, ingredient_name: str, dry_run: bool = False):
    content = (
        f"No external enrichment data was found for **{ingredient_name}** (SKU: {sku}).\n\n"
        f"Manual verification recommended before making sourcing decisions for this ingredient."
    )
    push_to_dify(
        sku=sku, ingredient_name=ingredient_name,
        source_name="Enrichment Pipeline", source_url="",
        raw_content=content, structured={},
        confidence="missing", dry_run=dry_run,
    )

# ── JSON MODE ─────────────────────────────────────────────────────────────────

def load_json_data(json_path: str) -> dict:
    """Read dify_ready_data.json and group records by raw_material_sku."""
    records = {}
    with open(json_path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            sku = rec["raw_material_sku"]
            if sku not in records:
                records[sku] = {
                    "raw_material_id": rec["raw_material_id"],
                    "raw_material_sku": sku,
                    "ingredient_name": parse_sku(sku)["ingredient_name"],
                    "suppliers": set(),
                    "finished_products": set(),
                }
            records[sku]["suppliers"].add(rec["supplier_name"])
            records[sku]["finished_products"].add(rec["finished_product_sku"])
    return records


def build_document_from_json_record(record: dict) -> str:
    """Format a grouped BOM record as a Dify-ready markdown document."""
    name      = record["ingredient_name"]
    sku       = record["raw_material_sku"]
    suppliers = sorted(record["suppliers"])
    products  = sorted(record["finished_products"])
    return (
        f"# {name}\n\n"
        f"**SKU:** {sku}\n"
        f"**Ingredient:** {name}\n"
        f"**Supplier count:** {len(suppliers)}\n"
        f"**Used in {len(products)} finished product(s)**\n\n"
        f"## Suppliers\n\n"
        + "\n".join(f"- {s}" for s in suppliers) +
        f"\n\n## Finished Products\n\n"
        + "\n".join(f"- {p}" for p in products) +
        "\n"
    )


def upload_from_json(json_path: str, dry_run: bool = False):
    if not dry_run:
        missing = {k: v for k, v in {
            "DIFY_API_KEY":   DIFY_API_KEY,
            "DIFY_DATASET_ID": DIFY_DATASET_ID,
        }.items() if not v}
        if missing:
            print(f"ERROR: missing env vars: {list(missing.keys())}")
            return

    print(f"Loading {json_path}...")
    records = load_json_data(json_path)
    print(f"Found {len(records)} unique ingredients\n")

    total      = len(records)
    uploaded   = 0
    start_time = time.time()

    for i, (sku, record) in enumerate(records.items(), 1):
        elapsed = time.time() - start_time
        eta     = (elapsed / i) * (total - i) if i > 1 else 0
        print(f"[{i}/{total}] {record['ingredient_name']} — ETA {eta/60:.1f}min")

        doc_text = build_document_from_json_record(record)
        ok = push_to_dify(
            sku=sku,
            ingredient_name=record["ingredient_name"],
            source_name="BOM Database",
            source_url="dify_ready_data.json",
            raw_content=doc_text,
            structured={},
            confidence="confirmed",
            dry_run=dry_run,
        )
        if ok:
            uploaded += 1
            print(f"    [ok] {len(record['suppliers'])} suppliers · {len(record['finished_products'])} finished products")

    duration = time.time() - start_time
    print(f"\n{'='*60}")
    print(f"Upload complete in {duration/60:.1f} minutes")
    print(f"  Docs uploaded : {uploaded}/{total}")
    print(f"{'='*60}")


# ── DEDUPLICATION ─────────────────────────────────────────────────────────────

def deduplicate_skus(skus: list[str]) -> list[str]:
    seen = {}
    for sku in skus:
        slug = parse_sku(sku)["ingredient_slug"]
        if slug not in seen:
            seen[slug] = sku
    deduped = list(seen.values())
    print(f"Deduplication: {len(skus)} SKUs -> {len(deduped)} unique ingredients")
    return deduped

# ── ENRICHMENT LOOP ───────────────────────────────────────────────────────────

def enrich_ingredient(fc: FirecrawlApp, sku: str, dry_run: bool = False) -> dict:
    parsed     = parse_sku(sku)
    ingredient = parsed["ingredient_name"]
    urls       = build_urls(ingredient)
    results    = {"sku": sku, "ingredient": ingredient, "uploaded": 0, "skipped": 0}

    for source in urls:
        print(f"    scraping {source['source']}: {source['url'][:70]}...")
        raw = scrape_url(fc, source["url"])

        if raw:
            structured = extract_structured(ingredient, raw) if not dry_run else {}
            if not dry_run:
                # Pre-warm SQLite enrichment_cache so main.py serves this instantly
                conn = sqlite3.connect(DB_PATH)
                enrich_module.create_cache_table(conn)
                slug = enrich_module.slug_from_sku(sku)
                enrich_module._set_cache(
                    conn, slug, ingredient, structured,
                    source["url"], raw[:2000], source["confidence"],
                )
                conn.close()

            ok = push_to_dify(
                sku=sku,
                ingredient_name=ingredient,
                source_name=source["source"],
                source_url=source["url"],
                raw_content=raw,
                structured=structured,
                confidence=source["confidence"],
                dry_run=dry_run,
            )
            if ok:
                results["uploaded"] += 1
                certs = ", ".join(structured.get("certifications") or []) or "none"
                print(f"    [ok] {source['source']} — certs: {certs}")
        else:
            results["skipped"] += 1

        time.sleep(SCRAPE_DELAY)

    if results["uploaded"] == 0:
        print(f"    [missing] no data found — marking as missing")
        mark_as_missing(sku, ingredient, dry_run)

    return results

# ── ENTRY POINT ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Agnes enrichment pipeline")
    parser.add_argument("--dry-run",   action="store_true", help="Print without uploading")
    parser.add_argument("--sku",       type=str, default=None, help="Enrich a single SKU only")
    parser.add_argument("--no-dedup",  action="store_true",    help="Skip deduplication")
    parser.add_argument("--from-json", type=str, default=None, help="Upload from dify_ready_data.json instead of scraping")
    args = parser.parse_args()

    if args.from_json:
        upload_from_json(args.from_json, dry_run=args.dry_run)
        return

    if not args.dry_run:
        missing = {k: v for k, v in {
            "FIRECRAWL_API_KEY": FIRECRAWL_API_KEY,
            "DIFY_API_KEY":      DIFY_API_KEY,
            "DIFY_DATASET_ID":   DIFY_DATASET_ID,
        }.items() if not v}
        if missing:
            print(f"ERROR: missing env vars: {list(missing.keys())}")
            print("Fill them in .env or run with --dry-run to test.")
            return

    # Initialise clients
    fc = FirecrawlApp(api_key=FIRECRAWL_API_KEY) if not args.dry_run else None

    print(f"Loading raw materials from {DB_PATH}...")
    skus = get_raw_materials(DB_PATH, single_sku=args.sku)
    print(f"Found {len(skus)} raw material SKUs")

    if not args.no_dedup and not args.sku:
        skus = deduplicate_skus(skus)

    total      = len(skus)
    stats      = {"uploaded": 0, "skipped": 0, "missing": 0}
    start_time = time.time()

    for i, sku in enumerate(skus, 1):
        parsed  = parse_sku(sku)
        elapsed = time.time() - start_time
        eta     = (elapsed / i) * (total - i) if i > 1 else 0
        print(f"\n[{i}/{total}] {sku} ({parsed['ingredient_name']}) — ETA {eta/60:.1f}min")

        result = enrich_ingredient(fc, sku, dry_run=args.dry_run)
        stats["uploaded"] += result["uploaded"]
        stats["skipped"]  += result["skipped"]
        if result["uploaded"] == 0:
            stats["missing"] += 1

    duration = time.time() - start_time
    print(f"\n{'='*60}")
    print(f"Enrichment complete in {duration/60:.1f} minutes")
    print(f"  Docs uploaded : {stats['uploaded']}")
    print(f"  Pages skipped : {stats['skipped']} (empty / too short)")
    print(f"  Missing       : {stats['missing']} (no data found)")
    print(f"{'='*60}")
    if not args.dry_run:
        print(f"\nNext: open Dify > Knowledge Base > your dataset")
        print(f"and paste the dataset ID into agnes_workflow.dsl (dataset_ids field).")


if __name__ == "__main__":
    main()
