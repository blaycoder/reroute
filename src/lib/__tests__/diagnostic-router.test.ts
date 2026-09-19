import { describe, expect, it } from "vitest";
import { getQuestionsByPurpose } from "@/data/question-bank";
import {
  DIAGNOSTIC_LENGTH,
  FIRST_QUESTION_ID,
  paceOf,
  pickNextQuestion,
  type AnsweredQuestion,
} from "../diagnostic-router";

const pool = getQuestionsByPurpose("diagnostic");

// Drives the router to completion with a fixed answering style.
function runDiagnostic(
  answerStyle: (questionId: string, index: number) => Omit<AnsweredQuestion, "questionId">,
): string[] {
  const answered: AnsweredQuestion[] = [];
  for (let i = 0; i < DIAGNOSTIC_LENGTH + 2; i++) {
    const next = pickNextQuestion(pool, answered);
    if (!next) break;
    answered.push({ questionId: next.id, ...answerStyle(next.id, i) });
  }
  return answered.map((a) => a.questionId);
}

describe("pickNextQuestion", () => {
  it("always starts with the fixed baseline question", () => {
    expect(pickNextQuestion(pool, [])?.id).toBe(FIRST_QUESTION_ID);
  });

  it("correct + fast: same topic, harder", () => {
    const next = pickNextQuestion(pool, [
      { questionId: FIRST_QUESTION_ID, correct: true, pace: "fast" },
    ]);
    expect(next?.id).toBe("q_alg_003");
  });

  it("wrong + fast: same topic, easier", () => {
    const next = pickNextQuestion(pool, [
      { questionId: FIRST_QUESTION_ID, correct: false, pace: "fast" },
    ]);
    expect(next?.id).toBe("q_alg_001");
  });

  it("wrong + slow: switches topic and starts easy", () => {
    const next = pickNextQuestion(pool, [
      { questionId: FIRST_QUESTION_ID, correct: false, pace: "slow" },
    ]);
    expect(next?.topic).not.toBe("Algebra");
    expect(next?.difficulty).toBe("easy");
  });

  it("correct + slow: stays on the topic at the same level, or the closest one", () => {
    const next = pickNextQuestion(pool, [
      { questionId: FIRST_QUESTION_ID, correct: true, pace: "slow" },
    ]);
    expect(next?.topic).toBe("Algebra");
  });

  it("never repeats a question and asks all 12 when nothing is exhausted early", () => {
    const sequence = runDiagnostic(() => ({ correct: true, pace: "fast" }));
    expect(new Set(sequence).size).toBe(sequence.length);
    expect(sequence).toHaveLength(DIAGNOSTIC_LENGTH);
  });

  it("gives different sequences to different answering patterns", () => {
    const confident = runDiagnostic(() => ({ correct: true, pace: "fast" }));
    const struggling = runDiagnostic(() => ({ correct: false, pace: "slow" }));
    expect(confident).not.toEqual(struggling);
  });

  it("completes when the diagnostic length is reached", () => {
    const answered: AnsweredQuestion[] = pool.map((q) => ({
      questionId: q.id,
      correct: true,
      pace: "fast",
    }));
    expect(pickNextQuestion(pool, answered)).toBeNull();
  });
});

describe("paceOf", () => {
  it("is fast when locked in within 75% of the estimated time", () => {
    expect(
      paceOf({ timeOnQuestionMs: 20_000, estimatedTimeSeconds: 30, timedOut: false }),
    ).toBe("fast");
  });

  it("is slow beyond 75% of the estimated time", () => {
    expect(
      paceOf({ timeOnQuestionMs: 25_000, estimatedTimeSeconds: 30, timedOut: false }),
    ).toBe("slow");
  });

  it("treats a timeout as slow", () => {
    expect(
      paceOf({ timeOnQuestionMs: 1_000, estimatedTimeSeconds: 30, timedOut: true }),
    ).toBe("slow");
  });
});
