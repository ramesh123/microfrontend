import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, Search, X } from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import { themeQuartz } from 'ag-grid-community';
import SmartCellRenderer from '@/components/core/cellRenderer';
import { useTheme } from '@/context/theme';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MultiSelectCombobox } from '@/components/ui/multi-select';

interface Column {
  name: string;
  type: string;
  source: 'left' | 'right';
  table: string;
  application: string;
}

interface Connection {
  targetColumnValue: any;
  sourceColumnValue: any;
  id: string;
  sourceColumn: Column;
  targetColumn: Column;
  connectionType: 'drag-drop' | 'manual';
}

interface TableMapping {
  id: string;
  sourceTable: { sourceId: string; tableName: string; sourceName: string };
  targetTable: { sourceId: string; tableName: string; sourceName: string } | null;
  connections: Connection[];
  sourceTableColumns?: { name: string; type: string }[];
  targetTableColumns?: { name: string; type: string }[];
  sourceNodeData?: any[];
  targetNodeData?: any[];
  isSingleRule?: boolean;
}

interface DataGridPreviewProps {
  mapping: TableMapping;
  onClose: () => void;
  onSelectionChange?: (selectedData: {
    sourceRow: any;
    targetRow: any;
    mapping: TableMapping;
  }) => void;
  validationResults?: any; // Validation results from node output
}

export const DataGridPreview: React.FC<DataGridPreviewProps> = ({
  mapping,
  onClose,
  onSelectionChange,
  validationResults
}) => {
  const { theme } = useTheme();
  const agTheme = theme === 'dark' || theme === 'blue-dark-g' ? 'ag-theme-quartz-dark' : 'ag-theme-quartz';

  // Search state for source and target grids
  const [sourceSearchTerm, setSourceSearchTerm] = useState('');
  const [targetSearchTerm, setTargetSearchTerm] = useState('');
  const [validationSearchTerm, setValidationSearchTerm] = useState('');
  
  // Column filter state for multi-select dropdowns (max 1 selection)
  const [selectedSourceColumns, setSelectedSourceColumns] = useState<(string | number)[]>([]);
  const [selectedTargetColumns, setSelectedTargetColumns] = useState<(string | number)[]>([]);
  const [selectedValidationColumns, setSelectedValidationColumns] = useState<(string | number)[]>([]);


  // Check if we have validation results to show
  const { hasValidationResults, validationData, validationColumns, validationStats, ruleKey, availableValidationColumns } = useMemo(() => {
    if (!validationResults || typeof validationResults !== 'object') {
      return { hasValidationResults: false, validationData: [], validationColumns: [], validationStats: null, ruleKey: null, availableValidationColumns: [] };
    }

    const keys = Object.keys(validationResults);
    if (keys.length === 0) {
      return { hasValidationResults: false, validationData: [], validationColumns: [], validationStats: null, ruleKey: null, availableValidationColumns: [] };
    }

    const firstKey = keys[0];
    let data = validationResults[firstKey];

    if (!Array.isArray(data) || data.length === 0) {
      return { hasValidationResults: false, validationData: [], validationColumns: [], validationStats: null, ruleKey: firstKey };
    }

    // Apply search filter if search term exists - filter data values in visible columns
    if (validationSearchTerm.trim()) {
      const searchLower = validationSearchTerm.toLowerCase();
      data = data.filter((row: any) => {
        // Determine which columns to search in
        let columnsToSearch: string[] = [];
        if (selectedValidationColumns.length > 0) {
          // If columns are selected, only search in those columns
          columnsToSearch = selectedValidationColumns.map(String);
        } else {
          // If no columns selected, search in all columns
          columnsToSearch = Object.keys(row);
        }
        
        // Check if any data value in the searchable columns matches
        return columnsToSearch.some((columnName: string) => {
          const value = row[columnName];
          if (value === null || value === undefined) return false;
          return String(value).toLowerCase().includes(searchLower);
        });
      });
    }

    // Get all unique column names from the data
    const allColumns = new Set<string>();
    data.forEach((row: any) => {
      Object.keys(row).forEach(col => allColumns.add(col));
    });

    // Filter columns based on selection - if none selected, show all
    let columnsToShow = Array.from(allColumns);
    if (selectedValidationColumns.length > 0) {
      const selectedNames = selectedValidationColumns.map(String);
      columnsToShow = columnsToShow.filter(col => selectedNames.includes(col));
    }

    // Create column definitions dynamically
    const cols = columnsToShow.map(colName => {
      let width = 150;
      if (colName === 'MATCHED_COLS' || colName === 'UNMATCHED_COLS') {
        width = 200;
      } else if (colName === 'OVERALL_VALIDATION_STATUS') {
        width = 180;
      }

      return {
        field: colName,
        headerName: colName,
        width,
        resizable: true,
        sortable: true,
        filter: true,
        cellRenderer: SmartCellRenderer,
        valueFormatter: (params: any) => {
          if (Array.isArray(params.value)) {
            return params.value.join(', ');
          }
          return params.value;
        },
        cellClass: (params: any) => {
          if (colName === 'OVERALL_VALIDATION_STATUS') {
            if (params.value === 'Passed') return 'bg-green-50 text-green-700 font-medium';
            if (params.value === 'Failed') return 'bg-red-50 text-red-700 font-medium';
          }
          return '';
        }
      };
    });

    // Calculate statistics from original data (before search filter)
    const originalData = validationResults[firstKey];
    const total = Array.isArray(originalData) ? originalData.length : 0;
    const passed = Array.isArray(originalData) ? originalData.filter((row: any) => row.OVERALL_VALIDATION_STATUS === 'Passed').length : 0;
    const failed = total - passed;

    // Get available validation columns for dropdown
    const availableValidationColumns = Array.from(allColumns).map(colName => ({ value: colName, label: colName }));

    return {
      hasValidationResults: true,
      validationData: data,
      validationColumns: cols,
      validationStats: { total, passed, failed, filtered: data.length },
      ruleKey: firstKey,
      availableValidationColumns
    };
  }, [validationResults, validationSearchTerm, selectedValidationColumns]);

  // Initialize selected rows from previously selected data if available
  const [selectedSourceRow, setSelectedSourceRow] = useState<any>(() => {
    // Check if there's existing selected data for this mapping's connections
    const firstConnection = mapping.connections[0];
    if (firstConnection?.sourceColumnValue !== undefined && firstConnection?.sourceColumnValue !== null) {
      // Reconstruct the row data from connection values
      const rowData: any = {};
      mapping.connections.forEach(conn => {
        if (conn.sourceColumnValue !== undefined && conn.sourceColumnValue !== null) {
          rowData[conn.sourceColumn.name] = conn.sourceColumnValue;
        }
      });
      return Object.keys(rowData).length > 0 ? rowData : null;
    }
    return null;
  });

  const [selectedTargetRow, setSelectedTargetRow] = useState<any>(() => {
    // Check if there's existing selected data for this mapping's connections
    const firstConnection = mapping.connections[0];
    if (firstConnection?.targetColumnValue !== undefined && firstConnection?.targetColumnValue !== null) {
      // Reconstruct the row data from connection values
      const rowData: any = {};
      mapping.connections.forEach(conn => {
        if (conn.targetColumnValue !== undefined && conn.targetColumnValue !== null) {
          rowData[conn.targetColumn.name] = conn.targetColumnValue;
        }
      });
      return Object.keys(rowData).length > 0 ? rowData : null;
    }
    return null;
  });
  
  // Refs for AG Grid API
  const sourceGridRef = useRef<AgGridReact>(null);
  const targetGridRef = useRef<AgGridReact>(null);
  const validationGridRef = useRef<AgGridReact>(null);

  // Helper function to notify parent of selection changes
  const notifySelectionChange = (sourceRow: any, targetRow: any) => {
    if (onSelectionChange) {
      console.log('📊 Data Selection Changed:');
      console.log('  ├─ Source Row:', sourceRow);
      console.log('  ├─ Target Row:', targetRow);
      console.log('  └─ Mapping:', mapping.id);

      onSelectionChange({
        sourceRow: sourceRow,
        targetRow: targetRow,
        mapping: mapping
      });
    }
  };

  // Auto-select first row if no selection exists when component mounts
  useEffect(() => {
    // Check if there's already selected data in connections
    const hasExistingSelection = mapping.connections.some(
      (conn: any) => 
        (conn.sourceColumnValue !== undefined && conn.sourceColumnValue !== null) ||
        (conn.targetColumnValue !== undefined && conn.targetColumnValue !== null)
    );

    // If no existing selection and we have data, use first row
    // Only check selectedSourceRow/selectedTargetRow on initial mount (they're initialized from connections)
    if (!hasExistingSelection) {
      // Use mapping data directly
      const firstSourceRow = mapping.sourceNodeData && mapping.sourceNodeData.length > 0 
        ? mapping.sourceNodeData[0] 
        : null;
      const firstTargetRow = mapping.targetNodeData && mapping.targetNodeData.length > 0 
        ? mapping.targetNodeData[0] 
        : null;
      
      if (firstSourceRow || firstTargetRow) {
        console.log('📊 Auto-selecting first row (no previous selection):');
        console.log('  ├─ Source Row:', firstSourceRow);
        console.log('  └─ Target Row:', firstTargetRow);
        
        setSelectedSourceRow(firstSourceRow);
        setSelectedTargetRow(firstTargetRow);
        notifySelectionChange(firstSourceRow, firstTargetRow);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapping.id]); // Run only when mapping changes

  // Log when component mounts with existing selected data
  useEffect(() => {
    if (selectedSourceRow || selectedTargetRow) {
      console.log('✅ Data Grid opened with PRESERVED selection:');
      console.log('  ├─ Source Row:', selectedSourceRow);
      console.log('  └─ Target Row:', selectedTargetRow);
    }
  }, []);

  // Generate mock data for AG Grid
  const generateMockData = (tableName: string, columns: string[]) => {
    return Array.from({ length: 20 }, (_, index) => {
      const row: any = { id: index + 1 };
      columns.forEach(column => {
        if (column.includes('id') || column.includes('ID')) {
          row[column] = index + 1;
        } else if (column.includes('email')) {
          row[column] = `user${index + 1}@example.com`;
        } else if (column.includes('name')) {
          row[column] = `User ${index + 1}`;
        } else if (column.includes('date') || column.includes('time')) {
          row[column] = new Date(2024, 0, index + 1).toISOString().split('T')[0];
        } else if (column.includes('amount') || column.includes('price') || column.includes('cost')) {
          row[column] = (Math.random() * 1000).toFixed(2);
        } else if (column.includes('status') || column.includes('type')) {
          row[column] = ['Active', 'Inactive', 'Pending', 'Completed'][index % 4];
        } else {
          row[column] = `Sample ${column} ${index + 1}`;
        }
      });
      return row;
    });
  };

  // Get column definitions for all table columns
  const getColumnDefs = (tableColumns: { name: string; type: string }[]) => {
    return tableColumns.map(column => ({
      field: column.name,
      headerName: column.name,
      width: 150,
      resizable: true,
      sortable: true,
      filter: true,
      cellRenderer: SmartCellRenderer,
    }));
  };

  // Get available source columns for dropdown
  const availableSourceColumns = useMemo(() => {
    let columns: { name: string; type: string }[] = [];
    if (mapping.sourceTableColumns && mapping.sourceTableColumns.length > 0) {
      columns = mapping.sourceTableColumns;
    } else {
      const uniqueColumns = [...new Set(mapping.connections.map(conn => conn.sourceColumn.name))];
      columns = uniqueColumns.map(name => ({ name, type: 'string' }));
    }
    return columns.map(col => ({ value: col.name, label: col.name }));
  }, [mapping.sourceTableColumns, mapping.connections]);

  // Get source table data and columns - filter by selected columns
  const sourceColumns = useMemo(() => {
    let columns: { name: string; type: string }[] = [];
    if (mapping.sourceTableColumns && mapping.sourceTableColumns.length > 0) {
      columns = mapping.sourceTableColumns;
    } else {
      const uniqueColumns = [...new Set(mapping.connections.map(conn => conn.sourceColumn.name))];
      columns = uniqueColumns.map(name => ({ name, type: 'string' }));
    }
    
    // Filter columns based on selection - if none selected, show all
    if (selectedSourceColumns.length > 0) {
      const selectedNames = selectedSourceColumns.map(String);
      columns = columns.filter(col => selectedNames.includes(col.name));
    }
    
    return getColumnDefs(columns);
  }, [mapping.sourceTableColumns, mapping.connections, selectedSourceColumns]);

  const sourceData = useMemo(() => {
    // Use real data if available, otherwise return empty (no mock data)
    let data: any[] = [];
    if (mapping.sourceNodeData && mapping.sourceNodeData.length > 0) {
      console.log('Using real source data:', mapping.sourceNodeData.slice(0, 2)); // Log first 2 rows
      data = mapping.sourceNodeData;
    } else {
      console.log('No source data available for:', mapping.sourceTable.tableName);
      return []; // Return empty instead of mock data
    }
    
    // Apply search filter if search term exists - filter data values in visible columns
    if (sourceSearchTerm.trim()) {
      const searchLower = sourceSearchTerm.toLowerCase();
      return data.filter((row: any) => {
        // Determine which columns to search in
        let columnsToSearch: string[] = [];
        if (selectedSourceColumns.length > 0) {
          // If columns are selected, only search in those columns
          columnsToSearch = selectedSourceColumns.map(String);
        } else {
          // If no columns selected, search in all columns
          columnsToSearch = Object.keys(row);
        }
        
        // Check if any data value in the searchable columns matches
        return columnsToSearch.some((columnName: string) => {
          const value = row[columnName];
          if (value === null || value === undefined) return false;
          return String(value).toLowerCase().includes(searchLower);
        });
      });
    }
    
    return data;
  }, [mapping.sourceNodeData, mapping.sourceTable.tableName, sourceSearchTerm, selectedSourceColumns]);

  // Get available target columns for dropdown
  const availableTargetColumns = useMemo(() => {
    if (mapping.isSingleRule || !mapping.targetTable) {
      return [];
    }
    let columns: { name: string; type: string }[] = [];
    if (mapping.targetTableColumns && mapping.targetTableColumns.length > 0) {
      columns = mapping.targetTableColumns;
    } else {
      const uniqueColumns = [...new Set(mapping.connections.map(conn => conn.targetColumn.name))];
      columns = uniqueColumns.map(name => ({ name, type: 'string' }));
    }
    return columns.map(col => ({ value: col.name, label: col.name }));
  }, [mapping.targetTableColumns, mapping.connections, mapping.isSingleRule, mapping.targetTable]);

  // Get target table data and columns - filter by selected columns
  const targetColumns = useMemo(() => {
    if (mapping.isSingleRule || !mapping.targetTable) {
      return [];
    }
    let columns: { name: string; type: string }[] = [];
    if (mapping.targetTableColumns && mapping.targetTableColumns.length > 0) {
      columns = mapping.targetTableColumns;
    } else {
      const uniqueColumns = [...new Set(mapping.connections.map(conn => conn.targetColumn.name))];
      columns = uniqueColumns.map(name => ({ name, type: 'string' }));
    }
    
    // Filter columns based on selection - if none selected, show all
    if (selectedTargetColumns.length > 0) {
      const selectedNames = selectedTargetColumns.map(String);
      columns = columns.filter(col => selectedNames.includes(col.name));
    }
    
    return getColumnDefs(columns);
  }, [mapping.targetTableColumns, mapping.connections, mapping.isSingleRule, mapping.targetTable, selectedTargetColumns]);

  const targetData = useMemo(() => {
    // For single-rule connections, don't show target data
    if (mapping.isSingleRule || !mapping.targetTable) {
      return [];
    }
    // Use real data if available, otherwise return empty (no mock data)
    let data: any[] = [];
    if (mapping.targetNodeData && mapping.targetNodeData.length > 0) {
      console.log('Using real target data:', mapping.targetNodeData.slice(0, 2)); // Log first 2 rows
      data = mapping.targetNodeData;
    } else {
      console.log('No target data available for:', mapping.targetTable?.tableName || 'N/A');
      return []; // Return empty instead of mock data
    }
    
    // Apply search filter if search term exists - filter data values in visible columns
    if (targetSearchTerm.trim()) {
      const searchLower = targetSearchTerm.toLowerCase();
      return data.filter((row: any) => {
        // Determine which columns to search in
        let columnsToSearch: string[] = [];
        if (selectedTargetColumns.length > 0) {
          // If columns are selected, only search in those columns
          columnsToSearch = selectedTargetColumns.map(String);
        } else {
          // If no columns selected, search in all columns
          columnsToSearch = Object.keys(row);
        }
        
        // Check if any data value in the searchable columns matches
        return columnsToSearch.some((columnName: string) => {
          const value = row[columnName];
          if (value === null || value === undefined) return false;
          return String(value).toLowerCase().includes(searchLower);
        });
      });
    }
    
    return data;
  }, [mapping.targetNodeData, mapping.targetTable, mapping.isSingleRule, targetSearchTerm, selectedTargetColumns]);

  const getConnectionTypeColor = (type: string) => {
    switch (type) {
      case 'integer':
      case 'bigint':
      case 'smallint':
        return 'bg-blue-100 text-blue-700';
      case 'varchar':
      case 'text':
      case 'char':
        return 'bg-green-100 text-green-700';
      case 'decimal':
      case 'float':
      case 'double':
        return 'bg-yellow-100 text-yellow-700';
      case 'timestamp':
      case 'datetime':
      case 'date':
        return 'bg-purple-100 text-purple-700';
      case 'boolean':
        return 'bg-pink-100 text-pink-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <TooltipProvider>
      <Card className="mt-1 p-0 gap-0">
        <CardHeader className="p-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-sm font-medium text-slate-700">
                  {mapping.sourceTable.tableName}
                </span>
              </div>
              {mapping.targetTable && (
                <>
                  <ArrowRight className="h-5 w-5 text-slate-400" />
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span className="text-sm font-medium text-slate-700">
                      {mapping.targetTable.tableName}
                    </span>
                  </div>
                </>
              )}
              {mapping.isSingleRule && (
                <>
                  <ArrowRight className="h-5 w-5 text-slate-400" />
                  <span className="text-sm font-medium text-slate-500 italic">
                    Single-side rule
                  </span>
                </>
              )}
              <Badge variant="outline" className="text-xs">
                {mapping.connections.length} Connections
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Show Validation Results if available, otherwise show data selection grids */}
          {hasValidationResults ? (
            <>
              {/* Validation Statistics */}
              <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-600">Total Rows:</span>
                  <Badge variant="outline">{validationStats?.total || 0}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-600">Passed:</span>
                  <Badge className="bg-green-100 text-green-700 border-green-200">{validationStats?.passed || 0}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-600">Failed:</span>
                  <Badge className="bg-red-100 text-red-700 border-red-200">{validationStats?.failed || 0}</Badge>
                </div>
                {ruleKey && (
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-xs text-slate-500">Rule: {ruleKey}</span>
                  </div>
                )}
              </div>

              {/* Validation Results Grid */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-slate-700">Validation Results</h4>
                  {validationStats?.filtered !== undefined && validationStats.filtered !== validationStats.total && (
                    <Badge variant="outline" className="text-xs">
                      Showing {validationStats.filtered} of {validationStats.total} rows
                    </Badge>
                  )}
                </div>
                {/* Column Filter and Search Input for Validation Results Grid - Dropdown first, then search */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-64">
                    <MultiSelectCombobox
                      options={availableValidationColumns || []}
                      value={selectedValidationColumns}
                      onChange={setSelectedValidationColumns}
                      placeholder="Filter columns..."
                      searchPlaceholder="Search columns..."
                      emptyText="No columns found."
                      maxDisplay={1}
                    />
                  </div>
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search in validation results..."
                      value={validationSearchTerm}
                      onChange={(e) => setValidationSearchTerm(e.target.value)}
                      className="h-9 pl-8 pr-8 text-sm"
                    />
                    {validationSearchTerm && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-9 px-2 hover:bg-transparent"
                        onClick={() => setValidationSearchTerm('')}
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className={`${agTheme} h-[400px] border border-slate-200 rounded-lg`}>
                  <AgGridReact
                    ref={validationGridRef}
                    rowData={validationData}
                    columnDefs={validationColumns}
                    defaultColDef={{
                      resizable: true,
                      sortable: true,
                      filter: true,
                      cellRenderer: SmartCellRenderer,
                    }}
                    pagination={true}
                    paginationPageSize={10}
                    paginationPageSizeSelector={[10, 25, 50, 100]}
                    suppressHorizontalScroll={false}
                    enableCellTextSelection={true}
                  />
                </div>
              </div>
            </>
          ) : (
            /* Side-by-Side AG Grids for Data Selection */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-slate-700">Data Preview</h4>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span>Select rows to filter</span>
                  </div>
                </div>
              </div>
              <div className={`grid gap-4 ${mapping.isSingleRule ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-2'}`}>
                {/* Source Data Grid */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <h5 className="text-sm font-medium text-slate-700">{mapping.sourceTable.tableName}</h5>
                    {selectedSourceRow && (
                      <Badge variant="default" className="text-xs bg-blue-100 text-blue-700">
                        Row Selected
                      </Badge>
                    )}
                    {/* Column Filter and Search Input for Source Grid - Dropdown first, then search */}
                    <div className="flex items-center gap-2">
                      <div className="w-64">
                        <MultiSelectCombobox
                          options={availableSourceColumns}
                          value={selectedSourceColumns}
                          onChange={setSelectedSourceColumns}
                          placeholder="Filter columns..."
                          searchPlaceholder="Search columns..."
                          emptyText="No columns found."
                          maxDisplay={1}
                        />
                      </div>
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search..."
                          value={sourceSearchTerm}
                          onChange={(e) => setSourceSearchTerm(e.target.value)}
                          className="h-9 pl-8 pr-8 text-sm w-48"
                        />
                        {sourceSearchTerm && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-9 px-2 hover:bg-transparent"
                            onClick={() => setSourceSearchTerm('')}
                          >
                            <X className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={`${agTheme} h-[300px] border border-slate-200 rounded-lg`}>
                    <AgGridReact
                      ref={sourceGridRef}
                      rowData={sourceData}
                      columnDefs={sourceColumns}
                      defaultColDef={{
                        resizable: true,
                        sortable: true,
                        filter: true,
                        cellRenderer: SmartCellRenderer,
                      }}
                      pagination={true}
                      paginationPageSize={8}
                      paginationPageSizeSelector={[8, 15, 25]}
                      suppressHorizontalScroll={false}
                      rowSelection="single"
                      onRowClicked={(event) => {
                        setSelectedSourceRow(event.data);
                        notifySelectionChange(event.data, selectedTargetRow);
                      }}
                      rowClassRules={{
                        'ag-row-selected': (params) => params.data === selectedSourceRow,
                      }}
                    />
                  </div>
                </div>

                {/* Target Data Grid - Only show if not single-rule */}
                {!mapping.isSingleRule && mapping.targetTable && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <h5 className="text-sm font-medium text-slate-700">{mapping.targetTable.tableName}</h5>
                    {selectedTargetRow && (
                      <Badge variant="default" className="text-xs bg-blue-100 text-blue-700">
                        Row Selected
                      </Badge>
                    )}
                    {/* Column Filter and Search Input for Target Grid - Dropdown first, then search */}
                    <div className="flex items-center gap-2">
                      <div className="w-64">
                        <MultiSelectCombobox
                          options={availableTargetColumns}
                          value={selectedTargetColumns}
                          onChange={setSelectedTargetColumns}
                          placeholder="Filter columns..."
                          searchPlaceholder="Search columns..."
                          emptyText="No columns found."
                          maxDisplay={1}
                        />
                      </div>
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search..."
                          value={targetSearchTerm}
                          onChange={(e) => setTargetSearchTerm(e.target.value)}
                          className="h-9 pl-8 pr-8 text-sm w-48"
                        />
                        {targetSearchTerm && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-9 px-2 hover:bg-transparent"
                            onClick={() => setTargetSearchTerm('')}
                          >
                            <X className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={`${agTheme} h-[300px] border border-slate-200 rounded-lg`}>
                    <AgGridReact
                      ref={targetGridRef}
                      rowData={targetData}
                      columnDefs={targetColumns}
                      defaultColDef={{
                        resizable: true,
                        sortable: true,
                        filter: true,
                        cellRenderer: SmartCellRenderer,
                      }}
                      pagination={true}
                      paginationPageSize={8}
                      paginationPageSizeSelector={[8, 15, 25]}
                      suppressHorizontalScroll={false}
                      rowSelection="single"
                      onRowClicked={(event) => {
                        setSelectedTargetRow(event.data);
                        notifySelectionChange(selectedSourceRow, event.data);
                      }}
                      rowClassRules={{
                        'ag-row-selected': (params) => params.data === selectedTargetRow,
                      }}
                    />
                  </div>
                </div>
                )}
              </div>

            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};
