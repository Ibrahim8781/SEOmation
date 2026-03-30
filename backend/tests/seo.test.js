/**
 * tests/seo.test.js
 * POST /api/seo/score  +  pure unit tests of SeoService.scoreContent
 */

import request from 'supertest';
import { describe, it, expect, beforeEach } from '@jest/globals';
import { app } from '../src/app.js';
import { SeoService } from '../src/services/seo.service.js';
import { TEST_USER, registerUser, authedRequest } from './helpers.js';

let token;
beforeEach(async () => {
  const { accessToken } = await registerUser(TEST_USER);
  token = accessToken;
});

// ---------------------------------------------------------------------------
// Unit: SeoService.scoreContent
// ---------------------------------------------------------------------------
describe('SeoService.scoreContent (unit)', () => {
  it('returns total score between 0 and 100', () => {
    const result = SeoService.scoreContent({
      title: 'How to Build a SaaS Product',
      metaDescription: 'Learn the best practices for building a SaaS product step by step with real examples.',
      bodyHtml: '<h1>SaaS Product</h1><h2>Introduction</h2><p>Building a SaaS product requires careful planning.</p><h2>Steps</h2><p>Follow these steps to succeed in SaaS.</p>',
      primaryKeyword: 'SaaS product'
    });
    expect(typeof result.total).toBe('number');
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(100);
  });

  it('returns components array with id, label, score, max, message, severity', () => {
    const result = SeoService.scoreContent({
      title: 'Test Title for SEO',
      bodyHtml: '<p>Test content body here.</p>',
      primaryKeyword: 'test'
    });
    expect(Array.isArray(result.components)).toBe(true);
    expect(result.components.length).toBeGreaterThan(0);

    const comp = result.components[0];
    expect(comp).toHaveProperty('id');
    expect(comp).toHaveProperty('label');
    expect(comp).toHaveProperty('score');
    expect(comp).toHaveProperty('max');
    expect(comp).toHaveProperty('message');
    expect(comp).toHaveProperty('severity');
  });

  it('returns meta with wordCount and keywordDensity', () => {
    const result = SeoService.scoreContent({
      title: 'Test',
      bodyHtml: '<p>This is a test body with the word test repeated test times for testing.</p>',
      primaryKeyword: 'test'
    });
    expect(result.meta).toHaveProperty('wordCount');
    expect(result.meta).toHaveProperty('keywordDensity');
    expect(typeof result.meta.wordCount).toBe('number');
    expect(typeof result.meta.keywordDensity).toBe('number');
  });

  it('content with ideal title length (45-70 chars) + keyword scores higher title', () => {
    const goodResult = SeoService.scoreContent({
      title: 'How to Build a Successful SaaS Product in 2025', // 48 chars, has keyword
      bodyHtml: '<h1>SaaS Product Guide</h1><p>Content about SaaS product development.</p>',
      primaryKeyword: 'SaaS product'
    });
    const badResult = SeoService.scoreContent({
      title: 'Hi', // too short, no keyword
      bodyHtml: '<p>Very short</p>',
      primaryKeyword: 'SaaS product'
    });
    const titleGood = goodResult.components.find((c) => c.id === 'title');
    const titleBad = badResult.components.find((c) => c.id === 'title');
    expect(titleGood.score).toBeGreaterThan(titleBad.score);
  });

  it('content with 400+ words scores highest for length', () => {
    const longBody = '<p>' + 'word '.repeat(410) + '</p>';
    const result = SeoService.scoreContent({ title: 'T', bodyHtml: longBody, primaryKeyword: 'word' });
    const lengthComp = result.components.find((c) => c.id === 'length');
    expect(lengthComp.score).toBe(15);
  });

  it('returns score=0 for title component when title is empty', () => {
    const result = SeoService.scoreContent({
      title: '',
      bodyHtml: '<p>Some content</p>',
      primaryKeyword: 'content'
    });
    const titleComp = result.components.find((c) => c.id === 'title');
    expect(titleComp.score).toBe(0);
  });

  it('handles null/undefined input gracefully', () => {
    expect(() => SeoService.scoreContent(null)).not.toThrow();
    expect(() => SeoService.scoreContent(undefined)).not.toThrow();
    expect(() => SeoService.scoreContent({})).not.toThrow();
  });

  it('keyword density within 0.8%-3.5% scores highest for keywords', () => {
    // Roughly 1.5% density: 3 occurrences in 200 words
    const words = 'lorem ipsum dolor sit amet '.repeat(39) + 'SaaS product SaaS product SaaS product';
    const result = SeoService.scoreContent({
      title: 'Test',
      bodyHtml: `<p>${words}</p>`,
      primaryKeyword: 'SaaS product'
    });
    const kwComp = result.components.find((c) => c.id === 'keywords');
    expect(kwComp.score).toBe(12);
  });

  it('H1 + 2 subheadings earns full heading score', () => {
    const result = SeoService.scoreContent({
      title: 'Test',
      bodyHtml: '<h1>Main Title</h1><h2>Section One</h2><p>Body</p><h2>Section Two</h2><p>More body</p>',
      primaryKeyword: 'test'
    });
    const headingsComp = result.components.find((c) => c.id === 'headings');
    expect(headingsComp.score).toBe(13);
  });

  it('images with descriptive alt text earn higher image score', () => {
    const withAlt = SeoService.scoreContent({
      title: 'Test',
      bodyHtml: '<img alt="A detailed description of the image" /><p>Content</p>',
      primaryKeyword: 'test'
    });
    const withoutAlt = SeoService.scoreContent({
      title: 'Test',
      bodyHtml: '<p>Content without images</p>',
      primaryKeyword: 'test'
    });
    const altComp = withAlt.components.find((c) => c.id === 'images');
    const noAltComp = withoutAlt.components.find((c) => c.id === 'images');
    expect(altComp.score).toBeGreaterThan(noAltComp.score);
  });
});

// ---------------------------------------------------------------------------
// API: POST /api/seo/score
// ---------------------------------------------------------------------------
describe('POST /api/seo/score', () => {
  it('returns 200 with total score and components for valid payload', async () => {
    const res = await authedRequest(token).post('/api/seo/score').send({
      title: 'How to Optimize Your Website for Search Engines',
      metaDescription: 'Learn the best techniques to optimize your website for search engines and improve rankings.',
      bodyHtml: '<h1>SEO Optimization</h1><h2>On-Page SEO</h2><p>On-page SEO optimization matters.</p><h2>Off-Page SEO</h2><p>Building backlinks is important for SEO optimization.</p>',
      primaryKeyword: 'SEO optimization',
      secondaryKeywords: ['search engine', 'rankings']
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('components');
    expect(Array.isArray(res.body.components)).toBe(true);
  });

  it('score is a number between 0 and 100', async () => {
    const res = await authedRequest(token).post('/api/seo/score').send({
      title: 'Test Title',
      bodyHtml: '<p>Test body</p>',
      primaryKeyword: 'test'
    });
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(0);
    expect(res.body.total).toBeLessThanOrEqual(100);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).post('/api/seo/score').send({
      title: 'Test',
      bodyHtml: '<p>Test</p>',
      primaryKeyword: 'test'
    });
    expect(res.status).toBe(401);
  });
});
