import { z } from 'zod';

const platformEnum = z.enum(['BLOG', 'LINKEDIN', 'INSTAGRAM']);
const languageEnum = z.enum(['EN', 'DE']);
const cadenceEnum = z.enum(['DAILY', 'WEEKLY', 'MONTHLY']);

const businessProfileSchema = z.object({
  businessName: z.string().min(2),
  niche: z.string().min(2),
  primaryPlatforms: z.array(platformEnum).min(1),
  timezone: z.string().min(2),
  language: languageEnum,
  contentGoals: z.string().min(5),
  toneOfVoice: z.string().min(3),
  targetAudience: z.string().min(3),
  publishingCadence: cadenceEnum,
  preferredContentTypes: z.array(z.string()).min(1),
  additionalNotes: z.string().optional(),
  primaryRegion: z.string().optional(),
  seasonalFocus: z.string().optional(),
  seedKeywords: z.array(z.string()).default([]),
  audiencePainPoints: z.array(z.string()).default([]),
  includeTrends: z.boolean().default(true)
});

const onboardingSchema = z.object({
  completed: z.boolean().default(true),
  businessProfile: businessProfileSchema
});

export const updateUserSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    company: z.string().min(2).optional(),
    niche: z.string().min(2).optional(),
    timezone: z.string().min(2).optional(),
    language: languageEnum.optional(),
    tone: z.string().min(2).max(120).optional(),
    preferences: z
      .object({
        onboarding: onboardingSchema.optional()
      })
      .optional()
  })
});
