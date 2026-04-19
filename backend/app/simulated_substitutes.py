"""
Simulated procurement substitute flow — multi-turn filtering (supplier, region, BOM).
Mirrors frontend/src/lib/chatSimulatedSubstitutes.ts and mock Calcium Carbonate rows.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, TypedDict

DETAIL_THRESHOLD = 5

_CATALOG = [
    {
        "name": "Magnesium Glycinate",
        "suppliers": [
            {
                "supplier": "BluePeak Ingredients",
                "substitutes": ["Magnesium Citrate", "Magnesium Malate"],
            },
        ],
    },
    {
        "name": "Whey Protein Isolate",
        "suppliers": [
            {
                "supplier": "Alpine Dairy Co.",
                "substitutes": ["Pea Protein Isolate", "Casein Concentrate"],
            },
        ],
    },
    {
        "name": "Lithium Carbonate",
        "suppliers": [
            {
                "supplier": "Andes Lithium Corp",
                "substitutes": ["Lithium Hydroxide", "Sodium-Ion Precursor"],
            },
        ],
    },
    {
        "name": "Electronic-Grade Silicon",
        "suppliers": [
            {
                "supplier": "Tokyo Crystal Works",
                "substitutes": ["Polycrystalline Silicon"],
            },
        ],
    },
    {
        "name": "Extra Virgin Olive Oil",
        "suppliers": [
            {
                "supplier": "Andalusia Groves",
                "substitutes": ["Greek EVOO"],
            },
        ],
    },
]


class SubstituteFilters(TypedDict, total=False):
    supplier: str
    region: str
    bom: str


def _is_substitute_question(message: str) -> bool:
    return bool(re.search(r"\bsubstitut|alternativ|replac|switch\b", message, re.I))


def _extract_material_hint(message: str) -> Optional[str]:
    t = message.strip()
    m = re.search("\u201c([^\u201d]{2,120})\u201d", t)
    if m:
        return m.group(1).strip()
    m = re.search(r'["\']([^"\']{2,120})["\']', t)
    if m:
        return m.group(1).strip()
    m = re.search(
        r"\b(?:substitutes?|alternatives?|replacement|replacements?)\s+for\s+(.+?)(?:\?|$)",
        t,
        re.I,
    )
    if m:
        return m.group(1).strip().rstrip(".")
    m = re.search(r"\bfor\s+(.+?)(?:\s*\?|\s*$|\.)", t, re.I)
    if m and _is_substitute_question(t):
        return m.group(1).strip().rstrip(".")
    names = sorted({e["name"] for e in _CATALOG} | {"Calcium Carbonate"}, key=len, reverse=True)
    lower = t.lower()
    for n in names:
        if len(n) >= 4 and n.lower() in lower:
            return n
    return None


def _find_catalog_entry(hint: str) -> Optional[Dict[str, Any]]:
    hl = hint.lower().strip()
    for entry in _CATALOG:
        n = entry["name"].lower()
        if n == hl or n in hl or hl in n:
            return entry
    return None


def _jost_subs() -> List[Dict[str, Any]]:
    return [
        {
            "name": "Sucralose",
            "compatibility_score": 0.55,
            "cost_impact": "+2%",
            "risk_impact": "+4%",
            "lead_time_impact": "+3d",
            "confidence": 0.59,
            "rationale": "",
        },
        {
            "name": "Zinc Oxide",
            "compatibility_score": 0.61,
            "cost_impact": "+8%",
            "risk_impact": "-2%",
            "lead_time_impact": "+1d",
            "confidence": 0.68,
            "rationale": "",
        },
        {
            "name": "Vitamin D3 Cholecalciferol",
            "compatibility_score": 0.72,
            "cost_impact": "+5%",
            "risk_impact": "-4%",
            "lead_time_impact": "+0d",
            "confidence": 0.74,
            "rationale": "",
        },
    ]


def _pure_subs() -> List[Dict[str, Any]]:
    return [
        {
            "name": "Milk Protein",
            "compatibility_score": 0.71,
            "cost_impact": "+6%",
            "risk_impact": "-5%",
            "lead_time_impact": "+2d",
            "confidence": 0.76,
            "rationale": "",
        },
        {
            "name": "Whey Protein Isolate",
            "compatibility_score": 0.64,
            "cost_impact": "+12%",
            "risk_impact": "-3%",
            "lead_time_impact": "+1d",
            "confidence": 0.7,
            "rationale": "",
        },
        {
            "name": "Hydroxypropyl Methylcellulose",
            "compatibility_score": 0.58,
            "cost_impact": "-4%",
            "risk_impact": "+8%",
            "lead_time_impact": "+0d",
            "confidence": 0.62,
            "rationale": "",
        },
    ]


def _build_calcium_carbonate_rows() -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    rows.append(
        {
            "company_id": "C900",
            "company_name": "One A Day",
            "finished_product_id": "FP9001",
            "finished_product_name": "One A Day Daily Tablet",
            "finished_product_sku": "FG-costco-100143268",
            "bom_id": "BOM-118",
            "raw_material_id": "RM-1105",
            "raw_material_name": "Calcium Carbonate",
            "raw_material_sku": "RM-CC-1105",
            "supplier_id": "19",
            "supplier_name": "Jost Chemical",
            "region": "United States",
            "substitute_options": _jost_subs(),
        }
    )
    rows.append(
        {
            "company_id": "C900",
            "company_name": "One A Day",
            "finished_product_id": "FP9001",
            "finished_product_name": "One A Day Daily Tablet",
            "finished_product_sku": "FG-costco-100143268",
            "bom_id": "BOM-118",
            "raw_material_id": "RM-1105",
            "raw_material_name": "Calcium Carbonate",
            "raw_material_sku": "RM-CC-1105",
            "supplier_id": "28",
            "supplier_name": "Jost Chemical",
            "region": "United States",
            "substitute_options": _jost_subs(),
        }
    )
    for i in range(2, 41):
        jost = i < 24
        rows.append(
            {
                "company_id": f"C{900 + (i % 5)}",
                "company_name": "One A Day" if i % 7 == 0 else "NutraSphere Labs",
                "finished_product_id": f"FP{8000 + i}",
                "finished_product_name": "One A Day Daily Tablet" if i % 7 == 0 else "Calcium Plus Tablet",
                "finished_product_sku": "FG-costco-100143268" if i % 7 == 0 else f"amazon-FP{8000 + i}",
                "bom_id": f"BOM-{4000 + i}",
                "raw_material_id": "RM-1105",
                "raw_material_name": "Calcium Carbonate",
                "raw_material_sku": "RM-CC-1105",
                "supplier_id": f"SUP-JOST-{i}" if jost else f"SUP-PB-{i}",
                "supplier_name": "Jost Chemical" if jost else "PureBulk",
                "region": "Germany" if i % 3 == 0 else "United States",
                "substitute_options": _jost_subs() if jost else _pure_subs(),
            }
        )
    return rows


def _all_simulated_procurement_rows() -> List[Dict[str, Any]]:
    return _build_calcium_carbonate_rows()


def _rows_for_material(material: str) -> List[Dict[str, Any]]:
    h = material.lower().strip()
    out: List[Dict[str, Any]] = []
    for r in _all_simulated_procurement_rows():
        n = str(r.get("raw_material_name", "")).lower()
        if n == h or n in h or h in n:
            out.append(r)
    return out


def _parse_filters(text: str) -> SubstituteFilters:
    out: SubstituteFilters = {}
    m = re.search(r"supplier\s*[:=]\s*([^\n]+)", text, re.I)
    if m:
        out["supplier"] = m.group(1).strip()
    m2 = re.search(r"region\s*[:=]\s*([^\n]+)", text, re.I)
    if m2:
        out["region"] = m2.group(1).strip()
    m3 = re.search(r"bom\s*[:=]\s*([^\n]+)", text, re.I)
    if m3:
        out["bom"] = m3.group(1).strip()
    if "bom" not in out:
        m4 = re.search(r"\bbom\s*[-#]?\s*(\d+)", text, re.I)
        if m4:
            out["bom"] = m4.group(1)
    return out


def _normalize_bom(s: str) -> str:
    return re.sub(r"\D", "", re.sub(r"^BOM-?", "", s, flags=re.I))


def _fuzzy_supplier_match(supplier_name: str, filter_s: str) -> bool:
    a = supplier_name.lower().strip()
    b = filter_s.lower().strip()
    if not b:
        return True
    if b in a or a in b:
        return True
    if len(b) >= 4 and b[:4] in a:
        return True
    if "jost" in a and "josh" in b:
        return True
    return False


def _apply_filters(rows: List[Dict[str, Any]], f: SubstituteFilters) -> List[Dict[str, Any]]:
    out = rows
    if f.get("supplier"):
        sup = f["supplier"]
        out = [r for r in out if _fuzzy_supplier_match(str(r.get("supplier_name", "")), sup)]
    if f.get("region"):
        rl = f["region"].lower()
        out = [r for r in out if rl in str(r.get("region", "")).lower()]
    if f.get("bom"):
        want = _normalize_bom(f["bom"])
        tmp: List[Dict[str, Any]] = []
        for r in out:
            bid = str(r.get("bom_id", ""))
            if want in _normalize_bom(bid) or f["bom"].lower() in bid.lower():
                tmp.append(r)
        out = tmp
    return out


def _accumulate_filters_after_substitute(history: List[Dict[str, str]], message: str) -> SubstituteFilters:
    turns = list(history) + [{"role": "user", "content": message}]
    sub_idx = -1
    for i, t in enumerate(turns):
        if t.get("role") == "user" and _is_substitute_question(str(t.get("content", ""))):
            sub_idx = i
    merged: SubstituteFilters = {}
    if sub_idx < 0:
        return merged
    for i in range(sub_idx + 1, len(turns)):
        if turns[i].get("role") == "user":
            merged.update(_parse_filters(str(turns[i].get("content", ""))))
    return merged


def _resolve_material(message: str, history: List[Dict[str, str]]) -> Optional[str]:
    if _is_substitute_question(message):
        return _extract_material_hint(message)
    for t in reversed(history):
        if t.get("role") == "user" and _is_substitute_question(str(t.get("content", ""))):
            return _extract_material_hint(str(t.get("content", "")))
    return None


def _is_substitute_follow_up(message: str, history: List[Dict[str, str]]) -> bool:
    if _is_substitute_question(message):
        return False
    if not history:
        return False
    for t in reversed(history):
        if t.get("role") == "assistant":
            c = str(t.get("content", ""))
            return bool(
                re.search(
                    r"Simulated database|narrow further|more information|filter|supplier|region|BOM",
                    c,
                    re.I,
                )
            )
    return False


def _format_detail_block(r: Dict[str, Any]) -> str:
    lines = [
        f"Company: {r.get('company_name', '')}",
        f"Finished Product: {r.get('finished_product_name', '')}",
        f"Finished Product SKU: {r.get('finished_product_sku', '')}",
        f"Supplier: {r.get('supplier_name', '')}",
        f"Supplier ID: #{r.get('supplier_id', '')}",
        f"BOM ID: {r.get('bom_id', '')}",
        f"Region: {r.get('region', '')}",
    ]
    return "\n".join(lines)


def _describe_filters(f: SubstituteFilters) -> str:
    bits: List[str] = []
    if f.get("supplier"):
        bits.append(f"supplier \"{f['supplier']}\"")
    if f.get("region"):
        bits.append(f"region \"{f['region']}\"")
    if f.get("bom"):
        bits.append(f"BOM \"{f['bom']}\"")
    if not bits:
        return ""
    return " with " + ", ".join(bits)


def _suggest_more(f: SubstituteFilters) -> str:
    parts: List[str] = []
    if not f.get("supplier"):
        parts.append("supplier")
    if not f.get("region"):
        parts.append("region")
    if not f.get("bom"):
        parts.append("BOM")
    if not parts:
        return "a more specific BOM or supplier ID"
    return ", ".join(parts)


def _format_detail_list(rows: List[Dict[str, Any]], material: str) -> str:
    head = (
        f"Found {len(rows)} result{'s' if len(rows) != 1 else ''} for {material} in the Simulated database:\n\n"
    )
    blocks = [_format_detail_block(r) for r in rows]
    return head + "\n\n---\n\n".join(blocks)


def answer_simulated_substitutes(
    user_message: str,
    history: Optional[List[Dict[str, str]]] = None,
) -> Optional[str]:
    history = history or []

    material = _resolve_material(user_message, history)
    if not material:
        hint = _extract_material_hint(user_message)
        if hint and _find_catalog_entry(hint) and _is_substitute_question(user_message):
            entry = _find_catalog_entry(hint)
            assert entry is not None
            display = str(entry["name"])
            lines = []
            for row in entry["suppliers"]:
                sup = str(row["supplier"])
                subs = ", ".join(str(s) for s in row["substitutes"])
                lines.append(f"{display} supplied by {sup}: {subs}")
            n = len(lines)
            head = f"No results in Real database, but found {n} result{'s' if n != 1 else ''} for {display}:"
            return head + "\n\n" + "\n\n".join(lines)
        return None

    rows = _rows_for_material(material)
    if not rows:
        if _is_substitute_question(user_message):
            entry = _find_catalog_entry(material)
            if entry:
                display = str(entry["name"])
                lines = []
                for row in entry["suppliers"]:
                    sup = str(row["supplier"])
                    subs = ", ".join(str(s) for s in row["substitutes"])
                    lines.append(f"{display} supplied by {sup}: {subs}")
                n = len(lines)
                head = f"No results in Real database, but found {n} result{'s' if n != 1 else ''} for {display}:"
                return head + "\n\n" + "\n\n".join(lines)
        return None

    has_filter_only = bool(_parse_filters(user_message))
    has_prior_substitute = any(
        t.get("role") == "user" and _is_substitute_question(str(t.get("content", ""))) for t in history
    )
    in_flow = (
        _is_substitute_question(user_message)
        or _is_substitute_follow_up(user_message, history)
        or (has_filter_only and has_prior_substitute)
    )
    if not in_flow:
        return None

    filters = _accumulate_filters_after_substitute(history, user_message)
    filtered = _apply_filters(rows, filters)

    if len(filters) == 0 and len(rows) <= DETAIL_THRESHOLD and _is_substitute_question(user_message):
        return "No results in Real database. " + _format_detail_list(rows, material)

    if len(filters) == 0 and len(rows) > DETAIL_THRESHOLD and _is_substitute_question(user_message):
        return (
            "No results in Real database, but found "
            f"{len(rows)} results for {material} in the Simulated database. "
            "Would you like to provide more information (supplier, region, BOM, etc.)?"
        )

    if not filtered:
        return (
            "No rows match those filters in the Simulated database. "
            "Try a different supplier name (e.g. spelling), region, or BOM ID."
        )

    if len(filtered) > DETAIL_THRESHOLD:
        extra = _describe_filters(filters)
        return (
            f"Found {len(filtered)} results for {material}{extra} in the Simulated database. "
            f"Would you like to narrow further (e.g. {_suggest_more(filters)})?"
        )

    extra = _describe_filters(filters)
    return (
        f"Found {len(filtered)} result{'s' if len(filtered) != 1 else ''} for {material}{extra} in the Simulated database:\n\n"
        + "\n\n---\n\n".join(_format_detail_block(r) for r in filtered)
    )


def format_simulated_substitutes_context(user_message: str) -> str:
    """Compact facts for the LLM (legacy catalog + note about multi-turn)."""
    if not _is_substitute_question(user_message):
        return ""
    hint = _extract_material_hint(user_message)
    if not hint:
        return ""
    rows = _rows_for_material(hint)
    if rows:
        parts = [
            "Simulated procurement rows for this material (demo; filter by supplier/region/BOM in chat):",
            f"- {hint}: {len(rows)} row(s) in simulated substitute dataset.",
        ]
        return "\n".join(parts)
    entry = _find_catalog_entry(hint)
    if not entry:
        return ""
    parts = ["Simulated substitution candidates (demo dataset; not in Real mydata):"]
    for row in entry["suppliers"]:
        sup = row["supplier"]
        subs = ", ".join(row["substitutes"])
        parts.append(f"- {entry['name']} @ {sup}: {subs}")
    return "\n".join(parts)
