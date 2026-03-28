import { z } from 'zod';
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from '../utils/languages.js';

const languageEnum = z.enum(SUPPORTED_LANGUAGES);

export const generateTopicsSchema = z.object({
body: z.object({
platform: z.enum(['BLOG', 'LINKEDIN', 'INSTAGRAM']),
language: languageEnum.default(DEFAULT_LANGUAGE),
context: z.record(z.any()).optional()
})
});
