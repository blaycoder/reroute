import { describe, expect, it } from "vitest";
import { inferTimePressure } from "../telemetry";

// 45s question: more than 30% left = more than 13.5s; under 10% left = over 40.5s used.
const base = { estimatedTimeSeconds: 45 };

describe("inferTimePressure", () => {
  it("is none with more than 30% of the time left", () => {
    expect(inferTimePressure({ ...base, timeOnQuestionMs: 10_000 })).toBe("none");
  });

  it("is mild with 10-30% of the time left", () => {
    expect(inferTimePressure({ ...base, timeOnQuestionMs: 35_000 })).toBe("mild");
  });

  it("is severe with under 10% of the time left", () => {
    expect(inferTimePressure({ ...base, timeOnQuestionMs: 43_000 })).toBe("severe");
  });

  it("is severe when the timer ran all the way out", () => {
    expect(inferTimePressure({ ...base, timeOnQuestionMs: 45_000 })).toBe("severe");
  });

  it("is none when there is no time limit to press against", () => {
    expect(
      inferTimePressure({ estimatedTimeSeconds: 0, timeOnQuestionMs: 5_000 }),
    ).toBe("none");
  });
});
