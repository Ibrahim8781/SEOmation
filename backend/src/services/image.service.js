import ApiError from '../utils/ApiError.js';
import { prisma } from '../lib/prisma.js';
import FastAPIService from './fastapi.service.js';
import { AssetStorageService } from './asset-storage.service.js';
import { sanitizeContentRecord } from '../utils/html-content.js';

async function assertOwnedContent(contentId, userId) {
  const content = await prisma.content.findUnique({ where: { id: contentId } });
  if (!content || content.userId !== userId) {
    throw new ApiError(404, 'Content not found');
  }
  return content;
}

const ROLE_ALIASES = {
  featured: 'featured',
  inline: 'inline',
  instagram_main: 'instagram_main',
  instagram: 'instagram_main',
  insta: 'instagram_main',
  linkedin: 'featured', // treat linkedin images as featured landscape
  wordpress: 'featured',
  blog: 'featured'
};

const ALLOWED_ROLES = Array.from(new Set(Object.values(ROLE_ALIASES)));

const ROLE_DEFAULT_SIZES = {
  featured: ['1200x628'], // WordPress / LinkedIn hero aspect
  inline: ['1024x768'],   // general inline landscape
  instagram_main: ['1080x1080'] // square for Instagram
};

function normalizeRole(role) {
  if (!role) return 'inline';
  const key = String(role).toLowerCase();
  return ROLE_ALIASES[key] || 'inline';
}

function normalizeSizesForRole(role, sizes) {
  if (Array.isArray(sizes) && sizes.length > 0) return sizes;
  const normalized = normalizeRole(role);
  if (normalized && ROLE_DEFAULT_SIZES[normalized]) return ROLE_DEFAULT_SIZES[normalized];
  return ['1024x1024'];
}

function normalizePlatform(platform, role) {
  const normalizedPlatform = String(platform || '').toLowerCase();
  if (['blog', 'linkedin', 'instagram', 'wordpress'].includes(normalizedPlatform)) {
    return normalizedPlatform === 'wordpress' ? 'blog' : normalizedPlatform;
  }
  if (normalizeRole(role) === 'instagram_main') {
    return 'instagram';
  }
  return 'blog';
}

function normalizeUrl(image) {
  if (image.url) return image.url;
  if (image.base64) return `data:image/png;base64,${image.base64}`;
  return null;
}

const MAX_SECONDARY_KEYWORD_HINTS = 12;
const ALT_KEYWORD_STOPWORDS = new Set([
  'about',
  'after',
  'before',
  'being',
  'between',
  'could',
  'during',
  'every',
  'from',
  'into',
  'other',
  'their',
  'there',
  'these',
  'those',
  'through',
  'using',
  'where',
  'which',
  'while',
  'whose',
  'would',
  'image',
  'images',
  'photo',
  'photos',
  'picture',
  'pictures',
  'graphic',
  'graphics',
  'illustration',
  'illustrations',
  'artwork',
  'design',
  'background',
  'banner',
  'poster',
  'cover',
  'scene'
]);

function safeSecondaryKeywords(value) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string');
  return [];
}

function extractKeywordHintsFromAltText(altText) {
  const tokens = String(altText || '').match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) || [];

  return tokens
    .map((token) => token.replace(/^[-']+|[-']+$/g, '').toLowerCase())
    .filter((token) => token.length >= 5)
    .filter((token) => /[\p{L}]/u.test(token))
    .filter((token) => !/^\d+$/.test(token))
    .filter((token) => !ALT_KEYWORD_STOPWORDS.has(token));
}

function mergeSecondaryKeywords(existingKeywords, newKeywords) {
  const merged = [];
  const seen = new Set();

  for (const keyword of [...existingKeywords, ...newKeywords]) {
    const normalized = String(keyword || '').trim();
    if (!normalized) continue;

    const dedupeKey = normalized.toLowerCase();
    if (seen.has(dedupeKey)) continue;

    seen.add(dedupeKey);
    merged.push(normalized);

    if (merged.length >= MAX_SECONDARY_KEYWORD_HINTS) {
      break;
    }
  }

  return merged;
}

async function persistStoredAsset({ userId, sourceUrl, dataUrl, aiMeta, format }) {
  const stored = await AssetStorageService.persistImage({
    userId,
    sourceUrl,
    dataUrl
  });

  return {
    url: stored.url,
    format: format || stored.format,
    aiMeta: {
      ...(aiMeta || {}),
      storage: stored.storageMeta,
      originalUrl: aiMeta?.originalUrl || stored.storageMeta.originalUrl || null
    }
  };
}

export const ImageService = {
  async listForContent(contentId, userId) {
    await assertOwnedContent(contentId, userId);
    return prisma.contentImageLink.findMany({
      where: { contentId },
      include: { image: true },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
    });
  },

  async uploadAndAttach(contentId, userId, payload) {
    const content = await assertOwnedContent(contentId, userId);
    const role = normalizeRole(payload.role);
    if (role && !ALLOWED_ROLES.includes(role)) {
      throw new ApiError(400, `role must be one of: ${ALLOWED_ROLES.join(', ')}`);
    }
    const url = payload.dataUrl || payload.url;
    if (!url) {
      throw new ApiError(400, 'dataUrl or url is required');
    }

    const altText = payload.altText || `Image for ${content.title}`;
    const stored = await persistStoredAsset({
      userId,
      sourceUrl: payload.url,
      dataUrl: payload.dataUrl,
      aiMeta: payload.aiMeta || null,
      format: payload.format || null
    });
    const asset = await prisma.imageAsset.create({
      data: {
        userId,
        prompt: payload.prompt || null,
        url: stored.url,
        altText,
        width: payload.width || null,
        height: payload.height || null,
        format: stored.format || null,
        provider: payload.provider || 'upload',
        aiMeta: stored.aiMeta
      }
    });

    const link = await prisma.contentImageLink.create({
        data: {
          contentId,
          imageId: asset.id,
          role,
          position: typeof payload.position === 'number' ? payload.position : null
        }
      });

    await this._persistKeywordHintsFromAlt(contentId, userId, altText);
    return { asset, link };
  },

  async generateAndAttach(contentId, userId, payload) {
    const content = await assertOwnedContent(contentId, userId);
    if (!payload.prompt) throw new ApiError(400, 'prompt is required');
    const role = normalizeRole(payload.role || 'inline');
    if (role && !ALLOWED_ROLES.includes(role)) {
      throw new ApiError(400, `role must be one of: ${ALLOWED_ROLES.join(', ')}`);
    }

    const aiResponse = await FastAPIService.generateImages(payload.prompt, {
      platform: normalizePlatform(payload.platform, role),
      style: payload.style || null,
      sizes: normalizeSizesForRole(role, payload.sizes),
      count: payload.count || 1,
      language: payload.language || 'en'
    });

    const images = Array.isArray(aiResponse.images) ? aiResponse.images : [];
    const results = [];

    for (let i = 0; i < images.length; i += 1) {
      const img = images[i];
      const url = normalizeUrl(img);
      if (!url) continue;

      const altText = img.altText || aiResponse.altText || payload.altText || payload.prompt;
      const meta = img.meta || {};
      const stored = await persistStoredAsset({
        userId,
        sourceUrl: url,
        aiMeta: {
          size: img.size || payload.sizes?.[i] || null,
          style: payload.style || null,
          source: meta.source || img.provider || 'generate',
          sourceDetails: meta.sourceDetails || null,
          originalUrl: meta.sourceDetails?.originalUrl || img.url || null,
          error: img.error || null,
          errors: meta.errors || null,
          isPlaceholder: img.provider === 'placeholder'
        },
        format: img.format || null
      });
      const asset = await prisma.imageAsset.create({
        data: {
          userId,
          prompt: payload.prompt,
          url: stored.url,
          altText,
          width: img.width || null,
          height: img.height || null,
          format: stored.format || null,
          provider: img.provider || meta.source || 'ai',
          aiMeta: stored.aiMeta
        }
      });

      const link = await prisma.contentImageLink.create({
        data: {
          contentId,
          imageId: asset.id,
          role,
          position: typeof payload.position === 'number' ? payload.position : i
        }
      });

      results.push({ asset, link });
    }

    await this._persistKeywordHintsFromAlt(contentId, userId, aiResponse.altText || payload.prompt);
    return { content: sanitizeContentRecord(content), results };
  },

  async _persistKeywordHintsFromAlt(contentId, userId, altText) {
    if (!altText) return;
    const owned = await prisma.content.findUnique({ where: { id: contentId } });
    if (!owned || owned.userId !== userId) return;

    const existingSecondary = safeSecondaryKeywords(owned.secondaryKeywords);
    const extractedKeywords = extractKeywordHintsFromAltText(altText);
    if (extractedKeywords.length === 0) return;

    const merged = mergeSecondaryKeywords(existingSecondary, extractedKeywords);

    await prisma.content.update({
      where: { id: contentId },
      data: { secondaryKeywords: merged }
    });
  },

  async removeLink(contentId, linkId, userId) {
    await assertOwnedContent(contentId, userId);
    const link = await prisma.contentImageLink.findFirst({
      where: { id: linkId, contentId },
      include: { image: true }
    });
    if (!link) throw new ApiError(404, 'Image link not found');
    await prisma.contentImageLink.delete({ where: { id: linkId } });
    return link;
  }
};
