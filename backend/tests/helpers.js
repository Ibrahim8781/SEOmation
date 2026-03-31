/**
 * tests/helpers.js
 * Shared utilities for all test files.
 */

import request from 'supertest';
import { app } from '../src/app.js';

// ---------------------------------------------------------------------------
// Default test user fixture
// ---------------------------------------------------------------------------
export const TEST_USER = {
  email: 'test@seomation.dev',
  password: 'TestPass123!',
  name: 'Test User',
  company: 'SEOmation Inc.',
  niche: 'SaaS technology',
  timezone: 'UTC',
  language: 'EN'
};

export const TEST_USER_2 = {
  email: 'other@seomation.dev',
  password: 'OtherPass456!',
  name: 'Other User',
  company: 'Other Corp',
  niche: 'E-commerce',
  timezone: 'UTC',
  language: 'EN'
};

// ---------------------------------------------------------------------------
// Register + login helpers
// ---------------------------------------------------------------------------

/** Register a user and return { user, accessToken, refreshToken } */
export async function registerUser(userData = TEST_USER) {
  const res = await request(app).post('/api/auth/register').send(userData);
  if (res.status !== 201) {
    throw new Error(`registerUser failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body; // { user, accessToken, refreshToken }
}

/** Login a user and return { user, accessToken, refreshToken } */
export async function loginUser(credentials = { email: TEST_USER.email, password: TEST_USER.password }) {
  const res = await request(app).post('/api/auth/login').send(credentials);
  if (res.status !== 200) {
    throw new Error(`loginUser failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

/** Register then return the accessToken string */
export async function getAccessToken(userData = TEST_USER) {
  const { accessToken } = await registerUser(userData);
  return accessToken;
}

/** Return a supertest agent with Authorization header pre-set */
export function authedRequest(accessToken) {
  return {
    get: (url) => request(app).get(url).set('Authorization', `Bearer ${accessToken}`),
    post: (url) => request(app).post(url).set('Authorization', `Bearer ${accessToken}`),
    put: (url) => request(app).put(url).set('Authorization', `Bearer ${accessToken}`),
    delete: (url) => request(app).delete(url).set('Authorization', `Bearer ${accessToken}`)
  };
}

// ---------------------------------------------------------------------------
// DB seeding helpers (via API so auth tokens are correct)
// ---------------------------------------------------------------------------

/** Create a content draft via the API and return the content item */
export async function createContent(accessToken, overrides = {}) {
  const payload = {
    platform: 'BLOG',
    language: 'EN',
    prompt: 'How to build a SaaS product from scratch',
    focusKeyword: 'SaaS product',
    ...overrides
  };
  const res = await request(app)
    .post('/api/content/generate')
    .set('Authorization', `Bearer ${accessToken}`)
    .send(payload);
  if (res.status !== 201) {
    throw new Error(`createContent failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.item;
}
