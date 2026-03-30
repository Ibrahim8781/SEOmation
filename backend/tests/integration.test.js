/**
 * tests/integration.test.js
 * GET /api/integrations
 * GET /api/integrations/:platform/auth-url
 * POST /api/integrations/wordpress/site
 * DELETE /api/integrations/:platform
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
// GET /api/integrations
// ---------------------------------------------------------------------------
describe('GET /api/integrations', () => {
  it('returns 200 with an empty array for a new user', async () => {
    const res = await authedRequest(token).get('/api/integrations');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBe(0);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/integrations');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/integrations/:platform/auth-url
// ---------------------------------------------------------------------------
describe('GET /api/integrations/:platform/auth-url', () => {
  it('returns 200 with a URL for wordpress', async () => {
    const res = await authedRequest(token).get('/api/integrations/wordpress/auth-url');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('url');
    expect(typeof res.body.url).toBe('string');
    expect(res.body.url.length).toBeGreaterThan(0);
  });

  it('returns 200 with a URL for linkedin', async () => {
    const res = await authedRequest(token).get('/api/integrations/linkedin/auth-url');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('url');
  });

  it('returns 400 for an unsupported platform', async () => {
    const res = await authedRequest(token).get('/api/integrations/tiktok/auth-url');
    expect(res.status).toBe(400);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/integrations/wordpress/auth-url');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/integrations/wordpress/site
// ---------------------------------------------------------------------------
describe('POST /api/integrations/wordpress/site', () => {
  it('returns 400 for a missing siteUrl', async () => {
    const res = await authedRequest(token).post('/api/integrations/wordpress/site').send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid URL format', async () => {
    const res = await authedRequest(token)
      .post('/api/integrations/wordpress/site')
      .send({ siteUrl: 'not-a-url' });
    expect(res.status).toBe(400);
  });

  it('accepts a valid HTTPS site URL', async () => {
    const res = await authedRequest(token)
      .post('/api/integrations/wordpress/site')
      .send({ siteUrl: 'https://myblog.wordpress.com' });
    // Should be 200 (stored) or 404 if no integration exists yet; must not 500
    expect(res.status).not.toBe(500);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app)
      .post('/api/integrations/wordpress/site')
      .send({ siteUrl: 'https://test.wordpress.com' });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/integrations/:platform
// ---------------------------------------------------------------------------
describe('DELETE /api/integrations/:platform', () => {
  it('returns 204 when trying to remove a non-existent integration (idempotent)', async () => {
    const res = await authedRequest(token).delete('/api/integrations/wordpress');
    expect(res.status).toBe(204);
  });

  it('returns 400 for an unsupported platform', async () => {
    const res = await authedRequest(token).delete('/api/integrations/tiktok');
    expect(res.status).toBe(400);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).delete('/api/integrations/wordpress');
    expect(res.status).toBe(401);
  });
});
