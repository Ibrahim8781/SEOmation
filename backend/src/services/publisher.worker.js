import { prisma } from '../lib/prisma.js';
import logger from '../lib/logger.js';
import { config } from '../config/index.js';
import { publishToPlatform } from './platform-publisher.service.js';

export class PublisherWorker {
  constructor(intervalMs = 60000) {
    this.intervalMs = intervalMs;
    this.timer = null;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), this.intervalMs);
    // Kick off immediately
    this.tick();
    logger.info({ interval: this.intervalMs }, 'Publisher worker started');
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick() {
    try {
      const now = new Date();
      const due = await prisma.scheduleJob.findMany({
        where: { status: 'SCHEDULED', scheduledTime: { lte: now } },
        orderBy: { scheduledTime: 'asc' },
        take: 5,
        include: { content: true, integration: true }
      });
      for (const job of due) {
        // eslint-disable-next-line no-await-in-loop
        await this.processJob(job);
      }
    } catch (err) {
      logger.error({ err }, 'Publisher worker tick failed');
    }
  }

  async processJob(job) {
    const claimed = await prisma.scheduleJob.updateMany({
      where: { id: job.id, status: 'SCHEDULED' },
      data: { status: 'RUNNING', attempts: { increment: 1 } }
    });
    if (claimed.count === 0) return;

    const attempts = job.attempts + 1;

    try {
      const result = await publishToPlatform(job);
      await prisma.scheduleJob.update({
        where: { id: job.id },
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
      logger.info({ jobId: job.id, platform: job.platform }, 'Publish success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const fatal =
        /access token missing/i.test(msg) ||
        /401/.test(msg) ||
        /403/.test(msg) ||
        /unauthorized/i.test(msg) ||
        /forbidden/i.test(msg) ||
        /author/i.test(msg);
      const nextTime = new Date(Date.now() + Math.pow(2, attempts) * 60_000);
      const final = fatal || attempts >= 3;
      await prisma.scheduleJob.update({
        where: { id: job.id },
        data: {
          status: final ? 'FAILED' : 'SCHEDULED',
          attempts,
          scheduledTime: final ? job.scheduledTime : nextTime,
          lastError: msg.slice(0, 500)
        }
      });
      logger.error(
        { jobId: job.id, platform: job.platform, err: msg, fatal },
        'Publish failed'
      );
    }
  }
}

let workerInstance = null;

export function startPublisherWorker() {
  if (workerInstance) return workerInstance;
  const intervalMs = Number(config.publisher?.intervalMs || 60000);
  workerInstance = new PublisherWorker(intervalMs);
  workerInstance.start();
  return workerInstance;
}
