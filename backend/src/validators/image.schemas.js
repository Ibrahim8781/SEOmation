import { z } from 'zod';

const roleEnum = z.enum(['featured', 'inline', 'thumbnail', 'instagram_main', 'gallery']);

export const generateImageSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    prompt: z.string().min(3),
    style: z.string().max(120).optional(),
    sizes: z.array(z.string()).max(5).optional(),
    count: z.number().int().min(1).max(6).optional(),
    role: roleEnum.optional(),
    position: z.number().int().min(0).optional(),
    altText: z.string().max(240).optional(),
    language: z.string().min(2).max(8).optional()
  })
});

export const uploadImageSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    dataUrl: z.string().min(10).optional(),
    url: z.string().min(10).optional(),
    altText: z.string().max(240).optional(),
    role: roleEnum.optional(),
    position: z.number().int().min(0).optional(),
    prompt: z.string().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    format: z.string().optional(),
    aiMeta: z.record(z.any()).optional()
  }).refine((b) => Boolean(b.dataUrl || b.url), {
    message: 'dataUrl or url is required',
    path: ['dataUrl']
  })
});

export const deleteImageLinkSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
    linkId: z.string().uuid()
  })
});
