import type { Difficulty, Question } from "@/types/question";

// Adaptive routing for the diagnostic. Pure and deterministic: given the
// diagnostic pool and what this student has answered so far, it returns the
// next question. Nothing here is seeded or scripted — two students with
// different answers get different sequences.

/** Every new diagnostic starts here, so students share a baseline. */
export const FIRST_QUESTION_ID = "q_alg_002";
export const DIAGNOSTIC_LENGTH = 12;

/** Fast = locked in within this share of the question's estimated time. */
const FAST_SHARE_OF_ESTIMATED_TIME = 0.75;

/** Tie-break order when several topics are equally unexplored. */
const TOPIC_ORDER = [
  "Algebra",
  "Simultaneous Equations",
  "Indices",
  "Geometry",
];

const DIFFICULTY_RANK: Record<Difficulty, number> = {
  easy: 0,
  medium: 1,
  hard: 2,
};

export type Pace = "fast" | "slow";

export interface AnsweredQuestion {
  questionId: string;
  correct: boolean;
  pace: Pace;
}

/** A question that timed out is always slow. */
export function paceOf(input: {
  timeOnQuestionMs: number;
  estimatedTimeSeconds: number;
  timedOut: boolean;
}): Pace {
  if (input.timedOut) return "slow";
  const fastLimitMs =
    FAST_SHARE_OF_ESTIMATED_TIME * input.estimatedTimeSeconds * 1000;
  return input.timeOnQuestionMs <= fastLimitMs ? "fast" : "slow";
}

function clampRank(rank: number): number {
  return Math.min(2, Math.max(0, rank));
}

function topicOrderIndex(topic: string): number {
  const index = TOPIC_ORDER.indexOf(topic);
  return index === -1 ? TOPIC_ORDER.length : index;
}

/** Question whose difficulty is closest to the target; ties keep pool order. */
function closestToTarget(
  candidates: Question[],
  targetRank: number,
): Question | null {
  let best: Question | null = null;
  let bestGap = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const gap = Math.abs(DIFFICULTY_RANK[candidate.difficulty] - targetRank);
    if (gap < bestGap) {
      best = candidate;
      bestGap = gap;
    }
  }
  return best;
}

export function pickNextQuestion(
  pool: Question[],
  answered: AnsweredQuestion[],
): Question | null {
  if (answered.length >= DIAGNOSTIC_LENGTH) return null;

  const answeredIds = new Set(answered.map((a) => a.questionId));
  const unused = pool.filter((q) => !answeredIds.has(q.id));
  // Every pool is exhausted: finish early rather than repeat a question.
  if (unused.length === 0) return null;

  if (answered.length === 0) {
    return pool.find((q) => q.id === FIRST_QUESTION_ID) ?? unused[0];
  }

  const answeredCountByTopic = new Map<string, number>();
  for (const a of answered) {
    const topic = pool.find((q) => q.id === a.questionId)?.topic;
    if (topic) {
      answeredCountByTopic.set(topic, (answeredCountByTopic.get(topic) ?? 0) + 1);
    }
  }

  const last = answered[answered.length - 1];
  const lastQuestion = pool.find((q) => q.id === last.questionId);
  if (!lastQuestion) return unused[0];

  let topic = lastQuestion.topic;
  let targetRank = DIFFICULTY_RANK[lastQuestion.difficulty];

  if (last.correct && last.pace === "fast") {
    targetRank += 1; // comfortable: push harder
  } else if (!last.correct && last.pace === "fast") {
    targetRank -= 1; // rushed and wrong: check the foundation
  } else if (!last.correct && last.pace === "slow") {
    // Struggling here: move to the least-explored other topic, start easy.
    const otherTopics = [...new Set(unused.map((q) => q.topic))]
      .filter((t) => t !== lastQuestion.topic)
      .sort(
        (a, b) =>
          (answeredCountByTopic.get(a) ?? 0) -
            (answeredCountByTopic.get(b) ?? 0) ||
          topicOrderIndex(a) - topicOrderIndex(b),
      );
    if (otherTopics.length > 0) topic = otherTopics[0];
    targetRank = DIFFICULTY_RANK.easy;
  }
  // correct + slow: same topic, same difficulty.

  targetRank = clampRank(targetRank);

  const inTopic = closestToTarget(
    unused.filter((q) => q.topic === topic),
    targetRank,
  );
  if (inTopic) return inTopic;

  // This topic's pool is used up: fall back to the shared pool, favouring
  // whichever topic the student has seen least.
  const fewestAnswered = Math.min(
    ...unused.map((q) => answeredCountByTopic.get(q.topic) ?? 0),
  );
  const shared = unused
    .filter((q) => (answeredCountByTopic.get(q.topic) ?? 0) === fewestAnswered)
    .sort((a, b) => topicOrderIndex(a.topic) - topicOrderIndex(b.topic));
  return closestToTarget(shared, targetRank);
}
