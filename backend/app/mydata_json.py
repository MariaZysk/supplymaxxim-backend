"""
Load frontend/src/data/mydata.json (same source as Procurement Search / BOM Explorer).
Used to ground /api/chat when SQLite drifts or ids differ.
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
MYDATA_PATH = _REPO_ROOT / "frontend" / "src" / "data" / "mydata.json"

_rows_cache: Optional[List[Dict[str, Any]]] = None


def _load_rows() -> List[Dict[str, Any]]:
    global _rows_cache
    if _rows_cache is not None:
        return _rows_cache
    if not MYDATA_PATH.is_file():
        _rows_cache = []
        return _rows_cache
    with open(MYDATA_PATH, encoding="utf-8") as f:
        _rows_cache = json.load(f)
    return _rows_cache


def _narrow_rows_to_best_material_phrase(user_message: str, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """When both e.g. «Lecithin» and «Soy Lecithin» match, prefer rows whose display name best matches the question wording."""
    if len(rows) <= 1:
        return rows
    lower = user_message.lower()
    by_dn: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for r in rows:
        dn = name_from_sku(str(r.get("raw_material_sku", "")))
        by_dn[dn].append(r)

    def score(dn: str) -> int:
        words = [w for w in dn.lower().split() if len(w) >= 2]
        if not words:
            return 0
        return sum(1 for w in words if w in lower)

    best = max(score(dn) for dn in by_dn) if by_dn else 0
    if best <= 0:
        return rows
    keep = {dn for dn in by_dn if score(dn) == best}
    out: List[Dict[str, Any]] = []
    for dn in keep:
        out.extend(by_dn[dn])
    return out


def name_from_sku(sku: str) -> str:
    if not sku:
        return "Unknown Material"
    parts = sku.split("-")
    middle = parts[2:-1] if len(parts) >= 4 else []
    if not middle:
        return sku
    return " ".join(p.capitalize() for p in middle)


def find_mydata_rows_for_message(user_message: str) -> List[Dict[str, Any]]:
    rows = _load_rows()
    if not rows:
        return []

    lower = user_message.lower()

    q_asc = re.search(r'["\']([^"\']{2,120})["\']', user_message)
    q_uni = re.search("\u201c([^\u201d]{2,120})\u201d", user_message)
    quoted = (q_uni or q_asc)
    if quoted:
        ph = quoted.group(1).strip().lower()
        out = []
        for r in rows:
            dn = name_from_sku(str(r.get("raw_material_sku", ""))).lower()
            if dn == ph or ph in dn or all(len(w) < 2 or w in dn for w in ph.split()):
                out.append(r)
        if out:
            return _narrow_rows_to_best_material_phrase(user_message, out)

    by_mid: Dict[int, str] = {}
    for r in rows:
        mid = int(r["raw_material_id"])
        if mid not in by_mid:
            by_mid[mid] = name_from_sku(str(r.get("raw_material_sku", "")))

    hit_ids: List[int] = []
    for mid, disp in sorted(by_mid.items(), key=lambda x: -len(x[1])):
        d = disp.lower()
        if len(d) >= 4 and d in lower:
            hit_ids.append(mid)
    if hit_ids:
        hit_set = set(hit_ids)
        cand = [r for r in rows if int(r["raw_material_id"]) in hit_set]
        return _narrow_rows_to_best_material_phrase(user_message, cand)

    m = re.search(r"raw[_\s]?material[_\s]?id\s*[:#]?\s*(\d+)", user_message, re.I)
    if m:
        rid = int(m.group(1))
        return [r for r in rows if int(r["raw_material_id"]) == rid]

    m2 = re.search(r"\bRM-C\d+-[a-z0-9-]+\b", user_message, re.I)
    if m2:
        target = m2.group(0).lower()
        return [r for r in rows if str(r.get("raw_material_sku", "")).lower() == target]

    return []


def format_mydata_context_block(user_message: str) -> str:
    rows = find_mydata_rows_for_message(user_message)
    if not rows:
        return ""

    seen: Dict[tuple, None] = {}
    uniq: List[Dict[str, Any]] = []
    for r in rows:
        k = (int(r["supplier_id"]), int(r["raw_material_id"]), str(r.get("raw_material_sku")))
        if k in seen:
            continue
        seen[k] = None
        uniq.append(r)

    # Group for the model: human facts only — no filenames or internal column dumps.
    by_material: Dict[str, set[str]] = defaultdict(set)
    for r in uniq:
        sku = r.get("raw_material_sku", "")
        dn = name_from_sku(str(sku))
        by_material[dn].add(str(r.get("supplier_name") or "").strip())

    lines: List[str] = [
        "Verified procurement relationships (same data as in-app Search / BOM):",
    ]
    for dn in sorted(by_material.keys()):
        names = sorted(by_material[dn])
        if names:
            lines.append(f"- {dn}: {', '.join(names)}")
    lines.append(
        "There are no unit prices in this dataset. "
        "In your reply, do not mention JSON files, row counts, raw_material_id, supplier_id, or RM-C SKUs unless the user asks for technical identifiers."
    )
    return "\n".join(lines)


def fallback_answer_from_mydata(user_message: str) -> Optional[str]:
    """Natural-language answer when SQLite has no match but procurement JSON does."""
    rows = find_mydata_rows_for_message(user_message)
    if not rows:
        return None

    by_mat: Dict[str, set[str]] = defaultdict(set)
    for r in rows:
        sku = str(r.get("raw_material_sku", ""))
        dn = name_from_sku(sku)
        name = str(r.get("supplier_name") or "").strip()
        if name:
            by_mat[dn].add(name)

    if not by_mat:
        return None

    msg_l = user_message.lower()
    wants_supplier = bool(
        re.search(r"\b(who|which|supplier|suppliers|supply|supplies|source|sources|vendor|vendors)\b", msg_l)
    )
    asks_price = bool(re.search(r"\b(price|cost|cheap|cheapest|\$|€|£)\b", msg_l))

    parts: List[str] = []
    if asks_price:
        parts.append(
            "Our procurement records here do not include unit prices — only which suppliers are linked to which materials."
        )

    # Prefer the longest material label that reads like the user’s topic (clearer than listing every id variant).
    mat_keys = sorted(by_mat.keys(), key=len, reverse=True)
    primary_mat = mat_keys[0] if mat_keys else "that material"
    all_sups = sorted({s for names in by_mat.values() for s in names})

    if wants_supplier and len(by_mat) == 1:
        names = sorted(by_mat[primary_mat])
        if len(names) == 1:
            parts.append(f"{names[0]} is listed as a supplier for {primary_mat}.")
        elif len(names) == 2:
            parts.append(f"{names[0]} and {names[1]} are listed as suppliers for {primary_mat}.")
        else:
            parts.append(
                f"For {primary_mat}, our records list these suppliers: {', '.join(names[:-1])}, and {names[-1]}."
            )
    elif wants_supplier:
        bits = []
        for dn in sorted(by_mat.keys()):
            nms = sorted(by_mat[dn])
            bits.append(f"{dn}: {', '.join(nms)}")
        parts.append("Per our procurement data: " + "; ".join(bits) + ".")
    else:
        if len(all_sups) <= 3:
            suplist = ", ".join(all_sups)
            parts.append(f"For {primary_mat}, suppliers in our records include {suplist}.")
        else:
            parts.append(
                f"For {primary_mat}, our records include multiple supplier links ({len(all_sups)} distinct suppliers)."
            )

    if not asks_price and not re.search(
        r"\bsubstitut|alternativ|replace\b|single[\s-]?source|sole supplier|concentration|dependency\b",
        msg_l,
    ):
        parts.append("Pricing is not available in this dataset.")

    return " ".join(parts)
