import type {
  SimulationDeviceTypeAlert,
  SimulationLineChartPoint,
  SimulationLocationData,
  SimulationTrackRun,
} from '@/controllers/API/simulationTrackApi';
import type { SimulationFilter } from './types';

export type SimulationDeviceTypeSeverityRow = SimulationDeviceTypeAlert & {
  device_type: string;
};

export const SEVERITY_COLORS = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#16a34a',
  open: '#059669',
  closed: '#64748b',
} as const;

const LINE_CHART_COLORS = [
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#ea580c',
  '#059669',
  '#0891b2',
];

export function formatSimulationDateTime(value: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function formatSimulationDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

/** Split multi-word device type labels onto two lines (e.g. "Gantry" / "override"). */
export function formatDeviceTypeTwoLineLabel(deviceType: string): { line1: string; line2: string | null } {
  const parts = deviceType.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { line1: deviceType.trim() || '—', line2: null };
  }
  return { line1: parts[0], line2: parts.slice(1).join(' ') };
}

export function formatDeviceTypeChartCategory(deviceType: string): string {
  const { line1, line2 } = formatDeviceTypeTwoLineLabel(deviceType);
  return line2 ? `${line1}\n${line2}` : line1;
}

export function formatSimulationNumber(value: number, fractionDigits = 0): string {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  });
}

export function aggregateSeverityTotals(locations: SimulationLocationData[]) {
  return locations.reduce(
    (acc, location) => {
      acc.critical += location.critical_count;
      acc.high += location.high_count;
      acc.medium += location.medium_count;
      acc.low += location.low_count;
      acc.open += location.open_count;
      acc.closed += location.closed_count;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0, open: 0, closed: 0 },
  );
}

/** Aggregate device-type severity counts across all locations in a run. */
export function aggregateDeviceTypesBySeverity(
  locations: SimulationLocationData[],
): SimulationDeviceTypeSeverityRow[] {
  const bucket = new Map<string, SimulationDeviceTypeSeverityRow>();

  for (const location of locations) {
    for (const deviceType of location.device_types) {
      const key = deviceType.device_type;
      const existing = bucket.get(key);
      if (!existing) {
        bucket.set(key, {
          ...deviceType,
          interlocks: [],
          distinct_interlocks_count: deviceType.distinct_interlocks_count,
        });
        continue;
      }
      existing.total_alerts += deviceType.total_alerts;
      existing.critical_count += deviceType.critical_count;
      existing.high_count += deviceType.high_count;
      existing.medium_count += deviceType.medium_count;
      existing.low_count += deviceType.low_count;
      existing.open_count += deviceType.open_count;
      existing.closed_count += deviceType.closed_count;
      existing.distinct_interlocks_count += deviceType.distinct_interlocks_count;
    }
  }

  return Array.from(bucket.values()).sort((a, b) => b.total_alerts - a.total_alerts);
}

export function buildSimulationFilterApiBody(
  filters: SimulationFilter,
  extras: Record<string, unknown> = {},
): Record<string, unknown> {
  const body: Record<string, unknown> = { ...extras };
  if (filters.dateRange?.from) {
    body.start_date = filters.dateRange.from.toISOString();
  }
  if (filters.dateRange?.to) {
    body.end_date = filters.dateRange.to.toISOString();
  }
  if (filters.timeRange && filters.timeRange !== 'all') {
    body.time_range = filters.timeRange;
  }
  return body;
}

export function buildLocationBarData(locations: SimulationLocationData[]) {
  return [...locations]
    .sort((a, b) => b.total_alerts - a.total_alerts)
    .slice(0, 10)
    .map((location) => ({
      name: location.location_name,
      alerts: location.total_alerts,
    }));
}

export function buildSeverityChartData(locations: SimulationLocationData[]) {
  const totals = aggregateSeverityTotals(locations);
  return [
    { name: 'Critical', value: totals.critical, fill: SEVERITY_COLORS.critical },
    { name: 'High', value: totals.high, fill: SEVERITY_COLORS.high },
    { name: 'Medium', value: totals.medium, fill: SEVERITY_COLORS.medium },
    { name: 'Low', value: totals.low, fill: SEVERITY_COLORS.low },
  ].filter((item) => item.value > 0);
}

export function buildOpenClosedChartData(locations: SimulationLocationData[]) {
  const totals = aggregateSeverityTotals(locations);
  return [
    { name: 'Open', value: totals.open, fill: SEVERITY_COLORS.open },
    { name: 'Closed', value: totals.closed, fill: SEVERITY_COLORS.closed },
  ].filter((item) => item.value > 0);
}

export function aggregateLineChartSeries(
  lineChart: Record<string, SimulationLineChartPoint[]>,
): SimulationLineChartPoint[] {
  const bucket = new Map<string, number>();
  for (const points of Object.values(lineChart)) {
    for (const point of points) {
      bucket.set(point.time, (bucket.get(point.time) ?? 0) + point.count);
    }
  }
  return Array.from(bucket.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, count]) => ({ time, count }));
}

export function formatLineChartTick(time: string): string {
  if (!time) return '';
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) return time;
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function buildTopLocationLineSeries(
  run: SimulationTrackRun,
  limit = 5,
): Array<{ key: string; label: string; color: string; data: SimulationLineChartPoint[] }> {
  const topLocations = [...run.location_data]
    .sort((a, b) => b.total_alerts - a.total_alerts)
    .slice(0, limit);

  return topLocations.map((location, index) => ({
    key: location.location_name,
    label: location.location_name,
    color: LINE_CHART_COLORS[index % LINE_CHART_COLORS.length],
    data: run.line_chart[location.location_name] ?? [],
  }));
}

export function mergeLineSeriesForChart(
  series: Array<{ key: string; label: string; color: string; data: SimulationLineChartPoint[] }>,
) {
  const timeSet = new Set<string>();
  for (const item of series) {
    for (const point of item.data) timeSet.add(point.time);
  }
  const times = Array.from(timeSet).sort((a, b) => a.localeCompare(b));
  return times.map((time) => {
    const row: Record<string, string | number> = { time };
    for (const item of series) {
      const match = item.data.find((point) => point.time === time);
      row[item.key] = match?.count ?? 0;
    }
    return row;
  });
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

/** Filter simulation runs by toolbar date range (listener start time). */
export function filterSimulationRunsByDate(
  runs: SimulationTrackRun[],
  filters: SimulationFilter,
): SimulationTrackRun[] {
  if (filters.timeRange === 'all' || (!filters.dateRange && !filters.timeRange)) {
    return runs;
  }

  const from = filters.dateRange?.from ? startOfDay(filters.dateRange.from) : null;
  const to = filters.dateRange?.to ? endOfDay(filters.dateRange.to) : null;

  return runs.filter((run) => {
    const started = new Date(run.run_info.listener_started_at);
    if (Number.isNaN(started.getTime())) return true;
    if (from && started < from) return false;
    if (to && started > to) return false;
    return true;
  });
}

export function pickLatestSimulationRun(runs: SimulationTrackRun[]): SimulationTrackRun | null {
  if (runs.length === 0) return null;
  return [...runs].sort(
    (a, b) =>
      new Date(b.run_info.listener_started_at).getTime() -
      new Date(a.run_info.listener_started_at).getTime(),
  )[0];
}
