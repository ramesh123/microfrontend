import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  formatYmd,
  resolveFlowDateFilterToYmd,
  type FlowDateFilterValue,
} from '@/components/common/FlowJobsDateFilter';
import {
  getTotalMatchedUnmatchedCount,
  getReconciliationSummaryTrends,
  getAgeingSummary,
  getRemarksWiseAgeingSummary,
  getSummaryTable,
  type AgeingSummaryRow,
  type RemarksWiseAgeingSummaryRow,
  type SummaryTableRow,
  type TotalMatchedUnmatchedCountRow,
} from '@/controllers/API/ReconcilationAPI';
import { formatNumber } from '@/utils/numberFormatters';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import { cn } from '@/lib/utils';
import { AgingSummaryCard } from './components/AgingSummaryCard';
import { AgingAmountTrendBarsRow } from './components/AgingAmountTrendBarsRow';
import { AgingSingleTrendCard } from './components/AgingSingleTrendCard';
import { AgingMatchRateTrendCard } from './components/AgingMatchRateTrendCard';
import { AgingSummaryTableCard } from './components/AgingSummaryTableCard';
import { RemarksWiseAgeingSummaryTableCard } from './components/RemarksWiseAgeingSummaryTableCard';
import { AgingReconciliationDetailsSheet } from './components/AgingReconciliationDetailsSheet';
import { useAgingReconciliationDetails } from './hooks/useAgingReconciliationDetails';
import { toAmountTrendChartData, toCountTrendChartData } from './utils/agingTrends';
import {
  AGING_METRIC_COLORS,
  AGING_TWIN_TREND_CHART_HEIGHT,
  agingSectionGap,
} from './utils/agingUiTokens';

interface AnalyticsAgingViewProps {
  flowId?: string;
  dateFilter: FlowDateFilterValue;
  onLoadingChange?: (loading: boolean) => void;
  onRegisterRefresh?: (refresh: (() => void) | null) => void;
  hideTopCardsAndBars?: boolean;
}

type AgingMetricKey = keyof TotalMatchedUnmatchedCountRow;

const AGING_METRICS: Array<{
  key: AgingMetricKey;
  label: string;
  format: 'amount' | 'count' | 'percent';
  valueClassName: string;
}> = [
    {
      key: 'total_matched_amount',
      label: 'Matched Amount',
      format: 'amount',
      valueClassName: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      key: 'total_unmatched_amount',
      label: 'Unmatched Amount',
      format: 'amount',
      valueClassName: 'text-rose-600 dark:text-rose-400',
    },
    {
      key: 'total_reversal_amount',
      label: 'Reversal Amount',
      format: 'amount',
      valueClassName: 'text-amber-600 dark:text-amber-500',
    },
    {
      key: 'total_matched_count',
      label: 'Matched Count',
      format: 'count',
      valueClassName: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      key: 'total_unmatched_count',
      label: 'Unmatched Count',
      format: 'count',
      valueClassName: 'text-rose-600 dark:text-rose-400',
    },
    {
      key: 'total_reversal_count',
      label: 'Reversal Count',
      format: 'count',
      valueClassName: 'text-amber-600 dark:text-amber-500',
    },
    {
      key: 'matched_rate',
      label: 'Matched Rate',
      format: 'percent',
      valueClassName: 'text-violet-600 dark:text-violet-400',
    },
    {
      key: 'unmatched_rate',
      label: 'Unmatched Rate',
      format: 'percent',
      valueClassName: 'text-orange-600 dark:text-orange-400',
    },
  ];

function formatMetricValue(value: number | undefined, format: 'amount' | 'count' | 'percent'): string {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return '—';
  const num = Number(value);
  if (format === 'percent') return `${Math.round(num)}%`;
  return Math.round(num).toLocaleString();
}

function buildAgingApiPayload(flowId: string, dateFilter: FlowDateFilterValue) {
  const { fromDate, toDate } = resolveFlowDateFilterToYmd(dateFilter);
  return {
    flow_id: flowId,
    start_date: fromDate ?? '',
    end_date: toDate ?? '',
  };
}

function buildAgeingSummaryPayload(flowId: string, sourceNames: string[]) {
  return {
    flow_id: flowId,
    flow_run_id: '',
    statement_date: '',
    cycle_number: '',
    execution_number: '',
    source_name: sourceNames,
  };
}

function buildSummaryTablePayload(flowId: string) {
  return {
    flow_id: flowId,
    stmt_date: '',
    is_select: false,
  };
}

function getUniqueSourceNames(rows: SummaryTableRow[]): string[] {
  return Array.from(
    new Set(
      rows
        .map((row) => String(row.source ?? '').trim())
        .filter((source) => source.length > 0),
    ),
  );
}

/** Stable React Query key segment — preset uses timeRange, not recomputed rolling dates. */
function getAgingDateQueryKey(dateFilter: FlowDateFilterValue): string {
  if (dateFilter.mode === 'all') return 'all';
  if (dateFilter.mode === 'preset') return `preset:${dateFilter.timeRange}`;
  return `custom:${formatYmd(dateFilter.from)}|${formatYmd(dateFilter.to)}`;
}

const AGING_QUERY_OPTIONS = {
  retry: false,
  staleTime: 60_000,
  refetchOnWindowFocus: false,
} as const;

const COUNT_LINES = [
  { dataKey: 'unmatched_count', name: 'Unmatched Count', color: AGING_METRIC_COLORS.unmatched },
  { dataKey: 'reversal_count', name: 'Reversal Count', color: AGING_METRIC_COLORS.reversal },
  { dataKey: 'matched_count', name: 'Matched Count', color: AGING_METRIC_COLORS.matched },
] as const;

const formatAxisAmount = (value: number) =>
  formatNumber(value, { format: 'short', minValue: 1000 });

const formatAxisCount = (value: number) =>
  formatNumber(value, { format: 'short', minValue: 1000 });

const formatTooltipCount = (value: number) =>
  formatNumber(value, { format: 'full', minValue: 0 });

export function AnalyticsAgingView({
  flowId,
  dateFilter,
  onLoadingChange,
  onRegisterRefresh,
  hideTopCardsAndBars = false,
}: AnalyticsAgingViewProps) {
  const dateQueryKey = useMemo(() => getAgingDateQueryKey(dateFilter), [dateFilter]);

  const apiPayload = useMemo(
    () => (flowId ? buildAgingApiPayload(flowId, dateFilter) : null),
    [flowId, dateFilter],
  );

  const {
    data: agingData,
    isLoading: agingQueryLoading,
    isFetching: agingQueryFetching,
    refetch: refetchAgingData,
    isError: agingQueryError,
    error: agingQueryErrorData,
  } = useQuery({
    queryKey: ['analytics-aging', flowId, dateQueryKey],
    queryFn: async () => {
      if (!apiPayload) {
        return {
          summary: null,
          trends: [],
          ageingTable: [] as AgeingSummaryRow[],
          remarksWiseAgeingTable: [] as RemarksWiseAgeingSummaryRow[],
          sourceNames: [] as string[],
        };
      }
      const [summary, trends, summaryRows] = await Promise.all([
        getTotalMatchedUnmatchedCount(apiPayload),
        getReconciliationSummaryTrends(apiPayload),
        getSummaryTable(buildSummaryTablePayload(flowId)),
      ]);
      const summaryRowsData = Array.isArray(summaryRows)
        ? summaryRows
        : Array.isArray(summaryRows?.data)
          ? summaryRows.data
          : [];
      const sourceNames = getUniqueSourceNames(summaryRowsData);
      const ageingSummaryPayload = buildAgeingSummaryPayload(flowId ?? '', sourceNames);
      const [ageingTable, remarksWiseAgeingTable] = await Promise.all([
        getAgeingSummary(ageingSummaryPayload),
        getRemarksWiseAgeingSummary(ageingSummaryPayload),
      ]);
      return { summary, trends, ageingTable, remarksWiseAgeingTable, sourceNames };
    },
    enabled: Boolean(flowId && apiPayload),
    ...AGING_QUERY_OPTIONS,
  });

  const data = agingData?.summary ?? null;
  const trends = agingData?.trends ?? [];
  const ageingTableRows = agingData?.ageingTable ?? [];
  const remarksWiseAgeingTableRows = agingData?.remarksWiseAgeingTable ?? [];
  const sourceNames = agingData?.sourceNames ?? [];

  const {
    detailsOpen,
    detailsData,
    detailsColumns,
    detailsLoading,
    totalRows,
    selectedSourceName,
    handleBarClick,
    handleChartClick,
    handleSourceTabChange,
    handleSheetOpenChange,
    activeParams,
  } = useAgingReconciliationDetails({ flowId, sourceNames });

  const showLoading = agingQueryLoading || agingQueryFetching;
  const hasError = agingQueryError;
  const summaryLoading = agingQueryLoading;
  const trendsLoading = agingQueryLoading;
  const ageingTableLoading = agingQueryLoading;
  const remarksWiseAgeingTableLoading = agingQueryLoading;

  const amountChartData = useMemo(() => toAmountTrendChartData(trends), [trends]);
  const countChartData = useMemo(() => toCountTrendChartData(trends), [trends]);

  const trendsLoadingEmpty = trendsLoading && trends.length === 0;

  // Get the specific trend value for the selected bar/metric
  const selectedTrendValue = useMemo(() => {
    if (!activeParams) return null;
    // Combine both amount and count chart data to find the row
    const allTrendData = [...trends];
    const matchingRow = allTrendData.find(row => row.statement_date === activeParams.statementDate);
    if (!matchingRow) return null;
    
    // Map the dataKey to the corresponding AMOUNT property in the trend row
    const valueMap: Record<string, string> = {
      'matched_amount': 'total_matched_amount',
      'unmatched_amount': 'total_unmatched_amount',
      'reversal_amount': 'total_reversal_amount',
      'matched_count': 'total_matched_amount',
      'unmatched_count': 'total_unmatched_amount',
      'reversal_count': 'total_reversal_amount'
    };
    const key = valueMap[activeParams.dataKey] || activeParams.dataKey;
    return (matchingRow as any)[key];
  }, [activeParams, trends]);

  const handleRefresh = useCallback(() => {
    void refetchAgingData();
  }, [refetchAgingData]);

  const refreshRef = useRef(handleRefresh);
  refreshRef.current = handleRefresh;

  useEffect(() => {
    onLoadingChange?.(showLoading);
  }, [showLoading, onLoadingChange]);

  useEffect(() => {
    onRegisterRefresh?.(flowId ? () => refreshRef.current() : null);
    return () => onRegisterRefresh?.(null);
  }, [flowId, onRegisterRefresh]);

  return (
    <div className={cn('flex h-full min-h-0 flex-1 flex-col overflow-auto px-0 pb-3', agingSectionGap)}>
      {!flowId ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Flow ID is required to load day wise trends.
        </div>
      ) : hasError ? (
        <div className="flex flex-1 items-center justify-center text-sm text-destructive pt-50">
          {getDisplayErrorMessage(agingQueryErrorData, 'Failed to load day wise trends data.')}
        </div>
      ) : (
        <>
          {!hideTopCardsAndBars && (
            <div className="shrink-0">
              <div className={cn('grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-8', agingSectionGap)}>
                {AGING_METRICS.map(({ key, label, format, valueClassName }) => (
                  // <div key={key} className="shrink-0 min-w-[120px]">
                  <AgingSummaryCard
                    key={key}
                    label={label}
                    value={
                      summaryLoading && !data ? '…' : formatMetricValue(data?.[key], format)
                    }
                    valueClassName={valueClassName}
                    isLoading={summaryLoading && !data}
                  />
                  // </div>
                ))}
              </div>
            </div>
          )}

          <div className={cn('flex min-h-0 flex-1 flex-col', agingSectionGap)}>
            {!hideTopCardsAndBars && (
              <AgingAmountTrendBarsRow
                data={amountChartData}
                valueFormatter={formatAxisAmount}
                isLoading={trendsLoadingEmpty}
                onMetricClick={handleChartClick}
              />
            )}

            <div className={cn('grid grid-cols-1 md:grid-cols-2', agingSectionGap)}>
              <AgingSingleTrendCard
                title="Count Trends"
                data={countChartData}
                lines={[...COUNT_LINES]}
                chartType="bar"
                chartHeight={AGING_TWIN_TREND_CHART_HEIGHT}
                yAxisFormatter={formatAxisCount}
                tooltipValueFormatter={formatTooltipCount}
                isLoading={trendsLoadingEmpty}
                onBarClick={handleBarClick}
              />
              <AgingMatchRateTrendCard
                data={trends}
                isLoading={trendsLoadingEmpty}
                onPointClick={(payload) => {
                  if (handleBarClick) {
                    handleBarClick({
                      row: payload.row,
                      dataKey: payload.dataKey.replace('_rate', '_count'),
                    });
                  }
                }}
              />
            </div>

            <RemarksWiseAgeingSummaryTableCard
              rows={remarksWiseAgeingTableRows}
              isLoading={remarksWiseAgeingTableLoading}
              defaultPageSize={10}
            />

            <AgingSummaryTableCard
              rows={ageingTableRows}
              isLoading={ageingTableLoading}
              defaultPageSize={10}
            />
          </div>

          <AgingReconciliationDetailsSheet
            open={detailsOpen}
            onOpenChange={handleSheetOpenChange}
            loading={detailsLoading}
            records={detailsData}
            columns={detailsColumns}
            totalRows={totalRows}
            sourceNames={sourceNames}
            selectedSourceName={selectedSourceName}
            onSourceTabChange={handleSourceTabChange}
            activeParams={activeParams}
            selectedTrendValue={selectedTrendValue}
            flowId={flowId}
          />
        </>
      )}
    </div>
  );
}
