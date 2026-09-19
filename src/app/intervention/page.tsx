"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiRecovery,
  SavedContentNotice,
  useRetryCounter,
} from "@/components/ui/ApiRecovery";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiUnavailableError, apiFetch, readCached } from "@/lib/api-client";
import { InterventionPanel } from "@/components/intervention/InterventionPanel";
import type {
  InterventionCheckGuidedResponse,
  InterventionGenerateRequest,
  InterventionGenerateResponse,
} from "@/types/api";

// Reads sessionStorage "reroute.intervention" (written by /fingerprint),
// merges the generate response back in for /practice.
const INTERVENTION_KEY = "reroute.intervention";

const GENERATE_PATH = "/api/intervention/generate";

export default function InterventionPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [phase, setPhase] = useState<"booting" | "ready">("booting");
  const [failed, setFailed] = useState(false);
  const [usingSaved, setUsingSaved] = useState(false);
  const [generate, setGenerate] = useState<InterventionGenerateResponse | null>(
    null,
  );
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<
    "correct" | "wrong" | "ungraded" | null
  >(null);
  const [hint, setHint] = useState<string | null>(null);
  const retries = useRetryCounter();
  const requestRef = useRef<InterventionGenerateRequest | null>(null);

  const show = useCallback((data: InterventionGenerateResponse) => {
    setGenerate(data);
    const raw = sessionStorage.getItem(INTERVENTION_KEY);
    const stored = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    sessionStorage.setItem(
      INTERVENTION_KEY,
      JSON.stringify({ ...stored, generate: data }),
    );
    setPhase("ready");
  }, []);

  const load = useCallback(
    async (request: InterventionGenerateRequest) => {
      setFailed(false);
      try {
        const data = await apiFetch<InterventionGenerateResponse>(
          GENERATE_PATH,
          request,
          { cache: true },
        );
        setUsingSaved(false);
        show(data);
      } catch (error) {
        if (error instanceof ApiUnavailableError) {
          setFailed(true);
          return;
        }
        showToast({
          variant: "error",
          message: "We couldn't load your lesson. Head back and try again.",
        });
        router.replace("/fingerprint");
      }
    },
    [router, show, showToast],
  );

  useEffect(() => {
    const raw = sessionStorage.getItem(INTERVENTION_KEY);
    if (!raw) {
      router.replace("/fingerprint");
      return;
    }
    const stored = JSON.parse(raw) as { studentId: string; topic: string };
    requestRef.current = { studentId: stored.studentId, topic: stored.topic };
    void load(requestRef.current);
  }, [load, router]);

  const resetRetries = retries.reset;
  useEffect(() => {
    if (!failed) resetRetries();
  }, [failed, resetRetries]);

  const handleRetry = () => {
    retries.bump();
    if (requestRef.current) void load(requestRef.current);
  };

  // The student's own last copy of this lesson, offered after repeated retries.
  const savedLesson =
    failed && requestRef.current
      ? readCached<InterventionGenerateResponse>(GENERATE_PATH, requestRef.current)
      : null;

  const resumeFromSaved = () => {
    if (!savedLesson) return;
    setUsingSaved(true);
    setFailed(false);
    show(savedLesson);
  };

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

  if (failed) {
    return (
      <main className="flex min-h-screen flex-col justify-center bg-background px-lg">
        <div className="mx-auto w-full max-w-md">
          <ApiRecovery
            message="We couldn't load your lesson. Check your connection and try again."
            retryCount={retries.count}
            onRetry={handleRetry}
            onUseCached={savedLesson ? resumeFromSaved : undefined}
          />
        </div>
      </main>
    );
  }

  if (phase === "booting" || !generate) {
    return (
      <main
        aria-busy="true"
        className="flex min-h-screen flex-col justify-center bg-background px-lg"
      >
        <div className="mx-auto flex w-full max-w-md flex-col gap-lg">
          <Skeleton variant="line" className="w-3/4" />
          <Skeleton variant="line" />
          <Skeleton variant="card" />
          <Skeleton variant="line" />
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-background px-lg pb-xl pt-xl">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <p className="font-heading text-h3 font-bold text-textPrimary">
          Reroute<span className="text-primary">.</span>
        </p>
        <h1 className="mt-xl font-heading text-h1 font-semibold leading-tight text-textPrimary">
          Let&apos;s fix {generate.conceptLabel}.
        </h1>
        {usingSaved && <SavedContentNotice className="mt-md self-start" />}

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
