import {
  BAR_COLUMN_LOCATION_X,
  BAR_COLUMN_OPEN_LOCATION_X,
  attachCompactValueYLabelAdapter,
  attachDrilldownOnColumnSeries,
  attachBarColumnPointerUx,
  attachGroupedBarColumnHoverState,
  attachGroupedBarColumnPointerUx,
  createAgingStyleColumnTooltip,
  createCompactSeriesLinkedTooltip,
  formatCompactAxisValue,
  isDataQualityAm5BarContext,
} from "./am5MiniChartHelpers";
import {
  FEW_BAR_COLUMN_WIDTH_PX,
  GROUPED_BAR_SHINE_PALETTES,
  GROUPED_BAR_VALUE_LABEL_DY,
  isFewBarCategories,
} from "./am5MiniChartConstants";
import type { Am5XyChartContext } from "./am5MiniChartXyTypes";

export function renderAm5SingleBarSeries(ctx: Am5XyChartContext): void {
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
    dateKey,
    categoryAxisKey,
    seriesKey,
    valueKey,
    categories,
    labelColor,
    metricLabelForAxis,
    isDark,
    drilldownEnabled,
    onDrilldownCategory,
    previewSlimBarWidthPx,
  } = ctx;

  const useAgingTooltip = isDataQualityAm5BarContext(detail, previewSlimBarWidthPx);

  const columnWidthForCount = (categoryCount: number, percentWhenMany: number) =>
    isFewBarCategories(categoryCount)
      ? FEW_BAR_COLUMN_WIDTH_PX
      : am5.percent(percentWhenMany);

  if (isMultiSeries) {
    const dateSet = [
      ...new Set(
        rawData.map((d: any) =>
          String(d[isDateBased ? dateKey : categoryAxisKey]),
        ),
      ),
    ];
    const multiBarCategoryCount = dateSet.length;
    const catAxisData = isDateBased
      ? undefined
      : dateSet.map((d) => ({ xCategory: d }));

    categories.forEach((cat, catIdx) => {
      const palette =
        GROUPED_BAR_SHINE_PALETTES[catIdx % GROUPED_BAR_SHINE_PALETTES.length];
      const [topHex, midHex, botHex] = palette;
      const columnFill = am5.LinearGradient.new(root, {
        rotation: 90,
        stops: [
          { color: am5.color(topHex), offset: 0 },
          { color: am5.color(midHex), offset: 0.5 },
          { color: am5.color(botHex), offset: 1 },
        ],
      });
      const catData = rawData.filter((d: any) => String(d[seriesKey]) === cat);
      const mapped = catData.map((d: any) => {
        const val = Number(d[valueKey]) || 0;
        if (isDateBased)
          return { date: new Date(d[dateKey] as string).getTime(), value: val };
        return { xCategory: String(d[categoryAxisKey] ?? ""), value: val };
      });

      const groupedTooltip = useAgingTooltip
        ? createAgingStyleColumnTooltip(root, am5, isDateBased ? "date" : "grouped", metricLabelForAxis)
        : createCompactSeriesLinkedTooltip(root, am5, (di) => {
            const vy = Number(di.get?.("valueY"));
            const fy = formatCompactAxisValue(vy);
            if (isDateBased) {
              const name = String(
                (di as { component?: { get?: (k: string) => unknown } }).component?.get?.(
                  "name",
                ) ?? "",
              );
              const vx = di.get?.("valueX") as number;
              const dateStr = root.dateFormatter.format(new Date(vx), "yyyy-MM-dd");
              return `${name}\n${dateStr}: ${fy}`;
            }
            const cat = String(di.get?.("categoryX") ?? "");
            return `${cat}\n${metricLabelForAxis}: ${fy}`;
          });

      const series = chart.series.push(
        am5xy.ColumnSeries.new(root, {
          name: cat,
          xAxis,
          yAxis,
          ...(isDateBased
            ? { valueXField: "date", valueYField: "value" }
            : { categoryXField: "xCategory", valueYField: "value" }),
          tooltip: groupedTooltip,
        }),
      );
      series.setAll({
        openLocationX: BAR_COLUMN_OPEN_LOCATION_X,
        locationX: BAR_COLUMN_LOCATION_X,
        clustered: false,
        fill: am5.color(midHex),
      });
      series.columns.template.setAll({
        centerX: am5.p50,
        cornerRadiusTL: 3,
        cornerRadiusTR: 3,
        cornerRadiusBL: 0,
        cornerRadiusBR: 0,
        strokeWidth: 1,
        stroke: am5.color(0xffffff),
        strokeOpacity: 0.42,
        fillOpacity: 0.96,
        fillGradient: columnFill,
        width: columnWidthForCount(multiBarCategoryCount, 14),
        cursorOverStyle: "pointer",
        ...(useAgingTooltip
          ? {
              tooltipX: am5.p50,
              tooltipY: am5.p0,
            }
          : {
              tooltipY: am5.p50,
              tooltipPosition: "pointer",
            }),
        interactive: true,
      });
      series.bullets.push(() => {
        const barLabel = am5.Label.new(root, {
          text: "{valueY.formatNumber('#,###.####')}",
          centerX: am5.p50,
          centerY: am5.p100,
          textAlign: "center",
          populateText: true,
          fontSize: 10,
          fontWeight: "700",
          fill: labelColor,
          dy: GROUPED_BAR_VALUE_LABEL_DY,
          oversizedBehavior: "truncate",
          maxWidth: 96,
        });
        attachCompactValueYLabelAdapter(barLabel);
        return am5.Bullet.new(root, {
          locationX: 0.5,
          locationY: 1,
          sprite: barLabel,
        });
      });
      attachGroupedBarColumnHoverState(series, am5, isDark);
      if (useAgingTooltip) {
        attachBarColumnPointerUx(series, am5, groupedTooltip);
      } else {
        attachGroupedBarColumnPointerUx(series, am5, groupedTooltip);
      }
      attachDrilldownOnColumnSeries(
        series,
        drilldownEnabled,
        onDrilldownCategory,
        isDateBased,
      );
      series.data.setAll(mapped);
      series.appear(800, catIdx * 100);
    });
    if (!isDateBased && catAxisData) xAxis.data.setAll(catAxisData);
    return;
  }

  const chartData = rawData.map((d: any) => {
    const val = Number(d[valueKey]) || 0;
    if (isDateBased)
      return { date: new Date(d[dateKey] as string).getTime(), value: val };
    return { xCategory: String(d[categoryAxisKey] ?? ""), value: val };
  });
  const singleBarCategoryCount = chartData.length;

  const singleBarTooltip = useAgingTooltip
    ? createAgingStyleColumnTooltip(root, am5, isDateBased ? "date" : "single", metricLabelForAxis)
    : createCompactSeriesLinkedTooltip(root, am5, (di) => {
        const vy = Number(di.get?.("valueY"));
        const fy = formatCompactAxisValue(vy);
        if (isDateBased) {
          const vx = di.get?.("valueX") as number;
          const dateStr = root.dateFormatter.format(new Date(vx), "yyyy-MM-dd");
          return `${dateStr}\n${metricLabelForAxis}: ${fy}`;
        }
        const cat = String(di.get?.("categoryX") ?? "");
        return `${cat}\n${metricLabelForAxis}: ${fy}`;
      });

  const series = chart.series.push(
    am5xy.ColumnSeries.new(root, {
      name: detail.metric_name,
      xAxis,
      yAxis,
      ...(isDateBased
        ? { valueXField: "date", valueYField: "value" }
        : { categoryXField: "xCategory", valueYField: "value" }),
      tooltip: singleBarTooltip,
    }),
  );
  series.setAll({
    openLocationX: BAR_COLUMN_OPEN_LOCATION_X,
    locationX: BAR_COLUMN_LOCATION_X,
    clustered: false,
  });
  series.columns.template.setAll({
    centerX: am5.p50,
    cornerRadiusTL: 3,
    cornerRadiusTR: 3,
    cornerRadiusBL: 0,
    cornerRadiusBR: 0,
    strokeWidth: 1,
    stroke: am5.color(0xffffff),
    strokeOpacity: 0.42,
    fillOpacity: 0.96,
    width: columnWidthForCount(singleBarCategoryCount, 18),
    cursorOverStyle: "pointer",
    ...(useAgingTooltip
      ? {
          tooltipX: am5.p50,
          tooltipY: am5.p0,
        }
      : {
          tooltipY: am5.p50,
          tooltipPosition: "pointer",
        }),
    interactive: true,
  });

  series.columns.template.adapters.add("fillGradient", (_g, target) => {
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
    if (idx < 0) idx = series.columns.indexOf(target);
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

  attachGroupedBarColumnHoverState(series, am5, isDark);
  if (useAgingTooltip) {
    attachBarColumnPointerUx(series, am5, singleBarTooltip);
  } else {
    attachGroupedBarColumnPointerUx(series, am5, singleBarTooltip);
  }
  attachDrilldownOnColumnSeries(series, drilldownEnabled, onDrilldownCategory, isDateBased);

  series.bullets.push(() => {
    const barTopLabel = am5.Label.new(root, {
      text: "{valueY.formatNumber('#,###.####')}",
      centerX: am5.p50,
      centerY: am5.p100,
      textAlign: "center",
      populateText: true,
      fontSize: 10,
      fontWeight: "700",
      fill: labelColor,
      dy: GROUPED_BAR_VALUE_LABEL_DY,
      oversizedBehavior: "truncate",
      maxWidth: 96,
    });
    attachCompactValueYLabelAdapter(barTopLabel);
    return am5.Bullet.new(root, {
      locationX: 0.5,
      locationY: 1,
      sprite: barTopLabel,
    });
  });

  if (!isDateBased) {
    xAxis.data.setAll(chartData);
  }
  series.data.setAll(chartData);
  series.appear(800);
}
