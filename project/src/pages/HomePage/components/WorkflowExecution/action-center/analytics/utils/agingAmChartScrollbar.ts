import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import { getValueAxisRange } from '@/pages/ExploratoryAnalysis/AgenticSemantics/am5MiniChartHelpers';

/** Show zoom bar once categories exceed this count. */
export const AGING_CHART_ZOOMBAR_THRESHOLD = 6;

/** Initial visible category count when zoom bar is active. */
export const AGING_CHART_ZOOMBAR_INITIAL_VISIBLE = 6;

/** Expanded dialog chart area height (px). */
export const AGING_CHART_EXPANDED_DIALOG_HEIGHT = 520;

/** Expanded dialog minimum chart area height (px). */
export const AGING_CHART_EXPANDED_DIALOG_MIN_HEIGHT = 360;

/** Analytics dashboard chart expand dialog — larger viewport for AmCharts. */
export const ANALYTICS_CHART_EXPANDED_DIALOG_HEIGHT = 680;

/** Analytics dashboard chart expand dialog minimum chart area (px). */
export const ANALYTICS_CHART_EXPANDED_DIALOG_MIN_HEIGHT = 480;

/** Expanded ageing table visible body rows in dialog. */
export const AGING_CHART_EXPANDED_TABLE_VISIBLE_ROWS = 18;

export function shouldShowAgingChartZoombar(pointCount: number): boolean {
  return pointCount > AGING_CHART_ZOOMBAR_THRESHOLD;
}

export function attachAgingCategoryZoombar(
  root: am5.Root,
  chart: am5xy.XYChart,
  xAxis: am5xy.CategoryAxis<am5xy.AxisRenderer>,
  pointCount: number,
  thumbColor?: am5.Color,
): boolean {
  if (!shouldShowAgingChartZoombar(pointCount)) {
    return false;
  }

  const initialVisible = Math.min(AGING_CHART_ZOOMBAR_INITIAL_VISIBLE, pointCount);
  const end = initialVisible >= pointCount ? 1 : initialVisible / pointCount;

  const scrollbar = am5.Scrollbar.new(root, {
    orientation: 'horizontal',
    marginBottom: 6,
    minHeight: 10,
    start: 0,
    end,
  });

  chart.set('scrollbarX', scrollbar);
  chart.bottomAxesContainer.children.push(scrollbar);
  scrollbar.thumb.setAll({
    fillOpacity: 0.25,
    fill: thumbColor ?? am5.color(0x94a3b8),
  });

  const syncZoomFromScrollbar = () => {
    const sb = chart.get('scrollbarX');
    if (!sb) return;
    const s = sb.get('start', 0);
    const e = sb.get('end', 1);
    xAxis.zoom(s, e, 0);
  };

  xAxis.events.once('datavalidated', () => {
    xAxis.zoomToIndexes(0, Math.max(0, initialVisible - 1));
    syncZoomFromScrollbar();
  });
  scrollbar.events.on('rangechanged', syncZoomFromScrollbar);

  return true;
}

export function collectNumericValuesFromRows(
  rows: Array<Record<string, string | number>>,
  keys: string[],
): number[] {
  const values: number[] = [];
  rows.forEach((row) => {
    keys.forEach((key) => {
      const value = Number(row[key]);
      if (Number.isFinite(value)) values.push(value);
    });
  });
  return values;
}

export function attachAgingYRangeForVisibleCategories(
  root: am5.Root,
  chart: am5xy.XYChart,
  xAxis: am5xy.CategoryAxis<am5xy.AxisRenderer>,
  yAxis: am5xy.ValueAxis<am5xy.AxisRenderer>,
  rows: Array<Record<string, string | number>>,
  valueKeys: string[],
): void {
  const pointCount = rows.length;
  if (pointCount === 0) return;

  const applyYRangeToVisibleWindow = () => {
    const startPos = xAxis.get('start', 0);
    const endPos = xAxis.get('end', 1);
    const startIndex = Math.max(0, Math.floor(startPos * pointCount));
    const endIndex = Math.min(pointCount - 1, Math.max(startIndex, Math.ceil(endPos * pointCount) - 1));

    const values = collectNumericValuesFromRows(rows.slice(startIndex, endIndex + 1), valueKeys);
    if (values.length === 0) return;

    const range = getValueAxisRange(values, { paddingPercent: 0.08, minSpanFraction: 0.08 });
    yAxis.set('min', range.min);
    yAxis.set('max', range.max);
  };

  let framePending = false;
  const scheduleApply = () => {
    if (framePending) return;
    framePending = true;
    root.events.once('frameended', () => {
      framePending = false;
      applyYRangeToVisibleWindow();
    });
  };

  xAxis.events.once('datavalidated', scheduleApply);
  xAxis.on('start', scheduleApply);
  xAxis.on('end', scheduleApply);
  chart.get('scrollbarX')?.events.on('rangechanged', scheduleApply);
}
