import React, { useEffect, useId, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { jobsApi } from '@/controllers/API/jobsApi';
import type { TaskRunsChartData, TaskRunsChartDay, TaskRunsChartSummary } from '@/types/jobs';
import { toast } from 'sonner';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';

const STROKE = {
  Completed: 'hsl(142, 71%, 42%)',
  Running: 'hsl(217, 91%, 52%)',
  Failed: 'hsl(0, 72%, 52%)',
} as const;

const FILL_TOP = {
  Completed: 'hsl(142, 71%, 45%)',
  Running: 'hsl(217, 91%, 55%)',
  Failed: 'hsl(0, 72%, 55%)',
} as const;

/** Solid dots on top of areas — same hues as tooltip / stroke lines */
function seriesDot(color: string) {
  return {
    r: 5,
    fill: color,
    stroke: 'var(--card)',
    strokeWidth: 2,
  };
}

interface TaskRunsChartProps {
  flowName: string;
  deploymentName: string;
  /** e.g. `day` — send empty string when unused */
  timeGrain?: string;
  refreshKey: number;
}

function formatPct(n: number | undefined): string {
  if (n == null || Number.isNaN(n)) return '0';
  const v = Number(n);
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2);
}

function summaryLine(summary: TaskRunsChartSummary | undefined): string {
  if (!summary) return '';
  const parts: string[] = [];
  if (summary.completed != null) {
    parts.push(
      `${summary.completed.count} Completed ${formatPct(summary.completed.percentage)}%`,
    );
  }
  if (summary.failed != null) {
    parts.push(`${summary.failed.count} Failed ${formatPct(summary.failed.percentage)}%`);
  }
  if (summary.running != null && summary.running.count > 0) {
    parts.push(
      `${summary.running.count} Running ${formatPct(summary.running.percentage)}%`,
    );
  }
  return parts.join(' ');
}

function formatTooltipDate(isoDate: string) {
  try {
    return format(parseISO(isoDate), 'MMM d, yyyy');
  } catch {
    return isoDate;
  }
}

type TooltipPayload = {
  dataKey?: string;
  value?: number;
  color?: string;
  payload?: TaskRunsChartDay;
};

const SERIES_KEYS = ['Completed', 'Running', 'Failed'] as const;
type SeriesKey = (typeof SERIES_KEYS)[number];

function isSeriesKey(key: string): key is SeriesKey {
  return (SERIES_KEYS as readonly string[]).includes(key);
}

function seriesValueFromRow(row: TaskRunsChartDay | undefined, key: SeriesKey): number {
  if (!row) return 0;
  return Number(row[key] ?? 0);
}

type DotLabelProps = {
  x?: number;
  y?: number;
  value?: number | string;
};

const LABEL_OFFSET_ABOVE_DOT = 10;

function makeDotValueLabel(fill: string) {
  return (props: DotLabelProps) => {
    const v = Number(props.value ?? 0);
    if (v <= 0 || props.x == null || props.y == null) return null;
    return (
      <text
        x={props.x}
        y={props.y - LABEL_OFFSET_ABOVE_DOT}
        textAnchor="middle"
        fill={fill}
        fontSize={10}
        fontWeight={600}
        pointerEvents="none"
      >
        {v.toLocaleString()}
      </text>
    );
  };
}

const renderFailedDotLabel = makeDotValueLabel(STROKE.Failed);
const renderRunningDotLabel = makeDotValueLabel(STROKE.Running);
const renderCompletedDotLabel = makeDotValueLabel(STROKE.Completed);

const CustomTooltip: React.FC<{
  active?: boolean;
  label?: string;
  payload?: TooltipPayload[];
}> = ({ active, label, payload }) => {
  if (!active || !payload?.length) return null;

  const dataRow = payload.find((p) => p.payload)?.payload;
  const byKey = new Map<string, TooltipPayload>();
  for (const p of payload) {
    const key = String(p.dataKey ?? '');
    if (!isSeriesKey(key)) continue;
    const existing = byKey.get(key);
    const v = Number(p.value ?? 0);
    const existingV = existing != null ? Number(existing.value ?? 0) : 0;
    if (!existing || v > 0 || (existingV <= 0 && v >= 0)) {
      byKey.set(key, p);
    }
  }

  const rows = SERIES_KEYS.map((key) => {
    const p = byKey.get(key);
    let v = p != null ? Number(p.value ?? 0) : 0;
    if (v <= 0) v = seriesValueFromRow(dataRow ?? p?.payload, key);
    if (v <= 0) return null;
    return { key, v, color: STROKE[key] as string };
  }).filter((r): r is { key: SeriesKey; v: number; color: string } => r != null);

  const dayTotal = rows.reduce((sum, r) => sum + r.v, 0);

  return (
    <div
      className="pointer-events-none z-50 w-[11.5rem] max-w-[11.5rem] rounded-lg border border-border/70 bg-popover px-3 py-2 text-popover-foreground shadow-md"
      role="tooltip"
    >
      {label ? (
        <p className="text-xs font-semibold text-foreground">{formatTooltipDate(String(label))}</p>
      ) : null}
      <div className="mt-1 flex flex-col gap-1">
        {rows.map(({ key, v, color }) => (
          <div key={key} className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
                aria-hidden
              />
              <span className="text-xs text-foreground">{key}</span>
            </div>
            <span className="shrink-0 text-xs font-bold tabular-nums">{v.toLocaleString()}</span>
          </div>
        ))}
      </div>
      {dayTotal > 0 ? (
        <p className="mt-1 text-[10px] text-muted-foreground">
          {dayTotal} task{dayTotal === 1 ? '' : 's'}
        </p>
      ) : null}
    </div>
  );
};

export const TaskRunsChart: React.FC<TaskRunsChartProps> = ({
  flowName,
  deploymentName,
  timeGrain = '',
  refreshKey,
}) => {
  const [payload, setPayload] = useState<TaskRunsChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const gid = `trc-${useId().replace(/\W/g, '')}`;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!flowName.trim() && !deploymentName.trim()) {
        setLoading(false);
        setPayload(null);
        return;
      }
      setLoading(true);
      try {
        const data = await jobsApi.getTaskRunsChart({
          time_grain: timeGrain,
          deployment_name: deploymentName,
          flow_name: flowName,
        });
        if (!cancelled) setPayload(data);
      } catch (error) {
        if (!cancelled) {
          setPayload(null);
          toast.error(getDisplayErrorMessage(error, 'Failed to load task runs chart.'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [flowName, deploymentName, timeGrain, refreshKey]);

  const chartRows = payload?.chartData ?? [];
  const showRunning = useMemo(
    () => chartRows.some((r) => (r.Running ?? 0) > 0),
    [chartRows],
  );

  const summary = payload?.summary;
  const summaryText = summaryLine(summary);
  const isSinglePoint = chartRows.length === 1;
  const showDotLabels = isSinglePoint;

  return (
    <Card className="mb-3 overflow-hidden rounded-xl border border-border/60 bg-card p-0 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 px-4 pt-4 pb-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-2">
          <h3 className="text-sm font-medium text-foreground">Task Runs</h3>
          {loading ? (
            <span className="text-sm font-semibold tabular-nums text-muted-foreground">—</span>
          ) : (
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {payload?.total ?? 0}
            </span>
          )}
        </div>
        {!loading && summaryText ? (
          <p className="max-w-[55%] text-right text-xs leading-relaxed text-muted-foreground">
            {summaryText}
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-0">
        {loading ? (
          <div className="flex h-[140px] items-center justify-center text-sm text-muted-foreground">
            Loading chart…
          </div>
        ) : chartRows.length === 0 ? (
          <div className="flex h-[100px] items-center justify-center text-sm text-muted-foreground">
            No chart data for this run.
          </div>
        ) : (
          <div className="task-runs-chart h-[160px] w-full [&_.recharts-surface]:outline-none [&_.recharts-wrapper]:outline-none [&_*:focus]:outline-none">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartRows}
                margin={{
                  top: showDotLabels ? 22 : 6,
                  right: 8,
                  left: 0,
                  bottom: isSinglePoint ? 20 : 0,
                }}
              >
                <defs>
                  <linearGradient id={`${gid}-g-completed`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={FILL_TOP.Completed} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={FILL_TOP.Completed} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id={`${gid}-g-failed`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={FILL_TOP.Failed} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={FILL_TOP.Failed} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id={`${gid}-g-running`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={FILL_TOP.Running} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={FILL_TOP.Running} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  hide={!isSinglePoint}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatTooltipDate(String(v))}
                  tick={{ fill: 'var(--foreground)', fontSize: 10, opacity: 0.75 }}
                  interval={0}
                />
                <YAxis hide domain={[0, 'auto']} />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={false}
                  wrapperStyle={{ outline: 'none', zIndex: 50, maxWidth: 184 }}
                  allowEscapeViewBox={{ x: false, y: false }}
                  offset={4}
                />
                <Area
                  type="monotone"
                  dataKey="Failed"
                  stroke={STROKE.Failed}
                  strokeWidth={2}
                  fill={`url(#${gid}-g-failed)`}
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
                {showRunning ? (
                  <Area
                    type="monotone"
                    dataKey="Running"
                    stroke={STROKE.Running}
                    strokeWidth={2}
                    fill={`url(#${gid}-g-running)`}
                    dot={false}
                    activeDot={false}
                    isAnimationActive={false}
                  />
                ) : null}
                <Area
                  type="monotone"
                  dataKey="Completed"
                  stroke={STROKE.Completed}
                  strokeWidth={2}
                  fill={`url(#${gid}-g-completed)`}
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
                {showDotLabels ? (
                  <>
                    <Line
                      type="monotone"
                      dataKey="Failed"
                      stroke="none"
                      fill="none"
                      dot={seriesDot(STROKE.Failed)}
                      activeDot={false}
                      isAnimationActive={false}
                      legendType="none"
                    >
                      <LabelList dataKey="Failed" content={renderFailedDotLabel} />
                    </Line>
                    {showRunning ? (
                      <Line
                        type="monotone"
                        dataKey="Running"
                        stroke="none"
                        fill="none"
                        dot={seriesDot(STROKE.Running)}
                        activeDot={false}
                        isAnimationActive={false}
                        legendType="none"
                      >
                        <LabelList dataKey="Running" content={renderRunningDotLabel} />
                      </Line>
                    ) : null}
                    <Line
                      type="monotone"
                      dataKey="Completed"
                      stroke="none"
                      fill="none"
                      dot={seriesDot(STROKE.Completed)}
                      activeDot={false}
                      isAnimationActive={false}
                      legendType="none"
                    >
                      <LabelList dataKey="Completed" content={renderCompletedDotLabel} />
                    </Line>
                  </>
                ) : null}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
