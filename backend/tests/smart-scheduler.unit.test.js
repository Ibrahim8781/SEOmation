import { jest } from '@jest/globals';

const scheduleScheduleJobMock = jest.fn();
const loggerInfoMock = jest.fn();
const loggerWarnMock = jest.fn();
const loggerErrorMock = jest.fn();

const updateManyMock = jest.fn();
const findUniqueMock = jest.fn();
const updateMock = jest.fn();

jest.unstable_mockModule('node-schedule', () => ({
  default: {
    scheduleJob: scheduleScheduleJobMock
  }
}));

jest.unstable_mockModule('../src/lib/logger.js', () => ({
  default: {
    info: loggerInfoMock,
    warn: loggerWarnMock,
    error: loggerErrorMock
  }
}));

jest.unstable_mockModule('../src/lib/prisma.js', () => ({
  prisma: {
    scheduleJob: {
      updateMany: updateManyMock,
      findUnique: findUniqueMock,
      update: updateMock
    }
  }
}));

const { SmartScheduler } = await import('../src/services/smart-scheduler.service.js');

describe('SmartScheduler', () => {
  const baseJob = {
    id: 'job-1',
    platform: 'WORDPRESS',
    scheduledTime: new Date('2026-03-17T10:00:00.000Z'),
    media: null
  };

  const hydratedJob = {
    ...baseJob,
    content: {
      id: 'content-1',
      title: 'Immediate publish',
      html: '<p>Hello</p>',
      text: 'Hello',
      aiMeta: {}
    },
    integration: {
      id: 'integration-1',
      platform: 'WORDPRESS',
      accessToken: null,
      metadata: {
        siteUrl: 'https://example.com',
        mock: true
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    updateManyMock.mockResolvedValue({ count: 1 });
    findUniqueMock.mockResolvedValue(hydratedJob);
    updateMock.mockResolvedValue({});
  });

  it('executes already-due jobs immediately instead of sending them to node-schedule', async () => {
    const scheduler = new SmartScheduler();
    const pastJob = {
      ...baseJob,
      scheduledTime: new Date(Date.now() - 1_000)
    };

    await scheduler.scheduleJob(pastJob);

    expect(scheduleScheduleJobMock).not.toHaveBeenCalled();
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { id: pastJob.id, status: 'SCHEDULED' },
      data: { status: 'RUNNING', attempts: { increment: 1 } }
    });
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: pastJob.id },
        data: expect.objectContaining({
          status: 'COMPLETED',
          lastError: null
        })
      })
    );
    expect(scheduler.getStats()).toEqual({
      activeJobs: 0,
      isShuttingDown: false
    });
  });

  it('falls back to immediate execution if node-schedule rejects registration', async () => {
    const scheduler = new SmartScheduler();
    const futureJob = {
      ...baseJob,
      scheduledTime: new Date(Date.now() + 10_000)
    };

    scheduleScheduleJobMock.mockReturnValueOnce(null);

    await scheduler.scheduleJob(futureJob);

    expect(scheduleScheduleJobMock).toHaveBeenCalledWith(futureJob.scheduledTime, expect.any(Function));
    expect(updateManyMock).toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalled();
    expect(loggerWarnMock).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: futureJob.id,
        platform: futureJob.platform
      }),
      'node-schedule did not register the job, executing immediately'
    );
  });
});
