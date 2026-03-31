/**
 * tests/image.test.js
 * GET /api/content/:id/images
 * POST /api/content/:id/images/generate
 * DELETE /api/content/:id/images/:linkId
 */

import request from 'supertest';
import { describe, it, expect, beforeEach } from '@jest/globals';
import { app } from '../src/app.js';
import { TEST_USER, TEST_USER_2, registerUser, authedRequest, createContent } from './helpers.js';

let token;
let token2;
let content;

beforeEach(async () => {
  const r1 = await registerUser(TEST_USER);
  token = r1.accessToken;
  const r2 = await registerUser(TEST_USER_2);
  token2 = r2.accessToken;
  content = await createContent(token);
});

// ---------------------------------------------------------------------------
// GET /api/content/:id/images
// ---------------------------------------------------------------------------
describe('GET /api/content/:id/images', () => {
  it('returns 200 with an empty items array for new content', async () => {
    const res = await authedRequest(token).get(`/api/content/${content.id}/images`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get(`/api/content/${content.id}/images`);
    expect(res.status).toBe(401);
  });

  it('returns 404 for another user\'s content', async () => {
    const res = await authedRequest(token2).get(`/api/content/${content.id}/images`);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /api/content/:id/images/generate
// ---------------------------------------------------------------------------
describe('POST /api/content/:id/images/generate', () => {
  it('returns 201 with results array (mock provider)', async () => {
    const res = await authedRequest(token)
      .post(`/api/content/${content.id}/images/generate`)
      .send({ prompt: 'A futuristic SaaS dashboard' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('results');
    expect(Array.isArray(res.body.results)).toBe(true);
  });

  it('response includes content object', async () => {
    const res = await authedRequest(token)
      .post(`/api/content/${content.id}/images/generate`)
      .send({ prompt: 'A professional business photo' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('content');
  });

  it('images are stored and retrievable via GET', async () => {
    await authedRequest(token)
      .post(`/api/content/${content.id}/images/generate`)
      .send({ prompt: 'AI technology abstract' });

    const listRes = await authedRequest(token).get(`/api/content/${content.id}/images`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.items.length).toBeGreaterThan(0);
  });

  it('returns 400 when prompt is missing', async () => {
    const res = await authedRequest(token)
      .post(`/api/content/${content.id}/images/generate`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 for another user\'s content', async () => {
    const res = await authedRequest(token2)
      .post(`/api/content/${content.id}/images/generate`)
      .send({ prompt: 'Test image' });
    expect(res.status).toBe(404);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app)
      .post(`/api/content/${content.id}/images/generate`)
      .send({ prompt: 'Test image' });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/content/:id/images/:linkId
// ---------------------------------------------------------------------------
describe('DELETE /api/content/:id/images/:linkId', () => {
  it('removes an image link and returns 200', async () => {
    // Generate an image first
    const genRes = await authedRequest(token)
      .post(`/api/content/${content.id}/images/generate`)
      .send({ prompt: 'Technology concept image' });
    expect(genRes.status).toBe(201);

    // Get the link ID from the list (response shape: { items: [...] })
    const listRes = await authedRequest(token).get(`/api/content/${content.id}/images`);
    const first = listRes.body.items[0];
    const linkId = first?.linkId || first?.id;
    expect(linkId).toBeDefined();

    // Delete the link
    const delRes = await authedRequest(token).delete(`/api/content/${content.id}/images/${linkId}`);
    expect(delRes.status).toBe(200);

    // Verify it's gone
    const afterRes = await authedRequest(token).get(`/api/content/${content.id}/images`);
    expect(afterRes.body.items.length).toBe(0);
  });

  it('returns 404 for another user trying to delete an image link', async () => {
    const genRes = await authedRequest(token)
      .post(`/api/content/${content.id}/images/generate`)
      .send({ prompt: 'Test image for deletion' });
    const listRes = await authedRequest(token).get(`/api/content/${content.id}/images`);
    const first = listRes.body.items[0];
    const linkId = first?.linkId || first?.id;

    if (genRes.status === 201 && linkId) {
      const res = await authedRequest(token2).delete(`/api/content/${content.id}/images/${linkId}`);
      expect(res.status).toBe(404);
    }
  });

  it('returns 404 for a non-existent link ID', async () => {
    const res = await authedRequest(token).delete(
      `/api/content/${content.id}/images/00000000-0000-0000-0000-000000000000`
    );
    expect(res.status).toBe(404);
  });
});
