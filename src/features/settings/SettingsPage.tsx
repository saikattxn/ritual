import { useMemo, useRef, useState, type FormEvent } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import {
  Bell, Camera, Download, Dumbbell, KeyRound, Ruler, Scissors, Sparkles, Trash2, User,
} from 'lucide-react';
import { useAuth, useUserId } from '@/auth/AuthProvider';
import { useProfile, useUpdateProfile } from '@/api/profile';
import { AVATAR_BUCKET, PHOTO_BUCKET, useRemoveAvatar, useUploadAvatar } from '@/api/body';
import { useRoutineItems } from '@/api/care';
import { useFitnessProfile, useSaveFitnessProfile } from '@/api/fitness';
import {
  Button, Card, CardHeader, DayPicker, ErrorBlock, Notice, PageHeader, SelectField, Skeleton, TextField, Toggle,
} from '@/components/ui';
import { useToast } from '@/components/ui/feedback';
import { Avatar } from '@/components/layout/AppShell';
import { EQUIPMENT, FITNESS_GOALS, LOCATIONS, DIFFICULTY } from '@/lib/constants';
import { browserTimezone, WEEKDAY_LONG } from '@/lib/dates';
import { friendlyError, supabase } from '@/lib/supabase';
import { buildExport, download, workoutLogCsv, toCsv } from '@/lib/export';
import { notificationsSupported, requestNotificationPermission, showLocalNotification } from '@/lib/reminders';
import { cn } from '@/lib/cn';
import { ProductFormModal, ProductList } from '@/features/care/shared';
import type { Area, CareProduct, FitnessProfile } from '@/types/db';

const SECTIONS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'skincare', label: 'Skincare products', icon: Sparkles },
  { id: 'haircare', label: 'Hair-care products', icon: Scissors },
  { id: 'workouts', label: 'Workout preferences', icon: Dumbbell },
  { id: 'display', label: 'Units & display', icon: Ruler },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Account security', icon: KeyRound },
  { id: 'data', label: 'Your data', icon: Download },
] as const;

export default function SettingsPage() {
  const { section = 'profile' } = useParams();
  const current = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];
  return (
    <>
      <PageHeader eyebrow="Settings" title={current.label} />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Settings sections" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:flex-col lg:overflow-visible">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <NavLink key={id} to={`/settings/${id}`}
              className={({ isActive }) => cn('flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition',
                isActive ? 'bg-sage-100 font-medium text-sage-900' : 'text-ink-700 hover:bg-sage-50')}>
              <Icon className="h-4 w-4" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="min-w-0 space-y-5">
          {current.id === 'profile' && <ProfileSection />}
          {current.id === 'skincare' && <ProductsSection area="skin" />}
          {current.id === 'haircare' && <ProductsSection area="hair" />}
          {current.id === 'workouts' && <WorkoutPrefsSection />}
          {current.id === 'display' && <DisplaySection />}
          {current.id === 'notifications' && <NotificationsSection />}
          {current.id === 'security' && <SecuritySection />}
          {current.id === 'data' && <DataSection />}
        </div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- Profile */
function ProfileSection() {
  const profile = useProfile();
  const { user } = useAuth();
  const update = useUpdateProfile();
  const upload = useUploadAvatar();
  const remove = useRemoveAvatar();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(profile.display_name);
  const [tz, setTz] = useState(profile.timezone);
  const [error, setError] = useState<string | null>(null);
  const zones = useMemo(() => {
    try {
      return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [profile.timezone];
    } catch {
      return [profile.timezone];
    }
  }, [profile.timezone]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('Enter a display name.');
    if (name.trim().length > 60) return setError('Keep it under 60 characters.');
    setError(null);
    update.mutate({ display_name: name.trim(), timezone: tz }, { onSuccess: () => toast.success('Profile saved'), onError: (x) => toast.error(x) });
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="flex items-center gap-4">
          <Avatar path={profile.avatar_path} name={profile.display_name} size={72} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" icon={<Camera className="h-4 w-4" />} loading={upload.isPending} onClick={() => file.current?.click()}>
              {profile.avatar_path ? 'Change photo' : 'Add photo'}
            </Button>
            {profile.avatar_path && (
              <Button size="sm" variant="ghost" loading={remove.isPending}
                onClick={() => remove.mutate(profile.avatar_path!, { onSuccess: () => toast.success('Photo removed'), onError: (x) => toast.error(x) })}>Remove</Button>
            )}
            <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Choose a profile photo"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) upload.mutate({ file: f, previous: profile.avatar_path }, { onSuccess: () => toast.success('Photo updated'), onError: (x) => toast.error(x) });
              }} />
            <p className="w-full text-xs text-ink-500">JPG, PNG or WebP up to 2 MB. Stored privately.</p>
          </div>
        </div>
        <TextField label="Display name" value={name} onChange={(e) => setName(e.target.value)} error={error} maxLength={60} />
        <TextField label="Email" value={user?.email ?? ''} disabled hint="Change it under Account security." />
        <SelectField label="Timezone" value={tz} onChange={(e) => setTz(e.target.value)} hint={`Decides when your day starts. Your device says ${browserTimezone()}.`}
          options={(zones.includes(tz) ? zones : [tz, ...zones]).map((z) => ({ value: z, label: z.replace(/_/g, ' ') }))} />
        <div className="flex justify-end"><Button type="submit" loading={update.isPending}>Save profile</Button></div>
      </form>
    </Card>
  );
}

/* --------------------------------------------------------------- Products */
function ProductsSection({ area }: { area: Area }) {
  const items = useRoutineItems(area);
  const [editing, setEditing] = useState<CareProduct | null | undefined>(undefined);
  return (
    <Card>
      <CardHeader title={area === 'skin' ? 'Skincare products' : 'Hair-care products'}
        action={<Button size="sm" onClick={() => setEditing(null)}>Add product</Button>} />
      <p className="mb-3 text-sm text-ink-500">Add, edit, schedule, pause, archive or delete products. Archiving keeps your history; deleting removes it.</p>
      <ProductList area={area} onEdit={setEditing} />
      {editing !== undefined && items.data && (
        <ProductFormModal open area={area} product={editing} items={items.data} onClose={() => setEditing(undefined)} />
      )}
    </Card>
  );
}

/* -------------------------------------------------------- Workout prefs */
function WorkoutPrefsSection() {
  const fp = useFitnessProfile();
  if (fp.error) return <ErrorBlock error={fp.error} onRetry={() => fp.refetch()} />;
  if (fp.isLoading) return <Skeleton className="h-80" />;
  return <WorkoutPrefsForm initial={fp.data ?? null} />;
}

function WorkoutPrefsForm({ initial }: { initial: FitnessProfile | null }) {
  const save = useSaveFitnessProfile();
  const { week_starts_on } = useProfile();
  const toast = useToast();
  const [f, setF] = useState({
    goal: initial?.goal ?? 'general_fitness', experience: initial?.experience ?? 'beginner', location: initial?.location ?? 'home',
    equipment: initial?.equipment ?? [], preferred_days: initial?.preferred_days ?? [1, 3, 5], session_minutes: String(initial?.session_minutes ?? 45),
  });
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const m = Number(f.session_minutes);
    if (!Number.isInteger(m) || m < 5 || m > 240) return setError('Session length must be 5–240 minutes.');
    if (!f.preferred_days.length) return setError('Pick at least one preferred day.');
    setError(null);
    save.mutate({ ...f, session_minutes: m } as Omit<FitnessProfile, 'user_id' | 'updated_at'>,
      { onSuccess: () => toast.success('Workout preferences saved'), onError: (x) => toast.error(x) });
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField label="Main goal" value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value as typeof f.goal })}
            options={Object.entries(FITNESS_GOALS).map(([value, label]) => ({ value, label }))} />
          <SelectField label="Experience" value={f.experience} onChange={(e) => setF({ ...f, experience: e.target.value as typeof f.experience })}
            options={Object.entries(DIFFICULTY).map(([value, label]) => ({ value, label }))} />
          <SelectField label="Usually train" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value as typeof f.location })}
            options={Object.entries(LOCATIONS).map(([value, label]) => ({ value, label }))} />
        </div>
        <fieldset>
          <legend className="label">Equipment you have</legend>
          <div className="flex flex-wrap gap-2">
            {Object.entries(EQUIPMENT).filter(([k]) => k !== 'none').map(([k, label]) => {
              const on = f.equipment.includes(k);
              return (
                <button key={k} type="button" aria-pressed={on} onClick={() => setF({ ...f, equipment: on ? f.equipment.filter((x) => x !== k) : [...f.equipment, k] })}
                  className={cn('rounded-full border px-3 py-1.5 text-sm', on ? 'border-sage-600 bg-sage-600 text-white' : 'border-sage-200 bg-white')}>{label}</button>
              );
            })}
          </div>
        </fieldset>
        <DayPicker label="Preferred workout days" value={f.preferred_days} onChange={(d) => setF({ ...f, preferred_days: d })} weekStartsOn={week_starts_on} />
        <TextField label="Typical session (minutes)" type="number" inputMode="numeric" className="max-w-[200px]" value={f.session_minutes}
          onChange={(e) => setF({ ...f, session_minutes: e.target.value })} />
        {error && <p className="text-sm text-clay-700">{error}</p>}
        {f.experience === 'beginner' && (
          <Notice title="Starting out">Two or three full-body sessions a week with a rest day between is a common, sensible start. Begin lighter than you think and add a little at a time.</Notice>
        )}
        <div className="flex justify-end"><Button type="submit" loading={save.isPending}>Save preferences</Button></div>
      </form>
    </Card>
  );
}

/* ---------------------------------------------------------------- Display */
function DisplaySection() {
  const p = useProfile();
  const update = useUpdateProfile();
  const toast = useToast();
  const set = (patch: Parameters<typeof update.mutate>[0]) => update.mutate(patch, { onSuccess: () => toast.success('Saved'), onError: (x) => toast.error(x) });
  return (
    <Card>
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField label="Weight" value={p.weight_unit} onChange={(e) => set({ weight_unit: e.target.value as 'kg' | 'lb' })}
          options={[{ value: 'kg', label: 'Kilograms (kg)' }, { value: 'lb', label: 'Pounds (lb)' }]} />
        <SelectField label="Length" value={p.length_unit} onChange={(e) => set({ length_unit: e.target.value as 'cm' | 'in' })}
          options={[{ value: 'cm', label: 'Centimetres (cm)' }, { value: 'in', label: 'Inches (in)' }]} />
        <SelectField label="Week starts on" value={String(p.week_starts_on)} onChange={(e) => set({ week_starts_on: Number(e.target.value) })}
          options={[1, 0, 6].map((d) => ({ value: String(d), label: WEEKDAY_LONG[d] }))} />
      </div>
      <p className="mt-3 text-xs text-ink-500">Weights and measurements are stored in metric and converted for display, so switching units never changes your records.</p>
      <div className="mt-4 border-t border-sage-100 pt-3">
        <Toggle label="Show streaks" description="Counts of consecutive days. Missing a day never deletes anything." checked={p.show_streaks} onChange={(v) => set({ show_streaks: v })} />
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------- Notifications */
function NotificationsSection() {
  const p = useProfile();
  const update = useUpdateProfile();
  const toast = useToast();
  const r = p.reminders ?? {};
  const [perm, setPerm] = useState<string>(notificationsSupported() ? Notification.permission : 'unsupported');
  const set = (patch: typeof r) => update.mutate({ reminders: { ...r, ...patch } }, { onError: (x) => toast.error(x) });

  const enable = async (on: boolean) => {
    if (on) {
      const res = await requestNotificationPermission();
      setPerm(res);
      if (res !== 'granted') return toast.error(res === 'unsupported' ? 'This browser doesn’t support notifications.' : 'Notifications are blocked for this site in your browser settings.');
    }
    set({ enabled: on, morning: r.morning ?? '08:00', evening: r.evening ?? '21:30' });
  };

  return (
    <Card>
      <Notice className="mb-4" title="How reminders work">
        Ritual shows reminders through your browser while it’s open in a tab or as an installed app. It does not send push
        notifications when Ritual is fully closed. Settings sync across devices; permission is granted per browser.
      </Notice>
      {perm === 'unsupported' ? <p className="text-sm text-ink-500">This browser doesn’t support notifications.</p> : (
        <>
          <Toggle label="Enable reminders" description={perm === 'denied' ? 'Blocked in your browser settings for this site.' : `Browser permission: ${perm}`}
            checked={!!r.enabled && perm === 'granted'} onChange={enable} />
          {r.enabled && perm === 'granted' && (
            <div className="mt-4 space-y-4 border-t border-sage-100 pt-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <TextField label="Morning skincare" type="time" value={r.morning ?? ''} onChange={(e) => set({ morning: e.target.value || null })} />
                <TextField label="Evening skincare" type="time" value={r.evening ?? ''} onChange={(e) => set({ evening: e.target.value || null })} />
                <TextField label="Workout check-in" type="time" value={r.workout ?? ''} onChange={(e) => set({ workout: e.target.value || null })} />
              </div>
              <Toggle label="Habit reminders" description="Uses the reminder time set on each habit." checked={!!r.habits} onChange={(v) => set({ habits: v })} />
              <Button size="sm" variant="secondary" onClick={() => showLocalNotification('Ritual', 'Reminders are working on this device.')}>Send a test reminder</Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

/* --------------------------------------------------------------- Security */
function SecuritySection() {
  const { user } = useAuth();
  const toast = useToast();
  const [pw, setPw] = useState({ next: '', confirm: '' });
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [email, setEmail] = useState('');

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    if (pw.next.length < 8) return setPwErr('Use at least 8 characters.');
    if (pw.next !== pw.confirm) return setPwErr('Passwords don’t match.');
    setPwErr(null);
    setBusy('pw');
    const { error } = await supabase.auth.updateUser({ password: pw.next });
    setBusy(null);
    if (error) return toast.error(friendlyError(error.message));
    setPw({ next: '', confirm: '' });
    toast.success('Password changed');
  }

  async function changeEmail(e: FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return toast.error('Enter a valid email address.');
    setBusy('email');
    const { error } = await supabase.auth.updateUser({ email: email.trim() }, { emailRedirectTo: `${window.location.origin}/settings/security` });
    setBusy(null);
    if (error) return toast.error(friendlyError(error.message));
    setEmail('');
    toast.success('Check both inboxes to confirm the change');
  }

  return (
    <>
      <Card>
        <CardHeader title="Change password" />
        <form onSubmit={changePassword} className="grid gap-4 sm:grid-cols-2" noValidate>
          <TextField label="New password" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
          <TextField label="Confirm new password" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} error={pwErr} />
          <div className="sm:col-span-2 flex justify-end"><Button type="submit" loading={busy === 'pw'}>Update password</Button></div>
        </form>
      </Card>
      <Card>
        <CardHeader title="Change email" eyebrow={user?.email} />
        <form onSubmit={changeEmail} className="flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
          <TextField className="flex-1" label="New email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" loading={busy === 'email'}>Send confirmation</Button>
        </form>
      </Card>
      <Card>
        <CardHeader title="Sessions" />
        <p className="mb-3 text-sm text-ink-500">Signed in on a shared or lost device? Sign out everywhere, including here.</p>
        <Button variant="secondary" loading={busy === 'global'} onClick={async () => {
          setBusy('global');
          await supabase.auth.signOut({ scope: 'global' });
        }}>Sign out of all devices</Button>
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------- Data */
function DataSection() {
  const uid = useUserId();
  const { signOut } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');

  const exportJson = async () => {
    setBusy('json');
    try {
      const data = await buildExport(uid);
      download(`ritual-export-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json');
      toast.success('Export downloaded');
    } catch (e) { toast.error(e); } finally { setBusy(null); }
  };
  const exportCsv = async (kind: 'workouts' | 'measurements' | 'routines') => {
    setBusy(kind);
    try {
      const data = await buildExport(uid);
      const date = new Date().toISOString().slice(0, 10);
      if (kind === 'workouts') download(`ritual-workout-log-${date}.csv`, workoutLogCsv(data), 'text/csv');
      if (kind === 'measurements') download(`ritual-measurements-${date}.csv`, toCsv(data.body_measurements, ['measured_on', 'kind', 'value', 'notes']), 'text/csv');
      if (kind === 'routines') download(`ritual-routine-completions-${date}.csv`, toCsv(data.routine_completions), 'text/csv');
      toast.success('CSV downloaded');
    } catch (e) { toast.error(e); } finally { setBusy(null); }
  };

  const deleteAccount = async () => {
    setBusy('delete');
    try {
      for (const bucket of [AVATAR_BUCKET, PHOTO_BUCKET]) {
        const { data: files, error } = await supabase.storage.from(bucket).list(uid, { limit: 1000 });
        if (error) throw new Error(error.message);
        if (files?.length) {
          const rm = await supabase.storage.from(bucket).remove(files.map((f) => `${uid}/${f.name}`));
          if (rm.error) throw new Error(rm.error.message);
        }
      }
      const { error } = await supabase.rpc('delete_my_account');
      if (error) throw new Error(friendlyError(error.message));
      await signOut();
    } catch (e) {
      toast.error(e);
      setBusy(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader title="Export your data" />
        <p className="mb-4 text-sm text-ink-500">Download everything in your account. The JSON file contains every record; the CSV files open in any spreadsheet.</p>
        <div className="flex flex-wrap gap-2">
          <Button icon={<Download className="h-4 w-4" />} loading={busy === 'json'} onClick={exportJson}>Everything (JSON)</Button>
          <Button variant="secondary" loading={busy === 'workouts'} onClick={() => exportCsv('workouts')}>Workout log (CSV)</Button>
          <Button variant="secondary" loading={busy === 'measurements'} onClick={() => exportCsv('measurements')}>Measurements (CSV)</Button>
          <Button variant="secondary" loading={busy === 'routines'} onClick={() => exportCsv('routines')}>Routine check-ins (CSV)</Button>
        </div>
        <p className="mt-3 text-xs text-ink-500">Progress photos aren’t included in the export file; download any you want to keep first.</p>
      </Card>
      <Card className="border-clay-300/70">
        <CardHeader title="Delete account" icon={<Trash2 className="h-[18px] w-[18px] text-clay-700" />} />
        <p className="text-sm text-ink-700">
          This permanently deletes your account, every product, routine, habit, workout, measurement and photo. It can’t be undone.
          Consider exporting your data first.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <TextField className="flex-1" label="Type DELETE to confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
          <Button variant="danger" disabled={confirmText !== 'DELETE'} loading={busy === 'delete'} onClick={deleteAccount}>Delete my account</Button>
        </div>
      </Card>
    </>
  );
}
