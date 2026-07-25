import {
  GROUPED_BAR_SCROLLBAR_INITIAL_VISIBLE,
  GROUPED_BAR_SHINE_PALETTES,
  SINGLE_BAR_SCROLLBAR_INITIAL_VISIBLE,
  niceYAxisMax,
} from "./am5MiniChartConstants";
import { getValueAxisRange, hideAm5LegendForDomReplacement } from "./am5MiniChartHelpers";
import { isDataQualityChartDetail } from "./chartTypes";
import type { Am5XyChartContext } from "./am5MiniChartXyTypes";

/** Single-series category bar: initial zoom window for data-quality dashboard charts. */
const SINGLE_BAR_SCROLLBAR_INITIAL_VISIBLE_DATA_QUALITY = 20;

function getOrderedAxisCategories(xAxis: any): string[] {
  const cats: string[] = [];
  const len = xAxis.data.length;
  for (let i = 0; i < len; i++) {
    const row = xAxis.data.getIndex(i) as { xCategory?: string } | undefined;
    const cat = String(row?.xCategory ?? "");
    if (cat) cats.push(cat);
  }
  if (cats.length > 0) return cats;

  const itemLen = xAxis.dataItems.length;
  for (let i = 0; i < itemLen; i++) {
    const rowCtx = xAxis.dataItems[i]?.dataContext as { xCategory?: string } | undefined;
    const cat = String(rowCtx?.xCategory ?? xAxis.dataItems[i]?.get?.("category") ?? "");
    if (cat) cats.push(cat);
  }
  return cats;
}

function getVisibleIndexRange(
  xAxis: any,
  chart: any,
  pointCount: number,
): { start: number; end: number } {
  if (pointCount <= 0) return { start: 0, end: -1 };

  let startPos = xAxis.get("start", 0);
  let endPos = xAxis.get("end", 1);

  /** Axis can still read 0–1 while the scrollbar thumb already moved. */
  const sb = chart.get("scrollbarX");
  if (sb && startPos === 0 && endPos === 1) {
    const sbStart = sb.get("start", 0);
    const sbEnd = sb.get("end", 1);
    if (sbStart > 0 || sbEnd < 1) {
      startPos = sbStart;
      endPos = sbEnd;
    }
  }

  const startIndex = Math.max(0, Math.floor(startPos * pointCount));
  const endIndex = Math.min(
    pointCount - 1,
    Math.max(startIndex, Math.ceil(endPos * pointCount) - 1),
  );
  return { start: startIndex, end: endIndex };
}

function forEachSeriesDataItem(
  chart: any,
  fn: (dataItem: { get?: (k: string) => unknown }) => void,
): void {
  const seriesList = chart.series?.values ?? [];
  for (const series of seriesList) {
    let handled = false;
    if (series.dataItems?.each) {
      series.dataItems.each((di: { get?: (k: string) => unknown }) => {
        handled = true;
        fn(di);
      });
    }
    if (!handled && series.columns?.each) {
      series.columns.each((col: { dataItem?: { get?: (k: string) => unknown } }) => {
        if (col.dataItem) fn(col.dataItem);
      });
    }
  }
}

function collectVisibleYValues(ctx: Am5XyChartContext): number[] {
  const { chart, xAxis, isDateBased } = ctx;
  const vals: number[] = [];

  const pushVy = (di: { get?: (k: string) => unknown }) => {
    const vy = Number(di.get?.("valueY"));
    if (Number.isFinite(vy)) vals.push(vy);
  };

  if (isDateBased) {
    let startPos = xAxis.get("start", 0);
    let endPos = xAxis.get("end", 1);
    const sb = chart.get("scrollbarX");
    if (sb && startPos === 0 && endPos === 1) {
      const sbStart = sb.get("start", 0);
      const sbEnd = sb.get("end", 1);
      if (sbStart > 0 || sbEnd < 1) {
        startPos = sbStart;
        endPos = sbEnd;
      }
    }
    const tMin = xAxis.positionToValue(startPos);
    const tMax = xAxis.positionToValue(endPos);
    if (!Number.isFinite(tMin) || !Number.isFinite(tMax)) return vals;
    const lo = Math.min(tMin, tMax);
    const hi = Math.max(tMin, tMax);

    forEachSeriesDataItem(chart, (di) => {
      const vx = Number(di.get?.("valueX"));
      if (!Number.isFinite(vx) || vx < lo || vx > hi) return;
      pushVy(di);
    });
    return vals;
  }

  const axisCategories = getOrderedAxisCategories(xAxis);
  const pointCount = axisCategories.length;
  if (pointCount === 0) {
    forEachSeriesDataItem(chart, pushVy);
    return vals;
  }

  const { start, end } = getVisibleIndexRange(xAxis, chart, pointCount);
  if (end < start) return vals;

  const visibleSet = new Set(axisCategories.slice(start, end + 1));
  forEachSeriesDataItem(chart, (di) => {
    const catX = String(di.get?.("categoryX") ?? "");
    if (!visibleSet.has(catX)) return;
    pushVy(di);
  });
  return vals;
}

function applyYRangeToVisibleXWindow(ctx: Am5XyChartContext): void {
  const { yAxis, isBarOrColumn } = ctx;
  const vals = collectVisibleYValues(ctx);
  if (vals.length === 0) return;

  if (isBarOrColumn) {
    const maxVal = Math.max(0, ...vals);
    yAxis.setAll({
      min: 0,
      max: niceYAxisMax(maxVal),
      strictMinMax: true,
      maxDeviation: 0,
    });
  } else {
    const r = getValueAxisRange(vals);
    yAxis.setAll({
      min: r.min,
      max: r.max,
      strictMinMax: true,
    });
  }
  yAxis.markDirty?.();
}

/** Recompute Y-axis min/max from values in the current X zoom window (line + bar scrollbars). */
function attachVisibleXWindowYAxisSync(
  ctx: Am5XyChartContext,
  scrollbar: any,
  {
    syncZoomFromScrollbar = false,
    afterZoom,
  }: { syncZoomFromScrollbar?: boolean; afterZoom?: () => void } = {},
): void {
  const { root, chart, xAxis } = ctx;
  let yRangeFramePending = false;
  const scheduleYRangeForVisibleX = () => {
    if (yRangeFramePending) return;
    yRangeFramePending = true;
    root.events.once("frameended", () => {
      yRangeFramePending = false;
      applyYRangeToVisibleXWindow(ctx);
    });
  };

  const syncXZoomFromScrollbar = () => {
    const sb = chart.get("scrollbarX");
    if (!sb) return;
    const s = sb.get("start", 0);
    const e = sb.get("end", 1);
    xAxis.zoom(s, e, 0);
  };

  const onScrollbarRangeChanged = () => {
    if (syncZoomFromScrollbar) syncXZoomFromScrollbar();
    scheduleYRangeForVisibleX();
  };

  const bootstrapVisibleYRange = () => {
    afterZoom?.();
    if (syncZoomFromScrollbar) syncXZoomFromScrollbar();
    scheduleYRangeForVisibleX();
  };

  let bootstrapAttempts = 0;
  const bootstrapWhenSeriesReady = () => {
    bootstrapAttempts += 1;
    const hasSeriesPoints = (chart.series?.values ?? []).some(
      (s: { dataItems?: { length?: number } }) => (s.dataItems?.length ?? 0) > 0,
    );
    if (!hasSeriesPoints && bootstrapAttempts < 8) {
      root.events.once("frameended", bootstrapWhenSeriesReady);
      return;
    }
    bootstrapVisibleYRange();
  };

  /**
   * xAxis `datavalidated` often fires during series render, before finalize runs.
   * Bootstrap on chart/series validation + next frames so initial zoom and Y range apply.
   */
  chart.events.once("datavalidated", bootstrapWhenSeriesReady);
  const firstSeries = chart.series?.getIndex?.(0);
  firstSeries?.events?.once?.("datavalidated", bootstrapWhenSeriesReady);
  root.events.once("frameended", bootstrapWhenSeriesReady);

  scrollbar.events.on("rangechanged", onScrollbarRangeChanged);
  xAxis.on("start", scheduleYRangeForVisibleX);
  xAxis.on("end", scheduleYRangeForVisibleX);
}

export function finalizeAm5XyChart(ctx: Am5XyChartContext): void {
  const {
    root,
    am5,
    am5xy,
    chart,
    xAxis,
    yAxis,
    rawData,
    detail,
    isBarOrColumn,
    isGroupedBar,
    isMultiSeries,
    isDateBased,
    dateKey,
    valueKey,
    categoryAxisKey,
    labelColor,
    legendFontSize,
    legendMarkerSize,
    legendItemSpacing,
    legendMarkerTextGap,
    isDark,
    workspaceDrilldownActive,
  } = ctx;

  if (isBarOrColumn) {
    const yRenderer = yAxis.get("renderer");
    const capBarYAxisLabelCount = () => {
      const len = yRenderer.axisLength();
      if (len <= 0) return;
      // Allow ~3–4 y-axis tick labels on short mini charts; max(96, len/2) forced only two.
      yRenderer.set("minGridDistance", Math.max(20, len / 3.5));
    };
    yAxis.events.once("datavalidated", capBarYAxisLabelCount);
    root.events.once("frameended", capBarYAxisLabelCount);
  }

  if (isMultiSeries && isGroupedBar) {
    const legend = am5.Legend.new(root, {
      centerX: am5.p50,
      x: am5.p50,
      layout: root.horizontalLayout,
      marginTop: 8,
      marginBottom: 4,
      useDefaultMarker: true,
    });
    chart.children.push(legend);
    legend.itemContainers.template.setAll({
      paddingTop: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      paddingRight: legendItemSpacing,
      marginTop: 0,
      marginBottom: 0,
    });
    legend.labels.template.setAll({
      fontSize: legendFontSize,
      fontWeight: "700",
      fill: labelColor,
      paddingLeft: 0,
      paddingRight: 2,
    });
    legend.valueLabels.template.setAll({
      fontSize: legendFontSize,
      fontWeight: "700",
      fill: labelColor,
    });
    legend.markers.template.setAll({
      width: legendMarkerSize,
      height: legendMarkerSize,
      marginRight: legendMarkerTextGap,
    });
    legend.data.setAll(chart.series.values);
    hideAm5LegendForDomReplacement(legend);
    ctx.domLegendItems = chart.series.values.map((s: { get?: (k: string) => unknown }, index: number) => {
      const pal =
        GROUPED_BAR_SHINE_PALETTES[index % GROUPED_BAR_SHINE_PALETTES.length] as readonly [
          string,
          string,
          string,
        ];
      return {
        id: String(s.get?.("name") ?? index),
        line: String(s.get?.("name") ?? ""),
        color: pal[1],
      };
    });
  }

  /** Grouped-bar snap cursor competes with column hit targets; omit when drilldown needs reliable clicks. */
  const useGroupedSnap =
    isGroupedBar && isBarOrColumn && !workspaceDrilldownActive;

  const lineSnapSeries = !isBarOrColumn
    ? chart.series.values.filter((s: { strokes?: unknown; columns?: unknown }) =>
        s.strokes != null && s.columns == null,
      )
    : [];

  chart.set(
    "cursor",
    am5xy.XYCursor.new(root, {
      behavior: isBarOrColumn ? "none" : "zoomX",
      xAxis,
      yAxis,
      ...(isBarOrColumn
        ? useGroupedSnap
          ? {
              // Without this, CategoryAxis drives a tooltip for every series at the
              // same category; snap to nearest column by pointer distance instead.
              snapToSeries: chart.series.values as any,
              snapToSeriesBy: "xy",
            }
          : {}
        : {
            snapToSeries: (lineSnapSeries.length > 0
              ? lineSnapSeries
              : chart.series.values) as any,
          }),
    }),
  );

  const cursor = chart.get("cursor");
  if (cursor && !isBarOrColumn) {
    cursor.lineX?.setAll?.({ visible: true, strokeOpacity: 0.35 });
    cursor.lineY?.setAll?.({ visible: false });
  }

  const barCategoryCount = isBarOrColumn
    ? isDateBased
      ? [
          ...new Set(
            rawData.map((d: any) => String(d[dateKey] ?? "")),
          ),
        ].filter(Boolean).length || rawData.length
      : [
          ...new Set(
            rawData.map((d: any) => String(d[categoryAxisKey] ?? "")),
          ),
        ].filter(Boolean).length || rawData.length
    : 0;

  const groupedBarNeedsZoomBar =
    isBarOrColumn &&
    !isDateBased &&
    isGroupedBar &&
    barCategoryCount > GROUPED_BAR_SCROLLBAR_INITIAL_VISIBLE;

  if (groupedBarNeedsZoomBar) {
    const visibleCats = Math.min(
      GROUPED_BAR_SCROLLBAR_INITIAL_VISIBLE,
      barCategoryCount,
    );
    const endFrac = visibleCats / barCategoryCount;
    const scrollbar = am5.Scrollbar.new(root, {
      orientation: "horizontal",
      marginBottom: 8,
      minHeight: 12,
      start: 0,
      end: endFrac,
    });
    chart.set("scrollbarX", scrollbar);
    chart.bottomAxesContainer.children.push(scrollbar);
    scrollbar.thumb.setAll({
      fillOpacity: 0.35,
      fill: isDark ? am5.color(0x64748b) : am5.color(0x94a3b8),
    });
    attachVisibleXWindowYAxisSync(ctx, scrollbar, {
      syncZoomFromScrollbar: true,
      afterZoom: () => {
        xAxis.zoomToIndexes(0, visibleCats - 1);
      },
    });
  } else if (isBarOrColumn && barCategoryCount > 10) {
    const dqSingleBarVisible = isDataQualityChartDetail(detail)
      ? Math.min(SINGLE_BAR_SCROLLBAR_INITIAL_VISIBLE_DATA_QUALITY, barCategoryCount)
      : SINGLE_BAR_SCROLLBAR_INITIAL_VISIBLE;
    const scrollbarEnd = dqSingleBarVisible / barCategoryCount;
    const scrollbar = am5.Scrollbar.new(root, {
      orientation: "horizontal",
      marginBottom: 8,
      minHeight: 10,
      start: 0,
      end: scrollbarEnd,
    });
    chart.set("scrollbarX", scrollbar);
    chart.bottomAxesContainer.children.push(scrollbar);
    scrollbar.thumb.setAll({ fillOpacity: 0.2 });
    attachVisibleXWindowYAxisSync(ctx, scrollbar, {
      syncZoomFromScrollbar: true,
      afterZoom: !isDateBased
        ? () => {
            const lastIdx = isDataQualityChartDetail(detail)
              ? Math.min(
                  SINGLE_BAR_SCROLLBAR_INITIAL_VISIBLE_DATA_QUALITY,
                  barCategoryCount,
                ) - 1
              : Math.min(SINGLE_BAR_SCROLLBAR_INITIAL_VISIBLE, barCategoryCount);
            xAxis.zoomToIndexes(0, lastIdx);
          }
        : undefined,
    });
  } else if (!isBarOrColumn && rawData.length > 8) {
    const pointCount = rawData.length;
    const end = pointCount <= 20 ? 1 : Math.min(1, 20 / pointCount);
    const scrollbar = am5.Scrollbar.new(root, {
      orientation: "horizontal",
      marginBottom: 6,
      minHeight: 10,
      start: 0,
      end,
    });
    chart.set("scrollbarX", scrollbar);
    chart.bottomAxesContainer.children.push(scrollbar);
    scrollbar.thumb.setAll({ fillOpacity: 0.2 });

    if (!isDateBased) {
      attachVisibleXWindowYAxisSync(ctx, scrollbar, {
        syncZoomFromScrollbar: true,
        afterZoom: () => {
          xAxis.zoomToIndexes(0, 10);
        },
      });
    } else {
      attachVisibleXWindowYAxisSync(ctx, scrollbar, {
        syncZoomFromScrollbar: true,
      });
    }
  }

  chart.appear(800, 80);
}
