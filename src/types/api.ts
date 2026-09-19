import type { NextAction } from "@/lib/rules-engine";
import type {
  AttemptTelemetry,
  Confidence,
  ErrorType,
  InterventionRecord,
  TopicProfile,
} from "./learner-state";
import type { Question } from "./question";

// Wire contracts for the six API routes. Answer keys and distractor metadata
// NEVER appear in any request/response here — the client only ever sends an
// option letter and receives sanitized content.

export interface ApiError {
  error: string;
  details?: unknown;
}

// ---------------------------------------------------------------------------
// POST /api/diagnostic/start
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
  difficulty: Question["difficulty"];
  questionText: string;
  options: Record<string, string>;
}

export interface DiagnosticStartResponse {
  studentId: string;
  diagnosticId: string;
  questions: DiagnosticQuestionPreview[];
}

// ---------------------------------------------------------------------------
// POST /api/diagnostic/answer
// ---------------------------------------------------------------------------

export interface DiagnosticAnswerRequest {
  diagnosticId: string;
  questionId: string;
  selectedOption: string;
  responseTimeSeconds: number;
  telemetry: AttemptTelemetry;
}

export interface DiagnosticAnswerResponse {
  recorded: true;
  /** Sequencer input only — never rendered to the student. */
  correct: boolean;
}

// ---------------------------------------------------------------------------
// POST /api/diagnostic/complete
// ---------------------------------------------------------------------------

export interface DiagnosticCompleteRequest {
  diagnosticId: string;
}

export interface LearnerProfileSummary {
  overall: {
    accuracy: number;
    avgSpeedSeconds: number;
    confidenceCalibration: number;
    speedScore: number;
  };
  byTopic: Record<string, TopicProfile>;
  readinessIndex: number;
  profileConfidence: number;
  interventionHistory: InterventionRecord[];
}

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
  errorType: ErrorType;
  confidence: Confidence;
}

export interface PracticeItem {
  questionText: string;
  options: Record<string, string>;
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

export interface InterventionCheckGuidedResponse {
  /** false when no server-side answer key exists (LLM-generated content). */
  graded: boolean;
  correct: boolean;
  hint: string | null;
}

// ---------------------------------------------------------------------------
// POST /api/intervention/verify
// ---------------------------------------------------------------------------

export interface InterventionVerifyRequest {
  interventionId: string;
  answers: {
    guidedResponse: string;
    practiceResponses: string[];
    reassessmentResponses?: string[];
  };
  /** Captured per question; stored-payload-ready, unused for scoring yet. */
  telemetry?: AttemptTelemetry[];
}

export interface InterventionVerifyResponse {
  masteryBefore: number;
  masteryAfter: number;
  improved: boolean;
  /** null when no profile exists yet to prioritize against. */
  nextPriorityTopic: string | null;
}
