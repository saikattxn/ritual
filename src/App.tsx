import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider';
import { isConfigured } from './lib/supabase';
import { AppShell, FullScreen } from './components/layout/AppShell';
import { LoadingBlock } from './components/ui';
import { ConfigError } from './features/auth/ConfigError';
import { SignIn, SignUp, ForgotPassword, ResetPassword } from './features/auth/AuthPages';

const Dashboard = lazy(() => import('./features/dashboard/DashboardPage'));
const Skincare = lazy(() => import('./features/care/SkincarePage'));
const HairCare = lazy(() => import('./features/care/HairCarePage'));
const Habits = lazy(() => import('./features/habits/HabitsPage'));
const Workouts = lazy(() => import('./features/workouts/WorkoutsPage'));
const TemplateBuilder = lazy(() => import('./features/workouts/TemplateBuilder'));
const SessionMode = lazy(() => import('./features/workouts/SessionMode'));
const Progress = lazy(() => import('./features/progress/ProgressPage'));
const CalendarPage = lazy(() => import('./features/calendar/CalendarPage'));
const Settings = lazy(() => import('./features/settings/SettingsPage'));

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, recovering } = useAuth();
  const loc = useLocation();
  if (loading) return <FullScreen><LoadingBlock /></FullScreen>;
  if (recovering) return <Navigate to="/reset-password" replace />;
  if (!user) return <Navigate to="/signin" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreen><LoadingBlock /></FullScreen>;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function App() {
  if (!isConfigured) return <ConfigError />;
  return (
    <Suspense fallback={<FullScreen><LoadingBlock /></FullScreen>}>
      <Routes>
        <Route path="/signin" element={<PublicOnly><SignIn /></PublicOnly>} />
        <Route path="/signup" element={<PublicOnly><SignUp /></PublicOnly>} />
        <Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route index element={<Dashboard />} />
          <Route path="skincare" element={<Skincare />} />
          <Route path="hair" element={<HairCare />} />
          <Route path="habits" element={<Habits />} />
          <Route path="workouts" element={<Workouts />} />
          <Route path="workouts/templates/:id" element={<TemplateBuilder />} />
          <Route path="workouts/session/:id" element={<SessionMode />} />
          <Route path="progress" element={<Progress />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="settings" element={<Navigate to="/settings/profile" replace />} />
          <Route path="settings/:section" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-3xl">Page not found</h1>
      <p className="mt-2 text-ink-500">That page doesn’t exist. Use the menu to find your way back.</p>
    </div>
  );
}
