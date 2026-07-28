import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { BarChart3, LineChart } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AGING_METRIC_COLORS, agingSectionGap } from '../utils/agingUiTokens';
import { niceScaleMax } from '../utils/agingTrendScale';
import {
  AgingHorizontalMetricTrendCard,
  type AgingHorizontalMetricRow,
} from './AgingHorizontalMetricTrendCard';
import { AgingAmMultiLineChart } from './AgingAmMultiLineChart';
import { AGING_CHART_EXPANDED_DIALOG_HEIGHT } from '../utils/agingAmChartScrollbar';
import {
  AgingChartExpandDialog,
  useAgingChartExpand,
} from './AgingChartExpandShell';

interface AmountTrendRow {
  statement_date: string;
  matched_amount: number;
  unmatched_amount: number;
  reversal_amount: number;
}

export interface AgingAmountTrendClickParams {
  statementDate: string;
  dataKey: 'matched_amount' | 'unmatched_amount' | 'reversal_amount';
}

interface AgingAmountTrendBarsRowProps {
  data: AmountTrendRow[];
  valueFormatter?: (value: number) => string;
  isLoading?: boolean;
  className?: string;
  onMetricClick?: (params: AgingAmountTrendClickParams) => void;
}

const METRICS = [
  {
    key: 'unmatched_amount' as const,
    title: 'Unmatched Amount',
    color: AGING_METRIC_COLORS.unmatched,
  },
  {
    key: 'reversal_amount' as const,
    title: 'Reversal Amount',
    color: AGING_METRIC_COLORS.reversal,
  },
  {
    key: 'matched_amount' as const,
    title: 'Matched Amount',
    color: AGING_METRIC_COLORS.matched,
  },
];

function toMetricRows(data: AmountTrendRow[], key: keyof AmountTrendRow): AgingHorizontalMetricRow[] {
  return data.map((row) => ({
    statement_date: row.statement_date,
    value: Number(row[key]) || 0,
  }));
}

export function AgingAmountTrendBarsRow({
  data,
  valueFormatter,
  isLoading,
  className,
  onMetricClick,
}: AgingAmountTrendBarsRowProps) {
  const [viewMode, setViewMode] = useState<'bar' | 'line'>('bar');

  const { matchedUnmatchedMax, reversalMax } = useMemo(() => {
    const matchedUnmatchedPeak = data.reduce(
      (max, row) =>
        Math.max(max, Number(row.matched_amount) || 0, Number(row.unmatched_amount) || 0),
      0,
    );
    const reversalPeak = data.reduce(
      (max, row) => Math.max(max, Number(row.reversal_amount) || 0),
      0,
    );
    return {
      matchedUnmatchedMax: niceScaleMax(matchedUnmatchedPeak),
      reversalMax: niceScaleMax(reversalPeak),
    };
  }, [data]);

  // Prepare line chart data with all three metrics
  const lineChartDataWithAllMetrics = useMemo(() => {
    return data.map((row) => ({
      statement_date: row.statement_date,
      matched_amount: Number(row.matched_amount) || 0,
      unmatched_amount: Number(row.unmatched_amount) || 0,
      reversal_amount: Number(row.reversal_amount) || 0,
    }));
  }, [data]);

  const canExpandLine = !isLoading && lineChartDataWithAllMetrics.length > 0;
  const { open: lineExpandOpen, setOpen: setLineExpandOpen, expandButton: lineExpandButton } =
    useAgingChartExpand(!canExpandLine);

  const lineChartContent = (height: number | '100%') => (
    <AgingAmMultiLineChart
      data={lineChartDataWithAllMetrics}
      metrics={METRICS}
      height={height}
      valueFormatter={valueFormatter}
      onPointClick={
        onMetricClick
          ? (payload) =>
              onMetricClick({
                statementDate: String(payload.row.statement_date ?? ''),
                dataKey: payload.dataKey as AgingAmountTrendClickParams['dataKey'],
              })
          : undefined
      }
    />
  );

  if (viewMode === 'line') {
    return (
      <div className={cn('flex flex-col gap-4', className)}>
        {/* Line Chart Container with Tabs on Right */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-semibold">Amount Trends</h3>
            <div className="flex items-center gap-1">
              {lineExpandButton}
              <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'bar' | 'line')}>
                <TabsList>
                  <TabsTrigger value="bar">
                    <BarChart3 size={18} />
                  </TabsTrigger>
                  <TabsTrigger value="line">
                    <LineChart size={18} />
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
          <div className="h-70 w-full rounded-lg border bg-card p-4">
            {lineChartContent('100%')}
          </div>
        </div>

        <AgingChartExpandDialog
          open={lineExpandOpen}
          onOpenChange={setLineExpandOpen}
          title="Amount Trends"
          subtitle="Matched, unmatched, and reversal amounts by statement date"
        >
          {lineChartContent(AGING_CHART_EXPANDED_DIALOG_HEIGHT)}
        </AgingChartExpandDialog>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {/* Header with Title and Tabs on Right */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold">Amount Trends</h3>
        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'bar' | 'line')}>
          <TabsList>
            <TabsTrigger value="bar">
              <BarChart3 size={18} />
            </TabsTrigger>
            <TabsTrigger value="line">
              <LineChart size={18} />
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Bar Chart View */}
      <div className={cn('grid min-h-0 grid-cols-1 md:grid-cols-3', agingSectionGap)}>
        {METRICS.map((metric) => (
          <AgingHorizontalMetricTrendCard
            key={metric.key}
            title={metric.title}
            color={metric.color}
            rows={toMetricRows(data, metric.key)}
            scaleMax={metric.key === 'reversal_amount' ? reversalMax : matchedUnmatchedMax}
            valueFormatter={valueFormatter}
            isLoading={isLoading}
            onRowClick={
              onMetricClick
                ? (row) =>
                    onMetricClick({
                      statementDate: row.statement_date,
                      dataKey: metric.key,
                    })
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
