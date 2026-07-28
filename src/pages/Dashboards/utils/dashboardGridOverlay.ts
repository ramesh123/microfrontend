import type { CSSProperties } from 'react';
import { CHART_GAP } from '../dashboardConstants';
import { GRID_COLS } from '../layoutConstants';
import { GRID_ROW_HEIGHT } from './gridLayoutConfig';
import { getColWidth } from './gridLayoutUtils';

export function getDashboardGridOverlayStyle(
  containerWidth: number,
  options?: {
    cols?: number;
    highlighted?: boolean;
    minHeight?: number | string;
  },
): CSSProperties {
  const cols = options?.cols ?? GRID_COLS;
  const highlighted = options?.highlighted ?? false;
  const colWidth = getColWidth(containerWidth, cols);
  const stepX = colWidth + CHART_GAP;
  const stepY = GRID_ROW_HEIGHT + CHART_GAP;

  const columnLine = highlighted ? 'hsla(var(--primary) / 0.45)' : 'hsla(var(--border) / 0.5)';
  const rowLine = highlighted ? 'hsla(var(--primary) / 0.3)' : 'hsla(var(--border) / 0.32)';

  const layers = [
    `repeating-linear-gradient(to right, ${columnLine} 0, ${columnLine} 1px, transparent 1px, transparent ${stepX}px)`,
    `repeating-linear-gradient(to bottom, ${rowLine} 0, ${rowLine} 1px, transparent 1px, transparent ${stepY}px)`,
  ];

  if (highlighted) {
    layers.unshift('linear-gradient(hsla(var(--primary) / 0.07), hsla(var(--primary) / 0.07))');
  }

  return {
    width: containerWidth,
    minHeight: options?.minHeight ?? '100%',
    backgroundImage: layers.join(', '),
    backgroundSize:
      highlighted
        ? `100% 100%, ${stepX}px 100%, 100% ${stepY}px`
        : `${stepX}px 100%, 100% ${stepY}px`,
    backgroundRepeat: highlighted ? 'no-repeat, repeat, repeat' : 'repeat, repeat',
  };
}
