import type { CSSProperties } from 'react';

export interface DashboardAppearance {
  bgColor: string;
  /** 0–100 */
  bgOpacity: number;
}

export const DEFAULT_DASHBOARD_APPEARANCE: DashboardAppearance = {
  bgColor: '#f1f5f9',
  bgOpacity: 100,
};

export const LEGACY_WHITE_CANVAS_COLOR = '#ffffff';

export function isLegacyWhiteCanvasAppearance(appearance: DashboardAppearance): boolean {
  const hex = appearance.bgColor.replace('#', '').trim().toLowerCase();
  return (hex === 'ffffff' || hex === 'fff') && appearance.bgOpacity === 100;
}

export const DASHBOARD_BACKGROUND_PALETTE = [
  { name: 'White', value: '#ffffff' },
  { name: 'Soft Slate', value: '#f8fafc' },
  { name: 'Cool Gray', value: '#f1f5f9' },
  { name: 'Sky Blue', value: '#eff6ff' },
  { name: 'Mint', value: '#ecfdf5' },
  { name: 'Warm Sand', value: '#fffbeb' },
  { name: 'Blush', value: '#fff1f2' },
  { name: 'Lavender', value: '#f5f3ff' },
  { name: 'Indigo', value: '#eef2ff' },
  { name: 'Charcoal', value: '#1e293b' },
  { name: 'Theme', value: 'theme' },
] as const;

const LIGHT_DASHBOARD_CANVAS_HEX = new Set([
  'ffffff',
  'fff',
  'f8fafc',
  'f1f5f9',
  'eff6ff',
  'ecfdf5',
  'fffbeb',
  'fff1f2',
  'f5f3ff',
  'eef2ff',
]);

function normalizeDashboardCanvasHex(hex: string): string {
  const normalized = hex.replace('#', '').trim().toLowerCase();
  if (normalized.length === 3) {
    return normalized
      .split('')
      .map((char) => char + char)
      .join('');
  }
  return normalized.slice(0, 6);
}

export function isLightDashboardCanvasColor(bgColor: string): boolean {
  if (bgColor === 'theme') return true;
  return LIGHT_DASHBOARD_CANVAS_HEX.has(normalizeDashboardCanvasHex(bgColor));
}

export function getThemeAwareDefaultDashboardAppearance(isDark: boolean): DashboardAppearance {
  return isDark
    ? { bgColor: 'theme', bgOpacity: 100 }
    : { ...DEFAULT_DASHBOARD_APPEARANCE };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace('#', '').trim();
  if (normalized.length === 3) {
    return {
      r: parseInt(normalized[0] + normalized[0], 16),
      g: parseInt(normalized[1] + normalized[1], 16),
      b: parseInt(normalized[2] + normalized[2], 16),
    };
  }
  if (normalized.length >= 6) {
    return {
      r: parseInt(normalized.slice(0, 2), 16),
      g: parseInt(normalized.slice(2, 4), 16),
      b: parseInt(normalized.slice(4, 6), 16),
    };
  }
  return null;
}

export function getDashboardCanvasBackgroundStyle(
  appearance: DashboardAppearance,
): CSSProperties {
  if (appearance.bgColor === 'theme') {
    const opacity = Math.max(0, Math.min(100, appearance.bgOpacity)) / 100;
    if (opacity >= 0.999) {
      return { backgroundColor: 'hsl(var(--background))' };
    }
    return {
      backgroundColor: `color-mix(in srgb, hsl(var(--background)) ${Math.round(opacity * 100)}%, transparent)`,
    };
  }

  const opacity = Math.max(0, Math.min(100, appearance.bgOpacity)) / 100;
  const rgb = hexToRgb(appearance.bgColor);
  if (!rgb) {
    return { backgroundColor: `rgba(255, 255, 255, ${opacity})` };
  }
  return {
    backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`,
  };
}

export function resolveDashboardCanvasBackgroundStyle(
  appearance: DashboardAppearance,
  isDark: boolean,
): CSSProperties {
  if (isDark && isLightDashboardCanvasColor(appearance.bgColor)) {
    return getDashboardCanvasBackgroundStyle({
      bgColor: 'theme',
      bgOpacity: appearance.bgOpacity,
    });
  }
  return getDashboardCanvasBackgroundStyle(appearance);
}

export function parseDashboardAppearance(source: unknown): DashboardAppearance {
  if (!source || typeof source !== 'object') {
    return { ...DEFAULT_DASHBOARD_APPEARANCE };
  }
  const data = source as Record<string, unknown>;
  const style =
    data.dashboard_style && typeof data.dashboard_style === 'object'
      ? (data.dashboard_style as Record<string, unknown>)
      : null;

  const bgColorRaw =
    (typeof data.dashboard_bg_color === 'string' && data.dashboard_bg_color) ||
    (typeof style?.bg_color === 'string' && style.bg_color) ||
    DEFAULT_DASHBOARD_APPEARANCE.bgColor;

  const opacityRaw =
    typeof data.dashboard_bg_opacity === 'number'
      ? data.dashboard_bg_opacity
      : typeof style?.bg_opacity === 'number'
        ? style.bg_opacity
        : DEFAULT_DASHBOARD_APPEARANCE.bgOpacity;

  return {
    bgColor: bgColorRaw,
    bgOpacity: Math.max(0, Math.min(100, Math.round(opacityRaw))),
  };
}

export function dashboardAppearanceToPayload(appearance: DashboardAppearance) {
  return {
    dashboard_bg_color: appearance.bgColor,
    dashboard_bg_opacity: appearance.bgOpacity,
  };
}

export function cloneDashboardAppearance(
  appearance: DashboardAppearance,
): DashboardAppearance {
  return { ...appearance };
}
