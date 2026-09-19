import "dotenv/config";
import questionBank from "../src/data/questions.json";
import type { Question } from "../src/types/question";
import { db } from "../src/lib/db";

// Seeds the Question table from the question bank's source of truth
// (src/data/questions.json). Idempotent: replaces the bank on every run.
// Attempts are left untouched — no FK by design, so re-seeding never
// destroys learner data.

const questions = questionBank as Question[];

async function main() {
  await db.transaction(async (tx) => {
    // Prisma 8 requires a predicate on delete; "id is not null" matches every row.
    await tx.orm.Question.where((question) => question.id.isNotNull()).delete();

    // No documented bulk insert in Prisma 8, so insert one by one — the bank
    // is small, and the transaction keeps the replace atomic.
    for (const q of questions) {
      await tx.orm.Question.create({
        id: q.id,
        subject: q.subject,
        topic: q.topic,
        subtopic: q.subtopic,
        concept: q.concept,
        difficulty: q.difficulty,
        estimatedTimeSeconds: q.estimatedTimeSeconds,
        questionText: q.questionText,
        optionsJson: JSON.stringify(q.options),
        correctOption: q.correctOption,
        distractorsJson: JSON.stringify(q.distractors),
        explanation: q.explanation,
      });
    }
  });

  console.log(`Seeded ${questions.length} questions.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.close());
