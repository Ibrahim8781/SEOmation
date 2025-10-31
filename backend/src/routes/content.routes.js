import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ContentController } from '../controllers/content.controller.js';

const router = express.Router();

/**
 * POST /api/content/generate
 * Generate content from topic OR custom prompt
 */
router.post('/generate', requireAuth(), ContentController.generate);

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
router.put('/:id', requireAuth(), ContentController.update);

/**
 * POST /api/content/:id/seo-hints
 * Get SEO score and hints
 */
router.post('/:id/seo-hints', requireAuth(), ContentController.getSeoHints);

export default router;