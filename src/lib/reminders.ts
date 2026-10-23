// In-browser reminders. These are shown with the Notification API while Ritual
// is open in a tab or installed app window. They are NOT push notifications:
// nothing is delivered when the app is fully closed. The UI says so plainly.
import { useEffect } from 'react';
import { useProfile } from '@/api/profile';
import { useHabits } from '@/api/habits';
import { clockIn, todayIn } from './dates';
import { habitScheduledOn } from './schedule';

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') return Notification.permission;
  return Notification.requestPermission();
}

function firedKey(key: string, date: string) {
  return `ritual:reminder:${key}:${date}`;
}

function alreadyFired(key: string, date: string) {
  try {
    return localStorage.getItem(firedKey(key, date)) === '1';
  } catch {
    return false;
  }
}

function markFired(key: string, date: string) {
  try {
    localStorage.setItem(firedKey(key, date), '1');
  } catch {
    /* storage unavailable: reminder may repeat once, which is harmless */
  }
}

export function showLocalNotification(title: string, body: string) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: '/icons/icon-192.png', tag: title });
  } catch {
    // Some mobile browsers only allow notifications through a service worker.
    navigator.serviceWorker?.ready.then((reg) => reg.showNotification(title, { body, icon: '/icons/icon-192.png', tag: title })).catch(() => {});
  }
}

export function useReminders() {
  const profile = useProfile();
  const prefs = profile.reminders ?? {};
  const habits = useHabits().data;
  useEffect(() => {
    if (!prefs.enabled || !notificationsSupported()) return;
    const plan: { key: string; time: string | null | undefined; title: string; body: string }[] = [
      { key: 'morning', time: prefs.morning, title: 'Morning ritual', body: 'Your morning skincare routine is ready when you are.' },
      { key: 'evening', time: prefs.evening, title: 'Evening ritual', body: 'Time to wind down with your evening routine.' },
      { key: 'workout', time: prefs.workout, title: 'Movement check-in', body: 'Have a look at today’s planned workout.' },
    ];
    const tick = () => {
      if (Notification.permission !== 'granted') return;
      const now = clockIn(profile.timezone);
      const today = todayIn(profile.timezone);
      if (prefs.habits && habits) {
        for (const h of habits) {
          if (h.reminder_time && habitScheduledOn(h, today) && !plan.some((p) => p.key === `habit-${h.id}`))
            plan.push({ key: `habit-${h.id}`, time: h.reminder_time.slice(0, 5), title: h.name, body: 'A gentle nudge for your habit today.' });
        }
      }
      for (const r of plan) {
        if (!r.time) continue;
        // Fire within a 10-minute window after the chosen time, once per day.
        const [h, m] = r.time.split(':').map(Number);
        const [nh, nm] = now.split(':').map(Number);
        const delta = nh * 60 + nm - (h * 60 + m);
        if (delta >= 0 && delta < 10 && !alreadyFired(r.key, today)) {
          markFired(r.key, today);
          showLocalNotification(r.title, r.body);
        }
      }
    };
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, [prefs.enabled, prefs.morning, prefs.evening, prefs.workout, prefs.habits, habits, profile.timezone]);
}
