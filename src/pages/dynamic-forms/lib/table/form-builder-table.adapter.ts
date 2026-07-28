import type { FormBuilderTableColumnDef } from './form-builder-table.types';
import type { FormBuilderTableColumn, FormBuilderTableRow } from '../../types';

export function buildFormBuilderTableColumns(
  columns: FormBuilderTableColumn[],
  options?: { sortable?: boolean; filterable?: boolean },
): FormBuilderTableColumnDef[] {
  const sortable = options?.sortable !== false;
  const filterable = options?.filterable !== false;
  return columns.map((column) => ({
    key: column.id,
    header: column.label,
    sortable,
    filterable,
    align: 'left' as const,
    display: column.display ?? 'text',
  }));
}

export function buildFormBuilderTableData(
  rows: FormBuilderTableRow[],
  columns: FormBuilderTableColumn[],
): Record<string, unknown>[] {
  return rows.map((row, index) => {
    const record: Record<string, unknown> = {
      id: row.id,
      _rowKey: row.id || `row_${index}`,
    };
    columns.forEach((column) => {
      const value = row.cells[column.id]?.trim();
      record[column.id] = value ? value : '—';
    });
    return record;
  });
}

export function buildTablePageSizeSteps(initialRowCount: number): number[] {
  const base = Math.max(1, Math.floor(initialRowCount));
  const steps = new Set([5, 10, 20, 50, base]);
  return [...steps].sort((a, b) => a - b);
}
