import { PageHeader } from "@/components/PageHeader";
import {
  regionDistribution,
  riskBreakdown,
  substitutionUsage,
  supplierTrend,
} from "@/data/mockData";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const colors = [
  "hsl(213 94% 60%)",
  "hsl(199 89% 65%)",
  "hsl(180 70% 50%)",
  "hsl(38 95% 58%)",
  "hsl(152 65% 45%)",
];

const Analytics = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analytics"
        title="Operational Insights"
        subtitle="Boardroom-ready visibility across supplier distribution, risk exposure, sourcing trends, and substitution adoption."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Cost & Risk Trends" subtitle="8-month rolling average">
          <LineChart data={supplierTrend}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="cost" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="risk" stroke="hsl(var(--accent))" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ChartCard>

        <ChartCard title="Supplier Distribution" subtitle="By region">
          <PieChart>
            <Pie
              data={regionDistribution}
              dataKey="value"
              nameKey="region"
              innerRadius={60}
              outerRadius={95}
              paddingAngle={3}
              stroke="hsl(var(--background))"
              strokeWidth={2}
            >
              {regionDistribution.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }} />
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ChartCard>

        <ChartCard title="Sourcing Risk Breakdown" subtitle="By category">
          <BarChart data={riskBreakdown} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="category" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={90} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--secondary) / 0.4)" }} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]}>
              {riskBreakdown.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ChartCard>

        <ChartCard title="Substitution Adoption" subtitle="Weekly substitution usage">
          <BarChart data={substitutionUsage}>
            <defs>
              <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--secondary) / 0.4)" }} />
            <Bar dataKey="count" fill="url(#bg)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartCard>
      </div>

      {/* Outcome strip */}
      <div className="rounded-xl border border-border/60 bg-card p-6 shadow-card">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-4">Procurement Decision Outcomes — Last 90 days</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            ["Cost saved", "$284K", "+12%"],
            ["Risk reduced", "18%", "+4 pts"],
            ["Substitutions adopted", "47", "+22%"],
            ["Lead-time reduction", "3.4 days", "—"],
          ].map(([k, v, d]) => (
            <div key={k} className="rounded-lg border border-border/40 bg-secondary/30 p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{k}</div>
              <div className="font-display text-2xl font-semibold mt-1.5">{v}</div>
              <div className="text-[11px] text-success mt-1">{d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactElement }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-6 shadow-card">
      <div className="mb-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{subtitle}</div>
        <h3 className="font-display text-lg font-semibold mt-1">{title}</h3>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
    </div>
  );
}

export default Analytics;
