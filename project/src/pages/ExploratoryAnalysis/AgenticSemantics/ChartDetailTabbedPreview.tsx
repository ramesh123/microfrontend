import { useEffect, useState } from 'react';
import { dqTableTabMinHeightFallbackPx, useDqTableTabMinHeightStyle } from './DashboardChartCards';
import { BarChart3, FileCode2, Info, Table2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { type ChartDetail, type DashboardCardTab, isDataQualityChartDetail } from './chartTypes';
import { Am5MiniChart } from './Am5MiniChart';
import { ChartDataTable } from './ChartDataTable';
import { ChartDetailInfoTabContent } from './ChartDetailInfoTab';
import { CorrelationHeatmapScaleLegend } from './am5MiniChartCorrelationHeatmap';
import {
  DqTableHeatmap,
  chartDetailUsesDataTable,
  chartDetailUsesTableHeatmap,
  chartPayloadDisplayColumns,
} from './DqTableHeatmap';
import { DataTrustScorecardPanel, chartDetailUsesDataTrustScorecard } from './DataTrustScorecard';
import {
  ValidationRuleFailuresPanel,
  chartDetailUsesValidationRuleFailures,
} from './ValidationRuleFailuresPanel';
import { BsFiletypeSql } from 'react-icons/bs';

type PreviewVariant = 'default' | 'compact';

const chartHeights: Record<PreviewVariant, string> = {
  default: 'h-[400px] min-h-[320px]',
  compact: 'h-[400px] min-h-[200px]',
};

function dqPreviewAm5ChartHeight(variant: PreviewVariant): string {
  return variant === 'compact' ? 'min(280px, 42vh)' : 'min(380px, 52vh)';
}

/**
 * Chart + table + SQL tabs (same pattern as dashboard cards), for modals and sidebars.
 */
export function ChartDetailTabbedPreview({
  detail,
  variant = 'default',
  title,
  chartAreaClassName,
  drilldownEnabled,
  onDrilldownCategory,
  onChartContextMenu,
}: {
  detail: ChartDetail;
  variant?: PreviewVariant;
  /** Optional heading above tabs */
  title?: string;
  /** When set, replaces default chart panel height classes for this instance. */
  chartAreaClassName?: string;
  /** When true, bar/column/pie clicks emit the category for workspace drilldown. */
  drilldownEnabled?: boolean;
  onDrilldownCategory?: (categoryLabel: string) => void;
  /** Right-click on chart plot (handled inside Am5MiniChart with capture + preventDefault). */
  onChartContextMenu?: (e: React.MouseEvent) => void;
}) {
  const [activeTab, setActiveTab] = useState<DashboardCardTab>('chart');
  const dqPreview = isDataQualityChartDetail(detail);

  useEffect(() => {
    if (!dqPreview) return;
    if (activeTab === 'query' || activeTab === 'info') {
      setActiveTab('chart');
    }
  }, [dqPreview, activeTab, detail.chart_id]);

  const previewDqScopeKey = `${detail.chart_id ?? ''}-${variant}`;
  const { chartPaneRef: dqPreviewChartPaneRef, tableTabScrollCapPx: dqPreviewTableTabScrollCapPx } =
    useDqTableTabMinHeightStyle(
      dqPreview,
      activeTab,
      previewDqScopeKey,
      dqTableTabMinHeightFallbackPx({ compact: variant === 'compact' }),
    );

  const resolvedChartAreaClass =
    chartAreaClassName ??
    (dqPreview
      ? variant === 'compact'
        ? 'h-auto min-h-0 max-h-[min(56vh,520px)] overflow-y-auto'
        : 'h-auto min-h-0 max-h-[min(74vh,720px)] overflow-y-auto'
      : chartHeights[variant]);

  const dqScroll = dqPreview
    ? variant === 'compact'
      ? 'max-h-[min(400px,52vh)]'
      : 'max-h-[min(520px,62vh)]'
    : 'max-h-[min(360px,55vh)]';

  /** Heatmap includes legend below grid — cap scroll area slightly lower than plain table. */
  const dqScrollHeatmap = dqPreview
    ? variant === 'compact'
      ? 'max-h-[min(340px,46vh)]'
      : 'max-h-[min(440px,56vh)]'
    : dqScroll;

  return (
    <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
      {title ? (
        <p className="px-2 py-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground border-b border-border/50 bg-muted/20">
          {title}
        </p>
      ) : null}
      <Tabs
        key={detail.chart_id + (detail.title ?? '') + (detail.metric_name ?? '')}
        value={activeTab}
        onValueChange={(v) => {
          const tab = v as DashboardCardTab;
          if (dqPreview && (tab === 'query' || tab === 'info')) return;
          setActiveTab(tab);
        }}
        className="w-full gap-0"
      >
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 bg-muted/20 border-b border-border/40">
          <p className="text-sm font-medium truncate min-w-0 flex-1">
            {detail.title ?? detail.metric_name}
          </p>
          <TabsList className="h-7 w-auto shrink-0 rounded-md border border-border/50 bg-muted/30 p-0.5 gap-0.5">
            <TabsTrigger value="chart" className="gap-1 px-1.5 h-6" title="Chart">
              <BarChart3 className="size-3.5 shrink-0" aria-hidden />
              <span className="sr-only">Chart</span>
            </TabsTrigger>
            <TabsTrigger value="table" className="gap-1 px-1.5 h-6" title="Table">
              <Table2 className="size-3.5 shrink-0" aria-hidden />
              <span className="sr-only">Table</span>
            </TabsTrigger>
            {!dqPreview ? (
              <>
                <TabsTrigger value="query" className="gap-1 px-1.5 h-6" title="SQL">
                  <BsFiletypeSql className="size-3.5 shrink-0" aria-hidden />
                  <span className="sr-only">SQL</span>
                </TabsTrigger>
                <TabsTrigger value="info" className="gap-1 px-1.5 h-6" title="Insight & narrative">
                  <Info className="size-3.5 shrink-0" aria-hidden />
                  <span className="sr-only">Insight & narrative</span>
                </TabsTrigger>
              </>
            ) : null}
          </TabsList>
        </div>

        <TabsContent value="chart" className="mt-0 p-0 focus-visible:outline-none">
          <div
            ref={dqPreview ? dqPreviewChartPaneRef : undefined}
            className={`flex w-full flex-col ${resolvedChartAreaClass}`}
          >
            <div
              {...(dqPreview ? { 'data-agentic-chart-preview': '' } : {})}
              className={
                dqPreview
                  ? 'flex min-h-0 w-full flex-col overflow-x-hidden p-1.5'
                  : 'flex h-full min-h-0 flex-1 flex-col overflow-hidden p-1.5'
              }
            >
              {chartDetailUsesDataTable(detail) ? (
                <ChartDataTable
                  rows={detail.chart_data ?? []}
                  displayColumns={chartPayloadDisplayColumns(detail)}
                  shrinkWrap={dqPreview}
                  scrollHeightClass={dqScroll}
                />
              ) : chartDetailUsesTableHeatmap(detail) ? (
                <DqTableHeatmap
                  detail={detail}
                  compact={variant === 'compact'}
                  shrinkWrap={dqPreview}
                  scrollHeightClass={dqScrollHeatmap}
                />
              ) : chartDetailUsesValidationRuleFailures(detail) ? (
                <ValidationRuleFailuresPanel detail={detail} />
              ) : chartDetailUsesDataTrustScorecard(detail) ? (
                <DataTrustScorecardPanel
                  detail={detail}
                  onDrilldownCategory={onDrilldownCategory}
                />
              ) : (
                <Am5MiniChart
                  detail={detail}
                  height={dqPreview ? dqPreviewAm5ChartHeight(variant) : undefined}
                  drilldownEnabled={drilldownEnabled}
                  onDrilldownCategory={onDrilldownCategory}
                  onChartContextMenu={onChartContextMenu}
                />
              )}
            </div>
            <CorrelationHeatmapScaleLegend detail={detail} />
          </div>
        </TabsContent>

        <TabsContent
          value="table"
          className={cn(
            'mt-0 p-2 focus-visible:outline-none',
            !dqPreview && 'max-h-[min(280px,45vh)] overflow-auto',
          )}
        >
          <ChartDataTable
            rows={detail.chart_data ?? []}
            displayColumns={chartPayloadDisplayColumns(detail)}
            shrinkWrap
            scrollViewportMaxHeightPx={
              dqPreview && activeTab === 'table' && dqPreviewTableTabScrollCapPx != null
                ? dqPreviewTableTabScrollCapPx
                : undefined
            }
            scrollHeightClass={
              dqPreview && activeTab === 'table' ? '' : 'max-h-[min(280px,45vh)]'
            }
          />
        </TabsContent>

        {!dqPreview ? (
          <>
            <TabsContent value="query" className="mt-0 p-2 focus-visible:outline-none space-y-2">
              <div>
                <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
                  SQL
                </p>
                <pre className="text-[10px] font-mono bg-muted/30 p-2 rounded-md border border-border/40 overflow-x-auto whitespace-pre-wrap max-h-[min(220px,40vh)] overflow-y-auto">
                  {detail.sql?.trim() || 'No SQL available for this chart.'}
                </pre>
              </div>
            </TabsContent>

            <TabsContent value="info" className="mt-0 p-2 focus-visible:outline-none">
              <ChartDetailInfoTabContent detail={detail} compact />
            </TabsContent>
          </>
        ) : null}
      </Tabs>
    </div>
  );
}
