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
        role: payload.role || 'inline',
        position: typeof payload.position === 'number' ? payload.position : null
      }
    });

    await this._persistKeywordHintsFromAlt(contentId, userId, altText);
    return { asset, link };
  },

  async generateAndAttach(contentId, userId, payload) {
    const content = await assertOwnedContent(contentId, userId);
    if (!payload.prompt) throw new ApiError(400, 'prompt is required');

    let aiResponse;
    try {
      aiResponse = await FastAPIService.generateImages(payload.prompt, {
        style: payload.style || null,
        sizes: payload.sizes || ['1024x1024'],
        count: payload.count || 1,
        language: payload.language || 'en'
      });
    } catch (err) {
      aiResponse = {
        altText: payload.altText || payload.prompt,
        images: [
          {
            url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==',
            base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==',
            size: payload.sizes?.[0] || '1024x1024',
            provider: 'mock',
            error: err.message
          }
        ]
      };
    }

    const images = Array.isArray(aiResponse.images) ? aiResponse.images : [];
    const results = [];

    for (let i = 0; i < images.length; i += 1) {
      const img = images[i];
      const url = normalizeUrl(img);
      if (!url) continue;

      const altText = img.altText || aiResponse.altText || payload.altText || payload.prompt;
      const asset = await prisma.imageAsset.create({
        data: {
          userId,
          prompt: payload.prompt,
          url,
          altText,
          width: img.width || null,
          height: img.height || null,
          format: img.format || null,
          provider: img.provider || 'ai',
          aiMeta: {
            size: img.size || payload.sizes?.[i] || null,
            style: payload.style || null,
            source: 'generate'
          }
        }
      });

      const link = await prisma.contentImageLink.create({
        data: {
          contentId,
          imageId: asset.id,
          role: payload.role || 'inline',
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
