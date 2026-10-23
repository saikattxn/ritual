import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Dumbbell, Leaf, Plus } from 'lucide-react';
import { useRoutineCompletions, useRoutineItems } from '@/api/care';
import { useHabitCompletions, useHabits, useToggleHabit } from '@/api/habits';
import { usePlanned, useTemplates } from '@/api/fitness';
import { useCompletedSessions } from '@/api/sessions';
import { useProfile, useToday } from '@/api/profile';
import { Badge, Button, Card, CardHeader, CheckRow, ErrorBlock, PageHeader, Skeleton } from '@/components/ui';
import { useToast } from '@/components/ui/feedback';
import {
  addDays, addMonths, dateRange, endOfMonth, formatDate, formatDuration, orderedWeekdays, startOfMonth, startOfWeek, WEEKDAY_SHORT,
} from '@/lib/dates';
import { completionKey, habitScheduledOn, itemScheduledOn } from '@/lib/schedule';
import { cn } from '@/lib/cn';
import { RoutineList, useCareDay } from '@/features/care/shared';
import { HabitIcon } from '@/features/habits/HabitsPage';
import { PlanModal } from '@/features/workouts/Planner';

type Mark = { planned: number; done: number };

export default function CalendarPage() {
  const today = useToday();
  const { week_starts_on } = useProfile();
  const [month, setMonth] = useState(startOfMonth(today));
  const [selected, setSelected] = useState(today);
  const gridStart = startOfWeek(month, week_starts_on);
  const gridEnd = addDays(startOfWeek(endOfMonth(month), week_starts_on), 6);

  const items = useRoutineItems();
  const completions = useRoutineCompletions(gridStart, gridEnd);
  const habits = useHabits();
  const habitDone = useHabitCompletions(gridStart, gridEnd);
  const planned = usePlanned(gridStart, gridEnd);
  const sessions = useCompletedSessions(gridStart, gridEnd);

  const error = items.error ?? completions.error ?? habits.error ?? habitDone.error ?? planned.error ?? sessions.error;
  const loading = items.isLoading || completions.isLoading || habits.isLoading || habitDone.isLoading || planned.isLoading || sessions.isLoading;

  const marks = useMemo(() => {
    const out = new Map<string, { skin: Mark; hair: Mark; habits: Mark; workout: Mark; rest: boolean }>();
    if (loading || error) return out;
    const doneR = new Set(completions.data!.map((c) => completionKey(c.routine_item_id, c.on_date)));
    const doneH = new Set(habitDone.data!.map((c) => completionKey(c.habit_id, c.on_date)));
    for (const d of dateRange(gridStart, gridEnd)) {
      const m = { skin: { planned: 0, done: 0 }, hair: { planned: 0, done: 0 }, habits: { planned: 0, done: 0 }, workout: { planned: 0, done: 0 }, rest: false };
      for (const it of items.data!) {
        if (!itemScheduledOn(it, d)) continue;
        const bucket = it.area === 'skin' ? m.skin : m.hair;
        bucket.planned++;
        if (doneR.has(completionKey(it.id, d))) bucket.done++;
      }
      for (const h of habits.data!) {
        if (!habitScheduledOn(h, d)) continue;
        m.habits.planned++;
        if (doneH.has(completionKey(h.id, d))) m.habits.done++;
      }
      for (const p of planned.data!.filter((x) => x.on_date === d)) {
        if (p.kind === 'rest') m.rest = true;
        else { m.workout.planned++; if (p.status === 'completed') m.workout.done++; }
      }
      const adHoc = sessions.data!.filter((s) => s.on_date === d && !s.planned_workout_id).length;
      m.workout.planned += adHoc;
      m.workout.done += adHoc;
      out.set(d, m);
    }
    return out;
  }, [loading, error, items.data, completions.data, habits.data, habitDone.data, planned.data, sessions.data, gridStart, gridEnd]);

  return (
    <>
      <PageHeader eyebrow="Calendar" title="Your month at a glance" subtitle="Select a day to see what was planned and what you did." />
      {error ? <ErrorBlock error={error} onRetry={() => { items.refetch(); completions.refetch(); habits.refetch(); habitDone.refetch(); planned.refetch(); sessions.refetch(); }} /> : (
        <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          <Card className="p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft className="h-5 w-5" /></Button>
              <h2 className="text-xl">{formatDate(month, { month: 'long', year: 'numeric' })}</h2>
              <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="h-5 w-5" /></Button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-ink-400 mb-1">
              {orderedWeekdays(week_starts_on).map((d) => <div key={d}>{WEEKDAY_SHORT[d].slice(0, 2)}</div>)}
            </div>
            {loading ? <Skeleton className="h-80" /> : (
              <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Calendar">
                {dateRange(gridStart, gridEnd).map((d) => {
                  const m = marks.get(d);
                  const inMonth = d.slice(0, 7) === month.slice(0, 7);
                  return (
                    <button key={d} type="button" onClick={() => setSelected(d)} aria-pressed={selected === d}
                      aria-label={`${formatDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}${m ? describeMarks(m) : ''}`}
                      className={cn('flex aspect-square flex-col items-center justify-start gap-1 rounded-xl p-1 sm:p-1.5 text-sm transition',
                        selected === d ? 'bg-sage-700 text-white' : d === today ? 'bg-sage-100' : 'hover:bg-sage-50',
                        !inMonth && selected !== d && 'opacity-40')}>
                      <span className={cn('tabular-nums', d === today && selected !== d && 'font-semibold text-sage-800')}>{Number(d.slice(8))}</span>
                      {m && (
                        <span className="flex flex-wrap justify-center gap-0.5">
                          <Dot m={m.skin} cls="bg-sage-500" on={selected === d} />
                          <Dot m={m.hair} cls="bg-clay-500" on={selected === d} />
                          <Dot m={m.habits} cls="bg-sage-300" on={selected === d} />
                          <Dot m={m.workout} cls="bg-ink-700" on={selected === d} />
                          {m.rest && <span className={cn('h-1.5 w-1.5 rounded-full ring-1', selected === d ? 'ring-white' : 'ring-sage-500')} />}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
              <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sage-500" />Skincare</li>
              <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-clay-500" />Hair</li>
              <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sage-300" />Habits</li>
              <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ink-700" />Workout</li>
              <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full ring-1 ring-sage-500" />Rest day</li>
              <li>Filled = all done · faded = planned</li>
            </ul>
          </Card>
          <DayPanel date={selected} today={today} />
        </div>
      )}
    </>
  );
}

function describeMarks(m: { skin: Mark; hair: Mark; habits: Mark; workout: Mark; rest: boolean }) {
  const parts: string[] = [];
  if (m.skin.planned) parts.push(`skincare ${m.skin.done} of ${m.skin.planned}`);
  if (m.hair.planned) parts.push(`hair ${m.hair.done} of ${m.hair.planned}`);
  if (m.habits.planned) parts.push(`habits ${m.habits.done} of ${m.habits.planned}`);
  if (m.workout.planned) parts.push(`workouts ${m.workout.done} of ${m.workout.planned}`);
  if (m.rest) parts.push('rest day');
  return parts.length ? `: ${parts.join(', ')}` : '';
}

function Dot({ m, cls, on }: { m: Mark; cls: string; on: boolean }) {
  if (!m.planned) return null;
  const full = m.done >= m.planned;
  return <span className={cn('h-1.5 w-1.5 rounded-full', on ? 'bg-white' : cls, !full && 'opacity-35')} />;
}

function DayPanel({ date, today }: { date: string; today: string }) {
  const skin = useCareDay('skin', date);
  const hair = useCareDay('hair', date);
  const habits = useHabits();
  const habitDone = useHabitCompletions(date, date);
  const planned = usePlanned(date, date);
  const sessions = useCompletedSessions(date, date);
  const templates = useTemplates();
  const toggleHabit = useToggleHabit();
  const toast = useToast();
  const [planning, setPlanning] = useState(false);
  const future = date > today;
  const dayHabits = (habits.data ?? []).filter((h) => habitScheduledOn(h, date));
  const doneH = new Set((habitDone.data ?? []).map((c) => c.habit_id));
  const adHoc = (sessions.data ?? []).filter((s) => !s.planned_workout_id);

  return (
    <Card>
      <CardHeader eyebrow={date === today ? 'Today' : future ? 'Planned' : 'Past day'} title={formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}
        action={<Button size="sm" variant="soft" icon={<Plus className="h-4 w-4" />} onClick={() => setPlanning(true)}>Plan</Button>} />
      {future && <p className="mb-3 text-xs text-ink-500">Future days show what’s planned. You can tick things off once the day arrives.</p>}
      <div className="space-y-5">
        <Section title="Workouts">
          {planned.isLoading ? <Skeleton className="h-10" /> : (planned.data ?? []).length === 0 && adHoc.length === 0 ? <Empty text="Nothing planned." /> : (
            <ul className="space-y-2">
              {(planned.data ?? []).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/70 border border-sage-100 px-3 py-2">
                  <span className="flex items-center gap-2 text-sm">{p.kind === 'rest' ? <Leaf className="h-4 w-4 text-sage-600" /> : <Dumbbell className="h-4 w-4 text-ink-500" />}{p.title}</span>
                  {p.kind === 'workout' && <Badge tone={p.status === 'completed' ? 'sage' : 'ink'}>{p.status === 'completed' ? 'Done' : p.status === 'skipped' ? 'Skipped' : date < today ? 'Not logged' : 'Planned'}</Badge>}
                </li>
              ))}
              {adHoc.map((s) => (
                <li key={s.id}><Link to={`/workouts/session/${s.id}`} className="flex items-center justify-between gap-2 rounded-xl bg-sage-50 px-3 py-2 text-sm hover:bg-sage-100">
                  <span>{s.title}</span><Badge>Logged · {formatDuration(s.active_seconds)}</Badge>
                </Link></li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Skincare">
          {skin.isLoading || !skin.data ? <Skeleton className="h-10" /> : <RoutineList entries={skin.data.entries} date={date} today={today} emptyText="No skincare scheduled." />}
        </Section>
        <Section title="Hair care">
          {hair.isLoading || !hair.data ? <Skeleton className="h-10" /> : <RoutineList entries={hair.data.entries} date={date} today={today} emptyText="No hair care scheduled." />}
        </Section>
        <Section title="Habits">
          {dayHabits.length === 0 ? <Empty text="No habits scheduled." /> : (
            <ul className="-mx-2">
              {dayHabits.map((h) => (
                <li key={h.id}><CheckRow checked={doneH.has(h.id)} disabled={future} title={h.name}
                  trailing={<span className="text-sage-600"><HabitIcon name={h.icon} /></span>}
                  onToggle={() => toggleHabit.mutate({ habitId: h.id, date, done: !doneH.has(h.id) }, { onError: (e) => toast.error(e) })} /></li>
              ))}
            </ul>
          )}
        </Section>
      </div>
      {planning && <PlanModal date={date} templates={templates.data ?? []} onClose={() => setPlanning(false)} />}
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h3 className="eyebrow mb-1.5">{title}</h3>{children}</section>;
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-ink-400 py-1">{text}</p>;
}
