import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { JobsFilter, StatusChartData } from '@/types/jobs';
import { jobsApi, buildFlowStatusCountsPayload, formatFlowStatusAxisLabel } from '@/controllers/API/jobsApi';
import { toast } from 'sonner';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';

interface FlowStatusChartProps {
  filters: JobsFilter;
  onStatusSelect: (status: string | null) => void;
  selectedStatus?: string;
}

const API_STATUS_COLORS: Record<string, { base: string; gradient: string }> = {
  COMPLETED: { base: 'hsl(142, 71%, 45%)', gradient: 'hsl(142, 71%, 57%)' },
  COMPLETE: { base: 'hsl(142, 71%, 45%)', gradient: 'hsl(142, 71%, 57%)' },
  SUCCESS: { base: 'hsl(142, 71%, 45%)', gradient: 'hsl(142, 71%, 57%)' },
  FAILED: { base: 'hsl(0, 84%, 60%)', gradient: 'hsl(0, 90%, 67%)' },
  FAILURE: { base: 'hsl(0, 84%, 60%)', gradient: 'hsl(0, 90%, 67%)' },
  ERROR: { base: 'hsl(0, 84%, 60%)', gradient: 'hsl(0, 90%, 67%)' },
  RUNNING: { base: 'hsl(217, 91%, 60%)', gradient: 'hsl(217, 92%, 67%)' },
  IN_PROGRESS: { base: 'hsl(217, 91%, 60%)', gradient: 'hsl(217, 92%, 67%)' },
  PENDING: { base: 'hsl(24, 94%, 50%)', gradient: 'hsl(24, 96%, 63%)' },
  QUEUED: { base: 'hsl(24, 94%, 50%)', gradient: 'hsl(24, 96%, 63%)' },
  ROLLED_BACK: { base: 'hsl(271, 76%, 45%)', gradient: 'hsl(271, 76%, 58%)' },
  ROLLBACK_RUNNING: { base: 'hsl(188, 85%, 38%)', gradient: 'hsl(188, 78%, 52%)' },
  ROLLBACK_FAILED: { base: 'hsl(350, 75%, 46%)', gradient: 'hsl(350, 82%, 58%)' },
};

const EXTRA_PALETTE: { base: string; gradient: string }[] = [
  { base: 'hsl(215, 19%, 35%)', gradient: 'hsl(215, 20%, 48%)' },
  { base: 'hsl(45, 93%, 42%)', gradient: 'hsl(45, 96%, 55%)' },
  { base: 'hsl(160, 84%, 32%)', gradient: 'hsl(160, 72%, 44%)' },
  { base: 'hsl(330, 70%, 48%)', gradient: 'hsl(330, 75%, 60%)' },
  { base: 'hsl(24, 90%, 48%)', gradient: 'hsl(24, 95%, 58%)' },
  { base: 'hsl(250, 65%, 52%)', gradient: 'hsl(250, 72%, 64%)' },
];

function hashStatus(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function colorsForApiStatus(status: string): { base: string; gradient: string } {
  const u = status.toUpperCase();
  if (API_STATUS_COLORS[u]) return API_STATUS_COLORS[u];
  return EXTRA_PALETTE[hashStatus(u) % EXTRA_PALETTE.length];
}

function svgGradientId(status: string): string {
  return `flow-grad-${status.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

const emptyChartData = (): StatusChartData[] => [];

function niceYMax(max: number): number {
  if (max <= 0) return 4;
  const padded = Math.ceil(max * 1.12);
  const exp = Math.floor(Math.log10(padded));
  const base = 10 ** exp;
  const n = padded / base;
  let nice: number;
  if (n <= 1) nice = 1;
  else if (n <= 2) nice = 2;
  else if (n <= 5) nice = 5;
  else nice = 10;
  return nice * base;
}

type ChartRow = StatusChartData;

export const FlowStatusChart: React.FC<FlowStatusChartProps> = ({
  filters,
  onStatusSelect,
  selectedStatus,
}) => {
  const [chartData, setChartData] = useState<StatusChartData[]>(emptyChartData);
  const [loading, setLoading] = useState(true);
  const [hoveredStatus, setHoveredStatus] = useState<string | null>(null);

  const countsPayloadKey = useMemo(() => {
    const p = buildFlowStatusCountsPayload(filters);
    return JSON.stringify(p);
  }, [
    filters.deploymentName,
    filters.timeRange,
    filters.dateRange?.from?.getTime(),
    filters.dateRange?.to?.getTime(),
  ]);

  useEffect(() => {
    let cancelled = false;
    const payload = buildFlowStatusCountsPayload(filters);
    setLoading(true);
    jobsApi
      .getFlowStatusCounts(payload)
      .then((rows) => {
        if (!cancelled) setChartData(rows);
      })
      .catch((error) => {
        if (!cancelled) {
          setChartData(emptyChartData());
          toast.error(getDisplayErrorMessage(error, 'Failed to load flow status counts.'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [countsPayloadKey]);

  const displayData: ChartRow[] = useMemo(() => {
    return [...chartData].sort((a, b) => b.count - a.count);
  }, [chartData]);

  const total = chartData.reduce((acc, curr) => acc + curr.count, 0);
  const maxCount = Math.max(0, ...chartData.map((d) => d.count));
  const yMax = niceYMax(maxCount);

  const gridStroke = 'var(--foreground)';
  const axisTickFill = 'var(--foreground)';

  const renderXTick = (props: Record<string, unknown>) => {
    const x = Number(props.x);
    const y = Number(props.y);
    const tickPayload = props.payload as { value?: string; payload?: ChartRow } | undefined;
    let row = displayData[Number(props.index)];
    if (!row && tickPayload?.payload) row = tickPayload.payload;
    if (!row && tickPayload?.value) {
      row = displayData.find(
        (d) => (d.label ?? formatFlowStatusAxisLabel(d.status)) === tickPayload.value,
      );
    }
    if (!row) return null;
    const label = row.label ?? formatFlowStatusAxisLabel(row.status);
    const dimmed = !!selectedStatus && selectedStatus !== row.status;
    const active = hoveredStatus === row.status;
    const words = label.split(/\s+/).filter(Boolean);
    const useTwoLines = words.length >= 2 && label.length > 11;
    return (
      <g transform={`translate(${x},${y})`}>
        {useTwoLines ? (
          <>
            <text
              x={0}
              y={0}
              dy={10}
              textAnchor="middle"
              fontSize={9}
              fill={axisTickFill}
              fontWeight={active ? 600 : 400}
              opacity={dimmed ? 0.4 : active ? 1 : 0.85}
            >
              {words[0]}
            </text>
            <text
              x={0}
              y={0}
              dy={22}
              textAnchor="middle"
              fontSize={9}
              fill={axisTickFill}
              fontWeight={active ? 600 : 400}
              opacity={dimmed ? 0.4 : active ? 1 : 0.85}
            >
              {words.slice(1).join(' ')}
            </text>
          </>
        ) : (
          <text
            x={0}
            y={0}
            dy={14}
            textAnchor="middle"
            fontSize={10}
            fill={axisTickFill}
            fontWeight={active ? 600 : 400}
            opacity={dimmed ? 0.4 : active ? 1 : 0.85}
          >
            {label}
          </text>
        )}
      </g>
    );
  };

  const FlowChartTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ value?: number; payload?: ChartRow; name?: string }>;
  }) => {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload as ChartRow | undefined;
    const st = row?.status ?? '';
    const statusLabel = row?.label ?? formatFlowStatusAxisLabel(st);
    const colors = colorsForApiStatus(st);
    const count = typeof payload[0]?.value === 'number' ? payload[0].value : row?.count ?? 0;
    const runLabel = count === 1 ? 'run' : 'runs';
    const pct = total > 0 ? ((count / total) * 100).toFixed(1) : null;

    return (
      <div
        className="pointer-events-none z-50 w-[11.5rem] max-w-[11.5rem] rounded-lg border border-border/70 bg-popover px-3 py-2 text-popover-foreground shadow-md"
        role="tooltip"
      >
        <div className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: colors.base }}
            aria-hidden
          />
          <span className="text-xs font-semibold leading-snug text-foreground">{statusLabel}</span>
        </div>
        <p className="mt-1 text-base font-bold tabular-nums leading-none text-foreground">
          {count.toLocaleString()}{' '}
          <span className="text-[10px] font-medium text-muted-foreground">{runLabel}</span>
        </p>
        {pct != null ? (
          <p className="mt-0.5 text-[10px] text-muted-foreground">{pct}% of total</p>
        ) : null}
      </div>
    );
  };

  const hasMultiWordLabels = displayData.some((d) => {
    const label = d.label ?? formatFlowStatusAxisLabel(d.status);
    return label.split(/\s+/).length >= 2 && label.length > 11;
  });
  const bottomMargin = hasMultiWordLabels ? 8 : displayData.length > 5 ? 16 : 6;
  const xAxisHeight = hasMultiWordLabels ? 52 : displayData.length > 5 ? 44 : 34;

  return (
    <Card className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm p-0 gap-0">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pt-3 pb-1.5">
        <CardTitle className="text-base font-semibold tracking-tight text-foreground">Flow Runs</CardTitle>
        <span
          className={`text-sm tabular-nums text-muted-foreground ${loading ? 'opacity-60' : ''}`}
        >
          {loading ? '…' : `${total.toLocaleString()} total`}
        </span>
      </CardHeader>
      <CardContent className="px-2 pb-2 pt-0 sm:px-4">
        {!loading && total === 0 ? (
          <div className="h-[200px] w-full flex items-center justify-center text-muted-foreground text-sm">
            No data available for the selected date range
          </div>
        ) : (
          <div className="h-[200px] w-full min-h-[180px] [&_.recharts-surface]:outline-none [&_.recharts-wrapper]:outline-none [&_*:focus]:outline-none">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={displayData}
                margin={{ top: 28, right: 8, left: 2, bottom: bottomMargin }}
                barCategoryGap={displayData.length > 5 ? '12%' : '18%'}
                onMouseLeave={() => setHoveredStatus(null)}
              >
                <defs>
                  {displayData.map((entry) => {
                    const { base, gradient } = colorsForApiStatus(entry.status);
                    const gid = svgGradientId(entry.status);
                    return (
                      <linearGradient id={gid} key={entry.status} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={gradient} />
                        <stop offset="100%" stopColor={base} />
                      </linearGradient>
                    );
                  })}
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={gridStroke}
                  strokeOpacity={0.14}
                  vertical
                  horizontal
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={{ stroke: gridStroke, strokeOpacity: 0.35 }}
                  interval={0}
                  height={xAxisHeight}
                  tick={renderXTick}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  domain={[0, yMax]}
                  tick={{ fill: axisTickFill, fontSize: 11, opacity: 0.85 }}
                  tickFormatter={(v) => (typeof v === 'number' ? v.toLocaleString() : String(v))}
                  width={48}
                />
                <Tooltip
                  cursor={{
                    fill: 'color-mix(in srgb, var(--foreground) 8%, transparent)',
                    radius: 6,
                  }}
                  content={(tipProps) => (
                    <FlowChartTooltip
                      active={tipProps.active}
                      payload={
                        tipProps.payload as Array<{ value?: number; payload?: ChartRow }> | undefined
                      }
                    />
                  )}
                  wrapperStyle={{ outline: 'none', zIndex: 50, maxWidth: 184 }}
                  allowEscapeViewBox={{ x: false, y: false }}
                  offset={4}
                />
                <Bar
                  dataKey="count"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={40}
                  isAnimationActive={false}
                  onClick={(item) => {
                    const row = (item as { payload?: ChartRow }).payload;
                    if (row?.status) onStatusSelect(row.status.toUpperCase());
                  }}
                  onMouseEnter={(item) => {
                    const row = (item as { payload?: ChartRow }).payload;
                    if (row?.status) setHoveredStatus(row.status);
                  }}
                >
                  <LabelList
                    dataKey="count"
                    position="top"
                    offset={6}
                    formatter={(value: number) => (value > 0 ? value.toLocaleString() : '')}
                    style={{
                      fill: axisTickFill,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  />
                  {displayData.map((entry) => (
                    <Cell
                      key={entry.status}
                      fill={`url(#${svgGradientId(entry.status)})`}
                      className="cursor-pointer transition-opacity duration-150"
                      style={{
                        opacity:
                          !selectedStatus || selectedStatus === entry.status.toUpperCase()
                            ? 1
                            : 0.35,
                      }}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
