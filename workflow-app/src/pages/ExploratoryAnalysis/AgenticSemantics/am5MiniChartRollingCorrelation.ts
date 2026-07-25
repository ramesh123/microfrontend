import type { ChartDetail } from "./chartTypes";
import { createShinePaletteFromBase } from "./am5MiniChartConstants";
import {
  NEAT_AXIS_STROKE_OPACITY,
  NEAT_CHART_PAD,
  NEAT_FS,
  NEAT_FW,
  NEAT_GRID_OPACITY,
  neatMiniChartColors,
} from "./am5MiniChartNeatTheme";
import {
  attachCompactValueAxisRendererLabels,
  attachTooltipLabelAdapter,
  formatCompactAxisValue,
  shineLinearGradient,
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
 * Rolling correlation: XYChart, ValueAxis X (window index), ValueAxis Y clamped −1…1.
 * Y axis ranges: reference line at 0; green fill 0.5…1; red fill −1…−0.5.
 * Optional `annotations` horizontal lines; tooltip includes optional rolling window label.
 */
export async function renderAm5RollingCorrelationChart(
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

  const yPayload = payload.yAxis as { min?: number; max?: number; label?: string } | undefined;
  const xPayload = payload.xAxis as { label?: string } | undefined;
  const yMin = numOrNull(yPayload?.min) ?? -1;
  const yMax = numOrNull(yPayload?.max) ?? 1;
  const yLabel =
    (typeof yPayload?.label === "string" && yPayload.label.trim()) ||
    "Pearson r";
  const xLabel =
    (typeof xPayload?.label === "string" && xPayload.label.trim()) || "Window";

  const zonePosLow = numOrNull(payload.zone_positive_min) ?? 0.5;
  const zoneNegHigh = numOrNull(payload.zone_negative_max) ?? -0.5;

  const rollingWindowText =
    (typeof payload.rolling_window === "string" && payload.rolling_window.trim()) ||
    (typeof payload.window_description === "string" && payload.window_description.trim()) ||
    "";

  const seriesCfg =
    findSeriesCfg(payload, "rolling_r") ??
    (Array.isArray(payload.series) && payload.series.length > 0
      ? (payload.series as Array<Record<string, unknown>>)[0]
      : undefined) ??
    {};

  const valueXField = typeof seriesCfg.valueXField === "string" ? seriesCfg.valueXField : "index";
  const valueYField =
    typeof seriesCfg.valueYField === "string" ? seriesCfg.valueYField : "rolling_r";
  const seriesName = typeof seriesCfg.name === "string" ? seriesCfg.name : "Rolling r";
  const strokeHex =
    typeof seriesCfg.stroke === "string" && String(seriesCfg.stroke).trim().startsWith("#")
      ? String(seriesCfg.stroke).trim()
      : "#3b82f6";
  const fillUnderHex =
    typeof seriesCfg.fill === "string" && String(seriesCfg.fill).trim().startsWith("#")
      ? String(seriesCfg.fill).trim()
      : "#bfdbfe";
  const bulletFillRaw = (seriesCfg.bullets as { fill?: string } | undefined)?.fill;
  const bulletFillHex =
    typeof bulletFillRaw === "string" && bulletFillRaw.trim().startsWith("#")
      ? bulletFillRaw.trim()
      : strokeHex;

  const strokeCol = cssHexToAm5(am5, seriesCfg.stroke ?? "#3b82f6");
  const fillUnder = cssHexToAm5(am5, seriesCfg.fill ?? "#bfdbfe");
  const fillOpacity = numOrNull(seriesCfg.fillOpacity) ?? 0.25;
  const strokeWidth = numOrNull(seriesCfg.strokeWidth) ?? 2;
  const bulletRadius =
    numOrNull((seriesCfg.bullets as { radius?: unknown } | undefined)?.radius) ?? 4;

  const lineStrokeShine = shineLinearGradient(
    root,
    am5,
    createShinePaletteFromBase(strokeHex),
    0,
  );

  let tooltipTemplate =
    typeof seriesCfg.tooltipText === "string"
      ? seriesCfg.tooltipText
      : "Window {valueX}: r = {valueY}";
  if (!tooltipTemplate.includes("{valueX")) {
    tooltipTemplate = tooltipTemplate
      .replace(/\{index\}/g, "{valueX}")
      .replace(/\{rolling_r\}/g, "{valueY}");
  }

  const neat = neatMiniChartColors(am5, isDark);

  const greenZone = isDark ? 0x064e3b : 0xd1fae5;
  const redZone = isDark ? 0x7f1d1d : 0xfecaca;
  const zeroLine = isDark ? am5.color(0x64748b) : am5.color(0x94a3b8);

  const chart = root.container.children.push(
    am5xy.XYChart.new(root, {
      panX,
      panY: false,
      wheelX,
      wheelY,
      pinchZoomX: true,
      layout: root.verticalLayout,
      paddingTop: 20,
      paddingBottom: NEAT_CHART_PAD.bottom,
      paddingLeft: NEAT_CHART_PAD.side,
      paddingRight: NEAT_CHART_PAD.side,
    }),
  );
  chart.plotContainer.set("maskContent", false);
  chart.seriesContainer.set("maskContent", false);

  const xRenderer = am5xy.AxisRendererX.new(root, {
    minGridDistance: 28,
    strokeOpacity: NEAT_AXIS_STROKE_OPACITY,
  });
  xRenderer.labels.template.setAll({
    fontSize: NEAT_FS.axis,
    fontWeight: NEAT_FW.axis,
    fill: neat.label,
    maxWidth: 120,
    oversizedBehavior: "truncate",
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
  attachCompactValueAxisRendererLabels(xRenderer);
  attachCompactValueAxisRendererLabels(yRenderer);

  const indexVals = rows
    .map((r) => numOrNull(r[valueXField]))
    .filter((v): v is number => v != null);
  const xMin = indexVals.length ? Math.min(...indexVals) : 0;
  const xMax = indexVals.length ? Math.max(...indexVals) : 1;
  const xPad = Math.max(0.35, (xMax - xMin) * 0.08 || 0.25);

  const xAxis = chart.xAxes.push(
    am5xy.ValueAxis.new(root, {
      renderer: xRenderer,
      min: xMin - xPad,
      max: xMax + xPad,
      strictMinMax: true,
      numberFormat: "#,###.##",
    }),
  );

  const yAxis = chart.yAxes.push(
    am5xy.ValueAxis.new(root, {
      renderer: yRenderer,
      min: yMin,
      max: yMax,
      strictMinMax: true,
      numberFormat: "#,###.##",
    }),
  );

  /** Positive correlation band (y = zonePosLow … 1) */
  if (zonePosLow < yMax) {
    const posItem = yAxis.makeDataItem({
      value: Math.max(zonePosLow, yMin),
      endValue: yMax,
    });
    const posRange = yAxis.createAxisRange(posItem);
    posRange.get("axisFill")?.setAll({
      fill: am5.color(greenZone),
      fillGradient: undefined,
      fillOpacity: isDark ? 0.16 : 0.12,
      visible: true,
    });
    posRange.get("grid")?.setAll({ visible: false });
  }

  /** Negative correlation band (y = yMin … zoneNegHigh) */
  if (zoneNegHigh > yMin) {
    const negItem = yAxis.makeDataItem({
      value: yMin,
      endValue: Math.min(zoneNegHigh, yMax),
    });
    const negRange = yAxis.createAxisRange(negItem);
    negRange.get("axisFill")?.setAll({
      fill: am5.color(redZone),
      fillGradient: undefined,
      fillOpacity: isDark ? 0.16 : 0.12,
      visible: true,
    });
    negRange.get("grid")?.setAll({ visible: false });
  }

  /** Reference line at y = 0 */
  const zeroItem = yAxis.makeDataItem({ value: 0 });
  const zeroRange = yAxis.createAxisRange(zeroItem);
  zeroRange.get("grid")?.setAll({
    stroke: zeroLine,
    strokeOpacity: 1,
    strokeDasharray: [5, 3],
    location: 0.5,
  });

  const annotations = Array.isArray(payload.annotations)
    ? (payload.annotations as Array<Record<string, unknown>>)
    : [];
  for (const ann of annotations) {
    if (String(ann?.type ?? "") !== "HorizontalLine") continue;
    const v = numOrNull(ann.value);
    if (v == null || v === 0) continue;
    const strokeColAnn = cssHexToAm5(am5, ann.stroke ?? strokeHex);
    const dash = Array.isArray(ann.strokeDasharray)
      ? (ann.strokeDasharray as number[])
      : [4, 2];
    const trItem = yAxis.makeDataItem({ value: v });
    const tr = yAxis.createAxisRange(trItem);
    tr.get("grid")?.setAll({
      stroke: strokeColAnn,
      strokeOpacity: 0.95,
      strokeDasharray: dash,
      location: 0.5,
    });
    const lbl = typeof ann.label === "string" ? ann.label.trim() : "";
    if (lbl) {
      const rangeLabel = tr.get("label");
      if (rangeLabel) {
        rangeLabel.setAll({
          text: lbl,
          fill: strokeColAnn,
          fontSize: 10,
          fontWeight: "600",
          inside: true,
          centerX: 0,
          centerY: am5.p50,
        });
      }
    }
  }

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

  yAxis.children.unshift(
    am5.Label.new(root, {
      text: yLabel,
      rotation: -90,
      y: am5.p50,
      centerX: am5.p50,
      fontSize: NEAT_FS.axisTitle,
      fontWeight: NEAT_FW.axis,
      fill: neat.label,
    }),
  );

  const rollingCorrTooltip = am5.Tooltip.new(root, {
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 12,
    paddingRight: 12,
    animationDuration: 150,
  });
  attachTooltipLabelAdapter(rollingCorrTooltip, (di) => {
    const vx = Number(di.get?.("valueX"));
    const vy = Number(di.get?.("valueY"));
    if (!Number.isFinite(vx) || !Number.isFinite(vy)) return "";
    const core = tooltipTemplate
      .replace(/\{valueX\}/g, formatCompactAxisValue(vx))
      .replace(/\{valueY\}/g, formatCompactAxisValue(vy));
    const parts = [
      rollingWindowText ? `[fontSize:10px opacity:0.9]${rollingWindowText}[/]` : "",
      `[fontSize:11px]${core}[/]`,
    ].filter(Boolean);
    return parts.join("\n");
  });

  const lineSeries = chart.series.push(
    am5xy.LineSeries.new(root, {
      name: seriesName,
      xAxis,
      yAxis,
      valueXField,
      valueYField,
      stroke: strokeCol,
      tooltip: rollingCorrTooltip,
    }),
  );
  lineSeries.strokes.template.setAll({
    strokeWidth,
    strokeGradient: lineStrokeShine,
  });
  lineSeries.fills.template.setAll({
    visible: true,
    fill: fillUnder,
    fillGradient: undefined,
    fillOpacity,
  });

  lineSeries.bullets.push((bulletRoot) => {
    const c = am5.Circle.new(bulletRoot, {
      radius: bulletRadius,
      fill: cssHexToAm5(am5, bulletFillHex),
      fillGradient: undefined,
      stroke: bulletRoot.interfaceColors.get("background"),
      strokeWidth: 1,
    });
    return am5.Bullet.new(bulletRoot, { sprite: c });
  });

  const mapped = rows.map((r) => {
    const ix = numOrNull(r[valueXField]);
    const ry = numOrNull(r[valueYField]);
    return {
      ...r,
      [valueXField]: ix ?? 0,
      [valueYField]: ry ?? 0,
    };
  });
  lineSeries.data.setAll(mapped as any);

  const legendPayload = payload.legend as { visible?: boolean } | undefined;
  if (legendPayload?.visible !== false) {
    const legend = am5.Legend.new(root, {
      centerX: am5.p50,
      x: am5.p50,
      layout: root.horizontalLayout,
      marginTop: 4,
      marginBottom: 2,
      useDefaultMarker: true,
    });
    chart.children.push(legend);
    legend.labels.template.setAll({
      fontSize: NEAT_FS.legend,
      fontWeight: NEAT_FW.legend,
      fill: neat.labelMuted,
    });
    legend.markers.template.setAll({ width: 10, height: 10 });
    legend.data.setAll(chart.series.values);
  }

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
      snapToSeries: [lineSeries],
    }),
  );

  const sbPayload = payload.scrollbarX as { visible?: boolean } | undefined;
  if (sbPayload?.visible && rows.length > 12) {
    const scrollbar = am5.Scrollbar.new(root, {
      orientation: "horizontal",
      marginBottom: 6,
      minHeight: 10,
      start: 0,
      end: 1,
    });
    chart.set("scrollbarX", scrollbar);
    chart.bottomAxesContainer.children.push(scrollbar);
    scrollbar.thumb.setAll({
      fillOpacity: 0.18,
      fill: neat.labelMuted,
    });
  }

  chart.appear(800, 80);
}
