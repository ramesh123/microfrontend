// Tailwind's spacing scale steps in 4px (0.25rem) increments. MUI defaults
// to an 8px step. Matching Tailwind's base here keeps MUI component padding/
// gaps (Button, Dialog, Card, etc.) on the same rhythm as the surrounding
// Tailwind-classed layout, instead of introducing a second, incompatible grid.
export const SPACING_UNIT_PX = 4;

export const shape = {
  // Falls back to 10px (matches --radius: 0.625rem in src/index.css) if the
  // CSS var can't be read for some reason (e.g. SSR); styleOverrides in
  // components.ts use the raw var directly where they need live theme sync.
  borderRadius: 10,
};
