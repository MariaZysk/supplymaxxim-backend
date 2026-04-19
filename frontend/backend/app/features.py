from .db import (
    get_finished_products_for_material,
    get_neighbor_materials,
    get_materials_for_supplier,
    material_has_bom_usage,
)


def jaccard(a: set, b: set) -> float:
    if not a and not b:
        return 0.0
    return len(a & b) / len(a | b)


def finished_product_overlap(original_id: int, option_id: int) -> float:
    original_set = get_finished_products_for_material(original_id)
    option_set = get_finished_products_for_material(option_id)
    return jaccard(original_set, option_set) * 100


def neighbor_material_overlap(original_id: int, option_id: int) -> float:
    original_neighbors = get_neighbor_materials(original_id)
    option_neighbors = get_neighbor_materials(option_id)
    return jaccard(original_neighbors, option_neighbors) * 100


def supplier_coverage_score(supplier_id: int, original_id: int) -> float:
    supplier_materials = get_materials_for_supplier(supplier_id)
    original_neighbors = get_neighbor_materials(original_id)

    score = 0

    if original_id in supplier_materials:
        score += 50

    if len(supplier_materials & original_neighbors) > 0:
        score += 30

    if len(supplier_materials) >= 5:
        score += 20

    return min(score, 100)


def supporting_evidence_points(
    supplier_id: int,
    original_id: int,
    option_id: int,
) -> int:
    points = 0

    supplier_materials = get_materials_for_supplier(supplier_id)

    if option_id in supplier_materials:
        points += 1

    if material_has_bom_usage(option_id):
        points += 1

    if finished_product_overlap(original_id, option_id) > 0:
        points += 1

    if neighbor_material_overlap(original_id, option_id) > 0:
        points += 1

    if len(supplier_materials & get_neighbor_materials(original_id)) > 0:
        points += 1

    return points


def data_completeness_score(supplier_id: int, option_id: int, original_id: int) -> float:
    checks = 0
    total = 5

    supplier_materials = get_materials_for_supplier(supplier_id)

    if option_id in supplier_materials:
        checks += 1

    if material_has_bom_usage(option_id):
        checks += 1

    if len(get_finished_products_for_material(option_id)) > 0:
        checks += 1

    if len(get_neighbor_materials(option_id)) > 0:
        checks += 1

    if len(supplier_materials) > 0:
        checks += 1

    return (checks / total) * 100
