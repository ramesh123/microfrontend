import { DashboardChart, Chart } from '../types';
import { GRID_COLS, GRID_CELL_HEIGHT, GRID_CELL_WIDTH, getGridColCount } from '../layoutConstants';
import { CHART_GAP, DEFAULT_NEW_WIDGET_WIDTH, DEFAULT_NEW_WIDGET_HEIGHT, MIN_BIG_NUMBER_WIDTH, MIN_BIG_NUMBER_HEIGHT } from '../dashboardConstants';
import {
  isPieDonutOrRadiusPieChart,
  isRadiusPieChart,
  normalizePieLikeChartRows,
  extractDashboardChartResponseRows,
  isCategoryValuePieRow,
} from '@/pages/charts/chartVizTypes';
import {
  isBigNumberVisualization,
  coerceBigNumberChartItems,
  type BigNumberMetricConfig,
} from '@/pages/charts/components/charts/bigNumber';

export { isPieDonutOrRadiusPieChart, isRadiusPieChart, normalizePieLikeChartRows, extractDashboardChartResponseRows, isCategoryValuePieRow };

// Helper function to check if two rectangles overlap
export const checkOverlap = (
  x1: number, y1: number, w1: number, h1: number,
  x2: number, y2: number, w2: number, h2: number
): boolean => {
  return !(x1 + w1 <= x2 || x2 + w2 <= x1 || y1 + h1 <= y2 || y2 + h2 <= y1);
};

export type RowLayoutItem = { row: number; top: number; height: number };

/**
 * Compute row layout so each row's top is the cumulative end of the previous row's
 * actual widget height (not based on default rowHeight or chart.position.y).
 * Partitions charts into rows by vertical overlap, then sets row i height = max(widget heights in row i) + GAP,
 * row i top = sum of previous row heights (row 0 top = CHART_GAP/2).
 */
export function computeRowLayoutFromWidgetHeights(
  dashboardCharts: Array<{ position: { x: number; y: number }; size: { width: number; height: number } }>,
  defaultRowHeightFallback: number
): RowLayoutItem[] {
  if (!dashboardCharts || dashboardCharts.length === 0) {
    return [{ row: 0, top: Math.floor(CHART_GAP / 2), height: Math.max(50, defaultRowHeightFallback - CHART_GAP) + CHART_GAP }];
  }

  const sorted = [...dashboardCharts].sort((a, b) => a.position.y - b.position.y);
  const rowGroups: Array<Array<{ position: { y: number }; size: { height: number } }>> = [];
  let currentRow: Array<{ position: { y: number }; size: { height: number } }> = [];
  let rowTop = Math.floor(CHART_GAP / 2);
  let currentRowMaxBottom = 0;

  for (const c of sorted) {
    const chartTop = c.position.y;
    const chartBottom = c.position.y + c.size.height;
    if (currentRow.length === 0) {
      currentRow.push(c);
      currentRowMaxBottom = rowTop + Math.max(...currentRow.map(ch => ch.size.height)) + CHART_GAP;
      continue;
    }
    if (chartTop < currentRowMaxBottom) {
      currentRow.push(c);
      currentRowMaxBottom = rowTop + Math.max(...currentRow.map(ch => ch.size.height)) + CHART_GAP;
    } else {
      rowGroups.push(currentRow);
      const maxH = Math.max(...currentRow.map(ch => ch.size.height));
      rowTop = currentRowMaxBottom;
      currentRow = [c];
      currentRowMaxBottom = rowTop + c.size.height + CHART_GAP;
    }
  }
  if (currentRow.length > 0) rowGroups.push(currentRow);

  const rows: RowLayoutItem[] = [];
  const firstRowCharts = rowGroups[0];
  const firstRowMinY = firstRowCharts.length > 0 ? Math.min(...firstRowCharts.map(ch => ch.position.y)) : 0;
  let cumulative = Math.min(Math.floor(CHART_GAP / 2), firstRowMinY);
  for (let i = 0; i < rowGroups.length; i++) {
    const charts = rowGroups[i];
    const maxH = Math.max(...charts.map(ch => ch.size.height));
    const h = Math.max(50, maxH) + CHART_GAP;
    const top = cumulative;
    rows.push({ row: i, top, height: h });
    cumulative += h;
  }
  const maxRow = rows.length - 1;
  rows.push({ row: maxRow + 1, top: cumulative + Math.floor(CHART_GAP / 2), height: defaultRowHeightFallback });
  return rows;
}

// Helper function to get which row a Y position belongs to (uses dynamic rowLayout)
export const getRowForY = (
  y: number,
  rowLayout: Array<{ row: number; top: number; height: number }>,
  ROW_HEIGHT: number
): number => {
  if (!rowLayout || rowLayout.length === 0) return Math.floor((y - (CHART_GAP / 2)) / ROW_HEIGHT);
  for (const r of rowLayout) {
    if (y >= r.top && y < r.top + r.height) return r.row;
  }
  // fallback to last row if below
  return rowLayout[rowLayout.length - 1]?.row ?? Math.floor((y - (CHART_GAP / 2)) / ROW_HEIGHT);
};

// Helper function to get Y position for a row (uses dynamic rowLayout)
export const getYForRow = (
  row: number,
  rowLayout: Array<{ row: number; top: number; height: number }>,
  ROW_HEIGHT: number
): number => {
  const found = rowLayout.find(r => r.row === row);
  if (found) return found.top;
  return row * ROW_HEIGHT + (CHART_GAP / 2);
};

// Helper function to get charts in a specific row
export const getChartsInRow = (
  row: number,
  dashboardCharts: DashboardChart[],
  excludeId?: string,
  rowLayout?: Array<{ row: number; top: number; height: number }>,
  ROW_HEIGHT?: number
): DashboardChart[] => {
  return dashboardCharts.filter(dc => {
    if (excludeId && dc.id === excludeId) return false;
    const chartRow = rowLayout && ROW_HEIGHT
      ? getRowForY(dc.position.y, rowLayout, ROW_HEIGHT)
      : Math.floor((dc.position.y - (CHART_GAP / 2)) / (ROW_HEIGHT || 400));
    return chartRow === row;
  }).sort((a, b) => a.position.x - b.position.x); // Sort by X position (left to right)
};

// Helper function to calculate available space in a row
export const getAvailableSpaceInRow = (
  row: number,
  dashboardCharts: DashboardChart[],
  CONTAINER_WIDTH: number,
  excludeId?: string,
  rowLayout?: Array<{ row: number; top: number; height: number }>,
  ROW_HEIGHT?: number
): number => {
  const chartsInRow = getChartsInRow(row, dashboardCharts, excludeId, rowLayout, ROW_HEIGHT);
  if (chartsInRow.length === 0) {
    return CONTAINER_WIDTH - (CHART_GAP * 2); // Full width minus padding
  }
  const rightmostChart = chartsInRow[chartsInRow.length - 1];
  const usedWidth = rightmostChart.position.x + rightmostChart.size.width;
  return CONTAINER_WIDTH - usedWidth - CHART_GAP; // Remaining space
};

// Helper function to calculate optimal chart width based on row space
export const calculateChartWidth = (
  row: number,
  chartCount: number,
  dashboardCharts: DashboardChart[],
  CONTAINER_WIDTH: number,
  excludeId?: string,
  rowLayout?: Array<{ row: number; top: number; height: number }>,
  ROW_HEIGHT?: number
): number => {
  const availableSpace = getAvailableSpaceInRow(row, dashboardCharts, CONTAINER_WIDTH, excludeId, rowLayout, ROW_HEIGHT);
  const minWidth = 300; // Minimum chart width
  const maxWidth = 800; // Maximum chart width

  if (chartCount === 0) {
    // If row is empty, prefer to use available space but respect min/max.
    // Do not allow placing a chart smaller than minWidth — caller should
    // try the next row if available space < minWidth.
    return Math.max(minWidth, Math.min(maxWidth, availableSpace));
  }

  // Calculate width: distribute available space among charts
  // Each chart gets equal space, but respect min/max constraints
  const totalGaps = (chartCount + 1) * CHART_GAP; // Gaps between and around charts
  const spaceForCharts = availableSpace - totalGaps;
  const calculatedWidth = Math.floor(spaceForCharts / chartCount);

  // Clamp between min and max
  return Math.max(minWidth, Math.min(maxWidth, calculatedWidth));
};

// Helper function to find next available position in a row
export const findNextPositionInRow = (
  row: number,
  chartWidth: number,
  dashboardCharts: DashboardChart[],
  CONTAINER_WIDTH: number,
  excludeId?: string,
  rowLayout?: Array<{ row: number; top: number; height: number }>,
  ROW_HEIGHT?: number
): { x: number; y: number } | null => {
  const chartsInRow = getChartsInRow(row, dashboardCharts, excludeId, rowLayout, ROW_HEIGHT);
  const rowY = rowLayout && ROW_HEIGHT
    ? getYForRow(row, rowLayout, ROW_HEIGHT)
    : row * (ROW_HEIGHT || 400) + (CHART_GAP / 2);

  // If row is empty, place at the start (x = 0 for first chart)
  if (chartsInRow.length === 0) {
    // First chart in empty row should start at x = 0 (no left gap)
    const startX = 0;
    const fits = startX + chartWidth + CHART_GAP <= (CONTAINER_WIDTH + 1);
    if (fits) return { x: startX, y: rowY };
    return null;
  }

  // Find the rightmost chart
  const rightmostChart = chartsInRow[chartsInRow.length - 1];
  const nextX = rightmostChart.position.x + rightmostChart.size.width + CHART_GAP;

  // Strict check: ensure chart fits with gap on both sides
  // Use a small tolerance (+1px) so small fractional/layout differences
  // don't prevent dropping into a row that visibly has enough space.
  if (nextX + chartWidth + CHART_GAP <= (CONTAINER_WIDTH + 1)) {
    return { x: nextX, y: rowY };
  }

  // Row is full - cannot place chart here
  return null;
};

// Helper function to find the first available row that can fit the chart
export const findAvailableRow = (
  chartWidth: number,
  dashboardCharts: DashboardChart[],
  CONTAINER_WIDTH: number,
  GRID_ROWS: number,
  startRow: number = 0,
  excludeId?: string,
  rowLayout?: Array<{ row: number; top: number; height: number }>,
  ROW_HEIGHT?: number
): { row: number; position: { x: number; y: number } } => {
  // Try starting from the specified row - allow unlimited rows
  const maxRows = Math.max(GRID_ROWS + 50, startRow + 100); // Allow many rows
  for (let row = startRow; row < maxRows; row++) {
    const position = findNextPositionInRow(row, chartWidth, dashboardCharts, CONTAINER_WIDTH, excludeId, rowLayout, ROW_HEIGHT);
    if (position) {
      return { row, position };
    }
  }

  // If no row found, create a new one at the end (unlimited rows)
  const lastRow = dashboardCharts.length > 0
    ? Math.max(0, ...dashboardCharts.map(dc => 
        rowLayout && ROW_HEIGHT
          ? getRowForY(dc.position.y, rowLayout, ROW_HEIGHT)
          : Math.floor((dc.position.y - (CHART_GAP / 2)) / (ROW_HEIGHT || 400))
      ))
    : 0;
  const newRow = lastRow + 1;
  const newRowY = rowLayout && ROW_HEIGHT
    ? getYForRow(newRow, rowLayout, ROW_HEIGHT)
    : newRow * (ROW_HEIGHT || 400) + (CHART_GAP / 2);
  // For a freshly created row, allow the first widget to be placed at x=0
  return { row: newRow, position: { x: 0, y: newRowY } };
};

// Helper function to redistribute chart widths in a row to fill available space
export const redistributeRowWidths = (
  row: number,
  dashboardCharts: DashboardChart[],
  CONTAINER_WIDTH: number,
  excludeId?: string,
  rowLayout?: Array<{ row: number; top: number; height: number }>,
  ROW_HEIGHT?: number
): Array<{ id: string; position: { x: number; y: number }; size: { width: number; height: number } }> => {
  const chartsInRow = getChartsInRow(row, dashboardCharts, excludeId, rowLayout, ROW_HEIGHT);
  if (chartsInRow.length === 0) return [];

  // If any chart is flush-left (x===0) we should not reserve the left-side
  // CHART_GAP padding. Adjust available space accordingly so charts fill the
  // container without leaving an extra right-side gap.
  const anyFlushLeft = chartsInRow.some(c => Math.round(c.position.x) === 0);
  const leftPadding = anyFlushLeft ? 0 : CHART_GAP;
  const rightPadding = CHART_GAP;
  const availableSpace = CONTAINER_WIDTH - leftPadding - rightPadding; // Total space minus padding
  const totalGaps = (chartsInRow.length - 1) * CHART_GAP; // Gaps between charts
  const spaceForCharts = availableSpace - totalGaps;

  // Calculate width per chart
  const minWidth = 300;
  const maxWidth = 800;
  let calculatedWidth = Math.floor(spaceForCharts / chartsInRow.length);

  // Single chart in a row uses full available width
  if (chartsInRow.length === 1) {
    calculatedWidth = Math.round(spaceForCharts);
  } else {
    // Clamp between min and max
    calculatedWidth = Math.max(minWidth, Math.min(maxWidth, calculatedWidth));
  }

  // Update chart positions and widths - start packing at leftPadding
  // Compute widths for each chart, and let the last chart absorb any leftover
  // pixels caused by rounding so the row fills the container without a gap.
  const widths: number[] = [];
  for (let i = 0; i < chartsInRow.length; i++) {
    // For uniform distribution use calculatedWidth for all, but allow single
    // chart to take full space (already handled above).
    widths.push(calculatedWidth);
  }

  // If there is any rounding remainder, add it to the last chart so the
  // row doesn't show a small empty gap on the right side.
  const totalAssigned = widths.reduce((s, v) => s + v, 0);
  const totalGapsWidth = totalGaps;
  const remainder = availableSpace - totalAssigned - totalGapsWidth;
  if (remainder > 0 && widths.length > 0) {
    widths[widths.length - 1] = widths[widths.length - 1] + remainder;
  }

  const rowY =
    rowLayout && ROW_HEIGHT
      ? getYForRow(row, rowLayout, ROW_HEIGHT)
      : chartsInRow[0]?.position.y ?? CHART_GAP / 2;

  let currentX = leftPadding;
  return chartsInRow.map((chart, idx) => {
    const w = Math.max(minWidth, Math.min(maxWidth, widths[idx]));
    const updated = {
      id: chart.id,
      position: { x: currentX, y: rowY },
      size: { width: w, height: chart.size.height }
    };
    currentX += w + CHART_GAP;
    return updated;
  });
};

/** Min width getter type for proportional redistribution */
export type GetMinWidthForChart = (chart: Chart) => number;

/**
 * Redistribute chart widths in a row proportionally to their current widths
 * when container width changes (e.g. sidebar collapse/expand). Preserves
 * width ratios instead of forcing equal widths.
 * Example: widths 5 and 4 (total 9), +3 columns → Chart1 gets (5/9)*12 ≈ 6.67, Chart2 gets (4/9)*12 ≈ 5.33.
 */
export const redistributeRowWidthsProportional = (
  row: number,
  dashboardCharts: DashboardChart[],
  CONTAINER_WIDTH: number,
  getMinWidthForChart: GetMinWidthForChart,
  rowLayout?: Array<{ row: number; top: number; height: number }>,
  ROW_HEIGHT?: number
): Array<{ id: string; position: { x: number; y: number }; size: { width: number; height: number } }> => {
  const chartsInRow = getChartsInRow(row, dashboardCharts, undefined, rowLayout, ROW_HEIGHT);
  if (chartsInRow.length === 0) return [];

  const anyFlushLeft = chartsInRow.some(c => Math.round(c.position.x) === 0);
  const leftPadding = anyFlushLeft ? 0 : CHART_GAP;
  const rightPadding = CHART_GAP;
  const availableSpace = CONTAINER_WIDTH - leftPadding - rightPadding;
  const totalGaps = (chartsInRow.length - 1) * CHART_GAP;
  const spaceForCharts = availableSpace - totalGaps;

  const minWidths = chartsInRow.map((c) => getMinWidthForChart(c.chart));

  const rowY =
    rowLayout && ROW_HEIGHT
      ? getYForRow(row, rowLayout, ROW_HEIGHT)
      : chartsInRow[0]?.position.y ?? CHART_GAP / 2;

  // One chart in a row should use the full row width (saved dashboards often store full-row width_px)
  if (chartsInRow.length === 1) {
    const chart = chartsInRow[0];
    const w = Math.max(minWidths[0], Math.round(spaceForCharts));
    return [{
      id: chart.id,
      position: { x: leftPadding, y: rowY },
      size: { width: w, height: chart.size.height },
    }];
  }

  const totalCurrentWidth = chartsInRow.reduce((sum, c) => sum + c.size.width, 0);
  if (totalCurrentWidth <= 0) return [];

  const maxWidth = 800;
  // Target width for each chart: proportional to current width ratio
  let widths = chartsInRow.map((chart, i) => {
    const ratio = chart.size.width / totalCurrentWidth;
    const target = ratio * spaceForCharts;
    return Math.max(minWidths[i], Math.min(maxWidth, Math.round(target)));
  });

  let totalAssigned = widths.reduce((s, v) => s + v, 0);
  let remainder = spaceForCharts - totalAssigned;
  if (remainder !== 0 && widths.length > 0) {
    if (remainder > 0) {
      widths[widths.length - 1] = widths[widths.length - 1] + remainder;
    } else {
      for (let i = widths.length - 1; i >= 0 && remainder < 0; i--) {
        const take = Math.max(0, Math.min(widths[i] - minWidths[i], -remainder));
        widths[i] -= take;
        remainder += take;
      }
    }
  }

  let currentX = leftPadding;
  return chartsInRow.map((chart, idx) => {
    const w = Math.max(minWidths[idx], Math.min(maxWidth, widths[idx]));
    const updated = {
      id: chart.id,
      position: { x: currentX, y: rowY },
      size: { width: w, height: chart.size.height }
    };
    currentX += w + CHART_GAP;
    return updated;
  });
};

/**
 * After container width changes (e.g. charts sidebar open/close), redistribute row widths
 * and snap every widget in a row to the same Y so layouts stay aligned.
 */
export const normalizeDashboardChartsLayout = (
  dashboardCharts: DashboardChart[],
  CONTAINER_WIDTH: number,
  ROW_HEIGHT: number,
  getMinWidthForChart: GetMinWidthForChart,
): DashboardChart[] => {
  if (!dashboardCharts.length) return dashboardCharts;

  const rowLayout = computeRowLayoutFromWidgetHeights(dashboardCharts, ROW_HEIGHT);
  const rows = new Set<number>();
  dashboardCharts.forEach((dc) => {
    rows.add(getRowForY(dc.position.y, rowLayout, ROW_HEIGHT));
  });

  let updated = [...dashboardCharts];
  rows.forEach((row) => {
    const redistributed = redistributeRowWidthsProportional(
      row,
      updated,
      CONTAINER_WIDTH,
      getMinWidthForChart,
      rowLayout,
      ROW_HEIGHT,
    );
    if (redistributed?.length) {
      const map = new Map(redistributed.map((r) => [r.id, r]));
      updated = updated.map((s) =>
        map.has(s.id)
          ? {
              ...s,
              position: map.get(s.id)!.position,
              size: { ...s.size, width: map.get(s.id)!.size.width },
            }
          : s,
      );
    }
  });

  const alignedLayout = computeRowLayoutFromWidgetHeights(updated, ROW_HEIGHT);
  return updated.map((dc) => {
    const row = getRowForY(dc.position.y, alignedLayout, ROW_HEIGHT);
    const rowY = getYForRow(row, alignedLayout, ROW_HEIGHT);
    return { ...dc, position: { ...dc.position, y: rowY } };
  });
};

// Helper function to snap Y position to row (horizontal grid only)
export const snapToGridPosition = (
  x: number,
  y: number,
  snapToGrid: boolean,
  rowLayout: Array<{ row: number; top: number; height: number }>,
  ROW_HEIGHT: number
): { x: number; y: number } => {
  if (!snapToGrid) return { x, y };
  // Snap Y to row
  const row = getRowForY(y, rowLayout, ROW_HEIGHT);
  const snappedY = getYForRow(row, rowLayout, ROW_HEIGHT);
  return { x, y: snappedY };
};

// Snap an X coordinate to the nearest grid column for a given row and widget width.
// Returns a snapped X or null if no non-overlapping column slot is available in the row.
export const snapXToGrid = (
  row: number,
  x: number,
  width: number,
  dashboardCharts: DashboardChart[],
  CONTAINER_WIDTH: number,
  rowLayout?: Array<{ row: number; top: number; height: number }>,
  ROW_HEIGHT?: number
): number | null => {
  const chartsInRow = getChartsInRow(row, dashboardCharts, undefined, rowLayout, ROW_HEIGHT);
  // If row is empty, allow x = 0 for first chart
  const isFirstChart = chartsInRow.length === 0;
  
  // Column step equals widget width + gap (simple fixed-column grid)
  const step = width + CHART_GAP;
  // Minimum start offset: 0 for first chart, CHART_GAP for subsequent charts
  const minX = isFirstChart ? 0 : CHART_GAP;
  // Maximum allowed start to keep widget inside container (respect right gap)
  const maxStart = Math.max(minX, CONTAINER_WIDTH - width - CHART_GAP);

  // Compute preferred column index based on x
  // For first chart, allow x = 0, so adjust calculation
  let col = isFirstChart && x < step ? 0 : Math.round((x - minX) / step);
  if (col < 0) col = 0;

  // Compute maximum columns that could fit
  const maxCols = Math.max(0, Math.floor((CONTAINER_WIDTH - minX - width - CHART_GAP) / step));

  // Try to find a non-overlapping column starting from preferred and moving right then left
  const tryColumn = (c: number) => {
    const candidate = Math.min(maxStart, minX + c * step);
    // Check overlap with existing charts (respect CHART_GAP spacing)
    const overlaps = chartsInRow.some(o => {
      const leftGap = o.position.x - CHART_GAP;
      const rightGap = o.position.x + o.size.width + CHART_GAP;
      return !(candidate + width <= leftGap || candidate >= rightGap);
    });
    return overlaps ? null : candidate;
  };

  // search rightwards
  for (let c = col; c <= maxCols; c++) {
    const res = tryColumn(c);
    if (res !== null) return res;
  }
  // then search leftwards
  for (let c = col - 1; c >= 0; c--) {
    const res = tryColumn(c);
    if (res !== null) return res;
  }

  return null;
};

// Helper function to find a non-overlapping position with gap
export const findNonOverlappingPosition = (
  newX: number,
  newY: number,
  width: number,
  height: number,
  excludeId: string,
  dashboardCharts: DashboardChart[],
  snapToGrid: boolean,
  rowLayout: Array<{ row: number; top: number; height: number }>,
  ROW_HEIGHT: number,
  CONTAINER_WIDTH: number
): { x: number; y: number } => {
  let finalX = newX;
  let finalY = newY;

  // Snap to grid if enabled
  if (snapToGrid) {
    const snapped = snapToGridPosition(finalX, finalY, snapToGrid, rowLayout, ROW_HEIGHT);
    finalX = snapped.x;
    finalY = snapped.y;
  }

  // Check against all other charts with gap
  for (const chart of dashboardCharts) {
    if (chart.id === excludeId) continue;

    // Expand bounding boxes by gap to ensure minimum spacing
    const chartLeft = chart.position.x - CHART_GAP;
    const chartTop = chart.position.y - CHART_GAP;
    const chartRight = chart.position.x + chart.size.width + CHART_GAP;
    const chartBottom = chart.position.y + chart.size.height + CHART_GAP;

    const newLeft = finalX - CHART_GAP;
    const newTop = finalY - CHART_GAP;
    const newRight = finalX + width + CHART_GAP;
    const newBottom = finalY + height + CHART_GAP;

    // Check if expanded boxes overlap (meaning charts are too close)
    if (checkOverlap(
      newLeft, newTop, width + (CHART_GAP * 2), height + (CHART_GAP * 2),
      chartLeft, chartTop, chart.size.width + (CHART_GAP * 2), chart.size.height + (CHART_GAP * 2)
    )) {
      // If too close, move to the right or below with gap
      if (finalX < chartRight) {
        finalX = chart.position.x + chart.size.width + CHART_GAP;
        // X position is free, no snapping needed
      }
      if (finalY < chartBottom && finalX < chartRight) {
        finalY = chart.position.y + chart.size.height + CHART_GAP;
        // Snap Y to row if enabled
        if (snapToGrid) {
          finalY = Math.round(finalY / ROW_HEIGHT) * ROW_HEIGHT + (CHART_GAP / 2);
        }
      }
    }
  }

  // Ensure position is not negative
  finalX = Math.max(0, finalX);
  finalY = Math.max(0, finalY);

  return { x: finalX, y: finalY };
};

/** Chart whose bounds contain the center of the dragged widget or overlap significantly (for swap-on-drop). */
export const findChartUnderCenter = (
  x: number,
  y: number,
  width: number,
  height: number,
  dashboardCharts: DashboardChart[],
  excludeId?: string,
): DashboardChart | null => {
  let bestTarget: DashboardChart | null = null;
  let maxOverlapRatio = 0;

  const rect1 = { x, y, w: width, h: height };
  const area1 = width * height;

  for (const c of dashboardCharts) {
    if (excludeId && c.id === excludeId) continue;

    const rect2 = { x: c.position.x, y: c.position.y, w: c.size.width, h: c.size.height };
    const area2 = c.size.width * c.size.height;

    // Calculate overlap bounding box
    const xOverlap = Math.max(0, Math.min(rect1.x + rect1.w, rect2.x + rect2.w) - Math.max(rect1.x, rect2.x));
    const yOverlap = Math.max(0, Math.min(rect1.y + rect1.h, rect2.y + rect2.h) - Math.max(rect1.y, rect2.y));
    const overlapArea = xOverlap * yOverlap;

    if (overlapArea > 0) {
      const minArea = Math.min(area1, area2);
      const ratio = overlapArea / minArea;

      // Swap triggers when there's at least 35% overlap with the smaller area
      if (ratio >= 0.35 && ratio > maxOverlapRatio) {
        maxOverlapRatio = ratio;
        bestTarget = c;
      }
    }
  }

  // Fallback to center-point check if no high overlap found
  if (!bestTarget) {
    const cx = x + width / 2;
    const cy = y + height / 2;
    for (const c of dashboardCharts) {
      if (excludeId && c.id === excludeId) continue;
      const inside =
        cx >= c.position.x &&
        cx <= c.position.x + c.size.width &&
        cy >= c.position.y &&
        cy <= c.position.y + c.size.height;
      if (inside) return c;
    }
  }

  return bestTarget;
};

/** Horizontal gap in a row that contains preferredX (or nearest gap). */
export const findHorizontalGapInRow = (
  row: number,
  preferredX: number,
  dashboardCharts: DashboardChart[],
  CONTAINER_WIDTH: number,
  excludeId?: string,
  rowLayout?: Array<{ row: number; top: number; height: number }>,
  ROW_HEIGHT?: number,
): { left: number; right: number; width: number } => {
  const chartsInRow = getChartsInRow(row, dashboardCharts, excludeId, rowLayout, ROW_HEIGHT).sort(
    (a, b) => a.position.x - b.position.x,
  );
  const anyFlushLeft = chartsInRow.some((c) => Math.round(c.position.x) === 0);
  const leftEdge = anyFlushLeft ? 0 : CHART_GAP;
  const rightEdge = CONTAINER_WIDTH - CHART_GAP;

  if (chartsInRow.length === 0) {
    return { left: leftEdge, right: rightEdge, width: rightEdge - leftEdge };
  }

  if (preferredX <= chartsInRow[0].position.x) {
    const right = chartsInRow[0].position.x - CHART_GAP;
    return { left: leftEdge, right, width: Math.max(0, right - leftEdge) };
  }

  for (let i = 0; i < chartsInRow.length - 1; i++) {
    const left = chartsInRow[i].position.x + chartsInRow[i].size.width + CHART_GAP;
    const right = chartsInRow[i + 1].position.x - CHART_GAP;
    if (preferredX >= left && preferredX <= right) {
      return { left, right, width: Math.max(0, right - left) };
    }
  }

  const last = chartsInRow[chartsInRow.length - 1];
  const left = last.position.x + last.size.width + CHART_GAP;
  return { left, right: rightEdge, width: Math.max(0, rightEdge - left) };
};

export type PlaceDashboardChartDropArgs = {
  chartId: string;
  preferredX: number;
  preferredY: number;
  dashboardCharts: DashboardChart[];
  CONTAINER_WIDTH: number;
  snapToGrid: boolean;
  rowLayout: Array<{ row: number; top: number; height: number }>;
  ROW_HEIGHT: number;
  getMinWidthForChart: GetMinWidthForChart;
  getMinHeightForChart: (chart?: Chart) => number;
  dropTargetRow?: number;
};

/** Fit chart into the horizontal gap and row band at the drop point (shrinks width & height). */
export const fitChartToAvailableSlot = (
  chart: DashboardChart,
  preferredX: number,
  preferredY: number,
  dashboardCharts: DashboardChart[],
  CONTAINER_WIDTH: number,
  rowLayout: Array<{ row: number; top: number; height: number }>,
  ROW_HEIGHT: number,
  getMinWidthForChart: GetMinWidthForChart,
  getMinHeightForChart: (chart?: Chart) => number,
  dropTargetRow?: number,
  snapToGrid = true,
): { x: number; y: number; width: number; height: number; targetRow: number } => {
  const minW = getMinWidthForChart(chart.chart);
  const minH = getMinHeightForChart(chart.chart);
  const targetRow =
    dropTargetRow !== undefined ? dropTargetRow : getRowForY(preferredY, rowLayout, ROW_HEIGHT);
  const rowY = getYForRow(targetRow, rowLayout, ROW_HEIGHT);
  const rowEntry = rowLayout.find((r) => r.row === targetRow);
  const rowBandHeight = Math.max(minH, (rowEntry?.height ?? ROW_HEIGHT) - CHART_GAP);

  const chartsInRow = getChartsInRow(targetRow, dashboardCharts, chart.id, rowLayout, ROW_HEIGHT);
  const gap = findHorizontalGapInRow(
    targetRow,
    preferredX,
    dashboardCharts,
    CONTAINER_WIDTH,
    chart.id,
    rowLayout,
    ROW_HEIGHT,
  );

  let availHeight: number;
  if (chartsInRow.length === 0) {
    availHeight = Math.max(minH, ROW_HEIGHT - CHART_GAP);
  } else {
    const neighborMaxH = Math.max(...chartsInRow.map((c) => c.size.height));
    availHeight = Math.max(minH, Math.min(rowBandHeight, neighborMaxH));
  }

  const availWidth = Math.max(0, gap.width);
  const width = availWidth >= minW ? availWidth : Math.max(minW, availWidth);
  const height = Math.max(minH, Math.min(chart.size.height, availHeight));

  let finalY = rowY;
  if (!snapToGrid) {
    const rowBottom = rowY + (rowEntry?.height ?? ROW_HEIGHT);
    if (preferredY >= rowY && preferredY <= rowBottom - minH) {
      finalY = Math.max(rowY, Math.min(preferredY, rowBottom - height));
    }
  }

  return {
    x: gap.left,
    y: finalY,
    width: Math.min(width, Math.max(minW, CONTAINER_WIDTH - gap.left - CHART_GAP)),
    height,
    targetRow,
  };
};

/**
 * Place a moved dashboard chart: swap if dropped on another chart, else fit into
 * available horizontal gap (row mode) or free position (snap off).
 */
export const placeDashboardChartOnDrop = ({
  chartId,
  preferredX,
  preferredY,
  dashboardCharts,
  CONTAINER_WIDTH,
  snapToGrid,
  rowLayout,
  ROW_HEIGHT,
  getMinWidthForChart,
  getMinHeightForChart,
  dropTargetRow,
}: PlaceDashboardChartDropArgs): DashboardChart[] => {
  const chart = dashboardCharts.find((c) => c.id === chartId);
  if (!chart) return dashboardCharts;

  const swapTarget = findChartUnderCenter(
    preferredX,
    preferredY,
    chart.size.width,
    chart.size.height,
    dashboardCharts,
    chartId,
  );

  if (swapTarget) {
    return dashboardCharts.map((dc) => {
      if (dc.id === chartId) {
        return {
          ...dc,
          position: { ...swapTarget.position },
          size: { width: swapTarget.size.width, height: swapTarget.size.height },
        };
      }
      if (dc.id === swapTarget.id) {
        return {
          ...dc,
          position: { ...chart.position },
          size: { width: chart.size.width, height: chart.size.height },
        };
      }
      return dc;
    });
  }

  const slot = fitChartToAvailableSlot(
    chart,
    preferredX,
    preferredY,
    dashboardCharts,
    CONTAINER_WIDTH,
    rowLayout,
    ROW_HEIGHT,
    getMinWidthForChart,
    getMinHeightForChart,
    dropTargetRow,
    snapToGrid,
  );

  const finalX = slot.x;
  const finalY = slot.y;
  const finalWidth = slot.width;
  const finalHeight = slot.height;

  const sourceRow = getRowForY(chart.position.y, rowLayout, ROW_HEIGHT);
  const targetRowFinal = slot.targetRow;

  let updated = dashboardCharts.map((dc) =>
    dc.id === chartId
      ? {
          ...dc,
          position: { x: finalX, y: finalY },
          size: { width: finalWidth, height: finalHeight },
        }
      : dc,
  );

  // Expand remaining charts in the row the widget left (row height shrinks via layout recompute)
  if (sourceRow !== targetRowFinal) {
    const redistributed = redistributeRowWidthsProportional(
      sourceRow,
      updated,
      CONTAINER_WIDTH,
      getMinWidthForChart,
      rowLayout,
      ROW_HEIGHT,
    );
    if (redistributed.length > 0) {
      const map = new Map(redistributed.map((r) => [r.id, r]));
      updated = updated.map((s) =>
        map.has(s.id)
          ? {
              ...s,
              position: map.get(s.id)!.position,
              size: { ...s.size, width: map.get(s.id)!.size.width },
            }
          : s,
      );
    }
  }

  return updated;
};

// Format relative time (e.g., "2 days ago")
export const getRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));

  if (diffInDays > 0) {
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  } else if (diffInHours > 0) {
    return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  } else if (diffInMinutes > 0) {
    return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
};

// Format visualization name for display
export const formatVisualizationName = (vizName: string): string => {
  if (!vizName) return 'Unknown';

  // Map common visualization names to display names
  const lower = vizName.toLowerCase();
  if (isRadiusPieChart(lower)) return 'Radius Pie Chart';

  const vizMap: Record<string, string> = {
    'table': 'Pivot Table',
    'pivot': 'Pivot Table',
    'bar': 'Bar Chart',
    'line': 'Line Chart',
    'pie': 'Pie Chart',
    'donut': 'Donut Chart',
    'area': 'Area Chart',
    'gauge': 'Gauge',
    'funnel': 'Funnel Chart',
    'sunburst': 'Sunburst',
    'big_number': 'Big Number',
    'radius_pie': 'Radius Pie Chart',
    'rad_pie': 'Radius Pie Chart',
  };

  return vizMap[lower] || vizName.split('_').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

// Return a sensible minimum height for a chart based on its visualization type.
// This keeps different visualizations usable when resizing (tables need more height).
export const getMinHeightForChart = (chart?: Chart): number => {
  try {
    if (!chart) return 300;
    const viz = (chart.visualization_name || chart.chart_type || '').toString().toLowerCase();

    // Allow user overrides via localStorage: per-visualization key `dashboard-minheight-<viz>`
    // or a default `dashboard-minheight-default` value.
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

    if (viz.includes('table') || viz.includes('pivot')) return DEFAULT_NEW_WIDGET_HEIGHT;
    if (viz.includes('big') && viz.includes('number')) return MIN_BIG_NUMBER_HEIGHT;
    if (viz === 'big_number' || viz === 'big-number') return MIN_BIG_NUMBER_HEIGHT;
    if (viz === 'divider') return GRID_CELL_HEIGHT;
    if (viz === 'text') return GRID_CELL_HEIGHT;
    if (viz === 'alert') return GRID_CELL_HEIGHT * 2;
    if (viz === 'image') return GRID_CELL_HEIGHT * 3;
    if (viz === 'panel') return GRID_CELL_HEIGHT * 3;
    if (isPieDonutOrRadiusPieChart(viz) || viz.includes('gauge') || viz.includes('funnel')) return GRID_CELL_HEIGHT;
    if (viz.includes('bar') || viz.includes('line') || viz.includes('area')) return GRID_CELL_HEIGHT;
    return 300;
  } catch (e) {
    return 300;
  }
};

// Return a sensible minimum width for a chart based on its visualization type.
// Users can override via localStorage `dashboard-minwidth-<viz>` or `dashboard-minwidth-default`.
export const getMinWidthForChart = (chart?: Chart): number => {
  try {
    if (!chart) return 300;
    const viz = (chart.visualization_name || chart.chart_type || '').toString().toLowerCase();
    try {
      const key = `dashboard-minwidth-${viz.replace(/[^a-z0-9_-]/g, '_')}`;
      const raw = localStorage.getItem(key) || localStorage.getItem('dashboard-minwidth-default');
      if (raw) {
        const parsed = parseInt(raw, 10);
        if (!isNaN(parsed) && parsed >= 0) return parsed;
      }
    } catch (e) {
      // ignore storage errors
    }

    // Default widths: allow tables to shrink to small sizes by default
    if (viz.includes('table') || viz.includes('pivot')) return DEFAULT_NEW_WIDGET_WIDTH;
    if (viz.includes('big') && viz.includes('number')) return MIN_BIG_NUMBER_WIDTH;
    if (viz === 'big_number' || viz === 'big-number') return MIN_BIG_NUMBER_WIDTH;
    if (viz === 'divider') return GRID_CELL_WIDTH * 2;
    if (viz === 'text') return GRID_CELL_WIDTH * 2;
    if (viz === 'alert') return GRID_CELL_WIDTH * 2;
    if (viz === 'image') return GRID_CELL_WIDTH * 3;
    if (viz === 'panel') return GRID_CELL_WIDTH * 3;
    if (isPieDonutOrRadiusPieChart(viz) || viz.includes('gauge') || viz.includes('funnel')) return GRID_CELL_HEIGHT;
    if (viz.includes('bar') || viz.includes('line') || viz.includes('area')) return GRID_CELL_HEIGHT;
    return 300;
  } catch (e) {
    return 300;
  }
};

// Transform chart data to format expected by AmChart
export const transformChartData = (data: any[]): any[] => {
  if (!Array.isArray(data)) return [];

  return data
    .map((item: any, index: number) => {
      const keys = Object.keys(item || {});

      // Numeric keys are considered metric columns (numbers or numeric strings)
      const numericKeys = keys.filter((k) => {
        const v = item[k];
        return typeof v === 'number' || (v !== null && v !== undefined && v !== '' && !isNaN(Number(v)));
      });

      // Dimension keys are non-numeric keys
      const dimensionKeys = keys.filter((k) => !numericKeys.includes(k));

      // Build category from dimension keys (join multiple dimensions)
      let category: string;
      if (dimensionKeys.length > 0) {
        category = dimensionKeys
          .map((key) => String(item[key] ?? '').trim())
          .filter((val) => val !== '')
          .join(', ');
      } else if (numericKeys.length > 0) {
        const baseName = numericKeys[0].replace(/\(.*\)/, '').trim();
        category = baseName || `Value ${index + 1}`;
      } else {
        category = `Item ${index + 1}`;
      }

      // If there are no numeric columns, skip this row
      if (numericKeys.length === 0) return null;

      // Build output object: preserve all numeric columns as separate series keys
      const out: any = { category, originalData: item };

      // For single-metric responses keep `value` for backward compatibility
      if (numericKeys.length === 1) {
        const k = numericKeys[0];
        const num = Number(item[k]) || 0;
        out.value = num;
        out[k] = num;
      } else {
        numericKeys.forEach((k) => {
          out[k] = Number(item[k]) || 0;
        });
      }

      return out;
    })
    .filter((item: any) => item !== null);
};

/** Transform API rows for dashboard/analytics — expands multi-metric big number rows. */
export const transformDashboardChartRows = (
  rows: any[],
  vizName: string,
  options?: {
    columns?: string[];
    metrics?: BigNumberMetricConfig[];
    x_axis?: string | null;
  },
): any[] => {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  if (isBigNumberVisualization(vizName)) {
    const expanded = coerceBigNumberChartItems(rows, {
      columns: options?.columns,
      x_axis: options?.x_axis ?? null,
      metrics: options?.metrics,
    });
    if (expanded.length > 0) return expanded;
  }

  if (isPieDonutOrRadiusPieChart(vizName)) {
    return normalizePieLikeChartRows(rows, options?.columns);
  }

  if ((vizName || '').toLowerCase() === 'sunburst') {
    return rows;
  }

  return transformChartData(rows);
};

/** Enrich createChart API response for dashboard widgets (dimensions, metrics, raw rows). */
export function buildDashboardChartRawResponse(
  resp: any,
  chartParams: Record<string, unknown> | null | undefined,
  rawRows: any[],
  chartMetrics?: unknown,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    ...resp,
    data: rawRows.length > 0 ? rawRows : resp?.data,
    columns: resp?.columns,
  };

  if (resp?.x_axis) out.x_axis = resp.x_axis;

  if (resp?.dimensions) {
    out.dimensions = resp.dimensions;
  } else if (chartParams) {
    const paramsDims = chartParams.dimensions;
    if (Array.isArray(paramsDims) && paramsDims.length > 0) {
      out.dimensions = paramsDims.map((d: any) => (typeof d === 'string' ? d : d.columns || d));
    } else if (Array.isArray(chartParams.hierarchy) && chartParams.hierarchy.length > 0) {
      out.dimensions = chartParams.hierarchy.map((d: any) =>
        typeof d === 'string' ? d : d.columns || d,
      );
    }
  }

  if (resp?.hierarchy) out.hierarchy = resp.hierarchy;

  if (Array.isArray(chartMetrics) && chartMetrics.length > 0) {
    out.metrics = chartMetrics;
  } else if (resp?.metrics) {
    out.metrics = resp.metrics;
  }

  return out;
}

