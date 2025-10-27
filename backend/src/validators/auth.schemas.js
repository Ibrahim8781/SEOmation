import { z } from 'zod';


export const registerSchema = z.object({
body: z.object({
email: z.string().email(),
password: z.string().min(8),
name: z.string().min(2),
role: z.enum(['USER', 'ADMIN']).default('USER'),
company: z.string().min(1),
niche: z.string().min(1),
timezone: z.string().min(1),
language: z.enum(['EN', 'DE'])
})
});


export const loginSchema = z.object({
body: z.object({ email: z.string().email(), password: z.string().min(8) })
});


export const refreshSchema = z.object({
body: z.object({ refreshToken: z.string().min(10) })
});