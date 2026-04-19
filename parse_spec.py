"""
Agnes — deterministic compliance spec parser
Extracts structured fields from raw scraped markdown using regex only.
Replaces Gemini extraction — zero LLM credits, zero hallucination.
"""

import re


_GRADE_PATTERNS = [
    r'\bUSP\b', r'\bNF\b', r'\bEP\b', r'\bJP\b', r'\bFCC\b', r'\bBP\b',
    r'pharma(?:ceutical)?[\s\-]?grade',
    r'food[\s\-]?grade',
    r'cosmetic[\s\-]?grade',
    r'technical[\s\-]?grade',
    r'reagent[\s\-]?grade',
]

_CERT_PATTERNS = [
    r'\bGMP\b', r'ISO[\s\-]?\d{4,5}', r'\bHalal\b', r'\bKosher\b',
    r'\bOrganic\b', r'\bNSF\b', r'FSSC[\s\-]?\d+', r'\bBRC\b',
    r'USDA[\s\-]?Organic', r'Fair[\s\-]Trade', r'\bVegan\b',
    r'Non[\s\-]?GMO', r'\bHACCP\b', r'\bSQF\b', r'\bIFS\b',
]

_REGULATORY_PATTERNS = [
    r'\bGRAS\b',
    r'FDA[\s\-]?(?:approved|listed|compliant)?',
    r'21[\s]?CFR[\s\d.]+',
    r'EU[\s\-]?(?:approved|listed|compliant)',
    r'\bEFSA\b',
    r'REACH[\s\-]?compliant',
    r'\bE\d{3,4}\b',
    r'INS[\s\-]?\d+',
    r'\bJECFA\b',
]

_FORM_PATTERNS = [
    r'\bpowder\b', r'\bgranules?\b', r'\bpellets?\b', r'\bliquid\b',
    r'\bsolution\b', r'\bcrystalline\b', r'\bcrystals?\b', r'\bmicronized\b',
    r'spray[\s\-]dried', r'\bflakes?\b', r'\bbeads?\b', r'\boil\b',
]

_ALLERGEN_FREE_PATTERNS = [
    r'gluten[\s\-]free', r'dairy[\s\-]free', r'nut[\s\-]free',
    r'soy[\s\-]free', r'egg[\s\-]free', r'wheat[\s\-]free',
    r'allergen[\s\-]free', r'free\s+from\s+(?:major\s+)?allergens?',
]

_SUPPLIER_PATTERNS = [
    r'\bAshland\b', r'\bColorcon\b', r'\bPrinova\b', r'\bBASF\b',
    r'\bDSM\b', r'\bLonza\b', r'\bRoquette\b', r'\bUnivar\b',
    r'\bBrenntag\b', r'\bIngredion\b', r'\bKerry\b', r'\bIFF\b',
    r'\bGivaudan\b', r'\bSymrise\b', r'\bFirmenich\b',
]

_PURITY_PATTERNS = [
    (r'(?:purity|assay|content)\s*:?\s*(\d+\.?\d*)\s*%', 1),
    (r'(\d+\.?\d*)\s*%\s*(?:min(?:imum)?|purity|assay)', 1),
    (r'[≥≧]\s*(\d+\.?\d*)\s*%', 1),
    (r'(\d+\.?\d*)\s*%\s*(?:w/w|v/v)', 1),
]


def _find_all(patterns: list[str], text: str) -> list[str]:
    seen = set()
    results = []
    for pat in patterns:
        for m in re.finditer(pat, text, re.IGNORECASE):
            val = m.group(0).strip()
            key = val.lower()
            if key not in seen:
                seen.add(key)
                results.append(val)
    return results


def _find_purity(text: str) -> float | None:
    values = []
    for pat, group in _PURITY_PATTERNS:
        for m in re.finditer(pat, text, re.IGNORECASE):
            try:
                v = float(m.group(group))
                if 50.0 <= v <= 100.0:
                    values.append(v)
            except (ValueError, IndexError):
                pass
    return max(values) if values else None


def extract(ingredient_name: str, markdown: str) -> dict:
    """
    Deterministic compliance field extractor — no LLM, no hallucination.
    Returns dict matching enrichment_cache schema fields.
    """
    if not markdown or len(markdown.strip()) < 50:
        return {}

    text = markdown[:4000]

    grades       = _find_all(_GRADE_PATTERNS, text)
    certs        = _find_all(_CERT_PATTERNS, text)
    regulatory   = _find_all(_REGULATORY_PATTERNS, text)
    forms        = _find_all(_FORM_PATTERNS, text)
    allergen_free = _find_all(_ALLERGEN_FREE_PATTERNS, text)
    suppliers    = _find_all(_SUPPLIER_PATTERNS, text)
    purity       = _find_purity(text)

    return {
        "grade":            grades[0] if grades else None,
        "purity_percent":   purity,
        "certifications":   certs,
        "regulatory_status": regulatory,
        "available_forms":  forms,
        "allergen_free":    allergen_free,
        "supplier_name":    suppliers[0] if suppliers else None,
        "notes":            None,
    }
