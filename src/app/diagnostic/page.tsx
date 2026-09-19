"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ProgressHeader } from "@/components/assessment/ProgressHeader";
import {
  QuestionCard,
  type QuestionCardOption,
  type ReadTelemetry,
} from "@/components/assessment/QuestionCard";
import { Timer } from "@/components/assessment/Timer";
import {
  ApiRecovery,
  SavedContentNotice,
  useRetryCounter,
} from "@/components/ui/ApiRecovery";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import {
  ApiRejectedError,
  ApiUnavailableError,
  apiFetch,
  cacheResponse,
  readCached,
} from "@/lib/api-client";
import type {
  ClientTelemetry,
  DiagnosticAnswerResponse,
  DiagnosticCompleteResponse,
  DiagnosticProgress,
} from "@/types/api";

// The server routes this diagnostic: it sends one question at a time and picks
// the next from this student's real answers. This page only shows the current
// question, times it, and reports what the student did. A refresh resumes from
// the last answered question because the state lives in the database.
//
// Reads sessionStorage "reroute.diagnostic" (written by /onboarding) and writes
// "reroute.fingerprint" (the computed profile) when the diagnostic completes.
const DIAGNOSTIC_KEY = "reroute.diagnostic";
const FINGERPRINT_KEY = "reroute.fingerprint";

interface PendingAnswer {
  questionId: string;
  selectedOption: string | null;
  telemetry: ClientTelemetry;
}

type FailureKind = "load" | "submit" | "complete";

const progressPath = (diagnosticId: string) => `/api/diagnostic/${diagnosticId}`;

const emptyTelemetry = (timedOut: boolean): ClientTelemetry => ({
  timeToFirstClickMs: 0,
  totalDwellTimeMs: 0,
  timeOnQuestionMs: 0,
  optionSwitchCount: 0,
  hoverSequence: [],
  idleBeforeSubmitMs: 0,
  answerChanges: [],
  wasSubmitted: false,
  timedOut,
});

function rememberSession(progress: DiagnosticProgress): void {
  const raw = sessionStorage.getItem(DIAGNOSTIC_KEY);
  const previous = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  sessionStorage.setItem(
    DIAGNOSTIC_KEY,
    JSON.stringify({
      ...previous,
      studentId: progress.studentId,
      diagnosticId: progress.diagnosticId,
    }),
  );
}

export default function DiagnosticPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [progress, setProgress] = useState<DiagnosticProgress | null>(null);
  const [phase, setPhase] = useState<"booting" | "ready" | "completing">("booting");
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<FailureKind | null>(null);
  const [usingSaved, setUsingSaved] = useState(false);
  const retries = useRetryCounter();

  const telemetryRef = useRef<ReadTelemetry | null>(null);
  const submittingRef = useRef(false);
  const pendingRef = useRef<PendingAnswer | null>(null);
  const diagnosticIdRef = useRef<string | null>(null);

  const readTelemetry = (timedOut: boolean): ClientTelemetry =>
    telemetryRef.current?.(timedOut) ?? emptyTelemetry(timedOut);

  const complete = useCallback(async () => {
    const diagnosticId = diagnosticIdRef.current;
    if (!diagnosticId) return;
    setPhase("completing");
    setFailure(null);
    try {
      const data = await apiFetch<DiagnosticCompleteResponse>(
        "/api/diagnostic/complete",
        { diagnosticId },
      );
      sessionStorage.setItem(FINGERPRINT_KEY, JSON.stringify(data));
      router.push("/fingerprint");
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        setFailure("complete");
        return;
      }
      showToast({
        variant: "error",
        message: "We couldn't finish your diagnostic. Let's start again.",
      });
      router.replace("/onboarding");
    }
  }, [router, showToast]);

  const applyProgress = useCallback(
    (next: DiagnosticProgress, source: "live" | "saved") => {
      diagnosticIdRef.current = next.diagnosticId;
      rememberSession(next);
      pendingRef.current = null;
      setProgress(next);
      setSelected(null);
      setUsingSaved(source === "saved");
      if (next.completed) {
        router.replace("/fingerprint");
        return;
      }
      if (next.question === null) {
        void complete();
        return;
      }
      setPhase("ready");
    },
    [complete, router],
  );

  const load = useCallback(
    async (diagnosticId: string) => {
      setFailure(null);
      try {
        const data = await apiFetch<DiagnosticProgress>(
          progressPath(diagnosticId),
          undefined,
          { cache: true },
        );
        applyProgress(data, "live");
      } catch (error) {
        if (error instanceof ApiUnavailableError) {
          setFailure("load");
          return;
        }
        router.replace("/onboarding"); // unknown session
      }
    },
    [applyProgress, router],
  );

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("session");
    let diagnosticId = fromUrl;
    if (!diagnosticId) {
      const raw = sessionStorage.getItem(DIAGNOSTIC_KEY);
      diagnosticId = raw
        ? ((JSON.parse(raw) as { diagnosticId?: string }).diagnosticId ?? null)
        : null;
    }
    if (!diagnosticId) {
      router.replace("/onboarding");
      return;
    }
    diagnosticIdRef.current = diagnosticId;
    void load(diagnosticId);
  }, [load, router]);

  const submit = useCallback(
    async (answer: PendingAnswer) => {
      const diagnosticId = diagnosticIdRef.current;
      if (!diagnosticId || submittingRef.current) return;
      submittingRef.current = true;
      setSubmitting(true);
      setFailure(null);
      pendingRef.current = answer;
      try {
        const res = await apiFetch<DiagnosticAnswerResponse>(
          "/api/diagnostic/answer",
          { diagnosticId, ...answer },
        );
        // Keep the replay copy as fresh as the last thing the student saw.
        cacheResponse(progressPath(diagnosticId), res.progress);
        applyProgress(res.progress, "live");
      } catch (error) {
        if (error instanceof ApiUnavailableError) {
          setFailure("submit");
        } else if (error instanceof ApiRejectedError && error.status === 409) {
          await load(diagnosticId); // this tab was out of step: resync
        } else {
          showToast({
            variant: "error",
            message: "We couldn't save that answer. Please try again.",
          });
        }
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [applyProgress, load, showToast],
  );

  const resetRetries = retries.reset;
  useEffect(() => {
    if (failure === null) resetRetries();
  }, [failure, resetRetries]);

  const question = progress?.question ?? null;

  const handleNext = () => {
    if (!question || selected == null) return;
    void submit({
      questionId: question.id,
      selectedOption: selected,
      telemetry: readTelemetry(false),
    });
  };

  // Time is up: send whatever is selected, or nothing if nothing is.
  const handleExpire = () => {
    if (!question || submittingRef.current) return;
    void submit({
      questionId: question.id,
      selectedOption: selected,
      telemetry: readTelemetry(true),
    });
  };

  const handleRetry = () => {
    retries.bump();
    const diagnosticId = diagnosticIdRef.current;
    if (!failure || !diagnosticId) return;
    if (failure === "load") void load(diagnosticId);
    else if (failure === "submit" && pendingRef.current) {
      void submit(pendingRef.current);
    } else if (failure === "complete") void complete();
  };

  // Only a read can be replayed from the student's own saved copy; an answer
  // has to be graded by the server.
  const savedProgress =
    failure === "load" && diagnosticIdRef.current
      ? readCached<DiagnosticProgress>(progressPath(diagnosticIdRef.current))
      : null;

  const resumeFromSaved = () => {
    if (!savedProgress) return;
    setFailure(null);
    applyProgress(savedProgress, "saved");
  };

  if (failure === "load" || failure === "complete") {
    return (
      <main className="flex min-h-screen flex-col justify-center bg-background px-lg">
        <div className="mx-auto w-full max-w-md">
          <ApiRecovery
            retryCount={retries.count}
            onRetry={handleRetry}
            onUseCached={savedProgress ? resumeFromSaved : undefined}
          />
        </div>
      </main>
    );
  }

  if (phase === "booting" || phase === "completing" || !progress || !question) {
    return (
      <main
        aria-busy="true"
        className="flex min-h-screen flex-col justify-center bg-background px-lg"
      >
        <div className="mx-auto flex w-full max-w-md flex-col gap-lg">
          <Skeleton variant="line" className="w-1/2" />
          <Skeleton variant="card" />
        </div>
      </main>
    );
  }

  const options: QuestionCardOption[] = Object.entries(question.options).map(
    ([id, text]) => ({ id, text }),
  );

  return (
    <main className="flex min-h-screen flex-col bg-background px-lg pb-lg pt-xl">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <ProgressHeader
          current={progress.answered + 1}
          total={progress.total}
          topicLabel={`${question.topic} · ${question.subtopic}`}
          onExit={() => router.push("/")}
          timer={
            <Timer
              key={question.id}
              totalSeconds={question.estimatedTimeSeconds}
              onExpire={handleExpire}
            />
          }
        />
        {usingSaved && <SavedContentNotice className="mt-md self-start" />}
        <QuestionCard
          key={question.id}
          className="mt-xl"
          questionText={question.questionText}
          options={options}
          selectedOption={selected}
          result={null}
          disabled={submitting || failure === "submit"}
          onSelect={setSelected}
          telemetryRef={telemetryRef}
        />
      </div>

      <div className="sticky bottom-0 mx-auto w-full max-w-md bg-background pb-lg pt-md">
        {failure === "submit" ? (
          <ApiRecovery
            message="We couldn't save your answer. Check your connection and try again."
            retryCount={retries.count}
            retrying={submitting}
            onRetry={handleRetry}
          />
        ) : (
          <Button
            size="lg"
            fullWidth
            onClick={handleNext}
            disabled={selected == null || submitting}
          >
            {progress.answered + 1 >= progress.total ? "Finish" : "Next"}
          </Button>
        )}
      </div>
    </main>
  );
}
