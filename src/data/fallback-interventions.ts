import algebraPublic from "../../public/fallback/intervention-algebra.json";

// Server-side fallback intervention content, used when the LLM is
// unavailable or returns unusable output.
//
// The DISPLAY content for Algebra is single-sourced from
// /public/fallback/intervention-algebra.json (client-safe: no answers in it,
// so the frontend can also fetch it directly when the API is unreachable).
// This module adds practice/reassessment items (with correct options),
// answer keys and the guided hint — all server-only.
// Text may contain $...$ LaTeX. All answers hand-verified.

export interface FallbackPracticeItem {
  questionText: string;
  options: Record<string, string>;
  correctOption: string;
}

export interface FallbackAnswerKey {
  guided: string;
  practice: string[];
  reassessment: string[];
}

export interface FallbackIntervention {
  topic: string;
  /** Human phrase for the intervention headline. */
  conceptLabel: string;
  explanation: string;
  workedExample: string;
  guidedQuestion: string;
  /** Server-only: shown on a wrong guided answer, never states the answer. */
  guidedHint: string | null;
  practice: FallbackPracticeItem[];
  reassessment: FallbackPracticeItem[];
  answerKey: FallbackAnswerKey | null;
}

const algebra: FallbackIntervention = {
  topic: "Algebra",
  ...algebraPublic,
  conceptLabel: "distributing negative coefficients",
  guidedHint:
    "Watch the sign on the constant — $-4 \\times 2$ and $-4 \\times -3$ don't behave the same way.",
  practice: [
    {
      questionText: "Simplify $-2(x + 6)$",
      options: {
        A: "$-2x - 12$",
        B: "$-2x + 12$",
        C: "$-2x - 6$",
        D: "$2x - 12$",
      },
      correctOption: "A",
    },
    {
      questionText: "Simplify $-4(2x - 3)$",
      options: {
        A: "$-8x - 12$",
        B: "$-8x + 12$",
        C: "$-6x + 12$",
        D: "$-8x$",
      },
      correctOption: "B",
    },
    {
      questionText: "Simplify $-5(x + 1) + 2x$",
      options: {
        A: "$-3x + 5$",
        B: "$-7x - 5$",
        C: "$-3x - 5$",
        D: "$3x - 5$",
      },
      correctOption: "C",
    },
  ],
  reassessment: [
    {
      questionText: "Simplify $-3(4x - 1)$",
      options: {
        A: "$-12x - 3$",
        B: "$-12x + 3$",
        C: "$-11x - 3$",
        D: "$12x - 3$",
      },
      correctOption: "B",
    },
    {
      questionText: "Simplify $-6(x - 2) + 3x$",
      options: {
        A: "$-9x + 12$",
        B: "$-3x - 12$",
        C: "$3x + 12$",
        D: "$-3x + 12$",
      },
      correctOption: "D",
    },
  ],
  answerKey: {
    guided: "$-3x + 12$", // -3(x - 4)
    practice: ["A", "B", "C"],
    reassessment: ["B", "D"],
  },
};

const simultaneous: FallbackIntervention = {
  topic: "Simultaneous Equations",
  conceptLabel: "elimination sign slips",
  explanation:
    "Elimination works when adding or subtracting the two equations removes one variable. With $2x + y = 10$ and $x - y = 2$, the $+y$ and $-y$ cancel when you ADD: $3x = 12$, so $x = 4$. Signs decide everything: subtract when the coefficients match, add when they are opposites.",
  workedExample:
    "Solve $3x + y = 7$ and $x - y = 1$.\nStep 1: $y$ and $-y$ are opposites, so add the equations: $4x = 8$.\nStep 2: $x = 2$.\nStep 3: substitute back: $2 - y = 1$, so $y = 1$.",
  guidedQuestion:
    "In the system $2x + y = 8$ and $x - y = 1$: after adding the two equations, what single equation in $x$ do you get?",
  guidedHint:
    "Decide first whether to add or subtract — look at the signs on the term you want gone.",
  practice: [
    {
      questionText: "Solve for $x$: $x + y = 7$ and $x - y = 3$",
      options: {
        A: "$x = 2$",
        B: "$x = 10$",
        C: "$x = 4$",
        D: "$x = 5$",
      },
      correctOption: "D",
    },
    {
      questionText: "Solve for $y$: $x = 2y$ and $3x + y = 14$",
      options: {
        A: "$y = 2$",
        B: "$y = 4$",
        C: "$y = 2.33$",
        D: "$y = 7$",
      },
      correctOption: "A",
    },
    {
      questionText: "Solve for $x$: $2x + 3y = 12$ and $2x - y = 4$",
      options: {
        A: "$x = 1$",
        B: "$x = 3$",
        C: "$x = 4$",
        D: "$x = 2$",
      },
      correctOption: "B",
    },
  ],
  reassessment: [
    {
      questionText: "Solve for $x$: $2x + y = 9$ and $2x - y = 3$",
      options: {
        A: "$x = 3$",
        B: "$x = 6$",
        C: "$x = 12$",
        D: "$x = 0$",
      },
      correctOption: "A",
    },
    {
      questionText: "Solve for $y$: $x = y + 3$ and $2x + y = 9$",
      options: {
        A: "$y = 4$",
        B: "$y = 1$",
        C: "$y = 5$",
        D: "$y = 3$",
      },
      correctOption: "B",
    },
  ],
  answerKey: {
    guided: "$3x = 9$",
    practice: ["D", "A", "B"],
    reassessment: ["A", "B"],
  },
};

const indices: FallbackIntervention = {
  topic: "Indices",
  conceptLabel: "applying the index laws",
  explanation:
    "The index laws only merge exponents when the bases match: $a^m \\times a^n = a^{m+n}$ (multiply means add), $a^m \\div a^n = a^{m-n}$ (divide means subtract), and $(a^m)^n = a^{mn}$ (power of a power means multiply).",
  workedExample:
    "Simplify $(3^2)^3 \\div 3^4$.\nStep 1: power of a power: $(3^2)^3 = 3^6$.\nStep 2: divide means subtract: $3^6 \\div 3^4 = 3^2$.\nStep 3: $3^2 = 9$.",
  guidedQuestion: "Write $5^3 \\times 5^2$ as a single power of 5.",
  guidedHint:
    "Multiplying merges exponents by addition — check the bases match first.",
  practice: [
    {
      questionText: "Write $2^5 \\div 2^3$ as a power of 2",
      options: {
        A: "$2^8$",
        B: "$2^2$",
        C: "$2^{15}$",
        D: "$2^3$",
      },
      correctOption: "B",
    },
    {
      questionText: "Write $(3^2)^2$ as a single power of 3",
      options: {
        A: "$3^4$",
        B: "$3^8$",
        C: "$9^2$",
        D: "$3^2$",
      },
      correctOption: "A",
    },
    {
      questionText: "Write $5^2 \\times 5^3 \\div 5^4$ as a single power of 5",
      options: {
        A: "$5^5$",
        B: "$5^9$",
        C: "$5^1$",
        D: "$5^{10}$",
      },
      correctOption: "C",
    },
  ],
  reassessment: [
    {
      questionText: "Write $7^6 \\div 7^2$ as a power of 7",
      options: {
        A: "$7^8$",
        B: "$7^4$",
        C: "$7^3$",
        D: "$7^{12}$",
      },
      correctOption: "B",
    },
    {
      questionText: "Write $(2^2)^3 \\times 2$ as a power of 2",
      options: {
        A: "$2^6$",
        B: "$2^{12}$",
        C: "$2^7$",
        D: "$2^5$",
      },
      correctOption: "C",
    },
  ],
  answerKey: {
    guided: "$5^5$",
    practice: ["B", "A", "C"],
    reassessment: ["B", "C"],
  },
};

const geometry: FallbackIntervention = {
  topic: "Geometry",
  conceptLabel: "the triangle angle sum",
  explanation:
    "Angle facts: angles in a triangle sum to $180^\\circ$; angles on a straight line sum to $180^\\circ$; angles in a quadrilateral sum to $360^\\circ$. To find a missing triangle angle, subtract the angles you know from $180^\\circ$ — subtract BOTH of them, not just one.",
  workedExample:
    "A triangle has angles $90^\\circ$ and $35^\\circ$.\nStep 1: add the known angles: $90 + 35 = 125^\\circ$.\nStep 2: subtract from $180^\\circ$: $180 - 125 = 55^\\circ$.",
  guidedQuestion:
    "Two angles of a triangle are $70^\\circ$ and $50^\\circ$. What is the third angle? (Just the number.)",
  guidedHint:
    "Subtract both known angles from $180^\\circ$, one at a time.",
  practice: [
    {
      questionText:
        "A triangle has angles $x$, $80^\\circ$ and $60^\\circ$. Find $x$ (just the number).",
      options: {
        A: "$140$",
        B: "$40$",
        C: "$20$",
        D: "$220$",
      },
      correctOption: "B",
    },
    {
      questionText:
        "Three angles of a quadrilateral are $90^\\circ$, $85^\\circ$ and $95^\\circ$. Find the fourth angle (just the number).",
      options: {
        A: "$270$",
        B: "$80$",
        C: "$90$",
        D: "$185$",
      },
      correctOption: "C",
    },
    {
      questionText:
        "Two angles of a triangle are $72^\\circ$ and $39^\\circ$. Find the third angle (just the number).",
      options: {
        A: "$111$",
        B: "$69$",
        C: "$249$",
        D: "$41$",
      },
      correctOption: "B",
    },
  ],
  reassessment: [
    {
      questionText:
        "Two angles of a triangle are $85^\\circ$ and $52^\\circ$. Find the third angle (just the number).",
      options: {
        A: "$137$",
        B: "$43$",
        C: "$223$",
        D: "$33$",
      },
      correctOption: "B",
    },
    {
      questionText:
        "A right-angled triangle has one angle of $35^\\circ$. Find the other non-right angle (just the number).",
      options: {
        A: "$145$",
        B: "$35$",
        C: "$55$",
        D: "$65$",
      },
      correctOption: "C",
    },
  ],
  answerKey: {
    guided: "$60^\\circ$",
    practice: ["B", "C", "B"],
    reassessment: ["B", "C"],
  },
};

const generic: FallbackIntervention = {
  topic: "generic",
  conceptLabel: "the underlying basics",
  explanation:
    "Let's rebuild this topic from the ground up. Read the idea below, then follow the worked example one line at a time, asking 'why' at every step.",
  workedExample:
    "Work through one example of this topic from your class notes, checking each line against the method shown there.",
  guidedQuestion:
    "In one sentence: what do you think the key rule or idea of this topic is?",
  guidedHint: null,
  practice: [],
  reassessment: [],
  answerKey: null,
};

const BY_TOPIC: Record<string, FallbackIntervention> = {
  Algebra: algebra,
  "Simultaneous Equations": simultaneous,
  Indices: indices,
  Geometry: geometry,
};

/** Known topics get tailored content; anything else gets the generic scaffold. */
export function getFallbackIntervention(topic: string): FallbackIntervention {
  return BY_TOPIC[topic] ?? generic;
}
