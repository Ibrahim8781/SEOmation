/**
 * tests/auth.test.js
 * POST /api/auth/register, login, refresh, logout
 */

import request from 'supertest';
import { describe, it, expect } from '@jest/globals';
import { app } from '../src/app.js';
import { TEST_USER, registerUser, loginUser } from './helpers.js';

const api = (path) => request(app).post(path);

// ---------------------------------------------------------------------------
// REGISTER
// ---------------------------------------------------------------------------
describe('POST /api/auth/register', () => {
  it('returns 201 + accessToken + refreshToken for valid payload', async () => {
    const res = await api('/api/auth/register').send(TEST_USER);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.user.email).toBe(TEST_USER.email);
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('returns 409 when email already registered', async () => {
    await registerUser(TEST_USER);
    const res = await api('/api/auth/register').send(TEST_USER);
    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('message');
  });

  it('returns 400 when email is missing', async () => {
    const { email: _email, ...rest } = TEST_USER;
    const res = await api('/api/auth/register').send(rest);
    expect(res.status).toBe(400);
  });

  it('returns 400 when password is too short (< 8 chars)', async () => {
    const res = await api('/api/auth/register').send({ ...TEST_USER, password: 'short' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when name is missing', async () => {
    const { name: _name, ...rest } = TEST_USER;
    const res = await api('/api/auth/register').send(rest);
    expect(res.status).toBe(400);
  });

  it('returns 400 when language is not a supported enum value', async () => {
    const res = await api('/api/auth/register').send({ ...TEST_USER, language: 'KLINGON' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when niche is missing', async () => {
    const { niche: _niche, ...rest } = TEST_USER;
    const res = await api('/api/auth/register').send(rest);
    expect(res.status).toBe(400);
  });

  it('returns 400 when company is missing', async () => {
    const { company: _company, ...rest } = TEST_USER;
    const res = await api('/api/auth/register').send(rest);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// LOGIN
// ---------------------------------------------------------------------------
describe('POST /api/auth/login', () => {
  it('returns 200 + tokens for correct credentials', async () => {
    await registerUser(TEST_USER);
    const res = await api('/api/auth/login').send({
      email: TEST_USER.email,
      password: TEST_USER.password
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.user.email).toBe(TEST_USER.email);
  });

  it('returns 401 for wrong password', async () => {
    await registerUser(TEST_USER);
    const res = await api('/api/auth/login').send({
      email: TEST_USER.email,
      password: 'WrongPassword!'
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 for unknown email', async () => {
    const res = await api('/api/auth/login').send({
      email: 'nobody@seomation.dev',
      password: 'SomePassword123'
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 when email is missing', async () => {
    const res = await api('/api/auth/login').send({ password: TEST_USER.password });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// REFRESH
// ---------------------------------------------------------------------------
describe('POST /api/auth/refresh', () => {
  it('returns 200 + new tokens for valid refresh token', async () => {
    const { refreshToken } = await registerUser(TEST_USER);
    const res = await api('/api/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
  });

  it('issues a different access token than the original', async () => {
    const { accessToken: original, refreshToken } = await registerUser(TEST_USER);
    // Wait >1s so the new token has a different iat (JWT timestamps are second-level)
    await new Promise(r => setTimeout(r, 1100));
    const res = await api('/api/auth/refresh').send({ refreshToken });
    expect(res.body.accessToken).not.toBe(original);
  });

  it('returns 401 for an invalid/garbage refresh token', async () => {
    const res = await api('/api/auth/refresh').send({ refreshToken: 'this.is.garbage' });
    expect(res.status).toBe(401);
  });

  it('returns 401 when reusing a revoked refresh token (rotation)', async () => {
    const { refreshToken: original } = await registerUser(TEST_USER);
    // First refresh — rotates the token (revokes original in DB)
    await api('/api/auth/refresh').send({ refreshToken: original });
    // Brief pause to ensure DB write is visible to the next connection in the pool
    await new Promise(r => setTimeout(r, 200));
    // Attempt to use the old token again — must fail
    const res = await api('/api/auth/refresh').send({ refreshToken: original });
    expect(res.status).toBe(401);
  });

  it('returns 400 when refreshToken field is missing', async () => {
    const res = await api('/api/auth/refresh').send({});
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// LOGOUT
// ---------------------------------------------------------------------------
describe('POST /api/auth/logout', () => {
  it('returns 204 and revokes the refresh token', async () => {
    const { refreshToken } = await registerUser(TEST_USER);
    const logoutRes = await api('/api/auth/logout').send({ refreshToken });
    expect(logoutRes.status).toBe(204);

    // Subsequent refresh with same token must fail
    const refreshRes = await api('/api/auth/refresh').send({ refreshToken });
    expect(refreshRes.status).toBe(401);
  });

  it('returns 204 even for an unknown/already-revoked token (idempotent)', async () => {
    const { refreshToken } = await registerUser(TEST_USER);
    await api('/api/auth/logout').send({ refreshToken });
    const res = await api('/api/auth/logout').send({ refreshToken });
    expect(res.status).toBe(204);
  });
});
