/*
  Warnings:

  - You are about to drop the column `chunkType` on the `document_chunks` table. All the data in the column will be lost.
  - You are about to drop the column `embeddingStatus` on the `document_chunks` table. All the data in the column will be lost.
  - You are about to drop the column `metadata` on the `document_chunks` table. All the data in the column will be lost.
  - You are about to drop the column `qdrantCollectionName` on the `documents` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "vector_collections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "qdrantCollectionName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_ChatMessageToDocumentChunk" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ChatMessageToDocumentChunk_A_fkey" FOREIGN KEY ("A") REFERENCES "chat_messages" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ChatMessageToDocumentChunk_B_fkey" FOREIGN KEY ("B") REFERENCES "document_chunks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "usedChunkIds" TEXT NOT NULL DEFAULT '[]',
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
    "collectionId" TEXT NOT NULL DEFAULT 'default',
    "chunkIndex" INTEGER NOT NULL,
    "pageStart" INTEGER,
    "pageEnd" INTEGER,
    "content" TEXT NOT NULL,
    "title" TEXT,
    "qdrantPointId" TEXT,
    "qdrantCollectionName" TEXT NOT NULL DEFAULT 'vietnamese_documents',
    "embedding" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "document_chunks_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "vector_collections" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_document_chunks" ("chunkIndex", "content", "createdAt", "documentId", "id", "qdrantPointId") SELECT "chunkIndex", "content", "createdAt", "documentId", "id", "qdrantPointId" FROM "document_chunks";
DROP TABLE "document_chunks";
ALTER TABLE "new_document_chunks" RENAME TO "document_chunks";
CREATE UNIQUE INDEX "document_chunks_qdrantPointId_key" ON "document_chunks"("qdrantPointId");
CREATE INDEX "document_chunks_documentId_idx" ON "document_chunks"("documentId");
CREATE INDEX "document_chunks_collectionId_idx" ON "document_chunks"("collectionId");
CREATE INDEX "document_chunks_qdrantPointId_idx" ON "document_chunks"("qdrantPointId");
CREATE INDEX "document_chunks_qdrantCollectionName_idx" ON "document_chunks"("qdrantCollectionName");
CREATE INDEX "document_chunks_createdAt_idx" ON "document_chunks"("createdAt");
CREATE TABLE "new_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL DEFAULT 'default',
    "documentNumber" TEXT,
    "documentName" TEXT NOT NULL,
    "documentType" TEXT,
    "issuingAgency" TEXT,
    "signerName" TEXT,
    "signerTitle" TEXT,
    "signedDate" DATETIME,
    "rawContent" TEXT NOT NULL,
    "markdownContent" TEXT NOT NULL,
    "qdrantPointIds" TEXT NOT NULL DEFAULT '[]',
    "processingStatus" TEXT NOT NULL DEFAULT 'processing',
    "errorMessage" TEXT,
    "processingStartedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingCompletedAt" DATETIME,
    CONSTRAINT "documents_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "vector_collections" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_documents" ("documentName", "documentNumber", "documentType", "errorMessage", "fileName", "filePath", "fileSize", "id", "issuingAgency", "markdownContent", "processingCompletedAt", "processingStartedAt", "processingStatus", "qdrantPointIds", "rawContent", "signedDate", "signerName", "signerTitle", "uploadedAt", "uploadedBy") SELECT "documentName", "documentNumber", "documentType", "errorMessage", "fileName", "filePath", "fileSize", "id", "issuingAgency", "markdownContent", "processingCompletedAt", "processingStartedAt", "processingStatus", "qdrantPointIds", "rawContent", "signedDate", "signerName", "signerTitle", "uploadedAt", "uploadedBy" FROM "documents";
DROP TABLE "documents";
ALTER TABLE "new_documents" RENAME TO "documents";
CREATE INDEX "documents_uploadedBy_idx" ON "documents"("uploadedBy");
CREATE INDEX "documents_collectionId_idx" ON "documents"("collectionId");
CREATE INDEX "documents_processingStatus_idx" ON "documents"("processingStatus");
CREATE INDEX "documents_uploadedAt_idx" ON "documents"("uploadedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "vector_collections_name_key" ON "vector_collections"("name");

-- CreateIndex
CREATE UNIQUE INDEX "vector_collections_qdrantCollectionName_key" ON "vector_collections"("qdrantCollectionName");

-- CreateIndex
CREATE UNIQUE INDEX "_ChatMessageToDocumentChunk_AB_unique" ON "_ChatMessageToDocumentChunk"("A", "B");

-- CreateIndex
CREATE INDEX "_ChatMessageToDocumentChunk_B_index" ON "_ChatMessageToDocumentChunk"("B");
