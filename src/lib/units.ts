// Weights are stored in kg and lengths in cm; convert only for display/input.
export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;

export type WeightUnit = 'kg' | 'lb';
export type LengthUnit = 'cm' | 'in';

const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;

export function kgTo(kg: number, unit: WeightUnit): number {
  return unit === 'kg' ? round(kg, 2) : round(kg / KG_PER_LB, 1);
}

export function toKg(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? round(value, 2) : round(value * KG_PER_LB, 2);
}

export function cmTo(cm: number, unit: LengthUnit): number {
  return unit === 'cm' ? round(cm, 1) : round(cm / CM_PER_IN, 1);
}

export function toCm(value: number, unit: LengthUnit): number {
  return unit === 'cm' ? round(value, 2) : round(value * CM_PER_IN, 2);
}

export function fmtWeight(kg: number | null | undefined, unit: WeightUnit): string {
  if (kg === null || kg === undefined) return '—';
  return `${kgTo(Number(kg), unit)} ${unit}`;
}

export function fmtNumber(n: number, dp = 1): string {
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: dp }).format(n);
}
