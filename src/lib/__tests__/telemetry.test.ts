import { describe, expect, it } from "vitest";
import { inferConfidence, inferMasterySignal } from "@/lib/telemetry";

// estimatedTimeSeconds = 60 → thresholds:
//   first click: high < 24_000 | low > 90_000
//   dwell:       high [30_000, 72_000] | low > 120_000

const base = {
  timeToFirstClickMs: 5_000,
  totalDwellTimeMs: 50_000,
  optionSwitchCount: 0,
  estimatedTimeSeconds: 60,
};

describe("inferConfidence", () => {
  it("returns high for a fast, committed, steady attempt", () => {
    expect(inferConfidence(base)).toBe("high");
  });

  it("returns high at the inclusive upper dwell boundary (1.2x)", () => {
    expect(inferConfidence({ ...base, totalDwellTimeMs: 72_000 })).toBe("high");
  });

  it("returns medium when first click misses the 40% cutoff", () => {
    expect(inferConfidence({ ...base, timeToFirstClickMs: 24_000 })).toBe(
      "medium",
    );
  });

  it("returns medium with one option switch", () => {
    expect(inferConfidence({ ...base, optionSwitchCount: 1 })).toBe("medium");
  });

  it("returns medium for dwell between the envelopes (1.67x)", () => {
    expect(inferConfidence({ ...base, totalDwellTimeMs: 100_000 })).toBe(
      "medium",
    );
  });

  it("returns medium for a snap answer below the 0.5x dwell floor", () => {
    expect(inferConfidence({ ...base, totalDwellTimeMs: 24_000 })).toBe(
      "medium",
    );
  });

  it("returns medium at the exclusive low-dwell boundary (exactly 2x)", () => {
    expect(inferConfidence({ ...base, totalDwellTimeMs: 120_000 })).toBe(
      "medium",
    );
  });

  it("returns low on two or more option switches", () => {
    expect(inferConfidence({ ...base, optionSwitchCount: 2 })).toBe("low");
  });

  it("returns low when dwell exceeds 2x estimated", () => {
    expect(inferConfidence({ ...base, totalDwellTimeMs: 120_001 })).toBe("low");
  });

  it("returns low when first click is slower than 1.5x estimated", () => {
    expect(inferConfidence({ ...base, timeToFirstClickMs: 90_001 })).toBe(
      "low",
    );
  });

  it("low signals preempt a high-shaped profile (dwell dominates)", () => {
    // Fast first click, no switches, but dwelling far too long.
    expect(inferConfidence({ ...base, totalDwellTimeMs: 150_000 })).toBe("low");
  });
});

describe("inferMasterySignal", () => {
  it("correct + high -> up", () => {
    expect(inferMasterySignal(true, "high")).toBe("up");
  });

  it("correct + low -> slight-up", () => {
    expect(inferMasterySignal(true, "low")).toBe("slight-up");
  });

  it("wrong + high -> flag (misconception signal)", () => {
    expect(inferMasterySignal(false, "high")).toBe("flag");
  });

  it("wrong + low -> gap (knowledge gap)", () => {
    expect(inferMasterySignal(false, "low")).toBe("gap");
  });

  it("correct + medium weakens to slight-up", () => {
    expect(inferMasterySignal(true, "medium")).toBe("slight-up");
  });

  it("wrong + medium weakens to gap", () => {
    expect(inferMasterySignal(false, "medium")).toBe("gap");
  });
});
