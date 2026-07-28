import { useMemo, useState, useEffect } from 'react';
import CustomTableData from './TableChartCustomTableData';
import { getColumnNumericExtent, resolveTableBadgeColor, TableChartConfig } from '../../Tablechartcustomization';

interface TableChartProps {
  // Accept either transformed chartData (category/value/originalData) or raw row objects from API
  data: Array<Record<string, any>> | Array<{ category: string; value: number; originalData: any }>;
  chartName?: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Hide the in-card title row (e.g. when the parent header already shows the chart name). */
  hideTitle?: boolean;
  /** Tighter padding for embedded dashboard card table view. */
  compact?: boolean;
  /**
   * Optional customization config from <TableChartCustomization />. Entirely optional —
   * omitting it keeps the exact previous look and behavior (all columns shown, sortable,
   * paginated at 20/page, default header colors).
   */
  config?: TableChartConfig;
}

export function TableChart({ data, chartName, icon: IconComponent, hideTitle = false, compact = false, config }: TableChartProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(config?.pagination?.pageSize ?? 20);

  // Transform data to table format
  const tableData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data.map((item, index) => {
      let row: Record<string, any>;
      if (item.originalData && typeof item.originalData === 'object' && !Array.isArray(item.originalData)) {
        row = {
          id: index,
          ...item.originalData,
        };
      } else {
        row = { id: index };
        if (typeof item === 'object' && item !== null) {
          Object.keys(item).forEach((key) => {
            if (key !== 'originalData') {
              row[key] = item[key];
            }
          });
        }
      }
      return { ...row, _tableChartRowId: index };
    });
  }, [data]);

  // Reset page when source data changes
  useEffect(() => {
    setCurrentPage(0);
  }, [tableData]);

  // Keep local page size in sync if the customization panel changes it after mount
  useEffect(() => {
    if (config?.pagination?.pageSize && config.pagination.pageSize !== pageSize) {
      setPageSize(config.pagination.pageSize);
      setCurrentPage(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.pagination?.pageSize]);

  const slicedData = useMemo(() => {
    if (config?.pagination?.enabled === false) return tableData;
    const startIndex = currentPage * pageSize;
    const endIndex = startIndex + pageSize;
    return tableData.slice(startIndex, endIndex);
  }, [tableData, currentPage, pageSize, config?.pagination?.enabled]);


  const columns = useMemo(() => {
    if (tableData.length === 0) return [];
    const firstRow = tableData[0];
    const allKeys = Object.keys(firstRow).filter((key) => key !== 'id' && key !== '_tableChartRowId');

    const visibleKeys = config?.columns?.visible?.length ? config.columns.visible.filter((k) => allKeys.includes(k)) : allKeys;

    const sortable = config?.sortingFiltering?.sortable ?? true;
    const filterable = config?.sortingFiltering?.filterable ?? false;
    const align = config?.columns?.align;
    const badges = config?.columns?.badges;
    const fixedColumns = config?.columns?.fixedColumns ?? [];
    const progressBars = config?.columns?.progressBars; // NEW

    return visibleKeys.map((key) => {
      const header = key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase());

      const headerLength = header.length;
      const maxContentLength = tableData.reduce((max, row) => {
        const value = row[key];
        const valueStr = value !== null && value !== undefined ? String(value) : '';
        return Math.max(max, valueStr.length);
      }, headerLength);

      const calculatedWidth = Math.max(80, Math.min(300, maxContentLength * 8 + 40));
      const hasBadgeConfig = badges?.[key] != null && (
        typeof badges[key] === 'string'
          ? Boolean(badges[key])
          : Array.isArray(badges[key])
            ? badges[key].length > 0
            : Boolean((badges[key] as { color?: string })?.color)
      );
      const progressCfg = progressBars?.[key];
      const columnExtent = hasBadgeConfig ? getColumnNumericExtent(tableData, key) : null;

      return {
        key,
        header,
        colWidth: calculatedWidth,
        sortable,
        filterable,
        ...(align ? { align } : {}),
        ...(fixedColumns.includes(key) ? { pinnedLeft: true } : {}),
        ...(hasBadgeConfig
          ? {
              renderCell: (row: Record<string, any>) => {
                const val = row[key];
                if (val === null || val === undefined || val === '') return '-';
                const badgeColor = resolveTableBadgeColor(
                  badges?.[key],
                  val,
                  columnExtent?.min,
                  columnExtent?.max,
                );
                if (!badgeColor) return String(val);
                return (
                  <span
                    className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
                    style={{
                      backgroundColor: `${badgeColor}1A`,
                      color: badgeColor,
                    }}
                  >
                    {String(val)}
                  </span>
                );
              },
            }
          : {}),
        ...(progressCfg && !hasBadgeConfig
          ? {
              renderCell: (row: Record<string, any>) => {
                const raw = Number(row[key]);
                if (!Number.isFinite(raw)) return String(row[key] ?? '-');
                const pct = Math.max(0, Math.min(100, (raw / progressCfg.max) * 100));
                return (
                  <div className="flex items-center gap-2 w-full min-w-[140px]">
                    <div className="relative h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: progressCfg.color }}
                      />
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground flex-shrink-0">
                      {raw}
                    </span>
                  </div>
                );
              },
            }
          : {}),
      };
    });
}, [
  tableData,
  config?.columns?.visible,
  config?.columns?.align,
  config?.columns?.badges,
  config?.columns?.progressBars,
  config?.columns?.fixedColumns,
  config?.sortingFiltering?.sortable,
  config?.sortingFiltering?.filterable,
]);
  const paginationEnabled = config?.pagination?.enabled ?? true;

  const paginationConfig = useMemo(() => ({
    steps: config?.pagination?.pageSizeOptions ?? [10, 20, 50, 100],
    currentPage,
    pageSize,
    totalRows: tableData.length,
    onChange: ({ currentPage: newPage, limit: newLimit }: { currentPage: number; limit: number }) => {
      setCurrentPage(newPage);
      setPageSize(newLimit);
    },
  }), [currentPage, pageSize, tableData.length, config?.pagination?.pageSizeOptions]);

  const initialSort = useMemo(() => {
    const key = config?.sortingFiltering?.defaultSortColumn;
    if (!key) return undefined;
    return { key, dir: config?.sortingFiltering?.defaultSortDir ?? 'asc' };
  }, [config?.sortingFiltering?.defaultSortColumn, config?.sortingFiltering?.defaultSortDir]);

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No data to display
      </div>
    );
  }

  return (
    <div className={`flex h-full min-h-0 w-full flex-col ${compact ? 'p-0' : 'p-2'}`}>
      {!hideTitle && (chartName || IconComponent) && (
        <div className="mb-4 flex flex-shrink-0 items-center gap-2">
          {IconComponent && <IconComponent className="h-4 w-4" />}
          {chartName && <h3 className="text-sm font-semibold text-foreground">{chartName}</h3>}
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-card text-card-foreground">
        <CustomTableData
          data={slicedData as Record<string, unknown>[]}
          columns={columns}
          rowKey="_tableChartRowId"
          scrollAreaFillsParent
          HorizontalScroll
          wrapLongCells
          bodyCellClassName="min-h-8 py-1"
          emptyState={<div className="p-8 text-center text-muted-foreground">No data to display</div>}
          enableHeaderActions
          pagination={paginationEnabled ? paginationConfig : undefined}
          headerBg={config?.appearance?.headerBg}
          headerTextColor={config?.appearance?.headerTextColor}
          striped={config?.appearance?.striped}
          showBorder={config?.appearance?.showBorder}
          density={config?.appearance?.density}
          headerFontSize={config?.typography?.headerFontSize}
          cellFontSize={config?.typography?.cellFontSize}
          headerFontWeight={config?.typography?.headerFontWeight}
          initialSort={initialSort}
        />
      </div>
    </div>
  );
}