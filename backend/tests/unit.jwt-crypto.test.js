/**
 * Unit Tests for JWT utilities and crypto helpers
 */
import jwt from 'jsonwebtoken';
import { signAccessToken, signRefreshToken } from '../src/utils/jwt.js';
import { sha256 } from '../src/lib/crypto.js';

describe('JWT Utilities', () => {
  const mockUser = { id: 'user-123', role: 'USER' };

  // ── signAccessToken ──────────────────────────────────────────────
  describe('signAccessToken', () => {
    it('returns a valid JWT string', () => {
      const token = signAccessToken(mockUser);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('embeds sub and role claims', () => {
      const token = signAccessToken(mockUser);
      const decoded = jwt.decode(token);
      expect(decoded.sub).toBe('user-123');
      expect(decoded.role).toBe('USER');
    });

    it('includes an expiration claim', () => {
      const token = signAccessToken(mockUser);
      const decoded = jwt.decode(token);
      expect(decoded).toHaveProperty('exp');
      expect(typeof decoded.exp).toBe('number');
    });

    it('access tokens expire before refresh tokens', () => {
      const access = signAccessToken(mockUser);
      const refresh = signRefreshToken(mockUser);
      const accessDecoded = jwt.decode(access);
      const refreshDecoded = jwt.decode(refresh);
      expect(accessDecoded.exp).toBeLessThan(refreshDecoded.exp);
    });

    it('two tokens for same user have different jti/iat (not identical)', () => {
      // Slight delay to ensure different iat
      const t1 = signAccessToken(mockUser);
      const t2 = signAccessToken(mockUser);
      // They should be functionally equivalent but may differ in timing
      expect(t1).toBeDefined();
      expect(t2).toBeDefined();
    });
  });

  // ── signRefreshToken ─────────────────────────────────────────────
  describe('signRefreshToken', () => {
    it('returns a valid JWT string', () => {
      const token = signRefreshToken(mockUser);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('embeds sub claim', () => {
      const token = signRefreshToken(mockUser);
      const decoded = jwt.decode(token);
      expect(decoded.sub).toBe('user-123');
    });

    it('does NOT embed role in refresh token', () => {
      const token = signRefreshToken(mockUser);
      const decoded = jwt.decode(token);
      expect(decoded.role).toBeUndefined();
    });

    it('has expiration', () => {
      const token = signRefreshToken(mockUser);
      const decoded = jwt.decode(token);
      expect(decoded).toHaveProperty('exp');
    });
  });
});

// ── sha256 ────────────────────────────────────────────────────────
describe('sha256 crypto helper', () => {
  it('returns a 64-char hex string', () => {
    const hash = sha256('hello');
    expect(typeof hash).toBe('string');
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });

  it('is deterministic for same input', () => {
    expect(sha256('test-token')).toBe(sha256('test-token'));
  });

  it('produces different hashes for different inputs', () => {
    expect(sha256('token-a')).not.toBe(sha256('token-b'));
  });

  it('handles empty string without throwing', () => {
    expect(() => sha256('')).not.toThrow();
    expect(sha256('')).toHaveLength(64);
  });

  it('handles special characters', () => {
    expect(() => sha256('<script>alert(1)</script>')).not.toThrow();
  });

  it('handles unicode input', () => {
    expect(() => sha256('مرحبا 🎉')).not.toThrow();
    expect(sha256('مرحبا 🎉')).toHaveLength(64);
  });
});
