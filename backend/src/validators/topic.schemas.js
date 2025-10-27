import { z } from 'zod';


export const generateTopicsSchema = z.object({
body: z.object({
platform: z.enum(['BLOG', 'LINKEDIN', 'INSTAGRAM']),
language: z.enum(['EN', 'DE']).default('EN'),
context: z.record(z.any()).optional()
})
});