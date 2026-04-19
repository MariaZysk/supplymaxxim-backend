"""
Agnes — ad-hoc enrichment module
Cache-first: checks enrichment_cache table in db.sqlite.
On miss: scrapes one source via Firecrawl, extracts via parse_spec (regex, no LLM), caches, returns.
Requires: FIRECRAWL_API_KEY (falls back gracefully if absent).
"""

import json
import os
import sqlite3
import time
from datetime import datetime, timezone

import parse_spec

FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY", "")
CACHE_MAX_AGE_H   = int(os.getenv("ENRICH_CACHE_AGE_H", "24"))

# Tried in order — stop on first successful scrape (keeps first-query latency ~5–8s)
_SOURCES = [
    "https://www.purebulk.com/search?type=product&q={q}",
    "https://www.prinova.com/en/ingredient-finder/?search={q}",
    "https://pubchem.ncbi.nlm.nih.gov/#query={q}",
]

# ── SCHEMA ────────────────────────────────────────────────────────────────────

_CREATE_SQL = """
CREATE TABLE IF NOT EXISTS enrichment_cache (
    slug              TEXT PRIMARY KEY,
    ingredient_name   TEXT,
    certifications    TEXT NOT NULL DEFAULT '[]',
    purity_percent    REAL,
    grade             TEXT,
    regulatory_status TEXT NOT NULL DEFAULT '[]',
    allergen_free     TEXT NOT NULL DEFAULT '[]',
    available_forms   TEXT NOT NULL DEFAULT '[]',
    supplier_name     TEXT,
    source_url        TEXT,
    confidence        TEXT NOT NULL DEFAULT 'missing',
    scraped_at        TEXT NOT NULL,
    raw_excerpt       TEXT NOT NULL DEFAULT ''
)
"""


def create_cache_table(conn: sqlite3.Connection) -> None:
    conn.execute(_CREATE_SQL)
    conn.commit()


# ── CACHE READ / WRITE ────────────────────────────────────────────────────────

def _deserialize(row: sqlite3.Row) -> dict:
    d = dict(row)
    for field in ("certifications", "regulatory_status", "allergen_free", "available_forms"):
        try:
            d[field] = json.loads(d[field] or "[]")
        except Exception:
            d[field] = []
    try:
        age_h = (
            datetime.now(timezone.utc)
            - datetime.fromisoformat(d["scraped_at"].replace("Z", "+00:00"))
        ).total_seconds() / 3600
        d["cache_age_hours"] = round(age_h, 1)
        d["stale"] = age_h > CACHE_MAX_AGE_H
    except Exception:
        d["cache_age_hours"] = None
        d["stale"] = False
    return d


def _get_cached(conn: sqlite3.Connection, slug: str) -> dict | None:
    row = conn.execute(
        "SELECT * FROM enrichment_cache WHERE slug = ?", (slug,)
    ).fetchone()
    return _deserialize(row) if row else None


def _set_cache(
    conn: sqlite3.Connection,
    slug: str,
    ingredient_name: str,
    structured: dict,
    source_url: str,
    raw_excerpt: str,
    confidence: str,
) -> None:
    conn.execute(
        """
        INSERT INTO enrichment_cache
            (slug, ingredient_name, certifications, purity_percent, grade,
             regulatory_status, allergen_free, available_forms, supplier_name,
             source_url, confidence, scraped_at, raw_excerpt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(slug) DO UPDATE SET
            ingredient_name   = excluded.ingredient_name,
            certifications    = excluded.certifications,
            purity_percent    = excluded.purity_percent,
            grade             = excluded.grade,
            regulatory_status = excluded.regulatory_status,
            allergen_free     = excluded.allergen_free,
            available_forms   = excluded.available_forms,
            supplier_name     = excluded.supplier_name,
            source_url        = excluded.source_url,
            confidence        = excluded.confidence,
            scraped_at        = excluded.scraped_at,
            raw_excerpt       = excluded.raw_excerpt
        """,
        (
            slug,
            ingredient_name,
            json.dumps(structured.get("certifications") or []),
            structured.get("purity_percent"),
            structured.get("grade"),
            json.dumps(structured.get("regulatory_status") or []),
            json.dumps(structured.get("allergen_free") or []),
            json.dumps(structured.get("available_forms") or []),
            structured.get("supplier_name"),
            source_url,
            confidence,
            datetime.now(timezone.utc).isoformat(),
            (raw_excerpt or "")[:2000],
        ),
    )
    conn.commit()


# ── SLUG HELPERS ──────────────────────────────────────────────────────────────

def slug_from_sku(sku: str) -> str:
    """RM-C28-vitamin-d3-cholecalciferol-8956b79c → vitamin-d3-cholecalciferol"""
    parts = sku.split("-")
    return "-".join(parts[2:-1])


def ingredient_name_from_slug(slug: str) -> str:
    return slug.replace("-", " ")


# ── LIVE SCRAPE + EXTRACT ─────────────────────────────────────────────────────

def _scrape(ingredient_name: str) -> tuple[str | None, str]:
    if not FIRECRAWL_API_KEY:
        return None, ""
    try:
        from firecrawl import FirecrawlApp
    except ImportError:
        return None, ""

    fc = FirecrawlApp(api_key=FIRECRAWL_API_KEY)
    q = ingredient_name.replace(" ", "+")
    for url_tpl in _SOURCES:
        url = url_tpl.format(q=q)
        try:
            result = fc.scrape_url(url, params={
                "formats": ["markdown"],
                "onlyMainContent": True,
                "waitFor": 1000,
            })
            content = result.get("markdown", "")
            if len(content.strip()) >= 300:
                return content, url
        except Exception:
            pass
        time.sleep(0.4)
    return None, ""


def _extract(ingredient_name: str, markdown: str) -> dict:
    return parse_spec.extract(ingredient_name, markdown)


# ── PUBLIC API ────────────────────────────────────────────────────────────────

def get_enrichment(
    conn: sqlite3.Connection,
    slug: str,
    ingredient_name: str,
    cache_only: bool = False,
) -> dict:
    """
    Returns enrichment dict for the given ingredient slug.
    Checks cache first; on miss, scrapes live unless cache_only=True.
    Never raises — always returns a dict with at minimum slug + confidence.
    """
    cached = _get_cached(conn, slug)
    if cached and not cached.get("stale"):
        cached["from_cache"] = True
        return cached

    if cache_only:
        return {
            "slug": slug,
            "ingredient_name": ingredient_name,
            "confidence": "not_cached",
            "certifications": [],
            "regulatory_status": [],
            "from_cache": False,
        }

    markdown, source_url = _scrape(ingredient_name)
    if markdown:
        structured = _extract(ingredient_name, markdown)
        confidence = "confirmed"
    else:
        structured = {}
        source_url = ""
        confidence = "missing"

    _set_cache(conn, slug, ingredient_name, structured, source_url, markdown or "", confidence)

    result = _get_cached(conn, slug) or {
        "slug": slug,
        "ingredient_name": ingredient_name,
        "confidence": confidence,
        "certifications": [],
        "regulatory_status": [],
    }
    result["from_cache"] = False
    return result
