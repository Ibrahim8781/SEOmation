import type { ContentItem, ContentVariant, Language, Platform } from '@/types';
import { getApiClient } from './client';

const api = getApiClient();

export interface GenerateContentPayload {
  platform: Platform;
  language?: Language;
  topicId?: string;
  prompt?: string;
  focusKeyword?: string;
  includeLinkedIn?: boolean;
  includeInstagram?: boolean;
  targetLength?: number;
  tone?: string;
}

export interface SeoHint {
  type: string;
  msg: string;
}

export interface GenerateContentResponse {
  item: ContentItem;
  focusKeyword: string;
  topicTitle: string;
  blog?: {
    structured?: unknown;
    diagnostics?: unknown;
  };
  variants: Record<string, ContentVariant | undefined>;
  seo?: {
    score: number;
    hints: SeoHint[];
  } | null;
}

export interface SeoHintsResponse {
  contentId: string;
  focusKeyword: string;
  score: number;
  hints: SeoHint[];
}

export const ContentAPI = {
  list() {
    return api.get<{ items: ContentItem[] }>('/content');
  },
  getById(id: string) {
    return api.get<ContentItem>(`/content/${id}`);
  },
  generate(payload: GenerateContentPayload) {
    return api.post<GenerateContentResponse>('/content/generate', payload);
  },
  getSeoHints(id: string, focusKeyword: string) {
    return api.post<SeoHintsResponse>(`/content/${id}/seo-hints`, { focusKeyword });
  }
};
