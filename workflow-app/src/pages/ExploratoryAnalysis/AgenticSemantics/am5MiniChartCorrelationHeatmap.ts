import React from "react";
import type { ChartDetail } from "./chartTypes";
import { createShinePaletteFromBase } from "./am5MiniChartConstants";
import { shineLinearGradient } from "./am5MiniChartHelpers";

/** Default scale: Pearson r min (−1) → red, mid (0) → orange, max (+1) → pale yellow. */
export const CORRELATION_HEATMAP_DEFAULT_COLOR_SCALE = {
  min: -1,
  mid: 0,
  max: 1,
  minColor: "#d50000",
  midColor: "#ff8c42",
  maxColor: "#fff59d",
} as const;

function isCorrelationHeatmapChart(
  chartType: string | undefined,
  payloadChartType?: string,
): boolean {
  const a = String(chartType ?? "");
  const b = String(payloadChartType ?? "");
  return (
    a.includes("correlation_heatmap") || b.includes("correlation_heatmap")
  );
}

function numFb(v: unknown, fb: number): number {
  if (v == null || v === "") return fb;
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

function strFb(v: unknown, fb: string): string {
  return typeof v === "string" && v.trim() ? v : fb;
}

/**
 * Resolved `colorScale` for correlation heatmaps, or `undefined` if this chart is not a heatmap.
 */
export function mergeCorrelationHeatmapColorScale(
  chartType: string | undefined,
  payload: Record<string, unknown> | null | undefined,
): Record<string, unknown> | undefined {
  const pct =
    payload && typeof payload === "object" && typeof payload.chart_type === "string"
      ? payload.chart_type
      : undefined;
  if (!isCorrelationHeatmapChart(chartType, pct)) return undefined;

  const cs =
    payload && typeof payload === "object"
      ? ((payload.colorScale as Record<string, unknown> | undefined) ?? {})
      : {};
  const D = CORRELATION_HEATMAP_DEFAULT_COLOR_SCALE;
  /** Backend often sends legacy diverging colours; app defaults win unless explicitly opted in. */
  const useCustom =
    typeof cs.useCustomColors === "boolean" && cs.useCustomColors === true;

  return {
    min: numFb(cs.min, D.min),
    mid: numFb(cs.mid, D.mid),
    max: numFb(cs.max, D.max),
    minColor: useCustom ? strFb(cs.minColor, D.minColor) : D.minColor,
    midColor: useCustom ? strFb(cs.midColor, D.midColor) : D.midColor,
    maxColor: useCustom ? strFb(cs.maxColor, D.maxColor) : D.maxColor,
  };
}

/** Ensures dashboard / API chart payloads include the default `colorScale` for correlation heatmaps. */
export function applyCorrelationHeatmapDefaultsToPayload(
  chartType: string | undefined,
  payload: ChartDetail["chart_payload"] | undefined,
): ChartDetail["chart_payload"] | undefined {
  if (!payload) return payload;
  const merged = mergeCorrelationHeatmapColorScale(
    chartType,
    payload as Record<string, unknown>,
  );
  if (!merged) return payload;
  return { ...payload, colorScale: merged };
}

function fmtScaleValue(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2);
}

/** Compact Pearson-r scale bar under correlation heatmap charts (matches amCharts legend colours). */
export function CorrelationHeatmapScaleLegend({ detail }: { detail: ChartDetail }) {
  const merged = mergeCorrelationHeatmapColorScale(
    detail.chart_type,
    detail.chart_payload as Record<string, unknown> | undefined,
  );
  if (!merged) return null;

  const min = Number(merged.min);
  const mid = Number(merged.mid);
  const max = Number(merged.max);
  const minColor = String(merged.minColor);
  const midColor = String(merged.midColor);
  const maxColor = String(merged.maxColor);

  return React.createElement(
    "div",
    {
      className:
        "shrink-0 border-t border-border/40 bg-muted/15 px-2 py-1.5",
      role: "img",
      "aria-label": `Correlation scale from ${fmtScaleValue(min)} to ${fmtScaleValue(max)}`,
    },
    React.createElement(
      "p",
      {
        className:
          "text-[9px] font-medium uppercase tracking-wide text-muted-foreground mb-1",
      },
      "Pearson r",
    ),
    React.createElement("div", {
      className: "h-2 w-full rounded-sm border border-border/50 shadow-inner",
      style: {
        background: `linear-gradient(to right, ${minColor}, ${midColor}, ${maxColor})`,
      },
    }),
    React.createElement(
      "div",
      {
        className:
          "flex justify-between gap-1 text-[9px] tabular-nums text-muted-foreground mt-0.5",
      },
      React.createElement("span", null, fmtScaleValue(min)),
      React.createElement("span", null, fmtScaleValue(mid)),
      React.createElement("span", null, fmtScaleValue(max)),
    ),
  );
}

function cssHexToAm5(am5: typeof import("@amcharts/amcharts5"), s: unknown): any {
  if (typeof s !== "string") return am5.color(0x94a3b8);
  const t = s.trim();
  if (!t.startsWith("#")) return am5.color(0x94a3b8);
  const hex = t.slice(1);
  const n =
    hex.length === 6
      ? parseInt(hex, 16)
      : hex.length === 8
        ? parseInt(hex.slice(0, 6), 16)
        : NaN;
  return Number.isFinite(n) ? am5.color(n) : am5.color(0x94a3b8);
}

function numOrFallback(v: unknown, fb: number): number {
  if (v == null || v === "") return fb;
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

function rgbFromHex(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace(/^#/, "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Linear sRGB lerp between two `#rrggbb` colours — matches heat-legend interpolation. */
function lerpHex(a: string, b: string, t: number): string {
  const A = rgbFromHex(a);
  const B = rgbFromHex(b);
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[A.r + (B.r - A.r) * t, A.g + (B.g - A.g) * t, A.b + (B.b - A.b) * t]
    .map((c) => clamp(c).toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * Three-stop heat colour (min → mid → max): default red (−1) → orange (0) → yellow (+1).
 * Maps Pearson r with `midValue` at `midColor` (usually 0). N/A → `neutralHex`.
 */
function heatDivergingHex(
  r: number | null | undefined,
  legendMin: number,
  legendMax: number,
  minHex: string,
  midHex: string,
  maxHex: string,
  midValue: number,
  neutralHex: string,
): string {
  if (r == null || !Number.isFinite(r)) return neutralHex;
  if (legendMax <= legendMin) return midHex;
  const clamp = (t: number) => Math.max(0, Math.min(1, t));
  if (r <= midValue) {
    const span = midValue - legendMin;
    const t = span <= 0 ? 0 : (r - legendMin) / span;
    return lerpHex(minHex, midHex, clamp(t));
  }
  const span = legendMax - midValue;
  const t = span <= 0 ? 1 : (r - midValue) / span;
  return lerpHex(midHex, maxHex, clamp(t));
}

/**
 * Correlation dashboard: `correlation_heatmap` — ColumnSeries heatmap with
 * colours on Pearson r (red at −1 → orange at 0 → yellow at +1 by default), gloss fills,
 * `neutral` for N/A cells, and label bullets. Axes: `metric_a` (rows) × `metric_b` (columns).
 */
export async function renderAm5CorrelationHeatmap(
  root: any,
  am5: typeof import("@amcharts/amcharts5"),
  detail: ChartDetail,
  rawData: Record<string, unknown>[],
  isDark: boolean,
): Promise<void> {
  const am5xy = await import("@amcharts/amcharts5/xy");

  const payload = (detail.chart_payload ?? {}) as Record<string, unknown>;
  const metricsRaw = payload.metrics;
  const metricsList: string[] = Array.isArray(metricsRaw)
    ? metricsRaw.map((m) => String(m))
    : [
        ...new Set(
          rawData.flatMap((d) => [
            String(d.metric_a ?? ""),
            String(d.metric_b ?? ""),
          ]),
        ),
      ].filter(Boolean);

  const xField = "metric_b";
  const yField = "metric_a";

  const labelColor = isDark ? am5.color(0xcccccc) : am5.color(0x555555);

  const settings = (payload.settings ?? {}) as Record<string, unknown>;
  const panX = settings.panX !== false;
  const wheelX = String(settings.wheelX ?? "panX") === "panX" ? "panX" : "none";
  const wheelY =
    String(settings.wheelY ?? "zoomX") === "zoomX" ? "zoomX" : "none";

  const chart = root.container.children.push(
    am5xy.XYChart.new(root, {
      panX,
      panY: false,
      wheelX,
      wheelY,
      pinchZoomX: true,
      layout: root.verticalLayout,
      paddingTop: 4,
      paddingBottom: 7,
      paddingLeft: 8,
      paddingRight: 12,
    }),
  );

  const yRenderer = am5xy.AxisRendererY.new(root, {
    minGridDistance: 18,
    inversed: true,
    strokeOpacity: 0.12,
  });
  yRenderer.grid.template.setAll({ visible: false });
  yRenderer.labels.template.setAll({
    fontSize: 9,
    fontWeight: "700",
    fill: labelColor,
    maxWidth: 120,
    oversizedBehavior: "truncate",
  });

  const yAxis = chart.yAxes.push(
    am5xy.CategoryAxis.new(root, {
      maxDeviation: 0,
      categoryField: yField,
      renderer: yRenderer,
    }),
  );

  const xRenderer = am5xy.AxisRendererX.new(root, {
    minGridDistance: 24,
    opposite: true,
    strokeOpacity: 0.12,
  });
  xRenderer.grid.template.setAll({ visible: false });
  xRenderer.labels.template.setAll({
    fontSize: 9,
    fontWeight: "700",
    fill: labelColor,
    rotation: -45,
    maxWidth: 120,
    oversizedBehavior: "truncate",
  });

  const xAxis = chart.xAxes.push(
    am5xy.CategoryAxis.new(root, {
      maxDeviation: 0,
      categoryField: xField,
      renderer: xRenderer,
    }),
  );

  const seriesCfg = Array.isArray(payload.series)
    ? (payload.series[0] as Record<string, unknown> | undefined)
    : undefined;
  const strokeHex =
    typeof seriesCfg?.stroke === "string" ? seriesCfg.stroke : "#ffffff";
  const strokeW = numOrFallback(seriesCfg?.strokeWidth, 1);
  const labelFs = numOrFallback(seriesCfg?.labelFontSize, 10);

  const D = CORRELATION_HEATMAP_DEFAULT_COLOR_SCALE;
  const mergedScale = mergeCorrelationHeatmapColorScale(
    detail.chart_type,
    payload,
  );
  const colorScale = (mergedScale ?? {
    min: D.min,
    mid: D.mid,
    max: D.max,
    minColor: D.minColor,
    midColor: D.midColor,
    maxColor: D.maxColor,
  }) as Record<string, unknown>;
  const legendMin = numOrFallback(colorScale.min, D.min);
  const legendMax = numOrFallback(colorScale.max, D.max);
  const legendMidValue = numOrFallback(colorScale.mid, D.mid);

  const seriesData = rawData.map((row) => {
    const pr = row.pearson_r;
    const r =
      pr == null || pr === ""
        ? null
        : Number.isFinite(Number(pr))
          ? Number(pr)
          : null;
    return {
      ...row,
      /** Layout value for ColumnSeries (N/A → 0). */
      pearson_r: r ?? 0,
      /** Heat rule source: null ⇒ `neutral` fill (N/A). */
      pearson_r_heat: r,
      _corr_r: r,
    };
  });

  const series = chart.series.push(
    am5xy.ColumnSeries.new(root, {
      calculateAggregates: true,
      clustered: false,
      xAxis,
      yAxis,
      categoryXField: xField,
      categoryYField: yField,
      valueField: "pearson_r",
      stroke: cssHexToAm5(am5, strokeHex),
    }),
  );

  series.columns.template.setAll({
    tooltipText: `[fontSize:11px]{metric_a} × {metric_b}\n[bold]{label}[/]`,
    strokeOpacity: 1,
    strokeWidth: strokeW,
    width: am5.percent(100),
    height: am5.percent(100),
    /** Match single-bar columns: slightly soft fill so gloss reads clearly. */
    fillOpacity: 0.96,
  });

  const minColorStr = String(colorScale.minColor ?? D.minColor);
  const midColorStr = String(colorScale.midColor ?? D.midColor);
  const maxColorStr = String(colorScale.maxColor ?? D.maxColor);
  const neutralColorStr = "#94a3b8";
  const heatNeutral = cssHexToAm5(am5, neutralColorStr);

  series.columns.template.adapters.add("fill", (_fill: any, target: any) => {
    const ctx = target.dataItem?.dataContext as
      | { pearson_r_heat?: number | null }
      | undefined;
    const r = ctx?.pearson_r_heat;
    if (r == null || !Number.isFinite(r)) return heatNeutral;
    return cssHexToAm5(
      am5,
      heatDivergingHex(
        r,
        legendMin,
        legendMax,
        minColorStr,
        midColorStr,
        maxColorStr,
        legendMidValue,
        neutralColorStr,
      ),
    );
  });

  series.columns.template.adapters.add("fillGradient", (_g, target: any) => {
    const ctx = target.dataItem?.dataContext as
      | { _corr_r?: number | null }
      | undefined;
    const baseHex = heatDivergingHex(
      ctx?._corr_r,
      legendMin,
      legendMax,
      minColorStr,
      midColorStr,
      maxColorStr,
      legendMidValue,
      neutralColorStr,
    );
    /** Vertical shine (highlight → base → depth), same triple as grouped/single bars. */
    return shineLinearGradient(
      root,
      am5,
      createShinePaletteFromBase(baseHex),
      90,
    );
  });

  series.bullets.push(() => {
    const label = am5.Label.new(root, {
      populateText: true,
      text: "{label}",
      centerX: am5.p50,
      centerY: am5.p50,
      fontSize: labelFs,
      fontWeight: "600",
    });
    label.adapters.add("fill", (_fill: any, target: any) => {
      const ctx = target.dataItem?.dataContext as { _corr_r?: number | null } | undefined;
      if (ctx?._corr_r == null) return labelColor;
      return isDark ? am5.color(0xf8fafc) : am5.color(0x0f172a);
    });
    return am5.Bullet.new(root, { sprite: label });
  });

  /** Colour scale legend is rendered in the React shell (`CorrelationHeatmapScaleLegend` in this module). */

  yAxis.data.setAll(metricsList.map((m) => ({ metric_a: m })));
  xAxis.data.setAll(metricsList.map((m) => ({ metric_b: m })));
  series.data.setAll(seriesData as any);

  chart.set(
    "cursor",
    am5xy.XYCursor.new(root, {
      behavior: "zoomX",
      xAxis,
      yAxis,
    }),
  );

  const sbCfg = (payload.scrollbarX ?? {}) as { visible?: boolean };
  const showSb = sbCfg.visible !== false && metricsList.length > 5;
  if (showSb) {
    const scrollbar = am5.Scrollbar.new(root, {
      orientation: "horizontal",
      marginTop: 4,
      marginBottom: 4,
      minHeight: 8,
      start: 0,
      end: Math.min(1, 6 / Math.max(metricsList.length, 1)),
    });
    chart.set("scrollbarX", scrollbar);
    chart.bottomAxesContainer.children.push(scrollbar);
    scrollbar.thumb.setAll({
      fillOpacity: 0.25,
      fill: isDark ? am5.color(0x64748b) : am5.color(0x94a3b8),
    });
    xAxis.events.once("datavalidated", () => {
      xAxis.zoomToIndexes(0, Math.min(5, metricsList.length - 1));
    });
  }

  chart.appear(600, 80);
}
