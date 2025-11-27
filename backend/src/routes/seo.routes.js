import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { SeoController } from '../controllers/seo.controller.js';
import { seoScoreSchema } from '../validators/seo.schemas.js';

const router = Router();

router.post('/score', requireAuth(), validate(seoScoreSchema), SeoController.score);

export default router;
