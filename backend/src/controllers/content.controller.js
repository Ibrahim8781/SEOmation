import FastAPIService from '../services/fastapi.service.js';
import { ContentService } from '../services/content.service.js';
import { ImageService } from '../services/image.service.js';
import { SeoService } from '../services/seo.service.js';
import ApiError from '../utils/ApiError.js';
import { HTTP } from '../utils/httpStatus.js';
import { prisma } from '../lib/prisma.js';
import logger from '../lib/logger.js';
import { LINKEDIN_POST_MAX_LENGTH } from '../constants/input-limits.js';

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

      const imagePrompt = payload.imagePrompt || topicTitle || focusKeyword || prompt || '';
      const imageStyle = payload.imageStyle || undefined;
      const aiResearchContext = buildAiResearchContext(userId, language, req.user, profile);

      const blogDraft = await FastAPIService.generateContent(
        userId,
        platform,
        language,
        topicTitle,
        focusKeyword,
        tone,
        targetLength,
        styleGuide,
        aiResearchContext
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
            style: imageStyle,
            count: 1,
            role: 'featured'
          });
        } catch (imgErr) {
          logger.warn({ contentId: saved.id, platform: 'BLOG', error: imgErr.message }, 'Image generation failed');
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
            styleGuide,
            aiResearchContext
          )
            .then((draft) => {
              variantResults.linkedin = extractVariant(draft, 'LINKEDIN');
            })
            .catch((error) => {
              logger.warn({ contentId: saved.id, platform: 'LINKEDIN', error: error.message }, 'Content variant generation failed');
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
            styleGuide,
            aiResearchContext
          )
            .then((draft) => {
              variantResults.instagram = extractVariant(draft, 'INSTAGRAM');
            })
            .catch((error) => {
              logger.warn({ contentId: saved.id, platform: 'INSTAGRAM', error: error.message }, 'Content variant generation failed');
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
            style: imageStyle,
            count: 1,
            role: 'thumbnail'
          });
        } catch (e) {
          logger.warn({ contentId: saved.id, platform: 'LINKEDIN', error: e.message }, 'Image generation failed');
        }
      }

      if (includeInstagramImage && definedVariants.instagram) {
        try {
          await ImageService.generateAndAttach(saved.id, userId, {
            prompt: imagePrompt,
            style: imageStyle,
            count: 1,
            role: 'instagram_main'
          });
        } catch (e) {
          logger.warn({ contentId: saved.id, platform: 'INSTAGRAM', error: e.message }, 'Image generation failed');
        }
      }

      const seoSummary = await buildSeoSummaryForContent(saved.id, saved, focusKeyword);
      const savedWithSeo = await ContentService.updateOwned(saved.id, userId, {
        seoSummary
      });
      if (savedWithSeo) {
        Object.assign(saved, savedWithSeo);
      }
      const seo = {
        score: Math.round(seoSummary.total ?? 0),
        hints: seoSummary.components
          .filter((component) => component.severity !== 'ok')
          .map((component) => ({ type: component.id, msg: component.message }))
      };

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

      const seoSummary = await buildSeoSummaryForContent(contentId, content, focusKeyword);
      const seoResult = {
        score: Math.round(seoSummary.total ?? 0),
        hints: seoSummary.components
          .filter((component) => component.severity !== 'ok')
          .map((component) => ({ type: component.id, msg: component.message }))
      };

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

function buildAiResearchContext(userId, language, user, profile) {
  const niche = profile?.niche ?? user?.niche ?? '';
  const normalizedLanguage = String(language || user?.language || 'EN').toLowerCase();
  const normalizedNiche = String(niche || 'general')
    .trim()
    .toLowerCase();

  return {
    includeTrend: profile?.includeTrends ?? true,
    niche,
    seedKeywords: Array.isArray(profile?.seedKeywords) ? profile.seedKeywords : [],
    region: profile?.primaryRegion ?? null,
    season: profile?.seasonalFocus ?? null,
    persona: {
      role: profile?.targetAudience || 'content reader',
      pains: Array.isArray(profile?.audiencePainPoints) ? profile.audiencePainPoints : []
    },
    namespace: `${userId}:${normalizedLanguage}:${normalizedNiche}`.toLowerCase()
  };
}

function extractVariant(draft, platform = 'BLOG') {
  if (!draft) return null;
  const text = platform === 'LINKEDIN'
    ? clampLinkedInText(draft.text)
    : draft.text;
  return {
    html: draft.html,
    text,
    structured: draft.structured ?? null,
    diagnostics: draft.aiMeta?.diagnostics ?? null
  };
}

function clampLinkedInText(value) {
  const text = String(value || '').trim();
  if (!text) return text;
  if (text.length <= LINKEDIN_POST_MAX_LENGTH) return text;
  return text.slice(0, LINKEDIN_POST_MAX_LENGTH).trimEnd();
}

async function buildSeoSummaryForContent(contentId, content, fallbackKeyword = '') {
  const linkedImages = await prisma.contentImageLink.findMany({
    where: { contentId },
    include: { image: true }
  });

  return SeoService.scoreContent({
    title: content.title || '',
    metaDescription: content.metaDescription || '',
    bodyHtml: content.html || content.text || '',
    primaryKeyword: content.primaryKeyword || fallbackKeyword || '',
    secondaryKeywords: Array.isArray(content.secondaryKeywords) ? content.secondaryKeywords : [],
    images: linkedImages.map((link) => ({
      altText: link.image?.altText || undefined
    }))
  });
}
