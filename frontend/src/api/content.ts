import type {
  ContentImageLink,
  ContentItem,
  ContentVariant,
  Language,
  Platform,
  SeoSummary
} from '@/types';
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
  includeImage?: boolean;
  includeLinkedInImage?: boolean;
  includeInstagramImage?: boolean;
  imagePrompt?: string;
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
  },
  saveDraftWithSeo(id: string, payload: SaveDraftPayload) {
    return api.post<{ item: ContentItem; seo: SeoSummary }>(`/content/${id}/save`, payload);
  },
  scoreSeo(payload: ScoreSeoPayload) {
    return api.post<SeoSummary>('/seo/score', payload);
  },
  listImages(contentId: string) {
    return api.get<{ items: ContentImageLink[] }>(`/content/${contentId}/images`);
  },
  generateImages(contentId: string, payload: GenerateImagePayload) {
    return api.post(`/content/${contentId}/images/generate`, payload);
  },
  uploadImage(contentId: string, payload: UploadImagePayload) {
    return api.post(`/content/${contentId}/images/upload`, payload);
  },
  deleteImageLink(contentId: string, linkId: string) {
    return api.delete(`/content/${contentId}/images/${linkId}`);
  }
};

export interface ScoreSeoPayload {
  title: string;
  metaDescription?: string;
  bodyHtml: string;
  primaryKeyword: string;
  secondaryKeywords?: string[];
  images?: { altText?: string }[];
  language?: string;
}

export interface SaveDraftPayload {
  title?: string;
  metaDescription?: string;
  bodyHtml?: string;
  text?: string;
  primaryKeyword?: string;
  secondaryKeywords?: string[];
  images?: { altText?: string }[];
  status?: 'DRAFT' | 'READY' | 'PUBLISHED' | 'ARCHIVED';
  linkedinText?: string;
  instagramText?: string;
}

export interface GenerateImagePayload {
  prompt: string;
  style?: string;
  sizes?: string[];
  count?: number;
  role?: string;
  position?: number;
  altText?: string;
  language?: string;
}

export interface UploadImagePayload {
  dataUrl?: string;
  url?: string;
  altText?: string;
  role?: string;
  position?: number;
  prompt?: string;
  width?: number;
  height?: number;
  format?: string;
  aiMeta?: Record<string, unknown>;
}
