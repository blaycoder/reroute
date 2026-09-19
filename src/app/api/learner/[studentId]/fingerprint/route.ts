import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import type {
  FingerprintResponse,
  LearnerProfileSummary,
} from "@/types/api";
import type { InterventionRecord, TopicProfile } from "@/types/learner-state";

// Returns the learner's most recent misconception fingerprint.
export async function GET(
  _request: Request,
  { params }: { params: { studentId: string } },
) {
  const row = await prisma.learnerProfile.findUnique({
    where: { studentId: params.studentId },
  });
  if (!row) {
    return jsonError(
      "No learner profile yet — complete a diagnostic first",
      404,
    );
  }

  const overall = JSON.parse(row.overallJson) as LearnerProfileSummary["overall"];
  const byTopic = JSON.parse(row.byTopicJson) as Record<string, TopicProfile>;
  const priorityTopic =
    Object.entries(byTopic).sort(
      (a, b) => b[1].priorityScore - a[1].priorityScore,
    )[0]?.[0] ?? null;

  const interventions = await prisma.intervention.findMany({
    // Only finished sessions: generate creates a row up front, so abandoned or
    // reloaded sessions would otherwise appear as bogus "Not yet 0% → 0%" entries.
    where: { studentId: params.studentId, completedAt: { not: null } },
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

  const payload: FingerprintResponse = {
    overall,
    byTopic,
    readinessIndex: row.readinessIndex,
    profileConfidence: row.profileConfidence,
    priorityTopic,
    interventionHistory,
  };
  return NextResponse.json(payload);
}
