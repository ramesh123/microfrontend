import {
  fetchChart,
  type ChartStatusResponse,
  type DashboardChartSpec,
  coerceDashboardChartDataRows,
  coerceDashboardInsightNarrative,
} from "@/controllers/API/agenticApi";
import type { ChartDetail } from "./chartTypes";
import { applyCorrelationHeatmapDefaultsToPayload } from "./am5MiniChartCorrelationHeatmap";

/**
 * Single path for dashboard / agent `chart_details[]` → {@link ChartDetail} (Insights, chat history, onboarding).
 */
export function dashboardChartSpecToChartDetail(spec: DashboardChartSpec): ChartDetail {
  const ni = coerceDashboardInsightNarrative(spec);
  const specRec = spec as Record<string, unknown>;
  const rawConvIds = specRec.conversation_ids;
  const conversation_ids = Array.isArray(rawConvIds)
    ? rawConvIds.filter((x): x is string => typeof x === "string" && x.trim() !== "")
    : undefined;
  const chartType = spec.chart_type ?? spec.type ?? "line";
  const chart_payload = applyCorrelationHeatmapDefaultsToPayload(
    chartType,
    spec.chart_payload as ChartDetail["chart_payload"],
  ) ?? (spec.chart_payload as ChartDetail["chart_payload"]);
  return {
    chart_id: spec.chart_id ?? "",
    chart_type: chartType,
    metric_name: spec.metric_name ?? spec.chart_title ?? spec.title ?? spec.metric ?? "Metric",
    title: spec.title ?? spec.chart_title ?? spec.metric_name,
    category_column: (spec as Record<string, unknown>).category_column as string | null | undefined,
    chart_data: coerceDashboardChartDataRows(spec),
    sql: spec.sql,
    intent: spec.intent,
    table: spec.table,
    narrative: spec.narrative ? { summary: spec.narrative.summary } : undefined,
    insight_text: ni.insight_text,
    narrative_text: ni.narrative_text,
    ...(conversation_ids && conversation_ids.length > 0 ? { conversation_ids } : {}),
    chart_payload,
    stats:
      spec.stats &&
      typeof spec.stats.count === "number" &&
      typeof spec.stats.total === "number"
        ? {
            count: spec.stats.count,
            total: spec.stats.total,
            avg: spec.stats.avg ?? 0,
            min: spec.stats.min ?? 0,
            max: spec.stats.max ?? 0,
          }
        : undefined,
  };
}

/** Prefer tabular rows when API sends `rows_json` (often richer than `data` for the same chart). */
function chartRowsFromStatusResponse(res: ChartStatusResponse): Record<string, unknown>[] {
  const payload = (res.chart_payload ?? {}) as Record<string, unknown>;
  const fromPayload = payload.data;
  if (Array.isArray(res.rows_json) && res.rows_json.length > 0) {
    return res.rows_json as Record<string, unknown>[];
  }
  if (Array.isArray(fromPayload) && fromPayload.length > 0) {
    return fromPayload as Record<string, unknown>[];
  }
  if (Array.isArray(res.data) && res.data.length > 0) {
    return res.data as Record<string, unknown>[];
  }
  return [];
}

/**
 * Bar/XY charts expect a category axis field; `rows_json` often uses the grain column (`region`, …)
 * while `chart_payload` may still say `category`. {@link am5MiniChartXySetup} uses `detail.category_column`
 * when it matches a row key.
 */
function inferCategoryColumnFromStatus(
  rows: Record<string, unknown>[],
  res: ChartStatusResponse,
): string | undefined {
  if (rows.length === 0) return undefined;
  const r0 = rows[0];
  const keys = Object.keys(r0);
  const ic = res.interaction_context;
  const cur = typeof ic?.current_level === "string" ? ic.current_level.trim() : "";
  if (cur && keys.includes(cur)) return cur;
  const gd0 = ic?.group_dimensions?.[0];
  const gd = typeof gd0 === "string" ? gd0.trim() : "";
  if (gd && keys.includes(gd)) return gd;
  const strKey = keys.find((k) => {
    const v = r0[k];
    return typeof v === "string" && v.trim() !== "";
  });
  return strKey;
}

/** Map GET /charts/{id} body into {@link ChartDetail} for {@link Am5MiniChart}. */
export function chartStatusResponseToChartDetail(res: ChartStatusResponse): ChartDetail {
  const payload = (res.chart_payload ?? {}) as Record<string, unknown>;
  const rows = chartRowsFromStatusResponse(res);

  const payloadTitle = typeof payload.title === "string" ? payload.title : undefined;
  const payloadSubtitle = typeof payload.subtitle === "string" ? payload.subtitle : undefined;
  const payloadMetric = typeof payload.metric_name === "string" ? payload.metric_name : undefined;
  const payloadChartType = typeof payload.chart_type === "string" ? payload.chart_type : undefined;

  const chartType =
    (res.chart_type && String(res.chart_type)) ||
    payloadChartType ||
    "line";

  const title = payloadTitle ?? payloadMetric ?? res.chart_id;
  const metricName = payloadMetric ?? payloadTitle ?? res.chart_id;

  const basePayload =
    payload && typeof payload === "object"
      ? { ...(payload as Record<string, unknown>) }
      : {};

  const mergedPayload = {
    ...basePayload,
    data: rows as Array<Record<string, unknown>>,
    chart_type: chartType,
  };

  const fromRes = res.conversation_ids;
  const convIdsFromPayload = payload.conversation_ids;
  const mergedConv =
    Array.isArray(fromRes) && fromRes.length > 0
      ? fromRes.filter((x): x is string => typeof x === "string" && x.trim() !== "")
      : Array.isArray(convIdsFromPayload)
        ? convIdsFromPayload.filter((x): x is string => typeof x === "string" && x.trim() !== "")
        : undefined;

  const statsFromJson = res.stats_json;
  const stats =
    statsFromJson &&
    typeof statsFromJson.count === "number" &&
    typeof statsFromJson.total === "number"
      ? {
          count: statsFromJson.count,
          total: statsFromJson.total,
          avg: statsFromJson.avg ?? 0,
          min: statsFromJson.min ?? 0,
          max: statsFromJson.max ?? 0,
        }
      : undefined;

  const payloadCatRaw = (payload as { category_column?: unknown }).category_column;
  const payloadCat =
    typeof payloadCatRaw === "string" && payloadCatRaw.trim() !== "" ? payloadCatRaw.trim() : "";
  const inferredCat = inferCategoryColumnFromStatus(rows, res);
  const categoryColumn =
    payloadCat && rows.length > 0 && Object.keys(rows[0]).includes(payloadCat)
      ? payloadCat
      : inferredCat;

  return {
    chart_id: res.chart_id,
    chart_type: chartType,
    metric_name: metricName,
    title,
    subtitle: payloadSubtitle,
    ...(categoryColumn ? { category_column: categoryColumn } : {}),
    chart_data: rows as Array<Record<string, unknown>>,
    chart_payload:
      applyCorrelationHeatmapDefaultsToPayload(
        chartType,
        mergedPayload as ChartDetail["chart_payload"],
      ) ?? (mergedPayload as ChartDetail["chart_payload"]),
    sql: res.sql ?? undefined,
    intent: "dashboard",
    ...(mergedConv && mergedConv.length > 0 ? { conversation_ids: mergedConv } : {}),
    ...(res.insight_text?.trim() ? { insight_text: res.insight_text.trim() } : {}),
    ...(res.narrative_text?.trim() ? { narrative_text: res.narrative_text.trim() } : {}),
    ...(stats ? { stats } : {}),
  };
}

export function isTerminalChartStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return (
    s === "ready" ||
    s === "complete" ||
    s === "completed" ||
    s === "failed" ||
    s === "error"
  );
}

/**
 * Poll GET /charts/{chart_id} until status is terminal or attempts exhausted.
 */
export async function fetchChartUntilReady(
  chartId: string,
  opts?: { maxAttempts?: number; intervalMs?: number },
): Promise<ChartStatusResponse> {
  const maxAttempts = opts?.maxAttempts ?? 50;
  const intervalMs = opts?.intervalMs ?? 400;

  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetchChart(chartId);
    if (isTerminalChartStatus(res.status)) {
      return res;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return fetchChart(chartId);
}
