import sqlite3
from pathlib import Path
from typing import Dict, List, Optional, Set

_ROOT = Path(__file__).resolve().parent.parent
DB_PATH = str(_ROOT / "data" / "db.sqlite")


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def get_raw_materials() -> List[Dict]:
    conn = get_connection()
    rows = conn.execute("""
        SELECT Id, SKU
        FROM Product
        WHERE Type = 'raw-material'
        ORDER BY SKU
    """).fetchall()
    conn.close()
    return [{"id": row["Id"], "name": row["SKU"]} for row in rows]


def get_material_by_id(material_id: int) -> Optional[Dict]:
    conn = get_connection()
    row = conn.execute("""
        SELECT Id, SKU, CompanyId, Type
        FROM Product
        WHERE Id = ?
    """, (material_id,)).fetchone()
    conn.close()

    if not row:
        return None

    return {
        "id": row["Id"],
        "name": row["SKU"],
        "company_id": row["CompanyId"],
        "type": row["Type"],
    }


def get_finished_products_for_material(material_id: int) -> Set[int]:
    conn = get_connection()
    rows = conn.execute("""
        SELECT DISTINCT p.Id
        FROM BOM_Component bc
        JOIN BOM b ON b.Id = bc.BOMId
        JOIN Product p ON p.Id = b.ProducedProductId
        WHERE bc.ConsumedProductId = ?
    """, (material_id,)).fetchall()
    conn.close()
    return {row["Id"] for row in rows}


def get_neighbor_materials(material_id: int) -> Set[int]:
    conn = get_connection()
    rows = conn.execute("""
        SELECT DISTINCT bc2.ConsumedProductId
        FROM BOM_Component bc1
        JOIN BOM_Component bc2 ON bc1.BOMId = bc2.BOMId
        WHERE bc1.ConsumedProductId = ?
          AND bc2.ConsumedProductId != ?
    """, (material_id, material_id)).fetchall()
    conn.close()
    return {row["ConsumedProductId"] for row in rows}


def get_suppliers_for_material(material_id: int) -> List[Dict]:
    conn = get_connection()
    rows = conn.execute("""
        SELECT DISTINCT s.Id, s.Name
        FROM Supplier_Product sp
        JOIN Supplier s ON s.Id = sp.SupplierId
        WHERE sp.ProductId = ?
    """, (material_id,)).fetchall()
    conn.close()
    return [{"supplier_id": row["Id"], "supplier_name": row["Name"]} for row in rows]


def get_materials_for_supplier(supplier_id: int) -> Set[int]:
    conn = get_connection()
    rows = conn.execute("""
        SELECT DISTINCT ProductId
        FROM Supplier_Product
        WHERE SupplierId = ?
    """, (supplier_id,)).fetchall()
    conn.close()
    return {row["ProductId"] for row in rows}


def material_has_bom_usage(material_id: int) -> bool:
    conn = get_connection()
    row = conn.execute("""
        SELECT 1
        FROM BOM_Component
        WHERE ConsumedProductId = ?
        LIMIT 1
    """, (material_id,)).fetchone()
    conn.close()
    return row is not None


def material_id_exists(material_id: int) -> bool:
    conn = get_connection()
    row = conn.execute(
        "SELECT 1 FROM Product WHERE Id = ? AND Type = 'raw-material'",
        (material_id,),
    ).fetchone()
    conn.close()
    return row is not None


def search_raw_materials_by_terms(terms: List[str], limit: int = 16) -> List[Dict]:
    """Case-insensitive SKU substring match for any term."""
    terms = [t.strip().lower() for t in terms if t and len(t.strip()) >= 2]
    if not terms:
        return []
    conn = get_connection()
    cond = " OR ".join(["LOWER(SKU) LIKE ?" for _ in terms])
    params = [f"%{t}%" for t in terms]
    rows = conn.execute(
        f"""
        SELECT DISTINCT Id, SKU
        FROM Product
        WHERE Type = 'raw-material' AND ({cond})
        ORDER BY SKU
        LIMIT ?
        """,
        params + [limit],
    ).fetchall()
    conn.close()
    return [{"id": row["Id"], "name": row["SKU"]} for row in rows]


def count_raw_materials() -> int:
    conn = get_connection()
    row = conn.execute(
        "SELECT COUNT(*) AS c FROM Product WHERE Type = 'raw-material'"
    ).fetchone()
    conn.close()
    return int(row["c"]) if row else 0
