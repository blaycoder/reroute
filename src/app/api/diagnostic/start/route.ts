import { NextResponse } from "next/server";
import { z } from "zod";
import { db, newId } from "@/lib/db";
import { diagnosticPool, loadProgress } from "@/lib/diagnostic-session";
import { jsonError, parseBody } from "@/lib/http";
import type { DiagnosticStartResponse } from "@/types/api";

const bodySchema = z.object({
  studentId: z.string().min(1).optional(),
  targetScore: z.number().int().min(0).max(400),
  subject: z.string().min(1),
});

// Creates the student (or reuses one) and a new diagnostic session, then
// returns the FIRST question only. Later questions are routed one at a time by
// /answer, so nothing about the rest of the diagnostic reaches the browser.
export async function POST(request: Request) {
  const body = await parseBody(request, bodySchema);
  if (!body.ok) {
    return jsonError("Invalid request body", 400, body.issues);
  }

  if (!diagnosticPool.some((question) => question.subject === body.data.subject)) {
    return jsonError(
      `No questions available for subject "${body.data.subject}"`,
      400,
    );
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

  const session = await db.orm.DiagnosticSession.create({
    id: newId(),
    studentId,
    subject: body.data.subject,
  });

  const progress = await loadProgress(session.id);
  if (!progress) return jsonError("Could not start the diagnostic", 500);

  const payload: DiagnosticStartResponse = progress;
  return NextResponse.json(payload);
}
