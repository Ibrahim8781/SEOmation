import ApiError from '../utils/ApiError.js';
import { prisma } from '../lib/prisma.js';

const SUPPORTED = ['WORDPRESS', 'LINKEDIN', 'INSTAGRAM'];

function normalizePlatform(value) {
  const platform = String(value || '').toUpperCase();
  if (!SUPPORTED.includes(platform)) {
    throw new ApiError(400, 'Unsupported platform');
  }
  return platform;
}

async function ownedContent(contentId, userId) {
  const content = await prisma.content.findUnique({ where: { id: contentId } });
  if (!content || content.userId !== userId) {
    throw new ApiError(404, 'Content not found');
  }
  return content;
}

async function ownedIntegration(integrationId, userId) {
  const integration = await prisma.platformIntegration.findUnique({ where: { id: integrationId } });
  if (!integration || integration.userId !== userId) {
    throw new ApiError(404, 'Integration not found');
  }
  return integration;
}

function validateMedia(platform, media) {
  if (platform === 'INSTAGRAM' && (!media || !media.instagram)) {
    throw new ApiError(400, 'Instagram requires an image. Select one before scheduling.');
  }
  return media || null;
}

export const ScheduleService = {
  async schedule(userId, contentId, integrationId, platform, scheduledTime, media) {
    const content = await ownedContent(contentId, userId);
    const integration = await ownedIntegration(integrationId, userId);
    const normalizedPlatform = normalizePlatform(platform || integration.platform);
    if (normalizedPlatform === 'WORDPRESS' && !((integration.metadata || {}).siteUrl || (integration.metadata || {}).siteId)) {
      throw new ApiError(400, 'WordPress site is not selected. Reconnect and pick a site.');
    }
    const when = new Date(scheduledTime);
    if (Number.isNaN(when.getTime())) {
      throw new ApiError(400, 'scheduledTime is invalid');
    }

    const normalizedMedia = validateMedia(normalizedPlatform, media);

    const data = {
      contentId: content.id,
      integrationId: integration.id,
      platform: normalizedPlatform,
      scheduledTime: when,
      media: normalizedMedia,
      status: 'SCHEDULED',
      attempts: 0,
      lastError: null
    };

    return prisma.scheduleJob.create({
      data: {
        ...data
      },
      include: { content: true, integration: true }
    });
  },

  async publishNow(userId, contentId, integrationId, platform, media) {
    return this.schedule(userId, contentId, integrationId, platform, new Date(), media);
  },

  async list(userId) {
    return prisma.scheduleJob.findMany({
      where: { content: { userId } },
      include: { content: true, integration: true, result: true },
      orderBy: { scheduledTime: 'desc' }
    });
  },

  async cancel(userId, jobId) {
    const job = await prisma.scheduleJob.findUnique({
      where: { id: jobId },
      include: { content: true }
    });
    if (!job || job.content.userId !== userId) {
      throw new ApiError(404, 'Schedule not found');
    }
    if (['COMPLETED', 'FAILED'].includes(job.status)) {
      return job;
    }
    return prisma.scheduleJob.update({
      where: { id: jobId },
      data: { status: 'CANCELLED' }
    });
  }
};
