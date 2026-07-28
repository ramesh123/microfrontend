/**
 * Shared visual tokens for mini XY charts: calm typography, light grids, consistent padding.
 */

export type NeatMiniChartColors = {
  label: any;
  labelMuted: any;
  grid: any;
};

export function neatMiniChartColors(
  am5: typeof import("@amcharts/amcharts5"),
  isDark: boolean,
): NeatMiniChartColors {
  return {
    label: isDark ? am5.color(0xd4d4d8) : am5.color(0x3f3f46),
    labelMuted: isDark ? am5.color(0xa1a1aa) : am5.color(0x71717a),
    grid: isDark ? am5.color(0x3f3f46) : am5.color(0xe4e4e7),
  };
}

/** Grid line visibility — keep low so data reads first */
export const NEAT_GRID_OPACITY = 0.25;

/** Axis baseline (renderer stroke) */
export const NEAT_AXIS_STROKE_OPACITY = 0.06;

export const NEAT_CHART_PAD = {
  top: 6,
  bottom: 7,
  side: 16,
} as const;

export const NEAT_CHART_PAD_BAR = {
  top: 8,
  bottom: 7,
  side: 16,
} as const;

export const NEAT_FS = {
  title: 12,
  subtitle: 11,
  axis: 10,
  axisTitle: 11,
  legend: 10,
} as const;

export const NEAT_FW = {
  title: "600",
  axis: "600",
  legend: "500",
} as const;
