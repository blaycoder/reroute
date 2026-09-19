import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, parseBody } from "@/lib/http";
import { buildLearnerProfile } from "@/lib/profile-builder";
import type { InterventionRecord } from "@/types/learner-state";
import type { DiagnosticCompleteResponse } from "@/types/api";

const bodySchema = z.object({
  diagnosticId: z.string().min(1),
});

// Closes the session and returns the full learner profile with the
// prioritized topic. Recomputation is idempotent, so completing twice is safe.
export async function POST(request: Request) {
  const body = await parseBody(request, bodySchema);
  if (!body.ok) {
    return jsonError("Invalid request body", 400, body.issues);
  }

  const session = await prisma.diagnosticSession.findUnique({
    where: { id: body.data.diagnosticId },
  });
  if (!session) return jsonError("Diagnostic session not found", 404);

  const attemptCount = await prisma.attempt.count({
    where: { diagnosticId: session.id },
  });
  if (attemptCount === 0) {
    return jsonError("No attempts recorded for this diagnostic", 404);
  }

  const snapshot = await buildLearnerProfile(session.studentId);

  if (!session.completedAt) {
    await prisma.diagnosticSession.update({
      where: { id: session.id },
      data: { completedAt: new Date() },
    });
  }

  const priorityTopic = Object.entries(snapshot.byTopic).sort(
    (a, b) => b[1].priorityScore - a[1].priorityScore,
  )[0]?.[0];

  const interventions = await prisma.intervention.findMany({
    // Only finished sessions: generate creates a row up front, so abandoned or
    // reloaded sessions would otherwise appear as bogus "Not yet 0% → 0%" entries.
    where: { studentId: session.studentId, completedAt: { not: null } },
    orderBy: { startedAt: "desc" },
  });
  const interventionHistory: InterventionRecord[] = interventions.map((i) => ({
    topic: i.topic,
    action: i.actionType,
    startedAt: i.startedAt.toISOString(),
    completedAt: i.completedAt?.toISOString() ?? "",
    masteryBefore: i.masteryBefore,
    masteryAfter: i.masteryAfter ?? 0,
    improved: i.improved ?? false,
  }));

  const payload: DiagnosticCompleteResponse = {
    learnerProfile: {
      overall: snapshot.overall,
      byTopic: snapshot.byTopic,
      readinessIndex: snapshot.readinessIndex,
      profileConfidence: snapshot.profileConfidence,
      interventionHistory,
    },
    readinessIndex: snapshot.readinessIndex,
    priorityTopic: priorityTopic ?? "",
  };
  return NextResponse.json(payload);
}
