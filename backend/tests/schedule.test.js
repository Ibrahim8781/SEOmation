/**
 * tests/schedule.test.js
 * GET /api/schedule, GET /api/schedule/stats
 * POST /api/schedule/content/:id/schedule
 * POST /api/schedule/:jobId/cancel
 *
 * Note: publishNow and schedule require a real PlatformIntegration to exist,
 * which requires a full OAuth flow. Those paths are covered in manual testing.
 * Here we test: list, stats, validation, and auth guards.
 */

import request from 'supertest';
import { describe, it, expect, beforeEach } from '@jest/globals';
import { app } from '../src/app.js';
import { TEST_USER, registerUser, authedRequest, createContent } from './helpers.js';

let token;
let content;

beforeEach(async () => {
  const { accessToken } = await registerUser(TEST_USER);
  token = accessToken;
  content = await createContent(token);
});

// ---------------------------------------------------------------------------
// GET /api/schedule
// ---------------------------------------------------------------------------
describe('GET /api/schedule', () => {
  it('returns 200 with an empty items array for a new user', async () => {
    const res = await authedRequest(token).get('/api/schedule');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBe(0);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/schedule');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/schedule/stats
// ---------------------------------------------------------------------------
describe('GET /api/schedule/stats', () => {
  it('returns 200 with stats object', async () => {
    const res = await authedRequest(token).get('/api/schedule/stats');
    expect(res.status).toBe(200);
    // Stats should be an object with at least one field (e.g. activeJobs, total, etc.)
    expect(typeof res.body).toBe('object');
    expect(res.body).not.toBeNull();
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/schedule/stats');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/schedule/content/:id/schedule — validation tests
// ---------------------------------------------------------------------------
describe('POST /api/schedule/content/:id/schedule (validation)', () => {
  it('returns 400 when integrationId is missing', async () => {
    const res = await authedRequest(token)
      .post(`/api/schedule/content/${content.id}/schedule`)
      .send({
        platform: 'WORDPRESS',
        scheduledTime: '2027-01-01T10:00'
      });
    expect(res.status).toBe(400);
  });

  it('returns 400 when scheduledTime has wrong format', async () => {
    const res = await authedRequest(token)
      .post(`/api/schedule/content/${content.id}/schedule`)
      .send({
        integrationId: '00000000-0000-0000-0000-000000000001',
        platform: 'WORDPRESS',
        scheduledTime: '01/01/2027 10:00 AM'  // Wrong format — must be datetime-local
      });
    expect(res.status).toBe(400);
  });

  it('returns 400 when platform is invalid', async () => {
    const res = await authedRequest(token)
      .post(`/api/schedule/content/${content.id}/schedule`)
      .send({
        integrationId: '00000000-0000-0000-0000-000000000001',
        platform: 'TIKTOK',
        scheduledTime: '2027-01-01T10:00'
      });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid timezone', async () => {
    const res = await authedRequest(token)
      .post(`/api/schedule/content/${content.id}/schedule`)
      .send({
        integrationId: '00000000-0000-0000-0000-000000000001',
        platform: 'WORDPRESS',
        scheduledTime: '2027-01-01T10:00',
        timezone: 'Not/ATimezone'
      });
    expect(res.status).toBe(400);
  });

  it('returns 404 when integrationId does not belong to user', async () => {
    const res = await authedRequest(token)
      .post(`/api/schedule/content/${content.id}/schedule`)
      .send({
        integrationId: '00000000-0000-0000-0000-000000000099',
        platform: 'WORDPRESS',
        scheduledTime: '2027-01-01T10:00',
        timezone: 'UTC'
      });
    // Integration not found → 404 or 400
    expect([400, 404]).toContain(res.status);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app)
      .post(`/api/schedule/content/${content.id}/schedule`)
      .send({
        integrationId: '00000000-0000-0000-0000-000000000001',
        platform: 'WORDPRESS',
        scheduledTime: '2027-01-01T10:00'
      });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/schedule/:jobId/cancel — validation
// ---------------------------------------------------------------------------
describe('POST /api/schedule/:jobId/cancel', () => {
  it('returns 404 for a non-existent job ID', async () => {
    const res = await authedRequest(token).post(
      '/api/schedule/00000000-0000-0000-0000-000000000000/cancel'
    );
    expect(res.status).toBe(404);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).post(
      '/api/schedule/00000000-0000-0000-0000-000000000000/cancel'
    );
    expect(res.status).toBe(401);
  });
});
