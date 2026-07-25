import type { CSSProperties } from 'react';
import {
  BIG_NUMBER_DEFAULT_WHITE,
  buildShineGradientCss,
  getBigNumberBaseColor,
  normalizeBackgroundOpacity,
} from './bigNumberCardColors';
import type { BigNumberKpiCustomizeOptions } from './bigNumberKpiCustomizeTypes';

export type KpiCardSurfaceStyle = {
  overlayStyle: CSSProperties;
  cardStyle: CSSProperties;
  isDefaultWhite: boolean;
  isGlass: boolean;
};

type KpiStyleOptions = BigNumberKpiCustomizeOptions & {
  cardColorScheme?: string;
  cardBackgroundColor?: string;
  backgroundOpacity?: number | string;
};

function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().replace('#', '');
  if (normalized.length === 3) {
    return {
      r: parseInt(normalized[0] + normalized[0], 16),
      g: parseInt(normalized[1] + normalized[1], 16),
      b: parseInt(normalized[2] + normalized[2], 16),
    };
  }
  if (normalized.length === 6) {
    return {
      r: parseInt(normalized.slice(0, 2), 16),
      g: parseInt(normalized.slice(2, 4), 16),
      b: parseInt(normalized.slice(4, 6), 16),
    };
  }
  return null;
}

export function hexToRgba(hex: string, alpha: number): string {
  const rgb = parseHexColor(hex);
  if (!rgb) return hex;
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}

export function resolveKpiCardSurfaceStyle(options: KpiStyleOptions | null | undefined): KpiCardSurfaceStyle {
  const glass = options?.kpiGlassEffect === true;
  const glassOpacity = normalizeBackgroundOpacity(options?.kpiGlassOpacity ?? 65);
  const glassBlur = Math.max(0, Math.min(32, Number(options?.kpiGlassBlur ?? 12) || 12));
  const borderColor = options?.kpiBorderColor?.trim();
  const glassTint = options?.kpiGlassTintColor?.trim() || '#ffffff';

  const kpiCustomBg = options?.kpiCardBackgroundColor?.trim();
  const schemeKey = options?.kpiCardColorScheme || options?.cardColorScheme;
  const legacyCustomBg =
    typeof options?.cardBackgroundColor === 'string' ? options.cardBackgroundColor.trim() : '';

  let background: string = BIG_NUMBER_DEFAULT_WHITE;
  let isDefaultWhite = true;
  let useGradientOpacity = false;

  if (kpiCustomBg) {
    background = glass ? hexToRgba(kpiCustomBg, glassOpacity) : kpiCustomBg;
    isDefaultWhite = false;
  } else if (schemeKey && schemeKey !== 'theme') {
    const base = getBigNumberBaseColor(schemeKey);
    if (base) {
      if (glass) {
        background = hexToRgba(base, Math.min(0.85, glassOpacity * 0.55 + 0.15));
      } else {
        background = buildShineGradientCss(base);
        useGradientOpacity = true;
      }
      isDefaultWhite = false;
    }
  } else if (legacyCustomBg) {
    background = glass ? hexToRgba(legacyCustomBg, glassOpacity) : legacyCustomBg;
    isDefaultWhite = false;
  } else if (glass) {
    background = hexToRgba(glassTint, glassOpacity);
    isDefaultWhite = true;
  }

  const overlayStyle: CSSProperties = {
    background,
    borderRadius: '10px',
  };

  if (glass) {
    overlayStyle.backdropFilter = `blur(${glassBlur}px)`;
    overlayStyle.WebkitBackdropFilter = `blur(${glassBlur}px)`;
  }

  if (!glass && useGradientOpacity && options?.backgroundOpacity !== undefined) {
    overlayStyle.opacity = normalizeBackgroundOpacity(options.backgroundOpacity);
  } else if (!glass && !isDefaultWhite && options?.backgroundOpacity !== undefined) {
    overlayStyle.opacity = normalizeBackgroundOpacity(options.backgroundOpacity);
  }

  const cardStyle: CSSProperties = {
    borderRadius: '10px',
  };

  if (borderColor) {
    cardStyle.borderColor = borderColor;
  }

  if (glass) {
    cardStyle.boxShadow = '0 8px 32px rgba(15, 23, 42, 0.08)';
  }

  return {
    overlayStyle,
    cardStyle,
    isDefaultWhite,
    isGlass: glass,
  };
}
