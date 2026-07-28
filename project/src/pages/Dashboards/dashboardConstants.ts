// Constants for grid layout
export const CHART_GAP = 2; // Gap between charts in pixels
/** Extra right canvas inset when no sidebar rail is present (0 when a sidebar rail is shown). */
export const DASHBOARD_CANVAS_RIGHT_INSET = 0;
export const DEFAULT_CHART_HEIGHT = 220; // Default chart height in pixels

// Default size for newly added widgets (pixels). These are fixed at add-time
// and do not trigger redistribution of existing widgets. Users can resize
// individual widgets later without affecting others.
export const DEFAULT_NEW_WIDGET_WIDTH = 240; // ~ default grid width (px)
export const DEFAULT_NEW_WIDGET_HEIGHT = DEFAULT_CHART_HEIGHT; // default height (px)

// Big number charts use a compact card size (not full chart height)
export const MIN_BIG_NUMBER_WIDTH = 40;
export const MIN_BIG_NUMBER_HEIGHT = 60;
export const DEFAULT_BIG_NUMBER_WIDTH = 180;
export const DEFAULT_BIG_NUMBER_HEIGHT = 80;

/** Width of the collapsed dashboard sidebar rail (vertical label bar). */
export const DASHBOARD_SIDEBAR_COLLAPSED_WIDTH_PX = 40;
