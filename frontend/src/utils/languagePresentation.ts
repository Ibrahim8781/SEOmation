import type { SupportedLanguage } from './languages';

type LanguageLike = SupportedLanguage | string | null | undefined;

type TextSurfaceOptions = {
  code?: boolean;
};

const LANGUAGE_TAGS: Record<SupportedLanguage, string> = {
  EN: 'en',
  DE: 'de',
  JA: 'ja',
  AR: 'ar',
  KO: 'ko',
  ZH: 'zh',
  RU: 'ru'
};

const LANGUAGE_SCRIPTS: Record<SupportedLanguage, 'latin' | 'arabic' | 'japanese' | 'korean' | 'chinese' | 'cyrillic'> = {
  EN: 'latin',
  DE: 'latin',
  JA: 'japanese',
  AR: 'arabic',
  KO: 'korean',
  ZH: 'chinese',
  RU: 'cyrillic'
};

const RTL_LANGUAGES = new Set<SupportedLanguage>(['AR']);

function normalizeLanguage(language: LanguageLike): SupportedLanguage {
  const value = String(language || 'EN').trim().toUpperCase();
  return (Object.prototype.hasOwnProperty.call(LANGUAGE_TAGS, value) ? value : 'EN') as SupportedLanguage;
}

export function resolveLanguageTag(language: LanguageLike) {
  return LANGUAGE_TAGS[normalizeLanguage(language)];
}

export function resolveLanguageDirection(language: LanguageLike) {
  return RTL_LANGUAGES.has(normalizeLanguage(language)) ? 'rtl' : 'ltr';
}

export function resolveLanguageScript(language: LanguageLike) {
  return LANGUAGE_SCRIPTS[normalizeLanguage(language)];
}

export function getTextSurfaceProps(language: LanguageLike, options: TextSurfaceOptions = {}) {
  const lang = resolveLanguageTag(language);
  const direction = options.code ? 'ltr' : resolveLanguageDirection(language);

  return {
    lang,
    dir: direction,
    'data-script': resolveLanguageScript(language),
    'data-text-dir': direction
  } as const;
}
