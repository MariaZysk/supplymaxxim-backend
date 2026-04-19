import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { ScoreBar } from "@/components/ScoreBar";
import { Badge } from "@/components/ui/badge";
import { procurementData, type Substitute } from "@/data/mockData";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowRight, Sparkles, TrendingDown, TrendingUp, Repeat } from "lucide-react";

const SubstitutionEngine = () => {
  const materialsWithSubs = useMemo(
    () => procurementData.filter((r) => r.substitute_options.length > 0),
    [],
  );
  const [recordIdx, setRecordIdx] = useState(0);
  const record = materialsWithSubs[recordIdx];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Substitution Engine"
        title="AI Substitution Analysis"
        subtitle="Discover viable substitute materials with quantified compatibility, cost, and risk impact."
        actions={
          <Select value={String(recordIdx)} onValueChange={(v) => setRecordIdx(Number(v))}>
            <SelectTrigger className="w-80 bg-secondary/40 border-border/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {materialsWithSubs.map((r, i) => (
                <SelectItem key={i} value={String(i)}>{r.raw_material_name} · {r.bom_id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {/* Source material */}
      <div className="rounded-xl border border-border/60 bg-card p-6 shadow-card">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Source Material</div>
            <h3 className="font-display text-xl font-semibold mt-1">{record.raw_material_name}</h3>
            <div className="text-xs text-muted-foreground font-mono mt-1">
              {record.raw_material_sku} · used in {record.finished_product_name} ({record.bom_id})
            </div>
          </div>
          <div className="flex gap-6">
            <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Cost</div><div className="font-display text-lg font-semibold">${record.estimated_cost.toFixed(2)}</div></div>
            <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Lead</div><div className="font-display text-lg font-semibold">{record.lead_time_days}d</div></div>
            <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Risk</div><div className="font-display text-lg font-semibold">{(record.risk_score * 100).toFixed(0)}</div></div>
          </div>
        </div>
      </div>

      {/* Substitutes grid + AI panel */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          {record.substitute_options.map((s, i) => (
            <SubstituteCard key={i} sub={s} />
          ))}
        </div>

        {/* AI rationale panel */}
        <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-elegant">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-primary">AI Recommendation</div>
              <div className="font-display font-semibold">Substitution Insight</div>
            </div>
          </div>

          <div className="space-y-4 text-sm leading-relaxed">
            <p className="text-foreground/90">
              The engine identified <b>{record.substitute_options.length}</b> feasible substitutes for{" "}
              <b>{record.raw_material_name}</b> with confidence above 0.55.
            </p>

            <div className="space-y-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">When to substitute</div>
                <p className="text-xs text-foreground/80">If primary supplier lead time exceeds 14 days or cost variance breaches +6%.</p>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Tradeoffs</div>
                <p className="text-xs text-foreground/80">Higher-confidence substitutes typically carry +3–11% cost premium but reduce single-source risk by ~15%.</p>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Risks</div>
                <p className="text-xs text-foreground/80">Validate downstream formulation impact and re-certify with affected QA bodies before swap.</p>
              </div>
            </div>

            <div className="pt-4 border-t border-border/60">
              <div className="text-[10px] uppercase tracking-wider text-success mb-1">Recommended next action</div>
              <div className="flex items-start gap-2">
                <ArrowRight className="h-4 w-4 mt-0.5 text-success" />
                <p className="text-sm font-medium">Initiate qualification trial with top-ranked substitute and run parallel sourcing for 2 production cycles.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function SubstituteCard({ sub }: { sub: Substitute }) {
  const costNeg = sub.cost_impact.startsWith("-");
  const riskNeg = sub.risk_impact.startsWith("-");
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-card hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Repeat className="h-4 w-4 text-primary" />
            <h4 className="font-semibold">{sub.name}</h4>
            <Badge variant="outline" className="border-primary/30 text-primary text-[10px]">
              {(sub.compatibility_score * 100).toFixed(0)}% compatibility
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed max-w-xl">{sub.rationale}</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Confidence</div>
          <div className="font-display text-lg font-semibold">{(sub.confidence * 100).toFixed(0)}%</div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-border/40">
        <Metric label="Cost Impact" value={sub.cost_impact} good={costNeg} icon={costNeg ? TrendingDown : TrendingUp} />
        <Metric label="Risk Impact" value={sub.risk_impact} good={riskNeg} icon={riskNeg ? TrendingDown : TrendingUp} />
        <Metric label="Lead Time" value={sub.lead_time_impact} good={sub.lead_time_impact.startsWith("-")} icon={sub.lead_time_impact.startsWith("-") ? TrendingDown : TrendingUp} />
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Compatibility</div>
          <ScoreBar value={sub.compatibility_score} variant="positive" className="mt-1.5" />
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, good, icon: Icon }: { label: string; value: string; good: boolean; icon: any }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-display text-base font-semibold mt-0.5 inline-flex items-center gap-1 ${good ? "text-success" : "text-warning"}`}>
        <Icon className="h-3.5 w-3.5" />{value}
      </div>
    </div>
  );
}

export default SubstitutionEngine;
