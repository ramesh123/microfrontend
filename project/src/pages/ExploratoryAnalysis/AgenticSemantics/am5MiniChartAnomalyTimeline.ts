import type { ChartDetail } from "./chartTypes";
import {
  createShinePaletteFromBase,
  VERTICAL_X_AXIS_LABEL_ELLIPSIS,
} from "./am5MiniChartConstants";
import {
  compactAxisLabelText,
  shineLinearGradient,
  shineRadialGradient,
} from "./am5MiniChartHelpers";

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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

function isTruthyAnomaly(v: unknown): boolean {
  if (v === true) return true;
  if (v === false || v == null) return false;
  if (typeof v === "number") return v !== 0;
  const s = String(v).toLowerCase();
  return s === "true" || s === "1" || s === "yes";
}

/** API rows use `anomaly_class` / `z_score` / `columnSettings`, not always `is_anomaly`. */
function rowIsAnomaly(d: Record<string, unknown>): boolean {
  if (isTruthyAnomaly(d.is_anomaly)) return true;
  const ac = d.anomaly_class;
  if (ac != null && String(ac).trim() !== "") return true;
  if (numOrNull(d.z_score) != null) return true;
  const cs = d.columnSettings as { fill?: string } | null | undefined;
  if (cs && typeof cs.fill === "string" && cs.fill.trim() !== "") return true;
  return false;
}

function yRangeFromValues(values: number[]): { min: number; max: number } {
  if (values.length === 0) return { min: 0, max: 1 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.08 || Math.abs(max) * 0.02 || 1;
  return { min: min - pad, max: max + pad };
}

/** When the horizontal scrollbar is shown, initial zoom shows this many categories. */
const SCROLLBAR_INITIAL_VISIBLE_POINTS = 15;

function buildClassColorMap(
  payload: Record<string, unknown>,
): Map<string, string> {
  const m = new Map<string, string>();
  const leg = payload.legend as { items?: Array<{ name?: string; fill?: string }> } | undefined;
  const items = leg?.items;
  if (!Array.isArray(items)) return m;
  for (const it of items) {
    const name = typeof it?.name === "string" ? it.name.trim() : "";
    const fill = typeof it?.fill === "string" ? it.fill : "";
    if (name && fill) m.set(name, fill);
  }
  return m;
}

/**
 * Anomaly timeline — supports dashboard API: `actual` + `period`, optional
 * `anomaly_class` / `z_score` / `columnSettings`, optional `y2Axis` + `anomaly_score`
 * columns, `annotations` threshold lines, `legend.items` class colors.
 */
export async function renderAm5AnomalyTimeline(
  root: any,
  am5: typeof import("@amcharts/amcharts5"),
  detail: ChartDetail,
  rawData: Record<string, unknown>[],
  isDark: boolean,
): Promise<void> {
  const am5xy = await import("@amcharts/amcharts5/xy");

  const payload = (detail.chart_payload ?? {}) as Record<string, unknown>;
  const classColors = buildClassColorMap(payload);

  const settings = (payload.settings ?? {}) as Record<string, unknown>;
  const panX = settings.panX !== false;
  const wheelX = String(settings.wheelX ?? "panX") === "panX" ? "panX" : "none";
  const wheelY =
    String(settings.wheelY ?? "zoomX") === "zoomX" ? "zoomX" : "none";

  const seriesList = Array.isArray(payload.series)
    ? (payload.series as Array<Record<string, unknown>>)
    : [];
  const lineCfg =
    seriesList.find(
      (s) =>
        String(s?.type ?? "").toLowerCase() === "lineseries" ||
        s?.id === "actual",
    ) ?? seriesList[0];
  const columnCfg = seriesList.find(
    (s) => String(s?.type ?? "").toLowerCase() === "columnseries",
  );

  const y2Payload = payload.y2Axis as
    | { min?: number; max?: number; label?: string; type?: string }
    | undefined;
  const hasScoreColumn =
    columnCfg != null ||
    rawData.some((r) => numOrNull(r.anomaly_score) != null);
  const annotations = Array.isArray(payload.annotations)
    ? (payload.annotations as Array<Record<string, unknown>>)
    : [];
  const needsY2 =
    hasScoreColumn ||
    annotations.some((a) => String(a?.axis ?? "") === "y2Axis") ||
    y2Payload != null;

  const labelColor = isDark ? am5.color(0xcccccc) : am5.color(0x555555);
  const gridStroke = isDark ? am5.color(0x334155) : am5.color(0xe2e8f0);
  const defaultLineStroke = isDark ? am5.color(0x60a5fa) : am5.color(0x2563eb);
  const lineStrokeHex =
    typeof lineCfg?.stroke === "string" && String(lineCfg.stroke).trim().startsWith("#")
      ? String(lineCfg.stroke).trim()
      : isDark
        ? "#60a5fa"
        : "#2563eb";
  const lineStroke =
    typeof lineCfg?.stroke === "string"
      ? cssHexToAm5(am5, lineCfg.stroke)
      : defaultLineStroke;
  const lineStrokeWidth = numOrNull(lineCfg?.strokeWidth) ?? 2;
  const lineStrokeShine = createShinePaletteFromBase(lineStrokeHex);
  const lineStrokeGradient = shineLinearGradient(root, am5, lineStrokeShine, 0);

  /**
   * Anomaly period band (axis fill): single cool indigo family only — no red/rose mix,
   * no neutral-gray gradient stops; vertical gloss reads as one shiny hue with depth.
   */
  const zoneFill = isDark ? am5.color(0x3730a3) : am5.color(0xe0e7ff);
  const zoneFillGradient = isDark
    ? am5.LinearGradient.new(root, {
        rotation: 90,
        stops: [
          { color: am5.color(0x4f46e5), offset: 0 },
          { color: am5.color(0x4338ca), offset: 0.48 },
          { color: am5.color(0x312e81), offset: 1 },
        ],
      })
    : am5.LinearGradient.new(root, {
        rotation: 90,
        stops: [
          { color: am5.color(0xf8f9ff), offset: 0 },
          { color: am5.color(0xe0e7ff), offset: 0.45 },
          { color: am5.color(0xc7d2fe), offset: 1 },
        ],
      });

  const radialShineByHex = new Map<string, any>();
  const radialForHex = (hex: string) => {
    const k = hex.toLowerCase();
    let g = radialShineByHex.get(k);
    if (!g) {
      g = shineRadialGradient(root, am5, createShinePaletteFromBase(k));
      radialShineByHex.set(k, g);
    }
    return g;
  };

  const chart = root.container.children.push(
    am5xy.XYChart.new(root, {
      panX,
      panY: false,
      wheelX,
      wheelY,
      pinchZoomX: true,
      layout: root.verticalLayout,
      paddingTop: 20,
      paddingBottom: 19,
      paddingLeft: 20,
      paddingRight: needsY2 ? 16 : 12,
    }),
  );
  chart.plotContainer.set("maskContent", false);
  chart.seriesContainer.set("maskContent", false);

  const xRenderer = am5xy.AxisRendererX.new(root, {
    minGridDistance: 24,
    strokeOpacity: 0.12,
  });
  xRenderer.labels.template.setAll({
    fontSize: 10,
    fontWeight: "700",
    fill: labelColor,
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
  xRenderer.labels.template.adapters.add("text", (text: string) =>
    compactAxisLabelText(String(text ?? ""), 14),
  );
  xRenderer.grid.template.setAll({ stroke: gridStroke, strokeOpacity: 0.25 });
  xRenderer.set("marginBottom", 8);

  const xAxis = chart.xAxes.push(
    am5xy.CategoryAxis.new(root, {
      categoryField: "period",
      renderer: xRenderer,
      tooltip: am5.Tooltip.new(root, {}),
    }),
  );

  const yRenderer = am5xy.AxisRendererY.new(root, { strokeOpacity: 0.12 });
  yRenderer.labels.template.setAll({
    fontSize: 10,
    fontWeight: "700",
    fill: labelColor,
  });
  yRenderer.grid.template.setAll({ stroke: gridStroke, strokeOpacity: 0.25 });

  const yAxis = chart.yAxes.push(
    am5xy.ValueAxis.new(root, {
      renderer: yRenderer,
      extraMin: 0.02,
      extraMax: 0.02,
    }),
  );

  const metricLabel =
    (typeof payload.metric_name === "string" ? payload.metric_name : null) ||
    detail.metric_name ||
    detail.title ||
    (typeof payload.title === "string" ? payload.title : "") ||
    (typeof (payload.yAxis as { label?: string } | undefined)?.label === "string"
      ? (payload.yAxis as { label: string }).label
      : "") ||
    "Value";

  yAxis.children.unshift(
    am5.Label.new(root, {
      text: metricLabel,
      rotation: -90,
      y: am5.p50,
      centerX: am5.p50,
      fontSize: 11,
      fontWeight: "700",
      fill: labelColor,
    }),
  );

  let yAxis2: any = null;
  if (needsY2) {
    const y2Renderer = am5xy.AxisRendererY.new(root, {
      opposite: true,
      strokeOpacity: 0.12,
    });
    y2Renderer.labels.template.setAll({
      fontSize: 10,
      fontWeight: "700",
      fill: labelColor,
    });
    y2Renderer.grid.template.setAll({ strokeOpacity: 0, visible: false });

    const y2Min = numOrNull(y2Payload?.min) ?? 0;
    const y2Max = numOrNull(y2Payload?.max) ?? 1;
    const y2Label =
      typeof y2Payload?.label === "string" ? y2Payload.label : "Anomaly score";

    yAxis2 = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: y2Renderer,
        min: y2Min,
        max: y2Max,
        strictMinMax: true,
      }),
    );
    yAxis2.children.push(
      am5.Label.new(root, {
        text: y2Label,
        rotation: 90,
        y: am5.p50,
        centerX: am5.p50,
        fontSize: 11,
        fontWeight: "700",
        fill: labelColor,
      }),
    );
  }

  const rows = rawData.map((d) => {
    const period = String(d.period ?? d.date ?? d.timestamp ?? "");
    const valueNum = numOrNull(d.actual) ?? numOrNull(d.value);
    const score = numOrNull(d.anomaly_score);
    return {
      ...d,
      period,
      value: valueNum ?? 0,
      _valueNum: valueNum,
      is_anomaly: rowIsAnomaly(d),
      anomaly_score_col: score ?? 0,
    };
  });

  const periods = rows.map((d) => d.period).filter(Boolean);
  xAxis.data.setAll(periods.map((period) => ({ period })));

  const vals = rows
    .map((d) => d._valueNum)
    .filter((v): v is number => v != null);
  const { min: yMin, max: yMax } = yRangeFromValues(vals.length ? vals : [0, 1]);
  yAxis.set("min", yMin);
  yAxis.set("max", yMax);

  const thresholdRaw =
    payload.threshold ?? payload.upper_threshold ?? payload.lower_threshold;
  const thresholdY1 = numOrNull(thresholdRaw);

  if (thresholdY1 != null) {
    const trItem = yAxis.makeDataItem({ value: thresholdY1 });
    const tr = yAxis.createAxisRange(trItem);
    tr.get("grid")?.setAll({
      stroke: am5.color(0xf59e0b),
      strokeOpacity: 0.9,
      strokeDasharray: [5, 4],
      location: 0.5,
    });
  }

  for (const ann of annotations) {
    if (String(ann?.type ?? "") !== "HorizontalLine") continue;
    const v = numOrNull(ann.value);
    if (v == null) continue;
    const axisName = String(ann.axis ?? "yAxis");
    const targetAxis = axisName === "y2Axis" && yAxis2 ? yAxis2 : yAxis;
    const strokeCol = cssHexToAm5(am5, ann.stroke ?? "#ef4444");
    const dash = Array.isArray(ann.strokeDasharray)
      ? (ann.strokeDasharray as number[])
      : [4, 2];
    const trItem = targetAxis.makeDataItem({ value: v });
    const tr = targetAxis.createAxisRange(trItem);
    tr.get("grid")?.setAll({
      stroke: strokeCol,
      strokeOpacity: 0.95,
      strokeDasharray: dash,
      location: 0.5,
    });
  }

  for (const row of rows) {
    if (!row.is_anomaly || !row.period) continue;
    const rangeDataItem = xAxis.makeDataItem({
      category: row.period,
      endCategory: row.period,
    });
    const range = xAxis.createAxisRange(rangeDataItem);
    range.get("axisFill")?.setAll({
      fill: zoneFill,
      fillGradient: zoneFillGradient,
      fillOpacity: isDark ? 0.38 : 0.28,
      visible: true,
    });
    range.get("grid")?.setAll({ visible: false });
  }

  if (needsY2 && yAxis2 && hasScoreColumn) {
    const colSeries = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name:
          columnCfg && typeof columnCfg.name === "string"
            ? columnCfg.name
            : "Anomaly score",
        xAxis,
        yAxis: yAxis2,
        categoryXField: "period",
        valueYField: "anomaly_score_col",
        stroke: am5.color(0x000000),
        strokeOpacity: 0,
      }),
    );
    const fillOp =
      columnCfg && typeof columnCfg.fillOpacity === "number"
        ? columnCfg.fillOpacity
        : 1;
    colSeries.columns.template.setAll({
      fillOpacity: fillOp,
      strokeOpacity: 0,
      width: 18,
      fillGradient: undefined,
    });
    colSeries.columns.template.adapters.add("fill", (_f: any, target: any) => {
      const ctx = target.dataItem?.dataContext as Record<string, unknown> | undefined;
      const cs = ctx?.columnSettings as { fill?: string } | null | undefined;
      if (cs?.fill && typeof cs.fill === "string")
        return cssHexToAm5(am5, cs.fill);
      const cls = String(ctx?.anomaly_class ?? "").trim();
      if (cls && classColors.has(cls))
        return cssHexToAm5(am5, classColors.get(cls)!);
      return cssHexToAm5(am5, lineStrokeHex);
    });
    const tip =
      columnCfg && typeof columnCfg.tooltipText === "string"
        ? columnCfg.tooltipText
        : "{categoryX}: score={anomaly_score} ({anomaly_class})";
    colSeries.set(
      "tooltip",
      am5.Tooltip.new(root, {
        labelText: tip,
      }),
    );
    colSeries.data.setAll(rows as any);
  }

  const series = chart.series.push(
    am5xy.LineSeries.new(root, {
      name: metricLabel,
      xAxis,
      yAxis,
      categoryXField: "period",
      valueYField: "value",
      stroke: lineStroke,
      strokeWidth: lineStrokeWidth,
    }),
  );

  series.strokes.template.setAll({
    strokeWidth: lineStrokeWidth,
    strokeGradient: lineStrokeGradient,
  });

  series.bullets.push((_r: any, _s: any, dataItem: any) => {
    const ctx = dataItem?.dataContext as Record<string, unknown> | undefined;
    if (!ctx) return undefined as any;
    const isAnomaly = !!(ctx as { is_anomaly?: boolean }).is_anomaly;
    if (isAnomaly) {
      const cs = ctx.columnSettings as { fill?: string } | undefined;
      let hex: string | null =
        cs?.fill && typeof cs.fill === "string" && cs.fill.trim().startsWith("#")
          ? cs.fill.trim()
          : null;
      if (!hex) {
        const cls = String(ctx.anomaly_class ?? "").trim();
        if (cls && classColors.has(cls)) hex = classColors.get(cls)!;
      }
      if (!hex) hex = "#ef4444";
      return am5.Bullet.new(root, {
        sprite: am5.Circle.new(root, {
          radius: 5,
          fillGradient: radialForHex(hex),
          stroke: am5.color(0xffffff),
          strokeWidth: 1,
        }),
      });
    }
    return am5.Bullet.new(root, {
      sprite: am5.Circle.new(root, {
        radius: 3,
        fillGradient: radialForHex(lineStrokeHex),
        stroke: am5.color(0xffffff),
        strokeWidth: 1,
      }),
    });
  });

  series.data.setAll(rows as any);

  const leg = payload.legend as { visible?: boolean; items?: Array<{ name?: string; fill?: string }> };
  if (leg?.visible !== false && Array.isArray(leg.items) && leg.items.length > 0) {
    const legRow = chart.children.push(
      am5.Container.new(root, {
        layout: root.horizontalLayout,
        centerX: am5.p50,
        x: am5.p50,
        marginTop: 4,
        marginBottom: 2,
      }),
    );
    for (const it of leg.items) {
      const cell = legRow.children.push(
        am5.Container.new(root, {
          layout: root.horizontalLayout,
          marginRight: 12,
        }),
      );
      cell.children.push(
        am5.Rectangle.new(root, {
          width: 10,
          height: 10,
          fill: cssHexToAm5(am5, it.fill),
          fillGradient:
            typeof it.fill === "string" && it.fill.trim().startsWith("#")
              ? radialForHex(it.fill.trim())
              : radialForHex("#94a3b8"),
          strokeOpacity: 0,
          centerY: am5.p50,
        }),
      );
      cell.children.push(
        am5.Label.new(root, {
          text: String(it.name ?? ""),
          fontSize: 10,
          fill: labelColor,
          paddingLeft: 4,
          centerY: am5.p50,
        }),
      );
    }
  }

  chart.set(
    "cursor",
    am5xy.XYCursor.new(root, {
      behavior: "zoomX",
      xAxis,
      yAxis,
      snapToSeries: chart.series.values,
    }),
  );

  const sbCfg = (payload.scrollbarX ?? {}) as { visible?: boolean };
  const nRows = rows.length;
  const showSb = sbCfg.visible !== false && nRows > 4;
  if (showSb) {
    const initialPoints = Math.min(SCROLLBAR_INITIAL_VISIBLE_POINTS, nRows);
    const visibleFrac =
      initialPoints >= nRows ? 1 : Math.min(1, initialPoints / nRows);
    const scrollbar = am5.Scrollbar.new(root, {
      orientation: "horizontal",
      marginBottom: 6,
      minHeight: 10,
      start: 0,
      end: visibleFrac,
    });
    chart.set("scrollbarX", scrollbar);
    chart.bottomAxesContainer.children.push(scrollbar);
    scrollbar.thumb.setAll({
      fillOpacity: 0.25,
      fill: isDark ? am5.color(0x64748b) : am5.color(0x94a3b8),
    });
    xAxis.events.once("datavalidated", () => {
      xAxis.zoomToIndexes(0, Math.max(0, initialPoints - 1));
    });
  }

  chart.appear(800, 80);
}
