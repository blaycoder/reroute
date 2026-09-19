import { describe, expect, it } from "vitest";
import { determineNextAction, inferErrorType } from "@/lib/rules-engine";
import type { TopicProfile } from "@/types/learner-state";

const EST = 60; // estimated question time for speed-threshold tests

function profile(overrides: Partial<TopicProfile> = {}): TopicProfile {
  return {
    accuracy: 0.6,
    avgSpeedSeconds: 50, // 0.83x estimated — neither slow (>90s) nor fast (<30s)
    confidence: "medium",
    errorType: null,
    priorityScore: 0.4,
    profileConfidence: 0.5,
    ...overrides,
  };
}

describe("inferErrorType", () => {
  const signals = {
    correct: false,
    inferredConfidence: "medium" as const,
    responseTimeSeconds: 45,
    estimatedTimeSeconds: 60,
    optionSwitchCount: 1,
  };

  it("correct attempts classify to null", () => {
    expect(inferErrorType({ ...signals, correct: true })).toBeNull();
  });

  it("confidently wrong -> conceptual (even when rushed)", () => {
    expect(
      inferErrorType({
        ...signals,
        inferredConfidence: "high",
        responseTimeSeconds: 5,
      }),
    ).toBe("conceptual");
  });

  it("rushed wrong -> careless", () => {
    expect(
      inferErrorType({ ...signals, responseTimeSeconds: 10 }),
    ).toBe("careless"); // 10 < 0.5 * 60
  });

  it("slow wrong -> procedural", () => {
    expect(
      inferErrorType({ ...signals, responseTimeSeconds: 100 }),
    ).toBe("procedural"); // 100 > 1.5 * 60
  });

  it("hedging wrong -> procedural", () => {
    expect(
      inferErrorType({ ...signals, optionSwitchCount: 2 }),
    ).toBe("procedural");
  });

  it("middling wrong -> application", () => {
    expect(inferErrorType(signals)).toBe("application");
  });

  it("treats estimatedTimeSeconds=0 as neither fast nor slow", () => {
    expect(
      inferErrorType({ ...signals, estimatedTimeSeconds: 0 }),
    ).toBe("application");
  });
});

describe("determineNextAction — errorType branches (preempt all)", () => {
  it("conceptual -> concept_explanation_guided_example", () => {
    expect(determineNextAction(profile({ errorType: "conceptual" }), EST)).toBe(
      "concept_explanation_guided_example",
    );
  });

  it("procedural -> worked_example_practice", () => {
    expect(determineNextAction(profile({ errorType: "procedural" }), EST)).toBe(
      "worked_example_practice",
    );
  });

  it("application -> contextual_practice", () => {
    expect(determineNextAction(profile({ errorType: "application" }), EST)).toBe(
      "contextual_practice",
    );
  });

  it("careless -> accuracy_intervention", () => {
    expect(
      determineNextAction(
        profile({ errorType: "careless", confidence: "low", avgSpeedSeconds: 200 }),
        EST,
      ),
    ).toBe("accuracy_intervention"); // wins even when slow + low confidence
  });
});

describe("determineNextAction — speed branches", () => {
  it("slow + accurate -> timed_practice", () => {
    expect(
      determineNextAction(
        profile({ avgSpeedSeconds: 100, accuracy: 0.8 }),
        EST,
      ),
    ).toBe("timed_practice"); // 100s > 1.5 * 60
  });

  it("fast + failing -> accuracy_intervention", () => {
    expect(
      determineNextAction(
        profile({ avgSpeedSeconds: 20, accuracy: 0.4 }),
        EST,
      ),
    ).toBe("accuracy_intervention"); // 20s < 0.5 * 60
  });

  it("skips speed branches when estimatedTimeSeconds is not provided", () => {
    expect(
      determineNextAction(profile({ avgSpeedSeconds: 200, accuracy: 0.8 })),
    ).toBe("targeted_practice_default");
  });
});

describe("determineNextAction — confidence/accuracy branches", () => {
  it("high confidence but failing -> misconception_check", () => {
    expect(
      determineNextAction(profile({ confidence: "high", accuracy: 0.4 }), EST),
    ).toBe("misconception_check");
  });

  it("low confidence but accurate -> confidence_building_practice", () => {
    expect(
      determineNextAction(profile({ confidence: "low", accuracy: 0.8 }), EST),
    ).toBe("confidence_building_practice");
  });

  it("low confidence and failing -> foundational_remediation", () => {
    expect(
      determineNextAction(profile({ confidence: "low", accuracy: 0.4 }), EST),
    ).toBe("foundational_remediation");
  });
});

describe("determineNextAction — default", () => {
  it("middling profile -> targeted_practice_default", () => {
    expect(determineNextAction(profile(), EST)).toBe(
      "targeted_practice_default",
    );
  });

  it("slow but inaccurate does not trigger timed_practice", () => {
    expect(
      determineNextAction(
        profile({ avgSpeedSeconds: 100, accuracy: 0.5 }),
        EST,
      ),
    ).toBe("targeted_practice_default"); // slow needs accuracy >= 0.7
  });
});
