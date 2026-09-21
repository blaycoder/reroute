import type { NextAction } from "@/lib/rules-engine";
import type { AttemptTelemetry, LearnerState } from "./learner-state";
import type { Question } from "./question";

// Wire contracts for the API routes. Answer keys and distractor metadata
// NEVER appear in any request/response here — the client only ever sends an
// option letter and receives sanitized content.

export interface ApiError {
  error: string;
  details?: unknown;
}

/**
 * What the browser sends. `timePressureSignal` is derived on the server from
 * the raw timing, so a client can't spoof it.
 */
export type ClientTelemetry = Omit<AttemptTelemetry, "timePressureSignal">;

// ---------------------------------------------------------------------------
// POST /api/diagnostic/start · GET /api/diagnostic/[diagnosticId]
// ---------------------------------------------------------------------------

export interface DiagnosticStartRequest {
  /** Omitted for a brand-new learner — the server creates the Student row. */
  studentId?: string;
  /** JAMB scale: 0-400. */
  targetScore: number;
  subject: string;
}

export interface DiagnosticQuestionPreview {
  id: string;
  topic: string;
  subtopic: string;
  difficulty: Question["difficulty"];
  estimatedTimeSeconds: number;
  questionText: string;
  options: Record<string, string>;
}

/**
 * Where a diagnostic stands. The server routes: it sends ONE question at a
 * time, so a refresh resumes from the last answer and no answer key or
 * upcoming question ever reaches the browser.
 */
export interface DiagnosticProgress {
  studentId: string;
  diagnosticId: string;
  total: number;
  answered: number;
  completed: boolean;
  /** The next question, or null once every question has been answered. */
  question: DiagnosticQuestionPreview | null;
}

export type DiagnosticStartResponse = DiagnosticProgress;

// ---------------------------------------------------------------------------
// POST /api/diagnostic/answer
// ---------------------------------------------------------------------------

export interface DiagnosticAnswerRequest {
  diagnosticId: string;
  questionId: string;
  /** null only when the timer ran out with nothing selected. */
  selectedOption: string | null;
  telemetry: ClientTelemetry;
}

export interface DiagnosticAnswerResponse {
  recorded: true;
  progress: DiagnosticProgress;
}

// ---------------------------------------------------------------------------
// POST /api/diagnostic/complete
// ---------------------------------------------------------------------------

export interface DiagnosticCompleteRequest {
  diagnosticId: string;
}

export type LearnerProfileSummary = LearnerState["learnerProfile"];

export interface DiagnosticCompleteResponse {
  learnerProfile: LearnerProfileSummary;
  readinessIndex: number;
  priorityTopic: string;
}

// ---------------------------------------------------------------------------
// GET /api/learner/[studentId]/fingerprint
// ---------------------------------------------------------------------------

export type FingerprintResponse = LearnerProfileSummary & {
  /** Highest priorityScore topic; null when no topic profiles exist. */
  priorityTopic: string | null;
};

// ---------------------------------------------------------------------------
// POST /api/intervention/generate
// ---------------------------------------------------------------------------

export interface InterventionGenerateRequest {
  studentId: string;
  topic: string;
}

export interface PracticeItem {
  id: string;
  questionText: string;
  options: Record<string, string>;
  estimatedTimeSeconds: number;
}

export interface InterventionContent {
  explanation: string;
  workedExample: string;
  guidedQuestion: string;
  practice: PracticeItem[];
  reassessment: PracticeItem[];
}

export interface InterventionGenerateResponse {
  interventionId: string;
  actionType: NextAction;
  /** Human phrase for the headline, e.g. "distributing negative coefficients". */
  conceptLabel: string;
  content: InterventionContent;
}

// ---------------------------------------------------------------------------
// POST /api/intervention/check-guided · check-practice
// ---------------------------------------------------------------------------

export interface InterventionCheckGuidedRequest {
  interventionId: string;
  guidedResponse: string;
}

export interface InterventionCheckGuidedResponse {
  graded: boolean;
  correct: boolean;
  /** Names the slip when the wrong answer matches a known misconception. */
  hint: string | null;
}

export interface InterventionCheckPracticeRequest {
  interventionId: string;
  questionId: string;
  selectedOption: string | null;
  telemetry: ClientTelemetry;
}

export interface InterventionCheckPracticeResponse {
  correct: boolean;
}

// ---------------------------------------------------------------------------
// POST /api/intervention/verify
// ---------------------------------------------------------------------------

export interface InterventionVerifyRequest {
  interventionId: string;
  reassessment: {
    questionId: string;
    selectedOption: string | null;
    telemetry: ClientTelemetry;
  }[];
}

export interface InterventionVerifyResponse {
  masteryBefore: number;
  masteryAfter: number;
  improved: boolean;
  /** null when no other topic remains to prioritize. */
  nextPriorityTopic: string | null;
}
