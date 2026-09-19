import { NextResponse } from "next/server";
import { z } from "zod";
import { getQuestion } from "@/data/question-bank";
import { clientTelemetrySchema, recordAttempt } from "@/lib/attempts";
import { computeLearnerProfile, pickPriorityTopic } from "@/lib/compute-profile";
import { db } from "@/lib/db";
import { jsonError, parseBody } from "@/lib/http";
import type { StoredIntervention } from "@/lib/intervention-content";
import type { InterventionVerifyResponse } from "@/types/api";
import type { TopicProfile } from "@/types/learner-state";

const bodySchema = z.object({
  interventionId: z.string().min(1),
  reassessment: z
    .array(
      z.object({
        questionId: z.string().min(1),
        /** null only when the timer ran out with nothing selected. */
        selectedOption: z.string().min(1).nullable(),
        telemetry: clientTelemetrySchema,
      }),
    )
    .min(1),
});

function nextPriorityTopic(
  byTopic: Record<string, TopicProfile>,
  finishedTopic: string,
): string | null {
  const remaining = Object.fromEntries(
    Object.entries(byTopic).filter(([topic]) => topic !== finishedTopic),
  );
  return pickPriorityTopic(remaining);
}

// Scores the reassessment on the server, records each answer as an attempt,
// then recomputes the learner profile. "Mastery" is the topic's accuracy across
// everything the student has answered, so mastery before and after are real
// numbers from real attempts — nothing here is scripted.
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

  for (const item of body.data.reassessment) {
    const question = getQuestion(item.questionId);
    if (!question || !stored.reassessmentQuestionIds.includes(question.id)) {
      return jsonError("Reassessment question not found", 404);
    }
    // Repeating a verify call must not double-count an answer.
    const existing = await db.orm.Attempt.where({
      interventionId: intervention.id,
      questionId: question.id,
      purpose: "reassessment",
    }).first();
    if (existing) continue;

    const result = await recordAttempt({
      sessionId: stored.sessionId,
      studentId: intervention.studentId,
      question,
      purpose: "reassessment",
      interventionId: intervention.id,
      selectedOption: item.selectedOption,
      telemetry: item.telemetry,
    });
    if (!result.ok) return jsonError(result.error, result.status);
  }

  const state = await computeLearnerProfile(stored.sessionId);
  const byTopic = state.learnerProfile.byTopic;

  const masteryBefore = intervention.masteryBefore;
  const masteryAfter =
    intervention.masteryAfter ??
    Math.round((byTopic[intervention.topic]?.accuracy ?? masteryBefore) * 1000) /
      1000;
  const improved = masteryAfter > masteryBefore;

  if (!intervention.completedAt) {
    await db.orm.Intervention.where({ id: intervention.id }).update({
      completedAt: new Date(),
      masteryAfter,
      improved: improved ? 1 : 0,
    });
  }

  const payload: InterventionVerifyResponse = {
    masteryBefore,
    masteryAfter,
    improved,
    nextPriorityTopic: nextPriorityTopic(byTopic, intervention.topic),
  };
  return NextResponse.json(payload);
}
