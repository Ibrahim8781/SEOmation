import { IntegrationService } from '../services/integration.service.js';
import { HTTP } from '../utils/httpStatus.js';
import logger from '../lib/logger.js';

const CALLBACK_MESSAGE_TYPE = 'seomation:integration-callback';

function formatPlatformLabel(platform) {
  const normalized = String(platform || '').toUpperCase();
  if (normalized === 'WORDPRESS') return 'WordPress';
  if (normalized === 'LINKEDIN') return 'LinkedIn';
  if (normalized === 'INSTAGRAM') return 'Instagram';
  return normalized || 'Integration';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildAppReturnUrl(clientOrigin, status, platform, message) {
  if (!clientOrigin) return null;

  try {
    const url = new URL('/settings/integrations', clientOrigin);
    url.searchParams.set('integration_status', status);
    url.searchParams.set('platform', String(platform || '').toUpperCase());
    url.searchParams.set('message', message);
    return url.toString();
  } catch (_error) {
    return null;
  }
}

function renderCallbackPage({ success, platform, message, clientOrigin }) {
  const safeMessage = message || (success ? 'Connection completed.' : 'Connection failed.');
  const returnUrl = buildAppReturnUrl(clientOrigin, success ? 'success' : 'error', platform, safeMessage);
  const headline = success
    ? `${formatPlatformLabel(platform)} connected`
    : `${formatPlatformLabel(platform)} connection failed`;
  const helperText = returnUrl
    ? 'Your workspace will resume automatically in a moment.'
    : 'Return to SEOmation to continue managing this integration.';
  const accentRgb = success ? '31, 122, 69' : '180, 35, 24';
  const scriptPayload = {
    type: CALLBACK_MESSAGE_TYPE,
    ok: success,
    platform: String(platform || '').toUpperCase(),
    message: safeMessage
  };

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    ${returnUrl ? `<meta http-equiv="refresh" content="3;url=${escapeHtml(returnUrl)}" />` : ''}
    <title>${escapeHtml(headline)}</title>
    <style>
      :root {
        color-scheme: light;
        --ink: #182033;
        --muted: #5f697f;
        --line: rgba(24, 32, 51, 0.08);
        --card: rgba(255, 255, 255, 0.94);
        --bg:
          radial-gradient(circle at top left, rgba(${accentRgb}, 0.10), transparent 30%),
          radial-gradient(circle at bottom right, rgba(24, 32, 51, 0.08), transparent 34%),
          linear-gradient(180deg, #f6f8fc 0%, #eef3fb 100%);
        --accent: ${success ? '#1f7a45' : '#b42318'};
        --accent-soft: ${success ? 'rgba(31, 122, 69, 0.10)' : 'rgba(180, 35, 24, 0.10)'};
        --accent-line: ${success ? 'rgba(31, 122, 69, 0.20)' : 'rgba(180, 35, 24, 0.18)'};
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        font-family: Inter, "Segoe UI", system-ui, sans-serif;
        background: var(--bg);
        color: var(--ink);
      }
      .card {
        width: min(100%, 520px);
        padding: 30px;
        border-radius: 28px;
        background: var(--card);
        border: 1px solid var(--line);
        box-shadow: 0 24px 70px rgba(24, 32, 51, 0.12);
        backdrop-filter: blur(18px);
        position: relative;
        overflow: hidden;
      }
      .card::before {
        content: "";
        position: absolute;
        inset: 0 0 auto;
        height: 5px;
        background: linear-gradient(90deg, var(--accent), rgba(${accentRgb}, 0.45));
      }
      .brand {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 22px;
        color: var(--muted);
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .brand-mark {
        width: 34px;
        height: 34px;
        display: grid;
        place-items: center;
        border-radius: 12px;
        background: linear-gradient(135deg, rgba(${accentRgb}, 0.18), rgba(24, 32, 51, 0.08));
        color: var(--accent);
        font-size: 18px;
      }
      .eyebrow {
        display: inline-flex;
        margin-bottom: 16px;
        padding: 7px 12px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      h1 {
        margin: 0 0 10px;
        font-size: 30px;
        line-height: 1.05;
        letter-spacing: -0.03em;
      }
      p {
        margin: 0;
        color: var(--muted);
        line-height: 1.65;
      }
      .message {
        font-size: 16px;
      }
      .status-panel {
        margin-top: 22px;
        padding: 16px 18px;
        border-radius: 18px;
        border: 1px solid var(--accent-line);
        background: linear-gradient(180deg, rgba(255,255,255,0.7), rgba(${accentRgb}, 0.05));
      }
      .status-label {
        margin-bottom: 6px;
        color: var(--ink);
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.03em;
        text-transform: uppercase;
      }
      .actions {
        margin-top: 24px;
      }
      a {
        appearance: none;
        border: 0;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 48px;
        padding: 12px 20px;
        font: inherit;
        font-weight: 700;
        text-decoration: none;
      }
      .primary {
        width: 100%;
        background: linear-gradient(135deg, var(--ink), #243252);
        color: #fff;
        box-shadow: 0 14px 28px rgba(24, 32, 51, 0.18);
      }
      .microcopy {
        margin-top: 12px;
        font-size: 13px;
      }
      .progress {
        margin-top: 16px;
        height: 6px;
        border-radius: 999px;
        overflow: hidden;
        background: rgba(24, 32, 51, 0.08);
      }
      .progress > span {
        display: block;
        height: 100%;
        width: 38%;
        border-radius: inherit;
        background: linear-gradient(90deg, var(--accent), rgba(${accentRgb}, 0.45));
        animation: progress 1.6s ease-in-out infinite;
      }
      @keyframes progress {
        0% { transform: translateX(-100%); width: 35%; }
        55% { transform: translateX(115%); width: 60%; }
        100% { transform: translateX(240%); width: 35%; }
      }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="brand">
        <span class="brand-mark">${success ? '✓' : '!'}</span>
        <span>SEOmation</span>
      </div>
      <span class="eyebrow">${success ? 'Connected' : 'Connection error'}</span>
      <h1>${escapeHtml(headline)}</h1>
      <p class="message">${escapeHtml(safeMessage)}</p>
      <div class="status-panel">
        <div class="status-label">${success ? 'What happens next' : 'Next step'}</div>
        <p>${escapeHtml(helperText)}</p>
        ${returnUrl ? '<div class="progress"><span></span></div>' : ''}
      </div>
      <div class="actions">
        ${returnUrl ? `<a class="primary" href="${escapeHtml(returnUrl)}">Continue to SEOmation</a>` : ''}
      </div>
      <p class="microcopy">${escapeHtml(returnUrl ? 'This window usually closes or redirects automatically.' : 'If this page stays open, switch back to your SEOmation workspace.')}</p>
    </main>
    <script>
      const payload = ${JSON.stringify(scriptPayload)};
      const targetOrigin = ${JSON.stringify(clientOrigin || '*')};
      const returnUrl = ${JSON.stringify(returnUrl)};

      const finish = () => {
        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage(payload, targetOrigin);
            if (returnUrl) {
              try {
                window.opener.location.replace(returnUrl);
              } catch (_navError) {
                // Ignore opener navigation failures and fall back to local redirect.
              }
            }
            try {
              window.opener.focus();
            } catch (_focusError) {
              // Ignore focus failures.
            }
            if (returnUrl) {
              window.close();
              return;
            }
          }
        } catch (_error) {
          // Ignore cross-window errors and fall back to redirect.
        }

        if (returnUrl) {
          window.location.replace(returnUrl);
          return;
        }

        try {
          if (window.opener && !window.opener.closed) {
            window.close();
          }
        } catch (_closeError) {
          // Ignore close failures.
        }
      };

      window.setTimeout(finish, 3000);
    </script>
  </body>
</html>`;
}

function applyCallbackPageHeaders(res) {
  res.set('Cache-Control', 'no-store');
  res.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
  );
}

function shouldReturnJson(req) {
  return String(req.query?.format || '').toLowerCase() === 'json';
}

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
      const url = IntegrationService.buildAuthUrl(req.user.id, platform, req.headers.origin || req.headers.referer);
      res.json({ url });
    } catch (e) {
      next(e);
    }
  },

  async callback(req, res, next) {
    const payload = req.validated ?? { params: req.params, query: req.query, body: req.body };
    let clientOrigin = null;

    try {
      const { userId, platform, clientOrigin: parsedOrigin } = IntegrationService.parseState(
        payload.query.state || payload.body?.state,
        payload.params.platform
      );
      clientOrigin = parsedOrigin;
      const integration = await IntegrationService.handleCallback(
        userId,
        platform,
        { ...payload.query, ...payload.body }
      );

      logger.info(
        {
          userId,
          platform,
          integrationId: integration.id,
          details: IntegrationService.summarizeIntegration(integration)
        },
        'Platform integration connected'
      );

      applyCallbackPageHeaders(res);

      if (shouldReturnJson(req)) {
        res.json({ integration });
        return;
      }

      res.status(HTTP.OK).type('html').send(
        renderCallbackPage({
          success: true,
          platform,
          message: `${formatPlatformLabel(platform)} connected successfully.`,
          clientOrigin
        })
      );
    } catch (e) {
      logger.warn(
        {
          platform: payload.params.platform,
          message: e.message,
          clientOrigin
        },
        'Platform integration callback failed'
      );

      if (!clientOrigin) {
        try {
          clientOrigin = IntegrationService.parseState(
            payload.query.state || payload.body?.state,
            payload.params.platform
          ).clientOrigin;
        } catch (_error) {
          clientOrigin = null;
        }
      }

      if (!shouldReturnJson(req)) {
        applyCallbackPageHeaders(res);
        res
          .status(e.statusCode || HTTP.BAD_REQUEST)
          .type('html')
          .send(
            renderCallbackPage({
              success: false,
              platform: payload.params.platform,
              message: e.message || 'Unable to complete the platform connection.',
              clientOrigin
            })
          );
        return;
      }

      next(e);
    }
  },

  async remove(req, res, next) {
    try {
      const { platform } = req.params;
      await IntegrationService.delete(req.user.id, platform);
      logger.info({ userId: req.user.id, platform }, 'Platform integration disconnected');
      res.status(HTTP.NO_CONTENT).send();
    } catch (e) {
      next(e);
    }
  },

  async setWpSite(req, res, next) {
    try {
      const payload = req.validated ?? { body: req.body };
      const integration = await IntegrationService.setWordPressSite(req.user.id, payload.body.siteUrl);
      logger.info(
        { userId: req.user.id, platform: 'WORDPRESS', siteUrl: payload.body.siteUrl },
        'WordPress site updated'
      );
      res.json({ integration: IntegrationService.sanitizeIntegration(integration) });
    } catch (e) {
      next(e);
    }
  }
};
