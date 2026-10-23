import { useMemo, useRef, useState, type FormEvent } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Archive, Camera, Check, ImageOff, Lock, Pencil, Plus, Ruler, Target, Trash2 } from 'lucide-react';
import {
  PHOTO_BUCKET, useAddMeasurement, useDeleteGoal, useDeleteMeasurement, useDeletePhoto, useGoals, useMeasurements, usePhotos,
  useSaveGoal, useUploadPhoto,
} from '@/api/body';
import { useExercises } from '@/api/fitness';
import { useCompletedSessions, useExerciseLog } from '@/api/sessions';
import { useProfile, useSignedUrl, useToday } from '@/api/profile';
import {
  Badge, Button, Card, CardHeader, EmptyState, ErrorBlock, Modal, ProgressBar, SelectField, Skeleton, TextField,
} from '@/components/ui';
import { useConfirm, useToast } from '@/components/ui/feedback';
import { MEASUREMENTS } from '@/lib/constants';
import { addDays, formatDate } from '@/lib/dates';
import { cmTo, kgTo, toCm, toKg } from '@/lib/units';
import { exerciseHistory } from '@/lib/workout';
import type { FitnessGoal, GoalKind, MeasurementKind, ProgressPhoto } from '@/types/db';

export function Body() {
  return (
    <div className="space-y-6">
      <p className="flex items-center gap-2 text-sm text-ink-500"><Lock className="h-4 w-4" /> Everything here is optional and private to your account. You can delete any entry at any time.</p>
      <Goals />
      <Measurements />
      <Photos />
    </div>
  );
}

/* ================================================================ Units */
function useMeasureFmt() {
  const { weight_unit, length_unit } = useProfile();
  return {
    unitOf: (k: MeasurementKind) => (MEASUREMENTS[k].type === 'weight' ? weight_unit : MEASUREMENTS[k].type === 'length' ? length_unit : '%'),
    show: (k: MeasurementKind, v: number) =>
      MEASUREMENTS[k].type === 'weight' ? kgTo(v, weight_unit) : MEASUREMENTS[k].type === 'length' ? cmTo(v, length_unit) : Math.round(v * 10) / 10,
    store: (k: MeasurementKind, v: number) =>
      MEASUREMENTS[k].type === 'weight' ? toKg(v, weight_unit) : MEASUREMENTS[k].type === 'length' ? toCm(v, length_unit) : v,
  };
}

/* ========================================================= Measurements */
function Measurements() {
  const data = useMeasurements();
  const del = useDeleteMeasurement();
  const confirm = useConfirm();
  const toast = useToast();
  const fmt = useMeasureFmt();
  const [adding, setAdding] = useState(false);
  const kinds = useMemo(() => [...new Set((data.data ?? []).map((m) => m.kind))], [data.data]);
  const [kind, setKind] = useState<MeasurementKind | ''>('');
  const active = (kind || kinds[0]) as MeasurementKind | undefined;
  const series = (data.data ?? []).filter((m) => m.kind === active);

  return (
    <Card>
      <CardHeader icon={<Ruler className="h-[18px] w-[18px]" />} title="Body measurements" eyebrow="Optional"
        action={<Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>Log</Button>} />
      {data.error ? <ErrorBlock error={data.error} onRetry={() => data.refetch()} /> : data.isLoading ? <Skeleton className="h-40" /> : !data.data?.length ? (
        <p className="text-sm text-ink-500">No measurements yet. Log body weight or measurements only if it’s useful to you.</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            {kinds.map((k) => (
              <button key={k} type="button" aria-pressed={active === k} onClick={() => setKind(k)}
                className={`rounded-full border px-3 py-1 text-sm ${active === k ? 'border-sage-700 bg-sage-700 text-white' : 'border-sage-200 bg-white'}`}>
                {MEASUREMENTS[k].label}
              </button>
            ))}
          </div>
          {active && series.length > 1 && (
            <div className="h-52" role="img" aria-label={`${MEASUREMENTS[active].label} over time`}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series.map((m) => ({ date: formatDate(m.measured_on), value: fmt.show(m.kind, Number(m.value)) }))} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="#e4ebe0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6b6860' }} tickLine={false} axisLine={false} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 12, fill: '#6b6860' }} tickLine={false} axisLine={false} width={48} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e4ebe0' }} formatter={(v) => [`${v} ${fmt.unitOf(active)}`, MEASUREMENTS[active].label]} />
                  <Line type="monotone" dataKey="value" stroke="#536f4a" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <ul className="mt-3 divide-y divide-sage-100 max-h-72 overflow-y-auto">
            {[...series].reverse().map((m) => (
              <li key={m.id} className="flex items-center justify-between py-2.5 text-sm">
                <span>{formatDate(m.measured_on, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                <span className="flex items-center gap-2">
                  <span className="font-medium">{fmt.show(m.kind, Number(m.value))} {fmt.unitOf(m.kind)}</span>
                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Delete entry" onClick={async () => {
                    if (await confirm({ title: 'Delete this entry?' })) del.mutate(m.id, { onError: (e) => toast.error(e) });
                  }}><Trash2 className="h-4 w-4" /></Button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {adding && <MeasurementModal onClose={() => setAdding(false)} />}
    </Card>
  );
}

function MeasurementModal({ onClose }: { onClose: () => void }) {
  const today = useToday();
  const add = useAddMeasurement();
  const toast = useToast();
  const fmt = useMeasureFmt();
  const [date, setDate] = useState(today);
  const [values, setValues] = useState<Partial<Record<MeasurementKind, string>>>({});
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const rows = (Object.entries(values) as [MeasurementKind, string][])
      .filter(([, v]) => v.trim() !== '')
      .map(([k, v]) => ({ kind: k, num: Number(v) }));
    if (!rows.length) return setError('Enter at least one value.');
    if (rows.some((r) => Number.isNaN(r.num) || r.num <= 0 || (r.kind === 'body_fat' && r.num >= 100))) return setError('Check the values you entered.');
    if (date > today) return setError('The date can’t be in the future.');
    setError(null);
    try {
      await add.mutateAsync(rows.map((r) => ({ measured_on: date, kind: r.kind, value: fmt.store(r.kind, r.num), notes: null })));
      toast.success('Saved');
      onClose();
    } catch (err) {
      toast.error(err);
    }
  }

  return (
    <Modal open onClose={onClose} title="Log measurements"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="measure-form" loading={add.isPending}>Save</Button></>}>
      <form id="measure-form" onSubmit={submit} className="space-y-4" noValidate>
        <TextField label="Date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(MEASUREMENTS) as MeasurementKind[]).map((k) => (
            <TextField key={k} label={`${MEASUREMENTS[k].label} (${fmt.unitOf(k)})`} type="number" inputMode="decimal" step="0.1"
              value={values[k] ?? ''} onChange={(e) => setValues({ ...values, [k]: e.target.value })} />
          ))}
        </div>
        <p className="text-xs text-ink-500">Fill in only what you want to track.</p>
        {error && <p className="text-sm text-clay-700">{error}</p>}
      </form>
    </Modal>
  );
}

/* ================================================================ Goals */
export function Goals() {
  const goals = useGoals();
  const [editing, setEditing] = useState<FitnessGoal | null | undefined>(undefined);
  const [showDone, setShowDone] = useState(false);
  const list = (goals.data ?? []).filter((g) => !g.archived_at && (showDone ? !!g.achieved_on : !g.achieved_on));
  const doneCount = (goals.data ?? []).filter((g) => !g.archived_at && g.achieved_on).length;

  return (
    <Card>
      <CardHeader icon={<Target className="h-[18px] w-[18px]" />} title={showDone ? 'Achieved goals' : 'Goals'} eyebrow="Fitness targets"
        action={<Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing(null)}>New goal</Button>} />
      {goals.error ? <ErrorBlock error={goals.error} onRetry={() => goals.refetch()} /> : goals.isLoading ? <Skeleton className="h-24" /> : list.length === 0 ? (
        <EmptyState title={showDone ? 'No achieved goals yet' : 'No active goals'}>
          {!showDone && 'Set a target — a lift, a weekly workout count, a measurement or anything else — and track it here.'}
        </EmptyState>
      ) : (
        <ul className="space-y-3">{list.map((g) => <GoalRow key={g.id} goal={g} onEdit={() => setEditing(g)} />)}</ul>
      )}
      {(doneCount > 0 || showDone) && (
        <button className="mt-4 text-sm text-sage-700 hover:underline" onClick={() => setShowDone((s) => !s)}>
          {showDone ? 'Back to active goals' : `Show achieved (${doneCount})`}
        </button>
      )}
      {editing !== undefined && <GoalModal goal={editing} onClose={() => setEditing(undefined)} />}
    </Card>
  );
}

/** Current value for a goal, from real records where possible. */
function useGoalCurrent(goal: FitnessGoal): { value: number | null; source: string } {
  const measurements = useMeasurements();
  const today = useToday();
  const sessions = useCompletedSessions(addDays(today, -6), today);
  const log = useExerciseLog(goal.kind === 'lift' ? goal.exercise_id : null);
  const { weight_unit, length_unit } = useProfile();
  if (goal.kind === 'body_weight' || goal.kind === 'measurement') {
    const kind = (goal.kind === 'body_weight' ? 'weight' : goal.measurement_kind) as MeasurementKind | null;
    const latest = [...(measurements.data ?? [])].reverse().find((m) => m.kind === kind);
    if (!latest || !kind) return { value: null, source: 'No measurement logged yet' };
    const v = MEASUREMENTS[kind].type === 'weight' ? kgTo(Number(latest.value), weight_unit)
      : MEASUREMENTS[kind].type === 'length' ? cmTo(Number(latest.value), length_unit) : Number(latest.value);
    return { value: v, source: `Latest entry, ${formatDate(latest.measured_on)}` };
  }
  if (goal.kind === 'lift') {
    const { prs } = exerciseHistory(log.data ?? []);
    if (!prs.heaviest) return { value: null, source: 'Not logged yet' };
    return { value: kgTo(prs.heaviest.value, weight_unit), source: `Heaviest logged set, ${formatDate(prs.heaviest.date)}` };
  }
  if (goal.kind === 'workouts_per_week') return { value: sessions.data?.length ?? null, source: 'Workouts in the last 7 days' };
  return { value: goal.current_value !== null ? Number(goal.current_value) : null, source: 'Updated by you' };
}

function GoalRow({ goal, onEdit }: { goal: FitnessGoal; onEdit: () => void }) {
  const save = useSaveGoal();
  const del = useDeleteGoal();
  const confirm = useConfirm();
  const toast = useToast();
  const today = useToday();
  const { value, source } = useGoalCurrent(goal);
  const target = Number(goal.target_value);
  const start = goal.start_value !== null ? Number(goal.start_value) : null;
  let pct: number | null = null;
  if (value !== null) {
    if (start !== null && start !== target) pct = ((value - start) / (target - start)) * 100;
    else if (target > 0) pct = (value / target) * 100;
  }
  const reached = pct !== null && pct >= 100;

  return (
    <li className="rounded-2xl border border-sage-100 bg-white/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{goal.title}</p>
          <p className="text-xs text-ink-500">
            {value !== null ? `${value} / ${target}` : `Target ${target}`} {goal.unit ?? ''} · {source}
            {goal.target_date ? ` · by ${formatDate(goal.target_date)}` : ''}
          </p>
        </div>
        <div className="flex shrink-0">
          {goal.achieved_on ? <Badge>Achieved {formatDate(goal.achieved_on)}</Badge> : (
            <Button size="icon" variant="ghost" aria-label="Mark achieved" title="Mark achieved"
              onClick={() => save.mutate({ id: goal.id, input: { achieved_on: today } }, { onSuccess: () => toast.success('Goal achieved — well done'), onError: (e) => toast.error(e) })}>
              <Check className="h-4 w-4" />
            </Button>
          )}
          <Button size="icon" variant="ghost" aria-label="Edit goal" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" aria-label="Archive goal" onClick={() => save.mutate({ id: goal.id, input: { archived_at: new Date().toISOString() } }, { onError: (e) => toast.error(e) })}>
            <Archive className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" aria-label="Delete goal" onClick={async () => {
            if (await confirm({ title: 'Delete this goal?' })) del.mutate(goal.id, { onError: (e) => toast.error(e) });
          }}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
      {pct !== null && <ProgressBar className="mt-3" value={pct} tone={reached ? 'clay' : 'sage'} />}
      {reached && !goal.achieved_on && <p className="mt-2 text-xs text-clay-700">Looks like you’ve reached this — mark it achieved when you’re ready.</p>}
    </li>
  );
}

function GoalModal({ goal, onClose }: { goal: FitnessGoal | null; onClose: () => void }) {
  const save = useSaveGoal();
  const exercises = useExercises();
  const toast = useToast();
  const { weight_unit, length_unit } = useProfile();
  const [kind, setKind] = useState<GoalKind>(goal?.kind ?? 'workouts_per_week');
  const [title, setTitle] = useState(goal?.title ?? '');
  const [exerciseId, setExerciseId] = useState(goal?.exercise_id ?? '');
  const [measure, setMeasure] = useState<MeasurementKind>((goal?.measurement_kind as MeasurementKind) ?? 'waist');
  const [startV, setStartV] = useState(goal?.start_value?.toString() ?? '');
  const [current, setCurrent] = useState(goal?.current_value?.toString() ?? '');
  const [target, setTarget] = useState(goal?.target_value?.toString() ?? '');
  const [unit, setUnit] = useState(goal?.unit ?? '');
  const [date, setDate] = useState(goal?.target_date ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const autoUnit = kind === 'body_weight' || kind === 'lift' ? weight_unit : kind === 'measurement' ? (MEASUREMENTS[measure].type === 'percent' ? '%' : length_unit) : kind === 'workouts_per_week' ? 'workouts' : unit;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = 'Name your goal.';
    if (target === '' || Number.isNaN(Number(target))) errs.target = 'Enter a target number.';
    if (kind === 'lift' && !exerciseId) errs.exercise = 'Choose the exercise.';
    if (startV !== '' && Number.isNaN(Number(startV))) errs.start = 'Enter a number.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await save.mutateAsync({
        id: goal?.id,
        input: {
          title: title.trim(), kind, exercise_id: kind === 'lift' ? exerciseId : null, measurement_kind: kind === 'measurement' ? measure : null,
          start_value: startV === '' ? null : Number(startV), current_value: kind === 'custom' && current !== '' ? Number(current) : null,
          target_value: Number(target), unit: autoUnit || null, target_date: date || null,
        },
      });
      toast.success(goal ? 'Goal updated' : 'Goal added');
      onClose();
    } catch (err) {
      toast.error(err);
    }
  }

  return (
    <Modal open onClose={onClose} title={goal ? 'Edit goal' : 'New goal'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="goal-form" loading={save.isPending}>Save</Button></>}>
      <form id="goal-form" onSubmit={submit} className="space-y-4" noValidate>
        <SelectField label="Type" value={kind} onChange={(e) => setKind(e.target.value as GoalKind)} options={[
          { value: 'workouts_per_week', label: 'Workouts per week' }, { value: 'lift', label: 'Lift a weight' },
          { value: 'body_weight', label: 'Body weight' }, { value: 'measurement', label: 'Body measurement' }, { value: 'custom', label: 'Something else' },
        ]} />
        <TextField label="Goal" placeholder="e.g. Train three times a week" value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} maxLength={100} />
        {kind === 'lift' && (
          <SelectField label="Exercise" value={exerciseId} onChange={(e) => setExerciseId(e.target.value)} error={errors.exercise}
            options={[{ value: '', label: 'Choose…' }, ...(exercises.data ?? []).filter((x) => !x.is_timed).map((x) => ({ value: x.id, label: x.name }))]} />
        )}
        {kind === 'measurement' && (
          <SelectField label="Measurement" value={measure} onChange={(e) => setMeasure(e.target.value as MeasurementKind)}
            options={(Object.keys(MEASUREMENTS) as MeasurementKind[]).filter((k) => k !== 'weight').map((k) => ({ value: k, label: MEASUREMENTS[k].label }))} />
        )}
        <div className="grid grid-cols-2 gap-3">
          <TextField label={`Starting value${autoUnit ? ` (${autoUnit})` : ''}`} hint="Optional" type="number" inputMode="decimal" value={startV} onChange={(e) => setStartV(e.target.value)} error={errors.start} />
          <TextField label={`Target${autoUnit ? ` (${autoUnit})` : ''}`} type="number" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} error={errors.target} />
        </div>
        {kind === 'custom' && (
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Current value" type="number" inputMode="decimal" value={current} onChange={(e) => setCurrent(e.target.value)} />
            <TextField label="Unit" placeholder="e.g. km" value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={20} />
          </div>
        )}
        <TextField label="Target date" hint="Optional" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        {kind !== 'custom' && <p className="text-xs text-ink-500">Progress is calculated from what you log — workouts, sets or measurements.</p>}
      </form>
    </Modal>
  );
}

/* =============================================================== Photos */
function Photos() {
  const photos = usePhotos();
  const upload = useUploadPhoto();
  const today = useToday();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);

  return (
    <Card>
      <CardHeader icon={<Camera className="h-[18px] w-[18px]" />} title="Progress photos" eyebrow="Private"
        action={<Button size="sm" icon={<Plus className="h-4 w-4" />} loading={upload.isPending} onClick={() => input.current?.click()}>Add photo</Button>} />
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Choose a progress photo"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) upload.mutate({ file: f, takenOn: today, note: null }, { onSuccess: () => toast.success('Photo saved privately'), onError: (x) => toast.error(x) });
        }} />
      <p className="mb-4 text-xs text-ink-500">Photos are stored in a private bucket only your account can read, and shown through links that expire after an hour. Max 8 MB.</p>
      {photos.error ? <ErrorBlock error={photos.error} /> : photos.isLoading ? <Skeleton className="h-32" /> : !photos.data?.length ? (
        <p className="text-sm text-ink-500">No photos. Completely optional.</p>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{photos.data.map((p) => <PhotoTile key={p.id} photo={p} />)}</ul>
      )}
    </Card>
  );
}

function PhotoTile({ photo }: { photo: ProgressPhoto }) {
  const url = useSignedUrl(PHOTO_BUCKET, photo.storage_path);
  const del = useDeletePhoto();
  const confirm = useConfirm();
  const toast = useToast();
  return (
    <li className="group relative overflow-hidden rounded-2xl bg-sage-100 aspect-[3/4]">
      {url.data ? <img src={url.data} alt={`Progress photo from ${formatDate(photo.taken_on)}`} className="h-full w-full object-cover" loading="lazy" />
        : url.error ? <div className="grid h-full place-items-center text-ink-400"><ImageOff className="h-6 w-6" /></div>
        : <Skeleton className="h-full w-full rounded-none" />}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-ink-900/70 to-transparent p-2 text-xs text-white">
        {formatDate(photo.taken_on, { day: 'numeric', month: 'short', year: 'numeric' })}
        <button type="button" aria-label="Delete photo" className="rounded-lg p-1.5 hover:bg-white/20" onClick={async () => {
          if (await confirm({ title: 'Delete this photo?', body: 'It will be removed from storage permanently.' }))
            del.mutate(photo, { onSuccess: () => toast.success('Photo deleted'), onError: (e) => toast.error(e) });
        }}><Trash2 className="h-4 w-4" /></button>
      </div>
    </li>
  );
}

