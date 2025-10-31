export type Role = 'USER' | 'ADMIN';
export type Language = 'EN' | 'DE';
export type Platform = 'BLOG' | 'LINKEDIN' | 'INSTAGRAM';
export type TopicStatus = 'SUGGESTED' | 'ACCEPTED' | 'REJECTED';
export type ContentStatus = 'DRAFT' | 'READY' | 'PUBLISHED' | 'ARCHIVED';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  company: string;
  niche: string;
  timezone: string;
  language: Language;
  preferences?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: User;
}

export interface Topic {
  id: string;
  userId: string;
  title: string;
  platform: Platform;
  language: Language;
  relevance: number | null;
  isRelevant: boolean | null;
  aiMeta: Record<string, unknown> | null;
  status: TopicStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ContentItem {
  id: string;
  userId: string;
  topicId: string | null;
  platform: Platform;
  language: Language;
  title: string;
  html: string | null;
  text: string | null;
  seoMeta: Record<string, unknown> | null;
  grammarScore: number | null;
  readabilityScore: number | null;
  ragScore: number | null;
  aiMeta: Record<string, unknown> | null;
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ApiErrorPayload {
  message: string;
  stack?: string;
}

export interface BusinessProfile {
  businessName: string;
  niche: string;
  primaryPlatforms: Platform[];
  timezone: string;
  language: Language;
  contentGoals: string;
  toneOfVoice: string;
  targetAudience: string;
  publishingCadence: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  additionalNotes?: string;
  preferredContentTypes: string[];
}
