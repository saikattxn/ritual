import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { must, supabase } from '@/lib/supabase';
import { useUserId } from '@/auth/AuthProvider';
import type {
  Exercise, ISODate, PlannedWorkout, SessionExercise, SessionWithDetails, TemplateWithExercises, WorkoutSession, WorkoutSet,
} from '@/types/db';

const SESSION_SELECT = '*, workout_session_exercises(*, workout_sets(*), exercises(instructions, demo_url, equipment))';

function sortSession(s: SessionWithDetails): SessionWithDetails {
  s.workout_session_exercises.sort((a, b) => a.position - b.position);
  s.workout_session_exercises.forEach((e) => e.workout_sets.sort((a, b) => a.set_number - b.set_number));
  return s;
}

export function useActiveSession() {
  const uid = useUserId();
  return useQuery({
    queryKey: ['sessions', uid, 'active'],
    queryFn: async () =>
      must(await supabase.from('workout_sessions').select('*').eq('user_id', uid).eq('status', 'in_progress')
        .order('started_at', { ascending: false }).limit(1).maybeSingle()) as WorkoutSession | null,
  });
}

export function useSession(id: string | undefined) {
  const uid = useUserId();
  return useQuery({
    queryKey: ['session', uid, id],
    enabled: !!id,
    queryFn: async () => {
      const s = must(await supabase.from('workout_sessions').select(SESSION_SELECT).eq('id', id!).maybeSingle()) as SessionWithDetails | null;
      if (!s) throw new Error('That workout session could not be found.');
      return sortSession(s);
    },
  });
}

/** Completed sessions in a date range, with exercises and sets for summaries. */
export function useCompletedSessions(from: ISODate, to: ISODate) {
  const uid = useUserId();
  return useQuery({
    queryKey: ['sessions', uid, 'completed', from, to],
    queryFn: async () =>
      (must(await supabase.from('workout_sessions').select(SESSION_SELECT).eq('user_id', uid).eq('status', 'completed')
        .gte('on_date', from).lte('on_date', to).order('started_at', { ascending: false })) as SessionWithDetails[]).map(sortSession),
  });
}

export interface ExerciseLogRow {
  date: ISODate;
  sessionId: string;
  sets: WorkoutSet[];
}

/** Every completed session in which this exercise was logged. */
export function useExerciseLog(exerciseId: string | null) {
  const uid = useUserId();
  return useQuery({
    queryKey: ['exerciseLog', uid, exerciseId],
    enabled: !!exerciseId,
    queryFn: async () => {
      const rows = must(await supabase.from('workout_session_exercises')
        .select('session_id, workout_sets(*), workout_sessions!inner(on_date, status)')
        .eq('user_id', uid).eq('exercise_id', exerciseId!).eq('workout_sessions.status', 'completed')) as unknown as
        { session_id: string; workout_sets: WorkoutSet[]; workout_sessions: { on_date: ISODate } }[];
      return rows.map<ExerciseLogRow>((r) => ({ date: r.workout_sessions.on_date, sessionId: r.session_id, sets: r.workout_sets }))
        .sort((a, b) => a.date.localeCompare(b.date));
    },
  });
}

/** The most recent completed performance of each exercise, for "last time" hints. */
export function useLastPerformance(exerciseIds: string[], excludeSessionId?: string) {
  const uid = useUserId();
  const key = [...exerciseIds].sort().join(',');
  return useQuery({
    queryKey: ['lastPerformance', uid, key, excludeSessionId],
    enabled: exerciseIds.length > 0,
    queryFn: async () => {
      const rows = must(await supabase.from('workout_session_exercises')
        .select('exercise_id, session_id, workout_sets(*), workout_sessions!inner(on_date, status, started_at)')
        .eq('user_id', uid).in('exercise_id', exerciseIds).eq('workout_sessions.status', 'completed')
        .limit(300)) as unknown as
        { exercise_id: string; session_id: string; workout_sets: WorkoutSet[]; workout_sessions: { on_date: string; started_at: string } }[];
      const out = new Map<string, { date: string; sets: WorkoutSet[] }>();
      rows
        .filter((r) => r.session_id !== excludeSessionId)
        .sort((a, b) => b.workout_sessions.started_at.localeCompare(a.workout_sessions.started_at))
        .forEach((r) => {
          if (!out.has(r.exercise_id)) {
            const sets = r.workout_sets.filter((s) => s.completed).sort((a, b) => a.set_number - b.set_number);
            if (sets.length) out.set(r.exercise_id, { date: r.workout_sessions.on_date, sets });
          }
        });
      return out;
    },
  });
}

function invalidateSessions(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ['sessions'] });
  qc.invalidateQueries({ queryKey: ['session'] });
  qc.invalidateQueries({ queryKey: ['planned'] });
  qc.invalidateQueries({ queryKey: ['exerciseLog'] });
  qc.invalidateQueries({ queryKey: ['lastPerformance'] });
}

type NewSessionExercise = Pick<SessionExercise,
  'exercise_id' | 'exercise_name' | 'muscle_group' | 'is_timed' | 'target_sets' | 'target_reps' | 'target_duration_sec' | 'target_weight_kg' | 'rest_sec' | 'notes'>;

async function insertSessionExercises(sessionId: string, list: NewSessionExercise[], startPosition: number) {
  if (!list.length) return;
  const inserted = must(await supabase.from('workout_session_exercises')
    .insert(list.map((e, i) => ({ ...e, session_id: sessionId, position: startPosition + i })))
    .select('id, target_sets, target_reps, target_duration_sec, target_weight_kg, is_timed')) as
    Pick<SessionExercise, 'id' | 'target_sets' | 'target_reps' | 'target_duration_sec' | 'target_weight_kg' | 'is_timed'>[];
  const sets = inserted.flatMap((e) =>
    Array.from({ length: e.target_sets }, (_, i) => ({
      session_exercise_id: e.id,
      set_number: i + 1,
      reps: e.is_timed ? null : e.target_reps,
      weight_kg: e.target_weight_kg,
      duration_sec: e.is_timed ? e.target_duration_sec : null,
      completed: false,
    })),
  );
  if (sets.length) must(await supabase.from('workout_sets').insert(sets));
}

export function fromExercise(e: Exercise): NewSessionExercise {
  return {
    exercise_id: e.id, exercise_name: e.name, muscle_group: e.muscle_group, is_timed: e.is_timed,
    target_sets: e.default_sets, target_reps: e.is_timed ? null : e.default_reps,
    target_duration_sec: e.is_timed ? e.default_duration_sec : null, target_weight_kg: null, rest_sec: e.default_rest_sec, notes: null,
  };
}

export function useStartSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ template, planned, title, today }: {
      template?: TemplateWithExercises | null; planned?: PlannedWorkout | null; title?: string; today: ISODate;
    }) => {
      const session = must(await supabase.from('workout_sessions').insert({
        title: title ?? planned?.title ?? template?.name ?? 'Workout',
        on_date: today,
        template_id: template?.id ?? null,
        planned_workout_id: planned?.id ?? null,
      }).select('*').single()) as WorkoutSession;
      try {
        const list = (template?.workout_template_exercises ?? []).map<NewSessionExercise>((te) => ({
          exercise_id: te.exercise_id,
          exercise_name: te.exercises?.name ?? 'Exercise',
          muscle_group: te.exercises?.muscle_group ?? null,
          is_timed: te.exercises?.is_timed ?? !!te.target_duration_sec,
          target_sets: te.sets, target_reps: te.target_reps, target_duration_sec: te.target_duration_sec,
          target_weight_kg: te.target_weight_kg, rest_sec: te.rest_sec, notes: te.notes,
        }));
        await insertSessionExercises(session.id, list, 1);
      } catch (e) {
        await supabase.from('workout_sessions').delete().eq('id', session.id);
        throw e;
      }
      return session;
    },
    onSettled: () => invalidateSessions(qc),
  });
}

function patchSet(qc: QueryClient, setId: string, patch: Partial<WorkoutSet>) {
  qc.setQueriesData<SessionWithDetails>({ queryKey: ['session'] }, (old) => {
    if (!old) return old;
    return {
      ...old,
      workout_session_exercises: old.workout_session_exercises.map((e) => ({
        ...e, workout_sets: e.workout_sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
      })),
    };
  });
}

export function useUpdateSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<WorkoutSet, 'reps' | 'weight_kg' | 'duration_sec' | 'completed' | 'completed_at'>> }) =>
      must(await supabase.from('workout_sets').update(patch).eq('id', id)),
    onMutate: ({ id, patch }) => patchSet(qc, id, patch),
    onError: () => qc.invalidateQueries({ queryKey: ['session'] }),
  });
}

export function useAddSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionExercise, last }: { sessionExercise: SessionExercise; last?: WorkoutSet }) =>
      must(await supabase.from('workout_sets').insert({
        session_exercise_id: sessionExercise.id,
        set_number: (last?.set_number ?? 0) + 1,
        reps: last?.reps ?? sessionExercise.target_reps,
        weight_kg: last?.weight_kg ?? sessionExercise.target_weight_kg,
        duration_sec: last?.duration_sec ?? sessionExercise.target_duration_sec,
        completed: false,
      })),
    onSettled: () => qc.invalidateQueries({ queryKey: ['session'] }),
  });
}

export function useDeleteSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => must(await supabase.from('workout_sets').delete().eq('id', id)),
    onSettled: () => qc.invalidateQueries({ queryKey: ['session'] }),
  });
}

export function useAddSessionExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ session, exercise }: { session: SessionWithDetails; exercise: Exercise }) => {
      const pos = Math.max(0, ...session.workout_session_exercises.map((e) => e.position)) + 1;
      await insertSessionExercises(session.id, [fromExercise(exercise)], pos);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['session'] }),
  });
}

export function useRemoveSessionExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => must(await supabase.from('workout_session_exercises').delete().eq('id', id)),
    onSettled: () => qc.invalidateQueries({ queryKey: ['session'] }),
  });
}

export function useSaveSessionTime() {
  return useMutation({
    mutationFn: async ({ id, activeSeconds }: { id: string; activeSeconds: number }) =>
      must(await supabase.from('workout_sessions').update({ active_seconds: Math.min(86400, Math.round(activeSeconds)) }).eq('id', id)),
  });
}

export function useFinishSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ session, activeSeconds, effort, notes }: {
      session: WorkoutSession; activeSeconds: number; effort: number | null; notes: string | null;
    }) => {
      must(await supabase.from('workout_sessions').update({
        status: 'completed', ended_at: new Date().toISOString(),
        active_seconds: Math.min(86400, Math.round(activeSeconds)), effort, notes,
      }).eq('id', session.id));
      if (session.planned_workout_id)
        must(await supabase.from('planned_workouts').update({ status: 'completed' }).eq('id', session.planned_workout_id));
    },
    onSettled: () => invalidateSessions(qc),
  });
}

export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (session: WorkoutSession) => {
      must(await supabase.from('workout_sessions').delete().eq('id', session.id));
      if (session.status === 'completed' && session.planned_workout_id)
        await supabase.from('planned_workouts').update({ status: 'planned' }).eq('id', session.planned_workout_id);
    },
    onSettled: () => invalidateSessions(qc),
  });
}

export interface ExerciseBest {
  maxWeight: number | null;
  maxReps: number | null;
  maxDuration: number | null;
}

/** All-time bests per exercise from completed sessions (excluding one session). */
export function useExerciseBests(exerciseIds: string[], excludeSessionId?: string) {
  const uid = useUserId();
  const key = [...exerciseIds].sort().join(',');
  return useQuery({
    queryKey: ['exerciseBests', uid, key, excludeSessionId],
    enabled: exerciseIds.length > 0,
    queryFn: async () => {
      const rows = must(await supabase.from('workout_session_exercises')
        .select('exercise_id, session_id, workout_sets(reps, weight_kg, duration_sec, completed), workout_sessions!inner(status)')
        .eq('user_id', uid).in('exercise_id', exerciseIds).eq('workout_sessions.status', 'completed')) as unknown as
        { exercise_id: string; session_id: string; workout_sets: Pick<WorkoutSet, 'reps' | 'weight_kg' | 'duration_sec' | 'completed'>[] }[];
      const out = new Map<string, ExerciseBest>();
      for (const r of rows) {
        if (r.session_id === excludeSessionId) continue;
        const b = out.get(r.exercise_id) ?? { maxWeight: null, maxReps: null, maxDuration: null };
        for (const s of r.workout_sets) {
          if (!s.completed) continue;
          const w = s.weight_kg === null ? null : Number(s.weight_kg);
          if (w !== null && w > 0 && (b.maxWeight === null || w > b.maxWeight)) b.maxWeight = w;
          if (s.reps !== null && (b.maxReps === null || s.reps > b.maxReps)) b.maxReps = s.reps;
          if (s.duration_sec !== null && (b.maxDuration === null || s.duration_sec > b.maxDuration)) b.maxDuration = s.duration_sec;
        }
        out.set(r.exercise_id, b);
      }
      return out;
    },
  });
}
