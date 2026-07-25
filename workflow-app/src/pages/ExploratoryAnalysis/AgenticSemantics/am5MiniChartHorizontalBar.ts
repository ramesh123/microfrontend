import type { ChartDetail } from "./chartTypes";
import {
  FEW_BAR_COLUMN_WIDTH_PX,
  isFewBarCategories,
  MINI_XY_CHART_PADDING,
  niceYAxisMax,
  resolveBarColumnWidthPx,
  SINGLE_BAR_SCROLLBAR_INITIAL_VISIBLE,
} from "./am5MiniChartConstants";
import {
  attachGroupedBarColumnHoverState,
  attachGroupedBarColumnPointerUx,
  attachDrilldownOnColumnSeries,
  attachCompactValueAxisRendererLabels,
  compactAxisLabelText,
  createAgingStyleHorizontalBarTooltip,
  createCompactSeriesLinkedTooltip,
  formatCompactAxisValue,
  isDataQualityAm5BarContext,
} from "./am5MiniChartHelpers";

/**
 * Horizontal bar chart (categories on Y, values on X) — same per-bar shine palette as
 * {@link am5MiniChartBarSingle} (`GROUPED_BAR_SHINE_PALETTES`).
 */
export async function renderAm5HorizontalBarChart(
  root: any,
  am5: typeof import("@amcharts/amcharts5"),
  detail: ChartDetail,
  rawData: Record<string, unknown>[],
  isDark: boolean,
  drilldown?: {
    enabled: boolean;
    onCategory: (label: string) => void;
    getWorkspaceDrilldownActive?: () => boolean;
  },
  /** Data preview: fixed bar thickness in px on the category (Y) axis. */
  previewSlimBarWidthPx?: number,
): Promise<void> {
  const am5xy = await import("@amcharts/amcharts5/xy");
  const labelColor = isDark ? am5.color(0xcccccc) : am5.color(0x555555);
  const gridStroke = isDark ? am5.color(0x64748b) : am5.color(0x94a3b8);

  const first = rawData[0] as Record<string, unknown> | undefined;
  if (!first) return;

  const keys = Object.keys(first);
  const userCat = (detail.category_column ?? "").trim();
  const legacyHasCategory = rawData.some((d) => (d as Record<string, unknown>).category != null);
  const categoryKey =
    userCat && keys.includes(userCat)
      ? userCat
      : legacyHasCategory
        ? "category"
        : keys.find((k) => typeof first[k] === "string") ?? keys[0] ?? "category";

  const valueKeys = keys.filter(
    (k) =>
      k !== categoryKey &&
      (legacyHasCategory ? k !== "category" : true) &&
      typeof first[k] === "number",
  );
  const valueKey = valueKeys[0] ?? "value";
  const maxVal = Math.max(0, ...rawData.map((d) => Number((d as Record<string, unknown>)[valueKey]) || 0));
  const xMax = niceYAxisMax(maxVal);

  const sorted = [...rawData].sort(
    (a, b) =>
      (Number((b as Record<string, unknown>)[valueKey]) || 0) -
      (Number((a as Record<string, unknown>)[valueKey]) || 0),
  );

  const chartData = sorted.map((row) => {
    const r = row as Record<string, unknown>;
    const cat = String(r[categoryKey] ?? "");
    const val = Number(r[valueKey]) || 0;
    return {
      categoryY: cat,
      categoryX: cat,
      valueX: val,
    };
  });

  const barCount = chartData.length;
  const barThickness =
    previewSlimBarWidthPx != null
      ? resolveBarColumnWidthPx(barCount, previewSlimBarWidthPx)
      : isFewBarCategories(barCount)
        ? FEW_BAR_COLUMN_WIDTH_PX
        : am5.percent(68);
  const needsYZoom = barCount > SINGLE_BAR_SCROLLBAR_INITIAL_VISIBLE;
  const zoomVisible = Math.min(SINGLE_BAR_SCROLLBAR_INITIAL_VISIBLE, barCount);

  const chart = root.container.children.push(
    am5xy.XYChart.new(root, {
      panX: false,
      panY: false,
      wheelX: "none" as const,
      wheelY: "none" as const,
      layout: root.verticalLayout,
      paddingTop: MINI_XY_CHART_PADDING.top,
      paddingBottom: MINI_XY_CHART_PADDING.bottom,
      paddingLeft: MINI_XY_CHART_PADDING.side,
      paddingRight: MINI_XY_CHART_PADDING.side + (needsYZoom ? 14 : 0),
    }),
  );

  const yRenderer = am5xy.AxisRendererY.new(root, {
    minGridDistance: 8,
    inversed: true,
  });
  yRenderer.grid.template.setAll({ visible: false, strokeOpacity: 0 });
  yRenderer.labels.template.setAll({
    fontSize: 11,
    fontWeight: "600",
    fill: labelColor,
    oversizedBehavior: "truncate",
    maxWidth: 160,
    textAlign: "right",
  });
  yRenderer.labels.template.adapters.add("text", (_text, target) => {
    const di = (target as { dataItem?: { get?: (k: string) => unknown } }).dataItem;
    const cat = di?.get?.("category");
    return compactAxisLabelText(String(cat ?? _text ?? ""), 32);
  });

  const yAxis = chart.yAxes.push(
    am5xy.CategoryAxis.new(root, {
      categoryField: "categoryY",
      renderer: yRenderer,
    }),
  );

  const xRenderer = am5xy.AxisRendererX.new(root, {
    minGridDistance: 36,
  });
  xRenderer.grid.template.setAll({
    stroke: gridStroke,
    strokeOpacity: 0.22,
    strokeWidth: 1,
    visible: true,
  });
  attachCompactValueAxisRendererLabels(xRenderer);

  const xAxis = chart.xAxes.push(
    am5xy.ValueAxis.new(root, {
      renderer: xRenderer,
      min: 0,
      max: xMax,
      strictMinMax: true,
      extraMax: 0.06,
    }),
  );

  const metricLabel = (detail.metric_name || detail.title || "Value").replace(/[[\]]/g, "");
  xAxis.children.push(
    am5.Label.new(root, {
      text: metricLabel,
      fontSize: 10,
      fontWeight: "600",
      fill: labelColor,
      x: am5.p50,
      centerX: am5.p50,
      y: am5.p100,
      centerY: am5.p100,
      paddingTop: 4,
    }),
  );

  const series = chart.series.push(
    am5xy.ColumnSeries.new(root, {
      name: metricLabel,
      xAxis,
      yAxis,
      valueXField: "valueX",
      categoryYField: "categoryY",
      rotated: true,
    }),
  );

  series.setAll({
    clustered: false,
  });

  const tooltip = isDataQualityAm5BarContext(detail, previewSlimBarWidthPx)
    ? createAgingStyleHorizontalBarTooltip(root, am5, metricLabel)
    : createCompactSeriesLinkedTooltip(
        root,
        am5,
        (di) => {
          const cat = String(di.get?.("categoryY") ?? "");
          const vx = Number(di.get?.("valueX"));
          const fv = Number.isFinite(vx) ? formatCompactAxisValue(vx) : "";
          return `${cat}\n${metricLabel}: ${fv}`;
        },
        "horizontal",
      );
  series.set("tooltip", tooltip);

  series.columns.template.setAll({
    cornerRadiusTL: 3,
    cornerRadiusBL: 3,
    cornerRadiusTR: 3,
    cornerRadiusBR: 3,
    strokeWidth: 1,
    stroke: am5.color(0xffffff),
    strokeOpacity: 0.42,
    fillOpacity: 0.96,
    height: barThickness,
    cursorOverStyle: "pointer",
    tooltipX: am5.p100,
    tooltipY: am5.p50,
  });

  /** Bar colour from value: green (strong), amber (mid), orange (weak) — matches DQ scorecard thresholds when axis ~0–100. */
  const scoreHueGradient = (value: number, axisMax: number) => {
    const colorScore = axisMax > 0 && axisMax <= 110 ? value : (value / axisMax) * 100;
    let top: number;
    let bot: number;
    if (colorScore >= 85) {
      top = 0x4ade80;
      bot = 0x16a34a;
    } else if (colorScore >= 60) {
      top = 0xfbbf24;
      bot = 0xd97706;
    } else {
      top = 0xfb923c;
      bot = 0xea580c;
    }
    return am5.LinearGradient.new(root, {
      rotation: 0,
      stops: [
        { color: am5.color(top), offset: 0 },
        { color: am5.color(bot), offset: 1 },
      ],
    });
  };

  series.columns.template.adapters.add("fillGradient", (_g, target) => {
    const di = (target as { dataItem?: { get?: (k: string) => unknown } }).dataItem;
    const vx = Number(di?.get?.("valueX"));
    const val = Number.isFinite(vx) ? vx : 0;
    return scoreHueGradient(val, xMax);
  });

  attachGroupedBarColumnHoverState(series, am5, isDark);
  attachGroupedBarColumnPointerUx(series, am5);
  attachDrilldownOnColumnSeries(series, !!drilldown?.onCategory, drilldown?.onCategory, false);

  series.bullets.push(() => {
    const endLabel = am5.Label.new(root, {
      text: "{valueX.formatNumber('#,###.##')}",
      populateText: true,
      fontSize: 10,
      fontWeight: "700",
      fill: labelColor,
      centerY: am5.p50,
      dx: 6,
      oversizedBehavior: "truncate",
      maxWidth: 72,
    });
    endLabel.adapters.add("text", (_text, target) => {
      const di = (target as { dataItem?: { get?: (k: string) => unknown } }).dataItem;
      const vx = di?.get?.("valueX");
      const num = vx == null ? NaN : Number(vx);
      if (!Number.isFinite(num)) return String(_text ?? "");
      return formatCompactAxisValue(num);
    });
    return am5.Bullet.new(root, {
      locationX: 1,
      locationY: 0.5,
      sprite: endLabel,
    });
  });

  yAxis.data.setAll(chartData);
  series.data.setAll(chartData);

  if (needsYZoom) {
    const endFrac = zoomVisible / barCount;
    const scrollbarY = am5.Scrollbar.new(root, {
      orientation: "vertical",
      marginRight: 2,
      marginTop: 6,
      marginBottom: 6,
      minWidth: 10,
      start: 0,
      end: endFrac,
    });
    chart.set("scrollbarY", scrollbarY);
    chart.rightAxesContainer.children.push(scrollbarY);
    scrollbarY.thumb.setAll({
      fillOpacity: 0.35,
      fill: isDark ? am5.color(0x64748b) : am5.color(0x94a3b8),
    });
    yAxis.events.once("datavalidated", () => {
      yAxis.zoomToIndexes(0, zoomVisible - 1);
    });
  }

  series.appear(600);
}
