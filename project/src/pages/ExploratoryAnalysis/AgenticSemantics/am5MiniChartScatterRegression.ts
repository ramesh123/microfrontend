import type { ChartDetail } from "./chartTypes";
import { VERTICAL_X_AXIS_LABEL_ELLIPSIS } from "./am5MiniChartConstants";
import {
  attachCompactValueAxisRendererLabels,
  attachTooltipLabelAdapter,
  createSeriesLinkedTooltipWithText,
  formatCompactAxisValue,
  getValueAxisRange,
} from "./am5MiniChartHelpers";
import {
  NEAT_AXIS_STROKE_OPACITY,
  NEAT_CHART_PAD,
  NEAT_FS,
  NEAT_FW,
  NEAT_GRID_OPACITY,
  neatMiniChartColors,
} from "./am5MiniChartNeatTheme";

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

function getRegressionRows(
  payload: Record<string, unknown>,
): Array<{ rx: number; ry: number }> {
  const raw =
    (Array.isArray(payload.regression_data) ? payload.regression_data : null) ??
    (Array.isArray(payload.regression_series_data)
      ? payload.regression_series_data
      : null);
  if (!raw || raw.length === 0) return [];
  return raw
    .map((r) => {
      const row = r as Record<string, unknown>;
      return {
        rx: numOrNull(row.rx) ?? NaN,
        ry: numOrNull(row.ry) ?? NaN,
      };
    })
    .filter((r) => Number.isFinite(r.rx) && Number.isFinite(r.ry))
    .sort((a, b) => a.rx - b.rx);
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

/** When point count exceeds this, initial X view uses a sliding window (partial thumb). */
const SCATTER_SCROLLBAR_DENSE_POINT_THRESHOLD = 16;

/**
 * Scatter + regression: XYChart with ValueAxis on X and Y.
 * Observations: LineSeries, stroke hidden, `connect: false`, circle bullets.
 * Regression: LineSeries with `rx`/`ry` (two endpoints), dashed stroke, no bullets.
 */
export async function renderAm5ScatterRegressionChart(
  root: any,
  am5: typeof import("@amcharts/amcharts5"),
  detail: ChartDetail,
  scatterData: Record<string, unknown>[],
  isDark: boolean,
): Promise<void> {
  const am5xy = await import("@amcharts/amcharts5/xy");

  const payload = (detail.chart_payload ?? {}) as Record<string, unknown>;
  const regressionRows = getRegressionRows(payload);

  if (scatterData.length === 0 && regressionRows.length < 2) {
    root.dispose();
    return;
  }

  const settings = (payload.settings ?? {}) as Record<string, unknown>;
  const panX = settings.panX !== false;
  const wheelX = String(settings.wheelX ?? "panX") === "panX" ? "panX" : "none";
  const wheelY =
    String(settings.wheelY ?? "zoomX") === "zoomX" ? "zoomX" : "none";

  const scatterCfg = findSeriesCfg(payload, "scatter") ?? {};
  const regCfg = findSeriesCfg(payload, "regression") ?? {};

  const scatterFillRaw =
    scatterCfg.fill ?? (scatterCfg.bullets as { fill?: string } | undefined)?.fill;
  const scatterFill = cssHexToAm5(am5, scatterFillRaw);
  const scatterRadius =
    numOrNull((scatterCfg.bullets as { radius?: unknown } | undefined)?.radius) ??
    5;
  const scatterFillOpacity =
    numOrNull(
      (scatterCfg.bullets as { fillOpacity?: unknown } | undefined)?.fillOpacity,
    ) ?? 1;

  const regStrokeRaw = regCfg.stroke ?? "#ef4444";
  const regStroke = cssHexToAm5(am5, regStrokeRaw);
  const regStrokeWidth = numOrNull(regCfg.strokeWidth) ?? 2;
  const dash = regCfg.strokeDasharray;
  const regDash =
    Array.isArray(dash) && dash.length >= 2
      ? [Number(dash[0]), Number(dash[1])]
      : ([6, 3] as const);

  const xPayload = payload.xAxis as { label?: string } | undefined;
  const yPayload = payload.yAxis as { label?: string } | undefined;
  const xLabel =
    (typeof payload.metric_a === "string" && payload.metric_a.trim()) ||
    (typeof xPayload?.label === "string" && xPayload.label.trim()) ||
    "X";
  const yLabel =
    (typeof payload.metric_b === "string" && payload.metric_b.trim()) ||
    (typeof yPayload?.label === "string" && yPayload.label.trim()) ||
    "Y";

  const neat = neatMiniChartColors(am5, isDark);

  const chart = root.container.children.push(
    am5xy.XYChart.new(root, {
      panX,
      panY: false,
      wheelX,
      wheelY,
      pinchZoomX: true,
      layout: root.verticalLayout,
      paddingTop: 20,
      paddingBottom: NEAT_CHART_PAD.bottom + 12,
      paddingLeft: NEAT_CHART_PAD.side,
      paddingRight: NEAT_CHART_PAD.side,
    }),
  );
  chart.plotContainer.set("maskContent", false);
  chart.seriesContainer.set("maskContent", false);

  const xRenderer = am5xy.AxisRendererX.new(root, {
    minGridDistance: 32,
    strokeOpacity: NEAT_AXIS_STROKE_OPACITY,
  });
  xRenderer.labels.template.setAll({
    fontSize: NEAT_FS.axis,
    fontWeight: NEAT_FW.axis,
    fill: neat.label,
    maxWidth: 160,
    oversizedBehavior: "truncate",
    ellipsis: VERTICAL_X_AXIS_LABEL_ELLIPSIS,
    rotation: -90,
    centerY: am5.p100,
    centerX: am5.p50,
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

  const xVals: number[] = [];
  const yVals: number[] = [];
  for (const d of scatterData) {
    const x = numOrNull(d.x);
    const y = numOrNull(d.y);
    if (x != null) xVals.push(x);
    if (y != null) yVals.push(y);
  }
  for (const r of regressionRows) {
    xVals.push(r.rx);
    yVals.push(r.ry);
  }

  const xRange =
    xVals.length > 0
      ? getValueAxisRange(xVals, { paddingPercent: 0.08, minSpanFraction: 0.06 })
      : { min: 0, max: 1 };
  const yRange =
    yVals.length > 0
      ? getValueAxisRange(yVals, { paddingPercent: 0.08, minSpanFraction: 0.06 })
      : { min: 0, max: 1 };

  const xAxis = chart.xAxes.push(
    am5xy.ValueAxis.new(root, {
      renderer: xRenderer,
      min: xRange.min,
      max: xRange.max,
      strictMinMax: true,
      numberFormat: "#,###.##",
      zoomX: true,
    }),
  );

  const yAxis = chart.yAxes.push(
    am5xy.ValueAxis.new(root, {
      renderer: yRenderer,
      min: yRange.min,
      max: yRange.max,
      strictMinMax: true,
      numberFormat: "#,###.##",
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

  const scatterName =
    typeof scatterCfg.name === "string" ? scatterCfg.name : "Observations";
  const regName =
    typeof regCfg.name === "string" ? regCfg.name : "Regression line";

  const cursorPayload = payload.cursor as { behavior?: string } | undefined;
  const cursorBehaviorRaw = String(cursorPayload?.behavior ?? "zoomX");
  const cursorBehavior =
    cursorBehaviorRaw === "zoomY" ||
    cursorBehaviorRaw === "zoomXY" ||
    cursorBehaviorRaw === "none"
      ? cursorBehaviorRaw
      : "zoomX";

  if (regressionRows.length >= 2) {
    const regTooltip = createSeriesLinkedTooltipWithText(root, am5, (di) => {
      const vx = Number(di.get?.("valueX"));
      const vy = Number(di.get?.("valueY"));
      const name = String(
        (di as { component?: { get?: (k: string) => unknown } }).component?.get?.(
          "name",
        ) ?? "",
      );
      if (!Number.isFinite(vx) || !Number.isFinite(vy)) return "";
      return `${name}\nx: ${formatCompactAxisValue(vx)} · y: ${formatCompactAxisValue(vy)}`;
    });

    const regSeries = chart.series.push(
      am5xy.LineSeries.new(root, {
        name: regName,
        xAxis,
        yAxis,
        valueXField: "rx",
        valueYField: "ry",
        stroke: regStroke,
        connect: true,
        tooltip: regTooltip,
      }),
    );
    regSeries.strokes.template.setAll({
      strokeWidth: regStrokeWidth,
      strokeDasharray: regDash,
      strokeGradient: undefined,
    });
    regSeries.fills.template.setAll({ visible: false });
    regSeries.data.setAll(regressionRows);
  }

  if (scatterData.length > 0) {
    const scatterTooltip = createSeriesLinkedTooltipWithText(root, am5, (di) => {
      const vx = Number(di.get?.("valueX"));
      const vy = Number(di.get?.("valueY"));
      const ctx = di.dataContext as { tooltipText?: unknown } | undefined;
      const tt = String(ctx?.tooltipText ?? "");
      if (!Number.isFinite(vx) || !Number.isFinite(vy)) return "";
      return `${tt}\n${formatCompactAxisValue(vx)} · ${formatCompactAxisValue(vy)}`;
    });

    const scatterSeries = chart.series.push(
      am5xy.LineSeries.new(root, {
        name: scatterName,
        xAxis,
        yAxis,
        valueXField: "x",
        valueYField: "y",
        stroke: scatterFill,
        connect: false,
        tooltip: scatterTooltip,
      }),
    );
    scatterSeries.strokes.template.setAll({
      strokeOpacity: 0,
      visible: false,
    });
    scatterSeries.fills.template.setAll({ visible: false });

    scatterSeries.bullets.push((bulletRoot) => {
      const c = am5.Circle.new(bulletRoot, {
        radius: scatterRadius,
        fill: scatterFill,
        fillOpacity: scatterFillOpacity,
        fillGradient: undefined,
        stroke: bulletRoot.interfaceColors.get("background"),
        strokeWidth: 1,
      });
      return am5.Bullet.new(bulletRoot, { sprite: c });
    });

    const scatterMapped = scatterData.map((d) => {
      const tx = typeof d.tooltipText === "string" ? d.tooltipText.trim() : "";
      const x = numOrNull(d.x);
      const y = numOrNull(d.y);
      return {
        ...d,
        tooltipText:
          tx ||
          (x != null && y != null
            ? `${xLabel}=${x.toLocaleString(undefined, { maximumFractionDigits: 2 })}, ${yLabel}=${y.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
            : ""),
      };
    });
    scatterSeries.data.setAll(scatterMapped as any);
  }

  const legendPayload = payload.legend as { visible?: boolean } | undefined;
  const showLegend = legendPayload?.visible !== false;
  if (showLegend && chart.series.length > 0) {
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

  chart.set(
    "cursor",
    am5xy.XYCursor.new(root, {
      behavior: cursorBehavior as "zoomX" | "zoomY" | "zoomXY" | "none",
      xAxis,
      yAxis,
      snapToSeries: chart.series.values,
    }),
  );

  const sbCfg = (payload.scrollbarX ?? {}) as { visible?: boolean };
  const pointCount = scatterData.length;
  /** Any scatter points: show zoom bar (few points can still span a huge X range and crowd axis labels). */
  const showScrollbar = sbCfg.visible !== false && pointCount >= 1;

  if (showScrollbar) {
    const endFrac =
      pointCount <= SCATTER_SCROLLBAR_DENSE_POINT_THRESHOLD
        ? 1
        : Math.min(1, SCATTER_SCROLLBAR_DENSE_POINT_THRESHOLD / pointCount);

    const scrollbar = am5.Scrollbar.new(root, {
      orientation: "horizontal",
      marginTop: 6,
      marginBottom: 4,
      minHeight: 14,
      height: 14,
      start: 0,
      end: endFrac,
    });
    scrollbar.thumb.setAll({
      fillOpacity: 0.42,
      fill: neat.labelMuted,
      cornerRadiusTL: 4,
      cornerRadiusTR: 4,
      cornerRadiusBL: 4,
      cornerRadiusBR: 4,
    });

    /** Put scrollbar under the X axis — attach before `set("scrollbarX")` so XYChart does not also push to topAxesContainer. */
    chart.bottomAxesContainer.children.push(scrollbar);
    chart.set("scrollbarX", scrollbar);

    /** XYChart wires `rangechanged` → axis zoom; apply initial window once data exist. */
    const applyScrollbarToXAxis = () => {
      const s = scrollbar.get("start", 0);
      const e = scrollbar.get("end", 1);
      xAxis.zoom(s, e, 0);
    };
    xAxis.events.once("datavalidated", applyScrollbarToXAxis);
  }

  chart.appear(800, 80);
}
