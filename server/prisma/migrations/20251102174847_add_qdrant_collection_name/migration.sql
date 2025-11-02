/*
  Warnings:

  - You are about to drop the `qdrant_collections` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `collectionId` on the `documents` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "qdrant_collections_isActive_idx";

-- DropIndex
DROP INDEX "qdrant_collections_name_idx";

-- DropIndex
DROP INDEX "qdrant_collections_name_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "qdrant_collections";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "qdrantCollectionName" TEXT NOT NULL DEFAULT 'vietnamese_documents',
    "qdrantPointIds" TEXT NOT NULL DEFAULT '[]',
    "processingStatus" TEXT NOT NULL DEFAULT 'processing',
    "errorMessage" TEXT,
    "processingStartedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingCompletedAt" DATETIME
);
INSERT INTO "new_documents" ("documentName", "documentNumber", "documentType", "errorMessage", "fileName", "filePath", "fileSize", "id", "issuingAgency", "markdownContent", "processingCompletedAt", "processingStartedAt", "processingStatus", "qdrantPointIds", "rawContent", "signedDate", "signerName", "signerTitle", "uploadedAt", "uploadedBy") SELECT "documentName", "documentNumber", "documentType", "errorMessage", "fileName", "filePath", "fileSize", "id", "issuingAgency", "markdownContent", "processingCompletedAt", "processingStartedAt", "processingStatus", "qdrantPointIds", "rawContent", "signedDate", "signerName", "signerTitle", "uploadedAt", "uploadedBy" FROM "documents";
DROP TABLE "documents";
ALTER TABLE "new_documents" RENAME TO "documents";
CREATE INDEX "documents_uploadedBy_idx" ON "documents"("uploadedBy");
CREATE INDEX "documents_processingStatus_idx" ON "documents"("processingStatus");
CREATE INDEX "documents_uploadedAt_idx" ON "documents"("uploadedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
