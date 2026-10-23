import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { Button, Modal } from './index';
import { cn } from '@/lib/cn';

/* ------------------------------------------------------------------ Toasts */
type ToastTone = 'success' | 'error' | 'info';
interface ToastItem { id: number; tone: ToastTone; message: string }

interface ToastApi {
  success: (m: string) => void;
  error: (m: unknown) => void;
  info: (m: string) => void;
}

const ToastCtx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const push = useCallback((tone: ToastTone, message: string) => {
    const id = nextId.current++;
    setItems((xs) => [...xs.slice(-3), { id, tone, message }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), tone === 'error' ? 6000 : 3200);
  }, []);
  const api = useRef<ToastApi>({
    success: (m) => push('success', m),
    info: (m) => push('info', m),
    error: (e) => push('error', e instanceof Error ? e.message : typeof e === 'string' ? e : 'Something went wrong.'),
  });
  return (
    <ToastCtx.Provider value={api.current}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 lg:bottom-6 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((t) => (
          <div key={t.id}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-2xl px-4 py-3 text-sm shadow-lift animate-fade-up',
              t.tone === 'error' ? 'bg-clay-700 text-white' : 'bg-ink-900 text-cream-50',
            )}
            role={t.tone === 'error' ? 'alert' : 'status'}
          >
            {t.tone === 'error' ? <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> : <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-sage-300" />}
            <span className="flex-1">{t.message}</span>
            <button className="opacity-70 hover:opacity-100" aria-label="Dismiss" onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))}>
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

/* ----------------------------------------------------------------- Confirm */
interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
}
type ConfirmFn = (o: ConfirmOptions) => Promise<boolean>;
const ConfirmCtx = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback<ConfirmFn>((o) => new Promise((resolve) => setState({ ...o, resolve })), []);
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        onClose={() => close(false)}
        title={state?.title ?? ''}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => close(false)}>Cancel</Button>
            <Button data-autofocus variant={state?.tone === 'primary' ? 'primary' : 'danger'} onClick={() => close(true)}>
              {state?.confirmLabel ?? 'Delete'}
            </Button>
          </>
        }
      >
        {state?.body && <div className="text-ink-700 text-[15px] leading-relaxed">{state.body}</div>}
      </Modal>
    </ConfirmCtx.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider');
  return ctx;
}
