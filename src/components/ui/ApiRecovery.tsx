"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn, FOCUS_RING } from "@/design/utils";

// Shown whenever the server can't be reached. Retry comes first; only after
// the student has pressed it more than once does a quieter "Try cached data"
// link appear beneath it — and only if this screen has a saved response of the
// student's own to replay.

/** Retry presses needed before the cached-data link is offered. */
const RETRIES_BEFORE_CACHE_LINK = 2;

export function useRetryCounter() {
  const [count, setCount] = useState(0);
  const bump = useCallback(() => setCount((current) => current + 1), []);
  const reset = useCallback(() => setCount(0), []);
  return { count, bump, reset };
}

export interface ApiRecoveryProps {
  message?: string;
  /** How many times Retry has been pressed for this failure. */
  retryCount: number;
  retrying?: boolean;
  onRetry: () => void;
  /** Provide only when a saved response exists for this screen. */
  onUseCached?: () => void;
  className?: string;
}

export function ApiRecovery({
  message = "We couldn't reach the server. Check your connection and try again.",
  retryCount,
  retrying = false,
  onRetry,
  onUseCached,
  className,
}: ApiRecoveryProps) {
  const offerCache = onUseCached != null && retryCount >= RETRIES_BEFORE_CACHE_LINK;

  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center gap-md text-center", className)}
    >
      <p className="text-body text-textPrimary">{message}</p>
      <Button size="lg" fullWidth onClick={onRetry} disabled={retrying}>
        {retrying ? "Retrying…" : "Retry"}
      </Button>
      {offerCache && (
        <div className="flex flex-col items-center gap-xs">
          <button
            type="button"
            onClick={onUseCached}
            className={cn(
              "min-h-xxxl px-md text-small text-textMuted underline underline-offset-4 hover:text-textPrimary",
              FOCUS_RING,
            )}
          >
            Try cached data
          </button>
          <p className="text-micro text-textMuted">
            Shows what you last saw on this device.
          </p>
        </div>
      )}
    </div>
  );
}

/** Small label shown while a screen is displaying saved data instead of live data. */
export function SavedContentNotice({ className }: { className?: string }) {
  return (
    <p
      role="status"
      className={cn(
        "inline-block rounded-pill bg-surfaceMuted px-md text-micro leading-relaxed text-textMuted",
        className,
      )}
    >
      Showing saved content
    </p>
  );
}
