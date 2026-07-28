import type { ChartFormParameter } from "@/pages/Visualization/API/chartsApi";
import type { CreateChartPayload } from "@/pages/Visualization/API/chartsApi";
import { applyAnalyticsStudioChartPayload } from "@/pages/analyticsstudio/analyticsStudioChartPayload";
import type { AnalyticsStudioChartInit } from "@/pages/charts/ChartFormulator/types";
import type { AnalyticsStudioCreateChartState } from "../types";
import type { AnalyticsStudioChartRecord } from "../analyticsStudioChartUtils";
import {
  extractColumnName,
  getNestedValue,
  resolveMetricNested,
  stripChartFormAuxKeysFromParams,
} from "@/pages/charts/ChartFormulator/utils";
import { attachCustomizationsToPayload } from "@/pages/charts/chartCustomizationsPayload";
import type { ChartCustomizationOptions } from "@/pages/charts/components/charts/pie";

type WizardChartOrigin = "connection" | "analytical_dataset";

function resolveWizardChartOrigin(
  routeState?: AnalyticsStudioCreateChartState,
  chartRecord?: AnalyticsStudioChartRecord | null,
): WizardChartOrigin | undefined {
  if (routeState?.datasetId != null) return "analytical_dataset";
  if (routeState) return "connection";

  if (!chartRecord) return undefined;

  const explicit = chartRecord.chart_origin;
  if (explicit === "connection" || explicit === "analytical_dataset") {
    return explicit;
  }
  if (chartRecord.dataset_id != null && chartRecord.dataset_id !== "") {
    return "analytical_dataset";
  }
  return "connection";
}

function resolveWizardConnectionId(
  routeState?: AnalyticsStudioCreateChartState,
  chartRecord?: AnalyticsStudioChartRecord | null,
  payload?: CreateChartPayload,
): string | number | undefined {
  const fromRoute = routeState?.connectionId;
  if (fromRoute != null && String(fromRoute).trim()) return fromRoute;

  const fromRecord = chartRecord?.connection_id;
  if (fromRecord != null && String(fromRecord).trim()) return fromRecord;

  const fromPayload = payload?.connection_id;
  if (fromPayload != null && String(fromPayload).trim()) return fromPayload;

  return undefined;
}

function resolveWizardDatasetId(
  routeState?: AnalyticsStudioCreateChartState,
  chartRecord?: AnalyticsStudioChartRecord | null,
): number | string | undefined {
  if (routeState?.datasetId != null) return routeState.datasetId;

  const fromRecord = chartRecord?.dataset_id;
  if (fromRecord != null && fromRecord !== "") {
    const parsed = Number(fromRecord);
    return Number.isNaN(parsed) ? fromRecord : parsed;
  }

  return undefined;
}

/** Wizard-only origin metadata — not sent for workflow/dashboard chart APIs. */
export function finalizeWizardChartPayload(
  payload: CreateChartPayload,
  routeState?: AnalyticsStudioCreateChartState,
  chartRecord?: AnalyticsStudioChartRecord | null,
): CreateChartPayload {
  const chartOrigin = resolveWizardChartOrigin(routeState, chartRecord);
  if (!chartOrigin) return payload;

  if (chartOrigin === "connection") {
    const connectionId = resolveWizardConnectionId(routeState, chartRecord, payload);
    const { dataset_id: _datasetId, ...rest } = payload;
    return {
      ...rest,
      chart_origin: "connection",
      ...(connectionId != null ? { connection_id: connectionId } : {}),
    };
  }

  const datasetId = resolveWizardDatasetId(routeState, chartRecord);
  const {
    connection_id: _connectionId,
    database_name: _databaseName,
    schema_name: _schemaName,
    table_name: _tableName,
    ...rest
  } = payload;

  return {
    ...rest,
    chart_origin: "analytical_dataset",
    ...(datasetId != null ? { dataset_id: datasetId } : {}),
  };
}

export interface BuildWizardChartPayloadInput {
  flowId: string;
  formValues: Record<string, unknown>;
  chartFormData: { parameters?: ChartFormParameter[]; name?: string; unique_id?: string } | null;
  selectedChart: { name: string; uniqueId?: string };
  selectedSource?: string | null;
  analyticsStudioInit?: AnalyticsStudioChartInit | null;
  customizationOptions?: ChartCustomizationOptions | null;
  routeState?: AnalyticsStudioCreateChartState;
  chartRecord?: AnalyticsStudioChartRecord | null;
}

export function buildWizardChartPayload({
  flowId,
  formValues,
  chartFormData,
  selectedChart,
  selectedSource,
  analyticsStudioInit,
  customizationOptions,
  routeState,
  chartRecord,
}: BuildWizardChartPayloadInput): CreateChartPayload | null {
  const formParams = chartFormData?.parameters ?? [];
  const chartType = selectedChart.uniqueId?.toLowerCase() || selectedChart.name.toLowerCase();
  const isPivotChart = chartType.includes("pivot") || selectedChart.uniqueId === "pivot_table";
  const formHasXAxisField = formParams.some((p) => p.key === "x-axis" || p.key === "X-axis");
  const formHasDimensionsField = formParams.some((p) => p.key === "dimensions");
  const isBarChart = chartType.includes("bar") || chartType.includes("column");
  const isLineChart = chartType.includes("line");
  const isAreaChart = chartType.includes("area");
  const isSunburstChart = chartType.includes("sunburst");

  const payload: CreateChartPayload = {
    flow_id: flowId,
    stmt_date: "",
    chart_name: selectedChart.name || "Untitled Chart",
    visualization_name:
      selectedChart.uniqueId || selectedChart.name.toLowerCase().replace(/\s+/g, "_") || "",
    params: {
      source: selectedSource || "",
      limit: undefined,
      is_drilldown: false,
    },
  };

  if (isPivotChart) {
    const rowsValue = formValues.rows;
    const rowsArr = Array.isArray(rowsValue) ? rowsValue : rowsValue ? [rowsValue] : [];
    (payload.params as Record<string, unknown>).rows = rowsArr
      .map((col) => extractColumnName(col))
      .filter(Boolean) as string[];

    const columnsValue = formValues.columns;
    const columnsArr = Array.isArray(columnsValue)
      ? columnsValue
      : columnsValue
        ? [columnsValue]
        : [];
    (payload.params as Record<string, unknown>).columns = columnsArr
      .map((col) => extractColumnName(col))
      .filter(Boolean) as string[];
    (payload.params as Record<string, unknown>).apply_metrics_on =
      formValues.apply_metrics_on || "columns";
    (payload.params as Record<string, unknown>).is_drilldown = false;

    if (formValues.filters && Array.isArray(formValues.filters) && formValues.filters.length > 0) {
      (payload.params as Record<string, unknown>).filters = formValues.filters
        .map((col, idx) => {
          const colName = extractColumnName(col);
          if (!colName) return null;
          const operator = getNestedValue(formValues, "filters", "operator", idx) || "=";
          const value = getNestedValue(formValues, "filters", "value", idx);
          return { columns: colName, operator, value };
        })
        .filter((f) => f && f.columns && f.value !== undefined);
    } else {
      (payload.params as Record<string, unknown>).filters = [];
    }
  }

  if (formValues.metric || formValues.metrics || formValues.mtric) {
    const metricValue = formValues.metric || formValues.metrics || formValues.mtric;
    const metricColumns = Array.isArray(metricValue) ? metricValue : metricValue ? [metricValue] : [];
    payload.params.metrics = metricColumns
      .map((col, idx) => {
        const colName = extractColumnName(col);
        if (!colName) return null;
        const operation =
          (resolveMetricNested(formValues, formParams, "operation", idx, col) as string) || "";
        const alias = resolveMetricNested(formValues, formParams, "alias", idx, col) as
          | string
          | null;
        return {
          columns: colName,
          operation,
          ...(alias && { alias, name: alias }),
        };
      })
      .filter((m) => m && m.columns);
  }

  const xAxisFromForm = formValues["x-axis"] ?? formValues["X-axis"];
  if (!isPivotChart && formHasXAxisField && xAxisFromForm) {
    const xAxisCol = Array.isArray(xAxisFromForm) ? xAxisFromForm[0] : xAxisFromForm;
    const xAxisColName = extractColumnName(xAxisCol);
    const alias =
      getNestedValue(formValues, "x-axis", "alias") ||
      getNestedValue(formValues, "x-axis", "label") ||
      getNestedValue(formValues, "X-axis", "alias") ||
      getNestedValue(formValues, "X-axis", "label");
    if (xAxisColName) {
      const xObj: Record<string, string> = { columns: xAxisColName };
      if (alias) xObj.alias = alias;
      payload.params["X-axis"] = [xObj];
    }
  }

  if (!isPivotChart && formHasDimensionsField && formValues.dimensions) {
    const dimValue = formValues.dimensions;
    const dimColumns = Array.isArray(dimValue) ? dimValue : dimValue ? [dimValue] : [];
    payload.params.dimensions = dimColumns
      .map((col, idx) => {
        const colName = extractColumnName(col);
        if (!colName) return null;
        const alias = getNestedValue(formValues, "dimensions", "alias", idx);
        return {
          columns: colName,
          ...(alias && { alias }),
        };
      })
      .filter((d) => d && d.columns);
  }

  if (!isPivotChart && isSunburstChart && formValues.hierarchy) {
    const hierarchyValue = formValues.hierarchy;
    const hierarchyColumns = Array.isArray(hierarchyValue)
      ? hierarchyValue
      : hierarchyValue
        ? [hierarchyValue]
        : [];
    (payload.params as Record<string, unknown>).dimensions = hierarchyColumns
      .map((col) => {
        const colName = extractColumnName(col);
        return colName ? { columns: colName } : null;
      })
      .filter(Boolean);
  }

  if (payload.params.dimensions && Array.isArray(payload.params.dimensions)) {
    const seen = new Set<string>();
    payload.params.dimensions = payload.params.dimensions.filter((d) => {
      const key = String(d.columns || "").toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  delete (payload.params as Record<string, unknown>).group_by;

  if (formValues.filters && !isPivotChart) {
    const filterValue = formValues.filters;
    const filterColumns = Array.isArray(filterValue) ? filterValue : filterValue ? [filterValue] : [];
    payload.params.filters = filterColumns
      .map((col, idx) => {
        const colName = extractColumnName(col);
        if (!colName) return null;
        const operator = getNestedValue(formValues, "filters", "operator", idx) || "=";
        const value = getNestedValue(formValues, "filters", "value", idx);
        return {
          columns: colName,
          operator,
          value,
        };
      })
      .filter((f) => f && f.columns && f.value);
  }

  if (formValues.limit != null && formValues.limit !== "") {
    payload.params.limit = Number(formValues.limit);
  } else {
    payload.params.limit = undefined;
  }

  if (isBarChart || isLineChart || isAreaChart) {
    // Metrics already attached above; no extra group_by fallback.
  }

  const chartTypeHint = chartType;
  attachCustomizationsToPayload(payload, customizationOptions, null, chartTypeHint);
  payload.params = stripChartFormAuxKeysFromParams(payload.params as Record<string, unknown>) as typeof payload.params;

  let nextPayload: CreateChartPayload = payload;

  const chartOrigin = resolveWizardChartOrigin(routeState, chartRecord);
  if (analyticsStudioInit && chartOrigin !== "analytical_dataset") {
    nextPayload = applyAnalyticsStudioChartPayload(
      nextPayload,
      analyticsStudioInit,
      selectedSource ?? null,
    ) as CreateChartPayload;
  }

  return finalizeWizardChartPayload(nextPayload, routeState, chartRecord);
}

export interface BuildWizardSaveChartPayloadInput extends BuildWizardChartPayloadInput {
  chartName: string;
  chartVisibility?: "personal" | "team" | "public";
  enableDrilldown?: boolean;
  drilldownColumns?: string[];
  routeState?: AnalyticsStudioCreateChartState;
  chartRecord?: AnalyticsStudioChartRecord | null;
}

export function buildWizardSaveChartPayload({
  chartName,
  chartVisibility = "personal",
  enableDrilldown,
  drilldownColumns = [],
  ...baseInput
}: BuildWizardSaveChartPayloadInput): CreateChartPayload | null {
  const payload = buildWizardChartPayload(baseInput);
  if (!payload) return null;

  payload.chart_name = chartName.trim();
  payload.visibility = chartVisibility;

  if (enableDrilldown && drilldownColumns.length > 0) {
    payload.params.drilldown_levels = drilldownColumns.map((column) => ({
      drill_filters: [],
      drill_columns: [{ column }],
    }));
  }

  return payload;
}
