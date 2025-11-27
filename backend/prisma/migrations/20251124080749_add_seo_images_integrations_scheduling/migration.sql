-- CreateEnum
CREATE TYPE "IntegrationPlatform" AS ENUM ('WORDPRESS', 'LINKEDIN', 'INSTAGRAM');

-- CreateEnum
CREATE TYPE "ImageRole" AS ENUM ('featured', 'inline', 'thumbnail', 'instagram_main', 'gallery');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('SCHEDULED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Content" ADD COLUMN     "metaDescription" TEXT,
ADD COLUMN     "primaryKeyword" TEXT,
ADD COLUMN     "secondaryKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "seoSummary" JSONB;

-- CreateTable
CREATE TABLE "ImageAsset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "prompt" TEXT,
    "url" TEXT NOT NULL,
    "altText" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "format" TEXT,
    "provider" TEXT,
    "aiMeta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentImageLink" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "role" "ImageRole" NOT NULL DEFAULT 'inline',
    "position" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentImageLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformIntegration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "IntegrationPlatform" NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleJob" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "platform" "IntegrationPlatform" NOT NULL,
    "scheduledTime" TIMESTAMP(3) NOT NULL,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'SCHEDULED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishResult" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "externalId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "response" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublishResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContentImageLink_contentId_imageId_role_key" ON "ContentImageLink"("contentId", "imageId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformIntegration_userId_platform_key" ON "PlatformIntegration"("userId", "platform");

-- CreateIndex
CREATE INDEX "ScheduleJob_scheduledTime_status_idx" ON "ScheduleJob"("scheduledTime", "status");

-- CreateIndex
CREATE INDEX "ScheduleJob_contentId_integrationId_idx" ON "ScheduleJob"("contentId", "integrationId");

-- CreateIndex
CREATE UNIQUE INDEX "PublishResult_jobId_key" ON "PublishResult"("jobId");

-- AddForeignKey
ALTER TABLE "ImageAsset" ADD CONSTRAINT "ImageAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentImageLink" ADD CONSTRAINT "ContentImageLink_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentImageLink" ADD CONSTRAINT "ContentImageLink_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "ImageAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformIntegration" ADD CONSTRAINT "PlatformIntegration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleJob" ADD CONSTRAINT "ScheduleJob_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleJob" ADD CONSTRAINT "ScheduleJob_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "PlatformIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishResult" ADD CONSTRAINT "PublishResult_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ScheduleJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
