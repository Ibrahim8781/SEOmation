import type { IntegrationPlatform, ScheduleJob } from '@/types';
import { getApiClient } from './client';

const api = getApiClient();

export const ScheduleAPI = {
  list() {
    return api.get<{ items: ScheduleJob[] }>('/schedule');
  },
  schedule(contentId: string, payload: SchedulePayload) {
    return api.post<{ job: ScheduleJob }>(`/schedule/content/${contentId}/schedule`, payload);
  },
  publishNow(contentId: string, payload: PublishPayload) {
    return api.post<{ job: ScheduleJob }>(`/schedule/content/${contentId}/publish-now`, payload);
  },
  cancel(jobId: string) {
    return api.post<{ job: ScheduleJob }>(`/schedule/${jobId}/cancel`);
  }
};

export interface SchedulePayload {
  integrationId: string;
  platform: IntegrationPlatform;
  scheduledTime: string;
  media?: {
    instagram?: string;
    linkedin?: string;
    wordpressFeatured?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface PublishPayload {
  integrationId: string;
  platform: IntegrationPlatform;
  media?: {
    instagram?: string;
    linkedin?: string;
    wordpressFeatured?: string;
  };
}
