import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ContentController } from '../controllers/content.controller.js';
import { generateContentSchema, updateContentSchema, seoHintsSchema } from '../validators/content.schemas.js';

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

export default router;
