/**
 * tests/setup.js
 * Global Jest setup — runs once after the test framework is installed, before each test file.
 *
 * IMPORTANT: The DATABASE_URL must point to a dedicated test database.
 * Run before first test run:
 *   createdb seomation_test
 *   DATABASE_URL="postgresql://postgres:ibrahim@127.0.0.1:5432/seomation_test?schema=public" npx prisma migrate deploy
 */

import { prisma } from '../src/lib/prisma.js';

// Guard: refuse to run against the production database
beforeAll(async () => {
  const url = process.env.DATABASE_URL || '';
  if (!url.includes('test') && !url.includes('jest') && !url.includes('ci')) {
    throw new Error(
      `[TEST GUARD] DATABASE_URL must contain "test", "jest", or "ci".\nCurrent URL: ${url}\nDo NOT run tests against the production database.`
    );
  }
});

// Clean all tables before each test file in a safe order (respects FK constraints)
beforeEach(async () => {
  await prisma.$transaction([
    prisma.publishResult.deleteMany(),
    prisma.scheduleJob.deleteMany(),
    prisma.contentImageLink.deleteMany(),
    prisma.imageAsset.deleteMany(),
    prisma.content.deleteMany(),
    prisma.topic.deleteMany(),
    prisma.platformIntegration.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.user.deleteMany()
  ]);
});

// Disconnect Prisma after all tests
afterAll(async () => {
  await prisma.$disconnect();
});
