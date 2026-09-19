-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "targetExam" TEXT NOT NULL DEFAULT 'JAMB',
    "targetScore" INTEGER NOT NULL,
    "subjects" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subject" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "subtopic" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "estimatedTimeSeconds" INTEGER NOT NULL,
    "questionText" TEXT NOT NULL,
    "optionsJson" TEXT NOT NULL,
    "correctOption" TEXT NOT NULL,
    "distractorsJson" TEXT NOT NULL,
    "explanation" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "diagnosticId" TEXT NOT NULL,
    "selectedOption" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "responseTimeSeconds" INTEGER NOT NULL,
    "inferredConfidence" TEXT NOT NULL,
    "inferredMasterySignal" TEXT NOT NULL,
    "telemetryJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LearnerProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "overallJson" TEXT NOT NULL,
    "byTopicJson" TEXT NOT NULL,
    "readinessIndex" INTEGER NOT NULL,
    "profileConfidence" REAL NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LearnerProfile_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Intervention" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "contentJson" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "masteryBefore" REAL NOT NULL,
    "masteryAfter" REAL,
    "improved" BOOLEAN,
    CONSTRAINT "Intervention_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Question_topic_idx" ON "Question"("topic");

-- CreateIndex
CREATE INDEX "Attempt_studentId_idx" ON "Attempt"("studentId");

-- CreateIndex
CREATE INDEX "Attempt_diagnosticId_idx" ON "Attempt"("diagnosticId");

-- CreateIndex
CREATE UNIQUE INDEX "LearnerProfile_studentId_key" ON "LearnerProfile"("studentId");

-- CreateIndex
CREATE INDEX "Intervention_studentId_idx" ON "Intervention"("studentId");
