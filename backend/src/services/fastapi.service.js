import { config } from '../config/index.js';
import ApiError from '../utils/ApiError.js';

const TIMEOUT_MS = 120000; // 2 minutes as requested

class FastAPIService {
    constructor() {
        this.baseUrl = config.ai.url;
        this.isMock = config.ai.mock;
    }

    /**
     * Generic HTTP request handler for FastAPI calls
     */
    async request(endpoint, payload, method = 'POST') {
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
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
            console.log(`[FastAPI] ${method} ${url}`, JSON.stringify(payload, null, 2));

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.text();
                console.error(`[FastAPI Error] ${response.status}:`, errorData);
                throw new ApiError(502, `FastAPI error: ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`[FastAPI Response]`, JSON.stringify(data, null, 2));
            return data;
        } catch (error) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
                throw new ApiError(504, 'FastAPI request timeout (2 minutes exceeded)');
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
            count: context?.count || 12,
            includeTrends: context?.includeTrends !== false,
            namespace: context?.namespace || null
        };

        const response = await this.request('/topic/suggest', payload);

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
    async generateContent(userId, platform, language, topicOrIdea, focusKeyword, tone = 'friendly', targetLength = 1200, styleGuide = []) {
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
            includeTrend: true,
            styleGuideBullets: styleGuide || [],
            namespace: null
        };

        const response = await this.request('/content/generate', payload);

        const contentForEditor = response?.contentForEditor || {};
        const structured = contentForEditor.structured || null;
        const html = contentForEditor.html || '';
        const plainText = contentForEditor.plainText || '';
        const diagnostics = response?.diagnostics || null;
        const metrics = response?.metrics || {};

        return {
            title: topicOrIdea,
            html,
            text: plainText,
            structured,
            seoMeta: {
                keywords: this.extractKeywords(plainText),
                focusKeyword
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

        const response = await this.request('/seo/hints', payload);

        return {
            score: response.score || 0,
            hints: response.hints || []
        };
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
