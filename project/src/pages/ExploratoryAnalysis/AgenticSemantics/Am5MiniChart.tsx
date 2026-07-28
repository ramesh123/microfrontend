import React, { useId, useLayoutEffect, useRef, useState } from "react";
import { useTheme } from "@/context/theme";
import type { ChartDetail } from "./chartTypes";
import { renderAm5PieChart } from "./am5MiniChartPie";
import { setupAm5XyChart } from "./am5MiniChartXySetup";
import { renderAm5BarSeries } from "./am5MiniChartBar";
import { renderAm5LineSeries } from "./am5MiniChartLine";
import { finalizeAm5XyChart } from "./am5MiniChartXyFinalize";
import { renderAm5ForecastBandChart } from "./am5MiniChartForecastBand";
import { renderAm5CorrelationHeatmap } from "./am5MiniChartCorrelationHeatmap";
import { renderAm5AnomalyTimeline } from "./am5MiniChartAnomalyTimeline";
import { renderAm5ScatterRegressionChart } from "./am5MiniChartScatterRegression";
import { renderAm5RollingCorrelationChart } from "./am5MiniChartRollingCorrelation";
import { renderAm5AnomalyDensityChart } from "./am5MiniChartAnomalyDensity";
import { renderAm5HorizontalBarChart } from "./am5MiniChartHorizontalBar";
import { renderAm5StackedColumnChart } from "./am5MiniChartStackedColumn";
import { chartDetailUsesDataTrustScorecard } from "./DataTrustScorecard";
import { chartDetailUsesValidationRuleFailures } from "./ValidationRuleFailuresPanel";
import {
  countBarChartCategoryValues,
  DATA_PREVIEW_BAR_COLUMN_WIDTH_PX,
  resolveBarColumnWidthPx,
} from "./am5MiniChartConstants";
import {
  applyDataQualityAm5Theme,
  isDataQualityAm5BarContext,
} from "./am5MiniChartHelpers";
import {
  ChartDomScrollLegend,
  type ChartDomScrollLegendItem,
} from "@/pages/charts/components/charts/ChartDomScrollLegend";

/** Re-export palettes for grouped bars / pie (and consumers that imported from this file). */
export { chartColors, donutColors } from "./am5MiniChartConstants";

function useChartDetailMemoize(value: ChartDetail): ChartDetail {
  const ref = useRef<ChartDetail>(value);
  if (value !== ref.current) {
    const equal =
      value.chart_id === ref.current.chart_id &&
      value.chart_type === ref.current.chart_type &&
      value.sql === ref.current.sql &&
      value.title === ref.current.title &&
      value.metric_name === ref.current.metric_name &&
      value.category_column === ref.current.category_column &&
      JSON.stringify(value.chart_data ?? null) === JSON.stringify(ref.current.chart_data ?? null) &&
      JSON.stringify(value.chart_payload ?? null) === JSON.stringify(ref.current.chart_payload ?? null);
    if (!equal) {
      ref.current = value;
    }
  }
  return ref.current;
}

export function Am5MiniChart({
  detail: rawDetail,
  height,
  drilldownEnabled,
  onDrilldownCategory,
  onChartContextMenu,
}: {
  detail: ChartDetail;
  height?: string;
  /** When true, bar/column/pie left-click emits the category label via `onDrilldownCategory`. */
  drilldownEnabled?: boolean;
  onDrilldownCategory?: (categoryLabel: string) => void;
  /**
   * Right-click on the chart (canvas). Use capture phase so `preventDefault` runs before the
   * browser’s canvas “Save image” menu.
   */
  onChartContextMenu?: (e: React.MouseEvent) => void;
}) {
  const detail = useChartDetailMemoize(rawDetail);
  const uniqueId = useId();
  const divId = `am5-dash-${uniqueId.replace(/:/g, "")}`;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<any>(null);
  const [domLegendItems, setDomLegendItems] = useState<ChartDomScrollLegendItem[]>([]);
  const drilldownCbRef = useRef(onDrilldownCategory);
  drilldownCbRef.current = onDrilldownCategory;
  const onDrilldownCategoryRef = useRef(onDrilldownCategory);
  onDrilldownCategoryRef.current = onDrilldownCategory;
  /** Toggle drilldown without remounting the chart (avoids blink). */
  const drilldownEnabledRef = useRef(!!drilldownEnabled);
  drilldownEnabledRef.current = !!drilldownEnabled;
  const onChartContextMenuRef = useRef(onChartContextMenu);
  onChartContextMenuRef.current = onChartContextMenu;
  const chartType = (detail.chart_type ?? "").toLowerCase();
  const { theme } = useTheme();
  const isDark =
    theme === "dark" ||
    theme === "blue-dark" ||
    theme === "blue-dark-g" ||
    theme === "purple-dark" ||
    theme === "orange-dark";

  useLayoutEffect(() => {
    let disposed = false;
    setDomLegendItems([]);

    const loadAndRender = async () => {
      const am5 = await import("@amcharts/amcharts5");
      const am5themes_Animated = (
        await import("@amcharts/amcharts5/themes/Animated")
      ).default;

      if (disposed) return;

      const payloadType = String(
        detail.chart_payload?.chart_type ?? "",
      ).toLowerCase();
      const isScatterRegression =
        chartType.includes("scatter_regression") ||
        payloadType.includes("scatter_regression");

      const rawData = (() => {
        const rows = detail.chart_data;
        if (Array.isArray(rows) && rows.length > 0) {
          return rows as Record<string, unknown>[];
        }
        const p = detail.chart_payload;
        if (isScatterRegression && p) {
          if (Array.isArray(p.scatter_data) && p.scatter_data.length > 0) {
            return p.scatter_data as Record<string, unknown>[];
          }
          if (Array.isArray(p.data) && p.data.length > 0) {
            return p.data as Record<string, unknown>[];
          }
        }
        const payloadRows = p?.data;
        if (Array.isArray(payloadRows) && payloadRows.length > 0) {
          return payloadRows as Record<string, unknown>[];
        }
        return [] as Record<string, unknown>[];
      })();

      const previewSlimBarWidthPx = (() => {
        const host = containerRef.current;
        if (!host?.closest("[data-agentic-chart-preview]")) return undefined;
        const categoryCount = countBarChartCategoryValues(rawData, detail);
        return resolveBarColumnWidthPx(
          categoryCount,
          DATA_PREVIEW_BAR_COLUMN_WIDTH_PX,
        );
      })();

      const root = am5.Root.new(divId);
      rootRef.current = root;
      root.setThemes([am5themes_Animated.new(root)]);
      root._logo?.dispose();

      const isDqAm5Chart = isDataQualityAm5BarContext(
        detail,
        previewSlimBarWidthPx,
      );
      if (isDqAm5Chart) {
        applyDataQualityAm5Theme(root, containerRef.current);
      }

      const regressionPointCount = (() => {
        const p = detail.chart_payload;
        if (!p) return 0;
        const a = Array.isArray(p.regression_data) ? p.regression_data.length : 0;
        const b = Array.isArray(
          (p as { regression_series_data?: unknown[] }).regression_series_data,
        )
          ? (p as { regression_series_data: unknown[] }).regression_series_data
              .length
          : 0;
        return Math.max(a, b);
      })();

      if (
        rawData.length === 0 &&
        !(isScatterRegression && regressionPointCount >= 2)
      ) {
        root.dispose();
        rootRef.current = null;
        return;
      }

      /** Rendered in React (`ChartDataTable` / `DqTableHeatmap` / scorecard), not amCharts. */
      if (
        chartType === "table" ||
        chartType === "table_heatmap" ||
        chartDetailUsesDataTrustScorecard(detail) ||
        chartDetailUsesValidationRuleFailures(detail)
      ) {
        root.dispose();
        rootRef.current = null;
        return;
      }

      const isCorrelationHeatmap =
        chartType.includes("correlation_heatmap") ||
        payloadType.includes("correlation_heatmap");

      if (isCorrelationHeatmap) {
        if (disposed) {
          root.dispose();
          return;
        }
        await renderAm5CorrelationHeatmap(root, am5, detail, rawData, isDark);
        return;
      }

      const isAnomalyTimeline =
        chartType.includes("anomaly_timeline") ||
        payloadType.includes("anomaly_timeline");

      if (isAnomalyTimeline) {
        if (disposed) {
          root.dispose();
          return;
        }
        await renderAm5AnomalyTimeline(root, am5, detail, rawData, isDark);
        return;
      }

      const isForecastBand =
        chartType.includes("forecast_band") ||
        payloadType.includes("forecast_band");

      if (isForecastBand) {
        if (disposed) {
          root.dispose();
          return;
        }
        await renderAm5ForecastBandChart(root, am5, detail, rawData, isDark);
        return;
      }

      if (isScatterRegression) {
        if (disposed) {
          root.dispose();
          return;
        }
        await renderAm5ScatterRegressionChart(root, am5, detail, rawData, isDark);
        return;
      }

      const isRollingCorrelation =
        chartType.includes("rolling_correlation") ||
        payloadType.includes("rolling_correlation");

      if (isRollingCorrelation) {
        if (disposed) {
          root.dispose();
          return;
        }
        await renderAm5RollingCorrelationChart(root, am5, detail, rawData, isDark);
        return;
      }

      const isAnomalyDensity =
        chartType.includes("anomaly_density") ||
        payloadType.includes("anomaly_density");

      if (isAnomalyDensity) {
        if (disposed) {
          root.dispose();
          return;
        }
        await renderAm5AnomalyDensityChart(root, am5, detail, rawData, isDark);
        return;
      }

      /** Pass whenever workspace wires drilldown; handlers gate on drilldownEnabledRef (no chart remount on toggle). */
      const drilldownOpts = onDrilldownCategoryRef.current
        ? {
            enabled: true as const,
            onCategory: (s: string) => {
              if (drilldownEnabledRef.current) drilldownCbRef.current?.(s);
            },
            getWorkspaceDrilldownActive: () => drilldownEnabledRef.current,
          }
        : undefined;

      if (chartType.includes("pie") || chartType.includes("donut")) {
        if (disposed) {
          root.dispose();
          return;
        }
        const pieLegendItems = await renderAm5PieChart(
          root,
          am5,
          detail,
          rawData,
          isDark,
          drilldownOpts,
        );
        if (!disposed) setDomLegendItems(pieLegendItems);
        return;
      }

      const isHorizontalBar =
        chartType.includes("horizontal_bar") || payloadType.includes("horizontal_bar");

      if (isHorizontalBar) {
        if (disposed) {
          root.dispose();
          return;
        }
        await renderAm5HorizontalBarChart(
          root,
          am5,
          detail,
          rawData,
          isDark,
          drilldownOpts,
          previewSlimBarWidthPx,
        );
        return;
      }

      const isStackedBar =
        chartType.includes("stacked_bar") || payloadType.includes("stacked_bar");

      if (isStackedBar) {
        if (disposed) {
          root.dispose();
          return;
        }
        await renderAm5StackedColumnChart(
          root,
          am5,
          detail,
          rawData,
          isDark,
          drilldownOpts,
          previewSlimBarWidthPx,
        );
        return;
      }

      const ctx = await setupAm5XyChart(
        root,
        am5,
        detail,
        rawData,
        chartType,
        isDark,
        drilldownOpts,
        previewSlimBarWidthPx,
      );
      if (disposed) {
        root.dispose();
        return;
      }

      if (ctx.isBarOrColumn) {
        renderAm5BarSeries(ctx);
      } else {
        renderAm5LineSeries(ctx);
      }
      finalizeAm5XyChart(ctx);
      if (!disposed) setDomLegendItems(ctx.domLegendItems);
      if (ctx.isBarOrColumn && onDrilldownCategoryRef.current) {
        const active = drilldownEnabledRef.current;
        ctx.chart.set("panX", active ? false : true);
        ctx.chart.set("wheelX", active ? "none" : "panX");
        ctx.chart.set("pinchZoomX", active ? false : true);
      }
    };

    loadAndRender();

    return () => {
      disposed = true;
      rootRef.current?.dispose();
      rootRef.current = null;
      setDomLegendItems([]);
    };
  }, [divId, detail, chartType, theme]);

  /** Update bar pan/zoom when drilldown toggles without rebuilding the chart (prevents blink). */
  useLayoutEffect(() => {
    if (!onDrilldownCategoryRef.current) return;
    const root = rootRef.current;
    if (!root) return;
    const chart = root.container.children.getIndex(0);
    if (!chart) return;
    const isBar =
      (chartType.includes("bar") ||
        chartType.includes("column") ||
        chartType.includes("grouped_bar") ||
        chartType.includes("stacked_bar")) &&
      !chartType.includes("horizontal_bar");
    if (!isBar) return;
    const active = drilldownEnabledRef.current;
    chart.set("panX", active ? false : true);
    chart.set("wheelX", active ? "none" : "panX");
    chart.set("pinchZoomX", active ? false : true);
  }, [drilldownEnabled, chartType]);

  /** Canvas targets the browser’s image menu unless we intercept in capture phase (native DOM). */
  const hasChartContextMenu = Boolean(onChartContextMenu);
  useLayoutEffect(() => {
    if (!hasChartContextMenu) return;
    const el = containerRef.current;
    if (!el) return;
    const handler = (ev: Event) => {
      const e = ev as MouseEvent;
      e.preventDefault();
      e.stopPropagation();
      onChartContextMenuRef.current?.(e as unknown as React.MouseEvent);
    };
    el.addEventListener("contextmenu", handler, true);
    return () => el.removeEventListener("contextmenu", handler, true);
  }, [divId, hasChartContextMenu]);

  return (
    <div
      className="flex h-full w-full min-h-0 flex-col"
      style={height && height !== "100%" ? { height } : undefined}
    >
      <div
        ref={containerRef}
        id={divId}
        className="min-h-0 flex-1"
        style={{ width: "100%" }}
      />
      <ChartDomScrollLegend
        visible={domLegendItems.length > 0}
        items={domLegendItems}
      />
    </div>
  );
}
