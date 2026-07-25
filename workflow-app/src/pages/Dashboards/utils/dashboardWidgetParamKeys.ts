/** Dashboard widget sheet overrides — not chart-definition fields from the chart editor. */
export const DASHBOARD_WIDGET_PARAM_OVERRIDE_KEYS = new Set([
  'widget_title_size',
  'widget_title_align',
  'showLegend',
  'showGridLines',
  'showValues',
  'colorScheme',
  'bigNumberFontSize',
  'subheaderFontSize',
  'bigNumberBold',
  'subheaderBold',
  'alert_title',
  'alert_message',
  'alert_bg_color',
  'alert_text_color',
  'panel_bg_color',
  'panel_columns',
  'panel_show_grid_lines',
  'panel_items',
  'divider_orientation',
  'divider_thickness',
  'divider_color',
  'image_data',
]);

export function isDashboardWidgetParamKey(key: string): boolean {
  return DASHBOARD_WIDGET_PARAM_OVERRIDE_KEYS.has(key);
}
