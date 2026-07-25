import type { Layout, LayoutItem } from 'react-grid-layout/legacy';
import {
  calcGridItemPosition,
  calcWHRaw,
  calcXY,
} from 'react-grid-layout/core';
import type { Chart, DashboardChart } from '../types';
import { GRID_COLS, DEFAULT_CONTAINER_WIDTH, LEGACY_GRID_COLS, PANEL_CHART_CELL_MIN_HEIGHT, PANEL_GRID_CELL_MIN_HEIGHT, resolvePanelItemLayout } from '../layoutConstants';
import { isStaticLayoutContentViz } from '../staticDashboardBlocks';
import { CHART_GAP, DASHBOARD_CANVAS_RIGHT_INSET, DEFAULT_BIG_NUMBER_HEIGHT, DEFAULT_BIG_NUMBER_WIDTH, DEFAULT_CHART_HEIGHT, DEFAULT_NEW_WIDGET_WIDTH } from '../dashboardConstants';
import { GRID_ROW_HEIGHT, GRID_MARGIN, GRID_CONTAINER_PADDING } from './gridLayoutConfig';
import { getMinHeightForChart, getMinWidthForChart } from './dashboardUtils';

/** Horizontal inset on the dashboard canvas. Matches save-time measurement and view-mode padding. */
export const DASHBOARD_CANVAS_LEFT_INSET = CHART_GAP;
export const DASHBOARD_CANVAS_RIGHT_INSET_TOTAL = CHART_GAP + DASHBOARD_CANVAS_RIGHT_INSET;
export const DASHBOARD_CANVAS_HORIZONTAL_PADDING =
  DASHBOARD_CANVAS_LEFT_INSET + DASHBOARD_CANVAS_RIGHT_INSET_TOTAL;

export function getDashboardCanvasAvailableWidth(measuredParentWidth: number): number {
  return Math.max(300, Math.round(measuredParentWidth) - DASHBOARD_CANVAS_HORIZONTAL_PADDING);
}

/** Never lay out wider than the live canvas — prevents right-edge clipping when saved width > viewport. */
export function resolveDashboardGridWidth(
  measuredParentWidth: number,
  preferredAvailableWidth?: number,
): number {
  const liveAvailable = getDashboardCanvasAvailableWidth(measuredParentWidth);
  if (preferredAvailableWidth == null || !Number.isFinite(preferredAvailableWidth)) {
    return liveAvailable;
  }
  return Math.min(liveAvailable, Math.max(300, Math.round(preferredAvailableWidth)));
}

/** Measure the live canvas parent width (prefers clientWidth for scrollbar accuracy). */
export function measureDashboardCanvasParentWidth(element: HTMLElement | null | undefined): number {
  if (!element) return 0;
  const clientWidth = element.clientWidth;
  if (clientWidth > 0) return clientWidth;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 ? Math.round(rect.width) : 0;
}

/** Resolve layout width from a live DOM node, falling back to a preferred/saved width. */
export function getDashboardLayoutWidth(
  element: HTMLElement | null | undefined,
  preferredAvailableWidth?: number,
): number {
  const parentWidth = measureDashboardCanvasParentWidth(element);
  if (parentWidth <= 0) {
    if (preferredAvailableWidth != null && Number.isFinite(preferredAvailableWidth) && preferredAvailableWidth > 0) {
      return Math.max(300, Math.round(preferredAvailableWidth));
    }
    return Math.max(300, DEFAULT_CONTAINER_WIDTH - DASHBOARD_CANVAS_HORIZONTAL_PADDING);
  }
  return resolveDashboardGridWidth(parentWidth, preferredAvailableWidth);
}

/** Keep absolutely-positioned dashboard widgets inside the layout width. */
export function clampDashboardWidgetLayoutBox(
  x: number,
  width: number,
  layoutWidth: number,
  edgeInset = CHART_GAP,
): { x: number; width: number } {
  const safeLayoutWidth = Math.max(48, layoutWidth);
  const inset = Math.max(0, edgeInset);
  const innerWidth = Math.max(24, safeLayoutWidth - inset * 2);
  let clampedX = Math.max(inset, x);
  let clampedW = Math.min(Math.max(24, width), innerWidth);
  if (clampedX + clampedW > safeLayoutWidth - inset) {
    clampedW = Math.max(24, safeLayoutWidth - inset - clampedX);
  }
  if (clampedX + clampedW > safeLayoutWidth - inset) {
    clampedX = Math.max(inset, safeLayoutWidth - inset - clampedW);
  }
  return { x: clampedX, width: clampedW };
}

function getRglPositionParams(containerWidth: number, cols = GRID_COLS) {
  return {
    margin: GRID_MARGIN,
    containerPadding: GRID_CONTAINER_PADDING,
    containerWidth,
    cols,
    rowHeight: GRID_ROW_HEIGHT,
    maxRows: Infinity,
  };
}

export function getColWidth(containerWidth: number, cols = GRID_COLS): number {
  const params = getRglPositionParams(containerWidth, cols);
  return (params.containerWidth - params.margin[0] * (params.cols - 1) - params.containerPadding[0] * 2) / params.cols;
}

export function gridUnitsToPixels(
  x: number, y: number, w: number, h: number,
  containerWidth: number, cols = GRID_COLS,
): { x: number; y: number; width: number; height: number } {
  const params = getRglPositionParams(containerWidth, cols);
  const pos = calcGridItemPosition(params, x, y, w, h);
  return { x: pos.left, y: pos.top, width: pos.width, height: pos.height };
}

export function pixelsToGridUnits(
  x: number, y: number, width: number, height: number,
  containerWidth: number, cols = GRID_COLS,
): { x: number; y: number; w: number; h: number } {
  const params = getRglPositionParams(containerWidth, cols);
  const { w, h } = calcWHRaw(params, width, height);
  const { x: gx, y: gy } = calcXY(params, y, x, w, h);
  return {
    x: Math.max(0, Math.min(cols - w, gx)),
    y: Math.max(0, gy),
    w: Math.max(1, Math.min(cols, w)),
    h: Math.max(1, h),
  };
}

export type SavedLayoutItem = {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  x_px?: number;
  y_px?: number;
  width_px?: number;
  height_px?: number;
  x_pct?: number;
  y_pct?: number;
  w_pct?: number;
  h_pct?: number;
};

/** Infer whether a saved layout used the legacy 12-column grid or the current grid. */
export function inferSavedGridCols(layout: SavedLayoutItem[] | undefined | null): number {
  if (!layout?.length) return GRID_COLS;
  const maxExtent = Math.max(
    ...layout.map((item) => Math.max(0, item.x ?? 0) + Math.max(1, item.w ?? 1)),
  );
  return maxExtent > LEGACY_GRID_COLS ? GRID_COLS : LEGACY_GRID_COLS;
}

function scaleGridUnitsBetweenColCounts(
  grid: { x: number; y: number; w: number; h: number },
  fromCols: number,
  toCols: number,
): { x: number; y: number; w: number; h: number } {
  if (fromCols === toCols) return grid;
  const factor = toCols / fromCols;
  const scaledW = Math.max(1, Math.min(toCols, Math.round(grid.w * factor)));
  const maxX = Math.max(0, toCols - scaledW);
  return {
    x: Math.max(0, Math.min(maxX, Math.round(grid.x * factor))),
    y: grid.y,
    w: scaledW,
    h: grid.h,
  };
}

function gridUnitsFromLegacy(value: number, cols = GRID_COLS): number {
  return Math.max(1, Math.round((value * cols) / LEGACY_GRID_COLS));
}

export function savedLayoutItemToGrid(
  layoutItem: SavedLayoutItem | undefined,
): { x: number; y: number; w: number; h: number } | undefined {
  if (!layoutItem) return undefined;
  const x = layoutItem.x;
  const y = layoutItem.y;
  const w = layoutItem.w;
  const h = layoutItem.h;
  if (!Number.isFinite(x)) return undefined;
  return {
    x: x!,
    y: Number.isFinite(y) ? y! : 0,
    w: Math.max(1, Number.isFinite(w) ? w! : 3),
    h: Math.max(1, Number.isFinite(h) ? h! : 8),
  };
}

export function restoreDashboardChartLayoutFromSavedItem(
  layoutItem: SavedLayoutItem | undefined,
  containerWidth: number,
  cols = GRID_COLS,
  savedGridCols = cols,
): {
  gridLayout: { x: number; y: number; w: number; h: number };
  position: { x: number; y: number };
  size: { width: number; height: number };
} | null {
  if (!layoutItem) return null;

  const savedGrid = savedLayoutItemToGrid(layoutItem);
  if (savedGrid) {
    const gridLayout = scaleGridUnitsBetweenColCounts(savedGrid, savedGridCols, cols);
    const px = gridUnitsToPixels(
      gridLayout.x,
      gridLayout.y,
      gridLayout.w,
      gridLayout.h,
      containerWidth,
      cols,
    );
    return {
      gridLayout,
      position: { x: px.x, y: px.y },
      size: { width: px.width, height: px.height },
    };
  }

  const hasFullPx =
    typeof layoutItem.x_px === 'number' &&
    typeof layoutItem.y_px === 'number' &&
    typeof layoutItem.width_px === 'number' &&
    typeof layoutItem.height_px === 'number';

  if (!hasFullPx) return null;

  const gridLayout = pixelsToGridUnits(
    layoutItem.x_px!, layoutItem.y_px!, layoutItem.width_px!, layoutItem.height_px!,
    containerWidth, cols,
  );
  const px = gridUnitsToPixels(gridLayout.x, gridLayout.y, gridLayout.w, gridLayout.h, containerWidth, cols);
  return {
    gridLayout,
    position: { x: px.x, y: px.y },
    size: { width: px.width, height: px.height },
  };
}

export function resolveLayoutItemToPixels(
  layoutItem: SavedLayoutItem | undefined,
  containerWidth: number,
  containerHeight: number,
  fallback: { x: number; y: number; width: number; height: number },
  cols = GRID_COLS,
  savedGridCols = cols,
): { x: number; y: number; width: number; height: number } {
  const grid = savedLayoutItemToGrid(layoutItem);
  if (grid) {
    const normalizedGrid = scaleGridUnitsBetweenColCounts(grid, savedGridCols, cols);
    return gridUnitsToPixels(normalizedGrid.x, normalizedGrid.y, normalizedGrid.w, normalizedGrid.h, containerWidth, cols);
  }

  if (!layoutItem) return fallback;

  let x: number;
  if (typeof layoutItem.x_px === 'number') x = Math.round(layoutItem.x_px);
  else if (typeof layoutItem.x_pct === 'number' && layoutItem.x_pct >= 0) x = Math.round(layoutItem.x_pct * containerWidth);
  else x = fallback.x;

  let y: number;
  if (typeof layoutItem.y_px === 'number') y = Math.round(layoutItem.y_px);
  else if (typeof layoutItem.y_pct === 'number' && layoutItem.y_pct >= 0) y = Math.round(layoutItem.y_pct * containerHeight);
  else y = fallback.y;

  let width: number;
  if (typeof layoutItem.width_px === 'number') width = Math.round(layoutItem.width_px);
  else if (typeof layoutItem.w_pct === 'number' && layoutItem.w_pct > 0) width = Math.round(layoutItem.w_pct * containerWidth);
  else width = fallback.width;

  let height: number;
  if (typeof layoutItem.height_px === 'number') height = Math.round(layoutItem.height_px);
  else if (typeof layoutItem.h_pct === 'number' && layoutItem.h_pct > 0) height = Math.round(layoutItem.h_pct * containerHeight);
  else height = fallback.height;

  return { x, y, width, height };
}

/**
 * Required grid `h` units for a panel widget given its current params —
 * kept for reference/telemetry, but NO LONGER used to floor resize (see
 * getGridMinConstraintsForChart below). Still useful if you want to warn
 * the user "content may clip" instead of hard-blocking the resize.
 */
export function getPanelRequiredGridHeight(
  params: Record<string, any> | undefined,
): number {
  const items = params?.panel_items || [];
  const columns = Math.max(1, params?.panel_columns || 4);
  const chartItems = items.filter((item: any) => item.type === 'chart');

  if (chartItems.length > 0) {
    const maxBottom = Math.max(
      ...chartItems.map((item: any, idx: number) => {
        const layout = resolvePanelItemLayout(item, idx, chartItems.length, columns);
        return layout.y + layout.h;
      }),
    );
    const requiredContentPx = (maxBottom / 100) * Math.max(PANEL_CHART_CELL_MIN_HEIGHT * 2, 240);
    return Math.max(3, Math.ceil(requiredContentPx / GRID_ROW_HEIGHT));
  }

  const itemCount = Math.max(1, chartItems.length || items.length);
  const rows = Math.max(1, Math.ceil(itemCount / columns));
  const cellHeightPx = chartItems.length > 0 ? PANEL_CHART_CELL_MIN_HEIGHT : PANEL_GRID_CELL_MIN_HEIGHT;
  const requiredContentPx = rows * cellHeightPx;
  return Math.max(3, Math.ceil(requiredContentPx / GRID_ROW_HEIGHT));
}

/**
 * Grid-unit min constraints for react-grid-layout.
 * FIX: panel no longer scales its minH with embedded chart count/rows —
 * that made panels unshrinkable once several charts were added. Panels now
 * use a small fixed floor like every other block; embedded charts use
 * percentage-based layout (PanelItemLayout) so they scale down with the
 * panel instead of forcing it to stay tall.
 */
export function getGridMinConstraintsForChart(
  chart: Chart,
  colWidth: number,
  cols = GRID_COLS,
): { minW: number; minH: number } {
  const viz = (chart.visualization_name || chart.chart_type || '').toString().toLowerCase();

  if (isStaticLayoutContentViz(viz)) {
    if (viz === 'divider') return { minW: gridUnitsFromLegacy(2, cols), minH: 1 };
    if (viz === 'text') return { minW: gridUnitsFromLegacy(2, cols), minH: 1 };
    if (viz === 'alert') return { minW: gridUnitsFromLegacy(2, cols), minH: 2 };
    if (viz === 'image') return { minW: gridUnitsFromLegacy(2, cols), minH: 2 };
    if (viz === 'panel') return { minW: gridUnitsFromLegacy(3, cols), minH: 3 };
  }

  return {
    minW: Math.max(1, Math.round(getMinWidthForChart(chart) / colWidth)),
    minH: Math.max(1, Math.round(getMinHeightForChart(chart) / GRID_ROW_HEIGHT)),
  };
}

export function dashboardChartsToLayout(
  charts: DashboardChart[],
  containerWidth: number,
  cols = GRID_COLS,
): Layout {
  const colWidth = getColWidth(containerWidth, cols);
  return charts.map((dc) => {
    const grid = dc.gridLayout
      ? dc.gridLayout
      : pixelsToGridUnits(dc.position.x, dc.position.y, dc.size.width, dc.size.height, containerWidth, cols);
    const { minW: chartMinW, minH: chartMinH } = getGridMinConstraintsForChart(dc.chart, colWidth);
    return {
      i: dc.id,
      x: grid.x, y: grid.y, w: grid.w, h: grid.h,
      minW: chartMinW,
      minH: chartMinH,
      maxW: cols,
    };
  });
}

/** Lock all items except the dragged one so RGL cannot reflow siblings during drag. */
export function withDragSiblingLocks(
  layout: Layout,
  draggedId: string | null | undefined,
): Layout {
  if (!draggedId) {
    return layout.map((item) => ({ ...item, static: false }));
  }
  return layout.map((item) => ({
    ...item,
    static: item.i !== draggedId,
  }));
}

/** Remove drag-time static flags before persisting layout. */
export function withoutLayoutDragLocks(layout: Layout): Layout {
  return layout.map(({ static: _static, ...item }) => item);
}

export function applyLayoutToDashboardCharts(
  charts: DashboardChart[],
  layout: Layout,
  containerWidth: number,
  cols = GRID_COLS,
): DashboardChart[] {
  return charts.map((dc) => {
    const item = layout.find((l) => l.i === dc.id);
    if (!item) return dc;
    const gridLayout = { x: item.x, y: item.y, w: item.w, h: item.h };
    const px = gridUnitsToPixels(item.x, item.y, item.w, item.h, containerWidth, cols);
    const gridUnchanged =
      dc.gridLayout?.x === gridLayout.x &&
      dc.gridLayout?.y === gridLayout.y &&
      dc.gridLayout?.w === gridLayout.w &&
      dc.gridLayout?.h === gridLayout.h;
    const pxUnchanged =
      dc.position.x === px.x &&
      dc.position.y === px.y &&
      dc.size.width === px.width &&
      dc.size.height === px.height;
    if (gridUnchanged && pxUnchanged) return dc;
    return {
      ...dc,
      gridLayout,
      position: { x: px.x, y: px.y },
      size: { width: px.width, height: px.height },
    };
  });
}

export function syncDashboardChartsPixelsForWidth(
  charts: DashboardChart[],
  containerWidth: number,
  cols = GRID_COLS,
): DashboardChart[] {
  return charts.map((dc) => {
    if (!dc.gridLayout) return dc;
    const px = gridUnitsToPixels(dc.gridLayout.x, dc.gridLayout.y, dc.gridLayout.w, dc.gridLayout.h, containerWidth, cols);
    if (
      dc.position.x === px.x &&
      dc.position.y === px.y &&
      dc.size.width === px.width &&
      dc.size.height === px.height
    ) {
      return dc;
    }
    return {
      ...dc,
      position: { x: px.x, y: px.y },
      size: { width: px.width, height: px.height },
    };
  });
}

/**
 * Items sharing the same grid row (same y), left-to-right.
 */
export function getLayoutRowItems(layout: Layout, rowY: number): Layout {
  return layout.filter((item) => item.y === rowY).sort((a, b) => a.x - b.x);
}

/**
 * True when row items are packed from x=0 with no gaps and span the full column count.
 */
export function isGridRowFull(rowItems: Layout, cols = GRID_COLS): boolean {
  if (rowItems.length === 0) return false;
  const sorted = [...rowItems].sort((a, b) => a.x - b.x);
  if (sorted[0].x !== 0) return false;
  let expectedX = 0;
  for (const item of sorted) {
    if (item.x !== expectedX) return false;
    expectedX += item.w;
  }
  return expectedX === cols;
}

type ColWeightItem = { i: string; minW?: number; weight: number };

/** Split `totalCols` across items proportionally while honoring minW. */
function distributeGridColsWithMinConstraints(
  items: ColWeightItem[],
  totalCols: number,
): Map<string, number> {
  const result = new Map<string, number>();
  if (items.length === 0) return result;
  if (items.length === 1) {
    result.set(items[0].i, totalCols);
    return result;
  }

  const mins = items.map((item) => Math.max(1, item.minW ?? 1));
  const minSum = mins.reduce((sum, value) => sum + value, 0);
  const effectiveTotal = Math.max(totalCols, minSum);

  const weightSum = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  let widths = items.map((item, index) => {
    const ratio =
      weightSum > 0
        ? Math.max(0, item.weight) / weightSum
        : 1 / items.length;
    return Math.max(mins[index], Math.round(ratio * effectiveTotal));
  });

  let total = widths.reduce((sum, value) => sum + value, 0);
  let diff = effectiveTotal - total;
  if (diff !== 0) {
    const lastIndex = widths.length - 1;
    widths[lastIndex] = Math.max(mins[lastIndex], widths[lastIndex] + diff);
    total = widths.reduce((sum, value) => sum + value, 0);
    diff = effectiveTotal - total;
    if (diff !== 0) {
      for (let index = widths.length - 1; index >= 0 && diff !== 0; index -= 1) {
        const room = widths[index] - mins[index];
        if (room <= 0) continue;
        const take = diff > 0 ? Math.min(room, diff) : -Math.min(room, -diff);
        widths[index] += take;
        diff -= take;
      }
    }
  }

  items.forEach((item, index) => {
    result.set(item.i, widths[index]);
  });
  return result;
}

/** Assign contiguous x positions for row items using the provided widths. */
function assignRowPositions(
  rowItems: Layout,
  widths: Map<string, number>,
): Map<string, { x: number; w: number }> {
  const positions = new Map<string, { x: number; w: number }>();
  let x = 0;
  for (const item of rowItems) {
    const w = widths.get(item.i) ?? item.w;
    positions.set(item.i, { x, w });
    x += w;
  }
  return positions;
}

/**
 * After adding widgets to a row, split the row evenly so charts sit one after another
 * and fill the available width.
 */
export function redistributeGridRowEqually(
  layout: Layout,
  rowY: number,
  cols = GRID_COLS,
): Layout {
  const rowItems = getLayoutRowItems(layout, rowY);
  if (rowItems.length <= 1) return layout;

  const widths = distributeGridColsWithMinConstraints(
    rowItems.map((item) => ({ i: item.i, minW: item.minW, weight: 1 })),
    cols,
  );
  const positions = assignRowPositions(rowItems, widths);

  return layout.map((item) => {
    const next = positions.get(item.i);
    return next ? { ...item, x: next.x, w: next.w } : item;
  });
}

/**
 * When a full row is resized, keep the resized widget anchored at its grid x/y and
 * redistribute width only across widgets to its right so the row still spans `cols`.
 */
export function redistributeGridRowOnResize(
  layout: Layout,
  resizedItemId: string,
  cols = GRID_COLS,
): Layout {
  const resized = layout.find((item) => item.i === resizedItemId);
  if (!resized) return layout;

  const rowItems = getLayoutRowItems(layout, resized.y);
  if (!isGridRowFull(rowItems, cols)) return layout;

  const sorted = [...rowItems].sort((a, b) => a.x - b.x);
  const leftItems = sorted.filter((item) => item.x < resized.x);
  const rightItems = sorted.filter((item) => item.x > resized.x);

  if (rightItems.length === 0) {
    const leftCols = leftItems.reduce((sum, item) => sum + item.w, 0);
    const maxW = Math.max(resized.minW ?? 1, cols - leftCols);
    const clampedW = Math.max(resized.minW ?? 1, Math.min(maxW, resized.w));
    return layout.map((item) =>
      item.i === resizedItemId ? { ...item, w: clampedW } : item,
    );
  }

  const leftCols = leftItems.reduce((sum, item) => sum + item.w, 0);
  const rightMinTotal = rightItems.reduce((sum, item) => sum + Math.max(1, item.minW ?? 1), 0);
  const maxResizedW = Math.max(resized.minW ?? 1, cols - leftCols - rightMinTotal);
  const newResizedW = Math.max(resized.minW ?? 1, Math.min(maxResizedW, resized.w));
  const remainingCols = Math.max(0, cols - leftCols - newResizedW);

  const rightWidths = distributeGridColsWithMinConstraints(
    rightItems.map((item) => ({ i: item.i, minW: item.minW, weight: item.w })),
    remainingCols,
  );

  const widthById = new Map<string, number>();
  leftItems.forEach((item) => widthById.set(item.i, item.w));
  widthById.set(resizedItemId, newResizedW);
  rightItems.forEach((item) => widthById.set(item.i, rightWidths.get(item.i) ?? item.w));

  const xById = new Map<string, number>();
  leftItems.forEach((item) => xById.set(item.i, item.x));
  xById.set(resizedItemId, resized.x);

  let nextX = resized.x + newResizedW;
  for (const item of rightItems) {
    const w = widthById.get(item.i) ?? item.w;
    xById.set(item.i, nextX);
    nextX += w;
  }

  // Absorb grid rounding drift on the last item in the row.
  if (rightItems.length > 0 && nextX !== cols) {
    const lastItem = rightItems[rightItems.length - 1];
    const adjustedW = Math.max(
      lastItem.minW ?? 1,
      (widthById.get(lastItem.i) ?? lastItem.w) + (cols - nextX),
    );
    widthById.set(lastItem.i, adjustedW);
  }

  return layout.map((item) => {
    const newX = xById.get(item.i);
    const newW = widthById.get(item.i);
    if (newX == null || newW == null) return item;
    return { ...item, x: newX, w: newW };
  });
}

/**
 * Place the next widget left-to-right on the current bottom row; wrap to a new row
 * when the row has no remaining space. Uses the chart's default width (not full row).
 */
export function findNextGridPosition(
  layout: Layout,
  defaultSize: { w: number; h: number },
  cols = GRID_COLS,
): { x: number; y: number; w: number; h: number } {
  const w = Math.max(1, Math.min(cols, defaultSize.w));
  const h = Math.max(1, defaultSize.h);

  if (!layout.length) {
    return { x: 0, y: 0, w, h };
  }

  const rowsByY = new Map<number, LayoutItem[]>();
  for (const item of layout) {
    const row = rowsByY.get(item.y) ?? [];
    row.push(item);
    rowsByY.set(item.y, row);
  }

  const rowYs = [...rowsByY.keys()].sort((a, b) => a - b);
  const lastRowY = rowYs[rowYs.length - 1]!;
  const lastRowItems = rowsByY.get(lastRowY)!;
  const rowRightEdge = Math.max(...lastRowItems.map((item) => item.x + item.w));
  const rowHeight = Math.max(...lastRowItems.map((item) => item.h));

  if (rowRightEdge + w <= cols) {
    return { x: rowRightEdge, y: lastRowY, w, h };
  }

  return { x: 0, y: lastRowY + rowHeight, w, h };
}

/** Append a new chart at the computed position without resizing siblings. */
export function layoutAfterAddingChart(
  layout: Layout,
  newItem: Layout[number],
  _cols = GRID_COLS,
): Layout {
  return [...layout, newItem];
}

export function syncChartsFromGridLayout(
  charts: DashboardChart[],
  newLayout: Layout,
  containerWidth: number,
  cols = GRID_COLS,
): DashboardChart[] {
  return applyLayoutToDashboardCharts(charts, newLayout, containerWidth, cols);
}

export function getDefaultGridSizeForChart(chart: Chart, containerWidth: number, cols = GRID_COLS): { w: number; h: number } {
  const colWidth = getColWidth(containerWidth, cols);
  const viz = (chart.visualization_name || chart.chart_type || '').toLowerCase();

  if (viz === 'divider') return { w: cols, h: 1 };
  if (viz === 'panel') return { w: Math.min(cols, gridUnitsFromLegacy(4, cols)), h: 12 };
  if (viz === 'text') return { w: gridUnitsFromLegacy(3, cols), h: 2 };
  if (viz === 'alert') return { w: gridUnitsFromLegacy(3, cols), h: 2 };
  if (viz === 'image') return { w: gridUnitsFromLegacy(4, cols), h: 6 };

  const isBigNumber =
    viz.includes('big') && (viz.includes('number') || viz.includes('bignumber') || viz.includes('big_number'));

  const widthPx = isBigNumber ? DEFAULT_BIG_NUMBER_WIDTH : DEFAULT_NEW_WIDGET_WIDTH;
  const heightPx = isBigNumber ? DEFAULT_BIG_NUMBER_HEIGHT : DEFAULT_CHART_HEIGHT;

  return {
    w: Math.max(1, Math.min(cols, Math.round(widthPx / colWidth))),
    h: Math.max(1, Math.round(heightPx / GRID_ROW_HEIGHT)),
  };
}

export function getGridRowCountFromCharts(
  charts: DashboardChart[],
  containerWidth: number,
  cols = GRID_COLS,
): number {
  if (charts.length === 0) return 0;
  const layout = dashboardChartsToLayout(charts, containerWidth, cols);
  return Math.max(0, ...layout.map((item) => item.y + item.h));
}

export function getGridContentHeightFromCharts(
  charts: DashboardChart[],
  containerWidth: number,
  cols = GRID_COLS,
): number {
  const rowCount = getGridRowCountFromCharts(charts, containerWidth, cols);
  if (rowCount === 0) return 400;
  const px = gridUnitsToPixels(0, 0, cols, rowCount, containerWidth, cols);
  // Extra row buffer so scroll reaches the last chart row reliably.
  return px.y + px.height + GRID_ROW_HEIGHT;
}

type GridRect = { x: number; y: number; w: number; h: number };

export function gridLayoutOverlapRatio(a: GridRect, b: GridRect): number {
  const xOverlap = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const yOverlap = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const overlapArea = xOverlap * yOverlap;
  if (overlapArea <= 0) return 0;
  const minArea = Math.min(a.w * a.h, b.w * b.h);
  return minArea > 0 ? overlapArea / minArea : 0;
}

export function gridFootprintsEqual(a: GridRect, b: GridRect): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

export function gridFootprintsDifferInSize(a: GridRect, b: GridRect): boolean {
  return a.w !== b.w || a.h !== b.h;
}

/** Find a layout item to swap with — center-over-target first, then overlap ratio. */
export function findGridLayoutSwapTarget(
  dragged: GridRect & { i?: string },
  layout: Layout,
  excludeId?: string,
  minOverlapRatio = 0.35,
): Layout[number] | null {
  const draggedCx = dragged.x + dragged.w / 2;
  const draggedCy = dragged.y + dragged.h / 2;

  for (const item of layout) {
    if (excludeId && item.i === excludeId) continue;
    if (
      draggedCx >= item.x &&
      draggedCx < item.x + item.w &&
      draggedCy >= item.y &&
      draggedCy < item.y + item.h
    ) {
      return item;
    }
  }

  let bestTarget: Layout[number] | null = null;
  let maxOverlapRatio = 0;

  for (const item of layout) {
    if (excludeId && item.i === excludeId) continue;
    const sizeDiffers = gridFootprintsDifferInSize(dragged, item);
    const ratio = gridLayoutOverlapRatio(dragged, item);
    const threshold = sizeDiffers ? Math.min(minOverlapRatio, 0.2) : minOverlapRatio;
    if (ratio >= threshold && ratio > maxOverlapRatio) {
      maxOverlapRatio = ratio;
      bestTarget = item;
    }
  }

  if (bestTarget) return bestTarget;

  for (const item of layout) {
    if (excludeId && item.i === excludeId) continue;
    const targetCx = item.x + item.w / 2;
    const targetCy = item.y + item.h / 2;
    const targetCenterInside =
      targetCx >= dragged.x &&
      targetCx < dragged.x + dragged.w &&
      targetCy >= dragged.y &&
      targetCy < dragged.y + dragged.h;
    if (targetCenterInside) return item;
  }

  return null;
}

/** Find swap target on drop — overlap, center-over-target, or nearest widget under cursor. */
export function findSwapTargetAtDrop(
  dragged: GridRect & { i?: string },
  layout: Layout,
  excludeId?: string,
): Layout[number] | null {
  const direct = findGridLayoutSwapTarget(dragged, layout, excludeId, 0.15);
  if (direct) return direct;

  const draggedCx = dragged.x + dragged.w / 2;
  const draggedCy = dragged.y + dragged.h / 2;

  let bestTarget: Layout[number] | null = null;
  let bestScore = Infinity;

  for (const item of layout) {
    if (excludeId && item.i === excludeId) continue;

    const targetCx = item.x + item.w / 2;
    const targetCy = item.y + item.h / 2;
    const inExpandedBounds =
      draggedCx >= item.x - 0.5 &&
      draggedCx < item.x + item.w + 0.5 &&
      draggedCy >= item.y - 0.5 &&
      draggedCy < item.y + item.h + 0.5;

    if (!inExpandedBounds) continue;

    const score = Math.abs(draggedCx - targetCx) + Math.abs(draggedCy - targetCy);
    if (score < bestScore) {
      bestScore = score;
      bestTarget = item;
    }
  }

  return bestTarget;
}

/** Exchange full grid footprints between two widgets for a clean animated swap. */
export function swapGridLayoutFootprints(
  layoutSnapshot: Layout,
  draggedId: string,
  targetId: string,
): Layout {
  const draggedStart = layoutSnapshot.find((l) => l.i === draggedId);
  const targetStart = layoutSnapshot.find((l) => l.i === targetId);
  if (!draggedStart || !targetStart) return layoutSnapshot;

  const pickFootprint = (source: Layout[number]) => ({
    x: source.x,
    y: source.y,
    w: source.w,
    h: source.h,
  });

  const draggedFootprint = pickFootprint(draggedStart);
  const targetFootprint = pickFootprint(targetStart);

  return layoutSnapshot.map((item) => {
    if (item.i === draggedId) return { ...item, ...targetFootprint };
    if (item.i === targetId) return { ...item, ...draggedFootprint };
    return { ...item };
  });
}

/** Exchange grid positions between two widgets; each keeps its own size. */
export function swapGridLayoutPositions(
  layoutSnapshot: Layout,
  draggedId: string,
  targetId: string,
): Layout {
  const draggedStart = layoutSnapshot.find((l) => l.i === draggedId);
  const targetStart = layoutSnapshot.find((l) => l.i === targetId);
  if (!draggedStart || !targetStart) return layoutSnapshot;

  return layoutSnapshot.map((item) => {
    if (item.i === draggedId) {
      return { ...item, x: targetStart.x, y: targetStart.y };
    }
    if (item.i === targetId) {
      return { ...item, x: draggedStart.x, y: draggedStart.y };
    }
    return { ...item };
  });
}

/** @deprecated Use swapGridLayoutFootprints for widget swap. */
export function swapGridLayoutItems(
  layoutSnapshot: Layout,
  draggedId: string,
  targetId: string,
): Layout {
  return swapGridLayoutFootprints(layoutSnapshot, draggedId, targetId);
}

/** Swap two widgets' positions unless a third widget would be overlapped or items leave the grid. */
export function trySwapLayoutPositions(
  layout: Layout,
  draggedId: string,
  targetId: string,
  cols = GRID_COLS,
): Layout | null {
  const swappedLayout = swapGridLayoutPositions(layout, draggedId, targetId);
  const dragged = swappedLayout.find((item) => item.i === draggedId);
  const target = swappedLayout.find((item) => item.i === targetId);
  if (!dragged || !target) return null;

  if (
    dragged.x < 0 ||
    dragged.y < 0 ||
    target.x < 0 ||
    target.y < 0 ||
    dragged.x + dragged.w > cols ||
    target.x + target.w > cols
  ) {
    return null;
  }

  for (const item of swappedLayout) {
    if (item.i === draggedId || item.i === targetId) continue;
    if (gridLayoutsOverlap(dragged, item) || gridLayoutsOverlap(target, item)) {
      return null;
    }
  }

  return swappedLayout;
}

/** Swap two widgets' footprints unless a third widget would be overlapped. */
export function trySwapLayoutFootprints(
  layout: Layout,
  draggedId: string,
  targetId: string,
): Layout | null {
  const swappedLayout = swapGridLayoutFootprints(layout, draggedId, targetId);
  const dragged = swappedLayout.find((item) => item.i === draggedId);
  const target = swappedLayout.find((item) => item.i === targetId);
  if (!dragged || !target) return null;

  for (const item of swappedLayout) {
    if (item.i === draggedId || item.i === targetId) continue;
    if (gridLayoutsOverlap(dragged, item) || gridLayoutsOverlap(target, item)) {
      return null;
    }
  }

  return swappedLayout;
}

/** Swap two widgets' footprints if the result has no overlaps; otherwise return null. */
export function trySwapDashboardChartsLayout(
  charts: DashboardChart[],
  draggedId: string,
  targetId: string,
  containerWidth: number,
  cols = GRID_COLS,
): DashboardChart[] | null {
  const layout = dashboardChartsToLayout(charts, containerWidth, cols);
  const swappedLayout = trySwapLayoutPositions(layout, draggedId, targetId, cols);
  if (!swappedLayout) return null;
  return applyLayoutToDashboardCharts(charts, swappedLayout, containerWidth, cols);
}

/** Swap two widgets' positions and recalculate pixel fields. */
export function swapDashboardChartsLayout(
  charts: DashboardChart[],
  draggedId: string,
  targetId: string,
  containerWidth: number,
  cols = GRID_COLS,
): DashboardChart[] {
  return trySwapDashboardChartsLayout(charts, draggedId, targetId, containerWidth, cols)
    ?? charts;
}

export function applySingleItemGridMove(
  layoutSnapshot: Layout,
  itemId: string,
  footprint: GridRect,
): Layout {
  return layoutSnapshot.map((item) =>
    item.i === itemId ? { ...item, x: footprint.x, y: footprint.y, w: footprint.w, h: footprint.h } : { ...item },
  );
}

export function gridLayoutsOverlap(a: GridRect, b: GridRect): boolean {
  return gridLayoutOverlapRatio(a, b) > 0;
}

/** True when any two layout items overlap. */
export function hasLayoutOverlaps(layout: Layout): boolean {
  for (let i = 0; i < layout.length; i += 1) {
    for (let j = i + 1; j < layout.length; j += 1) {
      if (gridLayoutsOverlap(layout[i], layout[j])) return true;
    }
  }
  return false;
}

export function createDashboardChartFromGridPlacement(
  chart: Chart,
  gridPos: { x: number; y: number; w: number; h: number },
  containerWidth: number,
  id = `dashboard-chart-${Date.now()}`,
  cols = GRID_COLS,
): DashboardChart {
  const px = gridUnitsToPixels(gridPos.x, gridPos.y, gridPos.w, gridPos.h, containerWidth, cols);
  return {
    id,
    chartId: chart.id,
    chart,
    gridLayout: gridPos,
    position: { x: px.x, y: px.y },
    size: { width: px.width, height: px.height },
    isLoading: !['panel', 'text', 'image', 'alert', 'divider'].includes(
      (chart.visualization_name || chart.chart_type || '').toLowerCase(),
    ),
  };
}