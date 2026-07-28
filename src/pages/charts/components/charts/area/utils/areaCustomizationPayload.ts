import type { AreaCustomizationOptions } from '../customize/areaCustomizeTypes';
import { defaultOptions as areaDefaultOptions } from '../customize/areaCustomizeTypes';

export type ChartCustomizationsDict = Record<string, unknown>;

export const AREA_CUSTOMIZATION_KEYS = [
  'colorScheme',
  'fontSize',
  'numberFormat',
  'currencyFormat',
  'currencySymbol',
  'currencyCode',
  'showLabels',
  'showLegend',
  'showValue',
  'valueFormatMode',
  'valueDecimalPlaces',
  'applyValueDecimalPlaces',
  'areaCurveStyle',
  'areaFillOpacity',
  'comparisonSeriesDashed',
  'areaCrosshairTooltip',
  'lineThickness',
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
  'refreshIntervalSeconds',
] as const satisfies readonly (keyof AreaCustomizationOptions)[];

export function buildAreaCustomizationPayload(
  ...sources: Array<ChartCustomizationsDict | null | undefined>
): ChartCustomizationsDict {
  const merged: ChartCustomizationsDict = {
    ...areaDefaultOptions,
    ...sources.filter(Boolean).reduce((acc, s) => ({ ...acc, ...s }), {}),
  };

  const out: ChartCustomizationsDict = {};

  for (const key of AREA_CUSTOMIZATION_KEYS) {
    const value = merged[key];
    if (value !== undefined) {
      out[key] = value;
      continue;
    }
    const fallback = (areaDefaultOptions as unknown as Record<string, unknown>)[key];
    if (fallback !== undefined) {
      out[key] = fallback;
    }
  }

  return out;
}
