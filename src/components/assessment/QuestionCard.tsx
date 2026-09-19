"use client";

import { useEffect, useRef } from "react";
import { Check, X } from "lucide-react";
import { MathText } from "@/components/ui/MathText";
import { cn, FOCUS_RING } from "@/design/utils";
import type { AttemptTelemetry } from "@/types/learner-state";

export interface QuestionCardOption {
  id: string;
  text: string;
}

export interface QuestionCardProps {
  questionText: string;
  options: QuestionCardOption[];
  /** Controlled selection. */
  selectedOption: string | null;
  /** Graded outcome for selectedOption; null while ungraded. */
  result: "correct" | "wrong" | null;
  disabled?: boolean;
  /**
   * Only honored together with `correctOption` — the diagnostic never reveals
   * the answer; practice mode may.
   */
  revealCorrect?: boolean;
  correctOption?: string;
  /**
   * Fires on every selection change with a cumulative telemetry snapshot.
   * Remount per question (`key={question.id}`) to reset telemetry.
   */
  onSelect: (selectedOption: string, telemetry: AttemptTelemetry) => void;
  className?: string;
}

type OptionState = "default" | "selected" | "correct" | "wrong" | "muted";

const OPTION_STYLES: Record<OptionState, string> = {
  default: "border-border bg-surface hover:border-primary hover:bg-surfaceMuted",
  selected: "border-primary bg-surfaceMuted",
  correct: "border-success bg-surfaceMuted",
  wrong: "border-error bg-surfaceMuted",
  muted: "border-border bg-surface opacity-50",
};

export function QuestionCard({
  questionText,
  options,
  selectedOption,
  result,
  disabled,
  revealCorrect,
  correctOption,
  onSelect,
  className,
}: QuestionCardProps) {
  const mountedAtRef = useRef<number | null>(null);
  const firstClickAtRef = useRef<number | null>(null);
  const lastInteractionAtRef = useRef<number | null>(null);
  const hoverSequenceRef = useRef<string[]>([]);
  const switchCountRef = useRef(0);
  const answerChangesRef = useRef<
    { from: string; to: string; timestampMs: number }[]
  >([]);

  useEffect(() => {
    mountedAtRef.current = performance.now();
  }, []);

  const locked = disabled || result != null;

  const buildTelemetry = (): AttemptTelemetry => {
    const now = performance.now();
    const mountedAt = mountedAtRef.current ?? now;
    return {
      timeToFirstClickMs:
        firstClickAtRef.current != null
          ? Math.round(firstClickAtRef.current - mountedAt)
          : 0,
      totalDwellTimeMs: Math.round(now - mountedAt),
      optionSwitchCount: switchCountRef.current,
      hoverSequence: hoverSequenceRef.current,
      idleBeforeSubmitMs:
        lastInteractionAtRef.current != null
          ? Math.round(now - lastInteractionAtRef.current)
          : 0,
      answerChanges: answerChangesRef.current,
      wasSubmitted: true,
    };
  };

  const handleSelect = (optionId: string) => {
    if (locked || optionId === selectedOption) return;
    const now = performance.now();
    if (firstClickAtRef.current == null) firstClickAtRef.current = now;
    if (selectedOption != null) {
      switchCountRef.current += 1;
      answerChangesRef.current = [
        ...answerChangesRef.current,
        {
          from: selectedOption,
          to: optionId,
          timestampMs: Math.round(now),
        },
      ];
    }
    lastInteractionAtRef.current = now;
    onSelect(optionId, buildTelemetry());
  };

  const handleHover = (optionId: string) => {
    hoverSequenceRef.current = [...hoverSequenceRef.current, optionId];
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (locked) return;
    const currentIndex = options.findIndex((o) => o.id === selectedOption);
    let nextIndex: number;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      nextIndex = Math.min(options.length - 1, currentIndex + 1);
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      nextIndex = Math.max(0, currentIndex - 1);
    } else {
      return;
    }
    event.preventDefault();
    handleSelect(options[nextIndex].id);
  };

  const optionState = (optionId: string): OptionState => {
    const isSelected = selectedOption === optionId;
    if (result != null) {
      if (isSelected) return result;
      if (
        revealCorrect &&
        correctOption != null &&
        optionId === correctOption
      ) {
        return "correct";
      }
      return "muted";
    }
    return isSelected ? "selected" : "default";
  };

  return (
    <section
      aria-label="Question"
      className={cn("flex flex-col gap-lg", className)}
    >
      <MathText
        text={questionText}
        className="font-heading text-h3 font-semibold text-textPrimary"
      />
      <div
        role="radiogroup"
        aria-label="Answer options"
        onKeyDown={handleKeyDown}
        className="flex flex-col gap-sm"
      >
        {options.map((option) => {
          const state = optionState(option.id);
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selectedOption === option.id}
              disabled={locked}
              onClick={() => handleSelect(option.id)}
              onPointerEnter={() => handleHover(option.id)}
              onFocus={() => handleHover(option.id)}
              className={cn(
                "flex min-h-xxxl w-full items-center gap-md rounded-md border px-lg py-sm text-left text-body text-textPrimary transition duration-micro ease-out",
                OPTION_STYLES[state],
                state === "default" && FOCUS_RING,
              )}
            >
              <span
                aria-hidden
                className="flex h-lg w-lg shrink-0 items-center justify-center rounded-pill border border-border text-micro font-semibold text-textMuted"
              >
                {option.id}
              </span>
              <MathText text={option.text} className="flex-1" />
              {state === "correct" && (
                <Check className="h-lg w-lg shrink-0 text-success" aria-hidden />
              )}
              {state === "wrong" && (
                <X className="h-lg w-lg shrink-0 text-error" aria-hidden />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
