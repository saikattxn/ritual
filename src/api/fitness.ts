import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { must, supabase } from '@/lib/supabase';
import { useUserId } from '@/auth/AuthProvider';
import type {
  Exercise, FitnessProfile, ISODate, PlannedWorkout, TemplateExercise, TemplateWithExercises, WorkoutTemplate,
} from '@/types/db';

/* ---------------------------------------------------------- Fitness profile */
export function useFitnessProfile() {
  const uid = useUserId();
  return useQuery({
    queryKey: ['fitnessProfile', uid],
    queryFn: async () =>
      must(await supabase.from('fitness_profiles').select('*').eq('user_id', uid).maybeSingle()) as FitnessProfile | null,
  });
}

export function useSaveFitnessProfile() {
  const qc = useQueryClient();
  const uid = useUserId();
  return useMutation({
    mutationFn: async (input: Omit<FitnessProfile, 'user_id' | 'updated_at'>) =>
      must(await supabase.from('fitness_profiles').upsert({ ...input, user_id: uid }).select('*').single()) as FitnessProfile,
    onSuccess: (p) => qc.setQueryData(['fitnessProfile', uid], p),
  });
}

/* ---------------------------------------------------------------- Exercises */
export function useExercises() {
  const uid = useUserId();
  return useQuery({
    queryKey: ['exercises', uid],
    staleTime: 10 * 60_000,
    // RLS returns the shared library plus this user's own exercises.
    queryFn: async () => must(await supabase.from('exercises').select('*').order('name')) as Exercise[],
  });
}

export type ExerciseInput = Pick<Exercise,
  'name' | 'muscle_group' | 'equipment' | 'category' | 'difficulty' | 'instructions' | 'is_timed' |
  'default_sets' | 'default_reps' | 'default_duration_sec' | 'default_rest_sec' | 'demo_url'>;

export function useSaveExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: ExerciseInput }) =>
      (id
        ? must(await supabase.from('exercises').update(input).eq('id', id).select('*').single())
        : must(await supabase.from('exercises').insert(input).select('*').single())) as Exercise,
    onSettled: () => qc.invalidateQueries({ queryKey: ['exercises'] }),
  });
}

export function useArchiveExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) =>
      must(await supabase.from('exercises').update({ archived_at: archived ? new Date().toISOString() : null }).eq('id', id)),
    onSettled: () => qc.invalidateQueries({ queryKey: ['exercises'] }),
  });
}

export function useDeleteExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => must(await supabase.from('exercises').delete().eq('id', id)),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['exercises'] });
      qc.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

/* ---------------------------------------------------------------- Templates */
const TEMPLATE_SELECT = '*, workout_template_exercises(*, exercises(*))';

function sortTemplate(t: TemplateWithExercises): TemplateWithExercises {
  t.workout_template_exercises.sort((a, b) => a.position - b.position);
  return t;
}

export function useTemplates() {
  const uid = useUserId();
  return useQuery({
    queryKey: ['templates', uid],
    queryFn: async () =>
      (must(await supabase.from('workout_templates').select(TEMPLATE_SELECT).order('created_at')) as TemplateWithExercises[])
        .map(sortTemplate),
  });
}

export function useTemplate(id: string | undefined) {
  const uid = useUserId();
  return useQuery({
    queryKey: ['templates', uid, id],
    enabled: !!id,
    queryFn: async () => {
      const t = must(await supabase.from('workout_templates').select(TEMPLATE_SELECT).eq('id', id!).maybeSingle()) as TemplateWithExercises | null;
      if (!t) throw new Error('That workout could not be found.');
      return sortTemplate(t);
    },
  });
}

export type TemplateInput = Pick<WorkoutTemplate, 'name' | 'description' | 'focus' | 'estimated_minutes'>;
export type TemplateExerciseInput = Pick<TemplateExercise,
  'exercise_id' | 'sets' | 'target_reps' | 'target_duration_sec' | 'target_weight_kg' | 'rest_sec' | 'notes'>;

/** Save a template and replace its exercise list in one go. */
export function useSaveTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input, exercises }: { id?: string; input: TemplateInput; exercises: TemplateExerciseInput[] }) => {
      const t = (id
        ? must(await supabase.from('workout_templates').update(input).eq('id', id).select('*').single())
        : must(await supabase.from('workout_templates').insert(input).select('*').single())) as WorkoutTemplate;
      if (id) must(await supabase.from('workout_template_exercises').delete().eq('template_id', t.id));
      if (exercises.length)
        must(await supabase.from('workout_template_exercises').insert(
          exercises.map((e, i) => ({ ...e, template_id: t.id, position: i + 1 })),
        ));
      return t;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

export function useDuplicateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ template, name }: { template: TemplateWithExercises; name?: string }) => {
      const t = must(await supabase.from('workout_templates').insert({
        name: name ?? (template.user_id ? `${template.name} (copy)` : template.name),
        description: template.description, focus: template.focus, estimated_minutes: template.estimated_minutes,
      }).select('*').single()) as WorkoutTemplate;
      const rows = template.workout_template_exercises.map((e) => ({
        template_id: t.id, exercise_id: e.exercise_id, position: e.position, sets: e.sets, target_reps: e.target_reps,
        target_duration_sec: e.target_duration_sec, target_weight_kg: e.target_weight_kg, rest_sec: e.rest_sec, notes: e.notes,
      }));
      if (rows.length) must(await supabase.from('workout_template_exercises').insert(rows));
      return t;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

export function useArchiveTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) =>
      must(await supabase.from('workout_templates').update({ archived_at: archived ? new Date().toISOString() : null }).eq('id', id)),
    onSettled: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => must(await supabase.from('workout_templates').delete().eq('id', id)),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['templates'] });
      qc.invalidateQueries({ queryKey: ['planned'] });
    },
  });
}

/* ----------------------------------------------------------- Weekly planner */
export function usePlanned(from: ISODate, to: ISODate) {
  const uid = useUserId();
  return useQuery({
    queryKey: ['planned', uid, from, to],
    queryFn: async () =>
      must(await supabase.from('planned_workouts').select('*').eq('user_id', uid)
        .gte('on_date', from).lte('on_date', to).order('on_date').order('created_at')) as PlannedWorkout[],
  });
}

export type PlannedInput = Pick<PlannedWorkout, 'on_date' | 'kind' | 'template_id' | 'title' | 'planned_minutes' | 'notes'>;

export function useSavePlanned() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: Partial<PlannedInput> & { status?: PlannedWorkout['status'] } }) =>
      id
        ? must(await supabase.from('planned_workouts').update(input).eq('id', id))
        : must(await supabase.from('planned_workouts').insert(input)),
    onSettled: () => qc.invalidateQueries({ queryKey: ['planned'] }),
  });
}

export function useBulkPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: PlannedInput[]) => {
      if (rows.length) must(await supabase.from('planned_workouts').insert(rows));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['planned'] }),
  });
}

export function useDeletePlanned() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => must(await supabase.from('planned_workouts').delete().eq('id', id)),
    onSettled: () => qc.invalidateQueries({ queryKey: ['planned'] }),
  });
}
