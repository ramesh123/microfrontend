import type { Dispatch, SetStateAction } from 'react';
import { createChart, getChartById } from '@/pages/Visualization/API/chartsApi';
import type { Chart, DashboardChart } from '../types';
import { isStaticLayoutContentChartId } from '../layoutConstants';
import { buildDashboardCreateChartPayload } from './buildDashboardCreateChartPayload';
import {
  transformDashboardChartRows,
  extractDashboardChartResponseRows,
  buildDashboardChartRawResponse,
} from './dashboardUtils';
import { applyPendingChartCustomization } from './applyPendingChartCustomization';
import { syncDashboardWidgetChartAfterEdit } from './syncDashboardWidgetChartAfterEdit';

export function isRefreshableDashboardChart(dc: DashboardChart): boolean {
  return !isStaticLayoutContentChartId(dc.chartId);
}

export function dashboardChartIdsMatch(
  widgetChartId: number | undefined,
  editedChartId: number | null | undefined,
): boolean {
  if (editedChartId == null || widgetChartId == null) return false;
  return Number(widgetChartId) === Number(editedChartId);
}

function flattenPivotResponse(resp: any): { rows: Record<string, any>[]; columns?: string[] } {
  const rows = Array.isArray(resp.rows) ? resp.rows : resp.rows && typeof resp.rows === 'object' ? Object.values(resp.rows) : [];
  let norm: Record<string, any> = resp.data;
  if (Object.keys(norm).length === 1 && norm[Object.keys(norm)[0]] && typeof norm[Object.keys(norm)[0]] === 'object') {
    norm = norm[Object.keys(norm)[0]];
  }
  const rowDimSet = new Set(rows);
  const metricKeys = Object.keys(norm).filter((k: string) => !rowDimSet.has(k));
  const firstRowDim = rows[0];
  const rowIndexSource = norm[firstRowDim] ?? (metricKeys[0] ? norm[metricKeys[0]] : null);
  const rowIndices =
    rowIndexSource && typeof rowIndexSource === 'object'
      ? Object.keys(rowIndexSource).sort((a, b) => Number(a) - Number(b))
      : [];
  const flattened: Record<string, any>[] = [];
  for (const idx of rowIndices) {
    const rowObj: Record<string, any> = {};
    for (const dim of rows) {
      const colData = norm[dim];
      rowObj[dim] = colData && typeof colData === 'object' && idx in colData ? colData[idx] : '';
    }
    for (const colKey of metricKeys) {
      const colData = norm[colKey];
      rowObj[colKey] = colData && typeof colData === 'object' && idx in colData ? colData[idx] : null;
    }
    flattened.push(rowObj);
  }
  return { rows: flattened, columns: resp.columns };
}

export async function refreshDashboardChartWidget(
  dc: DashboardChart,
  isAnalyticsStudio: boolean,
  setDashboardCharts: Dispatch<SetStateAction<DashboardChart[]>>,
  chartOverride?: Chart,
): Promise<void> {
  try {
    let chartForFetch: Chart = chartOverride ?? dc.chart;
    if (!chartOverride) {
      try {
        const fullChart = (await getChartById(String(dc.chartId))) as Chart;
        if (fullChart) {
          chartForFetch = syncDashboardWidgetChartAfterEdit(dc.chart, fullChart);
        }
      } catch {
        // continue with widget chart metadata
      }
    }

    const chartPayload = buildDashboardCreateChartPayload(chartForFetch, isAnalyticsStudio);
    const resp: any = await createChart(chartPayload);
    const isPivotResponse =
      resp && resp.rows && resp.columns && resp.data && typeof resp.data === 'object' && !Array.isArray(resp.data);

    if (isPivotResponse) {
      const { rows, columns } = flattenPivotResponse(resp);
      setDashboardCharts((prev) =>
        prev.map((item) =>
          item.id === dc.id
            ? {
                ...item,
                chart: chartForFetch,
                chartData: rows.length > 0 ? rows : [],
                chartColumns: columns,
                rawResponse: resp,
                isLoading: false,
              }
            : item,
        ),
      );
      return;
    }

    const vizName = (chartForFetch.visualization_name || chartForFetch.chart_type || '').toString().toLowerCase();
    const chartMetrics = chartForFetch.params?.metrics ?? chartForFetch.params?.metric ?? chartForFetch.params?.mtric;
    const rawRows = extractDashboardChartResponseRows(resp);
    const transformedData = transformDashboardChartRows(rawRows, vizName, {
      columns: resp.columns,
      metrics: Array.isArray(chartMetrics) ? chartMetrics : undefined,
      x_axis: resp.x_axis ?? null,
    });

    setDashboardCharts((prev) =>
      prev.map((item) =>
        item.id === dc.id
          ? {
              ...item,
              chart: chartForFetch,
              chartData: transformedData,
              chartColumns: resp.columns,
              rawResponse: buildDashboardChartRawResponse(
                resp,
                chartForFetch.params || {},
                rawRows,
                chartMetrics,
              ),
              isLoading: false,
            }
          : item,
      ),
    );
  } catch (error) {
    console.error('Failed to reload chart data after edit:', error);
    setDashboardCharts((prev) =>
      prev.map((item) => (item.id === dc.id ? { ...item, isLoading: false } : item)),
    );
  }
}

/** Reload widget(s) for the edited chart only (metadata sync + fresh API data). */
export async function refreshAllDashboardChartWidgets(
  isAnalyticsStudio: boolean,
  setDashboardCharts: Dispatch<SetStateAction<DashboardChart[]>>,
  options?: {
    editedChartId?: number | null;
    editedChartMeta?: Chart | null;
    pendingCustomization?: Record<string, unknown> | null;
  },
): Promise<string[]> {
  const { editedChartId, editedChartMeta, pendingCustomization } = options ?? {};
  const normalizedEditedId = editedChartId != null ? Number(editedChartId) : null;

  if (normalizedEditedId == null) {
    return [];
  }

  let refreshTargets: DashboardChart[] = [];
  setDashboardCharts((prev) => {
    refreshTargets = prev
      .filter(isRefreshableDashboardChart)
      .filter((dc) => dashboardChartIdsMatch(dc.chartId, normalizedEditedId))
      .map((dc) => {
        const widgetWithPending = applyPendingChartCustomization(dc.chart, pendingCustomization);
        const nextChart = editedChartMeta
          ? syncDashboardWidgetChartAfterEdit(widgetWithPending, editedChartMeta)
          : widgetWithPending;
        return {
          ...dc,
          isLoading: true,
          chart: nextChart,
        };
      });

    const refreshById = new Map(refreshTargets.map((widget) => [widget.id, widget]));
    return prev.map((dc) => refreshById.get(dc.id) ?? dc);
  });

  if (refreshTargets.length === 0) {
    return [];
  }

  await Promise.all(
    refreshTargets.map((dc) =>
      refreshDashboardChartWidget(dc, isAnalyticsStudio, setDashboardCharts, dc.chart),
    ),
  );

  return refreshTargets.map((dc) => dc.id);
}
