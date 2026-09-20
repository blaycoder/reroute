import { NextResponse } from "next/server";
import { z } from "zod";
import { getQuestion } from "@/data/question-bank";
import {
  REASSESSMENT_QUESTION_COUNT,
  getInterventionTemplate,
} from "@/data/interventions";
import { db, newId, nowIso } from "@/lib/db";
import { getLatestSessionId } from "@/lib/diagnostic-session";
import { jsonError, parseBody } from "@/lib/http";
import {
  toPracticeItem,
  type StoredIntervention,
} from "@/lib/intervention-content";
import { determineNextAction, type NextAction } from "@/lib/rules-engine";
import type { InterventionGenerateResponse } from "@/types/api";
import type { TopicProfile } from "@/types/learner-state";
import type { Question } from "@/types/question";

const bodySchema = z.object({
  studentId: z.string().min(1),
  topic: z.string().min(1),
});

function lookUp(ids: string[]): Question[] {
  return ids.flatMap((id) => {
    const question = getQuestion(id);
    return question ? [question] : [];
  });
}

// Picks the action from the student's own computed profile (deterministic —
// the AI's error type is already in there), then serves pre-written content:
// the concept's explanation and worked example, plus questions from the bank.
// Nothing is generated on the fly, so there is nothing for an LLM to get wrong.
export async function POST(request: Request) {
  const body = await parseBody(request, bodySchema);
  if (!body.ok) {
    return jsonError("Invalid request body", 400, body.issues);
  }

  const student = await db.orm.public.Student.first({ id: body.data.studentId });
  if (!student) return jsonError("Student not found", 404);

  const profileRow = await db.orm.public.LearnerProfile.where({
    studentId: student.id,
  }).first();
  if (!profileRow) {
    return jsonError("No learner profile yet — complete a diagnostic first", 404);
  }
  const topicProfile = (
    JSON.parse(profileRow.byTopicJson) as Record<string, TopicProfile>
  )[body.data.topic];
  if (!topicProfile) return jsonError("No profile for that topic", 404);

  const template = getInterventionTemplate(body.data.topic);
  if (!template) return jsonError("No lesson available for that topic", 400);

  const sessionId = await getLatestSessionId(student.id);
  if (!sessionId) return jsonError("No diagnostic session found", 404);

  // Reloading the lesson resumes the unfinished one instead of piling up rows.
  let intervention = await db.orm.public.Intervention.where({
    studentId: student.id,
    topic: body.data.topic,
  })
    .where((row) => row.completedAt.isNull())
    .orderBy((row) => row.startedAt.desc())
    .first();

  if (!intervention) {
    const stored: StoredIntervention = {
      sessionId,
      guidedQuestionId: template.guidedQuestionId,
      practiceQuestionIds: template.practiceQuestionIds,
      reassessmentQuestionIds: template.reassessmentQuestionIds.slice(
        0,
        REASSESSMENT_QUESTION_COUNT,
      ),
    };
    intervention = await db.orm.public.Intervention.create({
      id: newId(),
      studentId: student.id,
      topic: body.data.topic,
      actionType: determineNextAction(topicProfile),
      contentJson: JSON.stringify(stored),
      masteryBefore: topicProfile.accuracy,
      startedAt: nowIso(),
    });
  }

  const stored = JSON.parse(intervention.contentJson) as StoredIntervention;

  const payload: InterventionGenerateResponse = {
    interventionId: intervention.id,
    actionType: intervention.actionType as NextAction,
    conceptLabel: template.conceptLabel,
    content: {
      explanation: template.explanation,
      workedExample: template.workedExample,
      guidedQuestion: template.guidedQuestion,
      practice: lookUp(stored.practiceQuestionIds).map(toPracticeItem),
      reassessment: lookUp(stored.reassessmentQuestionIds).map(toPracticeItem),
    },
  };
  return NextResponse.json(payload);
}
