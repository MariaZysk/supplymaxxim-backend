import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { ScoreBar } from "@/components/ScoreBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Check, MapPin, Plus, X } from "lucide-react";
import {
  getRealRawMaterials,
  getRowsByMaterial,
  nameFromSku,
} from "@/data/realData";
import { simulateSupplierProfile } from "@/data/simulatedIntelligence";
import { useDataMode } from "@/contexts/DataModeContext";
import { SimulatedBadge, RealDataBadge, NotInRealData } from "@/components/SimulatedBadge";

const SupplierIntelligence = () => {
  const { mode } = useDataMode();
  const materials = useMemo(() => getRealRawMaterials().sort((a, b) => b.supplier_count - a.supplier_count), []);
  // pick first material that has at least 2 suppliers for a useful default
  const initial = materials.find((m) => m.supplier_count >= 2) ?? materials[0];

  const [materialId, setMaterialId] = useState<number>(initial.raw_material_id);
  const rows = useMemo(() => getRowsByMaterial(materialId), [materialId]);
  const supplierRows = useMemo(() => {
    // dedupe by supplier
    const m = new Map<number, { supplier_id: number; supplier_name: string }>();
    rows.forEach((r) => m.set(r.supplier_id, { supplier_id: r.supplier_id, supplier_name: r.supplier_name }));
    return Array.from(m.values()).map((s) => ({
      ...s,
      sim: simulateSupplierProfile(s.supplier_id, materialId),
    }));
  }, [rows, materialId]);

  const [selected, setSelected] = useState<number[]>(supplierRows.slice(0, 2).map((s) => s.supplier_id));

  // Reset selection when material changes
  useMemo(() => {
    setSelected(supplierRows.slice(0, 2).map((s) => s.supplier_id));
  }, [materialId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: number) => {
    setSelected((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < 4 ? [...cur, id] : cur);
  };

  const compareSet = supplierRows.filter((s) => selected.includes(s.supplier_id));
  const bestCost = compareSet.length ? Math.min(...compareSet.map((s) => s.sim.estimated_cost.value)) : 0;
  const bestLead = compareSet.length ? Math.min(...compareSet.map((s) => s.sim.lead_time_days.value)) : 0;
  const bestRisk = compareSet.length ? Math.min(...compareSet.map((s) => s.sim.risk_score.value)) : 0;

  const currentMaterial = materials.find((m) => m.raw_material_id === materialId);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Supplier Intelligence"
        title="Supplier Network Visibility"
        subtitle="For any raw material in your real dataset, compare every approved supplier across cost, lead time, risk, and reliability."
      />

      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-card flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Raw material</div>
        <Select value={String(materialId)} onValueChange={(v) => setMaterialId(Number(v))}>
          <SelectTrigger className="lg:w-[420px] h-11 bg-secondary/40 border-border/60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-[400px]">
            {materials.slice(0, 200).map((m) => (
              <SelectItem key={m.raw_material_id} value={String(m.raw_material_id)}>
                {m.display_name} <span className="text-muted-foreground ml-1">· {m.supplier_count} suppliers</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
          <RealDataBadge />
          <span>{supplierRows.length} approved suppliers · used in {currentMaterial?.used_in_bom_count ?? 0} BOMs</span>
        </div>
      </div>

      {/* Supplier list */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {supplierRows.map((s) => {
          const isSel = selected.includes(s.supplier_id);
          return (
            <div
              key={s.supplier_id}
              className={`rounded-xl border p-4 transition-all ${
                isSel ? "border-primary/50 bg-primary/5" : "border-border/60 bg-card"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{s.supplier_name}</div>
                  <div className="text-[11px] text-muted-foreground font-mono mt-0.5 flex items-center gap-2">
                    #{s.supplier_id}
                    <RealDataBadge />
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={isSel ? "default" : "outline"}
                  className={isSel ? "bg-primary text-primary-foreground" : "border-border/60"}
                  onClick={() => toggle(s.supplier_id)}
                >
                  {isSel ? <><Check className="h-3.5 w-3.5 mr-1" /> Selected</> : <><Plus className="h-3.5 w-3.5 mr-1" /> Compare</>}
                </Button>
              </div>

              {mode === "real" ? (
                <div className="mt-3 pt-3 border-t border-border/50 text-[11px]">
                  <NotInRealData />
                  <p className="text-muted-foreground mt-1">
                    Region, cost, lead time, and risk are not in the real dataset.
                  </p>
                </div>
              ) : (
                <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {s.sim.region.value} · {s.sim.country_of_origin.value}
                    </span>
                    <SimulatedBadge confidence={s.sim.region.confidence} compact />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cost</div>
                      <div className="font-mono tabular-nums">${s.sim.estimated_cost.value.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Lead</div>
                      <div className="font-mono tabular-nums">{s.sim.lead_time_days.value}d</div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-20">Reliability</span>
                      <ScoreBar value={s.sim.reliability_score.value} variant="positive" className="flex-1" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-20">Risk</span>
                      <ScoreBar value={s.sim.risk_score.value} variant="risk" className="flex-1" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Comparison panel */}
      {compareSet.length >= 2 && mode !== "real" && (
        <div className="rounded-xl border border-border/60 bg-card shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
                Side-by-side comparison <SimulatedBadge confidence="Medium" />
              </div>
              <h3 className="font-display text-lg font-semibold mt-1">
                {compareSet.length} suppliers · {currentMaterial?.display_name}
              </h3>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
              Clear all
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground bg-secondary/30">
                <tr>
                  <th className="text-left font-medium px-6 py-3">Metric</th>
                  {compareSet.map((s) => (
                    <th key={s.supplier_id} className="text-left font-medium px-4 py-3 min-w-[180px]">
                      <div className="font-semibold text-foreground">{s.supplier_name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">#{s.supplier_id}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { k: "Region", get: (s: typeof compareSet[number]) => s.sim.region.value },
                  { k: "Country", get: (s: typeof compareSet[number]) => s.sim.country_of_origin.value },
                  { k: "Estimated Cost", get: (s: typeof compareSet[number]) => `$${s.sim.estimated_cost.value.toFixed(2)}`, best: (s: typeof compareSet[number]) => s.sim.estimated_cost.value === bestCost },
                  { k: "Lead Time", get: (s: typeof compareSet[number]) => `${s.sim.lead_time_days.value}d`, best: (s: typeof compareSet[number]) => s.sim.lead_time_days.value === bestLead },
                  { k: "Risk", get: (s: typeof compareSet[number]) => s.sim.risk_score.value.toFixed(2), best: (s: typeof compareSet[number]) => s.sim.risk_score.value === bestRisk },
                  { k: "Reliability", get: (s: typeof compareSet[number]) => s.sim.reliability_score.value.toFixed(2) },
                  { k: "Sustainability", get: (s: typeof compareSet[number]) => s.sim.sustainability_score.value.toFixed(2) },
                ].map((row) => (
                  <tr key={row.k} className="border-t border-border/40">
                    <td className="px-6 py-3 text-muted-foreground text-xs uppercase tracking-wider">{row.k}</td>
                    {compareSet.map((s) => {
                      const isBest = (row as { best?: (s: typeof compareSet[number]) => boolean }).best?.(s);
                      return (
                        <td key={s.supplier_id} className="px-4 py-3 font-mono tabular-nums">
                          <span className={isBest ? "text-success font-semibold" : ""}>{row.get(s)}</span>
                          {isBest && <Badge variant="outline" className="ml-2 border-success/40 text-[10px]" style={{ color: "hsl(var(--success))" }}>Best</Badge>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {compareSet.length >= 2 && mode === "real" && (
        <div className="rounded-xl border border-border/60 bg-card p-6 text-center">
          <NotInRealData />
          <p className="text-xs text-muted-foreground mt-2">
            Side-by-side cost / risk / lead time comparison requires simulated intelligence.
            Switch to <strong className="text-primary">Simulated</strong> mode.
          </p>
        </div>
      )}
    </div>
  );
};

export default SupplierIntelligence;
