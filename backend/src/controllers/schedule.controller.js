// backend/src/controllers/schedule.controller.js - UPDATED

import { ScheduleService } from '../services/schedule.service.js';
import { getScheduler } from '../services/smart-scheduler.service.js';
import { HTTP } from '../utils/httpStatus.js';

export const ScheduleController = {
  async schedule(req, res, next) {
    try {
      const payload = req.validated ?? { params: req.params, body: req.body };
      const job = await ScheduleService.schedule(
        req.user.id,
        payload.params.id,
        payload.body.integrationId,
        payload.body.platform,
        payload.body.scheduledTime,
        payload.body.timezone ?? req.user.timezone,
        payload.body.media
      );

      // Register with smart scheduler
      const scheduler = getScheduler();
      await scheduler.scheduleJob(job);

      res.status(HTTP.CREATED).json({ job });
    } catch (e) {
      next(e);
    }
  },

  async publishNow(req, res, next) {
    try {
      const payload = req.validated ?? { params: req.params, body: req.body };
      const job = await ScheduleService.publishNow(
        req.user.id,
        payload.params.id,
        payload.body.integrationId,
        payload.body.platform,
        req.user.timezone,
        payload.body.media
      );

      // Execute immediately via scheduler
      const scheduler = getScheduler();
      await scheduler.scheduleJob(job);

      res.status(HTTP.CREATED).json({ job });
    } catch (e) {
      next(e);
    }
  },

  async list(req, res, next) {
    try {
      const items = await ScheduleService.list(req.user.id);
      res.json({ items });
    } catch (e) {
      next(e);
    }
  },

  async cancel(req, res, next) {
    try {
      const payload = req.validated ?? { params: req.params };
      const job = await ScheduleService.cancel(req.user.id, payload.params.jobId);

      // Cancel in scheduler
      const scheduler = getScheduler();
      scheduler.cancelJob(job.id);

      res.json({ job });
    } catch (e) {
      next(e);
    }
  },

  /**
   * NEW: Get scheduler stats (for debugging/monitoring)
   */
  async stats(req, res, next) {
    try {
      const scheduler = getScheduler();
      const stats = scheduler.getStats();
      res.json(stats);
    } catch (e) {
      next(e);
    }
  }
};
