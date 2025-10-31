import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useOnboarding } from '@/hooks/useOnboarding';
import { FullScreenLoader } from '@/components/common/FullScreenLoader';

export function ProtectedRoute() {
  const { user, initializing } = useAuth();
  const { isOnboarded } = useOnboarding();
  const location = useLocation();

  if (initializing) {
    return <FullScreenLoader message="Preparing your workspace..." />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const isOnOnboardingRoute = location.pathname === '/onboarding';

  if (!isOnboarded && !isOnOnboardingRoute) {
    return <Navigate to="/onboarding" replace />;
  }

  if (isOnboarded && isOnOnboardingRoute) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
