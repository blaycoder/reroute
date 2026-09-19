"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ProgressHeader } from "@/components/assessment/ProgressHeader";
import {
  QuestionCard,
  type QuestionCardOption,
} from "@/components/assessment/QuestionCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api-client";
import type {
  DiagnosticAnswerResponse,
  DiagnosticQuestionPreview,
  DiagnosticStartResponse,
} from "@/types/api";
import type { AttemptTelemetry } from "@/types/learner-state";

// Reads sessionStorage "reroot.diagnostic" (written by /onboarding) and
// "reroot.fingerprint" (written for /fingerprint on completion).
const DIAGNOSTIC_KEY = "reroot.diagnostic";
const FINGERPRINT_KEY = "reroot.fingerprint";

type StoredDiagnostic = DiagnosticStartResponse & { targetScore: number };

interface AnsweredQuestion {
  questionId: string;
  topic: string;
  correct: boolean;
}

type Phase = "booting" | "ready";

const DIFFICULTY_RANK: Record<DiagnosticQuestionPreview["difficulty"], number> = {
  easy: 0,
  medium: 1,
  hard: 2,
};

// Adaptive sequencing (simple version): the client picks the order over the
// batch. 2 questions per domain before any domain gets a 3rd; difficulty
// target shifts ±1 after a domain's first pair, and the next question in that
// domain is the remaining one closest to target.
function pickTopic(pool: DiagnosticQuestionPreview[], answered: AnsweredQuestion[]): string | null {
  const answeredIds = new Set(answered.map((a) => a.questionId));
  const remaining = pool.filter((q) => !answeredIds.has(q.id));
  if (remaining.length === 0) return null;

  const firstSeen = new Map<string, number>();
  pool.forEach((q, index) => {
    if (!firstSeen.has(q.topic)) firstSeen.set(q.topic, index);
  });

  const topics = [...new Set(remaining.map((q) => q.topic))];
  topics.sort((a, b) => {
    const aCount = answered.filter((x) => x.topic === a).length;
    const bCount = answered.filter((x) => x.topic === b).length;
    const aTier = aCount < 2 ? 0 : 1;
    const bTier = bCount < 2 ? 0 : 1;
    if (aTier !== bTier) return aTier - bTier;
    if (aCount !== bCount) return aCount - bCount;
    return (firstSeen.get(a) ?? 0) - (firstSeen.get(b) ?? 0);
  });
  return topics[0];
}

function difficultyTarget(topic: string, answered: AnsweredQuestion[]): number {
  const inTopic = answered.filter((a) => a.topic === topic);
  if (inTopic.length < 2) return DIFFICULTY_RANK.medium;
  const pair = inTopic.slice(0, 2);
  if (pair.every((a) => a.correct)) return DIFFICULTY_RANK.hard;
  if (pair.every((a) => !a.correct)) return DIFFICULTY_RANK.easy;
  return DIFFICULTY_RANK.medium;
}

function pickQuestion(
  pool: DiagnosticQuestionPreview[],
  answered: AnsweredQuestion[],
  topic: string,
): DiagnosticQuestionPreview | null {
  const answeredIds = new Set(answered.map((a) => a.questionId));
  const target = difficultyTarget(topic, answered);
  const remaining = pool
    .map((q, index) => ({ q, index }))
    .filter(({ q }) => q.topic === topic && !answeredIds.has(q.id));
  remaining.sort((a, b) => {
    const da = Math.abs(DIFFICULTY_RANK[a.q.difficulty] - target);
    const db = Math.abs(DIFFICULTY_RANK[b.q.difficulty] - target);
    if (da !== db) return da - db;
    return a.index - b.index;
  });
  return remaining[0]?.q ?? null;
}

const EMPTY_SNAPSHOT: AttemptTelemetry = {
  timeToFirstClickMs: 0,
  totalDwellTimeMs: 0,
  optionSwitchCount: 0,
  hoverSequence: [],
  idleBeforeSubmitMs: 0,
  answerChanges: [],
  wasSubmitted: true,
};

export default function DiagnosticPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [phase, setPhase] = useState<Phase>("booting");
  const [pool, setPool] = useState<DiagnosticQuestionPreview[]>([]);
  const [answered, setAnswered] = useState<AnsweredQuestion[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<AttemptTelemetry | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completingError, setCompletingError] = useState(false);

  const diagnosticIdRef = useRef<string | null>(null);
  const shownAtRef = useRef<number | null>(null);
  const lastInteractionAtRef = useRef<number | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(DIAGNOSTIC_KEY);
    if (!raw) {
      router.replace("/onboarding");
      return;
    }
    const stored = JSON.parse(raw) as StoredDiagnostic;
    diagnosticIdRef.current = stored.diagnosticId;
    setPool(stored.questions);
    setPhase("ready");
  }, [router]);

  const topic = phase === "ready" ? pickTopic(pool, answered) : null;
  const question = useMemo(
    () => (topic ? pickQuestion(pool, answered, topic) : null),
    [pool, answered, topic],
  );
  const index = answered.length + 1;
  const total = pool.length;

  // Per-question timers: reset whenever the question changes.
  useEffect(() => {
    if (phase === "ready" && question) {
      shownAtRef.current = performance.now();
      lastInteractionAtRef.current = null;
    }
  }, [phase, question]);

  const handleSelect = useCallback(
    (optionId: string, telemetry: AttemptTelemetry) => {
      setSelected(optionId);
      setSnapshot(telemetry);
      lastInteractionAtRef.current = performance.now();
    },
    [],
  );

  const completeDiagnostic = useCallback(async () => {
    setCompletingError(false);
    try {
      const data = await apiFetch("/api/diagnostic/complete", {
        diagnosticId: diagnosticIdRef.current,
      });
      sessionStorage.setItem(FINGERPRINT_KEY, JSON.stringify(data));
      router.push("/fingerprint");
    } catch {
      setCompletingError(true);
      showToast({
        variant: "error",
        message: "Couldn't save your results. Check your connection and try again.",
      });
    }
  }, [router, showToast]);

  const handleNext = async () => {
    if (!question || !selected || submitting) return;

    const now = performance.now();
    const shownAt = shownAtRef.current ?? now;
    const lastInteraction = lastInteractionAtRef.current ?? shownAt;
    const totalDwellTimeMs = Math.round(now - shownAt);
    const telemetry: AttemptTelemetry = {
      ...(snapshot ?? EMPTY_SNAPSHOT),
      totalDwellTimeMs,
      idleBeforeSubmitMs: Math.round(now - lastInteraction),
      wasSubmitted: true,
    };

    setSubmitting(true);
    try {
      const data = await apiFetch<DiagnosticAnswerResponse>(
        "/api/diagnostic/answer",
        {
          diagnosticId: diagnosticIdRef.current,
          questionId: question.id,
          selectedOption: selected,
          // Clamp to 1s: the API rejects 0, and a sub-second answer would
          // otherwise be dropped and never recorded.
          responseTimeSeconds: Math.max(1, Math.round(totalDwellTimeMs / 1000)),
          telemetry,
        },
      );

      const updated = [
        ...answered,
        { questionId: question.id, topic: question.topic, correct: data.correct },
      ];
      setAnswered(updated);
      setSelected(null);
      setSnapshot(null);
      setSubmitting(false);

      if (updated.length >= pool.length) {
        setCompleting(true);
        await completeDiagnostic();
      }
    } catch {
      showToast({
        variant: "error",
        message: "Couldn't save your answer. Check your connection and try again.",
      });
      setSubmitting(false);
    }
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

  if (completing) {
    return (
      <main
        aria-busy={!completingError}
        className="flex min-h-screen flex-col justify-center bg-background px-lg"
      >
        <div className="mx-auto flex w-full max-w-md flex-col gap-lg">
          {!completingError && (
            <>
              <Skeleton variant="line" className="w-1/2" />
              <Skeleton variant="card" />
            </>
          )}
          {completingError && (
            <Button size="lg" fullWidth onClick={() => void completeDiagnostic()}>
              Try again
            </Button>
          )}
        </div>
      </main>
    );
  }

  if (!question) return null;

  const options: QuestionCardOption[] = Object.entries(question.options).map(
    ([id, text]) => ({ id, text }),
  );

  return (
    <main className="flex min-h-screen flex-col bg-background px-lg pb-lg pt-xl">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <ProgressHeader
          current={index}
          total={total}
          topicLabel={question.topic}
          onExit={() => router.push("/")}
        />
        <p className="sr-only" aria-live="polite">
          {`Question ${index} of ${total}, ${question.topic}`}
        </p>
        <QuestionCard
          key={question.id}
          className="mt-xl"
          questionText={question.questionText}
          options={options}
          selectedOption={selected}
          result={null}
          disabled={submitting}
          onSelect={handleSelect}
        />
      </div>
      <div className="sticky bottom-0 mx-auto w-full max-w-md bg-background pb-lg pt-md">
        {selected != null && (
          <Button size="lg" fullWidth onClick={() => void handleNext()} disabled={submitting}>
            {submitting && <Loader2 className="h-lg w-lg animate-spin" aria-hidden />}
            {submitting ? "Saving…" : "Next"}
          </Button>
        )}
      </div>
    </main>
  );
}
