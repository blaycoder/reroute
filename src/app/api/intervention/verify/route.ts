import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeAnswer } from "@/lib/answer-normalize";
import { db } from "@/lib/db";
import { getTopicImpactWeight } from "@/lib/mastery";
import { jsonError, parseBody } from "@/lib/http";
import type { InterventionContent } from "@/types/api";
import type { TopicProfile } from "@/types/learner-state";

const bodySchema = z.object({
  interventionId: z.string().min(1),
  answers: z.object({
    guidedResponse: z.string().min(1),
    practiceResponses: z.array(z.string()),
    reassessmentResponses: z.array(z.string()).optional(),
  }),
  /** Captured client-side; stored-payload-ready, unused for scoring yet. */
  telemetry: z.array(z.unknown()).optional(),
});

const MASTERY_STEP = 0.2; // max mastery gain per verified intervention

interface StoredContent {
  content: InterventionContent;
  answerKey: {
    guided: string;
    practice: string[];
    reassessment: string[];
  } | null;
  source: string;
}

// Scores the intervention's check answers against the server-side answer key
// and updates the intervention record. LLM-graded free-form verification
// slots in here when the Socratic template lands.
export async function POST(request: Request) {
  const body = await parseBody(request, bodySchema);
  if (!body.ok) {
    return jsonError("Invalid request body", 400, body.issues);
  }

  const intervention = await db.orm.Intervention.first({
    id: body.data.interventionId,
  });
  if (!intervention) return jsonError("Intervention not found", 404);

  const stored = JSON.parse(intervention.contentJson) as StoredContent;
  const masteryBefore = intervention.masteryBefore;

  let masteryAfter = masteryBefore;
  if (stored.answerKey) {
    const key = stored.answerKey;
    const reassessmentKey = key.reassessment ?? [];
    const reassessmentResponses = body.data.answers.reassessmentResponses;
    const countReassessment = Boolean(
      reassessmentKey.length > 0 && reassessmentResponses,
    );

    const total =
      1 +
      key.practice.length +
      (countReassessment ? reassessmentKey.length : 0);
    let correct = 0;
    if (
      normalizeAnswer(body.data.answers.guidedResponse) ===
      normalizeAnswer(key.guided)
    ) {
      correct += 1;
    }
    key.practice.forEach((expected, index) => {
      const actual = body.data.answers.practiceResponses[index];
      if (actual && normalizeAnswer(actual) === normalizeAnswer(expected)) {
        correct += 1;
      }
    });
    if (countReassessment) {
      reassessmentKey.forEach((expected, index) => {
        const actual = reassessmentResponses?.[index];
        if (actual && normalizeAnswer(actual) === normalizeAnswer(expected)) {
          correct += 1;
        }
      });
    }
    const gain = MASTERY_STEP * (correct / total);
    masteryAfter = Math.round(Math.min(1, masteryBefore + gain) * 1000) / 1000;
  }
  const improved = masteryAfter > masteryBefore;

  await db.orm.Intervention.where({ id: intervention.id }).update({
    completedAt: new Date(),
    masteryAfter,
    improved: improved ? 1 : 0,
  });

  // Next priority: recompute scores with the improved topic, excluding it.
  const profileRow = await db.orm.LearnerProfile.where({
    studentId: intervention.studentId,
  }).first();
  let nextPriorityTopic: string | null = null;
  if (profileRow) {
    const byTopic = JSON.parse(profileRow.byTopicJson) as Record<
      string,
      TopicProfile
    >;
    if (byTopic[intervention.topic]) {
      byTopic[intervention.topic].accuracy = masteryAfter;
    }
    nextPriorityTopic =
      Object.entries(byTopic)
        .filter(([topic]) => topic !== intervention.topic)
        .sort(
          (a, b) =>
            (1 - b[1].accuracy) * getTopicImpactWeight(b[0]) -
            (1 - a[1].accuracy) * getTopicImpactWeight(a[0]),
        )[0]?.[0] ?? null;
  }

  const payload = {
    masteryBefore,
    masteryAfter,
    improved,
    nextPriorityTopic,
  };
  return NextResponse.json(payload);
}
