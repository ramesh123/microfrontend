import type { ChartDetail } from "./chartTypes";
import {
  createShinePaletteFromBase,
  DATE_AXIS_RELATIVE_PAD,
  rgbIntToHex,
  VERTICAL_X_AXIS_LABEL_ELLIPSIS,
} from "./am5MiniChartConstants";
import {
  attachCompactTooltipValueYAdapter,
  attachCompactValueAxisRendererLabels,
  compactAxisLabelText,
  formatCompactAxisValue,
  getDateAxisBaseIntervalFromSortedTimes,
  getValueAxisRange,
  shineLinearGradient,
  shineRadialGradient,
  SHORT_AM5_DATE_AXIS_FORMATS,
} from "./am5MiniChartHelpers";
import {
  NEAT_AXIS_STROKE_OPACITY,
  NEAT_CHART_PAD,
  NEAT_FS,
  NEAT_FW,
  NEAT_GRID_OPACITY,
  neatMiniChartColors,
} from "./am5MiniChartNeatTheme";

const DEFAULT_ACTUAL = 0x3b82f6;
const DEFAULT_FORECAST = 0x8b5cf6;
/** Outer ±2σ: wide band — cool indigo tint (no neutral / gray fill). */
const DEFAULT_BAND_2 = 0xe0e7ff;
/** Inner ±1σ: saturated indigo (stacks cleanly with outer; single hue family). */
const DEFAULT_BAND_1 = 0xa5b4fc;

/**
 * Monotone spline smoothing for bands + forecast/actual lines (0–1).
 * Per amCharts, **smaller** values produce a **more curved** (flowing) line; larger = closer to straight segments.
 */
const BAND_TENSION = 0.28;
/** Forecast line only — longer dashes read as a line, not as dots at small sizes. */
const FORECAST_DASH: readonly [number, number] = [8, 5];

/** Blend two 0xRRGGBB colours (avoids black/gray mix in band gloss). */
function mixRgbInt(a: number, b: number, t: number): number {
  const ar = (a >>> 16) & 0xff;
  const ag = (a >>> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >>> 16) & 0xff;
  const bg = (b >>> 8) & 0xff;
  const bb = b & 0xff;
  const rr = Math.round(ar + (br - ar) * t);
  const rg = Math.round(ag + (bg - ag) * t);
  const rb = Math.round(ab + (bb - ab) * t);
  return (rr << 16) | (rg << 8) | rb;
}

/** Vertical gloss on σ bands: highlight → base → tint toward forecast violet (no muddy neutrals). */
function bandGlossFillGradient(
  root: any,
  am5: typeof import("@amcharts/amcharts5"),
  baseRgb: number,
  rotation: number,
) {
  const hi = mixRgbInt(baseRgb, 0xffffff, 0.4);
  const lo = mixRgbInt(baseRgb, DEFAULT_FORECAST, 0.26);
  return am5.LinearGradient.new(root, {
    rotation,
    stops: [
      { color: am5.color(hi), offset: 0 },
      { color: am5.color(baseRgb), offset: 0.5 },
      { color: am5.color(lo), offset: 1 },
    ],
  });
}

/** When the horizontal scrollbar is shown, initial zoom shows this many data points. */
const SCROLLBAR_INITIAL_VISIBLE_POINTS = 15;

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function rowHasValidBandPair(
  row: Record<string, unknown>,
  upperKey: string,
  lowerKey: string,
): boolean {
  const u = numOrNull(row[upperKey]);
  const l = numOrNull(row[lowerKey]);
  return u != null && l != null;
}

/** True if at least one row has a usable upper+lower pair for the band (both numeric). */
function hasRenderableBand(
  rows: Record<string, unknown>[],
  upperKey: string,
  lowerKey: string,
): boolean {
  return rows.some((r) => rowHasValidBandPair(r, upperKey, lowerKey));
}

function yKeysForAxisRange(bandDefs: BandDef[]): string[] {
  const keys = new Set<string>(["actual", "forecast"]);
  for (const b of bandDefs) {
    keys.add(b.upperKey);
    keys.add(b.lowerKey);
  }
  return [...keys];
}

function allYValuesFromRows(rows: Record<string, unknown>[], keys: string[]): number[] {
  const vals: number[] = [];
  for (const d of rows) {
    for (const k of keys) {
      const n = numOrNull(d[k]);
      if (n != null) vals.push(n);
    }
  }
  return vals;
}

function parseRowDateMs(d: Record<string, unknown>): number | null {
  const explicit = d.date ?? d.Date ?? d.timestamp ?? d.Timestamp;
  if (explicit != null && explicit !== "") {
    const t = new Date(String(explicit)).getTime();
    if (Number.isFinite(t)) return t;
  }
  const p = d.period;
  if (p == null || p === "") return null;
  const t = new Date(String(p)).getTime();
  return Number.isFinite(t) ? t : null;
}

type BandDef = {
  upperKey: string;
  lowerKey: string;
  name: string;
  fillOpacity: number;
  fillRgb: number;
};

function buildBandDefs(rows: Record<string, unknown>[], isDark: boolean): BandDef[] {
  const band2Fill = isDark ? 0x312e81 : DEFAULT_BAND_2;
  const band1Fill = isDark ? 0x4f46e5 : DEFAULT_BAND_1;

  const has2 = hasRenderableBand(rows, "upper_2s", "lower_2s");
  const has1 = hasRenderableBand(rows, "upper_1s", "lower_1s");

  const out: BandDef[] = [];
  if (has2) {
    out.push({
      upperKey: "upper_2s",
      lowerKey: "lower_2s",
      name: "±2σ band",
      fillOpacity: isDark ? 0.34 : 0.22,
      fillRgb: band2Fill,
    });
  }
  if (has1) {
    out.push({
      upperKey: "upper_1s",
      lowerKey: "lower_1s",
      name: "±1σ band",
      fillOpacity: isDark ? 0.5 : 0.42,
      fillRgb: band1Fill,
    });
  }
  return out;
}

function bandDefsHas2s(defs: BandDef[]): boolean {
  return defs.some((d) => d.upperKey === "upper_2s");
}

function bandDefsHas1s(defs: BandDef[]): boolean {
  return defs.some((d) => d.upperKey === "upper_1s");
}

/** In-plot annotations like the reference (right-hand forecast region). */
function addForecastBandPlotLabels(
  root: any,
  am5: typeof import("@amcharts/amcharts5"),
  plotContainer: any,
  bandDefs: BandDef[],
  isDark: boolean,
): void {
  if (bandDefs.length === 0) return;
  const has2 = bandDefsHas2s(bandDefs);
  const has1 = bandDefsHas1s(bandDefs);
  const labelFill = isDark ? am5.color(0x93c5fd) : am5.color(0x1e3a8a);
  const labelFs = Math.max(8, NEAT_FS.axis - 1);

  const items: { text: string; xPct: number; yPct: number }[] = [];
  if (has2) {
    items.push({ text: "upper 2s", xPct: 72, yPct: 13 });
    items.push({ text: "±2σ band", xPct: 70, yPct: 76 });
  }
  if (has1) {
    items.push({ text: "±1σ band", xPct: 66, yPct: 44 });
    items.push({ text: "±1σ", xPct: 46, yPct: 36 });
  }

  for (const it of items) {
    plotContainer.children.push(
      am5.Label.new(root, {
        text: it.text,
        fontSize: labelFs,
        fontWeight: "500",
        fill: labelFill,
        fillOpacity: 0.92,
        x: am5.percent(it.xPct),
        y: am5.percent(it.yPct),
        centerX: am5.p50,
        centerY: am5.p50,
        layer: 45,
        interactive: false,
      }),
    );
  }
}

/**
 * Forecast band: range-area (upper/lower) + actual & forecast as continuous lines.
 * When `period` (or `date` / `timestamp`) parses as time, uses DateAxis like line charts.
 */
export async function renderAm5ForecastBandChart(
  root: any,
  am5: typeof import("@amcharts/amcharts5"),
  detail: ChartDetail,
  rawData: Record<string, unknown>[],
  isDark: boolean,
): Promise<void> {
  const am5xy = await import("@amcharts/amcharts5/xy");

  const neat = neatMiniChartColors(am5, isDark);

  const chart = root.container.children.push(
    am5xy.XYChart.new(root, {
      panX: false,
      panY: false,
      wheelX: "none",
      wheelY: "none",
      layout: root.verticalLayout,
      paddingTop: NEAT_CHART_PAD.top,
      paddingBottom: NEAT_CHART_PAD.bottom + 12,
      paddingLeft: NEAT_CHART_PAD.side,
      paddingRight: NEAT_CHART_PAD.side,
    }),
  );
  chart.plotContainer.set("maskContent", false);
  chart.seriesContainer.set("maskContent", false);

  const nRows = rawData.length;
  const dateParseCount = rawData.filter((d) => parseRowDateMs(d) != null).length;
  const datedRowsSorted = [...rawData]
    .map((row) => {
      const dateMs = parseRowDateMs(row);
      return dateMs != null ? { ...row, date: dateMs } : null;
    })
    .filter((r): r is Record<string, unknown> & { date: number } => r != null)
    .sort((a, b) => a.date - b.date);

  const isDateBased =
    nRows > 0 &&
    datedRowsSorted.length > 0 &&
    dateParseCount >= Math.max(1, Math.ceil(nRows * 0.5));

  const chartRows: Record<string, unknown>[] = isDateBased
    ? (datedRowsSorted as Record<string, unknown>[])
    : [...rawData].sort((a, b) =>
        String(a.period ?? "").localeCompare(String(b.period ?? "")),
      );

  const sortedTimes = isDateBased
    ? [...new Set(datedRowsSorted.map((r) => r.date))].sort((a, b) => a - b)
    : [];

  const dateAxisBaseInterval =
    sortedTimes.length >= 2
      ? getDateAxisBaseIntervalFromSortedTimes(sortedTimes)
      : { timeUnit: "day" as const, count: 1 };
  const useGaplessLineDayAxis =
    isDateBased && dateAxisBaseInterval.timeUnit === "day";

  const lineChartUsesScrollbar = nRows > 8;

  const xRenderer = am5xy.AxisRendererX.new(root, {
    minGridDistance: isDateBased ? (useGaplessLineDayAxis ? 12 : 26) : 30,
    strokeOpacity: NEAT_AXIS_STROKE_OPACITY,
  });
  xRenderer.labels.template.setAll({
    fontSize: NEAT_FS.axis,
    fontWeight: NEAT_FW.axis,
    fill: neat.label,
    maxWidth: 60,
    oversizedBehavior: "truncate",
    ellipsis: VERTICAL_X_AXIS_LABEL_ELLIPSIS,
    rotation: -45,
    centerY: am5.p50,
    centerX: am5.p100,
    textAlign: "center",
    paddingTop: 6,
    paddingBottom: 4,
  });
  xRenderer.grid.template.setAll({
    stroke: neat.grid,
    strokeOpacity: NEAT_GRID_OPACITY,
  });
  xRenderer.set("marginBottom", 8);

  let xAxis: any;
  if (isDateBased) {
    const DateAxisClass = useGaplessLineDayAxis
      ? am5xy.GaplessDateAxis
      : am5xy.DateAxis;
    xAxis = chart.xAxes.push(
      DateAxisClass.new(root, {
        baseInterval: dateAxisBaseInterval,
        renderer: xRenderer,
        // tooltip: am5.Tooltip.new(root, {}),
      }),
    );
    if (dateAxisBaseInterval.timeUnit === "month") {
      xAxis.set("markUnitChange", false);
    }
    (xRenderer as any).setAll({
      minLabelPosition: 0,
      maxLabelPosition: 1,
    });
    /** Center of each time cell (grid), not interval start — pairs with `locationX` / `exactLocationX` on series. */
    xAxis.set("startLocation", 0.5);
    xAxis.set("endLocation", 0.5);
    if (useGaplessLineDayAxis) {
      xAxis.set("extraMin", 0);
      xAxis.set("extraMax", 0);
    } else {
      xAxis.set("extraMin", lineChartUsesScrollbar ? 0.01 : DATE_AXIS_RELATIVE_PAD);
      xAxis.set("extraMax", lineChartUsesScrollbar ? 0.01 : DATE_AXIS_RELATIVE_PAD);
    }
    if (sortedTimes.length >= 2) {
      xAxis.setAll({
        min: sortedTimes[0],
        max: sortedTimes[sortedTimes.length - 1],
        strictMinMax: true,
      });
    } else if (sortedTimes.length === 1) {
      const pad = 12 * 60 * 60 * 1000;
      xAxis.setAll({
        min: sortedTimes[0] - pad,
        max: sortedTimes[0] + pad,
        strictMinMax: true,
      });
    }
    xAxis.set("dateFormats", { ...SHORT_AM5_DATE_AXIS_FORMATS });
    xAxis.set("periodChangeDateFormats", { ...SHORT_AM5_DATE_AXIS_FORMATS });
    xRenderer.labels.template.adapters.add("text", (text: string) =>
      compactAxisLabelText(String(text ?? ""), 14),
    );
  } else {
    xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "period",
        renderer: xRenderer,
        // tooltip: am5.Tooltip.new(root, {}),
      }),
    );
    xRenderer.labels.template.adapters.add("text", (text: string) =>
      compactAxisLabelText(String(text ?? ""), 14),
    );
    xAxis.set("startLocation", 0.5);
    xAxis.set("endLocation", 0.5);
  }

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

  const yAxis = chart.yAxes.push(
    am5xy.ValueAxis.new(root, {
      renderer: yRenderer,
      strictMinMax: true,
      numberFormat: "#,###.##",
    }),
  );

  const metricLabel =
    detail.metric_name ||
    detail.title ||
    (typeof detail.chart_payload?.title === "string"
      ? detail.chart_payload.title
      : "") ||
    "Value";
  yAxis.children.unshift(
    am5.Label.new(root, {
      text: metricLabel,
      rotation: -90,
      y: am5.p50,
      centerX: am5.p50,
      fontSize: NEAT_FS.axisTitle,
      fontWeight: NEAT_FW.axis,
      fill: neat.label,
    }),
  );

  if (!isDateBased) {
    const periods = chartRows.map((d) => String(d.period ?? ""));
    xAxis.data.setAll(periods.map((period) => ({ period })));
  }

  const bandDefs = buildBandDefs(chartRows as Record<string, unknown>[], isDark);
  const yRangeKeys = yKeysForAxisRange(bandDefs);
  const yVals = allYValuesFromRows(chartRows, yRangeKeys);
  const yRange =
    yVals.length > 0
      ? getValueAxisRange(yVals, { paddingPercent: 0.08, minSpanFraction: 0.08 })
      : { min: 0, max: 1 };
  yAxis.set("min", yRange.min);
  yAxis.set("max", yRange.max);
  const actualStroke = am5.color(DEFAULT_ACTUAL);
  const forecastStroke = am5.color(DEFAULT_FORECAST);
  const actualShine = createShinePaletteFromBase(rgbIntToHex(DEFAULT_ACTUAL));
  const forecastShine = createShinePaletteFromBase(rgbIntToHex(DEFAULT_FORECAST));
  const actualStrokeGrad = shineLinearGradient(root, am5, actualShine, 0);
  const forecastStrokeGrad = shineLinearGradient(root, am5, forecastShine, 0);
  const actualBulletShine = shineRadialGradient(root, am5, actualShine);
  const forecastBulletShine = shineRadialGradient(root, am5, forecastShine);

  const tooltipBase = {
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 12,
    paddingRight: 12,
    animationDuration: 150,
  };
  const attachForecastActualTooltipFormatting = (tip: { label: { adapters: { add: (k: string, fn: unknown) => void } } }) => {
    attachCompactTooltipValueYAdapter(tip, (di) => {
      const vy = Number(di.get?.("valueY"));
      const fy = formatCompactAxisValue(vy);
      const name = String(
        (di as { component?: { get?: (k: string) => unknown } }).component?.get?.(
          "name",
        ) ?? "",
      );
      if (isDateBased) {
        const vx = di.get?.("valueX") as number;
        const dateStr = root.dateFormatter.format(new Date(vx), "MMM d");
        return `[fontSize:10px opacity:0.8]${dateStr}[/]\n[fontSize:11px]${name}: ${fy}[/]`;
      }
      return `[fontSize:11px]${name}: ${fy}[/]`;
    });
  };
  const forecastLineTooltip = am5.Tooltip.new(root, { ...tooltipBase });
  attachForecastActualTooltipFormatting(forecastLineTooltip);
  const actualLineTooltip = am5.Tooltip.new(root, { ...tooltipBase });
  attachForecastActualTooltipFormatting(actualLineTooltip);

  const bandSeriesCommon = isDateBased
    ? {
        valueXField: "date",
        xAxis,
        yAxis,
        /** Match line charts: center on grid cell; `true` pins to timestamp and ignores cell center. */
        exactLocationX: false,
        locationX: 0.5,
      }
    : {
        categoryXField: "period",
        xAxis,
        yAxis,
        locationX: 0.5,
      };

  const bandSeriesStack: any[] = [];
  for (const b of bandDefs) {
    const fillColor = am5.color(b.fillRgb);
    const bandFillGrad = bandGlossFillGradient(root, am5, b.fillRgb, 90);
    const s = chart.series.push(
      am5xy.SmoothedXLineSeries.new(root, {
        name: b.name,
        ...bandSeriesCommon,
        valueYField: b.upperKey,
        openValueYField: b.lowerKey,
        tension: BAND_TENSION,
        // Range area: no edge strokes — only shaded band between upper and lower.
        stroke: fillColor,
        strokeOpacity: 0,
        strokeWidth: 0,
        fill: fillColor,
        fillOpacity: b.fillOpacity,
      }),
    );
    bandSeriesStack.push(s);
    s.strokes.template.setAll({
      visible: false,
      strokeOpacity: 0,
      strokeWidth: 0,
    });
    s.fills.template.setAll({
      visible: true,
      fill: fillColor,
      fillGradient: bandFillGrad,
      fillOpacity: b.fillOpacity,
    });
    s.data.setAll(chartRows as any);
  }

  addForecastBandPlotLabels(root, am5, chart.plotContainer, bandDefs, isDark);

  const forecastSeries = chart.series.push(
    am5xy.SmoothedXLineSeries.new(root, {
      name: "Forecast",
      ...bandSeriesCommon,
      valueYField: "forecast",
      tension: BAND_TENSION,
      stroke: forecastStroke,
      strokeWidth: 2,
      tooltip: forecastLineTooltip,
    }),
  );
  forecastSeries.strokes.template.setAll({
    strokeDasharray: [...FORECAST_DASH],
    strokeWidth: 2,
    strokeGradient: forecastStrokeGrad,
  });

  const actualSeries = chart.series.push(
    am5xy.SmoothedXLineSeries.new(root, {
      name: "Actual",
      ...bandSeriesCommon,
      valueYField: "actual",
      tension: BAND_TENSION,
      stroke: actualStroke,
      strokeWidth: 2.25,
      tooltip: actualLineTooltip,
    }),
  );

  actualSeries.strokes.template.setAll({
    strokeGradient: actualStrokeGrad,
  });

  const bulletStroke = isDark ? am5.color(0xc4b5fd) : am5.color(0xffffff);
  const attachLineBullet = (series: any, bulletFillGradient: any) => {
    series.bullets.push((bulletRoot: any, _s: any, dataItem: any) => {
      const valueY = dataItem.get("valueY") as number | null | undefined;
      if (valueY == null || (typeof valueY === "number" && Number.isNaN(valueY))) {
        return undefined;
      }
      return am5.Bullet.new(bulletRoot, {
        sprite: am5.Circle.new(bulletRoot, {
          radius: 3,
          fillGradient: bulletFillGradient,
          stroke: bulletStroke,
          strokeWidth: 1,
        }),
      });
    });
  };
  attachLineBullet(forecastSeries, forecastBulletShine);
  attachLineBullet(actualSeries, actualBulletShine);

  forecastSeries.data.setAll(chartRows as any);
  actualSeries.data.setAll(chartRows as any);

  const legend = am5.Legend.new(root, {
    centerX: am5.p50,
    x: am5.p50,
    layout: root.horizontalLayout,
    marginTop: 6,
    marginBottom: 4,
    paddingTop: 2,
    paddingBottom: 2,
    useDefaultMarker: true,
  });
  chart.children.push(legend);
  legend.itemContainers.template.setAll({
    paddingLeft: 0,
    paddingRight: 12,
    paddingTop: 2,
    paddingBottom: 2,
  });
  legend.labels.template.setAll({
    fontSize: NEAT_FS.legend,
    fontWeight: NEAT_FW.legend,
    fill: neat.labelMuted,
    oversizedBehavior: "truncate",
    maxWidth: 140,
  });
  legend.valueLabels.template.set("forceHidden", true);
  legend.markers.template.setAll({
    width: 12,
    height: 12,
    centerY: am5.p50,
  });
  legend.markerRectangles.template.setAll({
    cornerRadiusTL: 3,
    cornerRadiusTR: 3,
    cornerRadiusBL: 3,
    cornerRadiusBR: 3,
    strokeOpacity: 0.28,
    strokeWidth: 1,
    stroke: neat.label,
  });
  const legendSeriesOrder =
    bandSeriesStack.length >= 2
      ? [actualSeries, forecastSeries, bandSeriesStack[1], bandSeriesStack[0]]
      : [actualSeries, forecastSeries, ...bandSeriesStack];
  legend.data.setAll(legendSeriesOrder);

  chart.set(
    "cursor",
    am5xy.XYCursor.new(root, {
      behavior: "zoomX",
      xAxis,
      yAxis,
      snapToSeries: [forecastSeries, actualSeries],
    }),
  );

  if (lineChartUsesScrollbar) {
    const pointCount = nRows;
    const initialPoints = Math.min(SCROLLBAR_INITIAL_VISIBLE_POINTS, pointCount);
    const end =
      initialPoints >= pointCount ? 1 : Math.min(1, initialPoints / pointCount);
    const scrollbar = am5.Scrollbar.new(root, {
      orientation: "horizontal",
      marginBottom: 6,
      minHeight: 10,
      start: 0,
      end,
    });
    chart.set("scrollbarX", scrollbar);
    chart.bottomAxesContainer.children.push(scrollbar);
    /** Minimal zoom bar: no tinted fills — neutral thumb only. */
    scrollbar.thumb.setAll({
      fillOpacity: 0.2,
      fill: neat.labelMuted,
    });

    if (isDateBased) {
      const syncDateZoomFromScrollbar = () => {
        const sb = chart.get("scrollbarX");
        if (!sb) return;
        const s = sb.get("start", 0);
        const e = sb.get("end", 1);
        xAxis.zoom(s, e, 0);
      };
      xAxis.events.once("datavalidated", () => {
        syncDateZoomFromScrollbar();
      });
      scrollbar.events.on("rangechanged", syncDateZoomFromScrollbar);
    } else {
      const lastIdx = Math.min(
        SCROLLBAR_INITIAL_VISIBLE_POINTS - 1,
        pointCount - 1,
      );
      xAxis.events.once("datavalidated", () => {
        xAxis.zoomToIndexes(0, Math.max(0, lastIdx));
      });
    }
  }

  chart.appear(800, 80);
}
