import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isThemeDarkAppearance, useTheme } from '@/context/theme';
import type { SimulationTrackRun } from '@/controllers/API/simulationTrackApi';
import { formatSimulationNumber } from '../simulationTrackDashboardUtils';
import { cn } from '@/lib/utils';

import {
  createSimulationTrackAm5Chart,
  disposeAm5Root,
  type SimulationAm5Row,
} from './simulationTrackAm5Chart';

type SimulationChartsProps = {
  runs: SimulationTrackRun[];
};

type MetricConfig = {
  key: keyof Pick<SimulationAm5Row, 'alerts_created' | 'duration_ms' | 'total_telemetry_received'>;
  label: string;
  stroke: string;
  badgeClass: string;
  fractionDigits: number;
};

const CHART_HEIGHT = 500;
const CHART_LEGEND_HEIGHT = 28;

const METRICS: MetricConfig[] = [
  {
    key: 'total_telemetry_received',
    label: 'Telemetry received',
    stroke: '#0031a3',
    badgeClass: 'bg-[#0031a3]/10 text-[#0031a3] dark:bg-[#0031a3]/20 dark:text-[#6b8fe8]',
    fractionDigits: 0,
  },
  {
    key: 'duration_ms',
    label: 'Duration (ms)',
    stroke: '#16A34A',
    badgeClass: 'bg-[#16A34A]/15 text-[#166534] dark:bg-[#16A34A]/20 dark:text-[#4ADE80]',
    fractionDigits: 0,
  },
  {
    key: 'alerts_created',
    label: 'Alerts created',
    stroke: '#ff633c',
    badgeClass: 'bg-[#ff633c]/10 text-[#c03010] dark:bg-[#ff633c]/20 dark:text-[#ff9070]',
    fractionDigits: 0,
  },
];

function formatXAxisDateTime(value: string): string {
  if (!value) return '';
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

function buildRunInfoChartData(runs: SimulationTrackRun[]): SimulationAm5Row[] {
  const sorted = [...runs].sort(
    (a, b) =>
      new Date(a.run_info.listener_started_at).getTime() -
      new Date(b.run_info.listener_started_at).getTime(),
  );

  return sorted.map((run) => {
    const info = run.run_info;
    return {
      category: formatXAxisDateTime(info.listener_started_at),
      alerts_created: info.alerts_created,
      duration_ms: info.duration_ms,
      total_telemetry_received: info.total_telemetry_received,
    };
  });
}

function sumMetric(rows: SimulationAm5Row[], key: MetricConfig['key']): number {
  return rows.reduce((acc, row) => acc + row[key], 0);
}

function formatMetricBadge(
  metric: MetricConfig,
  summary: { alerts: number; duration: number; telemetry: number },
): string {
  if (metric.key === 'total_telemetry_received') {
    return `Telemetry: ${formatSimulationNumber(summary.telemetry)}`;
  }
  if (metric.key === 'duration_ms') {
    return `Duration: ${formatSimulationNumber(summary.duration)} ms`;
  }
  return `Alerts: ${formatSimulationNumber(summary.alerts)}`;
}

function SimulationChartLegend({
  hiddenKeys,
  onToggle,
}: {
  hiddenKeys: Set<MetricConfig['key']>;
  onToggle: (key: MetricConfig['key']) => void;
}) {
  return (
    <ul className="m-0 flex list-none flex-wrap items-center justify-center gap-x-4 gap-y-1 pb-0 pt-0">
      {METRICS.map((metric) => {
        const isHidden = hiddenKeys.has(metric.key);
        return (
          <li key={metric.key}>
            <button
              type="button"
              onClick={() => onToggle(metric.key)}
              className={cn(
                'inline-flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-[11px] transition-opacity hover:bg-muted/50',
                isHidden && 'opacity-40',
              )}
              aria-pressed={!isHidden}
              aria-label={`${isHidden ? 'Show' : 'Hide'} ${metric.label}`}
            >
              <svg width="14" height="10" viewBox="0 0 14 10" aria-hidden className="shrink-0">
                <line
                  x1="0"
                  y1="5"
                  x2="14"
                  y2="5"
                  stroke={metric.stroke}
                  strokeWidth="2"
                  strokeDasharray={isHidden ? '3 2' : undefined}
                />
                <circle
                  cx="7"
                  cy="5"
                  r="2.5"
                  fill="var(--card)"
                  stroke={metric.stroke}
                  strokeWidth="1.5"
                  opacity={isHidden ? 0.5 : 1}
                />
              </svg>
              <span
                className={cn(isHidden && 'line-through')}
                style={{ color: metric.stroke }}
              >
                {metric.label}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function SimulationCharts({ runs }: SimulationChartsProps) {
  const chartId = useId().replace(/:/g, '');
  const rootRef = useRef<ReturnType<typeof createSimulationTrackAm5Chart> | null>(null);

  const { theme } = useTheme();
  const isDark = isThemeDarkAppearance(theme);
  const [hiddenMetrics, setHiddenMetrics] = useState<Set<MetricConfig['key']>>(() => new Set());

  const chartData = useMemo(() => buildRunInfoChartData(runs), [runs]);

  const visibleMetrics = useMemo(
    () => METRICS.filter((metric) => !hiddenMetrics.has(metric.key)),
    [hiddenMetrics],
  );

  const toggleMetric = useCallback((key: MetricConfig['key']) => {
    setHiddenMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const summary = useMemo(() => {
    if (!chartData.length) {
      return { alerts: 0, duration: 0, telemetry: 0, runCount: 0 };
    }
    const latest = chartData[chartData.length - 1];
    return {
      alerts: sumMetric(chartData, 'alerts_created'),
      duration: latest.duration_ms,
      telemetry: sumMetric(chartData, 'total_telemetry_received'),
      runCount: chartData.length,
    };
  }, [chartData]);

  useLayoutEffect(() => {
    disposeAm5Root(rootRef.current);
    rootRef.current = null;

    if (!chartData.length || visibleMetrics.length === 0) return;

    const root = createSimulationTrackAm5Chart({
      containerId: chartId,
      data: chartData,
      metrics: visibleMetrics.map((metric) => ({
        key: metric.key,
        label: metric.label,
        color: metric.stroke,
        chartType: metric.key === 'alerts_created' ? 'column' : 'line',
      })),
    });
    rootRef.current = root;

    return () => {
      disposeAm5Root(rootRef.current);
      rootRef.current = null;
    };
  }, [chartData, chartId, isDark, theme, visibleMetrics]);

  return (
    <Card className="overflow-hidden rounded-xl border border-border/80 bg-card p-0 shadow-sm gap-0">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-x-3 gap-y-2 space-y-0 px-3 pt-3 pb-1">
        <CardTitle className="shrink-0 text-base font-semibold tracking-tight text-foreground">
          Agent Run Trends
        </CardTitle>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
            Total: {summary.runCount} run{summary.runCount === 1 ? '' : 's'}
          </span>
          {METRICS.map((metric) => (
            <span
              key={metric.key}
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${metric.badgeClass}`}
            >
              {formatMetricBadge(metric, summary)}
            </span>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-2 pt-0 sm:px-3">
        <div className="overflow-hidden rounded-lg border border-border/60 bg-muted/20 px-0 py-0 dark:bg-muted/10">
          <div
            className="flex flex-col"
            style={{ minHeight: CHART_HEIGHT + CHART_LEGEND_HEIGHT }}
          >
            <div
              className="flex shrink-0 items-center justify-center"
              style={{ height: CHART_LEGEND_HEIGHT }}
            >
              <SimulationChartLegend hiddenKeys={hiddenMetrics} onToggle={toggleMetric} />
            </div>

            {chartData.length === 0 ? (
              <div
                className="flex flex-1 items-center justify-center text-sm text-muted-foreground"
                style={{ height: CHART_HEIGHT }}
              >
                No run data to chart.
              </div>
            ) : visibleMetrics.length === 0 ? (
              <div
                className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-muted-foreground"
                style={{ height: CHART_HEIGHT }}
              >
                All metrics hidden — click a legend item to show a chart.
              </div>
            ) : (
              <div
                id={chartId}
                className="w-full min-h-[280px] [&_.am5-layer]:outline-none"
                style={{ height: CHART_HEIGHT }}
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}