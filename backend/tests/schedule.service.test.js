import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Import service after ensuring global.mockPrisma is available in setup
const { ScheduleService } = await import('../src/services/schedule.service.js');

describe('ScheduleService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.mockPrisma.content = { findUnique: jest.fn(), update: jest.fn() };
    global.mockPrisma.platformIntegration = { findUnique: jest.fn() };
    global.mockPrisma.scheduleJob = {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    };
  });

  describe('schedule', () => {
    it('creates a scheduled job for future publication', async () => {
      const userId = 'user-1';
      const contentId = 'content-1';
      const integrationId = 'int-1';
      const platform = 'LINKEDIN';
      const scheduledTime = new Date('2025-12-31T10:00:00Z');

      const mockContent = { id: contentId, userId, title: 'T' };
      const mockIntegration = { id: integrationId, userId, platform: 'LINKEDIN', accessToken: 't' };
      const mockJob = { id: 'job-1', contentId, integrationId, platform: 'LINKEDIN', scheduledTime, status: 'SCHEDULED' };

      global.mockPrisma.content.findUnique.mockResolvedValue(mockContent);
      global.mockPrisma.platformIntegration.findUnique.mockResolvedValue(mockIntegration);
      global.mockPrisma.scheduleJob.create.mockResolvedValue(mockJob);

      const res = await ScheduleService.schedule(userId, contentId, integrationId, platform, scheduledTime, null);

      expect(global.mockPrisma.scheduleJob.create).toHaveBeenCalled();
      expect(res.status).toBe('SCHEDULED');
      expect(res.platform).toBe('LINKEDIN');
    });

    it('requires media for INSTAGRAM', async () => {
      const userId = 'user-1';
      const mockContent = { id: 'c1', userId, title: 't' };
      const mockIntegration = { id: 'i1', userId, platform: 'INSTAGRAM' };

      global.mockPrisma.content.findUnique.mockResolvedValue(mockContent);
      global.mockPrisma.platformIntegration.findUnique.mockResolvedValue(mockIntegration);

      await expect(
        ScheduleService.schedule(userId, mockContent.id, mockIntegration.id, 'INSTAGRAM', new Date(), null)
      ).rejects.toThrow(/Instagram requires an image/);
    });

    it('requires WordPress site selection for WORDPRESS', async () => {
      const userId = 'user-1';
      const mockContent = { id: 'c1', userId, title: 't' };
      const mockIntegration = { id: 'i1', userId, platform: 'WORDPRESS', metadata: {} };

      global.mockPrisma.content.findUnique.mockResolvedValue(mockContent);
      global.mockPrisma.platformIntegration.findUnique.mockResolvedValue(mockIntegration);

      await expect(
        ScheduleService.schedule(userId, mockContent.id, mockIntegration.id, 'WORDPRESS', new Date(), null)
      ).rejects.toThrow(/WordPress site is not selected/);
    });

    it('rejects invalid scheduledTime', async () => {
      const userId = 'user-1';
      const mockContent = { id: 'c1', userId, title: 't' };
      const mockIntegration = { id: 'i1', userId, platform: 'LINKEDIN' };

      global.mockPrisma.content.findUnique.mockResolvedValue(mockContent);
      global.mockPrisma.platformIntegration.findUnique.mockResolvedValue(mockIntegration);

      await expect(
        ScheduleService.schedule(userId, mockContent.id, mockIntegration.id, 'LINKEDIN', 'bad-date', null)
      ).rejects.toThrow(/scheduledTime is invalid/);
    });
  });

  describe('publishNow', () => {
    it('schedules immediate publication', async () => {
      const userId = 'user-1';
      const contentId = 'content-1';
      const integrationId = 'int-1';

      const mockContent = { id: contentId, userId, title: 'T' };
      const mockIntegration = { id: integrationId, userId, platform: 'LINKEDIN' };
      const mockJob = { id: 'job-1', status: 'SCHEDULED' };

      global.mockPrisma.content.findUnique.mockResolvedValue(mockContent);
      global.mockPrisma.platformIntegration.findUnique.mockResolvedValue(mockIntegration);
      global.mockPrisma.scheduleJob.create.mockResolvedValue(mockJob);

      const res = await ScheduleService.publishNow(userId, contentId, integrationId, 'LINKEDIN', null);

      expect(res.status).toBe('SCHEDULED');
    });
  });

  describe('list', () => {
    it('returns scheduled jobs for a user', async () => {
      const userId = 'user-1';
      const mockJobs = [
        { id: 'j1', contentId: 'c1', platform: 'LINKEDIN', content: { userId } },
        { id: 'j2', contentId: 'c2', platform: 'WORDPRESS', content: { userId } }
      ];

      global.mockPrisma.scheduleJob.findMany.mockResolvedValue(mockJobs);

      const res = await ScheduleService.list(userId);

      expect(global.mockPrisma.scheduleJob.findMany).toHaveBeenCalledWith({
        where: { content: { userId } },
        include: { content: true, integration: true, result: true },
        orderBy: { scheduledTime: 'desc' }
      });
      expect(res).toEqual(mockJobs);
    });
  });

  describe('cancel', () => {
    it('cancels a pending schedule', async () => {
      const userId = 'user-1';
      const jobId = 'job-1';
      const mockJob = { id: jobId, status: 'SCHEDULED', content: { userId } };
      const mockCancelled = { ...mockJob, status: 'CANCELLED' };

      global.mockPrisma.scheduleJob.findUnique.mockResolvedValue(mockJob);
      global.mockPrisma.scheduleJob.update.mockResolvedValue(mockCancelled);

      const res = await ScheduleService.cancel(userId, jobId);

      expect(global.mockPrisma.scheduleJob.update).toHaveBeenCalledWith({
        where: { id: jobId },
        data: { status: 'CANCELLED' }
      });
      expect(res.status).toBe('CANCELLED');
    });

    it('does not cancel completed jobs', async () => {
      const userId = 'user-1';
      const jobId = 'job-1';
      const mockJob = { id: jobId, status: 'COMPLETED', content: { userId } };

      global.mockPrisma.scheduleJob.findUnique.mockResolvedValue(mockJob);

      const res = await ScheduleService.cancel(userId, jobId);

      expect(global.mockPrisma.scheduleJob.update).not.toHaveBeenCalled();
      expect(res.status).toBe('COMPLETED');
    });

    it('throws when job not found or not owned', async () => {
      global.mockPrisma.scheduleJob.findUnique.mockResolvedValue(null);
      await expect(ScheduleService.cancel('user-1', 'nope')).rejects.toThrow(/Schedule not found/);

      const jobWrongOwner = { id: 'j1', status: 'SCHEDULED', content: { userId: 'other' } };
      global.mockPrisma.scheduleJob.findUnique.mockResolvedValue(jobWrongOwner);
      await expect(ScheduleService.cancel('user-1', 'j1')).rejects.toThrow(/Schedule not found/);
    });
  });
});