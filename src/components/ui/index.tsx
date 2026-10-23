import {
  forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode,
  type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react';
import { AlertCircle, Check, Loader2, RotateCcw, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { WEEKDAY_LETTER, WEEKDAY_LONG, orderedWeekdays } from '@/lib/dates';

/* ----------------------------------------------------------------- Button */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const variantCls: Record<Variant, string> = {
  primary: 'bg-sage-700 text-cream-50 hover:bg-sage-800 shadow-sm',
  secondary: 'bg-white text-ink-900 border border-sage-200 hover:border-sage-400 hover:bg-sage-50',
  soft: 'bg-sage-100 text-sage-800 hover:bg-sage-200',
  ghost: 'text-ink-700 hover:bg-sage-100/70',
  danger: 'bg-clay-600 text-white hover:bg-clay-700',
};
const sizeCls: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-xl',
  md: 'h-11 px-4 text-[15px] gap-2 rounded-xl',
  lg: 'h-12 px-6 text-base gap-2 rounded-2xl',
  icon: 'h-10 w-10 rounded-xl',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none',
        variantCls[variant], sizeCls[size], className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

/* ------------------------------------------------------------------- Card */
export function Card({ className, children, as: As = 'section' }: { className?: string; children: ReactNode; as?: 'section' | 'div' | 'article' }) {
  return <As className={cn('card p-5 sm:p-6', className)}>{children}</As>;
}

export function CardHeader({ title, eyebrow, action, icon }: { title: ReactNode; eyebrow?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {icon && <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sage-100 text-sage-700">{icon}</div>}
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow mb-0.5">{eyebrow}</p>}
          <h2 className="text-lg font-medium leading-tight truncate">{title}</h2>
        </div>
      </div>
      {action}
    </div>
  );
}

/* ----------------------------------------------------------------- Fields */
interface FieldWrap {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  className?: string;
}

function FieldShell({ id, label, hint, error, className, children }: FieldWrap & { id: string; children: ReactNode }) {
  return (
    <div className={className}>
      {label && <label htmlFor={id} className="label">{label}</label>}
      {children}
      {error ? (
        <p id={`${id}-err`} className="mt-1.5 text-sm text-clay-700 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}

export const TextField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldWrap>(
  function TextField({ label, hint, error, className, id, ...rest }, ref) {
    const auto = useId();
    const fid = id ?? auto;
    return (
      <FieldShell id={fid} label={label} hint={hint} error={error} className={className}>
        <input
          ref={ref}
          id={fid}
          className="input"
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${fid}-err` : hint ? `${fid}-hint` : undefined}
          {...rest}
        />
      </FieldShell>
    );
  },
);

export function TextArea({ label, hint, error, className, id, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldWrap) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldShell id={fid} label={label} hint={hint} error={error} className={className}>
      <textarea id={fid} className="input min-h-[84px] resize-y" aria-invalid={!!error || undefined} {...rest} />
    </FieldShell>
  );
}

export function SelectField({
  label, hint, error, className, id, options, ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & FieldWrap & { options: { value: string; label: string }[] }) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldShell id={fid} label={label} hint={hint} error={error} className={className}>
      <select id={fid} className="input appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b6860' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
        {...rest}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </FieldShell>
  );
}

export function Toggle({ checked, onChange, label, description, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode; disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div>
        <label htmlFor={id} className="text-[15px] font-medium text-ink-900">{label}</label>
        {description && <p className="text-sm text-ink-500 mt-0.5">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn('relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50', checked ? 'bg-sage-600' : 'bg-sage-200')}
      >
        <span className={cn('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-6' : 'left-1')} />
      </button>
    </div>
  );
}

/* --------------------------------------------------------------- DayPicker */
export function DayPicker({ value, onChange, weekStartsOn = 1, label = 'Days', error }: {
  value: number[]; onChange: (d: number[]) => void; weekStartsOn?: number; label?: string; error?: string | null;
}) {
  const set = new Set(value);
  const toggle = (d: number) => {
    const next = new Set(set);
    next.has(d) ? next.delete(d) : next.add(d);
    onChange([...next].sort());
  };
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {orderedWeekdays(weekStartsOn).map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={set.has(d)}
            aria-label={WEEKDAY_LONG[d]}
            onClick={() => toggle(d)}
            className={cn(
              'h-10 w-10 rounded-full text-sm font-medium transition border',
              set.has(d) ? 'bg-sage-700 text-cream-50 border-sage-700' : 'bg-white text-ink-700 border-sage-200 hover:border-sage-400',
            )}
          >
            {WEEKDAY_LETTER[d]}
          </button>
        ))}
        <div className="flex gap-1 ml-1">
          <button type="button" className="text-xs text-sage-700 underline-offset-2 hover:underline px-1" onClick={() => onChange([0, 1, 2, 3, 4, 5, 6])}>All</button>
          <button type="button" className="text-xs text-sage-700 underline-offset-2 hover:underline px-1" onClick={() => onChange([1, 2, 3, 4, 5])}>Weekdays</button>
        </div>
      </div>
      {error && <p className="mt-1.5 text-sm text-clay-700">{error}</p>}
    </fieldset>
  );
}

/* --------------------------------------------------------- Status blocks */
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-sage-600', className)} aria-label="Loading" />;
}

export function LoadingBlock({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-2 py-10 text-sm text-ink-500', className)} role="status">
      <Spinner /> {label}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-sage-100/70', className)} />;
}

export function ErrorBlock({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : 'Something went wrong.';
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-clay-300/60 bg-clay-100/40 p-6 text-center">
      <AlertCircle className="h-6 w-6 text-clay-600" />
      <p className="text-sm text-ink-700">{msg}</p>
      {onRetry && <Button size="sm" variant="secondary" icon={<RotateCcw className="h-4 w-4" />} onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center px-4 py-10">
      {icon && <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-sage-100 text-sage-600">{icon}</div>}
      <h3 className="text-lg font-medium">{title}</h3>
      {children && <p className="mt-1.5 max-w-sm text-sm text-ink-500">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Notice({ tone = 'info', title, children, icon, className }: {
  tone?: 'info' | 'caution' | 'success'; title?: ReactNode; children?: ReactNode; icon?: ReactNode; className?: string;
}) {
  const cls = {
    info: 'bg-sage-50 border-sage-200 text-sage-900',
    caution: 'bg-clay-100/50 border-clay-300/70 text-ink-900',
    success: 'bg-sage-100 border-sage-300 text-sage-900',
  }[tone];
  return (
    <div className={cn('flex gap-3 rounded-2xl border p-4 text-sm', cls, className)} role={tone === 'caution' ? 'note' : undefined}>
      {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
      <div>
        {title && <p className="font-medium mb-0.5">{title}</p>}
        {children && <div className="text-ink-700 leading-relaxed">{children}</div>}
      </div>
    </div>
  );
}

export function Badge({ children, tone = 'sage', className }: { children: ReactNode; tone?: 'sage' | 'clay' | 'ink' | 'cream'; className?: string }) {
  const cls = {
    sage: 'bg-sage-100 text-sage-800', clay: 'bg-clay-100 text-clay-700', ink: 'bg-ink-900/5 text-ink-700', cream: 'bg-cream-200 text-ink-700',
  }[tone];
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', cls, className)}>{children}</span>;
}

/* --------------------------------------------------------------- Progress */
export function ProgressRing({ value, size = 64, stroke = 6, label, children }: {
  value: number | null; size?: number; stroke?: number; label?: string; children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }} role="img"
      aria-label={label ?? (value === null ? 'Nothing scheduled' : `${v}% complete`)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-sage-100" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          className="stroke-sage-600 transition-[stroke-dashoffset] duration-700 ease-out"
          strokeDasharray={c} strokeDashoffset={c - (v / 100) * c} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function ProgressBar({ value, className, tone = 'sage' }: { value: number; className?: string; tone?: 'sage' | 'clay' }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-sage-100', className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full transition-all duration-500', tone === 'sage' ? 'bg-sage-600' : 'bg-clay-500')} style={{ width: `${v}%` }} />
    </div>
  );
}

/* ---------------------------------------------------------------- CheckRow */
export function CheckRow({ checked, onToggle, title, subtitle, disabled, pending, trailing }: {
  checked: boolean; onToggle: () => void; title: ReactNode; subtitle?: ReactNode; disabled?: boolean; pending?: boolean; trailing?: ReactNode;
}) {
  return (
    <div className={cn('flex items-center gap-3 rounded-xl px-2 py-2 transition', !disabled && 'hover:bg-sage-50')}>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled || pending}
        onClick={onToggle}
        className={cn(
          'grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition',
          checked ? 'border-sage-600 bg-sage-600 text-white' : 'border-sage-300 bg-white hover:border-sage-500',
          (disabled || pending) && 'opacity-60',
        )}
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : checked && <Check className="h-4 w-4 animate-pop" strokeWidth={3} />}
        <span className="sr-only">{typeof title === 'string' ? title : 'Mark complete'}</span>
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn('text-[15px] leading-snug truncate', checked ? 'text-ink-400 line-through decoration-sage-300' : 'text-ink-900')}>{title}</p>
        {subtitle && <p className="text-xs text-ink-500 truncate">{subtitle}</p>}
      </div>
      {trailing}
    </div>
  );
}

/* -------------------------------------------------------------------- Tabs */
export function Segmented<T extends string>({ value, onChange, options, label, className }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; label: string; className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cn('inline-flex rounded-xl bg-sage-100/80 p-1 gap-1 max-w-full overflow-x-auto', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium transition',
            value === o.value ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-900',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------- Modal */
export function Modal({ open, onClose, title, children, footer, size = 'md' }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const list = [...f].filter((el) => !el.hasAttribute('disabled'));
        if (list.length === 0) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => {
      const target = ref.current?.querySelector<HTMLElement>('[data-autofocus], input, select, textarea') ?? ref.current;
      target?.focus();
    }, 20);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  const width = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-ink-900/30 backdrop-blur-[2px] animate-fade-up" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn('relative w-full max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-cream-50 shadow-lift animate-fade-up', width)}
      >
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 pt-5 pb-3">
          <h2 id={titleId} className="text-xl font-medium">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></Button>
        </div>
        <div className="overflow-y-auto px-5 sm:px-6 pb-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-sage-100 px-5 sm:px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, action, eyebrow }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between animate-fade-up">
      <div>
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="text-3xl sm:text-4xl font-normal">{title}</h1>
        {subtitle && <p className="mt-1.5 text-ink-500 max-w-2xl">{subtitle}</p>}
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </header>
  );
}

export function Stat({ label, value, hint }: { label: ReactNode; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/70 border border-sage-100 p-4">
      <p className="text-xs font-medium text-ink-500">{label}</p>
      <p className="mt-1 font-serif text-2xl text-ink-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}
