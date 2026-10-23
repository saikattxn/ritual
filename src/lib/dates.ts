// Calendar-date helpers that work on 'YYYY-MM-DD' strings so that a user's
// "today" never drifts with UTC offsets or daylight-saving changes.
import type { ISODate } from '@/types/db';

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Today's calendar date in the given IANA timezone. */
export function todayIn(tz: string, now: Date = new Date()): ISODate {
  const safe = isValidTimezone(tz) ? tz : browserTimezone();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: safe, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Current 'HH:MM' wall-clock time in a timezone. */
export function clockIn(tz: string, now: Date = new Date()): string {
  const safe = isValidTimezone(tz) ? tz : browserTimezone();
  return new Intl.DateTimeFormat('en-GB', { timeZone: safe, hour: '2-digit', minute: '2-digit', hour12: false })
    .format(now)
    .replace(/^24/, '00');
}

export function hourIn(tz: string, now: Date = new Date()): number {
  return Number(clockIn(tz, now).slice(0, 2));
}

function toUTC(d: ISODate): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day, 12));
}

function fromUTC(dt: Date): ISODate {
  return dt.toISOString().slice(0, 10);
}

export function addDays(d: ISODate, n: number): ISODate {
  const dt = toUTC(d);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fromUTC(dt);
}

export function addMonths(d: ISODate, n: number): ISODate {
  const dt = toUTC(d);
  const day = dt.getUTCDate();
  dt.setUTCDate(1);
  dt.setUTCMonth(dt.getUTCMonth() + n);
  const last = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  dt.setUTCDate(Math.min(day, last));
  return fromUTC(dt);
}

export function weekday(d: ISODate): number {
  return toUTC(d).getUTCDay();
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(a).getTime() - toUTC(b).getTime()) / 86_400_000);
}

export function startOfWeek(d: ISODate, weekStartsOn: number): ISODate {
  const back = (weekday(d) - weekStartsOn + 7) % 7;
  return addDays(d, -back);
}

export function startOfMonth(d: ISODate): ISODate {
  return d.slice(0, 8) + '01';
}

export function endOfMonth(d: ISODate): ISODate {
  return addDays(addMonths(startOfMonth(d), 1), -1);
}

/** Inclusive list of dates from `from` to `to`. */
export function dateRange(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  if (from > to) return out;
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function formatDate(d: ISODate, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }): string {
  return new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: 'UTC' }).format(toUTC(d));
}

export function formatLongDate(d: ISODate): string {
  return formatDate(d, { weekday: 'long', day: 'numeric', month: 'long' });
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  if (m > 0) return sec ? `${m}m ${sec}s` : `${m} min`;
  return `${sec}s`;
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = m.toString().padStart(2, '0');
  const ss = sec.toString().padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Days ordered from the user's chosen first day of the week. */
export function orderedWeekdays(weekStartsOn: number): number[] {
  return Array.from({ length: 7 }, (_, i) => (weekStartsOn + i) % 7);
}

export function describeDays(days: number[], weekStartsOn = 1): string {
  const set = new Set(days);
  if (set.size === 7) return 'Every day';
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return 'Weekdays';
  if (set.size === 2 && set.has(0) && set.has(6)) return 'Weekends';
  return orderedWeekdays(weekStartsOn).filter((d) => set.has(d)).map((d) => WEEKDAY_SHORT[d]).join(', ');
}
