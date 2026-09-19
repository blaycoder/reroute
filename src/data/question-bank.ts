import type { ErrorType } from "@/types/learner-state";
import type { Difficulty, Question, QuestionPurpose } from "@/types/question";

// The single source of truth for every question in the product: 12 diagnostic,
// 12 practice, 12 reassessment and 4 guided. Nothing is generated on the fly —
// the LLM may explain, but it never writes or grades a question.
//
// Every wrong option is the result of a specific, named mistake, and carries
// the deterministic prior (`errorType`) the AI diagnosis weighs against the
// student's real telemetry. All answers were worked by hand; the test in
// __tests__/question-bank.test.ts guards the structural rules.

const LETTERS = ["A", "B", "C", "D"] as const;
type Letter = (typeof LETTERS)[number];

const ESTIMATED_SECONDS: Record<Difficulty, number> = {
  easy: 30,
  medium: 45,
  hard: 60,
};

// [option text, named misconception, error-type prior, why it is wrong]
type WrongAnswer = readonly [
  text: string,
  misconception: string,
  errorType: ErrorType,
  explanation: string,
];

interface QuestionSpec {
  id: string;
  purpose: QuestionPurpose;
  concept: ConceptInfo;
  difficulty: Difficulty;
  questionText: string;
  correct: string;
  /** Where the correct option sits — set per question so "A" is not always right. */
  correctAt: Letter;
  wrong: readonly [WrongAnswer, WrongAnswer, WrongAnswer];
  explanation: string;
}

interface ConceptInfo {
  topic: string;
  subtopic: string;
  concept: string;
}

const ALGEBRA: ConceptInfo = {
  topic: "Algebra",
  subtopic: "Expansion of Brackets",
  concept: "distributing_negative_coefficient",
};
const SIMULTANEOUS: ConceptInfo = {
  topic: "Simultaneous Equations",
  subtopic: "Elimination",
  concept: "elimination_of_a_variable",
};
const INDICES: ConceptInfo = {
  topic: "Indices",
  subtopic: "Laws of Indices",
  concept: "index_laws",
};
const GEOMETRY: ConceptInfo = {
  topic: "Geometry",
  subtopic: "Angles in a Triangle",
  concept: "triangle_angle_sum",
};

function question(spec: QuestionSpec): Question {
  const wrongLetters = LETTERS.filter((letter) => letter !== spec.correctAt);
  const byLetter: Record<string, string> = { [spec.correctAt]: spec.correct };
  const distractors = spec.wrong.map(
    ([text, misconception, errorType, explanation], index) => {
      const option = wrongLetters[index];
      byLetter[option] = text;
      return { option, misconception, errorType, explanation };
    },
  );
  return {
    id: spec.id,
    purpose: spec.purpose,
    subject: "Mathematics",
    topic: spec.concept.topic,
    subtopic: spec.concept.subtopic,
    concept: spec.concept.concept,
    difficulty: spec.difficulty,
    estimatedTimeSeconds: ESTIMATED_SECONDS[spec.difficulty],
    questionText: spec.questionText,
    options: Object.fromEntries(LETTERS.map((letter) => [letter, byLetter[letter]])),
    correctOption: spec.correctAt,
    distractors,
    explanation: spec.explanation,
  };
}

// ---------------------------------------------------------------------------
// Algebra — expansion of brackets
// ---------------------------------------------------------------------------

const algebra: Question[] = [
  question({
    id: "q_alg_001",
    purpose: "diagnostic",
    concept: ALGEBRA,
    difficulty: "easy",
    questionText: "Simplify $-2(x + 3)$",
    correct: "$-2x - 6$",
    correctAt: "B",
    wrong: [
      ["$-2x + 6$", "Sign error on the constant", "procedural", "$-2 \\times 3$ is $-6$. A negative times a positive is negative, so the constant's sign must flip too."],
      ["$2x + 6$", "Ignored the negative coefficient", "conceptual", "The $-2$ multiplies both terms, so the $x$ term becomes $-2x$, not $+2x$."],
      ["$-2x + 3$", "Did not distribute to the constant", "conceptual", "The $-2$ has to multiply the $3$ as well: $-2 \\times 3 = -6$."],
    ],
    explanation: "Distribute $-2$ to both terms: $-2 \\cdot x = -2x$ and $-2 \\cdot 3 = -6$.",
  }),
  question({
    id: "q_alg_002",
    purpose: "diagnostic",
    concept: ALGEBRA,
    difficulty: "medium",
    questionText: "Simplify $-3(2x - 5) - 4(x + 2)$",
    correct: "$-10x + 7$",
    correctAt: "D",
    wrong: [
      ["$-10x + 23$", "Sign error on the second bracket's constant", "procedural", "$-4 \\times 2$ is $-8$, not $+8$. Then $15 - 8 = 7$."],
      ["$-2x + 7$", "Subtracted the x coefficients", "procedural", "$-6x$ and $-4x$ combine to $-10x$; they are not subtracted from each other."],
      ["$-2x + 23$", "Both errors combined", "procedural", "Two slips at once: the $x$ terms were subtracted and $-4 \\times 2$ was taken as $+8$."],
    ],
    explanation: "$-6x + 15 - 4x - 8 = -10x + 7$.",
  }),
  question({
    id: "q_alg_003",
    purpose: "diagnostic",
    concept: ALGEBRA,
    difficulty: "hard",
    questionText: "Simplify $4(2x - 3) - 3(3x - 5)$",
    correct: "$-x + 3$",
    correctAt: "A",
    wrong: [
      ["$-x - 27$", "Sign error on the second bracket's constant", "procedural", "$-3 \\times -5$ is $+15$, not $-15$."],
      ["$17x - 27$", "Sign errors on both terms of the second bracket", "conceptual", "The $-3$ flips the sign of both terms: $-3 \\cdot 3x = -9x$ and $-3 \\cdot -5 = +15$."],
      ["$17x + 3$", "Sign error on the x term only", "procedural", "$-3 \\cdot 3x$ is $-9x$, not $+9x$, so $8x - 9x = -x$."],
    ],
    explanation: "$8x - 12 - 9x + 15 = -x + 3$.",
  }),
  question({
    id: "p_alg_001",
    purpose: "practice",
    concept: ALGEBRA,
    difficulty: "easy",
    questionText: "Simplify $-4(x + 2)$",
    correct: "$-4x - 8$",
    correctAt: "C",
    wrong: [
      ["$-4x + 8$", "Sign error on the constant", "procedural", "$-4 \\times 2$ is $-8$, not $+8$."],
      ["$4x + 8$", "Ignored the negative coefficient", "conceptual", "The $-4$ multiplies both terms, so both signs flip."],
      ["$-4x + 2$", "Did not distribute to the constant", "conceptual", "The $-4$ has to multiply the $2$ as well."],
    ],
    explanation: "$-4 \\cdot x = -4x$ and $-4 \\cdot 2 = -8$.",
  }),
  question({
    id: "p_alg_002",
    purpose: "practice",
    concept: ALGEBRA,
    difficulty: "medium",
    questionText: "Simplify $-2(3x - 4) - 5(x + 1)$",
    correct: "$-11x + 3$",
    correctAt: "A",
    wrong: [
      ["$-11x + 13$", "Sign error on the second bracket's constant", "procedural", "$-5 \\times 1$ is $-5$, not $+5$."],
      ["$-x + 3$", "Subtracted the x coefficients", "procedural", "$-6x$ and $-5x$ combine to $-11x$."],
      ["$-x + 13$", "Both errors combined", "procedural", "The $x$ terms were subtracted and $-5 \\times 1$ was taken as $+5$."],
    ],
    explanation: "$-6x + 8 - 5x - 5 = -11x + 3$.",
  }),
  question({
    id: "p_alg_003",
    purpose: "practice",
    concept: ALGEBRA,
    difficulty: "hard",
    questionText: "Simplify $5(2x - 1) - 2(4x - 3)$",
    correct: "$2x + 1$",
    correctAt: "D",
    wrong: [
      ["$2x - 11$", "Sign error on the second bracket's constant", "procedural", "$-2 \\times -3$ is $+6$, not $-6$."],
      ["$18x - 11$", "Sign errors on both terms of the second bracket", "conceptual", "The $-2$ flips both terms: $-8x$ and $+6$."],
      ["$18x + 1$", "Sign error on the x term only", "procedural", "$-2 \\cdot 4x$ is $-8x$, not $+8x$."],
    ],
    explanation: "$10x - 5 - 8x + 6 = 2x + 1$.",
  }),
  question({
    id: "r_alg_001",
    purpose: "reassessment",
    concept: ALGEBRA,
    difficulty: "medium",
    questionText: "Simplify $-3(x + 5) + 2(x - 1)$",
    correct: "$-x - 17$",
    correctAt: "B",
    wrong: [
      ["$-x + 13$", "Sign error on the first bracket's constant", "procedural", "$-3 \\times 5$ is $-15$, not $+15$."],
      ["$-5x - 17$", "Subtracted the x coefficients", "procedural", "$-3x + 2x$ is $-x$, not $-5x$."],
      ["$-x - 16$", "Did not distribute to the second bracket's constant", "conceptual", "The $2$ multiplies both terms: $2 \\times -1 = -2$."],
    ],
    explanation: "$-3x - 15 + 2x - 2 = -x - 17$.",
  }),
  question({
    id: "r_alg_002",
    purpose: "reassessment",
    concept: ALGEBRA,
    difficulty: "hard",
    questionText: "Simplify $2(3x - 4) - 4(x - 2)$",
    correct: "$2x$",
    correctAt: "C",
    wrong: [
      ["$2x - 16$", "Sign error on the second bracket's constant", "procedural", "$-4 \\times -2$ is $+8$, not $-8$."],
      ["$10x - 16$", "Sign errors on both terms of the second bracket", "conceptual", "The $-4$ flips both terms: $-4x$ and $+8$."],
      ["$10x$", "Sign error on the x term only", "procedural", "$-4 \\cdot x$ is $-4x$, not $+4x$."],
    ],
    explanation: "$6x - 8 - 4x + 8 = 2x$.",
  }),
  question({
    id: "r_alg_003",
    purpose: "reassessment",
    concept: ALGEBRA,
    difficulty: "medium",
    questionText: "Simplify $-5(2x - 3) + 3(x + 4)$",
    correct: "$-7x + 27$",
    correctAt: "A",
    wrong: [
      ["$-7x - 3$", "Sign error on the first bracket's constant", "procedural", "$-5 \\times -3$ is $+15$, not $-15$."],
      ["$-13x + 27$", "Subtracted the x coefficients", "procedural", "$-10x + 3x$ is $-7x$."],
      ["$-7x + 19$", "Did not distribute to the second bracket's constant", "conceptual", "The $3$ multiplies the $4$ too: $3 \\times 4 = 12$."],
    ],
    explanation: "$-10x + 15 + 3x + 12 = -7x + 27$.",
  }),
  question({
    id: "g_alg_001",
    purpose: "guided",
    concept: ALGEBRA,
    difficulty: "medium",
    questionText: "Now try: what is $-3(x - 4)$?",
    correct: "$-3x + 12$",
    correctAt: "D",
    wrong: [
      ["$-3x - 12$", "Sign error on the constant", "procedural", "$-3 \\times -4$ is $+12$: a negative times a negative is positive."],
      ["$3x + 12$", "Ignored the negative coefficient", "conceptual", "The $-3$ multiplies the $x$ too, giving $-3x$."],
      ["$-3x - 4$", "Did not distribute to the constant", "conceptual", "The $-3$ has to multiply the $-4$ as well."],
    ],
    explanation: "$-3 \\cdot x = -3x$ and $-3 \\cdot -4 = +12$.",
  }),
];

// ---------------------------------------------------------------------------
// Simultaneous equations — elimination
// ---------------------------------------------------------------------------

const simultaneous: Question[] = [
  question({
    id: "q_sim_001",
    purpose: "diagnostic",
    concept: SIMULTANEOUS,
    difficulty: "easy",
    questionText: "Solve: $x + y = 7$ and $x - y = 1$",
    correct: "$x = 4, y = 3$",
    correctAt: "C",
    wrong: [
      ["$x = 3, y = 4$", "Swapped x and y", "careless", "Adding the equations gives $2x = 8$, so $x = 4$ and $y = 3$ — the values were the wrong way round."],
      ["$x = 6, y = 1$", "Checked only the first equation", "application", "$6 + 1 = 7$ works, but $6 - 1 = 5$, not $1$. Both equations must hold."],
      ["$x = 8, y = -1$", "Forgot to divide after eliminating", "procedural", "Adding gives $2x = 8$, so $x = 4$ — the $2$ still has to be divided out."],
    ],
    explanation: "Add the equations: $2x = 8$, so $x = 4$. Then $4 + y = 7$ gives $y = 3$.",
  }),
  question({
    id: "q_sim_002",
    purpose: "diagnostic",
    concept: SIMULTANEOUS,
    difficulty: "medium",
    questionText: "Solve: $2x + y = 10$ and $x - y = 2$",
    correct: "$x = 4, y = 2$",
    correctAt: "B",
    wrong: [
      ["$x = 12, y = -14$", "Forgot to divide after eliminating", "procedural", "Adding gives $3x = 12$, so $x = 4$ — the $3$ has to be divided out."],
      ["$x = 2, y = 4$", "Swapped x and y", "careless", "Check: $2(2) + 4 = 8$, not $10$. The values were the wrong way round."],
      ["$x = 3, y = 4$", "Checked only the first equation", "application", "$2(3) + 4 = 10$ works, but $3 - 4 = -1$, not $2$."],
    ],
    explanation: "Add the equations: $3x = 12$, so $x = 4$. Then $4 - y = 2$ gives $y = 2$.",
  }),
  question({
    id: "q_sim_003",
    purpose: "diagnostic",
    concept: SIMULTANEOUS,
    difficulty: "hard",
    questionText: "Solve: $3x + 2y = 16$ and $2x - 3y = -11$",
    correct: "$x = 2, y = 5$",
    correctAt: "D",
    wrong: [
      ["$x = 5, y = 2$", "Swapped x and y", "careless", "Check: $3(5) + 2(2) = 19$, not $16$."],
      ["$x = 4, y = 2$", "Checked only the first equation", "application", "$3(4) + 2(2) = 16$ works, but $2(4) - 3(2) = 2$, not $-11$."],
      ["$x = 2, y = -5$", "Sign error when solving for y", "careless", "$2y = 16 - 6 = 10$, so $y = +5$."],
    ],
    explanation: "Multiply to match $y$: $9x + 6y = 48$ and $4x - 6y = -22$. Add: $13x = 26$, so $x = 2$, then $y = 5$.",
  }),
  question({
    id: "p_sim_001",
    purpose: "practice",
    concept: SIMULTANEOUS,
    difficulty: "easy",
    questionText: "Solve: $x + y = 9$ and $x - y = 3$",
    correct: "$x = 6, y = 3$",
    correctAt: "A",
    wrong: [
      ["$x = 3, y = 6$", "Swapped x and y", "careless", "Check: $3 - 6 = -3$, not $3$."],
      ["$x = 12, y = -3$", "Forgot to divide after eliminating", "procedural", "Adding gives $2x = 12$, so $x = 6$."],
      ["$x = 7, y = 2$", "Checked only the first equation", "application", "$7 + 2 = 9$ works, but $7 - 2 = 5$, not $3$."],
    ],
    explanation: "Add the equations: $2x = 12$, so $x = 6$. Then $6 + y = 9$ gives $y = 3$.",
  }),
  question({
    id: "p_sim_002",
    purpose: "practice",
    concept: SIMULTANEOUS,
    difficulty: "medium",
    questionText: "Solve: $3x + y = 11$ and $x - y = 1$",
    correct: "$x = 3, y = 2$",
    correctAt: "D",
    wrong: [
      ["$x = 2, y = 3$", "Swapped x and y", "careless", "Check: $3(2) + 3 = 9$, not $11$."],
      ["$x = 12, y = -25$", "Forgot to divide after eliminating", "procedural", "Adding gives $4x = 12$, so $x = 3$."],
      ["$x = 4, y = -1$", "Checked only the first equation", "application", "$3(4) - 1 = 11$ works, but $4 - (-1) = 5$, not $1$."],
    ],
    explanation: "Add the equations: $4x = 12$, so $x = 3$. Then $3 - y = 1$ gives $y = 2$.",
  }),
  question({
    id: "p_sim_003",
    purpose: "practice",
    concept: SIMULTANEOUS,
    difficulty: "hard",
    questionText: "Solve: $2x + 3y = 13$ and $3x - 2y = 0$",
    correct: "$x = 2, y = 3$",
    correctAt: "B",
    wrong: [
      ["$x = 3, y = 2$", "Swapped x and y", "careless", "Check: $2(3) + 3(2) = 12$, not $13$."],
      ["$x = 5, y = 1$", "Checked only the first equation", "application", "$2(5) + 3(1) = 13$ works, but $3(5) - 2(1) = 13$, not $0$."],
      ["$x = 2, y = -3$", "Sign error when solving for y", "careless", "Check: $2(2) + 3(-3) = -5$, not $13$. $y$ is $+3$."],
    ],
    explanation: "Multiply to match $y$: $4x + 6y = 26$ and $9x - 6y = 0$. Add: $13x = 26$, so $x = 2$, then $y = 3$.",
  }),
  question({
    id: "r_sim_001",
    purpose: "reassessment",
    concept: SIMULTANEOUS,
    difficulty: "medium",
    questionText: "Solve: $x + 2y = 8$ and $x - y = 2$",
    correct: "$x = 4, y = 2$",
    correctAt: "C",
    wrong: [
      ["$x = 2, y = 4$", "Swapped x and y", "careless", "Check: $2 + 2(4) = 10$, not $8$."],
      ["$x = 6, y = 1$", "Checked only the first equation", "application", "$6 + 2(1) = 8$ works, but $6 - 1 = 5$, not $2$."],
      ["$x = 8, y = 6$", "Forgot to divide after eliminating", "procedural", "Subtracting gives $3y = 6$, so $y = 2$ — the $3$ has to be divided out."],
    ],
    explanation: "Subtract the equations: $3y = 6$, so $y = 2$. Then $x - 2 = 2$ gives $x = 4$.",
  }),
  question({
    id: "r_sim_002",
    purpose: "reassessment",
    concept: SIMULTANEOUS,
    difficulty: "hard",
    questionText: "Solve: $4x + 3y = 18$ and $2x - y = 4$",
    correct: "$x = 3, y = 2$",
    correctAt: "A",
    wrong: [
      ["$x = 2, y = 3$", "Swapped x and y", "careless", "Check: $4(2) + 3(3) = 17$, not $18$."],
      ["$x = 6, y = -2$", "Checked only the first equation", "application", "$4(6) + 3(-2) = 18$ works, but $2(6) - (-2) = 14$, not $4$."],
      ["$x = 3, y = -2$", "Sign error when solving for y", "careless", "From $2x - y = 4$: $y = 2x - 4 = 2$, not $-2$."],
    ],
    explanation: "From the second equation $y = 2x - 4$. Substitute: $4x + 6x - 12 = 18$, so $x = 3$ and $y = 2$.",
  }),
  question({
    id: "r_sim_003",
    purpose: "reassessment",
    concept: SIMULTANEOUS,
    difficulty: "medium",
    questionText: "Solve: $3x + y = 14$ and $x + y = 6$",
    correct: "$x = 4, y = 2$",
    correctAt: "B",
    wrong: [
      ["$x = 2, y = 4$", "Swapped x and y", "careless", "Check: $3(2) + 4 = 10$, not $14$."],
      ["$x = 5, y = -1$", "Checked only the first equation", "application", "$3(5) - 1 = 14$ works, but $5 - 1 = 4$, not $6$."],
      ["$x = 8, y = -2$", "Forgot to divide after eliminating", "procedural", "Subtracting gives $2x = 8$, so $x = 4$."],
    ],
    explanation: "Subtract the equations: $2x = 8$, so $x = 4$. Then $4 + y = 6$ gives $y = 2$.",
  }),
  question({
    id: "g_sim_001",
    purpose: "guided",
    concept: SIMULTANEOUS,
    difficulty: "medium",
    questionText: "Now try: solve $x + y = 10$ and $x - y = 4$. Write it as x = ..., y = ...",
    correct: "$x = 7, y = 3$",
    correctAt: "C",
    wrong: [
      ["$x = 3, y = 7$", "Swapped x and y", "careless", "Check: $3 - 7 = -4$, not $4$."],
      ["$x = 14, y = -4$", "Forgot to divide after eliminating", "procedural", "Adding gives $2x = 14$, so $x = 7$."],
      ["$x = 8, y = 2$", "Checked only the first equation", "application", "$8 + 2 = 10$ works, but $8 - 2 = 6$, not $4$."],
    ],
    explanation: "Add the equations: $2x = 14$, so $x = 7$. Then $7 + y = 10$ gives $y = 3$.",
  }),
];

// ---------------------------------------------------------------------------
// Indices — laws of indices
// ---------------------------------------------------------------------------

const indices: Question[] = [
  question({
    id: "q_ind_001",
    purpose: "diagnostic",
    concept: INDICES,
    difficulty: "easy",
    questionText: "Simplify $2^3 \\times 2^4$",
    correct: "$128$",
    correctAt: "A",
    wrong: [
      ["$4096$", "Multiplied the powers instead of adding", "conceptual", "Same base means add the powers: $3 + 4 = 7$, not $3 \\times 4 = 12$."],
      ["$16384$", "Multiplied the bases", "conceptual", "The base stays $2$. Only the powers combine: $2^{3+4} = 2^7$."],
      ["$14$", "Multiplied the base by the power", "conceptual", "$2^7$ means $2$ multiplied by itself $7$ times, which is $128$, not $2 \\times 7$."],
    ],
    explanation: "Same base, so add the powers: $2^{3+4} = 2^7 = 128$.",
  }),
  question({
    id: "q_ind_002",
    purpose: "diagnostic",
    concept: INDICES,
    difficulty: "medium",
    questionText: "Simplify $(2^3)^2 \\div 2^4$",
    correct: "$4$",
    correctAt: "C",
    wrong: [
      ["$2$", "Added the powers instead of multiplying", "conceptual", "A power of a power multiplies: $(2^3)^2 = 2^6$, not $2^5$."],
      ["$1024$", "Multiplied instead of dividing", "conceptual", "Dividing powers of the same base subtracts the exponents: $2^{6-4}$."],
      ["$16$", "Divided by the power instead of by the number", "procedural", "Dividing by $2^4$ means subtracting exponents ($6 - 4 = 2$), not dividing $64$ by $4$."],
    ],
    explanation: "$(2^3)^2 = 2^6$, then $2^6 \\div 2^4 = 2^{6-4} = 2^2 = 4$.",
  }),
  question({
    id: "q_ind_003",
    purpose: "diagnostic",
    concept: INDICES,
    difficulty: "hard",
    questionText: "Simplify $(2^2)^3 \\times 2^{-4}$",
    correct: "$4$",
    correctAt: "B",
    wrong: [
      ["$1024$", "Treated the negative power as positive", "conceptual", "$2^{-4}$ means dividing by $2^4$, so the exponents combine as $6 - 4$, not $6 + 4$."],
      ["$\\frac{1}{4}$", "Subtracted the powers in the wrong order", "procedural", "The exponents are $6$ and $-4$, so $6 + (-4) = 2$, not $-2$."],
      ["$2$", "Added the powers instead of multiplying", "conceptual", "A power of a power multiplies: $(2^2)^3 = 2^6$, not $2^5$."],
    ],
    explanation: "$(2^2)^3 = 2^6$, then $2^6 \\times 2^{-4} = 2^{6-4} = 2^2 = 4$.",
  }),
  question({
    id: "p_ind_001",
    purpose: "practice",
    concept: INDICES,
    difficulty: "easy",
    questionText: "Simplify $3^2 \\times 3^3$",
    correct: "$243$",
    correctAt: "D",
    wrong: [
      ["$729$", "Multiplied the powers instead of adding", "conceptual", "Same base means add the powers: $2 + 3 = 5$, not $2 \\times 3 = 6$."],
      ["$59049$", "Multiplied the bases", "conceptual", "The base stays $3$; only the powers combine."],
      ["$15$", "Multiplied the base by the power", "conceptual", "$3^5$ is $3$ multiplied by itself $5$ times."],
    ],
    explanation: "Same base, so add the powers: $3^{2+3} = 3^5 = 243$.",
  }),
  question({
    id: "p_ind_002",
    purpose: "practice",
    concept: INDICES,
    difficulty: "medium",
    questionText: "Simplify $(3^2)^3 \\div 3^4$",
    correct: "$9$",
    correctAt: "B",
    wrong: [
      ["$3$", "Added the powers instead of multiplying", "conceptual", "A power of a power multiplies: $(3^2)^3 = 3^6$."],
      ["$59049$", "Multiplied instead of dividing", "conceptual", "Dividing powers of the same base subtracts the exponents."],
      ["$\\frac{1}{9}$", "Subtracted the powers in the wrong order", "procedural", "It is $6 - 4 = 2$, not $4 - 6 = -2$."],
    ],
    explanation: "$(3^2)^3 = 3^6$, then $3^6 \\div 3^4 = 3^2 = 9$.",
  }),
  question({
    id: "p_ind_003",
    purpose: "practice",
    concept: INDICES,
    difficulty: "hard",
    questionText: "Simplify $(3^3)^2 \\times 3^{-4}$",
    correct: "$9$",
    correctAt: "C",
    wrong: [
      ["$59049$", "Treated the negative power as positive", "conceptual", "$3^{-4}$ means dividing by $3^4$: the exponents combine as $6 - 4$."],
      ["$\\frac{1}{9}$", "Subtracted the powers in the wrong order", "procedural", "$6 + (-4) = 2$, not $-2$."],
      ["$3$", "Added the powers instead of multiplying", "conceptual", "A power of a power multiplies: $(3^3)^2 = 3^6$, not $3^5$."],
    ],
    explanation: "$(3^3)^2 = 3^6$, then $3^6 \\times 3^{-4} = 3^2 = 9$.",
  }),
  question({
    id: "r_ind_001",
    purpose: "reassessment",
    concept: INDICES,
    difficulty: "medium",
    questionText: "Simplify $(2^2)^3 \\div 2^5$",
    correct: "$2$",
    correctAt: "A",
    wrong: [
      ["$1$", "Added the powers instead of multiplying", "conceptual", "A power of a power multiplies: $(2^2)^3 = 2^6$, not $2^5$."],
      ["$2048$", "Multiplied instead of dividing", "conceptual", "Dividing powers of the same base subtracts the exponents."],
      ["$\\frac{1}{2}$", "Subtracted the powers in the wrong order", "procedural", "It is $6 - 5 = 1$, not $5 - 6 = -1$."],
    ],
    explanation: "$(2^2)^3 = 2^6$, then $2^6 \\div 2^5 = 2^1 = 2$.",
  }),
  question({
    id: "r_ind_002",
    purpose: "reassessment",
    concept: INDICES,
    difficulty: "hard",
    questionText: "Simplify $(2^3)^2 \\times 2^{-5}$",
    correct: "$2$",
    correctAt: "D",
    wrong: [
      ["$2048$", "Treated the negative power as positive", "conceptual", "$2^{-5}$ means dividing by $2^5$: the exponents combine as $6 - 5$."],
      ["$\\frac{1}{2}$", "Subtracted the powers in the wrong order", "procedural", "$6 + (-5) = 1$, not $-1$."],
      ["$1$", "Added the powers instead of multiplying", "conceptual", "A power of a power multiplies: $(2^3)^2 = 2^6$, not $2^5$."],
    ],
    explanation: "$(2^3)^2 = 2^6$, then $2^6 \\times 2^{-5} = 2^1 = 2$.",
  }),
  question({
    id: "r_ind_003",
    purpose: "reassessment",
    concept: INDICES,
    difficulty: "medium",
    questionText: "Simplify $3^4 \\times 3^2 \\div 3^3$",
    correct: "$27$",
    correctAt: "C",
    wrong: [
      ["$19683$", "Added all three powers", "conceptual", "Multiply adds the powers but divide subtracts: $4 + 2 - 3 = 3$."],
      ["$81$", "Subtracted the wrong power", "careless", "The last power is $3$: $4 + 2 - 3 = 3$, not $4 + 2 - 2$."],
      ["$\\frac{1}{27}$", "Subtracted the powers in the wrong order", "procedural", "It is $6 - 3 = 3$, not $3 - 6 = -3$."],
    ],
    explanation: "$3^4 \\times 3^2 = 3^6$, then $3^6 \\div 3^3 = 3^3 = 27$.",
  }),
  question({
    id: "g_ind_001",
    purpose: "guided",
    concept: INDICES,
    difficulty: "medium",
    questionText: "Now try: simplify $3^2 \\times 3^4$.",
    correct: "$729$",
    correctAt: "A",
    wrong: [
      ["$6561$", "Multiplied the powers instead of adding", "conceptual", "Same base means add the powers: $2 + 4 = 6$, not $2 \\times 4 = 8$."],
      ["$531441$", "Multiplied the bases", "conceptual", "The base stays $3$; only the powers combine."],
      ["$18$", "Multiplied the base by the power", "conceptual", "$3^6$ is $3$ multiplied by itself $6$ times."],
    ],
    explanation: "Same base, so add the powers: $3^{2+4} = 3^6 = 729$.",
  }),
];

// ---------------------------------------------------------------------------
// Geometry — angles in a triangle
// ---------------------------------------------------------------------------

const geometry: Question[] = [
  question({
    id: "q_geo_001",
    purpose: "diagnostic",
    concept: GEOMETRY,
    difficulty: "easy",
    questionText: "The angles of a triangle are $x^\\circ$, $2x^\\circ$ and $3x^\\circ$. Find $x$.",
    correct: "$30^\\circ$",
    correctAt: "D",
    wrong: [
      ["$60^\\circ$", "Used only the largest angle", "conceptual", "All three angles share the $180^\\circ$, not just $3x$."],
      ["$45^\\circ$", "Added the coefficients as 4", "procedural", "$1 + 2 + 3 = 6$, so $6x = 180$."],
      ["$36^\\circ$", "Added the coefficients as 5", "procedural", "$1 + 2 + 3 = 6$, so $6x = 180$."],
    ],
    explanation: "The angles add to $180^\\circ$: $x + 2x + 3x = 6x = 180$, so $x = 30$.",
  }),
  question({
    id: "q_geo_002",
    purpose: "diagnostic",
    concept: GEOMETRY,
    difficulty: "medium",
    questionText: "Two angles of a triangle are $45^\\circ$ and $65^\\circ$. Find the third angle.",
    correct: "$70^\\circ$",
    correctAt: "A",
    wrong: [
      ["$110^\\circ$", "Stopped after adding the angles", "procedural", "$45 + 65 = 110$ is the angles you know. Subtract it from $180^\\circ$."],
      ["$115^\\circ$", "Subtracted only one angle from 180°", "procedural", "Both known angles come off the $180^\\circ$."],
      ["$20^\\circ$", "Subtracted the angles from each other", "conceptual", "The angles in a triangle add up; they are not subtracted from each other."],
    ],
    explanation: "$180 - (45 + 65) = 180 - 110 = 70$.",
  }),
  question({
    id: "q_geo_003",
    purpose: "diagnostic",
    concept: GEOMETRY,
    difficulty: "hard",
    questionText:
      "In a triangle the second angle is twice the first, and the third angle is $40^\\circ$ more than the first. Find the first angle.",
    correct: "$35^\\circ$",
    correctAt: "C",
    wrong: [
      ["$45^\\circ$", "Ignored the extra degrees", "procedural", "The third angle is $x + 40$, so the total is $4x + 40 = 180$."],
      ["$70^\\circ$", "Gave the second angle instead of the first", "careless", "$70^\\circ$ is $2x$. The question asks for $x$."],
      ["$75^\\circ$", "Gave the third angle instead of the first", "careless", "$75^\\circ$ is $x + 40$. The question asks for $x$."],
    ],
    explanation: "$x + 2x + (x + 40) = 180$, so $4x = 140$ and $x = 35$.",
  }),
  question({
    id: "p_geo_001",
    purpose: "practice",
    concept: GEOMETRY,
    difficulty: "easy",
    questionText: "The angles of a triangle are $x^\\circ$, $x^\\circ$ and $2x^\\circ$. Find $x$.",
    correct: "$45^\\circ$",
    correctAt: "B",
    wrong: [
      ["$60^\\circ$", "Added the coefficients as 3", "procedural", "$1 + 1 + 2 = 4$, so $4x = 180$."],
      ["$90^\\circ$", "Gave the largest angle instead of x", "careless", "$90^\\circ$ is $2x$. The question asks for $x$."],
      ["$36^\\circ$", "Added the coefficients as 5", "procedural", "$1 + 1 + 2 = 4$, so $4x = 180$."],
    ],
    explanation: "$x + x + 2x = 4x = 180$, so $x = 45$.",
  }),
  question({
    id: "p_geo_002",
    purpose: "practice",
    concept: GEOMETRY,
    difficulty: "medium",
    questionText: "Two angles of a triangle are $52^\\circ$ and $71^\\circ$. Find the third angle.",
    correct: "$57^\\circ$",
    correctAt: "C",
    wrong: [
      ["$123^\\circ$", "Stopped after adding the angles", "procedural", "$52 + 71 = 123$ is the known angles. Subtract it from $180^\\circ$."],
      ["$128^\\circ$", "Subtracted only one angle from 180°", "procedural", "Both known angles come off the $180^\\circ$."],
      ["$19^\\circ$", "Subtracted the angles from each other", "conceptual", "The angles in a triangle add up."],
    ],
    explanation: "$180 - (52 + 71) = 180 - 123 = 57$.",
  }),
  question({
    id: "p_geo_003",
    purpose: "practice",
    concept: GEOMETRY,
    difficulty: "hard",
    questionText:
      "In a triangle the second angle is three times the first, and the third angle is $20^\\circ$ more than the first. Find the first angle.",
    correct: "$32^\\circ$",
    correctAt: "A",
    wrong: [
      ["$36^\\circ$", "Ignored the extra degrees", "procedural", "The third angle is $x + 20$, so the total is $5x + 20 = 180$."],
      ["$96^\\circ$", "Gave the second angle instead of the first", "careless", "$96^\\circ$ is $3x$. The question asks for $x$."],
      ["$52^\\circ$", "Gave the third angle instead of the first", "careless", "$52^\\circ$ is $x + 20$. The question asks for $x$."],
    ],
    explanation: "$x + 3x + (x + 20) = 180$, so $5x = 160$ and $x = 32$.",
  }),
  question({
    id: "r_geo_001",
    purpose: "reassessment",
    concept: GEOMETRY,
    difficulty: "medium",
    questionText: "The angles of a triangle are $x^\\circ$, $3x^\\circ$ and $5x^\\circ$. Find $x$.",
    correct: "$20^\\circ$",
    correctAt: "D",
    wrong: [
      ["$36^\\circ$", "Used only the largest coefficient", "conceptual", "All three angles share the $180^\\circ$: $1 + 3 + 5 = 9$."],
      ["$60^\\circ$", "Used only the middle coefficient", "conceptual", "All three angles share the $180^\\circ$: $1 + 3 + 5 = 9$."],
      ["$45^\\circ$", "Added the coefficients as 4", "procedural", "$1 + 3 + 5 = 9$, so $9x = 180$."],
    ],
    explanation: "$x + 3x + 5x = 9x = 180$, so $x = 20$.",
  }),
  question({
    id: "r_geo_002",
    purpose: "reassessment",
    concept: GEOMETRY,
    difficulty: "hard",
    questionText:
      "In a triangle the second angle is twice the first, and the third angle is $20^\\circ$ less than the first. Find the first angle.",
    correct: "$50^\\circ$",
    correctAt: "B",
    wrong: [
      ["$45^\\circ$", "Ignored the difference in the third angle", "procedural", "The third angle is $x - 20$, so the total is $4x - 20 = 180$."],
      ["$100^\\circ$", "Gave the second angle instead of the first", "careless", "$100^\\circ$ is $2x$. The question asks for $x$."],
      ["$30^\\circ$", "Gave the third angle instead of the first", "careless", "$30^\\circ$ is $x - 20$. The question asks for $x$."],
    ],
    explanation: "$x + 2x + (x - 20) = 180$, so $4x = 200$ and $x = 50$.",
  }),
  question({
    id: "r_geo_003",
    purpose: "reassessment",
    concept: GEOMETRY,
    difficulty: "medium",
    questionText: "Two angles of a triangle are $38^\\circ$ and $84^\\circ$. Find the third angle.",
    correct: "$58^\\circ$",
    correctAt: "A",
    wrong: [
      ["$122^\\circ$", "Stopped after adding the angles", "procedural", "$38 + 84 = 122$ is the known angles. Subtract it from $180^\\circ$."],
      ["$142^\\circ$", "Subtracted only one angle from 180°", "procedural", "Both known angles come off the $180^\\circ$."],
      ["$46^\\circ$", "Subtracted the angles from each other", "conceptual", "The angles in a triangle add up."],
    ],
    explanation: "$180 - (38 + 84) = 180 - 122 = 58$.",
  }),
  question({
    id: "g_geo_001",
    purpose: "guided",
    concept: GEOMETRY,
    difficulty: "medium",
    questionText:
      "Now try: two angles of a triangle are $40^\\circ$ and $60^\\circ$. What is the third angle?",
    correct: "$80^\\circ$",
    correctAt: "B",
    wrong: [
      ["$100^\\circ$", "Stopped after adding the angles", "procedural", "$40 + 60 = 100$ is the known angles. Subtract it from $180^\\circ$."],
      ["$140^\\circ$", "Subtracted only one angle from 180°", "procedural", "Both known angles come off the $180^\\circ$."],
      ["$20^\\circ$", "Subtracted the angles from each other", "conceptual", "The angles in a triangle add up."],
    ],
    explanation: "$180 - (40 + 60) = 180 - 100 = 80$.",
  }),
];

export const QUESTION_BANK: Question[] = [
  ...algebra,
  ...simultaneous,
  ...indices,
  ...geometry,
];

const BY_ID = new Map(QUESTION_BANK.map((q) => [q.id, q]));

export function getQuestion(id: string): Question | undefined {
  return BY_ID.get(id);
}

export function getQuestionsByPurpose(purpose: QuestionPurpose): Question[] {
  return QUESTION_BANK.filter((q) => q.purpose === purpose);
}
