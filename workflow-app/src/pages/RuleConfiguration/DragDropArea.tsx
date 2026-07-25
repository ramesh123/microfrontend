import React, { ReactNode, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, X, Link, Plus, Database } from 'lucide-react';

interface Column {
  name: string;
  column: string;
  type: string;
  source: string;
  table: string;
  application: string;
}

interface Connection {
  id: string;
  sourceColumn: Column;
  targetColumn: Column;
  connectionType: 'drag-drop' | 'manual';
}

interface DragDropAreaProps {
  connections: Connection[];
  onConnectionRemove: (connectionId: string) => void;
  onConnectionAdd: (sourceColumn: Column, targetColumn: Column) => void;
}

interface DroppedColumn {
  name: string;
  type: string;
  source: 'left' | 'right';
  table: string;
  application: string;
}

export const DragDropArea: React.FC<DragDropAreaProps> = ({
  connections,
  onConnectionRemove,
  onConnectionAdd
}) => {
  
  const [leftColumns, setLeftColumns] = useState<DroppedColumn[]>([]);
  const [rightColumns, setRightColumns] = useState<DroppedColumn[]>([]);
  const [dragOverZone, setDragOverZone] = useState<'left' | 'right' | null>(null);

  const handleDragOver = (e: React.DragEvent, zone: 'left' | 'right') => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverZone(zone);
  };

  const handleDragLeave = () => {
    setDragOverZone(null);
  };

  const handleDrop = (e: React.DragEvent, zone: 'left' | 'right') => {
    e.preventDefault();
    
    try {
      const draggedData: DroppedColumn = JSON.parse(e.dataTransfer.getData('application/json'));
      
      if (zone === 'left' && draggedData.source === 'left') {
        // Add to left columns if not already present
        setLeftColumns(prev => {
          const exists = prev.some(col => 
            col.name === draggedData.name && 
            col.table === draggedData.table && 
            col.application === draggedData.application
          );
          return exists ? prev : [...prev, draggedData];
        });
      } else if (zone === 'right' && draggedData.source === 'right') {
        // Add to right columns if not already present
        setRightColumns(prev => {
          const exists = prev.some(col => 
            col.name === draggedData.name && 
            col.table === draggedData.table && 
            col.application === draggedData.application
          );
          return exists ? prev : [...prev, draggedData];
        });
      }
      
      // Auto-create connections between left and right columns
      if (zone === 'right' && draggedData.source === 'right') {
        // Check if there are left columns to connect with
        leftColumns.forEach(leftCol => {
          const sourceColumn = {
            name: leftCol.name,
            column: leftCol.name,
            type: leftCol.type,
            source: leftCol.source,
            table: leftCol.table,
            application: leftCol.application
          };
          const targetColumn = {
            name: draggedData.name,
            column: draggedData.name,
            type: draggedData.type,
            source: draggedData.source,
            table: draggedData.table,
            application: draggedData.application
          };
          onConnectionAdd(sourceColumn, targetColumn);
        });
      }
      
    } catch (error) {
      console.error('Error parsing dropped data:', error);
    }
    
    setDragOverZone(null);
  };

  const removeColumn = (column: DroppedColumn, zone: 'left' | 'right') => {
    if (zone === 'left') {
      setLeftColumns(prev => prev.filter(col => 
        !(col.name === column.name && col.table === column.table && col.application === column.application)
      ));
    } else {
      setRightColumns(prev => prev.filter(col => 
        !(col.name === column.name && col.table === column.table && col.application === column.application)
      ));
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

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link className="h-5 w-5 text-slate-600" />
            <CardTitle className="text-lg">Column Connections</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            {connections.length} connections
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4 max-h-[600px] overflow-y-auto">
        {/* Left and Right Drop Zones */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Left Drop Zone */}
          <div 
            className={`min-h-[120px] p-4 rounded-lg border-2 border-dashed transition-colors ${
              dragOverZone === 'left' 
                ? 'border-blue-400 bg-blue-50' 
                : 'border-slate-300 bg-slate-50/50'
            }`}
            onDragOver={(e) => handleDragOver(e, 'left')}
            onDrop={(e) => handleDrop(e, 'left')}
            onDragLeave={handleDragLeave}
          >
            <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              Source Columns
            </h4>
            {leftColumns.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-center">
                <div>
                  <Database className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Drag from left panel</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {leftColumns.map((column, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{column.application}</Badge>
                      <span className="text-sm font-medium">{column.table}.{column.name}</span>
                      <Badge variant="secondary" className={`text-xs ${getConnectionTypeColor(column.type)}`}>
                        {column.type}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeColumn(column, 'left')}
                      className="h-5 w-5 p-0 text-red-500 hover:text-red-700"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Drop Zone */}
          <div 
            className={`min-h-[120px] p-4 rounded-lg border-2 border-dashed transition-colors ${
              dragOverZone === 'right' 
                ? 'border-green-400 bg-green-50' 
                : 'border-slate-300 bg-slate-50/50'
            }`}
            onDragOver={(e) => handleDragOver(e, 'right')}
            onDrop={(e) => handleDrop(e, 'right')}
            onDragLeave={handleDragLeave}
          >
            <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              Target Columns
            </h4>
            {rightColumns.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-center">
                <div>
                  <Database className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Drag from right panel</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {rightColumns.map((column, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{column.application}</Badge>
                      <span className="text-sm font-medium">{column.table}.{column.name}</span>
                      <Badge variant="secondary" className={`text-xs ${getConnectionTypeColor(column.type)}`}>
                        {column.type}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeColumn(column, 'right')}
                      className="h-5 w-5 p-0 text-red-500 hover:text-red-700"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Connections Section */}
        {connections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="p-4 rounded-full bg-slate-100 mb-4">
              <ArrowRight className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-600 mb-2">No connections created</h3>
            <p className="text-sm text-slate-500 max-w-md">
              Drop columns from both sides to automatically create connections between them.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {connections.map((connection) => (
              <div 
                key={connection.id}
                className="p-4 border rounded-lg bg-blue-50/30 border-blue-200 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    {/* Source Column */}
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-xs">
                        {connection.sourceColumn.application}
                      </Badge>
                      <div className="text-sm font-medium">
                        {connection.sourceColumn.table}.{connection.sourceColumn.column}
                      </div>
                      <Badge 
                        variant="secondary" 
                        className={`text-xs ${getConnectionTypeColor(connection.sourceColumn.type)}`}
                      >
                        {connection.sourceColumn.type}
                      </Badge>
                    </div>
                    
                    {/* Arrow */}
                    <ArrowRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    
                    {/* Target Column */}
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-xs">
                        {connection.targetColumn.application}
                      </Badge>
                      <div className="text-sm font-medium">
                        {connection.targetColumn.table}.{connection.targetColumn.column}
                      </div>
                      <Badge 
                        variant="secondary" 
                        className={`text-xs ${getConnectionTypeColor(connection.targetColumn.type)}`}
                      >
                        {connection.targetColumn.type}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Remove Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onConnectionRemove(connection.id)}
                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* Connection Type Indicator */}
                <div className="flex items-center gap-2 mt-2">
                  <Badge 
                    variant={connection.sourceColumn.type === connection.targetColumn.type ? 'default' : 'secondary'} 
                    className="h-5 text-xs"
                  >
                    {connection.sourceColumn.type === connection.targetColumn.type ? 'Compatible' : 'Warning'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {connection.sourceColumn.type === connection.targetColumn.type 
                      ? `datatype ${connection.sourceColumn.type} = ${connection.targetColumn.type}` 
                      : `datatype ${connection.sourceColumn.type} ≠ ${connection.targetColumn.type}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Instructions */}
        <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
            <Plus className="h-4 w-4" />
            How to create connections
          </h4>
          <ul className="text-xs text-slate-600 space-y-1">
            <li>• Drag a column from the left panel and drop it onto a column in the right panel</li>
            <li>• Or drag from right panel and drop onto left panel column</li>
            <li>• Compatible data types will show as "Compatible", others as "Warning"</li>
            <li>• Click the X button to remove any connection</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
