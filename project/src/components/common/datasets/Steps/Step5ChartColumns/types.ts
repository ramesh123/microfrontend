export type DatasetChartColumns = {
  x_axis: string | null;
  dimensions: string[];
  metrics: string[];
  filters: string[];
};

export const EMPTY_CHART_COLUMNS: DatasetChartColumns = {
  x_axis: null,
  dimensions: [],
  metrics: [],
  filters: [],
};

const DIMENSION_TYPES = new Set(["str", "date", "datetime", "time", "timestamp", "bool"]);
const METRIC_TYPES = new Set(["int", "float"]);

export function normalizeChartColumns(value: unknown): DatasetChartColumns {
  if (!value || typeof value !== "object") return { ...EMPTY_CHART_COLUMNS };

  const record = value as Record<string, unknown>;
  const toStringArray = (input: unknown) =>
    Array.isArray(input) ? input.map((item) => String(item)).filter(Boolean) : [];

  const xAxis = record.x_axis;
  return {
    x_axis: typeof xAxis === "string" && xAxis.trim() ? xAxis.trim() : null,
    dimensions: toStringArray(record.dimensions),
    metrics: toStringArray(record.metrics),
    filters: toStringArray(record.filters),
  };
}

export function inferDefaultChartColumns(properties: Array<{ name: string; type?: string; isSelected?: boolean }>): DatasetChartColumns {
  const selected = properties.filter((property) => property.isSelected !== false && property.name);
  const dimensions = selected
    .filter((property) => DIMENSION_TYPES.has(property.type || "str"))
    .map((property) => property.name);
  const metrics = selected
    .filter((property) => METRIC_TYPES.has(property.type || ""))
    .map((property) => property.name);

  const dateColumn = selected.find((property) =>
    ["date", "datetime", "timestamp", "time"].includes(property.type || ""),
  );
  const xAxis = dateColumn?.name ?? dimensions[0] ?? null;

  return {
    x_axis: xAxis,
    dimensions: dimensions.filter((name) => name !== xAxis),
    metrics,
    filters: [],
  };
}
