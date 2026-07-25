import { themeQuartz } from "ag-grid-community";
import type { Theme } from "@/context/theme";
import { isThemeDarkAppearance } from "@/context/theme";

let colorProbe: HTMLDivElement | null = null;

/**
 * Resolves a CSS variable to a computed color AG Grid can use (rgb/rgba).
 * oklch() values from theme tokens are converted via the browser.
 */
export function resolveThemeColor(cssVar: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;

  if (!colorProbe) {
    colorProbe = document.createElement("div");
    colorProbe.style.display = "none";
    colorProbe.style.pointerEvents = "none";
    document.documentElement.appendChild(colorProbe);
  }

  colorProbe.style.backgroundColor = `var(${cssVar})`;
  const resolved = getComputedStyle(colorProbe).backgroundColor;
  if (resolved && resolved !== "rgba(0, 0, 0, 0)") {
    return resolved;
  }
  return fallback;
}

/** AG Grid Quartz theme aligned with app CSS variables (`--background`, `--foreground`, etc.). */
export function buildAgGridTheme(appTheme: Theme) {
  const isDark = isThemeDarkAppearance(appTheme);
  const backgroundColor = resolveThemeColor("--background", isDark ? "#141516" : "#fafafa");
  const foregroundColor = resolveThemeColor("--foreground", isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.87)");
  const headerBackgroundColor = resolveThemeColor("--muted", backgroundColor);
  const borderColor = resolveThemeColor("--border", isDark ? "#3f3f46" : "#e5e7eb");
  const chromeBackgroundColor = resolveThemeColor("--card", backgroundColor);
  const accentColor = resolveThemeColor("--accent", headerBackgroundColor);

  return themeQuartz.withParams({
    backgroundColor,
    foregroundColor,
    headerBackgroundColor,
    headerTextColor: foregroundColor,
    borderColor,
    chromeBackgroundColor,
    oddRowBackgroundColor: backgroundColor,
    rowHoverColor: accentColor,
    selectedRowBackgroundColor: accentColor,
    browserColorScheme: isDark ? "dark" : "light",
  });
}
