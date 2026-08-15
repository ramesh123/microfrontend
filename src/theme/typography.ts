import type { TypographyVariantsOptions } from '@mui/material/styles';

// Matches the font stack declared on :root in src/index.css so MUI text
// doesn't visually clash with the surrounding Tailwind-styled UI.
const FONT_FAMILY = 'system-ui, Avenir, Helvetica, Arial, sans-serif';

export const typography: TypographyVariantsOptions = {
  fontFamily: FONT_FAMILY,
  // Tailwind's default type scale (rem-based), so MUI text sizes line up
  // with the existing text-sm/text-base/text-lg utility classes elsewhere.
  h1: { fontFamily: FONT_FAMILY, fontSize: '2.25rem', fontWeight: 600, lineHeight: 1.2 },
  h2: { fontFamily: FONT_FAMILY, fontSize: '1.875rem', fontWeight: 600, lineHeight: 1.25 },
  h3: { fontFamily: FONT_FAMILY, fontSize: '1.5rem', fontWeight: 600, lineHeight: 1.3 },
  h4: { fontFamily: FONT_FAMILY, fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.35 },
  h5: { fontFamily: FONT_FAMILY, fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.4 },
  h6: { fontFamily: FONT_FAMILY, fontSize: '1rem', fontWeight: 600, lineHeight: 1.4 },
  subtitle1: { fontSize: '0.9375rem', fontWeight: 500 },
  subtitle2: { fontSize: '0.8125rem', fontWeight: 500 },
  body1: { fontSize: '0.875rem', fontWeight: 400, lineHeight: 1.5 },
  body2: { fontSize: '0.8125rem', fontWeight: 400, lineHeight: 1.5 },
  button: { fontSize: '0.875rem', fontWeight: 500, textTransform: 'none' },
  caption: { fontSize: '0.75rem', fontWeight: 400 },
  overline: { fontSize: '0.6875rem', fontWeight: 500, textTransform: 'uppercase' },
};
