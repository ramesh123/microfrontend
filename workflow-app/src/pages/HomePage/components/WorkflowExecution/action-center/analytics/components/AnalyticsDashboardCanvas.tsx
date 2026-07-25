import { SignalHighIcon } from 'lucide-react';
import { getAnalyticsChartDataMapKey } from '@/pages/Dashboards/layoutConstants';
import { CHART_GAP } from '@/pages/Dashboards/dashboardConstants';
import {
  parseDashboardAppearance,
  resolveDashboardCanvasBackgroundStyle,
} from '@/pages/Dashboards/utils/dashboardAppearance';
import { DashboardCanvasSkeleton } from '@/pages/Dashboards/components/DashboardCanvasSkeleton';
import { isThemeDarkAppearance, useTheme } from '@/context/theme';
import type { AnalyticsChartLayoutItem } from '../types';
import type { AnalyticsViewProps } from '../viewTypes';
import { AnalyticsChartCell } from './AnalyticsChartCell';

export function AnalyticsDashboardCanvas({
  isDashboardCanvasLoading,
  activeDashboard,
  containerRef,
  containerWidth,
  computedLayout,
  computedLayoutItems,
  chartDataMap,
  chartDrilldownState,
  loadingCharts,
  drilldownLoadingChartId,
  handleDrilldownBack,
  stableChartDrilldown,
  handleOpenDrilldown,
  handleOpenDataPreview,
  handleArmDrillThrough,
  drilldownArmedChartId,
  drillThroughArmedChartId,
  flowId,
  stmtDateForApi,
  handleStreamChartDataUpdate,
}: AnalyticsViewProps) {
  const { theme } = useTheme();
  const isDarkDashboardTheme = isThemeDarkAppearance(theme);
  const dashboardBackgroundStyle = resolveDashboardCanvasBackgroundStyle(
    parseDashboardAppearance(activeDashboard),
    isDarkDashboardTheme,
  );

  const contentMinHeightPx = Math.max(computedLayout?.contentHeightRendered ?? 0, 600);
  const layoutWidth = computedLayout?.layoutWidth ?? containerWidth;

  return (
    <div ref={containerRef} className="flex flex-1 min-h-0 w-full flex-col overflow-hidden">
      {isDashboardCanvasLoading ? (
        <DashboardCanvasSkeleton
          className="w-full flex-1"
          backgroundStyle={dashboardBackgroundStyle}
        />
      ) : activeDashboard ? (
        <>
          {activeDashboard.row_count != null && (
            <div className="flex-shrink-0 px-2 py-1 text-xs text-muted-foreground">
              {activeDashboard.row_count} {activeDashboard.row_count === 1 ? 'row' : 'rows'}
            </div>
          )}
          <div
            data-dashboard-canvas-surface
            className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden overscroll-contain scrollbar-thin dashboard-canvas-scroll"
            style={{ contain: 'layout', transform: 'translateZ(0)', ...dashboardBackgroundStyle }}
          >
            <div
              className="relative min-h-full w-full max-w-full"
              style={{
                paddingLeft: CHART_GAP,
                paddingRight: CHART_GAP,
                boxSizing: 'border-box',
                minHeight: contentMinHeightPx,
              }}
            >
              {computedLayoutItems && computedLayoutItems.length > 0 && activeDashboard.charts ? (
                computedLayoutItems.map((item: any) => {
                  const layoutItem = item.layoutItem || {};
                  const chartInfo =
                    activeDashboard.charts?.find((c: any) => c.widget_i === layoutItem.i) ||
                    activeDashboard.charts?.[item.originalIndex];
                  if (!chartInfo) return null;
                  const widgetId = chartInfo.widget_i || layoutItem.i || item.widgetId || '';
                  const chartId = getAnalyticsChartDataMapKey(chartInfo.chart_id, widgetId);
                  return (
                    <AnalyticsChartCell
                      key={layoutItem.i || item.widgetId || `widget_${item.originalIndex + 1}`}
                      chartId={chartId}
                      item={item as AnalyticsChartLayoutItem}
                      chartInfo={chartInfo}
                      chartDataMap={chartDataMap}
                      chartDrilldownState={chartDrilldownState}
                      loadingCharts={loadingCharts}
                      drilldownLoadingChartId={drilldownLoadingChartId}
                      containerWidth={layoutWidth}
                      onDrilldownBack={handleDrilldownBack}
                      onChartDrilldown={stableChartDrilldown}
                      onOpenDrilldown={handleOpenDrilldown}
                      onOpenDataPreview={handleOpenDataPreview}
                      onArmDrillThrough={handleArmDrillThrough}
                      isDrilldownArmed={drilldownArmedChartId === chartId}
                      isDrillThroughArmed={drillThroughArmedChartId === chartId}
                      flowId={flowId}
                      stmtDateForApi={stmtDateForApi}
                      onStreamChartDataUpdate={handleStreamChartDataUpdate}
                    />
                  );
                })
              ) : (
                <div className="flex min-h-full items-center justify-center">
                  <p className="text-sm text-muted-foreground">No charts in this dashboard</p>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-1 min-h-0 items-center justify-center bg-background">
          <div className="border border-dashed border-border rounded-lg p-8 text-center w-full max-w-xl bg-card/40">
            <SignalHighIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold mb-2">Analytics</h2>
            <p className="text-sm text-muted-foreground mb-4">No dashboards available</p>
            <p className="text-xs text-muted-foreground">Create a dashboard from the Settings dialog to get started.</p>
          </div>
        </div>
      )}
    </div>
  );
}
