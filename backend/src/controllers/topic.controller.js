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
            const { platform, language, context } = req.body;
            const userId = req.user.id;

            // Extract niche from context or user data
            const niche = context?.niche || req.user.niche;

            // Prepare persona from context
            const persona = {
                role: context?.audience || 'content creator',
                pains: context?.pains || []
            };

            // Call FastAPI to generate topics
            const topics = await FastAPIService.generateTopics(
                userId,
                language,
                niche,
                persona,
                context
            );

            // Save generated topics to database (temporarily stored for user selection)
            const saved = await TopicService.createManyFromAi(
                userId,
                platform,
                language,
                topics
            );

            // Return topics to frontend for user to select
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