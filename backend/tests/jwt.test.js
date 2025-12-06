import { describe, it, expect, beforeAll } from '@jest/globals';
import jwt from 'jsonwebtoken';

describe('JWT Utils', () => {
  const mockSecret = 'test-jwt-secret';
  const mockRefreshSecret = 'test-refresh-secret';

  beforeAll(() => {
    process.env.JWT_SECRET = mockSecret;
    process.env.JWT_REFRESH_SECRET = mockRefreshSecret;
  });

  describe('Access Token', () => {
    it('should generate a valid access token', () => {
      const payload = { sub: 'user-123', email: 'test@example.com' };
      const token = jwt.sign(payload, mockSecret, { expiresIn: '15m' });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should verify and decode a valid access token', () => {
      const payload = { sub: 'user-123', email: 'test@example.com' };
      const token = jwt.sign(payload, mockSecret, { expiresIn: '15m' });

      const decoded = jwt.verify(token, mockSecret);

      expect(decoded.sub).toBe('user-123');
      expect(decoded.email).toBe('test@example.com');
      expect(decoded).toHaveProperty('iat');
      expect(decoded).toHaveProperty('exp');
    });

    it('should throw error for invalid token', () => {
      const invalidToken = 'invalid.token.here';

      expect(() => {
        jwt.verify(invalidToken, mockSecret);
      }).toThrow();
    });

    it('should throw error for expired token', () => {
      const payload = { sub: 'user-123' };
      const expiredToken = jwt.sign(payload, mockSecret, { expiresIn: '0s' });

      // Wait a tiny bit to ensure expiration
      return new Promise(resolve => setTimeout(resolve, 100)).then(() => {
        expect(() => {
          jwt.verify(expiredToken, mockSecret);
        }).toThrow(/expired/);
      });
    });
  });

  describe('Refresh Token', () => {
    it('should generate a valid refresh token with longer expiry', () => {
      const payload = { sub: 'user-123' };
      const token = jwt.sign(payload, mockRefreshSecret, { expiresIn: '7d' });

      expect(token).toBeDefined();
      
      const decoded = jwt.verify(token, mockRefreshSecret);
      expect(decoded.sub).toBe('user-123');
      
      // Check that expiry is far in future (7 days = 604800 seconds)
      const expiryDuration = decoded.exp - decoded.iat;
      expect(expiryDuration).toBe(604800);
    });

    it('should verify refresh token with correct secret', () => {
      const payload = { sub: 'user-456' };
      const token = jwt.sign(payload, mockRefreshSecret, { expiresIn: '7d' });

      const decoded = jwt.verify(token, mockRefreshSecret);

      expect(decoded.sub).toBe('user-456');
    });

    it('should fail to verify refresh token with wrong secret', () => {
      const payload = { sub: 'user-789' };
      const token = jwt.sign(payload, mockRefreshSecret, { expiresIn: '7d' });

      expect(() => {
        jwt.verify(token, 'wrong-secret');
      }).toThrow();
    });
  });

  describe('Token Payload', () => {
    it('should include custom claims in token', () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'ADMIN',
        permissions: ['read', 'write']
      };

      const token = jwt.sign(payload, mockSecret, { expiresIn: '15m' });
      const decoded = jwt.verify(token, mockSecret);

      expect(decoded.role).toBe('ADMIN');
      expect(decoded.permissions).toEqual(['read', 'write']);
    });
  });
});