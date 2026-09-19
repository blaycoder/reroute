import type { PracticeItem } from "@/types/api";
import type { Question } from "@/types/question";

// What an Intervention row's contentJson holds. Only ids: the questions live in
// the question bank, so answer keys are never copied into the database.
export interface StoredIntervention {
  /** The diagnostic session this intervention's attempts count toward. */
  sessionId: string;
  guidedQuestionId: string;
  practiceQuestionIds: string[];
  reassessmentQuestionIds: string[];
}

/** Strips the answer key and distractor metadata before a question leaves the server. */
export function toPracticeItem(question: Question): PracticeItem {
  return {
    id: question.id,
    questionText: question.questionText,
    options: question.options,
    estimatedTimeSeconds: question.estimatedTimeSeconds,
  };
}
