import { config } from '../config/index.js';
import ApiError from '../utils/ApiError.js';

const ENDPOINT_TIMEOUTS = {
    '/topic/suggest': config.ai.timeouts.topicsMs,
    '/content/generate': config.ai.timeouts.contentMs,
    '/image/generate': config.ai.timeouts.imageMs,
    '/seo/hints': config.ai.timeouts.seoMs
};

class FastAPIService {
    constructor() {
        this.baseUrl = config.ai.url;
        this.isMock = config.ai.mock;
    }

    /**
     * Generic HTTP request handler for FastAPI calls
     */
    async request(endpoint, payload, method = 'POST', options = {}) {
        // If mock mode is enabled, return mock data
        if (this.isMock) {
            console.warn(`[AI Mock] ${method} ${endpoint}`, payload);
            return this.getMockResponse(endpoint, payload);
        }

        if (!this.baseUrl) {
            throw new ApiError(500, 'FastAPI service URL not configured');
        }

        const url = `${this.baseUrl}${endpoint}`;
        const controller = new AbortController();
        const timeoutMs = options.timeoutMs ?? ENDPOINT_TIMEOUTS[endpoint] ?? config.ai.timeouts.contentMs;
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            console.log(`[FastAPI] ${method} ${url}`);

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.text();
                console.error(`[FastAPI Error] ${response.status}:`, errorData.slice(0, 200));
                throw new ApiError(502, `FastAPI error: ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`[FastAPI Response] Success`);
            return data;
        } catch (error) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
                throw new ApiError(504, `FastAPI request timeout (${Math.round(timeoutMs / 1000)}s exceeded)`);
            }
            if (error instanceof ApiError) throw error;

            console.error(`[FastAPI Exception]`, error.message);
            throw new ApiError(502, `FastAPI connection error: ${error.message}`);
        }
    }

    /**
     * Generate topics from FastAPI
     * Called by: POST /api/topics/generate
     */
    async generateTopics(userId, language, niche, persona, context) {
        const payload = {
            userId,
            language,
            niche,
            persona: persona || { role: 'content creator', pains: [] },
            seedKeywords: context?.seedKeywords || [],
            region: context?.region || null,
            season: context?.season || null,
            contentGoals: context?.contentGoals || null,
            preferredContentTypes: context?.preferredContentTypes || [],
            count: context?.count || 12,
            includeTrends: context?.includeTrends !== false,
            namespace: context?.namespace || null
        };

        const response = await this.request('/topic/suggest', payload, 'POST', {
            timeoutMs: ENDPOINT_TIMEOUTS['/topic/suggest']
        });

        const diagnostics = response?.diagnostics || {};
        const seen = new Set();
        const items = [];
        const pushIdea = (idea, clusterLabel = null) => {
            if (!idea) return;
            const title = (idea.ideaText || idea.title || idea.text || '').trim();
            if (!title) return;
            const key = title.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);

            const targetKeyword = (idea.targetKeyword || '').trim() || null;
            const rationale = (idea.rationale || '').trim() || null;
            const trendTag = idea.trendTag || null;
            const relevance = typeof idea.relevance === 'number' ? idea.relevance : typeof idea.score === 'number' ? idea.score : 0.85;

            const aiMeta = {
                cluster: clusterLabel,
                diagnostics,
                source: clusterLabel ? 'cluster' : 'idea',
                trendTag,
                seedKeywords: payload.seedKeywords
            };

            items.push({
                title,
                targetKeyword,
                rationale,
                trendTag,
                platform: context?.platform || 'BLOG',
                language,
                relevance,
                isRelevant: true,
                aiMeta
            });
        };

        (response?.clusters || []).forEach((cluster) => {
            const label = cluster?.label || null;
            (cluster?.ideas || []).forEach((idea) => pushIdea(idea, label));
        });

        (response?.ideas || []).forEach((idea) => pushIdea(idea, null));

        return items;
    }

    /**
     * Generate content from FastAPI
     * Called by: POST /api/content/generate (both topicId and prompt flows combined)
     */
    async generateContent(
        userId,
        platform,
        language,
        topicOrIdea,
        focusKeyword,
        tone = 'friendly',
        targetLength = 1200,
        styleGuide = [],
        context = {}
    ) {
        const normalizedPlatform = String(platform || 'blog').toLowerCase();
        const normalizedLanguage = String(language || 'EN').toLowerCase();
        const payload = {
            userId,
            platform: normalizedPlatform,
            language: normalizedLanguage,
            topicOrIdea,
            tone,
            targetLength,
            focusKeyword,
            includeTrend: context?.includeTrend !== false,
            styleGuideBullets: styleGuide || [],
            niche: context?.niche || null,
            seedKeywords: context?.seedKeywords || [],
            region: context?.region || null,
            season: context?.season || null,
            persona: context?.persona || null,
            namespace: context?.namespace || null
        };

        const response = await this.request('/content/generate', payload, 'POST', {
            timeoutMs: ENDPOINT_TIMEOUTS['/content/generate']
        });

        const contentForEditor = response?.contentForEditor || {};
        const structured = contentForEditor.structured || null;
        const html = contentForEditor.html || '';
        const plainText = contentForEditor.plainText || '';
        const diagnostics = response?.diagnostics || null;
        const metrics = response?.metrics || {};
        const structuredObject =
            structured && typeof structured === 'object' && !Array.isArray(structured) ? structured : null;
        const structuredMeta =
            structuredObject?.meta && typeof structuredObject.meta === 'object' && !Array.isArray(structuredObject.meta)
                ? structuredObject.meta
                : null;
        const generatedTitle =
            (typeof structuredObject?.title === 'string' && structuredObject.title.trim()) ||
            (typeof structuredObject?.h1 === 'string' && structuredObject.h1.trim()) ||
            topicOrIdea;
        const generatedMetaDescription =
            typeof structuredMeta?.description === 'string' && structuredMeta.description.trim()
                ? structuredMeta.description.trim()
                : null;
        const generatedSlug =
            typeof structuredMeta?.slug === 'string' && structuredMeta.slug.trim()
                ? structuredMeta.slug.trim()
                : null;

        return {
            title: generatedTitle,
            html,
            text: plainText,
            structured,
            metaDescription: generatedMetaDescription,
            primaryKeyword: focusKeyword || null,
            seoMeta: {
                keywords: this.extractKeywords(plainText),
                focusKeyword,
                slug: generatedSlug
            },
            grammarScore: metrics.grammarScore ?? null,
            readabilityScore: metrics.readabilityScore ?? null,
            ragScore: metrics.ragScore ?? null,
            aiMeta: {
                diagnostics,
                contentStructure: structured,
                platform
            }
        };
    }

    /**
     * Get SEO hints/score for content
     * Called by: POST /api/content/:id/seo-hints (new endpoint you might need)
     */
    async getSeoHints(platform, language, focusKeyword, content) {
        const payload = {
            platform,
            language,
            focusKeyword,
            content
        };

        const response = await this.request('/seo/hints', payload, 'POST', {
            timeoutMs: ENDPOINT_TIMEOUTS['/seo/hints']
        });

        return {
            score: response.score || 0,
            hints: response.hints || []
        };
    }

    /**
     * Generate images + alt text from FastAPI
     */
    async generateImages(prompt, { platform = 'blog', style = null, sizes = ['1024x1024'], count = 1, language = 'en' } = {}) {
        const payload = {
            prompt,
            platform,
            style,
            sizes,
            count,
            language
        };

        return this.request('/image/generate', payload, 'POST', {
            timeoutMs: ENDPOINT_TIMEOUTS['/image/generate']
        });
    }

    /**
     * Mock responses for testing without FastAPI running
     */
    getMockResponse(endpoint, payload) {
        if (endpoint === '/topic/suggest') {
            return {
                clusters: [
                    {
                        label: payload.niche || 'Topic Cluster',
                        ideas: [
                            {
                                ideaText: `${payload.niche} guide for beginners`,
                                targetKeyword: 'beginner guide',
                                rationale: 'High search volume and user intent',
                                trendTag: 'evergreen',
                                language: payload.language
                            },
                            {
                                ideaText: `Advanced ${payload.niche} strategies`,
                                targetKeyword: 'advanced strategies',
                                rationale: 'Growing interest among professionals',
                                trendTag: 'trending',
                                language: payload.language
                            },
                            {
                                ideaText: `${payload.niche} trends in 2025`,
                                targetKeyword: 'latest trends',
                                rationale: 'Seasonal trending topic',
                                trendTag: 'trending-Q4',
                                language: payload.language
                            }
                        ]
                    }
                ],
                ideas: [],
                diagnostics: {
                    usedRAG: false,
                    clustersCount: 1,
                    namespace: 'mock'
                }
            };
        }

        if (endpoint === '/content/generate') {
            return {
                contentForEditor: {
                    structured: {
                        caption: `Mock content for: ${payload.topicOrIdea}`,
                        hashtags: ['#' + payload.focusKeyword.replace(/\s+/g, ''), '#content']
                    },
                    html: `<h1>${payload.topicOrIdea}</h1><p>This is mock content generated for ${payload.platform} platform.</p>`,
                    plainText: `# ${payload.topicOrIdea}\n\nThis is mock content generated for ${payload.platform} platform.`
                },
                diagnostics: {
                    usedRAG: false,
                    platform: payload.platform
                }
            };
        }

        if (endpoint === '/seo/hints') {
            return {
                score: 78,
                hints: [
                    { type: 'length', msg: 'Content length is optimal' },
                    { type: 'keyword', msg: `Include focus keyword "${payload.focusKeyword}" more naturally` }
                ]
            };
        }

        if (endpoint === '/image/generate') {
            const dataUrl =
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';
            return {
                altText: `Mock image for ${payload.prompt}`,
                images: (payload.sizes || ['1024x1024']).map((size, idx) => ({
                    url: dataUrl,
                    base64: dataUrl.split(',')[1],
                    size,
                    provider: 'mock',
                    width: Number.parseInt(String(size).split('x')[0], 10) || 1024,
                    height: Number.parseInt(String(size).split('x')[1], 10) || 1024,
                    format: 'png',
                    position: idx
                }))
            };
        }

        throw new ApiError(500, `Unknown mock endpoint: ${endpoint}`);
    }

    /**
     * Helper: Extract keywords from text
     */
    extractKeywords(text) {
        // Simple keyword extraction - can be improved
        const words = text
            .toLowerCase()
            .split(/\s+/)
            .filter(w => w.length > 4);
        return [...new Set(words)].slice(0, 5);
    }
}

export default new FastAPIService();
