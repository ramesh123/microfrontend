import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Database, ChevronDown, ChevronRight, Settings, Server, Table, Zap, CheckCircle2, XCircle, Filter } from 'lucide-react';
import { DataSource } from './types/mapping';
import { AddSourceDialog } from './AddSourceDialog';

interface DataSourcePanelProps {
  title: string;
  dataSources: DataSource[];
  onDataSourceUpdate: (sourceId: string, updatedSource: DataSource) => void;
  onAddSource?: (source: Omit<DataSource, 'id'>) => void;
  onColumnSelected?: (selectedColumns: { application: string; table: string; column: string; type: string }[]) => void;
  panelSide?: 'left' | 'right';
}

export const DataSourcePanel: React.FC<DataSourcePanelProps> = ({
  title,
  dataSources,
  onDataSourceUpdate,
  onAddSource,
  onColumnSelected,
  panelSide = 'left'
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSources, setExpandedSources] = useState<string[]>([]);
  const [expandedTables, setExpandedTables] = useState<string[]>([]);
  const [showOnlySelected, setShowOnlySelected] = useState(false);

  const toggleSourceExpansion = (sourceId: string) => {
    setExpandedSources(prev => 
      prev.includes(sourceId) 
        ? prev.filter(id => id !== sourceId)
        : [...prev, sourceId]
    );
  };

  const toggleTableExpansion = (tableKey: string) => {
    setExpandedTables(prev => 
      prev.includes(tableKey) 
        ? prev.filter(key => key !== tableKey)
        : [...prev, tableKey]
    );
  };

  const handleTableSelection = (sourceId: string, tableName: string, selected: boolean) => {
    const source = dataSources.find(ds => ds.id === sourceId);
    if (!source) return;

    const updatedTables = source.tables.map(table => {
      if (table.name === tableName) {
        // If selecting table, select all columns; if deselecting, deselect all columns
        const updatedColumns = table.columns.map(column => ({
          ...column,
          selected: selected
        }));
        return { ...table, selected, columns: updatedColumns };
      }
      return table;
    });

    onDataSourceUpdate(sourceId, { ...source, tables: updatedTables });
  };

  const handleColumnSelection = (sourceId: string, tableName: string, columnName: string, selected: boolean) => {
    const source = dataSources.find(ds => ds.id === sourceId);
    if (!source) return;

    // If selecting a column, first deselect all other columns in the same table
    if (selected) {
      const updatedTables = source.tables.map(table => {
        if (table.name === tableName) {
          // Deselect all columns in this table first
          const updatedColumns = table.columns.map(column => ({ ...column, selected: false }));
          return { ...table, columns: updatedColumns, selected: false };
        }
        return table;
      });
      
      // Update the source with deselected columns
      onDataSourceUpdate(sourceId, { ...source, tables: updatedTables });
    }

    // Then select the clicked column
    const updatedTables = source.tables.map(table => {
      if (table.name === tableName) {
        const updatedColumns = table.columns.map(column =>
          column.name === columnName ? { ...column, selected } : column
        );
        
        return { 
          ...table, 
          columns: updatedColumns,
          selected: selected
        };
      }
      return table;
    });

    onDataSourceUpdate(sourceId, { ...source, tables: updatedTables });

    // Notify parent component about selected columns
    if (onColumnSelected) {
      const selectedColumns = dataSources.flatMap(ds => 
        ds.tables.flatMap(table => 
          table.columns
            .filter(col => col.selected)
            .map(col => ({
              application: ds.name,
              table: table.name,
              column: col.name,
              type: col.type
            }))
        )
      );
      onColumnSelected(selectedColumns);
    }
  };

  const handleConnectSource = (sourceId: string) => {
    const source = dataSources.find(ds => ds.id === sourceId);
    if (!source) return;

    // Toggle connection status
    onDataSourceUpdate(sourceId, { ...source, connected: !source.connected });
  };

  const filteredSources = dataSources.filter(source => {
    // First apply search filter
    const matchesSearch = source.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      source.tables.some(table => 
        table.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    
    // If search doesn't match, exclude
    if (!matchesSearch) return false;
    
    // If filter is active, only show sources with selected columns
    if (showOnlySelected) {
      return source.tables.some(table => 
        table.columns.some(column => column.selected)
      );
    }
    
    // If filter is not active, show all sources that match search
    return true;
  });

  const getSelectedCount = (source: DataSource) => {
    const selectedTables = source.tables.filter(table => table.selected).length;
    const selectedColumns = source.tables.reduce((count, table) => 
      count + table.columns.filter(col => col.selected).length, 0
    );
    return { tables: selectedTables, columns: selectedColumns };
  };

  return (
    <Card className="h-full border-1 shadow-sm bg-white p-0 gap-0">
      <CardHeader className="border-b [.border-b]:pb-1 p-2 pb-0">
        <div className="flex items-center justify-between mb-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md ">
              <Server className="h-4 w-4 " />
            </div>
            <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-200 p-0">
              {title}
              {/* {showOnlySelected && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  <Filter className="h-3 w-3 mr-1" />
                  Filtered
                </Badge>
              )} */}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
            
              size="sm"
              onClick={() => setShowOnlySelected(!showOnlySelected)}
              className={`h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors ${
                showOnlySelected 
                  ? '!h-8 !w-8' 
                  : 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-70 !h-8 !w-8'
              }`}
              title={showOnlySelected ? 'Show all applications' : 'Show only applications with selected columns'}
            >
              <Filter className={`h-4 w-4 ${showOnlySelected ? 'fill-current' : ''}`} />
            </Button>
            {onAddSource && (
              <AddSourceDialog onAddSource={onAddSource} />
            )}
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-slate-400 h-3.5 w-3.5" />
          <Input
            placeholder="Search applications..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-8 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md focus:ring-1 focus:ring-slate-500/20 text-sm"
          />
        </div>
      </CardHeader>
      
      <CardContent className="p-2 space-y-2 max-h-[calc(100vh-10rem)] overflow-y-auto custom-scrollbar">
        {filteredSources.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 mb-2">
              <Database className="h-6 w-6 text-slate-400" />
            </div>
            <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">No applications found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-500">
              {searchTerm ? 'Try adjusting your search terms' : 'Add your first application to get started'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredSources.map((source) => {
              const selectedCount = getSelectedCount(source);
              const isExpanded = expandedSources.includes(source.id);
              
              return (
                <div 
                  key={source.id} 
                  className={`rounded-lg shadow-sm border-2 transition-all duration-200 cursor-pointer hover:shadow-md ${
                    isExpanded 
                      ? 'shadow-md' 
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  }`}
                  onClick={() => toggleSourceExpansion(source.id)}
                >
                  {/* Compact Application Header */}
                  <div className="p-3">
                    <div className="flex items-center justify-between">
                      {/* Left Side - Logo and Name */}
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center">
                          <img 
                            src="/src/assets/images/s4hana-icon.svg" 
                            alt="SAP HANA" 
                            className="h-5 w-5" 
                          />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                            {source.name}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {source.type.toUpperCase()} • {source.tables.length} tables
                          </p>
                        </div>
                      </div>

                      {/* Right Side - Status and Actions */}
                      <div className="flex items-center gap-2">
                        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          source.connected 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                        }`}>
                          {source.connected ? (
                            <><CheckCircle2 className="h-3 w-3 mr-1" />Connected</>
                          ) : (
                            <><XCircle className="h-3 w-3 mr-1" />Disconnected</>
                          )}
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConnectSource(source.id);
                          }}
                          className="h-6 w-6 p-0 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full"
                        >
                          <Settings className="h-3 w-3 text-slate-500 dark:text-slate-400" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Tables Section */}
                  {isExpanded && (
                    <div className="border-t">
                      <div className="p-3 space-y-2">
                        {source.tables.map((table) => {
                          const tableKey = `${source.id}-${table.name}`;
                          const selectedColumnsCount = table.columns.filter(col => col.selected).length;
                          const isTableExpanded = expandedTables.includes(tableKey);
                          
                          return (
                            <div key={table.name} className="rounded-md border">
                              <div className="flex items-center justify-between p-2 border-b border-slate-200/50 dark:border-slate-600/50">
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    checked={table.selected}
                                    onCheckedChange={(checked) => {
                                      handleTableSelection(source.id, table.name, checked as boolean);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="data-[state=checked]:data-[state=checked]:h-3.5 w-3.5"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleTableExpansion(tableKey);
                                    }}
                                    className="h-5 w-5 p-0 hover:rounded-sm transition-colors duration-200"
                                  >
                                    {isTableExpanded ? (
                                      <ChevronDown className="h-3 w-3 text-slate-600 dark:text-slate-400" />
                                    ) : (
                                      <ChevronRight className="h-3 w-3 text-slate-600 dark:text-slate-400" />
                                    )}
                                  </Button>
                                  <div className="flex items-center gap-1.5">
                                    <Table className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                      {table.name}
                                    </span>
                                  </div>
                                </div>
                                {selectedColumnsCount > 0 && (
                                  <Badge variant="secondary" className="h-5 text-xs px-1.5 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400">
                                    {selectedColumnsCount}
                                  </Badge>
                                )}
                              </div>

                              {/* Columns */}
                              {isTableExpanded && (
                                <div className="p-1">
                                  <div className="space-y-1">
                                    {(showOnlySelected ? table.columns.filter(col => col.selected) : table.columns).map((column) => (
                                      <div 
                                        key={column.name} 
                                        className={`border rounded-lg transition-all duration-200 cursor-pointer ${
                                          column.selected 
                                            ? 'shadow-md border-blue-300 bg-blue-50/30 dark:bg-blue-900/20' 
                                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-white hover:border-blue-200 dark:hover:border-blue-600'
                                        }`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleColumnSelection(source.id, table.name, column.name, !column.selected);
                                        }}
                                        draggable
                                        onDragStart={(e) => {
                                          e.dataTransfer.setData('application/json', JSON.stringify({
                                            name: column.name,
                                            type: column.type,
                                            source: panelSide,
                                            table: table.name,
                                            application: source.name
                                          }));
                                        }}
                                      >
                                        <div className="flex items-center p-3 h-10">
                                          <div className="flex items-center gap-3 flex-1">
                                            <Checkbox
                                              checked={column.selected}
                                              onCheckedChange={(checked) =>
                                                handleColumnSelection(source.id, table.name, column.name, checked as boolean)
                                              }
                                              onClick={(e) => e.stopPropagation()}
                                              className="data-[state=checked]: data-[state=checked]: h-4 w-4"
                                            />
                                            <div className="flex items-center justify-between flex-1">
                                              <span className={`text-sm font-medium ${
                                                column.selected 
                                                  ? 'text-slate-900 dark:text-slate-900' 
                                                  : 'text-slate-900 dark:text-slate-900'
                                              }`}>
                                                {column.name}
                                              </span>
                                              <span className="text-xs text-slate-500 dark:text-slate-500 bg-slate-100 dark:bg-slate-200 px-2 py-1 rounded font-mono">
                                                {column.type}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                    
                                    {/* Show message when filter is active but no columns are selected */}
                                    {showOnlySelected && table.columns.filter(col => col.selected).length === 0 && (
                                      <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">
                                        <Filter className="h-4 w-4 mx-auto mb-2 opacity-50" />
                                        No selected columns in this table
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
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
        
        .horizontal-scroll::-webkit-scrollbar {
          height: 6px;
        }
        .horizontal-scroll::-webkit-scrollbar-track {
          background: rgba(148, 163, 184, 0.1);
          border-radius: 3px;
        }
        .horizontal-scroll::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.4);
          border-radius: 3px;
        }
        .horizontal-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.6);
        }
      `}</style>
    </Card>
  );
};
