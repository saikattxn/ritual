import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Check, ChevronLeft, ChevronRight, ExternalLink, Flame, Pause, Play, Plus, SkipForward, Trash2, Trophy, X,
} from 'lucide-react';
import {
  useAddSessionExercise, useAddSet, useDeleteSession, useDeleteSet, useExerciseBests, useFinishSession, useLastPerformance,
  useRemoveSessionExercise, useSaveSessionTime, useSession, useUpdateSet, type ExerciseBest,
} from '@/api/sessions';
import { useProfile } from '@/api/profile';
import { Badge, Button, Card, ErrorBlock, LoadingBlock, Modal, Notice, Stat, TextArea } from '@/components/ui';
import { useConfirm, useToast } from '@/components/ui/feedback';
import { formatClock, formatDate, formatDuration } from '@/lib/dates';
import { fmtWeight, kgTo, toKg, type WeightUnit } from '@/lib/units';
import { setVolume } from '@/lib/workout';
import { cn } from '@/lib/cn';
import type { SessionExerciseWithSets, SessionWithDetails, WorkoutSet } from '@/types/db';
import { ExercisePicker } from './Library';
import { SafetyNote } from './SafetyNote';

export default function SessionMode() {
  const { id } = useParams();
  const session = useSession(id);
  if (session.error) return <ErrorBlock error={session.error} onRetry={() => session.refetch()} />;
  if (session.isLoading || !session.data) return <LoadingBlock label="Loading workout…" />;
  if (session.data.status !== 'in_progress') return <SessionSummary session={session.data} />;
  return <LiveSession session={session.data} />;
}

/* ===================================================================== Live */
function useStopwatch(session: SessionWithDetails) {
  const save = useSaveSessionTime();
  const fresh = Date.now() - new Date(session.started_at).getTime() < 60_000 && session.active_seconds === 0;
  const [base, setBase] = useState(session.active_seconds);
  const [runningSince, setRunningSince] = useState<number | null>(fresh ? Date.now() : null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (runningSince === null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [runningSince]);

  const elapsed = base + (runningSince !== null ? Math.max(0, (now - runningSince) / 1000) : 0);
  const elapsedRef = useRef(elapsed);
  elapsedRef.current = elapsed;

  const persist = useCallback(() => save.mutate({ id: session.id, activeSeconds: elapsedRef.current }), [save, session.id]);

  useEffect(() => {
    if (runningSince === null) return;
    const t = setInterval(persist, 30_000);
    return () => clearInterval(t);
  }, [runningSince, persist]);

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') persist(); };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [persist]);

  return {
    elapsed,
    running: runningSince !== null,
    pause: () => { setBase(elapsedRef.current); setRunningSince(null); save.mutate({ id: session.id, activeSeconds: elapsedRef.current }); },
    resume: () => { setNow(Date.now()); setRunningSince(Date.now()); },
    current: () => elapsedRef.current,
  };
}

function useRestTimer() {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [, force] = useState(0);
  useEffect(() => {
    if (endsAt === null) return;
    const t = setInterval(() => {
      if (Date.now() >= endsAt) {
        setEndsAt(null);
        try { navigator.vibrate?.([120, 80, 120]); } catch { /* not supported */ }
      } else force((x) => x + 1);
    }, 250);
    return () => clearInterval(t);
  }, [endsAt]);
  return {
    remaining: endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)) : 0,
    total,
    active: endsAt !== null,
    start: (sec: number) => { if (sec > 0) { setTotal(sec); setEndsAt(Date.now() + sec * 1000); } },
    add: (sec: number) => { setEndsAt((e) => (e ? e + sec * 1000 : e)); setTotal((t) => t + sec); },
    skip: () => setEndsAt(null),
  };
}

function LiveSession({ session }: { session: SessionWithDetails }) {
  const nav = useNavigate();
  const { weight_unit } = useProfile();
  const toast = useToast();
  const confirm = useConfirm();
  const clock = useStopwatch(session);
  const rest = useRestTimer();
  const exercises = session.workout_session_exercises;
  const [index, setIndex] = useState(() => {
    const firstOpen = exercises.findIndex((e) => e.workout_sets.some((s) => !s.completed));
    return firstOpen === -1 ? 0 : firstOpen;
  });
  const [picking, setPicking] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const addExercise = useAddSessionExercise();
  const removeExercise = useRemoveSessionExercise();
  const discard = useDeleteSession();

  const ids = useMemo(() => exercises.map((e) => e.exercise_id).filter((x): x is string => !!x), [exercises]);
  const last = useLastPerformance(ids, session.id);
  const current = exercises[Math.min(index, exercises.length - 1)];
  const totalSets = exercises.reduce((a, e) => a + e.workout_sets.length, 0);
  const doneSets = exercises.reduce((a, e) => a + e.workout_sets.filter((s) => s.completed).length, 0);

  useEffect(() => { if (index > exercises.length - 1 && exercises.length) setIndex(exercises.length - 1); }, [exercises.length, index]);

  const onSetDone = (ex: SessionExerciseWithSets, set: WorkoutSet) => {
    if (!clock.running) clock.resume();
    const remaining = ex.workout_sets.filter((s) => !s.completed && s.id !== set.id).length;
    if (remaining === 0 && index < exercises.length - 1) {
      toast.success(`${ex.exercise_name} complete`);
      rest.start(ex.rest_sec);
      setTimeout(() => setIndex((i) => Math.min(i + 1, exercises.length - 1)), 400);
    } else rest.start(ex.rest_sec);
  };

  return (
    <div className="space-y-5 pb-56 lg:pb-44">
      <div className="flex items-center justify-between gap-3">
        <Link to="/workouts" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-sage-800"><ArrowLeft className="h-4 w-4" /> Workouts</Link>
        <Button variant="ghost" size="sm" className="text-clay-700" onClick={async () => {
          if (await confirm({ title: 'Discard this workout?', body: 'Nothing from this session will be saved to your history.', confirmLabel: 'Discard' }))
            discard.mutate(session, { onSuccess: () => { toast.success('Workout discarded'); nav('/workouts'); }, onError: (e) => toast.error(e) });
        }}>Discard</Button>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">In progress · {formatDate(session.on_date)}</p>
          <h1 className="text-2xl sm:text-3xl">{session.title}</h1>
          <p className="text-sm text-ink-500">{doneSets} of {totalSets} sets done</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="font-serif text-3xl tabular-nums" aria-live="off">{formatClock(clock.elapsed)}</p>
            <p className="text-xs text-ink-500">{clock.running ? 'Active time' : 'Paused'}</p>
          </div>
          {clock.running
            ? <Button variant="secondary" size="icon" aria-label="Pause workout" onClick={clock.pause}><Pause className="h-5 w-5" /></Button>
            : <Button size="icon" aria-label="Resume workout" onClick={clock.resume}><Play className="h-5 w-5" /></Button>}
        </div>
      </Card>

      {doneSets === 0 && (
        <Notice tone="info" title="Warm up first">
          Spend 5–10 minutes on light cardio and mobility, then do a lighter practice set of your first exercise.
        </Notice>
      )}

      {exercises.length > 0 && (
        <nav aria-label="Exercises" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {exercises.map((e, i) => {
            const complete = e.workout_sets.length > 0 && e.workout_sets.every((s) => s.completed);
            return (
              <button key={e.id} type="button" onClick={() => setIndex(i)} aria-current={i === index ? 'step' : undefined}
                className={cn('flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition',
                  i === index ? 'border-sage-700 bg-sage-700 text-white' : complete ? 'border-sage-300 bg-sage-100 text-sage-800' : 'border-sage-200 bg-white')}>
                {complete && <Check className="h-3.5 w-3.5" />}{e.exercise_name}
              </button>
            );
          })}
        </nav>
      )}

      {current ? (
        <ExercisePanel key={current.id} ex={current} unit={weight_unit} lastTime={current.exercise_id ? last.data?.get(current.exercise_id) : undefined}
          onSetDone={(s) => onSetDone(current, s)}
          onRemove={async () => {
            if (await confirm({ title: `Remove ${current.exercise_name} from this workout?`, body: 'Any sets logged for it in this session will be removed.', confirmLabel: 'Remove' }))
              removeExercise.mutate(current.id, { onError: (e) => toast.error(e) });
          }} />
      ) : (
        <Card><p className="text-center text-ink-500 py-6">This workout has no exercises yet. Add one to start logging.</p></Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<ChevronLeft className="h-4 w-4" />} disabled={index === 0} onClick={() => setIndex(index - 1)}>Previous</Button>
          <Button variant="secondary" size="sm" disabled={index >= exercises.length - 1} onClick={() => setIndex(index + 1)}>Next <ChevronRight className="h-4 w-4" /></Button>
        </div>
        <Button variant="ghost" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setPicking(true)}>Add exercise</Button>
      </div>

      <SafetyNote compact />

      {/* Sticky footer: rest timer + finish */}
      <div className="fixed inset-x-0 bottom-16 lg:bottom-0 lg:left-64 z-20 px-4 pb-3 lg:pb-5">
        <div className="mx-auto max-w-6xl flex flex-col gap-2">
          {rest.active && (
            <div className="flex items-center gap-3 rounded-2xl bg-ink-900 px-4 py-3 text-cream-50 shadow-lift animate-fade-up" role="timer" aria-live="polite">
              <div className="flex-1">
                <p className="text-xs uppercase tracking-wider text-sage-300">Rest</p>
                <p className="font-serif text-2xl tabular-nums">{formatClock(rest.remaining)}</p>
                <div className="mt-1 h-1 rounded-full bg-white/15"><div className="h-1 rounded-full bg-sage-300 transition-all" style={{ width: `${(rest.remaining / Math.max(1, rest.total)) * 100}%` }} /></div>
              </div>
              <Button size="sm" variant="ghost" className="text-cream-50 hover:bg-white/10" onClick={() => rest.add(15)}>+15s</Button>
              <Button size="sm" variant="ghost" className="text-cream-50 hover:bg-white/10" icon={<SkipForward className="h-4 w-4" />} onClick={rest.skip}>Skip</Button>
            </div>
          )}
          <Button size="lg" className="w-full sm:w-auto sm:self-end shadow-lift" icon={<Flame className="h-5 w-5" />} onClick={() => setFinishing(true)}>Finish workout</Button>
        </div>
      </div>

      {picking && <ExercisePicker onClose={() => setPicking(false)} onPick={(e) => {
        setPicking(false);
        addExercise.mutate({ session, exercise: e }, { onSuccess: () => setIndex(exercises.length), onError: (x) => toast.error(x) });
      }} />}
      {finishing && <FinishModal session={session} elapsed={clock.current()} onClose={() => setFinishing(false)} />}
    </div>
  );
}

function ExercisePanel({ ex, unit, lastTime, onSetDone, onRemove }: {
  ex: SessionExerciseWithSets; unit: WeightUnit; lastTime?: { date: string; sets: WorkoutSet[] };
  onSetDone: (s: WorkoutSet) => void; onRemove: () => void;
}) {
  const addSet = useAddSet();
  const delSet = useDeleteSet();
  const toast = useToast();
  const [showInfo, setShowInfo] = useState(false);
  const target = ex.is_timed
    ? `${ex.target_sets} × ${ex.target_duration_sec ? formatDuration(ex.target_duration_sec) : '—'}`
    : `${ex.target_sets} × ${ex.target_reps ?? '—'}${ex.target_weight_kg ? ` @ ${fmtWeight(Number(ex.target_weight_kg), unit)}` : ''}`;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl">{ex.exercise_name}</h2>
          <p className="text-sm text-ink-500">Target {target} · rest {formatDuration(ex.rest_sec)}</p>
          {lastTime && (
            <p className="mt-1 text-xs text-sage-700">
              Last time ({formatDate(lastTime.date)}): {lastTime.sets.map((s) => ex.is_timed
                ? formatDuration(s.duration_sec ?? 0)
                : `${s.reps ?? 0}${s.weight_kg ? `×${kgTo(Number(s.weight_kg), unit)}` : ''}`).join(', ')}{!ex.is_timed && lastTime.sets.some((s) => s.weight_kg) ? ` ${unit}` : ''}
            </p>
          )}
        </div>
        <div className="flex gap-1">
          {(ex.exercises?.instructions || ex.notes) && <Button size="sm" variant="ghost" onClick={() => setShowInfo((s) => !s)}>{showInfo ? 'Hide' : 'How to'}</Button>}
          <Button size="icon" variant="ghost" aria-label={`Remove ${ex.exercise_name}`} onClick={onRemove}><X className="h-4 w-4" /></Button>
        </div>
      </div>
      {showInfo && (
        <div className="mt-3 rounded-2xl bg-sage-50 p-4 text-sm leading-relaxed text-ink-700">
          {ex.notes && <p className="mb-2 font-medium">{ex.notes}</p>}
          {ex.exercises?.instructions}
          {ex.exercises?.demo_url && (
            <a href={ex.exercises.demo_url} target="_blank" rel="noopener noreferrer nofollow" className="mt-2 flex items-center gap-1 text-sage-700 hover:underline">
              Demonstration <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )}

      <div className="mt-5">
        <div className={cn('grid gap-2 px-1 pb-2 text-xs font-medium text-ink-500', ex.is_timed ? 'grid-cols-[40px_1fr_56px]' : 'grid-cols-[40px_1fr_1fr_56px]')}>
          <span>Set</span>{ex.is_timed ? <span>Seconds</span> : <><span>Weight ({unit})</span><span>Reps</span></>}<span className="sr-only">Done</span>
        </div>
        <ul className="space-y-2">
          {ex.workout_sets.map((s, i) => (
            <SetRow key={s.id} set={s} timed={ex.is_timed} unit={unit} onDone={() => onSetDone(s)}
              canDelete={i === ex.workout_sets.length - 1 && !s.completed && ex.workout_sets.length > 1}
              onDelete={() => delSet.mutate(s.id, { onError: (e) => toast.error(e) })} />
          ))}
        </ul>
        <Button className="mt-3" size="sm" variant="soft" icon={<Plus className="h-4 w-4" />} loading={addSet.isPending}
          onClick={() => addSet.mutate({ sessionExercise: ex, last: ex.workout_sets[ex.workout_sets.length - 1] }, { onError: (e) => toast.error(e) })}>
          Add set
        </Button>
      </div>
    </Card>
  );
}

function SetRow({ set, timed, unit, onDone, canDelete, onDelete }: {
  set: WorkoutSet; timed: boolean; unit: WeightUnit; onDone: () => void; canDelete: boolean; onDelete: () => void;
}) {
  const update = useUpdateSet();
  const toast = useToast();
  const [weight, setWeight] = useState(set.weight_kg !== null ? String(kgTo(Number(set.weight_kg), unit)) : '');
  const [reps, setReps] = useState(set.reps !== null ? String(set.reps) : '');
  const [secs, setSecs] = useState(set.duration_sec !== null ? String(set.duration_sec) : '');

  const parsed = () => {
    const w = weight === '' ? null : Number(weight);
    const r = reps === '' ? null : Number(reps);
    const d = secs === '' ? null : Number(secs);
    if (w !== null && (Number.isNaN(w) || w < 0 || w > 2000)) return { error: 'Check the weight.' };
    if (r !== null && (!Number.isInteger(r) || r < 0 || r > 500)) return { error: 'Reps must be a whole number up to 500.' };
    if (d !== null && (!Number.isInteger(d) || d < 0 || d > 7200)) return { error: 'Seconds must be up to 7200.' };
    return { patch: timed ? { duration_sec: d } : { weight_kg: w === null ? null : toKg(w, unit), reps: r } };
  };

  const saveValues = () => {
    const p = parsed();
    if ('error' in p) return toast.error(p.error!);
    update.mutate({ id: set.id, patch: p.patch! }, { onError: (e) => toast.error(e) });
  };

  const toggle = () => {
    const p = parsed();
    if ('error' in p) return toast.error(p.error!);
    const completing = !set.completed;
    if (completing && (timed ? !p.patch!.duration_sec : !(p.patch as { reps: number | null }).reps))
      return toast.error(timed ? 'Enter how many seconds you did.' : 'Enter how many reps you did.');
    update.mutate(
      { id: set.id, patch: { ...p.patch!, completed: completing, completed_at: completing ? new Date().toISOString() : null } },
      { onError: (e) => toast.error(e) },
    );
    if (completing) onDone();
  };

  return (
    <li className={cn('grid items-center gap-2 rounded-2xl px-1 py-1 transition', timed ? 'grid-cols-[40px_1fr_56px]' : 'grid-cols-[40px_1fr_1fr_56px]', set.completed && 'bg-sage-50')}>
      <span className="grid h-9 w-9 place-items-center rounded-full bg-cream-200 text-sm font-semibold">{set.set_number}</span>
      {timed ? (
        <input className="input text-center tabular-nums" type="number" inputMode="numeric" aria-label={`Set ${set.set_number} seconds`}
          value={secs} onChange={(e) => setSecs(e.target.value)} onBlur={saveValues} disabled={set.completed} />
      ) : (
        <>
          <input className="input text-center tabular-nums" type="number" inputMode="decimal" step="0.5" placeholder="—" aria-label={`Set ${set.set_number} weight in ${unit}`}
            value={weight} onChange={(e) => setWeight(e.target.value)} onBlur={saveValues} disabled={set.completed} />
          <input className="input text-center tabular-nums" type="number" inputMode="numeric" aria-label={`Set ${set.set_number} reps`}
            value={reps} onChange={(e) => setReps(e.target.value)} onBlur={saveValues} disabled={set.completed} />
        </>
      )}
      <div className="flex justify-center">
        {canDelete && !set.completed && (weight === '' && reps === '' && secs === '') ? (
          <Button size="icon" variant="ghost" aria-label={`Remove set ${set.set_number}`} onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
        ) : (
          <button type="button" role="checkbox" aria-checked={set.completed} aria-label={`Set ${set.set_number} done`} onClick={toggle}
            className={cn('grid h-11 w-11 place-items-center rounded-2xl border-2 transition',
              set.completed ? 'border-sage-600 bg-sage-600 text-white' : 'border-sage-300 bg-white hover:border-sage-500')}>
            <Check className={cn('h-5 w-5', set.completed ? 'animate-pop' : 'text-sage-300')} strokeWidth={3} />
          </button>
        )}
      </div>
    </li>
  );
}

/* ================================================================= Finish */
function summarise(session: SessionWithDetails, bests: Map<string, ExerciseBest> | undefined, unit: WeightUnit = 'kg') {
  let sets = 0;
  let reps = 0;
  let volume = 0;
  const prs: { name: string; text: string }[] = [];
  for (const e of session.workout_session_exercises) {
    const done = e.workout_sets.filter((s) => s.completed);
    sets += done.length;
    reps += done.reduce((a, s) => a + (s.reps ?? 0), 0);
    volume += done.reduce((a, s) => a + setVolume(s), 0);
    if (!e.exercise_id || !bests || !done.length) continue;
    const prev = bests.get(e.exercise_id);
    if (!prev) continue; // first time — no comparison
    const w = Math.max(0, ...done.map((s) => Number(s.weight_kg ?? 0)));
    const r = Math.max(0, ...done.map((s) => s.reps ?? 0));
    const d = Math.max(0, ...done.map((s) => s.duration_sec ?? 0));
    if (w > 0 && prev.maxWeight !== null && w > prev.maxWeight) prs.push({ name: e.exercise_name, text: `heaviest set: ${fmtWeight(w, unit)}` });
    else if (!w && r > 0 && prev.maxReps !== null && r > prev.maxReps) prs.push({ name: e.exercise_name, text: `most reps: ${r}` });
    else if (d > 0 && prev.maxDuration !== null && d > prev.maxDuration) prs.push({ name: e.exercise_name, text: `longest: ${formatDuration(d)}` });
  }
  return { sets, reps, volume, prs };
}

function FinishModal({ session, elapsed, onClose }: { session: SessionWithDetails; elapsed: number; onClose: () => void }) {
  const nav = useNavigate();
  const toast = useToast();
  const { weight_unit } = useProfile();
  const finish = useFinishSession();
  const ids = session.workout_session_exercises.map((e) => e.exercise_id).filter((x): x is string => !!x);
  const bests = useExerciseBests(ids, session.id);
  const [effort, setEffort] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const sum = summarise(session, bests.data, weight_unit);
  const incomplete = session.workout_session_exercises.reduce((a, e) => a + e.workout_sets.filter((s) => !s.completed).length, 0);

  const save = () =>
    finish.mutate({ session, activeSeconds: elapsed, effort, notes: notes.trim() || null }, {
      onSuccess: () => { toast.success('Workout saved to your history'); nav('/workouts?tab=history'); },
      onError: (e) => toast.error(e),
    });

  return (
    <Modal open onClose={onClose} title="Finish workout"
      footer={<><Button variant="secondary" onClick={onClose}>Keep going</Button><Button onClick={save} loading={finish.isPending} disabled={sum.sets === 0}>Save workout</Button></>}>
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Active time" value={formatDuration(elapsed)} />
          <Stat label="Sets done" value={sum.sets} />
          <Stat label="Volume" value={sum.volume ? fmtWeight(sum.volume, weight_unit) : '—'} hint="weight × reps" />
        </div>
        {sum.sets === 0 && <Notice tone="caution" title="No sets are marked done yet">Tick off the sets you completed before saving, or discard the workout.</Notice>}
        {incomplete > 0 && sum.sets > 0 && <p className="text-sm text-ink-500">{incomplete} unticked {incomplete === 1 ? 'set' : 'sets'} won’t count. That’s completely fine.</p>}
        {sum.prs.length > 0 && (
          <div className="rounded-2xl bg-clay-100/60 p-4">
            <p className="flex items-center gap-2 font-medium"><Trophy className="h-4 w-4 text-clay-600" /> New personal bests</p>
            <ul className="mt-1 text-sm text-ink-700">{sum.prs.map((p) => <li key={p.name}>{p.name} — {p.text}</li>)}</ul>
          </div>
        )}
        <fieldset>
          <legend className="label">How hard did it feel? <span className="font-normal text-ink-500">(optional)</span></legend>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" aria-pressed={effort === n} onClick={() => setEffort(effort === n ? null : n)}
                className={cn('h-9 w-9 rounded-xl border text-sm', effort === n ? 'border-sage-700 bg-sage-700 text-white' : 'border-sage-200 bg-white')}>{n}</button>
            ))}
          </div>
          <p className="mt-1 text-xs text-ink-500">1 = very easy, 10 = maximum effort</p>
        </fieldset>
        <TextArea label="Notes" hint="Optional — energy, sleep, anything you noticed" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
        <p className="text-xs text-ink-500">Remember to cool down with some easy movement and stretching.</p>
      </div>
    </Modal>
  );
}

/* ============================================================== Summary */
function SessionSummary({ session }: { session: SessionWithDetails }) {
  const { weight_unit } = useProfile();
  const del = useDeleteSession();
  const confirm = useConfirm();
  const toast = useToast();
  const nav = useNavigate();
  const sum = summarise(session, undefined);
  return (
    <div className="space-y-5">
      <Link to="/workouts?tab=history" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-sage-800"><ArrowLeft className="h-4 w-4" /> History</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{formatDate(session.on_date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <h1 className="text-3xl">{session.title}</h1>
        </div>
        <Button variant="ghost" className="text-clay-700" icon={<Trash2 className="h-4 w-4" />} onClick={async () => {
          if (await confirm({ title: 'Delete this workout from your history?', body: 'Its sets and times will be removed permanently.' }))
            del.mutate(session, { onSuccess: () => { toast.success('Workout deleted'); nav('/workouts?tab=history'); }, onError: (e) => toast.error(e) });
        }}>Delete</Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Active time" value={formatDuration(session.active_seconds)} />
        <Stat label="Sets" value={sum.sets} />
        <Stat label="Reps" value={sum.reps || '—'} />
        <Stat label="Effort" value={session.effort ? `${session.effort}/10` : '—'} />
      </div>
      {session.notes && <Card><p className="whitespace-pre-line text-ink-700">{session.notes}</p></Card>}
      <div className="space-y-3">
        {session.workout_session_exercises.map((e) => {
          const done = e.workout_sets.filter((s) => s.completed);
          return (
            <Card key={e.id} className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{e.exercise_name}</p>
                <Badge tone={done.length ? 'sage' : 'ink'}>{done.length} {done.length === 1 ? 'set' : 'sets'}</Badge>
              </div>
              {done.length > 0 && (
                <p className="mt-1 text-sm text-ink-500">
                  {done.map((s) => (e.is_timed ? formatDuration(s.duration_sec ?? 0) : `${s.reps ?? 0}${s.weight_kg ? ` × ${fmtWeight(Number(s.weight_kg), weight_unit)}` : ' reps'}`)).join('  ·  ')}
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
