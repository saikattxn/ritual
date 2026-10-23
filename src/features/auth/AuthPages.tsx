import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Leaf, MailCheck } from 'lucide-react';
import { friendlyError, supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthProvider';
import { Button, Notice, TextField } from '@/components/ui';
import { Logo } from '@/components/layout/Logo';

const email = z.string().trim().min(1, 'Enter your email address.').email('Enter a valid email address.');
const password = z.string().min(8, 'Use at least 8 characters.').max(72, 'Use 72 characters or fewer.');

type Errors = Record<string, string | undefined>;

function collect(result: z.SafeParseReturnType<unknown, unknown>): Errors {
  if (result.success) return {};
  const out: Errors = {};
  for (const issue of result.error.issues) out[String(issue.path[0])] ??= issue.message;
  return out;
}

function authMessage(msg: string): string {
  if (/Invalid login credentials/i.test(msg)) return 'That email and password don’t match an account.';
  if (/Email not confirmed/i.test(msg)) return 'Please confirm your email address first — check your inbox for the link.';
  if (/User already registered/i.test(msg)) return 'An account with that email already exists. Try signing in instead.';
  if (/rate limit/i.test(msg)) return 'Too many attempts. Please wait a minute and try again.';
  return friendlyError(msg);
}

function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.1fr_1fr]">
      <div className="hidden lg:flex flex-col justify-between bg-sage-800 text-cream-100 p-12 relative overflow-hidden">
        <div className="relative z-10"><span className="[&_span]:text-cream-50"><Logo /></span></div>
        <div className="relative z-10 max-w-md">
          <p className="font-serif text-4xl leading-tight text-cream-50">Small, kind rituals — kept gently, every day.</p>
          <p className="mt-4 text-sage-200">Skincare, hair care, movement and habits in one calm, private place.</p>
        </div>
        <p className="relative z-10 text-sm text-sage-300">Your data stays in your own account.</p>
        <div className="absolute -right-24 -bottom-24 h-96 w-96 rounded-full bg-sage-700/60" aria-hidden />
        <div className="absolute right-24 top-24 h-40 w-40 rounded-full bg-clay-500/20" aria-hidden />
      </div>
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="lg:hidden mb-8"><Logo /></div>
          <h1 className="text-3xl">{title}</h1>
          {subtitle && <p className="mt-2 text-ink-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-sm text-ink-500">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

export function SignIn() {
  const nav = useNavigate();
  const loc = useLocation();
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs = collect(z.object({ email, password: z.string().min(1, 'Enter your password.') }).safeParse(values));
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setFormError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: values.email.trim(), password: values.password });
    setBusy(false);
    if (error) return setFormError(authMessage(error.message));
    nav((loc.state as { from?: string } | null)?.from ?? '/', { replace: true });
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to continue your rituals."
      footer={<>New here? <Link to="/signup" className="font-medium text-sage-700 hover:underline">Create an account</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {formError && <Notice tone="caution">{formError}</Notice>}
        <TextField label="Email" type="email" autoComplete="email" value={values.email} error={errors.email}
          onChange={(e) => setValues({ ...values, email: e.target.value })} />
        <TextField label="Password" type="password" autoComplete="current-password" value={values.password} error={errors.password}
          onChange={(e) => setValues({ ...values, password: e.target.value })} />
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm text-sage-700 hover:underline">Forgot password?</Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={busy}>Sign in</Button>
      </form>
    </AuthLayout>
  );
}

export function SignUp() {
  const nav = useNavigate();
  const [values, setValues] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const schema = z.object({
      name: z.string().trim().min(1, 'What should we call you?').max(60, 'Keep it under 60 characters.'),
      email, password, confirm: z.string(),
    }).refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords don’t match.' });
    const errs = collect(schema.safeParse(values));
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setFormError(null);
    const { data, error } = await supabase.auth.signUp({
      email: values.email.trim(),
      password: values.password,
      options: { data: { display_name: values.name.trim() }, emailRedirectTo: `${window.location.origin}/` },
    });
    setBusy(false);
    if (error) return setFormError(authMessage(error.message));
    if (data.session) nav('/', { replace: true });
    else setSentTo(values.email.trim());
  }

  if (sentTo)
    return (
      <AuthLayout title="Check your inbox">
        <Notice tone="success" icon={<MailCheck className="h-5 w-5 text-sage-700" />} title="Confirm your email">
          We’ve sent a confirmation link to <strong>{sentTo}</strong>. Open it on this device to finish creating your account.
        </Notice>
        <p className="mt-6 text-sm text-ink-500">Didn’t get it? Check spam, or <button className="text-sage-700 hover:underline" onClick={() => setSentTo(null)}>try again</button>.</p>
        <Link to="/signin" className="mt-6 inline-block text-sm font-medium text-sage-700 hover:underline">Back to sign in</Link>
      </AuthLayout>
    );

  return (
    <AuthLayout title="Create your Ritual" subtitle="A private space for the routines that look after you."
      footer={<>Already have an account? <Link to="/signin" className="font-medium text-sage-700 hover:underline">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {formError && <Notice tone="caution">{formError}</Notice>}
        <TextField label="Your name" autoComplete="given-name" value={values.name} error={errors.name}
          onChange={(e) => setValues({ ...values, name: e.target.value })} />
        <TextField label="Email" type="email" autoComplete="email" value={values.email} error={errors.email}
          onChange={(e) => setValues({ ...values, email: e.target.value })} />
        <TextField label="Password" type="password" autoComplete="new-password" hint="At least 8 characters." value={values.password}
          error={errors.password} onChange={(e) => setValues({ ...values, password: e.target.value })} />
        <TextField label="Confirm password" type="password" autoComplete="new-password" value={values.confirm} error={errors.confirm}
          onChange={(e) => setValues({ ...values, confirm: e.target.value })} />
        <Button type="submit" size="lg" className="w-full" loading={busy} icon={<Leaf className="h-4 w-4" />}>Create account</Button>
        <p className="text-xs text-ink-500 leading-relaxed">
          Ritual is a personal tracker, not a medical service. Skincare and fitness guidance in the app is general information only.
        </p>
      </form>
    </AuthLayout>
  );
}

export function ForgotPassword() {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = email.safeParse(value);
    if (!r.success) return setError(r.error.issues[0].message);
    setError(undefined);
    setBusy(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(r.data, { redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    if (err) return setError(authMessage(err.message));
    setSent(true);
  }

  return (
    <AuthLayout title="Reset your password" subtitle="We’ll email you a secure link to choose a new one."
      footer={<Link to="/signin" className="font-medium text-sage-700 hover:underline">Back to sign in</Link>}>
      {sent ? (
        <Notice tone="success" icon={<MailCheck className="h-5 w-5 text-sage-700" />} title="Check your email">
          If an account exists for that address, a reset link is on its way. The link opens a page where you can set a new password.
        </Notice>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <TextField label="Email" type="email" autoComplete="email" value={value} error={error} onChange={(e) => setValue(e.target.value)} />
          <Button type="submit" size="lg" className="w-full" loading={busy}>Send reset link</Button>
        </form>
      )}
    </AuthLayout>
  );
}

export function ResetPassword() {
  const { user, loading, clearRecovering } = useAuth();
  const nav = useNavigate();
  const [values, setValues] = useState({ password: '', confirm: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [waited, setWaited] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setWaited(true), 2500);
    return () => clearTimeout(t);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs = collect(z.object({ password, confirm: z.string() })
      .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords don’t match.' }).safeParse(values));
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: values.password });
    setBusy(false);
    if (error) return setFormError(authMessage(error.message));
    clearRecovering();
    nav('/', { replace: true });
  }

  if (!user)
    return (
      <AuthLayout title="Reset your password">
        {loading || !waited ? (
          <p className="text-ink-500">Checking your reset link…</p>
        ) : (
          <Notice tone="caution" title="This link has expired or was already used">
            Request a new one from the <Link className="text-sage-700 underline" to="/forgot-password">forgot password</Link> page.
            Open the link on the same device and browser you requested it from.
          </Notice>
        )}
      </AuthLayout>
    );

  return (
    <AuthLayout title="Choose a new password">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {formError && <Notice tone="caution">{formError}</Notice>}
        <TextField label="New password" type="password" autoComplete="new-password" value={values.password} error={errors.password}
          onChange={(e) => setValues({ ...values, password: e.target.value })} />
        <TextField label="Confirm new password" type="password" autoComplete="new-password" value={values.confirm} error={errors.confirm}
          onChange={(e) => setValues({ ...values, confirm: e.target.value })} />
        <Button type="submit" size="lg" className="w-full" loading={busy}>Save new password</Button>
      </form>
    </AuthLayout>
  );
}
