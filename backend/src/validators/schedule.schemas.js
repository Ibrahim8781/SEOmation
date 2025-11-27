import { z } from 'zod';

const platformEnum = z.enum(['WORDPRESS', 'LINKEDIN', 'INSTAGRAM']);
const platformSchema = z
  .string()
  .transform((value) => value.toUpperCase())
  .pipe(platformEnum);

export const scheduleJobSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    integrationId: z.string().uuid(),
    platform: platformSchema,
    scheduledTime: z.coerce.date(),
    media: z
      .object({
        instagram: z.string().uuid().optional(),
        linkedin: z.string().uuid().optional(),
        wordpressFeatured: z.string().uuid().optional()
      })
      .optional(),
    metadata: z.record(z.any()).optional()
  })
});

export const publishNowSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    integrationId: z.string().uuid(),
    platform: platformSchema,
    media: z
      .object({
        instagram: z.string().uuid().optional(),
        linkedin: z.string().uuid().optional(),
        wordpressFeatured: z.string().uuid().optional()
      })
      .optional()
  })
});

export const cancelScheduleSchema = z.object({
  params: z.object({ jobId: z.string().uuid() })
});
