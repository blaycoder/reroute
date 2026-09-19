"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api-client";
import { InterventionPanel } from "@/components/intervention/InterventionPanel";
import type {
  InterventionCheckGuidedResponse,
  InterventionGenerateResponse,
} from "@/types/api";
import type { Confidence, ErrorType } from "@/types/learner-state";

// Reads sessionStorage "reroute.intervention" (written by /fingerprint),
// merges the generate response back in for /practice.
const INTERVENTION_KEY = "reroute.intervention";

interface StoredIntervention {
  studentId: string;
  topic: string;
  errorType: ErrorType;
  confidence: Confidence;
}

export default function InterventionPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [phase, setPhase] = useState<"booting" | "ready">("booting");
  const [bootError, setBootError] = useState(false);
  const [generate, setGenerate] = useState<InterventionGenerateResponse | null>(
    null,
  );
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<
    "correct" | "wrong" | "ungraded" | null
  >(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(INTERVENTION_KEY);
    if (!raw) {
      router.replace("/fingerprint");
      return;
    }
    const stored = JSON.parse(raw) as StoredIntervention;

    (async () => {
      try {
        const data = await apiFetch<InterventionGenerateResponse>(
          "/api/intervention/generate",
          {
            studentId: stored.studentId,
            topic: stored.topic,
            errorType: stored.errorType,
            confidence: stored.confidence,
          },
        );
        setGenerate(data);
        sessionStorage.setItem(
          INTERVENTION_KEY,
          JSON.stringify({ ...stored, generate: data }),
        );
        setPhase("ready");
      } catch {
        showToast({
          variant: "error",
          message:
            "Couldn't load your session. Check your connection and try again.",
        });
        setBootError(true);
      }
    })();
  }, [router, showToast]);

  const handleRetryBoot = useCallback(() => {
    setBootError(false);
    window.location.reload();
  }, []);

  const handleGuidedSubmit = useCallback(
    async (response: string) => {
      if (!generate || checking) return;
      setChecking(true);
      try {
        const data = await apiFetch<InterventionCheckGuidedResponse>(
          "/api/intervention/check-guided",
          {
            interventionId: generate.interventionId,
            guidedResponse: response,
          },
        );
        setCheckResult(
          data.graded ? (data.correct ? "correct" : "wrong") : "ungraded",
        );
        setHint(data.hint);
        // Persist the guided response — verify needs it after practice.
        const raw = sessionStorage.getItem(INTERVENTION_KEY);
        if (raw) {
          const stored = JSON.parse(raw);
          sessionStorage.setItem(
            INTERVENTION_KEY,
            JSON.stringify({ ...stored, guidedResponse: response }),
          );
        }
      } catch {
        showToast({
          variant: "error",
          message: "Couldn't check that. Try once more.",
        });
      } finally {
        setChecking(false);
      }
    },
    [generate, checking, showToast],
  );

  if (phase === "booting") {
    return (
      <main
        aria-busy={!bootError}
        className="flex min-h-screen flex-col justify-center bg-background px-lg"
      >
        <div className="mx-auto flex w-full max-w-md flex-col gap-lg">
          {!bootError && (
            <>
              <Skeleton variant="line" className="w-3/4" />
              <Skeleton variant="line" />
              <Skeleton variant="card" />
              <Skeleton variant="line" />
            </>
          )}
          {bootError && (
            <Button size="lg" fullWidth onClick={handleRetryBoot}>
              Try again
            </Button>
          )}
        </div>
      </main>
    );
  }

  if (!generate) return null;

  return (
    <main className="flex min-h-screen flex-col bg-background px-lg pb-xl pt-xl">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <p className="font-heading text-h3 font-bold text-textPrimary">
          Reroute<span className="text-primary">.</span>
        </p>
        <h1 className="mt-xl font-heading text-h1 font-semibold leading-tight text-textPrimary">
          Let&apos;s fix {generate.conceptLabel}.
        </h1>

        <InterventionPanel
          className="mt-xl"
          explanation={generate.content.explanation}
          workedExample={generate.content.workedExample}
          guidedQuestion={generate.content.guidedQuestion}
          checking={checking}
          checkResult={checkResult}
          hint={hint}
          onSubmitGuided={(response) => void handleGuidedSubmit(response)}
        />
      </div>

      {checkResult != null && (
        <div className="sticky bottom-0 mx-auto w-full max-w-md bg-background pb-lg pt-md">
          <Button size="lg" fullWidth onClick={() => router.push("/practice")}>
            Start practice
          </Button>
        </div>
      )}
    </main>
  );
}
