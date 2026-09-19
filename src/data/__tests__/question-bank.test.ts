import { describe, expect, it } from "vitest";
import { listInterventionTemplates } from "@/data/interventions";
import {
  QUESTION_BANK,
  getQuestion,
  getQuestionsByPurpose,
} from "@/data/question-bank";

const TOPICS = ["Algebra", "Simultaneous Equations", "Indices", "Geometry"];
const LETTERS = ["A", "B", "C", "D"];

describe("question bank shape", () => {
  it("holds 40 questions: 12 diagnostic, 12 practice, 12 reassessment, 4 guided", () => {
    expect(QUESTION_BANK).toHaveLength(40);
    expect(getQuestionsByPurpose("diagnostic")).toHaveLength(12);
    expect(getQuestionsByPurpose("practice")).toHaveLength(12);
    expect(getQuestionsByPurpose("reassessment")).toHaveLength(12);
    expect(getQuestionsByPurpose("guided")).toHaveLength(4);
  });

  it("has unique ids", () => {
    expect(new Set(QUESTION_BANK.map((q) => q.id)).size).toBe(QUESTION_BANK.length);
  });

  it("balances every purpose across the four topics", () => {
    for (const topic of TOPICS) {
      expect(getQuestionsByPurpose("diagnostic").filter((q) => q.topic === topic)).toHaveLength(3);
      expect(getQuestionsByPurpose("practice").filter((q) => q.topic === topic)).toHaveLength(3);
      expect(getQuestionsByPurpose("reassessment").filter((q) => q.topic === topic)).toHaveLength(3);
      expect(getQuestionsByPurpose("guided").filter((q) => q.topic === topic)).toHaveLength(1);
    }
  });

  it("gives each diagnostic topic one easy, one medium and one hard question", () => {
    for (const topic of TOPICS) {
      const difficulties = getQuestionsByPurpose("diagnostic")
        .filter((q) => q.topic === topic)
        .map((q) => q.difficulty)
        .sort();
      expect(difficulties).toEqual(["easy", "hard", "medium"]);
    }
  });

  it("does not put the correct answer in the same place every time", () => {
    const positions = getQuestionsByPurpose("diagnostic").map((q) => q.correctOption);
    for (const letter of LETTERS) {
      expect(positions.filter((p) => p === letter)).toHaveLength(3);
    }
  });
});

describe("every question", () => {
  it.each(QUESTION_BANK.map((q) => [q.id, q] as const))(
    "%s has 4 options, 1 correct and 3 named distractors",
    (_id, question) => {
      expect(Object.keys(question.options)).toEqual(LETTERS);
      expect(LETTERS).toContain(question.correctOption);
      expect(question.distractors).toHaveLength(3);

      const distractorLetters = question.distractors.map((d) => d.option).sort();
      expect(distractorLetters).toEqual(
        LETTERS.filter((letter) => letter !== question.correctOption),
      );
      for (const distractor of question.distractors) {
        expect(distractor.misconception.length).toBeGreaterThan(0);
        expect(distractor.explanation.length).toBeGreaterThan(0);
        expect(["conceptual", "procedural", "application", "careless"]).toContain(
          distractor.errorType,
        );
      }

      // No two options may read the same.
      expect(new Set(Object.values(question.options)).size).toBe(4);
    },
  );

  it("uses 30 / 45 / 60 seconds for easy / medium / hard", () => {
    const expected = { easy: 30, medium: 45, hard: 60 } as const;
    for (const question of QUESTION_BANK) {
      expect(question.estimatedTimeSeconds).toBe(expected[question.difficulty]);
    }
  });
});

describe("intervention content", () => {
  it("has one lesson per topic", () => {
    expect(listInterventionTemplates().map((t) => t.topic).sort()).toEqual(
      [...TOPICS].sort(),
    );
  });

  it("points only at questions that exist, with the right purpose and topic", () => {
    for (const template of listInterventionTemplates()) {
      const guided = getQuestion(template.guidedQuestionId);
      expect(guided?.purpose).toBe("guided");
      expect(guided?.topic).toBe(template.topic);
      // The lesson text and the graded question must not drift apart.
      expect(guided?.questionText).toBe(template.guidedQuestion);

      expect(template.practiceQuestionIds).toHaveLength(3);
      for (const id of template.practiceQuestionIds) {
        expect(getQuestion(id)?.purpose).toBe("practice");
        expect(getQuestion(id)?.topic).toBe(template.topic);
      }
      expect(template.reassessmentQuestionIds).toHaveLength(3);
      for (const id of template.reassessmentQuestionIds) {
        expect(getQuestion(id)?.purpose).toBe("reassessment");
        expect(getQuestion(id)?.topic).toBe(template.topic);
      }
    }
  });
});
