import type { SunburstCustomizationOptions } from '../customize/sunburstCustomizeTypes';
import { defaultOptions as sunburstDefaultOptions } from '../customize/sunburstCustomizeTypes';

export type ChartCustomizationsDict = Record<string, unknown>;

/** Every customization key persisted for sunburst charts. */
export const SUNBURST_CUSTOMIZATION_KEYS = [
  'colorScheme',
  'fontSize',
  'numberFormat',
  'currencyFormat',
  'currencySymbol',
  'showLabels',
  'showLegend',
  'showTotal',
  'animation',
  'refreshIntervalSeconds',
] as const satisfies readonly (keyof SunburstCustomizationOptions)[];

export function buildSunburstCustomizationPayload(
  ...sources: Array<ChartCustomizationsDict | null | undefined>
): ChartCustomizationsDict {
  const merged: ChartCustomizationsDict = {
    ...sunburstDefaultOptions,
    ...sources.filter(Boolean).reduce((acc, s) => ({ ...acc, ...s }), {}),
  };

  const out: ChartCustomizationsDict = {};

  for (const key of SUNBURST_CUSTOMIZATION_KEYS) {
    const value = merged[key];
    if (value !== undefined) {
      out[key] = value;
      continue;
    }
    const fallback = (sunburstDefaultOptions as unknown as Record<string, unknown>)[key];
    if (fallback !== undefined) {
      out[key] = fallback;
    }
  }

  return out;
}
