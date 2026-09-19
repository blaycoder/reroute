import { NextResponse } from "next/server";
import { z } from "zod";
import { getQuestion } from "@/data/question-bank";
import { normalizeAnswer } from "@/lib/answer-normalize";
import { db } from "@/lib/db";
import { jsonError, parseBody } from "@/lib/http";
import type { StoredIntervention } from "@/lib/intervention-content";
import type { InterventionCheckGuidedResponse } from "@/types/api";

const bodySchema = z.object({
  interventionId: z.string().min(1),
  guidedResponse: z.string().min(1),
});

// Grades the typed guided answer against the bank's correct option. A wrong
// answer that matches a known distractor gets a hint naming that exact slip —
// never the answer itself.
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
  const question = getQuestion(stored.guidedQuestionId);
  if (!question) return jsonError("Guided question not found", 404);

  const response = normalizeAnswer(body.data.guidedResponse);
  const correct =
    response === normalizeAnswer(question.options[question.correctOption]);

  const matchedDistractor = correct
    ? undefined
    : question.distractors.find(
        (d) => normalizeAnswer(question.options[d.option]) === response,
      );

  const payload: InterventionCheckGuidedResponse = {
    graded: true,
    correct,
    hint: matchedDistractor?.explanation ?? null,
  };
  return NextResponse.json(payload);
}
