-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_chat_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "documentId" TEXT,
    "userMessage" TEXT NOT NULL,
    "botResponse" TEXT NOT NULL,
    "retrievedChunks" TEXT,
    "modelUsed" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "isDeepSearch" BOOLEAN NOT NULL DEFAULT false,
    "confidence" REAL,
    "cacheHit" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "chat_messages_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_chat_messages" ("botResponse", "createdAt", "documentId", "id", "inputTokens", "modelUsed", "outputTokens", "retrievedChunks", "totalTokens", "userId", "userMessage") SELECT "botResponse", "createdAt", "documentId", "id", "inputTokens", "modelUsed", "outputTokens", "retrievedChunks", "totalTokens", "userId", "userMessage" FROM "chat_messages";
DROP TABLE "chat_messages";
ALTER TABLE "new_chat_messages" RENAME TO "chat_messages";
CREATE INDEX "chat_messages_userId_idx" ON "chat_messages"("userId");
CREATE INDEX "chat_messages_documentId_idx" ON "chat_messages"("documentId");
CREATE INDEX "chat_messages_createdAt_idx" ON "chat_messages"("createdAt");
CREATE INDEX "chat_messages_isDeepSearch_idx" ON "chat_messages"("isDeepSearch");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
