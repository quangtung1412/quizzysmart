/*
  Warnings:

  - You are about to drop the column `hasQuickSearchAccess` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `premiumExpiresAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `premiumPlan` on the `User` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT,
    "password" TEXT,
    "email" TEXT,
    "name" TEXT,
    "branchCode" TEXT,
    "picture" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" TEXT NOT NULL DEFAULT 'user',
    "aiSearchQuota" INTEGER NOT NULL DEFAULT 10
);
INSERT INTO "new_User" ("aiSearchQuota", "branchCode", "createdAt", "email", "id", "name", "password", "picture", "role", "username") SELECT "aiSearchQuota", "branchCode", "createdAt", "email", "id", "name", "password", "picture", "role", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
