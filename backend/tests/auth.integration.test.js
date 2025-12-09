import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from './setup.js';

describe('Authentication Integration Tests', () => {
  const testUser = {
    email: `test.${Date.now()}@seomation.test`,
    password: 'TestPass123!',
    name: 'Test User',
    company: 'Test Co',
    niche: 'SaaS Testing',
    timezone: 'Asia/Karachi',
    language: 'EN'
  };

  let accessToken;
  let refreshToken;

  describe('POST /api/auth/register [AUTH-001, AUTH-002]', () => {
    it('should register new user with valid data', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      expect(res.body).toHaveProperty('user');
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.user.email).toBe(testUser.email);
      expect(res.body.user).not.toHaveProperty('passwordHash');

      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    it('should reject duplicate email registration', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(409);

      expect(res.body.message).toContain('Email already in use');
    });

    it('should reject invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...testUser, email: 'invalid-email' })
        .expect(400);
    });

    it('should reject short password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...testUser, email: 'new@test.com', password: 'short' })
        .expect(400);
    });
  });

  describe('POST /api/auth/login [AUTH-003, AUTH-004]', () => {
    it('should login with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.user.email).toBe(testUser.email);
    });

    it('should reject wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'WrongPassword' })
        .expect(401);

      expect(res.body.message).toContain('Invalid credentials');
    });

    it('should reject non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@test.com', password: 'AnyPassword' })
        .expect(401);
    });
  });

  describe('POST /api/auth/refresh [AUTH-005]', () => {
    it('should refresh token with valid refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.refreshToken).not.toBe(refreshToken); // Token rotation
    });

    it('should reject invalid refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid.token.here' })
        .expect(401);
    });
  });

  describe('GET /api/users/me [AUTH-006]', () => {
    it('should access protected route with valid token', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.email).toBe(testUser.email);
    });

    it('should reject request without token', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .expect(401);

      expect(res.body.message).toContain('Missing access token');
    });

    it('should reject request with invalid token', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken })
        .expect(204);

      // Verify token is revoked
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });
  });
});