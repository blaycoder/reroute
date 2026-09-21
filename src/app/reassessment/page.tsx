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
import { BeforeAfterBar } from "@/components/fingerprint/BeforeAfterBar";
import { ApiRecovery, useRetryCounter } from "@/components/ui/ApiRecovery";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiUnavailableError, apiFetch } from "@/lib/api-client";
import { tokens } from "@/design/tokens";
import type {
  ClientTelemetry,
  InterventionGenerateResponse,
  InterventionVerifyRequest,
  InterventionVerifyResponse,
  PracticeItem,
} from "@/types/api";

const INTERVENTION_KEY = "reroute.intervention";

interface StoredIntervention {
  studentId: string;
  topic: string;
  /** Set by /practice once every practice question has been answered. */
  practiceDone?: boolean;
  generate?: InterventionGenerateResponse;
}

interface VerifyResult {
  improved: boolean;
  masteryBefore: number;
  masteryAfter: number;
}

const pct = (value: number) => Math.round(value * 100);

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

export default function ReassessmentPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [phase, setPhase] = useState<
    "booting" | "questions" | "verifying" | "result"
  >("booting");
  const [verifyError, setVerifyError] = useState(false);
  const [topic, setTopic] = useState("");
  const [items, setItems] = useState<PracticeItem[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const retries = useRetryCounter();

  const answersRef = useRef<InterventionVerifyRequest["reassessment"]>([]);
  const telemetryRef = useRef<ReadTelemetry | null>(null);
  const advancingRef = useRef(false);
  const interventionIdRef = useRef<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(INTERVENTION_KEY);
    const stored = raw ? (JSON.parse(raw) as StoredIntervention) : null;
    if (!stored?.generate || !stored.topic) {
      router.replace("/intervention");
      return;
    }
    if (!stored.practiceDone) {
      router.replace("/practice");
      return;
    }
    const reassessment = stored.generate.content.reassessment;
    if (reassessment.length === 0) {
      router.replace("/progress");
      return;
    }
    interventionIdRef.current = stored.generate.interventionId;
    setTopic(stored.topic);
    setItems(reassessment);
    setPhase("questions");
  }, [router]);

  // A new question (or phase) unlocks advancing again.
  useEffect(() => {
    advancingRef.current = false;
  }, [index, phase]);

  const submitVerify = useCallback(async () => {
    const interventionId = interventionIdRef.current;
    if (!interventionId) return;
    setVerifyError(false);
    const request: InterventionVerifyRequest = {
      interventionId,
      reassessment: answersRef.current,
    };
    try {
      const data = await apiFetch<InterventionVerifyResponse>(
        "/api/intervention/verify",
        request,
      );
      sessionStorage.setItem(
        "reroute.verifyResult",
        JSON.stringify({ topic, ...data }),
      );
      setResult({
        improved: data.improved,
        masteryBefore: data.masteryBefore,
        masteryAfter: data.masteryAfter,
      });
      setPhase("result");
    } catch (error) {
      if (!(error instanceof ApiUnavailableError)) {
        showToast({
          variant: "error",
          message: "We couldn't score that. Please try again.",
        });
      }
      setVerifyError(true);
    }
  }, [showToast, topic]);

  // Records the current answer with its telemetry, then moves on. Used by both
  // the Next button and the timer running out.
  const advance = (choice: string | null, timedOut: boolean) => {
    const item = items[index];
    if (phase !== "questions" || !item || advancingRef.current) return;
    advancingRef.current = true;
    answersRef.current.push({
      questionId: item.id,
      selectedOption: choice,
      telemetry: telemetryRef.current?.(timedOut) ?? emptyTelemetry(timedOut),
    });
    setSelected(null);
    if (index + 1 >= items.length) {
      setPhase("verifying");
      void submitVerify();
      return;
    }
    setIndex((current) => current + 1);
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
        </div>
      </main>
    );
  }

  if (phase === "verifying") {
    return (
      <main
        aria-busy={!verifyError}
        className="flex min-h-screen flex-col justify-center bg-background px-lg"
      >
        <div className="mx-auto flex w-full max-w-md flex-col gap-lg">
          {!verifyError && (
            <>
              <Skeleton variant="line" className="w-2/3" />
              <Skeleton variant="card" />
            </>
          )}
          {verifyError && (
            <ApiRecovery
              message="We couldn't load your results. Check your connection and try again."
              retryCount={retries.count}
              onRetry={() => {
                retries.bump();
                void submitVerify();
              }}
            />
          )}
        </div>
      </main>
    );
  }

  if (phase === "result" && result) {
    const before = pct(result.masteryBefore);
    const after = pct(result.masteryAfter);
    return (
      <main className="flex min-h-screen flex-col justify-center bg-background px-lg">
        <div className="mx-auto flex w-full max-w-md flex-col gap-xl">
          <h1 className="font-heading text-h1 font-semibold leading-tight text-textPrimary">
            Did it stick?
          </h1>
          <p className="text-body font-medium text-textPrimary">
            {result.improved
              ? `Improved. ${topic} mastery: ${before}% → ${after}%. That's real.`
              : "Not yet. That's useful too — we'll try a different angle."}
          </p>
          <BeforeAfterBar
            label={`${topic} mastery`}
            before={before}
            after={after}
            afterDurationMs={tokens.motion.durations.celebration}
            afterDelayMs={tokens.motion.durations.micro}
          />
          <Button size="lg" fullWidth onClick={() => router.push("/progress")}>
            Continue
          </Button>
        </div>
      </main>
    );
  }

  const item = items[index];
  if (!item) return null;

  const options: QuestionCardOption[] = Object.entries(item.options).map(
    ([id, text]) => ({ id, text }),
  );

  return (
    <main className="flex min-h-screen flex-col bg-background px-lg pb-lg pt-xl">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <p className="font-heading text-h3 font-bold text-textPrimary">
          Reroute<span className="text-primary">.</span>
        </p>
        <h1 className="mt-lg font-heading text-h2 font-semibold text-textPrimary">
          Did it stick?
        </h1>
        <p className="mt-xs text-small text-textMuted">
          Two new questions. Same skill. New numbers.
        </p>

        <div className="mt-xl">
          <ProgressHeader
            current={index + 1}
            total={items.length}
            topicLabel={topic}
            timer={
              <Timer
                key={item.id}
                totalSeconds={item.estimatedTimeSeconds}
                onExpire={() => advance(selected, true)}
              />
            }
          />
        </div>

        <QuestionCard
          key={item.id}
          className="mt-xl"
          questionText={item.questionText}
          options={options}
          selectedOption={selected}
          result={null}
          onSelect={setSelected}
          telemetryRef={telemetryRef}
        />
      </div>

      <div className="sticky bottom-0 mx-auto w-full max-w-md bg-background pb-lg pt-md">
        {selected != null && (
          <Button size="lg" fullWidth onClick={() => advance(selected, false)}>
            {index + 1 >= items.length ? "Finish" : "Next"}
          </Button>
        )}
      </div>
    </main>
  );
}
