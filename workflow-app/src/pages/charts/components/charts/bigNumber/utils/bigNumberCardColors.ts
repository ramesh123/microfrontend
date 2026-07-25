import type { CSSProperties } from 'react';
import { createShinePaletteFromBase } from '@/pages/ExploratoryAnalysis/AgenticSemantics/am5MiniChartConstants';

export type BigNumberCardBackgroundStyle = 'shine' | 'glass';

export type BigNumberCardColorScheme = {
  value: string;
  name: string;
  /** Mid-tone base used to derive shine gradient; null = theme card */
  baseColor: string | null;
};

export const BIG_NUMBER_DEFAULT_WHITE = '#ffffff';

/** Shared corner radius for KPI card shell, fill, and dashboard widget clip. */
export const BIG_NUMBER_CARD_BORDER_RADIUS = '12px';
export const BIG_NUMBER_CARD_RADIUS_CLASS = '!rounded-[12px]';

/** Dashboard-friendly KPI card palettes (shine derived from base). */
export const bigNumberCardColorSchemes: BigNumberCardColorScheme[] = [
  { value: 'theme', name: 'Default (White)', baseColor: null },
  { value: 'ocean', name: 'Ocean Blue', baseColor: '#1F4E79' },
  { value: 'teal', name: 'Teal Shine', baseColor: '#2FA39A' },
  { value: 'royal', name: 'Royal Blue', baseColor: '#3B82F6' },
  { value: 'emerald', name: 'Emerald', baseColor: '#22C55E' },
  { value: 'violet', name: 'Violet', baseColor: '#8B5CF6' },
  { value: 'plum', name: 'Deep Plum', baseColor: '#8E1F5C' },
  { value: 'coral', name: 'Coral', baseColor: '#F97316' },
  { value: 'sunset', name: 'Sunset', baseColor: '#EA580C' },
  { value: 'rose', name: 'Rose', baseColor: '#E11D48' },
  { value: 'gold', name: 'Gold', baseColor: '#CA8A04' },
  { value: 'indigo', name: 'Indigo', baseColor: '#6366F1' },
  { value: 'cyan', name: 'Cyan Glow', baseColor: '#06B6D4' },
  { value: 'slate', name: 'Slate', baseColor: '#475569' },
  // Enterprise KPI / dashboard status tones (reference: plant summary cards)
  { value: 'kpi-green', name: 'KPI Green', baseColor: '#43A073' },
  { value: 'forest', name: 'Forest Green', baseColor: '#2E7D4A' },
  { value: 'lime', name: 'Lime Green', baseColor: '#65A30D' },
  { value: 'marine', name: 'Marine Blue', baseColor: '#1B6B93' },
  { value: 'burgundy', name: 'Burgundy', baseColor: '#9B2C4A' },
  { value: 'amber', name: 'Amber', baseColor: '#D48806' },
  { value: 'charcoal', name: 'Charcoal', baseColor: '#3F4F5F' },
  { value: 'steel-blue', name: 'Steel Blue', baseColor: '#4A6FA5' },
];

export function getBigNumberSchemeByValue(value?: string): BigNumberCardColorScheme | undefined {
  if (!value) return undefined;
  return bigNumberCardColorSchemes.find((s) => s.value === value);
}

export function isValidHexColor(hex: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex.trim());
}

function rgbFromHex(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace(/^#/, '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** True when user picked a non-default card colour in customize. */
export function hasExplicitBigNumberCardColor(opts?: {
  cardColorScheme?: string;
  cardBackgroundColor?: string;
  cardBackgroundStyle?: BigNumberCardBackgroundStyle;
  cardBackgroundImage?: string;
} | null): boolean {
  if (!opts) return false;
  if (typeof opts.cardBackgroundImage === 'string' && opts.cardBackgroundImage.trim()) return true;
  if (typeof opts.cardBackgroundColor === 'string' && opts.cardBackgroundColor.trim()) return true;
  if (opts.cardBackgroundStyle === 'glass') return true;
  const scheme = opts.cardColorScheme;
  return !!scheme && scheme !== 'theme';
}

export function getBigNumberBaseColor(schemeValue?: string): string | null {
  const scheme = getBigNumberSchemeByValue(schemeValue);
  if (!scheme || scheme.value === 'theme' || !scheme.baseColor) return null;
  return scheme.baseColor;
}

export function buildShineGradientCss(
  baseHex: string,
  angleDeg = 135,
): string {
  const [light, mid, dark] = createShinePaletteFromBase(baseHex);
  return `linear-gradient(${angleDeg}deg, ${light} 0%, ${mid} 48%, ${dark} 100%)`;
}

/** Frosted glass KPI card — semi-transparent tinted gradient (no white fade on edges). */
export function buildGlassGradientCss(baseHex: string, angleDeg = 135): string {
  const { r, g, b } = rgbFromHex(baseHex);
  return `linear-gradient(${angleDeg}deg, rgba(${r}, ${g}, ${b}, 0.42) 0%, rgba(${r}, ${g}, ${b}, 0.24) 52%, rgba(${r}, ${g}, ${b}, 0.14) 100%)`;
}

export const BIG_NUMBER_GLASS_NEUTRAL_GRADIENT =
  'linear-gradient(135deg, rgba(255, 255, 255, 0.58) 0%, rgba(241, 245, 249, 0.34) 52%, rgba(148, 163, 184, 0.2) 100%)';

export function normalizeBackgroundOpacity(v?: number | string | null): number {
  if (v === undefined || v === null || v === '') return 1;
  const n = Number(v);
  if (Number.isNaN(n)) return 1;
  if (n > 1) return Math.max(0, Math.min(1, n / 100));
  return Math.max(0, Math.min(1, n));
}

export type BigNumberCardStyleResult = {
  background: string;
  /** No shine colour — plain white card (unless glass style is active) */
  isDefaultWhite: boolean;
  midColor: string | null;
  style: BigNumberCardBackgroundStyle;
  /** Glass-only: frosted border */
  glassBorder?: string;
  /** Glass-only: backdrop blur in px */
  backdropBlur?: number;
  /** Glass cards use accent-coloured text instead of white */
  useAccentText?: boolean;
};

export type BigNumberCardSurfaceOptions = {
  cardColorScheme?: string;
  cardBackgroundColor?: string;
  cardBackgroundStyle?: BigNumberCardBackgroundStyle;
  backgroundOpacity?: number | string;
  bgOpacity?: number | string;
  /** Data URL for uploaded KPI card background image. */
  cardBackgroundImage?: string;
};

function escapeCssUrl(value: string): string {
  return value.replace(/"/g, '\\"');
}

/** Visible outline so glass cards do not disappear on light dashboards. */
export function resolveBigNumberCardBorder(style: BigNumberCardStyleResult): string {
  if (style.style === 'glass') {
    if (style.midColor) {
      const { r, g, b } = rgbFromHex(style.midColor);
      return `1px solid rgba(${r}, ${g}, ${b}, 0.42)`;
    }
    return '1px solid rgba(15, 23, 42, 0.16)';
  }
  if (style.midColor && !style.isDefaultWhite) {
    const { r, g, b } = rgbFromHex(style.midColor);
    return `1px solid rgba(${r}, ${g}, ${b}, 0.34)`;
  }
  return '1px solid hsl(var(--border))';
}

export function resolveBigNumberCardShadow(): string {
  return '0 1px 3px rgba(15, 23, 42, 0.08)';
}

export function buildBigNumberCardSurfaceStyles(
  opts: BigNumberCardSurfaceOptions | null | undefined,
  borderRadius: string,
): {
  fillStyle: CSSProperties;
  shellStyle: CSSProperties;
  cardStyle: BigNumberCardStyleResult;
  hasCardColor: boolean;
  opacity: number;
} {
  const cardStyle = resolveBigNumberCardStyle(opts);
  const isGlass = cardStyle.style === 'glass';
  const imageUrl = opts?.cardBackgroundImage?.trim() ?? '';
  // Shine cards always paint a fill (including default white); otherwise the card stays transparent.
  const hasCardColor =
    cardStyle.style === 'shine' || isGlass || imageUrl.length > 0;
  const opacity = hasCardColor ? normalizeBackgroundOpacity(opts?.backgroundOpacity) : 1;

  const fillStyle: CSSProperties = {
    borderRadius,
    opacity: hasCardColor ? opacity : 1,
  };

  if (imageUrl) {
    fillStyle.backgroundImage = `${cardStyle.background}, url("${escapeCssUrl(imageUrl)}")`;
    fillStyle.backgroundSize = 'cover, cover';
    fillStyle.backgroundPosition = 'center, center';
    fillStyle.backgroundRepeat = 'no-repeat, no-repeat';
  } else {
    fillStyle.background = cardStyle.background;
  }

  if (isGlass) {
    fillStyle.backdropFilter = `blur(${cardStyle.backdropBlur ?? 14}px)`;
    fillStyle.WebkitBackdropFilter = `blur(${cardStyle.backdropBlur ?? 14}px)`;
  }

  const shellStyle: CSSProperties = {
    borderRadius,
    border: resolveBigNumberCardBorder(cardStyle),
    boxShadow: resolveBigNumberCardShadow(),
  };

  return { fillStyle, shellStyle, cardStyle, hasCardColor, opacity };
}

export function resolveBigNumberCardStyle(
  opts: {
    cardColorScheme?: string;
    cardBackgroundColor?: string;
    cardBackgroundStyle?: BigNumberCardBackgroundStyle;
    backgroundOpacity?: number | string;
    bgOpacity?: number | string;
  } | null | undefined,
): BigNumberCardStyleResult {
  const style: BigNumberCardBackgroundStyle =
    opts?.cardBackgroundStyle === 'glass' ? 'glass' : 'shine';

  const customHex =
    typeof opts?.cardBackgroundColor === 'string' && opts.cardBackgroundColor.trim()
      ? opts.cardBackgroundColor.trim()
      : null;

  const base = customHex || getBigNumberBaseColor(opts?.cardColorScheme);

  if (style === 'glass') {
    if (!base) {
      return {
        background: BIG_NUMBER_GLASS_NEUTRAL_GRADIENT,
        isDefaultWhite: true,
        midColor: null,
        style: 'glass',
        glassBorder: '1px solid rgba(255, 255, 255, 0.45)',
        backdropBlur: 14,
        useAccentText: false,
      };
    }
    return {
      background: buildGlassGradientCss(base),
      isDefaultWhite: false,
      midColor: base,
      style: 'glass',
      glassBorder: `1px solid rgba(255, 255, 255, 0.35)`,
      backdropBlur: 14,
      useAccentText: true,
    };
  }

  if (!hasExplicitBigNumberCardColor(opts)) {
    return {
      background: BIG_NUMBER_DEFAULT_WHITE,
      isDefaultWhite: true,
      midColor: BIG_NUMBER_DEFAULT_WHITE,
      style: 'shine',
    };
  }

  if (!base) {
    return {
      background: BIG_NUMBER_DEFAULT_WHITE,
      isDefaultWhite: true,
      midColor: BIG_NUMBER_DEFAULT_WHITE,
      style: 'shine',
    };
  }

  const gradient = buildShineGradientCss(base);
  return {
    background: gradient,
    isDefaultWhite: false,
    midColor: base,
    style: 'shine',
  };
}
