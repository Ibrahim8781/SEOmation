export const LANGUAGE_CODES = ['EN', 'DE', 'JA', 'AR', 'KO', 'ZH', 'RU'] as const;

export type SupportedLanguage = (typeof LANGUAGE_CODES)[number];

export const LANGUAGE_OPTIONS: { label: string; value: SupportedLanguage }[] = [
  { label: 'English (EN)', value: 'EN' },
  { label: 'German (DE)', value: 'DE' },
  { label: 'Japanese (JA)', value: 'JA' },
  { label: 'Arabic (AR)', value: 'AR' },
  { label: 'Korean (KO)', value: 'KO' },
  { label: 'Chinese (ZH)', value: 'ZH' },
  { label: 'Russian (RU)', value: 'RU' }
];
