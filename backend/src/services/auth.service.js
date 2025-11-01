// src/services/auth.service.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { signAccessToken, signRefreshToken } from '../utils/jwt.js';
import { config } from '../config/index.js';
import { sha256 } from '../lib/crypto.js';
import ApiError from '../utils/ApiError.js';

const REFRESH_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

async function issueTokens(user, meta = {}) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  const tokenHash = sha256(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

  await prisma.refreshToken.create({
    data: {
      tokenHash,
      userId: user.id,
      expiresAt,
      userAgent: meta?.userAgent || null,
      ip: meta?.ip || null
    }
  });

  return { accessToken, refreshToken };
}

async function register(data) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new ApiError(409, 'Email already in use');

  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
      name: data.name,
      role: data.role || 'USER',
      company: data.company,
      niche: data.niche,
      timezone: data.timezone,
      language: data.language
    }
  });

  const tokens = await issueTokens(user, null);
  return { user, ...tokens };
}

async function login({ email, password }, meta = {}) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new ApiError(401, 'Invalid credentials');
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new ApiError(401, 'Invalid credentials');

  const tokens = await issueTokens(user, meta);
  return { user, ...tokens };
}

async function refresh(refreshToken, meta = {}) {
  try {
    const payload = jwt.verify(refreshToken, config.jwt.refreshSecret);
    const tokenHash = sha256(refreshToken);
    const stored = await prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null }
    });
    if (!stored || stored.expiresAt < new Date()) throw new Error('Expired/invalid');
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new Error('User missing');

    // Revoke old token and issue new (rotation)
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    const tokens = await issueTokens(user, meta);
    return { user, ...tokens };
  } catch (_e) {
    throw new ApiError(401, 'Invalid refresh token');
  }
}

async function logout(refreshToken) {
  const tokenHash = sha256(refreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() }
  });
}

export const AuthService = {
  register,
  login,
  issueTokens, // exported primarily for tests; keep if you rely on it
  refresh,
  logout
};

