import { useMemo, useState, type FormEvent } from 'react';
import { Droplets, Pencil, Plus, Scissors, Trash2 } from 'lucide-react';
import { useEndItem, useSaveActivity } from '@/api/care';
import { useProfile } from '@/api/profile';
import {
  Button, Card, CardHeader, DayPicker, EmptyState, ErrorBlock, Modal, PageHeader, Segmented, SelectField, Skeleton, TextField,
} from '@/components/ui';
import { useConfirm, useToast } from '@/components/ui/feedback';
import { HAIR_ACTIVITIES, HAIR_CATEGORIES } from '@/lib/constants';
import { formatLongDate, orderedWeekdays, WEEKDAY_SHORT } from '@/lib/dates';
import { cn } from '@/lib/cn';
import type { CareProduct, HairActivity, RoutineItem } from '@/types/db';
import { ProductFormModal, ProductList, RoutineList, SlotProgress, useCareDay, WeekStrip, weekPercent } from './shared';

export default function HairCarePage() {
  const [tab, setTab] = useState<'today' | 'schedule' | 'products'>('today');
  const [editingProduct, setEditingProduct] = useState<CareProduct | null | undefined>(undefined);
  const [editingActivity, setEditingActivity] = useState<RoutineItem | null | undefined>(undefined);
  const { data, isLoading, error, refetch, today } = useCareDay('hair');
  const { week_starts_on } = useProfile();
  const endItem = useEndItem();
  const confirm = useConfirm();
  const toast = useToast();

  const live = useMemo(() => (data?.items ?? []).filter((i) => i.ends_on === null || i.ends_on >= today), [data, today]);
  const productName = (id: string | null) => data?.products.find((p) => p.id === id)?.name;
  const weekPct = data ? weekPercent(data.week, today) : null;
  const empty = data && live.length === 0 && data.products.filter((p) => p.status !== 'archived').length === 0;

  return (
    <>
      <PageHeader
        eyebrow="Hair care"
        title="Your hair ritual"
        subtitle={formatLongDate(today)}
        action={
          <>
            <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setEditingActivity(null)}>Add activity</Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditingProduct(null)}>Add product</Button>
          </>
        }
      />
      <Segmented label="Hair-care view" value={tab} onChange={setTab} className="mb-6"
        options={[{ value: 'today', label: 'Today' }, { value: 'schedule', label: 'Weekly schedule' }, { value: 'products', label: 'Products' }]} />

      {error ? <ErrorBlock error={error} onRetry={refetch} />
        : isLoading || !data ? <Skeleton className="h-64" />
        : empty ? (
          <Card>
            <EmptyState icon={<Scissors className="h-6 w-6" />} title="Build a routine that suits your hair"
              action={<div className="flex flex-wrap justify-center gap-2">
                <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditingProduct(null)}>Add a product</Button>
                <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setEditingActivity(null)}>Add an activity</Button>
              </div>}>
              Track wash and conditioning days, scalp care and treatments — on whatever schedule works for you.
            </EmptyState>
          </Card>
        ) : tab === 'today' ? (
          <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
            <Card>
              <CardHeader icon={<Droplets className="h-[18px] w-[18px]" />} eyebrow="Today" title="Hair care" action={<SlotProgress entries={data.entries} />} />
              <RoutineList entries={data.entries} date={today} today={today} emptyText="Nothing planned for your hair today — enjoy the rest day." />
            </Card>
            <Card>
              <CardHeader eyebrow="This week" title={weekPct === null ? 'Nothing scheduled' : `${weekPct}% done so far`} />
              <WeekStrip week={data.week} today={today} />
            </Card>
          </div>
        ) : tab === 'schedule' ? (
          <Card>
            <CardHeader title="Weekly schedule" eyebrow={`${live.length} scheduled ${live.length === 1 ? 'step' : 'steps'}`} />
            {live.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-500">Nothing scheduled yet. Add an activity or give a product some days.</p>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="text-ink-500">
                      <th scope="col" className="text-left font-medium px-2 py-2">Step</th>
                      {orderedWeekdays(week_starts_on).map((d) => <th key={d} scope="col" className="font-medium px-1 py-2 w-11">{WEEKDAY_SHORT[d]}</th>)}
                      <th className="w-20"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {live.map((it) => (
                      <tr key={it.id} className="border-t border-sage-100">
                        <th scope="row" className="text-left font-normal px-2 py-2.5">
                          <p className="font-medium">{it.label ?? productName(it.product_id) ?? 'Step'}</p>
                          <p className="text-xs text-ink-500">
                            {it.activity ? HAIR_ACTIVITIES[it.activity] : 'Product'}{it.label && it.product_id ? ` · ${productName(it.product_id)}` : ''}
                          </p>
                        </th>
                        {orderedWeekdays(week_starts_on).map((d) => (
                          <td key={d} className="px-1 py-2 text-center">
                            <span className={cn('inline-block h-6 w-6 rounded-full', it.days.includes(d) ? 'bg-sage-500' : 'bg-sage-100')}
                              aria-label={it.days.includes(d) ? 'Scheduled' : 'Not scheduled'} role="img" />
                          </td>
                        ))}
                        <td className="text-right whitespace-nowrap">
                          {it.product_id && !it.label ? (
                            <Button size="icon" variant="ghost" aria-label="Edit product schedule"
                              onClick={() => setEditingProduct(data.products.find((p) => p.id === it.product_id) ?? null)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          ) : (
                            <>
                              <Button size="icon" variant="ghost" aria-label="Edit activity" onClick={() => setEditingActivity(it)}><Pencil className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" aria-label="Remove activity" onClick={async () => {
                                if (await confirm({ title: 'Remove this activity?', body: 'It will stop appearing from today. Your past completions are kept.', confirmLabel: 'Remove' }))
                                  endItem.mutate({ item: it, today }, { onSuccess: () => toast.success('Activity removed'), onError: (e) => toast.error(e) });
                              }}><Trash2 className="h-4 w-4" /></Button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ) : (
          <Card>
            <CardHeader title="Products" />
            <ProductList area="hair" onEdit={(p) => setEditingProduct(p)} />
          </Card>
        )}

      {editingProduct !== undefined && data && (
        <ProductFormModal open area="hair" product={editingProduct} items={data.items} onClose={() => setEditingProduct(undefined)} />
      )}
      {editingActivity !== undefined && data && (
        <ActivityModal item={editingActivity} products={data.products.filter((p) => p.status === 'active')} onClose={() => setEditingActivity(undefined)} />
      )}
    </>
  );
}

function ActivityModal({ item, products, onClose }: { item: RoutineItem | null; products: CareProduct[]; onClose: () => void }) {
  const { week_starts_on } = useProfile();
  const today = useCareDay('hair').today;
  const save = useSaveActivity();
  const toast = useToast();
  const [label, setLabel] = useState(item?.label ?? '');
  const [activity, setActivity] = useState<HairActivity>(item?.activity ?? 'wash');
  const [productId, setProductId] = useState<string>(item?.product_id ?? '');
  const [days, setDays] = useState<number[]>(item?.days ?? [0, 3]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const finalLabel = label.trim() || HAIR_ACTIVITIES[activity];
    if (finalLabel.length > 120) errs.label = 'Keep it under 120 characters.';
    if (!days.length) errs.days = 'Pick at least one day.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await save.mutateAsync({ item: item ?? undefined, today, input: { label: finalLabel, activity, slot: 'anytime', days, product_id: productId || null } });
      toast.success(item ? 'Activity updated' : 'Activity added');
      onClose();
    } catch (err) {
      toast.error(err);
    }
  }

  return (
    <Modal open onClose={onClose} title={item ? 'Edit activity' : 'Add hair-care activity'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="activity-form" loading={save.isPending}>Save</Button></>}>
      <form id="activity-form" onSubmit={submit} className="space-y-4" noValidate>
        <SelectField label="Activity" value={activity} onChange={(e) => setActivity(e.target.value as HairActivity)}
          options={Object.entries(HAIR_ACTIVITIES).map(([value, l]) => ({ value, label: l }))} />
        <TextField label="Name" placeholder={HAIR_ACTIVITIES[activity]} hint="Optional — e.g. “Scalp massage, 5 minutes”" value={label}
          onChange={(e) => setLabel(e.target.value)} error={errors.label} maxLength={120} />
        <SelectField label="Product used" hint="Optional" value={productId} onChange={(e) => setProductId(e.target.value)}
          options={[{ value: '', label: 'No specific product' }, ...products.map((p) => ({ value: p.id, label: `${p.name} (${HAIR_CATEGORIES[p.category] ?? p.category})` }))]} />
        <DayPicker value={days} onChange={setDays} weekStartsOn={week_starts_on} error={errors.days} />
        {item && <p className="text-xs text-ink-500">Changes apply from today. Earlier records stay as they were.</p>}
        <p className="text-xs text-ink-500">Every head of hair is different — choose whatever rhythm works for yours.</p>
      </form>
    </Modal>
  );
}
