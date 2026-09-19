"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  activateDemoMode,
  getFallbackState,
  isDemoMode,
  resetDemoMode,
  subscribeFallback,
  type ApiFallbackState,
} from "@/lib/api-client";
import { cn, FOCUS_RING } from "@/design/utils";

// Activates demo mode on ?demo=1 (DEMO pill + Reset demo), and shows the
// "Showing saved content" chip whenever a live call fell back to fixtures —
// in demo mode or not.
export function DemoBadge() {
  const router = useRouter();
  const [demo, setDemo] = useState(false);
  const [fallback, setFallback] = useState<ApiFallbackState>(getFallbackState());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") === "1") {
      activateDemoMode();
      params.delete("demo");
      const query = params.toString();
      window.history.replaceState(
        null,
        "",
        window.location.pathname + (query ? `?${query}` : ""),
      );
      // Land the presenter on the loop start; onboarding seeds and skips.
      router.replace("/onboarding");
    }
    setDemo(isDemoMode());
    return subscribeFallback((state) => setFallback(state));
  }, [router]);

  const showingSavedContent = fallback === "cached";
  if (!demo && !showingSavedContent) return null;

  return (
    <div className="fixed right-md top-md z-50 flex flex-col items-end gap-xs">
      {demo && (
        <span className="rounded-pill bg-accent px-md text-micro font-bold leading-relaxed text-textPrimary shadow-card">
          DEMO
        </span>
      )}
      {/* Shown outside demo mode too: when a live call fails and the client
          falls back to fixtures, a real learner must not mistake that sample
          data for their own results. */}
      {showingSavedContent && (
        <span
          role="status"
          className="rounded-pill bg-surface px-md text-micro leading-relaxed text-textMuted shadow-card"
        >
          Showing saved content
        </span>
      )}
      {demo && (
        <button
          type="button"
          onClick={() => {
            resetDemoMode();
            window.location.reload();
          }}
          className={cn(
            "rounded-pill bg-surface px-md py-1 text-micro text-textMuted shadow-card transition duration-micro ease-out hover:bg-surfaceMuted",
            FOCUS_RING,
          )}
        >
          Reset demo
        </button>
      )}
    </div>
  );
}
