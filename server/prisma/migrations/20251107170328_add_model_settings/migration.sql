-- CreateTable
CREATE TABLE "model_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "defaultModel" TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
    "cheaperModel" TEXT NOT NULL DEFAULT 'gemini-2.0-flash-lite',
    "embeddingModel" TEXT NOT NULL DEFAULT 'gemini-embedding-001',
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT
);
