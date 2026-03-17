// backend/src/services/smart-scheduler.service.js

import schedule from 'node-schedule';
import { prisma } from '../lib/prisma.js';
import logger from '../lib/logger.js';
import { publishToPlatform } from './platform-publisher.service.js';

const GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 minutes

export class SmartScheduler {
  constructor() {
    this.jobs = new Map(); // jobId -> node-schedule Job
    this.isShuttingDown = false;
  }

  /**
   * Schedule a new job
   */
  async scheduleJob(scheduleJobRecord) {
    if (this.isShuttingDown) {
      logger.warn({ jobId: scheduleJobRecord.id }, 'Cannot schedule job during shutdown');
      return;
    }

    const jobId = scheduleJobRecord.id;
    const scheduledTime = new Date(scheduleJobRecord.scheduledTime);
    const now = Date.now();

    if (this.jobs.has(jobId)) {
      this.jobs.get(jobId).cancel();
      this.jobs.delete(jobId);
    }

    if (Number.isNaN(scheduledTime.getTime())) {
      logger.error({ jobId, scheduledTime: scheduleJobRecord.scheduledTime }, 'Invalid scheduled time');
      return;
    }

    if (scheduledTime.getTime() <= now) {
      logger.info(
        {
          jobId,
          scheduledTime,
          platform: scheduleJobRecord.platform,
          overdueByMs: now - scheduledTime.getTime()
        },
        'Job is already due, executing immediately'
      );
      await this.executeJob(scheduleJobRecord);
      return;
    }

    const job = schedule.scheduleJob(scheduledTime, async () => {
      await this.executeJob(scheduleJobRecord);
    });

    if (!job) {
      logger.warn(
        { jobId, scheduledTime, platform: scheduleJobRecord.platform },
        'node-schedule did not register the job, executing immediately'
      );
      await this.executeJob(scheduleJobRecord);
      return;
    }

    this.jobs.set(jobId, job);

    logger.info(
      { jobId, scheduledTime, platform: scheduleJobRecord.platform },
      'Job scheduled with node-schedule'
    );
  }

  /**
   * Execute a job (publish to platform)
   */
  async executeJob(scheduleJobRecord) {
    const jobId = scheduleJobRecord.id;

    const claimed = await prisma.scheduleJob.updateMany({
      where: { id: jobId, status: 'SCHEDULED' },
      data: { status: 'RUNNING', attempts: { increment: 1 } }
    });

    if (claimed.count === 0) {
      logger.warn({ jobId }, 'Job already claimed or not SCHEDULED');
      this.jobs.delete(jobId);
      return;
    }

    const job = await prisma.scheduleJob.findUnique({
      where: { id: jobId },
      include: { content: true, integration: true }
    });

    if (!job) {
      logger.error({ jobId }, 'Job not found in database');
      this.jobs.delete(jobId);
      return;
    }

    const attempts = job.attempts;

    try {
      logger.info({ jobId, platform: job.platform }, 'Publishing to platform');

      const result = await publishToPlatform(job);

      await prisma.scheduleJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          lastError: null,
          result: {
            upsert: {
              create: {
                externalId: result.externalId || null,
                publishedAt: result.publishedAt || new Date(),
                response: result.response || null
              },
              update: {
                externalId: result.externalId || null,
                publishedAt: result.publishedAt || new Date(),
                response: result.response || null
              }
            }
          }
        }
      });

      logger.info({ jobId, platform: job.platform }, 'Publish success');
      this.jobs.delete(jobId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const fatal =
        /access token missing/i.test(msg) ||
        /401/.test(msg) ||
        /403/.test(msg) ||
        /unauthorized/i.test(msg) ||
        /forbidden/i.test(msg) ||
        /author/i.test(msg);

      const final = fatal || attempts >= 3;

      if (final) {
        await prisma.scheduleJob.update({
          where: { id: jobId },
          data: {
            status: 'FAILED',
            attempts,
            lastError: msg.slice(0, 500)
          }
        });
        logger.error({ jobId, platform: job.platform, err: msg, fatal }, 'Publish failed (final)');
        this.jobs.delete(jobId);
      } else {
        const retryDelayMs = Math.pow(2, attempts) * 60_000; // 2min, 4min, 8min
        const nextTime = new Date(Date.now() + retryDelayMs);

        await prisma.scheduleJob.update({
          where: { id: jobId },
          data: {
            status: 'SCHEDULED',
            attempts,
            scheduledTime: nextTime,
            lastError: msg.slice(0, 500)
          }
        });

        logger.warn(
          { jobId, platform: job.platform, attempts, retryAt: nextTime },
          'Publish failed, retrying'
        );

        const updatedJob = await prisma.scheduleJob.findUnique({
          where: { id: jobId },
          include: { content: true, integration: true }
        });
        if (updatedJob) {
          await this.scheduleJob(updatedJob);
        }
      }
    }
  }

  /**
   * Cancel a scheduled job
   */
  cancelJob(jobId) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.cancel();
      this.jobs.delete(jobId);
      logger.info({ jobId }, 'Job cancelled');
    }
  }

  /**
   * Reload pending jobs from database on server start
   */
  async reloadFromDatabase() {
    const now = new Date();

    const jobs = await prisma.scheduleJob.findMany({
      where: { status: 'SCHEDULED' },
      include: { content: true, integration: true }
    });

    logger.info({ count: jobs.length }, 'Reloading scheduled jobs from database');

    for (const job of jobs) {
      const scheduledTime = new Date(job.scheduledTime);
      const missedBy = now - scheduledTime;

      if (missedBy < 0) {
        await this.scheduleJob(job);
      } else if (missedBy < GRACE_PERIOD_MS) {
        logger.info(
          { jobId: job.id, missedBy: `${Math.round(missedBy / 1000)}s` },
          'Job missed but within grace period, publishing now'
        );
        await this.executeJob(job);
      } else {
        logger.warn(
          { jobId: job.id, missedBy: `${Math.round(missedBy / 60000)}min` },
          'Job missed and outside grace period, marking as FAILED'
        );
        await prisma.scheduleJob.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            lastError: `Server was offline. Missed scheduled time by ${Math.round(missedBy / 60000)} minutes.`
          }
        });
      }
    }

    const running = await prisma.scheduleJob.findMany({
      where: { status: 'RUNNING' },
      include: { content: true, integration: true }
    });

    for (const job of running) {
      logger.warn({ jobId: job.id }, 'Found stuck RUNNING job, retrying');
      await prisma.scheduleJob.update({
        where: { id: job.id },
        data: { status: 'SCHEDULED', scheduledTime: now }
      });

      const updated = await prisma.scheduleJob.findUnique({
        where: { id: job.id },
        include: { content: true, integration: true }
      });
      if (updated) {
        await this.scheduleJob(updated);
      }
    }

    logger.info({ active: this.jobs.size }, 'Job reload complete');
  }

  /**
   * Graceful shutdown: wait for running jobs to finish
   */
  async shutdown() {
    this.isShuttingDown = true;
    const activeCount = this.jobs.size;

    if (activeCount === 0) {
      logger.info('No active jobs, shutting down immediately');
      return;
    }

    logger.info({ activeJobs: activeCount }, 'Graceful shutdown: waiting for jobs to finish');

    this.jobs.forEach((job, jobId) => {
      job.cancel();
      logger.info({ jobId }, 'Job cancelled during shutdown');
    });

    this.jobs.clear();

    logger.info('All jobs cancelled, shutdown complete');
  }

  /**
   * Get scheduler stats
   */
  getStats() {
    return {
      activeJobs: this.jobs.size,
      isShuttingDown: this.isShuttingDown
    };
  }
}

let schedulerInstance = null;

export function getScheduler() {
  if (!schedulerInstance) {
    schedulerInstance = new SmartScheduler();
  }
  return schedulerInstance;
}

export async function startSmartScheduler() {
  const scheduler = getScheduler();
  await scheduler.reloadFromDatabase();
  logger.info('Smart scheduler started');
  return scheduler;
}
