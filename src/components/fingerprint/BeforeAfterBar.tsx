"use client";

import { useEffect, useState } from "react";
import { cn } from "@/design/utils";

export interface BeforeAfterBarProps {
  label: string;
  /** 0–100. */
  before: number;
  /** 0–100. */
  after: number;
  /** Overrides the "after" fill transition (ms), e.g. a slower reveal. */
  afterDurationMs?: number;
  /** Delays the "after" fill + delta chip (ms). */
  afterDelayMs?: number;
  className?: string;
}

function Bar({
  name,
  value,
  fill,
  mounted,
  durationMs,
  delayMs,
}: {
  name: string;
  value: number;
  fill: string;
  mounted: boolean;
  durationMs?: number;
  delayMs?: number;
}) {
  return (
    <div className="flex items-center gap-sm">
      <span className="w-xxxl shrink-0 text-micro text-textMuted">{name}</span>
      <div
        role="progressbar"
        aria-label={`${name}: ${Math.round(value)} of 100`}
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-sm flex-1 overflow-hidden rounded-pill border border-border bg-surfaceMuted"
      >
        <div
          className={cn(
            "h-full rounded-pill transition-[width] duration-standard ease-out",
            fill,
          )}
          style={{
            width: mounted ? `${value}%` : "0%",
            transitionDuration: durationMs ? `${durationMs}ms` : undefined,
            transitionDelay: delayMs ? `${delayMs}ms` : undefined,
          }}
        />
      </div>
      <span className="w-xl shrink-0 text-right text-small font-semibold text-textPrimary">
        {Math.round(value)}%
      </span>
    </div>
  );
}

export function BeforeAfterBar({
  label,
  before,
  after,
  afterDurationMs,
  afterDelayMs,
  className,
}: BeforeAfterBarProps) {
  const b = Math.min(100, Math.max(0, before));
  const a = Math.min(100, Math.max(0, after));
  const delta = Math.round(a - b);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className={cn("flex flex-col gap-sm", className)}>
      <div className="flex items-center justify-between">
        <span className="text-small font-semibold text-textPrimary">{label}</span>
        <span
          className={cn(
            "rounded-pill px-sm text-micro font-semibold",
            delta > 0 ? "bg-surfaceMuted text-success" : "text-textMuted",
            afterDelayMs && "animate-fade-up",
          )}
          style={
            afterDelayMs ? { animationDelay: `${afterDelayMs}ms` } : undefined
          }
        >
          ({delta > 0 ? "+" : ""}
          {delta})
        </span>
      </div>
      <Bar name="Before" value={b} fill="bg-textMuted" mounted={mounted} />
      <Bar
        name="After"
        value={a}
        fill={delta > 0 ? "bg-success" : "bg-primary"}
        mounted={mounted}
        durationMs={afterDurationMs}
        delayMs={afterDelayMs}
      />
    </div>
  );
}
