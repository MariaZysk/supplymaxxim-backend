"""
Agnes BOM HTTP routes — mounted on `app.main` (port 8000) so Dify HTTP nodes hit real paths.
Also used by standalone `uvicorn agnes.main:app`.
"""

from __future__ import annotations

import os
import re
import sqlite3
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter
from pydantic import BaseModel

from . import enrich
from . import scrape_news
from . import scrape_pubchem
from . import scrape_regulatory

_env_dir = Path(__file__).resolve().parent
load_dotenv(_env_dir / ".env")

_DEFAULT_DB = _env_dir.parent / "data" / "db.sqlite"
DB_PATH = os.getenv("DB_PATH", str(_DEFAULT_DB))

router = APIRouter(tags=["agnes-bom"])


def agnes_startup() -> None:
    conn = get_db()
    enrich.create_cache_table(conn)
    scrape_pubchem.create_cache_table(conn)
    scrape_regulatory.create_cache_table(conn)
    scrape_news.create_cache_table(conn)
    conn.close()


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ── REQUEST MODELS ────────────────────────────────────────────────────────────


class QueryRequest(BaseModel):
    query: str
    intent: str = "ingredient_lookup"


class WarmCacheRequest(BaseModel):
    slugs: list[str]


class ContextRequest(BaseModel):
    query: str
    intent: str = "ingredient_lookup"


class NewsRequest(BaseModel):
    query: str
    intent: str = ""


# ── UNIFIED CONTEXT ENDPOINT ──────────────────────────────────────────────────


@router.post("/api/context")
def unified_context(req: ContextRequest):
    """
    Single endpoint Agnes always calls — returns all data sections with empty
    defaults so Dify never receives an undefined variable.
    """
    intent = req.intent.strip().lower()
    empty = {}

    bom_data = ingredient_lookup(req.query) if "ingredient" in intent or "comparison" in intent else empty
    product_data = _product_context(req.query, False) if "product" in intent else empty
    comparison_data = ingredient_lookup(req.query) if "comparison" in intent else empty
    supplier_data = supplier_risk(req.query) if "supplier" in intent else empty
    portfolio_data = portfolio_summary() if "portfolio" in intent else empty

    return {
        "intent": intent,
        "bom_data": bom_data,
        "product_data": product_data,
        "comparison_data": comparison_data,
        "supplier_data": supplier_data,
        "portfolio_data": portfolio_data,
    }


# ── ENRICHMENT DATA ENDPOINTS (extended workflow) ─────────────────────────────


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


class SimpleQueryRequest(BaseModel):
    query: str


@router.post("/api/pubchem")
def pubchem_endpoint(req: SimpleQueryRequest):
    """Chemical identity from PubChem — formula, synonyms, solubility. Zero LLM."""
    name = " ".join(keywords(req.query)) or req.query
    conn = get_db()
    result = scrape_pubchem.get_pubchem(conn, _slug(name), name)
    conn.close()
    return result


@router.post("/api/regulatory")
def regulatory_endpoint(req: SimpleQueryRequest):
    """FDA regulatory status — openFDA label + food enforcement. Zero LLM."""
    name = " ".join(keywords(req.query)) or req.query
    conn = get_db()
    result = scrape_regulatory.get_regulatory(conn, _slug(name), name)
    conn.close()
    return result


@router.post("/api/news")
def news_endpoint(req: NewsRequest):
    """Supply chain news signals from Google News via Firecrawl. Zero LLM."""
    name = " ".join(keywords(req.query)) or req.query
    conn = get_db()
    result = scrape_news.get_news(conn, _slug(name), name)
    conn.close()
    return result


# ── MAIN ENDPOINT ─────────────────────────────────────────────────────────────


@router.post("/api/query")
def query(req: QueryRequest):
    intent = req.intent.strip().lower()
    if "ingredient" in intent:
        return ingredient_lookup(req.query)
    elif "supplier_risk" in intent or "supplier risk" in intent:
        return supplier_risk(req.query)
    else:
        return portfolio_summary()


class ProductRequest(BaseModel):
    product_sku: str
    with_enrichment: bool = True


@router.post("/api/product")
def get_product_context_post(req: ProductRequest):
    """POST wrapper — accepts {"product_sku": "..."} from Dify Input Parser output."""
    return _product_context(req.product_sku, req.with_enrichment)


@router.get("/api/product/{query}")
def get_product_context(query: str, with_enrichment: bool = True):
    """GET convenience endpoint for direct browser/curl access."""
    return _product_context(query, with_enrichment)


def _product_context(query: str, with_enrichment: bool = True) -> dict:
    conn = get_db()

    products = conn.execute(
        """
        SELECT p.Id, p.SKU, c.Name AS CompanyName
        FROM Product p
        JOIN Company c ON c.Id = p.CompanyId
        WHERE p.Type = 'finished-good' AND LOWER(p.SKU) LIKE ?
        LIMIT 5
    """,
        (f"%{query.lower()}%",),
    ).fetchall()

    if not products:
        conn.close()
        return {"error": f"No finished good found matching '{query}'", "query": query}

    product = products[0]
    product_id = product["Id"]

    raw_materials = conn.execute(
        """
        SELECT DISTINCT p_rm.Id AS raw_material_id, p_rm.SKU AS raw_material_sku
        FROM BOM b
        JOIN BOM_Component bc ON bc.BOMId = b.Id
        JOIN Product p_rm ON p_rm.Id = bc.ConsumedProductId
        WHERE b.ProducedProductId = ?
    """,
        (product_id,),
    ).fetchall()

    ingredients: list[dict] = []
    slug_enrichment: dict[str, dict] = {}

    for row in raw_materials:
        rm_id = row["raw_material_id"]
        rm_sku = row["raw_material_sku"]
        slug = enrich.slug_from_sku(rm_sku)
        ing = enrich.ingredient_name_from_slug(slug)

        suppliers = conn.execute(
            """
            SELECT s.Name FROM Supplier s
            JOIN Supplier_Product sp ON sp.SupplierId = s.Id
            WHERE sp.ProductId = ?
        """,
            (rm_id,),
        ).fetchall()
        supplier_names = [s["Name"] for s in suppliers]

        enrichment_data: dict = {}
        if with_enrichment:
            if slug not in slug_enrichment:
                slug_enrichment[slug] = enrich.get_enrichment(conn, slug, ing)
            enrichment_data = slug_enrichment[slug]

        ingredients.append(
            {
                "raw_material_id": rm_id,
                "raw_material_sku": rm_sku,
                "raw_material_name": ing,
                "slug": slug,
                "suppliers": supplier_names,
                "supplier_count": len(supplier_names),
                "single_source": len(supplier_names) == 1,
                "enrichment": enrichment_data,
            }
        )

    conn.close()
    return {
        "product_id": product["Id"],
        "product_sku": product["SKU"],
        "company": product["CompanyName"],
        "ingredient_count": len(ingredients),
        "ingredients": ingredients,
        "other_matches": [{"sku": p["SKU"], "company": p["CompanyName"]} for p in products[1:]],
    }


@router.get("/api/enrich/{slug}")
def enrich_endpoint(slug: str, cache_only: bool = False):
    """Return cached or live-scraped enrichment for one ingredient slug."""
    conn = get_db()
    result = enrich.get_enrichment(
        conn, slug, enrich.ingredient_name_from_slug(slug), cache_only=cache_only
    )
    conn.close()
    return result


@router.post("/api/warm-cache")
def warm_cache(req: WarmCacheRequest):
    conn = get_db()
    results = {}
    for slug in req.slugs:
        ing = enrich.ingredient_name_from_slug(slug)
        data = enrich.get_enrichment(conn, slug, ing, cache_only=False)
        results[slug] = {
            "confidence": data.get("confidence"),
            "certifications": data.get("certifications", []),
            "from_cache": data.get("from_cache"),
        }
    conn.close()
    return {"warmed": len(req.slugs), "results": results}


# ── HELPERS ───────────────────────────────────────────────────────────────────

STOPWORDS = {
    "what",
    "which",
    "who",
    "where",
    "when",
    "why",
    "how",
    "would",
    "could",
    "should",
    "will",
    "might",
    "may",
    "can",
    "do",
    "does",
    "did",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "happen",
    "happens",
    "happened",
    "became",
    "become",
    "becomes",
    "unavailable",
    "available",
    "gone",
    "lost",
    "removed",
    "disrupted",
    "affected",
    "impacted",
    "disappear",
    "disappears",
    "disappeared",
    "affect",
    "impact",
    "replace",
    "replacing",
    "replaced",
    "the",
    "a",
    "an",
    "if",
    "then",
    "so",
    "and",
    "or",
    "but",
    "not",
    "no",
    "yes",
    "its",
    "their",
    "our",
    "my",
    "your",
    "show",
    "me",
    "all",
    "find",
    "list",
    "get",
    "tell",
    "about",
    "suppliers",
    "supplier",
    "substitutes",
    "exist",
    "used",
    "in",
    "bom",
    "supplies",
    "source",
    "sourced",
    "from",
    "portfolio",
    "many",
    "use",
    "using",
    "we",
    "for",
}


def keywords(text: str) -> list[str]:
    words = re.sub(r"[^\w\s]", "", text.lower()).split()
    return [w for w in words if w not in STOPWORDS and len(w) > 2]


# ── INGREDIENT LOOKUP ─────────────────────────────────────────────────────────


def ingredient_lookup(query: str) -> dict:
    kw = keywords(query)
    if not kw:
        return {"error": "No ingredient name found in query", "query": query}

    conn = get_db()
    conditions = " AND ".join(["LOWER(p.SKU) LIKE ?" for _ in kw])
    params = [f"%{w}%" for w in kw]

    rows = conn.execute(
        f"""
        SELECT p.Id, p.SKU, c.Name AS CompanyName
        FROM Product p
        JOIN Company c ON c.Id = p.CompanyId
        WHERE p.Type = 'raw-material' AND {conditions}
        LIMIT 10
    """,
        params,
    ).fetchall()

    if not rows:
        conn.close()
        return {"ingredient_query": " ".join(kw), "matches": [], "message": "No matching raw materials found"}

    results = []
    for row in rows:
        pid = row["Id"]

        suppliers = conn.execute(
            """
            SELECT s.Id, s.Name
            FROM Supplier s
            JOIN Supplier_Product sp ON sp.SupplierId = s.Id
            WHERE sp.ProductId = ?
        """,
            (pid,),
        ).fetchall()

        finished_goods = conn.execute(
            """
            SELECT p.SKU, c.Name AS CompanyName
            FROM BOM_Component bc
            JOIN BOM b ON b.Id = bc.BOMId
            JOIN Product p ON p.Id = b.ProducedProductId
            JOIN Company c ON c.Id = p.CompanyId
            WHERE bc.ConsumedProductId = ?
        """,
            (pid,),
        ).fetchall()

        results.append(
            {
                "sku": row["SKU"],
                "company": row["CompanyName"],
                "suppliers": [{"id": s["Id"], "name": s["Name"]} for s in suppliers],
                "supplier_count": len(suppliers),
                "single_source": len(suppliers) == 1,
                "bom_impact": [{"sku": fg["SKU"], "company": fg["CompanyName"]} for fg in finished_goods],
                "finished_goods_count": len(finished_goods),
            }
        )

    slug_enrichment: dict[str, dict] = {}
    for result in results:
        slug = enrich.slug_from_sku(result["sku"])
        if slug not in slug_enrichment:
            ing_name = enrich.ingredient_name_from_slug(slug)
            slug_enrichment[slug] = enrich.get_enrichment(conn, slug, ing_name)
        result["enrichment"] = slug_enrichment[slug]

    conn.close()
    return {
        "ingredient_query": " ".join(kw),
        "matches": results,
        "total_matches": len(results),
    }


# ── SUPPLIER RISK ─────────────────────────────────────────────────────────────


def supplier_risk(query: str) -> dict:
    kw = keywords(query)
    if not kw:
        return {"error": "No supplier name found in query"}

    conn = get_db()
    conditions = " AND ".join(["LOWER(s.Name) LIKE ?" for _ in kw])
    params = [f"%{w}%" for w in kw]

    suppliers = conn.execute(
        f"""
        SELECT s.Id, s.Name FROM Supplier s
        WHERE {conditions}
        LIMIT 5
    """,
        params,
    ).fetchall()

    if not suppliers:
        conn.close()
        return {"supplier_query": " ".join(kw), "matches": [], "message": "No matching supplier found"}

    results = []
    for supplier in suppliers:
        raw_materials = conn.execute(
            """
            SELECT p.Id, p.SKU
            FROM Product p
            JOIN Supplier_Product sp ON sp.ProductId = p.Id
            WHERE sp.SupplierId = ? AND p.Type = 'raw-material'
        """,
            (supplier["Id"],),
        ).fetchall()

        at_risk = []
        for rm in raw_materials:
            alt_suppliers = conn.execute(
                """
                SELECT s.Name FROM Supplier s
                JOIN Supplier_Product sp ON sp.SupplierId = s.Id
                WHERE sp.ProductId = ? AND s.Id != ?
            """,
                (rm["Id"], supplier["Id"]),
            ).fetchall()

            finished_goods = conn.execute(
                """
                SELECT DISTINCT p.SKU FROM BOM_Component bc
                JOIN BOM b ON b.Id = bc.BOMId
                JOIN Product p ON p.Id = b.ProducedProductId
                WHERE bc.ConsumedProductId = ?
            """,
                (rm["Id"],),
            ).fetchall()

            at_risk.append(
                {
                    "sku": rm["SKU"],
                    "alternative_suppliers": [a["Name"] for a in alt_suppliers],
                    "has_alternatives": len(alt_suppliers) > 0,
                    "affected_finished_goods": [fg["SKU"] for fg in finished_goods],
                }
            )

        results.append(
            {
                "supplier_id": supplier["Id"],
                "supplier_name": supplier["Name"],
                "raw_materials_supplied": len(raw_materials),
                "at_risk_ingredients": at_risk,
                "single_source_count": sum(1 for r in at_risk if not r["has_alternatives"]),
            }
        )

    conn.close()
    return {"supplier_query": " ".join(kw), "results": results}


# ── PORTFOLIO SUMMARY ─────────────────────────────────────────────────────────


def portfolio_summary() -> dict:
    conn = get_db()

    single_source = conn.execute(
        """
        SELECT p.SKU, s.Name AS SupplierName
        FROM Product p
        JOIN Supplier_Product sp ON sp.ProductId = p.Id
        JOIN Supplier s ON s.Id = sp.SupplierId
        WHERE p.Type = 'raw-material'
        GROUP BY p.Id
        HAVING COUNT(sp.SupplierId) = 1
        LIMIT 20
    """
    ).fetchall()

    top_suppliers = conn.execute(
        """
        SELECT s.Name, COUNT(sp.ProductId) AS product_count
        FROM Supplier s
        JOIN Supplier_Product sp ON sp.SupplierId = s.Id
        JOIN Product p ON p.Id = sp.ProductId
        WHERE p.Type = 'raw-material'
        GROUP BY s.Id
        ORDER BY product_count DESC
        LIMIT 10
    """
    ).fetchall()

    totals = conn.execute(
        """
        SELECT
            (SELECT COUNT(*) FROM Product WHERE Type='raw-material') AS raw_materials,
            (SELECT COUNT(*) FROM BOM) AS boms,
            (SELECT COUNT(*) FROM Supplier) AS suppliers,
            (SELECT COUNT(*) FROM Product WHERE Type='finished-good') AS finished_goods
    """
    ).fetchone()

    conn.close()
    return {
        "portfolio_stats": {
            "total_raw_materials": totals["raw_materials"],
            "total_finished_goods": totals["finished_goods"],
            "total_boms": totals["boms"],
            "total_suppliers": totals["suppliers"],
        },
        "single_source_ingredients": [{"sku": r["SKU"], "sole_supplier": r["SupplierName"]} for r in single_source],
        "single_source_count": len(single_source),
        "top_suppliers_by_coverage": [
            {"name": r["Name"], "raw_materials_count": r["product_count"]} for r in top_suppliers
        ],
    }
