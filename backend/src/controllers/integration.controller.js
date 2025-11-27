import { IntegrationService } from '../services/integration.service.js';
import { HTTP } from '../utils/httpStatus.js';

export const IntegrationController = {
  async list(req, res, next) {
    try {
      const items = await IntegrationService.list(req.user.id);
      res.json({ items });
    } catch (e) {
      next(e);
    }
  },

  async authUrl(req, res, next) {
    try {
      const { platform } = req.params;
      const url = IntegrationService.buildAuthUrl(req.user.id, platform);
      res.json({ url });
    } catch (e) {
      next(e);
    }
  },

  async callback(req, res, next) {
    try {
      const payload = req.validated ?? { params: req.params, query: req.query, body: req.body };
      const { userId, platform } = IntegrationService.parseState(
        payload.query.state || payload.body?.state,
        payload.params.platform
      );
      const integration = await IntegrationService.handleCallback(
        userId,
        platform,
        { ...payload.query, ...payload.body }
      );
      res.json({ integration });
    } catch (e) {
      next(e);
    }
  },

  async remove(req, res, next) {
    try {
      const { platform } = req.params;
      await IntegrationService.delete(req.user.id, platform);
      res.status(HTTP.NO_CONTENT).send();
    } catch (e) {
      next(e);
    }
  },

  async setWpSite(req, res, next) {
    try {
      const payload = req.validated ?? { body: req.body };
      const integration = await IntegrationService.setWordPressSite(req.user.id, payload.body.siteUrl);
      res.json({ integration });
    } catch (e) {
      next(e);
    }
  }
};
