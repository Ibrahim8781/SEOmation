import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { DashboardPage } from '@/pages/Dashboard/DashboardPage';
import { BlogWriterPage } from '@/pages/BlogWriter/BlogWriterPage';
import { LoginPage } from '@/pages/Auth/LoginPage';
import { SignupPage } from '@/pages/Auth/SignupPage';
import { OnboardingPage } from '@/pages/Onboarding/OnboardingPage';
import { ContentListPage } from '@/pages/Content/ContentListPage';
import { ContentEditorPage } from '@/pages/Content/ContentEditorPage';
import { IntegrationsPage } from '@/pages/Settings/IntegrationsPage';
import { SchedulePage } from '@/pages/Schedule/SchedulePage';

export default function App() {
  return (
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
  );
}
