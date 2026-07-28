import type { ChartDetail } from "./chartTypes";

/** Base colours for grouped bar series (order cycles when there are more series). */
export const GROUPED_BAR_BASE_COLORS: readonly string[] = [
  "#1F4E79", // dark blue
  "#2FA39A", // teal
  "#8E1F5C", // deep purple
  "#F97316", // orange
  "#3B82F6", // bright blue
  "#14B8A6", // aqua teal
  "#A855F7", // violet
  "#EF4444", // red
  "#22C55E", // green
  "#EAB308", // yellow gold
  "#06B6D4", // cyan
  "#F43F5E", // pink red
];

function rgbFromHex(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace(/^#/, "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function hexFromRgb(r: number, g: number, b: number): string {
  const clamp = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)));
  return `#${[r, g, b]
    .map((c) => clamp(c).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Mix hex `a` toward `b` (0 = a, 1 = b). */
function mixHexToward(a: string, b: string, t: number): string {
  const A = rgbFromHex(a);
  const B = rgbFromHex(b);
  return hexFromRgb(
    A.r + (B.r - A.r) * t,
    A.g + (B.g - A.g) * t,
    A.b + (B.b - A.b) * t,
  );
}

/**
 * Same shine as grouped bars: subtle highlight → base → darker (for line / pie from any base hex).
 */
export function createShinePaletteFromBase(
  baseHex: string,
): readonly [string, string, string] {
  return [
    mixHexToward(baseHex, "#ffffff", 0.2),
    baseHex,
    mixHexToward(baseHex, "#0a0a12", 0.42),
  ] as const;
}

/** `#rrggbb` from `0xRRGGBB` — for shine palettes from numeric chart colours. */
export function rgbIntToHex(n: number): string {
  return `#${((n >>> 0) & 0xffffff).toString(16).padStart(6, "0")}`;
}

/** AmCharts `Color` / numeric rgb → `#rrggbb` for `createShinePaletteFromBase`. */
export function colorSourceToHex(color: unknown): string {
  if (typeof color === "number" && Number.isFinite(color)) return rgbIntToHex(color);
  const c = color as { rgb?: number; get?: (k: string) => unknown } | null | undefined;
  const rgb = c?.rgb ?? (typeof c?.get === "function" ? c.get("rgb") : undefined);
  if (typeof rgb === "number" && Number.isFinite(rgb)) return rgbIntToHex(rgb);
  return "#94a3b8";
}

/**
 * Grouped bar: vertical shine per series (subtle highlight → base → darker).
 * Little dark shiny: modest white mix on top, deeper mix toward black at bottom.
 */
export const GROUPED_BAR_SHINE_PALETTES: ReadonlyArray<
  readonly [string, string, string]
> = GROUPED_BAR_BASE_COLORS.map((base) => createShinePaletteFromBase(base));

/** Palette for grouped bar charts (one color per series / month-style slot). Saturated, chart-distinct. */
export const chartColors = [
  "#3B82F6",
  "#F59E0B",
  "#10B981",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#F97316",
  "#84CC16",
  "#6366F1",
  "#EAB308",
  "#14B8A6",
  "#D946EF",
  "#EF4444",
  "#22C55E",
  "#A855F7",
];

/** Pie / donut slice colours (distinct, readable on light and dark backgrounds). */
export const donutColors = [
  "#1F9D8F", // teal (main)
  "#E67E22", // orange
  "#C81D25", // red
  "#2D7FC7", // blue
  "#6A1B9A", // purple
  "#43A047", // green
  "#F59E0B", // amber
  "#0F7C82", // dark teal
  "#8E44AD", // violet
  "#2C3E50", // slate dark
];

/** Grouped bar: fixed column width (px) per series slot; clustering divides each category band. */
export const GROUPED_BAR_COLUMN_WIDTH_PX = 30;

/** Data Quality dashboard / DQ tabbed preview only (`data-agentic-chart-preview` on wrapper). */
export const DATA_PREVIEW_BAR_COLUMN_WIDTH_PX = 10;

/** Bar charts with this many category slots (or fewer) use {@link FEW_BAR_COLUMN_WIDTH_PX}. */
export const FEW_BAR_CATEGORY_MAX = 3;

/** Fixed column/bar thickness (px) when {@link FEW_BAR_CATEGORY_MAX} or fewer values. */
export const FEW_BAR_COLUMN_WIDTH_PX = 20;

/** Gap between bar top and value label (px), with label `centerY: p100`. */
export const GROUPED_BAR_VALUE_LABEL_DY = -6;

/** Category buckets (e.g. months) visible before horizontal scroll on grouped_bar. */
export const GROUPED_BAR_SCROLLBAR_INITIAL_VISIBLE = 2;

/** Categories visible in the scrollbar viewport on single-series bar/column charts. */
export const SINGLE_BAR_SCROLLBAR_INITIAL_VISIBLE = 7;

/** Grouped bar: keep enough chars for month-style labels. */
export const BAR_CATEGORY_AXIS_LABEL_MAX_CHARS_GROUPED = 12;

/** Single-series bar: short prefix + ellipsis (e.g. BANGALORE LPG RO → BANGL…). */
export const BAR_CATEGORY_AXIS_LABEL_MAX_CHARS_COMPACT = 10;

/**
 * Line/area DateAxis: horizontal inset as a fraction of the data time span.
 * Using relative padding (not half the min step) keeps the first/last points
 * visually consistent for monthly vs daily series.
 */
export const DATE_AXIS_RELATIVE_PAD = 0.02;

/**
 * Bar & line mini charts (Insights): one inset system so line top matches bar and
 * left/right match across chart types (replaces older bar=20 / line date=40 split).
 */
export const MINI_XY_CHART_PADDING = {
  top: 10,
  bottom: 7,
  side: 12,
} as const;

/**
 * Bottom x-axis labels rotated -90°: use with `oversizedBehavior: "truncate"` so long
 * text clips with an explicit ASCII ellipsis (amCharts defaults to Unicode `…`).
 */
export const VERTICAL_X_AXIS_LABEL_ELLIPSIS = "..." as const;

const MONTH_ABBR_ORDER = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
] as const;

/** Sort key for labels like "Nov-25" / "Jan-26" (Date.parse is unreliable for these). */
export function sortKeyMonthYearLabel(s: string): number | null {
  const m = s.trim().match(/^([A-Za-z]{3})-(\d{2})$/);
  if (!m) return null;
  const mi = MONTH_ABBR_ORDER.indexOf(m[1].toLowerCase() as (typeof MONTH_ABBR_ORDER)[number]);
  if (mi < 0) return null;
  const yy = Number.parseInt(m[2], 10);
  if (!Number.isFinite(yy)) return null;
  const fullYear = 2000 + yy;
  return fullYear * 12 + mi;
}

/** Rounds max up to a “nice” bound so the value axis can show evenly spaced ticks. */
export function niceYAxisMax(maxVal: number): number {
  if (!Number.isFinite(maxVal) || maxVal <= 0) return 1;
  const range = maxVal * 1.12;
  const exp = Math.floor(Math.log10(range));
  const f = 10 ** exp;
  const nf = range / f;
  let nice: number;
  if (nf <= 1) nice = 1;
  else if (nf <= 2) nice = 2;
  else if (nf <= 5) nice = 5;
  else nice = 10;
  return nice * f;
}

/** Unique x-axis category buckets for bar/column charts (not series row count). */
export function countBarChartCategoryValues(
  rawData: Record<string, unknown>[],
  detail: Pick<ChartDetail, "category_column">,
): number {
  if (!rawData.length) return 0;
  const keys = Object.keys(rawData[0] ?? {});
  if (!keys.length) return rawData.length;
  const dateKey =
    keys.find((k) => k === "date" || k === "Date" || k === "timestamp") ??
    keys[0];
  const seriesKey = "category";
  const legacyHasCategoryCol = rawData.some(
    (d) => (d as Record<string, unknown>)[seriesKey] != null,
  );
  const userCategoryCol = (detail.category_column ?? "").trim();
  const categoryAxisKey =
    userCategoryCol && keys.includes(userCategoryCol)
      ? userCategoryCol
      : legacyHasCategoryCol
        ? seriesKey
        : dateKey;
  const unique = new Set(
    rawData.map((d) =>
      String((d as Record<string, unknown>)[categoryAxisKey] ?? "").trim(),
    ),
  );
  unique.delete("");
  return unique.size > 0 ? unique.size : rawData.length;
}

export function isFewBarCategories(categoryCount: number): boolean {
  return categoryCount > 0 && categoryCount <= FEW_BAR_CATEGORY_MAX;
}

/** Few categories → 4px; otherwise keep the caller’s default width. */
export function resolveBarColumnWidthPx(
  categoryCount: number,
  defaultWidthPx: number,
): number {
  return isFewBarCategories(categoryCount)
    ? FEW_BAR_COLUMN_WIDTH_PX
    : defaultWidthPx;
}
