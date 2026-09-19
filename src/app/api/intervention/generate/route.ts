import { NextResponse } from "next/server";
import { z } from "zod";
import { db, newId } from "@/lib/db";
import {
  getFallbackIntervention,
  type FallbackPracticeItem,
} from "@/data/fallback-interventions";
import { jsonError, parseBody } from "@/lib/http";
import { generateText } from "@/lib/llm";
import { determineNextAction } from "@/lib/rules-engine";
import type {
  InterventionContent,
  InterventionGenerateResponse,
  PracticeItem,
} from "@/types/api";
import type { TopicProfile } from "@/types/learner-state";

const bodySchema = z.object({
  studentId: z.string().min(1),
  topic: z.string().min(1),
  errorType: z.enum(["conceptual", "procedural", "application", "careless"]),
  confidence: z.enum(["high", "medium", "low"]),
});

const llmItemSchema = z.object({
  questionText: z.string().min(1),
  options: z.record(z.string(), z.string().min(1)),
  correctOption: z.string().min(1),
});

const contentSchema = z.object({
  explanation: z.string().min(1),
  workedExample: z.string().min(1),
  guidedQuestion: z.string().min(1),
  /** Server-side only: grades the guided question, never shown to the student. */
  guidedAnswer: z.string().min(1),
  practice: z.array(llmItemSchema).min(1),
  reassessment: z.array(llmItemSchema).min(1),
});

const SYSTEM_PROMPT = [
  "You are Reroot's mathematics tutor for JAMB (Nigerian) students.",
  "Teach to ONE specific misconception. Return STRICT JSON only — no markdown fences — matching exactly:",
  '{"explanation": string, "workedExample": string, "guidedQuestion": string, "guidedAnswer": string, "practice": [{"questionText": string, "options": {"A": string, "B": string, "C": string, "D": string}, "correctOption": "A"}], "reassessment": [same shape]}',
  "practice must have exactly 3 items; reassessment exactly 2 items testing the same skill with new numbers.",
  "guidedAnswer is the expected answer to guidedQuestion — used server-side only, never shown to the student.",
  "Use $...$ inline LaTeX for all mathematics.",
  "explanation: teaches the corrected understanding of the misconception.",
  "workedExample: one fully worked similar problem, step by step.",
  "guidedQuestion: ONE short question the learner answers with a brief expression.",
].join("\n");

const stripItem = ({
  questionText,
  options,
}: FallbackPracticeItem | z.infer<typeof llmItemSchema>): PracticeItem => ({
  questionText,
  options,
});

const itemsAreValid = (
  items: z.infer<typeof llmItemSchema>[],
): boolean =>
  items.every((item) => Boolean(item.options[item.correctOption]));

// Picks the action via the deterministic rules engine, then sources content:
// LLM first, pre-written fallback as the guaranteed floor.
export async function POST(request: Request) {
  const body = await parseBody(request, bodySchema);
  if (!body.ok) {
    return jsonError("Invalid request body", 400, body.issues);
  }

  const student = await db.orm.Student.first({ id: body.data.studentId });
  if (!student) return jsonError("Student not found", 404);

  const profileRow = await db.orm.LearnerProfile.where({
    studentId: body.data.studentId,
  }).first();
  const stored = (
    profileRow
      ? (JSON.parse(profileRow.byTopicJson) as Record<string, TopicProfile>)
      : {}
  )[body.data.topic];

  // Request values are fresher than the stored profile — override.
  const effective: TopicProfile = {
    accuracy: stored?.accuracy ?? 0,
    avgSpeedSeconds: stored?.avgSpeedSeconds ?? 0,
    confidence: body.data.confidence,
    errorType: body.data.errorType,
    priorityScore: stored?.priorityScore ?? 0,
    profileConfidence: stored?.profileConfidence ?? 0,
  };
  const actionType = determineNextAction(effective);
  const masteryBefore = stored?.accuracy ?? 0;

  const fallback = getFallbackIntervention(body.data.topic);

  let content: InterventionContent | null = null;
  let source: "llm" | "fallback" = "fallback";
  let answerKey: {
    guided: string;
    practice: string[];
    reassessment: string[];
  } | null = fallback.answerKey;
  let practiceItems: FallbackPracticeItem[] = fallback.practice;
  let reassessmentItems: FallbackPracticeItem[] = fallback.reassessment;

  const llm = await generateText({
    system: SYSTEM_PROMPT,
    user: JSON.stringify({
      topic: body.data.topic,
      errorType: body.data.errorType,
      confidence: body.data.confidence,
      nextAction: actionType,
    }),
  });
  if (llm) {
    const jsonMatch = llm.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = contentSchema.safeParse(JSON.parse(jsonMatch[0]));
        if (
          parsed.success &&
          itemsAreValid(parsed.data.practice) &&
          itemsAreValid(parsed.data.reassessment)
        ) {
          content = {
            explanation: parsed.data.explanation,
            workedExample: parsed.data.workedExample,
            guidedQuestion: parsed.data.guidedQuestion,
            practice: parsed.data.practice.map(stripItem),
            reassessment: parsed.data.reassessment.map(stripItem),
          };
          answerKey = {
            guided: parsed.data.guidedAnswer,
            practice: parsed.data.practice.map((i) => i.correctOption),
            reassessment: parsed.data.reassessment.map((i) => i.correctOption),
          };
          practiceItems = parsed.data.practice;
          reassessmentItems = parsed.data.reassessment;
          source = "llm";
        }
      } catch {
        // fall through to fallback
      }
    }
  }
  if (!content) {
    content = {
      explanation: fallback.explanation,
      workedExample: fallback.workedExample,
      guidedQuestion: fallback.guidedQuestion,
      practice: fallback.practice.map(stripItem),
      reassessment: fallback.reassessment.map(stripItem),
    };
  }

  const intervention = await db.orm.Intervention.create({
    id: newId(),
    studentId: body.data.studentId,
    topic: body.data.topic,
    actionType,
    contentJson: JSON.stringify({
      content,
      answerKey,
      source,
      guidedHint: fallback.guidedHint,
      practiceItems,
      reassessmentItems,
    }),
    masteryBefore,
  });

  const payload: InterventionGenerateResponse = {
    interventionId: intervention.id,
    actionType,
    conceptLabel: fallback.conceptLabel,
    content,
  };
  return NextResponse.json(payload);
}
