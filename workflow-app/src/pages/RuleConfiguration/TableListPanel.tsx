import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, Server, Ban, Table, ChevronDown, ChevronRight } from 'lucide-react';
import { DataSource } from './types/mapping';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface TableListPanelProps {
  title: string;
  dataSources: DataSource[];
  onDataSourceUpdate: (sourceId: string, updatedSource: DataSource) => void;
  onAddSource?: (source: Omit<DataSource, 'id'>) => void;
  onColumnSelected?: (selectedColumns: { application: string; table: string; column: string; type: string }[]) => void;
  panelSide?: 'left' | 'right';
  restrictedTables?: Set<string>;
}

export const TableListPanel: React.FC<TableListPanelProps> = ({
  title,
  dataSources,
  onDataSourceUpdate,
  onAddSource,
  onColumnSelected,
  panelSide = 'left',
  restrictedTables = new Set()
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTables, setExpandedTables] = useState<string[]>([]);
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  const [tableSearchTerms, setTableSearchTerms] = useState<Record<string, string>>({});

  // Check if a table is restricted (used in the opposite panel)
  const isTableRestricted = (sourceName: string, tableName: string) => {
    const tableKey = `${sourceName}.${tableName}`;
    const isRestricted = restrictedTables.has(tableKey);
    
    // Debug logging
    if (isRestricted) {
      console.log(`🚫 Table ${tableKey} is restricted in ${panelSide} panel. Restricted tables:`, Array.from(restrictedTables));
    }
    
    return isRestricted;
  };

  // Get all tables from all data sources
  const allTables = dataSources.flatMap(source =>
    source.tables.map(table => ({
      ...table,
      sourceId: source.id,
      sourceName: source.name,
      sourceType: source.type,
      connected: source.connected
    }))
  );

  const toggleTableExpansion = (tableKey: string) => {
    setExpandedTables(prev =>
      prev.includes(tableKey)
        ? prev.filter(key => key !== tableKey)
        : [...prev, tableKey]
    );
  };

  const handleColumnSelection = (sourceId: string, tableName: string, columnName: string, selected: boolean) => {
    const source = dataSources.find(ds => ds.id === sourceId);
    if (!source) return;

    const updatedSource = {
      ...source,
      tables: source.tables.map(table => {
        if (table.name === tableName) {
          const updatedColumns = table.columns.map(column => {
            if (column.name === columnName) {
              return { ...column, selected };
            }
            return column;
          });

          return {
            ...table,
            columns: updatedColumns,
            selected: updatedColumns.some(col => col.selected)
          };
        }
        return table;
      })
    };

    onDataSourceUpdate(sourceId, updatedSource);

    // Notify parent about selected columns
    if (onColumnSelected) {
      const selectedColumns = updatedSource.tables.flatMap(table =>
        table.columns
          .filter(col => col.selected)
          .map(col => ({
            application: source.name,
            table: table.name,
            column: col.name,
            type: col.type
          }))
      );
      onColumnSelected(selectedColumns);
    }
  };


  const getConnectionTypeColor = (type: string) => {
    switch (type) {
      case 'integer':
      case 'bigint':
      case 'smallint':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'varchar':
      case 'text':
      case 'char':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'decimal':
      case 'float':
      case 'double':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'timestamp':
      case 'datetime':
      case 'date':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'boolean':
        return 'bg-pink-100 text-pink-700 border-pink-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  // Filter tables based on search term
  const filteredTables = allTables.filter(table =>
    table.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    table.sourceName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card className="h-full p-0 gap-0">
      <CardHeader className="pb-3 p-2">
        {title && (
          <div className="flex items-center justify-between mb-2">
            <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Server className="h-4 w-4" />
              {title}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setShowOnlySelected(!showOnlySelected)}
                className={`!w-8 !h-8 p-0 rounded-lg ${
                  showOnlySelected && dataSources.some(source =>
                    source.tables.some(table => table.columns.some(col => col.selected))
                  )
                    ? ''
                    : 'bg-white hover:bg-gray-50 border-gray-300'
                }`}
              >
                <Filter className={`h-4 w-4 ${
                  showOnlySelected && dataSources.some(source =>
                    source.tables.some(table => table.columns.some(col => col.selected))
                  )
                    ? 'text-white'
                    : 'text-gray-500'
                }`} />
              </Button>
            </div>
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
          <Input
            placeholder="Search tables..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-8 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md focus:ring-1 focus:ring-slate-500/20 text-sm"
          />
        </div>
      </CardHeader>

      <CardContent className="p-2 space-y-2 max-h-[calc(100vh-10rem)] overflow-y-auto custom-scrollbar">
        {filteredTables.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 mb-2">
              <Table className="h-6 w-6 text-slate-400" />
            </div>
            <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">No tables found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-500">
              {searchTerm ? 'Try adjusting your search terms' : 'No tables available'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTables.map((table) => {
              const tableKey = `${table.sourceId}-${table.name}`;
              const isTableExpanded = expandedTables.includes(tableKey);

              return (
                <div key={tableKey} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
                  <div className="p-2">
                    <div className="flex items-center justify-between gap-2">
                      <div
                        className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors rounded p-1 -m-1 flex-1"
                        onClick={() => toggleTableExpansion(tableKey)}
                      >
                        {isTableExpanded ? (
                          <ChevronDown className="h-4 w-4 text-slate-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-slate-500" />
                        )}

                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {table.sourceName}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Search columns..."
                          value={tableSearchTerms[tableKey] || ''}
                          onChange={(e) => setTableSearchTerms(prev => ({ ...prev, [tableKey]: e.target.value }))}
                          className="w-32 h-6 text-xs px-2"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                  </div>

                  {isTableExpanded && ( 
                    <div className="border-t border-slate-200 dark:border-slate-700">
                      <div className="p-2">
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {table.columns
                            .filter(column => {
                              const matchesSelectedFilter = showOnlySelected ? column.selected : true;
                              const searchTerm = tableSearchTerms[tableKey] || '';
                              const matchesSearch = !searchTerm || column.name.toLowerCase().includes(searchTerm.toLowerCase());
                              return matchesSelectedFilter && matchesSearch;
                            })
                            .map((column) => (
                          <div
                            key={column.name}
                            className={`rounded-md border transition-all duration-200 ${
                              isTableRestricted(table.sourceName, table.name)
                                ? 'border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 cursor-not-allowed opacity-50'
                                : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 cursor-pointer hover:shadow-sm'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isTableRestricted(table.sourceName, table.name)) {
                                handleColumnSelection(table.sourceId, table.name, column.name, !column.selected);
                              }
                            }}
                            draggable={!isTableRestricted(table.sourceName, table.name)}
                            onDragStart={(e) => {
                              if (isTableRestricted(table.sourceName, table.name)) {
                                e.preventDefault();
                                return;
                              }
                              const dragData = {
                                name: column.name,
                                type: column.type,
                                source: panelSide,
                                table: table.name,
                                application: table.sourceName
                              };
                              e.dataTransfer.setData('application/json', JSON.stringify(dragData));
                              e.dataTransfer.effectAllowed = 'move';
                              console.log('🚀 Drag started:', dragData);
                            }}
                          >
                            {isTableRestricted(table.sourceName, table.name) ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center p-2 h-8 w-full">
                                      <div className="flex items-center gap-2 flex-1">
                                        <Checkbox
                                          checked={column.selected}
                                          disabled={true}
                                          className="h-4 w-4"
                                        />
                                        <div className="flex items-center justify-between flex-1">
                                          <span className="text-sm font-medium text-slate-400 dark:text-slate-500">
                                            {column.name}
                                          </span>
                                          <div className="flex items-center gap-2">
                                            <Ban className="h-3 w-3 text-slate-400" />
                                            <Badge 
                                              variant="secondary" 
                                              className="text-xs bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                                            >
                                              {column.type}
                                            </Badge>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>This table is currently being used in the drop zones</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <div className="flex items-center p-2 h-8">
                                <div className="flex items-center gap-2 flex-1">
                                  <Checkbox
                                    checked={column.selected}
                                    disabled={isTableRestricted(table.sourceName, table.name)}
                                    onCheckedChange={(checked) => {
                                      if (!isTableRestricted(table.sourceName, table.name)) {
                                        handleColumnSelection(table.sourceId, table.name, column.name, checked as boolean);
                                      }
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="h-4 w-4"
                                  />
                                  <div className="flex items-center justify-between flex-1">
                                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                      {table.name}.{column.name}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <Badge
                                        variant="secondary"
                                        className={`text-xs ${getConnectionTypeColor(column.type)}`}
                                      >
                                        {column.type}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        
                        
                        {/* Show message when filter is active but no columns match */}
                        {table.columns.filter(column => {
                          const matchesSelectedFilter = showOnlySelected ? column.selected : true;
                          const searchTerm = tableSearchTerms[tableKey] || '';
                          const matchesSearch = !searchTerm || column.name.toLowerCase().includes(searchTerm.toLowerCase());
                          return matchesSelectedFilter && matchesSearch;
                        }).length === 0 && (showOnlySelected || tableSearchTerms[tableKey]) && (
                          <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">
                            <Filter className="h-4 w-4 mx-auto mb-2 opacity-50" />
                            {tableSearchTerms[tableKey] 
                              ? 'No columns match your search' 
                              : showOnlySelected 
                                ? 'No selected columns in this table' 
                                : 'No columns in this table'
                            }
                          </div>
                        )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { 
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.5);
        }
      `}</style>
    </Card>
  );
};
