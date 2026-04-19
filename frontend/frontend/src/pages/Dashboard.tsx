import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import {
  Users,
  Boxes,
  FileStack,
  Sparkles,
  AlertTriangle,
  TrendingDown,
  ArrowRight,
  Building2,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "react-router-dom";
import { useMemo } from "react";
import {
  getRealKpis,
  getRealSuppliers,
  realRows,
  nameFromSku,
} from "@/data/realData";
import {
  simulateAggregateKpis,
  simulateTrend,
} from "@/data/simulatedIntelligence";
import { useDataMode } from "@/contexts/DataModeContext";
import { SimulatedBadge, RealDataBadge, NotInRealData } from "@/components/SimulatedBadge";

const Dashboard = () => {
  const { mode } = useDataMode();
  const real = useMemo(() => getRealKpis(), []);
  const suppliers = useMemo(() => getRealSuppliers(), []);
  const sim = useMemo(() => simulateAggregateKpis(realRows, suppliers), [suppliers]);
  const trend = useMemo(() => simulateTrend(), []);
  const recent = useMemo(() => realRows.slice(0, 8), []);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Operations Overview"
        title="Procurement Intelligence Dashboard"
        subtitle="Real procurement relationships from your dataset, optionally enriched with simulated AI intelligence."
        actions={
          <>
            <Button variant="outline" size="sm" className="border-border/60">Export</Button>
            <Button size="sm" className="bg-gradient-primary text-primary-foreground" asChild>
              <Link to="/app/search">
                New Sourcing Run <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </>
        }
      />

      {/* Mode banner */}
      <div className="rounded-lg border border-border/60 bg-card/60 px-4 py-2.5 flex items-center gap-3 text-xs">
        {mode === "real" && (<><RealDataBadge /><span className="text-muted-foreground">Showing only verified relationships from <span className="font-mono text-foreground">mydata.json</span> — simulated intelligence is hidden.</span></>)}
        {mode === "simulated" && (<><SimulatedBadge confidence="Medium" /><span className="text-muted-foreground">Real entities enriched with AI-inferred fields. Every simulated value is tagged with provenance and confidence.</span></>)}
        {mode === "comparison" && (<><RealDataBadge /><SimulatedBadge confidence="Medium" /><span className="text-muted-foreground">Side-by-side: factual coverage vs added intelligence.</span></>)}
      </div>

      {/* Metric grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard label="Companies" value={real.companies.toLocaleString()} delta="real" trend="up" icon={Building2} accent="primary" />
        <MetricCard label="Active Suppliers" value={real.suppliers.toLocaleString()} delta="real" trend="up" icon={Users} accent="primary" />
        <MetricCard label="Raw Materials" value={real.raw_materials.toLocaleString()} delta="real" trend="up" icon={Boxes} accent="accent" />
        <MetricCard label="BOMs Evaluated" value={real.boms.toLocaleString()} delta="real" trend="up" icon={FileStack} accent="primary" />
        <MetricCard label="Supplier Links" value={real.relationships.toLocaleString()} delta="real" trend="up" icon={Link2} accent="accent" />
        {mode === "real" ? (
          <div className="metric-card flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">AI Recommendations</span>
              <Sparkles className="h-4 w-4 text-muted-foreground/40" />
            </div>
            <NotInRealData className="mt-3" />
          </div>
        ) : (
          <MetricCard
            label="AI Recs (sim.)"
            value={sim.ai_recommendations_generated.toLocaleString()}
            delta="simulated"
            trend="up"
            icon={Sparkles}
            accent="accent"
          />
        )}
      </div>

      {/* Simulated KPI strip — only outside Real mode */}
      {mode !== "real" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SimKpi label="Risk Alerts" value={sim.risk_alerts} icon={AlertTriangle} />
          <SimKpi label="Cost Opportunities" value={sim.cost_opportunities} icon={TrendingDown} />
          <SimKpi label="Avg Risk Index" value={sim.avg_risk_index.toFixed(2)} icon={AlertTriangle} />
          <SimKpi label="Avg Lead (days)" value={`${sim.avg_lead_time_days}d`} icon={Sparkles} />
        </div>
      )}

      {/* Trend + insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-border/60 bg-card p-6 shadow-card">
          <div className="flex items-start justify-between mb-1">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
                Sourcing Performance {mode !== "real" ? <SimulatedBadge confidence="Medium" /> : <RealDataBadge />}
              </div>
              <h3 className="font-display text-lg font-semibold mt-1">Average Cost & Risk · Last 8 months</h3>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><span className="status-dot bg-primary" />Avg Unit Cost</span>
              <span className="inline-flex items-center gap-1.5"><span className="status-dot bg-accent" />Risk Index</span>
            </div>
          </div>
          {mode === "real" ? (
            <div className="h-72 mt-4 flex flex-col items-center justify-center text-center px-6">
              <NotInRealData />
              <p className="text-xs text-muted-foreground mt-2 max-w-md">
                Time-series cost & risk trends are not present in the real dataset.
                Switch to Simulated mode to view AI-estimated trends.
              </p>
            </div>
          ) : (
            <div className="h-72 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="cost" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#g1)" />
                  <Area type="monotone" dataKey="risk" stroke="hsl(var(--accent))" strokeWidth={2} fill="url(#g2)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">AI Engine</div>
              <h3 className="font-display text-lg font-semibold mt-1">Live Insights</h3>
            </div>
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-[10px]">v2.4</Badge>
          </div>
          {mode === "real" ? (
            <div className="rounded-lg border border-border/50 bg-secondary/20 p-4 text-center">
              <NotInRealData />
              <p className="text-[11px] text-muted-foreground mt-2">
                Live AI insights are simulated outputs. Enable Simulated or Comparison mode.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { sev: "warning", text: `${sim.risk_alerts} suppliers flagged: simulated risk score above the 0.45 threshold across the active network.` },
                { sev: "info", text: `${sim.cost_opportunities} BOMs show estimated 6–14% cost reduction potential via supplier reallocation.` },
                { sev: "success", text: `Substitution engine surfaces feasible alternatives for ${Math.round(real.raw_materials * 0.62)} of ${real.raw_materials} raw materials.` },
              ].map((i, idx) => {
                const dot = i.sev === "warning" ? "bg-warning" : i.sev === "success" ? "bg-success" : "bg-primary";
                return (
                  <div key={idx} className="flex gap-3 p-3 rounded-lg bg-secondary/30 border border-border/50">
                    <span className={`status-dot mt-1.5 ${dot}`} />
                    <div className="text-xs leading-relaxed text-foreground/90">
                      {i.text}
                      <div className="mt-1.5"><SimulatedBadge confidence="Medium" /></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Button variant="ghost" size="sm" className="w-full mt-4 text-primary hover:text-primary" asChild>
            <Link to="/app/decisions">Open Decision Support <ArrowRight className="ml-1 h-3 w-3" /></Link>
          </Button>
        </div>
      </div>

      {/* Recent activity — REAL */}
      <div className="rounded-xl border border-border/60 bg-card shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
              Real Sourcing Relationships <RealDataBadge />
            </div>
            <h3 className="font-display text-lg font-semibold mt-1">Material → Supplier Edges</h3>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/app/bom">Open BOM Explorer <ArrowRight className="ml-1 h-3 w-3" /></Link>
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground bg-secondary/30">
              <tr>
                <th className="text-left font-medium px-6 py-3">Company</th>
                <th className="text-left font-medium px-4 py-3">Finished Product</th>
                <th className="text-left font-medium px-4 py-3">BOM</th>
                <th className="text-left font-medium px-4 py-3">Material</th>
                <th className="text-left font-medium px-6 py-3">Supplier</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r, i) => (
                <tr key={i} className="data-row border-t border-border/40">
                  <td className="px-6 py-3 text-muted-foreground">{r.company_name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.finished_product_sku}</td>
                  <td className="px-4 py-3 font-mono text-xs text-primary">#{r.bom_id}</td>
                  <td className="px-4 py-3">{nameFromSku(r.raw_material_sku)}</td>
                  <td className="px-6 py-3 font-medium">{r.supplier_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

function SimKpi({ label, value, icon: Icon }: { label: string; value: number | string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="mt-2 text-2xl font-display font-semibold">{value}</div>
      <SimulatedBadge confidence="Medium" className="mt-2" />
    </div>
  );
}

export default Dashboard;
