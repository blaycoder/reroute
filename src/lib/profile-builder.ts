import { prisma } from "@/lib/db";
import {
  computeConfidenceCalibration,
  computeConsistency,
  computeProfileConfidence,
  computeReadinessIndex,
  computeTopicProfile,
  getTopicImpactWeight,
} from "@/lib/mastery";
import { inferErrorType } from "@/lib/rules-engine";
import type {
  Attempt,
  AttemptTelemetry,
  Confidence,
  ErrorType,
  TopicProfile,
} from "@/types/learner-state";

// Rebuilds a student's LearnerProfile from scratch out of all stored
// attempts. Deterministic and stateless: every answer/complete call recomputes
// the same way, so there is no incremental state to drift.

interface QuestionMeta {
  topic: string;
  estimatedTimeSeconds: number;
}

export interface LearnerProfileSnapshot {
  overall: {
    accuracy: number;
    avgSpeedSeconds: number;
    confidenceCalibration: number;
    speedScore: number;
  };
  byTopic: Record<string, TopicProfile>;
  readinessIndex: number;
  profileConfidence: number;
}

export async function buildLearnerProfile(
  studentId: string,
): Promise<LearnerProfileSnapshot> {
  const rows = await prisma.attempt.findMany({
    where: { studentId },
    orderBy: { createdAt: "asc" },
  });
  const questions = await prisma.question.findMany({
    select: { id: true, topic: true, estimatedTimeSeconds: true },
  });
  const metaById = new Map<string, QuestionMeta>(
    questions.map((q) => [
      q.id,
      { topic: q.topic, estimatedTimeSeconds: q.estimatedTimeSeconds },
    ]),
  );

  // DB rows (serialized JSON) -> the Attempt contract the lib functions take.
  const attempts: Attempt[] = rows.map((row) => ({
    questionId: row.questionId,
    selectedOption: row.selectedOption,
    correct: row.correct,
    responseTimeSeconds: row.responseTimeSeconds,
    inferredConfidence: row.inferredConfidence as Confidence,
    inferredMasterySignal: row.inferredMasterySignal as Attempt["inferredMasterySignal"],
    telemetry: JSON.parse(row.telemetryJson) as AttemptTelemetry,
    timestamp: row.createdAt.toISOString(),
  }));

  // Group attempts by topic (question bank is the topic source of truth).
  const attemptsByTopic = new Map<string, Attempt[]>();
  for (const attempt of attempts) {
    const topic = metaById.get(attempt.questionId)?.topic ?? "Unknown";
    const bucket = attemptsByTopic.get(topic) ?? [];
    bucket.push(attempt);
    attemptsByTopic.set(topic, bucket);
  }

  const byTopic: Record<string, TopicProfile> = {};
  for (const [topic, topicAttempts] of attemptsByTopic) {
    // Dominant error type across the topic's wrong answers.
    const errorCounts = new Map<ErrorType, number>();
    for (const attempt of topicAttempts) {
      if (attempt.correct) continue;
      const errorType = inferErrorType({
        correct: false,
        inferredConfidence: attempt.inferredConfidence,
        responseTimeSeconds: attempt.responseTimeSeconds,
        estimatedTimeSeconds:
          metaById.get(attempt.questionId)?.estimatedTimeSeconds ?? 0,
        optionSwitchCount: attempt.telemetry.optionSwitchCount,
      });
      if (errorType) {
        errorCounts.set(errorType, (errorCounts.get(errorType) ?? 0) + 1);
      }
    }
    const dominant =
      Array.from(errorCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ??
      null;

    byTopic[topic] = computeTopicProfile(
      topicAttempts,
      dominant,
      getTopicImpactWeight(topic),
    );
  }

  const accuracy =
    attempts.length === 0
      ? 0
      : attempts.filter((a) => a.correct).length / attempts.length;
  const avgSpeedSeconds =
    attempts.length === 0
      ? 0
      : attempts.reduce((sum, a) => sum + a.responseTimeSeconds, 0) /
        attempts.length;
  const confidenceCalibration = computeConfidenceCalibration(attempts);

  // Speed score: expected pace ÷ actual pace, capped at 100 (expected = 100,
  // twice as slow = 50, faster than expected caps at 100).
  const attemptedEstimated = attempts
    .map((a) => metaById.get(a.questionId)?.estimatedTimeSeconds ?? 0)
    .filter((s) => s > 0);
  const expectedAvgSeconds =
    attemptedEstimated.length === 0
      ? 0
      : attemptedEstimated.reduce((sum, s) => sum + s, 0) /
        attemptedEstimated.length;
  const speedScore =
    avgSpeedSeconds <= 0 || expectedAvgSeconds <= 0
      ? 0
      : Math.round(100 * Math.min(1, expectedAvgSeconds / avgSpeedSeconds));

  const readinessIndex = computeReadinessIndex({
    accuracy,
    consistency: computeConsistency(attempts),
    confidenceCalibration,
  });
  const profileConfidence = computeProfileConfidence(
    attempts.length,
    attemptsByTopic.size,
  );

  const overall = {
    accuracy,
    avgSpeedSeconds,
    confidenceCalibration,
    speedScore,
  };
  const data = {
    overallJson: JSON.stringify(overall),
    byTopicJson: JSON.stringify(byTopic),
    readinessIndex,
    profileConfidence,
  };
  await prisma.learnerProfile.upsert({
    where: { studentId },
    update: data,
    create: { studentId, ...data },
  });

  return { overall, byTopic, readinessIndex, profileConfidence };
}
