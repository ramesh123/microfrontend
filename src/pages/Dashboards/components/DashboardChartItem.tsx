import { useState, useEffect, useRef, useMemo, useCallback, memo, type CSSProperties } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { Loader2, LayoutDashboard, GripVertical, Minimize2 } from 'lucide-react';
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ShadTooltip from '@/components/ui/shadTooltipComponent';
import { AmChart } from '@/pages/charts/components/AmChart';
import { getChartCustomizationFromChart } from '@/pages/charts/chartCustomizationsPayload';
import { PivotChart } from '../../charts/components/charts/pivot';
import { DashboardChart, Chart } from '../types';
import { CHART_GAP, DEFAULT_NEW_WIDGET_WIDTH, DEFAULT_NEW_WIDGET_HEIGHT, MIN_BIG_NUMBER_WIDTH, MIN_BIG_NUMBER_HEIGHT } from '../dashboardConstants';
import { isStaticBlockWithoutWidgetTitle, isStaticLayoutContentViz, GRID_CELL_HEIGHT } from '../layoutConstants';
import { DashboardStaticBlockContent } from './DashboardStaticBlockContent';
import { isPieDonutOrRadiusPieChart } from '@/pages/charts/chartVizTypes';
import { extractDashboardChartResponseRows } from '../utils/dashboardUtils';
import { isDashboardBigNumberChart, DASHBOARD_BIG_NUMBER_WIDGET_CLASS, DASHBOARD_WIDGET_SHELL_CLASS } from '../utils/dashboardWidgetTabs';
import { DashboardChartCardHeader } from './DashboardChartCardHeader';
import { DashboardChartHeaderActions } from './DashboardChartHeaderActions';
import { DashboardChartContentSkeleton } from './DashboardCanvasSkeleton';
import { DashboardWidgetExpandedContent } from './DashboardWidgetExpandedContent';
import { AgingChartExpandDialog } from '@/pages/HomePage/components/WorkflowExecution/action-center/analytics/components/AgingChartExpandShell';
import {
  getChartRefreshIntervalSeconds,
  isAutoRefreshChart,
  useBigNumberStreamRefresh,
  type StreamChartDataSlice,
} from '@/pages/charts/components/charts/bigNumber';

interface DashboardChartItemProps {
  dashboardChart: DashboardChart;
  allCharts?: DashboardChart[];
  onRemove: (id: string) => void;
  onResize: (id: string, width: number, height: number, left?: number, top?: number, bypassSnap?: boolean) => void;
  formatVisualizationName: (name: string) => string;
  containerRef: React.RefObject<HTMLDivElement>;
  freeDragRef?: React.RefObject<boolean>;
  onStreamChartDataUpdate?: (dashboardChartId: string, merged: StreamChartDataSlice) => void;
  onUpdateChart?: (id: string, updatedParams: any) => void;
  onEditChart?: (id: string) => void;
  recordUndoSnapshot?: () => void;
  /** When true, parent react-grid-layout handles drag/resize. */
  gridMode?: boolean;
}

function panelEmbeddedChartsDataEqual(
  prevAll: DashboardChart[] | undefined,
  nextAll: DashboardChart[] | undefined,
  panelItems: unknown,
): boolean {
  if (prevAll === nextAll) return true;
  if (!Array.isArray(panelItems)) return true;
  const chartItems = panelItems.filter(
    (item: { type?: string; chartId?: number | string }) => item?.type === 'chart' && item.chartId != null,
  );
  if (chartItems.length === 0) return true;
  for (const item of chartItems) {
    const chartId = item.chartId;
    const prev = prevAll?.find((c) => c.chartId === chartId || c.chart.id === chartId);
    const next = nextAll?.find((c) => c.chartId === chartId || c.chart.id === chartId);
    if (prev === next) continue;
    if (!prev || !next) return false;
    if (
      prev.chartData !== next.chartData ||
      prev.rawResponse !== next.rawResponse ||
      prev.chartColumns !== next.chartColumns ||
      prev.isLoading !== next.isLoading ||
      prev.chart !== next.chart
    ) {
      return false;
    }
  }
  return true;
}

function dashboardChartItemPropsAreEqual(prev: DashboardChartItemProps, next: DashboardChartItemProps): boolean {
  if (prev.gridMode !== next.gridMode) return false;
  const viz = (prev.dashboardChart.chart.visualization_name || prev.dashboardChart.chart.chart_type || '').toString().toLowerCase();
  if (viz === 'panel' && !panelEmbeddedChartsDataEqual(prev.allCharts, next.allCharts, prev.dashboardChart.chart.params?.panel_items)) {
    return false;
  }
  if (prev.dashboardChart === next.dashboardChart &&
      prev.onRemove === next.onRemove &&
      prev.onResize === next.onResize &&
      prev.onStreamChartDataUpdate === next.onStreamChartDataUpdate &&
      prev.formatVisualizationName === next.formatVisualizationName &&
      prev.containerRef === next.containerRef &&
      prev.freeDragRef === next.freeDragRef) return true;
  const p = prev.dashboardChart;
  const n = next.dashboardChart;
  if (p.id !== n.id) return false;
  if (
    p.gridLayout?.x !== n.gridLayout?.x ||
    p.gridLayout?.y !== n.gridLayout?.y ||
    p.gridLayout?.w !== n.gridLayout?.w ||
    p.gridLayout?.h !== n.gridLayout?.h
  ) {
    return false;
  }
  if (p.position.x !== n.position.x || p.position.y !== n.position.y) return false;
  if (p.size.width !== n.size.width || p.size.height !== n.size.height) return false;
  if (p.isLoading !== n.isLoading) return false;
  if (p.chartData !== n.chartData) return false;
  if (p.chartColumns !== n.chartColumns) return false;
  if (p.rawResponse !== n.rawResponse) return false;
  return prev.onRemove === next.onRemove && prev.onResize === next.onResize &&
    prev.onStreamChartDataUpdate === next.onStreamChartDataUpdate &&
    prev.formatVisualizationName === next.formatVisualizationName &&
    prev.containerRef === next.containerRef && prev.freeDragRef === next.freeDragRef;
}

// Drag handle isolated so dnd-kit listener/attribute churn does not invalidate chart memo.
function ChartDragHandle({
  attributes,
  listeners,
}: {
  attributes: DraggableAttributes;
  listeners: SyntheticListenerMap;
}) {
  return (
    <ShadTooltip content="Drag to move chart" side="top">
      <button
        type="button"
        className="flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing touch-none"
        aria-label="Drag to move chart"
        onClick={(e) => e.preventDefault()}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" strokeWidth={2.5} />
      </button>
    </ShadTooltip>
  );
}

// Inner chart content (Card + chart). Memoized so when another chart is dragged,
// this content does not re-render and other charts do not blink.
interface DashboardChartContentProps {
  dashboardChart: DashboardChart;
  allCharts?: DashboardChart[];
  onRemove: (id: string) => void;
  onResize: (id: string, width: number, height: number, left?: number, top?: number, bypassSnap?: boolean) => void;
  formatVisualizationName: (name: string) => string;
  containerRef: React.RefObject<HTMLDivElement>;
  chartContainerRef: React.RefObject<HTMLDivElement | null>;
  onStreamChartDataUpdate?: (dashboardChartId: string, merged: StreamChartDataSlice) => void;
  onUpdateChart?: (id: string, updatedParams: any) => void;
  onEditChart?: (id: string) => void;
  isDragging?: boolean;
  recordUndoSnapshot?: () => void;
  gridMode?: boolean;
}

// Minimum height per chart type (allows tables/pivots to be taller)
const getMinHeightForChart = (chart: Chart | undefined): number => {
  try {
    if (!chart) return 300;
    const viz = (chart.visualization_name || chart.chart_type || '').toString().toLowerCase();

    // Check localStorage overrides first. Keys:
    // - `dashboard-minheight-<viz>` (viz normalized)
    // - `dashboard-minheight-default`
    try {
      const key = `dashboard-minheight-${viz.replace(/[^a-z0-9_-]/g, '_')}`;
      const raw = localStorage.getItem(key) || localStorage.getItem('dashboard-minheight-default');
      if (raw) {
        const parsed = parseInt(raw, 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    } catch (e) {
      // ignore storage errors
    }

    if (viz.includes('big') || viz.includes('big_number') || viz.includes('bignumber')) return MIN_BIG_NUMBER_HEIGHT;
    if (viz.includes('table') || viz.includes('pivot')) return DEFAULT_NEW_WIDGET_HEIGHT;
    if (viz === 'divider' || viz === 'text') return GRID_CELL_HEIGHT;
    if (viz === 'alert') return GRID_CELL_HEIGHT * 2;
    if (viz === 'image' || viz === 'panel') return GRID_CELL_HEIGHT * 3;
    if (viz.includes('stacked') || viz.includes('bar') || viz.includes('line') || viz.includes('area')) return 50;
    if (isPieDonutOrRadiusPieChart(viz) || viz.includes('gauge') || viz.includes('funnel') || viz.includes('number')) return 50;
    return 300; // default
  } catch (e) {
    return 300;
  }
};

// Minimum width per chart type (user-overridable via localStorage keys)
const getMinWidthForChart = (chart: Chart | undefined): number => {
  try {
    if (!chart) return 300;
    const viz = (chart.visualization_name || chart.chart_type || '').toString().toLowerCase();
    try {
      const key = `dashboard-minwidth-${viz.replace(/[^a-z0-9_-]/g, '_')}`;
      const raw = localStorage.getItem(key) || localStorage.getItem('dashboard-minwidth-default');
      if (raw) {
        const parsed = parseInt(raw, 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    } catch (e) {
      // ignore storage errors
    }

    if (viz.includes('table') || viz.includes('pivot')) return DEFAULT_NEW_WIDGET_WIDTH;
    if (viz.includes('big') && viz.includes('number')) return MIN_BIG_NUMBER_WIDTH;
    if (viz.includes('big_number') || viz.includes('bignumber')) return MIN_BIG_NUMBER_WIDTH;
    if (viz.includes('stacked') || viz.includes('bar') || viz.includes('line') || viz.includes('area')) return 50;
    if (isPieDonutOrRadiusPieChart(viz) || viz.includes('gauge') || viz.includes('funnel')) return 50;
    return 300;
  } catch (e) {
    return 300;
  }
};

function dashboardChartContentPropsAreEqual(
  prev: DashboardChartContentProps,
  next: DashboardChartContentProps,
): boolean {
  if (prev.isDragging !== next.isDragging) return false;
  if (prev.gridMode !== next.gridMode) return false;
  const viz = (prev.dashboardChart.chart.visualization_name || prev.dashboardChart.chart.chart_type || '').toString().toLowerCase();
  if (viz === 'panel' && !panelEmbeddedChartsDataEqual(prev.allCharts, next.allCharts, prev.dashboardChart.chart.params?.panel_items)) {
    return false;
  }
  if (prev.dashboardChart === next.dashboardChart &&
      prev.onRemove === next.onRemove &&
      prev.onResize === next.onResize &&
      prev.onStreamChartDataUpdate === next.onStreamChartDataUpdate &&
      prev.formatVisualizationName === next.formatVisualizationName &&
      prev.containerRef === next.containerRef &&
      prev.chartContainerRef === next.chartContainerRef) {
    return true;
  }
  const p = prev.dashboardChart;
  const n = next.dashboardChart;
  if (p.id !== n.id) return false;
  if (
    p.gridLayout?.x !== n.gridLayout?.x ||
    p.gridLayout?.y !== n.gridLayout?.y ||
    p.gridLayout?.w !== n.gridLayout?.w ||
    p.gridLayout?.h !== n.gridLayout?.h
  ) {
    return false;
  }
  if (p.position.x !== n.position.x || p.position.y !== n.position.y) return false;
  if (p.size.width !== n.size.width || p.size.height !== n.size.height) return false;
  if (p.isLoading !== n.isLoading) return false;
  if (p.chartData !== n.chartData) return false;
  if (p.chartColumns !== n.chartColumns) return false;
  if (p.rawResponse !== n.rawResponse) return false;
  if (p.chart !== n.chart) return false;
  return prev.onRemove === next.onRemove &&
    prev.onResize === next.onResize &&
    prev.formatVisualizationName === next.formatVisualizationName &&
    prev.containerRef === next.containerRef &&
    prev.chartContainerRef === next.chartContainerRef;
}

interface MemoizedChartInnerProps {
  isLoading: boolean;
  chartData: any[] | undefined;
  rawResponse: any;
  chartColumns: string[] | undefined;
  chart: Chart;
  isBigNumberViz: boolean;
  vizName: string;
  chartVisualizationConfig: any;
  chartCustomizationOptions: any;
  chartRenderKey: string;
}

function memoizedChartInnerPropsAreEqual(
  prev: MemoizedChartInnerProps,
  next: MemoizedChartInnerProps
): boolean {
  return (
    prev.isLoading === next.isLoading &&
    prev.chartData === next.chartData &&
    prev.rawResponse === next.rawResponse &&
    prev.chartColumns === next.chartColumns &&
    prev.chart === next.chart &&
    prev.isBigNumberViz === next.isBigNumberViz &&
    prev.vizName === next.vizName &&
    prev.chartVisualizationConfig === next.chartVisualizationConfig &&
    prev.chartCustomizationOptions === next.chartCustomizationOptions &&
    prev.chartRenderKey === next.chartRenderKey
  );
}

const MemoizedChartInner = memo(function MemoizedChartInner({
  isLoading,
  chartData,
  rawResponse,
  chartColumns,
  chart,
  isBigNumberViz,
  vizName,
  chartVisualizationConfig,
  chartCustomizationOptions,
  chartRenderKey,
}: MemoizedChartInnerProps) {
  const chartConfig = useMemo(() => {
    const vizType = String(chart.visualization_name || chart.chart_type || '').trim();
    return {
      name: vizType || chart.chart_name || 'Chart',
      uniqueId: vizType,
      icon: null,
    };
  }, [chart.chart_name, chart.visualization_name, chart.chart_type]);

  const rawResponseFallback = useMemo(() => {
    if (rawResponse || !chartColumns?.length) return undefined;
    const cols = chartColumns || [];
    const paramsDims =
      chart?.params?.dimensions && Array.isArray(chart.params.dimensions)
        ? chart.params.dimensions.map((d: any) => (typeof d === 'string' ? d : d.columns || d))
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
    const derivedDims =
      paramsDims && paramsDims.length > 0
        ? paramsDims
        : cols.filter((c: any) => !hasAggregationPattern(String(c)));
    const chartParams = chart.params || {};
    const resp: any = {
      data: (chartData || []).map((d: any) => d?.originalData ?? d),
      columns: cols,
      x_axis: ((): any => {
        const raw = chartParams['X-axis'] ?? chartParams['x-axis'];
        if (raw === undefined || raw === null) {
          return chartVisualizationConfig?.x?.name || undefined;
        }
        if (Array.isArray(raw) && raw.length > 0) {
          const first = raw[0];
          return typeof first === 'string'
            ? first
            : first.columns ?? first.name ?? first.field ?? undefined;
        }
        if (typeof raw === 'string') return raw;
        if (typeof raw === 'object') return raw.columns ?? raw.name ?? raw.field ?? undefined;
        return undefined;
      })(),
    };
    if (derivedDims && derivedDims.length > 0) {
      resp.dimensions = derivedDims.map((d: any) => (typeof d === 'string' ? d : d.columns || d));
    } else if (Array.isArray(chartParams.hierarchy) && chartParams.hierarchy.length > 0) {
      resp.dimensions = chartParams.hierarchy.map((d: any) =>
        typeof d === 'string' ? d : d.columns || d,
      );
    }
    const paramsMetrics = chartParams.metrics ?? chartParams.metric ?? chartParams.mtric;
    if (Array.isArray(paramsMetrics) && paramsMetrics.length > 0) resp.metrics = paramsMetrics;
    return resp;
  }, [rawResponse, chartColumns, chartData, chart?.params, chartVisualizationConfig?.x?.name]);

  const resolvedRawResponse = useMemo(() => {
    if (rawResponse) {
      const rows = extractDashboardChartResponseRows(rawResponse);
      if (rows.length === 0 && Array.isArray(rawResponse.data)) return rawResponse;
      if (rows.length === 0) return rawResponse;
      return {
        ...rawResponse,
        data: rows,
        columns: rawResponse.columns ?? chartColumns,
      };
    }
    return rawResponseFallback;
  }, [rawResponse, rawResponseFallback, chartColumns]);

  if (isLoading) {
    return <DashboardChartContentSkeleton />;
  }

  if (rawResponse || resolvedRawResponse || (chartData && chartData.length > 0)) {
    const isPieLikeViz = isPieDonutOrRadiusPieChart(vizName);
    const rawRows = resolvedRawResponse
      ? extractDashboardChartResponseRows(resolvedRawResponse)
      : rawResponse
        ? extractDashboardChartResponseRows(rawResponse)
        : [];
    const chartDataForRender = isBigNumberViz
      ? chartData && chartData.length > 0
        ? chartData
        : rawRows.length > 0
          ? rawRows
          : []
      : chartData && chartData.length > 0
        ? chartData
        : rawRows.length > 0
          ? rawRows
          : resolvedRawResponse?.data || rawResponse?.data || [];

    return (
      <div className={`h-full min-h-0 ${isBigNumberViz || isPieLikeViz ? 'w-full min-w-0 overflow-hidden' : ''}`}>
        {vizName.includes('pivot') ? (
          <PivotChart
            data={chartData}
            rawResponse={rawResponse}
            forceMock={false}
            mockResponse={undefined}
            config={chartCustomizationOptions as any}
          />
        ) : (
          <AmChart
            key={chartRenderKey}
            chart={chartConfig}
            data={chartDataForRender}
            config={chartVisualizationConfig}
            showLegend={true}
            customizationOptions={chartCustomizationOptions}
            useSavedCustomizationOnly={true}
            rawResponse={resolvedRawResponse}
            chartParams={chart?.params}
          />
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
          <LayoutDashboard className="h-6 w-6 text-muted-foreground/50" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">No data available</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Chart data could not be loaded</p>
      </div>
    </div>
  );
}, memoizedChartInnerPropsAreEqual);

const DashboardChartContent = memo(function DashboardChartContent({
  dashboardChart,
  allCharts = [],
  onRemove,
  onResize,
  formatVisualizationName,
  containerRef,
  chartContainerRef,
  onStreamChartDataUpdate,
  isDragging,
  onUpdateChart,
  onEditChart,
  recordUndoSnapshot,
  gridMode = false,
}: DashboardChartContentProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isAnalyticsStudio = location.pathname.startsWith('/analytic-studio');
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<'n' | 's' | 'e' | 'w'>('e');
  const resizeStartRef = useRef<{
    width: number;
    height: number;
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const pendingResizeRef = useRef<{
    width: number;
    height: number;
    left: number;
    top: number;
  } | null>(null);

  const [isExpandOpen, setIsExpandOpen] = useState(false);
  const [expandReady, setExpandReady] = useState(false);

  const vizName = (dashboardChart.chart.visualization_name || dashboardChart.chart.chart_type || '').toString().toLowerCase();
  const isBigNumberViz = isDashboardBigNumberChart(dashboardChart.chart);
  const chartTitle = dashboardChart.chart.chart_name || 'Untitled Chart';
  const hideWidgetTitle = isStaticBlockWithoutWidgetTitle(vizName) || isBigNumberViz;

  const chartCustomizationOptions = useMemo(
    () => getChartCustomizationFromChart(dashboardChart.chart),
    [dashboardChart.chart],
  );

  const chartRenderKey = useMemo(() => {
    const chart = dashboardChart.chart;
    const dataLen = dashboardChart.chartData?.length ?? dashboardChart.rawResponse?.data?.length ?? 0;
    const metrics = chart.params?.metrics ?? chart.params?.metric ?? chart.params?.mtric;
    const metricsKey = metrics ? JSON.stringify(metrics) : '';
    const customKey = chart.customization ? JSON.stringify(chart.customization) : '';
    const paramsKey =
      chart.params && isPieDonutOrRadiusPieChart(vizName)
        ? JSON.stringify({
            colorScheme: chart.params.colorScheme,
            showLegend: chart.params.showLegend,
            outerRadius: chart.params.outerRadius,
          })
        : '';
    const iconPosKey =
      chart.params?.iconPositionX != null || chart.params?.iconPositionY != null
        ? `${chart.params?.iconPositionX ?? ''}-${chart.params?.iconPositionY ?? ''}`
        : '';
    return `${chart.id}-${chart.updated_at ?? ''}-${metricsKey}-${customKey}-${paramsKey}-${iconPosKey}-${vizName}-${dataLen}-${dashboardChart.isLoading ? 'loading' : 'ready'}`;
  }, [
    dashboardChart.chart,
    dashboardChart.chartData?.length,
    dashboardChart.rawResponse?.data?.length,
    dashboardChart.isLoading,
    vizName,
  ]);

  const isStaticContentBlock = isStaticBlockWithoutWidgetTitle(vizName);
  const canExpandWidget =
    !isBigNumberViz && !isStaticContentBlock && !dashboardChart.isLoading && !isStaticLayoutContentViz(vizName);

  useEffect(() => {
    if (!isExpandOpen) {
      setExpandReady(false);
      return;
    }
    const id = window.setTimeout(() => setExpandReady(true), 300);
    return () => window.clearTimeout(id);
  }, [isExpandOpen, dashboardChart.id]);

  const isStreamChart = isAutoRefreshChart(dashboardChart.chart);
  const streamRefreshSeconds = getChartRefreshIntervalSeconds(dashboardChart.chart);
  const streamDataRef = useRef<StreamChartDataSlice>({
    chartData: dashboardChart.chartData,
    rawResponse: dashboardChart.rawResponse,
    chartColumns: dashboardChart.chartColumns,
  });
  streamDataRef.current = {
    chartData: dashboardChart.chartData,
    rawResponse: dashboardChart.rawResponse,
    chartColumns: dashboardChart.chartColumns,
  };

  useBigNumberStreamRefresh({
    enabled:
      isStreamChart &&
      streamRefreshSeconds > 0 &&
      !dashboardChart.isLoading &&
      !!(dashboardChart.chartData?.length || dashboardChart.rawResponse),
    chartDetails: dashboardChart.chart,
    intervalSeconds: streamRefreshSeconds,
    stmtDate: dashboardChart.chart.stmt_date || '',
    flowId: dashboardChart.chart.flow_id,
    getCurrentData: () => streamDataRef.current,
    onDataUpdate: (merged) => onStreamChartDataUpdate?.(dashboardChart.id, merged),
  });

  const chartVisualizationConfig = useMemo(() => {
    const params = dashboardChart.chart.params;
    if (params?.config) return params.config;
    return {
      x: params?.dimensions?.[0] ? { name: params.dimensions[0].columns || params.dimensions[0] } : null,
      y: params?.metrics?.[0] ? { name: params.metrics[0].columns || params.metrics[0] } : null,
      operator: params?.metrics?.[0]?.operation || params?.operator || null,
      color: params?.color || null,
      column: params?.column || null,
      row: params?.row || null,
    };
  }, [dashboardChart.chart.params, dashboardChart.chart.chart_name, dashboardChart.chart.visualization_name]);

  const handleEditChart = () => {
    if (onEditChart) {
      onEditChart(dashboardChart.id);
      return;
    }
    const chartId = dashboardChart.chartId ?? dashboardChart.chart.id;
    if (isAnalyticsStudio && chartId) {
      navigate(`/analytic-studio/charts/${chartId}/edit`);
      return;
    }
    const flowId = dashboardChart.chart.flow_id;
    if (flowId && chartId) {
      navigate(`/reconciliation/operations/${flowId}/charts/${chartId}/edit`);
    } else if (chartId) {
      navigate(`/charts/formulator/edit/${chartId}`);
    }
  };

  const builderHeaderActions = (
    <DashboardChartHeaderActions
      chartTitle={chartTitle}
      onEdit={handleEditChart}
      onExpand={gridMode && canExpandWidget ? () => setIsExpandOpen(true) : undefined}
      expandDisabled={!canExpandWidget}
      expandTooltip="Expand chart"
      onRemove={() => onRemove(dashboardChart.id)}
    />
  );

  const chartPanel = (
    <MemoizedChartInner
      key={chartRenderKey}
      isLoading={dashboardChart.isLoading}
      chartData={dashboardChart.chartData}
      rawResponse={dashboardChart.rawResponse}
      chartColumns={dashboardChart.chartColumns}
      chart={dashboardChart.chart}
      isBigNumberViz={isBigNumberViz}
      vizName={vizName}
      chartVisualizationConfig={chartVisualizationConfig}
      chartCustomizationOptions={chartCustomizationOptions}
      chartRenderKey={chartRenderKey}
    />
  );

  const widgetPanel = chartPanel;

  const headerExpandProps = gridMode
    ? {}
    : {
        showExpandButton: canExpandWidget,
        expandDisabled: !canExpandWidget,
        onExpand: () => setIsExpandOpen(true),
        expandTooltip: 'Expand chart',
      };

  const builderCardHeader = isBigNumberViz ? null : gridMode ? (
    <div className="dashboard-chart-drag-handle relative shrink-0 cursor-grab touch-none active:cursor-grabbing">
      <DashboardChartCardHeader
        title={chartTitle}
        hideTitle={hideWidgetTitle}
        showDownloadButton={false}
        showDrilldownButton={false}
        showDrillThroughButton={false}
      />
    </div>
  ) : (
    <DashboardChartCardHeader
      title={chartTitle}
      hideTitle={hideWidgetTitle}
      showDownloadButton={false}
      showDrilldownButton={false}
      showDrillThroughButton={false}
      trailing={builderHeaderActions}
      {...headerExpandProps}
    />
  );

  const handleResizeStart = (e: React.MouseEvent, direction: 'n' | 's' | 'e' | 'w') => {
    e.preventDefault();
    e.stopPropagation();
    if (chartContainerRef.current) {
      resizeStartRef.current = {
        width: dashboardChart.size.width,
        height: dashboardChart.size.height,
        x: e.clientX,
        y: e.clientY,
        left: dashboardChart.position.x,
        top: dashboardChart.position.y,
      };
      setResizeDirection(direction);
      setIsResizing(true);
    }
  };

  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeStartRef.current || !containerRef.current) return;
      const canvasContainer = containerRef.current.parentElement;
      if (!canvasContainer) return;
      const containerRect = canvasContainer.getBoundingClientRect();
      const containerPadding = 12;
      const maxWidth = containerRect.width - containerPadding * 2;
      const maxHeight = containerRect.height - containerPadding * 2;
      const deltaX = e.clientX - resizeStartRef.current.x;
      const deltaY = e.clientY - resizeStartRef.current.y;
      let newWidth = resizeStartRef.current.width;
      let newHeight = resizeStartRef.current.height;
      let newLeft = resizeStartRef.current.left;
      let newTop = resizeStartRef.current.top;
      const minH = getMinHeightForChart(dashboardChart.chart);
      const minW = getMinWidthForChart(dashboardChart.chart);

      // Get other charts to detect collision and prevent overlaps
      const otherCharts = allCharts.filter((c) => c.id !== dashboardChart.id);

      switch (resizeDirection) {
        case 'e': {
          let maxAllowedRight = maxWidth;
          for (const other of otherCharts) {
            const verticalOverlap = !(newTop + newHeight <= other.position.y || other.position.y + other.size.height <= newTop);
            if (verticalOverlap && other.position.x > newLeft) {
              maxAllowedRight = Math.min(maxAllowedRight, other.position.x - CHART_GAP);
            }
          }
          newWidth = Math.max(minW, Math.min(maxAllowedRight - newLeft, resizeStartRef.current.width + deltaX));
          break;
        }
        case 'w': {
          const rightEdge = resizeStartRef.current.left + resizeStartRef.current.width;
          let minAllowedLeft = 0;
          for (const other of otherCharts) {
            const verticalOverlap = !(newTop + newHeight <= other.position.y || other.position.y + other.size.height <= newTop);
            if (verticalOverlap && other.position.x + other.size.width <= resizeStartRef.current.left) {
              minAllowedLeft = Math.max(minAllowedLeft, other.position.x + other.size.width + CHART_GAP);
            }
          }
          const tentativeLeft = Math.max(minAllowedLeft, resizeStartRef.current.left + deltaX);
          newWidth = Math.max(minW, rightEdge - tentativeLeft);
          newLeft = rightEdge - newWidth;
          break;
        }
        case 's': {
          newHeight = Math.max(minH, resizeStartRef.current.height + deltaY);
          break;
        }
        case 'n': {
          const tentativeHeight = resizeStartRef.current.height - deltaY;
          newHeight = Math.max(minH, tentativeHeight);
          newTop = resizeStartRef.current.top + (resizeStartRef.current.height - newHeight);
          if (newTop < 0) {
            newTop = 0;
            newHeight = resizeStartRef.current.height + resizeStartRef.current.top;
          }
          break;
        }
      }

      if (newLeft + newWidth > maxWidth) newWidth = maxWidth - newLeft;
      if (newLeft < 0) newLeft = 0;
      if (newTop < 0) newTop = 0;

      pendingResizeRef.current = { width: newWidth, height: newHeight, left: newLeft, top: newTop };
      const node = chartContainerRef.current;
      if (node) {
        node.style.left = `${newLeft}px`;
        node.style.top = `${newTop}px`;
        node.style.width = `${newWidth}px`;
        node.style.height = `${newHeight}px`;
        node.style.minWidth = `${newWidth}px`;
        node.style.maxWidth = `${newWidth}px`;
      }
    };
    const handleMouseUp = () => {
      const pending = pendingResizeRef.current;
      if (pending) {
        onResize(dashboardChart.id, pending.width, pending.height, pending.left, pending.top, true);
      }
      pendingResizeRef.current = null;
      setIsResizing(false);
      resizeStartRef.current = null;
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizeDirection, dashboardChart.id, onResize, containerRef, dashboardChart.chart, dashboardChart.position, allCharts]);

  return (
    <>
    <Card
      className={`relative h-full w-full min-h-0 min-w-0 px-0 py-0 gap-0 flex flex-col ${
        isBigNumberViz ? DASHBOARD_BIG_NUMBER_WIDGET_CLASS : DASHBOARD_WIDGET_SHELL_CLASS
      } ${
        isResizing ? '' : 'transition-all duration-200'
      } ${
        isDragging ? 'scale-[1.02] rotate-[0.5deg] ring-4 ring-primary/20' : ''
      }`}
    >

      {gridMode && isBigNumberViz && (
        <div
          className="dashboard-chart-drag-handle absolute inset-x-0 top-0 z-[5] h-7 cursor-grab touch-none active:cursor-grabbing"
          aria-hidden
        />
      )}

      {gridMode && (
        <div
          className="dashboard-chart-no-drag pointer-events-none absolute right-0.5 top-0.5 z-[200] flex items-center rounded-md bg-background/95 px-0.5 shadow-sm ring-1 ring-border/40 opacity-0 transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto"
          data-dashboard-chart-action
        >
          {builderHeaderActions}
        </div>
      )}

      <div
        className={`flex-1 flex flex-col p-0 min-w-0 ${
          hideWidgetTitle
            ? `w-full bg-transparent ${isBigNumberViz ? 'overflow-hidden !rounded-[12px]' : 'rounded-lg'}`
            : 'bg-transparent overflow-hidden rounded-lg'
        }`}
      >
        {isStaticLayoutContentViz(vizName) ? (
          isStaticContentBlock ? (
            <div className="group/static relative h-full min-h-0 w-full overflow-hidden">
              <div className="dashboard-chart-no-drag pointer-events-none absolute right-1 top-1 z-20 flex items-center rounded-md bg-background/90 px-0.5 shadow-sm ring-1 ring-border/40 opacity-0 transition-opacity group-hover/static:opacity-100 group-hover/static:pointer-events-auto">
                {builderHeaderActions}
              </div>
              <DashboardStaticBlockContent
                chart={dashboardChart.chart}
                dashboardChartId={dashboardChart.id}
                vizName={vizName}
                onUpdateChart={onUpdateChart}
                allCharts={allCharts}
              />
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              {builderCardHeader}
              <div className="min-h-0 flex-1 w-full overflow-hidden">
                <DashboardStaticBlockContent
                  chart={dashboardChart.chart}
                  dashboardChartId={dashboardChart.id}
                  vizName={vizName}
                  onUpdateChart={onUpdateChart}
                  allCharts={allCharts}
                />
              </div>
            </div>
          )
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            {builderCardHeader}
            <div
              className={`group relative min-h-0 flex-1 w-full ${
                isBigNumberViz
                  ? 'overflow-hidden !rounded-[12px] p-0'
                  : 'overflow-hidden p-0'
              }`}
              data-chart-id={dashboardChart.id}
            >
              {widgetPanel}
            </div>
          </div>
        )}
      </div>
      {!gridMode && (
        <>
      <div onMouseDown={(e) => handleResizeStart(e, 'n')} className="absolute top-0 left-0 w-full h-3 cursor-ns-resize opacity-0 hover:opacity-100 transition-opacity z-20" style={{ touchAction: 'none' }}>
        <div className="absolute top-1 left-1/2 -translate-x-1/2 h-1 w-20 bg-primary/40 rounded-full"></div>
      </div>
      <div
        onMouseDown={(e) => handleResizeStart(e, 's')}
        className={`absolute bottom-0 left-0 w-full h-3 cursor-ns-resize transition-opacity z-20 ${isResizing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        style={{ touchAction: 'none' }}
      >
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-20 bg-primary/40 rounded-full" />
      </div>
      <div
        onMouseDown={(e) => handleResizeStart(e, 'w')}
        className={`absolute top-0 left-0 w-3 h-full cursor-ew-resize transition-opacity z-20 ${isResizing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        style={{ touchAction: 'none' }}
      >
        <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-20 bg-primary/40 rounded-full" />
      </div>
      <div onMouseDown={(e) => handleResizeStart(e, 'e')} className="absolute top-0 right-0 w-3 h-full cursor-ew-resize opacity-0 hover:opacity-100 transition-opacity z-20" style={{ touchAction: 'none' }}>
        <div className="absolute right-1 top-1/2 -translate-y-1/2 w-1 h-20 bg-primary/40 rounded-full"></div>
      </div>
        </>
      )}
    </Card>
    {canExpandWidget ? (
      <AgingChartExpandDialog
        open={isExpandOpen}
        onOpenChange={setIsExpandOpen}
        title={chartTitle}
        subtitle={dashboardChart.chart.description || dashboardChart.chart.workflow_type || undefined}
        fillHeight
        dialogClassName="flex h-[88vh] min-h-0 max-h-[92vh] w-[min(98vw,1400px)] max-w-[98vw] flex-col gap-3 overflow-hidden p-4"
        headerTrailing={
          <Button
            variant="ghost"
            size="icon"
            className="!h-6 !w-6"
            onClick={() => setIsExpandOpen(false)}
            aria-label="Minimize"
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </Button>
        }
      >
        {expandReady ? (
          <DashboardWidgetExpandedContent
            scopeKey={`${dashboardChart.id}-${isExpandOpen}`}
            chart={dashboardChart.chart}
            renderChartPanel={() => (
              <div className="h-full min-h-0 w-full overflow-hidden rounded-md p-0">
                <MemoizedChartInner
                  key={`expand-chart-${chartRenderKey}`}
                  isLoading={dashboardChart.isLoading}
                  chartData={dashboardChart.chartData}
                  rawResponse={dashboardChart.rawResponse}
                  chartColumns={dashboardChart.chartColumns}
                  chart={dashboardChart.chart}
                  isBigNumberViz={isBigNumberViz}
                  vizName={vizName}
                  chartVisualizationConfig={chartVisualizationConfig}
                  chartCustomizationOptions={chartCustomizationOptions}
                  chartRenderKey={chartRenderKey}
                />
              </div>
            )}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
      </AgingChartExpandDialog>
    ) : null}
    </>
  );
}, dashboardChartContentPropsAreEqual);

export const DashboardChartItem = memo(function DashboardChartItem({
  dashboardChart,
  allCharts = [],
  onRemove,
  onResize,
  formatVisualizationName,
  containerRef,
  freeDragRef,
  onStreamChartDataUpdate,
  onUpdateChart,
  onEditChart,
  recordUndoSnapshot,
  gridMode = false,
}: DashboardChartItemProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({
    id: dashboardChart.id,
    disabled: gridMode,
  });

  if (gridMode) {
    return (
      <div ref={chartContainerRef} className="relative group h-full w-full min-h-0 min-w-0">
        <DashboardChartContent
          dashboardChart={dashboardChart}
          allCharts={allCharts}
          onRemove={onRemove}
          onResize={onResize}
          formatVisualizationName={formatVisualizationName}
          containerRef={containerRef}
          chartContainerRef={chartContainerRef}
          onStreamChartDataUpdate={onStreamChartDataUpdate}
          isDragging={false}
          gridMode
          onUpdateChart={onUpdateChart}
          onEditChart={onEditChart}
          recordUndoSnapshot={recordUndoSnapshot}
        />
      </div>
    );
  }

  const rawTx = transform?.x || 0;
  const rawTy = transform?.y || 0;
  // Allow dragging up to canvas top (y = 0)
  const clampedTy = Math.max(rawTy, -dashboardChart.position.y);

  const style: CSSProperties = {
    position: 'absolute',
    left: dashboardChart.position.x,
    top: dashboardChart.position.y,
    transform: `translate3d(${rawTx}px, ${clampedTy}px, 0)`,
    transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    opacity: isDragging ? 0.85 : 1,
    width: dashboardChart.size.width,
    height: dashboardChart.size.height,
    minWidth: dashboardChart.size.width,
    maxWidth: dashboardChart.size.width,
    flexShrink: 0,
    zIndex: isDragging ? 100 : 10,
  };

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        (chartContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      style={style}
      className="relative group"
    >
      <DashboardChartContent
        dashboardChart={dashboardChart}
        allCharts={allCharts}
        onRemove={onRemove}
        onResize={onResize}
        formatVisualizationName={formatVisualizationName}
        containerRef={containerRef}
        chartContainerRef={chartContainerRef}
        onStreamChartDataUpdate={onStreamChartDataUpdate}
        isDragging={isDragging}
        onUpdateChart={onUpdateChart}
        onEditChart={onEditChart}
        recordUndoSnapshot={recordUndoSnapshot}
        gridMode={gridMode}
      />
      <div className="pointer-events-none absolute left-1 top-0 z-30">
        <div className="pointer-events-auto">
          <ChartDragHandle attributes={attributes} listeners={listeners} />
        </div>
      </div>
    </div>
  );
}, dashboardChartItemPropsAreEqual);
