const CHART_SECTION_ORDER = [
  "charts",
  "comparison",
  "evolution",
  "part_of_a_whole",
  "distribution",
  "relationship",
  "ranking",
  "kpi",
  "kpi_gauges",
  "table",
  "tables",
  "ot_process",
  "timeseries",
  "geospatial",
] as const;

const CHART_SECTION_LABELS: Record<string, string> = {
  part_of_a_whole: "Composition Charts",
  evolution: "Trend Charts",
  kpi: "KPI Charts",
  kpi_gauges: "KPI & Gauge Charts",
  table: "Table Charts",
  tables: "Table Charts",
  charts: "Comparison Charts",
  comparison: "Comparison Charts",
  distribution: "Distribution Charts",
  relationship: "Relationship Charts",
  ranking: "Ranking Charts",
  geospatial: "Map Charts",
  ot_process: "Process Charts",
  timeseries: "Time Series Charts",
};

const CHART_SECTION_SHORT_LABELS: Record<string, string> = {
  part_of_a_whole: "Composition",
  evolution: "Trend",
  kpi: "KPI",
  kpi_gauges: "KPI & Gauge",
  table: "Table",
  tables: "Table",
  charts: "Comparison",
  comparison: "Comparison",
  distribution: "Distribution",
  relationship: "Relationship",
  ranking: "Ranking",
  geospatial: "Map",
  ot_process: "Process",
  timeseries: "Time Series",
};

function normalizeSectionKey(section: string) {
  return section.toLowerCase().trim().replace(/[\s-]+/g, "_");
}

function formatFallbackSectionLabel(section: string) {
  return section
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getChartSectionLabel(section: string) {
  const mapped = CHART_SECTION_LABELS[normalizeSectionKey(section)];
  if (mapped) return mapped;

  const formatted = formatFallbackSectionLabel(section);
  return /chart/i.test(formatted) ? formatted : `${formatted} Charts`;
}

export function getChartSectionShortLabel(section: string) {
  const mapped = CHART_SECTION_SHORT_LABELS[normalizeSectionKey(section)];
  if (mapped) return mapped;

  return formatFallbackSectionLabel(section);
}

export function sortChartSections<T extends { section: string }>(sections: T[]): T[] {
  return [...sections].sort((left, right) => {
    const leftIndex = CHART_SECTION_ORDER.indexOf(
      normalizeSectionKey(left.section) as (typeof CHART_SECTION_ORDER)[number],
    );
    const rightIndex = CHART_SECTION_ORDER.indexOf(
      normalizeSectionKey(right.section) as (typeof CHART_SECTION_ORDER)[number],
    );
    const safeLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
    const safeRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
    return safeLeft - safeRight;
  });
}
