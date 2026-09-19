import { NextResponse } from "next/server";
import { z } from "zod";
import { db, newId } from "@/lib/db";
import { jsonError, parseBody } from "@/lib/http";
import type {
  DiagnosticStartResponse,
  DiagnosticQuestionPreview,
} from "@/types/api";

const bodySchema = z.object({
  studentId: z.string().min(1).optional(),
  targetScore: z.number().int().min(0).max(400),
  subject: z.string().min(1),
});

// Creates (or reuses) a student, opens a diagnostic session, and returns the
// sanitized question set. The answer key never leaves the server: only id,
// questionText and options are selected.
export async function POST(request: Request) {
  const body = await parseBody(request, bodySchema);
  if (!body.ok) {
    return jsonError("Invalid request body", 400, body.issues);
  }

  let studentId: string;
  if (body.data.studentId) {
    const existing = await db.orm.Student.first({ id: body.data.studentId });
    if (!existing) return jsonError("Student not found", 404);
    const subjects = JSON.parse(existing.subjects) as string[];
    const updated = await db.orm.Student.where({ id: existing.id }).update({
      targetScore: body.data.targetScore,
      subjects: JSON.stringify(
        Array.from(new Set([...subjects, body.data.subject])),
      ),
    });
    // update() returns null if the row vanished between the read and the write.
    if (!updated) return jsonError("Student not found", 404);
    studentId = updated.id;
  } else {
    const created = await db.orm.Student.create({
      id: newId(),
      targetScore: body.data.targetScore,
      subjects: JSON.stringify([body.data.subject]),
    });
    studentId = created.id;
  }

  const questions = await db.orm.Question.where({ subject: body.data.subject })
    .orderBy((question) => question.id.asc())
    .all();
  if (questions.length === 0) {
    return jsonError(
      `No questions available for subject "${body.data.subject}"`,
      400,
    );
  }

  const session = await db.orm.DiagnosticSession.create({
    id: newId(),
    studentId,
    subject: body.data.subject,
  });

  const payload: DiagnosticStartResponse = {
    studentId,
    diagnosticId: session.id,
    questions: questions.map<DiagnosticQuestionPreview>((q) => ({
      id: q.id,
      topic: q.topic,
      difficulty: q.difficulty as DiagnosticQuestionPreview["difficulty"],
      questionText: q.questionText,
      options: JSON.parse(q.optionsJson) as Record<string, string>,
    })),
  };
  return NextResponse.json(payload);
}
