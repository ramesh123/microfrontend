/**
 * Format a field name for display (e.g. "some_field_name" -> "Some Field Name").
 */
export function formatFieldName(name: string): string {
  let formatted = name.replace(/_/g, ' ');
  formatted = formatted.replace(/([a-z])([A-Z])/g, '$1 $2');
  formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  return formatted.trim();
}

/**
 * True for flat keys used only by ChartConfigurator / DynamicChartForm (e.g. `metric_0_operation`, `dimensions_1_columns`).
 * These must never appear inside API `params`.
 */
export function isChartFormAuxiliaryParamKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  if (
    /^(metric|metrics|mtric)(_\d+)?_(operation|alias|aggregation|agg|columns)$/i.test(key) ||
    /^(metric|metrics|mtric)_(operation|alias|aggregation|agg|columns)$/i.test(key)
  ) {
    return true;
  }
  if (
    /^(dimensions|filters|hierarchy|x-axis|X-axis)(_\d+)_(alias|label|operator|value|aggregation|agg|columns)$/i.test(
      key,
    )
  ) {
    return true;
  }
  return false;
}

/** Drop UI-only keys from chart API `params` (mutates a shallow copy). */
export function stripChartFormAuxKeysFromParams<T extends Record<string, any>>(
  params: T | null | undefined,
): T {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return {} as T;
  }
  const out = { ...params } as Record<string, any>;
  for (const k of Object.keys(out)) {
    if (isChartFormAuxiliaryParamKey(k)) delete out[k];
  }
  return out as T;
}

/**
 * Extract column name from a form value (string or object with name/columns/field).
 */
export function extractColumnName(col: any): string | null {
  if (!col) return null;
  if (typeof col === 'string') return col;
  if (typeof col === 'object' && col !== null) {
    if (col.name) return col.name;
    if (col.columns) return col.columns;
    if (col.field) return col.field;
  }
  return null;
}

/**
 * Get nested form value (supports indexed keys for array items).
 */
export function getNestedValue(
  formValues: Record<string, any>,
  paramKey: string,
  nestedKey: string,
  index?: number
): any {
  if (index !== undefined) {
    // Single-slot metrics: Select writes `metric_operation`; hydrate often sets `metric_0_operation`.
    // Prefer unindexed first for index 0 so user edits win over stale indexed values.
    if (index === 0) {
      const unindexedKey = `${paramKey}_${nestedKey}`;
      const vu = formValues[unindexedKey];
      if (vu !== undefined && vu !== null && vu !== '') return vu;
    }
    const indexedKey = `${paramKey}_${index}_${nestedKey}`;
    const v = formValues[indexedKey];
    if (v !== undefined && v !== null && v !== '') return v;
    const arr = formValues[paramKey];
    if (Array.isArray(arr) && arr[index] != null && typeof arr[index] === 'object') {
      const inner = (arr[index] as Record<string, unknown>)[nestedKey];
      if (inner !== undefined && inner !== null && inner !== '') return inner;
    }
  }
  const nonIndexedKey = `${paramKey}_${nestedKey}`;
  const v2 = formValues[nonIndexedKey];
  if (v2 !== undefined && v2 !== null && v2 !== '') return v2;
  const v3 = formValues[nestedKey];
  if (v3 !== undefined && v3 !== null && v3 !== '') return v3;
  return null;
}

const METRIC_KEY_PREFIX = /^(metric|metrics|mtric)$/i;

/**
 * Resolves nested metric fields (operation, alias) for save/generate payloads.
 * Covers API keys metric / metrics / mtric, optional aggregation/agg, and keys like `*_idx_operation`.
 */
export function resolveMetricNested(
  formValues: Record<string, any>,
  formParams: Array<{ key?: string }> | undefined,
  nestedKey: string,
  index: number,
  col?: any
): any {
  const prefixes = new Set<string>(['metric', 'metrics', 'mtric']);
  const declared = formParams?.find((p) => {
    const k = (p?.key || '').toLowerCase();
    return k === 'metric' || k === 'metrics' || k === 'mtric';
  })?.key;
  if (declared) prefixes.add(declared);

  for (const pk of prefixes) {
    const v = getNestedValue(formValues, pk, nestedKey, index);
    if (v !== undefined && v !== null && v !== '') return v;
  }

  if (nestedKey === 'operation') {
    for (const pk of prefixes) {
      const v =
        getNestedValue(formValues, pk, 'aggregation', index) ||
        getNestedValue(formValues, pk, 'agg', index);
      if (v !== undefined && v !== null && v !== '') return v;
    }
  }

  if (col && typeof col === 'object' && col !== null) {
    const fromCol = (col as Record<string, unknown>)[nestedKey];
    if (fromCol !== undefined && fromCol !== null && fromCol !== '') return fromCol;
  }

  const suf = `_${index}_${nestedKey}`;
  for (const key of Object.keys(formValues)) {
    if (!key.endsWith(suf)) continue;
    const base = key.slice(0, -suf.length);
    if (!METRIC_KEY_PREFIX.test(base)) continue;
    const val = formValues[key];
    if (val !== undefined && val !== null && val !== '') return val;
  }
  return null;
}

/**
 * Collect column names referenced in chart params (metrics, dimensions, filters, x-axis, etc.).
 */
export function ensureColumnsFromParams(paramsObj: any): Set<string> {
  const cols = new Set<string>();
  if (!paramsObj) return cols;
  const collect = (entry: any) => {
    if (!entry) return;
    if (Array.isArray(entry)) {
      entry.forEach(collect);
    } else if (typeof entry === 'object') {
      if (entry.columns) cols.add(String(entry.columns));
    } else if (typeof entry === 'string' && entry.trim()) {
      cols.add(entry);
    }
  };
  if (paramsObj.metrics) collect(paramsObj.metrics);
  if (paramsObj.metric) collect(paramsObj.metric);
  if (paramsObj.mtric) collect(paramsObj.mtric);
  if (paramsObj.dimensions) collect(paramsObj.dimensions);
  if (paramsObj.group_by) collect(paramsObj.group_by);
  if (paramsObj.filters) collect(paramsObj.filters);
  if (paramsObj['X-axis']) {
    const xAxisVal = paramsObj['X-axis'];
    if (typeof xAxisVal === 'string') cols.add(xAxisVal);
    else if (xAxisVal && typeof xAxisVal === 'object' && xAxisVal.columns) cols.add(String(xAxisVal.columns));
  }
  if (paramsObj['x-axis']) {
    const xAxisVal = paramsObj['x-axis'];
    if (typeof xAxisVal === 'string') cols.add(xAxisVal);
    else if (xAxisVal && typeof xAxisVal === 'object' && xAxisVal.columns) cols.add(String(xAxisVal.columns));
  }
  return cols;
}

function getPairwiseResultsFromNwayOutput(output: unknown): unknown[] | null {
  if (!output || typeof output !== 'object') return null;
  const o = output as Record<string, unknown>;
  if (Array.isArray(o.pairwise_results)) return o.pairwise_results;
  const data = o.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const inner = (data as Record<string, unknown>).pairwise_results;
    if (Array.isArray(inner)) return inner;
  }
  return null;
}

/**
 * Column names from the primary `*_DATA` row object in nway validation pairwise results
 * (e.g. keys under `Transactions data_DATA`), matching the Data Validation Completed response shape.
 */
export function extractNwayValidationPairwiseDataColumns(output: unknown): string[] {
  const pairwise = getPairwiseResultsFromNwayOutput(output);
  if (!pairwise || pairwise.length === 0) return [];

  const pickDataObject = (record: unknown): Record<string, unknown> | null => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
    const rec = record as Record<string, unknown>;
    const keys = Object.keys(rec);
    for (const k of keys) {
      if (!k.endsWith('_DATA')) continue;
      const v = rec[k];
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        if (k.includes('Transactions') || k === 'Transactions data_DATA') {
          return v as Record<string, unknown>;
        }
      }
    }
    for (const k of keys) {
      if (!k.endsWith('_DATA')) continue;
      const v = rec[k];
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        return v as Record<string, unknown>;
      }
    }
    return null;
  };

  for (const pair of pairwise) {
    if (!pair || typeof pair !== 'object') continue;
    const records = (pair as Record<string, unknown>).records;
    if (!Array.isArray(records) || records.length === 0) continue;
    for (const record of records) {
      const dataObj = pickDataObject(record);
      if (dataObj) return Object.keys(dataObj);
    }
  }
  return [];
}

function isNwayValidationUpstreamNode(node: any): boolean {
  const id =
    node?.data?.node_id ??
    node?.data?.current_node_id ??
    node?.data?.node?.node_id;
  return id === 'nway_validation';
}

/**
 * Columns for draggable upstream fields: uses `output.columns` when present; for `nway_validation`,
 * falls back to `pairwise_results` → `*_DATA` object keys when columns are missing or empty.
 */
export function getUpstreamNodeFieldColumns(node: any): string[] {
  const out = node?.data?.node?.output;
  const rawCols = out?.columns;
  const asStrings = (arr: unknown): string[] =>
    Array.isArray(arr) ? arr.map((c) => String(c)).filter((c) => c.length > 0) : [];

  if (isNwayValidationUpstreamNode(node)) {
    const fromPairwise = extractNwayValidationPairwiseDataColumns(out);
    if (fromPairwise.length > 0) return fromPairwise;
  }

  return asStrings(rawCols);
}
