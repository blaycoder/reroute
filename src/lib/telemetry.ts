import type { Confidence } from "@/types/learner-state";

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
 * correct + high  -> 'up'         (strong evidence of mastery)
 * correct + low   -> 'slight-up'  (right answer, shaky process)
 * wrong  + high   -> 'flag'       (confidently wrong — misconception signal)
 * wrong  + low    -> 'gap'        (knowledge gap)
 *
 * Medium confidence weakens the evidence in both directions, so it never
 * produces the strong signals: correct + medium -> 'slight-up',
 * wrong + medium -> 'gap'.
 */
export function inferMasterySignal(
  correct: boolean,
  inferredConfidence: Confidence,
): MasterySignal {
  if (correct) {
    return inferredConfidence === "high" ? "up" : "slight-up";
  }
  return inferredConfidence === "high" ? "flag" : "gap";
}
