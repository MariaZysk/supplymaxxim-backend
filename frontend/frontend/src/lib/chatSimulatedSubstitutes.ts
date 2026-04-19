/**
 * Simulated procurement substitute flow (mockData) — multi-turn filtering by supplier,
 * region, BOM. Real/mydata has no substitute rows; we guide users when result sets are large.
 */
import type { ProcurementRecord } from "@/data/mockData";
import { procurementData } from "@/data/mockData";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export const DETAIL_THRESHOLD = 5;

export function isSubstituteQuestion(message: string): boolean {
  return /\bsubstitut|alternativ|replac(e|ement)|switch\b/i.test(message);
}

/** Best-effort material phrase from “Substitutes for X”, quotes, or substring match. */
export function extractMaterialNameForSubstitutes(message: string): string | null {
  const trim = message.trim();
  const uq = trim.match(/\u201c([^\u201d]{2,120})\u201d/);
  const aq = trim.match(/["']([^"']{2,120})["']/);
  const quoted = (uq?.[1] ?? aq?.[1])?.trim();
  if (quoted) return quoted;

  const forPhrases = trim.match(
    /\b(?:substitutes?|alternatives?|replacement|replacements?)\s+for\s+(.+?)(?:\?|$)/i,
  );
  if (forPhrases?.[1]) return forPhrases[1].trim().replace(/\.$/, "");

  const forLast = trim.match(/\bfor\s+(.+?)\s*(?:\?|\.|$)/i);
  if (forLast?.[1] && /\bsubstitut|alternativ|replac/i.test(trim)) {
    return forLast[1].trim().replace(/\.$/, "");
  }

  const names = [...new Set(procurementData.map((r) => r.raw_material_name))].sort(
    (a, b) => b.length - a.length,
  );
  const lower = trim.toLowerCase();
  for (const n of names) {
    if (n.length >= 4 && lower.includes(n.toLowerCase())) return n;
  }
  return null;
}

export type SubstituteFilters = { supplier?: string; region?: string; bom?: string };

export function parseFilters(text: string): SubstituteFilters {
  const out: SubstituteFilters = {};
  const m = text.match(/supplier\s*[:=]\s*([^\n]+)/i);
  if (m) out.supplier = m[1].trim();
  const m2 = text.match(/region\s*[:=]\s*([^\n]+)/i);
  if (m2) out.region = m2[1].trim();
  const m3 = text.match(/bom\s*[:=]\s*([^\n]+)/i);
  if (m3) out.bom = m3[1].trim();
  if (!out.bom) {
    const m4 = text.match(/\bbom\s*[-#]?\s*(\d+)/i);
    if (m4) out.bom = m4[1];
  }
  return out;
}

function normalizeBom(s: string): string {
  return s.replace(/^BOM-?/i, "").replace(/\D/g, "");
}

function fuzzySupplierMatch(supplierName: string, filter: string): boolean {
  const a = supplierName.toLowerCase().trim();
  const b = filter.toLowerCase().trim();
  if (!b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  if (b.length >= 4 && a.includes(b.slice(0, 4))) return true;
  if (a.includes("jost") && b.includes("josh")) return true;
  return false;
}

export function applySubstituteFilters(
  rows: ProcurementRecord[],
  f: SubstituteFilters,
): ProcurementRecord[] {
  let out = rows;
  if (f.supplier) {
    out = out.filter((r) => fuzzySupplierMatch(r.supplier_name, f.supplier!));
  }
  if (f.region) {
    const rl = f.region.toLowerCase();
    out = out.filter((r) => r.region.toLowerCase().includes(rl));
  }
  if (f.bom) {
    const want = normalizeBom(f.bom);
    out = out.filter(
      (r) =>
        normalizeBom(r.bom_id).includes(want) ||
        r.bom_id.toLowerCase().includes(f.bom!.toLowerCase()),
    );
  }
  return out;
}

function accumulateFiltersAfterSubstitute(history: ChatTurn[], message: string): SubstituteFilters {
  const turns = [...history, { role: "user" as const, content: message }];
  let subIdx = -1;
  for (let i = 0; i < turns.length; i++) {
    if (turns[i].role === "user" && isSubstituteQuestion(turns[i].content)) {
      subIdx = i;
    }
  }
  const filters: SubstituteFilters = {};
  if (subIdx < 0) return filters;
  for (let i = subIdx + 1; i < turns.length; i++) {
    if (turns[i].role === "user") Object.assign(filters, parseFilters(turns[i].content));
  }
  return filters;
}

function resolveMaterial(message: string, history: ChatTurn[]): string | null {
  if (isSubstituteQuestion(message)) {
    return extractMaterialNameForSubstitutes(message);
  }
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === "user" && isSubstituteQuestion(history[i].content)) {
      return extractMaterialNameForSubstitutes(history[i].content);
    }
  }
  return null;
}

function rowsForMaterial(material: string): ProcurementRecord[] {
  const h = material.toLowerCase().trim();
  return procurementData.filter((r) => {
    const n = r.raw_material_name.toLowerCase();
    return n === h || n.includes(h) || h.includes(n);
  });
}

function isSubstituteFollowUp(message: string, history: ChatTurn[]): boolean {
  if (isSubstituteQuestion(message)) return false;
  if (!history.length) return false;
  const lastAsst = [...history].reverse().find((t) => t.role === "assistant");
  if (!lastAsst) return false;
  return /Simulated database|narrow further|more information|filter|supplier|region|BOM/i.test(
    lastAsst.content,
  );
}

function formatSupplierId(id: string): string {
  return `#${id}`;
}

function formatDetailBlock(r: ProcurementRecord): string {
  const lines = [
    `Company: ${r.company_name}`,
    `Finished Product: ${r.finished_product_name}`,
    `Finished Product SKU: ${r.finished_product_sku}`,
    `Supplier: ${r.supplier_name}`,
    `Supplier ID: ${formatSupplierId(r.supplier_id)}`,
    `BOM ID: ${r.bom_id}`,
    `Region: ${r.region}`,
  ];
  return lines.join("\n");
}

function formatDetailList(rows: ProcurementRecord[], material: string): string {
  const head = `Found ${rows.length} result${rows.length === 1 ? "" : "s"} for ${material} in the Simulated database:\n\n`;
  const blocks = rows.map((r) => formatDetailBlock(r));
  return head + blocks.join("\n\n---\n\n");
}

function describeActiveFilters(f: SubstituteFilters): string {
  const bits: string[] = [];
  if (f.supplier) bits.push(`supplier “${f.supplier}”`);
  if (f.region) bits.push(`region “${f.region}”`);
  if (f.bom) bits.push(`BOM “${f.bom}”`);
  if (bits.length === 0) return "";
  return ` with ${bits.join(", ")}`;
}

function suggestMoreFilters(f: SubstituteFilters): string {
  const parts: string[] = [];
  if (!f.supplier) parts.push("supplier");
  if (!f.region) parts.push("region");
  if (!f.bom) parts.push("BOM");
  if (parts.length === 0) return "a more specific BOM or supplier ID";
  return parts.join(", ");
}

/**
 * Returns formatted reply or null if Simulated data has no rows for this material / flow.
 */
export function buildSimulatedSubstitutesAnswer(message: string, history: ChatTurn[] = []): string | null {
  const material = resolveMaterial(message, history);
  if (!material) return null;

  const rows = rowsForMaterial(material);
  if (rows.length === 0) return null;

  const hasFilterOnly = Object.keys(parseFilters(message)).length > 0;
  const hasPriorSubstituteInHistory = history.some(
    (h) => h.role === "user" && isSubstituteQuestion(h.content),
  );
  const inFlow =
    isSubstituteQuestion(message) ||
    isSubstituteFollowUp(message, history) ||
    (hasFilterOnly && hasPriorSubstituteInHistory);
  if (!inFlow) return null;

  const filters = accumulateFiltersAfterSubstitute(history, message);
  const filtered = applySubstituteFilters(rows, filters);

  if (Object.keys(filters).length === 0 && rows.length <= DETAIL_THRESHOLD && isSubstituteQuestion(message)) {
    return "No results in Real database. " + formatDetailList(rows, material);
  }

  if (Object.keys(filters).length === 0 && rows.length > DETAIL_THRESHOLD && isSubstituteQuestion(message)) {
    return (
      "No results in Real database, but found " +
      `${rows.length} results for ${material} in the Simulated database. ` +
      "Would you like to provide more information (supplier, region, BOM, etc.)?"
    );
  }

  if (filtered.length === 0) {
    return (
      "No rows match those filters in the Simulated database. " +
      "Try a different supplier name (e.g. spelling), region, or BOM ID."
    );
  }

  if (filtered.length > DETAIL_THRESHOLD) {
    const extra = describeActiveFilters(filters);
    return (
      `Found ${filtered.length} results for ${material}${extra} in the Simulated database. ` +
      `Would you like to narrow further (e.g. ${suggestMoreFilters(filters)})?`
    );
  }

  const extra = describeActiveFilters(filters);
  return (
    `Found ${filtered.length} result${filtered.length === 1 ? "" : "s"} for ${material}${extra} in the Simulated database:\n\n` +
    filtered.map((r) => formatDetailBlock(r)).join("\n\n---\n\n")
  );
}
