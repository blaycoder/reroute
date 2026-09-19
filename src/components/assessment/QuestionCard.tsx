"use client";

import { useEffect, useRef } from "react";
import { Check, X } from "lucide-react";
import { MathText } from "@/components/ui/MathText";
import { cn, FOCUS_RING } from "@/design/utils";
import type { ClientTelemetry } from "@/types/api";

export interface QuestionCardOption {
  id: string;
  text: string;
}

/** Reads the behaviour captured so far; call it at the moment of submit or timeout. */
export type ReadTelemetry = (timedOut: boolean) => ClientTelemetry;

export interface QuestionCardProps {
  questionText: string;
  options: QuestionCardOption[];
  /** Controlled selection. Nothing is selected on load. */
  selectedOption: string | null;
  /** Graded outcome for selectedOption; null while ungraded. */
  result: "correct" | "wrong" | null;
  /** Locks the options (submitting, or time is up). */
  disabled?: boolean;
  onSelect: (selectedOption: string) => void;
  /**
   * Filled with a reader for the passive telemetry (first-tap time, switches,
   * idle time, ...). Remount per question (`key={question.id}`) to reset it.
   */
  telemetryRef?: React.MutableRefObject<ReadTelemetry | null>;
  className?: string;
}

type OptionState = "default" | "selected" | "correct" | "wrong" | "disabled";

const OPTION_STYLES: Record<OptionState, string> = {
  default:
    "border border-border bg-surface text-textPrimary hover:-translate-y-px hover:border-secondary hover:bg-surfaceMuted",
  selected: "border-2 border-primary bg-primaryTint text-secondary",
  correct: "border-2 border-success bg-primaryTint text-secondary",
  wrong: "border-2 border-error bg-errorTint text-textPrimary",
  disabled:
    "cursor-not-allowed border border-border bg-surface text-textPrimary opacity-60",
};

export function QuestionCard({
  questionText,
  options,
  selectedOption,
  result,
  disabled,
  onSelect,
  telemetryRef,
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

  const readTelemetry: ReadTelemetry = (timedOut) => {
    const now = performance.now();
    const mountedAt = mountedAtRef.current ?? now;
    const elapsedMs = Math.round(now - mountedAt);
    return {
      timeToFirstClickMs:
        firstClickAtRef.current != null
          ? Math.round(firstClickAtRef.current - mountedAt)
          : 0,
      totalDwellTimeMs: elapsedMs,
      timeOnQuestionMs: elapsedMs,
      optionSwitchCount: switchCountRef.current,
      hoverSequence: hoverSequenceRef.current,
      idleBeforeSubmitMs:
        lastInteractionAtRef.current != null
          ? Math.round(now - lastInteractionAtRef.current)
          : 0,
      answerChanges: answerChangesRef.current,
      wasSubmitted: selectedOption != null,
      timedOut,
    };
  };

  // Keep the reader pointing at the latest selection.
  useEffect(() => {
    if (telemetryRef) telemetryRef.current = readTelemetry;
  });

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
    onSelect(optionId);
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
    if (result != null) return isSelected ? result : "disabled";
    if (isSelected) return "selected";
    return disabled ? "disabled" : "default";
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
                "flex min-h-xxxl w-full items-center gap-md rounded-md px-lg py-sm text-left text-body transition duration-micro ease-out",
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
              {state === "selected" && (
                <Check className="h-lg w-lg shrink-0 text-primary" aria-hidden />
              )}
              {state === "correct" && (
                <span
                  aria-hidden
                  className="flex h-xl w-xl shrink-0 items-center justify-center rounded-pill bg-success text-surface"
                >
                  <Check className="h-lg w-lg" />
                </span>
              )}
              {state === "wrong" && (
                <span
                  aria-hidden
                  className="flex h-xl w-xl shrink-0 items-center justify-center rounded-pill bg-error text-surface"
                >
                  <X className="h-lg w-lg" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
