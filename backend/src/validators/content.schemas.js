import { z } from 'zod';


const platformEnum = z.enum(['BLOG', 'LINKEDIN', 'INSTAGRAM']);
const languageEnum = z.enum(['EN', 'DE']);

export const generateContentSchema = z.object({
body: z.object({
platform: platformEnum,
language: languageEnum.optional(),
topicId: z.string().uuid().optional(),
prompt: z.string().min(5).optional(),
focusKeyword: z.string().min(2).optional(),
includeLinkedIn: z.boolean().optional(),
includeInstagram: z.boolean().optional(),
targetLength: z.number().int().min(400).max(4000).optional(),
tone: z.string().min(3).max(120).optional()
}).refine((b) => b.topicId || b.prompt, {
message: 'Provide either topicId or prompt',
path: ['prompt']
}).refine((b) => {
if (b.topicId) return true;
return typeof b.focusKeyword === 'string' && b.focusKeyword.trim().length > 1;
}, {
message: 'focusKeyword is required when generating from a prompt',
path: ['focusKeyword']
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

export const seoHintsSchema = z.object({
params: z.object({ id: z.string().uuid() }),
body: z.object({
focusKeyword: z.string().min(2)
})
});
