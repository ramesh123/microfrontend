export type ValueRangeColorStops = {
  low: string;
  mid: string;
  high: string;
};

export type ValueRangeBoundsMode = 'count' | 'percent';

export type ValueRangeBoundsOptions = {
  valueRangeColorLow?: string;
  valueRangeColorMid?: string;
  valueRangeColorHigh?: string;
  valueRangeBoundsMode?: ValueRangeBoundsMode;
  valueRangeLowMin?: number;
  valueRangeLowMax?: number;
  valueRangeMidMin?: number;
  valueRangeMidMax?: number;
  valueRangeHighMin?: number;
  valueRangeHighMax?: number;
};

function resolveEffectiveBandBound(
  stored: number | undefined,
  mode: ValueRangeBoundsMode,
  autoMin: number,
  autoMax: number,
): number | undefined {
  if (stored === undefined) return undefined;
  if (mode !== 'percent') return stored;
  const span = autoMax - autoMin;
  if (!Number.isFinite(span) || span <= 0) return stored;
  return autoMin + (stored / 100) * span;
}

export const DEFAULT_VALUE_RANGE_COLORS: ValueRangeColorStops = {
  low: '#ef4444',
  mid: '#f59e0b',
  high: '#22c55e',
};

function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.replace('#', '');
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((c) => Number.isNaN(c))) return null;
  return [r, g, b];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function lerpColor(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  if (!ca || !cb) return a;
  const u = Math.max(0, Math.min(1, t));
  return rgbToHex(
    ca[0] + (cb[0] - ca[0]) * u,
    ca[1] + (cb[1] - ca[1]) * u,
    ca[2] + (cb[2] - ca[2]) * u,
  );
}

export function parseValueRangeBound(value: unknown): number | undefined {
  if (value === '' || value === null || value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function hasCustomValueRangeBounds(opts?: ValueRangeBoundsOptions | null): boolean {
  if (!opts) return false;
  return (
    parseValueRangeBound(opts.valueRangeLowMin) !== undefined ||
    parseValueRangeBound(opts.valueRangeLowMax) !== undefined ||
    parseValueRangeBound(opts.valueRangeMidMin) !== undefined ||
    parseValueRangeBound(opts.valueRangeMidMax) !== undefined ||
    parseValueRangeBound(opts.valueRangeHighMin) !== undefined ||
    parseValueRangeBound(opts.valueRangeHighMax) !== undefined
  );
}

function valueInInclusiveBand(value: number, min?: number, max?: number): boolean {
  const hasMin = min !== undefined;
  const hasMax = max !== undefined;
  if (!hasMin && !hasMax) return false;
  if (hasMin && value < min!) return false;
  if (hasMax && value > max!) return false;
  return true;
}

export function resolveValueRangeColors(opts?: ValueRangeBoundsOptions | null): ValueRangeColorStops {
  const low = opts?.valueRangeColorLow?.trim();
  const mid = opts?.valueRangeColorMid?.trim();
  const high = opts?.valueRangeColorHigh?.trim();
  return {
    low: low && /^#[0-9a-fA-F]{6}$/i.test(low) ? low : DEFAULT_VALUE_RANGE_COLORS.low,
    mid: mid && /^#[0-9a-fA-F]{6}$/i.test(mid) ? mid : DEFAULT_VALUE_RANGE_COLORS.mid,
    high: high && /^#[0-9a-fA-F]{6}$/i.test(high) ? high : DEFAULT_VALUE_RANGE_COLORS.high,
  };
}

/** KPI colour from value position in data-derived min–max range (gradient). */
export function resolveRangeValueColor(
  value: number,
  min: number,
  max: number,
  stops: ValueRangeColorStops = DEFAULT_VALUE_RANGE_COLORS,
): string | null {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return null;
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  if (t <= 0.5) return lerpColor(stops.low, stops.mid, t * 2);
  return lerpColor(stops.mid, stops.high, (t - 0.5) * 2);
}

/** Solid colour when value falls in a user-defined band; otherwise data min–max gradient. */
export function resolveValueRangeColorForValue(
  value: number,
  opts: ValueRangeBoundsOptions | null | undefined,
  autoMin: number,
  autoMax: number,
): string | null {
  const stops = resolveValueRangeColors(opts);

  if (!hasCustomValueRangeBounds(opts)) {
    return resolveRangeValueColor(value, autoMin, autoMax, stops);
  }

  const mode: ValueRangeBoundsMode = opts?.valueRangeBoundsMode === 'percent' ? 'percent' : 'count';

  const highMin = resolveEffectiveBandBound(
    parseValueRangeBound(opts?.valueRangeHighMin),
    mode,
    autoMin,
    autoMax,
  );
  const highMax = resolveEffectiveBandBound(
    parseValueRangeBound(opts?.valueRangeHighMax),
    mode,
    autoMin,
    autoMax,
  );
  const midMin = resolveEffectiveBandBound(
    parseValueRangeBound(opts?.valueRangeMidMin),
    mode,
    autoMin,
    autoMax,
  );
  const midMax = resolveEffectiveBandBound(
    parseValueRangeBound(opts?.valueRangeMidMax),
    mode,
    autoMin,
    autoMax,
  );
  const lowMin = resolveEffectiveBandBound(
    parseValueRangeBound(opts?.valueRangeLowMin),
    mode,
    autoMin,
    autoMax,
  );
  const lowMax = resolveEffectiveBandBound(
    parseValueRangeBound(opts?.valueRangeLowMax),
    mode,
    autoMin,
    autoMax,
  );

  if (valueInInclusiveBand(value, highMin, highMax)) return stops.high;
  if (valueInInclusiveBand(value, midMin, midMax)) return stops.mid;
  if (valueInInclusiveBand(value, lowMin, lowMax)) return stops.low;

  return resolveRangeValueColor(value, autoMin, autoMax, stops);
}

export type GaugeArcBand = {
  key: 'low' | 'mid' | 'high';
  label: string;
  start: number;
  end: number;
  color: string;
};

function clampBandValue(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Three contiguous semicircle bands for gauge (Low / Mid / High). */
export function resolveGaugeArcBands(
  min: number,
  max: number,
  opts?: ValueRangeBoundsOptions | null,
): GaugeArcBand[] {
  const colors = resolveValueRangeColors(opts);
  const range = max - min;
  if (!Number.isFinite(min) || !Number.isFinite(max) || range <= 0) return [];

  const mode: ValueRangeBoundsMode = opts?.valueRangeBoundsMode === 'percent' ? 'percent' : 'count';
  const resolve = (stored: number | undefined, fallback: number) => {
    const parsed = parseValueRangeBound(stored);
    if (parsed === undefined) return fallback;
    return clampBandValue(
      resolveEffectiveBandBound(parsed, mode, min, max) ?? fallback,
      min,
      max,
    );
  };

  const third = range / 3;
  const defaultLowEnd = min + third;
  const defaultMidEnd = min + 2 * third;

  const lowStart = resolve(parseValueRangeBound(opts?.valueRangeLowMin), min);
  const lowEnd = resolve(parseValueRangeBound(opts?.valueRangeLowMax), defaultLowEnd);
  const midStart = resolve(parseValueRangeBound(opts?.valueRangeMidMin), lowEnd);
  const midEnd = resolve(parseValueRangeBound(opts?.valueRangeMidMax), defaultMidEnd);
  const highStart = resolve(parseValueRangeBound(opts?.valueRangeHighMin), midEnd);
  const highEnd = resolve(parseValueRangeBound(opts?.valueRangeHighMax), max);

  const segments: Array<{ key: 'low' | 'mid' | 'high'; label: string; start: number; end: number; color: string }> = [
    { key: 'low', label: 'LOW', start: lowStart, end: Math.max(lowStart, lowEnd), color: colors.low },
    { key: 'mid', label: 'MID', start: midStart, end: Math.max(midStart, midEnd), color: colors.mid },
    { key: 'high', label: 'HIGH', start: highStart, end: Math.max(highStart, highEnd), color: colors.high },
  ];

  // Ensure contiguous coverage from min to max without gaps
  segments[0].start = min;
  segments[2].end = max;
  segments[0].end = Math.max(segments[0].start, Math.min(segments[0].end, segments[1].start));
  segments[1].start = segments[0].end;
  segments[1].end = Math.max(segments[1].start, Math.min(segments[1].end, segments[2].start));
  segments[2].start = segments[1].end;

  return segments.filter((s) => s.end > s.start);
}
