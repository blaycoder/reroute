import type {
  Confidence,
  ErrorType,
  TopicProfile,
} from "@/types/learner-state";

// Deterministic prioritization: profile -> prioritized next action. No LLM.

export type NextAction =
  | "concept_explanation_guided_example"
  | "worked_example_practice"
  | "contextual_practice"
  | "accuracy_intervention"
  | "timed_practice"
  | "misconception_check"
  | "confidence_building_practice"
  | "foundational_remediation"
  | "targeted_practice_default";

/**
 * Decide the next action for a topic.
 *
 * Error type (from distractor analysis) preempts everything. Speed thresholds
 * need the question's estimated time, which is not part of TopicProfile —
 * pass it via `estimatedTimeSeconds`; when omitted the speed branches are
 * skipped (never treated as slow or fast).
 *
 * slow = avgSpeedSeconds > 1.5 * estimatedTimeSeconds
 * fast = avgSpeedSeconds < 0.5 * estimatedTimeSeconds
 */
export function determineNextAction(
  topicProfile: TopicProfile,
  estimatedTimeSeconds?: number,
): NextAction {
  if (topicProfile.errorType === "conceptual") {
    return "concept_explanation_guided_example";
  }
  if (topicProfile.errorType === "procedural") {
    return "worked_example_practice";
  }
  if (topicProfile.errorType === "application") {
    return "contextual_practice";
  }
  if (topicProfile.errorType === "careless") {
    return "accuracy_intervention";
  }

  const slow =
    estimatedTimeSeconds !== undefined &&
    topicProfile.avgSpeedSeconds > 1.5 * estimatedTimeSeconds;
  const fast =
    estimatedTimeSeconds !== undefined &&
    topicProfile.avgSpeedSeconds < 0.5 * estimatedTimeSeconds;

  if (slow && topicProfile.accuracy >= 0.7) return "timed_practice";
  if (fast && topicProfile.accuracy < 0.5) return "accuracy_intervention";
  if (topicProfile.confidence === "high" && topicProfile.accuracy < 0.5) {
    return "misconception_check";
  }
  if (topicProfile.confidence === "low" && topicProfile.accuracy >= 0.7) {
    return "confidence_building_practice";
  }
  if (topicProfile.confidence === "low" && topicProfile.accuracy < 0.5) {
    return "foundational_remediation";
  }
  return "targeted_practice_default";
}

export interface ErrorTypeSignals {
  correct: boolean;
  inferredConfidence: Confidence;
  responseTimeSeconds: number;
  estimatedTimeSeconds: number;
  optionSwitchCount: number;
}

/**
 * Deterministic error-type classification from telemetry (per attempt).
 *   confidently wrong            -> conceptual (broken mental model)
 *   rushed wrong (< 0.5x est.)   -> careless
 *   slow (or hedging) wrong      -> procedural (fumbling execution)
 *   anything else wrong          -> application
 * Correct attempts classify to null.
 */
export function inferErrorType(
  signals: ErrorTypeSignals,
): ErrorType | null {
  if (signals.correct) return null;
  if (signals.inferredConfidence === "high") return "conceptual";
  const estimated = signals.estimatedTimeSeconds;
  const fast = estimated > 0 && signals.responseTimeSeconds < 0.5 * estimated;
  const slow = estimated > 0 && signals.responseTimeSeconds > 1.5 * estimated;
  if (fast) return "careless";
  if (slow || signals.optionSwitchCount >= 2) return "procedural";
  return "application";
}
