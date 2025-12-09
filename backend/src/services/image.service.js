import ApiError from '../utils/ApiError.js';
import { prisma } from '../lib/prisma.js';
import FastAPIService from './fastapi.service.js';

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

function normalizeUrl(image) {
  if (image.url) return image.url;
  if (image.base64) return `data:image/png;base64,${image.base64}`;
  return null;
}

function safeSecondaryKeywords(value) {
  if (Array.isArray(value)) return value;
  return [];
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
      throw new ApiError(400, 'dataUrl is required');
    }

    const altText = payload.altText || `Image for ${content.title}`;
    const asset = await prisma.imageAsset.create({
      data: {
        userId,
        prompt: payload.prompt || null,
        url,
        altText,
        width: payload.width || null,
        height: payload.height || null,
        format: payload.format || null,
        provider: payload.provider || 'upload',
        aiMeta: payload.aiMeta || null
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
      const asset = await prisma.imageAsset.create({
        data: {
          userId,
          prompt: payload.prompt,
          url,
          altText,
          width: img.width || null,
          height: img.height || null,
          format: img.format || null,
          provider: img.provider || meta.source || 'ai',
          aiMeta: {
            size: img.size || payload.sizes?.[i] || null,
            style: payload.style || null,
            source: meta.source || img.provider || 'generate',
            sourceDetails: meta.sourceDetails || null,
            originalUrl: meta.sourceDetails?.originalUrl || img.url || null,
            error: img.error || null
          }
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
    return { content, results };
  },

  async _persistKeywordHintsFromAlt(contentId, userId, altText) {
    if (!altText) return;
    const owned = await prisma.content.findUnique({ where: { id: contentId } });
    if (!owned || owned.userId !== userId) return;

    const existingSecondary = safeSecondaryKeywords(owned.secondaryKeywords);
    const words = altText
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 4);
    const merged = Array.from(new Set([...existingSecondary, ...words])).slice(0, 12);

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
