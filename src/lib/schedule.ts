// Pure scheduling + consistency maths. Everything here works on saved rows
// only, so statistics are never invented. Unit-tested in schedule.test.ts.
import type { Habit, HabitCompletion, ISODate, RoutineCompletion, RoutineItem } from '@/types/db';
import { addDays, dateRange, weekday } from './dates';

export function itemActiveOn(item: Pick<RoutineItem, 'starts_on' | 'ends_on'>, d: ISODate): boolean {
  return item.starts_on <= d && (item.ends_on === null || d <= item.ends_on);
}

export function itemScheduledOn(item: Pick<RoutineItem, 'days' | 'starts_on' | 'ends_on'>, d: ISODate): boolean {
  return itemActiveOn(item, d) && item.days.includes(weekday(d));
}

export function habitScheduledOn(h: Pick<Habit, 'days' | 'created_on' | 'archived_on'>, d: ISODate): boolean {
  return h.created_on <= d && (h.archived_on === null || d < h.archived_on) && h.days.includes(weekday(d));
}

export interface DayTally {
  date: ISODate;
  scheduled: number;
  done: number;
}

export function completionKey(itemId: string, d: ISODate) {
  return `${itemId}|${d}`;
}

export function routineTallies(
  items: RoutineItem[],
  completions: Pick<RoutineCompletion, 'routine_item_id' | 'on_date'>[],
  from: ISODate,
  to: ISODate,
): DayTally[] {
  const done = new Set(completions.map((c) => completionKey(c.routine_item_id, c.on_date)));
  return dateRange(from, to).map((date) => {
    let scheduled = 0;
    let d = 0;
    for (const it of items) {
      if (!itemScheduledOn(it, date)) continue;
      scheduled++;
      if (done.has(completionKey(it.id, date))) d++;
    }
    return { date, scheduled, done: d };
  });
}

export function habitTallies(
  habits: Habit[],
  completions: Pick<HabitCompletion, 'habit_id' | 'on_date'>[],
  from: ISODate,
  to: ISODate,
): DayTally[] {
  const done = new Set(completions.map((c) => completionKey(c.habit_id, c.on_date)));
  return dateRange(from, to).map((date) => {
    let scheduled = 0;
    let d = 0;
    for (const h of habits) {
      if (!habitScheduledOn(h, date)) continue;
      scheduled++;
      if (done.has(completionKey(h.id, date))) d++;
    }
    return { date, scheduled, done: d };
  });
}

/** Sum of tallies → percentage, or null when nothing was scheduled (no data ≠ 0%). */
export function rate(tallies: DayTally[]): number | null {
  const s = tallies.reduce((a, t) => a + t.scheduled, 0);
  if (s === 0) return null;
  return Math.round((tallies.reduce((a, t) => a + t.done, 0) / s) * 100);
}

export function mergeTallies(...lists: DayTally[][]): DayTally[] {
  const map = new Map<ISODate, DayTally>();
  for (const list of lists) {
    for (const t of list) {
      const cur = map.get(t.date) ?? { date: t.date, scheduled: 0, done: 0 };
      cur.scheduled += t.scheduled;
      cur.done += t.done;
      map.set(t.date, cur);
    }
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Current streak: consecutive scheduled days, counting back from `today`,
 * where everything scheduled was completed. Days with nothing scheduled are
 * skipped rather than breaking the streak. Today only counts once complete.
 */
export function currentStreak(tallies: DayTally[], today: ISODate): number {
  const byDate = new Map(tallies.map((t) => [t.date, t]));
  let streak = 0;
  let d = today;
  const t0 = byDate.get(today);
  if (t0 && t0.scheduled > 0 && t0.done < t0.scheduled) d = addDays(today, -1);
  for (;;) {
    const t = byDate.get(d);
    if (!t) break;
    if (t.scheduled > 0) {
      if (t.done >= t.scheduled) streak++;
      else break;
    }
    d = addDays(d, -1);
  }
  return streak;
}

/**
 * Work out how to change a routine item's schedule without rewriting history.
 * - Items that started today or later are edited in place.
 * - Older items are closed off yesterday and a new version starts today.
 */
export type ReviseAction =
  | { type: 'update'; id: string }
  | { type: 'split'; endId: string; endOn: ISODate; startOn: ISODate };

export function planRevision(item: Pick<RoutineItem, 'id' | 'starts_on'>, today: ISODate): ReviseAction {
  if (item.starts_on >= today) return { type: 'update', id: item.id };
  return { type: 'split', endId: item.id, endOn: addDays(today, -1), startOn: today };
}

export type EndAction = { type: 'delete'; id: string } | { type: 'end'; id: string; endOn: ISODate };

/** Stop an item from today onwards, keeping its past. */
export function planEnd(item: Pick<RoutineItem, 'id' | 'starts_on'>, today: ISODate): EndAction {
  if (item.starts_on >= today) return { type: 'delete', id: item.id };
  return { type: 'end', id: item.id, endOn: addDays(today, -1) };
}
