import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AgingAmBarChart, type AgingAmBarClickPayload } from './AgingAmChart';

export type AgingTrendChartType = 'area' | 'bar' | 'line';

export interface AgingTrendLine {
  dataKey: string;
  name: string;
  color: string;
}

interface AgingTrendChartContentProps {
  data: Record<string, string | number>[];
  lines: AgingTrendLine[];
  chartType?: AgingTrendChartType;
  yAxisFormatter?: (value: number) => string;
  tooltipValueFormatter?: (value: number) => string;
  height?: number | '100%';
  yDomain?: [number, number];
  yMin?: number;
  yMax?: number;
  onBarClick?: (payload: AgingAmBarClickPayload) => void;
}

function AgingChartTooltip({
  active,
  payload,
  label,
  formatValue,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  formatValue?: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-border/80 bg-background/95 px-3 py-2 shadow-lg backdrop-blur-sm">
      <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">Statement {label}</p>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-foreground">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name}
            </span>
            <span className="font-semibold tabular-nums">
              {formatValue ? formatValue(Number(entry.value)) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartGradients({ lines }: { lines: AgingTrendLine[] }) {
  return (
    <defs>
      {lines.map((line) => (
        <linearGradient
          key={`grad-${line.dataKey}`}
          id={`fill-${line.dataKey}`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="0%" stopColor={line.color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={line.color} stopOpacity={0.02} />
        </linearGradient>
      ))}
    </defs>
  );
}

function ChartAxes({
  yAxisFormatter,
  yDomain,
}: {
  yAxisFormatter?: (value: number) => string;
  yDomain?: [number, number];
}) {
  return (
    <>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
      <XAxis
        dataKey="statement_date"
        tickLine={false}
        axisLine={false}
        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
        interval="preserveStartEnd"
        dy={4}
      />
      <YAxis
        tickLine={false}
        axisLine={false}
        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
        width={52}
        tickFormatter={yAxisFormatter}
        domain={yDomain}
      />
    </>
  );
}

function resolveYDomain(
  yDomain?: [number, number],
  yMin?: number,
  yMax?: number,
): [number, number] | undefined {
  if (yDomain) return yDomain;
  if (yMin != null && yMax != null) return [yMin, yMax];
  return undefined;
}

export function AgingTrendChartContent({
  data,
  lines,
  chartType = 'bar',
  yAxisFormatter,
  tooltipValueFormatter,
  height = 280,
  yDomain,
  yMin,
  yMax,
  onBarClick,
}: AgingTrendChartContentProps) {
  if (chartType === 'bar') {
    return (
      <AgingAmBarChart
        data={data}
        lines={lines}
        height={height}
        yMin={yMin ?? yDomain?.[0]}
        yMax={yMax ?? yDomain?.[1]}
        onBarClick={onBarClick}
      />
    );
  }

  const formatValue = tooltipValueFormatter ?? yAxisFormatter;
  const isArea = chartType === 'area';
  const resolvedYDomain = resolveYDomain(yDomain, yMin, yMax);

  const containerClassName =
    height === '100%' ? 'h-full w-full min-h-0' : 'w-full';
  const containerStyle = typeof height === 'number' ? { height } : undefined;

  if (data.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-2 text-muted-foreground',
          containerClassName,
        )}
        style={containerStyle}
      >
        <BarChart3 className="h-10 w-10 opacity-30" />
        <p className="text-xs">No trend data for this period</p>
      </div>
    );
  }

  const tooltipContent = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: unknown;
    label?: string | number;
  }) => (
    <AgingChartTooltip
      active={active}
      payload={payload as Array<{ name: string; value: number; color: string }>}
      label={label != null ? String(label) : undefined}
      formatValue={formatValue}
    />
  );

  return (
    <div className={containerClassName} style={containerStyle}>
      <ResponsiveContainer width="100%" height="100%">
        {isArea ? (
          <AreaChart data={data} margin={{ top: 12, right: 16, left: 4, bottom: 4 }}>
            <ChartGradients lines={lines} />
            <ChartAxes yAxisFormatter={yAxisFormatter} yDomain={resolvedYDomain} />
            <Tooltip
              cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
              content={tooltipContent}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
            />
            {lines.map((line) => (
              <Area
                key={line.dataKey}
                type="monotone"
                dataKey={line.dataKey}
                name={line.name}
                stroke={line.color}
                strokeWidth={2}
                fill={`url(#fill-${line.dataKey})`}
                dot={{ r: 3, strokeWidth: 2, fill: '#fff' }}
                activeDot={{ r: 5, strokeWidth: 2 }}
              />
            ))}
          </AreaChart>
        ) : (
          <LineChart data={data} margin={{ top: 12, right: 16, left: 4, bottom: 4 }}>
            <ChartAxes yAxisFormatter={yAxisFormatter} yDomain={resolvedYDomain} />
            <Tooltip
              cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
              content={tooltipContent}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
            />
            {lines.map((line) => (
              <Line
                key={line.dataKey}
                type="monotone"
                dataKey={line.dataKey}
                name={line.name}
                stroke={line.color}
                strokeWidth={2.5}
                dot={{ r: 3, strokeWidth: 2, fill: '#fff' }}
                activeDot={{ r: 6, strokeWidth: 2 }}
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
