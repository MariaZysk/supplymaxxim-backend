import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScoreBar } from "@/components/ScoreBar";
import { Search, SlidersHorizontal, X } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { realRows, nameFromSku, getRealRawMaterials, type RealRow } from "@/data/realData";
import {
  simulateSupplierProfile,
  simulateIngredientProfile,
  simulateSubstitutes,
} from "@/data/simulatedIntelligence";
import { useDataMode } from "@/contexts/DataModeContext";
import { SimulatedBadge, RealDataBadge, NotInRealData } from "@/components/SimulatedBadge";

type EnrichedRow = RealRow & {
  display_material: string;
  sim: ReturnType<typeof simulateSupplierProfile>;
};

const filterChips = ["All", "Low Risk", "Lead < 14d", "High Reliability"];

const ProcurementSearch = () => {
  const { mode } = useDataMode();
  const allMaterials = useMemo(() => getRealRawMaterials(), []);

  const [query, setQuery] = useState("");
  const [chip, setChip] = useState("All");
  const [sortKey, setSortKey] = useState<string>("relevance");
  const [selected, setSelected] = useState<EnrichedRow | null>(null);

  const enriched = useMemo<EnrichedRow[]>(() => {
    return realRows.map((r) => ({
      ...r,
      display_material: nameFromSku(r.raw_material_sku),
      sim: simulateSupplierProfile(r.supplier_id, r.raw_material_id),
    }));
  }, []);

  const results = useMemo(() => {
    let data = enriched;
    if (query) {
      const q = query.toLowerCase();
      data = data.filter((r) =>
        [
          r.display_material,
          r.raw_material_sku,
          r.finished_product_sku,
          String(r.bom_id),
          r.supplier_name,
          r.company_name,
          String(r.supplier_id),
        ].join(" ").toLowerCase().includes(q),
      );
    }
    // Filter chips only meaningful outside Real-only mode (they rely on simulated scores)
    if (mode !== "real") {
      if (chip === "Low Risk") data = data.filter((r) => r.sim.risk_score.value < 0.3);
      if (chip === "Lead < 14d") data = data.filter((r) => r.sim.lead_time_days.value < 14);
      if (chip === "High Reliability") data = data.filter((r) => r.sim.reliability_score.value >= 0.85);
    }
    if (mode !== "real") {
      if (sortKey === "cost") data = [...data].sort((a, b) => a.sim.estimated_cost.value - b.sim.estimated_cost.value);
      if (sortKey === "lead") data = [...data].sort((a, b) => a.sim.lead_time_days.value - b.sim.lead_time_days.value);
      if (sortKey === "risk") data = [...data].sort((a, b) => a.sim.risk_score.value - b.sim.risk_score.value);
      if (sortKey === "reliability") data = [...data].sort((a, b) => b.sim.reliability_score.value - a.sim.reliability_score.value);
    }
    return data.slice(0, 200);
  }, [enriched, query, chip, sortKey, mode]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Procurement Search"
        title="Sourcing Intelligence Search"
        subtitle="Search across 2,860 real procurement relationships — companies, finished products, BOMs, raw materials, and suppliers."
      />

      {/* Search bar */}
      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-card">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by product, BOM, material, supplier, SKU…"
              className="pl-10 h-12 text-base bg-secondary/40 border-border/60 focus-visible:ring-primary/40"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md hover:bg-secondary flex items-center justify-center"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>

          <Select value={sortKey} onValueChange={setSortKey} disabled={mode === "real"}>
            <SelectTrigger className="lg:w-52 h-12 bg-secondary/40 border-border/60">
              <SlidersHorizontal className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Sort: Relevance</SelectItem>
              <SelectItem value="cost">Sort: Cost (low→high)</SelectItem>
              <SelectItem value="lead">Sort: Lead time</SelectItem>
              <SelectItem value="risk">Sort: Risk (low→high)</SelectItem>
              <SelectItem value="reliability">Sort: Reliability</SelectItem>
            </SelectContent>
          </Select>

          <Button className="h-12 px-6 bg-gradient-primary text-primary-foreground">
            Run AI Search
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 mt-4 items-center">
          {filterChips.map((c) => (
            <button
              key={c}
              onClick={() => setChip(c)}
              disabled={mode === "real" && c !== "All"}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                chip === c
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "bg-secondary/40 border-border/60 text-muted-foreground hover:text-foreground"
              } ${mode === "real" && c !== "All" ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              {c}
              {c !== "All" && mode !== "real" && <SimulatedBadge compact className="ml-1.5" />}
            </button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground self-center">
            {results.length} results · {allMaterials.length} unique materials in dataset
          </span>
        </div>
      </div>

      {/* Results table */}
      <div className="rounded-xl border border-border/60 bg-card shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground bg-secondary/30">
              <tr>
                <th className="text-left font-medium px-5 py-3">Finished Product / BOM <RealDataBadge className="ml-1" /></th>
                <th className="text-left font-medium px-3 py-3">Raw Material <RealDataBadge className="ml-1" /></th>
                <th className="text-left font-medium px-3 py-3">Supplier <RealDataBadge className="ml-1" /></th>
                <th className="text-left font-medium px-3 py-3">Region {mode === "real" ? null : <SimulatedBadge compact className="ml-1" />}</th>
                <th className="text-right font-medium px-3 py-3">Cost {mode === "real" ? null : <SimulatedBadge compact className="ml-1" />}</th>
                <th className="text-right font-medium px-3 py-3">Lead {mode === "real" ? null : <SimulatedBadge compact className="ml-1" />}</th>
                <th className="text-left font-medium px-3 py-3">Risk {mode === "real" ? null : <SimulatedBadge compact className="ml-1" />}</th>
                <th className="text-left font-medium px-5 py-3">Reliability {mode === "real" ? null : <SimulatedBadge compact className="ml-1" />}</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr
                  key={i}
                  onClick={() => setSelected(r)}
                  className="data-row border-t border-border/40 cursor-pointer"
                >
                  <td className="px-5 py-4">
                    <div className="font-medium font-mono text-xs">{r.finished_product_sku}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      BOM #{r.bom_id} · {r.company_name}
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <div className="text-foreground/90">{r.display_material}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">#{r.raw_material_id}</div>
                  </td>
                  <td className="px-3 py-4">
                    <div className="font-medium">{r.supplier_name}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">#{r.supplier_id}</div>
                  </td>
                  <td className="px-3 py-4 text-muted-foreground">
                    {mode === "real" ? <NotInRealData compact /> : r.sim.region.value}
                  </td>
                  <td className="px-3 py-4 text-right font-mono tabular-nums">
                    {mode === "real" ? <NotInRealData compact /> : `$${r.sim.estimated_cost.value.toFixed(2)}`}
                  </td>
                  <td className="px-3 py-4 text-right tabular-nums text-muted-foreground">
                    {mode === "real" ? <NotInRealData compact /> : `${r.sim.lead_time_days.value}d`}
                  </td>
                  <td className="px-3 py-4">
                    {mode === "real" ? <NotInRealData compact /> : <ScoreBar value={r.sim.risk_score.value} variant="risk" />}
                  </td>
                  <td className="px-5 py-4">
                    {mode === "real" ? <NotInRealData compact /> : <ScoreBar value={r.sim.reliability_score.value} variant="positive" />}
                  </td>
                </tr>
              ))}
              {results.length === 0 && (
                <tr><td colSpan={8} className="text-center text-muted-foreground py-12 text-sm">No results match your query.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail drawer */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto bg-card border-border/60">
          {selected && <DetailContent row={selected} mode={mode} allMaterials={allMaterials} />}
        </SheetContent>
      </Sheet>
    </div>
  );
};

function DetailContent({
  row,
  mode,
  allMaterials,
}: {
  row: EnrichedRow;
  mode: "real" | "simulated" | "comparison";
  allMaterials: ReturnType<typeof getRealRawMaterials>;
}) {
  const ing = simulateIngredientProfile({ raw_material_id: row.raw_material_id, raw_material_sku: row.raw_material_sku });
  const subs = useMemo(
    () => simulateSubstitutes({ raw_material_id: row.raw_material_id, raw_material_sku: row.raw_material_sku }, allMaterials, 3),
    [row.raw_material_id, row.raw_material_sku, allMaterials],
  );

  return (
    <>
      <SheetHeader>
        <div className="flex items-center gap-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Sourcing Path</div>
          <RealDataBadge />
        </div>
        <SheetTitle className="font-display text-2xl">{row.display_material}</SheetTitle>
        <div className="text-xs text-muted-foreground font-mono">
          {row.raw_material_sku} · supplied by {row.supplier_name} (#{row.supplier_id})
        </div>
      </SheetHeader>

      {/* REAL DATA block */}
      <div className="mt-6">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
          From real dataset <RealDataBadge />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            ["Company", row.company_name],
            ["Finished Product SKU", row.finished_product_sku],
            ["BOM ID", `#${row.bom_id}`],
            ["Supplier ID", `#${row.supplier_id}`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-secondary/40 border border-border/60 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
              <div className="text-sm font-medium mt-0.5">{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* SIMULATED block */}
      {mode === "real" ? (
        <div className="mt-6 rounded-lg border border-border/60 bg-secondary/20 p-4">
          <NotInRealData />
          <p className="text-xs text-muted-foreground mt-2">
            Cost, lead time, risk, ingredient profile, and substitute candidates are simulated outputs.
            Switch to <strong className="text-primary">Simulated</strong> or <strong className="text-primary">Comparison</strong> mode to view them.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
              Simulated supplier profile <SimulatedBadge confidence="Medium" />
            </div>
            <div className="space-y-2">
              {[
                ["Region", row.sim.region.value, row.sim.region.confidence],
                ["Country of Origin", row.sim.country_of_origin.value, row.sim.country_of_origin.confidence],
                ["Estimated Cost", `$${row.sim.estimated_cost.value.toFixed(2)}`, row.sim.estimated_cost.confidence],
                ["Lead Time", `${row.sim.lead_time_days.value} days`, row.sim.lead_time_days.confidence],
              ].map(([k, v, c]) => (
                <div key={k as string} className="flex items-center justify-between rounded-lg bg-secondary/30 border border-border/50 px-3 py-2">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{k}</span>
                  <span className="text-sm font-medium flex items-center gap-2">
                    {v} <SimulatedBadge confidence={c as "Low" | "Medium" | "High"} compact />
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              Score Profile <SimulatedBadge confidence="Medium" />
            </h4>
            {[
              ["Availability", row.sim.availability_score.value, "positive"],
              ["Reliability", row.sim.reliability_score.value, "positive"],
              ["Sustainability", row.sim.sustainability_score.value, "positive"],
              ["Risk Exposure", row.sim.risk_score.value, "risk"],
            ].map(([label, v, variant]) => (
              <div key={label as string} className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground w-32">{label as string}</span>
                <ScoreBar value={v as number} variant={variant as "positive" | "risk"} className="flex-1" />
              </div>
            ))}
          </div>

          <div className="mt-6">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              Ingredient Intelligence <SimulatedBadge confidence={ing.functional_role.confidence} />
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ["Functional Role", ing.functional_role.value],
                ["Grade", ing.grade.value],
                ["Purity", ing.purity.value],
                ["Regulatory", ing.regulatory_status.value],
                ["Form", ing.physical_form.value],
                ["Source", ing.source.value],
              ].map(([k, v]) => (
                <div key={k} className="rounded bg-secondary/30 border border-border/50 px-2.5 py-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
                  <div className="font-medium">{v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              Certifications <SimulatedBadge confidence="Low" />
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {row.sim.certifications.value.map((c) => (
                <Badge key={c} variant="outline" className="border-border/60 bg-secondary/40 text-[10px]">{c}</Badge>
              ))}
            </div>
          </div>

          {subs.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                AI Substitute Candidates <SimulatedBadge confidence="Medium" />
              </h4>
              <div className="space-y-2">
                {subs.map((s) => (
                  <div key={s.candidate_material_id} className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-sm">{s.candidate_name}</div>
                      <Badge variant="outline" className="border-primary/30 text-primary text-[10px]">
                        {(s.compatibility_score * 100).toFixed(0)}% match · {s.recommendation_confidence}
                      </Badge>
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{s.candidate_sku}</div>
                    <div className="flex gap-3 mt-2 text-[11px] text-muted-foreground">
                      <span>Cost: <b className="text-foreground">{s.cost_impact}</b></span>
                      <span>Risk: <b className="text-foreground">{s.risk_impact}</b></span>
                      <span>Lead: <b className="text-foreground">{s.lead_time_impact}</b></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {mode === "comparison" && (
        <div className="mt-6 rounded-lg border border-border/60 bg-secondary/20 p-4">
          <h4 className="text-sm font-semibold mb-2">Real vs Simulated</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded border border-success/30 bg-success/5 p-3">
              <div className="text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1" style={{ color: "hsl(var(--success))" }}>
                Real coverage <RealDataBadge />
              </div>
              <ul className="space-y-1 text-foreground/90 list-disc list-inside">
                <li>Company → Product → BOM</li>
                <li>Material ↔ Supplier edge</li>
                <li>SKU identifiers</li>
              </ul>
            </div>
            <div className="rounded border border-primary/30 bg-primary/5 p-3">
              <div className="text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1 text-primary">
                Added intelligence <SimulatedBadge compact />
              </div>
              <ul className="space-y-1 text-foreground/90 list-disc list-inside">
                <li>Cost / lead / risk estimates</li>
                <li>Ingredient + regulatory profile</li>
                <li>Substitute recommendations</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 flex gap-2">
        <Button className="flex-1 bg-gradient-primary text-primary-foreground">Add to Sourcing Plan</Button>
        <Button variant="outline" className="border-border/60">Compare</Button>
      </div>
    </>
  );
}

export default ProcurementSearch;
