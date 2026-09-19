"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { MathText } from "@/components/ui/MathText";
import { cn, FOCUS_RING } from "@/design/utils";
import { tokens } from "@/design/tokens";

export interface InterventionPanelProps {
  explanation: string;
  workedExample: string;
  guidedQuestion: string;
  /** While saving or already checked. */
  disabled?: boolean;
  /** A check is in flight. */
  checking?: boolean;
  /** Outcome of the guided check; null while unanswered. */
  checkResult: "correct" | "wrong" | "ungraded" | null;
  /** Server-side hint, shown on a wrong answer. Never states the answer. */
  hint?: string | null;
  onSubmitGuided: (response: string) => void;
  className?: string;
}

const STAGGER_MS = tokens.motion.durations.standard;

export function InterventionPanel({
  explanation,
  workedExample,
  guidedQuestion,
  disabled,
  checking,
  checkResult,
  hint,
  onSubmitGuided,
  className,
}: InterventionPanelProps) {
  const [response, setResponse] = useState("");
  const answered = checkResult != null;
  const locked = disabled || checking || answered;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (locked || response.trim().length === 0) return;
    onSubmitGuided(response.trim());
  };

  return (
    <section
      aria-label="Guided intervention"
      className={cn("flex flex-col gap-lg", className)}
    >
      <div className="animate-fade-up">
        <MathText
          text={explanation}
          className="text-body leading-relaxed text-textPrimary"
        />
      </div>

      <div
        className="animate-fade-up rounded-md bg-surfaceMuted p-lg"
        style={{ animationDelay: `${STAGGER_MS}ms` }}
      >
        <MathText
          text={workedExample}
          className="text-small leading-relaxed text-textPrimary"
        />
      </div>

      <form
        onSubmit={handleSubmit}
        className="animate-fade-up flex flex-col gap-sm"
        style={{ animationDelay: `${STAGGER_MS * 2}ms` }}
      >
        <p className="text-body font-medium text-textPrimary">
          Before I show you anything, try this.
        </p>
        <MathText text={guidedQuestion} className="text-body text-textPrimary" />
        <label htmlFor="guided-response" className="text-micro text-textMuted">
          Your answer
        </label>
        <input
          id="guided-response"
          type="text"
          value={response}
          onChange={(event) => setResponse(event.target.value)}
          disabled={locked}
          className={cn(
            "min-h-xxxl rounded-md border border-border bg-surface px-lg text-body text-textPrimary",
            locked && "opacity-50",
            FOCUS_RING,
          )}
        />
        <Button
          type="submit"
          disabled={locked || response.trim().length === 0}
        >
          {checking ? "Checking…" : "Check my thinking"}
        </Button>
      </form>

      {checkResult != null && (
        <div
          className="animate-fade-up"
          style={{ animationDelay: `${STAGGER_MS * 3}ms` }}
          role="status"
          aria-live="polite"
        >
          {checkResult === "correct" && (
            <div className="flex items-center gap-md">
              <svg
                className="h-xl w-xl shrink-0 text-success"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
                <path
                  d="M4 12l5 5L20 6"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="animate-draw-check"
                  style={{ strokeDasharray: 24 }}
                />
              </svg>
              <p className="text-body font-medium text-textPrimary">
                That&apos;s the move. Now let&apos;s prove it holds.
              </p>
            </div>
          )}
          {checkResult === "wrong" && (
            <div className="flex flex-col gap-xs">
              <p className="text-body font-medium text-textPrimary">
                Close. Here&apos;s the exact spot where it slips.
              </p>
              {hint && (
                <p className="text-small leading-relaxed text-textMuted">
                  {hint}
                </p>
              )}
            </div>
          )}
          {checkResult === "ungraded" && (
            <p className="text-body font-medium text-textPrimary">
              Logged — we&apos;ll check this in practice.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
