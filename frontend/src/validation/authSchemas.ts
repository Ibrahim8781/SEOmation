import { z } from 'zod';
import { LANGUAGE_OPTIONS, TIMEZONE_OPTIONS } from '@/utils/constants';

const timezoneEnum = z.enum(TIMEZONE_OPTIONS as [string, ...string[]]);
const languageEnum = z.enum(LANGUAGE_OPTIONS.map((option) => option.value) as ['EN', 'DE']);

export const loginSchema = z.object({
  email: z.string().email('A valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters')
});

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('A valid email is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Include at least one uppercase letter')
    .regex(/[a-z]/, 'Include at least one lowercase letter')
    .regex(/[0-9]/, 'Include at least one number'),
  company: z.string().min(2, 'Company name is required'),
  niche: z.string().min(2, 'Niche is required'),
  timezone: timezoneEnum,
  language: languageEnum
});

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
