import type { ChartFormParameter } from "@/pages/Visualization/API/chartsApi";
import { extractColumnName } from "@/pages/charts/ChartFormulator/utils";

export function ensurePivotApplyParam(formData: { parameters?: ChartFormParameter[]; name?: string; unique_id?: string } | null, visualizationName?: string) {
  if (!formData?.parameters) return formData;
  const viz = (visualizationName || formData.name || formData.unique_id || "").toString().toLowerCase();
  if (!viz.includes("pivot")) return formData;
  const has = formData.parameters.some((p) => (p.key || "").toLowerCase() === "apply_metrics_on");
  if (has) return formData;
  return {
    ...formData,
    parameters: [
      ...formData.parameters,
      {
        name: "apply_metrics_on",
        label: "Apply metrics on",
        type: "select",
        placeholder: "",
        key: "apply_metrics_on",
        api: "",
        params: {},
        display_value: "",
        callback: false,
        validators: { required: false },
        options: ["columns", "rows"],
      } as ChartFormParameter,
    ],
  };
}

export function inferFieldType(columnName: string): "string" | "number" | "date" {
  const name = columnName.toLowerCase();
  const datePatterns = ["date", "time", "timestamp", "created", "updated", "modified"];
  const numberPatterns = ["count", "sum", "total", "amount", "price", "value", "qty", "number", "id", "score", "rate"];
  if (datePatterns.some((pattern) => name.includes(pattern))) return "date";
  if (numberPatterns.some((pattern) => name.includes(pattern))) return "number";
  return "string";
}

function hasFilledValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined && value !== "";
}

export function validateChartFormBinding(
  formValues: Record<string, unknown>,
  chartFormData: { parameters?: ChartFormParameter[] } | null | undefined,
  chartUniqueId?: string,
): boolean {
  const formParams = chartFormData?.parameters || [];
  const chartType = (chartUniqueId || "").toLowerCase();
  const isPivotChart = chartType.includes("pivot") || chartUniqueId === "pivot_table";

  if (isPivotChart) {
    if (!hasFilledValue(formValues.rows) || !hasFilledValue(formValues.columns)) {
      return false;
    }
  } else if (formParams.some((p) => p.key === "dimensions" || p.key === "x-axis")) {
    const hasDimensions = hasFilledValue(formValues.dimensions);
    const hasXAxis = hasFilledValue(formValues["x-axis"]);
    if (!hasDimensions && !hasXAxis) return false;
  }

  const hasMetric =
    hasFilledValue(formValues.metric) ||
    hasFilledValue(formValues.metrics) ||
    hasFilledValue(formValues.mtric);

  if (formParams.some((p) => ["metric", "metrics", "mtric"].includes(p.key)) && !hasMetric) {
    return false;
  }

  return true;
}

export function suggestChartBindings(
  fields: Array<{ name: string; type: string }>,
  chartFormData: { parameters?: ChartFormParameter[] } | null | undefined,
): Record<string, { name: string; type: string } | Array<{ name: string; type: string }>> {
  const params = chartFormData?.parameters ?? [];
  const suggestions: Record<string, { name: string; type: string } | Array<{ name: string; type: string }>> = {};

  const skipPatterns = ["password", "hash", "token", "secret", "salt"];
  const dimensionCandidates = fields.filter(
    (field) =>
      field.type !== "number" &&
      !skipPatterns.some((pattern) => field.name.toLowerCase().includes(pattern)),
  );
  const metricCandidates = fields.filter((field) => field.type === "number");

  const dimensionParam = params.find(
    (param) => param.key === "dimensions" || param.key === "x-axis" || param.key === "X-axis",
  );
  const metricParam = params.find((param) =>
    ["metric", "metrics", "mtric"].includes(param.key),
  );

  if (dimensionParam) {
    const pick = dimensionCandidates[0] ?? fields[0];
    if (pick) {
      const field = { name: pick.name, type: pick.type };
      suggestions[dimensionParam.key] =
        dimensionParam.type === "drag_and_drop_or_select_multiple" ? [field] : field;
    }
  }

  if (metricParam) {
    const pick = metricCandidates[0] ?? fields.find((field) => field.type === "number");
    if (pick) {
      suggestions[metricParam.key] = { name: pick.name, type: pick.type };
    }
  }

  return suggestions;
}

export function getBindingSummary(formValues: Record<string, unknown>): {
  dimensions: string[];
  metrics: string[];
} {
  const dimensions: string[] = [];
  const metrics: string[] = [];

  const pushNames = (target: string[], value: unknown) => {
    if (!value) return;
    const items = Array.isArray(value) ? value : [value];
    items.forEach((item) => {
      const name = extractColumnName(item);
      if (name) target.push(name);
    });
  };

  pushNames(dimensions, formValues.dimensions);
  pushNames(dimensions, formValues["x-axis"]);
  pushNames(dimensions, formValues.rows);
  pushNames(dimensions, formValues.columns);
  pushNames(metrics, formValues.metric);
  pushNames(metrics, formValues.metrics);
  pushNames(metrics, formValues.mtric);

  return {
    dimensions: [...new Set(dimensions)],
    metrics: [...new Set(metrics)],
  };
}
