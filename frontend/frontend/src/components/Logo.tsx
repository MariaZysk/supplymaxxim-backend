import { cn } from "@/lib/utils";

export const Logo = ({ className, showWordmark = true }: { className?: string; showWordmark?: boolean }) => {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative h-8 w-8 shrink-0">
        <div className="absolute inset-0 rounded-lg bg-gradient-primary opacity-90" />
        <div className="absolute inset-[3px] rounded-md bg-background flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-primary" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="8" />
            <ellipse cx="12" cy="12" rx="8" ry="3.5" />
            <ellipse cx="12" cy="12" rx="3.5" ry="8" />
          </svg>
        </div>
      </div>
      {showWordmark && (
        <div className="leading-none">
          <div className="font-display font-semibold tracking-tight text-[15px]">
            Spheremaxxing
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-0.5">
            Intelligence Console
          </div>
        </div>
      )}
    </div>
  );
};
