import type { PaletteOptions } from '@mui/material/styles';

/**
 * The app already has a runtime theme switcher (see src/context/theme) that
 * applies one of several classes to <html> (light, dark, blue-light,
 * orange-dark, purple-light, ...), each redefining a shared set of CSS
 * custom properties (--primary, --background, --border, etc. — see
 * src/index.css). Rather than duplicating every one of those variants'
 * exact color values here, we read whatever the browser has already
 * resolved for the currently-active class. This keeps MUI's palette in
 * sync with all existing themes for free, and never drifts if index.css
 * changes later.
 */
/**
 * Custom properties are returned by getPropertyValue() as the literal string they
 * were declared with — index.css (Tailwind v4) declares its colors as oklch(),
 * which MUI's color-manipulator (decomposeColor, used internally for
 * lighten/darken when augmenting palette entries) doesn't understand and throws
 * on. Assigning the value to a real `color` style and reading it back off
 * getComputedStyle lets the browser do the actual color-space conversion, which
 * normalizes to rgb()/rgba() — a format decomposeColor does support.
 */
function normalizeToRgb(value: string): string | null {
  if (typeof document === 'undefined') return null;
  const probe = document.createElement('span');
  probe.style.color = value;
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  document.body.removeChild(probe);
  return resolved || null;
}

function resolveCssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return fallback;
  return normalizeToRgb(raw) ?? fallback;
}

/** Builds an MUI PaletteOptions snapshot from the currently-active theme's CSS custom properties. */
export function buildPaletteFromCssVars(isDark: boolean): PaletteOptions {
  const v = (name: string, fallback: string) => resolveCssVar(name, fallback);

  return {
    mode: isDark ? 'dark' : 'light',
    primary: {
      main: v('--primary', isDark ? '#e5e5e5' : '#171717'),
      contrastText: v('--primary-foreground', isDark ? '#171717' : '#fafafa'),
    },
    secondary: {
      main: v('--secondary', isDark ? '#262626' : '#f5f5f5'),
      contrastText: v('--secondary-foreground', isDark ? '#fafafa' : '#171717'),
    },
    error: {
      main: v('--destructive', '#ef4444'),
    },
    background: {
      default: v('--background', isDark ? '#0a0a0a' : '#ffffff'),
      paper: v('--card', isDark ? '#171717' : '#ffffff'),
    },
    text: {
      primary: v('--foreground', isDark ? '#fafafa' : '#0a0a0a'),
      secondary: v('--muted-foreground', isDark ? '#a3a3a3' : '#737373'),
    },
    divider: v('--border', isDark ? '#262626' : '#e5e5e5'),
  };
}

/** Raw CSS var references for use in styleOverrides (literal CSS, not palette color-math — safe to pass unresolved). */
export const cssVar = {
  radius: 'var(--radius)',
  border: 'var(--border)',
  input: 'var(--input)',
  ring: 'var(--ring)',
  muted: 'var(--muted)',
  mutedForeground: 'var(--muted-foreground)',
  accent: 'var(--accent)',
  accentForeground: 'var(--accent-foreground)',
  popover: 'var(--popover)',
  popoverForeground: 'var(--popover-foreground)',
  card: 'var(--card)',
  cardForeground: 'var(--card-foreground)',
};
