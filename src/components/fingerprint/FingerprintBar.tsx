"use client";

import { useEffect, useState } from "react";
import { cn } from "@/design/utils";
export interface FingerprintBarProps {
  /** e.g. "Accuracy" | "Speed" | "Confidence Calibration". */
  label: string;
  /** 0–100. */
  value: number;
  /** Stagger delay for the mount animation (ms). */
  delayMs?: number;
  className?: string;
}

function thresholdFill(value: number): string {
  if (value >= 70) return "bg-success";
  if (value >= 40) return "bg-accent";
  return "bg-error";
}

export function FingerprintBar({
  label,
  value,
  delayMs,
  className,
}: FingerprintBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className={cn("flex flex-col gap-xs", className)}>
      <div className="flex items-baseline justify-between">
        <span className="text-small text-textPrimary">{label}</span>
        <span className="text-small font-semibold text-textPrimary">
          {Math.round(clamped)}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${label}: ${Math.round(clamped)} of 100`}
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-sm w-full overflow-hidden rounded-pill border border-border bg-surfaceMuted"
      >
        <div
          className={cn(
            "h-full rounded-pill transition-[width] duration-hero ease-out",
            thresholdFill(clamped),
          )}
          style={{
            width: mounted ? `${clamped}%` : "0%",
            transitionDelay: delayMs ? `${delayMs}ms` : undefined,
          }}
        />
      </div>
    </div>
  );
}
