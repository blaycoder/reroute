import { z } from "zod";
import { generateText } from "@/lib/llm";
import { inferErrorType } from "@/lib/rules-engine";
import type {
  AIDiagnosis,
  AttemptTelemetry,
  Confidence,
  ErrorType,
} from "@/types/learner-state";

// The AI does not calculate or grade — correctness is decided deterministically
// before this runs. Its job is to weigh the question's pre-tagged distractor
// mapping (a PRIOR, not a verdict) against how the student actually behaved,
// and to say so when the evidence disagrees.

const MAX_DIAGNOSIS_CHARS = 280;

export interface RecentAttempt {
  concept: string;
  correct: boolean;
  /** The named misconception of the wrong option chosen, when there was one. */
  misconception: string | null;
  inferredConfidence: Confidence;
}

export interface DiagnosisInput {
  questionText: string;
  concept: string;
  /** Text of the correct option. */
  correctAnswer: string;
  /** Text of the option the student chose; null when time ran out with none. */
  selectedAnswer: string | null;
  estimatedTimeSeconds: number;
  /** Named misconception of the chosen distractor, from the question bank. */
  knownMisconception: string | null;
  /** The distractor's pre-tagged error type — the prior the AI may override. */
  priorErrorType: ErrorType | null;
  /** The distractor's own explanation, used by the deterministic fallback. */
  priorExplanation: string | null;
  telemetry: AttemptTelemetry;
  inferredConfidence: Confidence;
  recentAttempts: RecentAttempt[];
}

const responseSchema = z.object({
  diagnosis: z.string().min(1).max(MAX_DIAGNOSIS_CHARS),
  errorType: z.enum(["conceptual", "procedural", "application", "careless"]),
  confidence: z.number().min(0).max(1),
  overrodePrior: z.boolean(),
  reasoning: z.string(),
});

const SYSTEM_PROMPT = [
  "You diagnose why a JAMB Mathematics student got a question wrong.",
  "You are given the question, the student's answer, a pre-tagged misconception for that wrong answer, and how the student actually behaved (timing, option switching, idle time), plus their recent history.",
  "The pre-tagged misconception is a PRIOR, not a verdict. Weigh it against the behaviour and the history.",
  "If the behaviour shows guessing (many option switches, very long dwell, low confidence), answer errorType \"careless\" even when the pre-tagged misconception says conceptual.",
  "If the history shows the same pattern across several questions, name the pattern, not the single error.",
  "Set overrodePrior to true whenever you disagree with the pre-tagged misconception.",
  "Do not solve or re-grade the question. Do not invent facts.",
  `diagnosis: ONE warm sentence, at most ${MAX_DIAGNOSIS_CHARS} characters, plain language, no jargon, never starting with "As an AI". Use $...$ for any maths.`,
  "Return STRICT JSON only, no markdown fences, exactly:",
  '{"diagnosis": string, "errorType": "conceptual"|"procedural"|"application"|"careless", "confidence": number between 0 and 1, "overrodePrior": boolean, "reasoning": string}',
].join("\n");

function userPrompt(input: DiagnosisInput): string {
  return JSON.stringify({
    question: input.questionText,
    concept: input.concept,
    correctAnswer: input.correctAnswer,
    studentAnswer: input.selectedAnswer ?? "(no answer — time ran out)",
    estimatedSeconds: input.estimatedTimeSeconds,
    preTaggedMisconception: input.knownMisconception,
    preTaggedErrorType: input.priorErrorType,
    behaviour: {
      secondsOnQuestion: Math.round(input.telemetry.timeOnQuestionMs / 1000),
      secondsToFirstTap: Math.round(input.telemetry.timeToFirstClickMs / 1000),
      optionSwitches: input.telemetry.optionSwitchCount,
      secondsIdleBeforeSubmit: Math.round(
        input.telemetry.idleBeforeSubmitMs / 1000,
      ),
      timedOut: input.telemetry.timedOut,
      timePressure: input.telemetry.timePressureSignal,
      inferredConfidence: input.inferredConfidence,
    },
    recentAttempts: input.recentAttempts,
  });
}

function limitLength(text: string): string {
  if (text.length <= MAX_DIAGNOSIS_CHARS) return text;
  const cut = text.slice(0, MAX_DIAGNOSIS_CHARS - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

function parseModelReply(text: string): z.infer<typeof responseSchema> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = responseSchema.safeParse(JSON.parse(text.slice(start, end + 1)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Deterministic diagnosis from the distractor mapping alone. */
export function fallbackDiagnosis(input: DiagnosisInput): AIDiagnosis {
  if (input.selectedAnswer === null) {
    return {
      diagnosis:
        "Time ran out before you chose an answer, so we can't tell which step it slipped at — we'll watch your pace on this topic.",
      errorType: "procedural",
      confidence: 0.4,
      overrodePrior: false,
      reasoning: "Fallback: timed out with no selection.",
      source: "fallback",
    };
  }

  const errorType =
    input.priorErrorType ??
    inferErrorType({
      correct: false,
      inferredConfidence: input.inferredConfidence,
      responseTimeSeconds: Math.round(input.telemetry.timeOnQuestionMs / 1000),
      estimatedTimeSeconds: input.estimatedTimeSeconds,
      optionSwitchCount: input.telemetry.optionSwitchCount,
    }) ??
    "application";

  const diagnosis =
    input.knownMisconception && input.priorExplanation
      ? `This one slipped at a specific step — ${input.knownMisconception.toLowerCase()}. ${input.priorExplanation}`
      : "This one didn't land yet — let's look at the method step by step.";

  return {
    diagnosis: limitLength(diagnosis),
    errorType,
    confidence: input.priorErrorType ? 0.6 : 0.4,
    overrodePrior: false,
    reasoning: "Fallback: distractor mapping only.",
    source: "fallback",
  };
}

/** Never throws: any failure or timeout resolves to the deterministic fallback. */
export async function diagnoseMisconception(
  input: DiagnosisInput,
): Promise<AIDiagnosis> {
  const reply = await generateText({
    system: SYSTEM_PROMPT,
    user: userPrompt(input),
    temperature: 0.2,
    maxTokens: 400,
  });
  const parsed = reply ? parseModelReply(reply.text) : null;
  if (!parsed) return fallbackDiagnosis(input);

  // A disagreement with the prior is decided by the data, not just claimed.
  const overrodePrior =
    input.priorErrorType !== null &&
    (parsed.overrodePrior || parsed.errorType !== input.priorErrorType);

  return {
    diagnosis: limitLength(parsed.diagnosis),
    errorType: parsed.errorType,
    confidence: parsed.confidence,
    overrodePrior,
    reasoning: parsed.reasoning,
    source: "ai",
  };
}
