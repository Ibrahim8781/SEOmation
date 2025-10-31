import type { Language, Platform, Topic } from '@/types';
import { getApiClient } from './client';

const api = getApiClient();

export interface GenerateTopicsPayload {
  platform: Platform;
  language: Language;
  context?: Record<string, unknown>;
}

export const TopicAPI = {
  list() {
    return api.get<{ items: Topic[] }>('/topics');
  },
  generate(payload: GenerateTopicsPayload) {
    return api.post<{ items: Topic[] }>('/topics/generate', payload);
  }
};
