import type { LegacyReactGridLayoutProps } from 'react-grid-layout/legacy';
import { GRID_COLS, GRID_CELL_HEIGHT } from '../layoutConstants';
import { CHART_GAP } from '../dashboardConstants';

/** Primary breakpoint used for the dashboard editor canvas. */
export const GRID_BREAKPOINT = 'lg' as const;

export const GRID_BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };

export const GRID_COLUMNS = {
  lg: GRID_COLS,
  md: GRID_COLS,
  sm: 8,
  xs: 4,
  xxs: 2,
} as const;

export const GRID_ROW_HEIGHT = GRID_CELL_HEIGHT;

export const GRID_MARGIN: [number, number] = [CHART_GAP, CHART_GAP];

export const GRID_CONTAINER_PADDING: [number, number] = [0, 0];

/** Default grid footprint for newly dropped widgets (w × h in grid units). */
export const DEFAULT_GRID_WIDGET_SIZE = { w: 6, h: 6 };

type DashboardGridLayoutProps = Pick<
  LegacyReactGridLayoutProps,
  | 'rowHeight'
  | 'margin'
  | 'containerPadding'
  | 'compactType'
  | 'preventCollision'
  | 'allowOverlap'
  | 'useCSSTransforms'
  | 'draggableCancel'
  | 'draggableHandle'
  | 'resizeHandles'
>;

/** Elements that must not start a grid drag (buttons, resize handles, etc.). */
export const GRID_DRAG_CANCEL_SELECTOR =
  '.dashboard-chart-no-drag, [data-dashboard-chart-action], button, a, input, textarea, select, [role="button"], .react-resizable-handle';

/** Drag only from the chart title bar — keeps edit/delete clicks reliable. */
export const GRID_DRAG_HANDLE_SELECTOR = '.dashboard-chart-drag-handle';

export const GRID_LAYOUT_PROPS: DashboardGridLayoutProps = {
  rowHeight: GRID_ROW_HEIGHT,
  margin: GRID_MARGIN,
  containerPadding: GRID_CONTAINER_PADDING,
  // Fixed compaction — do not toggle compactType on each drag (avoids inconsistent reflow).
  compactType: null,
  // Siblings stay fixed via controlled drag layout in DashboardGridCanvas.
  preventCollision: false,
  allowOverlap: false,
  useCSSTransforms: true,
  draggableCancel: GRID_DRAG_CANCEL_SELECTOR,
  draggableHandle: GRID_DRAG_HANDLE_SELECTOR,
  resizeHandles: ['s', 'w', 'e', 'n', 'sw', 'nw', 'se', 'ne'],
};
