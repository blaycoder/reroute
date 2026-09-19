import type { ErrorType } from "./learner-state";

export type QuestionPurpose =
  | "diagnostic"
  | "practice"
  | "reassessment"
  | "guided";

export type Difficulty = "easy" | "medium" | "hard";

export interface Distractor {
  option: string;
  /** Named misconception, e.g. "Sign error on the constant". */
  misconception: string;
  /** The deterministic prior for this wrong answer; the AI may override it. */
  errorType: ErrorType;
  explanation: string;
}

export interface Question {
  id: string;
  purpose: QuestionPurpose;
  subject: string;
  topic: string;
  subtopic: string;
  concept: string;
  difficulty: Difficulty;
  estimatedTimeSeconds: number;
  questionText: string; // may contain LaTeX
  options: Record<string, string>; // may contain LaTeX
  correctOption: string;
  distractors: Distractor[];
  explanation: string;
}
