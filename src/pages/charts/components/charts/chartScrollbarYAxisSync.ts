import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import { computePaddedValueAxisDomain } from '@/utils/chartValueAxisDomain';

const EXCLUDED_ROW_KEYS = new Set(['category', 'originalData']);

/** Minimum categories/bars to show when data zoom is active; also used as the threshold to enable zoom. */
export function resolveDataZoomMin(options?: Record<string, unknown>, fallback = 6): number {
  const raw = options?.dataZoomMin;
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 1) return Math.floor(n);
  return fallback;
}

export function resolveChartAxisTruncateOptions(options?: Record<string, unknown>): {
  userTruncate: boolean;
  rawMin: unknown;
  rawMax: unknown;
  bothBoundsFixed: boolean;
} {
  const opt = (k: string) => options?.[k];
  const userTruncate = Boolean(opt('truncateAxis') || opt('truncateXAxis'));
  let rawMin = opt('axisMin');
  let rawMax = opt('axisMax');
  if ((rawMin === undefined || rawMin === '') && Boolean(opt('truncateXAxis'))) {
    rawMin = opt('xAxisMin');
  }
  if ((rawMax === undefined || rawMax === '') && Boolean(opt('truncateXAxis'))) {
    rawMax = opt('xAxisMax');
  }
  const parseBound = (v: unknown): number | null => {
    if (v === null || typeof v === 'undefined' || v === '') return null;
    const n = Number(String(v));
    return Number.isFinite(n) ? n : null;
  };
  const bothBoundsFixed =
    userTruncate && parseBound(rawMin) !== null && parseBound(rawMax) !== null;
  return { userTruncate, rawMin, rawMax, bothBoundsFixed };
}

export function collectNumericValuesFromChartRows(
  rows: Array<Record<string, unknown>>,
  valueKeys: string[],
): number[] {
  const values: number[] = [];
  rows.forEach((row) => {
    if (!row) return;
    const keys =
      valueKeys.length > 0
        ? valueKeys
        : Object.keys(row).filter(
            (k) => !EXCLUDED_ROW_KEYS.has(k) && typeof row[k] === 'number',
          );
    keys.forEach((key) => {
      const value = Number(row[key]);
      if (Number.isFinite(value)) values.push(value);
    });
  });
  return values;
}

function getVisibleIndexRange(
  categoryAxis: any,
  chart: am5xy.XYChart,
  pointCount: number,
  categoryOnYAxis: boolean,
): { start: number; end: number } {
  if (pointCount <= 0) return { start: 0, end: -1 };

  let startPos = categoryAxis.get('start', 0);
  let endPos = categoryAxis.get('end', 1);

  const sb = categoryOnYAxis ? chart.get('scrollbarY') : chart.get('scrollbarX');
  if (sb && startPos === 0 && endPos === 1) {
    const sbStart = sb.get('start', 0);
    const sbEnd = sb.get('end', 1);
    if (sbStart > 0 || sbEnd < 1) {
      startPos = sbStart;
      endPos = sbEnd;
    }
  }

  const startIndex = Math.max(0, Math.floor(startPos * pointCount));
  const endIndex = Math.min(
    pointCount - 1,
    Math.max(startIndex, Math.ceil(endPos * pointCount) - 1),
  );
  return { start: startIndex, end: endIndex };
}

function syncCategoryZoomFromScrollbar(
  chart: am5xy.XYChart,
  categoryAxis: any,
  categoryOnYAxis: boolean,
): void {
  const sb = categoryOnYAxis ? chart.get('scrollbarY') : chart.get('scrollbarX');
  if (!sb) return;
  const s = sb.get('start', 0);
  const e = sb.get('end', 1);
  categoryAxis.zoom(s, e, 0);
}

function applyValueAxisForVisibleCategories(
  categoryAxis: any,
  valueAxis: am5xy.ValueAxis<am5xy.AxisRenderer>,
  chart: am5xy.XYChart,
  opts: {
    rows: Array<Record<string, unknown>>;
    valueKeys: string[];
    categoryOnYAxis: boolean;
    logEnabled: boolean;
    treatZeroAs?: number;
    userTruncate: boolean;
    rawMin: unknown;
    rawMax: unknown;
  },
): void {
  const pointCount = opts.rows.length;
  if (pointCount === 0) return;

  const { start, end } = getVisibleIndexRange(
    categoryAxis,
    chart,
    pointCount,
    opts.categoryOnYAxis,
  );
  if (end < start) return;

  const vals = collectNumericValuesFromChartRows(
    opts.rows.slice(start, end + 1),
    opts.valueKeys,
  );
  if (vals.length === 0) return;

  let minVal = Math.min(...vals);
  let maxVal = Math.max(...vals);

  if (opts.logEnabled) {
    if (minVal <= 0) {
      minVal =
        opts.treatZeroAs ??
        Math.max(1e-9, Math.min(...vals.filter((v) => v > 0)));
    }
  }

  const padded = computePaddedValueAxisDomain(
    vals,
    minVal,
    maxVal,
    opts.logEnabled,
    opts.userTruncate,
    opts.rawMin,
    opts.rawMax,
  );

  const parseBound = (v: unknown): number | null => {
    if (v === null || typeof v === 'undefined' || v === '') return null;
    const n = Number(String(v));
    return Number.isFinite(n) ? n : null;
  };
  const explicitMaxBound = opts.userTruncate && parseBound(opts.rawMax) !== null;

  try {
    valueAxis.set('min', padded.minVal);
    valueAxis.set('max', padded.maxVal);
    valueAxis.set('extraMin', 0);
    valueAxis.set('extraMax', explicitMaxBound ? 0 : 0.08);
    valueAxis.set('strictMinMax', false);
    valueAxis.zoomToValues(padded.minVal, padded.maxVal);
    valueAxis.markDirty?.();
  } catch {
    /* amCharts version differences */
  }
}

/**
 * When a category scrollbar is active, rescale the value axis to the visible category window
 * (same behavior as exploratory mini charts + aging analytics charts).
 */
export function attachChartScrollbarYRangeSync(
  root: am5.Root,
  chart: am5xy.XYChart,
  categoryAxis: any,
  valueAxis: am5xy.ValueAxis<am5xy.AxisRenderer>,
  options: {
    rows: Array<Record<string, unknown>>;
    valueKeys: string[];
    categoryOnYAxis?: boolean;
    logEnabled?: boolean;
    treatZeroAs?: number;
    userTruncate?: boolean;
    rawMin?: unknown;
    rawMax?: unknown;
    /** Skip when user fixed both min and max via truncate options */
    skipWhenBothBoundsFixed?: boolean;
    afterCategoryZoom?: () => void;
  },
): void {
  if (options.skipWhenBothBoundsFixed) return;
  if (!options.rows.length || !options.valueKeys.length) return;

  const categoryOnYAxis = options.categoryOnYAxis ?? false;
  const syncOpts = {
    rows: options.rows,
    valueKeys: options.valueKeys,
    categoryOnYAxis,
    logEnabled: options.logEnabled ?? false,
    treatZeroAs: options.treatZeroAs,
    userTruncate: options.userTruncate ?? false,
    rawMin: options.rawMin,
    rawMax: options.rawMax,
  };

  let framePending = false;
  const scheduleApply = () => {
    if (framePending) return;
    framePending = true;
    root.events.once('frameended', () => {
      framePending = false;
      applyValueAxisForVisibleCategories(categoryAxis, valueAxis, chart, syncOpts);
    });
  };

  const onCategoryZoomChanged = () => {
    syncCategoryZoomFromScrollbar(chart, categoryAxis, categoryOnYAxis);
    scheduleApply();
  };

  const bootstrap = () => {
    options.afterCategoryZoom?.();
    syncCategoryZoomFromScrollbar(chart, categoryAxis, categoryOnYAxis);
    scheduleApply();
  };

  let bootstrapAttempts = 0;
  const bootstrapWhenReady = () => {
    bootstrapAttempts += 1;
    const ready = options.rows.length > 0;
    if (!ready && bootstrapAttempts < 8) {
      root.events.once('frameended', bootstrapWhenReady);
      return;
    }
    bootstrap();
  };

  (chart.events as any).once('datavalidated', bootstrapWhenReady);
  const firstSeries = chart.series?.getIndex?.(0);
  firstSeries?.events?.once?.('datavalidated', bootstrapWhenReady);
  root.events.once('frameended', bootstrapWhenReady);

  const sb = categoryOnYAxis ? chart.get('scrollbarY') : chart.get('scrollbarX');
  sb?.events.on('rangechanged', onCategoryZoomChanged);
  categoryAxis.on('start', scheduleApply);
  categoryAxis.on('end', scheduleApply);
}
