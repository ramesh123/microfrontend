import type { Chart } from './types';

export const DEFAULT_DIVIDER_PARAMS = {
  divider_orientation: 'horizontal' as const,
  divider_thickness: 2,
  divider_color: '#000000',
};

/** Layout container blocks (sidebar drag sources). */
export const STATIC_LAYOUT_ITEMS: Chart[] = [
  {
    id: 10001,
    chart_name: 'Panel',
    visualization_name: 'panel',
    chart_type: 'panel',
    description: 'Multi-KPI container',
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    flow_id: '',
  },
];

/** Static content blocks (text, image, alert, divider). */
export const STATIC_CONTENT_ITEMS: Chart[] = [
  {
    id: 10002,
    chart_name: 'Text / Label',
    visualization_name: 'text',
    chart_type: 'text',
    description: 'Heading, body, note',
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    flow_id: '',
  },
  {
    id: 10003,
    chart_name: 'Image',
    visualization_name: 'image',
    chart_type: 'image',
    description: 'Logo, banner, photo',
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    flow_id: '',
  },
  {
    id: 10004,
    chart_name: 'Alert banner',
    visualization_name: 'alert',
    chart_type: 'alert',
    description: 'Status, warning',
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    flow_id: '',
  },
  {
    id: 10005,
    chart_name: 'Divider',
    visualization_name: 'divider',
    chart_type: 'divider',
    description: 'Separator',
    params: DEFAULT_DIVIDER_PARAMS,
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    flow_id: '',
  },
];

export const STATIC_BLOCK_CHART_ID_MIN = 10001;
export const STATIC_BLOCK_CHART_ID_MAX = 10005;

export const STATIC_BLOCK_VIZ_NAMES = ['panel', 'text', 'image', 'alert', 'divider'] as const;

export const STATIC_BLOCKS_WITHOUT_WIDGET_TITLE = ['text', 'image', 'alert', 'divider'] as const;

export function isStaticBlockWithoutWidgetTitle(vizName: string | undefined | null): boolean {
  if (!vizName) return false;
  return STATIC_BLOCKS_WITHOUT_WIDGET_TITLE.includes(
    vizName.toLowerCase() as (typeof STATIC_BLOCKS_WITHOUT_WIDGET_TITLE)[number],
  );
}

export function isStaticLayoutContentChartId(chartId: number): boolean {
  return chartId >= STATIC_BLOCK_CHART_ID_MIN && chartId <= STATIC_BLOCK_CHART_ID_MAX;
}

export function isStaticLayoutContentViz(vizName: string | undefined | null): boolean {
  if (!vizName) return false;
  return STATIC_BLOCK_VIZ_NAMES.includes(vizName.toLowerCase() as (typeof STATIC_BLOCK_VIZ_NAMES)[number]);
}

export function findStaticBlockTemplate(chartId: number): Chart | undefined {
  return STATIC_LAYOUT_ITEMS.find((c) => c.id === chartId) || STATIC_CONTENT_ITEMS.find((c) => c.id === chartId);
}
