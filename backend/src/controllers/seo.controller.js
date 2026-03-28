import { SeoService } from '../services/seo.service.js';
import { ContentService } from '../services/content.service.js';
import ApiError from '../utils/ApiError.js';
import { HTTP } from '../utils/httpStatus.js';
import { prisma } from '../lib/prisma.js';
import { sanitizeContentHtml } from '../utils/html-content.js';
import { LINKEDIN_POST_MAX_LENGTH } from '../constants/input-limits.js';

export const SeoController = {
  async score(req, res, next) {
    try {
      const payload = req.validated?.body ?? req.body ?? {};
      const score = SeoService.scoreContent(payload);
      res.json(score);
    } catch (e) {
      next(e);
    }
  },

  /**
   * Save draft content and persist SEO summary
   */
  async scoreAndSaveDraft(req, res, next) {
    try {
      const payload = req.validated ?? { params: req.params, body: req.body };
      const contentId = payload.params.id;

      const owned = await ContentService.getByIdOwned(contentId, req.user.id);
      if (!owned) throw new ApiError(404, 'Content not found');

      const primaryKeyword =
        payload.body.primaryKeyword ||
        payload.body.focusKeyword ||
        owned.primaryKeyword ||
        owned.seoMeta?.focusKeyword ||
        null;

      if (!primaryKeyword) {
        throw new ApiError(400, 'primaryKeyword is required for SEO scoring');
      }

      const html = sanitizeContentHtml(payload.body.bodyHtml || payload.body.html || owned.html || '');
      const text = payload.body.text || owned.text || '';
      const linkedImages = await prisma.contentImageLink.findMany({
        where: { contentId },
        include: { image: true }
      });
      const seoImages = [
        ...(payload.body.images || []),
        ...linkedImages.map((link) => ({ altText: link.image?.altText || undefined }))
      ].filter((image) => image?.altText);

      const seo = SeoService.scoreContent({
        title: payload.body.title || owned.title,
        metaDescription: payload.body.metaDescription || owned.metaDescription || '',
        bodyHtml: html || text,
        primaryKeyword,
        secondaryKeywords: payload.body.secondaryKeywords || owned.secondaryKeywords || [],
        images: seoImages
      });

      // merge aiMeta.social updates
      let nextAiMeta = owned.aiMeta || {};
      if (payload.body.linkedinText || payload.body.instagramText) {
        const social = { ...(nextAiMeta.social || {}) };
        if (payload.body.linkedinText) {
          social.linkedin = { ...(social.linkedin || {}), text: clampLinkedInText(payload.body.linkedinText) };
        }
        if (payload.body.instagramText) {
          social.instagram = { ...(social.instagram || {}), text: payload.body.instagramText };
        }
        nextAiMeta = { ...nextAiMeta, social };
      }

      const data = cleanUndefined({
        title: payload.body.title ?? owned.title,
        html,
        text,
        metaDescription: payload.body.metaDescription ?? owned.metaDescription,
        primaryKeyword,
        secondaryKeywords: payload.body.secondaryKeywords,
        aiMeta: nextAiMeta,
        seoSummary: seo,
        status: payload.body.status ?? owned.status
      });

      const updated = await prisma.content.update({
        where: { id: contentId },
        data
      });
      if (!updated) throw new ApiError(404, 'Content not found');

      res.status(HTTP.OK).json({ item: updated, seo });
    } catch (e) {
      next(e);
    }
  }
};

function cleanUndefined(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  );
}

function clampLinkedInText(value) {
  const text = String(value || '').trim();
  if (!text) return text;
  if (text.length <= LINKEDIN_POST_MAX_LENGTH) return text;
  return text.slice(0, LINKEDIN_POST_MAX_LENGTH).trimEnd();
}
