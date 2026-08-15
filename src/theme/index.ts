import { useMemo } from 'react';
import { createTheme, type Theme } from '@mui/material/styles';
import { useTheme as useAppTheme, isThemeDarkAppearance } from '@/context/theme';
import { buildPaletteFromCssVars } from './colors';
import { typography } from './typography';
import { SPACING_UNIT_PX, shape } from './spacing';
import { components } from './components';

/**
 * Builds (and memoizes) an MUI theme that mirrors whichever of the app's
 * existing CSS-variable-driven themes (light, dark, blue-light, orange-dark,
 * purple-light, ...) is currently applied to <html> — see
 * src/context/theme and src/index.css. Recomputes when the app's own theme
 * changes so MUI-backed components (see src/components/ui/*) stay visually
 * consistent with the rest of the Tailwind-styled app without hand-duplicating
 * every theme variant's palette here.
 */
export function useMuiTheme(): Theme {
  const { theme: activeTheme } = useAppTheme();
  const isDark = isThemeDarkAppearance(activeTheme);

  return useMemo(
    () =>
      createTheme({
        palette: buildPaletteFromCssVars(isDark),
        typography,
        spacing: SPACING_UNIT_PX,
        shape,
        components,
      }),
    // activeTheme (not just isDark) so switching between same-appearance
    // variants (e.g. blue-light -> purple-light) still re-reads CSS vars.
    [activeTheme, isDark],
  );
}

export { buildPaletteFromCssVars, cssVar } from './colors';
export { typography } from './typography';
export { SPACING_UNIT_PX, shape } from './spacing';
export { components } from './components';
