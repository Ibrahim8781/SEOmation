import { useEffect, useMemo, useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FiArrowRight, FiCheckCircle, FiTarget } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useAuth } from '@/hooks/useAuth';
import { useOnboarding } from '@/hooks/useOnboarding';
import type { Platform } from '@/types';
import {
  PLATFORM_OPTIONS,
  LANGUAGE_OPTIONS,
  TIMEZONE_OPTIONS,
  CADENCE_OPTIONS,
  CONTENT_FOCUS_OPTIONS
} from '@/utils/constants';
import { extractErrorMessage } from '@/utils/error';
import {
  onboardingSchema,
  onboardingValuesToProfile,
  profileToOnboardingValues,
  type OnboardingFormValues
} from '@/validation/onboardingSchema';
import './onboarding.css';

export function OnboardingPage() {
  const navigate = useNavigate();
  const { user, updateProfile } = useAuth();
  const { businessProfile, completeOnboarding } = useOnboarding();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultValues = useMemo<OnboardingFormValues>(() => {
    if (businessProfile) {
      return profileToOnboardingValues(businessProfile);
    }
    return {
      businessName: user?.company ?? '',
      niche: user?.niche ?? '',
      primaryPlatforms: ['BLOG'],
      timezone: user?.timezone ?? TIMEZONE_OPTIONS[0],
      language: (user?.language ?? 'EN') as 'EN' | 'DE',
      contentGoals: '',
      toneOfVoice: 'Professional',
      targetAudience: '',
      publishingCadence: 'WEEKLY',
      preferredContentTypes: ['SEO blog articles'],
      seedKeywords: [user?.niche, user?.company].filter(Boolean).join(', ') || 'SEO strategy',
      audiencePainPoints: '',
      primaryRegion: 'Global',
      seasonalFocus: '',
      includeTrends: true,
      additionalNotes: ''
    };
  }, [businessProfile, user]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset
  } = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema) as any,
    defaultValues
  });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const selectedPlatforms = watch('primaryPlatforms');
  const selectedContentTypes = watch('preferredContentTypes');

  const togglePlatform = (value: Platform) => {
    const current = watch('primaryPlatforms');
    if (current.includes(value)) {
      setValue(
        'primaryPlatforms',
        current.filter((item) => item !== value),
        { shouldValidate: true }
      );
    } else {
      setValue('primaryPlatforms', [...current, value], { shouldValidate: true });
    }
  };

  const toggleContentType = (value: string) => {
    const current = watch('preferredContentTypes');
    if (current.includes(value)) {
      setValue(
        'preferredContentTypes',
        current.filter((item) => item !== value),
        { shouldValidate: true }
      );
    } else {
      setValue('preferredContentTypes', [...current, value], { shouldValidate: true });
    }
  };

  const onSubmit: SubmitHandler<OnboardingFormValues> = async (values) => {
    if (!user) return;
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const profilePayload = onboardingValuesToProfile(values);
      await updateProfile({
        company: values.businessName,
        niche: values.niche,
        language: values.language,
        timezone: values.timezone,
        tone: values.toneOfVoice,
        preferences: {
          onboarding: {
            completed: true,
            businessProfile: profilePayload
          }
        }
      });
      completeOnboarding(profilePayload);
      navigate('/', { replace: true });
    } catch (error) {
      setSubmitError(extractErrorMessage(error, 'Failed to save your profile. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="onboarding-page">
      <div className="onboarding-hero">
        <span className="onboarding-pill">Let&apos;s personalize your workspace</span>
        <h1>Hi {user?.name?.split(' ')[0] || 'there'}, tell us about your business.</h1>
        <p>
          We use this information to craft more relevant topic ideas, tone-aligned drafts, and recommendations
          that match your audience perfectly.
        </p>
        <div className="onboarding-highlights">
          <div>
            <FiCheckCircle />
            <span>Tailored AI topic generation</span>
          </div>
          <div>
            <FiTarget />
            <span>Audience-aware content briefs</span>
          </div>
        </div>
      </div>

      <form className="onboarding-form" onSubmit={handleSubmit(onSubmit)}>
        <section className="onboarding-section glass-card">
          <header>
            <h2>Business foundations</h2>
            <p>These details shape the context for future briefs and topic suggestions.</p>
          </header>
          <div className="onboarding-grid">
            <Input
              label="Business / Brand name"
              placeholder="SEOmation"
              error={errors.businessName?.message}
              {...register('businessName')}
            />
            <Input
              label="Primary niche"
              placeholder="B2B SaaS, eCommerce, Education..."
              error={errors.niche?.message}
              {...register('niche')}
            />
            <Select
              label="Timezone"
              options={TIMEZONE_OPTIONS.map((tz) => ({ label: tz, value: tz }))}
              error={errors.timezone?.message}
              {...register('timezone')}
            />
            <Select
              label="Content language"
              options={LANGUAGE_OPTIONS}
              error={errors.language?.message}
              {...register('language')}
            />
          </div>
        </section>

        <section className="onboarding-section glass-card">
          <header>
            <h2>Content preferences</h2>
            <p>Help us understand what kind of content matters most for your strategy.</p>
          </header>

          <div className="onboarding-group">
            <label className="onboarding-label">Primary platforms</label>
            <div className="onboarding-chip-row">
              {PLATFORM_OPTIONS.map((option) => {
                const isActive = selectedPlatforms.includes(option.value);
                return (
                  <button
                    type="button"
                    key={option.value}
                    className={isActive ? 'chip chip--active' : 'chip'}
                    onClick={() => togglePlatform(option.value)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            {errors.primaryPlatforms?.message && (
              <p className="onboarding-error">{errors.primaryPlatforms.message}</p>
            )}
          </div>

          <div className="onboarding-group">
            <label className="onboarding-label">Content goals</label>
            <Textarea
              placeholder="Increase organic signups, educate new users, build thought leadership..."
              error={errors.contentGoals?.message}
              {...register('contentGoals')}
            />
          </div>

          <div className="onboarding-group">
            <Textarea
              label="Strategic keywords"
              placeholder="SEO automation, content operations, SaaS onboarding..."
              error={errors.seedKeywords?.message}
              {...register('seedKeywords')}
            />
          </div>

          <div className="onboarding-group onboarding-grid">
            <Input
              label="Tone of voice"
              placeholder="E.g. Professional, friendly, inspirational"
              error={errors.toneOfVoice?.message}
              {...register('toneOfVoice')}
            />
            <Input
              label="Target audience"
              placeholder="Founders, marketing managers, product teams..."
              error={errors.targetAudience?.message}
              {...register('targetAudience')}
            />
            <Select
              label="Publishing cadence"
              options={CADENCE_OPTIONS}
              error={errors.publishingCadence?.message}
              {...register('publishingCadence')}
            />
          </div>

          <div className="onboarding-group">
            <Textarea
              label="Audience pain points"
              placeholder="Slow production cycles, limited marketing bandwidth, inconsistent messaging..."
              error={errors.audiencePainPoints?.message}
              {...register('audiencePainPoints')}
            />
          </div>

          <div className="onboarding-group onboarding-grid">
            <Input
              label="Primary region or market"
              placeholder="Global, North America, DACH..."
              error={errors.primaryRegion?.message}
              {...register('primaryRegion')}
            />
            <Input
              label="Seasonal focus (optional)"
              placeholder="Q4 launches, Back-to-school, Evergreen"
              error={errors.seasonalFocus?.message}
              {...register('seasonalFocus')}
            />
          </div>

          <div className="onboarding-group onboarding-toggle">
            <label className="onboarding-label">Include trend-based topic ideas</label>
            <label className="onboarding-checkbox">
              <input type="checkbox" {...register('includeTrends')} />
              <span>Keep an eye on news and trending angles</span>
            </label>
          </div>

          <div className="onboarding-group">
            <label className="onboarding-label">Content types you produce most</label>
            <div className="onboarding-chip-row">
              {CONTENT_FOCUS_OPTIONS.map((option) => {
                const isActive = selectedContentTypes.includes(option);
                return (
                  <button
                    type="button"
                    key={option}
                    className={isActive ? 'chip chip--active' : 'chip'}
                    onClick={() => toggleContentType(option)}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            {errors.preferredContentTypes?.message && (
              <p className="onboarding-error">{errors.preferredContentTypes.message}</p>
            )}
          </div>

          <div className="onboarding-group">
            <Textarea
              label="Anything else we should know?"
              placeholder="Share campaign objectives, brand guidelines, or other notes."
              error={errors.additionalNotes?.message}
              {...register('additionalNotes')}
            />
          </div>
        </section>

        {submitError && <div className="onboarding-alert onboarding-alert--error">{submitError}</div>}

        <div className="onboarding-actions">
          <Button type="submit" size="lg" isLoading={isSubmitting} rightIcon={<FiArrowRight />}>
            Save &amp; continue to dashboard
          </Button>
        </div>
      </form>
    </div>
  );
}
