import {
  DEFAULT_ICON_POSITION,
  normalizeElementPosition,
  type BigNumberElementPosition,
} from './bigNumberStreamLayout';

export const DEFAULT_FREE_ICON_X = 8;
export const DEFAULT_FREE_ICON_Y = 10;

export const BIG_NUMBER_ICON_POSITION_KEYS = ['iconPositionX', 'iconPositionY', 'iconPosition'] as const;

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/** Coerce API / form values (number, numeric string) into a 0–100 coordinate. */
export function parsePercentCoord(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return undefined;
  return clampPercent(n);
}

const GRID_POSITION_TO_FREE: Record<BigNumberElementPosition, { x: number; y: number }> = {
  'top-left': { x: 8, y: 10 },
  'top-center': { x: 50, y: 10 },
  'top-right': { x: 92, y: 10 },
  'center-left': { x: 8, y: 50 },
  center: { x: 50, y: 50 },
  'center-right': { x: 92, y: 50 },
  'bottom-left': { x: 8, y: 90 },
  'bottom-center': { x: 50, y: 90 },
  'bottom-right': { x: 92, y: 90 },
};

export function gridPositionToFreePercent(position: BigNumberElementPosition): { x: number; y: number } {
  return GRID_POSITION_TO_FREE[position];
}

export function resolveFreeIconPosition(options: {
  iconPosition?: BigNumberElementPosition | string;
  iconPositionX?: unknown;
  iconPositionY?: unknown;
}): { x: number; y: number } {
  const x = parsePercentCoord(options.iconPositionX);
  const y = parsePercentCoord(options.iconPositionY);
  if (x !== undefined && y !== undefined) {
    return { x, y };
  }

  const grid = normalizeElementPosition(options.iconPosition, DEFAULT_ICON_POSITION);
  return gridPositionToFreePercent(grid);
}

const FREE_ICON_LEFT_X_MAX = 35;
const FREE_ICON_HEADER_ROW_Y_MAX = 42;
const FREE_ICON_HEADER_GAP_PX = 10;

/** True when a free-drag icon sits on the left near the header row. */
export function shouldPlaceHeaderBesideFreeIcon(options: {
  iconSvg?: string;
  iconPosition?: BigNumberElementPosition | string;
  iconPositionX?: unknown;
  iconPositionY?: unknown;
}): boolean {
  if (typeof options.iconSvg !== 'string' || !options.iconSvg.trim()) return false;
  const { x, y } = resolveFreeIconPosition(options);
  return x <= FREE_ICON_LEFT_X_MAX && y <= FREE_ICON_HEADER_ROW_Y_MAX;
}

/** Horizontal inset so header text starts to the right of a left-aligned free icon. */
export function resolveFreeIconHeaderInsetPx(
  options: {
    iconSvg?: string;
    iconPosition?: BigNumberElementPosition | string;
    iconPositionX?: unknown;
    iconPositionY?: unknown;
  },
  containerWidth: number,
  iconSizePx: number,
  contentPaddingLeftPx = 0,
): number {
  if (!shouldPlaceHeaderBesideFreeIcon(options)) return 0;
  if (containerWidth <= 0) return iconSizePx + FREE_ICON_HEADER_GAP_PX;

  const { x } = resolveFreeIconPosition(options);
  const iconCenterPx = (x / 100) * containerWidth;
  const iconRightPx = iconCenterPx + iconSizePx / 2;
  const inset = iconRightPx - contentPaddingLeftPx + FREE_ICON_HEADER_GAP_PX;
  const minInset = iconSizePx + FREE_ICON_HEADER_GAP_PX;
  const maxInset = Math.max(0, containerWidth - contentPaddingLeftPx) * 0.78;

  return Math.min(maxInset, Math.max(minInset, inset));
}

export function hasExplicitFreeIconPosition(options: {
  iconPositionX?: unknown;
  iconPositionY?: unknown;
}): boolean {
  return parsePercentCoord(options.iconPositionX) !== undefined &&
    parsePercentCoord(options.iconPositionY) !== undefined;
}

/** Normalize icon X/Y to numbers so they persist and render consistently after API round-trip. */
export function normalizeBigNumberIconPositionCustomizations<T extends Record<string, unknown>>(
  merged: T,
): T {
  const x = parsePercentCoord(merged.iconPositionX);
  const y = parsePercentCoord(merged.iconPositionY);
  const next = { ...merged } as T & { iconPositionX?: number; iconPositionY?: number };

  if (x !== undefined && y !== undefined) {
    next.iconPositionX = x;
    next.iconPositionY = y;
    return next;
  }

  if (typeof merged.iconSvg === 'string' && merged.iconSvg.trim()) {
    const grid = gridPositionToFreePercent(
      normalizeElementPosition(String(merged.iconPosition || ''), DEFAULT_ICON_POSITION),
    );
    next.iconPositionX = x ?? grid.x;
    next.iconPositionY = y ?? grid.y;
  }

  return next;
}
