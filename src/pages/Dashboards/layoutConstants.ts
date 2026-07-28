

import type { CSSProperties } from 'react';
import type { Chart } from './types';
import {
  STATIC_LAYOUT_ITEMS,
  STATIC_CONTENT_ITEMS,
  STATIC_BLOCK_CHART_ID_MIN,
  STATIC_BLOCK_CHART_ID_MAX,
  STATIC_BLOCK_VIZ_NAMES,
  STATIC_BLOCKS_WITHOUT_WIDGET_TITLE,
  isStaticBlockWithoutWidgetTitle,
  isStaticLayoutContentChartId,
  isStaticLayoutContentViz,
  findStaticBlockTemplate,
} from './staticDashboardBlocks';

export {
  STATIC_LAYOUT_ITEMS,
  STATIC_CONTENT_ITEMS,
  STATIC_BLOCK_CHART_ID_MIN,
  STATIC_BLOCK_CHART_ID_MAX,
  STATIC_BLOCK_VIZ_NAMES,
  STATIC_BLOCKS_WITHOUT_WIDGET_TITLE,
  isStaticBlockWithoutWidgetTitle,
  isStaticLayoutContentChartId,
  isStaticLayoutContentViz,
  findStaticBlockTemplate,
};

export const GRID_COLS = 24;
/** Dashboards saved before the 24-column grid used 12 columns. */
export const LEGACY_GRID_COLS = 12;
export const GRID_CELL_WIDTH = 20; // px
export const GRID_CELL_HEIGHT = 20; // px — dashboard snap/grid row unit

/** How many fixed-width grid columns fit in the container (used for snap + grid overlay). */
export function getGridColCount(containerWidth: number): number {
  return Math.max(1, Math.floor(containerWidth / GRID_CELL_WIDTH));
}

/** Reference sizes only — no longer used as a hard resize floor. Kept for
 * default sizing math (e.g. initial panel item placement) elsewhere. */
export const PANEL_GRID_CELL_MIN_HEIGHT = 48; // px
export const PANEL_CHART_CELL_MIN_HEIGHT = 100; // px

/** Per-item layout inside a panel (percentages 0–100 of the panel content area). */
export interface PanelItemLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const PANEL_ITEM_LAYOUT_MIN = 8; // minimum width/height in percent


// export function getDefaultPanelItemLayout(
//   index: number,
//   total: number,
//   columns: number,
// ): PanelItemLayout {
//   const cols = Math.max(1, columns);
//   const count = Math.max(1, total);
//   const rows = Math.max(1, Math.ceil(count / cols));
//   const col = index % cols;
//   const row = Math.floor(index / cols);
//   const gap = 1;
//   const cellW = 100 / cols;
//   const cellH = 100 / rows;
//   return {
//     x: col * cellW + gap / 2,
//     y: row * cellH + gap / 2,
//     w: Math.max(PANEL_ITEM_LAYOUT_MIN, cellW - gap),
//     h: Math.max(PANEL_ITEM_LAYOUT_MIN, cellH - gap),
//   };
// }

// export function resolvePanelItemLayout(
//   item: { layout?: Partial<PanelItemLayout> | null },
//   index: number,
//   total: number,
//   columns: number,
// ): PanelItemLayout {
//   const fallback = getDefaultPanelItemLayout(index, total, columns);
//   const layout = item.layout;
//   if (!layout) return fallback;
//   return {
//     x: typeof layout.x === 'number' ? layout.x : fallback.x,
//     y: typeof layout.y === 'number' ? layout.y : fallback.y,
//     w: typeof layout.w === 'number' ? Math.max(PANEL_ITEM_LAYOUT_MIN, layout.w) : fallback.w,
//     h: typeof layout.h === 'number' ? Math.max(PANEL_ITEM_LAYOUT_MIN, layout.h) : fallback.h,
//   };
// }
export function getDefaultPanelItemLayout(
  index: number,
  total: number,
  columns: number,
  gapXPct = 1.5,
  gapYPct = 1.5,
): PanelItemLayout {
  const cols = Math.max(1, columns);
  const count = Math.max(1, total);
  const rows = Math.max(1, Math.ceil(count / cols));
  const col = index % cols;
  const row = Math.floor(index / cols);
  const cellW = 100 / cols;
  const cellH = 100 / rows;
  // Keep gaps from eating more than ~20% of a cell, and never push past 100%.
  const gapX = Math.min(Math.max(0, gapXPct), cellW * 0.2);
  const gapY = Math.min(Math.max(0, gapYPct), cellH * 0.2);
  return clampPanelItemLayout({
    x: col * cellW + gapX / 2,
    y: row * cellH + gapY / 2,
    w: Math.max(PANEL_ITEM_LAYOUT_MIN, cellW - gapX),
    h: Math.max(PANEL_ITEM_LAYOUT_MIN, cellH - gapY),
  });
}

/** Use the smaller of configured columns and actual chart count so items fill the row. */
export function getEffectivePanelLayoutColumns(columns: number, itemCount: number): number {
  return Math.min(Math.max(1, columns), Math.max(1, itemCount));
}

// export function resolvePanelItemLayout(
//   item: { layout?: Partial<PanelItemLayout> | null },
//   index: number,
//   total: number,
//   columns: number,
// ): PanelItemLayout {
//   const fallback = getDefaultPanelItemLayout(index, total, columns);
//   const layout = item.layout;
//   if (!layout) return fallback;          // <-- only recomputes if no layout is stored
//   return {
//     x: typeof layout.x === 'number' ? layout.x : fallback.x,
//     y: typeof layout.y === 'number' ? layout.y : fallback.y,
//     w: typeof layout.w === 'number' ? Math.max(PANEL_ITEM_LAYOUT_MIN, layout.w) : fallback.w,
//     h: typeof layout.h === 'number' ? Math.max(PANEL_ITEM_LAYOUT_MIN, layout.h) : fallback.h,
//   };
// }


export function resolvePanelItemLayout(
  item: { layout?: Partial<PanelItemLayout> | null },
  index: number,
  total: number,
  columns: number,
  gapXPct = 1.5,
  gapYPct = 1.5,
): PanelItemLayout {
  const fallback = getDefaultPanelItemLayout(index, total, columns, gapXPct, gapYPct);
  const layout = item.layout;
  if (!layout) return fallback;
  return clampPanelItemLayout({
    x: typeof layout.x === 'number' ? layout.x : fallback.x,
    y: typeof layout.y === 'number' ? layout.y : fallback.y,
    w: typeof layout.w === 'number' ? Math.max(PANEL_ITEM_LAYOUT_MIN, layout.w) : fallback.w,
    h: typeof layout.h === 'number' ? Math.max(PANEL_ITEM_LAYOUT_MIN, layout.h) : fallback.h,
  });
}   
export function clampPanelItemLayout(layout: PanelItemLayout): PanelItemLayout {
  const w = Math.max(PANEL_ITEM_LAYOUT_MIN, Math.min(100, layout.w));
  const h = Math.max(PANEL_ITEM_LAYOUT_MIN, Math.min(100, layout.h));
  const x = Math.max(0, Math.min(100 - w, layout.x));
  const y = Math.max(0, Math.min(100 - h, layout.y));
  return { x, y, w, h };
}

export const DEFAULT_CONTAINER_WIDTH = 1200; // px fallback for legacy dashboards
export const DEFAULT_CONTAINER_HEIGHT = 800; // px fallback

/** Text blocks use widget title in the body; show title fields in the customizer. */
export function shouldShowWidgetTitleCustomizer(vizName: string | undefined | null): boolean {
  if (!vizName) return false;
  const viz = vizName.toLowerCase();
  if (viz === 'text') return true;
  return !isStaticBlockWithoutWidgetTitle(viz);
}

export function shouldApplyCustomizerWidgetTitle(vizName: string | undefined | null): boolean {
  return shouldShowWidgetTitleCustomizer(vizName);
}

/** Stable negative map key for static blocks (multiple widgets can share the same chart_id). */
export function getStaticBlockDataMapKey(widgetId: string): number {
  let hash = 0;
  for (let i = 0; i < widgetId.length; i++) {
    hash = ((hash << 5) - hash) + widgetId.charCodeAt(i);
    hash |= 0;
  }
  return hash > 0 ? -hash : hash || -1;
}

export function getAnalyticsChartDataMapKey(chartId: number, widgetId: string): number {
  return isStaticLayoutContentChartId(chartId) ? getStaticBlockDataMapKey(widgetId) : chartId;
}

export function getWidgetTitleSizeClass(params?: Record<string, unknown> | null): string {
  const size = params?.widget_title_size;
  if (size === 'xs') return 'text-xs';
  if (size === 'sm') return 'text-sm';
  if (size === 'base') return 'text-base';
  if (size === 'lg') return 'text-lg';
  if (size === 'xl') return 'text-xl';
  if (size === '2xl') return 'text-2xl';
  return 'text-sm';
}

export function getWidgetTitleAlignClass(params?: Record<string, unknown> | null): string {
  const align = params?.widget_title_align;
  if (align === 'left') return 'text-left';
  if (align === 'right') return 'text-right';
  return 'text-center';
}

export function getWidgetTitleAlignFlexClass(params?: Record<string, unknown> | null): string {
  const align = params?.widget_title_align;
  if (align === 'left') return 'justify-start';
  if (align === 'right') return 'justify-end';
  return 'justify-center';
}

export function buildStaticBlockChartFromDashboard(
  chartEntry: {
    chart_id: number;
    chart_name?: string;
    visualization_name?: string;
    params?: Record<string, unknown>;
  },
  widget?: { type?: string; title?: string; params?: Record<string, unknown> },
): Chart | null {
  const template = findStaticBlockTemplate(chartEntry.chart_id);
  if (!template) return null;

  const vizName =
    widget?.type ||
    chartEntry.visualization_name ||
    template.visualization_name ||
    template.chart_type ||
    '';
  return {
    ...template,
    chart_name: chartEntry.chart_name || widget?.title || template.chart_name,
    visualization_name: vizName,
    chart_type: vizName,
    params: {
      ...(template.params || {}),
      ...(chartEntry.params || {}),
      ...(widget?.params || {}),
    },
  };
}

export function getPanelChartSnapshot(
  panelChartsData: Record<string | number, unknown> | undefined,
  chartId: number | string | undefined | null,
): any | undefined {
  if (!panelChartsData || chartId == null || chartId === '') return undefined;
  return (
    panelChartsData[chartId] ??
    panelChartsData[String(chartId)] ??
    panelChartsData[Number(chartId)]
  );
}

/**
 * Grid layout for items inside a Panel widget.
 * FIX: rows previously had a hard `minmax(${minRowHeight}px, 1fr)` floor,
 * which meant the panel's internal grid (and therefore the panel itself,
 * once contentHeight was factored into the outer layout) could never shrink
 * below `rows * minRowHeight` px. Rows now use `minmax(0, 1fr)`, matching
 * columns — so cells scale proportionally with the panel's actual size
 * instead of refusing to shrink. `minRowHeight` is no longer applied as a
 * per-row CSS floor; pass it only if you want a soft visual reference
 * elsewhere (e.g. deciding default panel size on creation).
 */
// export function buildPanelGridStyle(
//   columns: number,
//   itemCount: number,
//   showGridLines: boolean,
//   _minRowHeight = PANEL_GRID_CELL_MIN_HEIGHT, // no longer used as a CSS floor; kept for signature compatibility
//   bgColor?: string,
// ): CSSProperties {
//   const cols = Math.max(1, columns);
//   const rows = Math.max(1, Math.ceil(Math.max(1, itemCount) / cols));
//   return {
//     display: 'grid',
//     gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
//     gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
//     gap: showGridLines ? '0' : '4px',
//     ...(bgColor ? { backgroundColor: bgColor } : {}),
//     height: '100%',
//     width: '100%',
//     minHeight: 0,
//     minWidth: 0,
//     alignContent: 'stretch',
//     overflow: 'hidden',
//   };
// }



export const DEFAULT_PANEL_GAP_X = 4;
export const DEFAULT_PANEL_GAP_Y = 4;

export function buildPanelGridStyle(
  columns: number,
  itemCount: number,
  showGridLines: boolean,
  _minRowHeight = PANEL_GRID_CELL_MIN_HEIGHT, // no longer used as a CSS floor; kept for signature compatibility
  bgColor?: string,
  gapX = DEFAULT_PANEL_GAP_X, // horizontal gap between columns, px
  gapY = DEFAULT_PANEL_GAP_Y, // vertical gap between rows, px
): CSSProperties {
  const cols = Math.max(1, columns);
  const rows = Math.max(1, Math.ceil(Math.max(1, itemCount) / cols));
  return {
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
    columnGap: showGridLines ? '0px' : `${gapX}px`,
    rowGap: showGridLines ? '0px' : `${gapY}px`,
    ...(bgColor ? { backgroundColor: bgColor } : {}),
    height: '100%',
    width: '100%',
    minHeight: 0,
    minWidth: 0,
    alignContent: 'stretch',
    overflow: 'hidden',
  };
}

export function getPanelBackgroundColor(params?: { panel_bg_color?: string | null }): string | undefined {
  const color = params?.panel_bg_color;
  if (!color || color === 'transparent') return undefined;
  return color;
}

export type PanelBgLayout = 'full' | 'left' | 'right';

/**
 * Absolute positioning for the card/content zone; background image stays full-bleed behind this.
 * Important: do not also set Tailwind w-full on the element — width:100% + left/right gutter
 * overflows the panel and clips the last column of cards.
 */
export function getPanelCardZoneStyle(
  layout: PanelBgLayout = 'full',
  gutterPct = 24,
): CSSProperties {
  const gutter = Math.max(0, Math.min(60, gutterPct));
  if (layout === 'left') {
    // Cards on the right — clear space on the left for the image
    return { position: 'absolute', top: 0, right: 0, bottom: 0, left: `${gutter}%`, width: 'auto' };
  }
  if (layout === 'right') {
    // Cards on the left — clear space on the right for the image
    return { position: 'absolute', top: 0, left: 0, bottom: 0, right: `${gutter}%`, width: 'auto' };
  }
  // Cards over image — fill the whole panel, no side gutter
  return { position: 'absolute', inset: 0, width: 'auto' };
}

/** Drop stored per-item layouts so charts re-flow into the current card zone. */
export function reflowPanelChartItems(items: any[] = []): any[] {
  return items.map((item) => {
    if (item?.type !== 'chart') return item;
    const { layout, ...rest } = item;
    return rest;
  });
}

export type PanelChartSizeClass = 'compact' | 'full';

/** KPI / gauge tiles vs full charts (area, bar, line, table, …). */
export function classifyPanelChartViz(vizName?: string | null): PanelChartSizeClass {
  const viz = (vizName || '').toLowerCase();
  if (
    viz.includes('bignumber') ||
    viz.includes('big_number') ||
    (viz.includes('big') && viz.includes('number')) ||
    viz.includes('gauge') ||
    viz.includes('kpi') ||
    viz.includes('stat')
  ) {
    return 'compact';
  }
  return 'full';
}

function panelLayoutRect(
  x: number,
  y: number,
  w: number,
  h: number,
  gapX: number,
  gapY: number,
): PanelItemLayout {
  const gx = Math.max(0, gapX);
  const gy = Math.max(0, gapY);
  return clampPanelItemLayout({
    x: x + gx / 2,
    y: y + gy / 2,
    w: Math.max(PANEL_ITEM_LAYOUT_MIN, w - gx),
    h: Math.max(PANEL_ITEM_LAYOUT_MIN, h - gy),
  });
}

/** Auto-layout: KPI row on top, full charts below — no overlap. */
export function computeSmartPanelLayouts(
  chartItems: Array<{ chartId?: number | null }>,
  resolveViz: (chartId: number) => string | undefined,
  columns: number,
  gapXPct = 1.5,
  gapYPct = 1.5,
): PanelItemLayout[] {
  if (chartItems.length === 0) return [];

  const compactIdx: number[] = [];
  const fullIdx: number[] = [];
  chartItems.forEach((item, i) => {
    const kind = classifyPanelChartViz(resolveViz(Number(item.chartId)));
    if (kind === 'compact') compactIdx.push(i);
    else fullIdx.push(i);
  });

  const layouts: PanelItemLayout[] = new Array(chartItems.length);
  const hasMix = compactIdx.length > 0 && fullIdx.length > 0;

  if (hasMix) {
    const kpiRowPct = Math.min(36, Math.max(26, 28 + compactIdx.length * 2));
    const cols = Math.max(
      1,
      Math.min(compactIdx.length, getEffectivePanelLayoutColumns(columns, compactIdx.length)),
    );
    compactIdx.forEach((itemIdx, i) => {
      const col = i % cols;
      const cellW = 100 / cols;
      layouts[itemIdx] = panelLayoutRect(col * cellW, 0, cellW, kpiRowPct, gapXPct, gapYPct);
    });

    const chartTop = kpiRowPct;
    const chartH = 100 - kpiRowPct;
    if (fullIdx.length === 1) {
      layouts[fullIdx[0]] = panelLayoutRect(0, chartTop, 100, chartH, gapXPct, gapYPct);
    } else {
      const cellH = chartH / fullIdx.length;
      fullIdx.forEach((itemIdx, i) => {
        layouts[itemIdx] = panelLayoutRect(0, chartTop + i * cellH, 100, cellH, gapXPct, gapYPct);
      });
    }
    return layouts;
  }

  if (compactIdx.length === chartItems.length) {
    return chartItems.map((_, idx) =>
      getDefaultPanelItemLayout(idx, chartItems.length, columns, gapXPct, gapYPct),
    );
  }

  if (fullIdx.length === 1) {
    layouts[fullIdx[0]] = panelLayoutRect(0, 0, 100, 100, gapXPct, gapYPct);
    return layouts;
  }

  return chartItems.map((_, idx) =>
    getDefaultPanelItemLayout(idx, chartItems.length, columns, gapXPct, gapYPct),
  );
}

export function applySmartPanelLayoutsToItems(
  items: any[],
  resolveViz: (chartId: number) => string | undefined,
  columns: number,
  gapXPct = 1.5,
  gapYPct = 1.5,
  options?: { preserveExisting?: boolean },
): any[] {
  const preserveExisting = options?.preserveExisting ?? false;
  const chartItems = items.filter((item) => item?.type === 'chart');
  const layouts = computeSmartPanelLayouts(chartItems, resolveViz, columns, gapXPct, gapYPct);
  let layoutIdx = 0;
  return items.map((item) => {
    if (item?.type !== 'chart') return item;
    const layout = layouts[layoutIdx++];
    if (preserveExisting && item.layout) return item;
    return layout ? { ...item, layout } : item;
  });
}

/** Prefer stored per-item layout when resize mode is on; otherwise use smart grid layout. */
export function resolvePanelChartDisplayLayout(
  item: { layout?: Partial<PanelItemLayout> | null },
  index: number,
  total: number,
  smartLayouts: PanelItemLayout[],
  columns: number,
  gapXPct = 1.5,
  gapYPct = 1.5,
  preferStoredLayout = false,
): PanelItemLayout {
  if (preferStoredLayout && item?.layout) {
    return resolvePanelItemLayout(item, index, total, columns, gapXPct, gapYPct);
  }
  const smart = smartLayouts[index];
  if (smart) return smart;
  return getDefaultPanelItemLayout(index, total, columns, gapXPct, gapYPct);
}

export function resolvePanelChartVizFromSources(
  chartId: number,
  panelChartsData: Record<string | number, unknown>,
  libraryCharts: Array<{ id?: number; visualization_name?: string; chart_type?: string }>,
): string | undefined {
  const snap = panelChartsData[chartId] ?? panelChartsData[String(chartId)];
  const snapChart = snap && typeof snap === 'object' ? (snap as { chart?: { visualization_name?: string; chart_type?: string } }).chart : undefined;
  if (snapChart) {
    return (snapChart.visualization_name || snapChart.chart_type || '').toString();
  }
  const lib = libraryCharts.find((c) => c.id === chartId);
  return (lib?.visualization_name || lib?.chart_type || '').toString();
}