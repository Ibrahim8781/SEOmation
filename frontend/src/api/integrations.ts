import type { PlatformIntegration, IntegrationPlatform } from '@/types';
import { getApiClient } from './client';

const api = getApiClient();

export const IntegrationsAPI = {
  list() {
    return api.get<{ items: PlatformIntegration[] }>('/integrations');
  },
  getAuthUrl(platform: IntegrationPlatform) {
    return api.get<{ url: string }>(`/integrations/${platform.toLowerCase()}/auth-url`);
  },
  disconnect(platform: IntegrationPlatform) {
    return api.delete(`/integrations/${platform.toLowerCase()}`);
  },
  completeCallback(platform: IntegrationPlatform, params: Record<string, string | undefined>) {
    return api.get<{ integration: PlatformIntegration }>(`/integrations/${platform.toLowerCase()}/callback`, {
      params
    });
  }
};
