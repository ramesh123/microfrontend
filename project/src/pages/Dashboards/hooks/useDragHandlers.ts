import { useCallback } from 'react';
import { DragStartEvent, DragEndEvent, DragOverEvent } from '@dnd-kit/core';
import { toast } from 'sonner';
import { createChart, getChartById } from '@/pages/Visualization/API/chartsApi';
import { Chart, DashboardChart } from '../types';
import { transformDashboardChartRows, extractDashboardChartResponseRows } from '../utils/dashboardUtils';
import { buildDashboardCreateChartPayload } from '../utils/buildDashboardCreateChartPayload';
import { GRID_COLS, isStaticLayoutContentChartId } from '../layoutConstants';
import { STATIC_LAYOUT_ITEMS, STATIC_CONTENT_ITEMS } from '../staticDashboardBlocks';
import {
  dashboardChartsToLayout,
  findNextGridPosition,
  getDefaultGridSizeForChart,
  createDashboardChartFromGridPlacement,
  layoutAfterAddingChart,
  getGridMinConstraintsForChart,
  getColWidth,
  applyLayoutToDashboardCharts,
} from '../utils/gridLayoutUtils';
import { isDashboardTableOrPivotChart } from '../utils/dashboardWidgetTabs';

interface UseDragHandlersProps {
  charts: Chart[];
  dashboardCharts: DashboardChart[];
  setDashboardCharts: React.Dispatch<React.SetStateAction<DashboardChart[]>>;
  setActiveId: (id: string | null) => void;
  onCanvasOverChange: (isOver: boolean) => void;
  CONTAINER_WIDTH: number;
  canvasRef: React.RefObject<HTMLDivElement>;
  pointerMoveHandlerRef: React.MutableRefObject<((e: MouseEvent) => void) | null>;
  pointerRef: React.MutableRefObject<{ x: number; y: number } | null>;
  dropPositionRef: React.MutableRefObject<{ x: number; y: number } | null>;
  lastOverRef: React.MutableRefObject<boolean>;
  analyticsStudio?: boolean;
  recordUndoSnapshot?: () => void;
}

export function useDragHandlers({
  charts,
  dashboardCharts,
  setDashboardCharts,
  setActiveId,
  onCanvasOverChange,
  CONTAINER_WIDTH,
  pointerMoveHandlerRef,
  pointerRef,
  dropPositionRef,
  lastOverRef,
  analyticsStudio,
  recordUndoSnapshot,
}: UseDragHandlersProps) {
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const activeId = event.active.id as string;
    setActiveId(activeId);

    if (activeId.startsWith('dashboard-chart-')) {
      recordUndoSnapshot?.();
    }
  }, [setActiveId, recordUndoSnapshot]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over, active } = event;
    const isOverNow = over?.id === 'dashboard-canvas';

    if (lastOverRef.current !== isOverNow) {
      lastOverRef.current = isOverNow;
      onCanvasOverChange(isOverNow);
    }

    // On-canvas widget drag/resize is handled by react-grid-layout
    if (active.id.toString().startsWith('dashboard-chart-')) {
      return;
    }
  }, [onCanvasOverChange, lastOverRef]);

  const addChartToCanvas = useCallback(async (chart: Chart) => {
    const chartId = chart.id;
    const isStaticItem = isStaticLayoutContentChartId(chartId);
    if (!isStaticItem) {
      const isAlreadyAdded = dashboardCharts.some(dc => dc.chartId === chartId);
      if (isAlreadyAdded) {
        toast.info(`${chart.chart_name} is already on the dashboard`);
        return;
      }
    }

    recordUndoSnapshot?.();

    let chartForDashboard = chart;
    try {
      if (!isStaticItem && !chart.customization) {
        const fullChart = await getChartById(String(chart.id));
        if (fullChart?.customization) {
          chartForDashboard = { ...chart, customization: fullChart.customization };
        }
      }
      if (!isStaticItem) {
        const isTableOrPivot = isDashboardTableOrPivotChart(chart);
        const emptyCustomization =
          !chart.customization ||
          (typeof chart.customization === 'object' &&
            !Array.isArray(chart.customization) &&
            Object.keys(chart.customization).length === 0);
        const shouldFetch = isTableOrPivot ? emptyCustomization : !chart.customization;

        if (shouldFetch) {
          const fullChart = await getChartById(String(chart.id));
          const custom = fullChart?.customization;
          if (custom && (!isTableOrPivot || (typeof custom === 'object' && Object.keys(custom).length > 0))) {
            chartForDashboard = { ...chart, customization: custom as Chart['customization'] };
          }
        }
      }
    } catch {
      // Sidebar chart metadata is enough to continue
    }

    const newChartId = `dashboard-chart-${Date.now()}`;
    const currentLayout = dashboardChartsToLayout(dashboardCharts, CONTAINER_WIDTH, GRID_COLS);
    const defaultSize = getDefaultGridSizeForChart(chart, CONTAINER_WIDTH, GRID_COLS);
    const gridPos = findNextGridPosition(currentLayout, defaultSize, GRID_COLS);
    const colWidth = getColWidth(CONTAINER_WIDTH, GRID_COLS);
    const { minW, minH } = getGridMinConstraintsForChart(chart, colWidth);
    const newLayoutItem = {
      i: newChartId,
      x: gridPos.x,
      y: gridPos.y,
      w: gridPos.w,
      h: gridPos.h,
      minW,
      minH,
      maxW: GRID_COLS,
    };
    const updatedLayout = layoutAfterAddingChart(currentLayout, newLayoutItem, GRID_COLS);
    const finalPlacement = updatedLayout.find((item) => item.i === newChartId)!;
    const newDashboardChart = createDashboardChartFromGridPlacement(
      chartForDashboard,
      {
        x: finalPlacement.x,
        y: finalPlacement.y,
        w: finalPlacement.w,
        h: finalPlacement.h,
      },
      CONTAINER_WIDTH,
      newChartId,
      GRID_COLS,
    );

    dropPositionRef.current = null;
    setDashboardCharts((prev) =>
      applyLayoutToDashboardCharts([...prev, newDashboardChart], updatedLayout, CONTAINER_WIDTH, GRID_COLS),
    );

    if (isStaticItem) {
      setDashboardCharts(prev =>
        prev.map(dc =>
          dc.id === newChartId
            ? { ...dc, isLoading: false }
            : dc
        )
      );
      toast.success(`Added ${chart.chart_name} to dashboard`);
      return;
    }

    try {
      const chartPayload = buildDashboardCreateChartPayload(chartForDashboard, analyticsStudio);
      const chartResponse = await createChart(chartPayload);
      const resp: any = chartResponse;

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
        const flattened: Record<string, any>[] = [];
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
          flattened.push(rowObj);
        }

        setDashboardCharts(prev =>
          prev.map(dc =>
            dc.id === newChartId
              ? {
                ...dc,
                chartData: flattened.length > 0 ? flattened : [],
                rawResponse: resp,
                chartColumns: resp.columns,
                isLoading: false
              }
              : dc
          )
        );
      } else {
        const vizName = chart.visualization_name || chart.chart_type || '';
        const chartMetrics = chart.params?.metrics ?? chart.params?.metric ?? chart.params?.mtric;
        const rawRows = extractDashboardChartResponseRows(resp);
        const transformedData = transformDashboardChartRows(rawRows, vizName, {
          columns: resp.columns,
          metrics: Array.isArray(chartMetrics) ? chartMetrics : undefined,
          x_axis: resp.x_axis ?? null,
        });

        setDashboardCharts(prev =>
          prev.map(dc =>
            dc.id === newChartId
              ? {
                ...dc,
                chartData: transformedData,
                chartColumns: resp.columns,
                rawResponse: {
                  ...resp,
                  data: rawRows.length > 0 ? rawRows : resp.data,
                  columns: resp.columns,
                  metrics: Array.isArray(chartMetrics) ? chartMetrics : resp.metrics,
                },
                isLoading: false
              }
              : dc
          )
        );
      }
      toast.success(`Added ${chart.chart_name} to dashboard`);
    } catch (error) {
      console.error('Error calling createChart API:', error);
      toast.error('Failed to add chart to dashboard');
      setDashboardCharts(prev => prev.filter(dc => dc.id !== newChartId));
    }
  }, [
    dashboardCharts,
    setDashboardCharts,
    CONTAINER_WIDTH,
    dropPositionRef,
    analyticsStudio,
    recordUndoSnapshot,
  ]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    onCanvasOverChange(false);
    lastOverRef.current = false;

    if (pointerMoveHandlerRef.current) {
      try {
        window.removeEventListener('mousemove', pointerMoveHandlerRef.current);
      } catch {
        // ignore
      }
      pointerMoveHandlerRef.current = null;
      pointerRef.current = null;
    }

    if (active.id.toString().startsWith('chart-')) {
      if (over?.id !== 'dashboard-canvas') {
        return;
      }

      const chartId = parseInt(active.id.toString().replace('chart-', ''));
      const chart = charts.find(c => c.id === chartId) ||
                    STATIC_LAYOUT_ITEMS.find(c => c.id === chartId) ||
                    STATIC_CONTENT_ITEMS.find(c => c.id === chartId);

      if (!chart) {
        return;
      }

      await addChartToCanvas(chart);
      return;
    }

    // On-canvas widget drag/resize is handled by react-grid-layout
    if (active.id.toString().startsWith('dashboard-chart-')) {
      dropPositionRef.current = null;
    }
  }, [
    charts,
    setActiveId,
    onCanvasOverChange,
    pointerMoveHandlerRef,
    pointerRef,
    dropPositionRef,
    lastOverRef,
    addChartToCanvas,
  ]);

  return {
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    addChartToCanvas,
  };
}
