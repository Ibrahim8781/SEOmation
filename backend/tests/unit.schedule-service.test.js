/**
 * Unit Tests for ScheduleService (mocked Prisma)
 */
import { jest } from '@jest/globals';

const scheduleJobCreateMock = jest.fn();
const scheduleJobFindManyMock = jest.fn();
const scheduleJobFindUniqueMock = jest.fn();
const scheduleJobUpdateMock = jest.fn();
const contentFindUniqueMock = jest.fn();
const integrationFindUniqueMock = jest.fn();

jest.unstable_mockModule('../src/lib/prisma.js', () => ({
  prisma: {
    content: { findUnique: contentFindUniqueMock },
    platformIntegration: { findUnique: integrationFindUniqueMock },
    scheduleJob: {
      create: scheduleJobCreateMock,
      findMany: scheduleJobFindManyMock,
      findUnique: scheduleJobFindUniqueMock,
      update: scheduleJobUpdateMock
    }
  }
}));

const { ScheduleService } = await import('../src/services/schedule.service.js');

// ── fixtures ───────────────────────────────────────────────────────
const userId = 'user-1';
const contentId = 'content-1';
const integrationId = 'integration-1';

const fakeContent = { id: contentId, userId, title: 'Test Post', html: '<p>Test</p>' };
const fakeWpIntegration = {
  id: integrationId,
  userId,
  platform: 'WORDPRESS',
  metadata: { siteUrl: 'https://myblog.com' }
};
const fakeLinkedInIntegration = {
  id: integrationId,
  userId,
  platform: 'LINKEDIN',
  metadata: {}
};
const fakeInstagramIntegration = {
  id: integrationId,
  userId,
  platform: 'INSTAGRAM',
  metadata: {}
};

describe('ScheduleService Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    scheduleJobCreateMock.mockResolvedValue({
      id: 'job-1',
      contentId,
      integrationId,
      platform: 'WORDPRESS',
      status: 'SCHEDULED',
      content: fakeContent,
      integration: fakeWpIntegration
    });
  });

  // ── schedule ─────────────────────────────────────────────────────
  describe('schedule', () => {
    it('creates a scheduled job for WordPress', async () => {
      contentFindUniqueMock.mockResolvedValue(fakeContent);
      integrationFindUniqueMock.mockResolvedValue(fakeWpIntegration);

      const futureTime = new Date(Date.now() + 3600000).toISOString();
      const job = await ScheduleService.schedule(userId, contentId, integrationId, 'WORDPRESS', futureTime, null);

      expect(scheduleJobCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SCHEDULED', platform: 'WORDPRESS' })
        })
      );
      expect(job).toBeDefined();
    });

    it('throws 404 when content does not exist', async () => {
      contentFindUniqueMock.mockResolvedValue(null);

      await expect(
        ScheduleService.schedule(userId, 'non-existent', integrationId, 'WORDPRESS', new Date(), null)
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws 404 when content belongs to another user', async () => {
      contentFindUniqueMock.mockResolvedValue({ ...fakeContent, userId: 'other-user' });
      integrationFindUniqueMock.mockResolvedValue(fakeWpIntegration);

      await expect(
        ScheduleService.schedule(userId, contentId, integrationId, 'WORDPRESS', new Date(), null)
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws 404 when integration does not exist', async () => {
      contentFindUniqueMock.mockResolvedValue(fakeContent);
      integrationFindUniqueMock.mockResolvedValue(null);

      await expect(
        ScheduleService.schedule(userId, contentId, integrationId, 'WORDPRESS', new Date(), null)
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws 400 for unsupported platform', async () => {
      contentFindUniqueMock.mockResolvedValue(fakeContent);
      integrationFindUniqueMock.mockResolvedValue({ ...fakeWpIntegration, platform: 'WORDPRESS' });

      await expect(
        ScheduleService.schedule(userId, contentId, integrationId, 'TIKTOK', new Date(), null)
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('throws 400 for invalid scheduledTime', async () => {
      contentFindUniqueMock.mockResolvedValue(fakeContent);
      integrationFindUniqueMock.mockResolvedValue(fakeWpIntegration);

      await expect(
        ScheduleService.schedule(userId, contentId, integrationId, 'WORDPRESS', 'not-a-date', null)
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('throws 400 for WordPress without siteUrl', async () => {
      contentFindUniqueMock.mockResolvedValue(fakeContent);
      integrationFindUniqueMock.mockResolvedValue({ ...fakeWpIntegration, metadata: {} });

      await expect(
        ScheduleService.schedule(userId, contentId, integrationId, 'WORDPRESS', new Date(), null)
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('site') });
    });

    it('throws 400 for Instagram without media', async () => {
      contentFindUniqueMock.mockResolvedValue(fakeContent);
      integrationFindUniqueMock.mockResolvedValue(fakeInstagramIntegration);

      scheduleJobCreateMock.mockResolvedValue({ id: 'job-2', platform: 'INSTAGRAM' });

      await expect(
        ScheduleService.schedule(userId, contentId, integrationId, 'INSTAGRAM', new Date(), null)
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('Instagram') });
    });

    it('succeeds for Instagram with media provided', async () => {
      contentFindUniqueMock.mockResolvedValue(fakeContent);
      integrationFindUniqueMock.mockResolvedValue(fakeInstagramIntegration);
      scheduleJobCreateMock.mockResolvedValue({ id: 'job-3', platform: 'INSTAGRAM' });

      const media = { instagram: { imageId: 'img-1', url: 'https://cdn.example.com/img.jpg' } };
      const job = await ScheduleService.schedule(userId, contentId, integrationId, 'INSTAGRAM', new Date(), media);
      expect(scheduleJobCreateMock).toHaveBeenCalled();
      expect(job).toBeDefined();
    });

    it('succeeds for LinkedIn without media', async () => {
      contentFindUniqueMock.mockResolvedValue(fakeContent);
      integrationFindUniqueMock.mockResolvedValue(fakeLinkedInIntegration);
      scheduleJobCreateMock.mockResolvedValue({ id: 'job-4', platform: 'LINKEDIN' });

      const job = await ScheduleService.schedule(userId, contentId, integrationId, 'LINKEDIN', new Date(), null);
      expect(scheduleJobCreateMock).toHaveBeenCalled();
      expect(job).toBeDefined();
    });
  });

  // ── publishNow ────────────────────────────────────────────────────
  describe('publishNow', () => {
    it('delegates to schedule with current time', async () => {
      contentFindUniqueMock.mockResolvedValue(fakeContent);
      integrationFindUniqueMock.mockResolvedValue(fakeLinkedInIntegration);
      scheduleJobCreateMock.mockResolvedValue({ id: 'job-now', platform: 'LINKEDIN', status: 'SCHEDULED' });

      await ScheduleService.publishNow(userId, contentId, integrationId, 'LINKEDIN', null);
      expect(scheduleJobCreateMock).toHaveBeenCalled();
    });
  });

  // ── list ──────────────────────────────────────────────────────────
  describe('list', () => {
    it('returns jobs for the user', async () => {
      const mockJobs = [{ id: 'j1', platform: 'WORDPRESS' }];
      scheduleJobFindManyMock.mockResolvedValue(mockJobs);

      const jobs = await ScheduleService.list(userId);
      expect(jobs).toEqual(mockJobs);
      expect(scheduleJobFindManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ where: { content: { userId } } })
      );
    });
  });

  // ── cancel ────────────────────────────────────────────────────────
  describe('cancel', () => {
    it('marks job as CANCELLED for valid user and pending job', async () => {
      scheduleJobFindUniqueMock.mockResolvedValue({
        id: 'job-1',
        status: 'SCHEDULED',
        content: { userId }
      });
      scheduleJobUpdateMock.mockResolvedValue({ id: 'job-1', status: 'CANCELLED' });

      const result = await ScheduleService.cancel(userId, 'job-1');
      expect(scheduleJobUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'CANCELLED' } })
      );
      expect(result.status).toBe('CANCELLED');
    });

    it('throws 404 when job not found', async () => {
      scheduleJobFindUniqueMock.mockResolvedValue(null);

      await expect(ScheduleService.cancel(userId, 'non-existent')).rejects.toMatchObject({
        statusCode: 404
      });
    });

    it('throws 404 when job belongs to different user', async () => {
      scheduleJobFindUniqueMock.mockResolvedValue({
        id: 'job-1',
        status: 'SCHEDULED',
        content: { userId: 'other-user' }
      });

      await expect(ScheduleService.cancel(userId, 'job-1')).rejects.toMatchObject({
        statusCode: 404
      });
    });

    it('returns job unchanged if already COMPLETED', async () => {
      const completedJob = { id: 'job-1', status: 'COMPLETED', content: { userId } };
      scheduleJobFindUniqueMock.mockResolvedValue(completedJob);

      const result = await ScheduleService.cancel(userId, 'job-1');
      expect(scheduleJobUpdateMock).not.toHaveBeenCalled();
      expect(result).toBe(completedJob);
    });

    it('returns job unchanged if already FAILED', async () => {
      const failedJob = { id: 'job-1', status: 'FAILED', content: { userId } };
      scheduleJobFindUniqueMock.mockResolvedValue(failedJob);

      const result = await ScheduleService.cancel(userId, 'job-1');
      expect(scheduleJobUpdateMock).not.toHaveBeenCalled();
      expect(result).toBe(failedJob);
    });
  });
});
