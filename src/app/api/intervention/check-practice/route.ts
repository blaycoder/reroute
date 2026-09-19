import { NextResponse } from "next/server";
import { z } from "zod";
import { getQuestion } from "@/data/question-bank";
import { clientTelemetrySchema, recordAttempt } from "@/lib/attempts";
import { computeLearnerProfile } from "@/lib/compute-profile";
import { db } from "@/lib/db";
import { jsonError, parseBody } from "@/lib/http";
import type { StoredIntervention } from "@/lib/intervention-content";
import type { InterventionCheckPracticeResponse } from "@/types/api";

const bodySchema = z.object({
  interventionId: z.string().min(1),
  questionId: z.string().min(1),
  /** null only when the timer ran out with nothing selected. */
  selectedOption: z.string().min(1).nullable(),
  telemetry: clientTelemetrySchema,
});

// Grades one practice answer on the server and stores it as an attempt, so the
// learner profile moves with every answer the student gives. Safe to repeat: a
// question already answered returns its recorded result.
export async function POST(request: Request) {
  const body = await parseBody(request, bodySchema);
  if (!body.ok) {
    return jsonError("Invalid request body", 400, body.issues);
  }

  const intervention = await db.orm.Intervention.first({
    id: body.data.interventionId,
  });
  if (!intervention) return jsonError("Intervention not found", 404);

  const stored = JSON.parse(intervention.contentJson) as StoredIntervention;
  const question = getQuestion(body.data.questionId);
  if (!question || !stored.practiceQuestionIds.includes(question.id)) {
    return jsonError("Practice question not found", 404);
  }

  const existing = await db.orm.Attempt.where({
    interventionId: intervention.id,
    questionId: question.id,
    purpose: "practice",
  }).first();
  if (existing) {
    const payload: InterventionCheckPracticeResponse = {
      correct: existing.correct === 1,
    };
    return NextResponse.json(payload);
  }

  const result = await recordAttempt({
    sessionId: stored.sessionId,
    studentId: intervention.studentId,
    question,
    purpose: "practice",
    interventionId: intervention.id,
    selectedOption: body.data.selectedOption,
    telemetry: body.data.telemetry,
  });
  if (!result.ok) return jsonError(result.error, result.status);

  await computeLearnerProfile(stored.sessionId);

  const payload: InterventionCheckPracticeResponse = { correct: result.correct };
  return NextResponse.json(payload);
}
