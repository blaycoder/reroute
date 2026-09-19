export type Confidence = "high" | "medium" | "low";
export type ErrorType = "conceptual" | "procedural" | "application" | "careless";

export interface AttemptTelemetry {
  timeToFirstClickMs: number;
  totalDwellTimeMs: number;
  optionSwitchCount: number;
  hoverSequence: string[];
  idleBeforeSubmitMs: number;
  answerChanges: { from: string; to: string; timestampMs: number }[];
  wasSubmitted: boolean;
}

export interface Attempt {
  questionId: string;
  selectedOption: string;
  correct: boolean;
  responseTimeSeconds: number;
  inferredConfidence: Confidence; // system-inferred, NOT self-reported
  inferredMasterySignal: "up" | "slight-up" | "flag" | "gap";
  telemetry: AttemptTelemetry;
  timestamp: string;
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
    };
    byTopic: Record<string, TopicProfile>;
    readinessIndex: number;
    profileConfidence: number;
    interventionHistory: InterventionRecord[];
  };
}
