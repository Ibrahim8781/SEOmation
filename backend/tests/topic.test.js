/**
 * tests/topic.test.js
 * POST /api/topics/generate, GET /api/topics
 * AI_MOCK=true so FastAPI is not required.
 */

import request from 'supertest';
import { describe, it, expect, beforeEach } from '@jest/globals';
import { app } from '../src/app.js';
import { TEST_USER, TEST_USER_2, registerUser, authedRequest } from './helpers.js';

let token;
let token2;

beforeEach(async () => {
  const r1 = await registerUser(TEST_USER);
  token = r1.accessToken;
  const r2 = await registerUser(TEST_USER_2);
  token2 = r2.accessToken;
});

// ---------------------------------------------------------------------------
// POST /api/topics/generate
// ---------------------------------------------------------------------------
describe('POST /api/topics/generate', () => {
  it('returns 201 and a non-empty topics list for valid payload', async () => {
    const res = await authedRequest(token).post('/api/topics/generate').send({
      platform: 'BLOG',
      language: 'EN'
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  it('each topic item has title, platform, language fields', async () => {
    const res = await authedRequest(token).post('/api/topics/generate').send({
      platform: 'BLOG',
      language: 'EN'
    });
    const topic = res.body.items[0];
    expect(topic).toHaveProperty('title');
    expect(typeof topic.title).toBe('string');
    expect(topic.title.length).toBeGreaterThan(0);
    expect(topic).toHaveProperty('platform');
    expect(topic).toHaveProperty('language');
  });

  it('works for LINKEDIN platform', async () => {
    const res = await authedRequest(token).post('/api/topics/generate').send({
      platform: 'LINKEDIN',
      language: 'EN'
    });
    expect(res.status).toBe(201);
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  it('works for INSTAGRAM platform', async () => {
    const res = await authedRequest(token).post('/api/topics/generate').send({
      platform: 'INSTAGRAM',
      language: 'EN'
    });
    expect(res.status).toBe(201);
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  it('accepts optional context.niche', async () => {
    const res = await authedRequest(token).post('/api/topics/generate').send({
      platform: 'BLOG',
      language: 'EN',
      context: { niche: 'fintech', count: 3 }
    });
    expect(res.status).toBe(201);
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  it('returns 400 when platform is missing', async () => {
    const res = await authedRequest(token).post('/api/topics/generate').send({
      language: 'EN'
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid platform value', async () => {
    const res = await authedRequest(token).post('/api/topics/generate').send({
      platform: 'TIKTOK',
      language: 'EN'
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for unsupported language', async () => {
    const res = await authedRequest(token).post('/api/topics/generate').send({
      platform: 'BLOG',
      language: 'XX'
    });
    expect(res.status).toBe(400);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).post('/api/topics/generate').send({
      platform: 'BLOG',
      language: 'EN'
    });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/topics
// ---------------------------------------------------------------------------
describe('GET /api/topics', () => {
  it('returns 200 with an items array', async () => {
    const res = await authedRequest(token).get('/api/topics');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('returns topics created by the current user', async () => {
    // Generate topics for user 1 (returns 201)
    await authedRequest(token).post('/api/topics/generate').send({ platform: 'BLOG', language: 'EN' });

    const res = await authedRequest(token).get('/api/topics');
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  it('does NOT return topics belonging to another user (data isolation)', async () => {
    // User 1 generates topics
    await authedRequest(token).post('/api/topics/generate').send({ platform: 'BLOG', language: 'EN' });

    // User 2 should see an empty list
    const res = await authedRequest(token2).get('/api/topics');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(0);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/topics');
    expect(res.status).toBe(401);
  });
});
