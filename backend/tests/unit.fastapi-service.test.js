/**
 * Unit Tests for FastAPIService
 * Tests: mock mode, all endpoints, timeout handling, error propagation
 */
import { jest } from '@jest/globals';

// ── Setup globals ─────────────────────────────────────────────────
global.fetch = jest.fn();

// ── Import service (uses real config but overrides via mock) ──────
import FastAPIService from '../src/services/fastapi.service.js';

// Helper: make fetch return a successful JSON response
function mockFetchSuccess(data) {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => data,
    text: async () => JSON.stringify(data)
  });
}

// Helper: make fetch return an error response
function mockFetchError(status, text) {
  global.fetch.mockResolvedValueOnce({
    ok: false,
    status,
    statusText: text,
    text: async () => text
  });
}

describe('FastAPIService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Mock mode responses ──────────────────────────────────────────
  describe('getMockResponse', () => {
    it('returns clusters for /topic/suggest', () => {
      const resp = FastAPIService.getMockResponse('/topic/suggest', { niche: 'SaaS', language: 'en' });
      expect(resp).toHaveProperty('clusters');
      expect(Array.isArray(resp.clusters)).toBe(true);
      expect(resp.clusters[0]).toHaveProperty('ideas');
      expect(Array.isArray(resp.clusters[0].ideas)).toBe(true);
    });

    it('returns contentForEditor for /content/generate', () => {
      const resp = FastAPIService.getMockResponse('/content/generate', {
        topicOrIdea: 'SaaS Growth',
        platform: 'blog',
        focusKeyword: 'growth'
      });
      expect(resp).toHaveProperty('contentForEditor');
      expect(resp.contentForEditor).toHaveProperty('html');
      expect(resp.contentForEditor).toHaveProperty('plainText');
    });

    it('uses topicOrIdea in mock content HTML', () => {
      const resp = FastAPIService.getMockResponse('/content/generate', {
        topicOrIdea: 'Unique Topic 12345',
        platform: 'blog',
        focusKeyword: 'topic'
      });
      expect(resp.contentForEditor.html).toContain('Unique Topic 12345');
    });

    it('returns score and hints for /seo/hints', () => {
      const resp = FastAPIService.getMockResponse('/seo/hints', { focusKeyword: 'SEO' });
      expect(resp).toHaveProperty('score');
      expect(resp).toHaveProperty('hints');
      expect(typeof resp.score).toBe('number');
      expect(Array.isArray(resp.hints)).toBe(true);
    });

    it('returns image array for /image/generate', () => {
      const resp = FastAPIService.getMockResponse('/image/generate', {
        prompt: 'A test image',
        sizes: ['1024x1024', '512x512']
      });
      expect(resp).toHaveProperty('altText');
      expect(resp).toHaveProperty('images');
      expect(resp.images).toHaveLength(2);
      expect(resp.images[0]).toHaveProperty('size', '1024x1024');
      expect(resp.images[1]).toHaveProperty('size', '512x512');
    });

    it('throws 500 ApiError for unknown endpoint', () => {
      expect(() => FastAPIService.getMockResponse('/unknown/endpoint', {})).toThrow(
        expect.objectContaining({ statusCode: 500 })
      );
    });
  });

  // ── extractKeywords ───────────────────────────────────────────────
  describe('extractKeywords', () => {
    it('returns at most 5 unique keywords', () => {
      const text = 'search engine optimization content marketing strategy analysis';
      const kws = FastAPIService.extractKeywords(text);
      expect(kws.length).toBeLessThanOrEqual(5);
    });

    it('filters out short words (≤4 chars)', () => {
      const text = 'SEO and SaaS are cool tools for content optimization';
      const kws = FastAPIService.extractKeywords(text);
      kws.forEach((kw) => expect(kw.length).toBeGreaterThan(4));
    });

    it('returns empty array for empty string', () => {
      expect(FastAPIService.extractKeywords('')).toEqual([]);
    });

    it('returns unique words', () => {
      const text = 'optimization optimization optimization content content';
      const kws = FastAPIService.extractKeywords(text);
      expect(new Set(kws).size).toBe(kws.length);
    });
  });

  // ── getSeoHints ──────────────────────────────────────────────────
  describe('getSeoHints', () => {
    it('normalizes response to { score, hints }', async () => {
      const original = FastAPIService.isMock;
      FastAPIService.isMock = false;
      FastAPIService.baseUrl = 'http://ai-service';
      mockFetchSuccess({ score: 82, hints: [{ type: 'title', msg: 'Optimize title' }] });

      const result = await FastAPIService.getSeoHints('blog', 'en', 'SEO', '<h1>test</h1>');
      expect(result).toHaveProperty('score', 82);
      expect(result.hints).toHaveLength(1);

      FastAPIService.isMock = original;
    });

    it('defaults to score 0 and empty hints on empty response', async () => {
      const original = FastAPIService.isMock;
      FastAPIService.isMock = false;
      FastAPIService.baseUrl = 'http://ai-service';
      mockFetchSuccess({});

      const result = await FastAPIService.getSeoHints('blog', 'en', 'SEO', '<h1>test</h1>');
      expect(result.score).toBe(0);
      expect(result.hints).toEqual([]);

      FastAPIService.isMock = original;
    });
  });

  // ── generateTopics – item parsing ─────────────────────────────────
  describe('generateTopics – response parsing', () => {
    it('deduplicates ideas across clusters and top-level ideas', async () => {
      const original = FastAPIService.isMock;
      FastAPIService.isMock = false;
      FastAPIService.baseUrl = 'http://ai-service';

      const duplicateIdea = { ideaText: 'Duplicate Topic', targetKeyword: 'dup', rationale: 'test' };
      mockFetchSuccess({
        clusters: [{ label: 'Cluster A', ideas: [duplicateIdea] }],
        ideas: [duplicateIdea],
        diagnostics: {}
      });

      const items = await FastAPIService.generateTopics('u1', 'en', 'Tech', null, {});
      const titles = items.map((i) => i.title);
      expect(new Set(titles).size).toBe(titles.length);

      FastAPIService.isMock = original;
    });

    it('skips ideas with empty title', async () => {
      const original = FastAPIService.isMock;
      FastAPIService.isMock = false;
      FastAPIService.baseUrl = 'http://ai-service';

      mockFetchSuccess({
        clusters: [],
        ideas: [
          { ideaText: '', targetKeyword: '' },
          { ideaText: 'Valid Topic Idea', targetKeyword: 'valid' }
        ],
        diagnostics: {}
      });

      const items = await FastAPIService.generateTopics('u1', 'en', 'Tech', null, {});
      expect(items.every((i) => i.title.length > 0)).toBe(true);

      FastAPIService.isMock = original;
    });
  });

  // ── HTTP error handling ──────────────────────────────────────────
  describe('HTTP error handling', () => {
    it('throws 502 ApiError when FastAPI returns non-ok response', async () => {
      const original = FastAPIService.isMock;
      FastAPIService.isMock = false;
      FastAPIService.baseUrl = 'http://ai-service';
      mockFetchError(500, 'Internal Server Error');

      await expect(
        FastAPIService.request('/seo/hints', {})
      ).rejects.toMatchObject({ statusCode: 502 });

      FastAPIService.isMock = original;
    });

    it('throws 500 when baseUrl is not configured', async () => {
      const original = FastAPIService.isMock;
      const originalUrl = FastAPIService.baseUrl;
      FastAPIService.isMock = false;
      FastAPIService.baseUrl = '';

      await expect(FastAPIService.request('/seo/hints', {})).rejects.toMatchObject({ statusCode: 500 });

      FastAPIService.isMock = original;
      FastAPIService.baseUrl = originalUrl;
    });

    it('throws 502 on network/fetch exception', async () => {
      const original = FastAPIService.isMock;
      FastAPIService.isMock = false;
      FastAPIService.baseUrl = 'http://ai-service';
      global.fetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      await expect(FastAPIService.request('/seo/hints', {})).rejects.toMatchObject({ statusCode: 502 });

      FastAPIService.isMock = original;
    });
  });
});
