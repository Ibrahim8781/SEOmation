import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FiBriefcase, FiGlobe, FiLock, FiMail, FiUser } from 'react-icons/fi';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useAuth } from '@/hooks/useAuth';
import { extractErrorMessage } from '@/utils/error';
import {
  LANGUAGE_OPTIONS,
  TIMEZONE_OPTIONS
} from '@/utils/constants';
import { registerSchema, type RegisterFormValues } from '@/validation/authSchemas';
import './auth.css';

const LANGUAGE_SELECT_OPTIONS = LANGUAGE_OPTIONS.map((option) => ({
  label: option.label,
  value: option.value
}));

const TIMEZONE_SELECT_OPTIONS = TIMEZONE_OPTIONS.map((tz) => ({
  label: tz,
  value: tz
}));

export function SignupPage() {
  const navigate = useNavigate();
  const { register: registerUser, authLoading } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      name: '',
      company: '',
      niche: '',
      timezone: TIMEZONE_OPTIONS[0],
      language: LANGUAGE_OPTIONS[0].value
    }
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setFormError(null);
    try {
      await registerUser(values);
      navigate('/onboarding', { replace: true });
    } catch (error) {
      setFormError(extractErrorMessage(error, 'Unable to create account. Please try again.'));
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-page__panel auth-page__panel--primary">
        <div className="auth-brand">
          <div className="auth-logo">SEO</div>
          <span>SEOmation</span>
        </div>
        <h1>Launch your AI-assisted content engine</h1>
        <p>
          Join SEOmation to transform your content operations with AI-assisted ideation, topic generation,
          and performance tracking tailored to your brand.
        </p>
        <div className="auth-illustration">
          <div className="auth-illustration__overlay">
            <span className="auth-highlight">🚀 Onboard new users in minutes</span>
            <strong>From briefing to publication without the busywork.</strong>
          </div>
        </div>
      </div>

      <div className="auth-page__panel auth-page__panel--form">
        <div className="auth-form">
          <h2>Create your account</h2>
          <p className="auth-form__subtitle">
            Tell us a bit about yourself so we can tailor the experience to your goals.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="auth-form__fields">
            <Input
              label="Full name"
              placeholder="Ali Ahmed"
              leftIcon={<FiUser />}
              error={errors.name?.message}
              {...register('name')}
            />

            <Input
              label="Work email"
              placeholder="you@company.com"
              type="email"
              leftIcon={<FiMail />}
              error={errors.email?.message}
              {...register('email')}
            />

            <Input
              label="Password"
              placeholder="Create a strong password"
              type="password"
              leftIcon={<FiLock />}
              helperText="Use at least 8 characters, including upper/lowercase letters and a number."
              error={errors.password?.message}
              {...register('password')}
            />

            <Input
              label="Company / Brand"
              placeholder="SEOmation"
              leftIcon={<FiBriefcase />}
              error={errors.company?.message}
              {...register('company')}
            />

            <Input
              label="Primary niche"
              placeholder="SaaS SEO, eCommerce, FinTech..."
              leftIcon={<FiGlobe />}
              error={errors.niche?.message}
              {...register('niche')}
            />

            <Select
              label="Preferred timezone"
              options={TIMEZONE_SELECT_OPTIONS}
              error={errors.timezone?.message}
              {...register('timezone')}
            />

            <Select
              label="Content language"
              options={LANGUAGE_SELECT_OPTIONS}
              error={errors.language?.message}
              {...register('language')}
            />

            {formError && <div className="auth-form__error">{formError}</div>}

            <Button type="submit" size="lg" isLoading={authLoading}>
              Get started
            </Button>
          </form>

          <p className="auth-form__footnote">
            Already onboard? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
