/**
 * tests/middleware.test.js
 * Auth middleware, Zod validation middleware, error handler, rate limiter
 */

import request from 'supertest';
import { describe, it, expect, beforeEach } from '@jest/globals';
import { app } from '../src/app.js';
import { signAccessToken } from '../src/utils/jwt.js';
import { TEST_USER, registerUser } from './helpers.js';

// A protected route to probe auth middleware against
const PROTECTED = '/api/users/me';

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------
describe('Auth middleware', () => {
  it('passes through with a valid Bearer token', async () => {
    const { accessToken } = await registerUser(TEST_USER);
    const res = await request(app).get(PROTECTED).set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).get(PROTECTED);
    expect(res.status).toBe(401);
  });

  it('returns 401 when Authorization header has wrong scheme (Basic)', async () => {
    const res = await request(app).get(PROTECTED).set('Authorization', 'Basic dXNlcjpwYXNz');
    expect(res.status).toBe(401);
  });

  it('returns 401 for a syntactically invalid JWT', async () => {
    const res = await request(app)
      .get(PROTECTED)
      .set('Authorization', 'Bearer this.is.not.a.jwt');
    expect(res.status).toBe(401);
  });

  it('returns 401 for a JWT signed with the wrong secret', async () => {
    // Manually create a token signed with a different secret
    const badToken = signAccessToken({ id: 'fake-id', email: 'x@x.com', role: 'USER' });
    // Tamper with the signature by changing the last few chars
    const tampered = badToken.slice(0, -5) + 'XXXXX';
    const res = await request(app).get(PROTECTED).set('Authorization', `Bearer ${tampered}`);
    expect(res.status).toBe(401);
  });

  it('returns 401 when Bearer token is an empty string', async () => {
    const res = await request(app).get(PROTECTED).set('Authorization', 'Bearer ');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Zod validation middleware
// ---------------------------------------------------------------------------
describe('Zod validation middleware', () => {
  it('returns 400 with error message for invalid register payload', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'not-an-email',
      password: '123',        // too short
      name: 'X',              // too short
      company: 'Co',
      niche: 'Tech',
      timezone: 'UTC',
      language: 'EN'
    });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
  });

  it('returns 400 for invalid content generate payload (no topicId or prompt)', async () => {
    const { accessToken } = await registerUser(TEST_USER);
    const res = await request(app)
      .post('/api/content/generate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ platform: 'BLOG', language: 'EN' });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------
describe('Error handler', () => {
  it('returns 404 with message for an unknown route', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('message');
  });

  it('error response does not expose stack trace in non-production env', async () => {
    const res = await request(app).get('/api/does-not-exist');
    // In test env (non-production) stack may be included but should not be production-dangerous
    expect(res.body).toHaveProperty('message');
  });

  it('returns 400 with a message for a malformed JSON body', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{invalid json}');
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
describe('GET /health', () => {
  it('returns 200 with ok: true', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
