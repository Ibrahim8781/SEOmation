// backend/src/services/smart-scheduler.service.js

import schedule from 'node-schedule';
import { prisma } from '../lib/prisma.js';
import logger from '../lib/logger.js';

const SUPPORTED = ['WORDPRESS', 'LINKEDIN', 'INSTAGRAM'];
const GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 minutes

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

export class SmartScheduler {
    constructor() {
        this.jobs = new Map(); // jobId -> node-schedule Job
        this.isShuttingDown = false;
    }

    /**
     * Schedule a new job
     */
    async scheduleJob(scheduleJobRecord) {
        if (this.isShuttingDown) {
            logger.warn({ jobId: scheduleJobRecord.id }, 'Cannot schedule job during shutdown');
            return;
        }

        const jobId = scheduleJobRecord.id;
        const scheduledTime = new Date(scheduleJobRecord.scheduledTime);

        // Cancel existing job if re-scheduling
        if (this.jobs.has(jobId)) {
            this.jobs.get(jobId).cancel();
            this.jobs.delete(jobId);
        }

        // Schedule with node-schedule
        const job = schedule.scheduleJob(scheduledTime, async () => {
            await this.executeJob(scheduleJobRecord);
        });

        this.jobs.set(jobId, job);

        logger.info(
            { jobId, scheduledTime, platform: scheduleJobRecord.platform },
            'Job scheduled with node-schedule'
        );
    }

    /**
     * Execute a job (publish to platform)
     */
    async executeJob(scheduleJobRecord) {
        const jobId = scheduleJobRecord.id;

        // Claim job (prevent duplicate execution)
        const claimed = await prisma.scheduleJob.updateMany({
            where: { id: jobId, status: 'SCHEDULED' },
            data: { status: 'RUNNING', attempts: { increment: 1 } }
        });

        if (claimed.count === 0) {
            logger.warn({ jobId }, 'Job already claimed or not SCHEDULED');
            this.jobs.delete(jobId);
            return;
        }

        // Fetch fresh data
        const job = await prisma.scheduleJob.findUnique({
            where: { id: jobId },
            include: { content: true, integration: true }
        });

        if (!job) {
            logger.error({ jobId }, 'Job not found in database');
            this.jobs.delete(jobId);
            return;
        }

        const attempts = job.attempts;

        try {
            logger.info({ jobId, platform: job.platform }, 'Publishing to platform');

            const result = await publishToPlatform(job);

            await prisma.scheduleJob.update({
                where: { id: jobId },
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

            logger.info({ jobId, platform: job.platform }, 'Publish success');
            this.jobs.delete(jobId);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            const fatal =
                /access token missing/i.test(msg) ||
                /401/.test(msg) ||
                /403/.test(msg) ||
                /unauthorized/i.test(msg) ||
                /forbidden/i.test(msg) ||
                /author/i.test(msg);

            const final = fatal || attempts >= 3;

            if (final) {
                // Mark as FAILED
                await prisma.scheduleJob.update({
                    where: { id: jobId },
                    data: {
                        status: 'FAILED',
                        attempts,
                        lastError: msg.slice(0, 500)
                    }
                });
                logger.error({ jobId, platform: job.platform, err: msg, fatal }, 'Publish failed (final)');
                this.jobs.delete(jobId);
            } else {
                // Retry with exponential backoff
                const retryDelayMs = Math.pow(2, attempts) * 60_000; // 2min, 4min, 8min
                const nextTime = new Date(Date.now() + retryDelayMs);

                await prisma.scheduleJob.update({
                    where: { id: jobId },
                    data: {
                        status: 'SCHEDULED',
                        attempts,
                        scheduledTime: nextTime,
                        lastError: msg.slice(0, 500)
                    }
                });

                logger.warn(
                    { jobId, platform: job.platform, attempts, retryAt: nextTime },
                    'Publish failed, retrying'
                );

                // Reschedule
                const updatedJob = await prisma.scheduleJob.findUnique({
                    where: { id: jobId },
                    include: { content: true, integration: true }
                });
                if (updatedJob) {
                    await this.scheduleJob(updatedJob);
                }
            }
        }
    }

    /**
     * Cancel a scheduled job
     */
    cancelJob(jobId) {
        const job = this.jobs.get(jobId);
        if (job) {
            job.cancel();
            this.jobs.delete(jobId);
            logger.info({ jobId }, 'Job cancelled');
        }
    }

    /**
     * Reload pending jobs from database on server start
     */
    async reloadFromDatabase() {
        const now = new Date();

        // Find all SCHEDULED jobs
        const jobs = await prisma.scheduleJob.findMany({
            where: { status: 'SCHEDULED' },
            include: { content: true, integration: true }
        });

        logger.info({ count: jobs.length }, 'Reloading scheduled jobs from database');

        for (const job of jobs) {
            const scheduledTime = new Date(job.scheduledTime);
            const missedBy = now - scheduledTime;

            if (missedBy < 0) {
                // FUTURE JOB: Schedule normally
                await this.scheduleJob(job);
            } else if (missedBy < GRACE_PERIOD_MS) {
                // MISSED BUT WITHIN GRACE PERIOD: Publish immediately
                logger.info(
                    { jobId: job.id, missedBy: `${Math.round(missedBy / 1000)}s` },
                    'Job missed but within grace period, publishing now'
                );
                await this.executeJob(job);
            } else {
                // TOO LATE: Mark as FAILED
                logger.warn(
                    { jobId: job.id, missedBy: `${Math.round(missedBy / 60000)}min` },
                    'Job missed and outside grace period, marking as FAILED'
                );
                await prisma.scheduleJob.update({
                    where: { id: job.id },
                    data: {
                        status: 'FAILED',
                        lastError: `Server was offline. Missed scheduled time by ${Math.round(missedBy / 60000)} minutes.`
                    }
                });
            }
        }

        // Reset any stuck RUNNING jobs (server crashed mid-publish)
        const running = await prisma.scheduleJob.findMany({
            where: { status: 'RUNNING' },
            include: { content: true, integration: true }
        });

        for (const job of running) {
            logger.warn({ jobId: job.id }, 'Found stuck RUNNING job, retrying');
            await prisma.scheduleJob.update({
                where: { id: job.id },
                data: { status: 'SCHEDULED', scheduledTime: now }
            });

            const updated = await prisma.scheduleJob.findUnique({
                where: { id: job.id },
                include: { content: true, integration: true }
            });
            if (updated) {
                await this.scheduleJob(updated);
            }
        }

        logger.info({ active: this.jobs.size }, 'Job reload complete');
    }

    /**
     * Graceful shutdown: wait for running jobs to finish
     */
    async shutdown() {
        this.isShuttingDown = true;
        const activeCount = this.jobs.size;

        if (activeCount === 0) {
            logger.info('No active jobs, shutting down immediately');
            return;
        }

        logger.info({ activeJobs: activeCount }, 'Graceful shutdown: waiting for jobs to finish');

        // Cancel all future jobs (they will be reloaded on restart)
        this.jobs.forEach((job, jobId) => {
            job.cancel();
            logger.info({ jobId }, 'Job cancelled during shutdown');
        });

        this.jobs.clear();

        logger.info('All jobs cancelled, shutdown complete');
    }

    /**
     * Get scheduler stats
     */
    getStats() {
        return {
            activeJobs: this.jobs.size,
            isShuttingDown: this.isShuttingDown
        };
    }
}

// Singleton instance
let schedulerInstance = null;

export function getScheduler() {
    if (!schedulerInstance) {
        schedulerInstance = new SmartScheduler();
    }
    return schedulerInstance;
}

export async function startSmartScheduler() {
    const scheduler = getScheduler();
    await scheduler.reloadFromDatabase();
    logger.info('Smart scheduler started');
    return scheduler;
}