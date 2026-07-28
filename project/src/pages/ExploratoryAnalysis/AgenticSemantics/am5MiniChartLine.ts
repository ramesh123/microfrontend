import {
  createShinePaletteFromBase,
  DATE_AXIS_RELATIVE_PAD,
  GROUPED_BAR_SHINE_PALETTES,
  MINI_XY_CHART_PADDING,
} from "./am5MiniChartConstants";
import {
  attachCompactValueYLabelAdapter,
  attachGroupedBarColumnHoverState,
  attachGroupedBarColumnPointerUx,
  BAR_X_AXIS_END_LOCATION,
  BAR_X_AXIS_START_LOCATION,
  createCompactSeriesLinkedTooltip,
  formatCompactAxisValue,
  hideAm5LegendForDomReplacement,
  neatChartHexAtIndex,
  shineLinearGradient,
  shineRadialGradient,
} from "./am5MiniChartHelpers";
import type { Am5XyChartContext } from "./am5MiniChartXyTypes";

export function renderAm5LineSeries(ctx: Am5XyChartContext): void {
  const {
    root,
    am5,
    am5xy,
    chart,
    xAxis,
    yAxis,
    detail,
    rawData,
    isMultiSeries,
    isDateBased,
    isAreaChart,
    dateKey,
    categoryAxisKey,
    seriesKey,
    valueKey,
    categories,
    metricLabelForAxis,
    isDark,
    labelColor,
    legendFontSize,
    legendMarkerSize,
    legendItemSpacing,
    legendMarkerTextGap,
  } = ctx;

  /**
   * DateAxis: widen plot range so the last month/point, line segment, and value bullets
   * are not flush with the plot edge (strict min/max + tiny extraMin/Max still clips labels).
   * Gapless day axes keep extraMin/extraMax at 0 — rely on symmetric chart padding instead.
   */
  if (isDateBased) {
    const pad = MINI_XY_CHART_PADDING.side;
    chart.set(
      "paddingLeft",
      Math.max(Number(chart.get("paddingLeft")) || 0, pad),
    );
    chart.set(
      "paddingRight",
      Math.max(Number(chart.get("paddingRight")) || 0, pad),
    );
    const emin = xAxis.get("extraMin") ?? 0;
    const emax = xAxis.get("extraMax") ?? 0;
    const minRel = Math.max(DATE_AXIS_RELATIVE_PAD * 2.5, 0.055);
    if (emin > 0 || emax > 0) {
      xAxis.set("extraMin", Math.max(emin, minRel));
      xAxis.set("extraMax", Math.max(emax, minRel));
    }
  }

  if (isMultiSeries) {
    const pointsCountForClarity = 12;

    const sharedDates = isDateBased
      ? [
          ...new Set(
            rawData
              .filter((d: any) => {
                const v = d?.[valueKey];
                if (v == null || v === "" || !Number.isFinite(Number(v)))
                  return false;
                const ts = new Date(String(d?.[dateKey] ?? "")).getTime();
                return Number.isFinite(ts);
              })
              .map((d: any) => new Date(String(d?.[dateKey] ?? "")).getTime()),
          ),
        ].sort((a: number, b: number) => a - b)
      : [];

    const sharedCategories = !isDateBased
      ? [
          ...new Set(
            rawData
              .map((d: any) => String(d?.[categoryAxisKey] ?? ""))
              .filter(Boolean),
          ),
        ].sort((a: string, b: string) => {
          const da = Date.parse(a);
          const db = Date.parse(b);
          if (!Number.isNaN(da) && !Number.isNaN(db)) return da - db;
          return a.localeCompare(b);
        })
      : [];

    if (!isDateBased) {
      xAxis.data.setAll(sharedCategories.map((xCategory) => ({ xCategory })));
      xAxis.set("startLocation", BAR_X_AXIS_START_LOCATION);
      xAxis.set("endLocation", BAR_X_AXIS_END_LOCATION);
      xAxis.set("extraMin", 0);
      xAxis.set("extraMax", 0);
    }

    categories.forEach((cat, catIdx) => {
      const shinePalette = createShinePaletteFromBase(
        neatChartHexAtIndex(catIdx),
      );
      const midColor = am5.color(shinePalette[1]);
      const strokeGradient = shineLinearGradient(root, am5, shinePalette, 0);
      const areaFillGradient = shineLinearGradient(root, am5, shinePalette, 90);
      const bulletRadial = shineRadialGradient(root, am5, shinePalette);

      const valueByX = new Map<string | number, number>();
      rawData.forEach((d: any) => {
        if (String(d?.[seriesKey]) !== cat) return;
        const rawVal = d?.[valueKey];
        const numericVal =
          rawVal == null || rawVal === "" || Number.isNaN(Number(rawVal))
            ? null
            : Number(rawVal);
        if (numericVal == null) return;

        if (isDateBased) {
          const ts = new Date(String(d?.[dateKey] ?? "")).getTime();
          if (Number.isFinite(ts)) valueByX.set(ts, numericVal);
        }
      });

      const mapped = isDateBased
        ? sharedDates.map((date, idx) => ({
            date,
            idx,
            value: valueByX.get(date) ?? null,
          }))
        : sharedCategories.map((xCategory, idx) => ({
            xCategory,
            idx,
            value: valueByX.get(xCategory) ?? null,
          }));

      const lineTooltip = createCompactSeriesLinkedTooltip(root, am5, (di) => {
        const name = String(
          (di as { component?: { get?: (k: string) => unknown } }).component?.get?.(
            "name",
          ) ?? "",
        );
        const vy = Number(di.get?.("valueY"));
        return `${name}\n${formatCompactAxisValue(vy)}`;
      });

      const series = chart.series.push(
        am5xy.LineSeries.new(root, {
          name: cat,
          xAxis,
          yAxis,
          ...(isDateBased
            ? {
                valueXField: "date",
                valueYField: "value",
                exactLocationX: false,
                locationX: 0.5,
              }
            : {
                categoryXField: "xCategory",
                valueYField: "value",
                locationX: 0.5,
              }),
          tooltip: lineTooltip,
        }),
      );

      series.strokes.template.setAll({
        strokeWidth: 2,
        strokeGradient,
      });
      series.fills.template.setAll(
        isAreaChart
          ? {
              visible: true,
              fillOpacity: 0.08,
              fillGradient: areaFillGradient,
            }
          : { visible: false },
      );
      /** Override chart theme `_colorize` so legend markers match `neatChartHexAtIndex` / stroke gradient palette. */
      series.set("stroke", midColor);
      series.set("fill", midColor);

      series.bullets.push((bulletRoot, _s, dataItem) => {
        if ((dataItem.dataContext as { legend?: boolean } | undefined)?.legend) {
          return undefined;
        }
        const valueY = dataItem.get("valueY");
        if (
          valueY == null ||
          (typeof valueY === "number" && Number.isNaN(valueY))
        ) {
          return undefined;
        }

        const totalPoints = isDateBased
          ? sharedDates.length
          : sharedCategories.length;
        const tooManyPoints = totalPoints > pointsCountForClarity;
        const dataContext = dataItem.dataContext as { idx?: number } | undefined;
        const idx = dataContext?.idx ?? -1;
        const isLastPoint = idx === totalPoints - 1;

        const container = am5.Container.new(bulletRoot, {
          interactive: true,
          cursorOverStyle: "pointer",
        });
        container.children.push(
          am5.Circle.new(bulletRoot, {
            radius: 5,
            fillGradient: bulletRadial,
            stroke: bulletRoot.interfaceColors.get("background"),
            strokeWidth: 2,
          }),
        );
        const label = container.children.push(
          am5.Label.new(bulletRoot, {
            text: "{valueY.formatNumber('#,###.##')}",
            centerX: am5.p50,
            centerY: am5.p100,
            populateText: true,
            fontWeight: "600",
            fontSize: 10,
            fill: midColor,
            background: am5.RoundedRectangle.new(bulletRoot, {
              fill: am5.color(isDark ? 0x111827 : 0xffffff),
              fillOpacity: 0.85,
            
              // ✅ REMOVE BORDER
              strokeOpacity: 0,
              strokeWidth: 0,
            }),
            paddingTop: 4,
            paddingBottom: 4,
            paddingLeft: 6,
            paddingRight: 6,
            dy: -8,
          }),
        );
        attachCompactValueYLabelAdapter(label);

        const baseOpacity = tooManyPoints && !isLastPoint ? 0 : 1;
        label.set("opacity", baseOpacity);
        container.events.on("pointerover", () => label.set("opacity", 1));
        container.events.on("pointerout", () => label.set("opacity", baseOpacity));

        return am5.Bullet.new(bulletRoot, { sprite: container });
      });

      series.data.setAll(mapped);
      series.appear(800, catIdx * 100);
    });

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
    ctx.domLegendItems = categories.map((cat, catIdx) => ({
      id: cat,
      line: cat,
      color: neatChartHexAtIndex(catIdx),
    }));
  } else {
    const chartData = (() => {
      if (isDateBased) {
        const byTs = new Map<number, number>();
        for (const d of rawData) {
          const ts = new Date(String((d as any)?.[dateKey] ?? "")).getTime();
          if (!Number.isFinite(ts)) continue;
          const raw = (d as any)?.[valueKey];
          if (raw == null || raw === "") continue;
          const val = Number(raw);
          if (!Number.isFinite(val)) continue;
          byTs.set(ts, val);
        }
        return [...byTs.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([date, value]) => ({ date, value }));
      }
      return rawData
        .map((d: any) => {
          const raw = d?.[valueKey];
          const val =
            raw == null || raw === "" || !Number.isFinite(Number(raw))
              ? null
              : Number(raw);
          return {
            xCategory: String(d?.[categoryAxisKey] ?? ""),
            value: val,
          };
        })
        .filter((row: any) => row.value != null)
        .sort((a: any, b: any) =>
          String(a.xCategory).localeCompare(String(b.xCategory)),
        );
    })();

    if (!isDateBased) {
      xAxis.set("startLocation", BAR_X_AXIS_START_LOCATION);
      xAxis.set("endLocation", BAR_X_AXIS_END_LOCATION);
      xAxis.set("extraMin", 0);
      xAxis.set("extraMax", 0);
    }

    /** Bars behind the line: same shine / column styling as `am5MiniChartBarSingle` (single series). */
    const singleLineTooltip = createCompactSeriesLinkedTooltip(root, am5, (di) => {
      const vy = Number(di.get?.("valueY"));
      return `${metricLabelForAxis}\n${formatCompactAxisValue(vy)}`;
    });

    const columnSeries = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: detail.metric_name,
        xAxis,
        yAxis,
        ...(isDateBased
          ? { valueXField: "date", valueYField: "value" }
          : { categoryXField: "xCategory", valueYField: "value" }),
      }),
    );
    columnSeries.setAll({
      openLocationX: 0.5,
      locationX: 0.5,
      clustered: false,
    });
    columnSeries.columns.template.setAll({
      centerX: am5.p50,
      cornerRadiusTL: 3,
      cornerRadiusTR: 3,
      cornerRadiusBL: 0,
      cornerRadiusBR: 0,
      strokeWidth: 1,
      stroke: am5.color(0xffffff),
      strokeOpacity: 0.42,
      fillOpacity: 0.96,
      width: am5.percent(18),
      cursorOverStyle: "pointer",
      tooltipY: am5.p50,
      tooltipPosition: "pointer",
      interactive: true,
    });
    columnSeries.columns.template.adapters.add("fillGradient", (_g, target) => {
      const ctxRow = target.dataItem?.dataContext as {
        xCategory?: string;
        date?: number;
      };
      const key = isDateBased
        ? String(ctxRow?.date ?? "")
        : String(ctxRow?.xCategory ?? "");
      let idx = chartData.findIndex((row: any) =>
        isDateBased
          ? String(row.date) === key
          : String(row.xCategory) === key,
      );
      if (idx < 0) idx = columnSeries.columns.indexOf(target);
      const palette =
        GROUPED_BAR_SHINE_PALETTES[idx % GROUPED_BAR_SHINE_PALETTES.length];
      const [topHex, midHex, botHex] = palette;
      return am5.LinearGradient.new(root, {
        rotation: 90,
        stops: [
          { color: am5.color(topHex), offset: 0 },
          { color: am5.color(midHex), offset: 0.5 },
          { color: am5.color(botHex), offset: 1 },
        ],
      });
    });
    attachGroupedBarColumnHoverState(columnSeries, am5, isDark);
    attachGroupedBarColumnPointerUx(columnSeries, am5);
    columnSeries.data.setAll(chartData);

    const series = chart.series.push(
      am5xy.LineSeries.new(root, {
        name: detail.metric_name,
        xAxis,
        yAxis,
        ...(isDateBased
          ? {
              valueXField: "date",
              valueYField: "value",
              /** Match centered columns: `exactLocationX` ignores `locationX` and can sit at interval start. */
              exactLocationX: false,
              locationX: 0.5,
            }
          : {
              categoryXField: "xCategory",
              valueYField: "value",
              /** Center of category cell — same horizontal anchor as `ColumnSeries` (open/location 0.5). */
              locationX: 0.5,
            }),
        tooltip: singleLineTooltip,
      }),
    );

    const singleShine = createShinePaletteFromBase(neatChartHexAtIndex(0));
    const lineMidColor = am5.color(singleShine[1]);
    const singleStrokeGrad = shineLinearGradient(root, am5, singleShine, 0);
    const singleAreaGrad = shineLinearGradient(root, am5, singleShine, 90);
    const singleBulletRadial = shineRadialGradient(root, am5, singleShine);
    series.strokes.template.setAll({
      strokeWidth: 2,
      strokeGradient: singleStrokeGrad,
    });
    series.fills.template.setAll(
      isAreaChart
        ? {
            visible: true,
            fillOpacity: 0.08,
            fillGradient: singleAreaGrad,
          }
        : { visible: false },
    );
    series.set("stroke", lineMidColor);
    series.set("fill", lineMidColor);

    series.bullets.push((bulletRoot, _s, dataItem) => {
      const valueY = dataItem.get("valueY");
      if (valueY == null || (typeof valueY === "number" && Number.isNaN(valueY))) {
        return undefined;
      }

      const container = am5.Container.new(bulletRoot, {});
      container.children.push(
        am5.Circle.new(bulletRoot, {
          radius: 5,
          fillGradient: singleBulletRadial,
          stroke: bulletRoot.interfaceColors.get("background"),
          strokeWidth: 2,
        }),
      );
      const singlePointLabel = container.children.push(
        am5.Label.new(bulletRoot, {
          text: "{valueY.formatNumber('#,###.##')}",
          centerX: am5.p50,
          centerY: am5.p100,
          populateText: true,
          fontWeight: "600",
          fontSize: 10,
          fill: lineMidColor,
          background: am5.RoundedRectangle.new(bulletRoot, {
            fill: am5.color(isDark ? 0x111827 : 0xffffff),
            fillOpacity: 0.85,
          
            // ✅ REMOVE BORDER
            strokeOpacity: 0,
            strokeWidth: 0,
          }),
          paddingTop: 4,
          paddingBottom: 4,
          paddingLeft: 6,
          paddingRight: 6,
          dy: -8,
        }),
      );
      attachCompactValueYLabelAdapter(singlePointLabel);

      return am5.Bullet.new(bulletRoot, { sprite: container });
    });

    series.data.setAll(chartData);
    if (!isDateBased) xAxis.data.setAll(chartData);
    columnSeries.appear(800);
    series.appear(800);
  }
}
