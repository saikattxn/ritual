import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Problems with the Supabase configuration, if any. The app refuses to run
 *  without a real backend rather than silently falling back to local storage. */
export const configProblems: string[] = [];
if (!url || url.includes('your-project-ref')) configProblems.push('VITE_SUPABASE_URL is missing.');
else if (!/^https?:\/\//.test(url)) configProblems.push('VITE_SUPABASE_URL must start with https://');
if (!anonKey || anonKey === 'your-anon-public-key') configProblems.push('VITE_SUPABASE_ANON_KEY is missing.');

export const isConfigured = configProblems.length === 0;

export const supabase: SupabaseClient = createClient(
  isConfigured ? url! : 'http://localhost.invalid',
  isConfigured ? anonKey! : 'missing',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  },
);

/** Throw a readable error from a Supabase response. */
export function must<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) throw new Error(friendlyError(res.error.message, res.error.code));
  return res.data;
}

export function friendlyError(message: string, code?: string): string {
  if (code === '42501' || /row-level security/i.test(message))
    return 'That action is not allowed for your account.';
  if (code === '23505') return 'That already exists.';
  if (/check constraint/i.test(message)) return 'Some of the values are not valid. Please check the form.';
  if (/Failed to fetch|NetworkError/i.test(message)) return 'Could not reach the server. Check your connection and try again.';
  if (/JWT expired|invalid JWT/i.test(message)) return 'Your session has expired. Please sign in again.';
  return message;
}
