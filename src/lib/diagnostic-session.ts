import { getQuestion, getQuestionsByPurpose } from "@/data/question-bank";
import { db } from "@/lib/db";
import {
  DIAGNOSTIC_LENGTH,
  paceOf,
  pickNextQuestion,
  type AnsweredQuestion,
} from "@/lib/diagnostic-router";
import type {
  DiagnosticProgress,
  DiagnosticQuestionPreview,
} from "@/types/api";
import type { AttemptTelemetry } from "@/types/learner-state";
import type { Question } from "@/types/question";

// Reads a diagnostic session back from its attempts. The database is the only
// state: resuming after a refresh, loading a finished session, and routing the
// next question all derive from the same rows.

export const diagnosticPool = getQuestionsByPurpose("diagnostic");

/** Strips the answer key and distractor metadata before a question leaves the server. */
export function toQuestionPreview(question: Question): DiagnosticQuestionPreview {
  return {
    id: question.id,
    topic: question.topic,
    subtopic: question.subtopic,
    difficulty: question.difficulty,
    estimatedTimeSeconds: question.estimatedTimeSeconds,
    questionText: question.questionText,
    options: question.options,
  };
}

export async function loadAnsweredQuestions(
  sessionId: string,
): Promise<AnsweredQuestion[]> {
  const rows = await db.orm.Attempt.where({
    diagnosticId: sessionId,
    purpose: "diagnostic",
  })
    .orderBy((attempt) => attempt.createdAt.asc())
    .all();

  const answered: AnsweredQuestion[] = [];
  for (const row of rows) {
    const question = getQuestion(row.questionId);
    if (!question) continue;
    const telemetry = JSON.parse(row.telemetryJson) as AttemptTelemetry;
    answered.push({
      questionId: row.questionId,
      correct: row.correct === 1,
      pace: paceOf({
        timeOnQuestionMs: telemetry.timeOnQuestionMs,
        estimatedTimeSeconds: question.estimatedTimeSeconds,
        timedOut: telemetry.timedOut,
      }),
    });
  }
  return answered;
}

/** The student's most recent diagnostic session; interventions count toward it. */
export async function getLatestSessionId(
  studentId: string,
): Promise<string | null> {
  const session = await db.orm.DiagnosticSession.where({ studentId })
    .orderBy((s) => s.startedAt.desc())
    .first();
  return session?.id ?? null;
}

export async function loadProgress(
  sessionId: string,
): Promise<DiagnosticProgress | null> {
  const session = await db.orm.DiagnosticSession.first({ id: sessionId });
  if (!session) return null;

  const answered = await loadAnsweredQuestions(sessionId);
  const completed = session.completedAt != null;
  const next = completed ? null : pickNextQuestion(diagnosticPool, answered);

  return {
    studentId: session.studentId,
    diagnosticId: session.id,
    total: DIAGNOSTIC_LENGTH,
    answered: answered.length,
    completed,
    question: next ? toQuestionPreview(next) : null,
  };
}
