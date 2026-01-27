-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelRotationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "defaultModel" TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
    "peakHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
    "peakHoursStart" TEXT,
    "peakHoursEnd" TEXT,
    "peakHoursDays" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT
);
