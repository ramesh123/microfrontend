import { inferType } from "@/pages/charts/ChartFormulator/types";
import type { ChartFormParameter } from "@/pages/Visualization/API/chartsApi";

/** Unwrap `{ data: chart }` envelopes returned by some chart APIs. */
export function normalizeChartRecordForWizard(
  chartData: Record<string, unknown>,
): Record<string, unknown> {
  const nested = chartData.data;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const candidate = nested as Record<string, unknown>;
    if (
      candidate.params != null ||
      candidate.visualization_name != null ||
      candidate.chart_type != null
    ) {
      return candidate;
    }
  }
  return chartData;
}

export function resolveChartParamsFromRecord(
  chartData: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const record = normalizeChartRecordForWizard(chartData);
  let params: unknown =
    record.params ??
    (record.chart_data as Record<string, unknown> | undefined)?.params;

  if (typeof params === "string") {
    const trimmed = params.trim();
    if (!trimmed || trimmed.includes("{{")) return undefined;
    try {
      params = JSON.parse(trimmed);
    } catch {
      return undefined;
    }
  }

  if (params && typeof params === "object" && !Array.isArray(params)) {
    return params as Record<string, unknown>;
  }
  return undefined;
}

function expandSavedMetricsForForm(apiMetrics: any[], metricsKey: string) {
  const mappedMetrics = apiMetrics.map((m: any) => {
    let columnName = "";
    if (typeof m === "string") {
      columnName = m;
    } else if (m && typeof m === "object") {
      const raw = m.columns ?? m.column ?? m.name ?? m.field;
      columnName = raw != null && typeof raw !== "object" ? String(raw) : "";
    }
    return {
      name: columnName,
      type: inferType(columnName || ""),
    };
  });

  const extraFormKeys: Record<string, unknown> = {};
  apiMetrics.forEach((metric: any, idx: number) => {
    const op = metric?.operation ?? metric?.aggregation ?? metric?.agg;
    const als = metric?.alias ?? metric?.column_alias;
    const prefixes = ["metric", "metrics", "mtric", metricsKey];
    const seen = new Set<string>();
    for (const prefix of prefixes) {
      if (!prefix || seen.has(prefix)) continue;
      seen.add(prefix);
      if (op !== undefined && op !== null && op !== "") {
        extraFormKeys[`${prefix}_${idx}_operation`] = op;
        if (idx === 0) {
          extraFormKeys[`${prefix}_operation`] = op;
        }
      }
      if (als !== undefined && als !== null && als !== "") {
        extraFormKeys[`${prefix}_${idx}_alias`] = als;
        if (idx === 0) {
          extraFormKeys[`${prefix}_alias`] = als;
        }
      }
    }
  });

  return { mappedMetrics, extraFormKeys };
}

export function populateWizardFormFromChart(
  chartData: Record<string, unknown>,
  formData: { parameters?: ChartFormParameter[] },
): Record<string, unknown> {
  const formValues: Record<string, unknown> = {};
  const normalizedChart = normalizeChartRecordForWizard(chartData);
  const params = resolveChartParamsFromRecord(normalizedChart);

  if (!params || !formData.parameters) {
    return formValues;
  }

  const metricsParam = formData.parameters.find(
    (p) => p.key === "metrics" || p.key === "metric" || p.key === "mtric",
  );
  const metricsKey = metricsParam?.key || "metrics";
  const apiMetrics = (params.metrics || params.metric || params.mtric || []) as unknown[];

  if (Array.isArray(apiMetrics) && apiMetrics.length > 0) {
    const { mappedMetrics, extraFormKeys } = expandSavedMetricsForForm(apiMetrics, metricsKey);
    formValues[metricsKey] = mappedMetrics;
    Object.assign(formValues, extraFormKeys);
  }

  const xAxisValue = params["X-axis"] || params["x-axis"];
  if (xAxisValue) {
    const xAxisParam = formData.parameters.find(
      (p) => p.key === "x-axis" || p.key === "X-axis",
    );
    if (xAxisParam) {
      let firstAxis: unknown = xAxisValue;
      if (Array.isArray(xAxisValue)) {
        firstAxis = xAxisValue.length > 0 ? xAxisValue[0] : null;
      }
      const axisObj = firstAxis as { columns?: string; column?: string; name?: string; alias?: string };
      const colName =
        typeof firstAxis === "string"
          ? firstAxis
          : axisObj?.columns || axisObj?.column || axisObj?.name;
      const alias = axisObj?.alias;
      formValues[xAxisParam.key] = {
        name: colName,
        alias,
        type: inferType(String(colName ?? "")),
      };
    }
  }

  if (params.dimensions && Array.isArray(params.dimensions)) {
    formValues.dimensions = params.dimensions.map((d: any) => ({
      name: d.columns || d,
      type: inferType(String(d.columns || d)),
    }));
    params.dimensions.forEach((dim: any, idx: number) => {
      if (dim.alias) {
        formValues[`dimensions_${idx}_alias`] = dim.alias;
      }
    });
  }

  const vizName = String(
    normalizedChart.visualization_name || normalizedChart.visualizationName || "",
  ).toLowerCase();
  const hierarchyParamForForm = formData.parameters.find((p) => p.key === "hierarchy");
  if (
    params.dimensions &&
    Array.isArray(params.dimensions) &&
    (hierarchyParamForForm || vizName.includes("sunburst"))
  ) {
    formValues.hierarchy = params.dimensions.map((d: any) => ({
      name: d.columns || d,
      type: inferType(String(d.columns || d)),
    }));
    params.dimensions.forEach((dim: any, idx: number) => {
      if (dim.alias) {
        formValues[`hierarchy_${idx}_alias`] = dim.alias;
      }
    });
  }

  if (params.group_by && Array.isArray(params.group_by)) {
    formValues.group_by = params.group_by.map((g: any) => ({
      name: g.columns || g,
      type: inferType(String(g.columns || g)),
    }));
    params.group_by.forEach((gb: any, idx: number) => {
      if (gb.aggregate) {
        formValues[`group_by_${idx}_aggregate`] = gb.aggregate;
      }
      if (gb.alias) {
        formValues[`group_by_${idx}_alias`] = gb.alias;
      }
    });
  }

  if (params.filters && Array.isArray(params.filters)) {
    formValues.filters = params.filters
      .filter((f: any) => f.columns)
      .map((f: any) => ({
        name: f.columns,
        type: inferType(String(f.columns)),
      }));
    params.filters.forEach((filter: any, idx: number) => {
      if (!filter.columns) return;
      if (filter.operator) {
        formValues[`filters_${idx}_operator`] = filter.operator;
      }
      if (filter.value) {
        formValues[`filters_${idx}_value`] = filter.value;
      }
    });
  }

  const limitParam = formData.parameters.find((p) => p.key === "limit");
  if (limitParam && params.limit !== undefined && params.limit !== null) {
    formValues.limit = params.limit;
  }

  const sourceParam = formData.parameters.find((p) => p.key === "source");
  if (sourceParam && params.source) {
    formValues.source = params.source;
  }

  const drilldownParam = formData.parameters.find(
    (p) => p.key === "is_drilldown" || p.key === "drilldown",
  );
  if (drilldownParam && params.is_drilldown !== undefined) {
    formValues[drilldownParam.key] = params.is_drilldown;
  }

  const hierarchyParam = formData.parameters.find((p) => p.key === "hierarchy");
  if (hierarchyParam && params.hierarchy && Array.isArray(params.hierarchy)) {
    formValues.hierarchy = params.hierarchy.map((h: any) => ({
      name: typeof h === "string" ? h : h.columns || h,
      type: inferType(String(typeof h === "string" ? h : h.columns || h)),
    }));
  }

  const vizNameForPivot = String(
    normalizedChart.visualization_name || normalizedChart.visualizationName || "",
  ).toLowerCase();
  if (vizNameForPivot.includes("pivot")) {
    if (params.rows && Array.isArray(params.rows)) {
      formValues.rows = params.rows.map((r: any) => ({
        name: typeof r === "string" ? r : (r.columns ?? r),
        type: inferType(String(typeof r === "string" ? r : (r.columns ?? r))),
      }));
    }
    if (params.columns && Array.isArray(params.columns)) {
      formValues.columns = params.columns.map((c: any) => ({
        name: typeof c === "string" ? c : (c.columns ?? c),
        type: inferType(String(typeof c === "string" ? c : (c.columns ?? c))),
      }));
    }
    if (params.apply_metrics_on != null) {
      formValues.apply_metrics_on = params.apply_metrics_on;
    }
  }

  return formValues;
}
