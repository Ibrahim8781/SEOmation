-- AlterTable
ALTER TABLE "Topic" ADD COLUMN     "rationale" TEXT,
ADD COLUMN     "targetKeyword" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tone" TEXT NOT NULL DEFAULT 'friendly';
