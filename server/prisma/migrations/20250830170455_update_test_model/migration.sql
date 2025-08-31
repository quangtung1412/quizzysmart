/*
  Warnings:

  - You are about to drop the `Test` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Test";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "tests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "questionCount" INTEGER NOT NULL,
    "timeLimit" INTEGER NOT NULL,
    "startTime" DATETIME,
    "endTime" DATETIME,
    "knowledgeSources" TEXT NOT NULL,
    "questionOrder" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Attempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mode" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "score" REAL,
    "settings" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "testId" TEXT,
    CONSTRAINT "Attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Attempt_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Attempt_testId_fkey" FOREIGN KEY ("testId") REFERENCES "tests" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Attempt" ("completedAt", "id", "knowledgeBaseId", "mode", "score", "settings", "startedAt", "testId", "userId") SELECT "completedAt", "id", "knowledgeBaseId", "mode", "score", "settings", "startedAt", "testId", "userId" FROM "Attempt";
DROP TABLE "Attempt";
ALTER TABLE "new_Attempt" RENAME TO "Attempt";
CREATE TABLE "new_TestAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "testId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TestAssignment_testId_fkey" FOREIGN KEY ("testId") REFERENCES "tests" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TestAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TestAssignment" ("assignedAt", "id", "testId", "userId") SELECT "assignedAt", "id", "testId", "userId" FROM "TestAssignment";
DROP TABLE "TestAssignment";
ALTER TABLE "new_TestAssignment" RENAME TO "TestAssignment";
CREATE UNIQUE INDEX "TestAssignment_testId_userId_key" ON "TestAssignment"("testId", "userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
