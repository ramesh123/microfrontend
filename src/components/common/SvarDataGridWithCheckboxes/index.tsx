import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Grid, Willow } from '@svar-ui/react-grid';
import '@svar-ui/react-grid/all.css';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const checkboxContainerRef = useRef<HTMLDivElement>(null);
  const [rowHeights, setRowHeights] = useState<number[]>([]);

  // Calculate pagination
  const totalPages = Math.ceil(data.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedData = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return [];
    }
    const sliced = data.slice(startIndex, endIndex);
    // Remove any internal fields that shouldn't be displayed
    return sliced.map(row => {
      const { __checkbox__, ...rowWithoutCheckbox } = row;
      return rowWithoutCheckbox;
    });
  }, [data, startIndex, endIndex]);

  // Get row ID helper
  const getRowId = (row: any): string => {
    return String(row.SYSTEM_REF_ID || row.system_ref_id || row.id || row.PK || row._rowId || '');
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

  // Measure row heights after render - ensure we capture all rows including last one
  useEffect(() => {
    if (gridContainerRef.current) {
      // Use a small delay to ensure DOM is fully rendered
      const timeoutId = setTimeout(() => {
        // Try multiple selectors to find grid rows
        const rows = gridContainerRef.current?.querySelectorAll(
          '.svar-grid tbody tr, .svar-grid tbody > div, [class*="svar-grid-row"], table tbody tr, tbody tr'
        );
        const heights: number[] = [];
        if (rows && rows.length > 0) {
          rows.forEach((row) => {
            const height = (row as HTMLElement).offsetHeight || (row as HTMLElement).clientHeight || 35;
            heights.push(height);
          });
        }
        // If no rows found, use default height for all
        if (heights.length === 0 && paginatedData.length > 0) {
          const defaultHeight = 35;
          for (let i = 0; i < paginatedData.length; i++) {
            heights.push(defaultHeight);
          }
        }
        // Ensure we have heights for all rows in paginatedData
        if (paginatedData && paginatedData.length > heights.length) {
          const defaultHeight = heights.length > 0 ? heights[0] : 35;
          while (heights.length < paginatedData.length) {
            heights.push(defaultHeight);
          }
        }
        setRowHeights(heights);
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [paginatedData]);

  // No scroll sync needed - checkboxes are inside the scrollable container and will scroll naturally

  return (
    <div className="relative h-full w-full">
      <style>{`
        .svar-grid-container {
          flex: 1;
          overflow-y: auto;
          overflow-x: auto;
          min-height: 0;
          position: relative;
          height: 100%;
        }
        .svar-grid {
          border: 1px solid #d1d5db !important;
          width: 100%;
        }
        .svar-grid-cell,
        .svar-grid-header-cell {
          border: 1px solid #d1d5db !important;
          border-right: 1px solid #d1d5db !important;
          border-bottom: 1px solid #d1d5db !important;
        }
        /* Make ALL headers sticky and non-scrollable - comprehensive targeting */
        .svar-grid-container table,
        .svar-grid-container table thead,
        .svar-grid thead,
        table thead {
          position: relative !important;
        }
        .svar-grid-container table thead,
        .svar-grid thead,
        table thead {
          position: sticky !important;
          top: 0 !important;
          z-index: 100 !important;
          background-color: #f9fafb !important;
        }
        .svar-grid-container table thead tr,
        .svar-grid thead tr,
        table thead tr {
          position: sticky !important;
          top: 0 !important;
          z-index: 100 !important;
          background-color: #f9fafb !important;
        }
        .svar-grid-container table thead th,
        .svar-grid-container table thead td,
        .svar-grid thead th,
        .svar-grid thead td,
        table thead th,
        table thead td {
          position: sticky !important;
          top: 0 !important;
          z-index: 100 !important;
          background-color: #f9fafb !important;
        }
        .svar-grid-header-cell {
          background-color: #f9fafb !important;
          font-weight: 600 !important;
          position: sticky !important;
          top: 0 !important;
          z-index: 100 !important;
        }
        /* Target any header element within the grid - make all sticky */
        [class*="svar-grid"] thead,
        [class*="svar-grid"] thead tr,
        [class*="svar-grid"] thead th,
        [class*="svar-grid"] thead td {
          position: sticky !important;
          top: 0 !important;
          z-index: 100 !important;
          background-color: #f9fafb !important;
        }
        /* Ensure first column is not cut off */
        .svar-grid tbody tr td:first-child,
        .svar-grid thead tr th:first-child,
        table tbody tr td:first-child,
        table thead tr th:first-child {
          padding-left: 4px !important;
        }
        .svar-grid-row {
          position: relative;
        }
        /* Ensure checkbox overlay is visible */
        .checkbox-overlay {
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
        /* Ensure checkbox header stays on top */
        .checkbox-header-sticky {
          position: sticky !important;
          top: 0 !important;
          z-index: 103 !important;
        }
      `}</style>
      
      <div className="svar-grid-container" ref={gridContainerRef} style={{ height: onPageChange ? 'calc(100% - 60px)' : '100%' }}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <span className="ml-2 text-muted-foreground">Loading...</span>
          </div>
        ) : data && Array.isArray(data) && data.length > 0 && columns && Array.isArray(columns) && columns.length > 0 ? (
          <div className="relative h-full w-full" style={{ paddingLeft: '50px', height: '100%', overflow: 'auto' }}>
            <Willow>
              <Grid
                data={paginatedData || []}
                columns={columns}
                reorder={true}
              />
            </Willow>
            
            {/* Checkbox overlays - positioned absolutely, scrolls with grid */}
            <div 
              ref={checkboxContainerRef}
              className="absolute top-0 left-0 w-[50px] z-[102]" 
              style={{ 
                height: '100%',
                overflow: 'visible',
                pointerEvents: 'none'
              }}
            >
              {/* Header checkbox - sticky and non-scrollable like other headers */}
              <div 
                className="h-[40px] flex items-center justify-center pointer-events-auto bg-gray-50 dark:bg-gray-800 border-r-2 border-gray-300 checkbox-overlay" 
                style={{ 
                  position: 'sticky', 
                  top: 0, 
                  zIndex: 103,
                  height: '40px',
                  width: '50px',
                  flexShrink: 0,
                  display: 'flex',
                  visibility: 'visible',
                  opacity: 1
                }}
              >
                <Checkbox
                  checked={isAllSelectedOnPage}
                  onCheckedChange={handleSelectAll}
                  className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                />
              </div>
              
              {/* Row checkboxes - positioned to match grid rows, scrolls with grid */}
              {paginatedData && Array.isArray(paginatedData) && paginatedData.map((row, index) => {
                const rowId = getRowId(row);
                const isSelected = selectedRowIds.has(rowId);
                const rowHeight = rowHeights[index] || 35;
                // Calculate top position: header (40px) + sum of previous row heights
                const topPosition = 40 + paginatedData.slice(0, index).reduce((sum, _, i) => sum + (rowHeights[i] || 35), 0);
                
                return (
                  <div
                    key={`checkbox-${rowId}-${index}`}
                    className="absolute flex items-center justify-center pointer-events-auto bg-white dark:bg-gray-900 border-r-2 border-gray-300 checkbox-overlay"
                    style={{ 
                      top: `${topPosition}px`,
                      height: `${rowHeight}px`,
                      minHeight: `${rowHeight}px`,
                      width: '50px',
                      left: 0,
                      zIndex: 102,
                      display: 'flex',
                      visibility: 'visible',
                      opacity: 1
                    }}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => handleRowCheckboxChange(rowId, checked === true)}
                      className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                );
              })}
            </div>
          </div>
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

