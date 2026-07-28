import type { BarCustomizationOptions } from '../customize/barCustomizeTypes';
import { defaultOptions as barDefaultOptions } from '../customize/barCustomizeTypes';

export type ChartCustomizationsDict = Record<string, unknown>;

export const BAR_CUSTOMIZATION_KEYS = [
  'colorScheme',
  'fontSize',
  'numberFormat',
  'currencyFormat',
  'currencySymbol',
  'currencyCode',
  'showLabels',
  'showLegend',
  'showValue',
  'animation',
  'logarithmicAxis',
  'truncateXAxis',
  'xAxisMin',
  'xAxisMax',
  'truncateAxis',
  'axisMin',
  'axisMax',
  'sortSeriesBy',
  'sortSeriesAscending',
  'stackedStyle',
  'legendType',
  'legendOrientation',
  'margin',
  'minorTicks',
  'dataZoom',
  'dataZoomMin',
  'xAxisTitle',
  'xAxisTitleMargin',
  'yAxisTitle',
  'yAxisTitleMargin',
  'yAxisTitlePosition',
  'xAxisLabelRotation',
  'yAxisLabelRotation',
  'valueDecimalPlaces',
  'refreshIntervalSeconds',
  'horizontal',
] as const satisfies readonly (keyof BarCustomizationOptions)[];

export function buildBarCustomizationPayload(
  ...sources: Array<ChartCustomizationsDict | null | undefined>
): ChartCustomizationsDict {
  const merged: ChartCustomizationsDict = {
    ...barDefaultOptions,
    ...sources.filter(Boolean).reduce((acc, s) => ({ ...acc, ...s }), {}),
  };

  const out: ChartCustomizationsDict = {};

  for (const key of BAR_CUSTOMIZATION_KEYS) {
    const value = merged[key];
    if (value !== undefined) {
      out[key] = value;
      continue;
    }
    const fallback = (barDefaultOptions as unknown as Record<string, unknown>)[key];
    if (fallback !== undefined) {
      out[key] = fallback;
    }
  }

  return out;
}
