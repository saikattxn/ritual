import { useMemo, useState, type FormEvent } from 'react';
import { Archive, ExternalLink, Pencil, Plus, RotateCcw, Search, Timer, Trash2 } from 'lucide-react';
import { useArchiveExercise, useDeleteExercise, useExercises, useSaveExercise, type ExerciseInput } from '@/api/fitness';
import { Badge, Button, Card, EmptyState, ErrorBlock, Modal, SelectField, Skeleton, TextArea, TextField, Toggle } from '@/components/ui';
import { useConfirm, useToast } from '@/components/ui/feedback';
import { DIFFICULTY, EQUIPMENT, EXERCISE_CATEGORIES, MUSCLE_GROUPS } from '@/lib/constants';
import { formatDuration } from '@/lib/dates';
import { cn } from '@/lib/cn';
import type { Exercise, MuscleGroup } from '@/types/db';

export function useExerciseFilter(list: Exercise[] | undefined) {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<MuscleGroup | ''>('');
  const [equipment, setEquipment] = useState('');
  const [mine, setMine] = useState(false);
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (list ?? []).filter((e) =>
      !e.archived_at &&
      (!term || e.name.toLowerCase().includes(term)) &&
      (!group || e.muscle_group === group) &&
      (!equipment || e.equipment === equipment) &&
      (!mine || e.user_id !== null));
  }, [list, q, group, equipment, mine]);
  const controls = (
    <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input className="input pl-9" placeholder="Search exercises" aria-label="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <select className="input" aria-label="Muscle group" value={group} onChange={(e) => setGroup(e.target.value as MuscleGroup | '')}>
        <option value="">All muscle groups</option>
        {Object.entries(MUSCLE_GROUPS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <select className="input" aria-label="Equipment" value={equipment} onChange={(e) => setEquipment(e.target.value)}>
        <option value="">Any equipment</option>
        {Object.entries(EQUIPMENT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <label className="flex items-center gap-2 text-sm text-ink-700 sm:col-span-3">
        <input type="checkbox" className="h-4 w-4 accent-sage-700" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Only my custom exercises
      </label>
    </div>
  );
  return { filtered, controls };
}

export function exerciseTarget(e: Pick<Exercise, 'is_timed' | 'default_sets' | 'default_reps' | 'default_duration_sec'>) {
  return e.is_timed
    ? `${e.default_sets} × ${e.default_duration_sec ? formatDuration(e.default_duration_sec) : '—'}`
    : `${e.default_sets} × ${e.default_reps ?? '—'}`;
}

export function Library() {
  const exercises = useExercises();
  const { filtered, controls } = useExerciseFilter(exercises.data);
  const [open, setOpen] = useState<Exercise | null>(null);
  const [editing, setEditing] = useState<Exercise | null | undefined>(undefined);
  const archived = (exercises.data ?? []).filter((e) => e.archived_at && e.user_id);
  const [showArchived, setShowArchived] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-500">{filtered.length} exercises</p>
        <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing(null)}>Custom exercise</Button>
      </div>
      {controls}
      {exercises.error ? <ErrorBlock error={exercises.error} onRetry={() => exercises.refetch()} />
        : exercises.isLoading ? <Skeleton className="h-64" />
        : filtered.length === 0 ? <Card><EmptyState title="No matching exercises">Try a different search or filter, or add your own.</EmptyState></Card>
        : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(showArchived ? archived : filtered).map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => setOpen(e)} className="card w-full text-left p-4 hover:shadow-lift transition h-full">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{e.name}</p>
                    {e.user_id && <Badge tone="clay">Mine</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-ink-500">{MUSCLE_GROUPS[e.muscle_group]} · {EQUIPMENT[e.equipment]}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge tone="cream">{DIFFICULTY[e.difficulty]}</Badge>
                    <Badge tone="cream">{e.is_timed && <Timer className="h-3 w-3" />}{exerciseTarget(e)}</Badge>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      {archived.length > 0 && (
        <button className="text-sm text-sage-700 hover:underline" onClick={() => setShowArchived((s) => !s)}>
          {showArchived ? 'Back to library' : `Show archived custom exercises (${archived.length})`}
        </button>
      )}
      {open && <ExerciseDetail exercise={open} onClose={() => setOpen(null)} onEdit={() => { setEditing(open); setOpen(null); }} />}
      {editing !== undefined && <ExerciseForm exercise={editing} onClose={() => setEditing(undefined)} />}
    </div>
  );
}

function ExerciseDetail({ exercise: e, onClose, onEdit }: { exercise: Exercise; onClose: () => void; onEdit: () => void }) {
  const archive = useArchiveExercise();
  const del = useDeleteExercise();
  const confirm = useConfirm();
  const toast = useToast();
  return (
    <Modal open onClose={onClose} title={e.name}
      footer={e.user_id ? (
        <div className="flex w-full flex-wrap justify-between gap-2">
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" icon={e.archived_at ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              onClick={() => archive.mutate({ id: e.id, archived: !e.archived_at }, { onSuccess: () => { toast.success(e.archived_at ? 'Restored' : 'Archived — history kept'); onClose(); }, onError: (x) => toast.error(x) })}>
              {e.archived_at ? 'Restore' : 'Archive'}
            </Button>
            <Button variant="ghost" size="sm" className="text-clay-700" icon={<Trash2 className="h-4 w-4" />} onClick={async () => {
              if (await confirm({ title: `Delete ${e.name}?`, body: 'It will be removed from your saved workouts. Past sessions keep the logged sets under its name.' }))
                del.mutate(e.id, { onSuccess: () => { toast.success('Exercise deleted'); onClose(); }, onError: (x) => toast.error(x) });
            }}>Delete</Button>
          </div>
          <Button size="sm" icon={<Pencil className="h-4 w-4" />} onClick={onEdit}>Edit</Button>
        </div>
      ) : undefined}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          <Badge>{MUSCLE_GROUPS[e.muscle_group]}</Badge>
          <Badge tone="cream">{EQUIPMENT[e.equipment]}</Badge>
          <Badge tone="cream">{EXERCISE_CATEGORIES[e.category]}</Badge>
          <Badge tone="cream">{DIFFICULTY[e.difficulty]}</Badge>
        </div>
        <dl className="grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-xl bg-white/70 p-3"><dt className="text-ink-500 text-xs">Sets</dt><dd className="font-medium">{e.default_sets}</dd></div>
          <div className="rounded-xl bg-white/70 p-3"><dt className="text-ink-500 text-xs">{e.is_timed ? 'Duration' : 'Reps'}</dt>
            <dd className="font-medium">{e.is_timed ? (e.default_duration_sec ? formatDuration(e.default_duration_sec) : '—') : e.default_reps ?? '—'}</dd></div>
          <div className="rounded-xl bg-white/70 p-3"><dt className="text-ink-500 text-xs">Rest</dt><dd className="font-medium">{formatDuration(e.default_rest_sec)}</dd></div>
        </dl>
        {e.instructions && <p className="text-[15px] leading-relaxed text-ink-700 whitespace-pre-line">{e.instructions}</p>}
        {e.demo_url && (
          <a href={e.demo_url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 text-sm text-sage-700 hover:underline">
            Demonstration link <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        <p className="text-xs text-ink-500">Stop if an exercise causes pain, dizziness or unusual symptoms. These are general instructions, not individual medical advice.</p>
      </div>
    </Modal>
  );
}

export function ExerciseForm({ exercise, onClose, onSaved }: { exercise: Exercise | null; onClose: () => void; onSaved?: (e: Exercise) => void }) {
  const save = useSaveExercise();
  const toast = useToast();
  const [f, setF] = useState<ExerciseInput>(() => ({
    name: exercise?.name ?? '', muscle_group: exercise?.muscle_group ?? 'full_body', equipment: exercise?.equipment ?? 'none',
    category: exercise?.category ?? 'strength', difficulty: exercise?.difficulty ?? 'beginner', instructions: exercise?.instructions ?? '',
    is_timed: exercise?.is_timed ?? false, default_sets: exercise?.default_sets ?? 3, default_reps: exercise?.default_reps ?? 10,
    default_duration_sec: exercise?.default_duration_sec ?? 30, default_rest_sec: exercise?.default_rest_sec ?? 60, demo_url: exercise?.demo_url ?? '',
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof ExerciseInput>(k: K, v: ExerciseInput[K]) => setF((s) => ({ ...s, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!f.name.trim()) errs.name = 'Name the exercise.';
    if (!Number.isInteger(f.default_sets) || f.default_sets < 1 || f.default_sets > 20) errs.sets = '1–20 sets.';
    if (!f.is_timed && (!f.default_reps || f.default_reps < 1 || f.default_reps > 200)) errs.reps = '1–200 reps.';
    if (f.is_timed && (!f.default_duration_sec || f.default_duration_sec < 5 || f.default_duration_sec > 7200)) errs.duration = '5 seconds to 2 hours.';
    if (f.default_rest_sec < 0 || f.default_rest_sec > 900) errs.rest = '0–900 seconds.';
    if (f.demo_url && !/^https:\/\/\S+$/.test(f.demo_url)) errs.demo_url = 'Use a full https:// link.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      const saved = await save.mutateAsync({
        id: exercise?.id,
        input: { ...f, name: f.name.trim(), instructions: f.instructions?.trim() || null, demo_url: f.demo_url?.trim() || null,
          default_reps: f.is_timed ? null : f.default_reps, default_duration_sec: f.is_timed ? f.default_duration_sec : null },
      });
      toast.success(exercise ? 'Exercise updated' : 'Exercise added');
      onSaved?.(saved);
      onClose();
    } catch (err) {
      toast.error(err);
    }
  }

  const num = (v: string) => (v === '' ? 0 : Number(v));

  return (
    <Modal open onClose={onClose} title={exercise ? 'Edit exercise' : 'New custom exercise'} size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="exercise-form" loading={save.isPending}>Save</Button></>}>
      <form id="exercise-form" onSubmit={submit} className="space-y-4" noValidate>
        <TextField label="Name" value={f.name} onChange={(e) => set('name', e.target.value)} error={errors.name} maxLength={100} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Muscle group" value={f.muscle_group} onChange={(e) => set('muscle_group', e.target.value as Exercise['muscle_group'])}
            options={Object.entries(MUSCLE_GROUPS).map(([value, label]) => ({ value, label }))} />
          <SelectField label="Equipment" value={f.equipment} onChange={(e) => set('equipment', e.target.value as Exercise['equipment'])}
            options={Object.entries(EQUIPMENT).map(([value, label]) => ({ value, label }))} />
          <SelectField label="Category" value={f.category} onChange={(e) => set('category', e.target.value as Exercise['category'])}
            options={Object.entries(EXERCISE_CATEGORIES).map(([value, label]) => ({ value, label }))} />
          <SelectField label="Difficulty" value={f.difficulty} onChange={(e) => set('difficulty', e.target.value as Exercise['difficulty'])}
            options={Object.entries(DIFFICULTY).map(([value, label]) => ({ value, label }))} />
        </div>
        <Toggle label="Timed exercise" description="Track seconds instead of repetitions (e.g. plank, run)." checked={f.is_timed} onChange={(v) => set('is_timed', v)} />
        <div className="grid grid-cols-3 gap-3">
          <TextField label="Sets" type="number" inputMode="numeric" value={f.default_sets} onChange={(e) => set('default_sets', num(e.target.value))} error={errors.sets} />
          {f.is_timed
            ? <TextField label="Seconds" type="number" inputMode="numeric" value={f.default_duration_sec ?? ''} onChange={(e) => set('default_duration_sec', num(e.target.value))} error={errors.duration} />
            : <TextField label="Reps" type="number" inputMode="numeric" value={f.default_reps ?? ''} onChange={(e) => set('default_reps', num(e.target.value))} error={errors.reps} />}
          <TextField label="Rest (sec)" type="number" inputMode="numeric" value={f.default_rest_sec} onChange={(e) => set('default_rest_sec', num(e.target.value))} error={errors.rest} />
        </div>
        <TextArea label="Instructions" hint="Optional — cues that help you move well" value={f.instructions ?? ''} onChange={(e) => set('instructions', e.target.value)} maxLength={3000} />
        <TextField label="Demonstration link" hint="Optional — a video or page you trust (https:// only)" value={f.demo_url ?? ''}
          onChange={(e) => set('demo_url', e.target.value)} error={errors.demo_url} />
      </form>
    </Modal>
  );
}

/** Modal for picking an exercise (used by the builder and live sessions). */
export function ExercisePicker({ onPick, onClose }: { onPick: (e: Exercise) => void; onClose: () => void }) {
  const exercises = useExercises();
  const { filtered, controls } = useExerciseFilter(exercises.data);
  const [creating, setCreating] = useState(false);
  if (creating) return <ExerciseForm exercise={null} onClose={() => setCreating(false)} onSaved={(e) => { onPick(e); }} />;
  return (
    <Modal open onClose={onClose} title="Add an exercise" size="lg"
      footer={<Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>Create custom exercise</Button>}>
      <div className="space-y-4">
        {controls}
        {exercises.isLoading ? <Skeleton className="h-40" /> : (
          <ul className="divide-y divide-sage-100 max-h-[50vh] overflow-y-auto -mx-1">
            {filtered.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => onPick(e)} className={cn('flex w-full items-center justify-between gap-3 rounded-xl px-2 py-3 text-left hover:bg-sage-50')}>
                  <span>
                    <span className="font-medium">{e.name}</span>
                    <span className="block text-xs text-ink-500">{MUSCLE_GROUPS[e.muscle_group]} · {EQUIPMENT[e.equipment]}</span>
                  </span>
                  <Plus className="h-4 w-4 text-sage-600 shrink-0" />
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="py-6 text-center text-sm text-ink-500">No matches.</li>}
          </ul>
        )}
      </div>
    </Modal>
  );
}
