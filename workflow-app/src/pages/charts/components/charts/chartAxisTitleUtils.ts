import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import { formatFieldName } from '@/pages/charts/ChartFormulator/utils';

export type ChartMetricParam = {
  alias?: string;
  columns?: string;
  column?: string;
  name?: string;
  operation?: string;
};

/** Normalize metrics from API params, form values, or raw response. */
export function normalizeChartMetrics(input: unknown): ChartMetricParam[] {
  if (input == null) return [];
  const arr = Array.isArray(input) ? input : [input];
  return arr
    .map((m): ChartMetricParam => {
      if (typeof m === 'string') return { columns: m };
      if (m && typeof m === 'object') return m as ChartMetricParam;
      return {};
    })
    .filter((m) => Boolean((m.alias || m.columns || m.column || m.name || '').trim()));
}

/** Single metric label: alias if set, else formatted column name. */
export function resolveMetricDisplayName(metric: ChartMetricParam | string | undefined | null): string {
  if (!metric) return '';
  if (typeof metric === 'string') return formatFieldName(metric);
  const alias = (metric.alias || '').trim();
  if (alias) return alias;
  const col = (metric.columns || metric.column || metric.name || '').trim();
  if (col) return formatFieldName(col);
  return '';
}

const cleanFieldKey = (s: string) => s.replace(/\(.*\)/, '').trim().toUpperCase();

function findMetricForSeriesField(metrics: ChartMetricParam[], seriesField: string): ChartMetricParam | undefined {
  const sf = cleanFieldKey(seriesField);
  return metrics.find((m) => {
    const col = (m.columns || m.column || m.name || '').trim();
    const c = cleanFieldKey(col);
    return sf === c || seriesField.toUpperCase().includes(c) || (c && sf.includes(c));
  });
}

/** Value-axis (Y) title: customization wins, else metric alias/column from chart params. */
export function resolveValueAxisTitle(
  customTitle: string | undefined,
  metrics?: ChartMetricParam[] | null,
  seriesFields?: string[],
): string {
  const custom = (customTitle || '').trim();
  if (custom) return custom;

  const metricList = metrics?.length ? metrics : [];
  const sf = seriesFields?.length ? seriesFields : [];

  // With dimensions, series columns are pivoted legend labels — keep the metric on the value axis.
  if (metricList.length > 0) {
    const labels = metricList.map((m) => resolveMetricDisplayName(m)).filter(Boolean);
    if (labels.length) return labels.join(', ');
  }

  // No metrics: infer from live series columns when they are metric fields (not dimension pivots).
  if (sf.length > 0) {
    const labels = sf
      .map((field) => {
        const m = findMetricForSeriesField(metricList, field);
        return m ? resolveMetricDisplayName(m) : formatFieldName(field);
      })
      .filter(Boolean);
    if (labels.length) return labels.join(', ');
  }

  return '';
}

/** Value columns for axis titles when row keys may be generic (`value`) after chart transforms. */
export function resolveChartValueFields(
  sampleRow: Record<string, unknown> | undefined | null,
  columns?: string[] | null,
  xAxis?: string | null,
): string[] {
  const fromRow = sampleRow
    ? Object.keys(sampleRow).filter(
        (k) => k !== 'category' && k !== 'originalData' && typeof sampleRow[k] === 'number',
      )
    : [];

  if (fromRow.length > 0 && !(fromRow.length === 1 && fromRow[0] === 'value')) {
    return fromRow;
  }

  if (columns && columns.length > 0) {
    const x = (xAxis || '').trim();
    const valueCols = columns.filter((c) => c !== x);
    if (valueCols.length) return valueCols;
  }

  return fromRow;
}

/** Shared axis name label styling (category + value axis titles). */
export const CHART_AXIS_TITLE_FONT_SIZE = 12;
export const CHART_AXIS_TITLE_FONT_WEIGHT = '500';

/** Shared axis tick value styling (category + numeric tick labels). */
export const CHART_AXIS_TICK_FONT_SIZE = 10;
export const CHART_AXIS_TICK_FONT_WEIGHT = '500';

/** Category-axis title: customization wins, else API `x_axis` (e.g. STATEMENT_DATE → Statement Date). */
export function resolveCategoryAxisTitle(customTitle: string | undefined, xAxisColumn: string): string {
  const custom = (customTitle || '').trim();
  if (custom) return custom;
  if (xAxisColumn && xAxisColumn !== 'category') return formatFieldName(xAxisColumn);
  return '';
}

/** Rotated value-axis title — vertically centered on chart height (vertical XY charts). */
export function attachLeftValueAxisTitle(
  chart: am5xy.XYChart,
  root: am5.Root,
  text: string,
  fill: am5.Color,
  opts?: {
    margin?: number;
    position?: 'left' | 'right' | 'center' | 'inside';
    fontSize?: number;
    logEnabled?: boolean;
  },
) {
  const base = (text || '').trim();
  const titleText = opts?.logEnabled
    ? `${base ? `${base} — ` : ''}Logarithmic Scale (base 10)`
    : base;
  if (!titleText.trim()) return;

  const titlePosition = opts?.position || 'left';
  const margin = opts?.margin ?? 1;
  const fontSize = opts?.fontSize ?? CHART_AXIS_TITLE_FONT_SIZE;
  /** Gap between rotated title and numeric tick labels (px). */
  const gapAfterTitle = 0;
  const label = am5.Label.new(root, {
    text: titleText,
    fontSize,
    fontWeight: CHART_AXIS_TITLE_FONT_WEIGHT,
    fill,
    rotation: titlePosition === 'left' ? -90 : titlePosition === 'right' ? 90 : 0,
    centerY: am5.p50,
    y: am5.p50,
    centerX: titlePosition === 'right' ? am5.p100 : am5.percent(20),
    x: titlePosition === 'right' ? am5.p100 : am5.percent(20),
    paddingRight: titlePosition === 'left' ? gapAfterTitle : 0,
    paddingLeft: titlePosition === 'right' ? gapAfterTitle : 0,
    marginRight: titlePosition === 'left' ? gapAfterTitle : 0,
    marginLeft: titlePosition === 'right' ? gapAfterTitle : 0,
  });
  try {
    // Rotated title width ≈ one line height; reserve title + gap + tick label column.
    const reserveSide = 0;

    if (titlePosition === 'right') {
      chart.rightAxesContainer.children.unshift(label);
      chart.set('paddingRight', 0);
    } else {
      chart.leftAxesContainer.children.unshift(label);
      chart.set('paddingLeft', 0);
    }
  } catch (e) {}
}

/** Centered category-axis name below tick labels (inside chart card). */
export function attachBottomCategoryAxisTitle(
  chart: am5xy.XYChart,
  root: am5.Root,
  text: string,
  fill: am5.Color,
  marginTop = 2,
) {
  const trimmed = (text || '').trim();
  if (!trimmed) return;
  const label = am5.Label.new(root, {
    text: trimmed,
    fontSize: CHART_AXIS_TITLE_FONT_SIZE,
    fontWeight: CHART_AXIS_TITLE_FONT_WEIGHT,
    fill,
    textAlign: 'center',
    centerX: am5.p50,
    x: am5.p50,
    width: am5.percent(100),
    paddingTop: marginTop,
    paddingBottom: 0,
  });
  try {
    chart.bottomAxesContainer.children.push(label);
    chart.set('paddingBottom', Math.max(Number(chart.get('paddingBottom')) || 0, marginTop + 2));
  } catch (e) {}
}

/** Value-axis name below tick labels (horizontal bar layout — numeric X). */
export function attachBottomValueAxisTitle(
  chart: am5xy.XYChart,
  root: am5.Root,
  text: string,
  fill: am5.Color,
  marginTop = 6,
  logEnabled = false,
) {
  const base = (text || '').trim();
  const titleText = logEnabled
    ? `${base ? `${base} — ` : ''}Logarithmic Scale (base 10)`
    : base;
  if (!titleText.trim()) return;
  attachBottomCategoryAxisTitle(chart, root, titleText, fill, marginTop);
}

/** Category-axis name on the left (horizontal bar layout) — left of date/category tick labels. */
export function attachLeftCategoryAxisTitle(
  chart: am5xy.XYChart,
  root: am5.Root,
  text: string,
  fill: am5.Color,
  marginRight = 8,
  categoryLabelWidth = 48,
) {
  const trimmed = (text || '').trim();
  if (!trimmed) return;
  const fontSize = CHART_AXIS_TITLE_FONT_SIZE;
  const gapAfterTitle = 0;
  const label = am5.Label.new(root, {
    text: trimmed,
    fontSize,
    fontWeight: CHART_AXIS_TITLE_FONT_WEIGHT,
    fill,
    rotation: -90,
    centerY: am5.p50,
    y: am5.p50,
    centerX: am5.percent(15),
    x: am5.percent(15),
    paddingRight: gapAfterTitle,
    marginRight: gapAfterTitle,
  });
  try {
    const reserveLeft = 0;
    chart.leftAxesContainer.children.unshift(label);
    chart.set('paddingLeft', Math.max(Number(chart.get('paddingLeft')) || 0, reserveLeft));
  } catch (e) {}
}
