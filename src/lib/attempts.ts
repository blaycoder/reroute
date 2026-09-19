import { z } from "zod";
import { db, newId } from "@/lib/db";
import {
  inferConfidence,
  inferMasterySignal,
  inferTimePressure,
} from "@/lib/telemetry";
import type { ClientTelemetry } from "@/types/api";
import type { AttemptTelemetry, Confidence } from "@/types/learner-state";
import type { Question } from "@/types/question";

// One path for recording an answer, whatever the screen: the server grades it,
// derives confidence and time pressure from the raw telemetry, and stores the
// attempt. The client only ever supplies an option letter and how it behaved.

export const clientTelemetrySchema = z.object({
  timeToFirstClickMs: z.number().min(0),
  totalDwellTimeMs: z.number().min(0),
  optionSwitchCount: z.number().int().min(0),
  hoverSequence: z.array(z.string()),
  idleBeforeSubmitMs: z.number().min(0),
  answerChanges: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      timestampMs: z.number(),
    }),
  ),
  wasSubmitted: z.boolean(),
  timeOnQuestionMs: z.number().min(0),
  timedOut: z.boolean(),
});

export type AttemptPurpose = "diagnostic" | "practice" | "reassessment";

export interface RecordAttemptInput {
  sessionId: string;
  studentId: string;
  question: Question;
  purpose: AttemptPurpose;
  interventionId?: string;
  /** null only when the timer ran out with nothing selected. */
  selectedOption: string | null;
  telemetry: ClientTelemetry;
}

export type RecordAttemptResult =
  | { ok: true; correct: boolean }
  | { ok: false; status: number; error: string };

export async function recordAttempt(
  input: RecordAttemptInput,
): Promise<RecordAttemptResult> {
  const { question, selectedOption, telemetry } = input;

  if (selectedOption === null) {
    if (!telemetry.timedOut) {
      return {
        ok: false,
        status: 400,
        error: "An answer is required unless time ran out",
      };
    }
  } else if (!(selectedOption in question.options)) {
    return {
      ok: false,
      status: 400,
      error: `selectedOption must be one of: ${Object.keys(question.options).join(", ")}`,
    };
  }

  const correct =
    selectedOption !== null && selectedOption === question.correctOption;

  // Nothing chosen means nothing to be confident about.
  const inferredConfidence: Confidence =
    selectedOption === null
      ? "low"
      : inferConfidence({
          timeToFirstClickMs: telemetry.timeToFirstClickMs,
          totalDwellTimeMs: telemetry.totalDwellTimeMs,
          optionSwitchCount: telemetry.optionSwitchCount,
          estimatedTimeSeconds: question.estimatedTimeSeconds,
        });

  const storedTelemetry: AttemptTelemetry = {
    ...telemetry,
    wasSubmitted: selectedOption !== null,
    timePressureSignal: inferTimePressure({
      timeOnQuestionMs: telemetry.timeOnQuestionMs,
      estimatedTimeSeconds: question.estimatedTimeSeconds,
    }),
  };

  await db.orm.Attempt.create({
    id: newId(),
    studentId: input.studentId,
    diagnosticId: input.sessionId,
    questionId: question.id,
    purpose: input.purpose,
    ...(input.interventionId ? { interventionId: input.interventionId } : {}),
    ...(selectedOption !== null ? { selectedOption } : {}),
    correct: correct ? 1 : 0,
    // Clamped to 1s: a sub-second answer is still an answer, not "0 seconds".
    responseTimeSeconds: Math.max(1, Math.round(telemetry.timeOnQuestionMs / 1000)),
    inferredConfidence,
    inferredMasterySignal: inferMasterySignal(correct, inferredConfidence),
    telemetryJson: JSON.stringify(storedTelemetry),
  });

  return { ok: true, correct };
}
