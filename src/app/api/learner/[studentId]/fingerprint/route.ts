import { NextResponse } from "next/server";
import { pickPriorityTopic } from "@/lib/compute-profile";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
import type { FingerprintResponse } from "@/types/api";
import type {
  HeadlineDiagnosis,
  InterventionRecord,
  LearnerState,
  TopicProfile,
} from "@/types/learner-state";

// Returns the learner's fingerprint, read from the profile computed out of
// their own attempts (see computeLearnerProfile). Nothing here is seeded.
export async function GET(
  _request: Request,
  { params }: { params: { studentId: string } },
) {
  const row = await db.orm.LearnerProfile.where({
    studentId: params.studentId,
  }).first();
  if (!row) {
    return jsonError(
      "No learner profile yet — complete a diagnostic first",
      404,
    );
  }

  const byTopic = JSON.parse(row.byTopicJson) as Record<string, TopicProfile>;

  // Only finished sessions: generate creates a row up front, so abandoned or
  // reloaded sessions would otherwise appear as bogus "Not yet 0% → 0%" entries.
  const interventions = await db.orm.Intervention.where({
    studentId: params.studentId,
  })
    .where((intervention) => intervention.completedAt.isNotNull())
    .orderBy((intervention) => intervention.startedAt.desc())
    .all();
  const interventionHistory: InterventionRecord[] = interventions.map((i) => ({
    topic: i.topic,
    action: i.actionType,
    startedAt: i.startedAt.toISOString(),
    completedAt: i.completedAt?.toISOString() ?? "",
    masteryBefore: i.masteryBefore,
    masteryAfter: i.masteryAfter ?? 0,
    improved: i.improved === 1,
  }));

  const payload: FingerprintResponse = {
    overall: JSON.parse(row.overallJson) as LearnerState["learnerProfile"]["overall"],
    byTopic,
    readinessIndex: row.readinessIndex,
    profileConfidence: row.profileConfidence,
    priorityTopic: pickPriorityTopic(byTopic),
    interventionHistory,
    headlineDiagnosis: row.headlineDiagnosisJson
      ? (JSON.parse(row.headlineDiagnosisJson) as HeadlineDiagnosis)
      : null,
  };
  return NextResponse.json(payload);
}
