import { ReactNode } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { useMuiTheme } from './index';

/**
 * Wraps children in MUI's ThemeProvider using a theme built from the app's
 * own runtime theme switcher (see src/context/theme). Must render *inside*
 * that app ThemeProvider — useMuiTheme() reads its context.
 */
export function MuiThemeBridge({ children }: { children: ReactNode }) {
  const muiTheme = useMuiTheme();
  return <MuiThemeProvider theme={muiTheme}>{children}</MuiThemeProvider>;
}
