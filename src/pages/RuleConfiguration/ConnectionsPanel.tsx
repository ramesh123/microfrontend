import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowRight, X, Link, Plus } from 'lucide-react';

interface Connection {
  id: string;
  sourceColumn: any;
  targetColumn: any;
  connectionType: 'drag-drop' | 'manual';
}

interface ConnectionsPanelProps {
  connections: Connection[];
  onConnectionRemove: (connectionId: string) => void;
  onConnectionAdd: (sourceColumn: any, targetColumn: any) => void;
}

export const ConnectionsPanel: React.FC<ConnectionsPanelProps> = ({
  connections,
  onConnectionRemove,
  onConnectionAdd
}) => {
  const [draggedColumn, setDraggedColumn] = useState<any>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    
    try {
      const droppedData = JSON.parse(e.dataTransfer.getData('application/json'));
      
      if (draggedColumn && droppedData) {
        // Create connection between dragged and dropped columns
        // draggedColumn is from source table, droppedData is from target table
        onConnectionAdd(draggedColumn, droppedData);
        setDraggedColumn(null); // Clear after creating connection
      } else {
        // Store the first dropped column
        setDraggedColumn(droppedData);
      }
    } catch (error) {
      console.error('Error parsing dropped data:', error);
    }
  };

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
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Create Connections
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {connections.length} connections
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent 
        className="space-y-4"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <Tabs defaultValue="connections" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="connections">Review Connections</TabsTrigger>
            <TabsTrigger value="enrich">Enrich Columns</TabsTrigger>
          </TabsList>

          <TabsContent value="connections" className="space-y-4">
            {connections.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 rounded-full bg-slate-100 mb-4">
                  <Link className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-600 mb-2">No connections created</h3>
                <p className="text-sm text-slate-500 max-w-md">
                  Drag columns from the left and right panels to create connections between them.
                  Drop one column onto another to establish a mapping.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {connections.map((connection) => (
                  <div 
                    key={connection.id}
                    className="flex items-center justify-between p-3 bg-blue-100 border border-blue-200 rounded-full"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-blue-800">
                        {connection.sourceColumn.table}.{connection.sourceColumn.name.length > 15 
                          ? connection.sourceColumn.name.substring(0, 15) + '...' 
                          : connection.sourceColumn.name}
                      </span>
                      <ArrowRight className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">
                        {connection.targetColumn.table}.{connection.targetColumn.name.length > 15
                          ? connection.targetColumn.name.substring(0, 15) + '...'
                          : connection.targetColumn.name}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="secondary" 
                        className={`text-xs ${getConnectionTypeColor(connection.sourceColumn.type)}`}
                      >
                        {connection.sourceColumn.type}
                      </Badge>
                      <Badge 
                        variant="secondary" 
                        className={`text-xs ${getConnectionTypeColor(connection.targetColumn.type)}`}
                      >
                        {connection.targetColumn.type}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onConnectionRemove(connection.id)}
                        className="h-6 w-6 p-0 text-blue-600 hover:text-red-600 hover:bg-red-50"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="enrich" className="space-y-4">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-slate-100 mb-4">
                <Plus className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-600 mb-2">Enrich Columns</h3>
              <p className="text-sm text-slate-500 max-w-md">
                This feature will allow you to add enrichment rules and transformations to your column connections.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Instructions */}
        <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
            <Plus className="h-4 w-4" />
            How to create connections
          </h4>
          <ul className="text-xs text-slate-600 space-y-1">
            <li>• Drag a column from the left panel and drop it onto a column in the right panel</li>
            <li>• Or drag from right panel and drop onto left panel column</li>
            <li>• Compatible data types will show as badges for easy identification</li>
            <li>• Click the X button to remove any connection</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
