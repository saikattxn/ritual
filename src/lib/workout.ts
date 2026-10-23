// Workout maths on logged sets. Estimated 1RM is clearly an estimate (Epley).
import type { ISODate, WorkoutSet } from '@/types/db';

export function estimated1RM(weightKg: number, reps: number): number | null {
  if (!weightKg || !reps || reps < 1) return null;
  if (reps === 1) return weightKg;
  if (reps > 12) return null; // the formula becomes unreliable at high reps
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

export function setVolume(s: Pick<WorkoutSet, 'reps' | 'weight_kg' | 'completed'>): number {
  if (!s.completed || !s.reps || !s.weight_kg) return 0;
  return s.reps * Number(s.weight_kg);
}

export interface ExercisePoint {
  date: ISODate;
  sessionId: string;
  bestWeight: number | null; // heaviest completed set, kg
  bestReps: number | null; // most reps in one completed set
  e1rm: number | null; // estimate
  volume: number; // kg × reps
  bestDuration: number | null;
}

export interface PersonalRecords {
  heaviest: { value: number; reps: number; date: ISODate } | null;
  bestE1rm: { value: number; date: ISODate } | null;
  mostReps: { value: number; date: ISODate } | null;
  longest: { value: number; date: ISODate } | null;
}

export function exerciseHistory(
  rows: { date: ISODate; sessionId: string; sets: Pick<WorkoutSet, 'reps' | 'weight_kg' | 'duration_sec' | 'completed'>[] }[],
): { points: ExercisePoint[]; prs: PersonalRecords } {
  const points: ExercisePoint[] = [];
  const prs: PersonalRecords = { heaviest: null, bestE1rm: null, mostReps: null, longest: null };
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  for (const r of sorted) {
    const done = r.sets.filter((s) => s.completed);
    if (done.length === 0) continue;
    let bestWeight: number | null = null;
    let bestReps: number | null = null;
    let e1rm: number | null = null;
    let bestDuration: number | null = null;
    let volume = 0;
    for (const s of done) {
      const w = s.weight_kg === null ? null : Number(s.weight_kg);
      if (w !== null && w > 0 && (bestWeight === null || w > bestWeight)) bestWeight = w;
      if (s.reps !== null && (bestReps === null || s.reps > bestReps)) bestReps = s.reps;
      if (w && s.reps) {
        const e = estimated1RM(w, s.reps);
        if (e !== null && (e1rm === null || e > e1rm)) e1rm = e;
        if (!prs.heaviest || w > prs.heaviest.value) prs.heaviest = { value: w, reps: s.reps, date: r.date };
      }
      if (s.duration_sec && (bestDuration === null || s.duration_sec > bestDuration)) bestDuration = s.duration_sec;
      volume += setVolume(s);
    }
    if (e1rm !== null && (!prs.bestE1rm || e1rm > prs.bestE1rm.value)) prs.bestE1rm = { value: e1rm, date: r.date };
    if (bestReps !== null && (!prs.mostReps || bestReps > prs.mostReps.value)) prs.mostReps = { value: bestReps, date: r.date };
    if (bestDuration !== null && (!prs.longest || bestDuration > prs.longest.value))
      prs.longest = { value: bestDuration, date: r.date };
    points.push({ date: r.date, sessionId: r.sessionId, bestWeight, bestReps, e1rm, volume, bestDuration });
  }
  return { points, prs };
}
