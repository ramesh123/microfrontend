export type BigNumberResponsiveLayoutMode = 'kpi' | 'single' | 'multi' | 'stream';

const REFERENCE_SIZE: Record<BigNumberResponsiveLayoutMode, { width: number; height: number }> = {
  kpi: { width: 300, height: 200 },
  single: { width: 260, height: 130 },
  multi: { width: 420, height: 100 },
  stream: { width: 320, height: 200 },
};

/** Fixed card size for Big Number preview while authoring in ChartFormulator. */
export function getBigNumberFormulatorPreviewSize(
  mode: BigNumberResponsiveLayoutMode,
): { width: number; height: number } {
  return REFERENCE_SIZE[mode];
}

const MIN_SCALE = 0.45;
const MAX_SCALE = 1;

/** Scale factor for fitting KPI content when the dashboard widget is resized. */
export function computeBigNumberResponsiveScale(
  width: number,
  height: number,
  mode: BigNumberResponsiveLayoutMode,
): number {
  if (width <= 0 || height <= 0) return 1;
  const ref = REFERENCE_SIZE[mode];
  const fit = Math.min(width / ref.width, height / ref.height);
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, fit));
}

export function scalePxValue(px: string | number | undefined, scale: number): string {
  if (px == null) return '';
  const base = typeof px === 'number' ? px : Number.parseFloat(px);
  if (!Number.isFinite(base)) return typeof px === 'string' ? px : `${px}px`;
  return `${Math.max(8, Math.round(base * scale))}px`;
}

export function scalePxNumber(px: string | number | undefined, scale: number): number {
  const parsed = typeof px === 'number' ? px : Number.parseFloat(String(px ?? ''));
  if (!Number.isFinite(parsed)) return 16;
  return Math.max(8, Math.round(parsed * scale));
}

/** Scale CSS padding shorthand (e.g. "16px 18px 14px"). */
export function scalePaddingValue(padding: string, scale: number): string {
  return padding
    .split(/\s+/)
    .map((token) => {
      const match = token.match(/^([\d.]+)(px|rem|em)?$/);
      if (!match) return token;
      const value = Number.parseFloat(match[1]);
      const unit = match[2] ?? 'px';
      if (!Number.isFinite(value)) return token;
      return `${Math.max(4, Math.round(value * scale))}${unit}`;
    })
    .join(' ');
}
