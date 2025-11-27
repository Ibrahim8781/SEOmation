import { ScheduleService } from '../services/schedule.service.js';
import { startPublisherWorker } from '../services/publisher.worker.js';
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
        payload.body.media
      );
      startPublisherWorker()?.tick?.().catch?.(() => {});
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
        payload.body.media
      );
      startPublisherWorker()?.tick?.().catch?.(() => {});
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
      res.json({ job });
    } catch (e) {
      next(e);
    }
  }
};
