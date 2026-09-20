import { NextResponse } from "next/server";
import { z } from "zod";
import { getQuestion } from "@/data/question-bank";
import { clientTelemetrySchema, recordAttempt } from "@/lib/attempts";
import { db } from "@/lib/db";
import { pickNextQuestion } from "@/lib/diagnostic-router";
import {
  diagnosticPool,
  loadAnsweredQuestions,
  loadProgress,
} from "@/lib/diagnostic-session";
import { jsonError, parseBody } from "@/lib/http";
import type { DiagnosticAnswerResponse } from "@/types/api";

const bodySchema = z.object({
  diagnosticId: z.string().min(1),
  questionId: z.string().min(1),
  /** null only when the timer ran out with nothing selected. */
  selectedOption: z.string().min(1).nullable(),
  telemetry: clientTelemetrySchema,
});

// Records one attempt, then routes the next question from the student's real
// answers. Safe to repeat: a question that was already answered returns the
// current progress instead of writing a duplicate.
export async function POST(request: Request) {
  const body = await parseBody(request, bodySchema);
  if (!body.ok) {
    return jsonError("Invalid request body", 400, body.issues);
  }

  const session = await db.orm.public.DiagnosticSession.first({
    id: body.data.diagnosticId,
  });
  if (!session) return jsonError("Diagnostic session not found", 404);
  if (session.completedAt) {
    return jsonError("Diagnostic session already completed", 400);
  }

  const question = getQuestion(body.data.questionId);
  if (!question || question.purpose !== "diagnostic") {
    return jsonError("Question not found", 404);
  }

  const answered = await loadAnsweredQuestions(session.id);

  if (!answered.some((a) => a.questionId === question.id)) {
    // Only the question the router is currently asking may be answered, so a
    // stale tab or a replayed request cannot skip or reorder the diagnostic.
    const expected = pickNextQuestion(diagnosticPool, answered);
    if (!expected || expected.id !== question.id) {
      return jsonError("That is not the current question", 409);
    }

    const result = await recordAttempt({
      sessionId: session.id,
      studentId: session.studentId,
      question,
      purpose: "diagnostic",
      selectedOption: body.data.selectedOption,
      telemetry: body.data.telemetry,
    });
    if (!result.ok) return jsonError(result.error, result.status);
  }

  const progress = await loadProgress(session.id);
  if (!progress) return jsonError("Diagnostic session not found", 404);

  const payload: DiagnosticAnswerResponse = { recorded: true, progress };
  return NextResponse.json(payload);
}
