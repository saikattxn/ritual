import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarPlus, Dumbbell, Droplets, Leaf, ListChecks, Moon, Play, Plus, Sparkles, Sun, Target } from 'lucide-react';
import { useProfile, useToday } from '@/api/profile';
import { useRoutineCompletions, useRoutineItems } from '@/api/care';
import { useHabitCompletions, useHabits, useToggleHabit } from '@/api/habits';
import { usePlanned, useTemplates } from '@/api/fitness';
import { useActiveSession, useCompletedSessions, useStartSession } from '@/api/sessions';
import { Badge, Button, Card, CardHeader, CheckRow, ErrorBlock, ProgressRing, Skeleton } from '@/components/ui';
import { useToast } from '@/components/ui/feedback';
import { addDays, dateRange, formatDate, formatDuration, formatLongDate, hourIn, WEEKDAY_SHORT, weekday } from '@/lib/dates';
import { greeting, messageFor } from '@/lib/messages';
import { completionKey, habitScheduledOn, habitTallies, mergeTallies, rate, routineTallies, type DayTally } from '@/lib/schedule';
import { cn } from '@/lib/cn';
import { RoutineList, useCareDay } from '@/features/care/shared';
import { HabitIcon } from '@/features/habits/HabitsPage';
import type { PlannedWorkout } from '@/types/db';

export default function DashboardPage() {
  const profile = useProfile();
  const today = useToday();
  const weekAgo = addDays(today, -6);
  const skin = useCareDay('skin');
  const hair = useCareDay('hair');
  const allItems = useRoutineItems();
  const recentCompletions = useRoutineCompletions(weekAgo, today);
  const habits = useHabits();
  const habitDone = useHabitCompletions(weekAgo, today);
  const planned = usePlanned(weekAgo, today);
  const active = useActiveSession();
  const toggleHabit = useToggleHabit();
  const toast = useToast();

  const loading = skin.isLoading || hair.isLoading || allItems.isLoading || recentCompletions.isLoading || habits.isLoading || habitDone.isLoading || planned.isLoading;
  const error = skin.error ?? hair.error ?? allItems.error ?? recentCompletions.error ?? habits.error ?? habitDone.error ?? planned.error;

  const todaysHabits = (habits.data ?? []).filter((h) => habitScheduledOn(h, today));
  const doneHabits = useMemo(() => new Set((habitDone.data ?? []).map((c) => completionKey(c.habit_id, c.on_date))), [habitDone.data]);
  const todaysPlans = (planned.data ?? []).filter((p) => p.on_date === today);

  const week = useMemo<DayTally[]>(() => {
    if (!allItems.data || !recentCompletions.data || !habits.data || !habitDone.data || !planned.data) return [];
    const workouts: DayTally[] = dateRange(weekAgo, today).map((d) => {
      const w = planned.data!.filter((p) => p.on_date === d && p.kind === 'workout');
      return { date: d, scheduled: w.length, done: w.filter((p) => p.status === 'completed').length };
    });
    return mergeTallies(
      routineTallies(allItems.data, recentCompletions.data, weekAgo, today),
      habitTallies(habits.data, habitDone.data, weekAgo, today),
      workouts,
    );
  }, [allItems.data, recentCompletions.data, habits.data, habitDone.data, planned.data, weekAgo, today]);

  const todayTally = week.find((t) => t.date === today);
  const todayPct = todayTally && todayTally.scheduled ? Math.round((todayTally.done / todayTally.scheduled) * 100) : null;
  const weekPct = rate(week);
  const activeDays = week.filter((t) => t.scheduled > 0 && t.done > 0).length;

  const hour = hourIn(profile.timezone);
  const firstName = profile.display_name.split(' ')[0];

  if (error) return <ErrorBlock error={error} onRetry={() => window.location.reload()} />;

  return (
    <div className="space-y-6">
      <section className="animate-fade-up">
        <p className="eyebrow">{formatLongDate(today)}</p>
        <h1 className="mt-1 text-3xl sm:text-4xl">{greeting(hour)}, {firstName}</h1>
        <p className="mt-2 text-ink-500 font-serif italic text-lg">{messageFor(today)}</p>
      </section>

      {/* Summary row */}
      <div className="grid gap-4 md:grid-cols-[auto_1fr]">
        <Card className="flex items-center gap-5 md:pr-10">
          {loading ? <Skeleton className="h-24 w-24 rounded-full" /> : (
            <ProgressRing value={todayPct} size={96} stroke={8}>
              <span className="font-serif text-2xl">{todayPct === null ? '—' : `${todayPct}%`}</span>
            </ProgressRing>
          )}
          <div>
            <p className="eyebrow">Today</p>
            <p className="text-lg font-medium">
              {todayTally?.scheduled ? `${todayTally.done} of ${todayTally.scheduled} done` : 'Nothing scheduled yet'}
            </p>
            <p className="text-sm text-ink-500">Skincare, hair, habits and workouts</p>
          </div>
        </Card>
        <Card>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="eyebrow">Last 7 days</p>
              <p className="text-lg font-medium">{weekPct === null ? 'No routines yet' : `${weekPct}% consistency · active ${activeDays} of 7 days`}</p>
            </div>
            <Link to="/progress" className="text-sm text-sage-700 hover:underline whitespace-nowrap">See progress</Link>
          </div>
          {loading ? <Skeleton className="h-16" /> : <WeekBars week={week} today={today} />}
        </Card>
      </div>

      <QuickActions />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader icon={<Sparkles className="h-[18px] w-[18px]" />} title="Skincare" eyebrow="Today"
            action={<Link to="/skincare" className="text-sm text-sage-700 hover:underline">Open</Link>} />
          {skin.isLoading || !skin.data ? <Skeleton className="h-32" /> : skin.data.entries.length === 0 ? (
            <EmptyMini text="No skincare steps today." to="/skincare?new=1" cta="Add a product" />
          ) : (
            <div className="space-y-4">
              {(['morning', 'evening'] as const).map((slot) => {
                const list = skin.data!.entries.filter((e) => e.item.slot === slot);
                if (!list.length) return null;
                const isNow = slot === 'morning' ? hour < 15 : hour >= 15;
                return (
                  <div key={slot}>
                    <p className={cn('flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mb-1', isNow ? 'text-sage-700' : 'text-ink-400')}>
                      {slot === 'morning' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                      {slot} · {list.filter((e) => e.done).length}/{list.length}
                    </p>
                    <RoutineList entries={list} date={today} today={today} emptyText="" />
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <WorkoutCard plans={todaysPlans} loading={planned.isLoading || active.isLoading} activeId={active.data?.id ?? null} today={today} />

          <Card>
            <CardHeader icon={<Droplets className="h-[18px] w-[18px]" />} title="Hair care" eyebrow="Today"
              action={<Link to="/hair" className="text-sm text-sage-700 hover:underline">Open</Link>} />
            {hair.isLoading || !hair.data ? <Skeleton className="h-20" /> : hair.data.entries.length === 0 ? (
              <EmptyMini text="Nothing planned for your hair today." to="/hair" cta="Set up hair care" />
            ) : (
              <RoutineList entries={hair.data.entries} date={today} today={today} emptyText="" />
            )}
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader icon={<ListChecks className="h-[18px] w-[18px]" />} title="Habits" eyebrow="Today"
          action={<Link to="/habits" className="text-sm text-sage-700 hover:underline">Manage</Link>} />
        {habits.isLoading ? <Skeleton className="h-20" /> : todaysHabits.length === 0 ? (
          <EmptyMini text={(habits.data ?? []).some((h) => !h.archived_on) ? 'No habits scheduled today.' : 'Habits are optional — add one if it helps.'} to="/habits" cta="Add a habit" />
        ) : (
          <ul className="-mx-2 grid sm:grid-cols-2 gap-x-6">
            {todaysHabits.map((h) => {
              const done = doneHabits.has(completionKey(h.id, today));
              return (
                <li key={h.id}>
                  <CheckRow checked={done} title={h.name}
                    onToggle={() => toggleHabit.mutate({ habitId: h.id, date: today, done: !done }, { onError: (e) => toast.error(e) })}
                    trailing={<span className="text-sage-600"><HabitIcon name={h.icon} /></span>} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function WeekBars({ week, today }: { week: DayTally[]; today: string }) {
  return (
    <div className="grid grid-cols-7 gap-2 items-end h-20" role="img"
      aria-label={week.map((t) => `${WEEKDAY_SHORT[weekday(t.date)]}: ${t.scheduled ? `${t.done} of ${t.scheduled}` : 'nothing scheduled'}`).join('; ')}>
      {week.map((t) => {
        const pct = t.scheduled ? t.done / t.scheduled : 0;
        return (
          <div key={t.date} className="flex flex-col items-center gap-1 h-full justify-end">
            <div className="w-full max-w-[36px] flex-1 flex items-end rounded-lg bg-sage-50">
              <div className={cn('w-full rounded-lg transition-all duration-700', t.scheduled ? 'bg-sage-500' : 'bg-transparent')}
                style={{ height: `${Math.max(t.scheduled ? 6 : 0, pct * 100)}%` }} />
            </div>
            <span className={cn('text-[11px]', t.date === today ? 'font-semibold text-sage-800' : 'text-ink-400')}>{WEEKDAY_SHORT[weekday(t.date)].slice(0, 2)}</span>
          </div>
        );
      })}
    </div>
  );
}

function QuickActions() {
  const actions = [
    { to: '/skincare?new=1', label: 'Add a product', icon: Plus },
    { to: '/workouts?start=1', label: 'Log a workout', icon: Dumbbell },
    { to: '/workouts?tab=plan', label: 'Plan the week', icon: CalendarPlus },
    { to: '/workouts?tab=body', label: 'Update a goal', icon: Target },
  ];
  return (
    <nav aria-label="Quick actions" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {actions.map(({ to, label, icon: Icon }) => (
        <Link key={to} to={to} className="card flex items-center gap-3 px-4 py-3.5 hover:shadow-lift hover:-translate-y-0.5 transition">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-clay-100 text-clay-700"><Icon className="h-4 w-4" /></span>
          <span className="text-sm font-medium">{label}</span>
        </Link>
      ))}
    </nav>
  );
}

function EmptyMini({ text, to, cta }: { text: string; to: string; cta: string }) {
  return (
    <div className="flex flex-col items-start gap-3 py-2">
      <p className="text-sm text-ink-500">{text}</p>
      <Link to={to} className="text-sm font-medium text-sage-700 hover:underline">{cta} →</Link>
    </div>
  );
}

function WorkoutCard({ plans, loading, activeId, today }: { plans: PlannedWorkout[]; loading: boolean; activeId: string | null; today: string }) {
  const nav = useNavigate();
  const templates = useTemplates();
  const logged = (useCompletedSessions(today, today).data ?? []).filter((s) => !s.planned_workout_id);
  const start = useStartSession();
  const toast = useToast();
  const workouts = plans.filter((p) => p.kind === 'workout');
  const rest = plans.some((p) => p.kind === 'rest');

  const begin = async (p: PlannedWorkout) => {
    try {
      const template = templates.data?.find((t) => t.id === p.template_id) ?? null;
      const s = await start.mutateAsync({ template, planned: p, today });
      nav(`/workouts/session/${s.id}`);
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <Card>
      <CardHeader icon={<Dumbbell className="h-[18px] w-[18px]" />} title="Workout" eyebrow="Today"
        action={<Link to="/workouts" className="text-sm text-sage-700 hover:underline">Open</Link>} />
      {loading ? <Skeleton className="h-16" /> : activeId ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-sage-50 p-4">
          <p className="text-sm">You have a workout in progress.</p>
          <Button size="sm" icon={<Play className="h-4 w-4" />} onClick={() => nav(`/workouts/session/${activeId}`)}>Resume</Button>
        </div>
      ) : workouts.length > 0 ? (
        <ul className="space-y-2">
          {workouts.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 rounded-2xl border border-sage-100 bg-white/60 p-3.5">
              <div className="min-w-0">
                <p className="font-medium truncate">{p.title}</p>
                <p className="text-xs text-ink-500">{p.planned_minutes ? `${p.planned_minutes} min · ` : ''}{formatDate(today)}</p>
              </div>
              {p.status === 'completed' ? <Badge>Done</Badge>
                : p.status === 'skipped' ? <Badge tone="ink">Skipped</Badge>
                : <Button size="sm" icon={<Play className="h-4 w-4" />} loading={start.isPending} onClick={() => begin(p)}>Start</Button>}
            </li>
          ))}
        </ul>
      ) : logged.length > 0 ? (
        <ul className="space-y-2">
          {logged.map((s) => (
            <li key={s.id}>
              <Link to={`/workouts/session/${s.id}`} className="flex items-center justify-between gap-3 rounded-2xl bg-sage-50 p-3.5 hover:bg-sage-100">
                <span className="font-medium truncate">{s.title}</span>
                <Badge>Logged · {formatDuration(s.active_seconds)}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      ) : rest ? (
        <div className="flex items-center gap-3 rounded-2xl bg-sage-50 p-4">
          <Leaf className="h-5 w-5 text-sage-600" />
          <p className="text-sm">Rest and recovery day. Gentle movement is welcome, rest is too.</p>
        </div>
      ) : (
        <EmptyMini text="No workout planned for today." to="/workouts?tab=plan" cta="Plan your week" />
      )}
    </Card>
  );
}
