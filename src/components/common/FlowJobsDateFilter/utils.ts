import { addDays, format } from 'date-fns';
import { JobsFilter, TimeRange } from '@/types/jobs';

export type FlowDateFilterValue =
  | { mode: 'all' }
  | { mode: 'preset'; timeRange: TimeRange }
  | { mode: 'custom'; from: Date; to: Date };

export function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseYmd(s: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const [ys, ms, ds] = s.split('-');
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return undefined;
  return dt;
}

export function getPresetDateRange(value: TimeRange): { from: Date; to: Date } | undefined {
  const to = new Date();
  switch (value) {
    case 'all':
      return undefined;
    case 'today':
      return { from: new Date(), to };
    case 'yesterday': {
      const y = addDays(new Date(), -1);
      return { from: y, to: y };
    }
    case 'last_7_days':
      return { from: addDays(new Date(), -7), to };
    case 'last_15_days':
      return { from: addDays(new Date(), -15), to };
    case 'last_30_days':
      return { from: addDays(new Date(), -30), to };
    case 'last_90_days':
      return { from: addDays(new Date(), -90), to };
    default:
      return { from: addDays(new Date(), -7), to };
  }
}

/** Resolve filter to API `created_at BETWEEN` date strings (local YMD). */
export function resolveFlowDateFilterToYmd(
  filter: FlowDateFilterValue,
): { fromDate?: string; toDate?: string } {
  if (filter.mode === 'all') {
    return {};
  }
  if (filter.mode === 'custom') {
    return { fromDate: formatYmd(filter.from), toDate: formatYmd(filter.to) };
  }
  const range = getPresetDateRange(filter.timeRange);
  if (!range) return {};
  return { fromDate: formatYmd(range.from), toDate: formatYmd(range.to) };
}

function formatDisplayDate(d: Date): string {
  return format(d, 'MMM d, yyyy');
}

/** Human-readable date range for Jobs page heading when a filter is active. */
export function formatJobsFilterDateHeading(filters: JobsFilter): string | null {
  if (filters.dateRange?.from) {
    const from = filters.dateRange.from;
    const to = filters.dateRange.to ?? filters.dateRange.from;
    const fromStr = formatDisplayDate(from);
    const toStr = formatDisplayDate(to);
    return fromStr === toStr ? fromStr : `${fromStr} – ${toStr}`;
  }

  if (filters.timeRange && filters.timeRange !== 'all') {
    const preset = PRESET_FILTERS.find((p) => p.value === filters.timeRange);
    const range = getPresetDateRange(filters.timeRange);
    if (range) {
      const fromStr = formatDisplayDate(range.from);
      const toStr = formatDisplayDate(range.to);
      const rangeLabel = fromStr === toStr ? fromStr : `${fromStr} – ${toStr}`;
      return preset ? `${preset.tooltip} (${rangeLabel})` : rangeLabel;
    }
    return preset?.tooltip ?? null;
  }

  return null;
}

export const PRESET_FILTERS: { label: string; value: TimeRange; tooltip: string }[] = [
  { label: 'ALL', value: 'all', tooltip: 'All dates' },
  { label: 'TDY', value: 'today', tooltip: 'Today' },
  { label: 'YDY', value: 'yesterday', tooltip: 'Yesterday' },
  { label: '1W', value: 'last_7_days', tooltip: 'Last 1 week' },
  { label: '15D', value: 'last_15_days', tooltip: 'Last 15 days' },
  { label: '1M', value: 'last_30_days', tooltip: 'Last 1 month' },
  { label: '3M', value: 'last_90_days', tooltip: 'Last 3 months' },
];

function formatCompactDateRange(from: Date, to: Date): string {
  const sameDay =
    from.getFullYear() === to.getFullYear() &&
    from.getMonth() === to.getMonth() &&
    from.getDate() === to.getDate();
  if (sameDay) return formatDisplayDate(from);
  const sameYear = from.getFullYear() === to.getFullYear();
  const fromStr = format(from, sameYear ? 'MMM d' : 'MMM d, yyyy');
  const toStr = format(to, 'MMM d, yyyy');
  return `${fromStr} – ${toStr}`;
}

/** Compact label for the date-range badge shown before preset buttons. */
export function formatFlowDateFilterBadgeLabel(value: FlowDateFilterValue): string | null {
  if (value.mode === 'all') return null;
  if (value.mode === 'custom') {
    return formatCompactDateRange(value.from, value.to);
  }
  const preset = PRESET_FILTERS.find((p) => p.value === value.timeRange);
  const range = getPresetDateRange(value.timeRange);
  if (!range) return preset?.label ?? null;
  const rangeLabel = formatCompactDateRange(range.from, range.to);
  return preset ? `${preset.label} · ${rangeLabel}` : rangeLabel;
}
