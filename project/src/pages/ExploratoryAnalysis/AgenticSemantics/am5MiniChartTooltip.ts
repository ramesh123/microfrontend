/**
 * Series-linked tooltips for Am5MiniChart: background follows hovered sprite fill/stroke,
 * label contrast is computed dynamically, shared chrome (radius, shadow, padding).
 */

type Am5Module = typeof import("@amcharts/amcharts5");

export type SeriesLinkedTooltipPointer =
  | "horizontal"
  | "vertical"
  | "left"
  | "right";

export type SeriesLinkedTooltipOptions = {
  pointerOrientation?: SeriesLinkedTooltipPointer;
  labelText?: string;
  maxLabelWidth?: number;
  fontSize?: number;
  fontWeight?: string | number;
  padding?: { top?: number; right?: number; bottom?: number; left?: number };
};

export type Am5TooltipDataItem = {
  get?: (k: string) => unknown;
  dataContext?: unknown;
  component?: { get?: (k: string) => unknown; strokes?: { template?: { get?: (k: string) => unknown } } };
};

type Rgb = { r: number; g: number; b: number };

const DEFAULT_PADDING = { top: 10, right: 14, bottom: 10, left: 14 };
const DEFAULT_MAX_LABEL_WIDTH = 280;
const DEFAULT_FONT_SIZE = 12;
const CONTRAST_LUMINANCE_THRESHOLD = 0.52;

function am5ColorToRgb(color: unknown): Rgb | null {
  if (color == null) return null;
  try {
    const c = color as {
      toNumber?: () => number;
      r?: number;
      g?: number;
      b?: number;
    };
    if (
      typeof c.r === "number" &&
      typeof c.g === "number" &&
      typeof c.b === "number"
    ) {
      return {
        r: Math.round(c.r),
        g: Math.round(c.g),
        b: Math.round(c.b),
      };
    }
    const n =
      typeof color === "number"
        ? color
        : typeof c.toNumber === "function"
          ? c.toNumber()
          : NaN;
    if (!Number.isFinite(n)) return null;
    const u = n >>> 0;
    return { r: (u >> 16) & 0xff, g: (u >> 8) & 0xff, b: u & 0xff };
  } catch {
    return null;
  }
}

function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG-inspired pick: light text on dark fills, dark text on light fills. */
export function contrastTextColorForRgb(
  am5: Am5Module,
  rgb: Rgb,
): ReturnType<Am5Module["color"]> {
  return relativeLuminance(rgb) > CONTRAST_LUMINANCE_THRESHOLD
    ? am5.color(0x111827)
    : am5.color(0xf9fafb);
}

/** Resolve solid or gradient fill to a representative RGB (mid stop for gradients). */
export function resolveAm5FillToRgb(fill: unknown, am5: Am5Module): Rgb | null {
  if (fill == null) return null;
  const direct = am5ColorToRgb(fill);
  if (direct) return direct;

  const grad = fill as {
    get?: (k: string) => unknown;
    stops?: Array<{ color?: unknown; get?: (k: string) => unknown }>;
  };
  const stopsRaw = grad.get?.("stops") ?? grad.stops;
  if (Array.isArray(stopsRaw) && stopsRaw.length > 0) {
    const mid = stopsRaw[Math.floor(stopsRaw.length / 2)] ?? stopsRaw[0];
    const stopColor =
      mid?.get?.("color") ??
      (mid as { color?: unknown })?.color ??
      stopsRaw[0]?.get?.("color") ??
      stopsRaw[0]?.color;
    return am5ColorToRgb(stopColor);
  }

  return null;
}

function readVisualFillFromSprite(sprite: unknown): unknown {
  if (sprite == null || typeof sprite !== "object") return null;
  const s = sprite as { get?: (k: string) => unknown };
  if (!s.get) return null;
  for (const key of ["fillGradient", "fill", "strokeGradient", "stroke"] as const) {
    const v = s.get(key);
    if (v != null) return v;
  }
  return null;
}

const LINKED_BAR_FILL_KEY = "_linkedBarFill";

/** Tooltip backgrounds need a solid am5.Color — LinearGradient on Tooltip bg renders black. */
function visualToTooltipSolidFill(
  visual: unknown,
  am5: Am5Module,
): ReturnType<Am5Module["color"]> | null {
  if (visual == null) return null;
  const rgb = resolveAm5FillToRgb(visual, am5);
  if (rgb) return am5.color((rgb.r << 16) | (rgb.g << 8) | rgb.b);
  return null;
}

/** Stash a solid fill on the tooltip so background adapters render line/bar colours (not gradients). */
export function primeSeriesLinkedTooltipFill(
  tooltip: { set: (key: string, value: unknown) => void; get: (key: string) => unknown },
  visual: unknown,
  am5: Am5Module,
): void {
  const solid = visualToTooltipSolidFill(visual, am5);
  if (solid == null) return;
  tooltip.set(LINKED_BAR_FILL_KEY, solid);
  const bg = tooltip.get("background") as {
    set?: (key: string, value: unknown) => void;
    setAll?: (v: Record<string, unknown>) => void;
  };
  bg?.setAll?.({ fill: solid, fillOpacity: 0.97 });
  bg?.set?.("fill", solid);
}

/** Apply hovered column colour to a series/column tooltip background. */
export function syncTooltipFillFromColumn(
  column: unknown,
  tooltip: { set: (key: string, value: unknown) => void; get: (key: string) => unknown },
  am5: Am5Module,
): void {
  const col = column as { get?: (k: string) => unknown } | undefined;
  if (!col?.get) return;
  const visual =
    col.get("fillGradient") ??
    col.get("fill") ??
    col.get("strokeGradient") ??
    col.get("stroke");
  primeSeriesLinkedTooltipFill(tooltip, visual, am5);
}

function resolveColumnSpriteFromDataItem(di: unknown): unknown {
  if (di == null) return null;
  const dataItem = di as {
    index?: number;
    component?: {
      columns?: {
        getIndex?: (index: number) => unknown;
        each?: (fn: (col: unknown) => void) => void;
      };
    };
  };
  const columns = dataItem.component?.columns;
  if (!columns) return null;

  const idx = dataItem.index;
  if (typeof idx === "number" && typeof columns.getIndex === "function") {
    const byIndex = columns.getIndex(idx);
    if (byIndex) return byIndex;
  }

  if (columns.each) {
    let matched: unknown = null;
    columns.each((col: unknown) => {
      if ((col as { dataItem?: unknown }).dataItem === di) matched = col;
    });
    if (matched) return matched;
  }

  return null;
}

/**
 * Column series: stash hovered bar fill on pointerover so series-level tooltips
 * inherit the exact per-bar gradient (adapters on columns.template).
 */
export function attachColumnTooltipBarColorSync(
  series: {
    columns: {
      template: {
        events: { on: (type: string, fn: (ev: { target?: unknown }) => void) => void };
      };
    };
  },
  tooltip: {
    set: (key: string, value: unknown) => void;
    get: (key: string) => unknown;
  },
  am5: Am5Module,
): void {
  series.columns.template.events.on("pointerover", (ev) => {
    syncTooltipFillFromColumn(ev.target, tooltip, am5);
  });
}

/** Walk tooltip host + ancestors (column, bullet, line segment, etc.). */
function resolveVisualFillFromTooltipHost(
  tooltip: { parent?: unknown; dataItem?: unknown; get?: (k: string) => unknown },
  am5: Am5Module,
): unknown {
  const stashed = tooltip.get?.(LINKED_BAR_FILL_KEY);
  if (stashed != null) return stashed;

  const di = tooltip.dataItem;
  const fromColumn = readVisualFillFromSprite(resolveColumnSpriteFromDataItem(di));
  if (fromColumn != null) return fromColumn;

  let sprite: unknown = tooltip.parent;
  for (let depth = 0; depth < 14 && sprite != null; depth++) {
    const visual = readVisualFillFromSprite(sprite);
    if (visual != null) return visual;
    sprite = (sprite as { parent?: unknown }).parent;
  }
  return resolveVisualFillFromDataItem(
    tooltip.dataItem as Am5TooltipDataItem | undefined,
    am5,
  );
}

type Am5TemplateRef = { get?: (k: string) => unknown };
type Am5SeriesComponentRef = {
  get?: (k: string) => unknown;
  strokes?: { template?: Am5TemplateRef };
  fills?: { template?: Am5TemplateRef };
};

function resolveVisualFillFromDataItem(
  di: Am5TooltipDataItem | undefined,
  _am5: Am5Module,
): unknown {
  if (!di) return null;

  const fromColumn = readVisualFillFromSprite(resolveColumnSpriteFromDataItem(di));
  if (fromColumn != null) return fromColumn;

  const comp = di.component as Am5SeriesComponentRef | undefined;

  if (comp?.get) {
    for (const key of ["fillGradient", "fill", "strokeGradient", "stroke"] as const) {
      const v = comp.get(key);
      if (v != null) return v;
    }
    const strokeTpl = comp.strokes?.template;
    if (strokeTpl?.get) {
      const strokeVisual =
        strokeTpl.get("strokeGradient") ?? strokeTpl.get("stroke");
      if (strokeVisual != null) return strokeVisual;
    }
    const fillTpl = comp.fills?.template;
    if (fillTpl?.get) {
      const fillVisual = fillTpl.get("fillGradient") ?? fillTpl.get("fill");
      if (fillVisual != null) return fillVisual;
    }
  }

  const bullets = (di as { bullets?: Array<{ get?: (k: string) => unknown }> }).bullets;
  if (Array.isArray(bullets)) {
    for (const bullet of bullets) {
      const visual = readVisualFillFromSprite(bullet?.get?.("sprite"));
      if (visual != null) return visual;
    }
  }

  const graphics = (di as { get?: (k: string) => unknown }).get?.("graphics");
  const fromGraphics = readVisualFillFromSprite(graphics);
  if (fromGraphics != null) return fromGraphics;

  return null;
}

/**
 * Column/bar series: attach tooltip on `columns.template` so the hovered bar's
 * fill/gradient drives tooltip background (series-level tooltips miss per-column adapters).
 */
export function assignColumnSeriesTemplateTooltip(
  series: { columns: { template: { setAll: (v: Record<string, unknown>) => void } } },
  tooltip: unknown,
): void {
  series.columns.template.setAll({ tooltip });
}

/** Background fill follows hovered column/line/slice (gradients + solid). */
function attachSeriesLinkedTooltipBackgroundFill(
  tooltip: { get: (k: string) => unknown; dataItem?: unknown; parent?: unknown },
  am5: Am5Module,
): void {
  const bg = tooltip.get("background") as {
    adapters?: { add?: (key: string, fn: (fill: unknown, target: unknown) => unknown) => void };
  };
  bg?.adapters?.add?.("fill", (fill: unknown) => {
    const stashed = tooltip.get?.(LINKED_BAR_FILL_KEY);
    const stashedSolid = visualToTooltipSolidFill(stashed, am5);
    if (stashedSolid != null) return stashedSolid;

    const fromHost = resolveVisualFillFromTooltipHost(tooltip, am5);
    const hostSolid = visualToTooltipSolidFill(fromHost, am5);
    if (hostSolid != null) return hostSolid;

    if (fill != null && resolveAm5FillToRgb(fill, am5)) return fill;
    const di = tooltip.dataItem as Am5TooltipDataItem | undefined;
    const rgb = seriesColorFromDataItem(di, am5);
    if (rgb) return am5.color((rgb.r << 16) | (rgb.g << 8) | rgb.b);
    return fill;
  });
}

function seriesColorFromDataItem(
  di: Am5TooltipDataItem | undefined,
  am5: Am5Module,
): Rgb | null {
  if (!di) return null;
  const fromVisual = resolveVisualFillFromDataItem(di, am5);
  if (fromVisual != null) return resolveAm5FillToRgb(fromVisual, am5);
  const component = di.component;
  if (component?.get) {
    for (const key of ["fill", "stroke"] as const) {
      const c = component.get(key);
      const rgb = resolveAm5FillToRgb(c, am5);
      if (rgb) return rgb;
    }
    const strokeTpl = component.strokes?.template?.get?.("stroke");
    const strokeGrad = component.strokes?.template?.get?.("strokeGradient");
    const rgbStroke =
      resolveAm5FillToRgb(strokeGrad, am5) ?? resolveAm5FillToRgb(strokeTpl, am5);
    if (rgbStroke) return rgbStroke;
  }
  return null;
}

function applyTooltipChrome(
  tooltip: any,
  am5: Am5Module,
  opts: SeriesLinkedTooltipOptions,
): void {
  const pad = { ...DEFAULT_PADDING, ...opts.padding };
  tooltip.setAll({
    getFillFromSprite: false,
    getStrokeFromSprite: false,
    autoTextColor: false,
    pointerOrientation: opts.pointerOrientation ?? "vertical",
    animationDuration: 160,
    paddingTop: pad.top,
    paddingBottom: pad.bottom,
    paddingLeft: pad.left,
    paddingRight: pad.right,
    ...(opts.labelText ? { labelText: opts.labelText } : {}),
  });

  const bg = tooltip.get("background");
  bg?.setAll?.({
    fill: am5.color(0x4b5563),
    fillOpacity: 0.97,
    strokeWidth: 1,
    strokeOpacity: 0.35,
    cornerRadiusTL: 8,
    cornerRadiusTR: 8,
    cornerRadiusBL: 8,
    cornerRadiusBR: 8,
    shadowColor: am5.color(0x000000),
    shadowOpacity: 0.2,
    shadowOffsetX: 0,
    shadowOffsetY: 3,
    shadowBlur: 10,
  });

  bg?.adapters?.add("stroke", (_stroke, target) => {
    const fill = (target as { get?: (k: string) => unknown })?.get?.("fill");
    const rgb = resolveAm5FillToRgb(fill, am5);
    if (!rgb) return _stroke;
    const lum = relativeLuminance(rgb);
    return am5.color(lum > 0.6 ? 0x000000 : 0xffffff);
  });

  tooltip.label.setAll({
    fontSize: opts.fontSize ?? DEFAULT_FONT_SIZE,
    fontWeight: opts.fontWeight ?? "600",
    textAlign: "left",
    oversizedBehavior: "wrap",
    maxWidth: opts.maxLabelWidth ?? DEFAULT_MAX_LABEL_WIDTH,
    lineHeight: 1.35,
  });

  attachSeriesLinkedTooltipBackgroundFill(tooltip, am5);
}

/** Label fill tracks tooltip background (sprite-linked) for accessible contrast. */
export function attachSeriesLinkedTooltipContrast(
  tooltip: any,
  am5: Am5Module,
): void {
  tooltip.label.adapters.add("fill", (_fill, target) => {
    const di = (tooltip.dataItem ??
      (target as { dataItem?: Am5TooltipDataItem }).dataItem) as
      | Am5TooltipDataItem
      | undefined;
    const bgFill = tooltip.get("background")?.get?.("fill");
    let rgb = resolveAm5FillToRgb(bgFill, am5);
    if (!rgb) {
      const visual = resolveVisualFillFromTooltipHost(tooltip, am5);
      if (visual != null) rgb = resolveAm5FillToRgb(visual, am5);
    }
    if (!rgb) rgb = seriesColorFromDataItem(di, am5);
    if (!rgb) return contrastTextColorForRgb(am5, { r: 55, g: 65, b: 81 });
    return contrastTextColorForRgb(am5, rgb);
  });
}

export function attachSeriesLinkedTooltipText(
  tooltip: any,
  buildText: (di: Am5TooltipDataItem) => string,
): void {
  tooltip.label.adapters.add("text", (_text, target) => {
    const di = ((target as { dataItem?: Am5TooltipDataItem }).dataItem ??
      tooltip.dataItem) as Am5TooltipDataItem | undefined;
    if (!di) return String(_text ?? "");
    const built = buildText(di);
    return built.trim() ? built : String(_text ?? "");
  });
}

/**
 * Tooltip whose background + pointer inherit the hovered bar/line/area/slice fill.
 * Works for any series count — attach one per series; cursor snap shows one per series at X.
 */
export function createSeriesLinkedTooltip(
  root: any,
  am5: Am5Module,
  opts: SeriesLinkedTooltipOptions = {},
): ReturnType<Am5Module["Tooltip"]["new"]> {
  const tooltip = am5.Tooltip.new(root, {});
  applyTooltipChrome(tooltip, am5, opts);
  attachSeriesLinkedTooltipContrast(tooltip, am5);
  return tooltip;
}

export function createSeriesLinkedTooltipWithText(
  root: any,
  am5: Am5Module,
  buildText: (di: Am5TooltipDataItem) => string,
  opts: SeriesLinkedTooltipOptions = {},
): ReturnType<Am5Module["Tooltip"]["new"]> {
  const tooltip = createSeriesLinkedTooltip(root, am5, opts);
  attachSeriesLinkedTooltipText(tooltip, buildText);
  return tooltip;
}
