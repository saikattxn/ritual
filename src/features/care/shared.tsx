import { useMemo, useState, type FormEvent } from 'react';
import { Archive, ArrowDown, ArrowUp, CalendarClock, MoreHorizontal, Pause, Pencil, Play, RotateCcw, Trash2 } from 'lucide-react';
import {
  useDeleteProduct, useProducts, useReorderItems, useRoutineCompletions, useRoutineItems, useSaveProduct,
  useSetProductStatus, useToggleRoutine, type SlotSchedule,
} from '@/api/care';
import { useProfile, useToday } from '@/api/profile';
import {
  Badge, Button, CheckRow, DayPicker, Modal, ProgressRing, SelectField, TextArea, TextField,
} from '@/components/ui';
import { useConfirm, useToast } from '@/components/ui/feedback';
import { ACTIVES, HAIR_ACTIVITIES, SKIN_ORDER, categoriesFor, SLOT_LABEL } from '@/lib/constants';
import { addDays, describeDays, diffDays, formatDate, startOfWeek, WEEKDAY_LETTER } from '@/lib/dates';
import { completionKey, itemScheduledOn, routineTallies } from '@/lib/schedule';
import { cn } from '@/lib/cn';
import type { Area, CareProduct, ISODate, RoutineItem, Slot } from '@/types/db';

/* ------------------------------------------------------------ Data hook */
export interface RoutineEntry {
  item: RoutineItem;
  product: CareProduct | null;
  title: string;
  done: boolean;
}

/** Everything needed to render an area's routine for a given date. */
export function useCareDay(area: Area, date?: ISODate) {
  const today = useToday();
  const day = date ?? today;
  const { week_starts_on } = useProfile();
  const weekStart = startOfWeek(day, week_starts_on);
  const from = weekStart < day ? weekStart : day;
  const to = addDays(weekStart, 6) > day ? addDays(weekStart, 6) : day;
  const products = useProducts(area);
  const items = useRoutineItems(area);
  const completions = useRoutineCompletions(from, to);

  const data = useMemo(() => {
    if (!products.data || !items.data || !completions.data) return null;
    const byId = new Map(products.data.map((p) => [p.id, p]));
    const done = new Set(completions.data.map((c) => completionKey(c.routine_item_id, c.on_date)));
    const entries: RoutineEntry[] = items.data
      .filter((it) => itemScheduledOn(it, day))
      .map((it) => {
        const product = it.product_id ? byId.get(it.product_id) ?? null : null;
        return { item: it, product, title: product?.name ?? it.label ?? 'Routine step', done: done.has(completionKey(it.id, day)) };
      })
      .sort((a, b) => a.item.position - b.item.position || a.title.localeCompare(b.title));
    const week = routineTallies(items.data, completions.data, weekStart, addDays(weekStart, 6));
    return { entries, week, products: products.data, items: items.data };
  }, [products.data, items.data, completions.data, day, weekStart]);

  return {
    data,
    today,
    day,
    isLoading: products.isLoading || items.isLoading || completions.isLoading,
    error: products.error ?? items.error ?? completions.error,
    refetch: () => { products.refetch(); items.refetch(); completions.refetch(); },
  };
}

/* ------------------------------------------------------- Routine checklist */
export function RoutineList({ entries, date, today, manage, emptyText }: {
  entries: RoutineEntry[]; date: ISODate; today: ISODate; manage?: boolean; emptyText: string;
}) {
  const toggle = useToggleRoutine();
  const reorder = useReorderItems();
  const toast = useToast();
  const future = date > today;

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= entries.length) return;
    const list = entries.map((e) => e.item);
    [list[idx], list[j]] = [list[j], list[idx]];
    reorder.mutate(list.map((it, i) => ({ id: it.id, position: (i + 1) * 10 })), { onError: (e) => toast.error(e) });
  };

  if (entries.length === 0) return <p className="py-6 text-center text-sm text-ink-500">{emptyText}</p>;

  return (
    <ul className="-mx-2">
      {entries.map((e, i) => (
        <li key={e.item.id}>
          <CheckRow
            checked={e.done}
            disabled={future}
            onToggle={() => toggle.mutate({ itemId: e.item.id, date, done: !e.done }, { onError: (err) => toast.error(err) })}
            title={e.title}
            subtitle={[
              e.product?.brand,
              e.product && categoriesFor(e.product.area)[e.product.category],
              !e.product && e.item.activity && e.item.activity !== 'other' ? HAIR_ACTIVITIES[e.item.activity] : null,
            ].filter(Boolean).join(' · ') || undefined}
            trailing={manage && entries.length > 1 ? (
              <div className="flex">
                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Move ${e.title} up`} disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Move ${e.title} down`} disabled={i === entries.length - 1 || reorder.isPending} onClick={() => move(i, 1)}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
            ) : undefined}
          />
        </li>
      ))}
    </ul>
  );
}

export function SlotProgress({ entries }: { entries: RoutineEntry[] }) {
  const total = entries.length;
  const done = entries.filter((e) => e.done).length;
  const pct = total ? Math.round((done / total) * 100) : null;
  return (
    <ProgressRing value={pct} size={48} stroke={5}>
      <span className="text-xs font-medium text-ink-700">{total ? `${done}/${total}` : '—'}</span>
    </ProgressRing>
  );
}

/* ----------------------------------------------------------- Week strip */
export function WeekStrip({ week, today }: { week: { date: ISODate; scheduled: number; done: number }[]; today: ISODate }) {
  return (
    <div className="grid grid-cols-7 gap-1.5" aria-label="This week">
      {week.map((t) => {
        const pct = t.scheduled ? t.done / t.scheduled : null;
        const isToday = t.date === today;
        const future = t.date > today;
        return (
          <div key={t.date} className="flex flex-col items-center gap-1.5">
            <span className={cn('text-[11px] font-medium', isToday ? 'text-sage-800' : 'text-ink-400')}>
              {WEEKDAY_LETTER[new Date(t.date + 'T12:00:00Z').getUTCDay()]}
            </span>
            <div
              title={`${formatDate(t.date)}: ${t.scheduled ? `${t.done} of ${t.scheduled}` : 'nothing scheduled'}`}
              className={cn(
                'h-9 w-full max-w-[44px] rounded-xl border transition',
                isToday && 'ring-2 ring-sage-400 ring-offset-1 ring-offset-cream-50',
                pct === null ? 'border-dashed border-sage-200 bg-transparent'
                  : future ? 'border-sage-200 bg-white'
                  : pct >= 1 ? 'border-sage-600 bg-sage-600'
                  : pct > 0 ? 'border-sage-300 bg-sage-200'
                  : 'border-sage-200 bg-white',
              )}
            >
              <span className="sr-only">{formatDate(t.date)}: {t.scheduled ? `${t.done} of ${t.scheduled} done` : 'nothing scheduled'}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------- Product form */
interface FormState {
  name: string; brand: string; category: string; actives: string[]; usage_instructions: string; notes: string;
  started_on: string; replace_on: string;
  morning: boolean; morningDays: number[]; evening: boolean; eveningDays: number[]; anytime: boolean; anytimeDays: number[];
}

export function ProductFormModal({ open, onClose, area, product, items }: {
  open: boolean; onClose: () => void; area: Area; product?: CareProduct | null; items: RoutineItem[];
}) {
  const today = useToday();
  const { week_starts_on } = useProfile();
  const save = useSaveProduct();
  const toast = useToast();

  const initial = useMemo<FormState>(() => {
    const current = (slot: Slot) => {
      const mine = items.filter((i) => i.product_id === product?.id && i.slot === slot);
      const live = mine.find((i) => i.ends_on === null || i.ends_on >= today);
      return live ?? null;
    };
    const m = current('morning'), e = current('evening'), a = current('anytime');
    return {
      name: product?.name ?? '', brand: product?.brand ?? '', category: product?.category ?? (area === 'skin' ? 'cleanser' : 'shampoo'),
      actives: product?.actives ?? [], usage_instructions: product?.usage_instructions ?? '', notes: product?.notes ?? '',
      started_on: product?.started_on ?? '', replace_on: product?.replace_on ?? '',
      morning: !!m, morningDays: m?.days ?? [0, 1, 2, 3, 4, 5, 6],
      evening: !!e, eveningDays: e?.days ?? [0, 1, 2, 3, 4, 5, 6],
      anytime: !!a, anytimeDays: a?.days ?? [0, 3],
    };
  }, [product, items, area, today]);

  const [f, setF] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lastKey, setLastKey] = useState<string>('');
  const key = `${open}-${product?.id ?? 'new'}`;
  if (key !== lastKey) {
    setLastKey(key);
    setF(initial);
    setErrors({});
  }

  const cats = categoriesFor(area);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!f.name.trim()) errs.name = 'Give the product a name.';
    if (f.name.length > 120) errs.name = 'Keep the name under 120 characters.';
    if (f.started_on && f.replace_on && f.replace_on < f.started_on) errs.replace_on = 'Replacement date must be after the start date.';
    if (f.morning && !f.morningDays.length) errs.morning = 'Pick at least one day.';
    if (f.evening && !f.eveningDays.length) errs.evening = 'Pick at least one day.';
    if (f.anytime && !f.anytimeDays.length) errs.anytime = 'Pick at least one day.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const position = area === 'skin' ? SKIN_ORDER[f.category] ?? 80 : 50;
    const schedule: SlotSchedule[] = area === 'skin'
      ? [
          ...(f.morning ? [{ slot: 'morning' as const, days: f.morningDays, position }] : []),
          ...(f.evening ? [{ slot: 'evening' as const, days: f.eveningDays, position }] : []),
        ]
      : f.anytime ? [{ slot: 'anytime' as const, days: f.anytimeDays, position }] : [];
    try {
      await save.mutateAsync({
        id: product?.id,
        today,
        existingItems: items,
        schedule,
        input: {
          area, category: f.category, name: f.name.trim(), brand: f.brand.trim() || null,
          actives: area === 'skin' ? f.actives : [], usage_instructions: f.usage_instructions.trim() || null,
          notes: f.notes.trim() || null, started_on: f.started_on || null, replace_on: f.replace_on || null,
        },
      });
      toast.success(product ? 'Product updated' : 'Product added');
      onClose();
    } catch (err) {
      toast.error(err);
    }
  }

  const paused = product && product.status !== 'active';

  return (
    <Modal open={open} onClose={onClose} title={product ? 'Edit product' : area === 'skin' ? 'Add skincare product' : 'Add hair-care product'} size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="product-form" loading={save.isPending}>Save</Button></>}>
      <form id="product-form" onSubmit={submit} className="space-y-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Product name" value={f.name} onChange={(e) => set('name', e.target.value)} error={errors.name} maxLength={120} required />
          <TextField label="Brand" hint="Optional" value={f.brand} onChange={(e) => set('brand', e.target.value)} maxLength={120} />
          <SelectField label="Type" value={f.category} onChange={(e) => set('category', e.target.value)}
            options={Object.entries(cats).map(([value, label]) => ({ value, label }))} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Started" type="date" value={f.started_on} onChange={(e) => set('started_on', e.target.value)} />
            <TextField label="Replace by" type="date" value={f.replace_on} onChange={(e) => set('replace_on', e.target.value)} error={errors.replace_on} />
          </div>
        </div>

        {area === 'skin' && (
          <fieldset>
            <legend className="label">Key actives <span className="font-normal text-ink-500">(optional — used for gentle combination tips)</span></legend>
            <div className="flex flex-wrap gap-2">
              {Object.entries(ACTIVES).map(([k, label]) => {
                const on = f.actives.includes(k);
                return (
                  <button key={k} type="button" aria-pressed={on}
                    onClick={() => set('actives', on ? f.actives.filter((a) => a !== k) : [...f.actives, k])}
                    className={cn('rounded-full border px-3 py-1.5 text-sm transition',
                      on ? 'border-sage-600 bg-sage-600 text-white' : 'border-sage-200 bg-white text-ink-700 hover:border-sage-400')}>
                    {label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        <div className="rounded-2xl border border-sage-100 bg-white/60 p-4 space-y-4">
          <div className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-sage-700" /><p className="font-medium">Schedule</p></div>
          {paused && <p className="text-sm text-ink-500">This product is {product!.status}. Resume it to change its schedule.</p>}
          {!paused && area === 'skin' && (
            <>
              <SlotEditor label="Morning routine" on={f.morning} setOn={(v) => set('morning', v)} days={f.morningDays}
                setDays={(d) => set('morningDays', d)} weekStartsOn={week_starts_on} error={errors.morning} />
              <SlotEditor label="Evening routine" on={f.evening} setOn={(v) => set('evening', v)} days={f.eveningDays}
                setDays={(d) => set('eveningDays', d)} weekStartsOn={week_starts_on} error={errors.evening} />
            </>
          )}
          {!paused && area === 'hair' && (
            <SlotEditor label="Use on a schedule" on={f.anytime} setOn={(v) => set('anytime', v)} days={f.anytimeDays}
              setDays={(d) => set('anytimeDays', d)} weekStartsOn={week_starts_on} error={errors.anytime} />
          )}
          {!paused && <p className="text-xs text-ink-500">Leave every slot off to keep the product in your list without scheduling it. Schedule changes apply from today; your past records stay as they were.</p>}
        </div>

        <TextArea label="How you use it" hint="Optional — e.g. two pumps on damp skin" value={f.usage_instructions}
          onChange={(e) => set('usage_instructions', e.target.value)} maxLength={2000} />
        <TextArea label="Notes & observations" hint="Optional — how your skin or hair is responding" value={f.notes}
          onChange={(e) => set('notes', e.target.value)} maxLength={2000} />
      </form>
    </Modal>
  );
}

function SlotEditor({ label, on, setOn, days, setDays, weekStartsOn, error }: {
  label: string; on: boolean; setOn: (v: boolean) => void; days: number[]; setDays: (d: number[]) => void; weekStartsOn: number; error?: string;
}) {
  return (
    <div>
      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="h-5 w-5 rounded accent-sage-700" />
        <span className="text-[15px]">{label}</span>
      </label>
      {on && <div className="mt-3 pl-8"><DayPicker label="On" value={days} onChange={setDays} weekStartsOn={weekStartsOn} error={error} /></div>}
    </div>
  );
}

/* ----------------------------------------------------------- Product list */
export function ProductList({ area, onEdit }: { area: Area; onEdit: (p: CareProduct) => void }) {
  const products = useProducts(area);
  const items = useRoutineItems(area);
  const today = useToday();
  const { week_starts_on } = useProfile();
  const setStatus = useSetProductStatus();
  const del = useDeleteProduct();
  const confirm = useConfirm();
  const toast = useToast();
  const [showArchived, setShowArchived] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);

  if (!products.data || !items.data) return null;
  const list = products.data.filter((p) => (showArchived ? p.status === 'archived' : p.status !== 'archived'));
  const archivedCount = products.data.filter((p) => p.status === 'archived').length;
  const cats = categoriesFor(area);

  const schedOf = (p: CareProduct) =>
    items.data!.filter((i) => i.product_id === p.id && (i.ends_on === null || i.ends_on >= today))
      .map((i) => `${SLOT_LABEL[i.slot]} · ${describeDays(i.days, week_starts_on)}`);

  const changeStatus = (p: CareProduct, status: CareProduct['status'], msg: string) =>
    setStatus.mutate({ product: p, status, items: items.data!, today }, { onSuccess: () => toast.success(msg), onError: (e) => toast.error(e) });

  return (
    <div>
      <ul className="divide-y divide-sage-100">
        {list.map((p) => {
          const sched = schedOf(p);
          const replaceSoon = p.replace_on && diffDays(p.replace_on, today) <= 14;
          return (
            <li key={p.id} className="flex items-start gap-3 py-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{p.name}</p>
                  <Badge tone="cream">{cats[p.category] ?? p.category}</Badge>
                  {p.status === 'paused' && <Badge tone="clay">Paused</Badge>}
                  {replaceSoon && p.status === 'active' && (
                    <Badge tone="clay">{p.replace_on! < today ? 'Past replace date' : `Replace by ${formatDate(p.replace_on!)}`}</Badge>
                  )}
                </div>
                {p.brand && <p className="text-sm text-ink-500">{p.brand}</p>}
                <p className="mt-1 text-xs text-ink-500">{p.status !== 'active' ? 'Not scheduled' : sched.length ? sched.join('  ·  ') : 'In your list, not scheduled'}</p>
              </div>
              <div className="relative">
                <Button size="icon" variant="ghost" aria-label={`Actions for ${p.name}`} aria-expanded={menu === p.id} onClick={() => setMenu(menu === p.id ? null : p.id)}>
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
                {menu === p.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenu(null)} aria-hidden />
                    <div role="menu" className="absolute right-0 z-20 mt-1 w-48 rounded-2xl border border-sage-100 bg-white p-1.5 shadow-lift"
                      onKeyDown={(e) => e.key === 'Escape' && setMenu(null)}>
                      <MenuItem icon={<Pencil className="h-4 w-4" />} onClick={() => { setMenu(null); onEdit(p); }}>Edit</MenuItem>
                      {p.status === 'active' && <MenuItem icon={<Pause className="h-4 w-4" />} onClick={() => { setMenu(null); changeStatus(p, 'paused', 'Paused — history kept'); }}>Pause</MenuItem>}
                      {p.status === 'paused' && <MenuItem icon={<Play className="h-4 w-4" />} onClick={() => { setMenu(null); changeStatus(p, 'active', 'Resumed from today'); }}>Resume</MenuItem>}
                      {p.status !== 'archived'
                        ? <MenuItem icon={<Archive className="h-4 w-4" />} onClick={() => { setMenu(null); changeStatus(p, 'archived', 'Archived — history kept'); }}>Archive</MenuItem>
                        : <MenuItem icon={<RotateCcw className="h-4 w-4" />} onClick={() => { setMenu(null); changeStatus(p, 'active', 'Restored'); }}>Restore</MenuItem>}
                      <MenuItem danger icon={<Trash2 className="h-4 w-4" />} onClick={async () => {
                        setMenu(null);
                        const ok = await confirm({
                          title: `Delete ${p.name}?`,
                          body: 'This permanently removes the product, its schedule and every completion recorded for it. Archive it instead if you want to keep your history.',
                        });
                        if (ok) del.mutate(p.id, { onSuccess: () => toast.success('Product deleted'), onError: (e) => toast.error(e) });
                      }}>Delete</MenuItem>
                    </div>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {list.length === 0 && (
        <p className="py-6 text-center text-sm text-ink-500">{showArchived ? 'No archived products.' : 'No products yet.'}</p>
      )}
      {(archivedCount > 0 || showArchived) && (
        <button className="mt-3 text-sm text-sage-700 hover:underline" onClick={() => setShowArchived((s) => !s)}>
          {showArchived ? 'Back to current products' : `Show archived (${archivedCount})`}
        </button>
      )}
    </div>
  );
}

function MenuItem({ children, icon, onClick, danger }: { children: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button role="menuitem" type="button" onClick={onClick}
      className={cn('flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-left', danger ? 'text-clay-700 hover:bg-clay-100/50' : 'hover:bg-sage-50')}>
      {icon}{children}
    </button>
  );
}

/** Completion % for the week so far (future days excluded), or null if nothing was scheduled. */
export function weekPercent(week: { date: ISODate; scheduled: number; done: number }[], today: ISODate) {
  const rows = week.filter((t) => t.date <= today);
  const s = rows.reduce((a, t) => a + t.scheduled, 0);
  return s ? Math.round((rows.reduce((a, t) => a + t.done, 0) / s) * 100) : null;
}
