import type { ChartDetail } from "./chartTypes";

/** Map API series_points { period, value } → Am5MiniChart line chart (date + value). */
export function seriesPointsToAnomalyLineDetail(
  points: Array<{ value?: number; period?: string }>,
  label: string,
  index: number,
): ChartDetail {
  const chart_data = points
    .filter(
      (p) =>
        p.period != null &&
        p.value != null &&
        Number.isFinite(Number(p.value)),
    )
    .map((p) => ({
      date: String(p.period),
      value: Number(p.value),
    }));
  return {
    chart_id: `anomaly-series-${index}`,
    chart_type: "line",
    metric_name: label,
    chart_data,
  };
}
