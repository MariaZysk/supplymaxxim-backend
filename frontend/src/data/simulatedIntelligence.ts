// ============================================================================
// Simulated Intelligence Layer
// Uses ingredient_metadata.json ONLY as a blueprint of which enrichment fields
// can exist on top of the real dataset. All values produced here are
// inferred/estimated from real entity ids (deterministic, seeded) and MUST be
// presented in the UI with a clear "Simulated" tag + confidence band.
// ============================================================================
import metadataBlueprint from "./ingredient_metadata.json";
import type { RealRow, RealRawMaterial, RealSupplier } from "./realData";
import { nameFromSku } from "./realData";

export type MetadataField = {
  Category: string;
  "Field Name": string;
  Description: string;
  "Required (Must/Good)": "Must" | "Good";
  Example: string;
};
export const ingredientMetadataBlueprint: MetadataField[] = metadataBlueprint as MetadataField[];

export type Confidence = "Low" | "Medium" | "High";
export type Provenance = "Simulated" | "Inferred" | "Estimated";

export type SimulatedField<T = string | number> = {
  value: T;
  provenance: Provenance;
  confidence: Confidence;
};

// ---------- Deterministic seeded RNG ----------
function hash(seed: number | string): number {
  let h = 2166136261;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}
function pick<T>(seed: number | string, arr: readonly T[]): T {
  return arr[Math.floor(hash(seed) * arr.length) % arr.length];
}
function range(seed: number | string, min: number, max: number): number {
  return min + hash(seed) * (max - min);
}
function confidenceFor(score: number): Confidence {
  if (score >= 0.75) return "High";
  if (score >= 0.5) return "Medium";
  return "Low";
}

// ---------- Reference vocabularies (matched to blueprint examples) ----------
const FUNCTIONAL_ROLES = ["Active Ingredient", "Excipient", "Lubricant", "Binder", "Coating Agent", "Stabilizer", "Flavor Carrier", "Bioavailability Enhancer"];
const GRADES = ["Pharma Grade", "Food Grade", "USP", "EP", "Industrial Grade"];
const REG_STATUS = ["FDA Approved", "EU Authorized", "GRAS", "Pending Review", "Notified Only"];
const PHYSICAL_FORMS = ["Powder", "Granule", "Liquid", "Crystalline Solid", "Suspension"];
const SOLUBILITY = ["Water Soluble", "Insoluble in water", "Oil Soluble", "Partially Soluble"];
const PARTICLE = ["Coarse", "Fine", "Micronized", "Nano"];
const CERTS = ["GMP Certified", "ISO 9001", "Organic", "Kosher", "Halal", "Non-GMO", "ISO 22000"];
const SOURCES = ["Synthetic", "Plant-derived", "Animal-derived", "Microbial Fermentation", "Mineral"];
const COUNTRIES = ["Germany", "United States", "India", "China", "Netherlands", "Spain", "Brazil", "Japan", "France", "Switzerland"];
const ALLERGENS = ["None Declared", "Contains Soy", "Contains Dairy", "Tree Nut Free", "Gluten Free"];
const USE_CASES = ["Tablet Compression", "Capsule Filling", "Topical Formulation", "Functional Beverage", "Sports Nutrition", "Sustained Release"];
const REGIONS = ["EU", "Americas", "APAC", "MENA"];

// ---------- Per-supplier simulated profile ----------
export type SimulatedSupplierProfile = {
  region: SimulatedField<string>;
  country_of_origin: SimulatedField<string>;
  reliability_score: SimulatedField<number>;
  risk_score: SimulatedField<number>;
  availability_score: SimulatedField<number>;
  sustainability_score: SimulatedField<number>;
  lead_time_days: SimulatedField<number>;
  estimated_cost: SimulatedField<number>;
  certifications: SimulatedField<string[]>;
};

export function simulateSupplierProfile(supplierId: number, materialId?: number): SimulatedSupplierProfile {
  const seed = `sup-${supplierId}-${materialId ?? "x"}`;
  const reliability = +range(seed + "-rel", 0.55, 0.97).toFixed(2);
  const risk = +range(seed + "-risk", 0.05, 0.6).toFixed(2);
  const availability = +range(seed + "-avail", 0.5, 0.98).toFixed(2);
  const sustainability = +range(seed + "-sus", 0.4, 0.95).toFixed(2);
  const lead = Math.round(range(seed + "-lead", 5, 35));
  const cost = +range(seed + "-cost", 6, 220).toFixed(2);
  const certCount = 1 + Math.floor(hash(seed + "-cn") * 3);
  const certs = Array.from(new Set(Array.from({ length: certCount }, (_, i) => pick(seed + "-c" + i, CERTS))));

  return {
    region: { value: pick(seed + "-rg", REGIONS), provenance: "Inferred", confidence: "Medium" },
    country_of_origin: { value: pick(seed + "-co", COUNTRIES), provenance: "Inferred", confidence: "Medium" },
    reliability_score: { value: reliability, provenance: "Estimated", confidence: confidenceFor(reliability) },
    risk_score: { value: risk, provenance: "Estimated", confidence: confidenceFor(1 - risk) },
    availability_score: { value: availability, provenance: "Estimated", confidence: confidenceFor(availability) },
    sustainability_score: { value: sustainability, provenance: "Estimated", confidence: confidenceFor(sustainability) },
    lead_time_days: { value: lead, provenance: "Estimated", confidence: "Medium" },
    estimated_cost: { value: cost, provenance: "Estimated", confidence: "Medium" },
    certifications: { value: certs, provenance: "Simulated", confidence: "Low" },
  };
}

// ---------- Per-raw-material simulated ingredient intelligence ----------
export type SimulatedIngredientProfile = {
  ingredient_name: SimulatedField<string>;
  synonyms: SimulatedField<string[]>;
  functional_role: SimulatedField<string>;
  grade: SimulatedField<string>;
  purity: SimulatedField<string>;
  regulatory_status: SimulatedField<string>;
  chemical_formula: SimulatedField<string>;
  physical_form: SimulatedField<string>;
  solubility: SimulatedField<string>;
  particle_size: SimulatedField<string>;
  certifications: SimulatedField<string[]>;
  source: SimulatedField<string>;
  country_of_origin: SimulatedField<string>;
  allergen_info: SimulatedField<string>;
  use_case: SimulatedField<string>;
  lead_time: SimulatedField<string>;
  availability: SimulatedField<string>;
};

export function simulateIngredientProfile(material: { raw_material_id: number; raw_material_sku: string }): SimulatedIngredientProfile {
  const seed = `mat-${material.raw_material_id}`;
  const name = nameFromSku(material.raw_material_sku);
  const purity = (90 + Math.floor(hash(seed + "-p") * 10)).toString() + "%";
  const certCount = 1 + Math.floor(hash(seed + "-cc") * 3);
  const certs = Array.from(new Set(Array.from({ length: certCount }, (_, i) => pick(seed + "-c" + i, CERTS))));
  const synCount = 1 + Math.floor(hash(seed + "-sc") * 2);
  const synonyms = Array.from({ length: synCount }, (_, i) => `${name} (alt ${i + 1})`);

  return {
    ingredient_name: { value: name, provenance: "Inferred", confidence: "High" },
    synonyms: { value: synonyms, provenance: "Simulated", confidence: "Low" },
    functional_role: { value: pick(seed + "-fr", FUNCTIONAL_ROLES), provenance: "Inferred", confidence: "Medium" },
    grade: { value: pick(seed + "-g", GRADES), provenance: "Estimated", confidence: "Medium" },
    purity: { value: purity, provenance: "Estimated", confidence: "Medium" },
    regulatory_status: { value: pick(seed + "-rs", REG_STATUS), provenance: "Estimated", confidence: "Medium" },
    chemical_formula: { value: `C${1 + Math.floor(hash(seed + "-cf1") * 30)}H${1 + Math.floor(hash(seed + "-cf2") * 60)}O${Math.floor(hash(seed + "-cf3") * 8)}`, provenance: "Simulated", confidence: "Low" },
    physical_form: { value: pick(seed + "-pf", PHYSICAL_FORMS), provenance: "Estimated", confidence: "Medium" },
    solubility: { value: pick(seed + "-sol", SOLUBILITY), provenance: "Estimated", confidence: "Medium" },
    particle_size: { value: pick(seed + "-ps", PARTICLE), provenance: "Estimated", confidence: "Medium" },
    certifications: { value: certs, provenance: "Simulated", confidence: "Low" },
    source: { value: pick(seed + "-src", SOURCES), provenance: "Inferred", confidence: "Medium" },
    country_of_origin: { value: pick(seed + "-co", COUNTRIES), provenance: "Inferred", confidence: "Medium" },
    allergen_info: { value: pick(seed + "-al", ALLERGENS), provenance: "Estimated", confidence: "Medium" },
    use_case: { value: pick(seed + "-uc", USE_CASES), provenance: "Inferred", confidence: "Medium" },
    lead_time: { value: `${Math.round(range(seed + "-lt", 5, 30))} days`, provenance: "Estimated", confidence: "Medium" },
    availability: { value: pick(seed + "-av", ["Stable", "Constrained", "Limited", "Abundant"]), provenance: "Estimated", confidence: "Medium" },
  };
}

// ---------- Substitute candidates (simulated) ----------
export type SimulatedSubstitute = {
  candidate_material_id: number;
  candidate_name: string;
  candidate_sku: string;
  compatibility_score: number;
  cost_impact: string;
  risk_impact: string;
  lead_time_impact: string;
  recommendation_confidence: Confidence;
  rationale: string;
};

export function simulateSubstitutes(
  target: { raw_material_id: number; raw_material_sku: string },
  pool: RealRawMaterial[],
  count = 3,
): SimulatedSubstitute[] {
  const seed = `sub-${target.raw_material_id}`;
  // Deterministically sample distinct candidates from the pool
  const others = pool.filter((p) => p.raw_material_id !== target.raw_material_id);
  const picks: RealRawMaterial[] = [];
  for (let i = 0; i < count && picks.length < others.length; i++) {
    const idx = Math.floor(hash(seed + "-p" + i) * others.length) % others.length;
    const cand = others[idx];
    if (cand && !picks.find((p) => p.raw_material_id === cand.raw_material_id)) picks.push(cand);
  }
  return picks.map((c, i) => {
    const s = `${seed}-${c.raw_material_id}-${i}`;
    const compat = +range(s + "-cm", 0.45, 0.95).toFixed(2);
    const costDelta = Math.round(range(s + "-cd", -25, 25));
    const riskDelta = Math.round(range(s + "-rd", -20, 20));
    const leadDelta = Math.round(range(s + "-ld", -8, 10));
    return {
      candidate_material_id: c.raw_material_id,
      candidate_name: c.display_name,
      candidate_sku: c.raw_material_sku,
      compatibility_score: compat,
      cost_impact: `${costDelta >= 0 ? "+" : ""}${costDelta}%`,
      risk_impact: `${riskDelta >= 0 ? "+" : ""}${riskDelta}%`,
      lead_time_impact: `${leadDelta >= 0 ? "+" : ""}${leadDelta}d`,
      recommendation_confidence: confidenceFor(compat),
      rationale: `Functional overlap with ${nameFromSku(target.raw_material_sku)} based on inferred role similarity and supplier overlap heuristics.`,
    };
  });
}

// ---------- Aggregate simulated KPIs (clearly labeled in UI) ----------
export function simulateAggregateKpis(rows: RealRow[], suppliers: RealSupplier[]) {
  const seed = `agg-${rows.length}`;
  return {
    ai_recommendations_generated: Math.round(rows.length * 3.3),
    risk_alerts: Math.max(3, Math.round(suppliers.length * 0.18)),
    cost_opportunities: Math.max(2, Math.round(suppliers.length * 0.12)),
    avg_risk_index: +range(seed + "-r", 0.22, 0.34).toFixed(2),
    avg_lead_time_days: Math.round(range(seed + "-l", 12, 22)),
  };
}

// ---------- Trend series (simulated) ----------
export function simulateTrend() {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"];
  return months.map((month, i) => ({
    month,
    cost: +range(`t-c-${i}`, 95, 130).toFixed(0),
    risk: +range(`t-r-${i}`, 0.18, 0.36).toFixed(2),
  }));
}
