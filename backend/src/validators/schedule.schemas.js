import { z } from 'zod';
import { isValidTimeZone } from '../utils/datetime.js';

const platformEnum = z.enum(['WORDPRESS', 'LINKEDIN', 'INSTAGRAM']);
const platformSchema = z
  .string()
  .transform((value) => value.toUpperCase())
  .pipe(platformEnum);
const localDateTimeSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/, {
  message: 'scheduledTime must use datetime-local format'
});
const timezoneSchema = z.string().min(1).refine((value) => isValidTimeZone(value), {
  message: 'timezone must be a valid IANA timezone'
});

export const scheduleJobSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    integrationId: z.string().uuid(),
    platform: platformSchema,
    scheduledTime: localDateTimeSchema,
    timezone: timezoneSchema.optional(),
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
