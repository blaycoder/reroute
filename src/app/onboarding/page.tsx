"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { apiFetch, isDemoMode } from "@/lib/api-client";
import { cn, FOCUS_RING } from "@/design/utils";
import type { DiagnosticStartResponse } from "@/types/api";

// Hands off to /diagnostic via sessionStorage key "reroot.diagnostic":
// { studentId, diagnosticId, questions, targetScore }.
const STORAGE_KEY = "reroot.diagnostic";

const PILLARS = [
  {
    name: "Accuracy",
    line: "How often you get questions right, topic by topic.",
  },
  {
    name: "Speed",
    line: "How long each question takes you, compared with a comfortable pace.",
  },
  {
    name: "Confidence Calibration",
    line: "How well your certainty matches your results.",
  },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Demo mode: seed the pre-cached diagnostic and skip straight in.
  useEffect(() => {
    if (!isDemoMode()) return;
    void (async () => {
      const fixture = await apiFetch<DiagnosticStartResponse>(
        "/api/diagnostic/start",
      );
      sessionStorage.setItem(
        "reroot.diagnostic",
        JSON.stringify({ ...fixture, targetScore: 280 }),
      );
      router.replace("/diagnostic");
    })();
  }, [router]);

  const [targetScore, setTargetScore] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const parsedScore = Number(targetScore);
  const isValid =
    targetScore.trim() !== "" &&
    Number.isInteger(parsedScore) &&
    parsedScore >= 0 &&
    parsedScore <= 400;
  const showInlineError = touched && !isValid;

  const openModal = () => dialogRef.current?.showModal();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting || !isValid) return;
    setSubmitting(true);
    try {
      const data = await apiFetch<DiagnosticStartResponse>(
        "/api/diagnostic/start",
        { targetScore: parsedScore, subject: "Mathematics" },
      );
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...data, targetScore: parsedScore }),
      );
      router.push("/diagnostic");
    } catch {
      showToast({
        variant: "error",
        message:
          "Couldn't start the diagnostic. Check your connection and try again.",
      });
      setSubmitting(false);
    }
  };

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
            Reroot<span className="text-primary">.</span>
          </p>

          <h1 className="mt-xl font-heading text-h1 font-semibold leading-tight text-textPrimary">
            Let&apos;s build your learning fingerprint.
          </h1>
          <p className="mt-md text-body leading-relaxed text-textMuted">
            Most apps just give you a score. Reroot measures how you think —
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
            Why Reroot?
          </button>
        </div>

        <dialog
          ref={dialogRef}
          aria-labelledby="why-reroot-title"
          onClick={(event) => {
            if (event.target === dialogRef.current) {
              dialogRef.current?.close();
            }
          }}
          className="w-full max-w-md rounded-md bg-surface p-xl text-left shadow-elevated backdrop:bg-textPrimary/40"
        >
          <h2
            id="why-reroot-title"
            className="font-heading text-h2 font-semibold text-textPrimary"
          >
            Why Reroot?
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
