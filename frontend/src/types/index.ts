export type Role = 'USER' | 'ADMIN';
export type Language = 'EN' | 'DE';
export type Platform = 'BLOG' | 'LINKEDIN' | 'INSTAGRAM';
export type IntegrationPlatform = 'WORDPRESS' | 'LINKEDIN' | 'INSTAGRAM';
export type TopicStatus = 'SUGGESTED' | 'ACCEPTED' | 'REJECTED';
export type ContentStatus = 'DRAFT' | 'READY' | 'PUBLISHED' | 'ARCHIVED';
export type ImageRole = 'featured' | 'inline' | 'thumbnail' | 'instagram_main' | 'gallery';
export type ScheduleStatus = 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

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
  metaDescription?: string | null;
  primaryKeyword?: string | null;
  secondaryKeywords?: string[];
  seoMeta: Record<string, unknown> | null;
  seoSummary?: SeoSummary | null;
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

export interface SeoComponentScore {
  id: string;
  label: string;
  score: number;
  max: number;
  message: string;
  severity: 'ok' | 'warn' | 'error';
}

export interface SeoSummary {
  total: number;
  max: number;
  components: SeoComponentScore[];
  meta?: {
    wordCount?: number;
    keywordDensity?: number;
    avgSentenceLength?: number;
  };
}

export interface ImageAsset {
  id: string;
  userId: string;
  prompt?: string | null;
  url: string;
  altText?: string | null;
  width?: number | null;
  height?: number | null;
  format?: string | null;
  provider?: string | null;
  aiMeta?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContentImageLink {
  id: string;
  contentId: string;
  imageId: string;
  role: ImageRole;
  position?: number | null;
  createdAt: string;
  image: ImageAsset;
}

export interface PlatformIntegration {
  id: string;
  userId: string;
  platform: IntegrationPlatform;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublishResult {
  id: string;
  jobId: string;
  externalId?: string | null;
  publishedAt?: string | null;
  response?: Record<string, unknown> | null;
  createdAt: string;
}

export interface ScheduleJob {
  id: string;
  contentId: string;
  integrationId: string;
  platform: IntegrationPlatform;
  scheduledTime: string;
  status: ScheduleStatus;
  attempts: number;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
  content?: ContentItem;
  integration?: PlatformIntegration;
  result?: PublishResult | null;
}
