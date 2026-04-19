"""
Agnes — FDA regulatory status module
Queries FDA openFDA drug label API and GRAS database for regulatory status.
Zero LLM. JSON parse + regex only. Cache-backed in db.sqlite.
"""

import json
import os
import re
import sqlite3
import urllib.request
import urllib.parse
from datetime import datetime, timezone

CACHE_MAX_AGE_H = int(os.getenv("REGULATORY_CACHE_AGE_H", "72"))  # 3 days

_CREATE_SQL = """
CREATE TABLE IF NOT EXISTS regulatory_cache (
    slug                TEXT PRIMARY KEY,
    ingredient_name     TEXT,
    fda_status          TEXT,
    gras_status         TEXT,
    eu_status           TEXT,
    approved_uses       TEXT NOT NULL DEFAULT '[]',
    restrictions        TEXT NOT NULL DEFAULT '[]',
    cfr_references      TEXT NOT NULL DEFAULT '[]',
    source_urls         TEXT NOT NULL DEFAULT '[]',
    scraped_at          TEXT NOT NULL
)
"""

# FDA 21 CFR part references that indicate food/pharma approval
_CFR_RE = re.compile(r'21\s*CFR\s*[\d.]+', re.IGNORECASE)
_GRAS_RE = re.compile(r'\bGRAS\b', re.IGNORECASE)
_EU_RE   = re.compile(r'\bE\s*\d{3,4}\b|\bEU\s*(?:approved|listed|permitted)\b', re.IGNORECASE)


def create_cache_table(conn: sqlite3.Connection) -> None:
    conn.execute(_CREATE_SQL)
    conn.commit()


def _get_cached(conn: sqlite3.Connection, slug: str) -> dict | None:
    row = conn.execute(
        "SELECT * FROM regulatory_cache WHERE slug = ?", (slug,)
    ).fetchone()
    if not row:
        return None
    d = dict(row)
    for f in ("approved_uses", "restrictions", "cfr_references", "source_urls"):
        try:
            d[f] = json.loads(d[f] or "[]")
        except Exception:
            d[f] = []
    try:
        age_h = (
            datetime.now(timezone.utc)
            - datetime.fromisoformat(d["scraped_at"].replace("Z", "+00:00"))
        ).total_seconds() / 3600
        if age_h > CACHE_MAX_AGE_H:
            return None
    except Exception:
        pass
    d["from_cache"] = True
    return d


def _set_cache(conn: sqlite3.Connection, slug: str, ingredient_name: str, data: dict) -> None:
    conn.execute(
        """
        INSERT INTO regulatory_cache
            (slug, ingredient_name, fda_status, gras_status, eu_status,
             approved_uses, restrictions, cfr_references, source_urls, scraped_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(slug) DO UPDATE SET
            ingredient_name = excluded.ingredient_name,
            fda_status      = excluded.fda_status,
            gras_status     = excluded.gras_status,
            eu_status       = excluded.eu_status,
            approved_uses   = excluded.approved_uses,
            restrictions    = excluded.restrictions,
            cfr_references  = excluded.cfr_references,
            source_urls     = excluded.source_urls,
            scraped_at      = excluded.scraped_at
        """,
        (
            slug,
            ingredient_name,
            data.get("fda_status"),
            data.get("gras_status"),
            data.get("eu_status"),
            json.dumps(data.get("approved_uses") or []),
            json.dumps(data.get("restrictions") or []),
            json.dumps(data.get("cfr_references") or []),
            json.dumps(data.get("source_urls") or []),
            datetime.now(timezone.utc).isoformat(),
        ),
    )
    conn.commit()


def _fetch_fda(ingredient_name: str) -> dict:
    """
    Queries FDA openFDA drug/food label API. Returns parsed regulatory data.
    No LLM — JSON parse + regex only.
    """
    q = urllib.parse.quote(f'"{ingredient_name}"')
    result = {
        "fda_status":    None,
        "gras_status":   None,
        "eu_status":     None,
        "approved_uses": [],
        "restrictions":  [],
        "cfr_references": [],
        "source_urls":   [],
    }

    # ── FDA drug label search ─────────────────────────────────────────────────
    fda_url = (
        f"https://api.fda.gov/drug/label.json"
        f"?search=inactive_ingredient:{q}&limit=3"
    )
    result["source_urls"].append(fda_url)
    try:
        with urllib.request.urlopen(fda_url, timeout=10) as r:
            data = json.loads(r.read().decode())
        results = data.get("results", [])
        if results:
            result["fda_status"] = "found in FDA drug labels as inactive ingredient"
            for rec in results[:2]:
                # Extract CFR references from any text field
                for field in ("references", "description", "indications_and_usage"):
                    text = " ".join(rec.get(field, []))
                    cfrs = _CFR_RE.findall(text)
                    result["cfr_references"].extend(cfrs)
                    if _GRAS_RE.search(text):
                        result["gras_status"] = "GRAS referenced in FDA label"
    except Exception:
        pass

    # ── FDA food additive / GRAS search ──────────────────────────────────────
    food_url = (
        f"https://api.fda.gov/food/enforcement.json"
        f"?search=product_description:{q}&limit=2"
    )
    result["source_urls"].append(food_url)
    try:
        with urllib.request.urlopen(food_url, timeout=10) as r:
            data = json.loads(r.read().decode())
        if data.get("results"):
            result["approved_uses"].append("found in FDA food enforcement database")
    except Exception:
        pass

    # ── Deduplicate CFR references ────────────────────────────────────────────
    result["cfr_references"] = list(dict.fromkeys(result["cfr_references"]))

    # ── Derive overall status ─────────────────────────────────────────────────
    if result["fda_status"] or result["gras_status"]:
        result["overall"] = "FDA regulated — found in official databases"
    else:
        result["overall"] = "not found in queried FDA databases — manual check recommended"

    return result


def get_regulatory(conn: sqlite3.Connection, slug: str, ingredient_name: str) -> dict:
    """
    Cache-first regulatory lookup. Never raises. Returns structured dict always.
    """
    cached = _get_cached(conn, slug)
    if cached:
        return cached

    data = _fetch_fda(ingredient_name)
    data["slug"]            = slug
    data["ingredient_name"] = ingredient_name
    _set_cache(conn, slug, ingredient_name, data)
    data["from_cache"] = False
    return data
