import { ImageService } from '../services/image.service.js';
import { HTTP } from '../utils/httpStatus.js';

export const ImageController = {
  async list(req, res, next) {
    try {
      const contentId = req.params.id;
      const items = await ImageService.listForContent(contentId, req.user.id);
      res.json({ items });
    } catch (e) {
      next(e);
    }
  },

  async upload(req, res, next) {
    try {
      const payload = req.validated ?? { params: req.params, body: req.body };
      const result = await ImageService.uploadAndAttach(payload.params.id, req.user.id, {
        dataUrl: payload.body.dataUrl || payload.body.url,
        altText: payload.body.altText,
        role: payload.body.role,
        position: payload.body.position,
        prompt: payload.body.prompt,
        width: payload.body.width,
        height: payload.body.height,
        format: payload.body.format,
        provider: 'upload',
        aiMeta: payload.body.aiMeta || null
      });
      res.status(HTTP.CREATED).json(result);
    } catch (e) {
      next(e);
    }
  },

  async generate(req, res, next) {
    try {
      const payload = req.validated ?? { params: req.params, body: req.body };
      const result = await ImageService.generateAndAttach(payload.params.id, req.user.id, {
        prompt: payload.body.prompt,
        style: payload.body.style,
        sizes: payload.body.sizes,
        count: payload.body.count,
        role: payload.body.role,
        position: payload.body.position,
        altText: payload.body.altText,
        language: payload.body.language
      });
      res.status(HTTP.CREATED).json(result);
    } catch (e) {
      next(e);
    }
  },

  async remove(req, res, next) {
    try {
      const payload = req.validated ?? { params: req.params };
      const removed = await ImageService.removeLink(payload.params.id, payload.params.linkId, req.user.id);
      res.json({ removed });
    } catch (e) {
      next(e);
    }
  }
};
