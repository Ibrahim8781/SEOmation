import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

function isLocalDatabase(url) {
  return /localhost|127\.0\.0\.1/i.test(url);
}

function isNamedTestDatabase(url) {
  return /(?:^|[_:/?=-])(test|jest|ci)(?:$|[_:/?=-])/i.test(url);
}

function assertSafeTestDatabase() {
  const databaseUrl = process.env.DATABASE_URL || '';
  const allowReset = process.env.ALLOW_TEST_DATABASE_RESET === 'true';

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required before running backend tests.');
  }

  if (allowReset) {
    return;
  }

  if (!isLocalDatabase(databaseUrl) || !isNamedTestDatabase(databaseUrl)) {
    throw new Error(
      `Refusing to wipe a non-test database. Point DATABASE_URL at a local test database or set ALLOW_TEST_DATABASE_RESET=true. Current DATABASE_URL: ${databaseUrl}`
    );
  }
}

beforeAll(async () => {
  assertSafeTestDatabase();
  await prisma.scheduleJob.deleteMany({});
  await prisma.contentImageLink.deleteMany({});
  await prisma.imageAsset.deleteMany({});
  await prisma.content.deleteMany({});
  await prisma.topic.deleteMany({});
  await prisma.platformIntegration.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({});
});

afterAll(async () => {
  await prisma.$disconnect();
});
