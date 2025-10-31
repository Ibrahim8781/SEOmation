import type { ContentItem } from '@/types';
import { getApiClient } from './client';

const api = getApiClient();

export const ContentAPI = {
  list() {
    return api.get<{ items: ContentItem[] }>('/content');
  },
  getById(id: string) {
    return api.get<ContentItem>(`/content/${id}`);
  }
};
