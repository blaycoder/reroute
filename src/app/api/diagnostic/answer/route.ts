import { NextResponse } from "next/server";
import { z } from "zod";
import { db, newId } from "@/lib/db";
import { jsonError, parseBody } from "@/lib/http";
import { buildLearnerProfile } from "@/lib/profile-builder";
import { inferConfidence, inferMasterySignal } from "@/lib/telemetry";
import type { DiagnosticAnswerResponse } from "@/types/api";

const telemetrySchema = z.object({
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
});

const bodySchema = z.object({
  diagnosticId: z.string().min(1),
  questionId: z.string().min(1),
  selectedOption: z.string().min(1),
  responseTimeSeconds: z.number().positive(),
  telemetry: telemetrySchema,
});

// Records one attempt, infers confidence/mastery signal server-side from the
// raw telemetry, then rebuilds the learner profile from all attempts.
export async function POST(request: Request) {
  const body = await parseBody(request, bodySchema);
  if (!body.ok) {
    return jsonError("Invalid request body", 400, body.issues);
  }

  const session = await db.orm.DiagnosticSession.first({
    id: body.data.diagnosticId,
  });
  if (!session) return jsonError("Diagnostic session not found", 404);
  if (session.completedAt) {
    return jsonError("Diagnostic session already completed", 400);
  }

  const question = await db.orm.Question.first({ id: body.data.questionId });
  if (!question) return jsonError("Question not found", 404);

  const options = JSON.parse(question.optionsJson) as Record<string, string>;
  if (!(body.data.selectedOption in options)) {
    return jsonError(
      `selectedOption must be one of: ${Object.keys(options).join(", ")}`,
      400,
    );
  }

  const correct = body.data.selectedOption === question.correctOption;
  const inferredConfidence = inferConfidence({
    timeToFirstClickMs: body.data.telemetry.timeToFirstClickMs,
    totalDwellTimeMs: body.data.telemetry.totalDwellTimeMs,
    optionSwitchCount: body.data.telemetry.optionSwitchCount,
    estimatedTimeSeconds: question.estimatedTimeSeconds,
  });
  const inferredMasterySignal = inferMasterySignal(
    correct,
    inferredConfidence,
  );

  await db.orm.Attempt.create({
    id: newId(),
    studentId: session.studentId,
    questionId: question.id,
    diagnosticId: session.id,
    selectedOption: body.data.selectedOption,
    correct: correct ? 1 : 0,
    responseTimeSeconds: Math.round(body.data.responseTimeSeconds),
    inferredConfidence,
    inferredMasterySignal,
    telemetryJson: JSON.stringify(body.data.telemetry),
  });

  await buildLearnerProfile(session.studentId);

  const payload: DiagnosticAnswerResponse = { recorded: true, correct };
  return NextResponse.json(payload);
}
