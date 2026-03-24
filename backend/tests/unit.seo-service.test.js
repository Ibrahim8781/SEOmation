/**
 * Comprehensive Unit Tests for SeoService
 * Covers all scoring branches, edge cases, and boundary conditions
 */
import { SeoService } from '../src/services/seo.service.js';

const FULL_CONTENT = `<h1>SaaS SEO Guide</h1><h2>Why SEO Matters</h2><p>Search engine optimization is critical for SaaS companies. ${' More detail here.'.repeat(30)}</p><h2>Key Strategies</h2><p>Focus on long-tail keywords. ${' Expand here.'.repeat(30)}</p><h3>Advanced Tips</h3><p>Use structured data. ${' More tips.'.repeat(20)}</p>`;

describe('SeoService – scoreContent', () => {
  // ── Sanity / shape ──────────────────────────────────────────────
  describe('output shape', () => {
    it('returns total, max, components, and meta fields', () => {
      const result = SeoService.scoreContent({ title: 'T', bodyHtml: '<h1>T</h1>', primaryKeyword: 'T' });
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('max', 100);
      expect(result).toHaveProperty('components');
      expect(result).toHaveProperty('meta');
      expect(Array.isArray(result.components)).toBe(true);
    });

    it('has exactly 6 components', () => {
      const result = SeoService.scoreContent({ title: 'Test', bodyHtml: '<h1>Test</h1>', primaryKeyword: 'test' });
      expect(result.components).toHaveLength(6);
    });

    it('total is a percentage (0-100)', () => {
      const result = SeoService.scoreContent({ title: 'X', bodyHtml: '', primaryKeyword: '' });
      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(result.total).toBeLessThanOrEqual(100);
    });

    it('handles null/undefined input gracefully', () => {
      expect(() => SeoService.scoreContent(null)).not.toThrow();
      expect(() => SeoService.scoreContent(undefined)).not.toThrow();
      expect(() => SeoService.scoreContent({})).not.toThrow();
    });
  });

  // ── Title scoring ────────────────────────────────────────────────
  describe('title component', () => {
    const getTitle = (input) => SeoService.scoreContent(input).components.find((c) => c.id === 'title');

    it('empty title scores 0 and contains add-title advice', () => {
      const c = getTitle({ title: '', bodyHtml: '', primaryKeyword: '' });
      expect(c.score).toBe(0);
      expect(c.message).toMatch(/add a clear title/i);
    });

    it('optimal length 45-70 chars earns 8 base points', () => {
      const title = 'A'.repeat(50); // 50 chars
      const c = getTitle({ title, bodyHtml: '', primaryKeyword: '' });
      expect(c.score).toBeGreaterThanOrEqual(8);
    });

    it('title with primary keyword earns 5 bonus points', () => {
      const c1 = getTitle({ title: 'SaaS SEO Guide for Beginners in Modern World', bodyHtml: '', primaryKeyword: 'SaaS SEO' });
      const c2 = getTitle({ title: 'A Guide for Beginners in the Modern World Today!', bodyHtml: '', primaryKeyword: 'SaaS SEO' });
      expect(c1.score).toBeGreaterThan(c2.score);
    });

    it('very short title (<30 chars) gets lower base score', () => {
      const c = getTitle({ title: 'Hi', bodyHtml: '', primaryKeyword: '' });
      expect(c.score).toBeLessThanOrEqual(4);
    });

    it('very long title (>90 chars) gets lower base score', () => {
      const c = getTitle({ title: 'A'.repeat(95), bodyHtml: '', primaryKeyword: '' });
      expect(c.score).toBeLessThanOrEqual(6);
    });

    it('acceptable range 30-90 chars earns 6 base points', () => {
      const title = 'A'.repeat(35);
      const c = getTitle({ title, bodyHtml: '', primaryKeyword: '' });
      expect(c.score).toBeGreaterThanOrEqual(6);
    });
  });

  // ── Meta description scoring ─────────────────────────────────────
  describe('meta component', () => {
    const getMeta = (input) => SeoService.scoreContent(input).components.find((c) => c.id === 'meta');

    it('empty meta description scores 0', () => {
      const c = getMeta({ title: 'T', metaDescription: '', primaryKeyword: 'test' });
      expect(c.score).toBe(0);
      expect(c.message).toMatch(/add a meta description/i);
    });

    it('optimal 140-165 chars earns 6 base points', () => {
      const meta = 'A'.repeat(150);
      const c = getMeta({ title: 'T', metaDescription: meta, primaryKeyword: '' });
      expect(c.score).toBeGreaterThanOrEqual(6);
    });

    it('keyword in meta description earns 4 bonus points', () => {
      const meta = 'A'.repeat(150) + ' keyword here';
      const withKw = getMeta({ title: 'T', metaDescription: meta, primaryKeyword: 'keyword' });
      const withoutKw = getMeta({ title: 'T', metaDescription: 'A'.repeat(150), primaryKeyword: 'keyword' });
      expect(withKw.score).toBeGreaterThan(withoutKw.score);
    });

    it('acceptable range 110-180 earns 4 base points', () => {
      const meta = 'A'.repeat(115);
      const c = getMeta({ title: 'T', metaDescription: meta, primaryKeyword: '' });
      expect(c.score).toBeGreaterThanOrEqual(4);
    });

    it('very short meta (<110 chars) earns only 2 base points', () => {
      const meta = 'A'.repeat(50);
      const c = getMeta({ title: 'T', metaDescription: meta, primaryKeyword: '' });
      expect(c.score).toBeLessThanOrEqual(6);
    });
  });

  // ── Heading structure ─────────────────────────────────────────────
  describe('headings component', () => {
    const getHeadings = (html) => SeoService.scoreContent({ title: 'T', bodyHtml: html, primaryKeyword: 't' }).components.find((c) => c.id === 'headings');

    it('no H1 scores 0 and advises adding H1', () => {
      const c = getHeadings('<h2>Section</h2><p>Content here</p>');
      expect(c.score).toBe(0);
      expect(c.message).toContain('H1');
    });

    it('H1 only (no H2/H3) scores 7 and advises subheadings', () => {
      const c = getHeadings('<h1>Title</h1><p>Content without subheadings here</p>');
      expect(c.score).toBe(7);
      expect(c.message).toMatch(/subheadings/i);
    });

    it('H1 + 2 H2s scores 13 and message indicates solid structure', () => {
      const c = getHeadings('<h1>Title</h1><h2>S1</h2><h2>S2</h2><p>Body content here</p>');
      expect(c.score).toBe(13);
      expect(c.message).toMatch(/solid/i);
    });

    it('H1 + H2 + H3 combination scores 13', () => {
      const c = getHeadings('<h1>Title</h1><h2>Section</h2><h3>Subsection</h3><p>Body content</p>');
      expect(c.score).toBe(13);
    });

    it('H1 with only 1 subheading scores 7 (not enough hierarchy)', () => {
      const c = getHeadings('<h1>Title</h1><h2>Only one section</h2><p>Content</p>');
      expect(c.score).toBe(7);
    });
  });

  // ── Keyword scoring ───────────────────────────────────────────────
  describe('keywords component', () => {
    const getKeyword = (html, primary, secondary = []) =>
      SeoService.scoreContent({ title: 'T', bodyHtml: html, primaryKeyword: primary, secondaryKeywords: secondary })
        .components.find((c) => c.id === 'keywords');

    it('no primary keyword scores 0 with advice message', () => {
      const c = getKeyword('<p>Content here</p>', '');
      expect(c.score).toBe(0);
      expect(c.message).toMatch(/primary keyword/i);
    });

    it('healthy density (0.8-3.5%) earns 12 base points', () => {
      // ~1.5% density: 3 occurrences in 200 words
      const body = 'SEO ' + 'word '.repeat(99) + 'SEO ' + 'word '.repeat(99) + 'SEO';
      const c = getKeyword(body, 'SEO');
      expect(c.score).toBeGreaterThanOrEqual(12);
    });

    it('low density (<0.8%) earns 6 base points', () => {
      const body = 'SEO ' + 'word '.repeat(300);
      const c = getKeyword(body, 'SEO');
      expect(c.score).toBe(6);
    });

    it('high density (>3.5%) earns 8 base points', () => {
      const body = 'SEO '.repeat(50) + 'word '.repeat(50);
      const c = getKeyword(body, 'SEO');
      expect(c.score).toBeGreaterThanOrEqual(8);
    });

    it('secondary keywords add 2 bonus points', () => {
      const body = 'SEO ' + 'word '.repeat(99) + 'SEO ' + 'word '.repeat(99) + 'SEO rank';
      const withSec = getKeyword(body, 'SEO', ['rank']);
      const withoutSec = getKeyword(body, 'SEO', []);
      expect(withSec.score).toBeGreaterThan(withoutSec.score);
    });

    it('meta contains keywordDensity', () => {
      const result = SeoService.scoreContent({ title: 'T', bodyHtml: 'SEO word word word', primaryKeyword: 'SEO' });
      expect(result.meta).toHaveProperty('keywordDensity');
      expect(typeof result.meta.keywordDensity).toBe('number');
    });
  });

  // ── Content length ────────────────────────────────────────────────
  describe('length component', () => {
    const getLength = (wordCount) => {
      const html = 'word '.repeat(wordCount);
      return SeoService.scoreContent({ title: 'T', bodyHtml: html, primaryKeyword: 'word' })
        .components.find((c) => c.id === 'length');
    };

    it('400+ words earns 15 (max)', () => {
      expect(getLength(400).score).toBe(15);
      expect(getLength(1000).score).toBe(15);
    });

    it('300-399 words earns 13', () => {
      expect(getLength(350).score).toBe(13);
    });

    it('250-299 words earns 11', () => {
      expect(getLength(275).score).toBe(11);
    });

    it('150-249 words earns 9', () => {
      expect(getLength(200).score).toBe(9);
    });

    it('100-149 words earns 7', () => {
      expect(getLength(120).score).toBe(7);
    });

    it('<100 words earns 4', () => {
      expect(getLength(50).score).toBe(4);
    });

    it('0 words earns 4', () => {
      expect(getLength(0).score).toBe(4);
    });

    it('meta contains accurate wordCount', () => {
      const result = SeoService.scoreContent({ title: 'T', bodyHtml: 'one two three four five', primaryKeyword: 't' });
      expect(result.meta.wordCount).toBe(5);
    });
  });

  // ── Image alt text ────────────────────────────────────────────────
  describe('images component', () => {
    const getImages = (html, images = []) =>
      SeoService.scoreContent({ title: 'T', bodyHtml: html, primaryKeyword: 't', images })
        .components.find((c) => c.id === 'images');

    it('no images scores 4 and advises adding images', () => {
      const c = getImages('<p>Content</p>', []);
      expect(c.score).toBe(4);
      expect(c.message).toMatch(/add images/i);
    });

    it('images with short alt text scores lower (not all descriptive)', () => {
      const c = getImages('<p>Content</p>', [{ altText: 'Hi' }]);
      expect(c.score).toBeLessThan(10);
    });

    it('images with descriptive alt text (≥6 chars) scores 10', () => {
      const c = getImages('<p>Content</p>', [{ altText: 'Descriptive alt text for image here' }]);
      expect(c.score).toBe(10);
    });

    it('extracts alt text from inline HTML img tags', () => {
      const html = '<p>Content</p><img src="x.jpg" alt="A descriptive alt text here" />';
      const c = getImages(html, []);
      expect(c.score).toBe(10);
    });

    it('combines inline img alts and images array', () => {
      const html = '<img src="a.jpg" alt="Good alt text here" />';
      const c = getImages(html, [{ altText: 'Another good alt text' }]);
      expect(c.score).toBe(10);
    });

    it('mixed descriptive and non-descriptive triggers partial warning', () => {
      const c = getImages('<p>c</p>', [
        { altText: 'Good descriptive alt text here' },
        { altText: 'hi' }
      ]);
      expect(c.message).toMatch(/some images need better/i);
    });
  });

  // ── Severity field ────────────────────────────────────────────────
  describe('severity classification', () => {
    it('full-score component has severity "ok"', () => {
      const result = SeoService.scoreContent({
        title: 'This is a perfectly optimized title between 45 70',
        metaDescription: 'A '.repeat(72).trim(), // ~144 chars
        bodyHtml: FULL_CONTENT,
        primaryKeyword: 'SaaS SEO',
        secondaryKeywords: ['guide'],
        images: [{ altText: 'An informative dashboard screenshot' }]
      });
      const okCount = result.components.filter((c) => c.severity === 'ok').length;
      expect(okCount).toBeGreaterThan(0);
    });

    it('zero-score component has severity "error"', () => {
      const result = SeoService.scoreContent({ title: '', bodyHtml: '', primaryKeyword: '' });
      const errors = result.components.filter((c) => c.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  // ── Regression / edge cases ───────────────────────────────────────
  describe('edge cases', () => {
    it('HTML entities in title do not crash scoring', () => {
      expect(() =>
        SeoService.scoreContent({ title: '<script>alert(1)</script>', bodyHtml: '', primaryKeyword: '' })
      ).not.toThrow();
    });

    it('extremely long body does not crash', () => {
      const html = '<h1>T</h1><h2>S1</h2><h2>S2</h2>' + '<p>word </p>'.repeat(5000);
      expect(() => SeoService.scoreContent({ title: 'T', bodyHtml: html, primaryKeyword: 'word' })).not.toThrow();
    });

    it('Unicode keywords are handled without throwing', () => {
      expect(() =>
        SeoService.scoreContent({ title: 'SEO في 2024', bodyHtml: '<h1>SEO في 2024</h1>', primaryKeyword: 'SEO' })
      ).not.toThrow();
    });

    it('secondaryKeywords with null entries does not throw', () => {
      expect(() =>
        SeoService.scoreContent({ title: 'T', bodyHtml: '<h1>T</h1>', primaryKeyword: 'T', secondaryKeywords: [null, undefined, ''] })
      ).not.toThrow();
    });
  });
});
