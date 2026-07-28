import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, LayoutDashboard, Loader2, Minimize2, RefreshCw } from 'lucide-react';
import { AgingChartExpandDialog } from './AgingChartExpandShell';
import {
  ANALYTICS_CHART_EXPANDED_DIALOG_HEIGHT,
  ANALYTICS_CHART_EXPANDED_DIALOG_MIN_HEIGHT,
} from '../utils/agingAmChartScrollbar';
import ShadTooltip from '@/components/common/shadTooltipComponent';
import { Card } from '@/components/ui/card';
import { AmChart } from '@/pages/charts/components/AmChart';
import { getChartCustomizationFromChart } from '@/pages/charts/chartCustomizationsPayload';
import {
  BIG_NUMBER_CARD_RADIUS_CLASS,
  getChartRefreshIntervalSeconds,
  isAutoRefreshChart,
  useBigNumberStreamRefresh,
  type StreamChartDataSlice,
} from '@/pages/charts/components/charts/bigNumber';
import {
  DASHBOARD_BIG_NUMBER_WIDGET_CLASS,
  DASHBOARD_WIDGET_SHELL_CLASS,
  isDashboardBigNumberChart,
  resolveDashboardChartVizName,
} from '@/pages/Dashboards/utils/dashboardWidgetTabs';
import { DashboardChartContentSkeleton } from '@/pages/Dashboards/components/DashboardCanvasSkeleton';
import { PivotChart } from '@/pages/charts/components/charts/pivot';
import { LevelBreadcrumb } from '@/pages/charts/components/DrilldownBreadcrumb';
import {
  canShowDrilldownButton,
  canShowDrillThroughButton,
} from '@/pages/charts/utils/chartActionVisibility';
import type { AnalyticsChartCellProps, ChartDrilldownState } from '../types';
import { DashboardStaticBlockView } from '@/pages/Dashboards/components/DashboardStaticBlockView';
import {
  buildStaticBlockChartFromDashboard,
  getWidgetTitleSizeClass,
  isStaticBlockWithoutWidgetTitle,
  isStaticLayoutContentChartId,
  isStaticLayoutContentViz,
} from '@/pages/Dashboards/layoutConstants';
import { DashboardChartCardHeader } from '@/pages/Dashboards/components/DashboardChartCardHeader';
import { DashboardWidgetExpandedContent } from '@/pages/Dashboards/components/DashboardWidgetExpandedContent';
import { downloadChartImageFromContainer } from '@/pages/charts/utils/chartImageDownload';

function layoutAxisToPercent(valuePx: number, layoutWidth: number): string {
  if (layoutWidth <= 0) return `${valuePx}px`;
  return `${(valuePx / layoutWidth) * 100}%`;
}

function buildDashboardWidgetAbsoluteStyle(
  position: { x: number; y: number },
  size: { width: number; height: number },
  layoutWidth: number,
): React.CSSProperties {
  return {
    position: 'absolute',
    left: layoutAxisToPercent(position.x, layoutWidth),
    top: `${position.y}px`,
    width: layoutAxisToPercent(size.width, layoutWidth),
    height: `${size.height}px`,
  };
}

interface ChartHeaderProps {
  chartId: number;
  chartTitle: string;
  canDrilldownBack: boolean;
  drillState?: ChartDrilldownState[number];
  drilldownLevels?: any[];
  onDrilldownBack: (chartId: number, popCount?: number) => void;
  showDrilldownButton: boolean;
  showDrillThroughButton: boolean;
  isDrilldownArmed: boolean;
  isDrillThroughArmed: boolean;
  canExpand: boolean;
  onOpenDrilldown: (chartId: number) => void;
  onArmDrillThrough: (chartId: number) => void;
  onExpand: () => void;
  isBigNumberChart?: boolean;
  isTableOrPivotChart?: boolean;
}

const AnalyticsExpandMinimizeButton = memo(function AnalyticsExpandMinimizeButton({
  onMinimize,
}: {
  onMinimize: () => void;
}) {
  return (
    <ShadTooltip content="Minimize">
      <Button
        variant="ghost"
        size="icon"
        className="!h-6 !w-6"
        onClick={onMinimize}
        aria-label="Minimize"
      >
        <Minimize2 className="h-3.5 w-3.5" />
      </Button>
    </ShadTooltip>
  );
});

const AnalyticsChartHeader = memo(function AnalyticsChartHeader({
  chartId,
  chartTitle,
  canDrilldownBack,
  drillState,
  drilldownLevels,
  onDrilldownBack,
  showDrilldownButton,
  showDrillThroughButton,
  isDrilldownArmed,
  isDrillThroughArmed,
  canExpand,
  onOpenDrilldown,
  onArmDrillThrough,
  onExpand,
  isBigNumberChart,
  isTableOrPivotChart,
}: ChartHeaderProps) {
  const levelLabels = useMemo(() => {
    if (!Array.isArray(drilldownLevels) || drilldownLevels.length === 0) return null;
    return [
      'Base',
      ...drilldownLevels.map(
        (lev: any) => (lev.drill_filters?.[0]?.column || lev.drill_columns?.[0]?.column) ?? 'Level',
      ),
    ];
  }, [drilldownLevels]);

  const currentLevelIndex =
    levelLabels != null ? Math.min(drillState?.stack?.length ?? 0, levelLabels.length - 1) : 0;

  const handleDownload = useCallback(() => {
    const container = document.querySelector(`[data-chart-id="${chartId}"]`);
    downloadChartImageFromContainer(container, { chartTitle, isBigNumberChart });
  }, [chartId, chartTitle, isBigNumberChart]);

  return (
    <>
      <DashboardChartCardHeader
        title={chartTitle}
        showExpandButton={canExpand}
        showDownloadButton={!isBigNumberChart && !isTableOrPivotChart}
        expandDisabled={!canExpand}
        expandTooltip="Expand chart"
        onExpand={onExpand}
        onDownload={handleDownload}
        showDrilldownButton={showDrilldownButton}
        showDrillThroughButton={showDrillThroughButton}
        isDrilldownArmed={isDrilldownArmed}
        isDrillThroughArmed={isDrillThroughArmed}
        onDrilldown={() => onOpenDrilldown(chartId)}
        onDrillThrough={() => onArmDrillThrough(chartId)}
        trailing={
          canDrilldownBack && drillState ? (
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <ShadTooltip content="Back to previous view">
                <Button
                  variant="ghost"
                  size="icon"
                  className="!h-6 !w-6 flex-shrink-0"
                  onClick={() => onDrilldownBack(chartId)}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
              </ShadTooltip>
              <ShadTooltip content="Reset to default view">
                <Button
                  variant="ghost"
                  size="icon"
                  className="!h-6 !w-6 flex-shrink-0"
                  onClick={() => onDrilldownBack(chartId, drillState.stack.length)}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </ShadTooltip>
            </div>
          ) : null
        }
      />
      {levelLabels != null && (
        <div className="flex-shrink-0 px-2 pb-0.5">
          <LevelBreadcrumb levelLabels={levelLabels} currentLevelIndex={currentLevelIndex} className="text-xs" />
        </div>
      )}
    </>
  );
});

interface ChartBodyProps {
  chartId: number;
  isBigNumberChart: boolean;
  isLoading: boolean;
  isDrilldownLoading: boolean;
  vizName: string;
  chartData: any[];
  chartConfig: { name: string; uniqueId: string; icon: null };
  chartVisualizationConfig: any;
  chartDetails: any;
  chartCustomizationOptions: ReturnType<typeof getChartCustomizationFromChart>;
  rawResponse?: any;
  rawResponseFallback?: any;
  onInteraction?: (
    field: string,
    value: any,
    originalData?: any,
    eventDimensionFields?: string[],
    eventDrillFilters?: Array<{ column: string; value: any }>,
  ) => void;
  flowId?: string;
  stmtDateForApi: string;
  isStreamChart: boolean;
  streamRefreshSeconds: number;
  hasDrillState: boolean;
  streamDataRef: React.MutableRefObject<StreamChartDataSlice>;
  onStreamChartDataUpdate: (chartId: number, merged: StreamChartDataSlice) => void;
  /** Explicit pixel height for expand dialog (AmCharts needs a sized container). */
  chartHeight?: number;
  /** Fill parent dialog content area (preferred for expand dialog). */
  fillContainer?: boolean;
  renderKey?: string;
}

function areChartBodyPropsEqual(prev: ChartBodyProps, next: ChartBodyProps): boolean {
  return (
    prev.chartId === next.chartId &&
    prev.isBigNumberChart === next.isBigNumberChart &&
    prev.isLoading === next.isLoading &&
    prev.isDrilldownLoading === next.isDrilldownLoading &&
    prev.vizName === next.vizName &&
    prev.chartData === next.chartData &&
    prev.chartConfig === next.chartConfig &&
    prev.chartVisualizationConfig === next.chartVisualizationConfig &&
    prev.chartDetails === next.chartDetails &&
    prev.chartCustomizationOptions === next.chartCustomizationOptions &&
    prev.rawResponse === next.rawResponse &&
    prev.rawResponseFallback === next.rawResponseFallback &&
    prev.onInteraction === next.onInteraction &&
    prev.flowId === next.flowId &&
    prev.stmtDateForApi === next.stmtDateForApi &&
    prev.isStreamChart === next.isStreamChart &&
    prev.streamRefreshSeconds === next.streamRefreshSeconds &&
    prev.hasDrillState === next.hasDrillState &&
    prev.streamDataRef === next.streamDataRef &&
    prev.onStreamChartDataUpdate === next.onStreamChartDataUpdate &&
    prev.chartHeight === next.chartHeight &&
    prev.fillContainer === next.fillContainer &&
    prev.renderKey === next.renderKey
  );
}

const AnalyticsChartBody = memo(function AnalyticsChartBody({
  chartId,
  isBigNumberChart,
  isLoading,
  isDrilldownLoading,
  vizName,
  chartData,
  chartConfig,
  chartVisualizationConfig,
  chartDetails,
  chartCustomizationOptions,
  rawResponse,
  rawResponseFallback,
  onInteraction,
  flowId,
  stmtDateForApi,
  isStreamChart,
  streamRefreshSeconds,
  hasDrillState,
  streamDataRef,
  onStreamChartDataUpdate,
  chartHeight,
  fillContainer = false,
  renderKey,
}: ChartBodyProps) {
  useBigNumberStreamRefresh({
    enabled:
      isStreamChart &&
      streamRefreshSeconds > 0 &&
      !isLoading &&
      !isDrilldownLoading &&
      !hasDrillState &&
      !!stmtDateForApi &&
      (!!chartData.length || !!rawResponse),
    chartDetails,
    intervalSeconds: streamRefreshSeconds,
    stmtDate: stmtDateForApi,
    flowId,
    getCurrentData: () => streamDataRef.current,
    onDataUpdate: (merged) => onStreamChartDataUpdate(chartId, merged),
  });

  const surfaceClass = isBigNumberChart
    ? `bg-transparent p-0 overflow-hidden ${BIG_NUMBER_CARD_RADIUS_CLASS}`
    : 'bg-transparent p-0 overflow-hidden';
  const sizedForExpand = fillContainer || (chartHeight != null && chartHeight > 0);
  const containerStyle =
    !fillContainer && chartHeight != null && chartHeight > 0
      ? { height: chartHeight, minHeight: chartHeight }
      : undefined;
  const chartWrapClass = isBigNumberChart ? `overflow-hidden ${BIG_NUMBER_CARD_RADIUS_CLASS}` : 'overflow-hidden';
  const containerClass = sizedForExpand
    ? `h-full max-h-full min-h-0 w-full max-w-full box-border ${chartWrapClass} ${surfaceClass}`
    : `flex-1 min-h-0 box-border ${chartWrapClass} ${surfaceClass}`;

  return (
    <div className={containerClass} style={containerStyle}>
      {isLoading || isDrilldownLoading ? (
        <DashboardChartContentSkeleton />
      ) : chartData.length > 0 || rawResponse ? (
        <div className={`relative h-full min-h-0 w-full max-w-full ${chartWrapClass}`}>
          {vizName.includes('pivot') ? (
            <PivotChart
              key={renderKey}
              data={chartData}
              rawResponse={rawResponse}
              forceMock={false}
              mockResponse={undefined}
            />
          ) : (
            <AmChart
              key={renderKey}
              chart={chartConfig}
              data={chartData}
              config={chartVisualizationConfig}
              showLegend={true}
              onChartInteraction={onInteraction}
              rawResponse={rawResponse || rawResponseFallback}
              chartParams={chartDetails?.params}
              customizationOptions={chartCustomizationOptions}
              useSavedCustomizationOnly={true}
            />
          )}
        </div>
      ) : (
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <LayoutDashboard className="h-6 w-6 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No data available</p>
          </div>
        </div>
      )}
    </div>
  );
}, areChartBodyPropsEqual);

function AnalyticsChartCellInner({
  chartId,
  item,
  chartInfo,
  chartDataMap,
  chartDrilldownState,
  loadingCharts,
  drilldownLoadingChartId,
  containerWidth,
  onDrilldownBack,
  onChartDrilldown,
  onOpenDrilldown,
  onOpenDataPreview,
  onArmDrillThrough,
  isDrilldownArmed = false,
  isDrillThroughArmed = false,
  flowId,
  stmtDateForApi,
  onStreamChartDataUpdate,
}: AnalyticsChartCellProps) {
  const baseDataInfo = chartDataMap[chartId];
  const drillState = chartDrilldownState[chartId];
  const chartDataInfo = drillState
    ? { ...baseDataInfo, chartData: drillState.currentChartData, rawResponse: drillState.currentRawResponse }
    : baseDataInfo;
  const isLoading = loadingCharts.has(chartId);
  const isDrilldownLoading = drilldownLoadingChartId === chartId;
  const canDrilldownBack = (drillState?.stack?.length ?? 0) > 0;

  const position = { x: item.x, y: item.y };
  const size = { width: item.width, height: item.height };
  const widgetStyle = useMemo(
    () => buildDashboardWidgetAbsoluteStyle(position, size, containerWidth),
    [position.x, position.y, size.width, size.height, containerWidth],
  );

  const chartDetails = chartDataInfo?.chart ?? baseDataInfo?.chart;
  const resolvedStaticChart = useMemo(() => {
    if (chartDetails) return chartDetails;
    if (!isStaticLayoutContentChartId(chartInfo?.chart_id)) return null;
    return buildStaticBlockChartFromDashboard(chartInfo, {
      type: chartInfo?.visualization_name,
      title: chartInfo?.chart_name,
      params: chartInfo?.params,
    });
  }, [chartDetails, chartInfo]);
  const chartData = chartDataInfo?.chartData || [];
  const isStaticBlock = Boolean(chartDataInfo?.isStaticBlock || baseDataInfo?.isStaticBlock) ||
    isStaticLayoutContentViz(
      chartDetails?.visualization_name ||
      chartDetails?.chart_type ||
      chartInfo?.visualization_name ||
      resolvedStaticChart?.visualization_name,
    );
  const vizNameLower = resolveDashboardChartVizName(chartDetails, chartInfo);
  const isBigNumberChart = isDashboardBigNumberChart(chartDetails, chartInfo);
  const isTableOrPivotChart = vizNameLower.includes('table') || vizNameLower.includes('pivot');
  const vizName = vizNameLower;
  const drilldownLevels = chartDetails?.params?.drilldown_levels;
  const showDrilldownButton = canShowDrilldownButton(vizName, drilldownLevels);
  const showDrillThroughButton = canShowDrillThroughButton(vizName);

  const chartTitle = useMemo(
    () =>
      chartDetails?.chart_name ||
      chartDetails?.chartName ||
      chartInfo?.chart_name ||
      chartInfo?.chartName ||
      'Untitled Chart',
    [chartDetails?.chart_name, chartDetails?.chartName, chartInfo?.chart_name, chartInfo?.chartName],
  );

  const chartConfig = useMemo(() => {
    const vizType = String(chartDetails?.visualization_name || chartInfo?.visualization_name || '').trim();
    return {
      name: vizType || chartTitle,
      uniqueId: vizType,
      icon: null,
    };
  }, [chartTitle, chartDetails?.visualization_name, chartInfo?.visualization_name]);

  const chartVisualizationConfig = useMemo(
    () =>
      chartDetails?.params?.config || {
        x: chartDetails?.params?.dimensions?.[0]
          ? { name: chartDetails.params.dimensions[0].columns || chartDetails.params.dimensions[0] }
          : null,
        y: chartDetails?.params?.metrics?.[0]
          ? { name: chartDetails.params.metrics[0].columns || chartDetails.params.metrics[0] }
          : null,
        operator: chartDetails?.params?.metrics?.[0]?.operation || chartDetails?.params?.operator || null,
        color: chartDetails?.params?.color || null,
        column: chartDetails?.params?.column || null,
        row: chartDetails?.params?.row || null,
      },
    [chartDetails?.params],
  );

  const chartCustomizationOptions = useMemo(
    () => getChartCustomizationFromChart(chartDetails),
    [chartDetails],
  );

  const chartRenderKey = useMemo(() => {
    const dataLen = chartData?.length ?? chartDataInfo?.rawResponse?.data?.length ?? 0;
    const updatedAt = chartDetails?.updated_at ?? '';
    return `${chartId}-${updatedAt}-${vizName}-${dataLen}-${isLoading || isDrilldownLoading ? 'loading' : 'ready'}`;
  }, [
    chartId,
    chartDetails?.updated_at,
    vizName,
    chartData?.length,
    chartDataInfo?.rawResponse?.data?.length,
    isLoading,
    isDrilldownLoading,
  ]);

  const isStreamChart = isAutoRefreshChart(chartDetails);
  const streamRefreshSeconds = getChartRefreshIntervalSeconds(chartDetails);
  const streamDataRef = useRef<StreamChartDataSlice>({
    chartData,
    rawResponse: chartDataInfo?.rawResponse,
    chartColumns: chartDataInfo?.chartColumns,
  });
  streamDataRef.current = {
    chartData,
    rawResponse: chartDataInfo?.rawResponse,
    chartColumns: chartDataInfo?.chartColumns,
  };

  const rawResponseFallback = useMemo(() => {
    if (chartDataInfo?.rawResponse || !chartDataInfo?.chartColumns?.length) return chartDataInfo?.rawResponse;
    const cols = chartDataInfo.chartColumns || [];
    const paramsDims =
      chartDetails?.params?.dimensions && Array.isArray(chartDetails.params.dimensions)
        ? chartDetails.params.dimensions.map((d: any) => (typeof d === 'string' ? d : d.columns || d))
        : undefined;
    const hasAggregationPattern = (key: string) => {
      if (!key) return false;
      const upper = String(key).toUpperCase();
      return (
        /\((SUM|COUNT|AVG|MIN|MAX|STDDEV|VARIANCE)\)/i.test(upper) ||
        /^(SUM|COUNT|AVG|MIN|MAX|STDDEV|VARIANCE)\(/i.test(upper) ||
        /_(SUM|COUNT|AVG|MIN|MAX|STDDEV|VARIANCE)$/i.test(upper) ||
        /(SUM|COUNT|AVG|MIN|MAX|STDDEV|VARIANCE)$/i.test(upper)
      );
    };
    const derivedDims = paramsDims?.length ? paramsDims : cols.filter((c: any) => !hasAggregationPattern(String(c)));
    const resp: any = {
      data: (chartData || []).map((d: any) => d?.originalData ?? d),
      columns: cols,
      x_axis: (() => {
        const px = chartDetails?.params?.['X-axis'] ?? chartDetails?.params?.['x-axis'] ?? chartDetails?.params?.x_axis;
        if (Array.isArray(px) && px.length > 0) {
          const first = px[0];
          return (first && (first.columns || first.column || first.name)) || first?.alias || undefined;
        }
        if (typeof px === 'string') return px;
        if (px && typeof px === 'object') return px.columns || px.column || px.name || px.alias;
        return chartVisualizationConfig?.x?.name || undefined;
      })(),
    };
    if (derivedDims?.length) resp.dimensions = derivedDims.map((d: any) => (typeof d === 'string' ? d : d.columns || d));
    const paramsMetrics = chartDetails?.params?.metrics ?? chartDetails?.params?.metric ?? chartDetails?.params?.mtric;
    if (Array.isArray(paramsMetrics) && paramsMetrics.length > 0) resp.metrics = paramsMetrics;
    return resp;
  }, [chartDataInfo?.rawResponse, chartDataInfo?.chartColumns, chartDetails?.params, chartData, chartVisualizationConfig?.x?.name]);

  const onInteraction = useCallback(
    (
      field: string,
      value: any,
      originalData?: any,
      eventDimensionFields?: string[],
      eventDrillFilters?: Array<{ column: string; value: any }>,
    ) => onChartDrilldown(chartId, field, value, originalData, eventDimensionFields, eventDrillFilters),
    [chartId, onChartDrilldown],
  );
  const stableOnInteraction =
    showDrilldownButton || showDrillThroughButton ? onInteraction : undefined;
  const [isExpandOpen, setIsExpandOpen] = useState(false);
  const [expandChartReady, setExpandChartReady] = useState(false);
  const canExpand = !isLoading && !isDrilldownLoading && !isBigNumberChart && !isStaticBlock;
  const handleExpand = useCallback(() => setIsExpandOpen(true), []);
  const handleMinimize = useCallback(() => setIsExpandOpen(false), []);

  const levelLabels = useMemo(() => {
    if (!Array.isArray(drilldownLevels) || drilldownLevels.length === 0) return null;
    return [
      'Base',
      ...drilldownLevels.map(
        (lev: any) => (lev.drill_filters?.[0]?.column || lev.drill_columns?.[0]?.column) ?? 'Level',
      ),
    ];
  }, [drilldownLevels]);

  const currentLevelIndex =
    levelLabels != null ? Math.min(drillState?.stack?.length ?? 0, levelLabels.length - 1) : 0;

  const expandToolbar = useMemo(() => {
    if (!levelLabels?.length) return null;
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <LevelBreadcrumb levelLabels={levelLabels} currentLevelIndex={currentLevelIndex} className="text-xs" />
        {canDrilldownBack && drillState ? (
          <div className="flex items-center gap-0.5">
            <ShadTooltip content="Back to previous view">
              <Button
                variant="ghost"
                size="icon"
                className="!h-6 !w-6"
                onClick={() => onDrilldownBack(chartId)}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
            </ShadTooltip>
            <ShadTooltip content="Reset to default view">
              <Button
                variant="ghost"
                size="icon"
                className="!h-6 !w-6"
                onClick={() => onDrilldownBack(chartId, drillState.stack.length)}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </ShadTooltip>
          </div>
        ) : null}
      </div>
    );
  }, [
    levelLabels,
    currentLevelIndex,
    canDrilldownBack,
    drillState,
    chartId,
    onDrilldownBack,
  ]);

  const chartBodyProps = useMemo(
    (): ChartBodyProps => ({
      chartId,
      isBigNumberChart,
      isLoading,
      isDrilldownLoading,
      vizName,
      chartData,
      chartConfig,
      chartVisualizationConfig,
      chartDetails,
      chartCustomizationOptions,
      rawResponse: chartDataInfo?.rawResponse,
      rawResponseFallback,
      onInteraction: stableOnInteraction,
      flowId,
      stmtDateForApi,
      isStreamChart,
      streamRefreshSeconds,
      hasDrillState: !!drillState,
      streamDataRef,
      onStreamChartDataUpdate,
      renderKey: chartRenderKey,
    }),
    [
      chartId,
      isBigNumberChart,
      isLoading,
      isDrilldownLoading,
      vizName,
      chartData,
      chartConfig,
      chartVisualizationConfig,
      chartDetails,
      chartCustomizationOptions,
      chartDataInfo?.rawResponse,
      rawResponseFallback,
      stableOnInteraction,
      flowId,
      stmtDateForApi,
      isStreamChart,
      streamRefreshSeconds,
      drillState,
      streamDataRef,
      onStreamChartDataUpdate,
      chartRenderKey,
    ],
  );

  useEffect(() => {
    if (!isExpandOpen) {
      setExpandChartReady(false);
      return;
    }
    const id = window.setTimeout(() => setExpandChartReady(true), 300);
    return () => window.clearTimeout(id);
  }, [isExpandOpen, chartId]);

  if (isStaticBlock && resolvedStaticChart) {
    const staticChart = resolvedStaticChart;
    const staticVizName = (staticChart.visualization_name || staticChart.chart_type || '').toString().toLowerCase();
    const hideWidgetTitle = isStaticBlockWithoutWidgetTitle(staticVizName);
    const isTextBlock = staticVizName === 'text';
    const hideWidgetBorder = hideWidgetTitle || isTextBlock;
    const widgetTitleClass = getWidgetTitleSizeClass(staticChart.params);
    const staticTitle = staticChart.chart_name || chartTitle;

    return (
      <div
        data-chart-id={chartId}
        style={widgetStyle}
      >
        <Card
          className={`group h-full w-full min-h-0 min-w-0 !px-0 py-0 gap-0 flex flex-col ${DASHBOARD_WIDGET_SHELL_CLASS}`}
        >
          {!hideWidgetTitle && (
            <div
              className={`flex-shrink-0 grid grid-cols-[1fr] items-center ${
                isTextBlock ? 'px-1.5 py-0' : 'px-2 py-0.5 border-b border-border/50'
              }`}
            >
              <h4 className={`font-semibold truncate text-foreground text-center ${widgetTitleClass}`}>
                {staticTitle}
              </h4>
            </div>
          )}
          <div className={`flex-1 min-h-0 overflow-hidden ${hideWidgetBorder ? 'p-0' : 'bg-muted/15 p-0'}`}>
            <DashboardStaticBlockView chart={staticChart} />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div
      data-chart-id={chartId}
      style={widgetStyle}
    >
      <Card
        className={
          isBigNumberChart
            ? `group h-full w-full min-h-0 min-w-0 !px-0 py-0 gap-0 flex flex-col ${DASHBOARD_BIG_NUMBER_WIDGET_CLASS}`
            : `group h-full w-full min-h-0 min-w-0 !px-0 py-0 gap-0 flex flex-col ${DASHBOARD_WIDGET_SHELL_CLASS}`
        }
      >
        {!isBigNumberChart ? (
          <AnalyticsChartHeader
            chartId={chartId}
            chartTitle={chartTitle}
            canDrilldownBack={canDrilldownBack}
            drillState={drillState}
            drilldownLevels={drilldownLevels}
            onDrilldownBack={onDrilldownBack}
            showDrilldownButton={showDrilldownButton}
            showDrillThroughButton={showDrillThroughButton}
            isDrilldownArmed={isDrilldownArmed}
            isDrillThroughArmed={isDrillThroughArmed}
            canExpand={canExpand}
            onOpenDrilldown={onOpenDrilldown}
            onArmDrillThrough={onArmDrillThrough}
            onExpand={handleExpand}
            isBigNumberChart={isBigNumberChart}
            isTableOrPivotChart={isTableOrPivotChart}
          />
        ) : null}
        <AnalyticsChartBody {...chartBodyProps} />
      </Card>
      {canExpand ? (
        <AgingChartExpandDialog
          open={isExpandOpen}
          onOpenChange={setIsExpandOpen}
          title={chartTitle}
          subtitle={chartDetails?.description || chartDetails?.workflow_type || undefined}
          fillHeight
          dialogClassName="flex h-[88vh] min-h-0 max-h-[92vh] w-[min(98vw,1400px)] max-w-[98vw] flex-col gap-3 overflow-hidden p-4"
          headerTrailing={<AnalyticsExpandMinimizeButton onMinimize={handleMinimize} />}
        >
        {expandChartReady && chartDetails ? (
          <DashboardWidgetExpandedContent
            scopeKey={`analytics-expand-${chartId}-${isExpandOpen}`}
            chart={chartDetails}
            toolbar={expandToolbar}
            renderChartPanel={() => (
              <AnalyticsChartBody
                chartId={chartId}
                isBigNumberChart={isBigNumberChart}
                isLoading={false}
                isDrilldownLoading={false}
                vizName={vizName}
                chartData={chartData}
                chartConfig={chartConfig}
                chartVisualizationConfig={chartVisualizationConfig}
                chartDetails={chartDetails}
                chartCustomizationOptions={chartCustomizationOptions}
                rawResponse={chartDataInfo?.rawResponse}
                rawResponseFallback={rawResponseFallback}
                onInteraction={stableOnInteraction}
                flowId={flowId}
                stmtDateForApi={stmtDateForApi}
                isStreamChart={false}
                streamRefreshSeconds={streamRefreshSeconds}
                hasDrillState={!!drillState}
                streamDataRef={streamDataRef}
                onStreamChartDataUpdate={onStreamChartDataUpdate}
                fillContainer
                renderKey={`analytics-expand-chart-${chartId}-${isExpandOpen}`}
              />
            )}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
      </AgingChartExpandDialog>
      ) : null}
    </div>
  );
}

function areChartCellPropsEqual(prev: AnalyticsChartCellProps, next: AnalyticsChartCellProps): boolean {
  if (prev.chartId !== next.chartId) return false;
  const id = prev.chartId;
  if (prev.item.x !== next.item.x || prev.item.y !== next.item.y || prev.item.width !== next.item.width || prev.item.height !== next.item.height) return false;
  if (prev.containerWidth !== next.containerWidth) return false;
  if (prev.item.layoutItem?.i !== next.item.layoutItem?.i) return false;
  if (prev.chartInfo !== next.chartInfo) return false;
  if (prev.chartDataMap[id] !== next.chartDataMap[id]) return false;
  if (prev.chartDrilldownState[id] !== next.chartDrilldownState[id]) return false;
  if (prev.loadingCharts.has(id) !== next.loadingCharts.has(id)) return false;
  if ((prev.drilldownLoadingChartId === id) !== (next.drilldownLoadingChartId === id)) return false;
  if (prev.isDrilldownArmed !== next.isDrilldownArmed) return false;
  if (prev.isDrillThroughArmed !== next.isDrillThroughArmed) return false;
  if (prev.flowId !== next.flowId || prev.stmtDateForApi !== next.stmtDateForApi) return false;
  if (
    prev.onDrilldownBack !== next.onDrilldownBack ||
    prev.onChartDrilldown !== next.onChartDrilldown ||
    prev.onOpenDrilldown !== next.onOpenDrilldown ||
    prev.onOpenDataPreview !== next.onOpenDataPreview ||
    prev.onArmDrillThrough !== next.onArmDrillThrough ||
    prev.onStreamChartDataUpdate !== next.onStreamChartDataUpdate
  ) {
    return false;
  }
  return true;
}

export const AnalyticsChartCell = memo(AnalyticsChartCellInner, areChartCellPropsEqual);
