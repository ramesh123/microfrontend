import { getBigNumberMetricKey } from './bigNumberUnitOptions';

export type BigNumberChartItem = {
  category: string;
  value: number;
  originalData: any;
  alias?: string;
  /** Index in chart params.metrics — used for per-metric customization. */
  metricConfigIndex?: number;
  /** Stable column key for per-metric customization. */
  metricKey?: string;
};

export type BigNumberMetricConfig = {
  columns?: string;
  column?: string;
  name?: string;
  operation?: string;
  alias?: string;
};

export type BigNumberLayoutPreference = 'auto' | 'kpi' | 'columns';
export type BigNumberLayoutMode = 'single' | 'kpi' | 'columns';

export type BigNumberMetricDisplay = {
  label: string;
  value: number | string;
  formattedValue: string;
  metricIndex?: number;
  metricKey?: string;
};

export function splitKpiMetricDisplays<T extends BigNumberMetricDisplay>(
  metricDisplays: T[],
  primaryMetricIndex = 0,
): { primary: T | undefined; footer: T[] } {
  if (!metricDisplays.length) return { primary: undefined, footer: [] };
  const safeIndex = Math.max(0, Math.min(Math.round(primaryMetricIndex), metricDisplays.length - 1));
  return {
    primary: metricDisplays[safeIndex],
    footer: metricDisplays.filter((_, index) => index !== safeIndex),
  };
}

export function isBigNumberVisualization(hint?: string | null): boolean {
  const v = (hint || '').toLowerCase();
  if (!v) return false;
  if (v.includes('big_number_stream') || v.includes('big number stream')) return true;
  return (
    v.includes('bignumber') ||
    v.includes('big number') ||
    v.includes('big_number') ||
    (v.includes('big') && v.includes('number')) ||
    v === 'number'
  );
}

function isAggregatedColumn(key: string): boolean {
  return key.includes('(') && key.includes(')');
}

function cleanColumnName(key: string): string {
  return key.replace(/\(.*\)/, '').trim();
}

function isNumericLike(value: unknown): value is number | string {
  if (typeof value === 'number' && !Number.isNaN(value)) return true;
  if (value === null || value === undefined || value === '') return false;
  return !Number.isNaN(Number(value));
}

function metricMatchesValueKey(metric: BigNumberMetricConfig, valueKey: string): boolean {
  const metricCol = metric.columns || metric.column || metric.name || '';
  const cleanedValueKey = cleanColumnName(valueKey);
  const cleanedMetricCol = cleanColumnName(String(metricCol));
  const op = (metric.operation || '').toUpperCase();

  if (!metricCol && !valueKey) return false;
  if (metricCol === valueKey) return true;
  if (valueKey.includes(String(metricCol))) return true;
  if (
    cleanedValueKey &&
    cleanedMetricCol &&
    cleanedValueKey.toUpperCase() === cleanedMetricCol.toUpperCase()
  ) {
    return true;
  }
  if (op && valueKey.toUpperCase().includes(`${op}(${cleanedMetricCol})`.toUpperCase())) {
    return true;
  }
  if (op && valueKey.toUpperCase().startsWith(`${op}(`) && cleanedMetricCol) {
    return valueKey.toUpperCase().includes(cleanedMetricCol.toUpperCase());
  }
  return false;
}

function findMatchingMetric(
  valueKey: string,
  metrics: BigNumberMetricConfig[] | undefined,
  item: Record<string, any>,
): BigNumberMetricConfig | undefined {
  if (!metrics?.length) return undefined;
  return metrics.find(
    (m) =>
      metricMatchesValueKey(m, valueKey) ||
      metricMatchesValueKey(m, item.category || ''),
  );
}

function resolveValueKeysForRow(
  item: Record<string, any>,
  apiColumns: string[],
  metrics: BigNumberMetricConfig[] | undefined,
  respXAxis: string | null,
): string[] {
  const keys = Object.keys(item);

  if (metrics && metrics.length > 1) {
    const matched: string[] = [];
    for (const metric of metrics) {
      const col = metric.columns || metric.column || metric.name;
      if (!col) continue;
      const key = keys.find((k) => metricMatchesValueKey(metric, k));
      if (key && isNumericLike(item[key])) {
        matched.push(key);
      }
    }
    if (matched.length > 0) return matched;
  }

  const aggregatedKeys = keys.filter(
    (k) => isAggregatedColumn(k) && isNumericLike(item[k]),
  );
  if (aggregatedKeys.length > 1) return aggregatedKeys;

  const fromApiColumns = (apiColumns || []).filter((k) => {
    if (respXAxis && k === respXAxis) return false;
    return isNumericLike(item[k]) && (isAggregatedColumn(k) || aggregatedKeys.length === 0);
  });
  if (fromApiColumns.length > 1) return fromApiColumns;

  const aggregatedKey = aggregatedKeys[0];
  if (aggregatedKey) return [aggregatedKey];

  const numericKey = keys.find((k) => {
    if (respXAxis && k === respXAxis) return false;
    return isNumericLike(item[k]);
  });
  return numericKey ? [numericKey] : [];
}

function buildCategoryForValueKey(
  item: Record<string, any>,
  index: number,
  valueKey: string,
  metrics: BigNumberMetricConfig[] | undefined,
  respXAxis: string | null,
  apiColumns: string[],
): string {
  const metric = findMatchingMetric(valueKey, metrics, item);
  const alias = metric?.alias || metric?.name;
  if (alias) return String(alias);

  const dimensionKeys = apiColumns.filter(
    (k) => !isAggregatedColumn(k) && k !== 'value' && k !== valueKey,
  );
  if (dimensionKeys.length > 0) {
    const joined = dimensionKeys
      .map((k) => {
        const v = item[k];
        return v === null || v === undefined ? '—' : String(v).trim();
      })
      .filter((v) => v !== '')
      .join(', ');
    if (joined) return joined;
  }

  if (respXAxis && item[respXAxis] !== undefined && item[respXAxis] !== null) {
    return String(item[respXAxis]);
  }

  const baseName = cleanColumnName(valueKey);
  return baseName || `Value ${index + 1}`;
}

/** Expand API rows into one big-number item per metric column when multiple metrics are configured. */
export function transformBigNumberChartData(
  rows: Array<Record<string, any>>,
  options?: {
    columns?: string[];
    x_axis?: string | null;
    xAxis?: string | null;
    metrics?: BigNumberMetricConfig[];
  },
): BigNumberChartItem[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const respXAxis = options?.x_axis ?? options?.xAxis ?? null;
  const metrics = options?.metrics;
  const apiColumns =
    (options?.columns && options.columns.length > 0
      ? options.columns
      : rows[0]
        ? Object.keys(rows[0])
        : []) as string[];

  const multipleMetricsMode = (metrics?.length ?? 0) > 1;

  return rows
    .flatMap((item, rowIndex) => {
      const valueKeys = resolveValueKeysForRow(item, apiColumns, metrics, respXAxis);
      if (valueKeys.length === 0) return [];

      if (valueKeys.length === 1 && !multipleMetricsMode) {
        const valueKey = valueKeys[0];
        const value = Number(item[valueKey]);
        if (Number.isNaN(value)) return [];
        const category = buildCategoryForValueKey(
          item,
          rowIndex,
          valueKey,
          metrics,
          respXAxis,
          apiColumns,
        );
        const metric = findMatchingMetric(valueKey, metrics, item);
        const metricConfigIndex =
          metric && metrics?.length ? metrics.indexOf(metric) : 0;
        const alias = metric?.alias?.trim();
        return [
          {
            category,
            value,
            originalData: item,
            ...(alias ? { alias } : {}),
            metricConfigIndex,
            metricKey: getBigNumberMetricKey(metric ?? valueKey, metricConfigIndex),
          },
        ];
      }

      if (multipleMetricsMode && metrics?.length) {
        const ordered = metrics
          .map((metric, metricConfigIndex) => {
            const valueKey =
              valueKeys.find((k) => metricMatchesValueKey(metric, k)) ??
              (valueKeys.length === metrics.length ? valueKeys[metricConfigIndex] : undefined);
            if (!valueKey || !isNumericLike(item[valueKey])) return null;
            const value = Number(item[valueKey]);
            if (Number.isNaN(value)) return null;
            const alias = metric.alias?.trim();
            const category =
              alias ||
              buildCategoryForValueKey(
                item,
                metricConfigIndex,
                valueKey,
                metrics,
                respXAxis,
                apiColumns,
              );
            return {
              category,
              value,
              originalData: item,
              ...(alias ? { alias } : {}),
              metricConfigIndex,
              metricKey: getBigNumberMetricKey(metric, metricConfigIndex),
            };
          })
          .filter((entry) => entry !== null) as BigNumberChartItem[];

        if (ordered.length > 0) return ordered;
      }

      return valueKeys
        .map((valueKey, metricIdx) => {
          const value = Number(item[valueKey]);
          if (Number.isNaN(value)) return null;
          const metric = findMatchingMetric(valueKey, metrics, item);
          const metricConfigIndex =
            metric && metrics?.length ? metrics.indexOf(metric) : metricIdx;
          const alias = metric?.alias?.trim();
          const category =
            alias ||
            buildCategoryForValueKey(item, metricIdx, valueKey, metrics, respXAxis, apiColumns);
          return {
            category,
            value,
            originalData: item,
            ...(alias ? { alias } : {}),
            metricConfigIndex,
            metricKey: getBigNumberMetricKey(metric ?? valueKey, metricConfigIndex),
          };
        })
        .filter((entry) => entry !== null) as BigNumberChartItem[];
    });
}

function normalizeBigNumberChartItem(row: Record<string, any>): BigNumberChartItem | null {
  if (!row || typeof row !== 'object') return null;

  if (isNumericLike(row.value)) {
    const value = Number(row.value);
    if (Number.isNaN(value)) return null;
    const category =
      typeof row.category === 'string' && row.category.trim() !== ''
        ? row.category
        : row.alias
          ? String(row.alias)
          : 'Value';
    return {
      category,
      value,
      originalData: row.originalData ?? row,
      ...(row.alias ? { alias: String(row.alias) } : {}),
      ...(typeof row.metricConfigIndex === 'number' ? { metricConfigIndex: row.metricConfigIndex } : {}),
      ...(row.metricKey ? { metricKey: String(row.metricKey) } : {}),
    };
  }

  const keys = Object.keys(row).filter((k) => k !== 'originalData' && k !== 'category' && k !== 'alias');
  const valueKey =
    keys.find((key) => isNumericLike(row[key]) && isAggregatedColumn(key)) ||
    keys.find((key) => isNumericLike(row[key]) && key !== 'value') ||
    keys.find((key) => key === 'value' && isNumericLike(row[key]));

  if (!valueKey) return null;

  const value = Number(row[valueKey]);
  if (Number.isNaN(value)) return null;

  const category =
    typeof row.category === 'string' && row.category.trim() !== '' && row.category !== 'value'
      ? row.category
      : cleanColumnName(valueKey) || 'Value';

  return {
    category,
    value,
    originalData: row.originalData ?? row,
    ...(row.alias ? { alias: String(row.alias) } : {}),
    ...(typeof row.metricConfigIndex === 'number' ? { metricConfigIndex: row.metricConfigIndex } : {}),
    ...(row.metricKey ? { metricKey: String(row.metricKey) } : {}),
  };
}

function countNumericMetricKeys(
  row: Record<string, any>,
  metrics?: BigNumberMetricConfig[],
): number {
  if (!row || typeof row !== 'object') return 0;
  const keys = Object.keys(row);

  if (metrics && metrics.length > 1) {
    let count = 0;
    for (const metric of metrics) {
      const key = keys.find((k) => metricMatchesValueKey(metric, k));
      if (key && isNumericLike(row[key])) count += 1;
    }
    if (count > 0) return count;
  }

  const aggregated = keys.filter((k) => isAggregatedColumn(k) && isNumericLike(row[k]));
  if (aggregated.length > 0) return aggregated.length;

  return keys.filter(
    (k) =>
      k !== 'category' &&
      k !== 'originalData' &&
      k !== 'alias' &&
      k !== 'value' &&
      isNumericLike(row[k]),
  ).length;
}

function rowsForBigNumberTransform(rows: Array<Record<string, any>>): Array<Record<string, any>> {
  return rows.map((row) => {
    if (row?.originalData && typeof row.originalData === 'object' && !Array.isArray(row.originalData)) {
      return row.originalData as Record<string, any>;
    }
    return row;
  });
}

function dedupeBigNumberRawRows(rows: Array<Record<string, any>>): Array<Record<string, any>> {
  const seen = new Set<string>();
  const deduped: Array<Record<string, any>> = [];
  for (const row of rows) {
    const raw = rowsForBigNumberTransform([row])[0] ?? row;
    const key = JSON.stringify(raw);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(raw);
  }
  return deduped;
}

/** Normalize dashboard/chart rows to big-number items without double-expanding KPI rows. */
export function coerceBigNumberChartItems(
  rows: Array<Record<string, any>>,
  options?: {
    columns?: string[];
    x_axis?: string | null;
    metrics?: BigNumberMetricConfig[];
  },
): BigNumberChartItem[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  if (looksLikeExpandedBigNumberChartItems(rows)) {
    return rows
      .map((row) => normalizeBigNumberChartItem(row))
      .filter((row): row is BigNumberChartItem => row !== null);
  }

  const rawRows = dedupeBigNumberRawRows(rows);
  const expanded = transformBigNumberChartData(rawRows, options);
  if (expanded.length > 0) return expanded;

  return rawRows
    .map((row) => normalizeBigNumberChartItem(row))
    .filter((row): row is BigNumberChartItem => row !== null);
}

/** True when rows are already `{ category, value }` items (not raw API aggregation rows). */
export function looksLikeExpandedBigNumberChartItems(rows: Array<Record<string, any>>): boolean {
  if (!rows.length) return false;
  return rows.every((row) => {
    if (!row || typeof row !== 'object') return false;
    if (typeof row.category !== 'string' || row.category.trim() === '') return false;
    if (!isNumericLike(row.value)) return false;
    const extraKeys = Object.keys(row).filter(
      (k) =>
        !['category', 'value', 'originalData', 'alias', 'metricConfigIndex', 'metricKey', 'metricIndex'].includes(
          k,
        ),
    );
    return !extraKeys.some((k) => isAggregatedColumn(k) && isNumericLike(row[k]));
  });
}

export function resolveBigNumberLayoutMode(
  data: BigNumberChartItem[],
  metrics?: BigNumberMetricConfig[] | null,
  preference: BigNumberLayoutPreference = 'auto',
): BigNumberLayoutMode {
  const metricCount = Math.max(data.length, metrics?.length ?? 0);
  if (metricCount <= 1) return 'single';
  if (preference === 'kpi') return 'kpi';
  if (preference === 'columns') return 'columns';
  return metricCount >= 2 ? 'kpi' : 'columns';
}

/** Normalize dashboard/formulator chart rows or raw API rows for BigNumberChart. */
export function resolveBigNumberChartData(
  data: Array<Record<string, any>> | undefined | null,
  options?: {
    rawResponse?: {
      data?: Array<Record<string, any>>;
      columns?: string[];
      x_axis?: string | null;
      metrics?: BigNumberMetricConfig[];
    } | null;
    metrics?: BigNumberMetricConfig[];
    chartHint?: string;
  },
): BigNumberChartItem[] {
  const rawResponse = options?.rawResponse;
  const metrics = options?.metrics ?? rawResponse?.metrics;
  const multipleMetricsMode = (metrics?.length ?? 0) > 1;

  const inputRows =
    Array.isArray(data) && data.length > 0
      ? data
      : Array.isArray(rawResponse?.data) && rawResponse.data.length > 0
        ? rawResponse.data
        : [];

  if (inputRows.length === 0) return [];

  if (looksLikeExpandedBigNumberChartItems(inputRows)) {
    return inputRows
      .map((row) => normalizeBigNumberChartItem(row))
      .filter((row): row is BigNumberChartItem => row !== null);
  }

  const rowsForTransform = rowsForBigNumberTransform(inputRows);
  const transformOptions = {
    columns: rawResponse?.columns,
    x_axis: rawResponse?.x_axis ?? null,
    metrics,
  };

  const shouldExpandMultiMetric =
    multipleMetricsMode ||
    rowsForTransform.some((row) => countNumericMetricKeys(row, metrics) > 1);

  if (shouldExpandMultiMetric) {
    const expanded = transformBigNumberChartData(rowsForTransform, transformOptions);
    if (expanded.length > 0) return expanded;
  }

  const singleMetricReady = inputRows.every(
    (row) =>
      row &&
      typeof row === 'object' &&
      isNumericLike(row.value) &&
      typeof row.category === 'string' &&
      row.category.trim() !== '',
  );

  if (singleMetricReady) {
    return inputRows
      .map((row) => normalizeBigNumberChartItem(row))
      .filter((row): row is BigNumberChartItem => row !== null);
  }

  const transformed = transformBigNumberChartData(rowsForTransform, transformOptions);
  if (transformed.length > 0) return transformed;

  return inputRows
    .map((row) => normalizeBigNumberChartItem(row))
    .filter((row): row is BigNumberChartItem => row !== null);
}

export function isBigNumberMultiMetricLayout(
  data: BigNumberChartItem[],
  metrics?: BigNumberMetricConfig[] | null,
  layoutPreference: BigNumberLayoutPreference = 'auto',
): boolean {
  return resolveBigNumberLayoutMode(data, metrics, layoutPreference) === 'columns';
}

export function isBigNumberKpiLayout(
  data: BigNumberChartItem[],
  metrics?: BigNumberMetricConfig[] | null,
  layoutPreference: BigNumberLayoutPreference = 'auto',
): boolean {
  return resolveBigNumberLayoutMode(data, metrics, layoutPreference) === 'kpi';
}
