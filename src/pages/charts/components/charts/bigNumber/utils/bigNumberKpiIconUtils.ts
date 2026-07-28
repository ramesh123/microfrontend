import { isSvgSource } from './svgIconColorUtils';

const RASTER_IMAGE_PREFIXES = [
  'data:image/png',
  'data:image/jpeg',
  'data:image/jpg',
  'data:image/webp',
  'data:image/gif',
] as const;

export const DEFAULT_KPI_ICON_SIZE_PX = 16;
export const MIN_KPI_ICON_SIZE_PX = 12;
export const MAX_KPI_ICON_SIZE_PX = 72;

export function isRasterImageSource(value?: string): boolean {
  if (!value?.trim()) return false;
  const normalized = value.trim().toLowerCase();
  return RASTER_IMAGE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function hasKpiIconSource(value?: string): boolean {
  return isSvgSource(value) || isRasterImageSource(value);
}

export function resolveKpiIconSizePx(iconSizePx?: number | string | null): number {
  const parsed = Number(iconSizePx);
  if (!Number.isFinite(parsed)) return DEFAULT_KPI_ICON_SIZE_PX;
  return Math.max(MIN_KPI_ICON_SIZE_PX, Math.min(MAX_KPI_ICON_SIZE_PX, Math.round(parsed)));
}

export function kpiIconSizeStyle(sizePx: number): {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
} {
  return {
    width: sizePx,
    height: sizePx,
    minWidth: sizePx,
    minHeight: sizePx,
  };
}
