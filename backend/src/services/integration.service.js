import crypto from 'crypto';
import ApiError from '../utils/ApiError.js';
import { prisma } from '../lib/prisma.js';
import { config } from '../config/index.js';

const PLATFORMS = ['WORDPRESS', 'LINKEDIN', 'INSTAGRAM'];

function normalizePlatform(value) {
  const p = String(value || '').toUpperCase();
  if (!PLATFORMS.includes(p)) throw new ApiError(400, 'Unsupported platform');
  return p;
}

function buildState(userId, platform) {
  return `${userId}:${platform}:${crypto.randomBytes(6).toString('hex')}`;
}

function parseState(state, expectedPlatform) {
  const [userId, platform, nonce] = String(state || '').split(':');
  if (!userId || !platform || !nonce) throw new ApiError(400, 'Invalid state');
  const normalized = normalizePlatform(platform);
  if (expectedPlatform && normalizePlatform(expectedPlatform) !== normalized) {
    throw new ApiError(400, 'State/platform mismatch');
  }
  return { userId, platform: normalized };
}

function getIntegrationConfig(platform) {
  const key = platform.toLowerCase();
  return config.integrations?.[key] || {};
}

async function exchangeWordpressToken(code, conf, redirect) {
  if (!conf.clientId || !conf.clientSecret) {
    throw new ApiError(400, 'WordPress client credentials missing');
  }
  const params = new URLSearchParams({
    client_id: conf.clientId,
    client_secret: conf.clientSecret,
    redirect_uri: redirect,
    grant_type: 'authorization_code',
    code
  });

  const resp = await fetch('https://public-api.wordpress.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new ApiError(400, `WordPress token exchange failed: ${resp.status} ${text}`);
  }
  const data = await resp.json();
  const accessToken = data.access_token;
  if (!accessToken) throw new ApiError(400, 'WordPress access token missing in response');
  const expiresAt =
    data.expires_in && Number.isFinite(data.expires_in)
      ? new Date(Date.now() + Number(data.expires_in) * 1000)
      : null;
  return { accessToken, expiresAt };
}

async function fetchWpTokenInfo(accessToken, clientId) {
  try {
    const resp = await fetch(
      `https://public-api.wordpress.com/oauth2/token-info?client_id=${encodeURIComponent(clientId || '')}&token=${encodeURIComponent(accessToken)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!resp.ok) return null;
    return resp.json();
  } catch (_e) {
    return null;
  }
}

async function fetchWpSiteInfo(siteId, accessToken) {
  try {
    const resp = await fetch(`https://public-api.wordpress.com/rest/v1.1/sites/${siteId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!resp.ok) return null;
    return resp.json();
  } catch (_e) {
    return null;
  }
}

async function fetchWpSites(accessToken) {
  try {
    const resp = await fetch('https://public-api.wordpress.com/rest/v1.1/me/sites', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data?.sites || [];
  } catch (_e) {
    return [];
  }
}

async function exchangeLinkedInToken(code, conf, redirect) {
  if (!conf.clientId || !conf.clientSecret) {
    throw new ApiError(400, 'LinkedIn client credentials missing');
  }
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirect,
    client_id: conf.clientId,
    client_secret: conf.clientSecret
  });

  const resp = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new ApiError(400, `LinkedIn token exchange failed: ${resp.status} ${text}`);
  }
  const data = await resp.json();
  const accessToken = data.access_token;
  if (!accessToken) throw new ApiError(400, 'LinkedIn access token missing in response');
  const expiresAt =
    data.expires_in && Number.isFinite(data.expires_in)
      ? new Date(Date.now() + Number(data.expires_in) * 1000)
      : null;
  return { accessToken, expiresAt };
}

async function fetchLinkedInProfile(accessToken) {
  try {
    // Primary: member id
    const resp = await fetch('https://api.linkedin.com/v2/me?projection=(id)', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });
    let data = {};
    if (resp.ok) data = await resp.json();

    // Fallback: OpenID userinfo
    let oidc = {};
    try {
      const respOidc = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (respOidc.ok) oidc = await respOidc.json();
    } catch (_ee) {
      /* ignore */
    }

    const id = data?.id || oidc?.sub || null;
    const urn = id ? `urn:li:person:${id}` : null;
    return { urn, raw: { ...data, oidc } };
  } catch (_e) {
    return {};
  }
}

export const IntegrationService = {
  async list(userId) {
    return prisma.platformIntegration.findMany({ where: { userId } });
  },

  async delete(userId, platform) {
    const normalized = normalizePlatform(platform);
    await prisma.platformIntegration.deleteMany({
      where: { userId, platform: normalized }
    });
  },

  async setWordPressSite(userId, siteUrl) {
    const integration = await prisma.platformIntegration.findFirst({
      where: { userId, platform: 'WORDPRESS' }
    });
    if (!integration) throw new ApiError(404, 'WordPress integration not found');
    return prisma.platformIntegration.update({
      where: { id: integration.id },
      data: {
        metadata: {
          ...(integration.metadata || {}),
          siteUrl
        }
      }
    });
  },

  buildAuthUrl(userId, platform) {
    const normalized = normalizePlatform(platform);
    const state = buildState(userId, normalized);
    const conf = getIntegrationConfig(normalized);
    const baseAuth =
      conf.authUrl ||
      (normalized === 'LINKEDIN'
        ? 'https://www.linkedin.com/oauth/v2/authorization'
        : `https://auth.example.com/${normalized.toLowerCase()}`);
    const redirect =
      conf.redirectUri ||
      `${config.integrations?.callbackBase || ''}/api/integrations/${normalized.toLowerCase()}/callback`;

    const params = new URLSearchParams({
      client_id: conf.clientId || 'demo',
      response_type: 'code',
      redirect_uri: redirect,
      scope: conf.scope || '',
      state
    });
    return `${baseAuth}?${params.toString()}`;
  },

  parseState,

  async handleCallback(userId, platform, payload) {
    const normalized = normalizePlatform(platform);
    if (payload.error) {
      throw new ApiError(400, `OAuth error: ${payload.error}`);
    }
    const code = payload.code || payload.token;
    if (!code) throw new ApiError(400, 'Missing code');
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ApiError(401, 'User not found');

    const conf = getIntegrationConfig(normalized);
    const redirect =
      conf.redirectUri ||
      `${config.integrations?.callbackBase || ''}/api/integrations/${normalized.toLowerCase()}/callback`;

    let accessToken = code;
    let expiresAt =
      payload.expiresAt || (payload.expires_in ? new Date(Date.now() + Number(payload.expires_in) * 1000) : null);
    let metadata = payload.metadata || null;

    if (normalized === 'LINKEDIN' && payload.code) {
      const exchanged = await exchangeLinkedInToken(payload.code, conf, redirect);
      accessToken = exchanged.accessToken;
      expiresAt = exchanged.expiresAt;
      const profile = await fetchLinkedInProfile(accessToken);
      if (profile.urn) {
        metadata = { ...(metadata || {}), urn: profile.urn, profile: profile.raw };
      } else if (profile.raw) {
        const fallbackId = profile.raw?.id || profile.raw?.oidc?.sub || null;
        if (fallbackId) {
          metadata = {
            ...(metadata || {}),
            urn: `urn:li:person:${fallbackId}`,
            profile: profile.raw
          };
        } else {
          metadata = { ...(metadata || {}), profile: profile.raw || null };
        }
      }
    }

    if (normalized === 'WORDPRESS') {
      // Exchange code for access token when using WordPress.com OAuth
      if (payload.code && (conf.authUrl || '').includes('wordpress.com')) {
        const exchanged = await exchangeWordpressToken(payload.code, conf, redirect);
        accessToken = exchanged.accessToken;
        expiresAt = exchanged.expiresAt;
      }

      const siteUrlFromPayload = payload.siteUrl || payload.metadata?.siteUrl || conf.siteUrl || null;
      let siteUrl = siteUrlFromPayload || null;
      let siteId = payload.metadata?.siteId || null;
      let siteName = payload.metadata?.siteName || null;
      let availableSites = [];

      if (accessToken && (!siteUrl || !siteId) && (conf.authUrl || '').includes('wordpress.com')) {
        const info = await fetchWpTokenInfo(accessToken, conf.clientId);
        const blogId = info?.blog_id;
        if (blogId) {
          siteId = String(blogId);
          const siteInfo = await fetchWpSiteInfo(blogId, accessToken);
          if (siteInfo) {
            siteUrl = siteInfo.URL || siteUrl;
            siteName = siteInfo.name || siteName;
          }
        }
        if (!siteUrl || !siteId) {
          availableSites = await fetchWpSites(accessToken);
          if (availableSites.length === 1) {
            siteUrl = availableSites[0]?.URL || siteUrl;
            siteId = String(availableSites[0]?.ID || '') || siteId;
            siteName = availableSites[0]?.name || siteName;
          }
        }
      }

      metadata = {
        ...(metadata || {}),
        siteUrl: siteUrl || null,
        siteId: siteId || null,
        siteName: siteName || null
      };

      if (availableSites.length > 1) {
        metadata.availableSites = availableSites.map((s) => ({
          id: s.ID,
          name: s.name,
          url: s.URL
        }));
      }
    }

    return prisma.platformIntegration.upsert({
      where: { userId_platform: { userId, platform: normalized } },
      update: {
        accessToken,
        refreshToken: payload.refreshToken || null,
        expiresAt,
        metadata
      },
      create: {
        userId,
        platform: normalized,
        accessToken,
        refreshToken: payload.refreshToken || null,
        expiresAt,
        metadata
      }
    });
  }
};
