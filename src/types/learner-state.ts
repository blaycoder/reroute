export type Confidence = "high" | "medium" | "low";
export type ErrorType = "conceptual" | "procedural" | "application" | "careless";

export type TimePressureSignal = "none" | "mild" | "severe";

export interface AttemptTelemetry {
  timeToFirstClickMs: number;
  totalDwellTimeMs: number;
  optionSwitchCount: number;
  hoverSequence: string[];
  idleBeforeSubmitMs: number;
  answerChanges: { from: string; to: string; timestampMs: number }[];
  wasSubmitted: boolean;
  /** Time from the question appearing to the answer being locked in. */
  timeOnQuestionMs: number;
  /** True when the countdown reached zero before the student submitted. */
  timedOut: boolean;
  /** Derived server-side from timeOnQuestionMs; the client's value is ignored. */
  timePressureSignal: TimePressureSignal;
}

export interface Attempt {
  questionId: string;
  /** null when the timer ran out with nothing selected. */
  selectedOption: string | null;
  correct: boolean;
  responseTimeSeconds: number;
  inferredConfidence: Confidence; // system-inferred, NOT self-reported
  inferredMasterySignal: "up" | "slight-up" | "flag" | "gap";
  telemetry: AttemptTelemetry;
  timestamp: string;
}

/** The AI's read of one wrong answer, weighed against the student's telemetry. */
export interface AIDiagnosis {
  /** One warm sentence, max 280 characters, no jargon. */
  diagnosis: string;
  errorType: ErrorType;
  /** 0-1. */
  confidence: number;
  /** True when the AI disagreed with the distractor's pre-tagged error type. */
  overrodePrior: boolean;
  /** Internal only — never shown to the student. */
  reasoning: string;
  /** "ai" when the model answered in time, "fallback" for the deterministic path. */
  source: "ai" | "fallback";
}

export interface TopicProfile {
  accuracy: number;
  avgSpeedSeconds: number;
  confidence: Confidence;
  errorType: ErrorType | null;
  priorityScore: number;
  profileConfidence: number; // 0-1, how sure the system is
}

export interface InterventionRecord {
  topic: string;
  action: string;
  startedAt: string;
  completedAt: string;
  masteryBefore: number;
  masteryAfter: number;
  improved: boolean;
}

export interface LearnerState {
  studentId: string;
  targetExam: "JAMB";
  targetScore: number;
  subjects: string[];
  diagnostic: {
    diagnosticId: string;
    domainsCovered: string[];
    completedInSeconds: number;
    attempts: Attempt[];
  };
  learnerProfile: {
    overall: {
      accuracy: number;
      avgSpeedSeconds: number;
      confidenceCalibration: number;
      /** 0-100: expected pace ÷ actual pace, capped at 100. */
      speedScore: number;
    };
    byTopic: Record<string, TopicProfile>;
    readinessIndex: number;
    profileConfidence: number;
    interventionHistory: InterventionRecord[];
    /** The AI's most telling diagnosis for the priority topic, if any. */
    headlineDiagnosis: HeadlineDiagnosis | null;
  };
}

/** What the fingerprint's "What the AI noticed" card shows. */
export interface HeadlineDiagnosis {
  topic: string;
  diagnosis: string;
  errorType: ErrorType;
  confidence: number;
  overrodePrior: boolean;
}
