"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ProgressHeader } from "@/components/assessment/ProgressHeader";
import {
  QuestionCard,
  type QuestionCardOption,
  type ReadTelemetry,
} from "@/components/assessment/QuestionCard";
import { Timer } from "@/components/assessment/Timer";
import { ApiRecovery, useRetryCounter } from "@/components/ui/ApiRecovery";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiUnavailableError, apiFetch } from "@/lib/api-client";
import type {
  ClientTelemetry,
  InterventionCheckPracticeResponse,
  InterventionGenerateResponse,
  PracticeItem,
} from "@/types/api";

const INTERVENTION_KEY = "reroute.intervention";

interface StoredIntervention {
  studentId: string;
  topic: string;
  practiceDone?: boolean;
  generate?: InterventionGenerateResponse;
}

interface PendingCheck {
  questionId: string;
  choice: string | null;
  telemetry: ClientTelemetry;
}

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

export default function PracticePage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [phase, setPhase] = useState<"booting" | "ready">("booting");
  const [topic, setTopic] = useState("");
  const [items, setItems] = useState<PracticeItem[]>([]);
  const [interventionId, setInterventionId] = useState("");
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [timedOutEmpty, setTimedOutEmpty] = useState(false);
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState(false);
  const retries = useRetryCounter();

  const telemetryRef = useRef<ReadTelemetry | null>(null);
  const pendingRef = useRef<PendingCheck | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(INTERVENTION_KEY);
    const stored = raw ? (JSON.parse(raw) as StoredIntervention) : null;
    if (!stored?.generate || !stored.topic) {
      router.replace("/intervention");
      return;
    }
    setTopic(stored.topic);
    setInterventionId(stored.generate.interventionId);
    setItems(stored.generate.content.practice);
    setPhase("ready");
  }, [router]);

  // The server grades the answer and records it, so the student's profile
  // moves with every question they answer.
  const sendCheck = async (pending: PendingCheck) => {
    setChecking(true);
    setFailed(false);
    try {
      const data = await apiFetch<InterventionCheckPracticeResponse>(
        "/api/intervention/check-practice",
        {
          interventionId,
          questionId: pending.questionId,
          selectedOption: pending.choice,
          telemetry: pending.telemetry,
        },
      );
      setTimedOutEmpty(pending.choice === null);
      setResult(data.correct ? "correct" : "wrong");
      pendingRef.current = null;
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        setFailed(true);
      } else {
        showToast({
          variant: "error",
          message: "We couldn't save that answer. Please try again.",
        });
      }
    } finally {
      setChecking(false);
    }
  };

  const check = (choice: string | null, timedOut: boolean) => {
    const item = items[index];
    if (!item || checking || result != null || pendingRef.current) return;
    const pending: PendingCheck = {
      questionId: item.id,
      choice,
      telemetry: telemetryRef.current?.(timedOut) ?? emptyTelemetry(timedOut),
    };
    pendingRef.current = pending;
    void sendCheck(pending);
  };

  const handleRetry = () => {
    retries.bump();
    if (pendingRef.current) void sendCheck(pendingRef.current);
  };

  const finishPractice = () => {
    const raw = sessionStorage.getItem(INTERVENTION_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as StoredIntervention;
      sessionStorage.setItem(
        INTERVENTION_KEY,
        JSON.stringify({ ...stored, practiceDone: true }),
      );
    }
    router.push("/reassessment");
  };

  const handleNext = () => {
    if (index + 1 >= items.length) {
      finishPractice();
      return;
    }
    setIndex((current) => current + 1);
    setSelected(null);
    setResult(null);
    setTimedOutEmpty(false);
    setFailed(false);
    pendingRef.current = null;
    retries.reset();
  };

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
        </div>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="flex min-h-screen flex-col justify-center bg-background px-lg">
        <div className="mx-auto flex w-full max-w-md flex-col gap-lg">
          <p className="text-body text-textMuted">
            Nothing to practice for this session — moving on.
          </p>
          <Button onClick={finishPractice}>Continue</Button>
        </div>
      </main>
    );
  }

  const item = items[index];
  const options: QuestionCardOption[] = Object.entries(item.options).map(
    ([id, text]) => ({ id, text }),
  );

  const statusText = checking
    ? "Checking…"
    : timedOutEmpty
      ? "Time's up. Let's look at it together."
      : result === "correct"
        ? "Correct."
        : result === "wrong"
          ? "Not quite."
          : "";

  return (
    <main className="flex min-h-screen flex-col bg-background px-lg pb-lg pt-xl">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <p className="font-heading text-h3 font-bold text-textPrimary">
          Reroute<span className="text-primary">.</span>
        </p>
        <h1 className="mt-lg font-heading text-h2 font-semibold text-textPrimary">
          Prove it holds.
        </h1>
        <p className="mt-xs text-small text-textMuted">
          {items.length} questions. Same idea as before.
        </p>

        <div className="mt-xl">
          <ProgressHeader
            current={index + 1}
            total={items.length}
            topicLabel={topic}
            timer={
              result == null ? (
                <Timer
                  key={item.id}
                  totalSeconds={item.estimatedTimeSeconds}
                  onExpire={() => check(selected, true)}
                />
              ) : undefined
            }
          />
        </div>

        <QuestionCard
          key={item.id}
          className="mt-xl"
          questionText={item.questionText}
          options={options}
          selectedOption={selected}
          result={result}
          disabled={checking}
          onSelect={setSelected}
          telemetryRef={telemetryRef}
        />

        <p
          role="status"
          aria-live="polite"
          className="mt-md text-small text-textMuted"
        >
          {statusText}
        </p>
      </div>

      <div className="sticky bottom-0 mx-auto w-full max-w-md bg-background pb-lg pt-md">
        {failed ? (
          <ApiRecovery
            message="We couldn't save your answer. Check your connection and try again."
            retryCount={retries.count}
            retrying={checking}
            onRetry={handleRetry}
          />
        ) : result != null ? (
          <Button size="lg" fullWidth onClick={handleNext}>
            {index + 1 >= items.length ? "Finish" : "Next"}
          </Button>
        ) : (
          <Button
            size="lg"
            fullWidth
            onClick={() => check(selected, false)}
            disabled={selected == null || checking}
          >
            Check answer
          </Button>
        )}
      </div>
    </main>
  );
}
