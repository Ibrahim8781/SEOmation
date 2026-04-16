import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FiBriefcase, FiEye, FiEyeOff, FiGlobe, FiLock, FiMail, FiUser } from 'react-icons/fi';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useAuth } from '@/hooks/useAuth';
import { extractErrorMessage } from '@/utils/error';
import { LANGUAGE_OPTIONS, TIMEZONE_OPTIONS } from '@/utils/constants';
import { registerSchema, type RegisterFormValues } from '@/validation/authSchemas';
import brandLogo from '@/assets/logo.png';
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
  const [logoFailed, setLogoFailed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="auth-page auth-page--signup">
      <div className="auth-page__panel auth-page__panel--primary">
        <div className="auth-brand">
          {/* Replace this imported logo file with your actual logo asset path */}
          {!logoFailed && (
            <img
              src={brandLogo}
              alt="SEOmation Logo"
              className="brand-logo"
              onError={(event) => {
                setLogoFailed(true);
                event.currentTarget.style.display = 'none';
                const fallback = document.getElementById('seo-fallback');
                if (fallback) fallback.style.display = 'flex';
              }}
            />
          )}
          <div id="seo-fallback" className="auth-logo" style={{ display: logoFailed ? 'flex' : 'none' }}>
            SEO
          </div>
          <span>SEOmation</span>
        </div>

        <div className="auth-primary-copy">
          <h1>Launch your AI-assisted content engine</h1>
          <p>
            Join SEOmation to transform your content operations with AI-assisted ideation, topic generation,
            and performance tracking tailored to your brand.
          </p>
        </div>

        <div className="auth-illustration">
          <div className="auth-illustration__overlay">
            <span className="auth-highlight">
              <svg
                className="auth-highlight__icon"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden
              >
                <path
                  d="M14.5 9.5L12 12M10.5 13.5L8 16M7 17L4 20M16.5 7.5L19 5M14 4C18 4 20 6 20 10C20 13 18 16 15 19L5 9C8 6 11 4 14 4Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M12 8L16 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <span>Onboard new users in minutes</span>
            </span>
            <strong>From briefing to publication without the busywork.</strong>
          </div>
        </div>
      </div>

      <div className="auth-page__panel auth-page__panel--form">
        <div className="auth-form auth-form--signup">
          <div className="auth-form__title-block">
            <h2>Create your account</h2>
            <p className="auth-form__subtitle">
              Tell us a bit about yourself so we can tailor the experience to your goals.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="auth-form__fields auth-form__fields--signup">
            <div className="auth-form__row">
              <Input
                label="Full name"
                placeholder="Ali Ahmed"
                leftIcon={<FiUser />}
                error={errors.name?.message}
                autoComplete="name"
                {...register('name')}
              />

              <Input
                label="Work email"
                placeholder="you@company.com"
                type="email"
                leftIcon={<FiMail />}
                error={errors.email?.message}
                autoComplete="email"
                {...register('email')}
              />
            </div>

            <Input
              label="Password"
              placeholder="Create a strong password"
              type={showPassword ? 'text' : 'password'}
              leftIcon={<FiLock />}
              rightIcon={
                <button
                  type="button"
                  className="auth-password-toggle"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              }
              helperText="Use at least 8 characters, including upper/lowercase letters and a number. Passwords must stay within bcrypt's 72-byte limit."
              error={errors.password?.message}
              autoComplete="new-password"
              className="auth-password-field"
              {...register('password')}
            />

            <div className="auth-form__row">
              <Input
                label="Company / Brand"
                placeholder="SEOmation"
                leftIcon={<FiBriefcase />}
                error={errors.company?.message}
                autoComplete="organization"
                {...register('company')}
              />

              <Input
                label="Primary niche"
                placeholder="e.g. SaaS SEO, eCommerce, FinTech"
                leftIcon={<FiGlobe />}
                error={errors.niche?.message}
                autoComplete="organization-title"
                {...register('niche')}
              />
            </div>

            <div className="auth-form__row">
              <Select
                label="Preferred timezone"
                options={TIMEZONE_SELECT_OPTIONS}
                error={errors.timezone?.message}
                autoComplete="off"
                {...register('timezone')}
              />

              <Select
                label="Content language"
                options={LANGUAGE_SELECT_OPTIONS}
                error={errors.language?.message}
                autoComplete="off"
                {...register('language')}
              />
            </div>

            {formError && <div className="auth-form__error">{formError}</div>}

            <Button type="submit" size="lg" isLoading={authLoading} className="auth-submit-button">
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
