// Mock procurement / supply-chain data for Spheremaxxing
// Designed to be easily replaced by API responses later.

export type Substitute = {
  name: string;
  compatibility_score: number;
  cost_impact: string;
  risk_impact: string;
  lead_time_impact: string;
  confidence: number;
  rationale: string;
};

export type ProcurementRecord = {
  company_id: string;
  company_name: string;
  finished_product_id: string;
  finished_product_name: string;
  finished_product_sku: string;
  bom_id: string;
  raw_material_id: string;
  raw_material_name: string;
  raw_material_sku: string;
  supplier_id: string;
  supplier_name: string;
  region: string;
  estimated_cost: number;
  lead_time_days: number;
  risk_score: number; // 0..1 lower = better
  reliability_score: number; // 0..1 higher = better
  availability_score: number; // 0..1 higher = better
  sustainability_score: number; // 0..1 higher = better
  certifications: string[];
  substitute_options: Substitute[];
};

/** Demo rows for substitute chat filtering (41 lines for Calcium Carbonate). */
function buildCalciumCarbonateRows(): ProcurementRecord[] {
  const pureSubs: Substitute[] = [
    {
      name: "Milk Protein",
      compatibility_score: 0.71,
      cost_impact: "+6%",
      risk_impact: "-5%",
      lead_time_impact: "+2d",
      confidence: 0.76,
      rationale: "Protein buffer alternative for certain chewable matrices.",
    },
    {
      name: "Whey Protein Isolate",
      compatibility_score: 0.64,
      cost_impact: "+12%",
      risk_impact: "-3%",
      lead_time_impact: "+1d",
      confidence: 0.7,
      rationale: "Higher solubility profile; adjust tablet hardness.",
    },
    {
      name: "Hydroxypropyl Methylcellulose",
      compatibility_score: 0.58,
      cost_impact: "-4%",
      risk_impact: "+8%",
      lead_time_impact: "+0d",
      confidence: 0.62,
      rationale: "Binder substitute where mineral label claim can shift.",
    },
  ];
  const jostSubs: Substitute[] = [
    {
      name: "Sucralose",
      compatibility_score: 0.55,
      cost_impact: "+2%",
      risk_impact: "+4%",
      lead_time_impact: "+3d",
      confidence: 0.59,
      rationale: "Sweetness system change when reformulating around mineral load.",
    },
    {
      name: "Zinc Oxide",
      compatibility_score: 0.61,
      cost_impact: "+8%",
      risk_impact: "-2%",
      lead_time_impact: "+1d",
      confidence: 0.68,
      rationale: "Alternative mineral route for combined mineral SKUs.",
    },
    {
      name: "Vitamin D3 Cholecalciferol",
      compatibility_score: 0.72,
      cost_impact: "+5%",
      risk_impact: "-4%",
      lead_time_impact: "+0d",
      confidence: 0.74,
      rationale: "Pairs with bone-health positioning alongside calcium.",
    },
  ];

  const rows: ProcurementRecord[] = [];
  rows.push({
    company_id: "C900",
    company_name: "One A Day",
    finished_product_id: "FP9001",
    finished_product_name: "One A Day Daily Tablet",
    finished_product_sku: "FG-costco-100143268",
    bom_id: "BOM-118",
    raw_material_id: "RM-1105",
    raw_material_name: "Calcium Carbonate",
    raw_material_sku: "RM-CC-1105",
    supplier_id: "19",
    supplier_name: "Jost Chemical",
    region: "United States",
    estimated_cost: 4.8,
    lead_time_days: 10,
    risk_score: 0.21,
    reliability_score: 0.89,
    availability_score: 0.9,
    sustainability_score: 0.75,
    certifications: ["GMP"],
    substitute_options: jostSubs,
  });
  rows.push({
    company_id: "C900",
    company_name: "One A Day",
    finished_product_id: "FP9001",
    finished_product_name: "One A Day Daily Tablet",
    finished_product_sku: "FG-costco-100143268",
    bom_id: "BOM-118",
    raw_material_id: "RM-1105",
    raw_material_name: "Calcium Carbonate",
    raw_material_sku: "RM-CC-1105",
    supplier_id: "28",
    supplier_name: "Jost Chemical",
    region: "United States",
    estimated_cost: 5.0,
    lead_time_days: 9,
    risk_score: 0.2,
    reliability_score: 0.9,
    availability_score: 0.88,
    sustainability_score: 0.76,
    certifications: ["ISO 9001", "USP", "GMP"],
    substitute_options: jostSubs,
  });

  for (let i = 2; i < 41; i++) {
    const jost = i < 24;
    rows.push({
      company_id: `C${900 + (i % 5)}`,
      company_name: i % 7 === 0 ? "One A Day" : "NutraSphere Labs",
      finished_product_id: `FP${8000 + i}`,
      finished_product_name: i % 7 === 0 ? "One A Day Daily Tablet" : "Calcium Plus Tablet",
      finished_product_sku: i % 7 === 0 ? "FG-costco-100143268" : `amazon-FP${8000 + i}`,
      bom_id: `BOM-${4000 + i}`,
      raw_material_id: "RM-1105",
      raw_material_name: "Calcium Carbonate",
      raw_material_sku: "RM-CC-1105",
      supplier_id: jost ? `SUP-JOST-${i}` : `SUP-PB-${i}`,
      supplier_name: jost ? "Jost Chemical" : "PureBulk",
      region: i % 3 === 0 ? "Germany" : "United States",
      estimated_cost: 4 + (i % 10) * 0.1,
      lead_time_days: 8 + (i % 5),
      risk_score: 0.2,
      reliability_score: 0.88,
      availability_score: 0.89,
      sustainability_score: 0.74,
      certifications: ["ISO 9001", "GMP"],
      substitute_options: jost ? jostSubs : pureSubs,
    });
  }
  return rows;
}

const _procurementDataBase: ProcurementRecord[] = [
  {
    company_id: "C102",
    company_name: "NutraSphere Labs",
    finished_product_id: "FP2201",
    finished_product_name: "Magnesium Complex 500mg",
    finished_product_sku: "amazon-FP2201",
    bom_id: "BOM-7781",
    raw_material_id: "RM-431",
    raw_material_name: "Magnesium Glycinate",
    raw_material_sku: "RM-MG-431",
    supplier_id: "SUP-902",
    supplier_name: "BluePeak Ingredients",
    region: "Germany",
    estimated_cost: 42.5,
    lead_time_days: 9,
    risk_score: 0.24,
    reliability_score: 0.91,
    availability_score: 0.88,
    sustainability_score: 0.82,
    certifications: ["ISO 9001", "GMP", "Kosher"],
    substitute_options: [
      { name: "Magnesium Citrate", compatibility_score: 0.81, cost_impact: "-8%", risk_impact: "+6%", lead_time_impact: "-2d", confidence: 0.86, rationale: "Bioequivalent absorption profile with established supplier base in EU." },
      { name: "Magnesium Malate", compatibility_score: 0.74, cost_impact: "+3%", risk_impact: "-4%", lead_time_impact: "+1d", confidence: 0.78, rationale: "Slightly higher cost offset by superior supply continuity." },
    ],
  },
  {
    company_id: "C102",
    company_name: "NutraSphere Labs",
    finished_product_id: "FP2201",
    finished_product_name: "Magnesium Complex 500mg",
    finished_product_sku: "amazon-FP2201",
    bom_id: "BOM-7781",
    raw_material_id: "RM-431",
    raw_material_name: "Magnesium Glycinate",
    raw_material_sku: "RM-MG-431",
    supplier_id: "SUP-441",
    supplier_name: "Hanseatic Organics",
    region: "Netherlands",
    estimated_cost: 38.9,
    lead_time_days: 14,
    risk_score: 0.31,
    reliability_score: 0.84,
    availability_score: 0.79,
    sustainability_score: 0.88,
    certifications: ["ISO 9001", "Organic", "Non-GMO"],
    substitute_options: [],
  },
  {
    company_id: "C102",
    company_name: "NutraSphere Labs",
    finished_product_id: "FP2201",
    finished_product_name: "Magnesium Complex 500mg",
    finished_product_sku: "amazon-FP2201",
    bom_id: "BOM-7781",
    raw_material_id: "RM-431",
    raw_material_name: "Magnesium Glycinate",
    raw_material_sku: "RM-MG-431",
    supplier_id: "SUP-217",
    supplier_name: "Pacific Bio Supply",
    region: "Singapore",
    estimated_cost: 35.2,
    lead_time_days: 22,
    risk_score: 0.46,
    reliability_score: 0.76,
    availability_score: 0.82,
    sustainability_score: 0.71,
    certifications: ["GMP"],
    substitute_options: [],
  },
  {
    company_id: "C204",
    company_name: "Helix Performance Inc.",
    finished_product_id: "FP3088",
    finished_product_name: "Whey Protein Isolate Vanilla",
    finished_product_sku: "shopify-FP3088",
    bom_id: "BOM-8842",
    raw_material_id: "RM-512",
    raw_material_name: "Whey Protein Isolate",
    raw_material_sku: "RM-WPI-512",
    supplier_id: "SUP-118",
    supplier_name: "Alpine Dairy Co.",
    region: "New Zealand",
    estimated_cost: 18.4,
    lead_time_days: 18,
    risk_score: 0.29,
    reliability_score: 0.93,
    availability_score: 0.9,
    sustainability_score: 0.8,
    certifications: ["ISO 22000", "Halal", "Grass-Fed"],
    substitute_options: [
      { name: "Pea Protein Isolate", compatibility_score: 0.62, cost_impact: "-22%", risk_impact: "-14%", lead_time_impact: "-6d", confidence: 0.71, rationale: "Vegan alternative with strong supply diversification, taste profile differs." },
      { name: "Casein Concentrate", compatibility_score: 0.79, cost_impact: "+5%", risk_impact: "-3%", lead_time_impact: "+0d", confidence: 0.83, rationale: "Closely matched amino profile from same dairy supply network." },
    ],
  },
  {
    company_id: "C204",
    company_name: "Helix Performance Inc.",
    finished_product_id: "FP3088",
    finished_product_name: "Whey Protein Isolate Vanilla",
    finished_product_sku: "shopify-FP3088",
    bom_id: "BOM-8842",
    raw_material_id: "RM-512",
    raw_material_name: "Whey Protein Isolate",
    raw_material_sku: "RM-WPI-512",
    supplier_id: "SUP-330",
    supplier_name: "Midwest Protein Partners",
    region: "United States",
    estimated_cost: 16.9,
    lead_time_days: 12,
    risk_score: 0.22,
    reliability_score: 0.88,
    availability_score: 0.94,
    sustainability_score: 0.66,
    certifications: ["ISO 9001", "FDA"],
    substitute_options: [],
  },
  {
    company_id: "C309",
    company_name: "Volt Mobility Systems",
    finished_product_id: "FP4501",
    finished_product_name: "EV Battery Cathode Module",
    finished_product_sku: "internal-FP4501",
    bom_id: "BOM-9912",
    raw_material_id: "RM-721",
    raw_material_name: "Lithium Carbonate",
    raw_material_sku: "RM-LC-721",
    supplier_id: "SUP-555",
    supplier_name: "Andes Lithium Corp",
    region: "Chile",
    estimated_cost: 78.3,
    lead_time_days: 28,
    risk_score: 0.52,
    reliability_score: 0.74,
    availability_score: 0.68,
    sustainability_score: 0.61,
    certifications: ["ISO 14001"],
    substitute_options: [
      { name: "Lithium Hydroxide", compatibility_score: 0.88, cost_impact: "+11%", risk_impact: "-9%", lead_time_impact: "-4d", confidence: 0.89, rationale: "Higher process compatibility for nickel-rich cathodes; broader supplier base." },
      { name: "Sodium-Ion Precursor", compatibility_score: 0.41, cost_impact: "-34%", risk_impact: "-22%", lead_time_impact: "-8d", confidence: 0.55, rationale: "Emerging chemistry with major cost advantages but requires cell redesign." },
    ],
  },
  {
    company_id: "C309",
    company_name: "Volt Mobility Systems",
    finished_product_id: "FP4501",
    finished_product_name: "EV Battery Cathode Module",
    finished_product_sku: "internal-FP4501",
    bom_id: "BOM-9912",
    raw_material_id: "RM-721",
    raw_material_name: "Lithium Carbonate",
    raw_material_sku: "RM-LC-721",
    supplier_id: "SUP-612",
    supplier_name: "Outback Minerals",
    region: "Australia",
    estimated_cost: 82.1,
    lead_time_days: 24,
    risk_score: 0.34,
    reliability_score: 0.89,
    availability_score: 0.81,
    sustainability_score: 0.74,
    certifications: ["ISO 14001", "IRMA"],
    substitute_options: [],
  },
  {
    company_id: "C411",
    company_name: "Cortex Semiconductors",
    finished_product_id: "FP5102",
    finished_product_name: "5nm Logic Wafer",
    finished_product_sku: "internal-FP5102",
    bom_id: "BOM-1023",
    raw_material_id: "RM-880",
    raw_material_name: "Electronic-Grade Silicon",
    raw_material_sku: "RM-EGS-880",
    supplier_id: "SUP-701",
    supplier_name: "Tokyo Crystal Works",
    region: "Japan",
    estimated_cost: 215.0,
    lead_time_days: 35,
    risk_score: 0.38,
    reliability_score: 0.95,
    availability_score: 0.72,
    sustainability_score: 0.78,
    certifications: ["ISO 9001", "SEMI S2"],
    substitute_options: [
      { name: "Polycrystalline Silicon", compatibility_score: 0.66, cost_impact: "-18%", risk_impact: "+5%", lead_time_impact: "-7d", confidence: 0.72, rationale: "Adequate for legacy nodes; performance penalty on advanced geometries." },
    ],
  },
  {
    company_id: "C512",
    company_name: "Atlas Foodworks",
    finished_product_id: "FP6203",
    finished_product_name: "Cold-Pressed Olive Oil 500ml",
    finished_product_sku: "amazon-FP6203",
    bom_id: "BOM-2244",
    raw_material_id: "RM-902",
    raw_material_name: "Extra Virgin Olive Oil",
    raw_material_sku: "RM-EVOO-902",
    supplier_id: "SUP-808",
    supplier_name: "Andalusia Groves",
    region: "Spain",
    estimated_cost: 9.8,
    lead_time_days: 7,
    risk_score: 0.19,
    reliability_score: 0.92,
    availability_score: 0.86,
    sustainability_score: 0.9,
    certifications: ["PDO", "Organic", "ISO 22000"],
    substitute_options: [
      { name: "Greek EVOO", compatibility_score: 0.94, cost_impact: "+4%", risk_impact: "-2%", lead_time_impact: "+1d", confidence: 0.91, rationale: "Direct organoleptic match from neighboring Mediterranean basin." },
    ],
  },
  {
    company_id: "C611",
    company_name: "MediCore Pharma",
    finished_product_id: "FP7044",
    finished_product_name: "Acetaminophen 500mg Tablets",
    finished_product_sku: "internal-FP7044",
    bom_id: "BOM-3105",
    raw_material_id: "RM-1003",
    raw_material_name: "Paracetamol API",
    raw_material_sku: "RM-PAR-1003",
    supplier_id: "SUP-915",
    supplier_name: "Granada Pharma",
    region: "India",
    estimated_cost: 12.6,
    lead_time_days: 19,
    risk_score: 0.41,
    reliability_score: 0.83,
    availability_score: 0.87,
    sustainability_score: 0.7,
    certifications: ["GMP", "WHO-PQ"],
    substitute_options: [],
  },
];

export const procurementData: ProcurementRecord[] = [
  ..._procurementDataBase,
  ...buildCalciumCarbonateRows(),
];

// Aggregate KPI metrics
export const dashboardMetrics = {
  active_suppliers: 1284,
  raw_materials_tracked: 4612,
  boms_evaluated: 387,
  ai_recommendations: 9421,
  risk_alerts: 24,
  cost_opportunities: 18,
};

export const supplierTrend = [
  { month: "Jan", cost: 124, risk: 0.32 },
  { month: "Feb", cost: 121, risk: 0.30 },
  { month: "Mar", cost: 118, risk: 0.34 },
  { month: "Apr", cost: 115, risk: 0.29 },
  { month: "May", cost: 112, risk: 0.27 },
  { month: "Jun", cost: 109, risk: 0.26 },
  { month: "Jul", cost: 105, risk: 0.24 },
  { month: "Aug", cost: 102, risk: 0.22 },
];

export const regionDistribution = [
  { region: "EU", value: 38 },
  { region: "Americas", value: 27 },
  { region: "APAC", value: 24 },
  { region: "MENA", value: 7 },
  { region: "Other", value: 4 },
];

export const riskBreakdown = [
  { category: "Geopolitical", value: 28 },
  { category: "Logistics", value: 22 },
  { category: "Quality", value: 14 },
  { category: "Financial", value: 11 },
  { category: "Compliance", value: 9 },
  { category: "ESG", value: 16 },
];

export const substitutionUsage = [
  { week: "W1", count: 12 },
  { week: "W2", count: 18 },
  { week: "W3", count: 15 },
  { week: "W4", count: 24 },
  { week: "W5", count: 31 },
  { week: "W6", count: 28 },
  { week: "W7", count: 36 },
  { week: "W8", count: 42 },
];

export const aiInsights = [
  { id: 1, severity: "info" as const, text: "Supplier B (Hanseatic Organics) offers 8.5% lower cost on RM-431 but exhibits +5d lead-time variance versus BluePeak." },
  { id: 2, severity: "warning" as const, text: "Material RM-721 (Lithium Carbonate) shows two feasible substitutes; Lithium Hydroxide path reduces lead time by 4 days at +11% cost." },
  { id: 3, severity: "success" as const, text: "Recommended sourcing path for BOM-8842 optimizes cost by 6% while reducing risk exposure by 18%." },
  { id: 4, severity: "warning" as const, text: "Single-source dependency detected on RM-880 (Electronic-Grade Silicon). Consider qualifying secondary supplier in Q3." },
  { id: 5, severity: "info" as const, text: "Andalusia Groves maintains 92% reliability across last 18 shipments; recommended as primary for RM-902." },
];

// Distinct lookups
export const allSuppliers = Array.from(
  new Map(procurementData.map((p) => [p.supplier_id, { id: p.supplier_id, name: p.supplier_name, region: p.region, reliability: p.reliability_score, risk: p.risk_score }])).values(),
);

export const allRawMaterials = Array.from(
  new Map(procurementData.map((p) => [p.raw_material_id, { id: p.raw_material_id, name: p.raw_material_name, sku: p.raw_material_sku }])).values(),
);
