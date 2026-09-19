import { getQuestion } from "@/data/question-bank";
import { db, newId } from "@/lib/db";
import {
  computeConfidenceCalibration,
  computeConsistency,
  computeProfileConfidence,
  computeReadinessIndex,
  computeTopicProfile,
  getTopicImpactWeight,
} from "@/lib/mastery";
import type {
  AIDiagnosis,
  Attempt,
  AttemptTelemetry,
  Confidence,
  ErrorType,
  HeadlineDiagnosis,
  InterventionRecord,
  LearnerState,
  TopicProfile,
} from "@/types/learner-state";

// The learner profile is a computation, not a fixture. Everything below is
// derived from the Attempt rows of one session: accuracy, speed, calibration,
// per-topic error type, priority, readiness. Practice and reassessment answers
// are attempts too, so the profile moves as the student improves.

/** The topic most worth fixing first; null when there are no topic profiles. */
export function pickPriorityTopic(
  byTopic: Record<string, TopicProfile>,
): string | null {
  return (
    Object.entries(byTopic).sort(
      (a, b) => b[1].priorityScore - a[1].priorityScore,
    )[0]?.[0] ?? null
  );
}

interface AttemptRecord {
  attempt: Attempt;
  topic: string;
  estimatedTimeSeconds: number;
  /** The distractor's pre-tagged error type — the prior the AI may override. */
  priorErrorType: ErrorType | null;
  diagnosis: AIDiagnosis | null;
}

export async function computeLearnerProfile(
  sessionId: string,
): Promise<LearnerState> {
  const session = await db.orm.DiagnosticSession.first({ id: sessionId });
  if (!session) throw new Error(`Diagnostic session not found: ${sessionId}`);
  const student = await db.orm.Student.first({ id: session.studentId });
  if (!student) throw new Error(`Student not found: ${session.studentId}`);

  const rows = await db.orm.Attempt.where({ diagnosticId: sessionId })
    .orderBy((attempt) => attempt.createdAt.asc())
    .all();

  const records: AttemptRecord[] = rows.map((row) => {
    const question = getQuestion(row.questionId);
    const distractor = question?.distractors.find(
      (d) => d.option === row.selectedOption,
    );
    return {
      attempt: {
        questionId: row.questionId,
        selectedOption: row.selectedOption ?? null,
        correct: row.correct === 1,
        responseTimeSeconds: row.responseTimeSeconds,
        inferredConfidence: row.inferredConfidence as Confidence,
        inferredMasterySignal:
          row.inferredMasterySignal as Attempt["inferredMasterySignal"],
        telemetry: JSON.parse(row.telemetryJson) as AttemptTelemetry,
        timestamp: row.createdAt.toISOString(),
      },
      topic: question?.topic ?? "Unknown",
      estimatedTimeSeconds: question?.estimatedTimeSeconds ?? 0,
      priorErrorType: distractor?.errorType ?? null,
      diagnosis: row.diagnosisJson
        ? (JSON.parse(row.diagnosisJson) as AIDiagnosis)
        : null,
    };
  });

  const attempts = records.map((r) => r.attempt);

  const recordsByTopic = new Map<string, AttemptRecord[]>();
  for (const record of records) {
    const bucket = recordsByTopic.get(record.topic) ?? [];
    bucket.push(record);
    recordsByTopic.set(record.topic, bucket);
  }

  const byTopic: Record<string, TopicProfile> = {};
  for (const [topic, topicRecords] of recordsByTopic) {
    byTopic[topic] = computeTopicProfile(
      topicRecords.map((r) => r.attempt),
      dominantErrorType(topicRecords),
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
  const expectedTimes = records
    .map((r) => r.estimatedTimeSeconds)
    .filter((seconds) => seconds > 0);
  const expectedAvgSeconds =
    expectedTimes.length === 0
      ? 0
      : expectedTimes.reduce((sum, s) => sum + s, 0) / expectedTimes.length;
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
    recordsByTopic.size,
  );

  const overall = {
    accuracy,
    avgSpeedSeconds,
    confidenceCalibration,
    speedScore,
  };

  const priorityTopic = pickPriorityTopic(byTopic);
  const headlineDiagnosis = priorityTopic
    ? pickHeadlineDiagnosis(priorityTopic, recordsByTopic.get(priorityTopic) ?? [])
    : null;

  // Only finished sessions: generate creates a row up front, so abandoned or
  // reloaded sessions would otherwise appear as bogus "Not yet 0% → 0%" entries.
  const interventions = await db.orm.Intervention.where({
    studentId: session.studentId,
  })
    .where((intervention) => intervention.completedAt.isNotNull())
    .orderBy((intervention) => intervention.startedAt.desc())
    .all();
  const interventionHistory: InterventionRecord[] = interventions.map((i) => ({
    topic: i.topic,
    action: i.actionType,
    startedAt: i.startedAt.toISOString(),
    completedAt: i.completedAt?.toISOString() ?? "",
    masteryBefore: i.masteryBefore,
    masteryAfter: i.masteryAfter ?? 0,
    improved: i.improved === 1,
  }));

  await saveProfileCache(session.studentId, {
    overall,
    byTopic,
    readinessIndex,
    profileConfidence,
    headlineDiagnosis,
  });

  return {
    studentId: student.id,
    targetExam: "JAMB",
    targetScore: student.targetScore,
    subjects: JSON.parse(student.subjects) as string[],
    diagnostic: {
      diagnosticId: session.id,
      domainsCovered: Object.keys(byTopic),
      completedInSeconds: session.completedInSeconds ?? 0,
      attempts,
    },
    learnerProfile: {
      overall,
      byTopic,
      readinessIndex,
      profileConfidence,
      interventionHistory,
      headlineDiagnosis,
    },
  };
}

/**
 * The topic's error type comes from the AI's read of its wrong answers, and
 * only falls back to the distractor's prior where no diagnosis exists yet.
 * The most common type wins; a tie goes to the most recent.
 */
function dominantErrorType(records: AttemptRecord[]): ErrorType | null {
  const counts = new Map<ErrorType, number>();
  let dominant: ErrorType | null = null;
  for (const record of records) {
    if (record.attempt.correct) continue;
    const errorType = record.diagnosis?.errorType ?? record.priorErrorType;
    if (!errorType) continue;
    const count = (counts.get(errorType) ?? 0) + 1;
    counts.set(errorType, count);
    if (dominant === null || count >= (counts.get(dominant) ?? 0)) {
      dominant = errorType;
    }
  }
  return dominant;
}

/** Prefers a diagnosis where the AI overrode the static mapping, then the surest. */
function pickHeadlineDiagnosis(
  topic: string,
  records: AttemptRecord[],
): HeadlineDiagnosis | null {
  const candidates = records.filter((r) => r.diagnosis !== null);
  if (candidates.length === 0) return null;
  const best = candidates.reduce((winner, candidate) => {
    const a = winner.diagnosis as AIDiagnosis;
    const b = candidate.diagnosis as AIDiagnosis;
    if (a.overrodePrior !== b.overrodePrior) {
      return b.overrodePrior ? candidate : winner;
    }
    return b.confidence >= a.confidence ? candidate : winner;
  });
  const diagnosis = best.diagnosis as AIDiagnosis;
  return {
    topic,
    diagnosis: diagnosis.diagnosis,
    errorType: diagnosis.errorType,
    confidence: diagnosis.confidence,
    overrodePrior: diagnosis.overrodePrior,
  };
}

async function saveProfileCache(
  studentId: string,
  profile: {
    overall: LearnerState["learnerProfile"]["overall"];
    byTopic: Record<string, TopicProfile>;
    readinessIndex: number;
    profileConfidence: number;
    headlineDiagnosis: HeadlineDiagnosis | null;
  },
): Promise<void> {
  const data = {
    overallJson: JSON.stringify(profile.overall),
    byTopicJson: JSON.stringify(profile.byTopic),
    headlineDiagnosisJson: profile.headlineDiagnosis
      ? JSON.stringify(profile.headlineDiagnosis)
      : null,
    readinessIndex: profile.readinessIndex,
    profileConfidence: profile.profileConfidence,
    updatedAt: new Date(),
  };
  // Not `.upsert()`: Prisma 8's upsert conflicts on the primary key, but this
  // row is keyed by the unique `studentId` while `id` is generated per create.
  await db.transaction(async (tx) => {
    const existing = await tx.orm.LearnerProfile.where({ studentId }).first();
    if (existing) {
      await tx.orm.LearnerProfile.where({ studentId }).update(data);
    } else {
      await tx.orm.LearnerProfile.create({ id: newId(), studentId, ...data });
    }
  });
}
