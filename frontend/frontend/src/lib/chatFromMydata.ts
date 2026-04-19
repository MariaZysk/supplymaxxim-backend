/**
 * Chat answers grounded in mydata.json (via realData.ts), with Simulated substitute
 * catalog from mockData when substitute questions need demo content Real data lacks.
 */
import { nameFromSku, realRows, type RealRow } from "@/data/realData";
import { buildSimulatedSubstitutesAnswer } from "@/lib/chatSimulatedSubstitutes";

const STOP = new Set(
  "the and for with from this that these those what when where which who how why are was were been being not you any all can ask get our out use using per unit one two may its its a an or as at be by if in of on to up we he she it their they them".split(
    " ",
  ),
);

function expandTokens(raw: string): string[] {
  const cleaned = raw.toLowerCase().replace(/["'?!.,;:()[\]]/g, " ");
  const pieces: string[] = [];
  for (const w of cleaned.split(/\s+/)) {
    if (w.length < 2) continue;
    pieces.push(w);
    if (w.includes("-")) {
      for (const part of w.split("-")) {
        if (part.length >= 3) pieces.push(part);
      }
    }
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of pieces) {
    if (STOP.has(t)) continue;
    if (t.length === 2 && !/^\d{2}$/.test(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function uniqueMaterialNames(): Map<number, string> {
  const m = new Map<number, string>();
  for (const r of realRows) {
    if (!m.has(r.raw_material_id)) {
      m.set(r.raw_material_id, nameFromSku(r.raw_material_sku));
    }
  }
  return m;
}

/** Find rows whose material is mentioned in the user message (quoted name, phrase in text, SKU, or tokens). */
export function findRealRowsForMessage(message: string): RealRow[] {
  const lower = message.toLowerCase().trim();

  const unicodeQuoted = message.match(/\u201c([^\u201d]{2,120})\u201d/);
  const asciiQuoted = message.match(/["']([^"']{2,120})["']/);
  const quoted = (unicodeQuoted?.[1] ?? asciiQuoted?.[1])?.trim() ?? "";
  if (quoted.length > 0) {
    const ph = quoted.toLowerCase();
    return realRows.filter((r) => {
      const dn = nameFromSku(r.raw_material_sku).toLowerCase();
      return (
        dn === ph ||
        dn.includes(ph) ||
        ph.split(/\s+/).every((w) => w.length < 2 || dn.includes(w))
      );
    });
  }

  const idMatch = message.match(/\braw[_\s]?material[_\s]?id\s*[:#]?\s*(\d+)\b/i);
  if (idMatch) {
    const id = parseInt(idMatch[1], 10);
    return realRows.filter((r) => r.raw_material_id === id);
  }

  const rmSku = message.match(/\bRM-C\d+-[a-z0-9-]+\b/i);
  if (rmSku) {
    const target = rmSku[0].toLowerCase();
    return realRows.filter((r) => r.raw_material_sku.toLowerCase() === target);
  }

  const mats = uniqueMaterialNames();
  const byLongestName = [...mats.entries()].sort((a, b) => b[1].length - a[1].length);
  const midHits = new Set<number>();
  for (const [mid, display] of byLongestName) {
    const d = display.toLowerCase();
    if (d.length >= 4 && lower.includes(d)) midHits.add(mid);
  }
  if (midHits.size > 0) {
    return realRows.filter((r) => midHits.has(r.raw_material_id));
  }

  const sig = expandTokens(message).filter((t) => t.length >= 3);
  if (sig.length === 0) return [];
  return realRows.filter((r) => {
    const dn = nameFromSku(r.raw_material_sku).toLowerCase();
    const sku = r.raw_material_sku.toLowerCase();
    return sig.every((t) => dn.includes(t) || sku.includes(t.replace(/\s+/g, "-")));
  });
}

function isLowestPriceOrCostQuestion(message: string): boolean {
  const t = message.toLowerCase();
  if (
    /\b(cheaper|cheapest|lowest\s+(price|cost)|least\s+expensive|lower\s+price|cost\s+less|best\s+deal|reduce\s+cost|affordab)/i.test(
      t,
    )
  ) {
    return true;
  }
  if (/(price|cost|cheap|expensive|\$)/i.test(t) && /(lower|cheap|least|save|afford|best)/i.test(t)) {
    return true;
  }
  if (
    /(which|what|who).{0,40}(supplier|vendors?)/i.test(t) &&
    /(price|cost|cheap|lower|sell|selling)/i.test(t)
  ) {
    return true;
  }
  return false;
}

function rowsSingleSourceReal(): RealRow[] {
  const suppliersByRm = new Map<number, Set<number>>();
  for (const r of realRows) {
    if (!suppliersByRm.has(r.raw_material_id)) suppliersByRm.set(r.raw_material_id, new Set());
    suppliersByRm.get(r.raw_material_id)!.add(r.supplier_id);
  }
  const single = new Set<number>();
  for (const [rm, sups] of suppliersByRm) {
    if (sups.size === 1) single.add(rm);
  }
  return realRows.filter((r) => single.has(r.raw_material_id));
}

/** Group rows by display material name → distinct supplier names */
/** Prefer e.g. «Soy Lecithin» over «Lecithin» when the question mentions the fuller phrase. */
export function narrowRowsToBestMaterialPhrase(message: string, rows: RealRow[]): RealRow[] {
  if (rows.length <= 1) return rows;
  const lower = message.toLowerCase();
  const byDn = new Map<string, RealRow[]>();
  for (const r of rows) {
    const dn = nameFromSku(r.raw_material_sku);
    const list = byDn.get(dn) ?? [];
    list.push(r);
    byDn.set(dn, list);
  }
  const score = (dn: string) => {
    const words = dn.toLowerCase().split(/\s+/).filter((w) => w.length >= 2);
    if (words.length === 0) return 0;
    return words.filter((w) => lower.includes(w)).length;
  };
  let best = 0;
  for (const dn of byDn.keys()) best = Math.max(best, score(dn));
  if (best <= 0) return rows;
  const out: RealRow[] = [];
  for (const [dn, list] of byDn) {
    if (score(dn) === best) out.push(...list);
  }
  return out;
}

function suppliersByMaterialName(rows: RealRow[]): Map<string, Set<string>> {
  const byMat = new Map<string, Set<string>>();
  for (const r of rows) {
    const dn = nameFromSku(r.raw_material_sku);
    if (!byMat.has(dn)) byMat.set(dn, new Set());
    const nm = r.supplier_name?.trim();
    if (nm) byMat.get(dn)!.add(nm);
  }
  return byMat;
}

function formatSupplierList(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function wantsSupplierFocus(message: string): boolean {
  return /\b(who|which|supplier|suppliers|supply|supplies|source|sources|vendor|vendors|selling|sell|provides?)\b/i.test(
    message,
  );
}

function wantsPrice(message: string): boolean {
  return /\b(price|cost|cheap|cheapest|\$|€|£)\b/i.test(message);
}

/** Main entry — grounded in procurement JSON via realData; replies are plain language (no raw dump). */
export function answerFromMydataJson(message: string): string {
  if (isLowestPriceOrCostQuestion(message)) {
    return (
      "Our procurement records here don’t include unit prices or lead times — only which suppliers are linked to which materials. " +
        "I can’t rank suppliers by price from this data alone. Use Procurement Search or your ERP for pricing."
    );
  }

  let rows = findRealRowsForMessage(message);
  rows = narrowRowsToBestMaterialPhrase(message, rows);

  if (rows.length === 0) {
    return (
      "I couldn’t find that material in our procurement data. " +
        "Try the ingredient or product name (e.g. soy lecithin), a numeric material id, or an RM-C… SKU if you have one."
    );
  }

  const byMat = suppliersByMaterialName(rows);
  const matKeys = [...byMat.keys()].sort((a, b) => b.length - a.length);
  const primaryMat = matKeys[0] ?? "that material";
  const askSuppliers = wantsSupplierFocus(message);
  const askPrice = wantsPrice(message);

  const parts: string[] = [];
  if (askPrice) {
    parts.push(
      "Our procurement records don’t include unit prices — only supplier–material links.",
    );
  }

  if (askSuppliers && byMat.size === 1) {
    const names = [...byMat.get(primaryMat)!].sort();
    if (names.length === 1) {
      parts.push(`${names[0]} is listed as a supplier for ${primaryMat}.`);
    } else {
      parts.push(
        `${formatSupplierList(names)} are listed as suppliers for ${primaryMat}.`,
      );
    }
  } else if (askSuppliers) {
    const bits = [...byMat.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dn, set]) => `${dn}: ${formatSupplierList([...set].sort())}`);
    parts.push(`Per our procurement data: ${bits.join("; ")}.`);
  } else if (/single[\s-]?source|sole supplier|only one supplier|supplier concentration|dependency/i.test(message)) {
    const risky = rowsSingleSourceReal();
    const ids = [...new Set(risky.map((r) => r.raw_material_id))].slice(0, 12);
    parts.push(
      `Materials that appear with only one supplier in these records include: ${ids.join(", ")}.`,
    );
  } else if (/\bsubstitut|alternativ|replace\b/i.test(message)) {
    parts.push(
      "Substitute options aren’t recorded here — only supplier–material–BOM links. Check formulation tools or another dataset for alternates.",
    );
  } else {
    const allSups = new Set<string>();
    for (const s of byMat.values()) for (const n of s) allSups.add(n);
    const list = [...allSups].sort();
    if (list.length <= 3) {
      parts.push(`For ${primaryMat}, suppliers in our records include ${formatSupplierList(list)}.`);
    } else {
      parts.push(
        `For ${primaryMat}, our records list multiple suppliers (${list.length} distinct).`,
      );
    }
  }

  if (
    !askPrice &&
    !parts.some((p) => /pricing|price/i.test(p)) &&
    !/\bsubstitut|alternativ|replace\b|single[\s-]?source|sole supplier|only one supplier|supplier concentration|dependency/i.test(
      message,
    )
  ) {
    parts.push("Pricing isn’t available in this dataset.");
  }

  return parts.join(" ");
}

/** Legacy export name used by api.ts */
export function localProcurementChatFallback(
  message: string,
  history: { role: "user" | "assistant"; content: string }[] = [],
): string {
  const turns = history.map((h) => ({
    role: h.role as "user" | "assistant",
    content: h.content,
  }));
  const sim = buildSimulatedSubstitutesAnswer(message, turns);
  if (sim) return sim;
  return answerFromMydataJson(message);
}
