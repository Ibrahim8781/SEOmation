import { z } from 'zod';


export const generateContentSchema = z.object({
body: z.object({
platform: z.enum(['BLOG', 'LINKEDIN', 'INSTAGRAM']),
language: z.enum(['EN', 'DE']).default('EN'),
topicId: z.string().uuid().optional(),
prompt: z.string().min(5).optional()
}).refine((b) => b.topicId || b.prompt, {
message: 'Provide either topicId or prompt',
path: ['body']
})
});


export const updateContentSchema = z.object({
params: z.object({ id: z.string().uuid() }),
body: z.object({
title: z.string().optional(),
html: z.string().optional(),
text: z.string().optional(),
seoMeta: z.record(z.any()).optional(),
grammarScore: z.number().optional(),
readabilityScore: z.number().optional(),
status: z.enum(['DRAFT', 'READY', 'PUBLISHED', 'ARCHIVED']).optional()
})
});