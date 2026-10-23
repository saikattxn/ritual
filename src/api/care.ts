import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { must, supabase } from '@/lib/supabase';
import { useUserId } from '@/auth/AuthProvider';
import { planEnd, planRevision } from '@/lib/schedule';
import type { Area, CareProduct, ISODate, ProductStatus, RoutineCompletion, RoutineItem, Slot } from '@/types/db';

/* ------------------------------------------------------------------ Queries */
export function useProducts(area: Area) {
  const uid = useUserId();
  return useQuery({
    queryKey: ['products', uid, area],
    queryFn: async () =>
      must(await supabase.from('care_products').select('*').eq('user_id', uid).eq('area', area)
        .order('created_at', { ascending: true })) as CareProduct[],
  });
}

/** Every routine item (including ended versions) so history stays accurate. */
export function useRoutineItems(area?: Area) {
  const uid = useUserId();
  return useQuery({
    queryKey: ['routineItems', uid, area ?? 'all'],
    queryFn: async () => {
      let q = supabase.from('routine_items').select('*').eq('user_id', uid);
      if (area) q = q.eq('area', area);
      return must(await q.order('position').order('created_at')) as RoutineItem[];
    },
  });
}

export function useRoutineCompletions(from: ISODate, to: ISODate) {
  const uid = useUserId();
  return useQuery({
    queryKey: ['routineCompletions', uid, from, to],
    queryFn: async () =>
      must(await supabase.from('routine_completions').select('id, routine_item_id, on_date, completed_at, user_id')
        .eq('user_id', uid).gte('on_date', from).lte('on_date', to)) as RoutineCompletion[],
  });
}

/* --------------------------------------------------------------- Completion */
function patchCompletionCaches(qc: QueryClient, itemId: string, date: ISODate, done: boolean) {
  qc.setQueriesData<RoutineCompletion[]>({ queryKey: ['routineCompletions'] }, (old) => {
    if (!old) return old;
    const without = old.filter((c) => !(c.routine_item_id === itemId && c.on_date === date));
    return done
      ? [...without, { id: `optimistic-${itemId}-${date}`, user_id: '', routine_item_id: itemId, on_date: date, completed_at: new Date().toISOString() }]
      : without;
  });
}

export function useToggleRoutine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, date, done }: { itemId: string; date: ISODate; done: boolean }) => {
      if (done) {
        const { error } = await supabase.from('routine_completions')
          .upsert({ routine_item_id: itemId, on_date: date }, { onConflict: 'routine_item_id,on_date', ignoreDuplicates: true });
        if (error) throw new Error(error.message);
      } else {
        must(await supabase.from('routine_completions').delete().eq('routine_item_id', itemId).eq('on_date', date));
      }
    },
    onMutate: async ({ itemId, date, done }) => {
      await qc.cancelQueries({ queryKey: ['routineCompletions'] });
      const snapshot = qc.getQueriesData<RoutineCompletion[]>({ queryKey: ['routineCompletions'] });
      patchCompletionCaches(qc, itemId, date, done);
      return { snapshot };
    },
    onError: (_e, _v, ctx) => ctx?.snapshot.forEach(([k, v]) => qc.setQueryData(k, v)),
    onSettled: () => qc.invalidateQueries({ queryKey: ['routineCompletions'] }),
  });
}

/* ---------------------------------------------------------- Schedule logic */
export interface SlotSchedule {
  slot: Slot;
  days: number[];
  position: number;
}

function sameDays(a: number[], b: number[]) {
  return a.length === b.length && [...a].sort().join() === [...b].sort().join();
}

async function endItem(item: RoutineItem, today: ISODate) {
  const plan = planEnd(item, today);
  if (plan.type === 'delete') must(await supabase.from('routine_items').delete().eq('id', plan.id));
  else must(await supabase.from('routine_items').update({ ends_on: plan.endOn }).eq('id', plan.id));
}

type ItemFields = Pick<RoutineItem, 'area' | 'product_id' | 'label' | 'activity' | 'slot' | 'days' | 'position'>;

/** Change an item's schedule while keeping its past intact. */
async function reviseItem(item: RoutineItem, next: ItemFields, today: ISODate) {
  const plan = planRevision(item, today);
  if (plan.type === 'update') {
    must(await supabase.from('routine_items').update(next).eq('id', item.id));
    return;
  }
  must(await supabase.from('routine_items').update({ ends_on: plan.endOn }).eq('id', plan.endId));
  const created = must(await supabase.from('routine_items').insert({ ...next, starts_on: plan.startOn }).select('id').single()) as { id: string };
  // Carry today's tick (if any) across to the new version.
  await supabase.from('routine_completions').update({ routine_item_id: created.id })
    .eq('routine_item_id', item.id).eq('on_date', today);
}

function currentItems(items: RoutineItem[], today: ISODate) {
  return items.filter((i) => i.ends_on === null || i.ends_on >= today);
}

async function syncProductSchedule(product: CareProduct, desired: SlotSchedule[], existing: RoutineItem[], today: ISODate) {
  const mine = currentItems(existing.filter((i) => i.product_id === product.id), today);
  const wanted = new Map(desired.filter((d) => d.days.length > 0).map((d) => [d.slot, d]));
  for (const item of mine) {
    const want = wanted.get(item.slot);
    if (!want) {
      await endItem(item, today);
      continue;
    }
    wanted.delete(item.slot);
    if (!sameDays(item.days, want.days)) {
      await reviseItem(item, { area: product.area, product_id: product.id, label: null, activity: item.activity, slot: want.slot, days: want.days, position: item.position }, today);
    }
  }
  const inserts = [...wanted.values()].map((w) => ({
    area: product.area, product_id: product.id, slot: w.slot, days: w.days, position: w.position, starts_on: today,
  }));
  if (inserts.length) must(await supabase.from('routine_items').insert(inserts));
}

function invalidateCare(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ['products'] });
  qc.invalidateQueries({ queryKey: ['routineItems'] });
  qc.invalidateQueries({ queryKey: ['routineCompletions'] });
}

/* -------------------------------------------------------------- Mutations */
export type ProductInput = Pick<CareProduct, 'area' | 'category' | 'name' | 'brand' | 'notes' | 'usage_instructions' | 'actives' | 'started_on' | 'replace_on'>;

export function useSaveProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input, schedule, existingItems, today }: {
      id?: string; input: ProductInput; schedule: SlotSchedule[]; existingItems: RoutineItem[]; today: ISODate;
    }) => {
      const product = (id
        ? must(await supabase.from('care_products').update(input).eq('id', id).select('*').single())
        : must(await supabase.from('care_products').insert(input).select('*').single())) as CareProduct;
      if (product.status === 'active') await syncProductSchedule(product, schedule, existingItems, today);
      return product;
    },
    onSettled: () => invalidateCare(qc),
  });
}

export function useSetProductStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ product, status, items, today }: { product: CareProduct; status: ProductStatus; items: RoutineItem[]; today: ISODate }) => {
      const mine = items.filter((i) => i.product_id === product.id);
      if (status === 'active' && product.status !== 'active') {
        // Restore the most recent schedule for each slot, starting today.
        const latest = new Map<Slot, RoutineItem>();
        for (const it of mine) {
          const cur = latest.get(it.slot);
          if (!cur || (it.ends_on ?? '9999') > (cur.ends_on ?? '9999')) latest.set(it.slot, it);
        }
        const restore = [...latest.values()].filter((i) => i.ends_on !== null && i.ends_on < today);
        if (restore.length)
          must(await supabase.from('routine_items').insert(restore.map((i) => ({
            area: i.area, product_id: i.product_id, slot: i.slot, days: i.days, position: i.position, starts_on: today,
          }))));
      } else if (status !== 'active') {
        for (const it of currentItems(mine, today)) await endItem(it, today);
      }
      must(await supabase.from('care_products').update({ status }).eq('id', product.id));
    },
    onSettled: () => invalidateCare(qc),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => must(await supabase.from('care_products').delete().eq('id', id)),
    onSettled: () => invalidateCare(qc),
  });
}

export type ActivityInput = { label: string; activity: RoutineItem['activity']; slot: Slot; days: number[]; product_id: string | null };

/** Hair-care activities (with or without a product) are routine items in their own right. */
export function useSaveActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ item, input, today }: { item?: RoutineItem; input: ActivityInput; today: ISODate }) => {
      const fields: ItemFields = {
        area: 'hair', product_id: input.product_id, label: input.label || null, activity: input.activity,
        slot: input.slot, days: input.days, position: item?.position ?? 0,
      };
      if (item) await reviseItem(item, fields, today);
      else must(await supabase.from('routine_items').insert({ ...fields, starts_on: today }));
    },
    onSettled: () => invalidateCare(qc),
  });
}

export function useEndItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ item, today }: { item: RoutineItem; today: ISODate }) => endItem(item, today),
    onSettled: () => invalidateCare(qc),
  });
}

export function useReorderItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: { id: string; position: number }[]) => {
      for (const u of updates) must(await supabase.from('routine_items').update({ position: u.position }).eq('id', u.id));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['routineItems'] }),
  });
}
