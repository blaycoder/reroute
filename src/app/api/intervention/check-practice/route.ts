import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeAnswer } from "@/lib/answer-normalize";
import { db } from "@/lib/db";
import { jsonError, parseBody } from "@/lib/http";
import type { FallbackPracticeItem } from "@/data/fallback-interventions";

const bodySchema = z.object({
  interventionId: z.string().min(1),
  /** Zero-based index into the intervention's practice items. */
  index: z.number().int().min(0),
  selectedOption: z.string().min(1),
});

interface StoredContent {
  practiceItems: FallbackPracticeItem[];
}

// Grades one practice item against the server-side key. Returns only the
// verdict — explanations stay withheld until the reassessment reveal.
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
  const item = stored.practiceItems?.[body.data.index];
  if (!item) return jsonError("Practice item not found", 404);

  const correct =
    normalizeAnswer(body.data.selectedOption) ===
    normalizeAnswer(item.correctOption);

  return NextResponse.json({ correct });
}
