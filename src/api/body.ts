import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { must, supabase } from '@/lib/supabase';
import { useUserId } from '@/auth/AuthProvider';
import type { BodyMeasurement, FitnessGoal, ISODate, MeasurementKind, ProgressPhoto } from '@/types/db';

/* ------------------------------------------------------------ Measurements */
export function useMeasurements() {
  const uid = useUserId();
  return useQuery({
    queryKey: ['measurements', uid],
    queryFn: async () =>
      must(await supabase.from('body_measurements').select('*').eq('user_id', uid)
        .order('measured_on', { ascending: true }).order('created_at')) as BodyMeasurement[],
  });
}

export function useAddMeasurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: { measured_on: ISODate; kind: MeasurementKind; value: number; notes: string | null }[]) =>
      must(await supabase.from('body_measurements').insert(rows)),
    onSettled: () => qc.invalidateQueries({ queryKey: ['measurements'] }),
  });
}

export function useDeleteMeasurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => must(await supabase.from('body_measurements').delete().eq('id', id)),
    onSettled: () => qc.invalidateQueries({ queryKey: ['measurements'] }),
  });
}

/* ------------------------------------------------------------------- Goals */
export function useGoals() {
  const uid = useUserId();
  return useQuery({
    queryKey: ['goals', uid],
    queryFn: async () =>
      must(await supabase.from('fitness_goals').select('*').eq('user_id', uid).order('created_at')) as FitnessGoal[],
  });
}

export type GoalInput = Pick<FitnessGoal,
  'title' | 'kind' | 'exercise_id' | 'measurement_kind' | 'start_value' | 'current_value' | 'target_value' | 'unit' | 'target_date'>;

export function useSaveGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: Partial<GoalInput> & { achieved_on?: ISODate | null; archived_at?: string | null } }) =>
      id ? must(await supabase.from('fitness_goals').update(input).eq('id', id)) : must(await supabase.from('fitness_goals').insert(input)),
    onSettled: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => must(await supabase.from('fitness_goals').delete().eq('id', id)),
    onSettled: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  });
}

/* ---------------------------------------------------------- Progress photos */
export const PHOTO_BUCKET = 'progress-photos';
export const AVATAR_BUCKET = 'avatars';

export function usePhotos() {
  const uid = useUserId();
  return useQuery({
    queryKey: ['photos', uid],
    queryFn: async () =>
      must(await supabase.from('progress_photos').select('*').eq('user_id', uid).order('taken_on', { ascending: false })) as ProgressPhoto[],
  });
}

function extFor(file: File) {
  return ({ 'image/png': 'png', 'image/webp': 'webp' } as Record<string, string>)[file.type] ?? 'jpg';
}

export function validateImage(file: File, maxMb: number): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Please choose a JPG, PNG or WebP image.';
  if (file.size > maxMb * 1024 * 1024) return `Images must be smaller than ${maxMb} MB.`;
  return null;
}

export function useUploadPhoto() {
  const uid = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, takenOn, note }: { file: File; takenOn: ISODate; note: string | null }) => {
      const problem = validateImage(file, 8);
      if (problem) throw new Error(problem);
      const path = `${uid}/${takenOn}-${crypto.randomUUID()}.${extFor(file)}`;
      const up = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) throw new Error(up.error.message);
      const ins = await supabase.from('progress_photos').insert({ taken_on: takenOn, storage_path: path, note });
      if (ins.error) {
        await supabase.storage.from(PHOTO_BUCKET).remove([path]);
        throw new Error(ins.error.message);
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['photos'] }),
  });
}

export function useDeletePhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (photo: ProgressPhoto) => {
      const rm = await supabase.storage.from(PHOTO_BUCKET).remove([photo.storage_path]);
      if (rm.error) throw new Error(rm.error.message);
      must(await supabase.from('progress_photos').delete().eq('id', photo.id));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['photos'] }),
  });
}

export function useUploadAvatar() {
  const uid = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, previous }: { file: File; previous: string | null }) => {
      const problem = validateImage(file, 2);
      if (problem) throw new Error(problem);
      const path = `${uid}/avatar-${Date.now()}.${extFor(file)}`;
      const up = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, { contentType: file.type });
      if (up.error) throw new Error(up.error.message);
      must(await supabase.from('profiles').update({ avatar_path: path }).eq('id', uid));
      if (previous) await supabase.storage.from(AVATAR_BUCKET).remove([previous]);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  });
}

export function useRemoveAvatar() {
  const uid = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (path: string) => {
      must(await supabase.from('profiles').update({ avatar_path: null }).eq('id', uid));
      await supabase.storage.from(AVATAR_BUCKET).remove([path]);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  });
}
