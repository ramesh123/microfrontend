import type { FormApiLogicStep, FormBuilderField, FormFieldValue } from '../../types';
import {
  DEFAULT_TABLE_INITIAL_ROW_COUNT,
  getTableRowsForField,
  normalizeTableColumns,
  normalizeTableInitialRowCount,
} from '../../lib/table/form-table.utils';
import { FormBuilderDataTable } from './data-table';

interface FormDataTableProps {
  field: FormBuilderField;
  value?: FormFieldValue;
  variant?: 'default' | 'canvas' | 'runtime';
  apiSteps?: FormApiLogicStep[];
}

export function FormDataTable({
  field,
  value,
  variant = 'default',
  apiSteps = [],
}: FormDataTableProps) {
  const columns = normalizeTableColumns(field.tableColumns);
  const rows = getTableRowsForField(field, value);
  const initialRowCount = normalizeTableInitialRowCount(
    field.tableInitialRowCount ?? DEFAULT_TABLE_INITIAL_ROW_COUNT,
  );

  const tableUi = {
    ...field.tableUi,
    searchStepId: field.tableUi?.searchStepId ?? field.apiSource?.stepId,
  };

  return (
    <FormBuilderDataTable
      title={field.displayName}
      columns={columns}
      rows={rows}
      initialRowCount={initialRowCount}
      tableUi={tableUi}
      apiSteps={apiSteps}
      responsePath={field.apiSource?.responseKey?.trim() || 'data'}
      variant={variant}
    />
  );
}
