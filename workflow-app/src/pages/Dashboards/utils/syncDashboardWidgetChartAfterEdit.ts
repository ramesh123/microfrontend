import {
  getSavedChartCustomizations,
  resolveChartCustomizationsForApi,
} from '@/pages/charts/chartCustomizationsPayload';
import { BIG_NUMBER_CUSTOMIZATION_KEYS, BIG_NUMBER_STREAM_CUSTOMIZATION_KEYS } from '@/pages/charts/components/charts/bigNumber';
import type { Chart } from '../types';
import { isDashboardWidgetParamKey } from './dashboardWidgetParamKeys';

function isBigNumberChartHint(hint: string): boolean {
  const h = hint.toLowerCase();
  return /big_number|big number/.test(h) && !/stream/.test(h);
}

function isBigNumberStreamChartHint(hint: string): boolean {
  return /big_number_stream|big number stream/.test(hint.toLowerCase());
}

function syncBigNumberCustomizationParams(
  params: Record<string, unknown>,
  apiParams: Record<string, unknown>,
  widgetParams: Record<string, unknown>,
  apiResolvedCustom: Record<string, unknown>,
  keys: readonly string[],
): void {
  for (const key of keys) {
    if (isDashboardWidgetParamKey(key)) continue;
    if (key in apiResolvedCustom) {
      params[key] = apiResolvedCustom[key];
    } else if (apiParams[key] !== undefined) {
      params[key] = apiParams[key];
    } else if (widgetParams[key] !== undefined) {
      params[key] = widgetParams[key];
    } else {
      delete params[key];
    }
  }
}

/** Replace chart definition from API after embedded edit; keep dashboard-only widget param overrides. */
export function syncDashboardWidgetChartAfterEdit(widgetChart: Chart, apiChart: Chart): Chart {
  const hint = String(
    apiChart.visualization_name || apiChart.chart_type || widgetChart.visualization_name || '',
  );
  const widgetParams =
    widgetChart.params && typeof widgetChart.params === 'object' ? widgetChart.params : {};
  const apiParams = apiChart.params && typeof apiChart.params === 'object' ? { ...apiChart.params } : {};
  const params: Record<string, unknown> = { ...apiParams };

  for (const [key, value] of Object.entries(widgetParams)) {
    if (isDashboardWidgetParamKey(key)) {
      params[key] = value;
    }
  }

  const apiCustomizationIsObject =
    apiChart.customization != null &&
    typeof apiChart.customization === 'object' &&
    !Array.isArray(apiChart.customization);

  if (apiCustomizationIsObject && isBigNumberChartHint(hint)) {
    const apiResolvedCustom =
      resolveChartCustomizationsForApi(getSavedChartCustomizations(apiChart), null, hint, true) ??
      getSavedChartCustomizations(apiChart) ??
      {};

    syncBigNumberCustomizationParams(
      params,
      apiParams,
      widgetParams,
      apiResolvedCustom,
      BIG_NUMBER_CUSTOMIZATION_KEYS,
    );
  }

  if (apiCustomizationIsObject && isBigNumberStreamChartHint(hint)) {
    const apiResolvedCustom =
      resolveChartCustomizationsForApi(getSavedChartCustomizations(apiChart), null, hint, true) ??
      getSavedChartCustomizations(apiChart) ??
      {};

    syncBigNumberCustomizationParams(
      params,
      apiParams,
      widgetParams,
      apiResolvedCustom,
      [...BIG_NUMBER_CUSTOMIZATION_KEYS, ...BIG_NUMBER_STREAM_CUSTOMIZATION_KEYS],
    );
  }

  return {
    ...widgetChart,
    ...apiChart,
    customization: apiChart.customization ?? widgetChart.customization,
    params,
    updated_at: apiChart.updated_at ?? widgetChart.updated_at,
  };
}
