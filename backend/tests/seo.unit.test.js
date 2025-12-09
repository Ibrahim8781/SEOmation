import { SeoService } from '../src/services/seo.service.js';

describe('SEO Service Unit Tests', () => {
  describe('scoreContent [SEO-001]', () => {
    it('should score complete content', () => {
      const result = SeoService.scoreContent({
        title: 'Ultimate Guide to SaaS SEO in 2024',
        metaDescription: 'Learn proven SaaS SEO strategies to drive organic traffic and boost conversions. This comprehensive guide covers keyword research, on-page optimization.',
        bodyHtml: '<h1>Ultimate Guide to SaaS SEO</h1><h2>Why SEO Matters</h2><p>Search engine optimization is critical for SaaS companies looking to scale their customer acquisition. By targeting the right keywords and creating high-quality content, you can attract qualified leads organically.</p><h2>Key Strategies</h2><p>Focus on long-tail keywords that match user intent. Create comprehensive guides that answer common questions your target audience asks.</p>'.repeat(15),
        primaryKeyword: 'SaaS SEO',
        secondaryKeywords: ['keyword research', 'organic traffic'],
        images: [{ altText: 'SEO dashboard showing metrics' }]
      });

      expect(result.total).toBeGreaterThan(0);
      expect(result.max).toBeGreaterThan(0);
      expect(result.components).toBeDefined();
      expect(Array.isArray(result.components)).toBe(true);
      expect(result.components.length).toBeGreaterThan(5);
    });

    it('should detect missing H1 [SEO-002]', () => {
      const result = SeoService.scoreContent({
        title: 'Test',
        metaDescription: 'Test description that is long enough for validation',
        bodyHtml: '<p>Content without H1 tag</p>',
        primaryKeyword: 'test'
      });

      const headingComponent = result.components.find(c => c.id === 'headings');
      expect(headingComponent.message).toContain('H1');
    });

    it('should calculate keyword density [SEO-003]', () => {
      const content = 'SEO optimization is important. SEO helps visibility. ' + 'More content here. '.repeat(100);
      const result = SeoService.scoreContent({
        title: 'SEO Guide',
        metaDescription: 'Learn SEO basics',
        bodyHtml: content,
        primaryKeyword: 'SEO'
      });

      expect(result.meta.keywordDensity).toBeGreaterThan(0);
      expect(result.meta.keywordDensity).toBeLessThan(5);
    });

    it('should check title length [SEO-007]', () => {
      const result = SeoService.scoreContent({
        title: 'This is a perfectly optimized title between 45-70 chars',
        metaDescription: 'Valid meta description here',
        bodyHtml: '<p>Content</p>',
        primaryKeyword: 'test'
      });

      const titleComponent = result.components.find(c => c.id === 'title');
      expect(titleComponent.score).toBeGreaterThan(10);
    });
  });
});