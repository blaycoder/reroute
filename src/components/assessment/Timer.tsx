"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/design/utils";

// Calm countdown that mirrors a JAMB CBT clock: no pulsing, only a colour step
// as time runs low. Remount it per question (`key={question.id}`) to restart.

/** At or below this many seconds the clock turns to the accent colour. */
const WARNING_SECONDS = 10;
/** At or below this many seconds it turns to the error colour. */
const CRITICAL_SECONDS = 5;

export interface TimerProps {
  totalSeconds: number;
  /** Fires once, when the countdown reaches zero. */
  onExpire: () => void;
  className?: string;
}

function format(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function Timer({ totalSeconds, onExpire, className }: TimerProps) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    const startedAt = performance.now();
    let expired = false;
    const interval = window.setInterval(() => {
      const secondsLeft = Math.max(
        0,
        totalSeconds - Math.floor((performance.now() - startedAt) / 1000),
      );
      setRemaining(secondsLeft);
      if (secondsLeft === 0 && !expired) {
        expired = true;
        window.clearInterval(interval);
        onExpireRef.current();
      }
    }, 250);
    return () => window.clearInterval(interval);
  }, [totalSeconds]);

  const tone =
    remaining <= CRITICAL_SECONDS
      ? "text-error"
      : remaining <= WARNING_SECONDS
        ? "text-accent"
        : "text-textMuted";

  return (
    <span
      role="timer"
      aria-label={`Time remaining: ${remaining} seconds`}
      className={cn("text-small font-semibold tabular-nums", tone, className)}
    >
      {format(remaining)}
    </span>
  );
}
