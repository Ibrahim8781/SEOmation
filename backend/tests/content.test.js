/**
 * tests/content.test.js
 * POST /api/content/generate, GET /api/content, GET /api/content/:id,
 * PUT /api/content/:id, POST /api/content/:id/seo-hints
 */

import request from 'supertest';
import { describe, it, expect, beforeEach } from '@jest/globals';
import { app } from '../src/app.js';
import { TEST_USER, TEST_USER_2, registerUser, authedRequest, createContent } from './helpers.js';

let token;
let token2;

beforeEach(async () => {
  const r1 = await registerUser(TEST_USER);
  token = r1.accessToken;
  const r2 = await registerUser(TEST_USER_2);
  token2 = r2.accessToken;
});

// ---------------------------------------------------------------------------
// POST /api/content/generate
// ---------------------------------------------------------------------------
describe('POST /api/content/generate', () => {
  it('returns 201 with item and seo fields for prompt-based generation', async () => {
    const res = await authedRequest(token).post('/api/content/generate').send({
      platform: 'BLOG',
      language: 'EN',
      prompt: 'How to build a successful SaaS startup',
      focusKeyword: 'SaaS startup'
    });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('item');
    expect(res.body).toHaveProperty('seo');
    expect(res.body.item).toHaveProperty('id');
    expect(res.body.item).toHaveProperty('title');
    expect(res.body.item.platform).toBe('BLOG');
  });

  it('returns seo.score as a number between 0 and 100', async () => {
    const res = await authedRequest(token).post('/api/content/generate').send({
      platform: 'BLOG',
      language: 'EN',
      prompt: 'Content marketing strategies for B2B',
      focusKeyword: 'content marketing'
    });
    expect(res.status).toBe(201);
    expect(typeof res.body.seo.score).toBe('number');
    expect(res.body.seo.score).toBeGreaterThanOrEqual(0);
    expect(res.body.seo.score).toBeLessThanOrEqual(100);
  });

  it('returns 400 when neither topicId nor prompt provided', async () => {
    const res = await authedRequest(token).post('/api/content/generate').send({
      platform: 'BLOG',
      language: 'EN'
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when prompt provided without focusKeyword', async () => {
    const res = await authedRequest(token).post('/api/content/generate').send({
      platform: 'BLOG',
      language: 'EN',
      prompt: 'Some topic without focus keyword'
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when prompt is too short (< 5 chars)', async () => {
    const res = await authedRequest(token).post('/api/content/generate').send({
      platform: 'BLOG',
      language: 'EN',
      prompt: 'Hi',
      focusKeyword: 'hi'
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid platform', async () => {
    const res = await authedRequest(token).post('/api/content/generate').send({
      platform: 'PODCAST',
      language: 'EN',
      prompt: 'A valid prompt here',
      focusKeyword: 'podcast'
    });
    expect(res.status).toBe(400);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).post('/api/content/generate').send({
      platform: 'BLOG',
      prompt: 'Test prompt',
      focusKeyword: 'test'
    });
    expect(res.status).toBe(401);
  });

  it('saves the content to the database (verifiable via GET)', async () => {
    const createRes = await authedRequest(token).post('/api/content/generate').send({
      platform: 'BLOG',
      language: 'EN',
      prompt: 'Building an effective email marketing campaign',
      focusKeyword: 'email marketing'
    });
    expect(createRes.status).toBe(201);
    const contentId = createRes.body.item.id;

    const getRes = await authedRequest(token).get(`/api/content/${contentId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(contentId);
  });
});

// ---------------------------------------------------------------------------
// GET /api/content
// ---------------------------------------------------------------------------
describe('GET /api/content', () => {
  it('returns 200 with items array', async () => {
    const res = await authedRequest(token).get('/api/content');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('returns created content in the list', async () => {
    await createContent(token);
    const res = await authedRequest(token).get('/api/content');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  it('does NOT return another user\'s content (data isolation)', async () => {
    await createContent(token);
    const res = await authedRequest(token2).get('/api/content');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(0);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/content');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/content/:id
// ---------------------------------------------------------------------------
describe('GET /api/content/:id', () => {
  it('returns 200 with full content object for the owner', async () => {
    const content = await createContent(token);
    const res = await authedRequest(token).get(`/api/content/${content.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(content.id);
    expect(res.body).toHaveProperty('title');
    expect(res.body).toHaveProperty('platform');
  });

  it('returns 404 when another user tries to access the content', async () => {
    const content = await createContent(token);
    const res = await authedRequest(token2).get(`/api/content/${content.id}`);
    expect(res.status).toBe(404);
  });

  it('returns 404 for a non-existent content ID', async () => {
    const res = await authedRequest(token).get('/api/content/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it('returns 401 when unauthenticated', async () => {
    const content = await createContent(token);
    const res = await request(app).get(`/api/content/${content.id}`);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/content/:id
// ---------------------------------------------------------------------------
describe('PUT /api/content/:id', () => {
  it('updates the title and returns 200 with updated data', async () => {
    const content = await createContent(token);
    const res = await authedRequest(token).put(`/api/content/${content.id}`).send({
      title: 'Updated Title for Testing'
    });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated Title for Testing');
  });

  it('updates status to READY', async () => {
    const content = await createContent(token);
    const res = await authedRequest(token).put(`/api/content/${content.id}`).send({
      status: 'READY'
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('READY');
  });

  it('updates primaryKeyword', async () => {
    const content = await createContent(token);
    const res = await authedRequest(token).put(`/api/content/${content.id}`).send({
      primaryKeyword: 'updated keyword'
    });
    expect(res.status).toBe(200);
    expect(res.body.primaryKeyword).toBe('updated keyword');
  });

  it('returns 404 when another user tries to update the content', async () => {
    const content = await createContent(token);
    const res = await authedRequest(token2).put(`/api/content/${content.id}`).send({
      title: 'Hacked Title'
    });
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid status value', async () => {
    const content = await createContent(token);
    const res = await authedRequest(token).put(`/api/content/${content.id}`).send({
      status: 'INVALID_STATUS'
    });
    expect(res.status).toBe(400);
  });

  it('returns 401 when unauthenticated', async () => {
    const content = await createContent(token);
    const res = await request(app).put(`/api/content/${content.id}`).send({ title: 'X' });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/content/:id/seo-hints
// ---------------------------------------------------------------------------
describe('POST /api/content/:id/seo-hints', () => {
  it('returns 200 with score and hints for the content owner', async () => {
    const content = await createContent(token);
    const res = await authedRequest(token)
      .post(`/api/content/${content.id}/seo-hints`)
      .send({ focusKeyword: 'SaaS product' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('score');
    expect(res.body).toHaveProperty('hints');
    expect(typeof res.body.score).toBe('number');
    expect(Array.isArray(res.body.hints)).toBe(true);
  });

  it('returns the contentId and focusKeyword in the response', async () => {
    const content = await createContent(token);
    const res = await authedRequest(token)
      .post(`/api/content/${content.id}/seo-hints`)
      .send({ focusKeyword: 'SaaS product' });

    expect(res.body.contentId).toBe(content.id);
    expect(res.body.focusKeyword).toBe('SaaS product');
  });

  it('returns 400 when focusKeyword is missing', async () => {
    const content = await createContent(token);
    const res = await authedRequest(token)
      .post(`/api/content/${content.id}/seo-hints`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 when another user tries to get SEO hints', async () => {
    const content = await createContent(token);
    const res = await authedRequest(token2)
      .post(`/api/content/${content.id}/seo-hints`)
      .send({ focusKeyword: 'keyword' });
    expect(res.status).toBe(404);
  });

  it('returns 401 when unauthenticated', async () => {
    const content = await createContent(token);
    const res = await request(app)
      .post(`/api/content/${content.id}/seo-hints`)
      .send({ focusKeyword: 'test' });
    expect(res.status).toBe(401);
  });
});
