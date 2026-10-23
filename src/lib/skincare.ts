// General, non-medical cautions about combining skincare actives. These are
// prompts to be careful, never a diagnosis or a prescription.
import type { CareProduct, RoutineItem, Slot } from '@/types/db';

export interface Caution {
  id: string;
  slot: Slot | 'both';
  title: string;
  detail: string;
  tone: 'info' | 'caution';
}

const PAIRS: { a: string; b: string; detail: string }[] = [
  {
    a: 'retinoid', b: 'aha',
    detail: 'Using a retinoid and an AHA exfoliant in the same routine can increase dryness or irritation for some people. Many people alternate them on different evenings.',
  },
  {
    a: 'retinoid', b: 'bha',
    detail: 'A retinoid and a BHA in the same routine can be drying for some skin types. Consider alternating nights and watching how your skin responds.',
  },
  {
    a: 'retinoid', b: 'benzoyl_peroxide',
    detail: 'Benzoyl peroxide can make some retinoids less effective and the combination may irritate. Some people use them at different times of day.',
  },
  {
    a: 'vitamin_c', b: 'aha',
    detail: 'Vitamin C and AHAs are both acidic; layering them may sting for sensitive skin.',
  },
  {
    a: 'vitamin_c', b: 'benzoyl_peroxide',
    detail: 'Benzoyl peroxide can oxidise vitamin C, so they are often used in separate routines.',
  },
  {
    a: 'aha', b: 'bha',
    detail: 'Two exfoliating acids in one routine can be a lot for some skin. Introduce them gradually.',
  },
];

const LABEL: Record<string, string> = {
  retinoid: 'a retinoid', aha: 'an AHA', bha: 'a BHA', vitamin_c: 'vitamin C', benzoyl_peroxide: 'benzoyl peroxide',
};

export function skincareCautions(products: CareProduct[], items: RoutineItem[]): Caution[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const out: Caution[] = [];

  const activesIn = (slot: Slot) => {
    const set = new Set<string>();
    for (const it of items) {
      if (it.slot !== slot || !it.product_id) continue;
      const p = byId.get(it.product_id);
      if (!p || p.status !== 'active') continue;
      p.actives.forEach((a) => set.add(a));
      if (p.category === 'retinoid') set.add('retinoid');
    }
    return set;
  };

  for (const slot of ['morning', 'evening'] as const) {
    const actives = activesIn(slot);
    for (const pair of PAIRS) {
      if (actives.has(pair.a) && actives.has(pair.b)) {
        out.push({
          id: `${slot}-${pair.a}-${pair.b}`,
          slot,
          tone: 'caution',
          title: `${slot === 'morning' ? 'Morning' : 'Evening'}: ${LABEL[pair.a]} with ${LABEL[pair.b]}`,
          detail: pair.detail,
        });
      }
    }
  }

  const morning = items.filter((i) => i.slot === 'morning' && i.product_id).map((i) => byId.get(i.product_id!));
  const hasSunscreen = morning.some((p) => p && p.status === 'active' && (p.category === 'sunscreen' || p.actives.includes('spf')));
  const usesPhotosensitising = [...activesIn('morning'), ...activesIn('evening')].some((a) =>
    ['retinoid', 'aha', 'bha'].includes(a),
  );
  if (!hasSunscreen && morning.length > 0) {
    out.push({
      id: 'sunscreen',
      slot: 'morning',
      tone: usesPhotosensitising ? 'caution' : 'info',
      title: 'No sunscreen in your morning routine',
      detail: usesPhotosensitising
        ? 'Retinoids and exfoliating acids can make skin more sensitive to the sun. A broad-spectrum sunscreen in the morning is widely recommended.'
        : 'Daily broad-spectrum sunscreen is one of the most widely recommended skincare steps.',
    });
  }
  return out;
}
