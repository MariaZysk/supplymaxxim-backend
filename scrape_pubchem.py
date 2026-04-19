"""
Agnes — PubChem chemical identity module
Queries PubChem REST API for formula, synonyms, solubility.
Zero LLM. Structured JSON only. Cache-backed in db.sqlite.
"""

import json
import os
import sqlite3
import urllib.request
import urllib.parse
from datetime import datetime, timezone

CACHE_MAX_AGE_H = int(os.getenv("PUBCHEM_CACHE_AGE_H", "168"))  # 1 week

_CREATE_SQL = """
CREATE TABLE IF NOT EXISTS pubchem_cache (
    slug            TEXT PRIMARY KEY,
    ingredient_name TEXT,
    formula         TEXT,
    iupac_name      TEXT,
    synonyms        TEXT NOT NULL DEFAULT '[]',
    solubility      TEXT,
    molecular_weight REAL,
    cid             INTEGER,
    scraped_at      TEXT NOT NULL
)
"""


def create_cache_table(conn: sqlite3.Connection) -> None:
    conn.execute(_CREATE_SQL)
    conn.commit()


def _get_cached(conn: sqlite3.Connection, slug: str) -> dict | None:
    row = conn.execute(
        "SELECT * FROM pubchem_cache WHERE slug = ?", (slug,)
    ).fetchone()
    if not row:
        return None
    d = dict(row)
    try:
        d["synonyms"] = json.loads(d["synonyms"] or "[]")
    except Exception:
        d["synonyms"] = []
    try:
        from datetime import datetime, timezone
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
        INSERT INTO pubchem_cache
            (slug, ingredient_name, formula, iupac_name, synonyms,
             solubility, molecular_weight, cid, scraped_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(slug) DO UPDATE SET
            ingredient_name  = excluded.ingredient_name,
            formula          = excluded.formula,
            iupac_name       = excluded.iupac_name,
            synonyms         = excluded.synonyms,
            solubility       = excluded.solubility,
            molecular_weight = excluded.molecular_weight,
            cid              = excluded.cid,
            scraped_at       = excluded.scraped_at
        """,
        (
            slug,
            ingredient_name,
            data.get("formula"),
            data.get("iupac_name"),
            json.dumps(data.get("synonyms") or []),
            data.get("solubility"),
            data.get("molecular_weight"),
            data.get("cid"),
            datetime.now(timezone.utc).isoformat(),
        ),
    )
    conn.commit()


def _fetch_pubchem(ingredient_name: str) -> dict:
    """
    Calls PubChem REST API. Returns structured dict or empty dict on failure.
    No LLM — pure JSON parsing.
    """
    base = "https://pubchem.ncbi.nlm.nih.gov/rest/pug"
    q = urllib.parse.quote(ingredient_name)

    def _get(url: str) -> dict | list | None:
        try:
            with urllib.request.urlopen(url, timeout=10) as r:
                return json.loads(r.read().decode())
        except Exception:
            return None

    # Step 1: resolve name → CID
    cid_data = _get(f"{base}/compound/name/{q}/cids/JSON")
    if not cid_data or "IdentifierList" not in cid_data:
        return {}
    cids = cid_data["IdentifierList"].get("CID", [])
    if not cids:
        return {}
    cid = cids[0]

    # Step 2: get properties
    props = _get(
        f"{base}/compound/cid/{cid}/property/"
        "MolecularFormula,MolecularWeight,IUPACName/JSON"
    )
    result = {"cid": cid}
    if props and "PropertyTable" in props:
        p = props["PropertyTable"]["Properties"][0]
        result["formula"]          = p.get("MolecularFormula")
        result["molecular_weight"] = p.get("MolecularWeight")
        result["iupac_name"]       = p.get("IUPACName")

    # Step 3: get synonyms (top 10)
    syn_data = _get(f"{base}/compound/cid/{cid}/synonyms/JSON")
    if syn_data and "InformationList" in syn_data:
        syns = syn_data["InformationList"]["Information"][0].get("Synonym", [])
        result["synonyms"] = syns[:10]

    # Step 4: get solubility from annotation (best-effort)
    annot = _get(
        f"https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/{cid}/JSON"
        "?heading=Solubility"
    )
    if annot:
        try:
            sections = annot["Record"]["Section"]
            for sec in sections:
                for subsec in sec.get("Section", []):
                    if "Solubility" in subsec.get("TOCHeading", ""):
                        info = subsec["Information"][0]
                        val = info["Value"]["StringWithMarkup"][0]["String"]
                        result["solubility"] = val
                        break
        except Exception:
            pass

    return result


def get_pubchem(conn: sqlite3.Connection, slug: str, ingredient_name: str) -> dict:
    """
    Cache-first PubChem lookup. Never raises. Returns {} on complete failure.
    """
    cached = _get_cached(conn, slug)
    if cached:
        return cached

    data = _fetch_pubchem(ingredient_name)
    if data:
        _set_cache(conn, slug, ingredient_name, data)
        data["from_cache"] = False
        data["slug"] = slug
        data["ingredient_name"] = ingredient_name
    else:
        data = {
            "slug": slug,
            "ingredient_name": ingredient_name,
            "formula": None,
            "synonyms": [],
            "solubility": None,
            "from_cache": False,
            "note": "not found in PubChem",
        }

    return data
