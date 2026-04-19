def calculate_bom_context_similarity(finished_overlap: float, neighbor_overlap: float) -> float:
    return 0.5 * finished_overlap + 0.5 * neighbor_overlap


def calculate_replaceability(bom_context_similarity: float, supplier_coverage: float) -> float:
    return 0.6 * bom_context_similarity + 0.4 * supplier_coverage


def evidence_label(points: int) -> str:
    if points <= 1:
        return "Weak"
    elif points <= 3:
        return "Moderate"
    return "Strong"


def calculate_supporting_evidence_score(points: int) -> float:
    return (points / 5) * 100


def calculate_feasibility(data_completeness: float, evidence_score: float, replaceability: float) -> float:
    return 0.5 * data_completeness + 0.3 * evidence_score + 0.2 * replaceability


def get_recommendation(replaceability: float, evidence_lbl: str, feasibility: float) -> str:
    if replaceability >= 75 and evidence_lbl in ["Moderate", "Strong"] and feasibility >= 70:
        return "Recommended"
    if replaceability >= 55 and evidence_lbl in ["Moderate", "Strong"] and feasibility >= 50:
        return "Needs Review"
    return "Not Recommended"
