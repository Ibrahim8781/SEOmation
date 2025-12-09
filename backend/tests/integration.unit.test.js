import { IntegrationService } from '../src/services/integration.service.js';

describe('Integration Service Unit Tests', () => {
  describe('buildAuthUrl [INT-001]', () => {
    it('should build WordPress auth URL', () => {
      const url = IntegrationService.buildAuthUrl('user123', 'WORDPRESS');
      
      expect(url).toContain('client_id');
      expect(url).toContain('redirect_uri');
      expect(url).toContain('state');
      expect(url).toContain('user123');
    });

    it('should build LinkedIn auth URL', () => {
      const url = IntegrationService.buildAuthUrl('user456', 'LINKEDIN');
      
      expect(url).toContain('linkedin.com/oauth');
      expect(url).toContain('state');
    });
  });

  describe('parseState', () => {
    it('should parse valid state', () => {
      const state = 'user123:WORDPRESS:abc123';
      const result = IntegrationService.parseState(state, 'WORDPRESS');
      
      expect(result.userId).toBe('user123');
      expect(result.platform).toBe('WORDPRESS');
    });

    it('should throw on invalid state', () => {
      expect(() => {
        IntegrationService.parseState('invalid', 'WORDPRESS');
      }).toThrow();
    });
  });
});