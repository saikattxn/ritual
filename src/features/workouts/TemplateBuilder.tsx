import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowUp, Copy, Dumbbell, Plus, X } from 'lucide-react';
import { useDuplicateTemplate, useExercises, useSaveTemplate, useTemplate, type TemplateExerciseInput } from '@/api/fitness';
import { useProfile } from '@/api/profile';
import { Button, Card, EmptyState, ErrorBlock, LoadingBlock, Notice, PageHeader, SelectField, TextArea, TextField } from '@/components/ui';
import { useToast } from '@/components/ui/feedback';
import { FOCUS, MUSCLE_GROUPS } from '@/lib/constants';
import { kgTo, toKg } from '@/lib/units';
import type { Exercise, TemplateFocus } from '@/types/db';
import { ExercisePicker } from './Library';
import { SafetyNote } from './SafetyNote';

interface Row extends TemplateExerciseInput {
  key: string;
  exercise: Pick<Exercise, 'name' | 'muscle_group' | 'is_timed'>;
  weightText: string; // in the user's unit
}

export default function TemplateBuilder() {
  const { id } = useParams();
  const isNew = id === 'new';
  const template = useTemplate(isNew ? undefined : id);
  const exercises = useExercises();
  const { weight_unit } = useProfile();
  const save = useSaveTemplate();
  const dup = useDuplicateTemplate();
  const toast = useToast();
  const nav = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [focus, setFocus] = useState<TemplateFocus>('custom');
  const [minutes, setMinutes] = useState('45');
  const [rows, setRows] = useState<Row[]>([]);
  const [picking, setPicking] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadedId, setLoadedId] = useState<string | null>(null);

  useEffect(() => {
    const t = template.data;
    if (!t || loadedId === t.id) return;
    setLoadedId(t.id);
    setName(t.name);
    setDescription(t.description ?? '');
    setFocus(t.focus);
    setMinutes(String(t.estimated_minutes));
    setRows(t.workout_template_exercises.map((e) => ({
      key: e.id, exercise_id: e.exercise_id, sets: e.sets, target_reps: e.target_reps, target_duration_sec: e.target_duration_sec,
      target_weight_kg: e.target_weight_kg, rest_sec: e.rest_sec, notes: e.notes,
      exercise: { name: e.exercises?.name ?? 'Exercise', muscle_group: e.exercises?.muscle_group ?? 'full_body', is_timed: e.exercises?.is_timed ?? false },
      weightText: e.target_weight_kg !== null ? String(kgTo(Number(e.target_weight_kg), weight_unit)) : '',
    })));
  }, [template.data, loadedId, weight_unit]);

  if (!isNew && template.error) return <ErrorBlock error={template.error} onRetry={() => template.refetch()} />;
  if (!isNew && (template.isLoading || !template.data)) return <LoadingBlock />;
  const readOnly = !isNew && template.data?.user_id === null;

  const addExercise = (e: Exercise) => {
    setRows((r) => [...r, {
      key: crypto.randomUUID(), exercise_id: e.id, sets: e.default_sets, target_reps: e.is_timed ? null : e.default_reps,
      target_duration_sec: e.is_timed ? e.default_duration_sec : null, target_weight_kg: null, rest_sec: e.default_rest_sec, notes: null,
      exercise: e, weightText: '',
    }]);
    setPicking(false);
  };
  const update = (key: string, patch: Partial<Row>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) => setRows((r) => {
    const j = i + d;
    if (j < 0 || j >= r.length) return r;
    const c = [...r];
    [c[i], c[j]] = [c[j], c[i]];
    return c;
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name this workout.';
    const m = Number(minutes);
    if (!Number.isInteger(m) || m < 5 || m > 240) errs.minutes = '5–240 minutes.';
    rows.forEach((r) => {
      if (!Number.isInteger(r.sets) || r.sets < 1 || r.sets > 20) errs[r.key] = 'Sets must be 1–20.';
      else if (r.exercise.is_timed ? !(r.target_duration_sec && r.target_duration_sec >= 5 && r.target_duration_sec <= 7200) : !(r.target_reps && r.target_reps >= 1 && r.target_reps <= 200))
        errs[r.key] = r.exercise.is_timed ? 'Duration must be 5 s – 2 h.' : 'Reps must be 1–200.';
      else if (r.weightText && (Number.isNaN(Number(r.weightText)) || Number(r.weightText) < 0 || Number(r.weightText) > 2000)) errs[r.key] = 'Check the weight.';
      else if (r.rest_sec < 0 || r.rest_sec > 900) errs[r.key] = 'Rest must be 0–900 s.';
    });
    setErrors(errs);
    if (Object.keys(errs).length) return toast.error('Please check the highlighted fields.');
    try {
      await save.mutateAsync({
        id: isNew ? undefined : id,
        input: { name: name.trim(), description: description.trim() || null, focus, estimated_minutes: m },
        exercises: rows.map((r) => ({
          exercise_id: r.exercise_id, sets: r.sets,
          target_reps: r.exercise.is_timed ? null : r.target_reps,
          target_duration_sec: r.exercise.is_timed ? r.target_duration_sec : null,
          target_weight_kg: r.weightText ? toKg(Number(r.weightText), weight_unit) : null,
          rest_sec: r.rest_sec, notes: r.notes?.trim() || null,
        })),
      });
      toast.success('Workout saved');
      nav('/workouts?tab=templates');
    } catch (err) {
      toast.error(err);
    }
  }

  const n = (v: string) => (v === '' ? 0 : Math.round(Number(v)));

  return (
    <>
      <Link to="/workouts?tab=templates" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-sage-800">
        <ArrowLeft className="h-4 w-4" /> Workouts
      </Link>
      <PageHeader eyebrow={readOnly ? 'Starter template' : isNew ? 'New workout' : 'Edit workout'} title={readOnly ? template.data!.name : name || 'Untitled workout'}
        action={readOnly ? (
          <Button icon={<Copy className="h-4 w-4" />} loading={dup.isPending} onClick={async () => {
            try {
              const c = await dup.mutateAsync({ template: template.data! });
              toast.success('Copied to your workouts');
              nav(`/workouts/templates/${c.id}`);
            } catch (e) { toast.error(e); }
          }}>Make a copy to edit</Button>
        ) : undefined} />

      {readOnly && <Notice className="mb-5" title="This is a general starter plan">It’s informational, not individual advice. Copy it to change exercises, sets, reps or weights.</Notice>}
      {exercises.error && <ErrorBlock error={exercises.error} />}

      <form onSubmit={submit} className="space-y-5" noValidate>
        <fieldset disabled={readOnly} className="space-y-5">
          <Card>
            <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
              <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} maxLength={100} />
              <SelectField label="Focus" value={focus} onChange={(e) => setFocus(e.target.value as TemplateFocus)}
                options={Object.entries(FOCUS).map(([value, label]) => ({ value, label }))} />
              <TextField label="About (min)" type="number" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} error={errors.minutes} />
            </div>
            <TextArea className="mt-4" label="Description" hint="Optional" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
          </Card>

          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg">Exercises</h2>
              {!readOnly && <Button size="sm" variant="soft" icon={<Plus className="h-4 w-4" />} onClick={() => setPicking(true)}>Add exercise</Button>}
            </div>
            {rows.length === 0 ? (
              <EmptyState icon={<Dumbbell className="h-6 w-6" />} title="No exercises yet">Add exercises from the library or create your own.</EmptyState>
            ) : (
              <ol className="space-y-3">
                {rows.map((r, i) => (
                  <li key={r.key} className="rounded-2xl border border-sage-100 bg-white/70 p-4">
                    <div className="flex items-start gap-3">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sage-100 text-xs font-semibold text-sage-800">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{r.exercise.name}</p>
                        <p className="text-xs text-ink-500">{MUSCLE_GROUPS[r.exercise.muscle_group]}</p>
                      </div>
                      {!readOnly && (
                        <div className="flex">
                          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Move down" disabled={i === rows.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Remove ${r.exercise.name}`} onClick={() => setRows((x) => x.filter((y) => y.key !== r.key))}><X className="h-4 w-4" /></Button>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <TextField label="Sets" type="number" inputMode="numeric" value={r.sets} onChange={(e) => update(r.key, { sets: n(e.target.value) })} />
                      {r.exercise.is_timed
                        ? <TextField label="Seconds" type="number" inputMode="numeric" value={r.target_duration_sec ?? ''} onChange={(e) => update(r.key, { target_duration_sec: n(e.target.value) })} />
                        : <TextField label="Reps" type="number" inputMode="numeric" value={r.target_reps ?? ''} onChange={(e) => update(r.key, { target_reps: n(e.target.value) })} />}
                      <TextField label={`Weight (${weight_unit})`} type="number" inputMode="decimal" step="0.5" placeholder="Optional" value={r.weightText}
                        onChange={(e) => update(r.key, { weightText: e.target.value })} />
                      <TextField label="Rest (sec)" type="number" inputMode="numeric" value={r.rest_sec} onChange={(e) => update(r.key, { rest_sec: n(e.target.value) })} />
                    </div>
                    <TextField className="mt-3" label="Notes" placeholder="Optional cue, e.g. slow lowering" value={r.notes ?? ''} onChange={(e) => update(r.key, { notes: e.target.value })} maxLength={500} />
                    {errors[r.key] && <p className="mt-2 text-sm text-clay-700">{errors[r.key]}</p>}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </fieldset>

        <SafetyNote />

        {!readOnly && (
          <div className="sticky bottom-20 lg:bottom-4 z-10 flex justify-end gap-2 rounded-2xl bg-cream-100/90 backdrop-blur p-2">
            <Button variant="secondary" onClick={() => nav('/workouts?tab=templates')}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>Save workout</Button>
          </div>
        )}
      </form>

      {picking && <ExercisePicker onPick={addExercise} onClose={() => setPicking(false)} />}
    </>
  );
}
