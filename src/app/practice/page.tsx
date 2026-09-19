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
import type { InterventionGenerateResponse, PracticeItem } from "@/types/api";

const INTERVENTION_KEY = "reroot.intervention";

interface StoredIntervention {
  studentId: string;
  topic: string;
  guidedResponse?: string;
  practiceResponses?: string[];
  generate?: InterventionGenerateResponse;
}

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
  const [checking, setChecking] = useState(false);
  const responsesRef = useRef<string[]>([]);

  useEffect(() => {
    const raw = sessionStorage.getItem(INTERVENTION_KEY);
    const stored = raw ? (JSON.parse(raw) as StoredIntervention) : null;
    if (!stored?.generate || !stored.topic) {
      router.replace("/intervention");
      return;
    }
    setTopic(stored.topic);
    setInterventionId(stored.generate.interventionId);
    setItems(stored.generate.content.practice ?? []);
    setPhase("ready");
  }, [router]);

  const checkAnswer = useCallback(
    async (itemIndex: number, optionId: string) => {
      setChecking(true);
      try {
        const data = await apiFetch<{ correct: boolean }>(
          "/api/intervention/check-practice",
          {
            interventionId,
            index: itemIndex,
            selectedOption: optionId,
          },
        );
        responsesRef.current[itemIndex] = optionId;
        setResult(data.correct ? "correct" : "wrong");
      } catch {
        setSelected(null);
        showToast({
          variant: "error",
          message: "Couldn't save that. Check your connection and try again.",
        });
      } finally {
        setChecking(false);
      }
    },
    [interventionId, showToast],
  );

  const handleSelect = useCallback(
    (optionId: string) => {
      if (selected != null || checking) return;
      setSelected(optionId);
      void checkAnswer(index, optionId);
    },
    [selected, checking, index, checkAnswer],
  );

  const handleNext = () => {
    if (index + 1 >= items.length) {
      const raw = sessionStorage.getItem(INTERVENTION_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as StoredIntervention;
        sessionStorage.setItem(
          INTERVENTION_KEY,
          JSON.stringify({
            ...stored,
            practiceResponses: responsesRef.current,
          }),
        );
      }
      router.push("/reassessment");
      return;
    }
    setIndex((current) => current + 1);
    setSelected(null);
    setResult(null);
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
          <Button onClick={() => router.push("/reassessment")}>Continue</Button>
        </div>
      </main>
    );
  }

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
          />
        </div>

        <QuestionCard
          key={index}
          className="mt-xl"
          questionText={item.questionText}
          options={options}
          selectedOption={selected}
          result={result}
          disabled={checking}
          onSelect={handleSelect}
        />

        <p
          role="status"
          aria-live="polite"
          className="mt-md text-small text-textMuted"
        >
          {checking
            ? "Checking…"
            : result === "correct"
              ? "Correct."
              : result === "wrong"
                ? "Not quite."
                : ""}
        </p>
      </div>

      <div className="sticky bottom-0 mx-auto w-full max-w-md bg-background pb-lg pt-md">
        {result != null && (
          <Button size="lg" fullWidth onClick={handleNext}>
            {index + 1 >= items.length ? "Finish" : "Next"}
          </Button>
        )}
      </div>
    </main>
  );
}
