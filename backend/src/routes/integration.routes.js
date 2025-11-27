import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { IntegrationController } from '../controllers/integration.controller.js';
import { integrationCallbackSchema, platformParamSchema } from '../validators/integration.schemas.js';
import { setWpSiteSchema } from '../validators/site.schemas.js';

const router = Router();

router.get('/', requireAuth(), IntegrationController.list);
router.get('/:platform/auth-url', requireAuth(), validate(platformParamSchema), IntegrationController.authUrl);
router.get(
  '/:platform/callback',
  validate(integrationCallbackSchema),
  IntegrationController.callback
);
router.delete('/:platform', requireAuth(), validate(platformParamSchema), IntegrationController.remove);
router.post('/wordpress/site', requireAuth(), validate(setWpSiteSchema), IntegrationController.setWpSite);

export default router;
