import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeAnswer } from "@/lib/answer-normalize";
import { prisma } from "@/lib/db";
import { jsonError, parseBody } from "@/lib/http";
import type { InterventionCheckGuidedResponse } from "@/types/api";

const bodySchema = z.object({
  interventionId: z.string().min(1),
  guidedResponse: z.string().min(1),
});

interface StoredContent {
  content: unknown;
  answerKey: { guided: string; practice: string[] } | null;
  source: string;
  guidedHint: string | null;
}

// Grades the guided question against the server-side answer key. Returns only
// the verdict and a hint — never the answer, and no mastery side effects
// (verify handles those after practice).
export async function POST(request: Request) {
  const body = await parseBody(request, bodySchema);
  if (!body.ok) {
    return jsonError("Invalid request body", 400, body.issues);
  }

  const intervention = await prisma.intervention.findUnique({
    where: { id: body.data.interventionId },
  });
  if (!intervention) return jsonError("Intervention not found", 404);

  const stored = JSON.parse(intervention.contentJson) as StoredContent;
  if (!stored.answerKey) {
    const ungraded: InterventionCheckGuidedResponse = {
      graded: false,
      correct: false,
      hint: null,
    };
    return NextResponse.json(ungraded);
  }

  const correct =
    normalizeAnswer(body.data.guidedResponse) ===
    normalizeAnswer(stored.answerKey.guided);

  const payload: InterventionCheckGuidedResponse = {
    graded: true,
    correct,
    hint: stored.guidedHint,
  };
  return NextResponse.json(payload);
}
