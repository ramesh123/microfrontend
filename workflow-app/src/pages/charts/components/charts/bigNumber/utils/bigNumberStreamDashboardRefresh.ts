import { useEffect, useRef } from 'react';
import { createChart } from '@/pages/Visualization/API/chartsApi';
import { getChartCustomizationFromChart } from '@/pages/charts/chartCustomizationsPayload';
import { isPieDonutOrRadiusPieChart, normalizePieLikeChartRows } from '@/pages/charts/chartVizTypes';

export type StreamChartDataSlice = {
  chartData?: Array<{ category: string; value: number; originalData?: any }>;
  rawResponse?: {
    data?: Array<Record<string, unknown>>;
    columns?: string[];
    x_axis?: string;
    dimensions?: string[];
    hierarchy?: string[];
    rows?: unknown;
  };
  chartColumns?: string[];
};

export function isBigNumberStreamChart(chart?: {
  visualization_name?: string;
  chart_type?: string;
} | null): boolean {
  const hint = `${chart?.visualization_name || ''} ${chart?.chart_type || ''}`.toLowerCase();
  return hint.includes('big_number_stream') || hint.includes('big number stream');
}

export function isGaugeChart(chart?: {
  visualization_name?: string;
  chart_type?: string;
} | null): boolean {
  const hint = `${chart?.visualization_name || ''} ${chart?.chart_type || ''}`.toLowerCase();
  return hint.includes('gauge');
}

export function isSunburstChart(chart?: {
  visualization_name?: string;
  chart_type?: string;
} | null): boolean {
  const hint = `${chart?.visualization_name || ''} ${chart?.chart_type || ''}`.toLowerCase();
  return hint.includes('sunburst');
}

export function isFunnelChart(chart?: {
  visualization_name?: string;
  chart_type?: string;
} | null): boolean {
  const hint = `${chart?.visualization_name || ''} ${chart?.chart_type || ''}`.toLowerCase();
  return hint.includes('funnel');
}

export function isBarChart(chart?: {
  visualization_name?: string;
  chart_type?: string;
} | null): boolean {
  const hint = `${chart?.visualization_name || ''} ${chart?.chart_type || ''}`.toLowerCase();
  return hint.includes('bar') || hint.includes('column');
}

export function isLineChart(chart?: {
  visualization_name?: string;
  chart_type?: string;
} | null): boolean {
  const hint = `${chart?.visualization_name || ''} ${chart?.chart_type || ''}`.toLowerCase();
  return hint.includes('line');
}

export function isAreaChart(chart?: {
  visualization_name?: string;
  chart_type?: string;
} | null): boolean {
  const hint = `${chart?.visualization_name || ''} ${chart?.chart_type || ''}`.toLowerCase();
  return hint.includes('area');
}

export function isPivotChart(chart?: {
  visualization_name?: string;
  chart_type?: string;
} | null): boolean {
  const hint = `${chart?.visualization_name || ''} ${chart?.chart_type || ''}`.toLowerCase();
  return hint.includes('pivot');
}

export function isTableChart(chart?: {
  visualization_name?: string;
  chart_type?: string;
} | null): boolean {
  const hint = `${chart?.visualization_name || ''} ${chart?.chart_type || ''}`.toLowerCase();
  return hint.includes('table') && !hint.includes('pivot');
}

export function isPieDonutOrRadiusPieAutoRefreshChart(chart?: {
  visualization_name?: string;
  chart_type?: string;
} | null): boolean {
  return isPieDonutOrRadiusPieChart(chart?.visualization_name || chart?.chart_type);
}

/** Charts that support scheduled auto-refresh on dashboards and analytics. */
export function isAutoRefreshChart(chart?: {
  visualization_name?: string;
  chart_type?: string;
} | null): boolean {
  return (
    isBigNumberStreamChart(chart) ||
    isGaugeChart(chart) ||
    isSunburstChart(chart) ||
    isFunnelChart(chart) ||
    isBarChart(chart) ||
    isLineChart(chart) ||
    isAreaChart(chart) ||
    isPivotChart(chart) ||
    isTableChart(chart) ||
    isPieDonutOrRadiusPieAutoRefreshChart(chart)
  );
}

export function getBigNumberStreamRefreshIntervalSeconds(chart?: unknown): number {
  const custom = getChartCustomizationFromChart(
    chart as { customization?: unknown; params?: { customization?: unknown } } | null,
  );
  const sec = custom?.refreshIntervalSeconds;
  return typeof sec === 'number' && Number.isFinite(sec) && sec > 0 ? sec : 0;
}

/** Alias used by gauge and other auto-refresh chart types (same customization field). */
export const getChartRefreshIntervalSeconds = getBigNumberStreamRefreshIntervalSeconds;

function normalizeXAxisInParams(params: Record<string, unknown> | undefined) {
  if (!params) return params ?? { source: '' };
  const p = { ...params };
  const rawX = p['X-axis'] || p['x-axis'] || p.x_axis || p.xAxis;
  if (rawX === undefined || rawX === null) return p;

  if (Array.isArray(rawX)) {
    p['X-axis'] = rawX.map((d: unknown) => {
      if (typeof d === 'string') return { columns: d };
      if (d && typeof d === 'object') {
        const o = d as Record<string, unknown>;
        return { columns: o.columns || o.column || o.name || '', alias: o.alias || o.name };
      }
      return d;
    });
  } else if (typeof rawX === 'string') {
    p['X-axis'] = [{ columns: rawX, alias: rawX }];
  } else if (rawX && typeof rawX === 'object') {
    const o = rawX as Record<string, unknown>;
    p['X-axis'] = [{ columns: o.columns || o.column || o.name || '', alias: o.alias || o.name }];
  }
  return p;
}

/** Build createChart payload for dashboard / analytics views. */
export function buildBigNumberStreamChartPayload(
  chartDetails: {
    flow_id?: string;
    visualization_name?: string;
    chart_name?: string;
    params?: Record<string, unknown>;
  },
  stmtDate: string,
  flowId?: string,
) {
  if ((chartDetails.visualization_name || '').toLowerCase() === 'sunburst') {
    const params: Record<string, unknown> = { ...(chartDetails.params || {}) };
    params.source =
      chartDetails.params?.source ??
      chartDetails.visualization_name ??
      chartDetails.chart_name ??
      'default';
    if (Array.isArray(params.hierarchy)) {
      params.dimensions = (params.hierarchy as unknown[]).map((c: unknown) =>
        typeof c === 'string' ? { columns: c } : (c as { columns?: string }).columns ? { columns: (c as { columns: string }).columns } : c,
      );
      delete params.hierarchy;
    }
    return {
      flow_id: chartDetails.flow_id || flowId || '',
      stmt_date: stmtDate,
      visualization_name: chartDetails.visualization_name || '',
      params: normalizeXAxisInParams(params),
    };
  }

  return {
    flow_id: chartDetails.flow_id || flowId || '',
    visualization_name: chartDetails.visualization_name || '',
    chart_name: chartDetails.chart_name || '',
    stmt_date: stmtDate,
    params: normalizeXAxisInParams(chartDetails.params || { source: '' }),
  };
}

export function normalizeBigNumberStreamChartResponse(
  chartDetails: { visualization_name?: string; chart_type?: string; params?: Record<string, unknown> },
  resp: {
    data?: unknown[];
    columns?: string[];
    x_axis?: string;
    rows?: unknown;
    dimensions?: unknown;
    hierarchy?: unknown;
  },
): StreamChartDataSlice {
  const cols = resp?.columns || [];
  const visualizationName = (chartDetails.visualization_name || '').toString().toLowerCase();
  const isPivot = isPivotChart(chartDetails);
  const isTable = isTableChart(chartDetails);

  if (isPivot) {
    return {
      chartData: [],
      chartColumns: cols,
      rawResponse: resp as StreamChartDataSlice['rawResponse'],
    };
  }

  if (isTable && Array.isArray(resp?.data)) {
    return {
      chartData: resp.data as StreamChartDataSlice['chartData'],
      chartColumns: cols,
      rawResponse: {
        data: resp.data as Array<Record<string, unknown>>,
        columns: resp.columns || cols,
        ...(resp.x_axis ? { x_axis: resp.x_axis } : {}),
      },
    };
  }

  const isSunburst = visualizationName === 'sunburst';
  const isMultiColumn = Array.isArray(cols) && cols.length > 1;
  const isPieOrDonut = isPieDonutOrRadiusPieChart(visualizationName);

  const looksLikeDimensionMetric =
    Array.isArray(resp?.data) &&
    resp.data.length > 0 &&
    (() => {
      const sample = resp.data.slice(0, 10) as Record<string, unknown>[];
      const keys = Object.keys(sample[0] || {});
      if (keys.length < 2) return false;
      const numericCounts: Record<string, number> = {};
      keys.forEach((k) => {
        numericCounts[k] = 0;
      });
      sample.forEach((row) => {
        keys.forEach((k) => {
          const v = row[k];
          if (v === null || v === undefined) return;
          if (typeof v === 'number') numericCounts[k] += 1;
          else if (!Number.isNaN(Number(v))) numericCounts[k] += 1;
        });
      });
      return keys.filter((k) => numericCounts[k] >= Math.max(1, Math.floor(sample.length * 0.6))).length === 1;
    })();

  const isAlreadyHierarchical =
    Array.isArray(resp?.data) &&
    resp.data.some((r: unknown) => {
      if (!r || typeof r !== 'object') return false;
      const row = r as Record<string, unknown>;
      if (row.children && Array.isArray(row.children)) return true;
      if ('category' in row && 'value' in row) return true;
      return Object.values(row).some((v) => v && typeof v === 'object' && !Array.isArray(v));
    });

  let chartDataFinal: StreamChartDataSlice['chartData'] = [];

  if (isSunburst || isAlreadyHierarchical || (isMultiColumn && !looksLikeDimensionMetric && !isPieOrDonut)) {
    chartDataFinal = Array.isArray(resp?.data) ? (resp.data as StreamChartDataSlice['chartData']) : [];
  } else if (isPieOrDonut) {
    chartDataFinal = normalizePieLikeChartRows(Array.isArray(resp?.data) ? resp.data : [], cols);
  } else {
    chartDataFinal = (Array.isArray(resp?.data) ? resp.data : [])
      .map((item: unknown) => {
        const row = (item || {}) as Record<string, unknown>;
        const keys = Object.keys(row);
        const valueKey =
          keys.find((key) => key.includes('(') || typeof row[key] === 'number') ||
          keys.find((key) => typeof row[key] === 'number');
        const dimensionKeys = keys.filter(
          (key) =>
            !key.includes('(') &&
            key !== 'value' &&
            typeof row[key] !== 'number' &&
            row[key] !== null &&
            row[key] !== undefined,
        );

        let category: string;
        if (dimensionKeys.length > 0) {
          category = dimensionKeys
            .map((key) => String(row[key] || '').trim())
            .filter((val) => val !== '')
            .join(', ');
        } else if (valueKey) {
          category = valueKey.replace(/\(.*\)/, '').trim() || 'Value';
        } else {
          category = 'Item';
        }

        const value = valueKey ? Number(row[valueKey]) : NaN;
        if (!valueKey || value === null || Number.isNaN(value)) return null;

        return { category, value, originalData: row };
      })
      .filter((it): it is NonNullable<typeof it> => it !== null);
  }

  const buildRaw = () => {
    if (!resp?.data) return undefined;
    const isPivotResponse =
      Boolean(resp.rows) &&
      Boolean(resp.columns) &&
      typeof resp.data === 'object' &&
      !Array.isArray(resp.data);
    if (isPivotResponse) return resp as StreamChartDataSlice['rawResponse'];

    const out: NonNullable<StreamChartDataSlice['rawResponse']> = {
      data: resp.data as Array<Record<string, unknown>>,
      columns: resp.columns || cols,
    };
    if (resp.x_axis) out.x_axis = resp.x_axis;

    if (resp.dimensions) {
      out.dimensions = resp.dimensions as string[];
    } else {
      const paramsDims =
        chartDetails?.params?.dimensions && Array.isArray(chartDetails.params.dimensions)
          ? chartDetails.params.dimensions.map((d: unknown) =>
              typeof d === 'string' ? d : (d as { columns?: string }).columns || d,
            )
          : undefined;
      if (paramsDims && paramsDims.length > 0) {
        out.dimensions = paramsDims as string[];
      } else if (chartDetails?.params?.hierarchy && Array.isArray(chartDetails.params.hierarchy)) {
        out.dimensions = chartDetails.params.hierarchy.map((d: unknown) =>
          typeof d === 'string' ? d : (d as { columns?: string }).columns || d,
        ) as string[];
      }
    }
    if (resp.hierarchy) out.hierarchy = resp.hierarchy as string[];
    return out;
  };

  return {
    chartData: chartDataFinal,
    chartColumns: cols,
    rawResponse: buildRaw(),
  };
}

/** Append fresh rows for sparkline / trend while keeping latest value for display. */
export function mergeStreamChartRefreshResult(
  prev: StreamChartDataSlice,
  next: StreamChartDataSlice,
): StreamChartDataSlice {
  const prevRawRows = Array.isArray(prev.rawResponse?.data) ? prev.rawResponse.data : [];
  const nextRawRows = Array.isArray(next.rawResponse?.data) ? next.rawResponse.data : [];
  const mergedRawRows = nextRawRows.length > 0 ? [...prevRawRows, ...nextRawRows] : prevRawRows;

  const latestChartRow =
    next.chartData && next.chartData.length > 0
      ? next.chartData[next.chartData.length - 1]
      : prev.chartData && prev.chartData.length > 0
        ? prev.chartData[prev.chartData.length - 1]
        : undefined;

  return {
    chartData: latestChartRow ? [latestChartRow] : prev.chartData,
    chartColumns: next.chartColumns ?? prev.chartColumns,
    rawResponse: {
      ...(prev.rawResponse || {}),
      ...(next.rawResponse || {}),
      data: mergedRawRows.length > 0 ? mergedRawRows : next.rawResponse?.data ?? prev.rawResponse?.data,
      columns: next.chartColumns ?? next.rawResponse?.columns ?? prev.rawResponse?.columns ?? prev.chartColumns,
      x_axis: next.rawResponse?.x_axis ?? prev.rawResponse?.x_axis,
      dimensions: next.rawResponse?.dimensions ?? prev.rawResponse?.dimensions,
    },
  };
}

/** Big number stream keeps sparkline history; gauge replaces with the latest snapshot. */
export function mergeChartRefreshResult(
  chartDetails: { visualization_name?: string; chart_type?: string },
  prev: StreamChartDataSlice,
  next: StreamChartDataSlice,
): StreamChartDataSlice {
  if (isBigNumberStreamChart(chartDetails)) {
    return mergeStreamChartRefreshResult(prev, next);
  }
  if (next.chartData?.length || next.rawResponse) {
    return {
      chartData: next.chartData ?? prev.chartData,
      chartColumns: next.chartColumns ?? prev.chartColumns,
      rawResponse: next.rawResponse ?? prev.rawResponse,
    };
  }
  return prev;
}

export function useBigNumberStreamRefresh({
  enabled,
  chartDetails,
  intervalSeconds,
  stmtDate,
  flowId,
  getCurrentData,
  onDataUpdate,
}: {
  enabled: boolean;
  chartDetails: {
    id?: number;
    flow_id?: string;
    visualization_name?: string;
    chart_name?: string;
    params?: Record<string, unknown>;
  } | null | undefined;
  intervalSeconds: number;
  stmtDate: string;
  flowId?: string;
  getCurrentData: () => StreamChartDataSlice;
  onDataUpdate: (merged: StreamChartDataSlice) => void;
}) {
  const getCurrentDataRef = useRef(getCurrentData);
  const onDataUpdateRef = useRef(onDataUpdate);
  getCurrentDataRef.current = getCurrentData;
  onDataUpdateRef.current = onDataUpdate;

  useEffect(() => {
    if (!enabled || !chartDetails || intervalSeconds <= 0 || !stmtDate) {
      return;
    }

    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      try {
        if (typeof window !== 'undefined') {
          (window as any).__chartStreamSilentRefresh = true;
        }
        const payload = buildBigNumberStreamChartPayload(chartDetails, stmtDate, flowId);
        const resp = await createChart(payload);
        if (cancelled) return;
        const normalized = normalizeBigNumberStreamChartResponse(chartDetails, resp as Parameters<typeof normalizeBigNumberStreamChartResponse>[1]);
        const merged = mergeChartRefreshResult(chartDetails, getCurrentDataRef.current(), normalized);
        onDataUpdateRef.current(merged);
      } catch (err) {
        console.error('Chart auto-refresh failed:', err);
      }
    };

    const timer = window.setInterval(tick, intervalSeconds * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    enabled,
    chartDetails?.id,
    chartDetails?.visualization_name,
    intervalSeconds,
    stmtDate,
    flowId,
  ]);
}
