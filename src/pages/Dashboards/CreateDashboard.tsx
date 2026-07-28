import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback, memo } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { Search, ArrowLeft, Loader2, Sparkles, ChevronLeft, ChevronRight, RefreshCw, Undo2, Redo2, ChevronDown, ChevronUp, Upload, Trash2, Check, ChevronsUpDown, X, Pencil, BarChart3, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { DEFAULT_CONTAINER_WIDTH, DEFAULT_CONTAINER_HEIGHT } from '@/pages/Dashboards/layoutConstants';
import useFlowStore from '@/stores/flowStore';
import { getWorkflowByIdApi } from '@/controllers/API';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import {
  isReconWorkflowFlowIdResolved,
  workflowMatchesRouteId,
} from './utils/reconWorkflowHydration';

// Import types
import { Chart, DashboardChart } from './types';

// Import API & utilities
import { createChart, getChartById } from '@/pages/Visualization/API/chartsApi';
import { transformDashboardChartRows, extractDashboardChartResponseRows } from './utils/dashboardUtils';
import { buildDashboardCreateChartPayload } from './utils/buildDashboardCreateChartPayload';
import {
  refreshAllDashboardChartWidgets,
} from './utils/refreshDashboardChartData';
import { applyPendingChartCustomization } from './utils/applyPendingChartCustomization';

// Import components
import { DroppableCanvas } from './components/DroppableCanvas';
import { DashboardGridCanvas } from './components/DashboardGridCanvas';
import { DraggableChartItem } from './components/DraggableChartItem';
import { DashboardEmbeddedChartEditor } from './components/DashboardEmbeddedChartEditor';
import { DashboardCanvasSkeleton } from './components/DashboardCanvasSkeleton';
import { DashboardSidebarCollapsedRail } from './components/DashboardSidebarCollapsedRail';
import { DASHBOARD_SIDEBAR_COLLAPSED_WIDTH_PX } from './dashboardConstants';
import type { StreamChartDataSlice } from '@/pages/charts/components/charts/bigNumber';

// Import utilities
import {
  formatVisualizationName,
  getRelativeTime,
} from './utils/dashboardUtils';

// Import hooks
import { useDashboardData } from './hooks/useDashboardData';
import { useDashboardSave } from './hooks/useDashboardSave';
import { useDragHandlers } from './hooks/useDragHandlers';
import { useDashboardUndo } from './hooks/useDashboardUndo';
import { GRID_COLS, GRID_CELL_HEIGHT, isStaticBlockWithoutWidgetTitle, getPanelChartSnapshot, shouldShowWidgetTitleCustomizer, shouldApplyCustomizerWidgetTitle, reflowPanelChartItems, applySmartPanelLayoutsToItems, resolvePanelChartVizFromSources } from './layoutConstants';
import { STATIC_LAYOUT_ITEMS, STATIC_CONTENT_ITEMS, DEFAULT_DIVIDER_PARAMS } from './staticDashboardBlocks';

import {
  syncDashboardChartsPixelsForWidth,
  getGridRowCountFromCharts,
  getGridContentHeightFromCharts,
  getDashboardCanvasAvailableWidth,
  getDashboardLayoutWidth,
  DASHBOARD_CANVAS_HORIZONTAL_PADDING,
  restoreDashboardChartLayoutFromSavedItem,
  inferSavedGridCols,
  getPanelRequiredGridHeight,
  pixelsToGridUnits,
  gridUnitsToPixels,
} from './utils/gridLayoutUtils';
import {
  cloneDashboardAppearance,
  DASHBOARD_BACKGROUND_PALETTE,
  DEFAULT_DASHBOARD_APPEARANCE,
  resolveDashboardCanvasBackgroundStyle,
  type DashboardAppearance,
} from './utils/dashboardAppearance';
import { isThemeDarkAppearance, useTheme } from '@/context/theme';

/** Keep sheet open when focus/pointer moves into portaled Select/Popover content. */
function preventSheetDismissForPortaledMenus(event: {
  preventDefault: () => void;
  target?: EventTarget | null;
  detail?: { originalEvent?: { target?: EventTarget | null } };
}) {
  const target = event.detail?.originalEvent?.target ?? event.target;
  if (!(target instanceof Element)) return;
  if (
    target.closest(
      [
        '[data-radix-popper-content-wrapper]',
        '[data-slot="select-content"]',
        '[data-slot="popover-content"]',
        '[data-radix-select-viewport]',
        '[role="listbox"]',
        '[data-radix-menu-content]',
        '[data-sonner-toaster]',
        '[data-sonner-toast]',
      ].join(', '),
    )
  ) {
    event.preventDefault();
  }
}

function gridLayoutEqual(
  a?: { x: number; y: number; w: number; h: number },
  b?: { x: number; y: number; w: number; h: number },
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

// Memoized chart canvas: re-renders only when dashboardCharts or layout props change.
interface ChartCanvasContentProps {
  dashboardCharts: DashboardChart[];
  CONTAINER_WIDTH: number;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  dashboardRefreshGeneration: number;
  onRemoveChart: (id: string) => void;
  onGridLayoutChange: (charts: DashboardChart[]) => void;
  onStreamChartDataUpdate: (dashboardChartId: string, merged: StreamChartDataSlice) => void;
  formatVisualizationName: (name: string) => string;
  onUpdateChart?: (id: string, updatedParams: any) => void;
  onEditChart?: (id: string) => void;
  recordUndoSnapshot?: () => void;
}

function chartCanvasContentPropsAreEqual(
  prev: ChartCanvasContentProps,
  next: ChartCanvasContentProps,
): boolean {
  if (
    prev.CONTAINER_WIDTH !== next.CONTAINER_WIDTH ||
    prev.canvasRef !== next.canvasRef ||
    prev.dashboardRefreshGeneration !== next.dashboardRefreshGeneration ||
    prev.onRemoveChart !== next.onRemoveChart ||
    prev.onGridLayoutChange !== next.onGridLayoutChange ||
    prev.onStreamChartDataUpdate !== next.onStreamChartDataUpdate ||
    prev.formatVisualizationName !== next.formatVisualizationName ||
    prev.dashboardCharts.length !== next.dashboardCharts.length
  ) {
    return false;
  }
  for (let i = 0; i < prev.dashboardCharts.length; i++) {
    const p = prev.dashboardCharts[i];
    const n = next.dashboardCharts[i];
    if (p.id !== n.id) return false;
    if (!gridLayoutEqual(p.gridLayout, n.gridLayout)) return false;
    if (p.position.x !== n.position.x || p.position.y !== n.position.y) return false;
    if (p.size.width !== n.size.width || p.size.height !== n.size.height) return false;
    if (p.isLoading !== n.isLoading) return false;
    if (p.chartData !== n.chartData) return false;
    if (p.chartColumns !== n.chartColumns) return false;
    if (p.rawResponse !== n.rawResponse) return false;
    if (p.chart !== n.chart) return false;
  }
  return true;
}


const ChartCanvasContent = memo(function ChartCanvasContent({
  dashboardCharts,
  CONTAINER_WIDTH,
  canvasRef,
  dashboardRefreshGeneration,
  onRemoveChart,
  onGridLayoutChange,
  onStreamChartDataUpdate,
  formatVisualizationName,
  onUpdateChart,
  onEditChart,
  recordUndoSnapshot,
}: ChartCanvasContentProps) {
  return (
    <DashboardGridCanvas
      key={`dashboard-grid-${dashboardRefreshGeneration}`}
      dashboardCharts={dashboardCharts}
      containerWidth={CONTAINER_WIDTH}
      isEditMode
      canvasRef={canvasRef}
      onLayoutChange={onGridLayoutChange}
      onRemoveChart={onRemoveChart}
      onStreamChartDataUpdate={onStreamChartDataUpdate}
      formatVisualizationName={formatVisualizationName}
      onUpdateChart={onUpdateChart}
      onEditChart={onEditChart}
      recordUndoSnapshot={recordUndoSnapshot}
    />
  );
}, chartCanvasContentPropsAreEqual);

interface DashboardChartsLayerProps {
  dashboardCharts: DashboardChart[];
  CONTAINER_WIDTH: number;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  dashboardRefreshGeneration: number;
  onRemoveChart: (id: string) => void;
  onGridLayoutChange: (charts: DashboardChart[]) => void;
  onStreamChartDataUpdate: (dashboardChartId: string, merged: StreamChartDataSlice) => void;
  formatVisualizationName: (name: string) => string;
  onUpdateChart?: (id: string, updatedParams: any) => void;
  onEditChart?: (id: string) => void;
  recordUndoSnapshot?: () => void;
}

function dashboardChartsLayerPropsAreEqual(
  prev: DashboardChartsLayerProps,
  next: DashboardChartsLayerProps,
): boolean {
  return chartCanvasContentPropsAreEqual(prev, next);
}

const DashboardChartsLayer = memo(function DashboardChartsLayer({
  dashboardCharts,
  CONTAINER_WIDTH,
  canvasRef,
  dashboardRefreshGeneration,
  onRemoveChart,
  onGridLayoutChange,
  onStreamChartDataUpdate,
  formatVisualizationName,
  onUpdateChart,
  onEditChart,
  recordUndoSnapshot,
}: DashboardChartsLayerProps) {
  return (
    <ChartCanvasContent
      dashboardCharts={dashboardCharts}
      CONTAINER_WIDTH={CONTAINER_WIDTH}
      canvasRef={canvasRef}
      dashboardRefreshGeneration={dashboardRefreshGeneration}
      onRemoveChart={onRemoveChart}
      onGridLayoutChange={onGridLayoutChange}
      onStreamChartDataUpdate={onStreamChartDataUpdate}
      formatVisualizationName={formatVisualizationName}
      onUpdateChart={onUpdateChart}
      onEditChart={onEditChart}
      recordUndoSnapshot={recordUndoSnapshot}
    />
  );
}, dashboardChartsLayerPropsAreEqual);

interface DashboardCanvasAreaProps {
  isEmpty: boolean;
  CONTAINER_WIDTH: number;
  dashboardCharts: DashboardChart[];
  canvasRef: React.RefObject<HTMLDivElement | null>;
  dropSurfaceRef: React.RefObject<HTMLDivElement | null>;
  dashboardRefreshGeneration: number;
  onRemoveChart: (id: string) => void;
  onGridLayoutChange: (charts: DashboardChart[]) => void;
  onStreamChartDataUpdate: (dashboardChartId: string, merged: StreamChartDataSlice) => void;
  formatVisualizationName: (name: string) => string;
  onUpdateChart?: (id: string, updatedParams: any) => void;
  onEditChart?: (id: string) => void;
  recordUndoSnapshot?: () => void;
  canvasBackgroundStyle?: React.CSSProperties;
  isCanvasDropActive?: boolean;
}

const dashboardCanvasAreaPropsAreEqual = (
  prev: DashboardCanvasAreaProps,
  next: DashboardCanvasAreaProps,
): boolean => {
  if (
    prev.isEmpty !== next.isEmpty ||
    prev.CONTAINER_WIDTH !== next.CONTAINER_WIDTH ||
    prev.canvasRef !== next.canvasRef ||
    prev.dropSurfaceRef !== next.dropSurfaceRef ||
    prev.dashboardRefreshGeneration !== next.dashboardRefreshGeneration ||
    prev.onRemoveChart !== next.onRemoveChart ||
    prev.onGridLayoutChange !== next.onGridLayoutChange ||
    prev.onStreamChartDataUpdate !== next.onStreamChartDataUpdate ||
    prev.onUpdateChart !== next.onUpdateChart ||
    prev.onEditChart !== next.onEditChart ||
    prev.formatVisualizationName !== next.formatVisualizationName ||
    prev.canvasBackgroundStyle?.backgroundColor !== next.canvasBackgroundStyle?.backgroundColor ||
    prev.isCanvasDropActive !== next.isCanvasDropActive
  ) {
    return false;
  }
  return dashboardChartsLayerPropsAreEqual(prev, next);
};

const DashboardCanvasArea = memo(function DashboardCanvasArea({
  isEmpty,
  CONTAINER_WIDTH,
  dashboardCharts,
  canvasRef,
  dropSurfaceRef,
  dashboardRefreshGeneration,
  onRemoveChart,
  onGridLayoutChange,
  onStreamChartDataUpdate,
  formatVisualizationName,
  onUpdateChart,
  onEditChart,
  recordUndoSnapshot,
  canvasBackgroundStyle,
  isCanvasDropActive = false,
}: DashboardCanvasAreaProps) {
  const gridContentMinHeight = useMemo(
    () => Math.max(400, getGridContentHeightFromCharts(dashboardCharts, CONTAINER_WIDTH, GRID_COLS)),
    [dashboardCharts, CONTAINER_WIDTH],
  );

  return (
    <DroppableCanvas
      isEmpty={isEmpty}
      isOver={false}
      containerWidth={CONTAINER_WIDTH}
      gridContentMinHeight={gridContentMinHeight}
      isDropHighlighted={isCanvasDropActive}
      dropSurfaceRef={dropSurfaceRef}
      canvasBackgroundStyle={canvasBackgroundStyle}
      className="h-full min-h-0"
    >
      <DashboardChartsLayer
        dashboardCharts={dashboardCharts}
        CONTAINER_WIDTH={CONTAINER_WIDTH}
        canvasRef={canvasRef}
        dashboardRefreshGeneration={dashboardRefreshGeneration}
        onRemoveChart={onRemoveChart}
        onGridLayoutChange={onGridLayoutChange}
        onStreamChartDataUpdate={onStreamChartDataUpdate}
        formatVisualizationName={formatVisualizationName}
        onUpdateChart={onUpdateChart}
        onEditChart={onEditChart}
        recordUndoSnapshot={recordUndoSnapshot}
      />
    </DroppableCanvas>
  );
}, dashboardCanvasAreaPropsAreEqual);

// Memoized body: re-renders only when chart/layout/sidebar state changes.
// DndContext lives here so title-only re-renders don't create new context and re-render all charts.
interface DashboardBodyProps {
  isLoadingDashboard: boolean;
  dashboardCharts: DashboardChart[];
  setDashboardCharts: React.Dispatch<React.SetStateAction<DashboardChart[]>>;
  dropSurfaceRef: React.RefObject<HTMLDivElement | null>;
  onCanvasOverChange: (isOver: boolean) => void;
  CONTAINER_WIDTH: number;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  canvasMeasureRef: React.RefObject<HTMLDivElement | null>;
  dashboardRefreshGeneration: number;
  onRemoveChart: (id: string) => void;
  onGridLayoutChange: (charts: DashboardChart[]) => void;
  onStreamChartDataUpdate: (dashboardChartId: string, merged: StreamChartDataSlice) => void;
  formatVisualizationName: (name: string) => string;
  isSidebarExpanded: boolean;
  setIsSidebarExpanded: (v: boolean) => void;
  filteredCharts: Chart[];
  addedChartIds: Set<number>;
  onUpdateChart?: (id: string, updatedParams: any) => void;
  onEditChart?: (id: string) => void;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  sortBy: 'recent' | 'name';
  setSortBy: (v: 'recent' | 'name') => void;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  isLoadingCharts: boolean;
  charts: Chart[];
  pointerMoveHandlerRef: React.MutableRefObject<((e: MouseEvent) => void) | null>;
  pointerRef: React.MutableRefObject<{ x: number; y: number } | null>;
  dropPositionRef: React.MutableRefObject<{ x: number; y: number } | null>;
  lastOverRef: React.MutableRefObject<boolean>;
  dragEndHandlerRef: React.MutableRefObject<((event: DragEndEvent) => void) | null>;
  onRefetchCharts: () => void | Promise<void>;
  onDeleteSidebarChart: (chart: Chart) => void | Promise<void>;
  deletingChartId: number | null;
  isRefreshingCharts: boolean;
  analyticsStudio?: boolean;
  pushUndoSnapshot?: () => void;
  canvasBackgroundStyle?: React.CSSProperties;
  isCanvasDropActive?: boolean;
}

const DashboardBody = memo(function DashboardBody({
  isLoadingDashboard,
  dashboardCharts,
  setDashboardCharts,
  dropSurfaceRef,
  onCanvasOverChange,
  CONTAINER_WIDTH,
  canvasRef,
  canvasMeasureRef,
  dashboardRefreshGeneration,
  onRemoveChart,
  onGridLayoutChange,
  onStreamChartDataUpdate,
  formatVisualizationName,
  isSidebarExpanded,
  setIsSidebarExpanded,
  filteredCharts,
  addedChartIds,
  onUpdateChart,
  onEditChart,
  searchTerm,
  setSearchTerm,
  sortBy,
  setSortBy,
  activeId,
  setActiveId,
  isLoadingCharts,
  charts,
  pointerMoveHandlerRef,
  pointerRef,
  dropPositionRef,
  lastOverRef,
  dragEndHandlerRef,
  onRefetchCharts,
  onDeleteSidebarChart,
  deletingChartId,
  isRefreshingCharts,
  analyticsStudio,
  pushUndoSnapshot,
  canvasBackgroundStyle,
  isCanvasDropActive = false,
}: DashboardBodyProps) {
  const [isStickyLibraryExpanded, setIsStickyLibraryExpanded] = useState<boolean>(false);

  const { chartsReadyToAdd, chartsOnDashboard } = useMemo(() => {
    const ready: Chart[] = [];
    const onCanvas: Chart[] = [];
    for (const chart of filteredCharts) {
      if (addedChartIds.has(chart.id)) onCanvas.push(chart);
      else ready.push(chart);
    }
    return { chartsReadyToAdd: ready, chartsOnDashboard: onCanvas };
  }, [filteredCharts, addedChartIds]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );
  const { handleDragStart, handleDragOver, handleDragEnd, addChartToCanvas } = useDragHandlers({
    charts,
    dashboardCharts,
    setDashboardCharts,
    setActiveId,
    onCanvasOverChange,
    CONTAINER_WIDTH,
    canvasRef: canvasRef as React.RefObject<HTMLDivElement>,
    pointerMoveHandlerRef,
    pointerRef,
    dropPositionRef,
    lastOverRef,
    analyticsStudio,
    recordUndoSnapshot: pushUndoSnapshot,
  });
  useEffect(() => {
    dragEndHandlerRef.current = handleDragEnd;
    return () => { dragEndHandlerRef.current = null; };
  }, [handleDragEnd, dragEndHandlerRef]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="relative flex flex-1 min-h-0 w-full overflow-hidden">
      {isLoadingDashboard ? (
        <DashboardCanvasSkeleton className="w-full bg-background" />
      ) : (
        <div
          ref={canvasMeasureRef}
          className="flex flex-1 flex-col overflow-hidden min-w-0 min-h-0"
        >
          <DashboardCanvasArea
            isEmpty={dashboardCharts.length === 0}
            CONTAINER_WIDTH={CONTAINER_WIDTH}
            dashboardCharts={dashboardCharts}
            canvasRef={canvasRef}
            dropSurfaceRef={dropSurfaceRef}
            dashboardRefreshGeneration={dashboardRefreshGeneration}
            onRemoveChart={onRemoveChart}
            onGridLayoutChange={onGridLayoutChange}
            onStreamChartDataUpdate={onStreamChartDataUpdate}
            formatVisualizationName={formatVisualizationName}
            onUpdateChart={onUpdateChart}
            onEditChart={onEditChart}
            recordUndoSnapshot={pushUndoSnapshot}
            canvasBackgroundStyle={canvasBackgroundStyle}
            isCanvasDropActive={isCanvasDropActive}
          />
        </div>
      )}
      {/* Right Side - Charts List */}
      <div
        className={`relative flex flex-col flex-shrink-0 min-h-0 self-stretch transition-all duration-300 overflow-hidden border-l border-border bg-muted/30 ${
          isSidebarExpanded ? 'w-80' : 'w-10'
        }`}
        style={{ width: isSidebarExpanded ? '320px' : `${DASHBOARD_SIDEBAR_COLLAPSED_WIDTH_PX}px` }}
      >
        {!isSidebarExpanded ? (
          <DashboardSidebarCollapsedRail
            label="Charts"
            count={charts.length}
            icon={<BarChart3 className="size-3" />}
            onExpand={() => setIsSidebarExpanded(true)}
          />
        ) : null}
        <div className={`absolute inset-0 flex flex-col overflow-hidden transition-opacity duration-300 ${isSidebarExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          {/* Header */}
          <div className="px-2 pt-2 pb-2 border-b border-border bg-card flex-shrink-0">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="min-w-0">
                <h3 className="font-semibold text-sm text-foreground leading-tight">Chart Library</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Drag or click charts onto the canvas</p>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title="Refresh chart list"
                  onClick={() => void onRefetchCharts()}
                  disabled={isRefreshingCharts}
                  className="h-7 w-7 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                >
                  {isRefreshingCharts ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsSidebarExpanded(false)}
                  className="h-7 w-7 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  title="Collapse sidebar"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search charts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 bg-background border-border !text-xs placeholder:text-muted-foreground"
              />
            </div>

            {!isLoadingCharts && filteredCharts.length > 0 && (
              <div className="flex items-center justify-between gap-2 mt-1.5">
                <p className="text-[11px] text-muted-foreground">
                  {chartsReadyToAdd.length} available
                  {chartsOnDashboard.length > 0 && (
                    <span className="text-muted-foreground/70"> · {chartsOnDashboard.length} added</span>
                  )}
                </p>
                {!(activeId && activeId.startsWith('chart-')) && (
                  <div className="flex rounded border border-border overflow-hidden bg-background shrink-0">
                    <button
                      type="button"
                      onClick={() => setSortBy('recent')}
                      className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${sortBy === 'recent'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'
                        }`}
                    >
                      Recent
                    </button>
                    <button
                      type="button"
                      onClick={() => setSortBy('name')}
                      className={`px-2 py-0.5 text-[10px] font-medium border-l border-border transition-colors ${sortBy === 'name'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'
                        }`}
                    >
                      A–Z
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Chart list */}
          <div className="flex-1 overflow-y-auto min-h-0 bg-muted/20">
            <div className="p-2">
            {isLoadingCharts ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-md bg-card border border-border p-2 animate-pulse">
                    <div className="flex gap-2">
                      <div className="w-8 h-8 rounded-md bg-muted shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3.5 bg-muted rounded w-3/4" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredCharts.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <Search className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs font-medium text-foreground">No charts found</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Try a different search term</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {chartsReadyToAdd.length > 0 && (
                  <section>
                    {chartsOnDashboard.length > 0 && (
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 px-0.5">Ready to add</p>
                    )}
                    <div className="space-y-2">
                      {chartsReadyToAdd.map((chart) => (
                        <DraggableChartItem
                          key={chart.id}
                          chart={chart}
                          formatVisualizationName={formatVisualizationName}
                          getRelativeTime={getRelativeTime}
                          isAdded={false}
                          onDelete={onDeleteSidebarChart}
                          isDeleting={deletingChartId === chart.id}
                          onAddToCanvas={addChartToCanvas}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {chartsOnDashboard.length > 0 && (
                  <section>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 px-0.5">On dashboard</p>
                    <div className="space-y-2">
                      {chartsOnDashboard.map((chart) => (
                        <DraggableChartItem
                          key={chart.id}
                          chart={chart}
                          formatVisualizationName={formatVisualizationName}
                          getRelativeTime={getRelativeTime}
                          isAdded
                          onDelete={onDeleteSidebarChart}
                          isDeleting={deletingChartId === chart.id}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
            </div>
          </div>

          {/* Blocks */}
          <div className="border-t border-border bg-card flex flex-col flex-shrink-0">
            <button
              type="button"
              onClick={() => setIsStickyLibraryExpanded(!isStickyLibraryExpanded)}
              className="w-full p-2 flex items-center justify-between hover:bg-primary/5 transition-colors text-left"
            >
              <div className="min-w-0">
                <span className="text-xs font-semibold text-foreground block leading-tight">Blocks</span>
                <span className="text-[11px] text-muted-foreground block mt-0.5">Layout & content elements</span>
              </div>
              {isStickyLibraryExpanded ? (
                <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-2" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-2" />
              )}
            </button>

            {isStickyLibraryExpanded && (
              <div className="p-2 pt-0 space-y-3 border-t border-border/60 bg-muted/20 max-h-[240px] overflow-y-auto">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 px-0.5">Layout</p>
                  <div className="space-y-2">
                    {STATIC_LAYOUT_ITEMS.map((item) => (
                      <DraggableChartItem
                        key={item.id}
                        chart={item}
                        formatVisualizationName={formatVisualizationName}
                        getRelativeTime={getRelativeTime}
                        isAdded={false}
                        showActions={false}
                        layout="compact"
                        onAddToCanvas={addChartToCanvas}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 px-0.5">Content</p>
                  <div className="space-y-2">
                    {STATIC_CONTENT_ITEMS.map((item) => (
                      <DraggableChartItem
                        key={item.id}
                        chart={item}
                        formatVisualizationName={formatVisualizationName}
                        getRelativeTime={getRelativeTime}
                        isAdded={false}
                        showActions={false}
                        layout="compact"
                        onAddToCanvas={addChartToCanvas}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>

      <DragOverlay>
        {activeId && activeId.startsWith('chart-') ? (() => {
          const idVal = parseInt(activeId.replace('chart-', ''));
          const found = charts.find(c => c.id === idVal) ||
            STATIC_LAYOUT_ITEMS.find(c => c.id === idVal) ||
            STATIC_CONTENT_ITEMS.find(c => c.id === idVal);
          if (!found) return null;
          return (
            <div className="rotate-2 opacity-95 scale-105 shadow-2xl">
              <DraggableChartItem
                chart={found}
                formatVisualizationName={formatVisualizationName}
                getRelativeTime={getRelativeTime}
                isAdded={false}
                showActions={false}
              />
            </div>
          );
        })() : null}
      </DragOverlay>
    </DndContext>
  );
});

interface ChartSearchPopoverProps {
  value?: number;
  charts: any[];
  onChange: (chartId: number) => void;
  addedChartIds?: Set<number>;
}

// const ChartSearchPopover = memo(function ChartSearchPopover({
//   value,
//   charts,
//   onChange,
// }: ChartSearchPopoverProps) {
//   const [open, setOpen] = useState(false);
//   const [query, setQuery] = useState('');

//   const selectedChart = useMemo(() => {
//     return charts.find(c => c.id === value);
//   }, [value, charts]);

//   const filtered = useMemo(() => {
//     return charts.filter(c =>
//       (c.chart_name || '').toLowerCase().includes(query.toLowerCase())
//     );
//   }, [query, charts]);

//   return (
//     <Popover open={open} onOpenChange={(o) => {
//       setOpen(o);
//       if (!o) setQuery('');
//     }} modal={false}>
//       <PopoverTrigger asChild>
//         <Button
//           variant="outline"
//           role="combobox"
//           aria-expanded={open}
//           className="w-full h-7 text-[10px] px-1.5 justify-between font-normal bg-background border-input"
//         >
//           <span className="truncate">
//             {selectedChart ? selectedChart.chart_name : 'Select Chart...'}
//           </span>
//           <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
//         </Button>
//       </PopoverTrigger>
//       <PopoverContent
//         className="w-[180px] min-w-[180px] max-h-[min(240px,85vh)] overflow-hidden p-0 flex flex-col z-[1200]"
//         align="start"
//       >
//         <div className="shrink-0 border-b p-1 bg-popover">
//           <Input
//             type="text"
//             placeholder="Search charts..."
//             value={query}
//             onChange={(e) => setQuery(e.target.value)}
//             className="h-7 text-xs px-2 w-full"
//             autoFocus
//           />
//         </div>
//         <div
//           className="min-h-0 max-h-[min(180px,calc(85vh_-_8rem))] overflow-y-auto overflow-x-hidden overscroll-contain p-1 bg-popover [scrollbar-gutter:stable] scrollbar-thin"
//           role="listbox"
//         >
//           {filtered.map((c) => (
//             <button
//               key={c.id}
//               type="button"
//               onClick={() => {
//                 onChange(c.id);
//                 setOpen(false);
//               }}
//               className={`w-full text-left px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground flex items-center justify-between rounded-sm ${c.id === value ? 'bg-accent font-medium' : ''
//                 }`}
//             >
//               <span className="truncate">{c.chart_name || `Chart #${c.id}`}</span>
//               {c.id === value && <Check className="h-3.5 w-3.5 shrink-0 ml-1 text-primary" />}
//             </button>
//           ))}
//           {filtered.length === 0 && (
//             <div className="px-2 py-3 text-center text-xs text-muted-foreground">
//               No charts found
//             </div>
//           )}
//         </div>
//       </PopoverContent>
//     </Popover>
//   );
// });

const ChartSearchPopover = memo(function ChartSearchPopover({
  value,
  charts,
  onChange,
  autoOpen,
  addedChartIds,
}: ChartSearchPopoverProps & { autoOpen?: boolean }) {
  const [open, setOpen] = useState(!!autoOpen);
  const [query, setQuery] = useState('');

  const selectedChart = useMemo(() => {
    return charts.find(c => c.id === value);
  }, [value, charts]);

  const filtered = useMemo(() => {
    return charts.filter(c =>
      (c.chart_name || '').toLowerCase().includes(query.toLowerCase())
    );
  }, [query, charts]);

  return (
    <Popover open={open} onOpenChange={(o) => {
      setOpen(o);
      if (!o) setQuery('');
    }} modal={false}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full h-7 text-[10px] px-1.5 justify-between font-normal bg-background border-input"
        >
          <span className="truncate">
            {selectedChart ? selectedChart.chart_name : 'Select Chart...'}
          </span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[180px] min-w-[180px] max-h-[min(240px,85vh)] overflow-hidden p-0 flex flex-col z-[1200]"
        align="start"
      >
        <div className="shrink-0 border-b p-1 bg-popover">
          <Input
            type="text"
            placeholder="Search charts..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-7 text-xs px-2 w-full"
            autoFocus
          />
        </div>
        <div
          className="min-h-0 max-h-[min(180px,calc(85vh_-_8rem))] overflow-y-auto overflow-x-hidden overscroll-contain p-1 bg-popover [scrollbar-gutter:stable] scrollbar-thin"
          role="listbox"
        >
          {filtered.map((c) => {
            const isSelected = c.id === value;
            const isAlreadyInPanel = addedChartIds?.has(c.id) && !isSelected;
            return (
              <button
                key={c.id}
                type="button"
                disabled={isAlreadyInPanel}
                onClick={() => {
                  if (isAlreadyInPanel) return;
                  onChange(c.id);
                  setOpen(false);
                }}
                className={`w-full text-left px-2 py-1.5 text-xs flex items-center justify-between gap-1 rounded-sm ${isSelected ? 'bg-accent font-medium' : ''
                  } ${isAlreadyInPanel
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-accent hover:text-accent-foreground'
                  }`}
              >
                <span className="truncate">{c.chart_name || `Chart #${c.id}`}</span>
                <span className="flex items-center gap-1 shrink-0">
                  {isAlreadyInPanel && (
                    <span className="text-[9px] font-semibold text-primary/80">Added</span>
                  )}
                  {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                </span>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-2 py-3 text-center text-xs text-muted-foreground">
              No charts found
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
});
const PanelItemsDraggableList = memo(function PanelItemsDraggableList({
  items,
  allItems,
  charts,
  onReorder,
  onRemove,
  formatVisualizationName,
  showRemove = false,
}: {
  items: any[];
  allItems: any[];
  charts: any[];
  onReorder: (items: any[]) => void;
  onRemove: (itemId: string) => void;
  formatVisualizationName: (name: string) => string;
  showRemove?: boolean;
}) {
  const dragIndexRef = useRef<number | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDrop = (dropIndex: number) => {
    const dragIndex = dragIndexRef.current;
    dragIndexRef.current = null;
    setDraggingId(null);
    setDragOverIndex(null);
    if (dragIndex === null || dragIndex === dropIndex) return;

    const reorderedChartItems = [...items];
    const [moved] = reorderedChartItems.splice(dragIndex, 1);
    reorderedChartItems.splice(dropIndex, 0, moved);

    const chartItemIds = new Set(reorderedChartItems.map((i) => i.id));
    const nonChartItems = allItems.filter((i: any) => !chartItemIds.has(i.id));
    onReorder([...reorderedChartItems, ...nonChartItems]);
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 py-5 bg-muted/10 border border-dashed rounded-md text-center">
        <p className="text-[11px] text-muted-foreground">No charts in this panel yet</p>
        <p className="text-[10px] text-muted-foreground/60">Add charts from Ready to add below</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1 -mr-1">
      {items.map((item: any, index: number) => {
        const isDragging = draggingId === item.id;
        const isOver = dragOverIndex === index && !isDragging;
        const chartDef = charts.find((c) => c.id === item.chartId);

        if (!chartDef) return null;

        return (
          <div key={item.id} className="relative">
            <div
              className={`absolute -top-[4px] left-2 right-2 h-[2px] rounded-full bg-primary transition-opacity duration-150 ${isOver ? 'opacity-100' : 'opacity-0'}`}
            />

            <div
              draggable
              onDragStart={(e) => {
                dragIndexRef.current = index;
                setDraggingId(item.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverIndex !== index) setDragOverIndex(index);
              }}
              onDragLeave={() => setDragOverIndex((cur) => (cur === index ? null : cur))}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(index);
              }}
              onDragEnd={() => {
                dragIndexRef.current = null;
                setDraggingId(null);
                setDragOverIndex(null);
              }}
              className={`flex items-stretch gap-1 transition-opacity duration-150 ${isDragging ? 'opacity-50' : 'opacity-100'}`}
            >
              <div
                className="flex items-center justify-center w-5 shrink-0 text-muted-foreground/45 hover:text-muted-foreground cursor-grab active:cursor-grabbing"
                title="Drag to reorder"
              >
                <GripVertical className="w-3.5 h-3.5" />
              </div>

              <div className="flex-1 min-w-0">
                <DraggableChartItem
                  chart={chartDef}
                  formatVisualizationName={formatVisualizationName}
                  getRelativeTime={getRelativeTime}
                  isAdded
                  dragMode="none"
                  showActions={showRemove}
                  onRemove={showRemove ? () => onRemove(item.id) : undefined}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});
const PanelAvailableChartsList = memo(function PanelAvailableChartsList({
  charts,
  addedChartIds,
  formatVisualizationName,
  onAddChart,
}: {
  charts: Chart[];
  addedChartIds: Set<number>;
  formatVisualizationName: (name: string) => string;
  onAddChart: (chartId: number) => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');

  const readyToAddCharts = useMemo(() => {
    let filtered = charts.filter((chart) => !addedChartIds.has(chart.id));
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((chart) =>
        chart.chart_name?.toLowerCase().includes(searchLower) ||
        chart.visualization_name?.toLowerCase().includes(searchLower),
      );
    }
    return [...filtered].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
  }, [charts, searchTerm, addedChartIds]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
        <Input
          placeholder="Search charts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-6 h-7 bg-background border-muted-foreground/20 !text-xs"
        />
      </div>
      <div className="max-h-[280px] overflow-y-auto space-y-2 pr-1 -mr-1">
        {readyToAddCharts.length === 0 ? (
          <div className="py-5 text-center text-[11px] text-muted-foreground border border-dashed rounded-md bg-muted/5">
            {addedChartIds.size > 0 ? 'All charts are in this panel' : 'No charts found'}
          </div>
        ) : (
          readyToAddCharts.map((chart) => (
            <DraggableChartItem
              key={chart.id}
              chart={chart}
              formatVisualizationName={formatVisualizationName}
              getRelativeTime={getRelativeTime}
              isAdded={false}
              dragMode="none"
              showActions={false}
              onAddClick={(c) => onAddChart(c.id)}
            />
          ))
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">Click a chart to add it to the panel</p>
    </div>
  );
});



export function CreateDashboard() {
  const { theme } = useTheme();
  const isDarkDashboardTheme = isThemeDarkAppearance(theme);
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ workflowname?: string, sidebar?: string }>();
  const [searchParams] = useSearchParams();
  const isAnalyticsStudio = location.pathname.startsWith('/analytic-studio');
  // Check for both 'edit' and 'dashboardId' query parameters
  const dashboardId = searchParams.get('dashboardId') || searchParams.get('edit');
  const isEditMode = !!dashboardId;

  // Ensure pointer interactions are restored if any prior flow left the
  // document/body with pointer-events disabled (prevents apparent UI freeze).
  useEffect(() => {
    const restoreInteraction = () => {
      if (typeof document !== 'undefined') {
        try {
          document.documentElement.style.pointerEvents = 'auto';
          document.body.style.pointerEvents = 'auto';
          document.body.style.overflow = 'auto';
        } catch {
          // ignore
        }
      }
    };

    restoreInteraction();
    const t = setTimeout(restoreInteraction, 100);
    return () => clearTimeout(t);
  }, []);

  // Get current workflow's flow_id from flowStore (hydrated from route on hard refresh)
  const currentWorkflow = useFlowStore((state) => state.currentWorkflow);
  const setCurrentWorkflow = useFlowStore((state) => state.setCurrentWorkflow);
  const workflowRouteId = params.workflowname;
  const [isHydratingWorkflow, setIsHydratingWorkflow] = useState(false);

  useEffect(() => {
    if (isAnalyticsStudio || !workflowRouteId) return;

    const current = useFlowStore.getState().currentWorkflow;
    if (
      workflowMatchesRouteId(current, workflowRouteId) &&
      isReconWorkflowFlowIdResolved(current, workflowRouteId)
    ) {
      return;
    }

    let cancelled = false;
    setIsHydratingWorkflow(true);
    getWorkflowByIdApi({ id: workflowRouteId })
      .then((res) => {
        if (!cancelled && res) {
          setCurrentWorkflow(res);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(getDisplayErrorMessage(err, 'Failed to fetch workflow'));
        }
      })
      .finally(() => {
        if (!cancelled) setIsHydratingWorkflow(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workflowRouteId, isAnalyticsStudio, setCurrentWorkflow]);

  const flowId =
    currentWorkflow &&
      workflowMatchesRouteId(currentWorkflow, workflowRouteId) &&
      isReconWorkflowFlowIdResolved(currentWorkflow, workflowRouteId)
      ? currentWorkflow.flow_id
      : currentWorkflow?.flow_id && !workflowRouteId
        ? currentWorkflow.flow_id
        : undefined;

  // Use dashboard data hook
  const {
    charts,
    dashboardCharts,
    setDashboardCharts,
    rawDashboardData,
    dashboardTitle,
    setDashboardTitle,
    isLoadingCharts,
    isLoadingDashboard,
    refetchCharts,
    updateChartInLibrary,
    removeChartFromLibrary,
    dashboardAppearance,
    setDashboardAppearance,
  } = useDashboardData(dashboardId, isEditMode, flowId, isAnalyticsStudio);

  const {
    pushUndoSnapshot,
    undo: undoDashboardAction,
    redo: redoDashboardAction,
    canUndo,
    canRedo,
    clearHistory: clearUndoHistory,
  } = useDashboardUndo(
    dashboardCharts,
    setDashboardCharts,
    dashboardTitle,
    setDashboardTitle,
    dashboardId,
  );

  const [deletingSidebarChartId, setDeletingSidebarChartId] = useState<number | null>(null);
  const [isRefreshingSidebarCharts, setIsRefreshingSidebarCharts] = useState(false);

  const handleRefetchSidebarCharts = useCallback(async () => {
    setIsRefreshingSidebarCharts(true);
    try {
      await refetchCharts();
    } finally {
      setIsRefreshingSidebarCharts(false);
    }
  }, [refetchCharts]);

  const handleDeleteSidebarChart = useCallback(
    async (chart: Chart) => {
      setDeletingSidebarChartId(chart.id);
      try {
        await removeChartFromLibrary(chart.id);
      } finally {
        setDeletingSidebarChartId(null);
      }
    },
    [removeChartFromLibrary]
  );

  const [showSavedPayload, setShowSavedPayload] = useState(false);
  // When set, we collapsed for save and will run save in useEffect after scaling effect updates layout
  const [pendingSaveDimensions, setPendingSaveDimensions] = useState<{
    width: number;
    height: number;
    containerWidth: number;
    contentHeight?: number;
    rowCount?: number;
  } | null>(null);
  const [isPreparingSave, setIsPreparingSave] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'name'>('recent');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeCustomizerChartId, setActiveCustomizerChartId] = useState<string | null>(null);
  const [activeChartEditorChartId, setActiveChartEditorChartId] = useState<number | null>(null);
  const [dashboardRefreshGeneration, setDashboardRefreshGeneration] = useState(0);
  const [isDashboardAppearanceOpen, setIsDashboardAppearanceOpen] = useState(false);
  const [editingDashboardAppearance, setEditingDashboardAppearance] = useState<DashboardAppearance>(
    DEFAULT_DASHBOARD_APPEARANCE,
  );
  const [editingTitle, setEditingTitle] = useState('');
  const [editingParams, setEditingParams] = useState<any>({});
  const [panelCustomizerTab, setPanelCustomizerTab] = useState<'properties' | 'style' | 'background'>('properties');
  const activeCustomizerChartIdRef = useRef<string | null>(null);
  const customizerLiveSyncSkipRef = useRef(false);
  activeCustomizerChartIdRef.current = activeCustomizerChartId;
  const embeddedEditorStateRef = useRef<{
    updated: boolean;
    chartId: number | null;
    pendingCustomization?: Record<string, unknown> | null;
  }>({
    updated: false,
    chartId: null,
    pendingCustomization: null,
  });
  const embeddedEditorCloseInProgressRef = useRef(false);

  const openEmbeddedChartEditor = useCallback((chartId: number) => {
    embeddedEditorCloseInProgressRef.current = false;
    embeddedEditorStateRef.current = {
      updated: false,
      chartId: Number(chartId),
      pendingCustomization: null,
    };
    setActiveChartEditorChartId(Number(chartId));
  }, []);

  const handleEmbeddedChartUpdated = useCallback(() => {
    const pendingCustomization =
      typeof window !== 'undefined'
        ? ((window as { __chartCustomizationOptions?: Record<string, unknown> }).__chartCustomizationOptions ??
          null)
        : null;
    embeddedEditorStateRef.current = {
      ...embeddedEditorStateRef.current,
      updated: true,
      chartId: embeddedEditorStateRef.current.chartId ?? activeChartEditorChartId,
      pendingCustomization,
    };
  }, [activeChartEditorChartId]);

  const handleEmbeddedChartEditorClose = useCallback(async () => {
    if (embeddedEditorCloseInProgressRef.current) return;

    const editorStateSnapshot = embeddedEditorStateRef.current;
    embeddedEditorStateRef.current = {
      updated: false,
      chartId: null,
      pendingCustomization: null,
    };
    const { updated: shouldRefresh, chartId: editedChartId, pendingCustomization } =
      editorStateSnapshot;
    setActiveChartEditorChartId(null);

    if (typeof window !== 'undefined') {
      delete (window as { __chartCustomizationOptions?: unknown }).__chartCustomizationOptions;
    }

    if (!shouldRefresh || editedChartId == null) return;

    embeddedEditorCloseInProgressRef.current = true;
    const normalizedChartId = Number(editedChartId);
    let widgetIdsToRefresh: string[] = [];

    try {
      let editedChartMeta: Chart | null = null;
      try {
        editedChartMeta = (await getChartById(String(normalizedChartId))) as Chart;
      } catch {
        // continue with refresh using widget metadata
      }

      if (editedChartMeta && pendingCustomization) {
        editedChartMeta = applyPendingChartCustomization(editedChartMeta, pendingCustomization);
      }

      widgetIdsToRefresh = await refreshAllDashboardChartWidgets(
        isAnalyticsStudio,
        setDashboardCharts,
        {
          editedChartId: normalizedChartId,
          editedChartMeta,
          pendingCustomization,
        },
      );

      if (editedChartMeta) {
        updateChartInLibrary(editedChartMeta);
      }
    } catch (error) {
      console.error('Failed to refresh dashboard chart after embedded edit:', error);
    } finally {
      embeddedEditorCloseInProgressRef.current = false;
      if (widgetIdsToRefresh.length > 0) {
        setDashboardCharts((prev) =>
          prev.map((dc) =>
            widgetIdsToRefresh.includes(dc.id) && dc.isLoading
              ? { ...dc, isLoading: false }
              : dc,
          ),
        );
      }
    }
  }, [isAnalyticsStudio, setDashboardCharts, updateChartInLibrary]);

  const customizingChart = useMemo(() => {
    return dashboardCharts.find(dc => dc.id === activeCustomizerChartId);
  }, [activeCustomizerChartId, dashboardCharts]);

  const activeCanvasAppearance = isDashboardAppearanceOpen
    ? editingDashboardAppearance
    : dashboardAppearance;

  const canvasBackgroundStyle = useMemo(
    () => resolveDashboardCanvasBackgroundStyle(activeCanvasAppearance, isDarkDashboardTheme),
    [activeCanvasAppearance, isDarkDashboardTheme],
  );

  const openDashboardAppearanceSheet = useCallback(() => {
    pushUndoSnapshot();
    setEditingDashboardAppearance(cloneDashboardAppearance(dashboardAppearance));
    setIsDashboardAppearanceOpen(true);
  }, [pushUndoSnapshot, dashboardAppearance]);

  const applyDashboardAppearance = useCallback(() => {
    setDashboardAppearance(cloneDashboardAppearance(editingDashboardAppearance));
    setIsDashboardAppearanceOpen(false);
    toast.success('Dashboard appearance updated');
  }, [editingDashboardAppearance, setDashboardAppearance]);

  const resetDashboardAppearanceDraft = useCallback(() => {
    setEditingDashboardAppearance({ ...DEFAULT_DASHBOARD_APPEARANCE });
  }, []);

  const prevCustomizerIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeCustomizerChartId) {
      prevCustomizerIdRef.current = null;
      return;
    }
    if (activeCustomizerChartId === prevCustomizerIdRef.current) return;

    prevCustomizerIdRef.current = activeCustomizerChartId;
    const dc = dashboardCharts.find(c => c.id === activeCustomizerChartId);
    if (dc) {
      setEditingTitle(dc.chart.chart_name || '');
      const viz = (dc.chart.visualization_name || dc.chart.chart_type || '').toString().toLowerCase();
      const params = dc.chart.params || {};
      setEditingParams(
        viz === 'divider' ? { ...DEFAULT_DIVIDER_PARAMS, ...params } : params,
      );
      if (viz === 'panel') {
        setPanelCustomizerTab('properties');
      }
    }
  }, [activeCustomizerChartId, dashboardCharts]);

  const isOverCanvasRef = useRef(false);
  const [isCanvasDropActive, setIsCanvasDropActive] = useState(false);
  const dropSurfaceRef = useRef<HTMLDivElement | null>(null);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [confirmBackOpen, setConfirmBackOpen] = useState(false);

  const hasUnsavedChanges = useMemo(
    () => dashboardCharts.length > 0 || !!dashboardTitle.trim(),
    [dashboardCharts.length, dashboardTitle],
  );
  const lastOverRef = useRef<boolean>(false);
  const pointerMoveHandlerRef = useRef<((e: MouseEvent) => void) | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasMeasureRef = useRef<HTMLDivElement>(null);
  const dropPositionRef = useRef<{ x: number; y: number } | null>(null);
  const [containerDimensions, setContainerDimensions] = useState<{ width: number; height: number }>(() => ({
    width: DEFAULT_CONTAINER_WIDTH,
    height: DEFAULT_CONTAINER_HEIGHT,
  }));
  const prevContainerRectRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const dragEndHandlerRef = useRef<((event: DragEndEvent) => void) | null>(null);

  const applyCanvasDropHighlight = useCallback((isOver: boolean) => {
    isOverCanvasRef.current = isOver;
    const el = dropSurfaceRef.current;
    if (!el) return;
    el.classList.toggle('bg-primary/5', isOver);
    el.classList.toggle('bg-background', !isOver);

    const emptyZone = el.querySelector('[data-dashboard-empty-drop]');
    if (emptyZone instanceof HTMLElement) {
      emptyZone.classList.toggle('bg-primary/5', isOver);
      emptyZone.classList.toggle('bg-transparent', !isOver);
    }
    const icon = el.querySelector('[data-dashboard-empty-icon]');
    if (icon instanceof HTMLElement) {
      icon.classList.toggle('bg-primary/20', isOver);
      icon.classList.toggle('scale-110', isOver);
      icon.classList.toggle('shadow-lg', isOver);
      icon.classList.toggle('shadow-primary/20', isOver);
      icon.classList.toggle('bg-gradient-to-br', !isOver);
      icon.classList.toggle('from-primary/10', !isOver);
      icon.classList.toggle('to-primary/5', !isOver);
    }
    const iconSvg = el.querySelector('[data-dashboard-empty-icon-svg]');
    if (iconSvg instanceof HTMLElement) {
      iconSvg.classList.toggle('text-primary', isOver);
      iconSvg.classList.toggle('scale-110', isOver);
      iconSvg.classList.toggle('text-primary/60', !isOver);
    }
    const title = el.querySelector('[data-dashboard-empty-title]');
    if (title instanceof HTMLElement) {
      title.textContent = isOver ? 'Drop to add your first chart' : 'Start building your dashboard';
      title.classList.toggle('text-primary', isOver);
      title.classList.toggle('text-foreground', !isOver);
    }
  }, []);

  const onCanvasOverChange = useCallback((isOver: boolean) => {
    applyCanvasDropHighlight(isOver);
    setIsCanvasDropActive(isOver);
  }, [applyCanvasDropHighlight]);

  const CONTAINER_WIDTH = useMemo(() => {
    const live = canvasMeasureRef.current
      ? getDashboardLayoutWidth(canvasMeasureRef.current, getDashboardCanvasAvailableWidth(containerDimensions.width))
      : getDashboardCanvasAvailableWidth(containerDimensions.width);
    return live;
  }, [containerDimensions.width]);

  // Seed canvas width from saved dashboard so the first RGL render matches save-time grid math.
  const seededContainerWidthRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isEditMode || !rawDashboardData?.container_width) return;
    const savedAvailableWidth = Math.max(300, Math.round(rawDashboardData.container_width));
    if (seededContainerWidthRef.current === savedAvailableWidth) return;
    seededContainerWidthRef.current = savedAvailableWidth;
    const savedParentWidth = savedAvailableWidth + DASHBOARD_CANVAS_HORIZONTAL_PADDING;
    const liveClientWidth = canvasMeasureRef.current?.clientWidth ?? 0;
    const parentWidth =
      liveClientWidth > 0
        ? isSidebarExpanded
          ? Math.min(savedParentWidth, liveClientWidth)
          : liveClientWidth
        : savedParentWidth;
    const savedHeight = Math.max(
      1,
      Math.round(rawDashboardData.container_height || DEFAULT_CONTAINER_HEIGHT),
    );
    prevContainerRectRef.current = { width: parentWidth, height: savedHeight };
    prevContainerWidthForSyncRef.current = getDashboardCanvasAvailableWidth(parentWidth);
    setContainerDimensions({ width: parentWidth, height: savedHeight });
  }, [isEditMode, rawDashboardData?.container_width, rawDashboardData?.container_height, isSidebarExpanded]);

  // After dashboard load, re-apply saved layout at the saved canvas width (guards stale local state).
  const layoutResyncKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isEditMode || isLoadingDashboard || !rawDashboardData?.layout?.length) return;
    if (dashboardCharts.length === 0) return;

    const savedAvailableWidth = Math.max(300, Math.round(rawDashboardData.container_width || CONTAINER_WIDTH));
    if (Math.abs(CONTAINER_WIDTH - savedAvailableWidth) > 8) return;

    const resyncKey = `${dashboardId ?? 'new'}:${dashboardCharts.map((dc) => dc.id).join('|')}`;
    if (layoutResyncKeyRef.current === resyncKey) return;
    layoutResyncKeyRef.current = resyncKey;

    const layoutById = new Map<string, any>(
      rawDashboardData.layout.map((item: any) => [item.i, item]),
    );

    const savedGridCols =
      typeof rawDashboardData.grid_cols === 'number' && rawDashboardData.grid_cols > 0
        ? rawDashboardData.grid_cols
        : inferSavedGridCols(rawDashboardData.layout);

    setDashboardCharts((prev) => {
      let changed = false;
      const next = prev.map((dc) => {
        const restored = restoreDashboardChartLayoutFromSavedItem(
          layoutById.get(dc.id),
          savedAvailableWidth,
          undefined,
          savedGridCols,
        );
        if (!restored) return dc;
        if (
          gridLayoutEqual(dc.gridLayout, restored.gridLayout) &&
          dc.position.x === restored.position.x &&
          dc.position.y === restored.position.y &&
          dc.size.width === restored.size.width &&
          dc.size.height === restored.size.height
        ) {
          return dc;
        }
        changed = true;
        return {
          ...dc,
          gridLayout: restored.gridLayout,
          position: restored.position,
          size: restored.size,
        };
      });
      return changed ? next : prev;
    });
  }, [
    isEditMode,
    isLoadingDashboard,
    rawDashboardData,
    dashboardCharts.length,
    dashboardId,
    CONTAINER_WIDTH,
    setDashboardCharts,
  ]);

  // Keep px fields aligned with saved grid units when canvas width is measured/resized.
  const prevContainerWidthForSyncRef = useRef<number | null>(null);
  useEffect(() => {
    if (dashboardCharts.length === 0) return;
    if (!dashboardCharts.some((dc) => dc.gridLayout)) return;
    if (prevContainerWidthForSyncRef.current === CONTAINER_WIDTH) return;
    prevContainerWidthForSyncRef.current = CONTAINER_WIDTH;
    setDashboardCharts((prev) => syncDashboardChartsPixelsForWidth(prev, CONTAINER_WIDTH, GRID_COLS));
  }, [CONTAINER_WIDTH, dashboardCharts.length, setDashboardCharts]);

  // Update container dimensions dynamically using ResizeObserver
  useEffect(() => {
    const measureEl = canvasMeasureRef.current;
    if (!measureEl) return;

    // Only update state when the rounded measured dimensions actually change (avoid infinite loops).
    const updateDimensionsIfChanged = (width: number, height: number) => {
      const roundedW = Math.max(1, Math.round(width));
      const roundedH = Math.max(1, Math.round(height));
      const prev = prevContainerRectRef.current;
      const changed = Math.abs(prev.width - roundedW) > 2 || Math.abs(prev.height - roundedH) > 2;
      if (changed) {
        prevContainerRectRef.current = { width: roundedW, height: roundedH };
        setContainerDimensions({ width: roundedW, height: roundedH });
      }
    };

    const measureNow = () => {
      if (isOverCanvasRef.current) return;
      const clientWidth = measureEl.clientWidth;
      const clientHeight = measureEl.clientHeight;
      if (clientWidth > 0 && clientHeight > 0) {
        updateDimensionsIfChanged(clientWidth, clientHeight);
      }
    };

    measureNow();

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries.length) return;
      if (isOverCanvasRef.current) return;
      const entry = entries[0];
      const width = entry.contentRect?.width > 0 ? entry.contentRect.width : measureEl.clientWidth;
      const height = entry.contentRect?.height > 0 ? entry.contentRect.height : measureEl.clientHeight;
      updateDimensionsIfChanged(width, height);
    });

    resizeObserver.observe(measureEl);

    let rafId: number | null = null;
    const handleWindowResize = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(measureNow);
    };
    window.addEventListener('resize', handleWindowResize);

    // Re-measure after sidebar width transition completes
    const timeoutId = window.setTimeout(measureNow, 320);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      if (rafId) cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
    };
  }, [isSidebarExpanded]);

  // Re-measure as soon as the canvas mounts or finishes loading — avoids stale DEFAULT_CONTAINER_WIDTH clipping.
  useLayoutEffect(() => {
    const measureEl = canvasMeasureRef.current;
    if (!measureEl) return;
    const w = measureEl.clientWidth;
    const h = measureEl.clientHeight;
    if (w > 0 && h > 0) {
      const prev = prevContainerRectRef.current;
      const roundedW = Math.max(1, Math.round(w));
      const roundedH = Math.max(1, Math.round(h));
      if (Math.abs(prev.width - roundedW) > 2 || Math.abs(prev.height - roundedH) > 2) {
        prevContainerRectRef.current = { width: roundedW, height: roundedH };
        setContainerDimensions({ width: roundedW, height: roundedH });
      }
    }
  }, [isLoadingDashboard, isSidebarExpanded]);

  const isSavingRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // When switching into edit mode, ensure any ongoing interactions or timers are cleared.
  useEffect(() => {
    if (!isEditMode) return;
    try { cleanupGlobalDragState(); } catch { /* ignore */ }
    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    } catch {
      // ignore
    }
  }, [isEditMode]);

  // Use dashboard save hook
  const { isSaving, handleCreateDashboard } = useDashboardSave(
    dashboardId,
    isEditMode,
    dashboardTitle,
    dashboardCharts, // This will be temporarily updated to original charts before save
    containerDimensions,
    isSidebarExpanded,
    CONTAINER_WIDTH,
    flowId,
    isAnalyticsStudio,
    dashboardAppearance,
  );

  // When we deferred save (auto-collapse), run save after scaling effect has updated dashboardCharts
  useEffect(() => {
    if (pendingSaveDimensions == null || isSaving) return;
    const dims = pendingSaveDimensions;
    setPendingSaveDimensions(null);
    setIsPreparingSave(false);
    isSavingRef.current = true;
    (async () => {
      try {
        abortControllerRef.current = new AbortController();
        await handleCreateDashboard(dims);
      } catch (err) {
        console.warn('Deferred handleCreateDashboard error:', err);
      } finally {
        isSavingRef.current = false;
        try { abortControllerRef.current = null; } catch { /* ignore */ }
      }
    })();
  }, [pendingSaveDimensions, isSaving, handleCreateDashboard]);

  // Cleanup routine to ensure any global pointer/drag state is cleared when leaving
  const cleanupGlobalDragState = () => {
    try {
      // attempt to terminate any captured interactions
      document.dispatchEvent(new MouseEvent('mouseup'));
      document.dispatchEvent(new PointerEvent('pointerup'));
      document.dispatchEvent(new PointerEvent('pointercancel'));
      document.dispatchEvent(new Event('pointerleave'));
      document.dispatchEvent(new Event('pointerout'));
      document.dispatchEvent(new Event('mouseleave'));
    } catch {
      // ignore
    }

    try {
      // Clear refs and flags used by drag handlers so no stale state remains
      try {
        const h = pointerMoveHandlerRef.current;
        if (h && typeof window !== 'undefined') {
          try { window.removeEventListener('mousemove', h); } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
      if (pointerMoveHandlerRef.current) pointerMoveHandlerRef.current = null;
      pointerRef.current = null;
      dropPositionRef.current = null;
      lastOverRef.current = false;
      applyCanvasDropHighlight(false);
      setIsCanvasDropActive(false);
      // If a DnD drag session is active, call the drag end handler to ensure DnD internals clean up
      try {
        if (activeId) {
          try { dragEndHandlerRef.current?.({ active: { id: activeId }, over: null } as unknown as DragEndEvent); } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
      setActiveId(null);
      // blur active element to release any pointer captures on interactive elements
      try { (document.activeElement as HTMLElement | null)?.blur(); } catch { /* ignore */ }
    } catch {
      // ignore
    }
  };

  // Ensure cleanup runs on unmount to avoid leaving global handlers that cause freezes
  useEffect(() => {
    return () => {
      cleanupGlobalDragState();
    };
  }, []);

  // Save dashboard layout to localStorage whenever it changes (auto-save draft for both create and edit)
  useEffect(() => {
    if (dashboardCharts.length > 0) {
      const storageKey = `dashboard-layout-${dashboardId || 'new'}`;
      try {
        const layoutToSave = {
          charts: dashboardCharts.map(dc => ({
            id: dc.id,
            chartId: dc.chartId,
            gridLayout: dc.gridLayout,
            position: dc.position,
            size: dc.size,
          })),
          timestamp: Date.now(),
        };
        localStorage.setItem(storageKey, JSON.stringify(layoutToSave));
      } catch (error) {
        console.error('Failed to save dashboard layout to localStorage:', error);
      }
    }
  }, [dashboardCharts, dashboardId]);

  const addedChartIds = useMemo(() => {
    return new Set(dashboardCharts.map(dc => dc.chartId));
  }, [dashboardCharts]);

  // Filter and sort charts
  const filteredCharts = useMemo(() => {
    let filtered = charts;

    // Search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(chart =>
        chart.chart_name?.toLowerCase().includes(searchLower) ||
        chart.visualization_name?.toLowerCase().includes(searchLower)
      );
    }

    // Sort: Added charts first, then by sort option
    filtered = [...filtered].sort((a, b) => {
      const aIsAdded = addedChartIds.has(a.id);
      const bIsAdded = addedChartIds.has(b.id);

      // Added charts come first
      if (aIsAdded && !bIsAdded) return -1;
      if (!aIsAdded && bIsAdded) return 1;

      // Then sort by selected option
      if (sortBy === 'recent') {
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      } else {
        return (a.chart_name || '').localeCompare(b.chart_name || '');
      }
    });

    return filtered;
  }, [charts, searchTerm, sortBy, addedChartIds]);

  const panelChartFetchRef = useRef<Set<string>>(new Set());

  const fetchPanelChartData = useCallback(async (chartId: number, panelDashboardChartId?: string | null) => {
    const fetchKey = `${panelDashboardChartId ?? activeCustomizerChartId ?? 'none'}-${chartId}`;
    if (panelChartFetchRef.current.has(fetchKey)) return;

    const chartDef = charts.find(c => c.id === chartId);
    if (!chartDef) return;

    panelChartFetchRef.current.add(fetchKey);
    const toastId = toast.loading(`Loading data for chart "${chartDef.chart_name || 'Chart'}"...`);

    try {
      const payload = buildDashboardCreateChartPayload(chartDef, false); // analyticsStudio = false
      const response = await createChart(payload);
      const resp: any = response;

      const vizName = (chartDef.visualization_name || chartDef.chart_type || '').toString().toLowerCase();
      let chartData: any[] = [];
      let chartColumns: string[] = resp.columns || [];

      const isPivotResponse = resp && resp.rows && resp.columns && resp.data && typeof resp.data === 'object' && !Array.isArray(resp.data);
      if (isPivotResponse) {
        const rows = Array.isArray(resp.rows) ? resp.rows : (resp.rows && typeof resp.rows === 'object' ? Object.values(resp.rows) : []);
        let norm: Record<string, any> = resp.data;
        if (Object.keys(norm).length === 1 && norm[Object.keys(norm)[0]] && typeof norm[Object.keys(norm)[0]] === 'object') {
          norm = norm[Object.keys(norm)[0]];
        }
        const rowDimSet = new Set(rows);
        const metricKeys = Object.keys(norm).filter((k: string) => !rowDimSet.has(k));
        const firstRowDim = rows[0];
        const rowIndexSource = norm[firstRowDim] ?? (metricKeys[0] ? norm[metricKeys[0]] : null);
        const rowIndices = rowIndexSource && typeof rowIndexSource === 'object' ? Object.keys(rowIndexSource).sort((a, b) => Number(a) - Number(b)) : [];
        for (const idx of rowIndices) {
          const rowObj: Record<string, any> = {};
          for (const dim of rows) {
            const colData = norm[dim];
            rowObj[dim] = colData && typeof colData === 'object' && idx in colData ? colData[idx] : '';
          }
          for (const colKey of metricKeys) {
            const colData = norm[colKey];
            rowObj[colKey] = colData && typeof colData === 'object' && idx in colData ? colData[idx] : null;
          }
          chartData.push(rowObj);
        }
      } else {
        const rawData = extractDashboardChartResponseRows(resp);
        const chartMetrics = chartDef?.params?.metrics ?? chartDef?.params?.metric ?? chartDef?.params?.mtric;
        chartData = transformDashboardChartRows(rawData, vizName, {
          columns: resp.columns,
          metrics: Array.isArray(chartMetrics) ? chartMetrics : undefined,
          x_axis: resp.x_axis ?? null,
        });
      }

      const panelChartEntry = {
        chartData,
        chartColumns,
        rawResponse: resp,
        chart: chartDef,
        isLoading: false,
      };

      const mergePanelChartsData = (prevParams: any) => ({
        ...(prevParams || {}),
        panel_charts_data: {
          ...(prevParams?.panel_charts_data || {}),
          [chartId]: panelChartEntry,
          [String(chartId)]: panelChartEntry,
        },
      });

      setEditingParams((p: any) => mergePanelChartsData(p));

      const targetPanelId = panelDashboardChartId ?? activeCustomizerChartId;
      if (targetPanelId) {
        setDashboardCharts((prev) =>
          prev.map((dc) => {
            if (dc.id !== targetPanelId) return dc;
            return {
              ...dc,
              chart: {
                ...dc.chart,
                params: mergePanelChartsData(dc.chart.params),
              },
            };
          }),
        );
      }

      toast.success(`Loaded data for ${chartDef.chart_name}`, { id: toastId });
    } catch (error) {
      console.error('Error fetching panel chart data:', error);
      toast.error(`Failed to load data for ${chartDef.chart_name}`, { id: toastId });
    } finally {
      panelChartFetchRef.current.delete(fetchKey);
    }
  }, [charts, activeCustomizerChartId, setDashboardCharts]);

  const panelAddedChartIds = useMemo(() => {
    const items = editingParams.panel_items || [];
    return new Set<number>(
      items
        .filter((item: any) => item.type === 'chart' && item.chartId != null)
        .map((item: any) => Number(item.chartId)),
    );
  }, [editingParams.panel_items]);

  const applyPanelSmartLayout = useCallback((items: any[], params: any, options?: { preserveExisting?: boolean }) => {
    const columns = params?.panel_columns ?? 4;
    const gapXPct = Math.min(6, Math.max(0, (params?.panel_gap_x ?? 4) / 5));
    const gapYPct = Math.min(6, Math.max(0, (params?.panel_gap_y ?? 4) / 5));
    const panelData = params?.panel_charts_data || {};
    const preserveExisting = options?.preserveExisting ?? !!params?.panel_resize_enabled;
    return applySmartPanelLayoutsToItems(
      items,
      (id) => resolvePanelChartVizFromSources(id, panelData, charts),
      columns,
      gapXPct,
      gapYPct,
      { preserveExisting },
    );
  }, [charts]);

  const addChartToPanel = useCallback((chartId: number) => {
    let didAdd = false;
    setEditingParams((p: any) => {
      const currentItems = p.panel_items || [];
      const alreadyAdded = currentItems.some(
        (item: any) => item.type === 'chart' && Number(item.chartId) === chartId,
      );
      if (alreadyAdded) {
        toast.info('This chart is already in the panel');
        return p;
      }
      didAdd = true;
      const chartDef = charts.find((c) => c.id === chartId);
      const newItem = {
        id: Math.random().toString(36).substr(2, 9),
        type: 'chart',
        chartId,
      };
      toast.success(`Added ${chartDef?.chart_name || 'chart'} to panel`);
      const nextItems = [...currentItems, newItem];
      return {
        ...p,
        panel_items: applyPanelSmartLayout(nextItems, p, { preserveExisting: false }),
      };
    });
    if (didAdd) {
      fetchPanelChartData(chartId, activeCustomizerChartId);
    }
  }, [charts, fetchPanelChartData, activeCustomizerChartId, applyPanelSmartLayout]);

  useEffect(() => {
    dashboardCharts.forEach((dc) => {
      const viz = (dc.chart.visualization_name || dc.chart.chart_type || '').toString().toLowerCase();
      if (viz !== 'panel') return;

      const items = dc.chart.params?.panel_items || [];
      const panelData = dc.chart.params?.panel_charts_data || {};

      items.forEach((item: any) => {
        if (item.type !== 'chart' || item.chartId == null) return;
        const snap = getPanelChartSnapshot(panelData, item.chartId);
        const hasData =
          (Array.isArray(snap?.chartData) && snap.chartData.length > 0) ||
          !!snap?.rawResponse;
        if (!hasData) {
          fetchPanelChartData(Number(item.chartId), dc.id);
        }
      });
    });
  }, [dashboardCharts, fetchPanelChartData]);

  const handleUpdateChart = useCallback((id: string, updatedFields: any) => {
    setDashboardCharts((prev) =>
      prev.map((dc) => {
        if (dc.id === id) {
          const newChart = { ...dc.chart };
          if (updatedFields.chart_name !== undefined) {
            newChart.chart_name = updatedFields.chart_name;
          }
          const { chart_name, ...otherFields } = updatedFields;
          if (Object.keys(otherFields).length > 0) {
            newChart.params = { ...(newChart.params || {}) };
            Object.entries(otherFields).forEach(([key, value]) => {
              if (value === undefined || value === null) {
                delete newChart.params![key];
              } else {
                newChart.params![key] = value;
              }
            });
          }
          return {
            ...dc,
            chart: newChart,
          };
        }
        return dc;
      })
    );

    if (id === activeCustomizerChartIdRef.current) {
      customizerLiveSyncSkipRef.current = true;
      setEditingParams((p) => ({ ...p, ...updatedFields }));
    }
  }, [setDashboardCharts]);

  const customizerLiveSyncReadyRef = useRef(false);

  useEffect(() => {
    if (!activeCustomizerChartId) {
      customizerLiveSyncReadyRef.current = false;
      return;
    }
    if (!customizerLiveSyncReadyRef.current) {
      customizerLiveSyncReadyRef.current = true;
      return;
    }
    if (customizerLiveSyncSkipRef.current) {
      customizerLiveSyncSkipRef.current = false;
      return;
    }

    const dc = dashboardCharts.find((c) => c.id === activeCustomizerChartId);
    if (!dc) return;

    const customizerViz = (dc.chart.visualization_name || dc.chart.chart_type || '')
      .toString()
      .toLowerCase();

    handleUpdateChart(activeCustomizerChartId, {
      ...(shouldApplyCustomizerWidgetTitle(customizerViz) ? { chart_name: editingTitle } : {}),
      ...editingParams,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync draft params only; avoid loop on dashboardCharts updates
  }, [activeCustomizerChartId, editingParams, editingTitle, handleUpdateChart]);

  const handleEditChartClick = useCallback((id: string) => {
    const dc = dashboardCharts.find((c) => c.id === id);
    if (!dc) return;

    const vizName = (dc.chart.visualization_name || dc.chart.chart_type || '').toString().toLowerCase();
    const isStaticItem = dc.chartId >= 10001 && dc.chartId <= 10005;

    if (isStaticItem || ['panel', 'text', 'image', 'alert', 'divider'].includes(vizName)) {
      setActiveCustomizerChartId(id);
      return;
    }

    const chartId = dc.chartId ?? dc.chart.id;
    if (chartId) {
      openEmbeddedChartEditor(chartId);
    }
  }, [dashboardCharts, openEmbeddedChartEditor]);

  const handleRemoveChart = useCallback((dashboardChartId: string) => {
    pushUndoSnapshot();
    setDashboardCharts((prev) => prev.filter((dc) => dc.id !== dashboardChartId));
    toast.success('Chart removed from dashboard');
  }, [pushUndoSnapshot, setDashboardCharts]);

  const handleEditChart = useCallback((chart: Chart) => {
    if (chart.id) {
      openEmbeddedChartEditor(chart.id);
    }
  }, [openEmbeddedChartEditor]);

  const handleGridLayoutChange = useCallback((charts: DashboardChart[]) => {
    setDashboardCharts((prev) => {
      if (
        prev.length === charts.length &&
        prev.every((dc, i) => {
          const next = charts[i];
          return (
            dc === next ||
            (gridLayoutEqual(dc.gridLayout, next.gridLayout) &&
              dc.position.x === next.position.x &&
              dc.position.y === next.position.y &&
              dc.size.width === next.size.width &&
              dc.size.height === next.size.height)
          );
        })
      ) {
        return prev;
      }
      return charts;
    });
  }, [setDashboardCharts]);

  const handleStreamChartDataUpdate = useCallback(
    (dashboardChartId: string, merged: StreamChartDataSlice) => {
      setDashboardCharts((prev) =>
        prev.map((dc) =>
          dc.id === dashboardChartId
            ? {
              ...dc,
              chartData: merged.chartData ?? dc.chartData,
              chartColumns: merged.chartColumns ?? dc.chartColumns,
              rawResponse: merged.rawResponse ?? dc.rawResponse,
            }
            : dc,
        ),
      );
    },
    [setDashboardCharts],
  );

  const handleSaveClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    console.log('=== SAVE BUTTON CLICK EVENT FIRED ===');
    e.preventDefault();
    e.stopPropagation();
    console.log('Save button clicked - handler fired!', {
      isSaving,
      dashboardChartsLength: dashboardCharts.length,
      dashboardTitle: dashboardTitle.trim(),
      disabled: isSaving || isPreparingSave || dashboardCharts.length === 0 || !dashboardTitle.trim()
    });

    // Double check validation before proceeding
    if (isSaving || isPreparingSave) {
      console.log('Already saving or preparing save, ignoring click');
      return;
    }
    if (dashboardCharts.length === 0) {
      console.log('No charts, showing error');
      toast.error('Please add at least one chart to the dashboard');
      return;
    }
    if (!dashboardTitle.trim()) {
      console.log('No title, showing error');
      toast.error('Please enter a dashboard title');
      return;
    }

    // When sidebar is expanded, collapse first and defer save until canvas width stabilizes.
    if (isSidebarExpanded) {
      console.log('Collapsing sidebar before save; will save after layout updates...');
      setIsSidebarExpanded(false);
      setIsPreparingSave(true);
      await new Promise(resolve => setTimeout(resolve, 380)); // Wait for collapse animation
      if (!canvasRef.current) {
        setIsPreparingSave(false);
        return;
      }
      try {
        const parent = canvasMeasureRef.current || canvasRef.current;
        const measureStable = async (maxAttempts = 10, delayMs = 80) => {
          let lastW = 0;
          let lastH = 0;
          for (let i = 0; i < maxAttempts; i++) {
            const r = parent.getBoundingClientRect();
            const w = Math.max(1, Math.round(r.width));
            const h = Math.max(1, Math.round(r.height));
            if (w === lastW && h === lastH) return { w, h };
            lastW = w;
            lastH = h;
            await new Promise((res) => setTimeout(res, delayMs));
          }
          const r = parent.getBoundingClientRect();
          return { w: Math.max(1, Math.round(r.width)), h: Math.max(1, Math.round(r.height)) };
        };
        const measured = await measureStable(12, 60);
        const w = measured.w;
        const h = measured.h;
        const availableWidth = getDashboardCanvasAvailableWidth(w);
        setPendingSaveDimensions({
          width: w,
          height: h,
          containerWidth: availableWidth,
          contentHeight: getGridContentHeightFromCharts(dashboardCharts, availableWidth, GRID_COLS),
          rowCount: getGridRowCountFromCharts(dashboardCharts, availableWidth, GRID_COLS),
        });
      } catch (err) {
        console.warn('Error measuring container for save:', err);
        setIsPreparingSave(false);
      }
      return;
    }

    // Sidebar already collapsed: measure and save immediately
    await new Promise(resolve => setTimeout(resolve, 50));
    let saveDimensions: { width: number; height: number; containerWidth: number; contentHeight?: number; rowCount?: number } | undefined;
    if (canvasRef.current) {
      try {
        const parent = canvasMeasureRef.current || canvasRef.current;
        const measureStable = async (maxAttempts = 10, delayMs = 80) => {
          let lastW = 0;
          let lastH = 0;
          for (let i = 0; i < maxAttempts; i++) {
            const r = parent.getBoundingClientRect();
            const w = Math.max(1, Math.round(r.width));
            const h = Math.max(1, Math.round(r.height));
            if (w === lastW && h === lastH) return { w, h };
            lastW = w;
            lastH = h;
            await new Promise((res) => setTimeout(res, delayMs));
          }
          const r = parent.getBoundingClientRect();
          return { w: Math.max(1, Math.round(r.width)), h: Math.max(1, Math.round(r.height)) };
        };
        const measured = await measureStable(12, 60);
        const w = measured.w;
        const h = measured.h;
        const availableWidth = getDashboardCanvasAvailableWidth(w);
        saveDimensions = {
          width: w,
          height: h,
          containerWidth: availableWidth,
          contentHeight: getGridContentHeightFromCharts(dashboardCharts, availableWidth, GRID_COLS),
          rowCount: getGridRowCountFromCharts(dashboardCharts, availableWidth, GRID_COLS),
        };
      } catch (err) {
        console.warn('Error measuring container for save:', err);
      }
    }

    console.log('Calling handleCreateDashboard with measured dimensions:', saveDimensions);
    isSavingRef.current = true;
    try {
      abortControllerRef.current = new AbortController();
      await handleCreateDashboard(saveDimensions);
    } catch (err) {
      console.warn('handleCreateDashboard error or aborted:', err);
    } finally {
      isSavingRef.current = false;
      try { abortControllerRef.current = null; } catch { /* ignore */ }
    }
  };


  const clearDashboardDraft = useCallback(() => {
    try {
      const storageKey = `dashboard-layout-${dashboardId || 'new'}`;
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    setDashboardCharts([]);
    setDashboardTitle('');
    clearUndoHistory();
  }, [dashboardId, setDashboardCharts, setDashboardTitle, clearUndoHistory]);

  const navigateBack = useCallback(() => {
    try {
      cleanupGlobalDragState();
    } catch {
      // ignore
    }
    if (isAnalyticsStudio) {
      setTimeout(() => navigate('/analytic-studio', { state: { tab: 'dashboards' } }), 0);
      return;
    }
    const workflowName = params.workflowname;
    if (workflowName) {
      const workflowFromStore = useFlowStore.getState().currentWorkflow;
      const workflow =
        workflowFromStore && workflowMatchesRouteId(workflowFromStore, workflowName)
          ? workflowFromStore
          : undefined;
      setTimeout(
        () =>
          navigate(`/reconciliation/operations/${workflowName}?tab=analytics&view=recontab`, {
            state: workflow ? { workflow, viewMode: 'recontab' } : undefined,
          }),
        0,
      );
    } else if (isEditMode) {
      setTimeout(() => navigate('/visualization/dashboards'), 0);
    } else {
      setTimeout(() => navigate(-1), 0);
    }
  }, [params.workflowname, currentWorkflow, isEditMode, navigate, isAnalyticsStudio]);

  const navigateOnCancelDiscard = useCallback(() => {
    try {
      cleanupGlobalDragState();
    } catch {
      // ignore
    }
    if (isAnalyticsStudio) {
      setTimeout(() => navigate('/analytic-studio', { state: { tab: 'dashboards' } }), 0);
      return;
    }
    const workflowName = params?.workflowname;
    if (workflowName) {
      const workflowFromStore = useFlowStore.getState().currentWorkflow;
      const workflow =
        workflowFromStore && workflowMatchesRouteId(workflowFromStore, workflowName)
          ? workflowFromStore
          : undefined;
      setTimeout(
        () =>
          navigate(`/reconciliation/operations/${workflowName}?tab=analytics&view=recontab`, {
            state: workflow ? { workflow, viewMode: 'recontab' } : undefined,
          }),
        0,
      );
    } else {
      setTimeout(() => navigate('/visualization/dashboards'), 0);
    }
  }, [params?.workflowname, currentWorkflow, navigate, isAnalyticsStudio]);

  const handleCancel = () => {
    try {
      cleanupGlobalDragState();
    } catch {
      // ignore
    }
    if (isAnalyticsStudio) {
      setTimeout(() => navigate('/analytic-studio', { state: { tab: 'dashboards' } }), 0);
      return;
    }
    const currentPath =
      typeof window !== 'undefined'
        ? window.location.pathname
        : '/visualization/dashboards';
    setTimeout(() => navigate(currentPath, { replace: true }), 0);
  };

  const handleDiscardAndLeaveBack = useCallback(() => {
    setConfirmBackOpen(false);
    clearDashboardDraft();
    navigateBack();
  }, [clearDashboardDraft, navigateBack]);

  const handleDiscardAndLeaveCancel = useCallback(() => {
    setConfirmCancelOpen(false);
    clearDashboardDraft();
    navigateOnCancelDiscard();
  }, [clearDashboardDraft, navigateOnCancelDiscard]);


  // Export dashboard as PNG (uses dynamic import of html2canvas or falls back to print)
  // const handleExportPNG = async () => {
  //   const node = canvasRef.current;
  //   if (!node) {
  //     toast.error('Nothing to export');
  //     return;
  //   }
  //   try {
  //     const link = document.createElement('a');
  //     link.download = `${(dashboardTitle || 'dashboard').replace(/\s+/g, '_')}.png`;
  //     document.body.appendChild(link);
  //     link.click();
  //     link.remove();
  //     toast.success('Exported PNG');
  //   } catch (err) {
  //     console.warn('html2canvas failed, falling back to print', err);
  //     window.print();
  //   }
  // };

  return (
    <>
      <div className="flex flex-col flex-1 min-h-0 w-full bg-background overflow-hidden">
        <div className="flex flex-col flex-1 min-h-0 w-full overflow-hidden">
          {/* Header */}
          <div
            className="relative z-30 flex-shrink-0 border-b border-border bg-card px-2 py-1 pt-0 shadow-sm"
            style={{ pointerEvents: 'auto' }}
          >
            <div className="flex items-center gap-4 min-w-0" style={{ pointerEvents: 'auto' }}>
              <div className="flex items-center gap-2 shrink-0">
              <Popover open={confirmBackOpen} onOpenChange={setConfirmBackOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={isSaving || isPreparingSave}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (hasUnsavedChanges) {
                        setConfirmBackOpen(true);
                        return;
                      }
                      navigateBack();
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="h-8 w-8 hover:bg-muted"
                  >
                    <ArrowLeft className="!h-5 !w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 p-2">
                  <div className="text-sm">You have unsaved changes. Discard and leave?</div>
                  <div className="mt-0 flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmBackOpen(false)}
                      className="!h-7"
                    >
                      No
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="!h-7"
                      onClick={handleDiscardAndLeaveBack}
                    >
                      Yes
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 shrink-0">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <h1 className="text-base font-semibold whitespace-nowrap">
                  {isAnalyticsStudio
                    ? isEditMode
                      ? 'Analytics Studio — Edit Dashboard'
                      : 'Analytics Studio — Create Dashboard'
                    : isEditMode
                      ? 'Edit Dashboard'
                      : 'Create New Dashboard'}
                </h1>
              </div>
              </div>

              <div className="flex-1 flex items-center justify-center min-w-0 px-2">
                <Input
                  placeholder="Enter dashboard title"
                  value={dashboardTitle}
                  onFocus={pushUndoSnapshot}
                  onChange={(e) => setDashboardTitle(e.target.value)}
                  onBlur={() => { }}
                  aria-label="Dashboard title"
                  className="h-9 max-w-lg w-full text-center text-sm font-semibold bg-muted/40 border-border/60 focus-visible:bg-background"
                />
              </div>

              <div className="ml-auto flex items-center gap-2 shrink-0" style={{ pointerEvents: 'auto', zIndex: 10 }}>
                <div className="flex items-center gap-0.5 rounded-lg border border-border/60 bg-muted/30 p-0.5">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Dashboard appearance"
                  disabled={isSaving || isPreparingSave}
                  onClick={openDashboardAppearanceSheet}
                  className="!h-8 !w-8 border-0 bg-transparent shadow-none hover:bg-background"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Undo (Ctrl+Z)"
                  disabled={!canUndo || isSaving || isPreparingSave}
                  onClick={undoDashboardAction}
                  className="!h-8 !w-8 border-0 bg-transparent shadow-none hover:bg-background"
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Redo (Ctrl+Shift+Z)"
                  disabled={!canRedo || isSaving || isPreparingSave}
                  onClick={redoDashboardAction}
                  className="!h-8 !w-8 border-0 bg-transparent shadow-none hover:bg-background"
                >
                  <Redo2 className="h-4 w-4" />
                </Button>
                </div>
                <Badge variant="secondary" className="h-7 px-2.5 text-xs font-medium shrink-0">
                  {dashboardCharts.length} {dashboardCharts.length === 1 ? 'chart' : 'charts'}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = !isSidebarExpanded;
                    setIsSidebarExpanded(next);
                    setTimeout(() => {
                      if (!canvasMeasureRef.current) return;
                      try {
                        const r = canvasMeasureRef.current.getBoundingClientRect();
                        const w = Math.max(1, Math.round(r.width));
                        const h = Math.max(1, Math.round(r.height));
                        setContainerDimensions({ width: w, height: h });
                      } catch {
                        // ignore
                      }
                    }, 40);
                  }}
                  className="h-8 w-8"
                  aria-label={isSidebarExpanded ? 'Collapse charts sidebar' : 'Expand charts sidebar'}
                >
                  {isSidebarExpanded ? <ChevronLeft className="!h-4 !w-4" /> : <ChevronRight className="!h-4 !w-4" />}
                </Button>
                <Button
                  ref={saveButtonRef}
                  onClick={handleSaveClick}
                  disabled={isSaving || isPreparingSave || dashboardCharts.length === 0 || !dashboardTitle.trim()}
                  className="!h-8 px-2 py-1 "
                  type="button"
                  style={{ pointerEvents: 'auto', position: 'relative', zIndex: 1000 }}
                  onMouseDown={(e) => {
                    console.log('Save button onMouseDown fired', {
                      isSaving,
                      isPreparingSave,
                      dashboardChartsLength: dashboardCharts.length,
                      dashboardTitle: dashboardTitle.trim(),
                      disabled: isSaving || isPreparingSave || dashboardCharts.length === 0 || !dashboardTitle.trim()
                    });
                    e.stopPropagation();
                  }}
                  onPointerDown={(e) => {
                    console.log('Save button onPointerDown fired', {
                      isSaving,
                      isPreparingSave,
                      dashboardChartsLength: dashboardCharts.length,
                      dashboardTitle: dashboardTitle.trim(),
                      disabled: isSaving || isPreparingSave || dashboardCharts.length === 0 || !dashboardTitle.trim(),
                      buttonElement: e.currentTarget,
                      isButtonDisabled: (e.currentTarget as HTMLButtonElement).disabled
                    });

                    // If button is disabled, onClick won't fire, so handle it here as fallback
                    const isDisabled = isSaving || isPreparingSave || dashboardCharts.length === 0 || !dashboardTitle.trim();
                    if (!isDisabled) {
                      console.log('Button enabled, triggering handleSaveClick from onPointerDown');
                      e.preventDefault();
                      e.stopPropagation();
                      // Small delay to ensure state is current, then trigger click handler
                      setTimeout(() => {
                        handleSaveClick(e as unknown as React.MouseEvent<HTMLButtonElement>);
                      }, 0);
                    } else {
                      console.log('Button is disabled, click ignored', {
                        isSaving,
                        hasCharts: dashboardCharts.length > 0,
                        hasTitle: !!dashboardTitle.trim(),
                        dashboardTitleValue: dashboardTitle
                      });
                      // Show helpful error message
                      if (!dashboardTitle.trim()) {
                        toast.error('Please enter a dashboard title first');
                      } else if (dashboardCharts.length === 0) {
                        toast.error('Please add at least one chart to the dashboard');
                      }
                    }
                  }}
                >
                  {(isSaving || isPreparingSave) ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span>{isEditMode ? 'Updating...' : 'Creating...'}</span>
                    </>
                  ) : (
                    <span>{isEditMode ? 'Update' : 'Save'}</span>
                  )}
                </Button>
                <Popover open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={isSaving || isPreparingSave}
                      className="!h-8 !px-2 border-muted-foreground/20 hover:bg-muted"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (hasUnsavedChanges) {
                          setConfirmCancelOpen(true);
                          return;
                        }
                        handleCancel();
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      Cancel
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-64 p-2">
                    <div className="text-sm">You have unsaved changes. Discard and leave?</div>
                    <div className="mt-0 flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setConfirmCancelOpen(false)} className='!h-7'>No</Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="!h-7"
                        onClick={handleDiscardAndLeaveCancel}
                      >
                        Yes
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>

              </div>
            </div>
          </div>
          {/* Content - Canvas + Sidebar */}
          <div className="flex flex-1 min-h-0 w-full overflow-hidden bg-background">
            <DashboardBody
              isLoadingDashboard={isLoadingDashboard}
              dashboardCharts={dashboardCharts}
              setDashboardCharts={setDashboardCharts}
              dropSurfaceRef={dropSurfaceRef}
              onCanvasOverChange={onCanvasOverChange}
              CONTAINER_WIDTH={CONTAINER_WIDTH}
              canvasRef={canvasRef}
              canvasMeasureRef={canvasMeasureRef}
              dashboardRefreshGeneration={dashboardRefreshGeneration}
              onRemoveChart={handleRemoveChart}
              onGridLayoutChange={handleGridLayoutChange}
              onStreamChartDataUpdate={handleStreamChartDataUpdate}
              formatVisualizationName={formatVisualizationName}
              isSidebarExpanded={isSidebarExpanded}
              setIsSidebarExpanded={setIsSidebarExpanded}
              filteredCharts={filteredCharts}
              addedChartIds={addedChartIds}
              onUpdateChart={handleUpdateChart}
              onEditChart={handleEditChartClick}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              sortBy={sortBy}
              setSortBy={setSortBy}
              activeId={activeId}
              setActiveId={setActiveId}
              isLoadingCharts={isLoadingCharts}
              charts={charts}
              pointerMoveHandlerRef={pointerMoveHandlerRef}
              pointerRef={pointerRef}
              dropPositionRef={dropPositionRef}
              lastOverRef={lastOverRef}
              dragEndHandlerRef={dragEndHandlerRef}
              onRefetchCharts={handleRefetchSidebarCharts}
              onDeleteSidebarChart={handleDeleteSidebarChart}
              deletingChartId={deletingSidebarChartId}
              isRefreshingCharts={isRefreshingSidebarCharts}
              analyticsStudio={isAnalyticsStudio}
              pushUndoSnapshot={pushUndoSnapshot}
              canvasBackgroundStyle={canvasBackgroundStyle}
              isCanvasDropActive={isCanvasDropActive}
            />
          </div>
        </div>
      </div>

      <Sheet
        modal={false}
        open={isDashboardAppearanceOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsDashboardAppearanceOpen(false);
            setEditingDashboardAppearance(cloneDashboardAppearance(dashboardAppearance));
          }
        }}
      >
        <SheetContent
          onFocusOutside={(e) => {
            e.preventDefault();
          }}
          onInteractOutside={preventSheetDismissForPortaledMenus}
          onPointerDownOutside={preventSheetDismissForPortaledMenus}
          className="sm:max-w-[420px] flex flex-col h-full bg-card px-4 py-0 shadow-2xl border-l z-[1000]"
        >
          <SheetHeader className="shrink-0 pb-2 border-b px-2 py-2">
            <SheetTitle className="text-lg font-bold flex items-center gap-1">
              <Pencil className="!w-5 !h-5 text-primary" />
              Dashboard Appearance
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              Customize the canvas background color and opacity.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto py-4 space-y-6 min-h-0 pr-1">
            <div className="space-y-3">
              <Label className="text-xs font-semibold">Background Palette</Label>
              <div className="grid grid-cols-2 gap-2">
                {DASHBOARD_BACKGROUND_PALETTE.map((swatch) => (
                  <button
                    key={swatch.value}
                    type="button"
                    onClick={() =>
                      setEditingDashboardAppearance((prev) => ({ ...prev, bgColor: swatch.value }))
                    }
                    className={`flex items-center gap-2 p-2 border rounded-lg text-left text-xs font-medium hover:bg-muted/50 transition-colors ${editingDashboardAppearance.bgColor.toLowerCase() === swatch.value.toLowerCase()
                      ? 'border-primary ring-2 ring-primary/20 bg-muted/40'
                      : 'border-muted'
                      }`}
                  >
                    <span
                      className="w-4 h-4 rounded-full border flex-shrink-0"
                      style={
                        swatch.value === 'theme'
                          ? {
                              backgroundColor: 'hsl(var(--background))',
                              boxShadow: 'inset 0 0 0 1px hsl(var(--border))',
                            }
                          : { backgroundColor: swatch.value }
                      }
                    />
                    {swatch.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs font-semibold">Custom Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={
                    editingDashboardAppearance.bgColor === 'theme'
                      ? '#f1f5f9'
                      : editingDashboardAppearance.bgColor
                  }
                  onChange={(e) =>
                    setEditingDashboardAppearance((prev) => ({ ...prev, bgColor: e.target.value }))
                  }
                  className="w-10 h-10 rounded border cursor-pointer p-0 bg-transparent"
                />
                <Input
                  value={editingDashboardAppearance.bgColor}
                  onChange={(e) =>
                    setEditingDashboardAppearance((prev) => ({ ...prev, bgColor: e.target.value }))
                  }
                  className="h-9 text-xs font-mono flex-1"
                  placeholder="#ffffff or theme"
                />
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Background Opacity</Label>
                <span className="text-xs font-mono text-muted-foreground">
                  {editingDashboardAppearance.bgOpacity}%
                </span>
              </div>
              <Slider
                min={0}
                max={100}
                step={1}
                value={[editingDashboardAppearance.bgOpacity]}
                onValueChange={([value]) =>
                  setEditingDashboardAppearance((prev) => ({
                    ...prev,
                    bgOpacity: value ?? prev.bgOpacity,
                  }))
                }
              />
              <p className="text-[10px] text-muted-foreground">
                Lower opacity lets the default canvas show through.
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs font-semibold">Preview</Label>
              <div
                className="h-20 w-full rounded-lg border"
                style={resolveDashboardCanvasBackgroundStyle(
                  editingDashboardAppearance,
                  isDarkDashboardTheme,
                )}
              />
            </div>
          </div>

          <SheetFooter className="shrink-0 border-t py-3 px-2 flex flex-row gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="!h-8"
              onClick={resetDashboardAppearanceDraft}
            >
              Reset
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="!h-8"
                onClick={() => {
                  setIsDashboardAppearanceOpen(false);
                  setEditingDashboardAppearance(cloneDashboardAppearance(dashboardAppearance));
                }}
              >
                Cancel
              </Button>
              <Button type="button" size="sm" className="!h-8" onClick={applyDashboardAppearance}>
                Apply
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet
        modal={false}
        open={!!activeCustomizerChartId}
        onOpenChange={(open) => !open && setActiveCustomizerChartId(null)}
      >
        <SheetContent
          onFocusOutside={(e) => {
            e.preventDefault();
          }}
          onInteractOutside={preventSheetDismissForPortaledMenus}
          onPointerDownOutside={preventSheetDismissForPortaledMenus}
          className="sm:max-w-[420px] flex flex-col h-full bg-card px-4 py-0 shadow-2xl border-l z-[1000]"
        >
          <SheetHeader className="shrink-0 pb-2 border-b px-2 py-2">
            <SheetTitle className="text-lg font-bold flex items-center gap-1">
              <Sparkles className="!w-5 !h-5 text-primary animate-pulse" />
              Customize Widget
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              Configure parameters, styling options, and layouts.
            </SheetDescription>
          </SheetHeader>

          {customizingChart && (
            <div className="flex-1 overflow-y-auto py-0 space-y-2 min-h-0 pr-1">
              {/* General Settings */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">General Settings</h4>
                {!shouldShowWidgetTitleCustomizer(
                  (customizingChart.chart.visualization_name || customizingChart.chart.chart_type || '').toString().toLowerCase(),
                ) ? null : (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="customizer-widget-title" className="text-xs font-semibold">Widget Title</Label>
                      <Input
                        id="customizer-widget-title"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        placeholder="Enter title..."
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Widget Title Size</Label>
                      <Select
                        modal={false}
                        value={editingParams.widget_title_size || 'lg'}
                        onValueChange={(val) => setEditingParams((p: any) => ({ ...p, widget_title_size: val }))}
                      >
                        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent className="z-[1200]">
                          <SelectItem value="xs">Extra Small</SelectItem>
                          <SelectItem value="sm">Small</SelectItem>
                          <SelectItem value="base">Medium</SelectItem>
                          <SelectItem value="lg">Large (Default)</SelectItem>
                          <SelectItem value="xl">X Large</SelectItem>
                          <SelectItem value="2xl">2X Large</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {(customizingChart.chart.visualization_name || customizingChart.chart.chart_type || '').toString().toLowerCase() === 'text' && (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Title Alignment</Label>
                        <Select
                          modal={false}
                          value={editingParams.widget_title_align || 'center'}
                          onValueChange={(val) => setEditingParams((p: any) => ({ ...p, widget_title_align: val }))}
                        >
                          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent className="z-[1200]">
                            <SelectItem value="left">Left</SelectItem>
                            <SelectItem value="center">Middle</SelectItem>
                            <SelectItem value="right">Right</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Dynamic Chart Options */}
              {!['panel', 'text', 'image', 'alert', 'divider'].includes(
                (customizingChart.chart.visualization_name || customizingChart.chart.chart_type || '').toString().toLowerCase()
              ) && (
                  <div className="space-y-1 pt-2 border-t">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Visual Customizations</h4>

                    <div className="flex items-center justify-between py-1">
                      <Label htmlFor="customizer-toggle-legend" className="flex flex-col gap-0.5 cursor-pointer">
                        <span className="text-xs font-semibold">Show Legend</span>
                        <span className="text-[10px] text-muted-foreground font-normal">Toggle visibility of chart legend</span>
                      </Label>
                      <Switch
                        id="customizer-toggle-legend"
                        checked={editingParams.showLegend !== false}
                        onCheckedChange={(checked) => setEditingParams((p: any) => ({ ...p, showLegend: checked }))}
                      />
                    </div>

                    <div className="flex items-center justify-between py-1">
                      <Label htmlFor="customizer-toggle-grid" className="flex flex-col gap-0.5 cursor-pointer">
                        <span className="text-xs font-semibold">Show Grid Lines</span>
                        <span className="text-[10px] text-muted-foreground font-normal">Toggle grid guides behind series</span>
                      </Label>
                      <Switch
                        id="customizer-toggle-grid"
                        checked={editingParams.showGridLines !== false}
                        onCheckedChange={(checked) => setEditingParams((p: any) => ({ ...p, showGridLines: checked }))}
                      />
                    </div>

                    <div className="flex items-center justify-between py-1">
                      <Label htmlFor="customizer-toggle-values" className="flex flex-col gap-0.5 cursor-pointer">
                        <span className="text-xs font-semibold">Show Data Values</span>
                        <span className="text-[10px] text-muted-foreground font-normal">Display text values on top of slices or bars</span>
                      </Label>
                      <Switch
                        id="customizer-toggle-values"
                        checked={!!editingParams.showValues}
                        onCheckedChange={(checked) => setEditingParams((p: any) => ({ ...p, showValues: checked }))}
                      />
                    </div>

                    {/* Big Number Specific */}
                    {((customizingChart.chart.visualization_name || customizingChart.chart.chart_type || '').toString().toLowerCase().includes('big')) && (
                      <div className="space-y-1 pt-2 border-t">
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold">Number Font Size</Label>
                          <Select
                            modal={false}
                            value={editingParams.bigNumberFontSize || 'small'}
                            onValueChange={(val) => setEditingParams((p: any) => ({ ...p, bigNumberFontSize: val }))}
                          >
                            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent className="z-[1200]">
                              <SelectItem value="small">Small</SelectItem>
                              <SelectItem value="normal">Normal</SelectItem>
                              <SelectItem value="large">Large</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs font-semibold">Description Font Size</Label>
                          <Select
                            modal={false}
                            value={editingParams.subheaderFontSize || 'large'}
                            onValueChange={(val) => setEditingParams((p: any) => ({ ...p, subheaderFontSize: val }))}
                          >
                            <SelectTrigger className="!h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent className="z-[1200]">
                              <SelectItem value="small">Small</SelectItem>
                              <SelectItem value="normal">Normal</SelectItem>
                              <SelectItem value="large">Large</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center justify-between py-1">
                          <Label htmlFor="customizer-bignumber-bold" className="flex flex-col gap-0.5 cursor-pointer">
                            <span className="text-xs font-semibold">Bold Big Number</span>
                            <span className="text-[10px] text-muted-foreground font-normal">Render main number text in bold</span>
                          </Label>
                          <Switch
                            id="customizer-bignumber-bold"
                            checked={editingParams.bigNumberBold !== false}
                            onCheckedChange={(checked) => setEditingParams((p: any) => ({ ...p, bigNumberBold: checked }))}
                          />
                        </div>

                        <div className="flex items-center justify-between py-1">
                          <Label htmlFor="customizer-subheader-bold" className="flex flex-col gap-0.5 cursor-pointer">
                            <span className="text-xs font-semibold">Bold Description</span>
                            <span className="text-[10px] text-muted-foreground font-normal">Render subheader text in bold</span>
                          </Label>
                          <Switch
                            id="customizer-subheader-bold"
                            checked={!!editingParams.subheaderBold}
                            onCheckedChange={(checked) => setEditingParams((p: any) => ({ ...p, subheaderBold: checked }))}
                          />
                        </div>
                      </div>
                    )}

                    {/* Color Palette Choice */}
                    <div className="space-y-2 pt-3 border-t">
                      <Label className="text-xs font-semibold">Color Theme</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { name: 'Default Slate', value: 'slate' },
                          { name: 'Vibrant Indigo', value: 'indigo' },
                          { name: 'Forest Green', value: 'emerald' },
                          { name: 'Sunrise Orange', value: 'amber' },
                          { name: 'Crimson Rose', value: 'rose' },
                          { name: 'Classic Blue', value: 'blue' }
                        ].map((theme) => (
                          <button
                            key={theme.value}
                            onClick={() => setEditingParams((p: any) => ({ ...p, colorScheme: theme.value }))}
                            className={`flex items-center gap-2 p-2 border rounded-lg text-left text-xs font-medium hover:bg-muted/50 transition-colors ${editingParams.colorScheme === theme.value ? 'border-primary ring-2 ring-primary/20 bg-muted/40' : 'border-muted'
                              }`}
                          >
                            <span className={`w-3.5 h-3.5 rounded-full bg-${theme.value}-500 flex-shrink-0`} style={{
                              backgroundColor: theme.value === 'slate' ? '#64748b' :
                                theme.value === 'indigo' ? '#6366f1' :
                                  theme.value === 'emerald' ? '#10b981' :
                                    theme.value === 'amber' ? '#f59e0b' :
                                      theme.value === 'rose' ? '#f43f5e' : '#3b82f6'
                            }} />
                            {theme.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

              {/* Text block uses Widget Title + alignment from General Settings only */}

              {/* Alert Block Specific */}
              {(customizingChart.chart.visualization_name || customizingChart.chart.chart_type || '').toString().toLowerCase() === 'alert' && (
                <div className="space-y-4 pt-4 border-t">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Alert Banner Content</h4>
                  <div className="space-y-2">
                    <Label htmlFor="customizer-alert-title" className="text-xs font-semibold">Alert Title</Label>
                    <Input
                      id="customizer-alert-title"
                      value={editingParams.alert_title ?? 'Status Update'}
                      onChange={(e) => setEditingParams((p: any) => ({ ...p, alert_title: e.target.value }))}
                      placeholder="Enter title..."
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customizer-alert-message" className="text-xs font-semibold">Alert Message</Label>
                    <Input
                      id="customizer-alert-message"
                      value={editingParams.alert_message ?? 'All data ingestion jobs running healthy'}
                      onChange={(e) => setEditingParams((p: any) => ({ ...p, alert_message: e.target.value }))}
                      placeholder="Enter message..."
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Background Color</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={editingParams.alert_bg_color || '#e6f4ea'}
                          onChange={(e) => setEditingParams((p: any) => ({ ...p, alert_bg_color: e.target.value }))}
                          className="w-8 h-8 rounded border cursor-pointer p-0 bg-transparent"
                        />
                        <span className="text-xs font-mono">{editingParams.alert_bg_color || '#e6f4ea'}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Text Color</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={editingParams.alert_text_color || '#137333'}
                          onChange={(e) => setEditingParams((p: any) => ({ ...p, alert_text_color: e.target.value }))}
                          className="w-8 h-8 rounded border cursor-pointer p-0 bg-transparent"
                        />
                        <span className="text-xs font-mono">{editingParams.alert_text_color || '#137333'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <Label className="text-[11px] text-muted-foreground">Predefined Themes</Label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { name: 'Success Green', bg: '#e6f4ea', text: '#137333' },
                        { name: 'Warning Amber', bg: '#fef7e0', text: '#b06000' },
                        { name: 'Danger Red', bg: '#fce8e6', text: '#c5221f' },
                        { name: 'Info Blue', bg: '#e8f0fe', text: '#1a73e8' }
                      ].map((theme, idx) => (
                        <button
                          key={idx}
                          onClick={() => setEditingParams((p: any) => ({
                            ...p,
                            alert_bg_color: theme.bg,
                            alert_text_color: theme.text
                          }))}
                          className="flex flex-col items-center justify-center p-1.5 border rounded-md hover:bg-muted/50 transition-colors text-[10px] gap-1 text-center"
                          style={{ borderColor: editingParams.alert_bg_color === theme.bg ? theme.text : 'var(--border)' }}
                        >
                          <span className="w-4 h-4 rounded-full border" style={{ backgroundColor: theme.bg }} />
                          <span className="truncate max-w-full font-medium" style={{ color: theme.text }}>{theme.name.split(' ')[0]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
{/* Panel Block Specific */}
{(customizingChart.chart.visualization_name || customizingChart.chart.chart_type || '').toString().toLowerCase() === 'panel' && (
                <div className="pt-4 border-t">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Panel Configuration</h4>

                  {/* Tab bar */}
                  <div className="flex items-center gap-4 border-b mb-4">
                    {([
                      { key: 'properties', label: 'Properties' },
                      { key: 'style', label: 'Style' },
                      { key: 'background', label: 'Background' },
                    ] as const).map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setPanelCustomizerTab(tab.key)}
                        className={`pb-2 text-xs font-semibold -mb-px border-b-2 transition-colors ${
                          panelCustomizerTab === tab.key
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* ===== Properties Tab ===== */}
                  {panelCustomizerTab === 'properties' && (
                    <div className="space-y-4">
                      {/* <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Columns Count</Label>
                        <Select
                          modal={false}
                          value={String(editingParams.panel_columns || '4')}
                          onValueChange={(val) => setEditingParams((p: any) => ({ ...p, panel_columns: parseInt(val) }))}
                        >
                          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent className="z-[1200]">
                            <SelectItem value="1">1 Column</SelectItem>
                            <SelectItem value="2">2 Columns</SelectItem>
                            <SelectItem value="3">3 Columns</SelectItem>
                            <SelectItem value="4">4 Columns (Default)</SelectItem>
                            <SelectItem value="5">5 Columns</SelectItem>
                            <SelectItem value="6">6 Columns</SelectItem>
                          </SelectContent>
                        </Select>
                      </div> */}


<div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Columns Count</Label>
                        <Select
                          modal={false}
                          value={String(editingParams.panel_columns || '4')}
                          onValueChange={(val) => {
                            const newColumns = parseInt(val);
                            setEditingParams((p: any) => ({
                              ...p,
                              panel_columns: newColumns,
                              panel_items: applyPanelSmartLayout(
                                reflowPanelChartItems(p.panel_items || []),
                                { ...p, panel_columns: newColumns },
                                { preserveExisting: false },
                              ),
                            }));
                          }}
                        >
                          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent className="z-[1200]">
                            <SelectItem value="1">1 Column</SelectItem>
                            <SelectItem value="2">2 Columns</SelectItem>
                            <SelectItem value="3">3 Columns</SelectItem>
                            <SelectItem value="4">4 Columns (Default)</SelectItem>
                            <SelectItem value="5">5 Columns</SelectItem>
                            <SelectItem value="6">6 Columns</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center justify-between py-1">
                        <Label htmlFor="customizer-panel-grid-lines" className="flex flex-col items-start gap-0.5 cursor-pointer">
                          <span className="text-xs font-semibold">Show Cell Borders</span>
                        </Label>
                        <Switch
                          id="customizer-panel-grid-lines"
                          checked={editingParams.panel_show_grid_lines !== false}
                          onCheckedChange={(checked) => setEditingParams((p: any) => ({ ...p, panel_show_grid_lines: checked }))}
                        />
                      </div>

                      <div className="space-y-3 pt-2 border-t">
  <div className="flex items-center justify-between">
    <Label className="text-xs font-semibold">Horizontal Gap</Label>
    <span className="text-[10px] font-mono text-muted-foreground">
      {editingParams.panel_gap_x ?? 4}px
    </span>
  </div>
  <Slider
    min={0}
    max={32}
    step={1}
    value={[editingParams.panel_gap_x ?? 4]}
    onValueChange={([value]) =>
      setEditingParams((p: any) => {
        const next = { ...p, panel_gap_x: value };
        if (p.panel_resize_enabled) return next;
        return {
          ...next,
          panel_items: applyPanelSmartLayout(
            reflowPanelChartItems(p.panel_items || []),
            next,
            { preserveExisting: false },
          ),
        };
      })
    }
  />

  <div className="flex items-center justify-between">
    <Label className="text-xs font-semibold">Vertical Gap</Label>
    <span className="text-[10px] font-mono text-muted-foreground">
      {editingParams.panel_gap_y ?? 4}px
    </span>
  </div>
  <Slider
    min={0}
    max={32}
    step={1}
    value={[editingParams.panel_gap_y ?? 4]}
    onValueChange={([value]) =>
      setEditingParams((p: any) => {
        const next = { ...p, panel_gap_y: value };
        if (p.panel_resize_enabled) return next;
        return {
          ...next,
          panel_items: applyPanelSmartLayout(
            reflowPanelChartItems(p.panel_items || []),
            next,
            { preserveExisting: false },
          ),
        };
      })
    }
  />
  <p className="text-[10px] text-muted-foreground">
    Set to 0 for edge-to-edge cards. Spacing updates when charts re-flow.
  </p>
</div>

                      <div className="flex items-center justify-between py-1">
                        <Label htmlFor="customizer-panel-resize-enabled" className="flex flex-col items-start gap-0.5 cursor-pointer">
                          <span className="text-xs font-semibold">Allow Chart Resizing</span>
                          <span className="text-[10px] text-muted-foreground font-normal">Let users drag to resize/move charts inside this panel</span>
                        </Label>
                        <Switch
                          id="customizer-panel-resize-enabled"
                          checked={!!editingParams.panel_resize_enabled}
                          onCheckedChange={(checked) => setEditingParams((p: any) => {
                            if (checked) {
                              return {
                                ...p,
                                panel_resize_enabled: true,
                                panel_items: applyPanelSmartLayout(
                                  p.panel_items || [],
                                  { ...p, panel_resize_enabled: true },
                                ),
                              };
                            }
                            const cleared = reflowPanelChartItems(p.panel_items || []);
                            return {
                              ...p,
                              panel_resize_enabled: false,
                              panel_items: applyPanelSmartLayout(cleared, p, { preserveExisting: false }),
                            };
                          })}
                        />
                      </div>

                      {/* Panel charts — In panel / Ready to add (matches sidebar) */}
                      <div className="space-y-4 pt-2 border-t">
                        <section className="space-y-2">
                          <div className="flex items-center justify-between gap-1.5 flex-wrap">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              In panel ({(editingParams.panel_items || []).filter((item: any) => item.type === 'chart').length})
                            </p>
                            {(editingParams.panel_items || []).some((i: any) => i.type === 'chart') && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[10px] px-2"
                                onClick={() => setEditingParams((p: any) => ({
                                  ...p,
                                  panel_items: applyPanelSmartLayout(
                                    reflowPanelChartItems(p.panel_items || []),
                                    p,
                                    { preserveExisting: false },
                                  ),
                                }))}
                              >
                                Reset layout
                              </Button>
                            )}
                          </div>

                          <PanelItemsDraggableList
                            items={(editingParams.panel_items || []).filter((item: any) => item.type === 'chart')}
                            allItems={editingParams.panel_items || []}
                            charts={charts}
                            formatVisualizationName={formatVisualizationName}
                            showRemove={!!editingParams.panel_resize_enabled}
                            onReorder={(reordered) => setEditingParams((p: any) => ({
                              ...p,
                              panel_items: p.panel_resize_enabled
                                ? reordered
                                : applyPanelSmartLayout(reordered, p),
                            }))}
                            onRemove={(itemId) => {
                              setEditingParams((p: any) => {
                                const nextItems = (p.panel_items || []).filter((i: any) => i.id !== itemId);
                                return {
                                  ...p,
                                  panel_items: p.panel_resize_enabled
                                    ? nextItems
                                    : applyPanelSmartLayout(nextItems, p),
                                };
                              });
                            }}
                          />
                        </section>

                        <section className="space-y-2 pt-2 border-t">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Ready to add
                          </p>
                          <PanelAvailableChartsList
                            charts={charts}
                            addedChartIds={panelAddedChartIds}
                            formatVisualizationName={formatVisualizationName}
                            onAddChart={addChartToPanel}
                          />
                        </section>
                      </div>
                    </div>
                  )}

                  {/* ===== Style Tab ===== */}
                  {panelCustomizerTab === 'style' && (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Background Color</Label>
                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            type="color"
                            value={editingParams.panel_bg_color || '#ffffff'}
                            onChange={(e) => setEditingParams((p: any) => ({ ...p, panel_bg_color: e.target.value }))}
                            className="w-8 h-8 rounded border cursor-pointer p-0 bg-transparent"
                          />
                          <span className="text-xs font-mono">
                            {editingParams.panel_bg_color || 'Default (transparent)'}
                          </span>
                          {editingParams.panel_bg_color && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-[10px] px-2 text-destructive hover:text-destructive"
                              onClick={() => setEditingParams((p: any) => ({ ...p, panel_bg_color: null }))}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ===== Background Tab ===== */}
                  {panelCustomizerTab === 'background' && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Background Image</Label>
                      {editingParams.panel_bg_image ? (
                        <div className="relative border rounded-lg overflow-hidden h-24 bg-muted/20 flex items-center justify-center">
                          <img src={editingParams.panel_bg_image} className="w-full h-full object-cover" />
                          <button
                            onClick={() => setEditingParams((p: any) => { const copy = { ...p }; delete copy.panel_bg_image; return copy; })}
                            className="absolute top-1.5 right-1.5 bg-destructive text-destructive-foreground p-1 rounded-full shadow hover:bg-destructive/90 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 hover:border-primary/50 transition-colors cursor-pointer bg-muted/5">
                          <Upload className="w-5 h-5 text-muted-foreground/45 mb-1" />
                          <span className="text-xs font-semibold text-muted-foreground/80">Upload Background Image</span>
                          <span className="text-[10px] text-muted-foreground/50 mt-0.5">PNG, JPG or WebP</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                  const base64 = ev.target?.result as string;
                                  if (base64) {
                                    setEditingParams((p: any) => ({ ...p, panel_bg_image: base64 }));
                                  }
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                      )}

                      {editingParams.panel_bg_image && (
                        <>
                          {/* Card gutter — image stays full-fill, cards shift to leave it visible */}
                          <div className="space-y-1.5 pt-2">
                            <Label className="text-xs font-semibold">Card Placement</Label>
                            <div className="grid grid-cols-3 gap-1.5">
                              {[
                                { value: 'full', label: 'Cards Over Image' },
                                { value: 'left', label: 'Cards Right Side' },
                                { value: 'right', label: 'Cards Left Side' },
                              ].map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => setEditingParams((p: any) => {
                                    const next = { ...p, panel_bg_layout: opt.value };
                                    // Reflow so all columns stay visible inside the new card zone
                                    if (!p.panel_resize_enabled) {
                                      next.panel_items = applyPanelSmartLayout(
                                        reflowPanelChartItems(p.panel_items || []),
                                        next,
                                        { preserveExisting: false },
                                      );
                                    }
                                    return next;
                                  })}
                                  className={`px-1.5 py-1.5 rounded-md border text-[9.5px] leading-tight font-medium transition-colors ${(editingParams.panel_bg_layout || 'full') === opt.value
                                    ? 'border-primary ring-2 ring-primary/20 bg-muted/40'
                                    : 'border-muted hover:bg-muted/30'
                                    }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              The image always fills the whole panel. This only decides which side the cards leave clear.
                            </p>
                          </div>

                          {(editingParams.panel_bg_layout === 'left' || editingParams.panel_bg_layout === 'right') && (
                            <div className="space-y-1.5 pt-1">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs font-semibold">Clear Space Width</Label>
                                <span className="text-[10px] font-mono text-muted-foreground">
                                  {editingParams.panel_bg_gutter_pct ?? 24}%
                                </span>
                              </div>
                              <Slider
                                min={10}
                                max={50}
                                step={1}
                                value={[editingParams.panel_bg_gutter_pct ?? 24]}
                                onValueChange={([value]) =>
                                  setEditingParams((p: any) => ({ ...p, panel_bg_gutter_pct: value }))
                                }
                              />
                            </div>
                          )}

                          {/* Image adjustments — brightness / contrast / saturation / opacity */}
                          <div className="space-y-3 pt-2 border-t">
                            <Label className="text-xs font-semibold">Image Adjustments</Label>

                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-muted-foreground">Brightness</span>
                                <span className="text-[10px] font-mono text-muted-foreground">{editingParams.panel_bg_brightness ?? 100}%</span>
                              </div>
                              <Slider
                                min={30}
                                max={150}
                                step={1}
                                value={[editingParams.panel_bg_brightness ?? 100]}
                                onValueChange={([value]) => setEditingParams((p: any) => ({ ...p, panel_bg_brightness: value }))}
                              />
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-muted-foreground">Contrast</span>
                                <span className="text-[10px] font-mono text-muted-foreground">{editingParams.panel_bg_contrast ?? 100}%</span>
                              </div>
                              <Slider
                                min={50}
                                max={150}
                                step={1}
                                value={[editingParams.panel_bg_contrast ?? 100]}
                                onValueChange={([value]) => setEditingParams((p: any) => ({ ...p, panel_bg_contrast: value }))}
                              />
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-muted-foreground">Saturation</span>
                                <span className="text-[10px] font-mono text-muted-foreground">{editingParams.panel_bg_saturate ?? 100}%</span>
                              </div>
                              <Slider
                                min={0}
                                max={200}
                                step={1}
                                value={[editingParams.panel_bg_saturate ?? 100]}
                                onValueChange={([value]) => setEditingParams((p: any) => ({ ...p, panel_bg_saturate: value }))}
                              />
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-muted-foreground">Image Opacity</span>
                                <span className="text-[10px] font-mono text-muted-foreground">{editingParams.panel_bg_opacity ?? 100}%</span>
                              </div>
                              <Slider
                                min={10}
                                max={100}
                                step={1}
                                value={[editingParams.panel_bg_opacity ?? 100]}
                                onValueChange={([value]) => setEditingParams((p: any) => ({ ...p, panel_bg_opacity: value }))}
                              />
                            </div>
                          </div>

                          {/* Live preview */}
                          <div className="space-y-1 pt-1">
                            <Label className="text-[10px] text-muted-foreground">Preview</Label>
                            <div className="h-16 w-full rounded-md border overflow-hidden relative bg-muted/20">
                              <div
                                className="absolute inset-0"
                                style={{
                                  backgroundImage: `url(${editingParams.panel_bg_image})`,
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center',
                                  opacity: (editingParams.panel_bg_opacity ?? 100) / 100,
                                  filter: `brightness(${editingParams.panel_bg_brightness ?? 100}%) contrast(${editingParams.panel_bg_contrast ?? 100}%) saturate(${editingParams.panel_bg_saturate ?? 100}%)`,
                                }}
                              />
                              {(editingParams.panel_bg_layout === 'left' || editingParams.panel_bg_layout === 'right') && (
                                <div
                                  className="absolute inset-y-0 border border-dashed border-primary/50 bg-primary/10"
                                  style={
                                    editingParams.panel_bg_layout === 'left'
                                      ? { left: `${editingParams.panel_bg_gutter_pct ?? 24}%`, right: 0 }
                                      : { left: 0, right: `${editingParams.panel_bg_gutter_pct ?? 24}%` }
                                  }
                                />
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Divider Block Specific */}
              {(customizingChart.chart.visualization_name || customizingChart.chart.chart_type || '').toString().toLowerCase() === 'divider' && (
                <div className="space-y-4 pt-4 border-t">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Divider Style</h4>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Orientation</Label>
                    <Select
                      modal={false}
                      value={editingParams.divider_orientation || 'horizontal'}
                      onValueChange={(val) => setEditingParams((p: any) => ({ ...p, divider_orientation: val }))}
                    >
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent className="z-[1200]">
                        <SelectItem value="horizontal">Horizontal</SelectItem>
                        <SelectItem value="vertical">Vertical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Line Thickness (px)</Label>
                    <Select
                      modal={false}
                      value={String(editingParams.divider_thickness ?? DEFAULT_DIVIDER_PARAMS.divider_thickness)}
                      onValueChange={(val) => setEditingParams((p: any) => ({ ...p, divider_thickness: parseInt(val, 10) }))}
                    >
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent className="z-[1200]">
                        <SelectItem value="1">1 px (Thin)</SelectItem>
                        <SelectItem value="2">2 px</SelectItem>
                        <SelectItem value="3">3 px</SelectItem>
                        <SelectItem value="4">4 px</SelectItem>
                        <SelectItem value="6">6 px</SelectItem>
                        <SelectItem value="8">8 px (Thick)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Line Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editingParams.divider_color ?? DEFAULT_DIVIDER_PARAMS.divider_color}
                        onChange={(e) => setEditingParams((p: any) => ({ ...p, divider_color: e.target.value }))}
                        className="w-8 h-8 rounded border cursor-pointer p-0 bg-transparent"
                      />
                      <span className="text-xs font-mono">{editingParams.divider_color ?? DEFAULT_DIVIDER_PARAMS.divider_color}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Image Block Specific */}
              {(customizingChart.chart.visualization_name || customizingChart.chart.chart_type || '').toString().toLowerCase() === 'image' && (
                <div className="space-y-4 pt-4 border-t">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Image Resource</h4>
                  {editingParams.image_data ? (
                    <div className="space-y-2">
                      <div className="relative border rounded-lg overflow-hidden h-32 bg-muted/20 flex items-center justify-center">
                        <img src={editingParams.image_data} className="w-full h-full object-contain" />
                        <button
                          onClick={() => setEditingParams((p: any) => { const copy = { ...p }; delete copy.image_data; return copy; })}
                          className="absolute top-1.5 right-1.5 bg-destructive text-destructive-foreground p-1 rounded-full shadow hover:bg-destructive/90 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-[10px] text-muted-foreground text-center">Custom image uploaded successfully</p>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 hover:border-primary/50 transition-colors cursor-pointer bg-muted/5">
                      <Upload className="w-6 h-6 text-muted-foreground/45 mb-1" />
                      <span className="text-xs font-semibold text-muted-foreground/80">Upload Custom Image</span>
                      <span className="text-[10px] text-muted-foreground/50 mt-0.5">PNG, JPG or WebP</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              const base64 = ev.target?.result as string;
                              if (base64) {
                                setEditingParams((p: any) => ({ ...p, image_data: base64 }));
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              )}
            </div>
          )}

          <SheetFooter className="shrink-0 border-t pt-4 flex flex-row justify-end gap-2">
            {/* <Button variant="ghost" onClick={() => setActiveCustomizerChartId(null)} className="h-9 text-xs">
              Cancel
            </Button>
            <Button
              onClick={() => {
                const customizerViz = (customizingChart.chart.visualization_name || customizingChart.chart.chart_type || '')
                  .toString()
                  .toLowerCase();
                pushUndoSnapshot();
                handleUpdateChart(activeCustomizerChartId!, {
                  ...(shouldApplyCustomizerWidgetTitle(customizerViz) ? { chart_name: editingTitle } : {}),
                  ...editingParams,
                });
                setActiveCustomizerChartId(null);
                toast.success('Customizations applied');
              }}
              className="h-9 text-xs"
            >
              Apply
            </Button> */}
            <Button
              onClick={() => {
                const customizerViz = (customizingChart.chart.visualization_name || customizingChart.chart.chart_type || '')
                  .toString()
                  .toLowerCase();
                pushUndoSnapshot();

                const paramsToApply =
                  customizerViz === 'panel' && !editingParams.panel_resize_enabled
                    ? {
                        ...editingParams,
                        panel_items: applyPanelSmartLayout(
                          reflowPanelChartItems(editingParams.panel_items || []),
                          editingParams,
                          { preserveExisting: false },
                        ),
                      }
                    : editingParams;

                handleUpdateChart(activeCustomizerChartId!, {
                  ...(shouldApplyCustomizerWidgetTitle(customizerViz) ? { chart_name: editingTitle } : {}),
                  ...paramsToApply,
                });

                // Panels: auto-grow the widget if the new set of embedded items no longer
                // fits its current grid height. Never shrinks — only grows.
                if (customizerViz === 'panel') {
                  const targetId = activeCustomizerChartId;
                  setDashboardCharts((prev) => {
                    const idx = prev.findIndex((dc) => dc.id === targetId);
                    if (idx === -1) return prev;
                    const dc = prev[idx];

                    const currentGrid =
                      dc.gridLayout ??
                      pixelsToGridUnits(dc.position.x, dc.position.y, dc.size.width, dc.size.height, CONTAINER_WIDTH, GRID_COLS);

                    const requiredH = getPanelRequiredGridHeight(editingParams);
                    if (requiredH <= currentGrid.h) return prev;

                    const newGrid = { ...currentGrid, h: requiredH };
                    const px = gridUnitsToPixels(newGrid.x, newGrid.y, newGrid.w, newGrid.h, CONTAINER_WIDTH, GRID_COLS);

                    const next = [...prev];
                    next[idx] = {
                      ...dc,
                      gridLayout: newGrid,
                      position: { x: px.x, y: px.y },
                      size: { width: px.width, height: px.height },
                    };
                    return next;
                  });
                }

                setActiveCustomizerChartId(null);
                toast.success('Customizations applied');
              }}
              className="h-9 text-xs"
            >
              Apply
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet
        modal={false}
        open={activeChartEditorChartId != null}
        onOpenChange={(open) => {
          if (!open && activeChartEditorChartId != null) {
            void handleEmbeddedChartEditorClose();
          }
        }}
      >
        <SheetContent
          side="right"
          hideClose
          onFocusOutside={(e) => {
            e.preventDefault();
          }}
          onInteractOutside={preventSheetDismissForPortaledMenus}
          onPointerDownOutside={preventSheetDismissForPortaledMenus}
          className="z-[1100] flex h-full w-[96vw] max-w-[96vw] flex-col gap-0 border-l p-0 sm:max-w-[96vw]"
        >
          {activeChartEditorChartId != null && (
            <DashboardEmbeddedChartEditor
              chartId={activeChartEditorChartId}
              flowId={flowId}
              isAnalyticsStudio={isAnalyticsStudio}
              onClose={handleEmbeddedChartEditorClose}
              onChartUpdated={handleEmbeddedChartUpdated}
            />
          )}
        </SheetContent>
      </Sheet>

      {isEditMode && showSavedPayload && rawDashboardData && (
        <div style={{ position: 'fixed', right: 16, bottom: 16, width: '480px', maxHeight: '60vh', overflow: 'auto', zIndex: 9999 }}>
          <div className="bg-card border rounded p-2 shadow-lg text-xs">
            <div className="flex items-center justify-between mb-2">
              <strong>Saved dashboard JSON</strong>
              <Button variant="ghost" size="icon" onClick={() => setShowSavedPayload(false)}>Close</Button>
            </div>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(rawDashboardData, null, 2)}</pre>
          </div>
        </div>
      )}
    </>
  );
}