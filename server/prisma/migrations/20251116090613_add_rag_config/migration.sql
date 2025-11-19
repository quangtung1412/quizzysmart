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
    "fileSearchStoreName" TEXT,
    "fileSearchDocumentName" TEXT,
    "ragMethod" TEXT NOT NULL DEFAULT 'qdrant',
    "processingStatus" TEXT NOT NULL DEFAULT 'processing',
    "errorMessage" TEXT,
    "processingStartedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingCompletedAt" DATETIME
);
INSERT INTO "new_documents" ("documentName", "documentNumber", "documentType", "errorMessage", "fileName", "filePath", "fileSize", "id", "issuingAgency", "markdownContent", "processingCompletedAt", "processingStartedAt", "processingStatus", "qdrantCollectionName", "qdrantPointIds", "rawContent", "signedDate", "signerName", "signerTitle", "uploadedAt", "uploadedBy") SELECT "documentName", "documentNumber", "documentType", "errorMessage", "fileName", "filePath", "fileSize", "id", "issuingAgency", "markdownContent", "processingCompletedAt", "processingStartedAt", "processingStatus", "qdrantCollectionName", "qdrantPointIds", "rawContent", "signedDate", "signerName", "signerTitle", "uploadedAt", "uploadedBy" FROM "documents";
DROP TABLE "documents";
ALTER TABLE "new_documents" RENAME TO "documents";
CREATE INDEX "documents_uploadedBy_idx" ON "documents"("uploadedBy");
CREATE INDEX "documents_processingStatus_idx" ON "documents"("processingStatus");
CREATE INDEX "documents_uploadedAt_idx" ON "documents"("uploadedAt");
CREATE INDEX "documents_ragMethod_idx" ON "documents"("ragMethod");
CREATE TABLE "new_system_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelRotationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "defaultModel" TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
    "peakHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
    "peakHoursStart" TEXT,
    "peakHoursEnd" TEXT,
    "peakHoursDays" TEXT NOT NULL DEFAULT '[]',
    "ragMethod" TEXT NOT NULL DEFAULT 'qdrant',
    "fileSearchStoreName" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT
);
INSERT INTO "new_system_settings" ("defaultModel", "id", "modelRotationEnabled", "peakHoursDays", "peakHoursEnabled", "peakHoursEnd", "peakHoursStart", "updatedAt", "updatedBy") SELECT "defaultModel", "id", "modelRotationEnabled", "peakHoursDays", "peakHoursEnabled", "peakHoursEnd", "peakHoursStart", "updatedAt", "updatedBy" FROM "system_settings";
DROP TABLE "system_settings";
ALTER TABLE "new_system_settings" RENAME TO "system_settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
