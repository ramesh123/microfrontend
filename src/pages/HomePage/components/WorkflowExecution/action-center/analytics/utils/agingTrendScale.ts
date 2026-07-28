import { formatNumber } from '@/utils/numberFormatters';

/** Rounds up to a readable axis max (e.g. 1.38B → 1.5B, 30M → 50M). */
export function niceScaleMax(maxValue: number): number {
  if (!Number.isFinite(maxValue) || maxValue <= 0) return 1;
  const exp = Math.floor(Math.log10(maxValue));
  const base = 10 ** exp;
  const fraction = maxValue / base;
  let niceFraction = 10;
  if (fraction <= 1) niceFraction = 1;
  else if (fraction <= 1.5) niceFraction = 1.5;
  else if (fraction <= 2) niceFraction = 2;
  else if (fraction <= 5) niceFraction = 5;
  return niceFraction * base;
}

export function formatTrendStatementDate(statementDate: string): string {
  if (!statementDate) return '—';
  try {
    const [year, month, day] = statementDate.split('-').map(Number);
    if (!year || !month || !day) return statementDate;
    return new Date(year, month - 1, day).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return statementDate;
  }
}

export function formatTrendAxisValue(value: number): string {
  return formatNumber(value, { format: 'short', minValue: 1000 });
}
