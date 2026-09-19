import { PrismaClient } from "@prisma/client";
import questionBank from "../src/data/questions.json";
import type { Question } from "../src/types/question";

// Seeds the Question table from the question bank's source of truth
// (src/data/questions.json). Idempotent: replaces the bank on every run.
// Attempts are left untouched — no FK by design, so re-seeding never
// destroys learner data.

const prisma = new PrismaClient();

const questions = questionBank as Question[];

async function main() {
  await prisma.question.deleteMany();

  await prisma.question.createMany({
    data: questions.map((q) => ({
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
    })),
  });

  console.log(`Seeded ${questions.length} questions.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
