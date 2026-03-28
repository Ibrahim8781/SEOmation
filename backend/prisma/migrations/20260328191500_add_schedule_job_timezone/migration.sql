ALTER TABLE "ScheduleJob"
ADD COLUMN "scheduledTimezone" TEXT NOT NULL DEFAULT 'UTC';

UPDATE "ScheduleJob" AS sj
SET "scheduledTimezone" = COALESCE(u."timezone", 'UTC')
FROM "Content" AS c
JOIN "User" AS u ON u."id" = c."userId"
WHERE sj."contentId" = c."id";
