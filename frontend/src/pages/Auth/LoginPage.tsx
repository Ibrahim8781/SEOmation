import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FiLock, FiMail } from 'react-icons/fi';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/hooks/useAuth';
import { extractErrorMessage } from '@/utils/error';
import { loginSchema, type LoginFormValues } from '@/validation/authSchemas';
import './auth.css';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, authLoading } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
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
    <div className="auth-page">
      <div className="auth-page__panel auth-page__panel--primary">
        <div className="auth-brand">
          <div className="auth-logo">SEO</div>
          <span>SEOmation</span>
        </div>
        <h1>Create engaging content faster</h1>
        <p>
          Log in to access AI-powered topic suggestions, SEO-optimized writing workflows, and analytics that
          keep your content strategy ahead of the curve.
        </p>
        <div className="auth-illustration">
          <div className="auth-illustration__overlay">
            <span className="auth-highlight">✨ Trusted by marketing teams worldwide</span>
            <strong>Content automation made delightful.</strong>
          </div>
        </div>
      </div>

      <div className="auth-page__panel auth-page__panel--form">
        <div className="auth-form">
          <h2>Welcome back</h2>
          <p className="auth-form__subtitle">Sign in to continue crafting high-performing content.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="auth-form__fields">
            <Input
              label="Email address"
              placeholder="you@email.com"
              type="email"
              leftIcon={<FiMail />}
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Password"
              placeholder="Enter your password"
              type="password"
              leftIcon={<FiLock />}
              error={errors.password?.message}
              {...register('password')}
            />

            {formError && <div className="auth-form__error">{formError}</div>}

            <Button type="submit" size="lg" isLoading={authLoading}>
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
