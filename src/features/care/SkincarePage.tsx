import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Info, Moon, Plus, ShieldAlert, Sparkles, Sun } from 'lucide-react';
import { Button, Card, CardHeader, EmptyState, ErrorBlock, Notice, PageHeader, Segmented, Skeleton } from '@/components/ui';
import { formatLongDate } from '@/lib/dates';
import { skincareCautions } from '@/lib/skincare';
import type { CareProduct } from '@/types/db';
import { ProductFormModal, ProductList, RoutineList, SlotProgress, useCareDay, WeekStrip, weekPercent } from './shared';

export default function SkincarePage() {
  const [tab, setTab] = useState<'routine' | 'products'>('routine');
  const [editing, setEditing] = useState<CareProduct | null | undefined>(undefined);
  const [manage, setManage] = useState(false);
  const { data, isLoading, error, refetch, today } = useCareDay('skin');
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    if (params.get('new') === '1') {
      setEditing(null);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const cautions = useMemo(() => {
    if (!data) return [];
    const live = data.items.filter((i) => i.ends_on === null || i.ends_on >= today);
    return skincareCautions(data.products, live);
  }, [data, today]);

  const morning = data?.entries.filter((e) => e.item.slot === 'morning') ?? [];
  const evening = data?.entries.filter((e) => e.item.slot === 'evening') ?? [];
  const hasProducts = (data?.products.filter((p) => p.status !== 'archived').length ?? 0) > 0;
  const weekPct = data ? weekPercent(data.week, today) : null;

  return (
    <>
      <PageHeader
        eyebrow="Skincare"
        title="Your skin ritual"
        subtitle={formatLongDate(today)}
        action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing(null)}>Add product</Button>}
      />

      <Segmented label="Skincare view" value={tab} onChange={setTab} className="mb-6"
        options={[{ value: 'routine', label: 'Today’s routine' }, { value: 'products', label: 'Products' }]} />

      {error ? <ErrorBlock error={error} onRetry={refetch} />
        : isLoading || !data ? (
          <div className="grid gap-5 md:grid-cols-2"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
        ) : !hasProducts ? (
          <Card>
            <EmptyState icon={<Sparkles className="h-6 w-6" />} title="Start with what’s already on your shelf"
              action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing(null)}>Add your first product</Button>}>
              Add a cleanser, moisturiser or sunscreen, choose morning or evening and the days you use it. Ritual builds your
              daily checklist from there.
            </EmptyState>
          </Card>
        ) : tab === 'routine' ? (
          <div className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <Card>
                <CardHeader icon={<Sun className="h-[18px] w-[18px]" />} eyebrow="AM" title="Morning" action={<SlotProgress entries={morning} />} />
                <RoutineList entries={morning} date={today} today={today} manage={manage} emptyText="Nothing scheduled this morning." />
              </Card>
              <Card>
                <CardHeader icon={<Moon className="h-[18px] w-[18px]" />} eyebrow="PM" title="Evening" action={<SlotProgress entries={evening} />} />
                <RoutineList entries={evening} date={today} today={today} manage={manage} emptyText="Nothing scheduled this evening." />
              </Card>
            </div>
            <div className="flex justify-end">
              <Button size="sm" variant="ghost" onClick={() => setManage((m) => !m)}>{manage ? 'Done reordering' : 'Reorder steps'}</Button>
            </div>

            <Card>
              <CardHeader eyebrow="This week" title={weekPct === null ? 'No steps scheduled yet' : `${weekPct}% of scheduled steps so far`} />
              <WeekStrip week={data.week} today={today} />
            </Card>

            {cautions.length > 0 && (
              <div className="space-y-3">
                {cautions.map((c) => (
                  <Notice key={c.id} tone={c.tone} title={c.title}
                    icon={c.tone === 'caution' ? <ShieldAlert className="h-5 w-5 text-clay-600" /> : <Info className="h-5 w-5 text-sage-600" />}>
                    {c.detail}
                  </Notice>
                ))}
              </div>
            )}
            <SkinSafetyNote />
          </div>
        ) : (
          <div className="space-y-5">
            <Card>
              <CardHeader title="Products" eyebrow={`${data.products.filter((p) => p.status !== 'archived').length} in use`} />
              <ProductList area="skin" onEdit={(p) => setEditing(p)} />
            </Card>
            <SkinSafetyNote />
          </div>
        )}

      {editing !== undefined && data && (
        <ProductFormModal open area="skin" product={editing} items={data.items} onClose={() => setEditing(undefined)} />
      )}
    </>
  );
}

function SkinSafetyNote() {
  return (
    <p className="text-xs text-ink-500 leading-relaxed max-w-3xl">
      Ritual offers general information, not medical advice, and isn’t a substitute for a dermatologist or pharmacist.
      Introduce active ingredients such as retinoids and exfoliating acids gradually, patch-test new products, and stop
      using anything that causes ongoing irritation.
    </p>
  );
}
