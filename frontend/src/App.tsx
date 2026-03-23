import { Suspense, lazy, useEffect, useRef } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { FullScreenLoader } from '@/components/common/FullScreenLoader';

const AppLayout = lazy(() => import('@/components/layout/AppLayout').then((module) => ({ default: module.AppLayout })));
const DashboardPage = lazy(() =>
  import('@/pages/Dashboard/DashboardPage').then((module) => ({ default: module.DashboardPage }))
);
const BlogWriterPage = lazy(() =>
  import('@/pages/BlogWriter/BlogWriterPage').then((module) => ({ default: module.BlogWriterPage }))
);
const LoginPage = lazy(() => import('@/pages/Auth/LoginPage').then((module) => ({ default: module.LoginPage })));
const SignupPage = lazy(() => import('@/pages/Auth/SignupPage').then((module) => ({ default: module.SignupPage })));
const OnboardingPage = lazy(() =>
  import('@/pages/Onboarding/OnboardingPage').then((module) => ({ default: module.OnboardingPage }))
);
const ContentListPage = lazy(() =>
  import('@/pages/Content/ContentListPage').then((module) => ({ default: module.ContentListPage }))
);
const ContentEditorPage = lazy(() =>
  import('@/pages/Content/ContentEditorPage').then((module) => ({ default: module.ContentEditorPage }))
);
const IntegrationsPage = lazy(() =>
  import('@/pages/Settings/IntegrationsPage').then((module) => ({ default: module.IntegrationsPage }))
);
const SchedulePage = lazy(() =>
  import('@/pages/Schedule/SchedulePage').then((module) => ({ default: module.SchedulePage }))
);

const LAST_ROUTE_KEY = 'seomation:last-route';

function RouteRestore() {
  const location = useLocation();
  const navigate = useNavigate();
  const restoreAttemptedRef = useRef(false);

  useEffect(() => {
    if (restoreAttemptedRef.current) return;
    restoreAttemptedRef.current = true;

    if (location.pathname !== '/') return;

    const params = new URLSearchParams(location.search);
    const integrationStatus = params.get('integration_status');
    const integrationPlatform = params.get('platform');
    if (integrationStatus && integrationPlatform) {
      navigate(`/settings/integrations${location.search}`, { replace: true });
      return;
    }

    const navigationEntry = performance.getEntriesByType('navigation')[0];
    const navigationType =
      navigationEntry && 'type' in navigationEntry ? navigationEntry.type : undefined;
    if (navigationType !== 'reload') return;

    const lastRoute = sessionStorage.getItem(LAST_ROUTE_KEY) || '';
    if (
      !lastRoute ||
      lastRoute === '/' ||
      lastRoute.startsWith('/onboarding') ||
      lastRoute.startsWith('/login') ||
      lastRoute.startsWith('/signup')
    ) {
      return;
    }

    navigate(lastRoute, { replace: true });
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    if (
      location.pathname === '/onboarding' ||
      location.pathname.startsWith('/login') ||
      location.pathname.startsWith('/signup')
    ) {
      return;
    }

    const currentRoute = `${location.pathname}${location.search}${location.hash}`;
    sessionStorage.setItem(LAST_ROUTE_KEY, currentRoute);
  }, [location.hash, location.pathname, location.search]);

  return null;
}

export default function App() {
  return (
    <Suspense fallback={<FullScreenLoader message="Loading app..." />}>
      <RouteRestore />
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="writer" element={<BlogWriterPage />} />
            <Route path="content" element={<ContentListPage />} />
            <Route path="content/:id" element={<ContentEditorPage />} />
            <Route path="settings/integrations" element={<IntegrationsPage />} />
            <Route path="schedule" element={<SchedulePage />} />
          </Route>
          <Route path="/onboarding" element={<OnboardingPage />} />
        </Route>

        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
