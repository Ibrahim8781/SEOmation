import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock the config module before importing the service
jest.unstable_mockModule('../src/config/index.js', () => ({
  config: {
    integrations: {
      linkedin: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://test/callback',
        scope: 'openid profile email w_member_social'
      },
      wordpress: {
        clientId: 'test-wp-client',
        clientSecret: 'test-wp-secret'
      },
      callbackBase: 'http://test'
    }
  }
}));

// Import service after mocking config
const { IntegrationService } = await import('../src/services/integration.service.js');

describe('IntegrationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.mockPrisma.platformIntegration = {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      update: jest.fn()
    };
    global.mockPrisma.user = { findUnique: jest.fn() };
  });

  describe('list', () => {
    it('returns integrations for a user', async () => {
      const userId = 'u1';
      const mockInts = [{ id: 'i1', userId }, { id: 'i2', userId }];
      global.mockPrisma.platformIntegration.findMany.mockResolvedValue(mockInts);

      const res = await IntegrationService.list(userId);

      expect(global.mockPrisma.platformIntegration.findMany).toHaveBeenCalledWith({ where: { userId } });
      expect(res).toEqual(mockInts);
    });

    it('returns empty array when none', async () => {
      global.mockPrisma.platformIntegration.findMany.mockResolvedValue([]);
      const res = await IntegrationService.list('no-user');
      expect(res).toEqual([]);
    });
  });

  describe('delete', () => {
    it('deletes by platform (normalized)', async () => {
      global.mockPrisma.platformIntegration.deleteMany.mockResolvedValue({ count: 1 });
      await IntegrationService.delete('u1', 'linkedin');
      expect(global.mockPrisma.platformIntegration.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1', platform: 'LINKEDIN' }
      });
    });

    it('throws for unsupported platform', async () => {
      await expect(IntegrationService.delete('u1', 'NOPE')).rejects.toThrow(/Unsupported platform/);
    });
  });

  describe('setWordPressSite', () => {
    it('updates siteUrl when integration exists', async () => {
      const userId = 'u1';
      const siteUrl = 'https://x';
      const mockInt = { id: 'i1', userId, platform: 'WORDPRESS', metadata: {} };
      const mockUpdated = { ...mockInt, metadata: { siteUrl } };

      global.mockPrisma.platformIntegration.findFirst.mockResolvedValue(mockInt);
      global.mockPrisma.platformIntegration.update.mockResolvedValue(mockUpdated);

      const res = await IntegrationService.setWordPressSite(userId, siteUrl);

      expect(global.mockPrisma.platformIntegration.update).toHaveBeenCalledWith({
        where: { id: mockInt.id },
        data: { metadata: { siteUrl } }
      });
      expect(res.metadata.siteUrl).toBe(siteUrl);
    });

    it('throws when WordPress integration missing', async () => {
      global.mockPrisma.platformIntegration.findFirst.mockResolvedValue(null);
      await expect(IntegrationService.setWordPressSite('u1', 'https://x')).rejects.toThrow(/WordPress integration not found/);
    });
  });

  describe('buildAuthUrl & parseState', () => {
    it('builds auth URL and includes state for LinkedIn', () => {
      const url = IntegrationService.buildAuthUrl('u1', 'LINKEDIN');
      expect(url).toContain('linkedin.com');
      expect(url).toContain('state=');
      // State is URL-encoded in the query string, so check for encoded version
      expect(url).toContain('u1%3ALINKEDIN%3A'); // URL-encoded colon is %3A
    });

    it('parses valid state and rejects mismatch', () => {
      const state = 'user-1:LINKEDIN:nonce';
      const parsed = IntegrationService.parseState(state, 'LINKEDIN');
      expect(parsed.userId).toBe('user-1');
      expect(parsed.platform).toBe('LINKEDIN');
      expect(() => IntegrationService.parseState('bad', 'LINKEDIN')).toThrow(/Invalid state/);
      expect(() => IntegrationService.parseState(state, 'WORDPRESS')).toThrow(/State\/platform mismatch/);
    });
  });

  describe('handleCallback', () => {
    it('handles LinkedIn callback and upserts integration', async () => {
      const userId = 'u1';
      const payload = { code: 'c', state: `${userId}:LINKEDIN:nonce` };
      const mockUser = { id: userId, email: 'e' };
      const mockUpsert = { id: 'i1', userId, platform: 'LINKEDIN' };

      global.mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      global.mockPrisma.platformIntegration.upsert.mockResolvedValue(mockUpsert);

      // mock fetch for token exchange and profile
      global.fetch = jest.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 't', expires_in: 3600 }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'li-id' }) });

      const res = await IntegrationService.handleCallback(userId, 'LINKEDIN', payload);

      expect(global.mockPrisma.platformIntegration.upsert).toHaveBeenCalled();
      expect(res.platform).toBe('LINKEDIN');
    });

    it('throws when code missing or user not found or payload error', async () => {
      global.mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      await expect(IntegrationService.handleCallback('u1', 'LINKEDIN', {})).rejects.toThrow(/Missing code/);

      global.mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(IntegrationService.handleCallback('no-user', 'LINKEDIN', { code: 'c' })).rejects.toThrow(/User not found/);

      global.mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      await expect(IntegrationService.handleCallback('u1', 'LINKEDIN', { error: 'denied' })).rejects.toThrow(/OAuth error: denied/);
    });
  });
});