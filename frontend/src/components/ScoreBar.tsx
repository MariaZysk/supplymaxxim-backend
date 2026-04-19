import { cn } from "@/lib/utils";

export function ScoreBar({
  value,
  variant = "auto",
  className,
}: {
  value: number; // 0..1
  variant?: "auto" | "risk" | "positive";
  className?: string;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  // For "risk" lower is better. For "positive" higher is better.
  let color = "bg-primary";
  if (variant === "risk") {
    color = pct < 30 ? "bg-success" : pct < 55 ? "bg-warning" : "bg-destructive";
  } else if (variant === "positive") {
    color = pct < 60 ? "bg-warning" : pct < 80 ? "bg-primary" : "bg-success";
  }
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 w-full max-w-[120px] rounded-full bg-secondary overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-mono tabular-nums text-muted-foreground w-9">
        {pct.toFixed(0)}
      </span>
    </div>
  );
}
