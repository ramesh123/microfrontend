import { useMemo } from 'react';
import { Am5MiniChart } from '@/pages/ExploratoryAnalysis/AgenticSemantics/Am5MiniChart';
import type { ChartDetail } from '@/pages/ExploratoryAnalysis/AgenticSemantics/chartTypes';

/**
 * Status distribution for data-quality trends: same amCharts column path as dashboard
 * (`setupAm5XyChart` + `renderAm5SingleBarSeries` in am5MiniChartBarSingle).
 */
export function DataQualityTrendStatusAm5Chart({
  entries,
}: {
  entries: { status: string; count: number }[];
}) {
  const detail = useMemo((): ChartDetail => {
    const chart_data = entries.map((e) => ({
      xCategory: e.status.replace(/_/g, ' '),
      value: e.count,
    }));
    return {
      chart_id: 'dq-trends-status-distribution',
      chart_type: 'bar_chart',
      metric_name: 'Trend rows',
      chart_data,
      title: 'Status distribution',
      category_column: 'xCategory',
      intent: 'data_quality',
      chart_payload: { chart_type: 'bar_chart' },
    };
  }, [entries]);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-border/80 bg-card shadow-sm">
      <div className="shrink-0 border-b border-border/60 px-4 py-3">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">Status distribution</h3>
        <p className="mt-1 text-xs leading-relaxed text-semibold">
          How many trend rows sit in each trend_status (improved, unchanged, baseline, changed, …).
        </p>
      </div>
      <div className="flex min-h-0 w-full flex-1 flex-col p-2 sm:p-3">
        {entries.length === 0 ? (
          <p className="flex min-h-[200px] flex-1 items-center justify-center text-center text-sm text-muted-foreground">
            No trend rows.
          </p>
        ) : (
          <div className="min-h-[200px] w-full flex-1">
            <Am5MiniChart detail={detail} height="100%" />
          </div>
        )}
      </div>
    </div>
  );
}
