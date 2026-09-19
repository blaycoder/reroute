export interface Distractor {
  option: string;
  misconception: string;
  explanation: string;
}

export interface Question {
  id: string;
  subject: string;
  topic: string;
  subtopic: string;
  concept: string;
  difficulty: "easy" | "medium" | "hard";
  estimatedTimeSeconds: number;
  questionText: string; // may contain LaTeX
  options: Record<string, string>; // may contain LaTeX
  correctOption: string;
  distractors: Distractor[];
  explanation: string;
}
