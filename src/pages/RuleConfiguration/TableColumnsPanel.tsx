import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Database, CheckCircle } from 'lucide-react';

interface Column {
  name: string;
  type: string;
  selected: boolean;
}

interface TableColumnsPanelProps {
  title: string;
  tableName: string | null;
  columns: Column[];
  availableTables: string[];
  onTableSelect: (tableName: string) => void;
  onColumnSelect: (columnName: string, selected: boolean) => void;
  onColumnDrag: (column: { name: string; type: string; table: string }) => void;
}

export const TableColumnsPanel: React.FC<TableColumnsPanelProps> = ({
  title,
  tableName,
  columns,
  availableTables,
  onTableSelect,
  onColumnSelect,
  onColumnDrag
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredColumns = columns.filter(column =>
    column.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-200">
          {title}
        </CardTitle>
        {tableName && (
          <Badge variant="outline" className="w-fit text-xs">
            {tableName}
          </Badge>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Table Selection */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-700">Select Table</h4>
          <div className="flex flex-wrap gap-2">
            {availableTables.map((table) => {
              const isSelected = tableName === table;
              return (
                <Button
                  key={table}
                  variant="outline"
                  size="sm"
                  onClick={() => onTableSelect(table)}
                  className={`h-7 px-3 rounded-md text-xs ${
                    isSelected
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-gray-50 border-gray-200 text-gray-700'
                  }`}
                >
                  {table}
                  {isSelected && <CheckCircle className="h-3 w-3 ml-1" />}
                </Button>
              );
            })}
          </div>
        </div>

        {tableName ? (
          <>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                placeholder="Search columns..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md focus:ring-1 focus:ring-slate-500/20 text-sm"
              />
            </div>

            {/* Columns List */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredColumns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Database className="h-8 w-8 text-slate-400 mb-2" />
                  <p className="text-sm text-slate-500">
                    {searchTerm ? 'No columns found' : 'No columns available'}
                  </p>
                </div>
              ) : (
                filteredColumns.map((column) => (
                  <div
                    key={column.name}
                    className={`p-3 border rounded-lg cursor-pointer transition-all duration-200 ${
                      column.selected
                        ? 'border-blue-300 bg-blue-50/30 shadow-md'
                        : 'border-gray-200 hover:border-blue-200 bg-white hover:shadow-sm'
                    }`}
                    onClick={() => onColumnSelect(column.name, !column.selected)}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/json', JSON.stringify({
                        name: column.name,
                        type: column.type,
                        table: tableName
                      }));
                      onColumnDrag({
                        name: column.name,
                        type: column.type,
                        table: tableName
                      });
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          column.selected ? 'bg-blue-500' : 'bg-gray-300'
                        }`}></div>
                        <span className="text-sm font-medium text-slate-800">
                          {column.name}
                        </span>
                      </div>
                      <Badge 
                        variant="secondary" 
                        className={`text-xs ${getConnectionTypeColor(column.type)}`}
                      >
                        {column.type}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Database className="h-12 w-12 text-slate-400 mb-4" />
            <h3 className="text-lg font-medium text-slate-600 mb-2">No table selected</h3>
            <p className="text-sm text-slate-500">
              Select a table from the options above to view its columns
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
