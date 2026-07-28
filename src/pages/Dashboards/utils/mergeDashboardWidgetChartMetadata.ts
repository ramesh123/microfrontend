import type { Chart } from '../types';
import { BIG_NUMBER_CUSTOMIZATION_KEYS } from '@/pages/charts/components/charts/bigNumber';
import { isDashboardWidgetParamKey } from './dashboardWidgetParamKeys';

type WidgetLike = { params?: Record<string, unknown> } | null | undefined;
type ChartEntryLike = { params?: Record<string, unknown> } | null | undefined;

function isBigNumberChartHint(chart: Chart): boolean {
  const hint = String(chart.visualization_name || chart.chart_type || '').toLowerCase();
  return /big_number|big number/.test(hint) && !/stream/.test(hint);
}

/** Merge per-widget dashboard params onto chart metadata (customizations, panel config, etc.). */
export function mergeDashboardWidgetChartMetadata<T extends Chart | Record<string, unknown>>(
  chartFromApi: T,
  options?: {
    widget?: WidgetLike;
    chartEntry?: ChartEntryLike;
  },
): T {
  const entryParams = options?.chartEntry?.params;
  const widgetParams = options?.widget?.params;
  if (!entryParams && !widgetParams) return chartFromApi;

  const base = chartFromApi as Chart;
  const mergedParams: Record<string, unknown> = {
    ...(base.params || {}),
    ...(entryParams || {}),
    ...(widgetParams || {}),
  };

  if (isBigNumberChartHint(base)) {
    for (const key of BIG_NUMBER_CUSTOMIZATION_KEYS) {
      if (isDashboardWidgetParamKey(key)) continue;
      if (base.params && base.params[key] !== undefined) {
        mergedParams[key] = base.params[key];
      }
    }
  }

  return {
    ...base,
    params: mergedParams,
  } as T;
}
