import type { CreateChartPayload } from '@/pages/Visualization/API/chartsApi';
import { applyAnalyticsStudioPayloadForSavedChart } from '@/pages/analyticsstudio/analyticsStudioChartPayload';
import type { AnalyticsStudioChartRecord } from '@/pages/analyticsstudio/analyticsStudioChartUtils';
import type { Chart } from '../types';

function normalizeXAxisInParams(params: Record<string, unknown>) {
  const raw = params['X-axis'] ?? params['x-axis'];
  if (raw === undefined || raw === null || raw === '') return params;

  const normalizeEntry = (entry: unknown) => {
    if (!entry) return null;
    if (typeof entry === 'string') return { columns: entry };
    if (typeof entry === 'object') {
      const obj = entry as Record<string, unknown>;
      const col = obj.columns ?? obj.name ?? obj.field ?? null;
      if (!col) return null;
      return {
        columns: col,
        ...(obj.alias ? { alias: obj.alias } : {}),
      };
    }
    return null;
  };

  if (Array.isArray(raw)) {
    const arr = raw.map(normalizeEntry).filter(Boolean);
    if (arr.length > 0) params['X-axis'] = arr;
  } else {
    const item = normalizeEntry(raw);
    if (item) params['X-axis'] = [item];
  }

  delete params['x-axis'];
  return params;
}

export function buildDashboardCreateChartPayload(
  chart: Chart,
  analyticsStudio?: boolean,
): CreateChartPayload {
  const visualizationName = chart.visualization_name || chart.chart_type || '';
  const defaultSource =
    (chart.params && chart.params.source
      ? String(chart.params.source)
      : visualizationName || chart.chart_name || 'default');

  let chartPayload: CreateChartPayload;

  if (visualizationName.toLowerCase() === 'sunburst') {
    const params: Record<string, unknown> = { ...(chart.params || {}) };
    params.source = defaultSource;

    if (Array.isArray(params.hierarchy)) {
      params.dimensions = params.hierarchy.map((col: unknown) =>
        typeof col === 'string'
          ? { columns: col }
          : ((col as { columns?: string })?.columns ? { columns: (col as { columns: string }).columns } : col),
      );
      delete params.hierarchy;
    }

    normalizeXAxisInParams(params);

    chartPayload = {
      flow_id: chart.flow_id || '',
      stmt_date: chart.stmt_date || '',
      visualization_name: visualizationName,
      params: params as CreateChartPayload['params'],
    };
  } else {
    const params: Record<string, unknown> = { ...(chart.params || {}) };
    params.source = defaultSource;
    normalizeXAxisInParams(params);

    chartPayload = {
      flow_id: chart.flow_id || '',
      visualization_name: visualizationName,
      chart_name: chart.chart_name || '',
      stmt_date: chart.stmt_date || '',
      params: params as CreateChartPayload['params'],
    };
  }

  if (chart.customization && Object.keys(chart.customization).length > 0) {
    chartPayload.customization = chart.customization;
  }

  if (analyticsStudio || chart.source_type === 'database') {
    return applyAnalyticsStudioPayloadForSavedChart(
      chartPayload,
      chart as unknown as AnalyticsStudioChartRecord,
      defaultSource,
    ) as CreateChartPayload;
  }

  return chartPayload;
}
