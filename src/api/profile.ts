import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { must, supabase } from '@/lib/supabase';
import { useUserId } from '@/auth/AuthProvider';
import { browserTimezone, hourIn, todayIn } from '@/lib/dates';
import type { Profile } from '@/types/db';

export function useProfileQuery() {
  const uid = useUserId();
  return useQuery({
    queryKey: ['profile', uid],
    queryFn: async () => {
      const row = must(await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()) as Profile | null;
      if (!row) throw new Error('Your profile could not be found. Try signing out and in again.');
      // First visit: adopt the browser's timezone instead of the UTC default.
      const tz = browserTimezone();
      if (row.timezone === 'UTC' && tz !== 'UTC') {
        const updated = await supabase.from('profiles').update({ timezone: tz }).eq('id', uid).select('*').single();
        if (!updated.error) return updated.data as Profile;
      }
      return row;
    },
    staleTime: 5 * 60_000,
  });
}

/** Profile for use inside the app shell, where it is guaranteed to be loaded. */
export function useProfile(): Profile {
  const { data } = useProfileQuery();
  if (!data) throw new Error('Profile not loaded');
  return data;
}

export function useUpdateProfile() {
  const uid = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>) =>
      must(await supabase.from('profiles').update(patch).eq('id', uid).select('*').single()) as Profile,
    onSuccess: (p) => qc.setQueryData(['profile', uid], p),
  });
}

/** Today's date in the user's timezone; re-renders when the day changes. */
export function useToday(): string {
  const { timezone } = useProfile();
  const [today, setToday] = useState(() => todayIn(timezone));
  useEffect(() => {
    setToday(todayIn(timezone));
    const t = setInterval(() => setToday(todayIn(timezone)), 30_000);
    return () => clearInterval(t);
  }, [timezone]);
  return today;
}

export function useHour(): number {
  const { timezone } = useProfile();
  return hourIn(timezone);
}

/** Short-lived signed URL for a private storage object. */
export function useSignedUrl(bucket: string, path: string | null | undefined) {
  return useQuery({
    queryKey: ['signed', bucket, path],
    enabled: !!path,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path!, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}
