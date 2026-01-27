-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_subscription_plans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "aiQuota" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "features" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "popular" BOOLEAN NOT NULL DEFAULT false,
    "bestChoice" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_subscription_plans" ("aiQuota", "createdAt", "displayOrder", "duration", "features", "id", "isActive", "name", "planId", "popular", "price", "updatedAt") SELECT "aiQuota", "createdAt", "displayOrder", "duration", "features", "id", "isActive", "name", "planId", "popular", "price", "updatedAt" FROM "subscription_plans";
DROP TABLE "subscription_plans";
ALTER TABLE "new_subscription_plans" RENAME TO "subscription_plans";
CREATE UNIQUE INDEX "subscription_plans_planId_key" ON "subscription_plans"("planId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
