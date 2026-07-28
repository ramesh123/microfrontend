import type {
  ColumnSemanticMapping,
  DatasetSemanticMappings,
} from "@/components/common/datasets/Steps/Step5ChartColumns/semanticMapping";
import { inferType } from "@/pages/charts/ChartFormulator/types";
import type { ChartFormParameter } from "@/pages/Visualization/API/chartsApi";
import type { AnalyticsStudioCreateChartState } from "../types";

export type SemanticBindingField = {
  name: string;
  type: "string" | "number" | "date";
};

export type SemanticBindingFieldGroups = {
  xAxis: SemanticBindingField[];
  dimensions: SemanticBindingField[];
  metrics: SemanticBindingField[];
};

function semanticTypeToFieldType(type: string): "string" | "number" | "date" {
  const normalized = type.trim().toLowerCase();
  if (["datetime", "date", "timestamp", "time"].includes(normalized)) return "date";
  if (["int", "float", "number", "decimal", "double"].includes(normalized)) return "number";
  return "string";
}

function columnToField(mapping: ColumnSemanticMapping): SemanticBindingField {
  const semanticType = semanticTypeToFieldType(mapping.type);
  return {
    name: mapping.column,
    type: semanticType !== "string" ? semanticType : inferType(mapping.column),
  };
}

function isXAxisSemanticMapping(mapping: ColumnSemanticMapping): boolean {
  return mapping.chartDefault === "x_axis";
}

function isSelectableDimensionMapping(mapping: ColumnSemanticMapping): boolean {
  return (
    mapping.role === "dimension" &&
    mapping.chartDefault !== "not_used" &&
    mapping.chartDefault !== "y_axis"
  );
}

function isMeasureSemanticMapping(mapping: ColumnSemanticMapping): boolean {
  return mapping.role === "measure" && mapping.chartDefault !== "not_used";
}

function resolveXAxisMapping(columns: ColumnSemanticMapping[]): ColumnSemanticMapping | undefined {
  const xAxisCandidates = columns.filter(isXAxisSemanticMapping);
  if (!xAxisCandidates.length) return undefined;

  return (
    xAxisCandidates.find((mapping) => mapping.role === "date_time" && mapping.primary) ??
    xAxisCandidates[0]
  );
}

function applyMetricAggregations(
  formValues: Record<string, unknown>,
  metricsKey: string,
  measureColumns: ColumnSemanticMapping[],
): void {
  const prefixes = ["metric", "metrics", "mtric", metricsKey];
  const seen = new Set<string>();

  measureColumns.forEach((mapping, index) => {
    const operation = mapping.aggregation || "sum";
    for (const prefix of prefixes) {
      if (!prefix || seen.has(prefix)) continue;
      seen.add(prefix);
      formValues[`${prefix}_${index}_operation`] = operation;
      formValues[`${prefix}_${index}_aggregation`] = operation;
      formValues[`${prefix}_${index}_agg`] = operation;
      if (index === 0) {
        formValues[`${prefix}_operation`] = operation;
        formValues[`${prefix}_aggregation`] = operation;
        formValues[`${prefix}_agg`] = operation;
      }
    }
  });
}

function toBindingValue(
  param: ChartFormParameter | undefined,
  field: SemanticBindingField,
): SemanticBindingField | SemanticBindingField[] {
  if (param?.type === "drag_and_drop_or_select_multiple") return [field];
  return field;
}

export function hasSemanticMappingsForBinding(
  routeState: Pick<AnalyticsStudioCreateChartState, "semanticMappings">,
): boolean {
  return (routeState.semanticMappings?.columns?.length ?? 0) > 0;
}

export function buildSemanticBindingFieldGroups(
  semanticMappings: DatasetSemanticMappings,
): SemanticBindingFieldGroups {
  const xAxis = semanticMappings.columns
    .filter(isXAxisSemanticMapping)
    .map(columnToField);

  const xAxisNames = new Set(xAxis.map((field) => field.name));

  const dimensions = semanticMappings.columns
    .filter(isSelectableDimensionMapping)
    .filter((mapping) => !xAxisNames.has(mapping.column))
    .map(columnToField);

  const metrics = semanticMappings.columns
    .filter(isMeasureSemanticMapping)
    .map(columnToField);

  return { xAxis, dimensions, metrics };
}

export function buildFieldsByParamKey(
  groups: SemanticBindingFieldGroups,
): Record<string, SemanticBindingField[]> {
  return {
    "x-axis": groups.xAxis,
    "X-axis": groups.xAxis,
    dimensions: groups.dimensions,
    metric: groups.metrics,
    metrics: groups.metrics,
    mtric: groups.metrics,
  };
}

/** Backward-compatible union of all selectable binding fields. */
export function buildFieldsFromSemanticMappings(
  semanticMappings: DatasetSemanticMappings,
): SemanticBindingField[] {
  const groups = buildSemanticBindingFieldGroups(semanticMappings);
  const seen = new Set<string>();
  const fields: SemanticBindingField[] = [];

  for (const field of [...groups.xAxis, ...groups.dimensions, ...groups.metrics]) {
    if (seen.has(field.name)) continue;
    seen.add(field.name);
    fields.push(field);
  }

  return fields;
}

export function buildFormValuesFromSemanticMappings(
  semanticMappings: DatasetSemanticMappings,
  chartFormData: { parameters?: ChartFormParameter[] },
): Record<string, unknown> {
  const columns = semanticMappings.columns;
  const parameters = chartFormData.parameters;
  if (!columns.length || !parameters?.length) return {};

  const formValues: Record<string, unknown> = {};

  const metricsParam = parameters.find(
    (param) => param.key === "metrics" || param.key === "metric" || param.key === "mtric",
  );
  const metricsKey = metricsParam?.key || "metrics";

  const xAxisParam = parameters.find(
    (param) => param.key === "x-axis" || param.key === "X-axis",
  );

  const dimensionsParam = parameters.find((param) => param.key === "dimensions");

  const xAxisMapping = resolveXAxisMapping(columns);
  if (xAxisMapping && xAxisParam) {
    formValues[xAxisParam.key] = columnToField(xAxisMapping);
  }

  const xAxisName = xAxisMapping?.column;
  const dimensionColumns = columns
    .filter(isSelectableDimensionMapping)
    .filter((column) => column.column !== xAxisName);
  if (dimensionColumns.length && dimensionsParam) {
    formValues.dimensions = toBindingValue(
      dimensionsParam,
      columnToField(dimensionColumns[0]),
    );
  }

  const measureColumns = columns.filter(isMeasureSemanticMapping);
  if (measureColumns.length && metricsParam) {
    const firstMeasure = measureColumns[0];
    formValues[metricsKey] = toBindingValue(metricsParam, columnToField(firstMeasure));
    applyMetricAggregations(formValues, metricsKey, [firstMeasure]);
  }

  return formValues;
}
