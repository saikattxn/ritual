import { describe, expect, it } from 'vitest';
import { addDays, addMonths, dateRange, startOfWeek, todayIn, weekday, describeDays, endOfMonth } from './dates';
import { currentStreak, habitTallies, itemScheduledOn, planEnd, planRevision, rate, routineTallies } from './schedule';
import { estimated1RM, exerciseHistory } from './workout';
import { kgTo, toKg } from './units';
import { skincareCautions } from './skincare';
import type { CareProduct, Habit, RoutineItem } from '@/types/db';

const item = (o: Partial<RoutineItem>): RoutineItem => ({
  id: 'i1', user_id: 'u', area: 'skin', product_id: 'p1', label: null, activity: null, slot: 'morning',
  days: [0, 1, 2, 3, 4, 5, 6], position: 0, starts_on: '2026-10-01', ends_on: null, created_at: '', ...o,
});

describe('dates', () => {
  it('handles month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29');
  });
  it('is stable across the UK clock change', () => {
    expect(dateRange('2026-10-24', '2026-10-27')).toEqual(['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27']);
  });
  it('knows weekdays and week starts', () => {
    expect(weekday('2026-10-23')).toBe(5); // Friday
    expect(startOfWeek('2026-10-23', 1)).toBe('2026-10-19');
    expect(startOfWeek('2026-10-23', 0)).toBe('2026-10-18');
  });
  it('computes today in a timezone', () => {
    const late = new Date('2026-10-23T23:30:00Z');
    expect(todayIn('Europe/London', late)).toBe('2026-10-24');
    expect(todayIn('America/New_York', late)).toBe('2026-10-23');
    expect(todayIn('Asia/Dhaka', new Date('2026-10-23T19:00:00Z'))).toBe('2026-10-24');
  });
  it('describes day sets', () => {
    expect(describeDays([0, 1, 2, 3, 4, 5, 6])).toBe('Every day');
    expect(describeDays([1, 2, 3, 4, 5])).toBe('Weekdays');
    expect(describeDays([1, 3, 5])).toBe('Mon, Wed, Fri');
  });
});

describe('schedule', () => {
  it('respects days and validity window', () => {
    const it1 = item({ days: [1], starts_on: '2026-10-05', ends_on: '2026-10-19' });
    expect(itemScheduledOn(it1, '2026-10-05')).toBe(true);
    expect(itemScheduledOn(it1, '2026-10-06')).toBe(false);
    expect(itemScheduledOn(it1, '2026-10-26')).toBe(false); // after end
    expect(itemScheduledOn(it1, '2026-09-28')).toBe(false); // before start
  });
  it('tallies completions and returns null rate when nothing is scheduled', () => {
    const items = [item({ id: 'a' }), item({ id: 'b', days: [5] })];
    const t = routineTallies(items, [{ routine_item_id: 'a', on_date: '2026-10-23' }], '2026-10-22', '2026-10-23');
    expect(t).toEqual([
      { date: '2026-10-22', scheduled: 1, done: 0 },
      { date: '2026-10-23', scheduled: 2, done: 1 },
    ]);
    expect(rate(t)).toBe(33);
    expect(rate([{ date: '2026-10-22', scheduled: 0, done: 0 }])).toBeNull();
  });
  it('habits count from creation and stop on archive', () => {
    const h: Habit = { id: 'h', user_id: 'u', name: 'x', icon: 'leaf', days: [0, 1, 2, 3, 4, 5, 6], reminder_time: null,
      position: 0, created_on: '2026-10-20', archived_on: '2026-10-22', created_at: '' };
    const t = habitTallies([h], [], '2026-10-19', '2026-10-23');
    expect(t.map((x) => x.scheduled)).toEqual([0, 1, 1, 0, 0]);
  });
  it('streak skips rest days and ignores an unfinished today', () => {
    const t = [
      { date: '2026-10-19', scheduled: 2, done: 1 },
      { date: '2026-10-20', scheduled: 2, done: 2 },
      { date: '2026-10-21', scheduled: 0, done: 0 },
      { date: '2026-10-22', scheduled: 1, done: 1 },
      { date: '2026-10-23', scheduled: 3, done: 1 },
    ];
    expect(currentStreak(t, '2026-10-23')).toBe(2);
  });
  it('versions schedule edits instead of rewriting history', () => {
    expect(planRevision({ id: 'x', starts_on: '2026-10-23' }, '2026-10-23')).toEqual({ type: 'update', id: 'x' });
    expect(planRevision({ id: 'x', starts_on: '2026-10-01' }, '2026-10-23')).toEqual({
      type: 'split', endId: 'x', endOn: '2026-10-22', startOn: '2026-10-23',
    });
    expect(planEnd({ id: 'x', starts_on: '2026-10-23' }, '2026-10-23')).toEqual({ type: 'delete', id: 'x' });
  });
});

describe('workout maths', () => {
  it('estimates 1RM only in a sensible rep range', () => {
    expect(estimated1RM(100, 1)).toBe(100);
    expect(estimated1RM(100, 5)).toBe(116.7);
    expect(estimated1RM(100, 20)).toBeNull();
  });
  it('builds history and PRs from completed sets only', () => {
    const { points, prs } = exerciseHistory([
      { date: '2026-10-01', sessionId: 's1', sets: [{ reps: 8, weight_kg: 40, duration_sec: null, completed: true }] },
      { date: '2026-10-08', sessionId: 's2', sets: [
        { reps: 6, weight_kg: 45, duration_sec: null, completed: true },
        { reps: 10, weight_kg: 60, duration_sec: null, completed: false },
      ] },
      { date: '2026-10-09', sessionId: 's3', sets: [{ reps: 8, weight_kg: 50, duration_sec: null, completed: false }] },
    ]);
    expect(points).toHaveLength(2);
    expect(prs.heaviest?.value).toBe(45);
    expect(points[1].volume).toBe(270);
  });
  it('converts units both ways', () => {
    expect(kgTo(100, 'lb')).toBe(220.5);
    expect(toKg(220.5, 'lb')).toBe(100.02);
  });
});

describe('skincare cautions', () => {
  const prod = (id: string, category: string, actives: string[] = []): CareProduct => ({
    id, user_id: 'u', area: 'skin', category, name: id, brand: null, notes: null, usage_instructions: null,
    actives, started_on: null, replace_on: null, status: 'active', created_at: '', updated_at: '',
  });
  it('flags retinoid + AHA in the same routine and a missing sunscreen', () => {
    const products = [prod('r', 'retinoid'), prod('a', 'exfoliant', ['aha']), prod('c', 'cleanser')];
    const items = [
      item({ id: '1', product_id: 'r', slot: 'evening' }),
      item({ id: '2', product_id: 'a', slot: 'evening' }),
      item({ id: '3', product_id: 'c', slot: 'morning' }),
    ];
    const ids = skincareCautions(products, items).map((c) => c.id);
    expect(ids).toContain('evening-retinoid-aha');
    expect(ids).toContain('sunscreen');
  });
});
