import type { ChartDetail } from "./chartTypes";
import { createShinePaletteFromBase, donutColors } from "./am5MiniChartConstants";
import {
  formatCompactAxisValue,
  resolveAm5SpriteDataContext,
  shineRadialGradient,
  createSeriesLinkedTooltipWithText,
} from "./am5MiniChartHelpers";
import type { ChartDomScrollLegendItem } from "@/pages/charts/components/charts/ChartDomScrollLegend";

export async function renderAm5PieChart(
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
): Promise<ChartDomScrollLegendItem[]> {
  const am5percent = await import("@amcharts/amcharts5/percent");

  const labelColor = isDark ? am5.color(0xcccccc) : am5.color(0x555555);

  const chart = root.container.children.push(
    am5percent.PieChart.new(root, {
      layout: root.verticalLayout,
      centerY: am5.p50,
      y: am5.p50,
      innerRadius: am5.percent(40),
      radius: am5.percent(78),
      width: am5.percent(100),
      height: am5.percent(100),
      paddingBottom: 0,
    }),
  );

  const series = chart.series.push(
    am5percent.PieSeries.new(root, {
      valueField: "value",
      categoryField: "category",
      endAngle: 270,
      /** Hide % / value in legend; slice labels show percent instead. */
      legendValueText: "",
    }),
  );

  series
    .get("colors")
    ?.set(
      "colors",
      donutColors.map((c) => am5.color(c)),
    );

  series.slices.template.adapters.add("fillGradient", (_fillGradient, target) => {
    const di = target.dataItem;
    if (!di) return undefined;
    const idx = series.dataItems.indexOf(di);
    if (idx < 0) return undefined;
    const base = donutColors[idx % donutColors.length];
    return shineRadialGradient(root, am5, createShinePaletteFromBase(base));
  });

  series.labels.template.setAll({
    text: "{category}\n{valuePercentTotal.formatNumber('#.0')}%",
    fontSize: 11,
    fontWeight: "700",
    fill: labelColor,
    maxWidth: 100,
    oversizedBehavior: "truncate",
    radius: 10,
    textAlign: "center",
  });

  series.ticks.template.setAll({
    stroke: labelColor,
    strokeOpacity: 0.5,
    length: 6,
  });

  series.slices.template.setAll({
    strokeWidth: 2.5,
    stroke: am5.color(0xffffff),
    strokeOpacity: 0.95,
    tooltip: createSeriesLinkedTooltipWithText(
      root,
      am5,
      (di) => {
        const cat = String(di.get?.("category") ?? "");
        const val = Number(di.get?.("value"));
        if (!Number.isFinite(val)) return "";
        return `${cat}\n${formatCompactAxisValue(val)}`;
      },
      { pointerOrientation: "horizontal" },
    ),
  });

  const pieData = rawData.map((d: any, i: number) => ({
    category: d.category || d.date || `Item ${i + 1}`,
    value: Number(d.value) || 0,
  }));
  series.data.setAll(pieData);

  if (drilldown?.onCategory) {
    series.slices.template.events.on("click", (ev: unknown) => {
      const dc = resolveAm5SpriteDataContext(ev) as { category?: string } | undefined;
      const cat = dc?.category;
      const s = cat != null ? String(cat).trim() : "";
      if (s) drilldown.onCategory(s);
    });
  }

  series.appear(1000);
  chart.appear(1000, 100);

  return pieData.map((d, idx) => ({
    id: String(d.category ?? idx),
    line: `${d.category}: ${formatCompactAxisValue(d.value)}`,
    color: donutColors[idx % donutColors.length],
  }));
}
