// Personal data export. RLS guarantees each query only returns the signed-in
// user's rows (plus read-only library rows, which are filtered out here).
import { supabase } from './supabase';

const OWN_TABLES = [
  'care_products', 'routine_items', 'routine_completions', 'habits', 'habit_completions', 'fitness_profiles',
  'planned_workouts', 'workout_sessions', 'workout_session_exercises', 'workout_sets', 'fitness_goals',
  'body_measurements', 'progress_photos',
] as const;

async function fetchAll(table: string, uid: string) {
  const out: Record<string, unknown>[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase.from(table).select('*').eq('user_id', uid).range(from, from + page - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < page) break;
  }
  return out;
}

export type ExportData = { exported_at: string; app: string; profile: unknown } & Record<string, Record<string, unknown>[]>;

export async function buildExport(uid: string): Promise<ExportData> {
  const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', uid).single();
  if (error) throw new Error(error.message);
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const t of OWN_TABLES) tables[t] = await fetchAll(t, uid);
  tables.custom_exercises = await fetchAll('exercises', uid);
  tables.workout_templates = await fetchAll('workout_templates', uid);
  tables.workout_template_exercises = await fetchAll('workout_template_exercises', uid);
  return { ...tables, exported_at: new Date().toISOString(), app: 'Ritual', profile } as ExportData;
}

export function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = Array.isArray(v) ? v.join(' ') : typeof v === 'object' ? JSON.stringify(v) : String(v);
  // Neutralise spreadsheet formula injection and quote when needed.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  const cols = columns ?? [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n');
}

/** One row per logged set, joined with its session and exercise — handy in a spreadsheet. */
export function workoutLogCsv(data: ExportData): string {
  const sessions = new Map<unknown, Record<string, unknown>>(data.workout_sessions.map((s) => [s.id, s]));
  const exercises = new Map<unknown, Record<string, unknown>>(data.workout_session_exercises.map((e) => [e.id, e]));
  const rows = data.workout_sets.map((set) => {
    const ex: Record<string, unknown> = exercises.get(set.session_exercise_id) ?? {};
    const s: Record<string, unknown> = sessions.get(ex.session_id) ?? {};
    return {
      date: s.on_date, workout: s.title, status: s.status, exercise: ex.exercise_name, set: set.set_number,
      reps: set.reps, weight_kg: set.weight_kg, duration_sec: set.duration_sec, completed: set.completed,
    };
  }).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return toCsv(rows, ['date', 'workout', 'status', 'exercise', 'set', 'reps', 'weight_kg', 'duration_sec', 'completed']);
}
