-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
INSERT INTO "new_document_chunks" ("chunkIndex", "chunkType", "content", "createdAt", "documentId", "embeddingStatus", "id", "metadata", "qdrantPointId") SELECT "chunkIndex", "chunkType", "content", "createdAt", "documentId", "embeddingStatus", "id", "metadata", "qdrantPointId" FROM "document_chunks";
DROP TABLE "document_chunks";
ALTER TABLE "new_document_chunks" RENAME TO "document_chunks";
CREATE INDEX "document_chunks_documentId_idx" ON "document_chunks"("documentId");
CREATE INDEX "document_chunks_chunkType_idx" ON "document_chunks"("chunkType");
CREATE INDEX "document_chunks_embeddingStatus_idx" ON "document_chunks"("embeddingStatus");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
