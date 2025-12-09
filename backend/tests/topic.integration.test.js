import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from './setup.js';

describe('Topic Generation Integration Tests', () => {
  let accessToken;
  let userId;

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `topic.test.${Date.now()}@test.com`,
        passwordHash: 'hashed',
        name: 'Topic Tester',
        company: 'Test Co',
        niche: 'SaaS SEO',
        timezone: 'UTC',
        language: 'EN'
      }
    });
    userId = user.id;

    // Get token via auth service (simplified)
    const { AuthService } = await import('../src/services/auth.service.js');
    const tokens = await AuthService.issueTokens(user);
    accessToken = tokens.accessToken;
  });

  describe('POST /api/topics/generate [TOPIC-001]', () => {
    it('should generate topics with valid niche', async () => {
      const res = await request(app)
        .post('/api/topics/generate')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          platform: 'BLOG',
          language: 'EN',
          context: {
            niche: 'SaaS SEO',
            audience: 'founders',
            seedKeywords: ['content', 'SEO', 'automation'],
            region: 'US',
            season: 'Q4',
            count: 12
          }
        })
        .expect(201);

      expect(res.body.items).toBeDefined();
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items.length).toBeGreaterThan(0);
      expect(res.body.items.length).toBeLessThanOrEqual(12);

      // Validate structure
      const topic = res.body.items[0];
      expect(topic).toHaveProperty('id');
      expect(topic).toHaveProperty('title');
      expect(topic).toHaveProperty('platform');
      expect(topic).toHaveProperty('language');
      expect(topic).toHaveProperty('status', 'SUGGESTED');
      expect(topic.title.length).toBeGreaterThan(20);
      expect(topic.title.length).toBeLessThan(120);
    });

    it('should support German language [TOPIC-006]', async () => {
      const res = await request(app)
        .post('/api/topics/generate')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          platform: 'BLOG',
          language: 'DE',
          context: { niche: 'Marketing', count: 6 }
        })
        .expect(201);

      expect(res.body.items[0].language).toBe('DE');
    });

    it('should reject unauthorized request', async () => {
      await request(app)
        .post('/api/topics/generate')
        .send({ platform: 'BLOG', language: 'EN' })
        .expect(401);
    });
  });

  describe('GET /api/topics', () => {
    it('should list user topics', async () => {
      const res = await request(app)
        .get('/api/topics')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.items).toBeDefined();
      expect(Array.isArray(res.body.items)).toBe(true);
    });
  });
});
