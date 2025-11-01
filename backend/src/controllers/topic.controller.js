import FastAPIService from '../services/fastapi.service.js';
import { TopicService } from '../services/topic.service.js';

export const TopicController = {
    /**
     * POST /api/topics/generate
     * Generates topic ideas from FastAPI AI service
     * 
     * Request body:
     * {
     *   platform: "BLOG",
     *   language: "EN",
     *   context: {
     *     company: "SEOmation",
     *     niche: "SaaS SEO",
     *     audience: "founders",
     *     tone: "helpful",
     *     seedKeywords: [],
     *     region: "US",
     *     season: "Q4"
     *   }
     * }
     */
    async generate(req, res, next) {
        try {
            const payload = req.validated?.body ?? req.body ?? {};
            const userId = req.user.id;

            const profile = req.user.preferences?.onboarding?.businessProfile ?? null;

            const requestedPlatform = payload.platform || profile?.primaryPlatforms?.[0] || 'BLOG';
            const platform = requestedPlatform?.toUpperCase?.() || 'BLOG';

            const requestedLanguage = payload.language || profile?.language || req.user.language || 'EN';
            const language = String(requestedLanguage).toUpperCase();

            const baseContext = payload.context ?? {};

            const resolvedSeedKeywords = Array.isArray(baseContext.seedKeywords)
                ? baseContext.seedKeywords
                : typeof baseContext.seedKeywords === 'string'
                    ? baseContext.seedKeywords
                        .split(',')
                        .map((item) => item.trim())
                        .filter(Boolean)
                    : profile?.seedKeywords ?? [];

            const resolvedPainsRaw = baseContext.pains ?? baseContext.painPoints ?? profile?.audiencePainPoints ?? [];
            const resolvedPains = Array.isArray(resolvedPainsRaw)
                ? resolvedPainsRaw
                : String(resolvedPainsRaw || '')
                    .split(',')
                    .map((item) => item.trim())
                    .filter(Boolean);

            const includeTrendsValue = baseContext.includeTrends ?? profile?.includeTrends ?? true;
            const includeTrends =
                typeof includeTrendsValue === 'string'
                    ? includeTrendsValue.toLowerCase() !== 'false'
                    : Boolean(includeTrendsValue);

            const countValue = baseContext.count ?? 12;
            const countNumber = Number.parseInt(countValue, 10);
            const resolvedCount = Number.isFinite(countNumber)
                ? Math.min(40, Math.max(5, countNumber))
                : 12;

            const resolvedContext = {
                ...baseContext,
                platform,
                businessName: baseContext.businessName ?? profile?.businessName ?? req.user.company,
                niche: baseContext.niche ?? profile?.niche ?? req.user.niche,
                audience: baseContext.audience ?? profile?.targetAudience ?? 'content creator',
                tone: baseContext.tone ?? profile?.toneOfVoice ?? req.user.tone ?? 'friendly',
                seedKeywords: resolvedSeedKeywords,
                pains: resolvedPains,
                region: baseContext.region ?? profile?.primaryRegion ?? null,
                season: baseContext.season ?? profile?.seasonalFocus ?? null,
                includeTrends,
                count: resolvedCount
            };

            const niche = resolvedContext.niche || req.user.niche;

            const persona = {
                role: resolvedContext.audience || 'content creator',
                pains: resolvedContext.pains || []
            };

            const topics = await FastAPIService.generateTopics(
                userId,
                language,
                niche,
                persona,
                resolvedContext
            );

            const saved = await TopicService.createManyFromAi(
                userId,
                platform,
                language,
                topics
            );

            res.status(201).json({
                items: saved,
                meta: {
                    status: 'SUGGESTED',
                    action: 'Select topics to generate content'
                }
            });
        } catch (e) {
            next(e);
        }
    },

    /**
     * GET /api/topics
     * List all topics for the authenticated user
     */
    async list(req, res, next) {
        try {
            const items = await TopicService.listByUser(req.user.id);
            res.json({ items });
        } catch (e) {
            next(e);
        }
    }
};
