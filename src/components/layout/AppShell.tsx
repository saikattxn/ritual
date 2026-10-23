import { Suspense, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BarChart3, CalendarDays, Dumbbell, LayoutDashboard, ListChecks, LogOut, Menu, Scissors, Settings, Sparkles, X,
} from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { useProfileQuery, useSignedUrl } from '@/api/profile';
import { AVATAR_BUCKET } from '@/api/body';
import { Button, ErrorBlock, LoadingBlock } from '@/components/ui';
import { cn } from '@/lib/cn';
import { Logo } from './Logo';
import { useReminders } from '@/lib/reminders';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/skincare', label: 'Skincare', icon: Sparkles },
  { to: '/hair', label: 'Hair Care', icon: Scissors },
  { to: '/workouts', label: 'Workouts', icon: Dumbbell },
  { to: '/progress', label: 'Progress', icon: BarChart3 },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/habits', label: 'Habits', icon: ListChecks },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const MOBILE_PRIMARY = ['/', '/skincare', '/hair', '/workouts'];

export function Avatar({ path, name, size = 36 }: { path: string | null; name: string; size?: number }) {
  const { data: url } = useSignedUrl(AVATAR_BUCKET, path);
  const initials = name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '·';
  return url ? (
    <img src={url} alt="" className="rounded-full object-cover bg-sage-100" style={{ width: size, height: size }} />
  ) : (
    <div className="grid place-items-center rounded-full bg-sage-200 text-sage-800 font-medium" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden>
      {initials}
    </div>
  );
}

function ShellBody() {
  useReminders();
  return (
    <Suspense fallback={<LoadingBlock />}>
      <Outlet />
    </Suspense>
  );
}

export function AppShell() {
  const { signOut } = useAuth();
  const profile = useProfileQuery();
  const [moreOpen, setMoreOpen] = useState(false);
  const loc = useLocation();

  if (profile.isLoading) return <FullScreen><LoadingBlock label="Opening your Ritual…" /></FullScreen>;
  if (profile.error || !profile.data)
    return (
      <FullScreen>
        <div className="max-w-md w-full space-y-4">
          <ErrorBlock error={profile.error ?? new Error('Could not load your profile.')} onRetry={() => profile.refetch()} />
          <Button variant="ghost" className="w-full" onClick={signOut}>Sign out</Button>
        </div>
      </FullScreen>
    );

  const p = profile.data;
  const isActive = (to: string) => (to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(to));

  return (
    <div className="min-h-screen lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:shadow">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:sticky lg:top-0 lg:h-screen border-r border-sage-100 bg-cream-50/70 px-4 py-6">
        <div className="px-2 mb-8"><Logo /></div>
        <nav aria-label="Main" className="flex-1 space-y-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive: a }) => cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition',
                a ? 'bg-sage-100 text-sage-900 font-medium' : 'text-ink-700 hover:bg-sage-50',
              )}>
              <Icon className="h-[18px] w-[18px]" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-6 flex items-center gap-3 rounded-2xl bg-white/70 p-3 border border-sage-100">
          <Avatar path={p.avatar_path} name={p.display_name} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{p.display_name}</p>
            <NavLink to="/settings/profile" className="text-xs text-ink-500 hover:text-sage-700">Edit profile</NavLink>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out" title="Sign out"><LogOut className="h-4 w-4" /></Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between border-b border-sage-100 bg-cream-100/90 backdrop-blur px-4 h-14">
        <Logo compact />
        <NavLink to="/settings/profile" aria-label="Your profile"><Avatar path={p.avatar_path} name={p.display_name} size={32} /></NavLink>
      </header>

      <main id="main" className="flex-1 min-w-0 px-4 sm:px-6 lg:px-10 pt-6 lg:pt-10 pb-28 lg:pb-12">
        <div className="mx-auto max-w-6xl">
          <ShellBody />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav aria-label="Main" className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-sage-100 bg-cream-50/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5">
          {NAV.filter((n) => MOBILE_PRIMARY.includes(n.to)).map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive: a }) => cn('flex flex-col items-center gap-0.5 py-2.5 text-[11px]', a ? 'text-sage-800 font-medium' : 'text-ink-500')}>
              <Icon className="h-5 w-5" aria-hidden />
              {label.replace(' Care', '')}
            </NavLink>
          ))}
          <button type="button" onClick={() => setMoreOpen(true)} aria-haspopup="dialog" aria-expanded={moreOpen}
            className={cn('flex flex-col items-center gap-0.5 py-2.5 text-[11px]',
              NAV.some((n) => !MOBILE_PRIMARY.includes(n.to) && isActive(n.to)) ? 'text-sage-800 font-medium' : 'text-ink-500')}>
            <Menu className="h-5 w-5" aria-hidden />
            More
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="More pages"
          onKeyDown={(e) => e.key === 'Escape' && setMoreOpen(false)}>
          <div className="absolute inset-0 bg-ink-900/30" onClick={() => setMoreOpen(false)} aria-hidden />
          <div className="absolute bottom-0 inset-x-0 rounded-t-3xl bg-cream-50 p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-lift animate-fade-up">
            <div className="flex items-center justify-between mb-2 px-2">
              <p className="eyebrow">More</p>
              <Button variant="ghost" size="icon" aria-label="Close menu" onClick={() => setMoreOpen(false)} autoFocus><X className="h-5 w-5" /></Button>
            </div>
            <div className="grid gap-1">
              {NAV.filter((n) => !MOBILE_PRIMARY.includes(n.to)).map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} onClick={() => setMoreOpen(false)}
                  className={({ isActive: a }) => cn('flex items-center gap-3 rounded-xl px-3 py-3 text-[15px]', a ? 'bg-sage-100 font-medium' : 'hover:bg-sage-50')}>
                  <Icon className="h-5 w-5 text-sage-700" aria-hidden /> {label}
                </NavLink>
              ))}
              <button type="button" onClick={() => { setMoreOpen(false); signOut(); }}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] text-clay-700 hover:bg-clay-100/50">
                <LogOut className="h-5 w-5" aria-hidden /> Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function FullScreen({ children }: { children: ReactNode }) {
  return <div className="min-h-screen grid place-items-center p-6">{children}</div>;
}
