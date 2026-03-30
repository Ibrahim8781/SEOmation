/**
 * tests/user.test.js
 * GET /api/users/me, PUT /api/users/me
 */

import request from 'supertest';
import { describe, it, expect, beforeEach } from '@jest/globals';
import { app } from '../src/app.js';
import { TEST_USER, registerUser, authedRequest } from './helpers.js';

let token;

beforeEach(async () => {
  const { accessToken } = await registerUser(TEST_USER);
  token = accessToken;
});

// ---------------------------------------------------------------------------
// GET /api/users/me
// ---------------------------------------------------------------------------
describe('GET /api/users/me', () => {
  it('returns 200 + user object for authenticated user', async () => {
    const res = await authedRequest(token).get('/api/users/me');
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(TEST_USER.email);
    expect(res.body.name).toBe(TEST_USER.name);
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with a malformed token', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer not.a.valid.jwt');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/users/me
// ---------------------------------------------------------------------------
describe('PUT /api/users/me', () => {
  it('updates company field and returns 200 with updated data', async () => {
    const res = await authedRequest(token).put('/api/users/me').send({ company: 'Updated Corp' });
    expect(res.status).toBe(200);
    expect(res.body.company).toBe('Updated Corp');
  });

  it('updates niche field', async () => {
    const res = await authedRequest(token).put('/api/users/me').send({ niche: 'AI/ML' });
    expect(res.status).toBe(200);
    expect(res.body.niche).toBe('AI/ML');
  });

  it('updates preferences object', async () => {
    const preferences = { defaultLanguage: 'en' };
    const res = await authedRequest(token).put('/api/users/me').send({ preferences });
    expect(res.status).toBe(200);
  });

  it('updates tone field', async () => {
    const res = await authedRequest(token).put('/api/users/me').send({ tone: 'professional' });
    expect(res.status).toBe(200);
    expect(res.body.tone).toBe('professional');
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(app).put('/api/users/me').send({ company: 'Hack Corp' });
    expect(res.status).toBe(401);
  });

  it('ignores unknown fields (no error)', async () => {
    const res = await authedRequest(token).put('/api/users/me').send({ unknownField: 'xyz' });
    // Should not crash — either 200 with unchanged data or validation strips the field
    expect(res.status).toBeLessThan(500);
  });
});
