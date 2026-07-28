import type { AgeingSummaryRow } from '@/controllers/API/ReconcilationAPI';

const AMOUNT_KEYS: Array<keyof AgeingSummaryRow> = [
  'days_1_to_3_amount',
  'days_4_to_6_amount',
  'days_7_to_15_amount',
  'days_16_to_30_amount',
  'above_30_days_amount',
];

const COUNT_KEYS: Array<keyof AgeingSummaryRow> = [
  'days_1_to_3_count',
  'days_4_to_6_count',
  'days_7_to_15_count',
  'days_16_to_30_count',
  'days_above_30_count',
];

export function getBucketMaxValue(
  rows: AgeingSummaryRow[],
  view: 'amount' | 'count',
): number {
  const keys = view === 'amount' ? AMOUNT_KEYS : COUNT_KEYS;
  let max = 0;
  for (const row of rows) {
    for (const key of keys) {
      const num = Number(row[key]);
      if (Number.isFinite(num) && num > max) max = num;
    }
  }
  return max;
}

export function getAgingHeatCellClass(value: number, max: number): string {
  if (!max || value <= 0) return '';
  const ratio = value / max;
  if (ratio >= 0.75) return 'rounded-md bg-red-100/80 dark:bg-red-950/40';
  if (ratio >= 0.5) return 'rounded-md bg-orange-100/80 dark:bg-orange-950/40';
  if (ratio >= 0.25) return 'rounded-md bg-amber-100/70 dark:bg-amber-950/35';
  return 'rounded-md bg-blue-100/60 dark:bg-blue-950/30';
}
