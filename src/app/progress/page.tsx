"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiRecovery,
  SavedContentNotice,
  useRetryCounter,
} from "@/components/ui/ApiRecovery";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiUnavailableError, apiFetch, readCached } from "@/lib/api-client";
import { BeforeAfterBar } from "@/components/fingerprint/BeforeAfterBar";
import { NextPriorityCard } from "@/components/fingerprint/NextPriorityCard";
import { cn } from "@/design/utils";
import { tokens } from "@/design/tokens";
import type { FingerprintResponse } from "@/types/api";

const DIAGNOSTIC_KEY = "reroute.diagnostic";
const VERIFY_RESULT_KEY = "reroute.verifyResult";
const INTERVENTION_KEY = "reroute.intervention";

interface StoredVerifyResult {
  topic: string;
  improved: boolean;
  masteryBefore: number;
  masteryAfter: number;
  nextPriorityTopic: string | null;
}

const pct = (value: number) => Math.round(value * 100);

export default function ProgressPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [phase, setPhase] = useState<"booting" | "ready">("booting");
  const [targetScore, setTargetScore] = useState(0);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<StoredVerifyResult | null>(
    null,
  );
  const [fingerprint, setFingerprint] = useState<FingerprintResponse | null>(
    null,
  );

  const [failed, setFailed] = useState(false);
  const [usingSaved, setUsingSaved] = useState(false);
  const retries = useRetryCounter();
  const contextRef = useRef<{
    studentId: string;
    targetScore: number;
    verifyResult: StoredVerifyResult;
  } | null>(null);

  const fingerprintPath = (id: string) => `/api/learner/${id}/fingerprint`;

  const showFingerprint = useCallback(
    (data: FingerprintResponse, saved: boolean) => {
      const context = contextRef.current;
      if (!context) return;
      setTargetScore(context.targetScore);
      setStudentId(context.studentId);
      setVerifyResult(context.verifyResult);
      setFingerprint(data);
      setUsingSaved(saved);
      setFailed(false);
      setPhase("ready");
    },
    [],
  );

  const load = useCallback(async () => {
    const context = contextRef.current;
    if (!context) return;
    setFailed(false);
    try {
      const data = await apiFetch<FingerprintResponse>(
        fingerprintPath(context.studentId),
        undefined,
        { cache: true },
      );
      showFingerprint(data, false);
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        setFailed(true);
        return;
      }
      showToast({
        variant: "error",
        message: "Couldn't load your progress. Check your connection and try again.",
      });
      router.replace("/fingerprint");
    }
  }, [router, showFingerprint, showToast]);

  useEffect(() => {
    const diagnosticRaw = sessionStorage.getItem(DIAGNOSTIC_KEY);
    const verifyRaw = sessionStorage.getItem(VERIFY_RESULT_KEY);
    const diagnostic = diagnosticRaw
      ? (JSON.parse(diagnosticRaw) as { studentId?: string; targetScore?: number })
      : null;
    if (!verifyRaw || !diagnostic?.studentId) {
      router.replace("/fingerprint");
      return;
    }
    contextRef.current = {
      studentId: diagnostic.studentId,
      targetScore: diagnostic.targetScore ?? 0,
      verifyResult: JSON.parse(verifyRaw) as StoredVerifyResult,
    };
    void load();
  }, [load, router]);

  const resetRetries = retries.reset;
  useEffect(() => {
    if (!failed) resetRetries();
  }, [failed, resetRetries]);

  const handleRetry = () => {
    retries.bump();
    void load();
  };

  // The student's own last copy of their progress, offered after repeated retries.
  const savedFingerprint =
    failed && contextRef.current
      ? readCached<FingerprintResponse>(fingerprintPath(contextRef.current.studentId))
      : null;

  const resumeFromSaved = () => {
    if (savedFingerprint) showFingerprint(savedFingerprint, true);
  };

  const handleContinue = () => {
    if (!verifyResult?.nextPriorityTopic || !studentId || !fingerprint) return;
    sessionStorage.setItem(
      INTERVENTION_KEY,
      JSON.stringify({ studentId, topic: verifyResult.nextPriorityTopic }),
    );
    router.push("/intervention");
  };

  if (failed) {
    return (
      <main className="flex min-h-screen flex-col justify-center bg-background px-lg">
        <div className="mx-auto w-full max-w-md">
          <ApiRecovery
            retryCount={retries.count}
            onRetry={handleRetry}
            onUseCached={savedFingerprint ? resumeFromSaved : undefined}
          />
        </div>
      </main>
    );
  }

  if (phase === "booting") {
    return (
      <main
        aria-busy="true"
        className="flex min-h-screen flex-col justify-center bg-background px-lg"
      >
        <div className="mx-auto flex w-full max-w-md flex-col gap-lg">
          <Skeleton variant="line" className="w-1/2" />
          <Skeleton variant="card" />
          <Skeleton variant="line" />
          <Skeleton variant="card" />
        </div>
      </main>
    );
  }

  if (!verifyResult || !fingerprint) return null;

  const before = pct(verifyResult.masteryBefore);
  const after = pct(verifyResult.masteryAfter);
  const nextTopic = verifyResult.nextPriorityTopic;
  const history = fingerprint.interventionHistory ?? [];

  return (
    <main className="flex min-h-screen flex-col bg-background px-lg py-xl">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <p className="font-heading text-h3 font-bold text-textPrimary">
          Reroute<span className="text-primary">.</span>
        </p>
        <h1 className="mt-lg font-heading text-h1 font-semibold text-textPrimary">
          Your journey
        </h1>
        {usingSaved && <SavedContentNotice className="mt-md self-start" />}

        <Card className="mt-xl">
          <div className="flex flex-col gap-md">
            <div className="flex items-center justify-between">
              <span className="text-small text-textMuted">Target</span>
              <span className="text-small font-semibold text-textPrimary">
                Target: {targetScore}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-small text-textMuted">Readiness</span>
              <span className="text-small font-semibold text-textPrimary">
                Readiness: {fingerprint.readinessIndex}/100
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-small text-textMuted">Movement</span>
              <span className="text-small font-semibold text-textPrimary">
                {before}% → {after}%
              </span>
            </div>
          </div>
          <p className="mt-md text-micro text-textMuted">
            Movement reflects {verifyResult.topic} mastery.
          </p>
        </Card>

        <BeforeAfterBar
          className="mt-xl"
          label={`${verifyResult.topic} mastery`}
          before={before}
          after={after}
        />

        {history.length > 0 && (
          <section aria-label="Intervention history" className="mt-xl">
            <h2 className="text-small font-semibold text-textPrimary">
              Session history
            </h2>
            <ul className="mt-md flex flex-col gap-sm">
              {history.map((entry, index) => (
                <li
                  key={`${entry.topic}-${entry.startedAt}`}
                  className="animate-fade-up rounded-md bg-surface p-lg shadow-card"
                  style={{
                    animationDelay: `${index * tokens.motion.durations.micro}ms`,
                  }}
                >
                  <div className="flex items-center justify-between gap-sm">
                    <span className="text-small font-semibold text-textPrimary">
                      {entry.topic}
                    </span>
                    <span
                      className={cn(
                        "text-micro font-semibold",
                        entry.improved ? "text-success" : "text-textMuted",
                      )}
                    >
                      {entry.improved ? "Improved" : "Not yet"}
                    </span>
                  </div>
                  <p className="mt-xs text-small text-textMuted">
                    {pct(entry.masteryBefore)}% → {pct(entry.masteryAfter)}%
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {nextTopic ? (
          <NextPriorityCard
            className="mt-xl"
            topic={nextTopic}
            reason="You're ready for this one."
            onContinue={handleContinue}
          />
        ) : (
          <p className="mt-xl text-small text-textMuted">
            No other topics need attention right now.
          </p>
        )}

        <Button
          variant="ghost"
          fullWidth
          className="mt-xl"
          onClick={() => router.push("/fingerprint")}
        >
          See full fingerprint
        </Button>
      </div>
    </main>
  );
}
