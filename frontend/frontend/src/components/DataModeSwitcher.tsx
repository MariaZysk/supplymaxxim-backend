import { Database, Sparkles, GitCompare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDataMode, type DataMode } from "@/contexts/DataModeContext";

const options: { value: DataMode; label: string; short: string; Icon: typeof Database }[] = [
  { value: "real", label: "Real Data", short: "Real", Icon: Database },
  { value: "simulated", label: "Simulated Intelligence", short: "Simulated", Icon: Sparkles },
  { value: "comparison", label: "Comparison", short: "Compare", Icon: GitCompare },
];

export function DataModeSwitcher({ className }: { className?: string }) {
  const { mode, setMode } = useDataMode();
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 p-0.5 rounded-lg border border-border/60 bg-card/60 backdrop-blur",
        className,
      )}
      role="tablist"
      aria-label="Data mode"
    >
      {options.map(({ value, short, label, Icon }) => {
        const active = mode === value;
        return (
          <button
            key={value}
            role="tab"
            aria-selected={active}
            title={label}
            onClick={() => setMode(value)}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all",
              active
                ? "bg-primary/15 text-primary border border-primary/30 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.15)]"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50 border border-transparent",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{short}</span>
          </button>
        );
      })}
    </div>
  );
}
