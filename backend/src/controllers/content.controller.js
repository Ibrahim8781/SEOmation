import FastAPIService from '../services/fastapi.service.js';
import { ContentService } from '../services/content.service.js';
import { ImageService } from '../services/image.service.js';
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
      const payload = req.validated?.body ?? req.body ?? {};
      const userId = req.user.id;
      const profile = req.user.preferences?.onboarding?.businessProfile ?? null;

      const platform = (payload.platform || 'BLOG').toUpperCase();
      const requestedLanguage = payload.language || profile?.language || req.user.language || 'EN';
      let language = String(requestedLanguage).toUpperCase();

      const includeLinkedIn = toBoolean(payload.includeLinkedIn, false);
      const includeInstagram = toBoolean(payload.includeInstagram, false);
      const includeImage = toBoolean(payload.includeImage, false);
      const includeLinkedInImage = toBoolean(payload.includeLinkedInImage, false);
      const includeInstagramImage = toBoolean(payload.includeInstagramImage, false);
      const imagePrompt = payload.imagePrompt || topicTitle || focusKeyword || payload.prompt || '';

      const tone = payload.tone || profile?.toneOfVoice || req.user.tone || 'friendly';
      const targetLength = resolveTargetLength(payload.targetLength);
      const styleGuide = buildStyleGuide(profile);

      const topicId = payload.topicId || null;
      const prompt = typeof payload.prompt === 'string' ? payload.prompt.trim() : '';
      let focusKeyword = typeof payload.focusKeyword === 'string' ? payload.focusKeyword.trim() : null;
      let topicTitle = null;

      if (topicId) {
        const topic = await prisma.topic.findUnique({
          where: { id: topicId }
        });

        if (!topic || topic.userId !== userId) {
          throw new ApiError(404, 'Topic not found or unauthorized');
        }

        topicTitle = topic.title;
        focusKeyword = focusKeyword || topic.targetKeyword || topic.title;
        if (!payload.language && topic.language) {
          language = topic.language;
        }
      } else if (prompt) {
        topicTitle = prompt;
        focusKeyword = focusKeyword || prompt;
      } else {
        throw new ApiError(400, 'Either topicId or prompt must be provided');
      }

      const blogDraft = await FastAPIService.generateContent(
        userId,
        platform,
        language,
        topicTitle,
        focusKeyword,
        tone,
        targetLength,
        styleGuide
      );

      const { structured: blogStructure, ...blogPayload } = blogDraft;

      const saved = await ContentService.createDraft(userId, {
        ...blogPayload,
        platform,
        language,
        topicId
      });

      // Optional: attach images for the main draft
      if (includeImage) {
        try {
          await ImageService.generateAndAttach(saved.id, userId, {
            prompt: imagePrompt,
            count: 1,
            role: 'featured'
          });
        } catch (imgErr) {
          console.warn('[Image] Blog image generation failed', imgErr.message);
        }
      }

      const variantResults = {};
      const variantTasks = [];

      if (includeLinkedIn) {
        variantTasks.push(
          FastAPIService.generateContent(
            userId,
            'LINKEDIN',
            language,
            topicTitle,
            focusKeyword,
            tone,
            400,
            styleGuide
          )
            .then((draft) => {
              variantResults.linkedin = extractVariant(draft);
            })
            .catch((error) => {
              console.warn('[FastAPI] LinkedIn variant failed', error.message);
            })
        );
      }

      if (includeInstagram) {
        variantTasks.push(
          FastAPIService.generateContent(
            userId,
            'INSTAGRAM',
            language,
            topicTitle,
            focusKeyword,
            tone,
            180,
            styleGuide
          )
            .then((draft) => {
              variantResults.instagram = extractVariant(draft);
            })
            .catch((error) => {
              console.warn('[FastAPI] Instagram variant failed', error.message);
            })
        );
      }

      if (variantTasks.length) {
        await Promise.allSettled(variantTasks);
      }

      const definedVariants = Object.fromEntries(
        Object.entries(variantResults).filter(([, value]) => Boolean(value))
      );

      if (Object.keys(definedVariants).length > 0) {
        const updated = await ContentService.updateOwned(saved.id, userId, {
          aiMeta: {
            ...(saved.aiMeta ?? {}),
            social: definedVariants
          }
        });
        if (updated) {
          Object.assign(saved, updated);
        }
      }

      // Attach images for variants if requested
      if (includeLinkedInImage && definedVariants.linkedin) {
        try {
          await ImageService.generateAndAttach(saved.id, userId, {
            prompt: imagePrompt,
            count: 1,
            role: 'thumbnail'
          });
        } catch (e) {
          console.warn('[Image] LinkedIn image generation failed', e.message);
        }
      }

      if (includeInstagramImage && definedVariants.instagram) {
        try {
          await ImageService.generateAndAttach(saved.id, userId, {
            prompt: imagePrompt,
            count: 1,
            role: 'instagram_main'
          });
        } catch (e) {
          console.warn('[Image] Instagram image generation failed', e.message);
        }
      }

      let seo = null;
      try {
        seo = await FastAPIService.getSeoHints(
          platform,
          language,
          focusKeyword,
          saved.html || saved.text || ''
        );
      } catch (seoError) {
        console.warn('[FastAPI] SEO hints failed', seoError.message);
      }

      res.status(HTTP.CREATED).json({
        item: saved,
        focusKeyword,
        topicTitle,
        blog: {
          structured: blogStructure,
          diagnostics: blogDraft.aiMeta?.diagnostics ?? null
        },
        variants: definedVariants,
        seo
      });
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
      const payload = req.validated ?? { params: req.params, body: req.body };
      const updated = await ContentService.updateOwned(payload.params.id, req.user.id, payload.body);
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
      const payload = req.validated ?? { params: req.params, body: req.body };
      const { focusKeyword } = payload.body;
      const contentId = payload.params.id;

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

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return Boolean(value);
}

function resolveTargetLength(value) {
  if (value === undefined || value === null) return 1200;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 1200;
  return Math.min(3000, Math.max(600, parsed));
}

function buildStyleGuide(profile) {
  if (!profile) return [];
  const bullets = [];
  if (profile.contentGoals) {
    bullets.push(`Content goals: ${profile.contentGoals}`);
  }
  if (profile.targetAudience) {
    bullets.push(`Target audience: ${profile.targetAudience}`);
  }
  if (profile.publishingCadence) {
    bullets.push(`Publishing cadence: ${profile.publishingCadence}`);
  }
  if (Array.isArray(profile.preferredContentTypes) && profile.preferredContentTypes.length) {
    bullets.push(`Preferred content types: ${profile.preferredContentTypes.join(', ')}`);
  }
  if (profile.additionalNotes) {
    bullets.push(`Additional notes: ${profile.additionalNotes}`);
  }
  if (Array.isArray(profile.seedKeywords) && profile.seedKeywords.length) {
    bullets.push(`Important keywords: ${profile.seedKeywords.join(', ')}`);
  }
  if (profile.primaryRegion) {
    bullets.push(`Primary region: ${profile.primaryRegion}`);
  }
  return bullets;
}

function extractVariant(draft) {
  if (!draft) return null;
  return {
    html: draft.html,
    text: draft.text,
    structured: draft.structured ?? null,
    diagnostics: draft.aiMeta?.diagnostics ?? null
  };
}
