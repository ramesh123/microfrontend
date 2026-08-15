import type { Components, Theme } from '@mui/material/styles';
import { cssVar } from './colors';

/**
 * styleOverrides are plain CSS-in-JS applied per component class, not run
 * through MUI's color-math (unlike palette.*.main) — raw `var(--x)` strings
 * work here and stay in sync with whichever of the app's theme classes is
 * active, without needing a theme rebuild.
 */
export const components: Components<Theme> = {
  MuiButton: {
    defaultProps: {
      disableElevation: true,
    },
    styleOverrides: {
      root: {
        textTransform: 'none',
        borderRadius: cssVar.radius,
        fontWeight: 500,
      },
      outlined: {
        borderColor: cssVar.border,
      },
    },
  },
  MuiTextField: {
    defaultProps: {
      size: 'small',
    },
  },
  MuiOutlinedInput: {
    styleOverrides: {
      root: {
        borderRadius: cssVar.radius,
        backgroundColor: cssVar.card,
      },
      notchedOutline: {
        borderColor: cssVar.border,
      },
    },
  },
  MuiSelect: {
    defaultProps: {
      size: 'small',
    },
  },
  MuiMenu: {
    styleOverrides: {
      paper: {
        backgroundColor: cssVar.popover,
        color: cssVar.popoverForeground,
        border: `1px solid ${cssVar.border}`,
        borderRadius: cssVar.radius,
      },
    },
  },
  MuiDialog: {
    styleOverrides: {
      paper: {
        backgroundColor: cssVar.card,
        color: cssVar.cardForeground,
        borderRadius: cssVar.radius,
      },
    },
  },
  MuiCard: {
    styleOverrides: {
      root: {
        backgroundColor: cssVar.card,
        color: cssVar.cardForeground,
        border: `1px solid ${cssVar.border}`,
        borderRadius: cssVar.radius,
        backgroundImage: 'none',
      },
    },
  },
  MuiTabs: {
    styleOverrides: {
      indicator: {
        height: 2,
      },
    },
  },
  MuiTab: {
    styleOverrides: {
      root: {
        textTransform: 'none',
        fontWeight: 500,
        minHeight: 40,
      },
    },
  },
  MuiTableCell: {
    styleOverrides: {
      root: {
        borderBottom: `1px solid ${cssVar.border}`,
      },
      head: {
        color: cssVar.mutedForeground,
        fontWeight: 500,
        backgroundColor: cssVar.muted,
      },
    },
  },
  MuiTooltip: {
    styleOverrides: {
      tooltip: {
        backgroundColor: cssVar.popover,
        color: cssVar.popoverForeground,
        border: `1px solid ${cssVar.border}`,
        fontSize: '0.75rem',
      },
    },
  },
  MuiAlert: {
    styleOverrides: {
      root: {
        borderRadius: cssVar.radius,
      },
    },
  },
  MuiPagination: {
    defaultProps: {
      shape: 'rounded',
    },
  },
  MuiCheckbox: {
    defaultProps: {
      size: 'small',
    },
  },
  MuiRadio: {
    defaultProps: {
      size: 'small',
    },
  },
  MuiChip: {
    styleOverrides: {
      root: {
        borderRadius: cssVar.radius,
      },
    },
  },
};
