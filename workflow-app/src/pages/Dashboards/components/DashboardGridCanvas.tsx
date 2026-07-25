import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GridLayout, { type Layout, type LayoutItem } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import './dashboardGrid.css';
import { DashboardChart } from '../types';
import { DashboardChartItem } from './DashboardChartItem';
import type { StreamChartDataSlice } from '@/pages/charts/components/charts/bigNumber';
import { GRID_LAYOUT_PROPS } from '../utils/gridLayoutConfig';
import {
  applyLayoutToDashboardCharts,
  applySingleItemGridMove,
  dashboardChartsToLayout,
  findSwapTargetAtDrop,
  getGridContentHeightFromCharts,
  getLayoutRowItems,
  gridLayoutsOverlap,
  hasLayoutOverlaps,
  isGridRowFull,
  redistributeGridRowOnResize,
  trySwapLayoutPositions,
  withDragSiblingLocks,
  withoutLayoutDragLocks,
  getDashboardLayoutWidth,
} from '../utils/gridLayoutUtils';
import { CHART_GAP, DASHBOARD_CANVAS_RIGHT_INSET } from '../dashboardConstants';
import { GRID_COLS } from '../layoutConstants';

const NOOP_RESIZE = () => {};

export interface DashboardGridCanvasProps {
  dashboardCharts: DashboardChart[];
  containerWidth: number;
  isEditMode?: boolean;
  onLayoutChange: (charts: DashboardChart[]) => void;
  onRemoveChart: (id: string) => void;
  onStreamChartDataUpdate: (dashboardChartId: string, merged: StreamChartDataSlice) => void;
  formatVisualizationName: (name: string) => string;
  onUpdateChart?: (id: string, updatedParams: Record<string, unknown>) => void;
  onEditChart?: (id: string) => void;
  recordUndoSnapshot?: () => void;
  canvasRef?: React.RefObject<HTMLDivElement | null>;
}

export const DashboardGridCanvas = memo(function DashboardGridCanvas({
  dashboardCharts,
  containerWidth,
  isEditMode = true,
  onLayoutChange,
  onRemoveChart,
  onStreamChartDataUpdate,
  formatVisualizationName,
  onUpdateChart,
  onEditChart,
  recordUndoSnapshot,
  canvasRef,
}: DashboardGridCanvasProps) {
  const [liveGridWidth, setLiveGridWidth] = useState(containerWidth);

  // Clamp grid width to the visible canvas so saved/large container_width values cannot clip the right edge.
  useEffect(() => {
    const scrollRoot = canvasRef?.current?.closest('[data-dashboard-canvas-surface]') as HTMLElement | null;
    const measureTarget = scrollRoot ?? canvasRef?.current?.parentElement ?? null;
    if (!measureTarget) {
      setLiveGridWidth(containerWidth);
      return;
    }

    const measure = () => {
      const clientWidth = measureTarget.clientWidth;
      if (clientWidth <= 0) return;
      setLiveGridWidth(getDashboardLayoutWidth(measureTarget, containerWidth));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(measureTarget);
    return () => observer.disconnect();
  }, [canvasRef, containerWidth]);

  const effectiveGridWidth = liveGridWidth > 0 ? liveGridWidth : containerWidth;

  const layout = useMemo(
    () => dashboardChartsToLayout(dashboardCharts, effectiveGridWidth, GRID_COLS),
    [dashboardCharts, effectiveGridWidth],
  );

  const contentMinHeight = useMemo(
    () => Math.max(400, getGridContentHeightFromCharts(dashboardCharts, effectiveGridWidth, GRID_COLS)),
    [dashboardCharts, effectiveGridWidth],
  );

  const skipInitialLayoutChangeRef = useRef(true);
  const skipLayoutChangesCountRef = useRef(0);
  const isDraggingRef = useRef(false);
  const isResizingRef = useRef(false);
  const dragLayoutSnapshotRef = useRef<Layout | null>(null);
  const resizeLayoutSnapshotRef = useRef<Layout | null>(null);
  const resizeRowWasFullRef = useRef(false);
  const resizingItemIdRef = useRef<string | null>(null);
  const swapTargetIdRef = useRef<string | null>(null);
  const pendingDisplayLayoutRef = useRef<Layout | null>(null);
  const draggingItemIdRef = useRef<string | null>(null);
  const [dragLayout, setDragLayout] = useState<Layout | null>(null);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [measuredLayoutHeight, setMeasuredLayoutHeight] = useState(0);

  const displayLayout = dragLayout ?? layout;

  // Keep scroll area at least as tall as the rendered react-grid-layout surface.
  useEffect(() => {
    const root = canvasRef?.current;
    if (!root) return;

    let gridEl: Element | null = null;
    let observer: ResizeObserver | null = null;

    const measure = () => {
      if (!gridEl) return;
      const height = Math.ceil(gridEl.getBoundingClientRect().height);
      if (height > 0) {
        setMeasuredLayoutHeight((prev) => (prev === height ? prev : height));
      }
    };

    const attach = () => {
      observer?.disconnect();
      gridEl = root.querySelector('.react-grid-layout');
      if (!gridEl) {
        setMeasuredLayoutHeight(0);
        return;
      }
      measure();
      observer = new ResizeObserver(measure);
      observer.observe(gridEl);
    };

    attach();
    const rafId = requestAnimationFrame(attach);

    return () => {
      cancelAnimationFrame(rafId);
      observer?.disconnect();
    };
  }, [canvasRef, displayLayout, effectiveGridWidth, dashboardCharts.length]);

  const canvasHeight = Math.max(contentMinHeight, measuredLayoutHeight);

  const layoutMatchesSnapshot = useCallback((a: Layout, b: Layout) => {
    if (a.length !== b.length) return false;
    return a.every((item) => {
      const other = b.find((entry) => entry.i === item.i);
      return (
        other &&
        other.x === item.x &&
        other.y === item.y &&
        other.w === item.w &&
        other.h === item.h
      );
    });
  }, []);

  useEffect(() => {
    const pending = pendingDisplayLayoutRef.current;
    if (!pending) return;
    if (layoutMatchesSnapshot(layout, pending)) {
      pendingDisplayLayoutRef.current = null;
      setDragLayout(null);
    }
  }, [layout, layoutMatchesSnapshot]);

  const chartIdsKey = useMemo(() => dashboardCharts.map((dc) => dc.id).join('|'), [dashboardCharts]);
  const prevContainerWidthRef = useRef(effectiveGridWidth);

  useEffect(() => {
    skipInitialLayoutChangeRef.current = true;
    skipLayoutChangesCountRef.current = Math.max(skipLayoutChangesCountRef.current, 8);
  }, [chartIdsKey]);

  useEffect(() => {
    if (prevContainerWidthRef.current === effectiveGridWidth) return;
    prevContainerWidthRef.current = effectiveGridWidth;
    skipInitialLayoutChangeRef.current = true;
    skipLayoutChangesCountRef.current += 8;
  }, [effectiveGridWidth]);

  const applyLayout = useCallback(
    (newLayout: Layout) => {
      onLayoutChange(applyLayoutToDashboardCharts(dashboardCharts, newLayout, effectiveGridWidth, GRID_COLS));
    },
    [dashboardCharts, effectiveGridWidth, onLayoutChange],
  );

  const commitDragResult = useCallback(
    (nextLayout: Layout, skipCount = 6) => {
      const unlockedLayout = withoutLayoutDragLocks(nextLayout);
      skipLayoutChangesCountRef.current = skipCount;
      pendingDisplayLayoutRef.current = unlockedLayout;
      setDragLayout(unlockedLayout);
      applyLayout(unlockedLayout);
    },
    [applyLayout],
  );

  const finishDragSession = useCallback(() => {
    isDraggingRef.current = false;
    draggingItemIdRef.current = null;
    dragLayoutSnapshotRef.current = null;
    swapTargetIdRef.current = null;
    setDraggingItemId(null);
  }, []);

  const applyResizeLayout = useCallback(
    (currentLayout: Layout, resizedItemId: string) => {
      let layout = resizeRowWasFullRef.current
        ? redistributeGridRowOnResize(currentLayout, resizedItemId, GRID_COLS)
        : currentLayout;

      if (hasLayoutOverlaps(layout)) {
        if (resizeLayoutSnapshotRef.current) {
          applyLayout(resizeLayoutSnapshotRef.current);
        }
        return;
      }

      applyLayout(layout);
    },
    [applyLayout],
  );

  const handleLayoutChange = useCallback(
    (newLayout: Layout) => {
      if (!isEditMode) return;

      // During drag/resize, commit layout only on dragStop/resizeStop.
      if (isDraggingRef.current || isResizingRef.current) return;

      if (skipLayoutChangesCountRef.current > 0) {
        skipLayoutChangesCountRef.current -= 1;
        return;
      }

      if (skipInitialLayoutChangeRef.current) {
        skipInitialLayoutChangeRef.current = false;
        // Ignore RGL's first mount layout — it can differ due to min constraints / width
        // and would overwrite saved positions (especially y/h for layout/content blocks).
        return;
      }

      applyLayout(newLayout);
    },
    [dashboardCharts, isEditMode, applyLayout],
  );

  const handleDragStart = useCallback(
    (
      _currentLayout: Layout,
      _oldItem: LayoutItem | null,
      newItem: LayoutItem | null,
    ) => {
      recordUndoSnapshot?.();
      isDraggingRef.current = true;
      pendingDisplayLayoutRef.current = null;
      const draggedId = newItem?.i ?? null;
      draggingItemIdRef.current = draggedId;
      setDraggingItemId(draggedId);
      const snapshot = withDragSiblingLocks(
        layout.map((item) => ({ ...item })),
        draggedId,
      );
      dragLayoutSnapshotRef.current = snapshot;
      setDragLayout(snapshot);
      swapTargetIdRef.current = null;
    },
    [recordUndoSnapshot, layout],
  );

  const handleDrag = useCallback(
    (
      _currentLayout: Layout,
      _oldItem: LayoutItem | null,
      newItem: LayoutItem | null,
    ) => {
      const snapshot = dragLayoutSnapshotRef.current;
      if (!newItem || !snapshot) {
        swapTargetIdRef.current = null;
        setDragLayout(null);
        return;
      }

      const controlledLayout = withDragSiblingLocks(
        snapshot.map((item) =>
          item.i === newItem.i
            ? { ...item, x: newItem.x, y: newItem.y, w: newItem.w, h: newItem.h }
            : { ...item },
        ),
        newItem.i,
      );
      setDragLayout(controlledLayout);

      const othersLayout = snapshot.filter((item) => item.i !== newItem.i);
      const target = findSwapTargetAtDrop(newItem, othersLayout, newItem.i);
      swapTargetIdRef.current = target?.i ?? null;
    },
    [],
  );

  const handleDragStop = useCallback(
    (
      _currentLayout: Layout,
      _oldItem: LayoutItem | null,
      newItem: LayoutItem | null,
    ) => {
      const snapshot = dragLayoutSnapshotRef.current;
      let targetId = swapTargetIdRef.current;

      if (!isEditMode || !snapshot || !newItem) {
        finishDragSession();
        pendingDisplayLayoutRef.current = null;
        setDragLayout(null);
        return;
      }

      const droppedFootprint = {
        x: newItem.x,
        y: newItem.y,
        w: newItem.w,
        h: newItem.h,
      };

      const othersLayout = snapshot.filter((item) => item.i !== newItem.i);
      const dropSwapTarget = findSwapTargetAtDrop(
        droppedFootprint,
        othersLayout,
        newItem.i,
      );
      if (dropSwapTarget?.i) {
        targetId = dropSwapTarget.i;
      }

      // Swap positions only — each chart keeps its size; all other charts stay at snapshot coords.
      if (targetId && targetId !== newItem.i) {
        const swappedLayout = trySwapLayoutPositions(snapshot, newItem.i, targetId, GRID_COLS);
        if (swappedLayout) {
          commitDragResult(swappedLayout);
          finishDragSession();
          return;
        }
        commitDragResult(snapshot, 4);
        finishDragSession();
        return;
      }

      const overlapsOther = othersLayout.some((item) =>
        gridLayoutsOverlap(droppedFootprint, item),
      );

      if (overlapsOther) {
        commitDragResult(snapshot, 4);
        finishDragSession();
        return;
      }

      const original = snapshot.find((item) => item.i === newItem.i);
      if (
        original &&
        original.x === droppedFootprint.x &&
        original.y === droppedFootprint.y &&
        original.w === droppedFootprint.w &&
        original.h === droppedFootprint.h
      ) {
        finishDragSession();
        pendingDisplayLayoutRef.current = null;
        setDragLayout(null);
        return;
      }

      commitDragResult(applySingleItemGridMove(snapshot, newItem.i, droppedFootprint), 4);
      finishDragSession();
    },
    [isEditMode, commitDragResult, finishDragSession],
  );

  const handleResize = useCallback(
    (
      _currentLayout: Layout,
      _oldItem: LayoutItem | null,
      _newItem: LayoutItem | null,
    ) => {
      // Let react-grid-layout drive the live resize preview; commit once on resizeStop.
      if (!isEditMode || !isResizingRef.current) return;
    },
    [isEditMode],
  );

  const handleResizeStart = useCallback(
    (
      _currentLayout: Layout,
      _oldItem: LayoutItem | null,
      newItem: LayoutItem | null,
    ) => {
      recordUndoSnapshot?.();
      isResizingRef.current = true;
      resizeLayoutSnapshotRef.current = layout.map((item) => ({ ...item }));
      resizingItemIdRef.current = newItem?.i ?? null;
      if (newItem && resizeLayoutSnapshotRef.current) {
        const rowItems = getLayoutRowItems(resizeLayoutSnapshotRef.current, newItem.y);
        resizeRowWasFullRef.current = isGridRowFull(rowItems, GRID_COLS);
      } else {
        resizeRowWasFullRef.current = false;
      }
    },
    [layout, recordUndoSnapshot],
  );

  const handleResizeStop = useCallback(
    (
      currentLayout: Layout,
      _oldItem: LayoutItem | null,
      newItem: LayoutItem | null,
    ) => {
      isResizingRef.current = false;
      if (!isEditMode) return;
      skipLayoutChangesCountRef.current = 2;
      if (newItem) {
        applyResizeLayout(currentLayout, newItem.i);
      } else {
        applyLayout(currentLayout);
      }
      resizeLayoutSnapshotRef.current = null;
      resizeRowWasFullRef.current = false;
      resizingItemIdRef.current = null;
    },
    [isEditMode, applyLayout, applyResizeLayout],
  );

  return (
    <div
      ref={canvasRef}
      className={`dashboard-grid-canvas w-full max-w-full${draggingItemId ? ' is-chart-dragging' : ''}`}
      style={{
        minHeight: canvasHeight,
        maxWidth: effectiveGridWidth + CHART_GAP + CHART_GAP + DASHBOARD_CANVAS_RIGHT_INSET,
        paddingLeft: CHART_GAP,
        paddingRight: CHART_GAP + DASHBOARD_CANVAS_RIGHT_INSET,
        boxSizing: 'border-box',
      }}
    >
      <GridLayout
        className="layout"
        layout={displayLayout}
        cols={GRID_COLS}
        width={effectiveGridWidth}
        {...GRID_LAYOUT_PROPS}
        allowOverlap={!!draggingItemId}
        preventCollision={!!draggingItemId}
        isDraggable={isEditMode}
        isResizable={isEditMode}
        onLayoutChange={handleLayoutChange}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragStop={handleDragStop}
        onResize={handleResize}
        onResizeStart={handleResizeStart}
        onResizeStop={handleResizeStop}
      >
        {dashboardCharts.map((dashboardChart) => (
          <div key={dashboardChart.id} className="dashboard-grid-item h-full min-h-0 min-w-0">
            <DashboardChartItem
              dashboardChart={dashboardChart}
              allCharts={dashboardCharts}
              onRemove={onRemoveChart}
              onResize={NOOP_RESIZE}
              onStreamChartDataUpdate={onStreamChartDataUpdate}
              formatVisualizationName={formatVisualizationName}
              containerRef={canvasRef as React.RefObject<HTMLDivElement>}
              gridMode
              onUpdateChart={onUpdateChart}
              onEditChart={onEditChart}
              recordUndoSnapshot={recordUndoSnapshot}
            />
          </div>
        ))}
      </GridLayout>
    </div>
  );
});
