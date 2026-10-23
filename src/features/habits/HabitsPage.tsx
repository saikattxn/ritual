import { useMemo, useState, type FormEvent } from 'react';
import {
  Apple, Archive, BookOpen, Brain, Droplets, Dumbbell, Footprints, Heart, Leaf, ListChecks, Moon, Pencil, Pill, Plus,
  RotateCcw, Sparkles, Sun, Trash2, type LucideIcon,
} from 'lucide-react';
import { useArchiveHabit, useDeleteHabit, useHabitCompletions, useHabits, useSaveHabit, useToggleHabit } from '@/api/habits';
import { useProfile, useToday } from '@/api/profile';
import {
  Button, Card, CardHeader, DayPicker, EmptyState, ErrorBlock, Modal, PageHeader, Skeleton, TextField,
} from '@/components/ui';
import { useConfirm, useToast } from '@/components/ui/feedback';
import { HABIT_ICONS, HABIT_SUGGESTIONS } from '@/lib/constants';
import { addDays, dateRange, describeDays, formatDate, startOfWeek, WEEKDAY_LETTER } from '@/lib/dates';
import { completionKey, currentStreak, habitScheduledOn, habitTallies } from '@/lib/schedule';
import { cn } from '@/lib/cn';
import type { Habit } from '@/types/db';

const ICONS: Record<string, LucideIcon> = {
  droplets: Droplets, moon: Moon, footprints: Footprints, 'book-open': BookOpen, brain: Brain, sun: Sun, pill: Pill,
  apple: Apple, dumbbell: Dumbbell, sparkles: Sparkles, heart: Heart, leaf: Leaf,
};

export function HabitIcon({ name, className }: { name: string; className?: string }) {
  const I = ICONS[name] ?? Sparkles;
  return <I className={className ?? 'h-4 w-4'} aria-hidden />;
}

export default function HabitsPage() {
  const today = useToday();
  const { week_starts_on, show_streaks } = useProfile();
  const weekStart = startOfWeek(today, week_starts_on);
  const from = addDays(today, -60) < weekStart ? addDays(today, -60) : weekStart;
  const habits = useHabits();
  const completions = useHabitCompletions(from, addDays(weekStart, 6));
  const toggle = useToggleHabit();
  const archive = useArchiveHabit();
  const del = useDeleteHabit();
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState<Habit | null | undefined>(undefined);
  const [showArchived, setShowArchived] = useState(false);

  const weekDates = dateRange(weekStart, addDays(weekStart, 6));
  const done = useMemo(() => new Set((completions.data ?? []).map((c) => completionKey(c.habit_id, c.on_date))), [completions.data]);
  const active = (habits.data ?? []).filter((h) => !h.archived_on);
  const archived = (habits.data ?? []).filter((h) => h.archived_on);

  const streakFor = (h: Habit) => currentStreak(habitTallies([h], completions.data ?? [], from, today), today);

  return (
    <>
      <PageHeader eyebrow="Habits" title="Everyday habits" subtitle="Small things, repeated kindly. Missing a day is fine — just pick it back up."
        action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing(null)}>New habit</Button>} />

      {habits.error || completions.error ? (
        <ErrorBlock error={habits.error ?? completions.error} onRetry={() => { habits.refetch(); completions.refetch(); }} />
      ) : habits.isLoading || completions.isLoading ? (
        <Skeleton className="h-64" />
      ) : active.length === 0 && !showArchived ? (
        <Card>
          <EmptyState icon={<ListChecks className="h-6 w-6" />} title="No habits yet"
            action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing(null)}>Create a habit</Button>}>
            Habits are optional. Add one or two that matter to you — they’ll appear on your dashboard on the days you choose.
          </EmptyState>
        </Card>
      ) : (
        <Card>
          <CardHeader title={showArchived ? 'Archived habits' : 'This week'} eyebrow={`${formatDate(weekStart)} – ${formatDate(addDays(weekStart, 6))}`} />
          <ul className="divide-y divide-sage-100">
            {(showArchived ? archived : active).map((h) => {
              const streak = streakFor(h);
              return (
                <li key={h.id} className="py-4 flex flex-col gap-3 md:flex-row md:items-center">
                  <div className="flex items-center gap-3 md:w-64 md:shrink-0 min-w-0">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sage-100 text-sage-700"><HabitIcon name={h.icon} /></div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{h.name}</p>
                      <p className="text-xs text-ink-500">
                        {describeDays(h.days, week_starts_on)}
                        {show_streaks && streak > 1 && !showArchived ? ` · ${streak}-day run` : ''}
                        {h.reminder_time ? ` · ${h.reminder_time.slice(0, 5)}` : ''}
                      </p>
                    </div>
                  </div>
                  {!showArchived && (
                    <div className="grid grid-cols-7 gap-1.5 flex-1 max-w-md">
                      {weekDates.map((d) => {
                        const scheduled = habitScheduledOn(h, d);
                        const isDone = done.has(completionKey(h.id, d));
                        const future = d > today;
                        return (
                          <button key={d} type="button" disabled={future || (!scheduled && !isDone)}
                            aria-pressed={isDone}
                            aria-label={`${h.name}, ${formatDate(d, { weekday: 'long', day: 'numeric', month: 'short' })}${scheduled ? '' : ' (not scheduled)'}`}
                            onClick={() => toggle.mutate({ habitId: h.id, date: d, done: !isDone }, { onError: (e) => toast.error(e) })}
                            className={cn(
                              'flex flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] transition border',
                              isDone ? 'bg-sage-600 border-sage-600 text-white'
                                : scheduled ? 'bg-white border-sage-200 text-ink-700 hover:border-sage-500'
                                : 'border-transparent text-ink-400',
                              d === today && !isDone && 'ring-2 ring-sage-300',
                              future && 'opacity-50',
                            )}>
                            {WEEKDAY_LETTER[new Date(d + 'T12:00:00Z').getUTCDay()]}
                            <span className="text-xs font-medium">{Number(d.slice(8))}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex gap-1 md:ml-auto">
                    {!showArchived ? (
                      <>
                        <Button size="icon" variant="ghost" aria-label={`Edit ${h.name}`} onClick={() => setEditing(h)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" aria-label={`Archive ${h.name}`} onClick={() =>
                          archive.mutate({ id: h.id, archivedOn: today }, { onSuccess: () => toast.success('Habit archived — history kept'), onError: (e) => toast.error(e) })}>
                          <Archive className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <Button size="icon" variant="ghost" aria-label={`Restore ${h.name}`} onClick={() =>
                        archive.mutate({ id: h.id, archivedOn: null }, { onSuccess: () => toast.success('Habit restored'), onError: (e) => toast.error(e) })}>
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" aria-label={`Delete ${h.name}`} onClick={async () => {
                      if (await confirm({ title: `Delete “${h.name}”?`, body: 'This removes the habit and all of its check-ins permanently. Archive it instead to keep your history.' }))
                        del.mutate(h.id, { onSuccess: () => toast.success('Habit deleted'), onError: (e) => toast.error(e) });
                    }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </li>
              );
            })}
          </ul>
          {(archived.length > 0 || showArchived) && (
            <button className="mt-4 text-sm text-sage-700 hover:underline" onClick={() => setShowArchived((s) => !s)}>
              {showArchived ? 'Back to active habits' : `Show archived (${archived.length})`}
            </button>
          )}
        </Card>
      )}

      {editing !== undefined && <HabitModal habit={editing} onClose={() => setEditing(undefined)} />}
    </>
  );
}

export function HabitModal({ habit, onClose }: { habit: Habit | null; onClose: () => void }) {
  const today = useToday();
  const { week_starts_on } = useProfile();
  const save = useSaveHabit();
  const toast = useToast();
  const [name, setName] = useState(habit?.name ?? '');
  const [icon, setIcon] = useState(habit?.icon ?? 'sparkles');
  const [days, setDays] = useState<number[]>(habit?.days ?? [0, 1, 2, 3, 4, 5, 6]);
  const [time, setTime] = useState(habit?.reminder_time?.slice(0, 5) ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name your habit.';
    if (name.length > 80) errs.name = 'Keep it under 80 characters.';
    if (!days.length) errs.days = 'Pick at least one day.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await save.mutateAsync({ id: habit?.id, today, input: { name: name.trim(), icon, days, reminder_time: time || null } });
      toast.success(habit ? 'Habit updated' : 'Habit added');
      onClose();
    } catch (err) {
      toast.error(err);
    }
  }

  return (
    <Modal open onClose={onClose} title={habit ? 'Edit habit' : 'New habit'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="habit-form" loading={save.isPending}>Save</Button></>}>
      <form id="habit-form" onSubmit={submit} className="space-y-5" noValidate>
        {!habit && (
          <div className="flex flex-wrap gap-2">
            {HABIT_SUGGESTIONS.map((s) => (
              <button key={s.name} type="button" onClick={() => { setName(s.name); setIcon(s.icon); }}
                className="rounded-full border border-sage-200 bg-white px-3 py-1.5 text-sm hover:border-sage-400">{s.name}</button>
            ))}
          </div>
        )}
        <TextField label="Habit" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} maxLength={80} />
        <fieldset>
          <legend className="label">Icon</legend>
          <div className="flex flex-wrap gap-2">
            {HABIT_ICONS.map((i) => (
              <button key={i} type="button" aria-pressed={icon === i} aria-label={i} onClick={() => setIcon(i)}
                className={cn('grid h-10 w-10 place-items-center rounded-xl border transition',
                  icon === i ? 'border-sage-600 bg-sage-600 text-white' : 'border-sage-200 bg-white text-sage-700 hover:border-sage-400')}>
                <HabitIcon name={i} />
              </button>
            ))}
          </div>
        </fieldset>
        <DayPicker value={days} onChange={setDays} weekStartsOn={week_starts_on} error={errors.days} />
        <TextField label="Reminder time" type="time" value={time} onChange={(e) => setTime(e.target.value)}
          hint="Optional. Reminders appear while Ritual is open, if you turn them on in Settings → Notifications." />
      </form>
    </Modal>
  );
}
