import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FiEye, FiEyeOff, FiLock, FiMail } from 'react-icons/fi';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/hooks/useAuth';
import { extractErrorMessage } from '@/utils/error';
import { loginSchema, type LoginFormValues } from '@/validation/authSchemas';
import brandLogo from '@/assets/logo.png';
import './auth.css';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, authLoading } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  });

  useEffect(() => {
    const sessionExpired = window.sessionStorage.getItem('session_expired');
    if (sessionExpired === '1') {
      setFormError('Your session expired. Please log in again.');
      window.sessionStorage.removeItem('session_expired');
    }
  }, []);

  const onSubmit = async (values: LoginFormValues) => {
    setFormError(null);
    try {
      await login(values);
      const redirectPath = (location.state as { from?: Location })?.from?.pathname ?? '/';
      navigate(redirectPath, { replace: true });
    } catch (error) {
      setFormError(extractErrorMessage(error, 'Unable to sign in. Please try again.'));
    }
  };

  return (
    <div className="auth-page auth-page--login">
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
                const fallback = document.getElementById('seo-fallback-login');
                if (fallback) fallback.style.display = 'flex';
              }}
            />
          )}
          <div
            id="seo-fallback-login"
            className="auth-logo"
            style={{ display: logoFailed ? 'flex' : 'none' }}
          >
            SEO
          </div>
          <span>SEOmation</span>
        </div>

        <div className="auth-primary-copy">
          <h1>Create engaging content faster</h1>
          <p>
            Log in to access AI-powered topic suggestions, SEO-optimized writing workflows, and analytics that
            keep your content strategy ahead of the curve.
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
                  d="M12 3L14.6 8.2L20.3 9L16.1 13L17.1 18.7L12 16L6.9 18.7L7.9 13L3.7 9L9.4 8.2L12 3Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Trusted by marketing teams worldwide</span>
            </span>
            <strong>Content automation made delightful.</strong>
          </div>
        </div>
      </div>

      <div className="auth-page__panel auth-page__panel--form">
        <div className="auth-form auth-form--login">
          <div className="auth-form__title-block">
            <h2>Welcome back</h2>
            <p className="auth-form__subtitle">Sign in to continue crafting high-performing content.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="auth-form__fields auth-form__fields--login">
            <Input
              label="Email address"
              placeholder="you@email.com"
              type="email"
              leftIcon={<FiMail />}
              error={errors.email?.message}
              autoComplete="email"
              {...register('email')}
            />
            <Input
              label="Password"
              placeholder="Enter your password"
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
              error={errors.password?.message}
              autoComplete="current-password"
              {...register('password')}
            />

            <div className="auth-forgot-wrap">
              <Link to="/forgot-password" className="auth-forgot-link">
                Forgot password?
              </Link>
            </div>

            {formError && <div className="auth-form__error">{formError}</div>}

            <Button type="submit" size="lg" isLoading={authLoading} className="auth-login-submit">
              Log in
            </Button>
          </form>

          <p className="auth-form__footnote">
            Don&apos;t have an account? <Link to="/signup">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
