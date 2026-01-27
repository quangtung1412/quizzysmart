-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_tests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "questionCount" INTEGER NOT NULL,
    "timeLimit" INTEGER NOT NULL,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "startTime" DATETIME,
    "endTime" DATETIME,
    "knowledgeSources" TEXT NOT NULL,
    "questionOrder" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_tests" ("createdAt", "description", "endTime", "id", "isActive", "knowledgeSources", "name", "questionCount", "questionOrder", "startTime", "timeLimit") SELECT "createdAt", "description", "endTime", "id", "isActive", "knowledgeSources", "name", "questionCount", "questionOrder", "startTime", "timeLimit" FROM "tests";
DROP TABLE "tests";
ALTER TABLE "new_tests" RENAME TO "tests";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
