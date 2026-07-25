import { useMemo } from 'react';
import { LineChart as LineChartIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { ReconciliationSummaryTrendRow } from '@/controllers/API/ReconcilationAPI';
import { cn } from '@/lib/utils';
import {
  AGING_METRIC_COLORS,
  AGING_TWIN_TREND_CHART_HEIGHT,
  agingCardSurface,
  agingEmptyState,
} from '../utils/agingUiTokens';
import { AgingAnalyticsCardHeader } from './AgingAnalyticsCardHeader';
import { AgingAmMultiLineChart, type AgingAmMultiLineMetric, type AgingAmMultiLinePointClickPayload } from './AgingAmMultiLineChart';
import { AGING_CHART_EXPANDED_DIALOG_HEIGHT } from '../utils/agingAmChartScrollbar';
import {
  AgingChartExpandDialog,
  useAgingChartExpand,
} from './AgingChartExpandShell';

/** Chart area height — alias of shared aging twin-card token. */
const CHART_HEIGHT = AGING_TWIN_TREND_CHART_HEIGHT;

interface AgingMatchRateTrendCardProps {
  title?: string;
  data?: ReconciliationSummaryTrendRow[];
  isLoading?: boolean;
  className?: string;
  onPointClick?: (payload: AgingAmMultiLinePointClickPayload) => void;
}

function normalizePercent(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  if (num > 0 && num <= 1) return num * 100;
  return num;
}

function buildLineData(data?: ReconciliationSummaryTrendRow[]) {
  return (data ?? [])
    .map((row) => ({
      ...row,
      statement_date: row.statement_date,
      matched_rate: normalizePercent(row.matched_rate),
      unmatched_rate: normalizePercent(row.unmatched_rate),
    }))
    .filter(
      (row) =>
        row.statement_date &&
        (Number.isFinite(row.matched_rate) || Number.isFinite(row.unmatched_rate)),
    );
}

const MATCH_RATE_METRICS: AgingAmMultiLineMetric[] = [
  {
    key: 'matched_rate',
    title: 'Matched Rate',
    color: AGING_METRIC_COLORS.matchedRate,
  },
  {
    key: 'unmatched_rate',
    title: 'Unmatched Rate',
    color: AGING_METRIC_COLORS.unmatchedRate,
  },
];

export function AgingMatchRateTrendCard({
  title = 'Matching Performance Trend',
  data,
  isLoading,
  className,
  onPointClick,
}: AgingMatchRateTrendCardProps) {
  const chartData = useMemo(
    () => buildLineData(data),
    [data],
  );
  const hasData = chartData.length > 0;
  const { open, setOpen, expandButton } = useAgingChartExpand(isLoading || !hasData);

  const chartContent = (height: number) => (
    <AgingAmMultiLineChart
      data={chartData}
      metrics={MATCH_RATE_METRICS}
      height={height}
      valueFormatter={(value) => `${value.toFixed(2)}%`}
      yMin={0}
      yMax={100}
      onPointClick={onPointClick}
    />
  );

  return (
    <Card className={cn(agingCardSurface, 'flex min-h-0 flex-col p-0', className)}>
      <AgingAnalyticsCardHeader
        icon={LineChartIcon}
        title={title}
        subtitle="by statement date"
        trailing={expandButton}
      />
      <CardContent className="shrink-0 px-3 pb-1.5 pt-1">
        {isLoading ? (
          <div
            className={cn('flex items-center justify-center', agingEmptyState)}
            style={{ height: CHART_HEIGHT }}
          >
            Loading match rate…
          </div>
        ) : !hasData ? (
          <div
            className="flex flex-col items-center justify-center gap-2 text-muted-foreground/70"
            style={{ height: CHART_HEIGHT }}
          >
            <LineChartIcon className="h-9 w-9 opacity-25" strokeWidth={1.5} />
            <p className={agingEmptyState}>No match rate data for this period</p>
          </div>
        ) : (
          chartContent(CHART_HEIGHT)
        )}
      </CardContent>

      <AgingChartExpandDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        subtitle="by statement date"
      >
        {chartContent(AGING_CHART_EXPANDED_DIALOG_HEIGHT)}
      </AgingChartExpandDialog>
    </Card>
  );
}
