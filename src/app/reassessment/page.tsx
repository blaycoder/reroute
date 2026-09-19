"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ProgressHeader } from "@/components/assessment/ProgressHeader";
import {
  QuestionCard,
  type QuestionCardOption,
} from "@/components/assessment/QuestionCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api-client";
import { BeforeAfterBar } from "@/components/fingerprint/BeforeAfterBar";
import { tokens } from "@/design/tokens";
import type {
  InterventionGenerateResponse,
  InterventionVerifyResponse,
  PracticeItem,
} from "@/types/api";
import type { AttemptTelemetry } from "@/types/learner-state";

const INTERVENTION_KEY = "reroot.intervention";

interface StoredIntervention {
  studentId: string;
  topic: string;
  guidedResponse?: string;
  practiceResponses?: string[];
  generate?: InterventionGenerateResponse;
}

interface VerifyResult {
  improved: boolean;
  masteryBefore: number;
  masteryAfter: number;
}

const pct = (value: number) => Math.round(value * 100);

const EMPTY_SNAPSHOT: AttemptTelemetry = {
  timeToFirstClickMs: 0,
  totalDwellTimeMs: 0,
  optionSwitchCount: 0,
  hoverSequence: [],
  idleBeforeSubmitMs: 0,
  answerChanges: [],
  wasSubmitted: true,
};

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
  const [snapshot, setSnapshot] = useState<AttemptTelemetry | null>(null);
  const [attempts, setAttempts] = useState<AttemptTelemetry[]>([]);
  const [result, setResult] = useState<VerifyResult | null>(null);

  const shownAtRef = useRef<number | null>(null);
  const lastInteractionAtRef = useRef<number | null>(null);
  const responsesRef = useRef<string[]>([]);

  useEffect(() => {
    const raw = sessionStorage.getItem(INTERVENTION_KEY);
    const stored = raw ? (JSON.parse(raw) as StoredIntervention) : null;
    if (
      !stored?.generate ||
      !stored.topic ||
      !stored.guidedResponse ||
      !stored.practiceResponses
    ) {
      router.replace("/intervention");
      return;
    }
    setTopic(stored.topic);
    setItems(stored.generate.content.reassessment ?? []);
    // No reassessment items (generic path) — go straight to verification.
    setPhase(stored.generate.content.reassessment?.length ? "questions" : "verifying");
  }, [router]);

  // Per-question timers: reset whenever the question changes.
  useEffect(() => {
    if (phase === "questions") {
      shownAtRef.current = performance.now();
      lastInteractionAtRef.current = null;
    }
  }, [phase, index]);

  const handleSelect = useCallback(
    (optionId: string, telemetry: AttemptTelemetry) => {
      setSelected(optionId);
      setSnapshot(telemetry);
      lastInteractionAtRef.current = performance.now();
    },
    [],
  );

  const submitVerify = useCallback(
    async (reassessmentResponses: string[], telemetry: AttemptTelemetry[]) => {
      const raw = sessionStorage.getItem(INTERVENTION_KEY);
      const stored = raw ? (JSON.parse(raw) as StoredIntervention) : null;
      if (!stored?.generate || !stored.guidedResponse) return;
      setVerifyError(false);
      try {
        const data = await apiFetch<InterventionVerifyResponse>(
          "/api/intervention/verify",
          {
            interventionId: stored.generate.interventionId,
            answers: {
              guidedResponse: stored.guidedResponse,
              practiceResponses: stored.practiceResponses ?? [],
              reassessmentResponses,
            },
            telemetry,
          },
        );
        sessionStorage.setItem(
          "reroot.verifyResult",
          JSON.stringify({ topic, ...data }),
        );
        setResult({
          improved: data.improved,
          masteryBefore: data.masteryBefore,
          masteryAfter: data.masteryAfter ?? 0,
        });
        setPhase("result");
      } catch {
        showToast({
          variant: "error",
          message:
            "Couldn't load your results. Check your connection and try again.",
        });
        setVerifyError(true);
      }
    },
    [showToast, topic],
  );

  const handleNext = () => {
    if (!selected || submittingBlocked()) return;

    const now = performance.now();
    const shownAt = shownAtRef.current ?? now;
    const lastInteraction = lastInteractionAtRef.current ?? shownAt;
    const totalDwellTimeMs = Math.round(now - shownAt);
    const merged: AttemptTelemetry = {
      ...(snapshot ?? EMPTY_SNAPSHOT),
      totalDwellTimeMs,
      idleBeforeSubmitMs: Math.round(now - lastInteraction),
      wasSubmitted: true,
    };
    const updatedAttempts = [...attempts, merged];
    responsesRef.current[index] = selected;
    setAttempts(updatedAttempts);
    setSelected(null);
    setSnapshot(null);

    if (index + 1 >= items.length) {
      setPhase("verifying");
      void submitVerify(responsesRef.current, updatedAttempts);
      return;
    }
    setIndex((current) => current + 1);
  };

  const submittingBlocked = () => phase !== "questions";

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
            <Button
              size="lg"
              fullWidth
              onClick={() => void submitVerify(responsesRef.current, attempts)}
            >
              Try again
            </Button>
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

  if (!items[index]) return null;

  const item = items[index];
  const options: QuestionCardOption[] = Object.entries(item.options).map(
    ([id, text]) => ({ id, text }),
  );

  return (
    <main className="flex min-h-screen flex-col bg-background px-lg pb-lg pt-xl">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <p className="font-heading text-h3 font-bold text-textPrimary">
          Reroot<span className="text-primary">.</span>
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
          />
        </div>

        <QuestionCard
          key={index}
          className="mt-xl"
          questionText={item.questionText}
          options={options}
          selectedOption={selected}
          result={null}
          onSelect={handleSelect}
        />
      </div>

      <div className="sticky bottom-0 mx-auto w-full max-w-md bg-background pb-lg pt-md">
        {selected != null && (
          <Button size="lg" fullWidth onClick={handleNext}>
            {index + 1 >= items.length ? "Finish" : "Next"}
          </Button>
        )}
      </div>
    </main>
  );
}
