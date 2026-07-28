import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  agingBarGradient,
  agingBarTrack,
  agingCardSurface,
  agingCardSubtitle,
  agingCardTitle,
  agingDateLabel,
  agingEmptyState,
  agingScaleLabel,
  agingHorizontalTrendScrollMaxHeight,
  agingTrendRow,
  agingValueLabel,
  AGING_HORIZONTAL_TREND_MAX_VISIBLE_BARS,
} from '../utils/agingUiTokens';
import {
  formatTrendAxisValue,
  formatTrendStatementDate,
  niceScaleMax,
} from '../utils/agingTrendScale';
import {
  AgingChartExpandDialog,
  useAgingChartExpand,
} from './AgingChartExpandShell';
import { AGING_CHART_EXPANDED_DIALOG_HEIGHT } from '../utils/agingAmChartScrollbar';

export interface AgingHorizontalMetricRow {
  statement_date: string;
  value: number;
}

interface AgingHorizontalMetricTrendCardProps {
  title: string;
  color: string;
  rows: AgingHorizontalMetricRow[];
  scaleMax?: number;
  valueFormatter?: (value: number) => string;
  isLoading?: boolean;
  className?: string;
  showAllRows?: boolean;
  onRowClick?: (row: AgingHorizontalMetricRow) => void;
}

export function AgingHorizontalMetricTrendCard({
  title,
  color,
  rows,
  scaleMax,
  valueFormatter = formatTrendAxisValue,
  isLoading,
  className,
  showAllRows = false,
  onRowClick,
}: AgingHorizontalMetricTrendCardProps) {
  const canExpand = !isLoading && rows.length > 0;
  const { open, setOpen, expandButton } = useAgingChartExpand(!canExpand || showAllRows);

  const resolvedMax = useMemo(() => {
    if (scaleMax != null && scaleMax > 0) return scaleMax;
    const peak = rows.reduce((max, row) => Math.max(max, row.value), 0);
    return niceScaleMax(peak);
  }, [rows, scaleMax]);

  const maxLabel = valueFormatter(resolvedMax);
  const shouldScroll = !showAllRows && rows.length > AGING_HORIZONTAL_TREND_MAX_VISIBLE_BARS;

  const rowsContent = (
    <div
      className={cn(
        'flex flex-col gap-0.5',
        shouldScroll && 'overflow-y-auto overscroll-y-contain pr-0.5',
      )}
      style={
        shouldScroll
          ? { maxHeight: agingHorizontalTrendScrollMaxHeight() }
          : showAllRows
            ? { maxHeight: AGING_CHART_EXPANDED_DIALOG_HEIGHT - 72 }
            : undefined
      }
    >
      {rows.map((row) => {
        const pct =
          resolvedMax > 0
            ? Math.min(100, Math.max(0, (row.value / resolvedMax) * 100))
            : 0;
        const valueLabel = valueFormatter(row.value);

        const rowContent = (
          <>
            <span className={agingDateLabel}>
              {formatTrendStatementDate(row.statement_date)}
            </span>
            <div className={agingBarTrack}>
              <div
                className="absolute inset-y-0 left-0 rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
                style={{
                  width: `${pct}%`,
                  background: agingBarGradient(color),
                }}
              />
              <span
                className={cn(
                  agingValueLabel,
                  'absolute top-1/2 -translate-y-1/2 whitespace-nowrap',
                )}
                style={{ left: `calc(${pct}% + 5px)` }}
              >
                {valueLabel}
              </span>
            </div>
          </>
        );

        if (onRowClick) {
          return (
            <button
              key={row.statement_date}
              type="button"
              onClick={() => onRowClick(row)}
              className={cn(
                agingTrendRow,
                'w-full cursor-pointer text-left transition-colors hover:bg-muted/30',
              )}
            >
              {rowContent}
            </button>
          );
        }

        return (
          <div key={row.statement_date} className={agingTrendRow}>
            {rowContent}
          </div>
        );
      })}
    </div>
  );

  return (
    <Card className={cn(agingCardSurface, 'flex min-h-0 min-w-0 flex-1 flex-col p-0', className)}>
      <div className="shrink-0 border-b border-border/35 bg-gradient-to-b from-muted/25 to-transparent px-3.5 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/80 dark:ring-black/20"
              style={{ background: agingBarGradient(color) }}
            />
            <p className={cn(agingCardTitle, 'truncate')}>{title}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {!showAllRows ? expandButton : null}
          </div>
        </div>
        <p className={cn(agingCardSubtitle, 'mt-0.5 pl-[1.125rem] text-foreground/70')}>
          By statement dates
        </p>
      </div>
      <CardContent className="flex min-h-0 flex-1 flex-col px-2.5 pb-3 pt-2">
        {isLoading ? (
          <div className={cn('flex flex-1 items-center justify-center py-9', agingEmptyState, 'text-foreground/75')}>
            Loading trends…
          </div>
        ) : rows.length === 0 ? (
          <div className={cn('flex flex-1 items-center justify-center py-9', agingEmptyState, 'text-foreground/75')}>
            No trend data for this period
          </div>
        ) : (
          rowsContent
        )}
      </CardContent>

      {!showAllRows ? (
        <AgingChartExpandDialog
          open={open}
          onOpenChange={setOpen}
          title={title}
          subtitle="By statement date"
        >
          <AgingHorizontalMetricTrendCard
            title={title}
            color={color}
            rows={rows}
            scaleMax={scaleMax}
            valueFormatter={valueFormatter}
            showAllRows
            onRowClick={onRowClick}
          />
        </AgingChartExpandDialog>
      ) : null}
    </Card>
  );
}
