import { NextResponse } from "next/server";
import { z } from "zod";
import { computeLearnerProfile, pickPriorityTopic } from "@/lib/compute-profile";
import { db } from "@/lib/db";
import { jsonError, parseBody } from "@/lib/http";
import { diagnoseWrongAnswers } from "@/lib/session-diagnosis";
import type { DiagnosticCompleteResponse } from "@/types/api";

const bodySchema = z.object({
  diagnosticId: z.string().min(1),
});

// Closes the session: the AI reads each wrong answer against the student's
// telemetry, then the learner profile is computed from their real attempts.
// Recomputation is idempotent, so completing twice is safe.
export async function POST(request: Request) {
  const body = await parseBody(request, bodySchema);
  if (!body.ok) {
    return jsonError("Invalid request body", 400, body.issues);
  }

  const session = await db.orm.DiagnosticSession.first({
    id: body.data.diagnosticId,
  });
  if (!session) return jsonError("Diagnostic session not found", 404);

  const { attemptCount } = await db.orm.Attempt.where({
    diagnosticId: session.id,
    purpose: "diagnostic",
  }).aggregate((aggregate) => ({ attemptCount: aggregate.count() }));
  if (attemptCount === 0) {
    return jsonError("No attempts recorded for this diagnostic", 404);
  }

  await diagnoseWrongAnswers(session.id);

  if (!session.completedAt) {
    const completedAt = new Date();
    await db.orm.DiagnosticSession.where({ id: session.id }).update({
      completedAt,
      completedInSeconds: Math.max(
        0,
        Math.round((completedAt.getTime() - session.startedAt.getTime()) / 1000),
      ),
    });
  }

  const state = await computeLearnerProfile(session.id);

  const payload: DiagnosticCompleteResponse = {
    learnerProfile: state.learnerProfile,
    readinessIndex: state.learnerProfile.readinessIndex,
    priorityTopic: pickPriorityTopic(state.learnerProfile.byTopic) ?? "",
  };
  return NextResponse.json(payload);
}
