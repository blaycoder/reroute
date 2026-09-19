import { describe, expect, it } from "vitest";
import {
  TOPIC_IMPACT_WEIGHTS,
  computeConsistency,
  computeConfidenceCalibration,
  computePriorityScore,
  computeProfileConfidence,
  computeReadinessIndex,
  computeTopicProfile,
} from "@/lib/mastery";
import type { Attempt } from "@/types/learner-state";

function makeAttempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    questionId: "q1",
    selectedOption: "A",
    correct: true,
    responseTimeSeconds: 30,
    inferredConfidence: "high",
    inferredMasterySignal: "up",
    telemetry: {
      timeToFirstClickMs: 1_000,
      totalDwellTimeMs: 25_000,
      optionSwitchCount: 0,
      hoverSequence: [],
      idleBeforeSubmitMs: 0,
      answerChanges: [],
      wasSubmitted: true,
    },
    timestamp: "2026-09-16T00:00:00.000Z",
    ...overrides,
  };
}

describe("computeTopicProfile", () => {
  it("computes accuracy, avg speed, confidence label, priority and profile confidence", () => {
    const attempts = [
      makeAttempt({ correct: true, inferredConfidence: "high", responseTimeSeconds: 30 }),
      makeAttempt({ correct: false, inferredConfidence: "low", responseTimeSeconds: 50 }),
      makeAttempt({ correct: true, inferredConfidence: "medium", responseTimeSeconds: 40 }),
    ];

    const profile = computeTopicProfile(attempts);

    expect(profile.accuracy).toBeCloseTo(2 / 3);
    expect(profile.avgSpeedSeconds).toBe(40);
    expect(profile.confidence).toBe("medium"); // mean score 0.5
    expect(profile.priorityScore).toBeCloseTo(1 / 3); // (1 - 2/3) * 1.0
    expect(profile.profileConfidence).toBe(0.5); // 0.4 + 0.05 * (3 - 1)
  });

  it("passes through errorType and applies a custom impact weight", () => {
    const attempts = [
      makeAttempt({ correct: true }),
      makeAttempt({ correct: false }),
    ];
    const profile = computeTopicProfile(attempts, "conceptual", 1.3);
    expect(profile.errorType).toBe("conceptual");
    expect(profile.priorityScore).toBeCloseTo(0.5 * 1.3);
  });

  it("returns a zeroed profile for no attempts", () => {
    const profile = computeTopicProfile([], "procedural");
    expect(profile.accuracy).toBe(0);
    expect(profile.avgSpeedSeconds).toBe(0);
    expect(profile.confidence).toBe("low");
    expect(profile.priorityScore).toBe(0);
    expect(profile.profileConfidence).toBe(0);
  });

  it("labels a confidently-correct topic as high confidence", () => {
    const profile = computeTopicProfile([
      makeAttempt({ inferredConfidence: "high" }),
      makeAttempt({ inferredConfidence: "high" }),
    ]);
    expect(profile.confidence).toBe("high");
  });
});

describe("computeConsistency", () => {
  it("returns 1 when every attempt has the same outcome", () => {
    expect(computeConsistency([makeAttempt(), makeAttempt()])).toBe(1);
  });

  it("returns 0.5 for an even split", () => {
    const attempts = [
      makeAttempt({ correct: true }),
      makeAttempt({ correct: false }),
      makeAttempt({ correct: true }),
      makeAttempt({ correct: false }),
    ];
    expect(computeConsistency(attempts)).toBeCloseTo(0.5);
  });

  it("returns 0 for no attempts", () => {
    expect(computeConsistency([])).toBe(0);
  });
});

describe("computeReadinessIndex", () => {
  it("weights accuracy 0.5, consistency 0.3, calibration 0.2", () => {
    expect(
      computeReadinessIndex({
        accuracy: 0.8,
        consistency: 0.9,
        confidenceCalibration: -0.1,
      }),
    ).toBe(85); // 40 + 27 + 18
  });

  it("rounds to the nearest integer", () => {
    expect(
      computeReadinessIndex({
        accuracy: 1 / 3,
        consistency: 0.5,
        confidenceCalibration: 0,
      }),
    ).toBe(52); // 16.67 + 15 + 20
  });

  it("penalises overconfidence via the absolute calibration term", () => {
    const overconfident = computeReadinessIndex({
      accuracy: 0.8,
      consistency: 0.9,
      confidenceCalibration: 0.3, // confidence score far above accuracy
    });
    const wellCalibrated = computeReadinessIndex({
      accuracy: 0.8,
      consistency: 0.9,
      confidenceCalibration: 0,
    });
    expect(overconfident).toBeLessThan(wellCalibrated);
  });
});

describe("computePriorityScore", () => {
  it("defaults to impact weight 1.0", () => {
    expect(computePriorityScore({ accuracy: 0.6 })).toBeCloseTo(0.4);
  });

  it("scales by the topic impact weight", () => {
    expect(computePriorityScore({ accuracy: 0.6 }, 1.3)).toBeCloseTo(0.52);
  });
});

describe("computeProfileConfidence", () => {
  it("starts at 0.4 when attempts match the diagnostic baseline", () => {
    expect(computeProfileConfidence(10, 10)).toBe(0.4);
  });

  it("grows 0.05 per extra attempt", () => {
    expect(computeProfileConfidence(12, 10)).toBeCloseTo(0.5);
  });

  it("caps at 0.95", () => {
    expect(computeProfileConfidence(30, 10)).toBe(0.95);
  });

  it("drops 0.1 on a contradicting attempt", () => {
    expect(computeProfileConfidence(12, 10, true)).toBeCloseTo(0.4);
  });

  it("never drops below 0", () => {
    expect(computeProfileConfidence(1, 10, true)).toBeCloseTo(0.3);
  });
});

describe("computeConfidenceCalibration", () => {
  it("returns 0 for no attempts", () => {
    expect(computeConfidenceCalibration([])).toBe(0);
  });

  it("returns 0 when confidence score matches accuracy", () => {
    expect(
      computeConfidenceCalibration([
        makeAttempt({ correct: true, inferredConfidence: "high" }),
        makeAttempt({ correct: false, inferredConfidence: "low" }),
      ]),
    ).toBeCloseTo(0); // accuracy 0.5 - score 0.5
  });

  it("is negative when overconfident", () => {
    expect(
      computeConfidenceCalibration([
        makeAttempt({ correct: false, inferredConfidence: "high" }),
        makeAttempt({ correct: false, inferredConfidence: "high" }),
      ]),
    ).toBe(-1); // accuracy 0 - score 1
  });

  it("is positive when underconfident", () => {
    expect(
      computeConfidenceCalibration([
        makeAttempt({ correct: true, inferredConfidence: "low" }),
        makeAttempt({ correct: true, inferredConfidence: "low" }),
      ]),
    ).toBe(1); // accuracy 1 - score 0
  });
});

describe("TOPIC_IMPACT_WEIGHTS", () => {
  it("carries the demo weights", () => {
    expect(TOPIC_IMPACT_WEIGHTS).toEqual({
      Algebra: 1.3,
      Geometry: 0.8,
      Indices: 1.0,
      "Simultaneous Equations": 1.2,
    });
  });
});
