import type { Language, Platform, Topic } from '@/types';
import { getApiClient } from './client';

const api = getApiClient();

export interface GenerateTopicsContext {
  businessName?: string;
  niche?: string;
  audience?: string;
  tone?: string;
  seedKeywords?: string[];
  pains?: string[];
  region?: string | null;
  season?: string | null;
  includeTrends?: boolean;
  count?: number;
  namespace?: string | null;
}

export interface GenerateTopicsPayload {
  platform: Platform;
  language: Language;
  context?: GenerateTopicsContext;
}

export interface GenerateTopicsResponse {
  items: Topic[];
  meta?: Record<string, unknown>;
}

export const TopicAPI = {
  list() {
    return api.get<{ items: Topic[] }>('/topics');
  },
  generate(payload: GenerateTopicsPayload) {
    return api.post<GenerateTopicsResponse>('/topics/generate', payload);
  }
};
