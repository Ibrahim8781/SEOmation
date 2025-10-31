import type { Language, Platform } from '@/types';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';

export const PLATFORM_OPTIONS: { label: string; value: Platform }[] = [
  { label: 'Blog', value: 'BLOG' },
  { label: 'LinkedIn', value: 'LINKEDIN' },
  { label: 'Instagram', value: 'INSTAGRAM' }
];

export const LANGUAGE_OPTIONS: { label: string; value: Language }[] = [
  { label: 'English (EN)', value: 'EN' },
  { label: 'German (DE)', value: 'DE' }
];

export const TIMEZONE_OPTIONS = [
  'Asia/Karachi',
  'Europe/Berlin',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Dubai',
  'Asia/Singapore'
];

export const CONTENT_FOCUS_OPTIONS = [
  'SEO blog articles',
  'Product updates',
  'Thought leadership',
  'How-to tutorials',
  'Case studies',
  'Social media captions'
];

export const TONE_OF_VOICE_OPTIONS = [
  'Professional',
  'Friendly',
  'Authoritative',
  'Playful',
  'Inspirational'
];

export const CADENCE_OPTIONS = [
  { label: 'Daily', value: 'DAILY' },
  { label: 'Weekly', value: 'WEEKLY' },
  { label: 'Monthly', value: 'MONTHLY' }
];
