import type { ChartDetail } from "./chartTypes";
import {
  BAR_X_AXIS_END_LOCATION,
  BAR_X_AXIS_START_LOCATION,
  getCategoryCellLocations,
  getDateAxisBaseIntervalFromSortedTimes,
  extendTimeByDateAxisBaseInterval,
  getGroupedBarCategoryCellLocations,
  getValueAxisRange,
  formatCompactAxisValue,
} from "./am5MiniChartHelpers";
import { MINI_XY_CHART_PADDING } from "./am5MiniChartConstants";
import {
  BAR_CATEGORY_AXIS_LABEL_MAX_CHARS_COMPACT,
  BAR_CATEGORY_AXIS_LABEL_MAX_CHARS_GROUPED,
  countBarChartCategoryValues,
  DATE_AXIS_RELATIVE_PAD,
  GROUPED_BAR_COLUMN_WIDTH_PX,
  GROUPED_BAR_SCROLLBAR_INITIAL_VISIBLE,
  niceYAxisMax,
  resolveBarColumnWidthPx,
  VERTICAL_X_AXIS_LABEL_ELLIPSIS,
} from "./am5MiniChartConstants";
import { truncateCategoryAxisLabel } from "./am5MiniChartHelpers";
import type { Am5XyChartContext } from "./am5MiniChartXyTypes";

export async function setupAm5XyChart(
  root: any,
  am5: typeof import("@amcharts/amcharts5"),
  detail: ChartDetail,
  rawData: Record<string, unknown>[],
  chartType: string,
  isDark: boolean,
  drilldown?: {
    enabled: boolean;
    onCategory: (label: string) => void;
    /** Workspace drilldown toggle (ref-backed); avoids full chart remount on enable/disable. */
    getWorkspaceDrilldownActive?: () => boolean;
  },
  /** Data preview: fixed column/bar thickness in px (see DATA_PREVIEW_BAR_COLUMN_WIDTH_PX). */
  previewSlimBarWidthPx?: number,
): Promise<Am5XyChartContext> {
  const am5xy = await import("@amcharts/amcharts5/xy");

  const barCategoryCount = countBarChartCategoryValues(rawData, detail);
  const groupedBarColWidthPx = resolveBarColumnWidthPx(
    barCategoryCount,
    previewSlimBarWidthPx ?? GROUPED_BAR_COLUMN_WIDTH_PX,
  );

  const isBarOrColumn =
    (chartType.includes("bar") || chartType.includes("column")) &&
    !chartType.includes("horizontal_bar") &&
    !chartType.includes("stacked_bar");
  const isGroupedBar =
    chartType === "grouped_bar" || chartType.includes("grouped_bar");
  const isAreaChart = chartType.includes("area");

  const labelColor = isDark ? am5.color(0xcccccc) : am5.color(0x555555);

  /** Pan/wheel steal pointer gestures from column clicks; turn off while drilldown is on. */
  const wsDrillActive = drilldown?.getWorkspaceDrilldownActive?.() ?? false;
  const barPanZoom = isBarOrColumn && !wsDrillActive;

  const chart = root.container.children.push(
    am5xy.XYChart.new(root, {
      /** Line/area: no pan or wheel. Bars: LPG-style pan + wheel zoom (unless drilldown). */
      panX: barPanZoom,
      panY: false,
      wheelX: barPanZoom ? "panX" : "none",
      wheelY: "none",
      layout: root.verticalLayout,
      paddingTop: MINI_XY_CHART_PADDING.top,
      paddingBottom: MINI_XY_CHART_PADDING.bottom,
      ...(isBarOrColumn
        ? {
            paddingLeft: MINI_XY_CHART_PADDING.side,
            paddingRight: MINI_XY_CHART_PADDING.side,
            pinchZoomX: barPanZoom,
            panY: false,
          }
        : {
            paddingLeft: MINI_XY_CHART_PADDING.side,
            paddingRight: MINI_XY_CHART_PADDING.side,
          }),
    }),
  );

  if (!isBarOrColumn) {
    chart.plotContainer.set("maskContent", false);
    chart.seriesContainer.set("maskContent", false);
  }

  const keys = Object.keys(rawData[0] ?? {});
  const dateKey =
    keys.find((k) => k === "date" || k === "Date" || k === "timestamp") ??
    keys[0];
  const seriesKey = "category";
  const legacyHasCategoryCol = rawData.some((d) => (d as any)[seriesKey] != null);
  const userCategoryCol = (detail.category_column ?? "").trim();
  const categoryAxisKey =
    userCategoryCol && keys.includes(userCategoryCol)
      ? userCategoryCol
      : legacyHasCategoryCol
        ? seriesKey
        : dateKey;

  const valueKeys = keys.filter(
    (k) =>
      k !== dateKey &&
      k !== categoryAxisKey &&
      (legacyHasCategoryCol ? k !== seriesKey : true) &&
      typeof (rawData[0] as any)?.[k] === "number",
  );
  const valueKey = valueKeys[0] ?? "value";

  const hasCategory = legacyHasCategoryCol;
  const categories = hasCategory
    ? [...new Set(rawData.map((d: any) => String(d[seriesKey] ?? "")))]
    : [];
  const isMultiSeries = hasCategory && categories.length > 1;
  /** Matches scrollbar branch in finalize; no extra X padding so zoom shows edge points. */
  const lineChartUsesScrollbar =
    !isBarOrColumn && rawData.length > 8;

  const firstDateVal = rawData[0]?.[dateKey];
  const isDateBased =
    typeof firstDateVal === "string" &&
    !Number.isNaN(Date.parse(firstDateVal as string));

  const humanizeFieldName = (field: string) =>
    field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const maxNumericY =
    isGroupedBar && valueKeys.length > 0
      ? Math.max(
          0,
          ...rawData.flatMap((d: any) =>
            valueKeys.map((k) => Number(d[k]) || 0),
          ),
        )
      : Math.max(
          0,
          ...rawData.map((d: any) => Number(d[valueKey]) || 0),
        );
  const yAxisMaxBar =
    isBarOrColumn && maxNumericY > 0 ? niceYAxisMax(maxNumericY) : undefined;
  /** Match finalize scrollbar branches — leave Y axis unlocked so scroll can rescale it. */
  const barUsesXScrollbar =
    isBarOrColumn &&
    ((isGroupedBar &&
      !isDateBased &&
      barCategoryCount > GROUPED_BAR_SCROLLBAR_INITIAL_VISIBLE) ||
      barCategoryCount > 10);
  const yAxisMaxBarLocked =
    yAxisMaxBar != null && !barUsesXScrollbar ? yAxisMaxBar : undefined;
  const yAxisRangeLine = !isBarOrColumn
    ? getValueAxisRange(
        rawData
          .map((d: any) => Number(d[valueKey]))
          .filter((v) => Number.isFinite(v)),
      )
    : null;

  let sortedUniqueDateTimes: number[] = [];
  let dateAxisBaseInterval: { timeUnit: "day" | "month"; count: number } = {
    timeUnit: "day",
    count: 1,
  };
  if (isDateBased) {
    sortedUniqueDateTimes = [
      ...new Set(
        rawData
          .filter((d: any) => {
            const t = new Date(String(d?.[dateKey] ?? "")).getTime();
            if (!Number.isFinite(t)) return false;
            if (isBarOrColumn) return true;
            const v = d?.[valueKey];
            if (v == null || v === "" || !Number.isFinite(Number(v)))
              return false;
            return true;
          })
          .map((d: any) => new Date(String(d?.[dateKey] ?? "")).getTime()),
      ),
    ].sort((a: number, b: number) => a - b);
    dateAxisBaseInterval =
      getDateAxisBaseIntervalFromSortedTimes(sortedUniqueDateTimes);
  }

  /** Day-based line/area: ticks follow real data dates (matches tooltip); avoids skipped edge labels. */
  const useGaplessLineDayAxis =
    isDateBased &&
    !isBarOrColumn &&
    dateAxisBaseInterval.timeUnit === "day";

  let xAxis: any;
  if (isDateBased) {
    const DateAxisClass = useGaplessLineDayAxis
      ? am5xy.GaplessDateAxis
      : am5xy.DateAxis;
    xAxis = chart.xAxes.push(
      DateAxisClass.new(root, {
        baseInterval: dateAxisBaseInterval,
        renderer: am5xy.AxisRendererX.new(root, {
          /**
           * Gapless: lower distance shrinks overlap threshold so adjacent day labels
           * (e.g. Mar 17 / Mar 18) are less likely to be hidden vs. tooltip dates.
           */
          minGridDistance: isBarOrColumn
            ? 30
            : useGaplessLineDayAxis
              ? 12
              : 26,
          ...(isBarOrColumn ? getCategoryCellLocations(true) : {}),
        }),
        ...(isBarOrColumn ? { tooltip: am5.Tooltip.new(root, {}) } : {}),
      }),
    );
    if (dateAxisBaseInterval.timeUnit === "month") {
      xAxis.set("markUnitChange", false);
    }
  } else {
    const useGroupedBarXRenderer = isBarOrColumn && isGroupedBar;
    const groupedBarMinGrid =
      useGroupedBarXRenderer && valueKeys.length > 0
        ? Math.max(
            96,
            groupedBarColWidthPx * valueKeys.length + 56,
          )
        : 60;
    xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "xCategory",
        renderer: am5xy.AxisRendererX.new(root, {
          minGridDistance: useGroupedBarXRenderer
            ? groupedBarMinGrid
            : isBarOrColumn
              ? 24
              : 10,
          ...(useGroupedBarXRenderer
            ? getGroupedBarCategoryCellLocations()
            : getCategoryCellLocations(isBarOrColumn)),
        }),
      }),
    );
  }

  /** Line/area: no x-axis hover tooltip — series-linked tooltips only (avoids black date/category popover). */
  if (!isBarOrColumn) {
    xAxis.set("tooltip", undefined);
    xAxis.get("renderer").labels.template.setAll({
      tooltipText: "",
      interactive: false,
    });
    xAxis.get("renderer").labels.template.set("tooltip", undefined);
  }

  if (isBarOrColumn) {
    xAxis.set("startLocation", BAR_X_AXIS_START_LOCATION);
    xAxis.set("endLocation", BAR_X_AXIS_END_LOCATION);
  } else {
    const xRenderer = xAxis.get("renderer");
    if (isDateBased) {
      /** 0.02 hides labels in the first/last 2% — first date (e.g. Mar 17) had no tick text. */
      xRenderer?.setAll?.({
        minLabelPosition: 0,
        maxLabelPosition: 1,
      });
    } else {
      xRenderer?.setAll?.({
        minLabelPosition: 0.02,
        maxLabelPosition: 0.98,
      });
    }

    if (isDateBased) {
      xAxis.set("startLocation", 0);
      xAxis.set("endLocation", 1);
      /**
       * GaplessDateAxis: extraMin/extraMax > 0 injects synthetic days not present in chart_data.
       * Keep 0 so the axis only reflects real JSON timestamps.
       */
      if (useGaplessLineDayAxis) {
        xAxis.set("extraMin", 0);
        xAxis.set("extraMax", 0);
      } else {
        xAxis.set(
          "extraMin",
          lineChartUsesScrollbar ? 0.01 : DATE_AXIS_RELATIVE_PAD,
        );
        xAxis.set(
          "extraMax",
          lineChartUsesScrollbar ? 0.01 : DATE_AXIS_RELATIVE_PAD,
        );
      }

      const times = sortedUniqueDateTimes;

      if (times.length >= 2) {
        const lastTs = times[times.length - 1];
        const maxExtended = extendTimeByDateAxisBaseInterval(
          lastTs,
          dateAxisBaseInterval,
        );
        (xAxis as any).setAll({
          min: times[0],
          max: maxExtended,
          strictMinMax: true,
        });
      } else if (times.length === 1) {
        const pad = 12 * 60 * 60 * 1000;
        (xAxis as any).setAll({
          min: times[0] - pad,
          max: times[0] + pad,
          strictMinMax: true,
        });
      }
    } else {
      xAxis.set("startLocation", isBarOrColumn ? 0.5 : 0);
      xAxis.set("endLocation", isBarOrColumn ? 0.5 : 1);
      xAxis.set("extraMin", 0);
      xAxis.set("extraMax", 0);
    }
  }

  const yAxisMax = yAxisMaxBarLocked;
  const yAxis = chart.yAxes.push(
    am5xy.ValueAxis.new(root, {
      ...(isBarOrColumn
        ? {
            min: 0,
            ...(yAxisMax != null ? { max: yAxisMax } : {}),
            ...(yAxisMax != null
              ? { strictMinMax: true, maxDeviation: 0 }
              : { maxDeviation: 0.5 }),
          }
        : {
            min: yAxisRangeLine?.min ?? 0,
            max: yAxisRangeLine?.max ?? 1,
            strictMinMax: true,
          }),
      renderer: am5xy.AxisRendererY.new(root, {
        minGridDistance: isBarOrColumn ? 24 : 30,
        ...(isBarOrColumn ? { pan: "zoom" as const } : {}),
      }),
    }),
  );

  yAxis.set(
    "numberFormat",
    isBarOrColumn && maxNumericY > 0 && maxNumericY < 1000
      ? "#,###"
      : "#,###.##",
  );
  if (maxNumericY > 0 && maxNumericY < 10) {
    yAxis.set("maxPrecision", 3);
  } else if (maxNumericY > 0 && maxNumericY < 100) {
    yAxis.set("maxPrecision", 2);
  }
  const metricLabelForAxis = (detail.metric_name || detail.title || "Value").replace(
    /[[\]]/g,
    "",
  );
  const xAxisTitleText = (
    detail.category_column?.trim() ||
    (isDateBased
      ? humanizeFieldName(dateKey)
      : humanizeFieldName(String(categoryAxisKey)))
  ).replace(/[[\]]/g, "");
  if (isBarOrColumn) {
    yAxis.children.unshift(
      am5.Label.new(root, {
        rotation: -90,
        text: metricLabelForAxis,
        y: am5.p50,
        centerX: am5.p50,
        fontSize: 11,
        fill: labelColor,
        fontWeight: "700",
        paddingBottom: 0,
      }),
    );
    xAxis.set(
      "title",
      am5.Label.new(root, {
        text: xAxisTitleText,
        fontSize: 11,
        fill: labelColor,
        fontWeight: "700",
        x: am5.p50,
        centerX: am5.p50,
      }),
    );
  } else {
    yAxis.children.unshift(
      am5.Label.new(root, {
        rotation: -90,
        text: metricLabelForAxis,
        y: am5.p50,
        centerX: am5.p50,
        fontSize: 11,
        fill: labelColor,
        fontWeight: "700",
        paddingBottom: 0,
      }),
    );
    xAxis.set(
      "title",
      am5.Label.new(root, {
        text: xAxisTitleText,
        fontSize: 11,
        fill: labelColor,
        fontWeight: "700",
        x: am5.p50,
        centerX: am5.p50,
      }),
    );
  }
  const manyCategories = rawData.length > 6;
  const barCatCount = isBarOrColumn && !isDateBased ? rawData.length : 0;
  const rotateBarCategoryLabels = barCatCount > 12;
  const rotateLineLabels = !isBarOrColumn && rawData.length > 10;
  const axisLabelSize = isBarOrColumn ? 10 : 11;
  xAxis.get("renderer").labels.template.setAll({
    fontSize: axisLabelSize,
    fontWeight: "700",
    fill: labelColor,
    rotation:
      isBarOrColumn && !isDateBased
        ? rotateBarCategoryLabels
          ? -40
          : 0
        : rotateLineLabels
          ? -90
          : manyCategories
            ? -45
            : 0,
    centerY: am5.p50,
    centerX:
      isBarOrColumn && !isDateBased
        ? am5.p50
        : rotateLineLabels
          ? am5.p100
          : manyCategories
            ? am5.p100
            : am5.p50,
    maxWidth: isBarOrColumn ? (rotateBarCategoryLabels ? 160 : 130) : 110,
    oversizedBehavior:
      isBarOrColumn && !isDateBased && !rotateBarCategoryLabels ? "wrap" : "truncate",
    ellipsis: VERTICAL_X_AXIS_LABEL_ELLIPSIS,
    textAlign: "center",
    paddingTop: isBarOrColumn ? 6 : 6,
    paddingBottom: isBarOrColumn ? 4 : 0,
    location: 0.5,
    tooltipText: "",
    interactive: false,
  });
  if (isBarOrColumn && !isDateBased) {
    const barLabelMaxChars = isGroupedBar
      ? BAR_CATEGORY_AXIS_LABEL_MAX_CHARS_GROUPED
      : BAR_CATEGORY_AXIS_LABEL_MAX_CHARS_COMPACT;
    // Use axis dataItem category — adapter `text` can still be "{category}" before macros run;
    // truncating that string produced "{cate…" instead of real names.
    xAxis.get("renderer").labels.template.adapters.add("text", (text, target) => {
      const di = (target as { dataItem?: { get?: (k: string) => unknown } })
        .dataItem;
      const cat = di?.get?.("category");
      if (cat != null && String(cat) !== "") {
        return truncateCategoryAxisLabel(String(cat), barLabelMaxChars);
      }
      const t = String(text ?? "");
      if (t.includes("{") && t.includes("}")) return t;
      return truncateCategoryAxisLabel(t, barLabelMaxChars);
    });
  }
  yAxis.get("renderer").labels.template.setAll({
    fontSize: axisLabelSize,
    fontWeight: "700",
    fill: labelColor,
    maxWidth: 120,
    oversizedBehavior: "truncate",
    textAlign: "right",
  });
  yAxis.get("renderer").labels.template.adapters.add("text", (text, target) => {
    const di = (target as { dataItem?: { get?: (k: string) => unknown } }).dataItem;
    const v = di?.get?.("value");
    if (v != null && v !== "") {
      const num = Number(v);
      if (Number.isFinite(num)) return formatCompactAxisValue(num);
    }
    const parsed = Number(String(text ?? "").replace(/,/g, ""));
    if (Number.isFinite(parsed) && String(text ?? "").trim() !== "") {
      return formatCompactAxisValue(parsed);
    }
    return text;
  });
  const gridStroke = isDark ? am5.color(0x64748b) : am5.color(0x94a3b8);
  xAxis.get("renderer").grid.template.setAll({
    stroke: gridStroke,
    strokeOpacity: isBarOrColumn ? 0.25 : 0.25,
    strokeWidth: 1,
    visible: true,
  });
  yAxis.get("renderer").grid.template.setAll({
    stroke: gridStroke,
    strokeOpacity: isBarOrColumn ? 0.25 : 0.25,
    strokeWidth: 1,
    visible: true,
  });

  if (isBarOrColumn) {
    const xRenderer = xAxis.get("renderer");
    xRenderer.set("marginTop", 4);
    xRenderer.set("marginBottom", !isDateBased ? 8 : 2);
    if (!isDateBased) {
      xRenderer.set("minHeight", barCatCount > 12 ? 72 : 56);
    } else {
      xRenderer.set("minHeight", 40);
    }
  }

  const legendFontSize = 10;
  const legendMarkerSize = 12;
  const legendItemSpacing = 0;
  const legendMarkerTextGap = 2;

  return {
    root,
    am5,
    am5xy,
    chart,
    xAxis,
    yAxis,
    detail,
    rawData,
    chartType,
    isDark,
    isBarOrColumn,
    isGroupedBar,
    isAreaChart,
    isMultiSeries,
    isDateBased,
    dateKey,
    categoryAxisKey,
    seriesKey,
    valueKeys,
    valueKey,
    categories,
    keys,
    legacyHasCategoryCol,
    humanizeFieldName,
    metricLabelForAxis,
    xAxisTitleText,
    labelColor,
    maxNumericY,
    gridStroke,
    legendFontSize,
    legendMarkerSize,
    legendItemSpacing,
    legendMarkerTextGap,
    axisLabelSize,
    rotateBarCategoryLabels,
    rotateLineLabels,
    manyCategories,
    drilldownEnabled: !!drilldown?.onCategory,
    onDrilldownCategory: drilldown?.onCategory,
    workspaceDrilldownActive: wsDrillActive,
    previewSlimBarWidthPx,
    domLegendItems: [],
  };
}
