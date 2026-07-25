import * as am5 from '@amcharts/amcharts5';

/** Resolved theme colors for amCharts (RGB-based); probes CSS variables on `host`. */
export type AmChartThemePack = {
  background: am5.Color;
  foreground: am5.Color;
  /** Axis ticks, legends, in-chart titles (plot uses `--card`; use this for readable contrast). */
  cardForeground: am5.Color;
  muted: am5.Color;
  border: am5.Color;
  card: am5.Color;
  popover: am5.Color;
  popoverFg: am5.Color;
};

let probeCanvas: HTMLCanvasElement | null = null;

/**
 * Converts a resolved CSS color string (rgb, rgba, hex, oklch, etc.) to am5.Color via canvas.
 * getComputedStyle often returns oklch(...), which the older rgb-regex parsers miss.
 */
export function resolveCssColorStringToAm5(resolvedCss: string, fallback: am5.Color): am5.Color {
  const s = (resolvedCss || '').trim();
  if (!s) return fallback;
  try {
    if (!probeCanvas) {
      probeCanvas = document.createElement('canvas');
      probeCanvas.width = 1;
      probeCanvas.height = 1;
    }
    const ctx = probeCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return fallback;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000000';
    ctx.fillStyle = s;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return am5.color((r << 16) | (g << 8) | b);
  } catch {
    return fallback;
  }
}

function probeVar(
  probeRoot: HTMLElement,
  prop: 'color' | 'backgroundColor',
  cssVar: string,
): string {
  const div = document.createElement('div');
  div.style.position = 'absolute';
  div.style.left = '-9999px';
  div.style.pointerEvents = 'none';
  div.style.visibility = 'hidden';
  if (prop === 'color') div.style.setProperty('color', cssVar);
  else div.style.setProperty('background-color', cssVar);
  probeRoot.appendChild(div);
  const cs = getComputedStyle(div);
  const raw = prop === 'color' ? cs.color : cs.backgroundColor;
  probeRoot.removeChild(div);
  return raw || '';
}

/**
 * Resolves `--foreground` for the active theme. Re-probe on each call so adapters stay in sync.
 */
export function amChartLabelForeground(host?: HTMLElement | null): am5.Color {
  return probeAmChartThemeColors(host).foreground;
}

/** amCharts label `fill` adapter that always tracks the current `--foreground` token. */
export function createAmChartForegroundFillAdapter(
  host?: HTMLElement | null,
): () => am5.Color {
  return () => amChartLabelForeground(host);
}

/** Reads design tokens from `host` (chart mount) or `<html>` when omitted. */
export function probeAmChartThemeColors(host?: HTMLElement | null): AmChartThemePack {
  const probeRoot = host ?? document.documentElement;
  const fallbackBg = am5.color(0xf4f4f5);
  const fallbackFg = am5.color(0x171717);

  const fgStr = probeVar(probeRoot, 'color', 'var(--foreground)');
  const cardFgStr = probeVar(probeRoot, 'color', 'var(--card-foreground)');
  const bgStr = probeVar(probeRoot, 'backgroundColor', 'var(--background)');
  const mutedStr = probeVar(probeRoot, 'color', 'var(--muted-foreground)');
  const borderStr = probeVar(probeRoot, 'backgroundColor', 'var(--border)');
  const cardStr = probeVar(probeRoot, 'backgroundColor', 'var(--card)');
  const popStr = probeVar(probeRoot, 'backgroundColor', 'var(--popover)');
  const popFgStr = probeVar(probeRoot, 'color', 'var(--popover-foreground)');

  const background = resolveCssColorStringToAm5(bgStr, fallbackBg);
  const foreground = resolveCssColorStringToAm5(fgStr, fallbackFg);
  /** Use for axis ticks, legends, and titles drawn on the chart (plot matches `--card`). */
  const cardForeground = resolveCssColorStringToAm5(cardFgStr, foreground);

  return {
    background,
    foreground,
    cardForeground,
    muted: resolveCssColorStringToAm5(mutedStr, foreground),
    border: resolveCssColorStringToAm5(borderStr, am5.color(0x888888)),
    card: resolveCssColorStringToAm5(cardStr, background),
    popover: resolveCssColorStringToAm5(popStr, resolveCssColorStringToAm5(cardStr, background)),
    popoverFg: resolveCssColorStringToAm5(popFgStr, foreground),
  };
}

/** Maps app tokens into amCharts interface colors (scrollbars, defaults, etc.). */
export function applyAm5InterfaceTheme(root: am5.Root, t: AmChartThemePack): void {
  const trySet = (key: string, color: am5.Color) => {
    try {
      root.interfaceColors.set(key as any, color);
    } catch {
      /* unknown key for this amCharts build */
    }
  };
  trySet('background', t.background);
  trySet('alternativeBackground', t.card);
  trySet('text', t.foreground);
  trySet('grid', t.muted);
  trySet('disabled', t.muted);
}
