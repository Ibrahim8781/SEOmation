import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ContentController } from '../controllers/content.controller.js';
import { SeoController } from '../controllers/seo.controller.js';
import { ImageController } from '../controllers/image.controller.js';
import { generateContentSchema, updateContentSchema, seoHintsSchema } from '../validators/content.schemas.js';
import { saveDraftWithSeoSchema } from '../validators/seo.schemas.js';
import { generateImageSchema, uploadImageSchema, deleteImageLinkSchema } from '../validators/image.schemas.js';
import { platformParamSchema } from '../validators/integration.schemas.js';

const router = express.Router();

/**
 * POST /api/content/generate
 * Generate content from topic OR custom prompt
 */
router.post('/generate', requireAuth(), validate(generateContentSchema), ContentController.generate);

/**
 * GET /api/content
 * List all content drafts
 */
router.get('/', requireAuth(), ContentController.list);

/**
 * GET /api/content/:id
 * Get specific content by ID
 */
router.get('/:id', requireAuth(), ContentController.getById);

/**
 * PUT /api/content/:id
 * Update content draft
 */
router.put('/:id', requireAuth(), validate(updateContentSchema), ContentController.update);

/**
 * POST /api/content/:id/seo-hints
 * Get SEO score and hints
 */
router.post('/:id/seo-hints', requireAuth(), validate(seoHintsSchema), ContentController.getSeoHints);

/**
 * GET /api/content/:id/images
 */
router.get('/:id/images', requireAuth(), ImageController.list);

/**
 * POST /api/content/:id/images/generate
 */
router.post(
  '/:id/images/generate',
  requireAuth(),
  validate(generateImageSchema),
  ImageController.generate
);

/**
 * POST /api/content/:id/images/upload
 */
router.post(
  '/:id/images/upload',
  requireAuth(),
  validate(uploadImageSchema),
  ImageController.upload
);

/**
 * DELETE /api/content/:id/images/:linkId
 */
router.delete(
  '/:id/images/:linkId',
  requireAuth(),
  validate(deleteImageLinkSchema),
  ImageController.remove
);

/**
 * POST /api/content/:id/save
 * Save a draft and persist SEO summary
 */
router.post('/:id/save', requireAuth(), validate(saveDraftWithSeoSchema), SeoController.scoreAndSaveDraft);

export default router;
