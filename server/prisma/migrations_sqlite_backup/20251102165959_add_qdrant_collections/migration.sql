/*
  Warnings:

  - You are about to drop the `_ChatMessageToDocumentChunk` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `vector_collections` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `usedChunkIds` on the `chat_messages` table. All the data in the column will be lost.
  - You are about to drop the column `collectionId` on the `document_chunks` table. All the data in the column will be lost.
  - You are about to drop the column `embedding` on the `document_chunks` table. All the data in the column will be lost.
  - You are about to drop the column `pageEnd` on the `document_chunks` table. All the data in the column will be lost.
  - You are about to drop the column `pageStart` on the `document_chunks` table. All the data in the column will be lost.
  - You are about to drop the column `qdrantCollectionName` on the `document_chunks` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `document_chunks` table. All the data in the column will be lost.
  - Added the required column `chunkType` to the `document_chunks` table without a default value. This is not possible if the table is not empty.
  - Added the required column `metadata` to the `document_chunks` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "_ChatMessageToDocumentChunk_B_index";

-- DropIndex
DROP INDEX "_ChatMessageToDocumentChunk_AB_unique";

-- DropIndex
DROP INDEX "vector_collections_qdrantCollectionName_key";

-- DropIndex
DROP INDEX "vector_collections_name_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "_ChatMessageToDocumentChunk";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "vector_collections";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "qdrant_collections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "keywords" TEXT NOT NULL DEFAULT '[]',
    "vectorDimension" INTEGER NOT NULL DEFAULT 768,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "documentCount" INTEGER NOT NULL DEFAULT 0
);

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
CREATE TABLE "new_document_chunks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "chunkType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" TEXT NOT NULL,
    "qdrantPointId" TEXT,
    "embeddingStatus" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_document_chunks" ("chunkIndex", "content", "createdAt", "documentId", "id", "qdrantPointId") SELECT "chunkIndex", "content", "createdAt", "documentId", "id", "qdrantPointId" FROM "document_chunks";
DROP TABLE "document_chunks";
ALTER TABLE "new_document_chunks" RENAME TO "document_chunks";
CREATE INDEX "document_chunks_documentId_idx" ON "document_chunks"("documentId");
CREATE INDEX "document_chunks_chunkType_idx" ON "document_chunks"("chunkType");
CREATE INDEX "document_chunks_embeddingStatus_idx" ON "document_chunks"("embeddingStatus");
CREATE TABLE "new_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" TEXT NOT NULL,
    "documentNumber" TEXT,
    "documentName" TEXT NOT NULL,
    "documentType" TEXT,
    "issuingAgency" TEXT,
    "signerName" TEXT,
    "signerTitle" TEXT,
    "signedDate" DATETIME,
    "rawContent" TEXT NOT NULL,
    "markdownContent" TEXT NOT NULL,
    "collectionId" TEXT,
    "qdrantPointIds" TEXT NOT NULL DEFAULT '[]',
    "processingStatus" TEXT NOT NULL DEFAULT 'processing',
    "errorMessage" TEXT,
    "processingStartedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingCompletedAt" DATETIME,
    CONSTRAINT "documents_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "qdrant_collections" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_documents" ("collectionId", "documentName", "documentNumber", "documentType", "errorMessage", "fileName", "filePath", "fileSize", "id", "issuingAgency", "markdownContent", "processingCompletedAt", "processingStartedAt", "processingStatus", "qdrantPointIds", "rawContent", "signedDate", "signerName", "signerTitle", "uploadedAt", "uploadedBy") SELECT "collectionId", "documentName", "documentNumber", "documentType", "errorMessage", "fileName", "filePath", "fileSize", "id", "issuingAgency", "markdownContent", "processingCompletedAt", "processingStartedAt", "processingStatus", "qdrantPointIds", "rawContent", "signedDate", "signerName", "signerTitle", "uploadedAt", "uploadedBy" FROM "documents";
DROP TABLE "documents";
ALTER TABLE "new_documents" RENAME TO "documents";
CREATE INDEX "documents_uploadedBy_idx" ON "documents"("uploadedBy");
CREATE INDEX "documents_processingStatus_idx" ON "documents"("processingStatus");
CREATE INDEX "documents_uploadedAt_idx" ON "documents"("uploadedAt");
CREATE INDEX "documents_collectionId_idx" ON "documents"("collectionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "qdrant_collections_name_key" ON "qdrant_collections"("name");

-- CreateIndex
CREATE INDEX "qdrant_collections_name_idx" ON "qdrant_collections"("name");

-- CreateIndex
CREATE INDEX "qdrant_collections_isActive_idx" ON "qdrant_collections"("isActive");
