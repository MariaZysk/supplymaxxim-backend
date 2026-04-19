// ============================================================================
// Real Data Layer — driven exclusively by mydata.json
// This is the source of truth for actual procurement relationships.
// No invented fields. If a field is missing, it stays missing.
// ============================================================================
import rawRows from "./mydata.json";

export type RealRow = {
  company_id: number;
  company_name: string;
  finished_product_id: number;
  finished_product_sku: string;
  bom_id: number;
  raw_material_id: number;
  raw_material_sku: string;
  supplier_id: number;
  supplier_name: string;
};

export const realRows: RealRow[] = rawRows as RealRow[];

// ---------- Derived entities ----------

export type RealCompany = {
  company_id: number;
  company_name: string;
  finished_product_count: number;
  bom_count: number;
  supplier_count: number;
};

export type RealFinishedProduct = {
  finished_product_id: number;
  finished_product_sku: string;
  company_id: number;
  company_name: string;
  bom_id: number;
  raw_material_count: number;
  supplier_count: number;
};

export type RealRawMaterial = {
  raw_material_id: number;
  raw_material_sku: string;
  /** human-readable name parsed from the SKU pattern RM-Cx-<name>-<hash> */
  display_name: string;
  supplier_count: number;
  used_in_bom_count: number;
};

export type RealSupplier = {
  supplier_id: number;
  supplier_name: string;
  raw_material_count: number;
  bom_count: number;
  finished_product_count: number;
};

// SKU like "RM-C2-soy-lecithin-cc38c49d" → "Soy Lecithin"
export function nameFromSku(sku: string): string {
  if (!sku) return "Unknown Material";
  const parts = sku.split("-");
  // strip RM, Cx, trailing hash
  const middle = parts.slice(2, -1);
  if (middle.length === 0) return sku;
  return middle
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

// Lazy-built indexes
let _companies: RealCompany[] | null = null;
let _products: RealFinishedProduct[] | null = null;
let _materials: RealRawMaterial[] | null = null;
let _suppliers: RealSupplier[] | null = null;

export function getRealCompanies(): RealCompany[] {
  if (_companies) return _companies;
  const m = new Map<number, { name: string; products: Set<number>; boms: Set<number>; suppliers: Set<number> }>();
  for (const r of realRows) {
    const e = m.get(r.company_id) ?? { name: r.company_name, products: new Set(), boms: new Set(), suppliers: new Set() };
    e.products.add(r.finished_product_id);
    e.boms.add(r.bom_id);
    e.suppliers.add(r.supplier_id);
    m.set(r.company_id, e);
  }
  _companies = Array.from(m.entries()).map(([id, e]) => ({
    company_id: id,
    company_name: e.name,
    finished_product_count: e.products.size,
    bom_count: e.boms.size,
    supplier_count: e.suppliers.size,
  }));
  return _companies;
}

export function getRealFinishedProducts(): RealFinishedProduct[] {
  if (_products) return _products;
  const m = new Map<number, { row: RealRow; mats: Set<number>; sups: Set<number> }>();
  for (const r of realRows) {
    const e = m.get(r.finished_product_id) ?? { row: r, mats: new Set(), sups: new Set() };
    e.mats.add(r.raw_material_id);
    e.sups.add(r.supplier_id);
    m.set(r.finished_product_id, e);
  }
  _products = Array.from(m.values()).map((e) => ({
    finished_product_id: e.row.finished_product_id,
    finished_product_sku: e.row.finished_product_sku,
    company_id: e.row.company_id,
    company_name: e.row.company_name,
    bom_id: e.row.bom_id,
    raw_material_count: e.mats.size,
    supplier_count: e.sups.size,
  }));
  return _products;
}

export function getRealRawMaterials(): RealRawMaterial[] {
  if (_materials) return _materials;
  const m = new Map<number, { sku: string; sups: Set<number>; boms: Set<number> }>();
  for (const r of realRows) {
    const e = m.get(r.raw_material_id) ?? { sku: r.raw_material_sku, sups: new Set(), boms: new Set() };
    e.sups.add(r.supplier_id);
    e.boms.add(r.bom_id);
    m.set(r.raw_material_id, e);
  }
  _materials = Array.from(m.entries()).map(([id, e]) => ({
    raw_material_id: id,
    raw_material_sku: e.sku,
    display_name: nameFromSku(e.sku),
    supplier_count: e.sups.size,
    used_in_bom_count: e.boms.size,
  }));
  return _materials;
}

export function getRealSuppliers(): RealSupplier[] {
  if (_suppliers) return _suppliers;
  const m = new Map<number, { name: string; mats: Set<number>; boms: Set<number>; products: Set<number> }>();
  for (const r of realRows) {
    const e = m.get(r.supplier_id) ?? { name: r.supplier_name, mats: new Set(), boms: new Set(), products: new Set() };
    e.mats.add(r.raw_material_id);
    e.boms.add(r.bom_id);
    e.products.add(r.finished_product_id);
    m.set(r.supplier_id, e);
  }
  _suppliers = Array.from(m.entries()).map(([id, e]) => ({
    supplier_id: id,
    supplier_name: e.name,
    raw_material_count: e.mats.size,
    bom_count: e.boms.size,
    finished_product_count: e.products.size,
  }));
  return _suppliers;
}

// Lookups
export function getRowsByMaterial(materialId: number): RealRow[] {
  return realRows.filter((r) => r.raw_material_id === materialId);
}
export function getRowsByBom(bomId: number): RealRow[] {
  return realRows.filter((r) => r.bom_id === bomId);
}
export function getRowsBySupplier(supplierId: number): RealRow[] {
  return realRows.filter((r) => r.supplier_id === supplierId);
}

// Real KPI metrics — these are FACTUAL counts from the dataset.
export function getRealKpis() {
  return {
    companies: getRealCompanies().length,
    finished_products: getRealFinishedProducts().length,
    boms: new Set(realRows.map((r) => r.bom_id)).size,
    raw_materials: getRealRawMaterials().length,
    suppliers: getRealSuppliers().length,
    relationships: realRows.length,
  };
}
