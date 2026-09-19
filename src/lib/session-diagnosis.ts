import { getQuestion } from "@/data/question-bank";
import { diagnoseMisconception, type RecentAttempt } from "@/lib/ai-diagnosis";
import { db } from "@/lib/db";
import type { AttemptTelemetry, Confidence } from "@/types/learner-state";

// How many earlier answers the AI sees, so it can name a pattern across
// questions instead of judging each slip in isolation.
const RECENT_HISTORY_LENGTH = 4;

/**
 * Diagnoses every wrong answer in a session that has no diagnosis yet, in
 * parallel. Each call is capped by the LLM deadline and falls back to the
 * deterministic diagnosis, so this never fails and takes at most one deadline.
 * Results are stored on the attempt, which makes re-running it a no-op.
 */
export async function diagnoseWrongAnswers(sessionId: string): Promise<void> {
  const rows = await db.orm.Attempt.where({
    diagnosticId: sessionId,
    purpose: "diagnostic",
  })
    .orderBy((attempt) => attempt.createdAt.asc())
    .all();

  const recent: RecentAttempt[] = [];
  const pending: Promise<void>[] = [];

  for (const row of rows) {
    const question = getQuestion(row.questionId);
    const history = recent.slice(-RECENT_HISTORY_LENGTH);
    const distractor = question?.distractors.find(
      (d) => d.option === row.selectedOption,
    );

    if (question) {
      recent.push({
        concept: question.concept,
        correct: row.correct === 1,
        misconception: distractor?.misconception ?? null,
        inferredConfidence: row.inferredConfidence as Confidence,
      });
    }

    if (!question || row.correct === 1 || row.diagnosisJson) continue;

    pending.push(
      diagnoseMisconception({
        questionText: question.questionText,
        concept: question.concept,
        correctAnswer: question.options[question.correctOption],
        selectedAnswer: row.selectedOption
          ? question.options[row.selectedOption]
          : null,
        estimatedTimeSeconds: question.estimatedTimeSeconds,
        knownMisconception: distractor?.misconception ?? null,
        priorErrorType: distractor?.errorType ?? null,
        priorExplanation: distractor?.explanation ?? null,
        telemetry: JSON.parse(row.telemetryJson) as AttemptTelemetry,
        inferredConfidence: row.inferredConfidence as Confidence,
        recentAttempts: history,
      }).then(async (diagnosis) => {
        await db.orm.Attempt.where({ id: row.id }).update({
          diagnosisJson: JSON.stringify(diagnosis),
        });
      }),
    );
  }

  await Promise.all(pending);
}
