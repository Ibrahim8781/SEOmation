import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from './setup.js';

describe('Content Generation Integration Tests', () => {
  let accessToken;
  let userId;
  let topicId;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `content.test.${Date.now()}@test.com`,
        passwordHash: 'hashed',
        name: 'Content Tester',
        company: 'Test Co',
        niche: 'SaaS',
        timezone: 'UTC',
        language: 'EN'
      }
    });
    userId = user.id;

    const { AuthService } = await import('../src/services/auth.service.js');
    const tokens = await AuthService.issueTokens(user);
    accessToken = tokens.accessToken;

    // Create a test topic
    const topic = await prisma.topic.create({
      data: {
        userId,
        title: 'How to optimize SaaS landing pages',
        platform: 'BLOG',
        language: 'EN',
        targetKeyword: 'SaaS SEO',
        status: 'SUGGESTED'
      }
    });
    topicId = topic.id;
  });

  describe('POST /api/content/generate [CONT-001, CONT-002]', () => {
    it('should generate blog from topic ID', async () => {
      const res = await request(app)
        .post('/api/content/generate')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          platform: 'BLOG',
          language: 'EN',
          topicId,
          targetLength: 1200
        })
        .timeout(65000) // AI generation can take time
        .expect(201);

      expect(res.body.item).toBeDefined();
      expect(res.body.item.title).toBeTruthy();
      expect(res.body.item.html).toBeTruthy();
      expect(res.body.item.text).toBeTruthy();
      expect(res.body.item.platform).toBe('BLOG');
      expect(res.body.item.status).toBe('DRAFT');
    });

    it('should generate from custom prompt [CONT-002]', async () => {
      const res = await request(app)
        .post('/api/content/generate')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          platform: 'BLOG',
          language: 'EN',
          prompt: 'Write a guide on onboarding new SaaS users',
          focusKeyword: 'user onboarding'
        })
        .timeout(65000)
        .expect(201);

      expect(res.body.item.title).toContain('onboarding');
    });

    it('should include LinkedIn variant [CONT-003]', async () => {
      const res = await request(app)
        .post('/api/content/generate')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          platform: 'BLOG',
          topicId,
          includeLinkedIn: true
        })
        .timeout(65000)
        .expect(201);

      expect(res.body.variants).toHaveProperty('linkedin');
      expect(res.body.variants.linkedin.text).toBeTruthy();
    });

    it('should reject missing topicId and prompt', async () => {
      await request(app)
        .post('/api/content/generate')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ platform: 'BLOG', language: 'EN' })
        .expect(400);
    });
  });

  describe('GET /api/content', () => {
    it('should list user content', async () => {
      const res = await request(app)
        .get('/api/content')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.items).toBeDefined();
      expect(Array.isArray(res.body.items)).toBe(true);
    });
  });
});
