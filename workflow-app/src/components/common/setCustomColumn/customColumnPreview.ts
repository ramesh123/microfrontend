import { CustomColumn, CustomFilter } from '@/types/customColumn';

const getOperationSymbol = (operation: string): string => {
  if (!operation) return '';
  return operation.split(' ')[0];
};

const resolveOperand = (row: Record<string, unknown>, useManual: boolean, value: unknown): number | string => {
  if (useManual) {
    const num = Number(value);
    return value === '' || value === null || value === undefined ? 0 : (isNaN(num) ? String(value) : num);
  }
  if (!value || value === 'none') return 0;
  const cell = row[String(value)];
  const num = Number(cell);
  return cell === '' || cell === null || cell === undefined ? 0 : (isNaN(num) ? String(cell) : num);
};

const applyOperation = (left: number | string, operation: string, right: number | string): number | string => {
  const num1 = Number(left);
  const num2 = Number(right);
  if (isNaN(num1) || isNaN(num2)) return left;

  switch (getOperationSymbol(operation)) {
    case '+':
      return num1 + num2;
    case '-':
      return num1 - num2;
    case '*':
      return num1 * num2;
    case '/':
      return num2 !== 0 ? num1 / num2 : num1;
    default:
      return left;
  }
};

const computeFilterChain = (row: Record<string, unknown>, filters: CustomFilter[]): number | string | null => {
  if (!filters.length) return null;

  let result: number | string | null = null;

  filters.forEach((filter, index) => {
    const operation = getOperationSymbol(filter.operation);
    const right = resolveOperand(row, filter.text_slf_box, filter.selected_last_field);

    if (index === 0) {
      const left = resolveOperand(row, !!filter.text_sf_box, filter.selected_field);
      result = applyOperation(left, operation, right);
    } else if (result !== null) {
      result = applyOperation(result, operation, right);
    }
  });

  return result;
};

export const computeCustomColumnPreviewRows = (
  sourceRows: Record<string, unknown>[],
  columnConfigs: CustomColumn[]
): { rows: Record<string, unknown>[]; previewColumnNames: string[] } => {
  const previewColumnNames = columnConfigs
    .map((col) => col.new_custom_column?.trim())
    .filter((name): name is string => Boolean(name));

  const rows = sourceRows.map((row) => {
    const nextRow = { ...row };
    columnConfigs.forEach((col) => {
      const columnName = col.new_custom_column?.trim();
      if (!columnName) return;
      nextRow[columnName] = computeFilterChain(row, col.custom_filter_list);
    });
    return nextRow;
  });

  return { rows, previewColumnNames };
};
