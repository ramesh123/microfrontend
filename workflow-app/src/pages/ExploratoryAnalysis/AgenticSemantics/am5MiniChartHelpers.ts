/**
 * Shared palette and bar/column UX helpers for Am5MiniChart.
 */

import type { ChartDetail } from "./chartTypes";
import { isDataQualityChartDetail } from "./chartTypes";
import {
  attachSeriesLinkedTooltipContrast,
  attachSeriesLinkedTooltipText,
  createSeriesLinkedTooltip,
  createSeriesLinkedTooltipWithText,
  syncTooltipFillFromColumn,
  type Am5TooltipDataItem,
} from "./am5MiniChartTooltip";
import {
  applyAm5InterfaceTheme,
  probeAmChartThemeColors,
} from "@/pages/charts/components/charts/amChartThemeColors";

export {
  attachSeriesLinkedTooltipContrast,
  attachSeriesLinkedTooltipText,
  assignColumnSeriesTemplateTooltip,
  attachColumnTooltipBarColorSync,
  syncTooltipFillFromColumn,
  contrastTextColorForRgb,
  createSeriesLinkedTooltip,
  createSeriesLinkedTooltipWithText,
  resolveAm5FillToRgb,
} from "./am5MiniChartTooltip";
export type {
  Am5TooltipDataItem,
  SeriesLinkedTooltipOptions,
  SeriesLinkedTooltipPointer,
} from "./am5MiniChartTooltip";

type Am5DataItem = Am5TooltipDataItem;

type Am5Module = typeof import("@amcharts/amcharts5");

/** Build a series-linked tooltip with compact value formatting (all XY mini charts). */
export function createCompactSeriesLinkedTooltip(
  root: unknown,
  am5: Am5Module,
  buildText: (di: Am5TooltipDataItem) => string,
  pointerOrientation: "horizontal" | "vertical" = "vertical",
): ReturnType<Am5Module["Tooltip"]["new"]> {
  return createSeriesLinkedTooltipWithText(root, am5, (di) => {
    const vy = Number(di.get?.("valueY"));
    const vx = Number(di.get?.("valueX"));
    if (!Number.isFinite(vy) && !Number.isFinite(vx)) return "";
    return buildText(di);
  }, { pointerOrientation });
}

/** Data-quality Insights dashboard / trends column charts. */
export function isDataQualityAm5BarContext(
  detail: ChartDetail,
  previewSlimBarWidthPx?: number,
): boolean {
  return previewSlimBarWidthPx != null || isDataQualityChartDetail(detail);
}

/** Match {@link AgingAmBarChart} popover/tooltip colors from app CSS tokens. */
export function applyDataQualityAm5Theme(
  root: unknown,
  host: HTMLElement | null | undefined,
): void {
  if (!host) return;
  applyAm5InterfaceTheme(
    root as import("@amcharts/amcharts5").Root,
    probeAmChartThemeColors(host),
  );
}

type DqBarTooltipMode = "single" | "grouped" | "date";

/** Readable tooltip numbers: compact suffix for large values, locale for smaller ones. */
export function formatDqTooltipValue(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 10_000) return formatCompactAxisValue(n);
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: abs >= 100 ? 1 : 2,
  });
}

function humanizeDqTooltipFieldLabel(raw: string | undefined): string {
  const s = String(raw ?? "").trim();
  if (!s) return "Value";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function seriesNameFromTooltipDataItem(di: Am5TooltipDataItem): string {
  const fromComponent = (di as { component?: { get?: (k: string) => unknown } }).component?.get?.(
    "name",
  );
  if (fromComponent != null && String(fromComponent).trim()) return String(fromComponent).trim();
  const fromItem = di.get?.("name");
  if (fromItem != null && String(fromItem).trim()) return String(fromItem).trim();
  return "Series";
}

/** Polished data-quality bar tooltip: series-linked color, multi-line body. */
export function createAgingStyleColumnTooltip(
  root: any,
  am5: Am5Module,
  mode: DqBarTooltipMode,
  valueLabel?: string,
): ReturnType<Am5Module["Tooltip"]["new"]> {
  const tooltip = createSeriesLinkedTooltip(root, am5, { pointerOrientation: "vertical" });
  const metricLabel = humanizeDqTooltipFieldLabel(valueLabel);

  attachSeriesLinkedTooltipText(tooltip, (di) => {
    if (mode === "date") {
      const vx = di.get?.("valueX") as number;
      const vy = Number(di.get?.("valueY"));
      if (!Number.isFinite(vx) || !Number.isFinite(vy)) return "";
      const dateStr = root.dateFormatter.format(new Date(vx), "MMM d, yyyy");
      return `${dateStr}\n${metricLabel}: ${formatDqTooltipValue(vy)}`;
    }

    if (mode === "grouped") {
      const vy = Number(di.get?.("valueY"));
      if (!Number.isFinite(vy)) return "";
      const seriesName = seriesNameFromTooltipDataItem(di);
      const cat = String(di.get?.("categoryX") ?? "").trim();
      const valueLine = formatDqTooltipValue(vy);
      return cat ? `${seriesName}\n${cat}\n${valueLine}` : `${seriesName}\n${valueLine}`;
    }

    const vy = Number(di.get?.("valueY"));
    if (!Number.isFinite(vy)) return "";
    const cat = String(di.get?.("categoryX") ?? "").trim() || "—";
    return `${cat}\n${metricLabel}: ${formatDqTooltipValue(vy)}`;
  });

  return tooltip;
}

export function createAgingStyleHorizontalBarTooltip(
  root: any,
  am5: Am5Module,
  valueLabel?: string,
): ReturnType<Am5Module["Tooltip"]["new"]> {
  const tooltip = createSeriesLinkedTooltip(root, am5, { pointerOrientation: "horizontal" });
  const metricLabel = humanizeDqTooltipFieldLabel(valueLabel);

  attachSeriesLinkedTooltipText(tooltip, (di) => {
    const cat = String(di.get?.("categoryY") ?? "").trim() || "—";
    const vx = Number(di.get?.("valueX"));
    if (!Number.isFinite(vx)) return "";
    return `${cat}\n${metricLabel}: ${formatDqTooltipValue(vx)}`;
  });

  return tooltip;
}

/** Truncate long category strings for axis labels; full value remains in tooltips/data. */
export function truncateCategoryAxisLabel(
  text: string | undefined,
  maxChars: number,
): string {
  const s = String(text ?? "");
  if (s.length <= maxChars) return s;
  return `${s.slice(0, maxChars)}…`;
}

/**
 * If `s` looks like an ISO date (e.g. `2026-03-22T00:00:00+00:00`), return a short label
 * like "Mar 22"; otherwise return `s` unchanged.
 */
export function formatCategoryLabelIfIsoDate(s: string): string {
  const t = String(s ?? "").trim();
  if (!/\d{4}-\d{2}-\d{2}/.test(t)) return t;
  const d = new Date(t);
  if (!Number.isFinite(d.getTime())) return t;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(d);
}

/**
 * Tick labels for rotated x axes: prefer short dates for ISO-like strings, then cap
 * length with ASCII `...` so `oversizedBehavior: "truncate"` + `maxWidth` are not
 * the only line of defense (CategoryAxis adapters / DateAxis label text can still
 * receive long strings in some cases).
 */
export function compactAxisLabelText(s: string, maxChars: number = 14): string {
  const formatted = formatCategoryLabelIfIsoDate(String(s ?? "").trim());
  if (formatted.length <= maxChars) return formatted;
  return `${formatted.slice(0, Math.max(0, maxChars - 3))}...`;
}

/** amCharts DateAxis `dateFormats` / `periodChangeDateFormats`: short month+day on daily data. */
export const SHORT_AM5_DATE_AXIS_FORMATS: Record<string, string> = {
  millisecond: "MMM d",
  second: "MMM d",
  minute: "MMM d",
  hour: "MMM d",
  day: "MMM d",
  week: "MMM d",
  month: "MMM yyyy",
  year: "yyyy",
};

export const DASH_COLORS = [
  0x2563eb, 0x06b6d4, 0x8b5cf6, 0xf59e0b, 0x10b981, 0xef4444, 0xec4899, 0x6366f1,
  0x14b8a6, 0xf97316, 0x84cc16, 0xa855f7, 0x0ea5e9, 0xe11d48, 0x22d3ee,
] as const;

/** Same palette as Ask/AskChart — calmer, chart‑readable (line + multiline). */
export const NEAT_CHART_PALETTE = [
  0x3182bd, 0xe6550d, 0x31a354, 0x756bb1, 0x636363, 0x6baed6, 0xfd8d3c, 0x74c476,
  0x9e9ac8, 0x969696, 0x9ecae1, 0xfdae6b, 0xa1d99b, 0xbcbddc, 0xbdbdbd,
] as const;

/** `#rrggbb` from NEAT_CHART_PALETTE integer (Ask/AskChart line colours). */
export function neatChartHexAtIndex(i: number): string {
  const n = NEAT_CHART_PALETTE[i % NEAT_CHART_PALETTE.length];
  return `#${((n >>> 0) & 0xffffff).toString(16).padStart(6, "0")}`;
}

/** Hide in-chart amCharts legend; legend rows render in DOM via `ChartDomScrollLegend`. */
export function hideAm5LegendForDomReplacement(legend: {
  set: (key: string, value: unknown) => void;
}): void {
  try {
    legend.set("visible", false);
    legend.set("opacity", 0);
    try {
      legend.set("forceHidden", true);
    } catch {
      /* ignore */
    }
    try {
      legend.set("height", 0);
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore */
  }
}

/** Linear shine (grouped-bar–style triple) for line stroke (horizontal) or area fill (vertical). */
export function shineLinearGradient(
  root: any,
  am5: Am5Module,
  palette: readonly [string, string, string],
  rotation: number,
) {
  const [top, mid, bot] = palette;
  return am5.LinearGradient.new(root, {
    rotation,
    stops: [
      { color: am5.color(top), offset: 0 },
      { color: am5.color(mid), offset: 0.5 },
      { color: am5.color(bot), offset: 1 },
    ],
  });
}

/** Radial shine for line bullets / pie slices. */
export function shineRadialGradient(
  root: any,
  am5: Am5Module,
  palette: readonly [string, string, string],
) {
  const [top, mid, bot] = palette;
  return am5.RadialGradient.new(root, {
    stops: [
      { color: am5.color(top), offset: 0 },
      { color: am5.color(mid), offset: 0.5 },
      { color: am5.color(bot), offset: 1 },
    ],
  });
}

/** LPG-style column fills / strokes (single- and multi-series bars, not grouped). */
export const BAR_COLUMN_FILL_RGB = [
  0x5e74e9, 0x282f64, 0x5b3474, 0x8a3679, 0xb63a76, 0xd94769, 0xf36355, 0xff863e,
  0xffab22, 0xffcf24,
] as const;
export const BAR_COLUMN_STROKE_RGB = [
  0xd94769, 0x282f64, 0x5b3474, 0x8a3679, 0xb63a76, 0xd94769, 0xf36355, 0xff863e,
  0xffab22, 0xffcf24,
] as const;

export function attachBarColumnPointerUx(
  series: any,
  am5: typeof import("@amcharts/amcharts5"),
  tooltip?: any,
) {
  series.columns.template.events.on("pointerover", (ev: any) => {
    const column = ev.target;
    const tt = tooltip ?? series.get("tooltip");
    if (tt) syncTooltipFillFromColumn(column, tt, am5);
    column.showTooltip();
    column.set("tooltipX", am5.percent(50));
    column.set("tooltipY", 0);
  });
  series.columns.template.events.on("pointerout", (ev: any) => {
    ev.target.hideTooltip();
  });
}

/** Tooltip to the right of the column, vertically centered — avoids adjacent bars and top labels. */
export function attachGroupedBarColumnPointerUx(
  series: any,
  am5: typeof import("@amcharts/amcharts5"),
  tooltip?: any,
) {
  series.columns.template.events.on("pointerover", (ev: any) => {
    const column = ev.target;
    const tt = tooltip ?? series.get("tooltip");
    if (tt) syncTooltipFillFromColumn(column, tt, am5);
    column.showTooltip();
    column.set("tooltipX", am5.percent(100));
    column.set("tooltipY", am5.percent(50));
  });
  series.columns.template.events.on("pointerout", (ev: any) => {
    ev.target.hideTooltip();
  });
}

export function attachBarColumnHoverState(
  series: any,
  am5: typeof import("@amcharts/amcharts5"),
  isDark: boolean,
) {
  /** Match LPG production zone chart: slight lift + readable stroke on hover */
  series.columns.template.states.create("hover", {
    fillOpacity: 0.8,
    strokeOpacity: 0.4,
    stroke: am5.color(isDark ? 0xe2e8f0 : 0x000000),
    scale: 1.02,
  });
}

/** Grouped bars: no scale on hover — avoids overlapping neighbors at tight layouts. */
export function attachGroupedBarColumnHoverState(
  series: any,
  am5: typeof import("@amcharts/amcharts5"),
  isDark: boolean,
) {
  series.columns.template.states.create("hover", {
    fillOpacity: 0.95,
    strokeOpacity: 0.45,
    stroke: am5.color(isDark ? 0xe2e8f0 : 0x000000),
    scale: 1,
  });
}

/**
 * Bar/column layout (amCharts 5):
 *
 * 1. **Axis `startLocation` / `endLocation`** — inset the whole x range so the
 *    first/last bars are not flush with the plot edge (see Am5MiniChart).
 * 2. **Renderer `cellStartLocation` / `cellEndLocation`** — symmetric insets
 *    *within each category* so series draw inside the band between grid lines.
 * 3. **`columns.template.width`** — % of that *series* cell only (keep at 100
 *    when gutters come from (1)+(2); lower only to add extra inner margin).
 * 4. **Column `openLocationX` / `locationX`** — full span `0 → 1` of the
 *    series cell so % width stays centered.
 * 5. **`columns.template.centerX`** — for `%` width, `p50` centers the sprite.
 *    For **fixed pixel** width, use `p0`: the series sets `x` to the left edge
 *    and already centers the span; `p50` would double-anchor and shift the bar.
 */
/** Inset full x-axis so first/last categories aren’t flush with plot L/R edges */
export const BAR_X_AXIS_START_LOCATION = 0.04;
export const BAR_X_AXIS_END_LOCATION = 0.96;
/** Per-category insets: space between grid lines and column (symmetric). */
export const BAR_COLUMN_CATEGORY_CELL_START = 0.06;
export const BAR_COLUMN_CATEGORY_CELL_END = 0.94;
/** % of the series cell width (~35% matches reference: narrow bar, even side padding). */
export const BAR_COLUMN_WIDTH_PCT = 35;
/** Column horizontal span inside each series cell. */
export const BAR_COLUMN_OPEN_LOCATION_X = 0;
export const BAR_COLUMN_LOCATION_X = 1;

/**
 * Value labels: bottom of text sits above the bar top with this offset (px).
 * Use with `centerY: p100` on the Label so spacing matches reference (clear gap, not flush).
 */
export const BAR_VALUE_LABEL_DY = -8;

export function getCategoryCellLocations(isBarOrColumn: boolean) {
  return isBarOrColumn
    ? {
        cellStartLocation: BAR_COLUMN_CATEGORY_CELL_START,
        cellEndLocation: BAR_COLUMN_CATEGORY_CELL_END,
      }
    : { cellStartLocation: 0.2, cellEndLocation: 0.8 };
}

/**
 * Grouped bar: inset within each category so clusters don’t touch grid lines (larger gap between categories).
 */
export const GROUPED_BAR_CATEGORY_CELL_START = 0.12;
export const GROUPED_BAR_CATEGORY_CELL_END = 0.88;

export function getGroupedBarCategoryCellLocations() {
  return {
    cellStartLocation: GROUPED_BAR_CATEGORY_CELL_START,
    cellEndLocation: GROUPED_BAR_CATEGORY_CELL_END,
  };
}

const MS_PER_DAY = 86400000;
/** Smallest gap between points ≥ this → treat as month-bucketed data (month grid, no day row under month). */
const MIN_STEP_FOR_MONTH_BASE_INTERVAL_MS = 20 * MS_PER_DAY;

/**
 * Pick DateAxis `baseInterval` from sorted unique timestamps.
 * Monthly / coarse series must use `month` or amCharts keeps `day` + `markUnitChange` and shows day under month.
 */
export function getDateAxisBaseIntervalFromSortedTimes(
  sortedUniqueTimes: number[],
): { timeUnit: "day" | "month"; count: number } {
  if (sortedUniqueTimes.length < 2) {
    return { timeUnit: "day", count: 1 };
  }
  let minStep = Infinity;
  for (let i = 1; i < sortedUniqueTimes.length; i++) {
    const step = sortedUniqueTimes[i] - sortedUniqueTimes[i - 1];
    if (step > 0 && step < minStep) minStep = step;
  }
  if (!Number.isFinite(minStep) || minStep <= 0) {
    return { timeUnit: "day", count: 1 };
  }
  if (minStep >= MIN_STEP_FOR_MONTH_BASE_INTERVAL_MS) {
    return { timeUnit: "month", count: 1 };
  }
  return { timeUnit: "day", count: 1 };
}

/**
 * Advance a timestamp by one DateAxis `baseInterval` (UTC).
 * Line charts set `strictMinMax` with `max` = last data time; when that equals the
 * start of the last month/day, the last point sits on the plot edge and the final
 * grid line is clipped. Extending `max` by one interval keeps the last bucket inset
 * and shows the trailing vertical grid without adding fake data points.
 */
export function extendTimeByDateAxisBaseInterval(
  timeMs: number,
  base: { timeUnit: "day" | "month"; count: number },
): number {
  const d = new Date(timeMs);
  if (base.timeUnit === "month") {
    d.setUTCMonth(d.getUTCMonth() + base.count);
    return d.getTime();
  }
  d.setUTCDate(d.getUTCDate() + base.count);
  return d.getTime();
}

/**
 * Compact chart numbers (axes, tooltips, data labels): **k** (thousands), **M**
 * (millions), **cr** (crores, 10⁷), **b** (billions). Crore sits between M and b.
 */
export function formatCompactAxisValue(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (n === 0) return "0";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const trim = (x: number): string => x.toFixed(2).replace(/\.?0+$/, "");
  if (abs < 1e3) {
    if (Number.isInteger(abs)) return sign + String(abs);
    return sign + trim(abs);
  }
  if (abs < 1e6) return sign + trim(abs / 1e3) + "k";
  if (abs < 1e7) return sign + trim(abs / 1e6) + "M";
  if (abs < 1e9) return sign + trim(abs / 1e7) + "cr";
  return sign + trim(abs / 1e9) + "b";
}

type Am5AdaptersHost = { adapters: { add: (key: string, fn: (text: unknown, target: unknown) => unknown) => void } };

/** Bullet / point labels: show `valueY` with compact k / M / cr / b. */
export function attachCompactValueYLabelAdapter(label: Am5AdaptersHost): void {
  label.adapters.add("text", (_text, target) => {
    const di = (target as { dataItem?: { get?: (k: string) => unknown } }).dataItem;
    const vy = di?.get?.("valueY");
    const num = vy == null ? NaN : Number(vy);
    if (!Number.isFinite(num)) return String(_text ?? "");
    return formatCompactAxisValue(num);
  });
}

/** Tooltip body: caller builds full rich-text line(s); `fn` runs when `valueY` is numeric. */
export function attachCompactTooltipValueYAdapter(
  tooltip: { label: Am5AdaptersHost },
  fn: (dataItem: { get?: (k: string) => unknown }) => string,
): void {
  tooltip.label.adapters.add("text", (_text, target) => {
    const di = (target as { dataItem?: { get?: (k: string) => unknown } }).dataItem;
    if (!di?.get) return String(_text ?? "");
    const vy = di.get("valueY");
    if (!Number.isFinite(Number(vy))) return String(_text ?? "");
    return fn(di);
  });
}

/** Tooltip label from full `dataItem` (e.g. x + y, or `dataContext.tooltipText`). */
export function attachTooltipLabelAdapter(
  tooltip: { label: Am5AdaptersHost },
  fn: (dataItem: Am5DataItem) => string,
): void {
  tooltip.label.adapters.add("text", (_text, target) => {
    const di = (target as { dataItem?: Am5DataItem }).dataItem;
    if (!di) return String(_text ?? "");
    return fn(di);
  });
}

/** ValueAxis / `AxisRenderer` tick labels — k / M / cr / b (matches Y-axis on dashboard XY charts). */
export function attachCompactValueAxisRendererLabels(renderer: {
  labels: { template: { adapters: { add: (k: string, fn: unknown) => void } } };
}): void {
  renderer.labels.template.adapters.add("text", (text, target) => {
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
}

/**
 * Derive a tight Y-axis range so line variation stays visible (avoid always starting at 0).
 * Mirrors the behavior used in LPG productivity charts.
 */
export function getValueAxisRange(
  values: number[],
  {
    paddingPercent = 0.1,
    minSpanFraction = 0.3,
  }: { paddingPercent?: number; minSpanFraction?: number } = {},
): { min: number; max: number } {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return { min: 0, max: 1 };

  const minVal = Math.min(...finite);
  const maxVal = Math.max(...finite);
  const span = maxVal - minVal || 1;
  const extraSpan = span * minSpanFraction;
  const padding = Math.max(span * paddingPercent, span * 0.05) + extraSpan;

  const min = minVal - padding;
  const max = maxVal + padding;

  return {
    min: minVal >= 0 ? Math.max(0, min) : min,
    max,
  };
}

/**
 * amCharts hit target may be a child (e.g. value Label) without `dataItem`; walk up to the column/slice.
 */
export function resolveAm5SpriteDataContext(ev: unknown): unknown {
  let sprite: any = (ev as { target?: unknown })?.target;
  let guard = 0;
  while (sprite && guard++ < 24) {
    const di = sprite.dataItem;
    if (di) {
      const dc = di.dataContext;
      if (dc != null) return dc;
      try {
        const catX = di.get?.("categoryX");
        if (catX != null) return { __categoryX: catX };
      } catch {
        /* ignore */
      }
      try {
        const catY = di.get?.("categoryY");
        if (catY != null) return { __categoryX: catY };
      } catch {
        /* ignore */
      }
    }
    sprite = sprite.parent;
  }
  return undefined;
}

function drilldownLabelFromResolvedContext(
  ctx: unknown,
  isDateBased: boolean,
): string {
  if (ctx == null) return "";
  if (typeof ctx === "object" && ctx !== null && "__categoryX" in ctx) {
    return String((ctx as { __categoryX: unknown }).__categoryX ?? "").trim();
  }
  const o = ctx as {
    xCategory?: unknown;
    categoryX?: unknown;
    category?: unknown;
    categoryY?: unknown;
    date?: unknown;
  };
  if (isDateBased) {
    const d = o.date;
    if (typeof d === "number" && Number.isFinite(d)) {
      return new Date(d).toISOString().slice(0, 10);
    }
    return "";
  }
  const v = o.xCategory ?? o.categoryX ?? o.category ?? o.categoryY;
  return String(v ?? "").trim();
}

/**
 * Left-click on a column: emit category label for workspace drilldown (bar/column charts).
 * Skips when `drilldownEnabled` is false or no handler.
 */
export function attachDrilldownOnColumnSeries(
  series: any,
  drilldownEnabled: boolean | undefined,
  onCategory: ((label: string) => void) | undefined,
  isDateBased: boolean,
): void {
  if (!drilldownEnabled || !onCategory) return;
  const dispatch = (ev: unknown) => {
    const ctx = resolveAm5SpriteDataContext(ev);
    const label = drilldownLabelFromResolvedContext(ctx, isDateBased);
    if (label) onCategory(label);
  };
  series.columns.template.events.on("click", dispatch);
}
