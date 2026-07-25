import {
  BAR_COLUMN_OPEN_LOCATION_X,
  BAR_COLUMN_LOCATION_X,
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
  GROUPED_BAR_COLUMN_WIDTH_PX,
  GROUPED_BAR_SHINE_PALETTES,
  GROUPED_BAR_VALUE_LABEL_DY,
  resolveBarColumnWidthPx,
  sortKeyMonthYearLabel,
} from "./am5MiniChartConstants";
import type { Am5XyChartContext } from "./am5MiniChartXyTypes";

export function renderAm5GroupedBarSeries(ctx: Am5XyChartContext): void {
  const {
    root,
    am5,
    am5xy,
    chart,
    xAxis,
    yAxis,
    detail,
    rawData,
    categoryAxisKey,
    valueKeys,
    labelColor,
    isDark,
    humanizeFieldName,
    drilldownEnabled,
    onDrilldownCategory,
    previewSlimBarWidthPx,
  } = ctx;

  const useAgingTooltip = isDataQualityAm5BarContext(detail, previewSlimBarWidthPx);

  const sortedCats = [
    ...new Set(
      rawData.map((d: any) => String(d[categoryAxisKey] ?? "")),
    ),
  ]
    .filter(Boolean)
    .sort((a, b) => {
      const ka = sortKeyMonthYearLabel(a);
      const kb = sortKeyMonthYearLabel(b);
      if (ka != null && kb != null) return ka - kb;
      const da = Date.parse(a);
      const db = Date.parse(b);
      if (!Number.isNaN(da) && !Number.isNaN(db)) return da - db;
      return a.localeCompare(b);
    });

  const columnWidthPx = resolveBarColumnWidthPx(
    sortedCats.length,
    previewSlimBarWidthPx ?? GROUPED_BAR_COLUMN_WIDTH_PX,
  );

  const catAxisData = sortedCats.map((c) => ({ xCategory: c }));
  xAxis.data.setAll(catAxisData);

  chart.set("clustered", true);

  valueKeys.forEach((zoneKey, zIdx) => {
    const palette =
      GROUPED_BAR_SHINE_PALETTES[zIdx % GROUPED_BAR_SHINE_PALETTES.length];
    const [topHex, midHex, botHex] = palette;
    const columnFill = am5.LinearGradient.new(root, {
      rotation: 90,
      stops: [
        { color: am5.color(topHex), offset: 0 },
        { color: am5.color(midHex), offset: 0.5 },
        { color: am5.color(botHex), offset: 1 },
      ],
    });
    const seriesName = humanizeFieldName(zoneKey);

    const mapped = sortedCats.map((cat) => {
      const row = rawData.find(
        (d: any) => String(d[categoryAxisKey] ?? "") === cat,
      );
      const val = row ? Number((row as any)[zoneKey]) || 0 : 0;
      return { xCategory: cat, value: val };
    });

    const tooltip = useAgingTooltip
      ? createAgingStyleColumnTooltip(root, am5, "grouped")
      : createCompactSeriesLinkedTooltip(root, am5, (di) => {
          const vy = Number(di.get?.("valueY"));
          return `${seriesName}: ${formatCompactAxisValue(vy)}`;
        });

    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: seriesName,
        xAxis,
        yAxis,
        categoryXField: "xCategory",
        valueYField: "value",
        tooltip,
      }),
    );
    series.setAll({
      openLocationX: BAR_COLUMN_OPEN_LOCATION_X,
      locationX: BAR_COLUMN_LOCATION_X,
      clustered: true,
      stacked: false,
      fill: am5.color(midHex),
    });
    // Fixed px width: series sets column `x` to left edge; `centerX: p50` mis-anchors and shifts the bar.
    series.columns.template.setAll({
      centerX: am5.p0,
      cornerRadiusTL: 3,
      cornerRadiusTR: 3,
      cornerRadiusBL: 0,
      cornerRadiusBR: 0,
      strokeWidth: 1,
      stroke: am5.color(0xffffff),
      strokeOpacity: 0.42,
      fillOpacity: 0.96,
      fillGradient: columnFill,
      width: columnWidthPx,
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
    series.bullets.push((_bulletRoot, _series, dataItem) => {
      const vy = dataItem.get("valueY") as number | null | undefined;
      if (vy == null || (typeof vy === "number" && (vy === 0 || Number.isNaN(vy)))) {
        return undefined;
      }
      const gLabel = am5.Label.new(root, {
        text: "{valueY.formatNumber('#,###.##')}",
        populateText: true,
        centerX: am5.p50,
        centerY: am5.p100,
        dy: GROUPED_BAR_VALUE_LABEL_DY,
        fontSize: 10,
        fontWeight: "700",
        fill: labelColor,
        oversizedBehavior: "truncate",
        maxWidth: 96,
      });
      attachCompactValueYLabelAdapter(gLabel);
      return am5.Bullet.new(root, {
        locationX: 0.5,
        locationY: 1,
        sprite: gLabel,
      });
    });
    attachGroupedBarColumnHoverState(series, am5, isDark);
    if (useAgingTooltip) {
      attachBarColumnPointerUx(series, am5, tooltip);
    } else {
      attachGroupedBarColumnPointerUx(series, am5, tooltip);
    }
    attachDrilldownOnColumnSeries(series, drilldownEnabled, onDrilldownCategory, false);
    series.data.setAll(mapped);
    series.appear(800, zIdx * 80);
  });
}
