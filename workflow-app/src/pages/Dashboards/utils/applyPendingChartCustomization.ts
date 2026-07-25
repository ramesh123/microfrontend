import {
  getSavedChartCustomizations,
  resolveChartCustomizationsForApi,
} from '@/pages/charts/chartCustomizationsPayload';
import { BIG_NUMBER_CUSTOMIZATION_KEYS } from '@/pages/charts/components/charts/bigNumber';
import type { Chart } from '../types';

/** Overlay latest editor-session customization onto chart metadata (e.g. dragged icon position). */
export function applyPendingChartCustomization(
  chart: Chart,
  pendingCustomization?: Record<string, unknown> | null,
): Chart {
  if (!pendingCustomization || typeof pendingCustomization !== 'object') return chart;

  const hint = String(chart.visualization_name || chart.chart_type || '');
  const resolved =
    resolveChartCustomizationsForApi(
      pendingCustomization,
      getSavedChartCustomizations(chart),
      hint,
      true,
    ) ?? pendingCustomization;

  if (!resolved || Object.keys(resolved).length === 0) return chart;

  const params = { ...(chart.params || {}) };
  for (const key of BIG_NUMBER_CUSTOMIZATION_KEYS) {
    if (resolved[key] !== undefined) {
      params[key] = resolved[key];
    }
  }

  return {
    ...chart,
    customization: {
      ...(getSavedChartCustomizations(chart) || {}),
      ...resolved,
    },
    params,
  };
}
