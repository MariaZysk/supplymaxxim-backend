import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";

export function MetricCard({
  label,
  value,
  delta,
  trend = "up",
  icon: Icon,
  accent = "primary",
}: {
  label: string;
  value: string | number;
  delta?: string;
  trend?: "up" | "down" | "neutral";
  icon: LucideIcon;
  accent?: "primary" | "accent" | "success" | "warning" | "destructive";
}) {
  const accentMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary border-primary/20",
    accent: "bg-accent/10 text-accent border-accent/20",
    success: "bg-success/10 border-success/20",
    warning: "bg-warning/10 border-warning/20",
    destructive: "bg-destructive/10 text-destructive border-destructive/20",
  };
  const trendStyles =
    trend === "up"
      ? "text-success"
      : trend === "down"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <div className="metric-card group">
      <div className="flex items-start justify-between">
        <div className={cn("h-9 w-9 rounded-lg border flex items-center justify-center", accentMap[accent])}>
          <Icon className="h-4.5 w-4.5" style={{ width: 18, height: 18, color: accent === "success" ? "hsl(var(--success))" : accent === "warning" ? "hsl(var(--warning))" : undefined }} />
        </div>
        {delta && (
          <span className={cn("inline-flex items-center gap-0.5 text-[11px] font-medium", trendStyles)}>
            {trend === "up" ? <ArrowUpRight className="h-3 w-3" /> : trend === "down" ? <ArrowDownRight className="h-3 w-3" /> : null}
            {delta}
          </span>
        )}
      </div>
      <div className="mt-4">
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
        <div className="font-display text-2xl font-semibold mt-1 tracking-tight">{value}</div>
      </div>
    </div>
  );
}
