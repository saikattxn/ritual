import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarRange, ChevronLeft, ChevronRight, Copy, Leaf, MoreVertical, Play, Plus, Wand2 } from 'lucide-react';
import {
  useBulkPlan, useDeletePlanned, useFitnessProfile, usePlanned, useSavePlanned, useTemplates, type PlannedInput,
} from '@/api/fitness';
import { useCompletedSessions, useStartSession } from '@/api/sessions';
import { useProfile, useToday } from '@/api/profile';
import { Badge, Button, ErrorBlock, Modal, Notice, SelectField, Segmented, Skeleton, TextArea, TextField } from '@/components/ui';
import { useConfirm, useToast } from '@/components/ui/feedback';
import { addDays, dateRange, formatDate, formatDuration, startOfWeek, WEEKDAY_SHORT, weekday } from '@/lib/dates';
import { cn } from '@/lib/cn';
import type { PlannedWorkout, TemplateWithExercises } from '@/types/db';

export function Planner() {
  const today = useToday();
  const { week_starts_on } = useProfile();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today, week_starts_on));
  const weekEnd = addDays(weekStart, 6);
  const planned = usePlanned(weekStart, weekEnd);
  const lastWeek = usePlanned(addDays(weekStart, -7), addDays(weekStart, -1));
  const sessions = useCompletedSessions(weekStart, weekEnd);
  const templates = useTemplates();
  const fitness = useFitnessProfile();
  const bulk = useBulkPlan();
  const toast = useToast();
  const [editing, setEditing] = useState<{ plan?: PlannedWorkout; date: string } | null>(null);
  const [autoOpen, setAutoOpen] = useState(false);

  const days = dateRange(weekStart, weekEnd);
  const byDay = useMemo(() => {
    const m = new Map<string, PlannedWorkout[]>();
    (planned.data ?? []).forEach((p) => m.set(p.on_date, [...(m.get(p.on_date) ?? []), p]));
    return m;
  }, [planned.data]);
  const adHoc = useMemo(() => (sessions.data ?? []).filter((s) => !s.planned_workout_id), [sessions.data]);

  const copyLastWeek = () => {
    const rows: PlannedInput[] = (lastWeek.data ?? []).map((p) => ({
      on_date: addDays(p.on_date, 7), kind: p.kind, template_id: p.template_id, title: p.title, planned_minutes: p.planned_minutes, notes: p.notes,
    }));
    if (!rows.length) return toast.info('Nothing was planned last week.');
    bulk.mutate(rows, { onSuccess: () => toast.success(`Copied ${rows.length} plans from last week`), onError: (e) => toast.error(e) });
  };

  const workoutsPlanned = (planned.data ?? []).filter((p) => p.kind === 'workout').length;
  const plannedDone = (planned.data ?? []).filter((p) => p.kind === 'workout' && p.status === 'completed').length;

  return (
    <div className="space-y-5">
      {fitness.data === null && (
        <Notice tone="info" title="Tell Ritual how you like to train">
          Set your goal, experience, equipment and preferred days in <Link className="text-sage-700 underline" to="/settings/workouts">Settings → Workout preferences</Link> to plan faster.
        </Notice>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Previous week" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft className="h-5 w-5" /></Button>
          <p className="min-w-[150px] text-center font-medium">{formatDate(weekStart)} – {formatDate(weekEnd)}</p>
          <Button variant="ghost" size="icon" aria-label="Next week" onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight className="h-5 w-5" /></Button>
          {weekStart !== startOfWeek(today, week_starts_on) && (
            <Button variant="ghost" size="sm" onClick={() => setWeekStart(startOfWeek(today, week_starts_on))}>This week</Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" icon={<Copy className="h-4 w-4" />} loading={bulk.isPending} onClick={copyLastWeek}>Copy last week</Button>
          <Button variant="secondary" size="sm" icon={<Wand2 className="h-4 w-4" />} onClick={() => setAutoOpen(true)}>Fill preferred days</Button>
        </div>
      </div>

      <p className="text-sm text-ink-500">
        {workoutsPlanned ? `${plannedDone} of ${workoutsPlanned} planned workouts done this week` : 'No workouts planned this week yet'}
        {adHoc.length > 0 && ` · ${adHoc.length} unplanned ${adHoc.length === 1 ? 'workout' : 'workouts'} logged`}.
      </p>

      {planned.error ? <ErrorBlock error={planned.error} onRetry={() => planned.refetch()} /> : planned.isLoading ? <Skeleton className="h-72" /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {days.map((d) => {
            const list = byDay.get(d) ?? [];
            const logged = adHoc.filter((s) => s.on_date === d);
            return (
              <div key={d} className={cn('rounded-2xl border p-3 flex flex-col gap-2 min-h-[140px]',
                d === today ? 'border-sage-400 bg-white' : 'border-sage-100 bg-white/50')}>
                <div className="flex items-baseline justify-between">
                  <p className={cn('text-sm font-medium', d === today && 'text-sage-800')}>{WEEKDAY_SHORT[weekday(d)]}</p>
                  <p className="text-xs text-ink-400">{formatDate(d)}</p>
                </div>
                {list.map((p) => <PlanChip key={p.id} plan={p} today={today} templates={templates.data ?? []} onEdit={() => setEditing({ plan: p, date: p.on_date })} />)}
                {logged.map((s) => (
                  <div key={s.id} className="rounded-xl bg-sage-50 px-2.5 py-2 text-xs">
                    <p className="font-medium text-sm line-clamp-2 break-words">{s.title}</p>
                    <p className="text-ink-500">Logged · {formatDuration(s.active_seconds)}</p>
                  </div>
                ))}
                <button type="button" onClick={() => setEditing({ date: d })}
                  className="mt-auto flex items-center justify-center gap-1 rounded-xl border border-dashed border-sage-200 py-1.5 text-xs text-ink-500 hover:border-sage-400 hover:text-sage-800">
                  <Plus className="h-3.5 w-3.5" /> Add<span className="sr-only"> plan for {formatDate(d)}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {editing && <PlanModal plan={editing.plan} date={editing.date} templates={templates.data ?? []} onClose={() => setEditing(null)} />}
      {autoOpen && <AutoPlanModal weekStart={weekStart} existing={planned.data ?? []} templates={templates.data ?? []}
        preferredDays={fitness.data?.preferred_days ?? [1, 3, 5]} minutes={fitness.data?.session_minutes ?? 45} onClose={() => setAutoOpen(false)} />}
    </div>
  );
}

function PlanChip({ plan, today, templates, onEdit }: { plan: PlannedWorkout; today: string; templates: TemplateWithExercises[]; onEdit: () => void }) {
  const nav = useNavigate();
  const start = useStartSession();
  const save = useSavePlanned();
  const toast = useToast();
  const [menu, setMenu] = useState(false);
  const missed = plan.kind === 'workout' && plan.status === 'planned' && plan.on_date < today;

  if (plan.kind === 'rest')
    return (
      <button type="button" onClick={onEdit} className="flex items-center gap-2 rounded-xl bg-cream-200/70 px-2.5 py-2 text-left text-sm hover:bg-cream-300/70">
        <Leaf className="h-4 w-4 text-sage-600" /> {plan.title}
      </button>
    );

  const begin = async () => {
    try {
      const s = await start.mutateAsync({ template: templates.find((t) => t.id === plan.template_id) ?? null, planned: plan, today });
      nav(`/workouts/session/${s.id}`);
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <div className={cn('relative rounded-xl px-2.5 py-2 text-sm border',
      plan.status === 'completed' ? 'bg-sage-600 border-sage-600 text-white' : 'bg-white border-sage-200')}>
      <div className="flex items-start gap-1">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onEdit}>
          <p className="font-medium line-clamp-2 break-words">{plan.title}</p>
          <p className={cn('text-xs', plan.status === 'completed' ? 'text-sage-100' : 'text-ink-500')}>
            {plan.status === 'completed' ? 'Done' : plan.status === 'skipped' ? 'Skipped' : missed ? 'Not logged' : plan.planned_minutes ? `${plan.planned_minutes} min` : 'Planned'}
          </p>
        </button>
        <button type="button" aria-label={`Options for ${plan.title}`} aria-expanded={menu} onClick={() => setMenu(!menu)}
          className={cn('rounded-lg p-1', plan.status === 'completed' ? 'hover:bg-sage-700' : 'hover:bg-sage-50')}>
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>
      {menu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} aria-hidden />
          <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-44 rounded-2xl border border-sage-100 bg-white p-1.5 text-ink-900 shadow-lift">
            {plan.status !== 'completed' && plan.on_date <= today && (
              <button role="menuitem" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-sage-50" onClick={() => { setMenu(false); begin(); }}>
                <Play className="h-4 w-4" /> Start workout
              </button>
            )}
            <button role="menuitem" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-sage-50" onClick={() => { setMenu(false); onEdit(); }}>
              <CalendarRange className="h-4 w-4" /> Edit or move
            </button>
            {plan.status === 'planned' && (
              <button role="menuitem" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-sage-50"
                onClick={() => { setMenu(false); save.mutate({ id: plan.id, input: { status: 'skipped' } }, { onError: (e) => toast.error(e) }); }}>
                Mark as skipped
              </button>
            )}
            {plan.status === 'skipped' && (
              <button role="menuitem" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-sage-50"
                onClick={() => { setMenu(false); save.mutate({ id: plan.id, input: { status: 'planned' } }, { onError: (e) => toast.error(e) }); }}>
                Mark as planned
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function PlanModal({ plan, date, templates, onClose }: { plan?: PlannedWorkout; date: string; templates: TemplateWithExercises[]; onClose: () => void }) {
  const save = useSavePlanned();
  const del = useDeletePlanned();
  const confirm = useConfirm();
  const toast = useToast();
  const usable = templates.filter((t) => !t.archived_at);
  const [kind, setKind] = useState<'workout' | 'rest'>(plan?.kind ?? 'workout');
  const [templateId, setTemplateId] = useState(plan?.template_id ?? '');
  const [title, setTitle] = useState(plan?.title ?? '');
  const [minutes, setMinutes] = useState(plan?.planned_minutes?.toString() ?? '');
  const [notes, setNotes] = useState(plan?.notes ?? '');
  const [onDate, setOnDate] = useState(plan?.on_date ?? date);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const pickTemplate = (id: string) => {
    setTemplateId(id);
    const t = usable.find((x) => x.id === id);
    if (t) {
      if (!title || usable.some((x) => x.name === title)) setTitle(t.name);
      if (!minutes) setMinutes(String(t.estimated_minutes));
    }
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const finalTitle = kind === 'rest' ? title.trim() || 'Rest & recovery' : title.trim();
    if (!finalTitle) errs.title = 'Give this session a name or choose a workout.';
    const m = minutes ? Number(minutes) : null;
    if (m !== null && (!Number.isInteger(m) || m < 5 || m > 240)) errs.minutes = 'Between 5 and 240 minutes.';
    if (!onDate) errs.date = 'Choose a date.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await save.mutateAsync({
        id: plan?.id,
        input: { on_date: onDate, kind, template_id: kind === 'workout' ? templateId || null : null, title: finalTitle,
          planned_minutes: kind === 'workout' ? m : null, notes: notes.trim() || null },
      });
      toast.success(plan ? (plan.on_date !== onDate ? `Moved to ${formatDate(onDate)}` : 'Plan updated') : 'Added to your week');
      onClose();
    } catch (err) {
      toast.error(err);
    }
  }

  return (
    <Modal open onClose={onClose} title={plan ? 'Edit plan' : `Plan ${formatDate(date, { weekday: 'long', day: 'numeric', month: 'short' })}`}
      footer={
        <div className="flex w-full flex-wrap justify-between gap-2">
          {plan ? (
            <Button variant="ghost" className="text-clay-700" onClick={async () => {
              if (await confirm({ title: 'Remove this plan?', body: 'Any workout you already logged for it stays in your history.', confirmLabel: 'Remove' }))
                del.mutate(plan.id, { onSuccess: () => { toast.success('Plan removed'); onClose(); }, onError: (e) => toast.error(e) });
            }}>Delete</Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" form="plan-form" loading={save.isPending}>Save</Button>
          </div>
        </div>
      }>
      <form id="plan-form" onSubmit={submit} className="space-y-4" noValidate>
        <Segmented label="Plan type" value={kind} onChange={setKind} options={[{ value: 'workout', label: 'Workout' }, { value: 'rest', label: 'Rest day' }]} />
        {kind === 'workout' && (
          <SelectField label="Workout" value={templateId} onChange={(e) => pickTemplate(e.target.value)}
            options={[{ value: '', label: 'Custom (no saved workout)' },
              ...usable.filter((t) => t.user_id).map((t) => ({ value: t.id, label: t.name })),
              ...usable.filter((t) => !t.user_id).map((t) => ({ value: t.id, label: `Starter · ${t.name}` }))]} />
        )}
        <TextField label="Name" value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title}
          placeholder={kind === 'rest' ? 'Rest & recovery' : 'e.g. Evening run'} maxLength={100} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Date" type="date" value={onDate} onChange={(e) => setOnDate(e.target.value)} error={errors.date}
            hint={plan ? 'Change to move this session' : undefined} />
          {kind === 'workout' && (
            <TextField label="Duration (min)" type="number" inputMode="numeric" min={5} max={240} value={minutes}
              onChange={(e) => setMinutes(e.target.value)} error={errors.minutes} />
          )}
        </div>
        <TextArea label="Notes" hint="Optional" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
      </form>
    </Modal>
  );
}

function AutoPlanModal({ weekStart, existing, templates, preferredDays, minutes, onClose }: {
  weekStart: string; existing: PlannedWorkout[]; templates: TemplateWithExercises[]; preferredDays: number[]; minutes: number; onClose: () => void;
}) {
  const bulk = useBulkPlan();
  const toast = useToast();
  const usable = templates.filter((t) => !t.archived_at);
  const [templateId, setTemplateId] = useState(usable.find((t) => t.user_id)?.id ?? usable[0]?.id ?? '');
  const [restOthers, setRestOthers] = useState(false);
  const days = dateRange(weekStart, addDays(weekStart, 6));
  const taken = new Set(existing.map((p) => p.on_date));
  const targets = days.filter((d) => preferredDays.includes(weekday(d)) && !taken.has(d));
  const rests = restOthers ? days.filter((d) => !preferredDays.includes(weekday(d)) && !taken.has(d)) : [];
  const t = usable.find((x) => x.id === templateId);

  const go = () => {
    const rows: PlannedInput[] = [
      ...targets.map((d) => ({ on_date: d, kind: 'workout' as const, template_id: t?.id ?? null, title: t?.name ?? 'Workout', planned_minutes: t?.estimated_minutes ?? minutes, notes: null })),
      ...rests.map((d) => ({ on_date: d, kind: 'rest' as const, template_id: null, title: 'Rest & recovery', planned_minutes: null, notes: null })),
    ];
    bulk.mutate(rows, { onSuccess: () => { toast.success(`Planned ${rows.length} days`); onClose(); }, onError: (e) => toast.error(e) });
  };

  return (
    <Modal open onClose={onClose} title="Fill your preferred days"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={go} loading={bulk.isPending} disabled={!targets.length && !rests.length}>Plan {targets.length + rests.length} days</Button></>}>
      <div className="space-y-4">
        <p className="text-sm text-ink-700">
          Adds a workout on each of your preferred days ({preferredDays.map((d) => WEEKDAY_SHORT[d]).join(', ')}) that doesn’t already have a plan.
          Change your preferred days in Settings → Workout preferences.
        </p>
        <SelectField label="Workout" value={templateId} onChange={(e) => setTemplateId(e.target.value)}
          options={usable.map((x) => ({ value: x.id, label: x.user_id ? x.name : `Starter · ${x.name}` }))} />
        <label className="flex items-center gap-3 text-[15px]">
          <input type="checkbox" className="h-5 w-5 accent-sage-700" checked={restOthers} onChange={(e) => setRestOthers(e.target.checked)} />
          Mark the other free days as rest days
        </label>
        {!targets.length && <Badge tone="clay">Your preferred days this week are already planned.</Badge>}
      </div>
    </Modal>
  );
}
