import { cn } from "@/design/utils";

export interface ProgressBarProps {
  /** 0–100, clamped. */
  value: number;
  /** When omitted the bar is aria-hidden — the parent owns the semantics. */
  label?: string;
  className?: string;
}

export function ProgressBar({ value, label, className }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      role={label ? "progressbar" : undefined}
      aria-label={label}
      aria-valuenow={label ? Math.round(clamped) : undefined}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      aria-hidden={label ? undefined : true}
      className={cn("h-xs w-full overflow-hidden rounded-pill bg-border", className)}
    >
      <div
        className="h-full rounded-pill bg-primary transition-[width] duration-standard ease-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
