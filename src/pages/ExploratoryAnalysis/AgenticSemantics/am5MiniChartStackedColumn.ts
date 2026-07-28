import type { ChartDetail } from "./chartTypes";
import {
  MINI_XY_CHART_PADDING,
  GROUPED_BAR_SHINE_PALETTES,
  FEW_BAR_COLUMN_WIDTH_PX,
  isFewBarCategories,
  niceYAxisMax,
  SINGLE_BAR_SCROLLBAR_INITIAL_VISIBLE,
} from "./am5MiniChartConstants";
import {
  BAR_COLUMN_WIDTH_PCT,
  getCategoryCellLocations,
  attachGroupedBarColumnHoverState,
  attachGroupedBarColumnPointerUx,
  attachDrilldownOnColumnSeries,
  createCompactSeriesLinkedTooltip,
  formatCompactAxisValue,
  truncateCategoryAxisLabel,
} from "./am5MiniChartHelpers";

function humanizeFieldName(field: string): string {
  return field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Field name looks like a percentage / rate column (do not raw-stack with counts). */
function keySuggestsPercentField(name: string): boolean {
  return /pct|percent|ratio|_rate$|rate$|percentage|proportion|share/i.test(name);
}

/** Mixing e.g. violation_pct + violation_count — use 100%-style stack so the bar is meaningful. */
function stackedMixesPercentAndNonPercentMeasures(valueKeys: string[]): boolean {
  if (valueKeys.length < 2) return false;
  const pctNamed = valueKeys.filter(keySuggestsPercentField);
  const other = valueKeys.filter((k) => !keySuggestsPercentField(k));
  return pctNamed.length > 0 && other.length > 0;
}

type StackSemantic = "bad" | "good" | "neutral";

function stackSemanticClass(valueKey: string): StackSemantic {
  const k = valueKey.toLowerCase();
  const bad =
    /violat|failure|fail_|_fail|err_|error|invalid|breach|reject|anomal|defect|fault|non_?compliant|broken|issue_count|fail_count|error_count/i.test(
      k,
    );
  if (bad) return "bad";
  const good =
    /valid_count|pass_count|compliant|passed|success|clean|healthy|valid_rate|pass_rate|good_rate|_valid_|_pass_|^valid$|^pass$/i.test(
      k,
    );
  if (good) return "good";
  return "neutral";
}

/** Nth series within the same class (e.g. 2nd “bad” field) gets a clearly different hue from the 1st. */
function stackSemanticSlot(valueKeys: string[], zIdx: number): number {
  const cls = stackSemanticClass(valueKeys[zIdx]);
  let slot = 0;
  for (let i = 0; i < zIdx; i++) {
    if (stackSemanticClass(valueKeys[i]) === cls) slot++;
  }
  return slot;
}

/**
 * High-contrast pairs first: blue vs orange (complements) so a thin normalized slice
 * still reads against a large neighbour — better than red vs orange (adjacent hues).
 */
const STACK_BAD_DISTINCT_HEX = ["#1D4ED8", "#EA580C", "#DC2626", "#A855F7", "#0D9488", "#CA8A04"];
const STACK_GOOD_DISTINCT_HEX = ["#15803D", "#2563EB", "#0D9488", "#65A30D", "#047857"];

function stackSegmentFillHex(valueKeys: string[], zIdx: number): string {
  const cls = stackSemanticClass(valueKeys[zIdx]);
  const slot = stackSemanticSlot(valueKeys, zIdx);
  if (cls === "bad") {
    return STACK_BAD_DISTINCT_HEX[slot % STACK_BAD_DISTINCT_HEX.length];
  }
  if (cls === "good") {
    return STACK_GOOD_DISTINCT_HEX[slot % STACK_GOOD_DISTINCT_HEX.length];
  }
  return GROUPED_BAR_SHINE_PALETTES[slot % GROUPED_BAR_SHINE_PALETTES.length][1];
}

function shortLegendTitle(field: string, maxChars: number): string {
  const h = humanizeFieldName(field);
  if (h.length <= maxChars) return h;
  return `${h.slice(0, Math.max(4, maxChars - 1))}…`;
}

/** When one series is orders of magnitude larger, stack as % of row total so segments stay visible. */
function shouldNormalizeStackedSeries(valueKeys: string[], rows: Record<string, unknown>[]): boolean {
  if (valueKeys.length < 2) return false;
  if (stackedMixesPercentAndNonPercentMeasures(valueKeys)) return true;
  const colMax = valueKeys.map((k) =>
    Math.max(0, ...rows.map((r) => Math.abs(Number((r as Record<string, unknown>)[k]) || 0))),
  );
  const positive = colMax.filter((m) => m > 0);
  if (positive.length < 2) return false;
  const minM = Math.min(...positive);
  const maxM = Math.max(...positive);
  return maxM / minM >= 18;
}

/**
 * Vertical stacked column: one bar per category; each `ColumnSeries` sets `stacked: true` (amCharts 5),
 * matching the official demos — otherwise columns draw from y=0 and overlap (one colour visible).
 * Percent + count in the same bar forces 100%-style stacking; problem vs healthy metrics
 * use high-contrast hue pairs (e.g. blue + orange for two “bad” metrics); good metrics use green + blue.
 */
export async function renderAm5StackedColumnChart(
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
  /** Data preview: fixed column width in px. */
  previewSlimBarWidthPx?: number,
): Promise<void> {
  const am5xy = await import("@amcharts/amcharts5/xy");
  const labelColor = isDark ? am5.color(0xcccccc) : am5.color(0x555555);
  const gridStroke = isDark ? am5.color(0x64748b) : am5.color(0x94a3b8);
  const legendFontSize = 10;
  const legendMarkerSize = 11;
  const legendItemSpacing = 2;
  const legendMarkerTextGap = 2;

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

  const valueKeysFiltered = keys.filter(
    (k) =>
      k !== categoryKey &&
      (legacyHasCategory ? k !== "category" : true) &&
      typeof first[k] === "number",
  );
  if (valueKeysFiltered.length === 0) return;
  /** Pct-like metrics at stack bottom, counts on top — clearer when magnitudes differ. */
  const valueKeys = [...valueKeysFiltered].sort((a, b) => {
    const rank = (k: string) =>
      /pct|percent|ratio/i.test(k) ? 0 : /count|violations?$/i.test(k) ? 2 : 1;
    return rank(a) - rank(b);
  });

  const baseRows = rawData.map((row) => {
    const r = row as Record<string, unknown>;
    const out: Record<string, unknown> = {
      xCategory: String(r[categoryKey] ?? ""),
    };
    for (const vk of valueKeys) {
      out[vk] = Number(r[vk]) || 0;
    }
    return out;
  });

  const normalizeStack = shouldNormalizeStackedSeries(valueKeys, baseRows);

  const chartData = normalizeStack
    ? baseRows.map((d) => {
        const r = d as Record<string, unknown>;
        const sum =
          valueKeys.reduce((s, k) => s + (Math.abs(Number(r[k]) || 0) || 0), 0) || 1;
        const __raw: Record<string, number> = {};
        const out: Record<string, unknown> = { xCategory: r.xCategory, __raw };
        for (const vk of valueKeys) {
          const v = Math.abs(Number(r[vk]) || 0);
          __raw[vk] = v;
          out[vk] = (v / sum) * 100;
        }
        return out;
      })
    : baseRows.map((d) => {
        const r = d as Record<string, unknown>;
        const __raw: Record<string, number> = {};
        for (const vk of valueKeys) {
          __raw[vk] = Number(r[vk]) || 0;
        }
        return { ...r, __raw };
      });

  const totals = chartData.map((d) => {
    const raw = (d as Record<string, unknown>).__raw as Record<string, number> | undefined;
    if (raw) {
      return valueKeys.reduce((s, k) => s + (Number(raw[k]) || 0), 0);
    }
    return valueKeys.reduce((s, k) => s + (Number((d as Record<string, unknown>)[k]) || 0), 0);
  });
  const maxStack = normalizeStack ? 100 : Math.max(0, ...totals);
  const yMax = normalizeStack ? 100 : niceYAxisMax(maxStack);

  const barCount = chartData.length;
  const needsXZoom = barCount > SINGLE_BAR_SCROLLBAR_INITIAL_VISIBLE;
  const zoomVisible = Math.min(SINGLE_BAR_SCROLLBAR_INITIAL_VISIBLE, barCount);

  const chart = root.container.children.push(
    am5xy.XYChart.new(root, {
      panX: false,
      panY: false,
      wheelX: "none" as const,
      wheelY: "none" as const,
      layout: root.verticalLayout,
      paddingTop: MINI_XY_CHART_PADDING.top + (valueKeys.length > 1 ? 6 : 0),
      paddingBottom: MINI_XY_CHART_PADDING.bottom + 12 + (needsXZoom ? 8 : 0),
      paddingLeft: MINI_XY_CHART_PADDING.side,
      paddingRight: MINI_XY_CHART_PADDING.side,
    }),
  );
  /** Stacking is per-series in amCharts 5 (`ColumnSeries.stacked`); chart-level `stacked` is ignored and columns overlap. */

  const cellLoc = getCategoryCellLocations(true);
  const rotateCats = barCount > 5 || chartData.some((d) => String((d as Record<string, unknown>).xCategory).length > 10);
  const xRenderer = am5xy.AxisRendererX.new(root, {
    minGridDistance: Math.max(28, 14 + barCount * 2),
    cellStartLocation: cellLoc.cellStartLocation,
    cellEndLocation: cellLoc.cellEndLocation,
  });
  /** Vertical lines per category — slightly stronger stroke so they survive light themes / zoom. */
  xRenderer.grid.template.setAll({
    visible: true,
    stroke: gridStroke,
    strokeOpacity: isDark ? 0.5 : 0.62,
    strokeWidth: 1,
    location: 0.5,
  });
  xRenderer.labels.template.setAll({
    fontSize: 9,
    fontWeight: "700",
    fill: labelColor,
    oversizedBehavior: "truncate",
    maxWidth: rotateCats ? 78 : 88,
    rotation: rotateCats ? -40 : 0,
    centerY: am5.p50,
    centerX: rotateCats ? am5.p100 : am5.p50,
  });
  xRenderer.labels.template.adapters.add("text", (_text, target) => {
    const di = (target as { dataItem?: { get?: (k: string) => unknown } }).dataItem;
    const cat = di?.get?.("category");
    return truncateCategoryAxisLabel(String(cat ?? _text ?? ""), rotateCats ? 11 : 13);
  });

  const xAxis = chart.xAxes.push(
    am5xy.CategoryAxis.new(root, {
      categoryField: "xCategory",
      renderer: xRenderer,
    }),
  );

  const yRenderer = am5xy.AxisRendererY.new(root, {
    minGridDistance: 18,
  });
  yRenderer.grid.template.setAll({
    stroke: gridStroke,
    strokeOpacity: 0.28,
    strokeWidth: 1,
    visible: true,
  });
  yRenderer.labels.template.setAll({
    fontSize: 10,
    fontWeight: "700",
    fill: labelColor,
    maxWidth: 44,
    oversizedBehavior: "truncate",
  });

  const yAxis = chart.yAxes.push(
    am5xy.ValueAxis.new(root, {
      renderer: yRenderer,
      min: 0,
      max: yMax,
      strictMinMax: true,
      extraMax: normalizeStack ? 0.03 : 0.015,
    }),
  );

  const metricLabel = (
    normalizeStack ? "Share of row (%)" : (detail.metric_name || detail.title || "Value")
  ).replace(/[[\]]/g, "");
  yAxis.children.unshift(
    am5.Label.new(root, {
      text: metricLabel,
      rotation: -90,
      y: am5.p50,
      centerX: am5.p50,
      fontSize: 10,
      fontWeight: "700",
      fill: labelColor,
      paddingRight: 4,
    }),
  );

  const lastSeriesIndex = valueKeys.length - 1;

  valueKeys.forEach((valueKey, zIdx) => {
    const seriesNameFull = humanizeFieldName(valueKey);
    const seriesTitle = shortLegendTitle(valueKey, 22);
    const segmentFillHex = stackSegmentFillHex(valueKeys, zIdx);

    const tooltip = createCompactSeriesLinkedTooltip(root, am5, (di) => {
      const cat = String(di.get?.("categoryX") ?? "");
      const ctx = (di as { dataContext?: Record<string, unknown> }).dataContext;
      const raw = ctx?.__raw as Record<string, number> | undefined;
      const rawVal = raw && valueKey in raw ? Number(raw[valueKey]) : Number(di.get?.("valueY"));
      const fv = Number.isFinite(rawVal) ? formatCompactAxisValue(rawVal) : "";
      const plotVal = Number(di.get?.("valueY"));
      const stackHint =
        normalizeStack && Number.isFinite(plotVal)
          ? `\n${plotVal.toFixed(1)}% of stack`
          : "";
      return `${seriesNameFull}\n${cat}\n${fv}${stackHint}`;
    });

    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: seriesTitle,
        stacked: true,
        xAxis,
        yAxis,
        categoryXField: "xCategory",
        valueYField: valueKey,
        tooltip,
      }),
    );
    series.setAll({
      /** Center in category cell — 0/1 span caused stacked columns to bleed into neighbours. */
      openLocationX: 0.5,
      locationX: 0.5,
      clustered: false,
    });
    series.columns.template.setAll({
      centerX: am5.p50,
      cornerRadiusTL: zIdx === lastSeriesIndex ? 4 : 1,
      cornerRadiusTR: zIdx === lastSeriesIndex ? 4 : 1,
      cornerRadiusBL: zIdx === 0 ? 4 : 1,
      cornerRadiusBR: zIdx === 0 ? 4 : 1,
      strokeWidth: 1.5,
      stroke: am5.color(0xffffff),
      strokeOpacity: 0.92,
      fillOpacity: 1,
      fill: am5.color(segmentFillHex),
      width: isFewBarCategories(barCount)
        ? FEW_BAR_COLUMN_WIDTH_PX
        : previewSlimBarWidthPx ?? am5.percent(BAR_COLUMN_WIDTH_PCT),
      tooltipY: am5.p50,
      cursorOverStyle: "pointer",
      tooltipPosition: "pointer",
      interactive: true,
    });

    /** One label per segment, vertically centered inside that segment (not a combined label at stack top). */
    series.bullets.push((_root, _series, dataItem) => {
      const vy = Number(dataItem.get("valueY"));
      if (!Number.isFinite(vy) || vy <= 0) return undefined;
      if (normalizeStack && vy < 2) return undefined;

      const ctx = (dataItem as { dataContext?: Record<string, unknown> }).dataContext;
      const raw = ctx?.__raw as Record<string, number> | undefined;
      const rawVal = raw && valueKey in raw ? Number(raw[valueKey]) : vy;
      /** Prefer raw counts/pcts in the segment when normalized (stack height is %; label matches business numbers). */
      const labelText =
        raw && valueKey in raw && Number.isFinite(rawVal)
          ? formatCompactAxisValue(rawVal)
          : normalizeStack
            ? `${vy.toFixed(1)}%`
            : formatCompactAxisValue(vy);
      if (!labelText.trim()) return undefined;

      const segmentLabel = am5.Label.new(root, {
        text: labelText,
        populateText: true,
        centerX: am5.p50,
        centerY: am5.p50,
        fontSize: barCount > 10 ? 8 : 9,
        fontWeight: "800",
        fill: am5.color(0xffffff),
        oversizedBehavior: "fit",
        maxWidth: 92,
        textAlign: "center",
      });
      segmentLabel.setAll({
        shadowColor: am5.color(0x020617),
        shadowBlur: 2.5,
        shadowOpacity: 0.55,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
      });

      return am5.Bullet.new(root, {
        locationX: 0.5,
        locationY: 0.5,
        sprite: segmentLabel,
      });
    });

    attachGroupedBarColumnHoverState(series, am5, isDark);
    attachGroupedBarColumnPointerUx(series, am5);
    attachDrilldownOnColumnSeries(series, !!drilldown?.onCategory, drilldown?.onCategory, false);
    series.data.setAll(chartData);
    series.appear(600, zIdx * 70);
  });

  xAxis.data.setAll(chartData);

  if (needsXZoom) {
    const endFrac = zoomVisible / barCount;
    const scrollbarX = am5.Scrollbar.new(root, {
      orientation: "horizontal",
      marginBottom: 4,
      minHeight: 8,
      start: 0,
      end: endFrac,
    });
    chart.set("scrollbarX", scrollbarX);
    chart.bottomAxesContainer.children.push(scrollbarX);
    scrollbarX.thumb.setAll({
      fillOpacity: 0.35,
      fill: isDark ? am5.color(0x64748b) : am5.color(0x94a3b8),
    });
    xAxis.events.once("datavalidated", () => {
      xAxis.zoomToIndexes(0, zoomVisible - 1);
    });
  }

  const legend = am5.Legend.new(root, {
    centerX: am5.p50,
    x: am5.p50,
    layout: root.horizontalLayout,
    marginTop: 2,
    marginBottom: 0,
    useDefaultMarker: true,
  });
  chart.children.push(legend);
  legend.itemContainers.template.setAll({
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: legendItemSpacing,
  });
  legend.labels.template.setAll({
    fontSize: legendFontSize,
    fontWeight: "700",
    fill: labelColor,
    paddingLeft: 0,
    paddingRight: 2,
  });
  legend.markers.template.setAll({
    width: legendMarkerSize,
    height: legendMarkerSize,
    marginRight: legendMarkerTextGap,
  });
  legend.data.setAll(chart.series.values);

  chart.set(
    "cursor",
    am5xy.XYCursor.new(root, {
      behavior: "none",
      xAxis,
      yAxis,
    }),
  );
}
