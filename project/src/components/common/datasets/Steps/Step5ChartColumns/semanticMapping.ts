import {
  type DatasetChartColumns,
  EMPTY_CHART_COLUMNS,
  normalizeChartColumns,
} from "./types";

export type SemanticRole = "date_time" | "dimension" | "measure" | "identifier";
export type DateGrain = "day" | "week" | "month" | "quarter" | "year";
export type Cardinality = "low" | "medium" | "high";
export type Aggregation = "sum" | "avg" | "count" | "min" | "max" | "count_distinct";
export type ChartDefault =
  | "x_axis"
  | "y_axis"
  | "color_series"
  | "group_by"
  | "filter_only"
  | "not_used";

export type ColumnSemanticMapping = {
  column: string;
  displayName: string;
  type: string;
  role: SemanticRole;
  grain?: DateGrain;
  primary?: boolean;
  cardinality?: Cardinality;
  aggregation?: Aggregation;
  chartDefault: ChartDefault;
};

export type DatasetSemanticMappings = {
  columns: ColumnSemanticMapping[];
};

type PropertyInput = {
  name: string;
  display_name?: string;
  type?: string;
  isSelected?: boolean;
};

const DATE_TYPES = new Set(["date", "datetime", "timestamp", "time"]);
const METRIC_TYPES = new Set(["int", "float"]);

const ROLE_OPTIONS: Array<{ value: SemanticRole; label: string }> = [
  { value: "date_time", label: "Date / time" },
  { value: "dimension", label: "Dimension" },
  { value: "measure", label: "Measure" },
  { value: "identifier", label: "Identifier" },
];

const CHART_DEFAULT_OPTIONS: Array<{ value: ChartDefault; label: string }> = [
  { value: "x_axis", label: "X-axis" },
  { value: "y_axis", label: "Y-axis" },
  { value: "color_series", label: "Color / series" },
  { value: "group_by", label: "Group by" },
  { value: "filter_only", label: "Filter only" },
  { value: "not_used", label: "Not used" },
];

const GRAIN_OPTIONS: Array<{ value: DateGrain; label: string }> = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
];

const AGGREGATION_OPTIONS: Array<{ value: Aggregation; label: string }> = [
  { value: "sum", label: "Sum" },
  { value: "avg", label: "Average" },
  { value: "count", label: "Count" },
  { value: "min", label: "Min" },
  { value: "max", label: "Max" },
  { value: "count_distinct", label: "Count distinct" },
];

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function isIdentifierName(name: string) {
  const normalized = normalizeName(name);
  return (
    normalized.endsWith("_id") ||
    normalized.endsWith("_cd") ||
    normalized === "id" ||
    normalized.includes("material_cd") ||
    normalized.includes("ps_dt_id")
  );
}

function isDateName(name: string) {
  const normalized = normalizeName(name);
  return (
    DATE_TYPES.has(normalized) ||
    normalized.includes("date") ||
    normalized.includes("time") ||
    normalized.includes("_dt") ||
    normalized.includes("_month") ||
    normalized.includes("_year")
  );
}

function isMeasureName(name: string, type: string) {
  if (METRIC_TYPES.has(type)) return true;
  const normalized = normalizeName(name);
  return /(weight|amount|qty|quantity|price|value|total|count|rate|score|net_|gross_)/.test(
    normalized,
  );
}

function inferCardinality(name: string): Cardinality {
  const normalized = normalizeName(name);
  if (/(category|segment|company|brand|type|status|region)/.test(normalized)) return "low";
  if (/(name|org_|material|product|customer|vendor)/.test(normalized)) return "medium";
  return "high";
}

function inferRole(name: string, type: string): SemanticRole {
  if (isIdentifierName(name)) return "identifier";
  if (DATE_TYPES.has(type) || isDateName(name)) return "date_time";
  if (isMeasureName(name, type)) return "measure";
  return "dimension";
}

function inferChartDefault(role: SemanticRole, name: string, cardinality: Cardinality, isPrimaryDate: boolean): ChartDefault {
  if (role === "identifier") return "not_used";
  if (role === "measure") return "y_axis";
  if (role === "date_time") return isPrimaryDate ? "x_axis" : "group_by";
  if (cardinality === "low") return "group_by";
  if (cardinality === "medium") return "color_series";
  return "filter_only";
}

function inferGrain(type: string, name: string): DateGrain {
  const normalized = normalizeName(name);
  if (normalized.includes("year")) return "year";
  if (normalized.includes("quarter")) return "quarter";
  if (normalized.includes("month") || normalized.includes("_mo")) return "month";
  if (normalized.includes("week")) return "week";
  if (type === "date") return "day";
  return "month";
}

function inferAggregation(type: string): Aggregation {
  return type === "int" || type === "float" ? "sum" : "count";
}

export function inferSemanticMappings(properties: PropertyInput[]): ColumnSemanticMapping[] {
  const selected = properties.filter((property) => property.isSelected !== false && property.name);
  const dateColumns = selected.filter((property) => inferRole(property.name, property.type || "str") === "date_time");
  const primaryDateColumn = dateColumns[0]?.name;

  return selected.map((property) => {
    const type = property.type || "str";
    const role = inferRole(property.name, type);
    const cardinality = role === "dimension" ? inferCardinality(property.name) : undefined;
    const isPrimaryDate = role === "date_time" && property.name === primaryDateColumn;

    return {
      column: property.name,
      displayName: property.display_name || property.name,
      type,
      role,
      grain: role === "date_time" ? inferGrain(type, property.name) : undefined,
      primary: role === "date_time" ? isPrimaryDate : undefined,
      cardinality,
      aggregation: role === "measure" ? inferAggregation(type) : undefined,
      chartDefault: inferChartDefault(role, property.name, cardinality || "medium", isPrimaryDate),
    };
  });
}

export function semanticMappingsFromChartColumns(
  chartColumns: DatasetChartColumns,
  properties: PropertyInput[],
): ColumnSemanticMapping[] {
  const base = inferSemanticMappings(properties);
  const normalized = normalizeChartColumns(chartColumns);

  return base.map((mapping) => {
    let chartDefault = mapping.chartDefault;

    if (normalized.x_axis === mapping.column) chartDefault = "x_axis";
    else if (normalized.metrics.includes(mapping.column)) chartDefault = "y_axis";
    else if (normalized.filters.includes(mapping.column)) chartDefault = "filter_only";
    else if (normalized.dimensions.includes(mapping.column)) {
      if (chartDefault === "not_used") chartDefault = "group_by";
    }

    return {
      ...mapping,
      chartDefault,
      primary: normalized.x_axis === mapping.column ? true : mapping.primary,
    };
  });
}

export function normalizeSemanticMappings(value: unknown, properties: PropertyInput[]): ColumnSemanticMapping[] {
  if (!value || typeof value !== "object") return inferSemanticMappings(properties);

  const record = value as Record<string, unknown>;
  const columns = Array.isArray(record.columns) ? record.columns : Array.isArray(value) ? value : [];

  if (!columns.length) return inferSemanticMappings(properties);

  const propertyByName = new Map(
    properties
      .filter((property) => property.isSelected !== false && property.name)
      .map((property) => [property.name, property]),
  );

  return columns
    .map((entry): ColumnSemanticMapping | null => {
      if (!entry || typeof entry !== "object") return null;
      const item = entry as Record<string, unknown>;
      const column = String(item.column ?? item.name ?? "").trim();
      if (!column) return null;

      const property = propertyByName.get(column);
      const role = (item.role as SemanticRole) || inferRole(column, String(property?.type || item.type || "str"));
      const type = String(property?.type || item.type || "str");

      const mapping: ColumnSemanticMapping = {
        column,
        displayName: String(property?.display_name || item.displayName || column),
        type,
        role,
        chartDefault: (item.chartDefault as ChartDefault) || "not_used",
      };

      if (item.grain) mapping.grain = item.grain as DateGrain;
      if (item.primary !== undefined) mapping.primary = Boolean(item.primary);
      if (item.cardinality) mapping.cardinality = item.cardinality as Cardinality;
      if (item.aggregation) mapping.aggregation = item.aggregation as Aggregation;

      return mapping;
    })
    .filter((item): item is ColumnSemanticMapping => item !== null);
}

export function semanticMappingsToChartColumns(mappings: ColumnSemanticMapping[]): DatasetChartColumns {
  if (!mappings.length) return { ...EMPTY_CHART_COLUMNS };

  const xAxis =
    mappings.find((mapping) => mapping.chartDefault === "x_axis")?.column ??
    mappings.find((mapping) => mapping.role === "date_time" && mapping.primary)?.column ??
    mappings.find((mapping) => mapping.role === "date_time")?.column ??
    null;

  const dimensions = mappings
    .filter(
      (mapping) =>
        mapping.chartDefault !== "not_used" &&
        mapping.chartDefault !== "y_axis" &&
        (mapping.role === "dimension" ||
          mapping.role === "date_time" ||
          ["group_by", "color_series", "filter_only", "x_axis"].includes(mapping.chartDefault)),
    )
    .map((mapping) => mapping.column)
    .filter((column) => column !== xAxis);

  const metrics = mappings
    .filter((mapping) => mapping.role === "measure" && mapping.chartDefault !== "not_used")
    .map((mapping) => mapping.column);

  const filters = mappings
    .filter((mapping) => mapping.chartDefault === "filter_only")
    .map((mapping) => mapping.column);

  return {
    x_axis: xAxis,
    dimensions: [...new Set(dimensions)],
    metrics: [...new Set(metrics)],
    filters: [...new Set(filters)],
  };
}

export function hasSemanticMappingData(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const columns = Array.isArray(record.columns) ? record.columns : Array.isArray(value) ? value : [];
  return columns.length > 0;
}

export {
  ROLE_OPTIONS,
  CHART_DEFAULT_OPTIONS,
  GRAIN_OPTIONS,
  AGGREGATION_OPTIONS,
};
