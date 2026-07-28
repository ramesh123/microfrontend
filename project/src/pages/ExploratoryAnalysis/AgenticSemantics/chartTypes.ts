export interface ChartDetail {
  chart_id: string;
  chart_type: string;
  metric_name: string;
  chart_data: Array<Record<string, unknown>>;
  /** Correlation forecast charts; also used when payload comes from GET /api/v2/charts/:id */
  subtitle?: string;
  chart_payload?: {
    data?: Array<Record<string, unknown>>;
    title?: string;
    subtitle?: string;
    chart_type?: string;
    /** Correlation heatmap: axis order and color scale */
    metrics?: string[];
    /** Pearson r scale (numeric bounds merged); colours from app defaults unless `useCustomColors` */
    colorScale?: {
      min?: number;
      mid?: number;
      max?: number;
      /** When true, `minColor` / `midColor` / `maxColor` from payload are used; otherwise app defaults apply. */
      useCustomColors?: boolean;
      minColor?: string;
      midColor?: string;
      maxColor?: string;
    };
    settings?: Record<string, unknown>;
    scrollbarX?: Record<string, unknown>;
    series?: unknown;
    /** Data-quality / dashboard plan: explicit table columns (`evidence: true` → View Evidence + GET path in cell). */
    display_columns?: Array<{ field: string; label?: string; evidence?: boolean }>;
    /** Fields in `table_heatmap` to colour by value (defaults applied in UI if omitted). */
    heatmap_value_fields?: string[];
    /** Data-quality plan entry key (e.g. `data_trust_scorecard`). */
    chart_key?: string;
    /** Optional aggregate block from chart plan (e.g. trust scorecard summaries). */
    summary?: Record<string, unknown>;
    /** Data-quality plan source id (e.g. `algofusion_data_quality_rule_results`). */
    data_source?: string;
    [key: string]: unknown;
  };
  sql?: string;
  intent?: string;
  table?: string;
  title?: string;
  category_column?: string | null;
  stats?: {
    count: number;
    total: number;
    avg: number;
    min: number;
    max: number;
  };
  narrative?: { summary?: string };
  /** Short analytic takeaway (Insight tab) */
  insight_text?: string;
  /** Longer narrative summary (Insight tab) */
  narrative_text?: string;
  /** Workspace conversation ids tied to this chart (e.g. dashboard SQL insight); load via History in chart chat. */
  conversation_ids?: string[];
}

export type DashboardCardTab = "chart" | "table" | "query" | "info";

/** Data-quality dashboard charts (`intent` from chart plan) — tighter card / chart max heights in the UI. */
export function isDataQualityChartDetail(detail: Pick<ChartDetail, "intent">): boolean {
  return String(detail.intent ?? "").toLowerCase() === "data_quality";
}
