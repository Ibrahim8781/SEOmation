import { z } from 'zod';
import { SUPPORTED_LANGUAGES } from '../utils/languages.js';

const languageEnum = z.enum(SUPPORTED_LANGUAGES);
const BCRYPT_MAX_PASSWORD_BYTES = 72;

function validateBcryptPassword(value) {
  return Buffer.byteLength(value, 'utf8') <= BCRYPT_MAX_PASSWORD_BYTES;
}

export const registerSchema = z.object({
body: z.object({
email: z.string().email(),
password: z
  .string()
  .min(8)
  .refine(validateBcryptPassword, {
    message: `Password must be ${BCRYPT_MAX_PASSWORD_BYTES} bytes or fewer`
  }),
name: z.string().min(2),
role: z.enum(['USER', 'ADMIN']).default('USER'),
company: z.string().min(1),
niche: z.string().min(1),
timezone: z.string().min(1),
language: languageEnum
})
});


export const loginSchema = z.object({
body: z.object({ email: z.string().email(), password: z.string().min(8) })
});


export const refreshSchema = z.object({
body: z.object({ refreshToken: z.string().min(10) })
});
