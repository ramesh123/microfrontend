import React, { useState, useMemo, useEffect } from 'react';
import { ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import '@material/web/progress/circular-progress.js';

// No @material/web data-table component exists — plain native <table>,
// matching the pattern already used by common/tableWithPagination.
// Checkbox/Button/Select above already render @material/web custom elements
// internally via their own adapters (components/ui/*.tsx).
interface SvarDataGridWithCheckboxesProps {
  data: any[];
  columns: any[];
  onSelectionChange?: (selectedRows: any[]) => void;
  isLoading?: boolean;
  pageSize?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

type SortState = { id: string; dir: 'asc' | 'desc' } | null;

const SvarDataGridWithCheckboxes: React.FC<SvarDataGridWithCheckboxesProps> = ({
  data = [],
  columns = [],
  onSelectionChange,
  isLoading = false,
  pageSize = 20,
  currentPage = 1,
  onPageChange,
  onPageSizeChange,
}) => {
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [sortState, setSortState] = useState<SortState>(null);

  // Get row ID helper
  const getRowId = (row: any): string => {
    return String(row.SYSTEM_REF_ID || row.system_ref_id || row.id || row.PK || row._rowId || '');
  };

  // Sort full dataset (before pagination) so sorting is consistent across pages
  const sortedData = useMemo(() => {
    if (!sortState) return data;
    const { id, dir } = sortState;
    return [...data].sort((a, b) => {
      const av = a[id];
      const bv = b[id];
      if (av == null && bv == null) return 0;
      if (av == null) return dir === 'asc' ? -1 : 1;
      if (bv == null) return dir === 'asc' ? 1 : -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return dir === 'asc' ? av - bv : bv - av;
      }
      return dir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [data, sortState]);

  // Calculate pagination
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedData = useMemo(() => {
    if (!sortedData || !Array.isArray(sortedData) || sortedData.length === 0) {
      return [];
    }
    const sliced = sortedData.slice(startIndex, endIndex);
    // Remove any internal fields that shouldn't be displayed
    return sliced.map(row => {
      const { __checkbox__, ...rowWithoutCheckbox } = row;
      return rowWithoutCheckbox;
    });
  }, [sortedData, startIndex, endIndex]);

  const handleSort = (colId: string) => {
    setSortState((prev) => {
      if (!prev || prev.id !== colId) return { id: colId, dir: 'asc' };
      if (prev.dir === 'asc') return { id: colId, dir: 'desc' };
      return null;
    });
  };

  // Handle checkbox selection
  const handleRowCheckboxChange = (rowId: string, checked: boolean) => {
    setSelectedRowIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(rowId);
      } else {
        newSet.delete(rowId);
      }

      // Notify parent of selection change
      if (onSelectionChange) {
        const selected = data.filter(row => newSet.has(getRowId(row)));
        onSelectionChange(selected);
      }

      return newSet;
    });
  };

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(paginatedData.map(row => getRowId(row)));
      setSelectedRowIds(allIds);
      if (onSelectionChange) {
        onSelectionChange(paginatedData);
      }
    } else {
      setSelectedRowIds(new Set());
      if (onSelectionChange) {
        onSelectionChange([]);
      }
    }
  };

  // Check if all rows on current page are selected
  const isAllSelectedOnPage = paginatedData.length > 0 && paginatedData.every(row => {
    return selectedRowIds.has(getRowId(row));
  });

  // Update selected rows when data changes
  useEffect(() => {
    // Clear selection if data changes significantly
    const currentIds = new Set(paginatedData.map(row => getRowId(row)));
    setSelectedRowIds(prev => {
      const filtered = new Set([...prev].filter(id => currentIds.has(id)));
      return filtered;
    });
  }, [data.length, currentPage]);

  return (
    <div className="relative h-full w-full flex flex-col">
      <div
        className="flex-1 overflow-auto min-h-0"
        style={{ height: onPageChange ? 'calc(100% - 60px)' : '100%' }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <md-circular-progress indeterminate style={{ '--md-circular-progress-size': '32px' } as React.CSSProperties} />
            <span className="ml-2 text-muted-foreground">Loading...</span>
          </div>
        ) : data && Array.isArray(data) && data.length > 0 && columns && Array.isArray(columns) && columns.length > 0 ? (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky top-0 z-[3] border-b bg-muted px-2 py-1.5" style={{ width: 44 }}>
                  <Checkbox
                    checked={isAllSelectedOnPage}
                    onCheckedChange={handleSelectAll}
                  />
                </th>
                {columns.map((col) => (
                  <th
                    key={col.id}
                    className="sticky top-0 z-[2] border-b bg-muted px-2 py-1.5 text-left font-medium"
                    style={{ width: col.width, minWidth: col.width }}
                  >
                    {col.sort ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        onClick={() => handleSort(col.id)}
                      >
                        {col.header}
                        {sortState?.id === col.id ? (
                          sortState.dir === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : null}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((row, index) => {
                const rowId = getRowId(row);
                const isSelected = selectedRowIds.has(rowId);
                return (
                  <tr key={`row-${rowId}-${index}`} className={isSelected ? 'bg-muted/60' : 'hover:bg-muted/50'}>
                    <td className="border-b px-2 py-1.5">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => handleRowCheckboxChange(rowId, checked === true)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    {columns.map((col) => (
                      <td key={col.id} className="border-b px-2 py-1.5" style={{ width: col.width }}>
                        {row[col.id] ?? ''}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            No data to display
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {data && Array.isArray(data) && data.length > 0 && onPageChange && (
        <div className="flex items-center justify-between px-4 py-2 border-t bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Showing {startIndex + 1} to {Math.min(endIndex, data.length)} of {data.length} records
            </span>
            {onPageSizeChange && (
              <>
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    onPageSizeChange(Number(value));
                    onPageChange(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">per page</span>
              </>
            )}
          </div>

          {onPageChange && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="h-8"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">Page</span>
                <span className="text-sm font-medium">{currentPage}</span>
                <span className="text-sm text-muted-foreground">of</span>
                <span className="text-sm font-medium">{totalPages}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="h-8"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SvarDataGridWithCheckboxes;
