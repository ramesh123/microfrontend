import type { ChartDetail } from "./chartTypes";
import { GROUPED_BAR_BASE_COLORS, niceYAxisMax } from "./am5MiniChartConstants";
import {
  NEAT_AXIS_STROKE_OPACITY,
  NEAT_CHART_PAD_BAR,
  NEAT_FS,
  NEAT_FW,
  NEAT_GRID_OPACITY,
  neatMiniChartColors,
} from "./am5MiniChartNeatTheme";
import {
  BAR_X_AXIS_END_LOCATION,
  BAR_X_AXIS_START_LOCATION,
  attachCompactValueAxisRendererLabels,
  attachTooltipLabelAdapter,
  createSeriesLinkedTooltipWithText,
  formatCategoryLabelIfIsoDate,
  formatCompactAxisValue,
  getCategoryCellLocations,
  truncateCategoryAxisLabel,
} from "./am5MiniChartHelpers";

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function cssHexToAm5(am5: typeof import("@amcharts/amcharts5"), s: unknown): any {
  if (typeof s !== "string") return am5.color(0x3b82f6);
  const t = s.trim();
  if (!t.startsWith("#")) return am5.color(0x3b82f6);
  const hex = t.slice(1);
  const n =
    hex.length === 6
      ? parseInt(hex, 16)
      : hex.length === 8
        ? parseInt(hex.slice(0, 6), 16)
        : NaN;
  return Number.isFinite(n) ? am5.color(n) : am5.color(0x3b82f6);
}

function findSeriesCfg(
  payload: Record<string, unknown>,
  id: string,
): Record<string, unknown> | undefined {
  const list = Array.isArray(payload.series)
    ? (payload.series as Array<Record<string, unknown>>)
    : [];
  return list.find((s) => String(s?.id ?? "") === id);
}

/**
 * Anomaly density histogram: pre-binned rows (`lo`/`hi`, `range`, `count`).
 * Single ColumnSeries; bar colours cycle `GROUPED_BAR_BASE_COLORS` by bin index (no legend).
 */
export async function renderAm5AnomalyDensityChart(
  root: any,
  am5: typeof import("@amcharts/amcharts5"),
  detail: ChartDetail,
  rows: Record<string, unknown>[],
  isDark: boolean,
): Promise<void> {
  const am5xy = await import("@amcharts/amcharts5/xy");

  const payload = (detail.chart_payload ?? {}) as Record<string, unknown>;

  if (rows.length === 0) {
    root.dispose();
    return;
  }

  const settings = (payload.settings ?? {}) as Record<string, unknown>;
  const panX = settings.panX !== false;
  const wheelX = String(settings.wheelX ?? "panX") === "panX" ? "panX" : "none";
  const wheelY =
    String(settings.wheelY ?? "zoomX") === "zoomX" ? "zoomX" : "none";

  const xPayload = payload.xAxis as
    | { label?: string; categoryField?: string; type?: string }
    | undefined;
  const yPayload = payload.yAxis as { min?: number; max?: number; label?: string } | undefined;

  const seriesCfg =
    findSeriesCfg(payload, "density") ??
    (Array.isArray(payload.series) && payload.series.length > 0
      ? (payload.series as Array<Record<string, unknown>>)[0]
      : undefined) ??
    {};

  const catKey =
    (typeof xPayload?.categoryField === "string" && xPayload.categoryField) ||
    (typeof seriesCfg.valueXField === "string" && seriesCfg.valueXField) ||
    "range";
  const valueYField =
    typeof seriesCfg.valueYField === "string" ? seriesCfg.valueYField : "count";
  const seriesName =
    typeof seriesCfg.name === "string" ? seriesCfg.name : "Anomaly count";
  const fillOpacity = numOrNull(seriesCfg.fillOpacity) ?? 1;
  const strokeOpacity = numOrNull(seriesCfg.strokeOpacity) ?? 0;
  const cornerTL = numOrNull(seriesCfg.cornerRadiusTL) ?? 4;
  const cornerTR = numOrNull(seriesCfg.cornerRadiusTR) ?? 4;
  const tooltipText =
    typeof seriesCfg.tooltipText === "string"
      ? seriesCfg.tooltipText
      : "{range}: {count} anomalies\nDominant class: {dominant_class}";

  const yMin = numOrNull(yPayload?.min) ?? 0;
  const yMaxPayload = numOrNull(yPayload?.max);
  const yLabel =
    (typeof yPayload?.label === "string" && yPayload.label.trim()) || "Count";
  const xLabel =
    (typeof xPayload?.label === "string" && xPayload.label.trim()) ||
    "Score range";

  const counts = rows
    .map((r) => numOrNull(r[valueYField]))
    .filter((v): v is number => v != null);
  const maxCount = counts.length ? Math.max(...counts) : 0;
  const yMax = yMaxPayload ?? niceYAxisMax(Math.max(1, maxCount));

  const neat = neatMiniChartColors(am5, isDark);

  const chart = root.container.children.push(
    am5xy.XYChart.new(root, {
      panX,
      panY: false,
      wheelX,
      wheelY,
      pinchZoomX: true,
      layout: root.verticalLayout,
      paddingTop: NEAT_CHART_PAD_BAR.top,
      paddingBottom: NEAT_CHART_PAD_BAR.bottom,
      paddingLeft: NEAT_CHART_PAD_BAR.side,
      paddingRight: NEAT_CHART_PAD_BAR.side,
    }),
  );

  const xRenderer = am5xy.AxisRendererX.new(root, {
    minGridDistance: 28,
    strokeOpacity: NEAT_AXIS_STROKE_OPACITY,
    ...getCategoryCellLocations(true),
  });
  xRenderer.labels.template.setAll({
    fontSize: NEAT_FS.axis,
    fontWeight: NEAT_FW.axis,
    fill: neat.label,
    maxWidth: 120,
    oversizedBehavior: "truncate",
    paddingTop: 4,
    paddingBottom: 2,
  });
  xRenderer.grid.template.setAll({
    stroke: neat.grid,
    strokeOpacity: NEAT_GRID_OPACITY,
  });

  const yRenderer = am5xy.AxisRendererY.new(root, {
    strokeOpacity: NEAT_AXIS_STROKE_OPACITY,
  });
  yRenderer.labels.template.setAll({
    fontSize: NEAT_FS.axis,
    fontWeight: NEAT_FW.axis,
    fill: neat.label,
  });
  yRenderer.grid.template.setAll({
    stroke: neat.grid,
    strokeOpacity: NEAT_GRID_OPACITY,
  });
  attachCompactValueAxisRendererLabels(yRenderer);

  const xAxis = chart.xAxes.push(
    am5xy.CategoryAxis.new(root, {
      categoryField: catKey,
      renderer: xRenderer,
      tooltip: am5.Tooltip.new(root, {}),
    }),
  );

  xAxis.set("startLocation", BAR_X_AXIS_START_LOCATION);
  xAxis.set("endLocation", BAR_X_AXIS_END_LOCATION);

  const yAxis = chart.yAxes.push(
    am5xy.ValueAxis.new(root, {
      renderer: yRenderer,
      min: yMin,
      max: yMax,
      strictMinMax: true,
      maxDeviation: 0,
      numberFormat: "#,###",
    }),
  );

  const yAxisTitle =
    (typeof payload.metric_name === "string" && payload.metric_name.trim()) ||
    (typeof detail.metric_name === "string" && detail.metric_name.trim()) ||
    yLabel;

  yAxis.children.unshift(
    am5.Label.new(root, {
      text: yAxisTitle,
      rotation: -90,
      y: am5.p50,
      centerX: am5.p50,
      fontSize: NEAT_FS.axisTitle,
      fontWeight: NEAT_FW.axis,
      fill: neat.label,
    }),
  );

  xAxis.set(
    "title",
    am5.Label.new(root, {
      text: xLabel,
      fontSize: NEAT_FS.axisTitle,
      fontWeight: NEAT_FW.axis,
      fill: neat.label,
      x: am5.p50,
      centerX: am5.p50,
    }),
  );

  const catData = rows.map((r) => {
    const cat = String(r[catKey] ?? "");
    return { [catKey]: cat } as Record<string, string>;
  });
  xAxis.data.setAll(catData);

  xRenderer.labels.template.adapters.add("text", (text, target) => {
    const di = (target as { dataItem?: { get?: (k: string) => unknown } })
      .dataItem;
    const cat = di?.get?.("category");
    if (cat != null && String(cat) !== "") {
      return truncateCategoryAxisLabel(
        formatCategoryLabelIfIsoDate(String(cat)),
        14,
      );
    }
    const t = String(text ?? "");
    if (t.includes("{") && t.includes("}")) return t;
    return truncateCategoryAxisLabel(formatCategoryLabelIfIsoDate(t), 14);
  });

  const densityTooltip = createSeriesLinkedTooltipWithText(root, am5, (di) => {
    const ctx = (di.dataContext ?? {}) as Record<string, unknown>;
    return tooltipText.replace(/\{([^}]+)\}/g, (_m, rawKey: string) => {
      const key = rawKey.trim();
      const val = ctx[key];
      if (val == null || val === "") return "";
      const n = Number(val);
      if (
        Number.isFinite(n) &&
        (key === valueYField || key === "count")
      ) {
        return formatCompactAxisValue(n);
      }
      return String(val);
    });
  });

  const colSeries = chart.series.push(
    am5xy.ColumnSeries.new(root, {
      name: seriesName,
      xAxis,
      yAxis,
      categoryXField: catKey,
      valueYField,
      stroke: am5.color(0x000000),
      strokeOpacity,
      tooltip: densityTooltip,
    }),
  );

  colSeries.columns.template.setAll({
    cornerRadiusTL: cornerTL,
    cornerRadiusTR: cornerTR,
    cornerRadiusBL: 0,
    cornerRadiusBR: 0,
    strokeOpacity,
    fillOpacity,
    fillGradient: undefined,
    width: 20,
    cursorOverStyle: "pointer",
  });

  colSeries.columns.template.adapters.add("fill", (_fill, target: any) => {
    const di = target.dataItem;
    const idx =
      di != null && typeof colSeries.dataItems.indexOf === "function"
        ? colSeries.dataItems.indexOf(di)
        : -1;
    const i = idx >= 0 ? idx : 0;
    const hex =
      GROUPED_BAR_BASE_COLORS[i % GROUPED_BAR_BASE_COLORS.length] ?? "#3b82f6";
    return cssHexToAm5(am5, hex);
  });

  colSeries.data.setAll(rows as any);

  const cursorPayload = payload.cursor as { behavior?: string } | undefined;
  const cursorBehaviorRaw = String(cursorPayload?.behavior ?? "zoomX");
  const cursorBehavior =
    cursorBehaviorRaw === "zoomY" ||
    cursorBehaviorRaw === "zoomXY" ||
    cursorBehaviorRaw === "none"
      ? cursorBehaviorRaw
      : "zoomX";

  chart.set(
    "cursor",
    am5xy.XYCursor.new(root, {
      behavior: cursorBehavior as "zoomX" | "zoomY" | "zoomXY" | "none",
      xAxis,
      yAxis,
      snapToSeries: [colSeries],
    }),
  );

  const sbPayload = payload.scrollbarX as { visible?: boolean } | undefined;
  const barCount = rows.length;
  const densityScrollbarInitialBars = 10;
  if (sbPayload?.visible && barCount > densityScrollbarInitialBars) {
    const visible = Math.min(densityScrollbarInitialBars, barCount);
    const endFrac = visible / barCount;
    const scrollbar = am5.Scrollbar.new(root, {
      orientation: "horizontal",
      marginBottom: 8,
      minHeight: 10,
      start: 0,
      end: endFrac,
    });
    chart.set("scrollbarX", scrollbar);
    chart.bottomAxesContainer.children.push(scrollbar);
    scrollbar.thumb.setAll({
      fillOpacity: 0.18,
      fill: neat.labelMuted,
    });
    xAxis.events.once("datavalidated", () => {
      xAxis.zoomToIndexes(0, visible - 1);
    });
  }

  chart.appear(800, 80);
}
