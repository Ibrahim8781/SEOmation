/**
 * Integration Tests for User endpoints: GET/PUT /api/users/me
 */
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from './setup.js';
import { AuthService } from '../src/services/auth.service.js';

describe('User Endpoints Integration Tests', () => {
  let accessToken;
  let userId;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `user.me.test.${Date.now()}@test.com`,
        passwordHash: '$2a$12$fakehash',
        name: 'Profile Tester',
        company: 'Test Co',
        niche: 'SaaS',
        timezone: 'UTC',
        language: 'EN'
      }
    });
    userId = user.id;
    const tokens = await AuthService.issueTokens(user);
    accessToken = tokens.accessToken;
  });

  // ── GET /api/users/me ────────────────────────────────────────────
  describe('GET /api/users/me', () => {
    it('returns user profile for authenticated request', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('email');
      expect(res.body).toHaveProperty('name');
      expect(res.body).toHaveProperty('id');
    });

    it('does not return passwordHash', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('returns 401 without auth header', async () => {
      const res = await request(app).get('/api/users/me').expect(401);
      expect(res.body.message).toMatch(/missing access token/i);
    });

    it('returns 401 with garbage Bearer token', async () => {
      await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer garbage.token.here')
        .expect(401);
    });

    it('returns 401 with Basic auth instead of Bearer', async () => {
      await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Basic dXNlcjpwYXNz')
        .expect(401);
    });
  });

  // ── PUT /api/users/me ─────────────────────────────────────────────
  describe('PUT /api/users/me', () => {
    it('updates name and company', async () => {
      const res = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated Name', company: 'New Corp' })
        .expect(200);

      expect(res.body.name).toBe('Updated Name');
      expect(res.body.company).toBe('New Corp');
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('updates niche and timezone', async () => {
      const res = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ niche: 'E-commerce', timezone: 'America/New_York' })
        .expect(200);

      expect(res.body.niche).toBe('E-commerce');
      expect(res.body.timezone).toBe('America/New_York');
    });

    it('updates language', async () => {
      const res = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ language: 'DE' })
        .expect(200);

      expect(res.body.language).toBe('DE');
    });

    it('returns 401 without auth token', async () => {
      await request(app)
        .put('/api/users/me')
        .send({ name: 'Hacker' })
        .expect(401);
    });

    it('persists changes to the database', async () => {
      await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'PersistenceCheck' })
        .expect(200);

      const dbUser = await prisma.user.findUnique({ where: { id: userId } });
      expect(dbUser.name).toBe('PersistenceCheck');
    });
  });

  // ── Health check ─────────────────────────────────────────────────
  describe('GET /health', () => {
    it('returns 200 OK', async () => {
      const res = await request(app).get('/health').expect(200);
      expect(res.body).toHaveProperty('status', 'ok');
    });
  });
});
