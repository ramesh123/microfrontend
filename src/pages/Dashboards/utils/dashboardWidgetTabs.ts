import { isBigNumberVisualization, BIG_NUMBER_CARD_RADIUS_CLASS } from '@/pages/charts/components/charts/bigNumber';

type VizNameSource = {
  visualization_name?: string | null;
  chart_type?: string | null;
  chart_name?: string | null;
} | null | undefined;

/** Resolve viz type from chart metadata — never use display chart_name as viz hint. */
export function resolveDashboardChartVizName(...sources: VizNameSource[]): string {
  for (const source of sources) {
    const viz = (source?.visualization_name || source?.chart_type || '').toString().toLowerCase();
    if (viz) return viz;
  }
  return '';
}

export function isDashboardBigNumberChart(...sources: VizNameSource[]): boolean {
  return isBigNumberVisualization(resolveDashboardChartVizName(...sources));
}

export function isDashboardTableOrPivotChart(...sources: VizNameSource[]): boolean {
  const viz = resolveDashboardChartVizName(...sources);
  return viz.includes('table') || viz.includes('pivot');
}

/**
 * Standard chart widgets use a transparent shell with a visible border.
 * Big Number KPIs and table/pivot widgets manage their own inner surface styling.
 */
export function shouldUseDashboardWhiteWidgetCard(..._sources: VizNameSource[]): boolean {
  return false;
}

/** Bordered dashboard widget shell — card outline on the canvas, transparent fill. */
export const DASHBOARD_WIDGET_SHELL_CLASS =
  'h-full w-full min-h-0 min-w-0 box-border overflow-hidden rounded-xl border border-border bg-transparent shadow-sm';

/** Panel embedded charts (line, bar, table, …) need an opaque surface over panel photos. */
export const PANEL_EMBEDDED_CHART_SHELL_CLASS =
  'panel-embedded-chart-shell h-full w-full min-h-0 min-w-0 box-border overflow-hidden rounded-xl border border-border bg-card shadow-sm';

/** Inner fill only — use inside {@link PANEL_EMBEDDED_CHART_SHELL_CLASS} to avoid double borders. */
export const PANEL_EMBEDDED_CHART_FILL_CLASS =
  'panel-embedded-chart-shell h-full w-full min-h-0 min-w-0 overflow-hidden bg-card';

export function getPanelEmbeddedWidgetShellClass(...sources: VizNameSource[]): string {
  return isDashboardBigNumberChart(...sources)
    ? DASHBOARD_BIG_NUMBER_WIDGET_CLASS
    : PANEL_EMBEDDED_CHART_SHELL_CLASS;
}

/** @deprecated Use {@link DASHBOARD_WIDGET_SHELL_CLASS} — white fill removed, border kept. */
export const DASHBOARD_WHITE_WIDGET_CARD_CLASS = DASHBOARD_WIDGET_SHELL_CLASS;

/** Clip KPI cards to a single rounded rect — no inset padding (avoids white corner bleed). */
export const DASHBOARD_BIG_NUMBER_WIDGET_CLASS = `box-border h-full w-full min-h-0 min-w-0 overflow-hidden border border-border bg-transparent shadow-sm ${BIG_NUMBER_CARD_RADIUS_CLASS}`;

/** Chart / Table / SQL / Details tabs disabled — widgets always show the chart. */
export function shouldShowDashboardWidgetTabs(..._sources: VizNameSource[]): boolean {
  return false;
}
