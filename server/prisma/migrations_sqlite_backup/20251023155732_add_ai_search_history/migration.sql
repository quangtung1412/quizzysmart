-- CreateTable
CREATE TABLE "AiSearchHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "imageBase64" TEXT,
    "knowledgeBaseIds" TEXT NOT NULL,
    "recognizedText" TEXT NOT NULL,
    "extractedOptions" TEXT,
    "matchedQuestionId" TEXT,
    "matchedQuestion" TEXT,
    "confidence" INTEGER NOT NULL,
    "modelUsed" TEXT NOT NULL,
    "modelPriority" INTEGER NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "responseTime" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiSearchHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AiSearchHistory_userId_idx" ON "AiSearchHistory"("userId");

-- CreateIndex
CREATE INDEX "AiSearchHistory_createdAt_idx" ON "AiSearchHistory"("createdAt");

-- CreateIndex
CREATE INDEX "AiSearchHistory_modelUsed_idx" ON "AiSearchHistory"("modelUsed");
