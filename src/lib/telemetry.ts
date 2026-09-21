import type { Confidence, TimePressureSignal } from "@/types/learner-state";

// Deterministic confidence inference from raw interaction telemetry.
// Confidence is system-inferred from behaviour — never self-reported.

export interface ConfidenceSignals {
  timeToFirstClickMs: number;
  totalDwellTimeMs: number;
  optionSwitchCount: number;
  estimatedTimeSeconds: number;
}

/**
 * Classify an attempt's confidence.
 *
 * high   — committed fast (first click < 40% of estimated time), no option
 *          switches, dwell in [0.5x, 1.2x] of estimated time (inclusive).
 * low    — hedging (>= 2 option switches), OR dwelling > 2x estimated,
 *          OR first click slower than 1.5x estimated.
 * medium — everything between the high and low envelopes. The spec's medium
 *          bounds (switches <= 1, dwell 0.6x–1.8x) fall out of the two
 *          checks above, leaving no undefined gap.
 */
export function inferConfidence(attempt: ConfidenceSignals): Confidence {
  const estimatedMs = attempt.estimatedTimeSeconds * 1000;

  const fastCommit = attempt.timeToFirstClickMs < 0.4 * estimatedMs;
  const noHedging = attempt.optionSwitchCount === 0;
  const steadyDwell =
    attempt.totalDwellTimeMs >= 0.5 * estimatedMs &&
    attempt.totalDwellTimeMs <= 1.2 * estimatedMs;

  if (fastCommit && noHedging && steadyDwell) return "high";

  const hedging = attempt.optionSwitchCount >= 2;
  const sluggish = attempt.totalDwellTimeMs > 2 * estimatedMs;
  const hesitant = attempt.timeToFirstClickMs > 1.5 * estimatedMs;

  if (hedging || sluggish || hesitant) return "low";

  return "medium";
}

export type MasterySignal = "up" | "slight-up" | "flag" | "gap";

/**
 * Map correctness × inferred confidence to a mastery signal.
 *
 * correct + high   -> 'up'         (strong evidence of mastery)
 * correct + medium -> 'up'
 * correct + low    -> 'slight-up'  (right answer, shaky process)
 * wrong  + high    -> 'flag'       (confidently wrong — misconception signal)
 * wrong  + medium  -> 'flag'
 * wrong  + low     -> 'gap'        (knowledge gap)
 */
export function inferMasterySignal(
  correct: boolean,
  inferredConfidence: Confidence,
): MasterySignal {
  if (correct) {
    return inferredConfidence === "low" ? "slight-up" : "up";
  }
  return inferredConfidence === "low" ? "gap" : "flag";
}

/**
 * How much of the question's time was left when the student locked in.
 *   more than 30% left -> 'none'
 *   10% to 30% left    -> 'mild'
 *   under 10% left     -> 'severe'
 * Derived from raw timing on the server, so it cannot be spoofed by the client.
 */
export function inferTimePressure(input: {
  timeOnQuestionMs: number;
  estimatedTimeSeconds: number;
}): TimePressureSignal {
  const totalMs = input.estimatedTimeSeconds * 1000;
  if (totalMs <= 0) return "none";
  const remainingFraction = (totalMs - input.timeOnQuestionMs) / totalMs;
  if (remainingFraction > 0.3) return "none";
  if (remainingFraction >= 0.1) return "mild";
  return "severe";
}
