"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiRecovery, useRetryCounter } from "@/components/ui/ApiRecovery";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import {
  ApiUnavailableError,
  apiFetch,
  cacheResponse,
  clearCache,
} from "@/lib/api-client";
import { cn, FOCUS_RING } from "@/design/utils";
import type { DiagnosticStartResponse } from "@/types/api";

// Hands off to /diagnostic via sessionStorage key "reroute.diagnostic":
// { studentId, diagnosticId, targetScore }. The questions themselves are
// fetched one at a time by the diagnostic.
const STORAGE_KEY = "reroute.diagnostic";

// These three sentences appear word for word on the fingerprint screen too.
const PILLARS = [
  { name: "Accuracy", line: "How often you get it right." },
  {
    name: "Speed",
    line: "How quickly you solve, compared to the expected time.",
  },
  { name: "Confidence Calibration", line: "Whether you know what you know." },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [targetScore, setTargetScore] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);
  const retries = useRetryCounter();

  const parsedScore = Number(targetScore);
  const isValid =
    targetScore.trim() !== "" &&
    Number.isInteger(parsedScore) &&
    parsedScore >= 0 &&
    parsedScore <= 400;
  const showInlineError = touched && !isValid;

  const openModal = () => dialogRef.current?.showModal();

  const startDiagnostic = useCallback(async () => {
    setSubmitting(true);
    setFailed(false);
    try {
      const data = await apiFetch<DiagnosticStartResponse>(
        "/api/diagnostic/start",
        { targetScore: parsedScore, subject: "Mathematics" },
      );
      // A new student starts clean: nothing saved for anyone else carries over.
      clearCache();
      cacheResponse(`/api/diagnostic/${data.diagnosticId}`, data);
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          studentId: data.studentId,
          diagnosticId: data.diagnosticId,
          targetScore: parsedScore,
        }),
      );
      router.push("/diagnostic");
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        setFailed(true);
        setSubmitting(false);
        return;
      }
      showToast({
        variant: "error",
        message: "We couldn't start your diagnostic. Please try again.",
      });
      setSubmitting(false);
    }
  }, [parsedScore, router, showToast]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting || !isValid) return;
    await startDiagnostic();
  };

  if (failed && !submitting) {
    return (
      <main className="flex min-h-screen flex-col justify-center bg-background px-lg">
        <div className="mx-auto w-full max-w-md">
          <ApiRecovery
            message="We couldn't start your diagnostic. Check your connection and try again."
            retryCount={retries.count}
            onRetry={() => {
              retries.bump();
              void startDiagnostic();
            }}
          />
        </div>
      </main>
    );
  }

  if (submitting) {
    return (
      <main
        aria-busy="true"
        className="flex min-h-screen flex-col justify-center bg-background px-lg"
      >
        <div className="mx-auto flex w-full max-w-md flex-col gap-lg">
          <Skeleton variant="line" className="w-1/3" />
          <Skeleton variant="block" />
          <Skeleton variant="line" />
          <Skeleton variant="line" />
          <Skeleton variant="line" className="w-2/3" />
          <p className="mt-xl text-center text-body leading-relaxed text-textMuted">
            This takes about 8 minutes. There are no wrong answers here — only
            useful ones.
          </p>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="flex min-h-screen flex-col bg-background px-lg py-xl">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
          <p className="font-heading text-h3 font-bold text-textPrimary">
            Reroute<span className="text-primary">.</span>
          </p>

          <h1 className="mt-xl font-heading text-h1 font-semibold leading-tight text-textPrimary">
            Let&apos;s build your learning fingerprint.
          </h1>
          <p className="mt-md text-body leading-relaxed text-textMuted">
            Most apps just give you a score. Reroute measures how you think —
            tracking your accuracy, speed, and confidence across every topic.
          </p>

          <form onSubmit={handleSubmit} className="mt-xl flex flex-col gap-lg">
            <div className="grid grid-cols-2 gap-sm">
              <div className="flex flex-col gap-xs">
                <span className="text-micro text-textMuted">Target exam</span>
                <span className="inline-flex min-h-xxxl items-center justify-center rounded-pill border border-border bg-surfaceMuted px-lg text-body font-medium text-textPrimary">
                  JAMB
                </span>
              </div>
              <div className="flex flex-col gap-xs">
                <span className="text-micro text-textMuted">Subject</span>
                <span className="inline-flex min-h-xxxl items-center justify-center rounded-pill border border-border bg-surfaceMuted px-lg text-body font-medium text-textPrimary">
                  Mathematics
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-xs">
              <label
                htmlFor="target-score"
                className="text-small font-medium text-textPrimary"
              >
                Target score
              </label>
              <input
                id="target-score"
                type="number"
                inputMode="numeric"
                min={0}
                max={400}
                step={1}
                value={targetScore}
                onChange={(event) => setTargetScore(event.target.value)}
                onBlur={() => setTouched(true)}
                aria-invalid={showInlineError}
                aria-describedby={
                  showInlineError ? "target-score-error" : undefined
                }
                placeholder="e.g. 280"
                className={cn(
                  "min-h-xxxl rounded-md border bg-surface px-lg text-body text-textPrimary placeholder:text-textMuted",
                  showInlineError ? "border-error" : "border-border",
                  FOCUS_RING,
                )}
              />
              {showInlineError && (
                <p id="target-score-error" className="text-small text-error">
                  Enter a score between 0 and 400.
                </p>
              )}
            </div>

            <Button type="submit" fullWidth disabled={!isValid}>
              Start diagnostic
            </Button>
          </form>

          <button
            type="button"
            onClick={openModal}
            className={cn(
              "mx-auto mt-xl flex min-h-xxxl items-center rounded-md px-md text-small font-medium text-secondary underline underline-offset-4",
              FOCUS_RING,
            )}
          >
            Why Reroute?
          </button>
        </div>

        <dialog
          ref={dialogRef}
          aria-labelledby="why-reroute-title"
          onClick={(event) => {
            if (event.target === dialogRef.current) {
              dialogRef.current?.close();
            }
          }}
          className="w-full max-w-md rounded-md bg-surface p-xl text-left shadow-elevated backdrop:bg-textPrimary/40"
        >
          <h2
            id="why-reroute-title"
            className="font-heading text-h2 font-semibold text-textPrimary"
          >
            Why Reroute?
          </h2>
          <ul className="mt-lg flex flex-col gap-md">
            {PILLARS.map((pillar) => (
              <li key={pillar.name}>
                <span className="text-small font-semibold text-textPrimary">
                  {pillar.name}
                </span>
                <p className="text-small leading-relaxed text-textMuted">
                  {pillar.line}
                </p>
              </li>
            ))}
          </ul>
          <Button
            variant="ghost"
            onClick={() => dialogRef.current?.close()}
            fullWidth
            className="mt-xl"
          >
            Close
          </Button>
        </dialog>
      </main>
    </>
  );
}
