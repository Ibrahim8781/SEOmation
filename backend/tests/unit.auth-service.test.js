/**
 * Unit Tests for Auth Service (mocked Prisma + bcrypt)
 * Tests: register, login, refresh, logout, issueTokens
 */
import { jest } from '@jest/globals';

// ── Mocks ────────────────────────────────────────────────────────────
const userFindUniqueMock = jest.fn();
const userCreateMock = jest.fn();
const refreshTokenCreateMock = jest.fn();
const refreshTokenFindFirstMock = jest.fn();
const refreshTokenUpdateMock = jest.fn();
const refreshTokenUpdateManyMock = jest.fn();

jest.unstable_mockModule('../src/lib/prisma.js', () => ({
  prisma: {
    user: { findUnique: userFindUniqueMock, create: userCreateMock },
    refreshToken: {
      create: refreshTokenCreateMock,
      findFirst: refreshTokenFindFirstMock,
      update: refreshTokenUpdateMock,
      updateMany: refreshTokenUpdateManyMock
    }
  }
}));

const { AuthService } = await import('../src/services/auth.service.js');

// ── Helpers ───────────────────────────────────────────────────────────
const fakeUser = {
  id: 'user-uuid-1',
  email: 'test@example.com',
  passwordHash: '$2a$12$K9WB78Qu6Y4d3Fk7nOqsYuX6iK3pxXvJRH5eR9dz0lF1.aOV9yMqO', // "Correct1!"
  role: 'USER',
  name: 'Test User'
};

describe('AuthService Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    refreshTokenCreateMock.mockResolvedValue({});
  });

  // ── register ─────────────────────────────────────────────────────
  describe('register', () => {
    const validData = {
      email: 'new@example.com',
      password: 'SecurePass1!',
      name: 'New User',
      company: 'Co',
      niche: 'Tech',
      timezone: 'UTC',
      language: 'EN'
    };

    it('creates a new user when email is not taken', async () => {
      userFindUniqueMock.mockResolvedValue(null);
      const createdUser = { ...fakeUser, email: validData.email };
      userCreateMock.mockResolvedValue(createdUser);

      const result = await AuthService.register(validData);

      expect(userFindUniqueMock).toHaveBeenCalledWith({ where: { email: validData.email } });
      expect(userCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: validData.email })
        })
      );
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('throws 409 ApiError when email is already in use', async () => {
      userFindUniqueMock.mockResolvedValue(fakeUser);

      await expect(AuthService.register(validData)).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringContaining('Email already in use')
      });
      expect(userCreateMock).not.toHaveBeenCalled();
    });

    it('hashes password before storing (does not store plaintext)', async () => {
      userFindUniqueMock.mockResolvedValue(null);
      userCreateMock.mockResolvedValue({ ...fakeUser });
      let storedHash = null;
      userCreateMock.mockImplementation(async ({ data }) => {
        storedHash = data.passwordHash;
        return { ...fakeUser };
      });

      await AuthService.register(validData);
      expect(storedHash).toBeTruthy();
      expect(storedHash).not.toBe(validData.password);
      expect(storedHash.startsWith('$2')).toBe(true); // bcrypt prefix
    });

    it('defaults role to USER when not provided', async () => {
      userFindUniqueMock.mockResolvedValue(null);
      let capturedData = null;
      userCreateMock.mockImplementation(async ({ data }) => {
        capturedData = data;
        return { ...fakeUser, role: 'USER' };
      });

      await AuthService.register(validData);
      expect(capturedData.role).toBe('USER');
    });
  });

  // ── login ─────────────────────────────────────────────────────────
  describe('login', () => {
    it('returns tokens for valid credentials', async () => {
      // Use a real bcrypt hash for "TestPassword1"
      const bcrypt = await import('bcryptjs');
      const hash = await bcrypt.default.hash('TestPassword1', 12);
      userFindUniqueMock.mockResolvedValue({ ...fakeUser, passwordHash: hash });

      const result = await AuthService.login({ email: fakeUser.email, password: 'TestPassword1' });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe(fakeUser.email);
    });

    it('throws 401 for non-existent user', async () => {
      userFindUniqueMock.mockResolvedValue(null);

      await expect(
        AuthService.login({ email: 'ghost@example.com', password: 'AnyPass1!' })
      ).rejects.toMatchObject({ statusCode: 401, message: 'Invalid credentials' });
    });

    it('throws 401 for wrong password', async () => {
      const bcrypt = await import('bcryptjs');
      const hash = await bcrypt.default.hash('CorrectPass1', 12);
      userFindUniqueMock.mockResolvedValue({ ...fakeUser, passwordHash: hash });

      await expect(
        AuthService.login({ email: fakeUser.email, password: 'WrongPass1!' })
      ).rejects.toMatchObject({ statusCode: 401, message: 'Invalid credentials' });
    });
  });

  // ── refresh ───────────────────────────────────────────────────────
  describe('refresh', () => {
    it('throws 401 for malformed/invalid refresh token', async () => {
      await expect(AuthService.refresh('not.a.real.token')).rejects.toMatchObject({
        statusCode: 401,
        message: 'Invalid refresh token'
      });
    });

    it('throws 401 when stored token is not found', async () => {
      // issue a real token then make findFirst return null
      refreshTokenCreateMock.mockResolvedValue({});
      userFindUniqueMock.mockResolvedValue(fakeUser);
      userCreateMock.mockResolvedValue(fakeUser);

      const tokens = await AuthService.issueTokens(fakeUser);
      refreshTokenFindFirstMock.mockResolvedValue(null);

      await expect(AuthService.refresh(tokens.refreshToken)).rejects.toMatchObject({
        statusCode: 401
      });
    });

    it('throws 401 for expired stored token', async () => {
      const tokens = await AuthService.issueTokens(fakeUser);
      refreshTokenFindFirstMock.mockResolvedValue({
        id: 'rt-1',
        expiresAt: new Date(Date.now() - 1000), // already expired
        revokedAt: null
      });

      await expect(AuthService.refresh(tokens.refreshToken)).rejects.toMatchObject({
        statusCode: 401
      });
    });

    it('rotates token on successful refresh', async () => {
      const tokens = await AuthService.issueTokens(fakeUser);
      refreshTokenFindFirstMock.mockResolvedValue({
        id: 'rt-1',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null
      });
      refreshTokenUpdateMock.mockResolvedValue({});
      userFindUniqueMock.mockResolvedValue(fakeUser);

      const result = await AuthService.refresh(tokens.refreshToken);
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      // Verify old token was revoked (rotation occurred)
      expect(refreshTokenUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ revokedAt: expect.any(Date) }) })
      );
      // Verify a new refresh token was issued (create was called again)
      expect(refreshTokenCreateMock).toHaveBeenCalledTimes(2); // once in issueTokens, once in refresh
    });
  });

  // ── logout ─────────────────────────────────────────────────────────
  describe('logout', () => {
    it('marks refresh token as revoked', async () => {
      refreshTokenUpdateManyMock.mockResolvedValue({ count: 1 });

      await AuthService.logout('some-refresh-token');

      expect(refreshTokenUpdateManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ revokedAt: expect.any(Date) })
        })
      );
    });

    it('does not throw if token not found (no-op)', async () => {
      refreshTokenUpdateManyMock.mockResolvedValue({ count: 0 });
      await expect(AuthService.logout('unknown-token')).resolves.not.toThrow();
    });
  });
});
