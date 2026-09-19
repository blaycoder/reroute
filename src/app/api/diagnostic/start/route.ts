import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
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
    const existing = await prisma.student.findUnique({
      where: { id: body.data.studentId },
    });
    if (!existing) return jsonError("Student not found", 404);
    const subjects = JSON.parse(existing.subjects) as string[];
    const updated = await prisma.student.update({
      where: { id: existing.id },
      data: {
        targetScore: body.data.targetScore,
        subjects: JSON.stringify(
          Array.from(new Set([...subjects, body.data.subject])),
        ),
      },
    });
    studentId = updated.id;
  } else {
    const created = await prisma.student.create({
      data: {
        targetScore: body.data.targetScore,
        subjects: JSON.stringify([body.data.subject]),
      },
    });
    studentId = created.id;
  }

  const questions = await prisma.question.findMany({
    where: { subject: body.data.subject },
    orderBy: { id: "asc" },
  });
  if (questions.length === 0) {
    return jsonError(
      `No questions available for subject "${body.data.subject}"`,
      400,
    );
  }

  const session = await prisma.diagnosticSession.create({
    data: { studentId, subject: body.data.subject },
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
