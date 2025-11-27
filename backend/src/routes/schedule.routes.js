import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ScheduleController } from '../controllers/schedule.controller.js';
import { cancelScheduleSchema, publishNowSchema, scheduleJobSchema } from '../validators/schedule.schemas.js';

const router = Router();

router.get('/', requireAuth(), ScheduleController.list);
router.post(
  '/content/:id/schedule',
  requireAuth(),
  validate(scheduleJobSchema),
  ScheduleController.schedule
);
router.post(
  '/content/:id/publish-now',
  requireAuth(),
  validate(publishNowSchema),
  ScheduleController.publishNow
);
router.post('/:jobId/cancel', requireAuth(), validate(cancelScheduleSchema), ScheduleController.cancel);

export default router;
