export type Role = 'USER' | 'ADMIN';
export type Language = 'EN' | 'DE';
export type Platform = 'BLOG' | 'LINKEDIN' | 'INSTAGRAM';
export type TopicStatus = 'SUGGESTED' | 'ACCEPTED' | 'REJECTED';
export type ContentStatus = 'DRAFT' | 'READY' | 'PUBLISHED' | 'ARCHIVED';

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
  primaryRegion?: string;
  seasonalFocus?: string;
  seedKeywords: string[];
  audiencePainPoints: string[];
  includeTrends: boolean;
}

export interface UserPreferences {
  onboarding?: {
    completed: boolean;
    businessProfile: BusinessProfile;
  };
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  company: string;
  niche: string;
  timezone: string;
  language: Language;
  tone: string;
  preferences?: UserPreferences | null;
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

export interface TopicAiMeta {
  cluster?: string;
  diagnostics?: unknown;
  trendTag?: string;
  source?: string;
  [key: string]: unknown;
}

export interface Topic {
  id: string;
  userId: string;
  title: string;
  platform: Platform;
  language: Language;
  relevance: number | null;
  isRelevant: boolean | null;
  targetKeyword: string | null;
  rationale: string | null;
  aiMeta: TopicAiMeta | null;
  status: TopicStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ContentVariant {
  html: string | null;
  text: string | null;
  structured?: unknown;
  diagnostics?: unknown;
}

export interface ContentAiMeta {
  diagnostics?: unknown;
  contentStructure?: unknown;
  social?: Record<string, ContentVariant>;
  [key: string]: unknown;
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
  aiMeta: ContentAiMeta | null;
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ApiErrorPayload {
  message: string;
  stack?: string;
}
