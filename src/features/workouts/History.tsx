import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { History as HistoryIcon, Trophy } from 'lucide-react';
import { useExercises } from '@/api/fitness';
import { useCompletedSessions, useExerciseLog } from '@/api/sessions';
import { useProfile, useToday } from '@/api/profile';
import { Card, CardHeader, EmptyState, ErrorBlock, Segmented, Skeleton, Stat } from '@/components/ui';
import { addDays, formatDate, formatDuration } from '@/lib/dates';
import { exerciseHistory } from '@/lib/workout';
import { fmtWeight, kgTo } from '@/lib/units';
import { setVolume } from '@/lib/workout';

export function History() {
  const today = useToday();
  const [range, setRange] = useState<'30' | '90' | '365'>('90');
  const from = addDays(today, -Number(range) + 1);
  const sessions = useCompletedSessions(from, today);
  const { weight_unit } = useProfile();

  const stats = useMemo(() => {
    const list = sessions.data ?? [];
    const time = list.reduce((a, s) => a + s.active_seconds, 0);
    const sets = list.reduce((a, s) => a + s.workout_session_exercises.reduce((b, e) => b + e.workout_sets.filter((x) => x.completed).length, 0), 0);
    const weeks = Number(range) / 7;
    return { count: list.length, time, sets, perWeek: list.length / weeks };
  }, [sessions.data, range]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Range" value={range} onChange={setRange}
          options={[{ value: '30', label: '30 days' }, { value: '90', label: '90 days' }, { value: '365', label: '12 months' }]} />
      </div>
      {sessions.error ? <ErrorBlock error={sessions.error} onRetry={() => sessions.refetch()} /> : sessions.isLoading ? <Skeleton className="h-48" /> : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Workouts" value={stats.count} />
            <Stat label="Per week" value={stats.count ? stats.perWeek.toFixed(1) : '—'} hint="average" />
            <Stat label="Training time" value={stats.time ? formatDuration(stats.time) : '—'} />
            <Stat label="Sets logged" value={stats.sets || '—'} />
          </div>
          <ExerciseProgress />
          <Card>
            <CardHeader title="Completed workouts" eyebrow="History" />
            {(sessions.data ?? []).length === 0 ? (
              <EmptyState icon={<HistoryIcon className="h-6 w-6" />} title="No workouts logged in this period">
                Finish a workout and it will appear here with its sets, time and any personal bests.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-sage-100">
                {sessions.data!.map((s) => {
                  const done = s.workout_session_exercises.flatMap((e) => e.workout_sets.filter((x) => x.completed));
                  const vol = done.reduce((a, x) => a + setVolume(x), 0);
                  return (
                    <li key={s.id}>
                      <Link to={`/workouts/session/${s.id}`} className="flex items-center justify-between gap-3 py-3.5 hover:bg-sage-50/60 -mx-2 px-2 rounded-xl">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{s.title}</p>
                          <p className="text-xs text-ink-500">
                            {formatDate(s.on_date, { weekday: 'short', day: 'numeric', month: 'short' })} · {formatDuration(s.active_seconds)} · {done.length} sets
                            {vol ? ` · ${fmtWeight(vol, weight_unit)} volume` : ''}
                          </p>
                        </div>
                        {s.effort && <span className="text-xs text-ink-500 whitespace-nowrap">Effort {s.effort}/10</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

export function ExerciseProgress({ title = 'Exercise progress' }: { title?: string }) {
  const exercises = useExercises();
  const { weight_unit } = useProfile();
  const [exerciseId, setExerciseId] = useState<string>('');
  const log = useExerciseLog(exerciseId || null);
  const selected = exercises.data?.find((e) => e.id === exerciseId);
  const { points, prs } = useMemo(() => exerciseHistory(log.data ?? []), [log.data]);
  const timed = selected?.is_timed ?? false;
  const hasWeight = points.some((p) => p.bestWeight !== null);

  const chart = points.map((p) => ({
    date: formatDate(p.date),
    best: timed ? p.bestDuration : hasWeight ? (p.bestWeight !== null ? kgTo(p.bestWeight, weight_unit) : null) : p.bestReps,
    e1rm: p.e1rm !== null ? kgTo(p.e1rm, weight_unit) : null,
  }));

  return (
    <Card>
      <CardHeader title={title} eyebrow="Recorded sets only" />
      <select className="input mb-4 max-w-md" aria-label="Choose an exercise" value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
        <option value="">Choose an exercise…</option>
        {(exercises.data ?? []).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>
      {!exerciseId ? (
        <p className="text-sm text-ink-500">Pick an exercise to see your logged sets over time.</p>
      ) : log.isLoading ? <Skeleton className="h-56" /> : log.error ? <ErrorBlock error={log.error} /> : points.length === 0 ? (
        <p className="text-sm text-ink-500">No completed sets logged for {selected?.name} yet.</p>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Sessions" value={points.length} />
            {prs.heaviest && <Stat label="Heaviest set" value={fmtWeight(prs.heaviest.value, weight_unit)} hint={`${prs.heaviest.reps} reps · ${formatDate(prs.heaviest.date)}`} />}
            {prs.bestE1rm && <Stat label="Est. 1-rep max" value={fmtWeight(prs.bestE1rm.value, weight_unit)} hint="Estimate (Epley), not a tested max" />}
            {prs.mostReps && !timed && <Stat label="Most reps" value={prs.mostReps.value} hint={formatDate(prs.mostReps.date)} />}
            {prs.longest && timed && <Stat label="Longest" value={formatDuration(prs.longest.value)} hint={formatDate(prs.longest.date)} />}
          </div>
          {points.length > 1 ? (
            <div className="h-60" role="img" aria-label={`Chart of ${selected?.name} over ${points.length} sessions`}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="#e4ebe0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6b6860' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#6b6860' }} tickLine={false} axisLine={false} width={48} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e4ebe0' }} />
                  <Line type="monotone" dataKey="best" name={timed ? 'Longest set (s)' : hasWeight ? `Heaviest set (${weight_unit})` : 'Most reps'} stroke="#536f4a" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                  {hasWeight && !timed && <Line type="monotone" dataKey="e1rm" name={`Est. 1RM (${weight_unit}, estimate)`} stroke="#c4835c" strokeDasharray="5 4" strokeWidth={1.5} dot={false} connectNulls />}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-sm text-ink-500">Log this exercise again to see a trend.</p>}
          {hasWeight && !timed && <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-500"><Trophy className="h-3.5 w-3.5" /> Solid line: your heaviest recorded set. Dashed line: an estimated one-rep max calculated from it.</p>}
        </>
      )}
    </Card>
  );
}
