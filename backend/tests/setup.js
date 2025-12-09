import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

beforeAll(async () => {
  // Clean test database before all tests
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