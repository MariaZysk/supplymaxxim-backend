import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getRealFinishedProducts,
  getRowsByBom,
  nameFromSku,
  type RealFinishedProduct,
} from "@/data/realData";
import { simulateSupplierProfile, simulateIngredientProfile } from "@/data/simulatedIntelligence";
import { useDataMode } from "@/contexts/DataModeContext";
import { SimulatedBadge, RealDataBadge, NotInRealData } from "@/components/SimulatedBadge";
import { ScoreBar } from "@/components/ScoreBar";
import { Search, ChevronRight, X } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";

const BomExplorer = () => {
  const { mode } = useDataMode();
  const products = useMemo(() => getRealFinishedProducts(), []);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<RealFinishedProduct | null>(null);

  const filtered = useMemo(() => {
    if (!query) return products.slice(0, 60);
    const q = query.toLowerCase();
    return products.filter((p) =>
      [p.finished_product_sku, String(p.finished_product_id), p.company_name, String(p.bom_id)]
        .join(" ").toLowerCase().includes(q),
    ).slice(0, 80);
  }, [products, query]);

  const rows = selected ? getRowsByBom(selected.bom_id) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="BOM Explorer"
        title="Bill of Materials Intelligence"
        subtitle="Inspect each finished product's real BOM with the supplier graph and (optionally) simulated ingredient intelligence."
      />

      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-card">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search finished products, BOMs, companies, SKUs…"
            className="pl-10 h-11 bg-secondary/40 border-border/60"
          />
        </div>
        <div className="mt-3 text-[11px] text-muted-foreground flex items-center gap-3">
          <RealDataBadge />
          <span>{products.length} finished products · {filtered.length} shown</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {filtered.map((p) => (
          <button
            key={p.finished_product_id}
            onClick={() => setSelected(p)}
            className="text-left rounded-xl border border-border/60 bg-card p-4 shadow-card hover:border-primary/40 transition-all group"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {p.company_name}
                </div>
                <div className="font-medium truncate mt-0.5">{p.finished_product_sku}</div>
                <div className="text-[11px] text-muted-foreground font-mono mt-1">
                  BOM #{p.bom_id} · FP #{p.finished_product_id}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" />
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Badge variant="outline" className="border-border/60 bg-secondary/40 text-[10px]">
                {p.raw_material_count} materials
              </Badge>
              <Badge variant="outline" className="border-border/60 bg-secondary/40 text-[10px]">
                {p.supplier_count} suppliers
              </Badge>
              <RealDataBadge className="ml-auto" />
            </div>
          </button>
        ))}
      </div>

      {/* Detail drawer */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto bg-card border-border/60">
          {selected && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Bill of Materials
                  </div>
                  <RealDataBadge />
                </div>
                <SheetTitle className="font-display text-xl">{selected.finished_product_sku}</SheetTitle>
                <div className="text-xs text-muted-foreground">
                  {selected.company_name} · BOM #{selected.bom_id} · {rows.length} material→supplier edges
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-3">
                {rows.map((r) => {
                  const ing = simulateIngredientProfile({ raw_material_id: r.raw_material_id, raw_material_sku: r.raw_material_sku });
                  const sup = simulateSupplierProfile(r.supplier_id, r.raw_material_id);
                  return (
                    <div key={`${r.raw_material_id}-${r.supplier_id}`} className="rounded-lg border border-border/60 bg-secondary/20 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            Raw Material <RealDataBadge />
                          </div>
                          <div className="font-medium mt-0.5">{nameFromSku(r.raw_material_sku)}</div>
                          <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                            #{r.raw_material_id} · {r.raw_material_sku}
                          </div>
                        </div>
                        <div className="text-right min-w-0">
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 justify-end">
                            Supplier <RealDataBadge />
                          </div>
                          <div className="font-medium mt-0.5 truncate">{r.supplier_name}</div>
                          <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                            #{r.supplier_id}
                          </div>
                        </div>
                      </div>

                      {mode !== "real" && (
                        <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 gap-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Ingredient</span>
                              <SimulatedBadge provenance={ing.functional_role.provenance} confidence={ing.functional_role.confidence} compact />
                            </div>
                            <div className="text-xs">{ing.functional_role.value} · {ing.grade.value}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {ing.purity.value} · {ing.physical_form.value}
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Supplier signal</span>
                              <SimulatedBadge provenance="Estimated" confidence={sup.reliability_score.confidence} compact />
                            </div>
                            <div className="space-y-1">
                              <ScoreBar value={sup.reliability_score.value} variant="positive" />
                              <ScoreBar value={sup.risk_score.value} variant="risk" />
                            </div>
                          </div>
                        </div>
                      )}

                      {mode === "real" && (
                        <div className="mt-3 pt-3 border-t border-border/50 text-[11px]">
                          <NotInRealData />
                          <span className="text-muted-foreground"> · Switch to Simulated mode for ingredient profile, lead time, and risk estimates.</span>
                        </div>
                      )}

                      {mode === "comparison" && (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div className="rounded border border-success/30 bg-success/5 p-2">
                            <div className="text-[10px] uppercase tracking-wider flex items-center gap-1 mb-1" style={{ color: "hsl(var(--success))" }}>
                              <RealDataBadge /> Real fields
                            </div>
                            <div className="text-[11px] text-foreground/90">name, sku, supplier link</div>
                          </div>
                          <div className="rounded border border-primary/30 bg-primary/5 p-2">
                            <div className="text-[10px] uppercase tracking-wider flex items-center gap-1 mb-1 text-primary">
                              <SimulatedBadge compact /> Added by AI
                            </div>
                            <div className="text-[11px] text-foreground/90">role, grade, risk, lead</div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 flex gap-2">
                <Button variant="outline" className="flex-1 border-border/60" onClick={() => setSelected(null)}>
                  <X className="h-3.5 w-3.5 mr-1" /> Close
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default BomExplorer;
