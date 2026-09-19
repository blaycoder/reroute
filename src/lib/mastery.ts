import type {
  Attempt,
  Confidence,
  ErrorType,
  TopicProfile,
} from "@/types/learner-state";

// Deterministic mastery estimation. Pure functions over Attempt[] — no LLM.

/**
 * Impact weight per topic (how much fixing a topic moves readiness). Set by
 * hand — not derived from the JAMB syllabus — so treat them as a tuning knob.
 */
export const TOPIC_IMPACT_WEIGHTS: Record<string, number> = {
  Algebra: 1.3,
  Geometry: 0.8,
  Indices: 1.0,
  "Simultaneous Equations": 1.2,
};

export function getTopicImpactWeight(topic: string): number {
  return TOPIC_IMPACT_WEIGHTS[topic] ?? 1.0;
}

const CONFIDENCE_SCORE: Record<Confidence, number> = {
  high: 1,
  medium: 0.5,
  low: 0,
};

/**
 * confidenceCalibration = accuracy - mean confidence score.
 * Negative = overconfident (confidence above demonstrated accuracy);
 * positive = underconfident. Empty input -> 0.
 */
export function computeConfidenceCalibration(attempts: Attempt[]): number {
  if (attempts.length === 0) return 0;
  const accuracy =
    attempts.filter((a) => a.correct).length / attempts.length;
  const score =
    attempts.reduce((sum, a) => sum + CONFIDENCE_SCORE[a.inferredConfidence], 0) /
    attempts.length;
  return accuracy - score;
}

/**
 * consistency = 1 - stddev(per-question correctness).
 * Population stddev (attempts are the whole observation, not a sample).
 * All-same results -> 1 (perfectly consistent); 50/50 -> 0.5; empty -> 0.
 */
export function computeConsistency(attempts: Attempt[]): number {
  if (attempts.length === 0) return 0;
  const values: number[] = attempts.map((a) => (a.correct ? 1 : 0));
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return 1 - Math.sqrt(variance);
}

/** priorityScore = (1 - accuracy) * topicImpactWeight */
export function computePriorityScore(
  profile: Pick<TopicProfile, "accuracy">,
  impactWeight = 1.0,
): number {
  return (1 - profile.accuracy) * impactWeight;
}

/**
 * profileConfidence — how sure the system is about a learner profile.
 * Starts at 0.4 after the diagnostic (one attempt per topic, i.e.
 * attemptCount === topicCount); += 0.05 per additional attempt, capped at
 * 0.95; -= 0.1 when a new attempt contradicts the existing profile
 * (never below 0).
 */
export function computeProfileConfidence(
  attemptCount: number,
  topicCount: number,
  contradicted = false,
): number {
  const extraAttempts = Math.max(0, attemptCount - topicCount);
  let score = 0.4 + 0.05 * extraAttempts;
  if (contradicted) score -= 0.1;
  return Math.min(0.95, Math.max(0, score));
}

export interface ReadinessInput {
  accuracy: number; // 0-1
  consistency: number; // 0-1, from computeConsistency
  /** accuracy - confidenceScore; negative = overconfident. */
  confidenceCalibration: number;
}

/**
 * readinessIndex = round(100 * (0.5*accuracy + 0.3*consistency
 *                                + 0.2*(1 - |confidenceCalibration|)))
 */
export function computeReadinessIndex(profile: ReadinessInput): number {
  const readiness =
    0.5 * profile.accuracy +
    0.3 * profile.consistency +
    0.2 * (1 - Math.abs(profile.confidenceCalibration));
  return Math.round(100 * readiness);
}

function confidenceLabel(score: number): Confidence {
  if (score >= 2 / 3) return "high";
  if (score > 1 / 3) return "medium";
  return "low";
}

/**
 * Aggregate a topic's attempts into a profile. `errorType` is assigned by the
 * diagnostic layer (the AI's read, or the distractor mapping) — not derivable from attempts alone —
 * and `impactWeight` defaults to 1.0 (callers pass the topic's impact weight).
 */
export function computeTopicProfile(
  attempts: Attempt[],
  errorType: ErrorType | null = null,
  impactWeight = 1.0,
): TopicProfile {
  if (attempts.length === 0) {
    return {
      accuracy: 0,
      avgSpeedSeconds: 0,
      confidence: "low",
      errorType,
      priorityScore: 0,
      profileConfidence: 0,
    };
  }

  const accuracy =
    attempts.filter((a) => a.correct).length / attempts.length;
  const avgSpeedSeconds =
    attempts.reduce((sum, a) => sum + a.responseTimeSeconds, 0) /
    attempts.length;
  const confidenceScore =
    attempts.reduce((sum, a) => sum + CONFIDENCE_SCORE[a.inferredConfidence], 0) /
    attempts.length;

  return {
    accuracy,
    avgSpeedSeconds,
    confidence: confidenceLabel(confidenceScore),
    errorType,
    priorityScore: computePriorityScore({ accuracy }, impactWeight),
    // Per-topic view: the diagnostic baseline is one attempt on the topic.
    profileConfidence: computeProfileConfidence(attempts.length, 1),
  };
}
