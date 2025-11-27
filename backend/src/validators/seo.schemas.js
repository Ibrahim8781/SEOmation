import { z } from 'zod';

const statusEnum = z.enum(['DRAFT', 'READY', 'PUBLISHED', 'ARCHIVED']);

const imageInput = z.object({
  altText: z.string().max(240).optional()
});

export const seoScoreSchema = z.object({
  body: z.object({
    title: z.string().min(3, 'Title is required'),
    metaDescription: z.string().max(320).optional(),
    bodyHtml: z.string().min(10, 'bodyHtml is required'),
    primaryKeyword: z.string().min(2, 'primaryKeyword is required'),
    focusKeyword: z.string().min(2).optional(),
    secondaryKeywords: z.array(z.string().min(2)).optional(),
    images: z.array(imageInput).optional(),
    language: z.string().min(2).max(8).optional()
  })
});

export const saveDraftWithSeoSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      title: z.string().min(3).optional(),
      metaDescription: z.string().max(320).optional(),
      bodyHtml: z.string().min(10).optional(),
      text: z.string().optional(),
      primaryKeyword: z.string().min(2).optional(),
      focusKeyword: z.string().min(2).optional(),
      secondaryKeywords: z.array(z.string().min(2)).optional(),
      images: z.array(imageInput).optional(),
      linkedinText: z.string().optional(),
      instagramText: z.string().optional(),
      status: statusEnum.optional()
    })
    .refine((b) => Boolean(b.bodyHtml || b.text), {
      message: 'bodyHtml is required',
      path: ['bodyHtml']
    })
});
