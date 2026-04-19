"""
Agnes — ingredient enrichment (Firecrawl + deterministic parse_spec).
Cache-backed in SQLite. No Gemini / LLM in this module.
"""

from __future__ import annotations

import json
import os
import re
import sqlite3
import urllib.parse
from datetime import datetime, timezone

from . import parse_spec

CACHE_MAX_AGE_H = int(os.getenv("ENRICHMENT_CACHE_AGE_H", "168"))

_CREATE_SQL = """
CREATE TABLE IF NOT EXISTS enrichment_cache (
    slug             TEXT PRIMARY KEY,
    ingredient_name  TEXT,
    payload          TEXT NOT NULL,
    scraped_at       TEXT NOT NULL
)
"""


def create_cache_table(conn: sqlite3.Connection) -> None:
    conn.execute(_CREATE_SQL)
    conn.commit()


def slug_from_sku(sku: str) -> str:
    """Derive a stable slug from a raw-material SKU (e.g. RM-C28-glycerin-85e43afb)."""
    s = sku.lower().strip()
    s = re.sub(r"^rm-c\d+-", "", s)
    s = re.sub(r"-[a-f0-9]{8}$", "", s)
    out = s.strip("-")
    return out or re.sub(r"[^\w]+", "-", sku.lower()).strip("-")


def ingredient_name_from_slug(slug: str) -> str:
    return slug.replace("-", " ").strip()


def _confidence(parsed: dict) -> float:
    score = 0.0
    if parsed.get("grade"):
        score += 0.3
    if parsed.get("purity_percent") is not None:
        score += 0.2
    certs = parsed.get("certifications") or []
    if certs:
        score += min(0.3, 0.06 * len(certs))
    reg = parsed.get("regulatory_status") or []
    if reg:
        score += min(0.25, 0.05 * len(reg))
    if parsed.get("available_forms"):
        score += min(0.15, 0.03 * len(parsed["available_forms"]))
    return round(min(1.0, score), 3)


def _build_response(
    slug: str,
    ingredient_name: str,
    parsed: dict,
    *,
    from_cache: bool,
    note: str | None = None,
) -> dict:
    certs = list(parsed.get("certifications") or [])
    reg = list(parsed.get("regulatory_status") or [])
    forms = list(parsed.get("available_forms") or [])
    allergen = list(parsed.get("allergen_free") or [])
    out = {
        "slug": slug,
        "ingredient_name": ingredient_name,
        "grade": parsed.get("grade"),
        "purity_percent": parsed.get("purity_percent"),
        "certifications": certs,
        "regulatory_status": reg,
        "available_forms": forms,
        "allergen_free": allergen,
        "supplier_name": parsed.get("supplier_name"),
        "notes": parsed.get("notes"),
        "confidence": _confidence(parsed),
        "from_cache": from_cache,
    }
    if note:
        out["note"] = note
    return out


def _fetch_markdown(ingredient_name: str) -> str | None:
    api_key = os.getenv("FIRECRAWL_API_KEY", "")
    if not api_key:
        return None
    try:
        from firecrawl import FirecrawlApp
    except ImportError:
        return None

    q = f"{ingredient_name} USP NF food grade specification COA datasheet"
    url = f"https://www.google.com/search?q={urllib.parse.quote_plus(q)}"
    fc = FirecrawlApp(api_key=api_key)
    try:
        result = fc.scrape_url(
            url,
            params={
                "formats": ["markdown"],
                "onlyMainContent": True,
                "waitFor": 2000,
            },
        )
        content = (result or {}).get("markdown", "")
        return content if len(content.strip()) >= 80 else None
    except Exception:
        return None


def _get_cached(conn: sqlite3.Connection, slug: str) -> dict | None:
    row = conn.execute(
        "SELECT payload, scraped_at FROM enrichment_cache WHERE slug = ?",
        (slug,),
    ).fetchone()
    if not row:
        return None
    try:
        age_h = (
            datetime.now(timezone.utc)
            - datetime.fromisoformat(row["scraped_at"].replace("Z", "+00:00"))
        ).total_seconds() / 3600
        if age_h > CACHE_MAX_AGE_H:
            return None
    except Exception:
        return None
    try:
        data = json.loads(row["payload"])
    except Exception:
        return None
    data["from_cache"] = True
    return data


def _set_cache(conn: sqlite3.Connection, slug: str, ingredient_name: str, payload: dict) -> None:
    to_store = {k: v for k, v in payload.items() if k != "from_cache"}
    conn.execute(
        """
        INSERT INTO enrichment_cache (slug, ingredient_name, payload, scraped_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(slug) DO UPDATE SET
            ingredient_name = excluded.ingredient_name,
            payload         = excluded.payload,
            scraped_at      = excluded.scraped_at
        """,
        (
            slug,
            ingredient_name,
            json.dumps(to_store),
            datetime.now(timezone.utc).isoformat(),
        ),
    )
    conn.commit()


def get_enrichment(
    conn: sqlite3.Connection,
    slug: str,
    ingredient_name: str,
    *,
    cache_only: bool = False,
) -> dict:
    """Cache-first enrichment. Never raises."""
    cached = _get_cached(conn, slug)
    if cached:
        return cached

    if cache_only:
        return _build_response(
            slug,
            ingredient_name,
            {},
            from_cache=False,
            note="cache_only_miss",
        )

    markdown = _fetch_markdown(ingredient_name)
    if not markdown:
        data = _build_response(
            slug,
            ingredient_name,
            {},
            from_cache=False,
            note="enrichment unavailable — check FIRECRAWL_API_KEY or firecrawl-py",
        )
        _set_cache(conn, slug, ingredient_name, data)
        return data

    parsed = parse_spec.extract(ingredient_name, markdown)
    data = _build_response(slug, ingredient_name, parsed, from_cache=False)
    _set_cache(conn, slug, ingredient_name, data)
    data["from_cache"] = False
    return data
