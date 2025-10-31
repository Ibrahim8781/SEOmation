import { z } from 'zod';
import { CADENCE_OPTIONS, CONTENT_FOCUS_OPTIONS, PLATFORM_OPTIONS } from '@/utils/constants';
import type { BusinessProfile, Platform } from '@/types';

const platformEnum = z.enum(PLATFORM_OPTIONS.map((option) => option.value) as [Platform, ...Platform[]]);
const cadenceEnum = z.enum(CADENCE_OPTIONS.map((option) => option.value) as ['DAILY', 'WEEKLY', 'MONTHLY']);
const languageEnum = z.enum(['EN', 'DE']);

export const onboardingSchema = z.object({
  businessName: z.string().min(2, 'Please tell us your business name'),
  niche: z.string().min(2, 'Share the niche you operate in'),
  primaryPlatforms: z.array(platformEnum).min(1, 'Select at least one platform'),
  timezone: z.string().min(2, 'Timezone is required'),
  language: languageEnum,
  contentGoals: z.string().min(10, 'What outcomes are you targeting from content?'),
  toneOfVoice: z.string().min(3, 'Tone of voice helps us match your brand'),
  targetAudience: z.string().min(5, 'Describe who you are writing for'),
  publishingCadence: cadenceEnum,
  preferredContentTypes: z
    .array(z.string())
    .min(1, 'Pick at least one content type you frequently produce'),
  additionalNotes: z.string().optional()
});

export type OnboardingFormValues = z.infer<typeof onboardingSchema>;

export function onboardingValuesToProfile(values: OnboardingFormValues): BusinessProfile {
  return {
    businessName: values.businessName,
    niche: values.niche,
    primaryPlatforms: values.primaryPlatforms,
    timezone: values.timezone,
    language: values.language,
    contentGoals: values.contentGoals,
    toneOfVoice: values.toneOfVoice,
    targetAudience: values.targetAudience,
    publishingCadence: values.publishingCadence,
    additionalNotes: values.additionalNotes,
    preferredContentTypes: values.preferredContentTypes
  };
}

export function profileToOnboardingValues(profile: BusinessProfile): OnboardingFormValues {
  return {
    businessName: profile.businessName,
    niche: profile.niche,
    primaryPlatforms: profile.primaryPlatforms,
    timezone: profile.timezone,
    language: profile.language,
    contentGoals: profile.contentGoals,
    toneOfVoice: profile.toneOfVoice,
    targetAudience: profile.targetAudience,
    publishingCadence: profile.publishingCadence,
    preferredContentTypes: profile.preferredContentTypes,
    additionalNotes: profile.additionalNotes ?? ''
  };
}

export const DEFAULT_CONTENT_TYPES = CONTENT_FOCUS_OPTIONS;
