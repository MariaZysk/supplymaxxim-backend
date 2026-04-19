import { Badge } from "@/components/ui/badge";
import { Sparkles, Database, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Confidence, Provenance } from "@/data/simulatedIntelligence";

const provColor: Record<Provenance, string> = {
  Simulated: "border-accent/40 bg-accent/10 text-accent",
  Inferred: "border-primary/40 bg-primary/10 text-primary",
  Estimated: "border-warning/40 bg-warning/10 text-warning",
};
const confColor: Record<Confidence, string> = {
  High: "text-success",
  Medium: "text-warning",
  Low: "text-destructive",
};

export function SimulatedBadge({
  provenance = "Simulated",
  confidence,
  className,
  compact = false,
}: {
  provenance?: Provenance;
  confidence?: Confidence;
  className?: string;
  compact?: boolean;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 px-1.5 py-0 text-[9px] font-medium uppercase tracking-wider",
        provColor[provenance],
        className,
      )}
    >
      <Sparkles className="h-2.5 w-2.5" />
      {compact ? provenance.charAt(0) : provenance}
      {confidence && !compact && (
        <span className={cn("ml-1 font-semibold", confColor[confidence])}>· {confidence}</span>
      )}
    </Badge>
  );
}

export function RealDataBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 px-1.5 py-0 text-[9px] font-medium uppercase tracking-wider border-success/40 bg-success/10",
        className,
      )}
      style={{ color: "hsl(var(--success))" }}
    >
      <Database className="h-2.5 w-2.5" />
      Real
    </Badge>
  );
}

export function NotInRealData({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] text-muted-foreground italic", className)}>
      <AlertCircle className="h-3 w-3" />
      {compact ? "n/a" : "Not available in real dataset"}
    </span>
  );
}
