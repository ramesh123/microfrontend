import type { ChartCustomizationOptions } from '../customize/pieCustomizeTypes';
import { defaultOptions as pieDefaultOptions } from '../customize/pieCustomizeTypes';

export type ChartCustomizationsDict = Record<string, unknown>;

/** Every customization key persisted for pie, donut, and radius pie charts. */
export const PIE_CUSTOMIZATION_KEYS = [
  'colorScheme',
  'percentageThreshold',
  'showLegend',
  'legendType',
  'legendOrientation',
  'legendMargin',
  'labelType',
  'numberFormat',
  'currencyFormat',
  'currencySymbol',
  'dateFormat',
  'showLabels',
  'labelLine',
  'showTotal',
  'outerRadius',
  'innerRadius',
  'sortSliceBy',
  'refreshIntervalSeconds',
  'showSideLegend',
  'sideLegendOrientation',
] as const satisfies readonly (keyof ChartCustomizationOptions)[];

/**
 * Merge sources with pie defaults and emit a full customization object for API payloads.
 * Ensures side-legend and inner-radius options persist in create/update, dashboard, and analytics.
 */
export function buildPieCustomizationPayload(
  ...sources: Array<ChartCustomizationsDict | null | undefined>
): ChartCustomizationsDict {
  const merged: ChartCustomizationsDict = {
    ...pieDefaultOptions,
    ...sources.filter(Boolean).reduce((acc, s) => ({ ...acc, ...s }), {}),
  };

  const out: ChartCustomizationsDict = {};

  for (const key of PIE_CUSTOMIZATION_KEYS) {
    const value = merged[key];
    if (value !== undefined) {
      out[key] = value;
      continue;
    }
    const fallback = (pieDefaultOptions as unknown as Record<string, unknown>)[key];
    if (fallback !== undefined) {
      out[key] = fallback;
    }
  }

  if (out.showSideLegend !== true) {
    out.showSideLegend = false;
  }
  out.sideLegendOrientation = out.sideLegendOrientation === 'left' ? 'left' : 'right';

  return out;
}
