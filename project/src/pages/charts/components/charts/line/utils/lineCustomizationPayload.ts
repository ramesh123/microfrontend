import type { LineCustomizationOptions } from '../customize/lineCustomizeTypes';
import { defaultOptions as lineDefaultOptions } from '../customize/lineCustomizeTypes';

export type ChartCustomizationsDict = Record<string, unknown>;

export const LINE_CUSTOMIZATION_KEYS = [
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
  'refreshIntervalSeconds',
  'lineCurveStyle',
  'lineThickness',
] as const satisfies readonly (keyof LineCustomizationOptions)[];

export function buildLineCustomizationPayload(
  ...sources: Array<ChartCustomizationsDict | null | undefined>
): ChartCustomizationsDict {
  const merged: ChartCustomizationsDict = {
    ...lineDefaultOptions,
    ...sources.filter(Boolean).reduce((acc, s) => ({ ...acc, ...s }), {}),
  };

  const out: ChartCustomizationsDict = {};

  for (const key of LINE_CUSTOMIZATION_KEYS) {
    const value = merged[key];
    if (value !== undefined) {
      out[key] = value;
      continue;
    }
    const fallback = (lineDefaultOptions as unknown as Record<string, unknown>)[key];
    if (fallback !== undefined) {
      out[key] = fallback;
    }
  }

  return out;
}
