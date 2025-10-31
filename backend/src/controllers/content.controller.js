import FastAPIService from '../services/fastapi.service.js';
import { ContentService } from '../services/content.service.js';
import ApiError from '../utils/ApiError.js';
import { HTTP } from '../utils/httpStatus.js';
import { prisma } from '../lib/prisma.js';

export const ContentController = {
  /**
   * POST /api/content/generate
   * Combined endpoint for both topicId-based and prompt-based content generation
   * 
   * Scenario 1 - From selected topic (topicId):
   * {
   *   platform: "BLOG",
   *   language: "EN",
   *   topicId: "d23e3620-f2a6-4e1a-84ba-44846401679b"
   * }
   * 
   * Scenario 2 - From custom prompt (no topicId):
   * {
   *   platform: "BLOG",
   *   language: "EN",
   *   prompt: "Write a guide on onboarding new SaaS users"
   * }
   */
  async generate(req, res, next) {
    try {
      const { platform, language, topicId, prompt } = req.body;
      const userId = req.user.id;

      // Validate input: either topicId or prompt must be provided
      if (!topicId && !prompt) {
        throw new ApiError(400, 'Either topicId or prompt must be provided');
      }

      let topicTitle = null;
      let focusKeyword = null;

      // If topicId provided, fetch the topic and verify ownership
      if (topicId) {
        const topic = await prisma.topic.findUnique({
          where: { id: topicId }
        });

        if (!topic || topic.userId !== userId) {
          throw new ApiError(404, 'Topic not found or unauthorized');
        }

        topicTitle = topic.title;
        focusKeyword = topic.targetKeyword || topic.title;
      } else {
        // If prompt provided, use it as the topic title
        topicTitle = prompt;
        focusKeyword = prompt;
      }

      // Get user's tone preference (default: friendly)
      const tone = req.user.tone || 'friendly';

      // Call FastAPI to generate content
      const draft = await FastAPIService.generateContent(
        userId,
        platform,
        language,
        topicTitle,
        focusKeyword,
        tone,
        1200, // targetLength
        [] // styleGuideBullets
      );

      // Save generated content to database
      const saved = await ContentService.createDraft(userId, {
        ...draft,
        platform,
        language,
        topicId: topicId || null
      });

      res.status(HTTP.CREATED).json(saved);
    } catch (e) {
      next(e);
    }
  },

  /**
   * GET /api/content
   * List all content drafts for the authenticated user
   */
  async list(req, res, next) {
    try {
      const items = await ContentService.listByUser(req.user.id);
      res.json({ items });
    } catch (e) {
      next(e);
    }
  },

  /**
   * GET /api/content/:id
   * Get a specific content draft by ID (verify ownership)
   */
  async getById(req, res, next) {
    try {
      const item = await ContentService.getByIdOwned(req.params.id, req.user.id);
      if (!item) throw new ApiError(404, 'Content not found');
      res.json(item);
    } catch (e) {
      next(e);
    }
  },

  /**
   * PUT /api/content/:id
   * Update a content draft
   */
  async update(req, res, next) {
    try {
      const updated = await ContentService.updateOwned(req.params.id, req.user.id, req.body);
      if (!updated) throw new ApiError(404, 'Content not found');
      res.json(updated);
    } catch (e) {
      next(e);
    }
  },

  /**
   * POST /api/content/:id/seo-hints
   * NEW: Get SEO score and hints for generated content
   * 
   * Request body:
   * {
   *   focusKeyword: "SaaS SEO"
   * }
   */
  async getSeoHints(req, res, next) {
    try {
      const { focusKeyword } = req.body;
      const contentId = req.params.id;

      // Fetch content to verify ownership
      const content = await ContentService.getByIdOwned(contentId, req.user.id);
      if (!content) throw new ApiError(404, 'Content not found');

      if (!focusKeyword) {
        throw new ApiError(400, 'focusKeyword is required');
      }

      // Call FastAPI SEO service
      const seoResult = await FastAPIService.getSeoHints(
        content.platform,
        content.language,
        focusKeyword,
        content.html || content.text
      );

      res.json({
        contentId,
        focusKeyword,
        ...seoResult
      });
    } catch (e) {
      next(e);
    }
  }
};