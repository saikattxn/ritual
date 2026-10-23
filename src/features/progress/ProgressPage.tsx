import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3 } from 'lucide-react';
import { useRoutineCompletions, useRoutineItems } from '@/api/care';
import { useHabitCompletions, useHabits } from '@/api/habits';
import { usePlanned } from '@/api/fitness';
import { useCompletedSessions } from '@/api/sessions';
import { useProfile, useToday } from '@/api/profile';
import { Card, CardHeader, EmptyState, ErrorBlock, PageHeader, Segmented, Skeleton, Stat, TextField } from '@/components/ui';
import { addDays, dateRange, diffDays, formatDate, formatDuration, startOfWeek, weekday, WEEKDAY_LETTER } from '@/lib/dates';
import { habitTallies, mergeTallies, rate, routineTallies, type DayTally } from '@/lib/schedule';
import { cn } from '@/lib/cn';
import { ExerciseProgress } from '@/features/workouts/History';
import { Goals } from '@/features/workouts/Body';

const COLORS = { skin: '#536f4a', hair: '#c4835c', habits: '#5f8597', workouts: '#42583c', minutes: '#c9d7c2' };

export default function ProgressPage() {
  const today = useToday();
  const { week_starts_on } = useProfile();
  const [range, setRange] = useState<'7' | '30' | '90' | '365' | 'custom'>('30');
  const [customFrom, setCustomFrom] = useState(addDays(today, -29));
  const [customTo, setCustomTo] = useState(today);
  const from = range === 'custom' ? (customFrom <= customTo ? customFrom : customTo) : addDays(today, -Number(range) + 1);
  const to = range === 'custom' ? (customTo >= customFrom ? (customTo > today ? today : customTo) : customFrom) : today;
  const span = diffDays(to, from) + 1;

  const items = useRoutineItems();
  const completions = useRoutineCompletions(from, to);
  const habits = useHabits();
  const habitDone = useHabitCompletions(from, to);
  const planned = usePlanned(from, to);
  const sessions = useCompletedSessions(from, to);
  const error = items.error ?? completions.error ?? habits.error ?? habitDone.error ?? planned.error ?? sessions.error;
  const loading = items.isLoading || completions.isLoading || habits.isLoading || habitDone.isLoading || planned.isLoading || sessions.isLoading;

  const calc = useMemo(() => {
    if (loading || error) return null;
    const skin = routineTallies(items.data!.filter((i) => i.area === 'skin'), completions.data!, from, to);
    const hair = routineTallies(items.data!.filter((i) => i.area === 'hair'), completions.data!, from, to);
    const hab = habitTallies(habits.data!, habitDone.data!, from, to);
    const workoutTallies: DayTally[] = dateRange(from, to).map((d) => {
      const w = planned.data!.filter((p) => p.on_date === d && p.kind === 'workout');
      return { date: d, scheduled: w.length, done: w.filter((p) => p.status === 'completed').length };
    });
    const all = mergeTallies(skin, hair, hab, workoutTallies);

    // Bucket long ranges by week so charts stay readable.
    const weekly = span > 45;
    const bucketKey = (d: string) => (weekly ? startOfWeek(d, week_starts_on) : d);
    const buckets = new Map<string, { skin: DayTally[]; hair: DayTally[]; hab: DayTally[] }>();
    dateRange(from, to).forEach((d, i) => {
      const k = bucketKey(d);
      const b = buckets.get(k) ?? { skin: [], hair: [], hab: [] };
      b.skin.push(skin[i]); b.hair.push(hair[i]); b.hab.push(hab[i]);
      buckets.set(k, b);
    });
    const completionSeries = [...buckets.entries()].map(([k, b]) => ({
      label: formatDate(k), skin: rate(b.skin), hair: rate(b.hair), habits: rate(b.hab),
    }));

    const weeks = new Map<string, { workouts: number; minutes: number }>();
    for (let w = startOfWeek(from, week_starts_on); w <= to; w = addDays(w, 7)) weeks.set(w, { workouts: 0, minutes: 0 });
    for (const s of sessions.data!) {
      const k = startOfWeek(s.on_date, week_starts_on);
      const cur = weeks.get(k) ?? { workouts: 0, minutes: 0 };
      cur.workouts++;
      cur.minutes += Math.round(s.active_seconds / 60);
      weeks.set(k, cur);
    }
    const workoutSeries = [...weeks.entries()].sort().map(([k, v]) => ({ label: formatDate(k), ...v }));
    const totalSeconds = sessions.data!.reduce((a, s) => a + s.active_seconds, 0);

    return {
      skinRate: rate(skin), hairRate: rate(hair), habitRate: rate(hab), overall: rate(all), all,
      completionSeries, workoutSeries, weekly,
      workouts: sessions.data!.length, totalSeconds,
      avg: sessions.data!.length ? totalSeconds / sessions.data!.length : 0,
      hasAnything: all.some((t) => t.scheduled > 0) || sessions.data!.length > 0,
    };
  }, [loading, error, items.data, completions.data, habits.data, habitDone.data, planned.data, sessions.data, from, to, span, week_starts_on]);

  const pct = (v: number | null) => (v === null ? '—' : `${v}%`);

  return (
    <>
      <PageHeader eyebrow="Progress" title="How things are going" subtitle="Every number here comes from what you’ve actually logged. Days with nothing scheduled are left out rather than counted as zero." />
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <Segmented label="Date range" value={range} onChange={setRange} options={[
          { value: '7', label: '7 days' }, { value: '30', label: '30 days' }, { value: '90', label: '90 days' }, { value: '365', label: '1 year' }, { value: 'custom', label: 'Custom' },
        ]} />
        {range === 'custom' && (
          <div className="flex gap-2">
            <TextField label="From" type="date" value={customFrom} max={today} onChange={(e) => setCustomFrom(e.target.value)} />
            <TextField label="To" type="date" value={customTo} max={today} onChange={(e) => setCustomTo(e.target.value)} />
          </div>
        )}
      </div>

      {error ? <ErrorBlock error={error} onRetry={() => window.location.reload()} /> : loading || !calc ? (
        <div className="grid gap-4 sm:grid-cols-3"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      ) : !calc.hasAnything ? (
        <Card><EmptyState icon={<BarChart3 className="h-6 w-6" />} title="Nothing to chart yet">
          Once you add routines, habits or log a workout, your consistency and progress will appear here. No made-up numbers.
        </EmptyState></Card>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Stat label="Overall" value={pct(calc.overall)} hint="of everything scheduled" />
            <Stat label="Skincare" value={pct(calc.skinRate)} />
            <Stat label="Hair care" value={pct(calc.hairRate)} />
            <Stat label="Habits" value={pct(calc.habitRate)} />
            <Stat label="Workouts" value={calc.workouts} hint={calc.workouts ? `avg ${formatDuration(calc.avg)}` : undefined} />
            <Stat label="Training time" value={calc.totalSeconds ? formatDuration(calc.totalSeconds) : '—'} />
          </div>

          <Card>
            <CardHeader title="Activity" eyebrow={`${formatDate(from)} – ${formatDate(to)}`} />
            <Heatmap tallies={calc.all} weekStartsOn={week_starts_on} today={today} />
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title="Routine completion" eyebrow={calc.weekly ? 'Per week, %' : 'Per day, %'} />
              <div className="h-64" role="img" aria-label="Line chart of skincare, hair-care and habit completion percentages">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={calc.completionSeries} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="#e4ebe0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b6860' }} tickLine={false} axisLine={false} minTickGap={16} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#6b6860' }} tickLine={false} axisLine={false} unit="%" />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e4ebe0' }} formatter={(v) => (v === null ? 'Nothing scheduled' : `${v}%`)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line dataKey="skin" name="Skincare" stroke={COLORS.skin} strokeWidth={2} dot={{ r: 2.5 }} connectNulls={false} />
                    <Line dataKey="hair" name="Hair" stroke={COLORS.hair} strokeWidth={2} dot={{ r: 2.5 }} connectNulls={false} />
                    <Line dataKey="habits" name="Habits" stroke={COLORS.habits} strokeWidth={2} dot={{ r: 2.5 }} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card>
              <CardHeader title="Workouts per week" eyebrow="Completed sessions & minutes" />
              <div className="h-64" role="img" aria-label="Bar chart of workouts and training minutes per week">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={calc.workoutSeries} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="#e4ebe0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b6860' }} tickLine={false} axisLine={false} minTickGap={16} />
                    <YAxis yAxisId="l" allowDecimals={false} tick={{ fontSize: 11, fill: '#6b6860' }} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: '#6b6860' }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e4ebe0' }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar yAxisId="l" dataKey="workouts" name="Workouts" fill={COLORS.workouts} radius={[6, 6, 0, 0]} />
                    <Bar yAxisId="r" dataKey="minutes" name="Minutes" fill={COLORS.minutes} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <ExerciseProgress />
        <Goals />
      </div>
    </>
  );
}

function Heatmap({ tallies, weekStartsOn, today }: { tallies: DayTally[]; weekStartsOn: number; today: string }) {
  if (!tallies.length) return null;
  const first = startOfWeek(tallies[0].date, weekStartsOn);
  const byDate = new Map(tallies.map((t) => [t.date, t]));
  const weeks: string[][] = [];
  for (let w = first; w <= tallies[tallies.length - 1].date; w = addDays(w, 7)) weeks.push(dateRange(w, addDays(w, 6)));
  const level = (t?: DayTally) => {
    if (!t || t.scheduled === 0) return 'bg-transparent border border-dashed border-sage-200';
    const p = t.done / t.scheduled;
    if (p === 0) return 'bg-cream-200';
    if (p < 0.5) return 'bg-sage-200';
    if (p < 1) return 'bg-sage-400';
    return 'bg-sage-700';
  };
  return (
    <div>
      <div className="flex gap-1 overflow-x-auto pb-2">
        <div className="flex flex-col gap-1 pr-1 text-[10px] text-ink-400">
          {weeks[0].map((d) => <span key={d} className="h-4 leading-4">{WEEKDAY_LETTER[weekday(d)]}</span>)}
        </div>
        {weeks.map((w) => (
          <div key={w[0]} className="flex flex-col gap-1">
            {w.map((d) => {
              const t = byDate.get(d);
              return (
                <span key={d} className={cn('h-4 w-4 rounded-[4px]', d > today || !byDate.has(d) ? 'opacity-0' : level(t))}
                  title={`${formatDate(d)}: ${t?.scheduled ? `${t.done} of ${t.scheduled}` : 'nothing scheduled'}`} />
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-ink-500">
        Less
        {['bg-cream-200', 'bg-sage-200', 'bg-sage-400', 'bg-sage-700'].map((c) => <span key={c} className={cn('h-3 w-3 rounded-[3px]', c)} />)}
        More · dashed = nothing scheduled
      </div>
    </div>
  );
}
