"use client";

import { X } from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn, FOCUS_RING } from "@/design/utils";

export interface ProgressHeaderProps {
  /** 1-based. */
  current: number;
  total: number;
  topicLabel?: string;
  onExit?: () => void;
  className?: string;
}

export function ProgressHeader({
  current,
  total,
  topicLabel,
  onExit,
  className,
}: ProgressHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-md", className)}>
      <div className="flex items-center gap-md">
        <p className="text-small font-semibold text-textPrimary">
          Question {current} of {total}
        </p>
        {topicLabel && (
          <span className="rounded-pill bg-surfaceMuted px-sm text-micro leading-relaxed text-textMuted">
            {topicLabel}
          </span>
        )}
        {onExit && (
          <button
            type="button"
            onClick={onExit}
            aria-label="Exit diagnostic"
            className={cn(
              "ml-auto flex h-xxxl w-xxxl items-center justify-center rounded-md text-textMuted transition duration-micro ease-out hover:bg-surfaceMuted",
              FOCUS_RING,
            )}
          >
            <X className="h-lg w-lg" aria-hidden />
          </button>
        )}
      </div>
      {/* aria-hidden: the text counter above carries the semantics. */}
      <ProgressBar value={(current / total) * 100} />
    </header>
  );
}
