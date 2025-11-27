import { prisma } from '../lib/prisma.js';
import logger from '../lib/logger.js';
import { config } from '../config/index.js';

const SUPPORTED = ['WORDPRESS', 'LINKEDIN', 'INSTAGRAM'];

function stripTags(html = '') {
  return String(html || '').replace(/<[^>]+>/g, ' ');
}

async function fetchFirstImage(contentId) {
  const link = await prisma.contentImageLink.findFirst({
    where: { contentId },
    include: { image: true },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
  });
  return link?.image?.url || null;
}

async function fetchImageUrl(contentId, imageId) {
  if (!imageId) return null;
  const link = await prisma.contentImageLink.findFirst({
    where: {
      contentId,
      OR: [{ id: imageId }, { imageId }]
    },
    include: { image: true }
  });
  return link?.image?.url || null;
}

async function fetchImageBuffer(url) {
  if (!url) return null;
  try {
    if (url.startsWith('data:')) {
      const [, base] = url.split(',');
      return Buffer.from(base, 'base64');
    }
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const arr = await resp.arrayBuffer();
    return Buffer.from(arr);
  } catch (_e) {
    return null;
  }
}

async function hydrateWordpressIntegration(integration) {
  if (!integration.accessToken) return integration;
  const confSiteId = integration.metadata?.siteId || null;
  const confSiteUrl = integration.metadata?.siteUrl || null;
  if (confSiteId && confSiteUrl) return integration;

  try {
    const infoResp = await fetch(
      `https://public-api.wordpress.com/oauth2/token-info?token=${encodeURIComponent(integration.accessToken)}`,
      { headers: { Authorization: `Bearer ${integration.accessToken}` } }
    );
    let blogId = null;
    if (infoResp.ok) {
      const info = await infoResp.json();
      blogId = info?.blog_id || null;
    }
    let siteUrl = confSiteUrl;
    let siteName = integration.metadata?.siteName || null;
    if (blogId) {
      const siteResp = await fetch(`https://public-api.wordpress.com/rest/v1.1/sites/${blogId}`, {
        headers: { Authorization: `Bearer ${integration.accessToken}` }
      });
      if (siteResp.ok) {
        const siteInfo = await siteResp.json();
        siteUrl = siteInfo.URL || siteUrl;
        siteName = siteInfo.name || siteName;
      }
    }
    const merged = {
      ...integration,
      metadata: {
        ...(integration.metadata || {}),
        siteId: blogId || confSiteId || null,
        siteUrl: siteUrl || null,
        siteName: siteName || null
      }
    };
    // Persist
    await prisma.platformIntegration.update({
      where: { id: integration.id },
      data: { metadata: merged.metadata }
    });
    return merged;
  } catch (_e) {
    return integration;
  }
}

async function publishWordPress(content, integration, media) {
  const integ = await hydrateWordpressIntegration(integration);
  const siteId = integ.metadata?.siteId || null;
  const siteUrl = integ.metadata?.siteUrl || null;
  if (!siteId && !siteUrl) {
    throw new Error('WordPress site URL/ID missing; reconnect integration with site selection.');
  }

  const isWpCom = Boolean(siteId);
  const endpoint = isWpCom
    ? `https://public-api.wordpress.com/wp/v2/sites/${siteId}/posts`
    : `${siteUrl.replace(/\/$/, '')}/wp-json/wp/v2/posts`;
  let htmlBody = content.html || content.text || '';
  if (media?.wordpressFeatured) {
    const imgUrl = await fetchImageUrl(content.id, media.wordpressFeatured);
    if (imgUrl) {
      htmlBody = `<img src="${imgUrl}" alt="${content.title || ''}" />\n${htmlBody}`;
    }
  }

  const body = {
    title: content.title,
    content: htmlBody,
    status: 'publish'
  };

  if (!integration.accessToken || integration.metadata?.mock === true) {
    return {
      externalId: `mock-wp-${Date.now()}`,
      response: { mock: true, endpoint, body },
      publishedAt: new Date()
    };
  }

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${integ.accessToken}`
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`WordPress publish failed (${resp.status}): ${text.slice(0, 200)}`);
  }
  const data = await resp.json();
  return {
    externalId: data.id ? String(data.id) : null,
    response: data,
    publishedAt: data.date ? new Date(data.date) : new Date()
  };
}

async function publishLinkedIn(content, integration, media) {
  const socialText = content.aiMeta?.social?.linkedin?.text;
  const text = socialText || content.text || stripTags(content.html || '');
  if (!integration.accessToken) {
    throw new Error('LinkedIn access token missing; connect LinkedIn integration.');
  }
  const meta = integration.metadata || {};
  let authorUrn =
    meta.urn ||
    (meta.profile?.id ? `urn:li:person:${meta.profile.id}` : null) ||
    (meta.profile?.oidc?.sub ? `urn:li:person:${meta.profile.oidc.sub}` : null);
  if (authorUrn && authorUrn.startsWith('urn:li:member:')) {
    authorUrn = authorUrn.replace('urn:li:member:', 'urn:li:person:');
  }
  if (!authorUrn) {
    throw new Error('LinkedIn author URN missing; reconnect integration to refresh profile data.');
  }
  if (integration.metadata?.mock === true) {
    return {
      externalId: `mock-li-${Date.now()}`,
      response: { mock: true, body: text.slice(0, 280) },
      publishedAt: new Date()
    };
  }

  const payload = {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
  };

  let assetUrn = null;
  const mediaUrl = await fetchImageUrl(content.id, media?.linkedin);
  if (mediaUrl) {
    const buffer = await fetchImageBuffer(mediaUrl);
    if (buffer) {
      // Register upload
      const registerResp = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${integration.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          registerUploadRequest: {
            recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
            owner: authorUrn,
            serviceRelationships: [
              { relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' }
            ]
          }
        })
      });

      if (registerResp.ok) {
        const reg = await registerResp.json();
        assetUrn = reg.value?.asset || null;
        const uploadUrl = reg.value?.uploadMechanism?.[
          'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
        ]?.uploadUrl;
        if (assetUrn && uploadUrl) {
          const uploadResp = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'image/jpeg' },
            body: buffer
          });
          if (!uploadResp.ok) {
            assetUrn = null;
          }
        }
      }
    }
  }

  if (assetUrn) {
    payload.specificContent = {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: 'IMAGE',
        media: [
          {
            status: 'READY',
            media: assetUrn,
            description: { text: text.slice(0, 200) || 'Image' }
          }
        ]
      }
    };
  } else {
    payload.specificContent = {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: 'NONE'
      }
    };
  }

  payload.visibility = { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' };

  const resp = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${integration.accessToken}`
    },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`LinkedIn publish failed (${resp.status}): ${txt.slice(0, 200)}`);
  }
  const data = await resp.json();
  return {
    externalId: data.id || null,
    response: data,
    publishedAt: new Date()
  };
}

async function publishInstagram(content, integration, media) {
  let imageUrl = await fetchImageUrl(content.id, media?.instagram);
  if (!imageUrl) imageUrl = await fetchFirstImage(content.id);
  if (!imageUrl) {
    throw new Error('Instagram requires at least one image attached to the content.');
  }
  if (!integration.accessToken || integration.metadata?.mock === true) {
    return {
      externalId: `mock-ig-${Date.now()}`,
      response: { mock: true, imageUrl, caption: content.text || stripTags(content.html || '') },
      publishedAt: new Date()
    };
  }

  const igUserId = integration.metadata?.instagramBusinessId;
  if (!igUserId) {
    throw new Error('instagramBusinessId missing for Instagram publish.');
  }

  const socialText = content.aiMeta?.social?.instagram?.text;
  const caption = socialText || content.text || stripTags(content.html || '');
  const createUrl = `https://graph.facebook.com/v21.0/${igUserId}/media`;
  const publishUrl = `https://graph.facebook.com/v21.0/${igUserId}/media_publish`;

  const createResp = await fetch(createUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caption, image_url: imageUrl, access_token: integration.accessToken })
  });
  if (!createResp.ok) {
    const txt = await createResp.text();
    throw new Error(`Instagram create failed (${createResp.status}): ${txt.slice(0, 200)}`);
  }
  const created = await createResp.json();

  const publishResp = await fetch(publishUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: created.id, access_token: integration.accessToken })
  });
  if (!publishResp.ok) {
    const txt = await publishResp.text();
    throw new Error(`Instagram publish failed (${publishResp.status}): ${txt.slice(0, 200)}`);
  }
  const published = await publishResp.json();

  return {
    externalId: published.id || created.id || null,
    response: { create: created, publish: published },
    publishedAt: new Date()
  };
}

async function publishToPlatform(job) {
  const { platform, content, integration } = job;
  if (!SUPPORTED.includes(platform)) {
    throw new Error(`Unsupported platform ${platform}`);
  }

  if (platform === 'WORDPRESS') return publishWordPress(content, integration, job.media);
  if (platform === 'LINKEDIN') return publishLinkedIn(content, integration, job.media);
  return publishInstagram(content, integration, job.media);
}

export class PublisherWorker {
  constructor(intervalMs = 60000) {
    this.intervalMs = intervalMs;
    this.timer = null;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), this.intervalMs);
    // Kick off immediately
    this.tick();
    logger.info({ interval: this.intervalMs }, 'Publisher worker started');
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick() {
    try {
      const now = new Date();
      const due = await prisma.scheduleJob.findMany({
        where: { status: 'SCHEDULED', scheduledTime: { lte: now } },
        orderBy: { scheduledTime: 'asc' },
        take: 5,
        include: { content: true, integration: true }
      });
      for (const job of due) {
        // eslint-disable-next-line no-await-in-loop
        await this.processJob(job);
      }
    } catch (err) {
      logger.error({ err }, 'Publisher worker tick failed');
    }
  }

  async processJob(job) {
    const claimed = await prisma.scheduleJob.updateMany({
      where: { id: job.id, status: 'SCHEDULED' },
      data: { status: 'RUNNING', attempts: { increment: 1 } }
    });
    if (claimed.count === 0) return;

    const attempts = job.attempts + 1;

    try {
      const result = await publishToPlatform(job);
      await prisma.scheduleJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          lastError: null,
          result: {
            upsert: {
              create: {
                externalId: result.externalId || null,
                publishedAt: result.publishedAt || new Date(),
                response: result.response || null
              },
              update: {
                externalId: result.externalId || null,
                publishedAt: result.publishedAt || new Date(),
                response: result.response || null
              }
            }
          }
        }
      });
      logger.info({ jobId: job.id, platform: job.platform }, 'Publish success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const fatal =
        /access token missing/i.test(msg) ||
        /401/.test(msg) ||
        /403/.test(msg) ||
        /unauthorized/i.test(msg) ||
        /forbidden/i.test(msg) ||
        /author/i.test(msg);
      const nextTime = new Date(Date.now() + Math.pow(2, attempts) * 60_000);
      const final = fatal || attempts >= 3;
      await prisma.scheduleJob.update({
        where: { id: job.id },
        data: {
          status: final ? 'FAILED' : 'SCHEDULED',
          attempts,
          scheduledTime: final ? job.scheduledTime : nextTime,
          lastError: msg.slice(0, 500)
        }
      });
      logger.error(
        { jobId: job.id, platform: job.platform, err: msg, fatal },
        'Publish failed'
      );
    }
  }
}

let workerInstance = null;

export function startPublisherWorker() {
  if (workerInstance) return workerInstance;
  const intervalMs = Number(config.publisher?.intervalMs || 60000);
  workerInstance = new PublisherWorker(intervalMs);
  workerInstance.start();
  return workerInstance;
}
