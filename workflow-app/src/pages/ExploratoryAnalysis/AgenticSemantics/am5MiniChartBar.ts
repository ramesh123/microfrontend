import type { Am5XyChartContext } from "./am5MiniChartXyTypes";
import { renderAm5GroupedBarSeries } from "./am5MiniChartBarGrouped";
import { renderAm5SingleBarSeries } from "./am5MiniChartBarSingle";

export function renderAm5BarSeries(ctx: Am5XyChartContext): void {
  const { isGroupedBar, isDateBased, valueKeys } = ctx;

  if (isGroupedBar && !isDateBased && valueKeys.length > 0) {
    renderAm5GroupedBarSeries(ctx);
  } else {
    renderAm5SingleBarSeries(ctx);
  }
}
