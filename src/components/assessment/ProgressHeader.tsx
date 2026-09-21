"use client";

import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn, FOCUS_RING } from "@/design/utils";

export interface ProgressHeaderProps {
  /** 1-based. */
  current: number;
  total: number;
  /** e.g. "Algebra · Expansion of Brackets". */
  topicLabel?: string;
  onExit?: () => void;
  /** The countdown, shown top-right on the same line as the question number. */
  timer?: React.ReactNode;
  className?: string;
}

// One counter, one bar. Two short lines rather than one long one, so nothing
// wraps or scrolls sideways at 360px.
export function ProgressHeader({
  current,
  total,
  topicLabel,
  onExit,
  timer,
  className,
}: ProgressHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-xs", className)}>
      <div className="flex items-center justify-between gap-md">
        <p className="text-small font-semibold text-textPrimary">
          Question {current} of {total}
        </p>
        {timer}
      </div>
      <div className="flex items-center justify-between gap-md">
        {topicLabel ? (
          <p className="min-w-0 truncate text-small text-textMuted">
            {topicLabel}
          </p>
        ) : (
          <span />
        )}
        {onExit && (
          <button
            type="button"
            onClick={onExit}
            className={cn(
              "-mr-md min-h-xxxl shrink-0 rounded-md px-md text-small text-textMuted transition duration-micro ease-out hover:text-textPrimary",
              FOCUS_RING,
            )}
          >
            Exit
          </button>
        )}
      </div>
      {/* aria-hidden: the text counter above carries the semantics. */}
      <ProgressBar value={(current / total) * 100} />
    </header>
  );
}
