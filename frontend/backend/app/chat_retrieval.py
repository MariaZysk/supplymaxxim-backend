"""
Build retrieval context for the procurement chatbot from SQLite.
Keeps answers grounded in dataset lookups (materials, suppliers, BOM signals).
"""

from __future__ import annotations

import re
from typing import Dict, List, Optional, Tuple

from .mydata_json import fallback_answer_from_mydata, format_mydata_context_block
from .simulated_substitutes import (
    answer_simulated_substitutes,
    format_simulated_substitutes_context,
)
from .db import (
    count_raw_materials,
    get_finished_products_for_material,
    get_material_by_id,
    get_neighbor_materials,
    get_suppliers_for_material,
    material_has_bom_usage,
    material_id_exists,
    search_raw_materials_by_terms,
)
from .features import (
    data_completeness_score,
    finished_product_overlap,
    neighbor_material_overlap,
    supplier_coverage_score,
    supporting_evidence_points,
)
from .scoring import (
    calculate_bom_context_similarity,
    calculate_feasibility,
    calculate_replaceability,
    calculate_supporting_evidence_score,
    evidence_label,
    get_recommendation,
)

_STOPWORDS = frozenset(
    """
    the a an is are was were be been being to of and or for in on at by with from as if it its this that these those
    what when where which who whom how why can could should would may might will shall must
    any some we you i they them their our your my me us his her he she
    do does did done doing not no yes so than then there here about into over after before
    get got also just only even ever both each few more most other such same than too very
    give using use ask help please tell want need like best well make made
    """.split()
)


def _tokens(message: str) -> List[str]:
    raw = re.findall(r"[A-Za-z0-9][A-Za-z0-9\-_.]*", message)
    out: List[str] = []
    for t in raw:
        tl = t.lower()
        if len(tl) < 3 or tl in _STOPWORDS:
            continue
        out.append(tl)
    return out


def _extract_number_hints(message: str) -> List[str]:
    hints: List[str] = []
    for m in re.finditer(r"\bRM[-\s]?(\d+)\b", message, re.IGNORECASE):
        hints.append(m.group(1))
    for m in re.finditer(r"\b(?:material|sku|id)[:\s#-]*(\d{1,8})\b", message, re.IGNORECASE):
        hints.append(m.group(1))
    for m in re.finditer(r"\b(\d{3,8})\b", message):
        hints.append(m.group(1))
    seen = set()
    uniq: List[str] = []
    for h in hints:
        if h not in seen:
            seen.add(h)
            uniq.append(h)
    return uniq[:12]


def _resolve_material_ids(message: str) -> List[int]:
    ids: List[int] = []
    for h in _extract_number_hints(message):
        if h.isdigit() and material_id_exists(int(h)):
            ids.append(int(h))
    # de-dupe preserving order
    seen: set[int] = set()
    out: List[int] = []
    for i in ids:
        if i not in seen:
            seen.add(i)
            out.append(i)
    return out


def _search_ids_from_keywords(message: str) -> List[int]:
    terms = _tokens(message)
    hits: List[int] = []
    if not terms:
        return []
    rows = search_raw_materials_by_terms(terms, limit=20)
    for row in rows:
        hits.append(int(row["id"]))
    # unique preserve order
    seen: set[int] = set()
    out: List[int] = []
    for i in hits:
        if i not in seen:
            seen.add(i)
            out.append(i)
    return out


def pick_material_ids_for_context(message: str, max_ids: int = 3) -> Tuple[List[int], str]:
    """
    Returns (material_ids, retrieval_note) describing how matches were chosen.
    """
    direct = _resolve_material_ids(message)
    if direct:
        return direct[:max_ids], "matched numeric material id / RM-* hint in the question"
    kw = _search_ids_from_keywords(message)
    if kw:
        return kw[:max_ids], "matched SKU keywords from the question"
    return [], "no specific material matched — clarify SKU or material id"


def _score_supplier_lines(material_id: int, limit: int = 6) -> List[str]:
    original = get_material_by_id(material_id)
    if not original:
        return []
    suppliers = get_suppliers_for_material(material_id)
    lines: List[Tuple[float, str]] = []
    option_id = material_id
    option_name = original["name"]

    for supplier in suppliers:
        supplier_id = supplier["supplier_id"]
        supplier_name = supplier["supplier_name"]
        fo = finished_product_overlap(material_id, option_id)
        no = neighbor_material_overlap(material_id, option_id)
        bom_sim = calculate_bom_context_similarity(fo, no)
        coverage = supplier_coverage_score(supplier_id, material_id)
        replaceability = calculate_replaceability(bom_sim, coverage)
        ev_pts = supporting_evidence_points(supplier_id, material_id, option_id)
        ev_lbl = evidence_label(ev_pts)
        ev_score = calculate_supporting_evidence_score(ev_pts)
        completeness = data_completeness_score(supplier_id, option_id, material_id)
        feasibility = calculate_feasibility(completeness, ev_score, replaceability)
        recommendation = get_recommendation(replaceability, ev_lbl, feasibility)
        lines.append(
            (
                replaceability,
                f"- {supplier_name} (supplier id {supplier_id}): "
                f"recommendation={recommendation}, replaceability={replaceability:.1f}, "
                f"evidence={ev_lbl} ({ev_pts}/5), feasibility={feasibility:.1f}",
            )
        )
    lines.sort(key=lambda x: -x[0])
    return [t[1] for t in lines[:limit]]


def build_data_context(user_message: str) -> str:
    """Plain-text block injected into the LLM (or used for fallback summaries)."""
    sim = format_simulated_substitutes_context(user_message)
    mydata = format_mydata_context_block(user_message)
    total_m = count_raw_materials()
    mids, note = pick_material_ids_for_context(user_message, max_ids=3)
    parts: List[str] = []
    if sim.strip():
        parts.append(
            "SIMULATED DATABASE — demo substitute catalog (not in Real mydata.json; same idea as in-app Simulated mode):"
        )
        parts.append(sim)
        parts.append("---")
    if mydata.strip():
        parts.append("PRIMARY SOURCE — verified procurement relationships (same facts as Search / BOM; use for supplier names):")
        parts.append(mydata)
        parts.append("---")
    parts.append(f"SQLite analytic DB: {total_m} raw materials in Product.")
    parts.append(f"SQLite retrieval note: {note}.")

    if not mids:
        parts.append(
            "No material row selected. The user may be asking a general question; "
            "if they need lookups, ask them for a material SKU or numeric Id."
        )
        return "\n".join(parts)

    for mid in mids:
        mat = get_material_by_id(mid)
        if not mat:
            continue
        sups = get_suppliers_for_material(mid)
        fps = get_finished_products_for_material(mid)
        neigh = get_neighbor_materials(mid)
        bom = material_has_bom_usage(mid)
        parts.append(f"\nMaterial id {mat['id']}, SKU: {mat['name']}")
        parts.append(
            f"- BOM usage: {'yes' if bom else 'no'}; "
            f"finished products using this RM: {len(fps)}; "
            f"neighbor materials on shared BOMs: {len(neigh)}"
        )
        if sups:
            names = ", ".join(s["supplier_name"] for s in sups[:12])
            extra = f" (+{len(sups) - 12} more)" if len(sups) > 12 else ""
            parts.append(f"- Suppliers covering this SKU ({len(sups)}): {names}{extra}")
            parts.append("Ranked supplier signals (same scoring as /api/recommend):")
            parts.extend(_score_supplier_lines(mid, limit=8))
        else:
            parts.append("- No suppliers linked in Supplier_Product for this material.")

    return "\n".join(parts)


def fallback_reply(
    user_message: str,
    data_context: str,
    history: Optional[List[Dict[str, str]]] = None,
) -> str:
    """Deterministic answer when LLM is unavailable."""
    simulated = answer_simulated_substitutes(user_message, history)
    if simulated:
        return simulated

    lowered = user_message.strip().lower()
    mids, _ = pick_material_ids_for_context(user_message, max_ids=1)

    my_hit = fallback_answer_from_mydata(user_message)
    if not mids and my_hit:
        return my_hit

    if not mids:
        return (
            "I do not have a specific material in your question yet. "
            "Which raw material should I look at (paste a SKU fragment, numeric Id, or something like RM-431)?"
        )

    mid = mids[0]
    mat = get_material_by_id(mid)
    if not mat:
        return "That material Id was not found as a raw material in the dataset."

    sups = get_suppliers_for_material(mid)
    if not sups:
        return (
            f"For {mat['name']} (id {mid}), there are no linked suppliers in the database. "
            f"Could you confirm the SKU or pick another material from procurement records?"
        )

    if any(
        w in lowered
        for w in ("best", "recommend", "supplier", "who", "source", "buy", "qualify")
    ):
        ranked = _score_supplier_lines(mid, limit=4)
        top = ranked[0] if ranked else ""
        return (
            f"Here is what the in-app scoring says for {mat['name']} (id {mid}). "
            f"Top line: {top.replace('- ', '') if top else 'See dataset.'} "
            f"If you need more detail, say whether you care most about cost, risk, or dual sourcing."
        )

    if any(w in lowered for w in ("risk", "single", "exposure", "dependence")):
        neigh = len(get_neighbor_materials(mid))
        fps = len(get_finished_products_for_material(mid))
        return (
            f"{mat['name']} (id {mid}) appears on {fps} downstream finished-good path(s) "
            f"(via BOM) and shares BOM context with {neigh} other raw materials. "
            f"Use the ranked supplier list above to see concentration vs alternatives."
        )

    if any(w in lowered for w in ("substitute", "alternative", "replace", "switch")):
        return (
            f"For {mat['name']} (id {mid}), substitution options need a comparable SKU in the BOM graph. "
            f"I can compare suppliers that already list this material; for true substitutes, name a second SKU to compare."
        )

    return (
        f"Using live data for {mat['name']} (id {mid}): {len(sups)} supplier(s) are in scope. "
        f"Ask about best supplier, risk, or substitutes to narrow the answer, "
        f"or paste another SKU to switch context."
    )
    
