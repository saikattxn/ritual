import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { must, supabase } from '@/lib/supabase';
import { useUserId } from '@/auth/AuthProvider';
import type { Habit, HabitCompletion, ISODate } from '@/types/db';

export function useHabits() {
  const uid = useUserId();
  return useQuery({
    queryKey: ['habits', uid],
    queryFn: async () =>
      must(await supabase.from('habits').select('*').eq('user_id', uid).order('position').order('created_at')) as Habit[],
  });
}

export function useHabitCompletions(from: ISODate, to: ISODate) {
  const uid = useUserId();
  return useQuery({
    queryKey: ['habitCompletions', uid, from, to],
    queryFn: async () =>
      must(await supabase.from('habit_completions').select('*').eq('user_id', uid).gte('on_date', from).lte('on_date', to)) as HabitCompletion[],
  });
}

export function useToggleHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ habitId, date, done }: { habitId: string; date: ISODate; done: boolean }) => {
      if (done) {
        const { error } = await supabase.from('habit_completions')
          .upsert({ habit_id: habitId, on_date: date }, { onConflict: 'habit_id,on_date', ignoreDuplicates: true });
        if (error) throw new Error(error.message);
      } else {
        must(await supabase.from('habit_completions').delete().eq('habit_id', habitId).eq('on_date', date));
      }
    },
    onMutate: async ({ habitId, date, done }) => {
      await qc.cancelQueries({ queryKey: ['habitCompletions'] });
      const snapshot = qc.getQueriesData<HabitCompletion[]>({ queryKey: ['habitCompletions'] });
      qc.setQueriesData<HabitCompletion[]>({ queryKey: ['habitCompletions'] }, (old) => {
        if (!old) return old;
        const without = old.filter((c) => !(c.habit_id === habitId && c.on_date === date));
        return done ? [...without, { id: 'optimistic', user_id: '', habit_id: habitId, on_date: date, completed_at: '' }] : without;
      });
      return { snapshot };
    },
    onError: (_e, _v, ctx) => ctx?.snapshot.forEach(([k, v]) => qc.setQueryData(k, v)),
    onSettled: () => qc.invalidateQueries({ queryKey: ['habitCompletions'] }),
  });
}

export type HabitInput = Pick<Habit, 'name' | 'icon' | 'days' | 'reminder_time'>;

export function useSaveHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input, today }: { id?: string; input: HabitInput; today: ISODate }) =>
      id
        ? must(await supabase.from('habits').update(input).eq('id', id))
        : must(await supabase.from('habits').insert({ ...input, created_on: today })),
    onSettled: () => qc.invalidateQueries({ queryKey: ['habits'] }),
  });
}

export function useArchiveHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, archivedOn }: { id: string; archivedOn: ISODate | null }) =>
      must(await supabase.from('habits').update({ archived_on: archivedOn }).eq('id', id)),
    onSettled: () => qc.invalidateQueries({ queryKey: ['habits'] }),
  });
}

export function useDeleteHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => must(await supabase.from('habits').delete().eq('id', id)),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['habits'] });
      qc.invalidateQueries({ queryKey: ['habitCompletions'] });
    },
  });
}
