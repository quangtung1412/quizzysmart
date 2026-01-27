-- CreateTable
CREATE TABLE "StudyPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "knowledgeBaseName" TEXT NOT NULL,
    "totalDays" INTEGER NOT NULL,
    "minutesPerDay" INTEGER NOT NULL,
    "questionsPerDay" INTEGER NOT NULL,
    "currentPhase" TEXT NOT NULL DEFAULT 'initial',
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "currentDay" INTEGER NOT NULL DEFAULT 1,
    "newQuestionsLearned" INTEGER NOT NULL DEFAULT 0,
    "completedQuestions" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "QuestionProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studyPlanId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "difficultyLevel" TEXT,
    "lastReviewed" DATETIME,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "nextReviewAfter" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuestionProgress_studyPlanId_fkey" FOREIGN KEY ("studyPlanId") REFERENCES "StudyPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StudyPlan_userId_knowledgeBaseId_key" ON "StudyPlan"("userId", "knowledgeBaseId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionProgress_studyPlanId_questionId_key" ON "QuestionProgress"("studyPlanId", "questionId");
