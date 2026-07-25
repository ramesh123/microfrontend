import type { FormBuilderField, FormBuilderTableColumn, FormBuilderTableRow, FormFieldValue } from '../../types';
import { getValueByPath } from '../logic/form-logic.utils';

export const DEFAULT_TABLE_COLUMNS: FormBuilderTableColumn[] = [
  { id: 'col_1', label: 'Column 1' },
  { id: 'col_2', label: 'Column 2' },
  { id: 'col_3', label: 'Column 3' },
];

export const DEFAULT_TABLE_INITIAL_ROW_COUNT = 5;
const TABLE_ROW_HEIGHT_PX = { compact: 28, default: 36 } as const;
const TABLE_HEADER_HEIGHT_PX = { compact: 32, default: 40 } as const;

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function toSnakeCase(label: string): string {
  return label.trim().replace(/\s+/g, '_').toLowerCase();
}

function toCamelCase(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  return parts
    .map((part, index) =>
      index === 0
        ? part.toLowerCase()
        : `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`,
    )
    .join('');
}

function unwrapTablePayload(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed;

  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>;
    const nested = record.rows ?? record.data ?? record.items ?? record.results ?? record.records;
    if (Array.isArray(nested)) return nested;
    return [record];
  }

  return null;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function isPrimitiveCell(value: unknown): boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function humanizeJsonKey(key: string): string {
  const leaf = key.split('.').pop() ?? key;
  return leaf
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Collect leaf paths from a row object (arrays of objects use the first item, no index in path). */
function collectLeafPaths(value: unknown, prefix = '', depth = 0, out: string[] = []): string[] {
  if (depth > 4) return out;

  if (isPrimitiveCell(value)) {
    if (prefix) out.push(prefix);
    return out;
  }

  if (Array.isArray(value)) {
    const firstObject = value.find((item) => isPlainRecord(item));
    if (firstObject) collectLeafPaths(firstObject, prefix, depth + 1, out);
    else if (value.length > 0 && isPrimitiveCell(value[0]) && prefix) out.push(prefix);
    return out;
  }

  if (!isPlainRecord(value)) return out;

  for (const [key, nested] of Object.entries(value)) {
    const nextPath = prefix ? `${prefix}.${key}` : key;
    if (isPrimitiveCell(nested)) {
      out.push(nextPath);
      continue;
    }
    if (isPlainRecord(nested) || Array.isArray(nested)) {
      collectLeafPaths(nested, nextPath, depth + 1, out);
    }
  }

  return out;
}

/** True when columns look like empty defaults (no JSON keys mapped yet). */
export function tableColumnsNeedApiDefaults(columns?: FormBuilderTableColumn[]): boolean {
  if (!columns?.length) return true;
  return columns.every((column) => !column.responseKey?.trim());
}

/**
 * Build editable column defaults from the first row of an API list response.
 * User can change headers / keys afterward.
 */
export function inferTableColumnsFromApiData(
  raw: unknown,
  maxColumns = 12,
): FormBuilderTableColumn[] {
  const entries = unwrapTablePayload(raw);
  if (!entries?.length) return [];

  const firstRow = entries.find((entry) => isPlainRecord(entry));
  if (!firstRow) return [];

  const paths = collectLeafPaths(firstRow);
  if (paths.length === 0) return [];

  const sorted = [...new Set(paths)].sort((a, b) => {
    const depthDiff = a.split('.').length - b.split('.').length;
    if (depthDiff !== 0) return depthDiff;
    return a.localeCompare(b);
  });

  return sorted.slice(0, maxColumns).map((path) => {
    const leaf = path.split('.').pop() ?? path;
    const isStatus = /status|state|active|enabled/i.test(leaf);
    return {
      id: `col_${crypto.randomUUID().slice(0, 8)}`,
      label: humanizeJsonKey(leaf),
      responseKey: path,
      display: isStatus ? ('badge' as const) : ('text' as const),
    };
  });
}

function formatCellValue(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Walk path; if a segment lands on an object array, continue into the first item. */
function getTableValueByPath(data: unknown, path: string): unknown {
  const trimmed = path.trim();
  if (!trimmed) return undefined;

  const direct = getValueByPath(data, trimmed);
  if (direct != null && direct !== '') return direct;

  let current: unknown = data;
  for (const segment of trimmed.split('.')) {
    if (current == null) return undefined;

    if (Array.isArray(current)) {
      const index = Number(segment);
      if (Number.isInteger(index) && index >= 0 && index < current.length) {
        current = current[index];
        continue;
      }
      const firstObject = current.find((item) => isPlainRecord(item));
      if (!firstObject) return undefined;
      current = firstObject;
    }

    if (!isPlainRecord(current)) return undefined;
    const match =
      segment in current
        ? segment
        : Object.keys(current).find((key) => key.toLowerCase() === segment.toLowerCase());
    if (!match) return undefined;
    current = current[match];
  }

  return current;
}

function findKeyDeep(data: unknown, keyName: string, depth = 0): unknown {
  if (data == null || depth > 8) return undefined;
  const target = normalizeKey(keyName);
  if (!target) return undefined;

  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findKeyDeep(item, keyName, depth + 1);
      if (found != null && found !== '') return found;
    }
    return undefined;
  }

  if (!isPlainRecord(data)) return undefined;

  for (const [key, value] of Object.entries(data)) {
    if (normalizeKey(key) === target && value != null && value !== '') return value;
  }

  for (const value of Object.values(data)) {
    if (isPlainRecord(value) || Array.isArray(value)) {
      const found = findKeyDeep(value, keyName, depth + 1);
      if (found != null && found !== '') return found;
    }
  }

  return undefined;
}

function resolveCellFromRecord(
  record: Record<string, unknown>,
  column: FormBuilderTableColumn,
  columnIndex: number,
): string {
  const mappedKey = column.responseKey?.trim();
  const candidateKeys = [
    mappedKey,
    column.label,
    column.id,
    `col_${columnIndex + 1}`,
    toSnakeCase(column.label),
    toCamelCase(column.label),
    column.label.replace(/\s+/g, ''),
  ].filter((key): key is string => Boolean(key?.trim()));

  for (const key of candidateKeys) {
    const byPath = getTableValueByPath(record, key);
    if (byPath != null && byPath !== '') return formatCellValue(byPath);
  }

  for (const key of candidateKeys) {
    const leaf = key.includes('.') ? (key.split('.').pop() ?? key) : key;
    const deep = findKeyDeep(record, leaf);
    if (deep != null && deep !== '') return formatCellValue(deep);
  }

  return '';
}

export function normalizeTableInitialRowCount(count?: number): number {
  const parsed = count ?? DEFAULT_TABLE_INITIAL_ROW_COUNT;
  if (!Number.isFinite(parsed)) return DEFAULT_TABLE_INITIAL_ROW_COUNT;
  return Math.min(50, Math.max(1, Math.floor(parsed)));
}

export function getTableRowHeightPx(compact = false): number {
  return compact ? TABLE_ROW_HEIGHT_PX.compact : TABLE_ROW_HEIGHT_PX.default;
}

export function getTableHeaderHeightPx(compact = false): number {
  return compact ? TABLE_HEADER_HEIGHT_PX.compact : TABLE_HEADER_HEIGHT_PX.default;
}

export function getTableBodyHeightPx(rowCount: number, compact = false): number {
  return normalizeTableInitialRowCount(rowCount) * getTableRowHeightPx(compact);
}

export function createPlaceholderRows(
  columns: FormBuilderTableColumn[],
  count: number,
): FormBuilderTableRow[] {
  const emptyCells = Object.fromEntries(columns.map((column) => [column.id, '']));
  return Array.from({ length: normalizeTableInitialRowCount(count) }, (_, index) => ({
    id: `placeholder_${index}`,
    cells: { ...emptyCells },
  }));
}

export function normalizeTableColumns(columns?: FormBuilderTableColumn[]): FormBuilderTableColumn[] {
  if (!columns?.length) return DEFAULT_TABLE_COLUMNS.map((column) => ({ ...column }));
  return columns;
}

export function normalizeTableRows(
  columns: FormBuilderTableColumn[],
  rows?: FormBuilderTableRow[],
): FormBuilderTableRow[] {
  if (!rows?.length) return [];

  return rows.map((row) => {
    const cells: Record<string, string> = {};
    columns.forEach((column) => {
      cells[column.id] = row.cells?.[column.id] ?? '';
    });
    return { id: row.id || crypto.randomUUID(), cells };
  });
}

/** Parse API / runtime value into table rows aligned with configured columns. */
export function parseTableValue(
  raw: unknown,
  columns: FormBuilderTableColumn[],
): FormBuilderTableRow[] {
  if (raw == null || raw === '') return [];

  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }

  const entries = unwrapTablePayload(parsed);
  if (!entries?.length) return [];

  return entries.map((entry, index) => {
    const cells: Record<string, string> = {};
    columns.forEach((column, columnIndex) => {
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        cells[column.id] = resolveCellFromRecord(entry as Record<string, unknown>, column, columnIndex);
      } else if (Array.isArray(entry)) {
        cells[column.id] = String(entry[columnIndex] ?? '');
      } else {
        cells[column.id] = columnIndex === 0 ? String(entry ?? '') : '';
      }
    });
    return {
      id: `row_${index}`,
      cells,
    };
  });
}

export function padTableRowsToCount(
  rows: FormBuilderTableRow[],
  columns: FormBuilderTableColumn[],
  count: number,
): FormBuilderTableRow[] {
  const target = normalizeTableInitialRowCount(count);
  if (rows.length >= target) return rows;

  const emptyCells = Object.fromEntries(columns.map((column) => [column.id, '']));
  const padded = [...rows];
  while (padded.length < target) {
    padded.push({ id: `pad_${padded.length}`, cells: { ...emptyCells } });
  }
  return padded;
}

export function getTableRowsForField(
  field: FormBuilderField,
  runtimeValue?: FormFieldValue,
): FormBuilderTableRow[] {
  const columns = normalizeTableColumns(field.tableColumns);
  const initialCount = normalizeTableInitialRowCount(field.tableInitialRowCount);

  if (runtimeValue !== undefined && runtimeValue !== null && runtimeValue !== '') {
    const fromApi = parseTableValue(runtimeValue, columns);
    if (fromApi.length > 0) return fromApi;
  }

  const syncedRows = normalizeTableRows(columns, field.tableRows);
  if (syncedRows.length > 0) return syncedRows;

  return createPlaceholderRows(columns, initialCount);
}

/** After API logic runs, persist display-field content on the form definition. */
export function syncDisplayFieldsFromAppliedLogic(
  fields: FormBuilderField[],
  values: Record<string, FormFieldValue>,
): FormBuilderField[] {
  return fields.map((field) => {
    if (!(field.name in values)) return field;

    const raw = values[field.name];

    if (field.type === 'data_table') {
      const columns = normalizeTableColumns(field.tableColumns);
      const rows = parseTableValue(raw, columns);
      if (rows.length > 0) {
        return { ...field, tableRows: rows };
      }
    }

    if (field.type === 'big_number' && raw != null && raw !== '') {
      return { ...field, bigNumberValue: String(raw) };
    }

    return field;
  });
}
