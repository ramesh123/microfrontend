import type { GaugeCustomizationOptions } from '../customize/gaugeCustomizeTypes';
import { defaultOptions as gaugeDefaultOptions } from '../customize/gaugeCustomizeTypes';
import {
  buildIntervalBoundsFromBands,
  type ValueRangeBand,
} from '../../shared/ValueRangeBandsPanel';
import { DEFAULT_VALUE_RANGE_COLORS } from '../../shared/bigNumberValueRangeColors';

export type ChartCustomizationsDict = Record<string, unknown>;

/** Every customization key persisted for gauge charts. */
export const GAUGE_CUSTOMIZATION_KEYS = [
  'min',
  'max',
  'intervalBounds',
  'colorScheme',
  'arcWidth',
  'fontSize',
  'numberFormat',
  'currencyFormat',
  'currencySymbol',
  'valueFormat',
  'showPointer',
  'animation',
  'showAxisTicks',
  'showSplitLines',
  'splitNumber',
  'showProgress',
  'overlap',
  'roundCap',
  'showLabels',
  'showTotal',
  'forceShowAllTicks',
  'refreshIntervalSeconds',
  'customBands',
  'valueRangeColorLow',
  'valueRangeColorMid',
  'valueRangeColorHigh',
  'valueRangeLowMin',
  'valueRangeLowMax',
  'valueRangeMidMin',
  'valueRangeMidMax',
  'valueRangeHighMin',
  'valueRangeHighMax',
  'valueRangeBoundsMode',
] as const satisfies readonly (keyof GaugeCustomizationOptions)[];

function parseBandBound(value: unknown): number | undefined {
  if (value === '' || value === null || value === undefined) return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function normalizeCustomBands(raw: unknown): ValueRangeBand[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return raw.map((band) => {
    const b = (band && typeof band === 'object' ? band : {}) as Record<string, unknown>;
    const min = parseBandBound(b.minValue);
    const max = parseBandBound(b.maxValue);
    return {
      color: typeof b.color === 'string' && b.color.trim() ? b.color : '#3182bd',
      minValue: min ?? '',
      maxValue: max ?? '',
    };
  });
}

/** Keep legacy low/mid/high keys in sync with the first three custom bands. */
function syncLegacyValueRangeFromBands(
  out: ChartCustomizationsDict,
  bands: ValueRangeBand[],
): void {
  const [low, mid, high] = bands;
  if (low) {
    out.valueRangeColorLow = low.color || DEFAULT_VALUE_RANGE_COLORS.low;
    const min = parseBandBound(low.minValue);
    const max = parseBandBound(low.maxValue);
    if (min !== undefined) out.valueRangeLowMin = min;
    else delete out.valueRangeLowMin;
    if (max !== undefined) out.valueRangeLowMax = max;
    else delete out.valueRangeLowMax;
  }
  if (mid) {
    out.valueRangeColorMid = mid.color || DEFAULT_VALUE_RANGE_COLORS.mid;
    const min = parseBandBound(mid.minValue);
    const max = parseBandBound(mid.maxValue);
    if (min !== undefined) out.valueRangeMidMin = min;
    else delete out.valueRangeMidMin;
    if (max !== undefined) out.valueRangeMidMax = max;
    else delete out.valueRangeMidMax;
  }
  if (high) {
    out.valueRangeColorHigh = high.color || DEFAULT_VALUE_RANGE_COLORS.high;
    const min = parseBandBound(high.minValue);
    const max = parseBandBound(high.maxValue);
    if (min !== undefined) out.valueRangeHighMin = min;
    else delete out.valueRangeHighMin;
    if (max !== undefined) out.valueRangeHighMax = max;
    else delete out.valueRangeHighMax;
  }
}

/**
 * Merge sources with gauge defaults and emit a full customization object for API payloads.
 * Ensures customBands + derived intervalBounds are always included when bands are configured.
 */
export function buildGaugeCustomizationPayload(
  ...sources: Array<ChartCustomizationsDict | null | undefined>
): ChartCustomizationsDict {
  const merged: ChartCustomizationsDict = {
    ...gaugeDefaultOptions,
    ...sources.filter(Boolean).reduce((acc, s) => ({ ...acc, ...s }), {}),
  };

  const out: ChartCustomizationsDict = {};

  for (const key of GAUGE_CUSTOMIZATION_KEYS) {
    const value = merged[key];
    if (value !== undefined) {
      out[key] = value;
      continue;
    }
    const fallback = (gaugeDefaultOptions as unknown as Record<string, unknown>)[key];
    if (fallback !== undefined) {
      out[key] = fallback;
    }
  }

  const bands = normalizeCustomBands(out.customBands ?? merged.customBands);
  if (bands) {
    out.customBands = bands;
    const derivedBounds = buildIntervalBoundsFromBands(bands);
    // Prefer derived bounds from bands; keep an explicit non-empty intervalBounds only if bands have none.
    if (derivedBounds) {
      out.intervalBounds = derivedBounds;
    } else if (typeof out.intervalBounds !== 'string') {
      out.intervalBounds = '';
    }
    syncLegacyValueRangeFromBands(out, bands);
  } else if (typeof out.intervalBounds !== 'string') {
    out.intervalBounds = '';
  }

  return out;
}

export { buildIntervalBoundsFromBands };
