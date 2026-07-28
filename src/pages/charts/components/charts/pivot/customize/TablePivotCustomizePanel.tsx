import TableChartCustomization, {
  DEFAULT_TABLE_CHART_CONFIG,
  type TableChartConfig,
} from '../../Tablechartcustomization';

/** Pivot customize options share the same shape as table chart customize. */
export type TablePivotCustomizationOptions = TableChartConfig;

const defaultOptions: TablePivotCustomizationOptions = {
  ...DEFAULT_TABLE_CHART_CONFIG,
};

export function TablePivotCustomizePanel({
  options = defaultOptions,
  onOptionsChange,
  availableColumns = [],
}: {
  options?: Partial<TablePivotCustomizationOptions> | null;
  onOptionsChange: (o: TablePivotCustomizationOptions) => void;
  /** Pivot row + column + metric fields from the Data tab. */
  availableColumns?: { key: string; label: string }[];
}) {
  const value: TableChartConfig = {
    ...DEFAULT_TABLE_CHART_CONFIG,
    ...(options || {}),
    appearance: {
      ...DEFAULT_TABLE_CHART_CONFIG.appearance,
      ...(options?.appearance || {}),
    },
    columns: {
      ...DEFAULT_TABLE_CHART_CONFIG.columns,
      ...(options?.columns || {}),
      available:
        availableColumns.length > 0
          ? availableColumns
          : options?.columns?.available ?? DEFAULT_TABLE_CHART_CONFIG.columns.available,
      badges: options?.columns?.badges ?? DEFAULT_TABLE_CHART_CONFIG.columns.badges,
      fixedColumns: options?.columns?.fixedColumns ?? DEFAULT_TABLE_CHART_CONFIG.columns.fixedColumns,
      progressBars: options?.columns?.progressBars ?? DEFAULT_TABLE_CHART_CONFIG.columns.progressBars,
    },
    pagination: {
      ...DEFAULT_TABLE_CHART_CONFIG.pagination,
      ...(options?.pagination || {}),
    },
    sortingFiltering: {
      ...DEFAULT_TABLE_CHART_CONFIG.sortingFiltering,
      ...(options?.sortingFiltering || {}),
    },
    typography: {
      ...DEFAULT_TABLE_CHART_CONFIG.typography,
      ...(options?.typography || {}),
    },
  };

  return (
    <TableChartCustomization
      key={`pivot-customize-${availableColumns.map((c) => c.key).join('|') || 'empty'}`}
      value={value}
      onChange={onOptionsChange}
      availableColumns={availableColumns}
      panelDescription="Pivot table display settings"
      variant="pivot"
    />
  );
}

export { defaultOptions };
