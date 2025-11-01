import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { TopicController } from '../controllers/topic.controller.js';
import { generateTopicsSchema } from '../validators/topic.schemas.js';

const router = express.Router();

/**
 * POST /api/topics/generate
 * Generate topic ideas using AI/FastAPI
 * 
 * Request body:
 * {
 *   "platform": "BLOG",
 *   "language": "EN",
 *   "context": {
 *     "niche": "SaaS SEO",
 *     "audience": "founders",
 *     "tone": "helpful",
 *     "seedKeywords": [],
 *     "region": "US",
 *     "season": "Q4"
 *   }
 * }
 * 
 * Response:
 * {
 *   "items": [
 *     {
 *       "id": "uuid",
 *       "userId": "user-id",
 *       "title": "SaaS SEO content strategy for 2025",
 *       "platform": "BLOG",
 *       "language": "EN",
 *       "relevance": 0.92,
 *       "isRelevant": true,
 *       "aiMeta": { ... },
 *       "status": "SUGGESTED",
 *       "createdAt": "2025-10-31T12:13:34.745Z",
 *       "updatedAt": "2025-10-31T12:13:34.745Z"
 *     },
 *     ...
 *   ],
 *   "meta": {
 *     "status": "SUGGESTED",
 *     "action": "Select topics to generate content"
 *   }
 * }
 */
router.post('/generate', requireAuth(), validate(generateTopicsSchema), TopicController.generate);

/**
 * GET /api/topics
 * List all topics for authenticated user
 * 
 * Response:
 * {
 *   "items": [
 *     { id, userId, title, platform, language, relevance, status, ... },
 *     ...
 *   ]
 * }
 */
router.get('/', requireAuth(), TopicController.list);

export default router;
