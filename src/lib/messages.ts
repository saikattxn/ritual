import type { ISODate } from '@/types/db';
import { diffDays } from './dates';

// Original, gentle prompts. One is chosen per calendar day.
const MESSAGES = [
  'Small steps, kept gently, become the shape of your days.',
  'You do not have to do everything today. Just the next kind thing.',
  'Consistency is built on ordinary days like this one.',
  'Rest counts. Recovery is part of the routine.',
  'Show up softly. That still counts as showing up.',
  'Progress is quiet. Trust the work you cannot see yet.',
  'Look after the body that carries you through everything.',
  'A missed day is a pause, not a reset.',
  'Today is a fresh page. Fill as much or as little as feels right.',
  'Care for yourself the way you would care for someone you love.',
  'Little rituals make room for big calm.',
  'Move a little, breathe a little, notice a little.',
  'You are allowed to go slowly.',
  'Every routine started with a single morning.',
];

export function messageFor(d: ISODate): string {
  const n = Math.abs(diffDays(d, '2024-01-01'));
  return MESSAGES[n % MESSAGES.length];
}

export function greeting(hour: number): string {
  if (hour < 5) return 'Good evening';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
