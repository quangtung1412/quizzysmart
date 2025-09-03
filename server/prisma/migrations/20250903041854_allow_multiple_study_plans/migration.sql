-- DropIndex
DROP INDEX "StudyPlan_userId_knowledgeBaseId_key";

-- AlterTable
ALTER TABLE "StudyPlan" ADD COLUMN "title" TEXT;
