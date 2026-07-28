import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, CheckCircle, AlertTriangle, X, Link, Plus, ArrowRight, Hash, Database } from 'lucide-react';
import { JoinBuilder } from './JoinBuilder';
import { MappingBuilder } from './MappingBuilder';
import { ColumnMapping, DataSource, Join, SelectedColumn, ValidationResult } from './types/mapping';

interface MappingAreaProps {
  applications: DataSource[];
  joins: Join[];
  mappings: ColumnMapping[];
  validationResults: ValidationResult;
  selectedColumns: SelectedColumn[];
  columnConnections: { id: string; sourceColumn: any; targetColumn?: any; connectionType: 'single' | 'mapped' }[];
  onJoinAdd: (join: Omit<Join, 'id'>) => void;
  onJoinUpdate: (joinId: string, updatedJoin: Join) => void;
  onJoinRemove: (joinId: string) => void;
  onMappingAdd: (mapping: Omit<ColumnMapping, 'id'>) => void;
  onMappingRemove: (mappingId: string) => void;
  onRemoveConnection: (connectionId: string) => void;
  onCreateMapping: (sourceColumn: any, targetColumn: any) => void;
}

export const MappingArea: React.FC<MappingAreaProps> = ({
  applications,
  joins,
  mappings,
  validationResults,
  selectedColumns,
  columnConnections,
  onJoinAdd,
  onJoinUpdate,
  onJoinRemove,
  onMappingAdd,
  onMappingRemove,
  onRemoveConnection,
  onCreateMapping
}) => {
  const [selectedMapping, setSelectedMapping] = useState<string | null>(null);
  const [showJoinBuilder, setShowJoinBuilder] = useState(false);
  const [showMappingBuilder, setShowMappingBuilder] = useState(false);

  const getValidationIcon = (status: 'passed' | 'failed' | 'warning') => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getValidationBadgeVariant = (status: 'passed' | 'failed' | 'warning') => {
    switch (status) {
      case 'passed':
        return 'default' as const;
      case 'failed':
        return 'destructive' as const;
      case 'warning':
        return 'secondary' as const;
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
        <CardTitle className="text-lg">Mapping & Validation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="joins" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="joins">Joins</TabsTrigger>
            <TabsTrigger value="mappings">Column Mappings</TabsTrigger>
            <TabsTrigger value="validation">Validation</TabsTrigger>
          </TabsList>

          <TabsContent value="joins" className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Table Joins & Column Connections</h3>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowJoinBuilder(true)}
                className="h-7"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Join
              </Button>
            </div>

            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {/* Selected Columns Section */}
              {columnConnections.filter(conn => conn.connectionType === 'single').length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    Selected Columns ({columnConnections.filter(conn => conn.connectionType === 'single').length})
                  </h4>
                  {columnConnections
                    .filter(conn => conn.connectionType === 'single')
                    .map((connection) => (
                      <div 
                        key={connection.id}
                        className="p-4 border rounded-lg bg-white hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-slate-50 border">
                              <Hash className="h-4 w-4 text-slate-600" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs">
                                  {connection.sourceColumn.application}
                                </Badge>
                                <span className="text-sm font-medium">{connection.sourceColumn.table}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-slate-800">
                                  {connection.sourceColumn.column}
                                </span>
                                <Badge 
                                  variant="secondary" 
                                  className={`text-xs ${getConnectionTypeColor(connection.sourceColumn.type)}`}
                                >
                                  {connection.sourceColumn.type}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onRemoveConnection(connection.id)}
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Connection Actions */}
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-slate-500">
                            Available for mapping
                          </div>
                          
                          {columnConnections.filter(conn => conn.connectionType === 'single').length > 1 && (
                            <div className="flex items-center gap-2">
                              {columnConnections
                                .filter(conn => 
                                  conn.connectionType === 'single' && 
                                  conn.id !== connection.id
                                )
                                .slice(0, 2)
                                .map((otherConnection) => (
                                  <Button
                                    key={otherConnection.id}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onCreateMapping(connection.sourceColumn, otherConnection.sourceColumn)}
                                    className="h-7 text-xs"
                                  >
                                    <ArrowRight className="h-3 w-3 mr-1" />
                                    Map to {otherConnection.sourceColumn.table}.{otherConnection.sourceColumn.column}
                                  </Button>
                                ))}
                              
                              {columnConnections.filter(conn => conn.connectionType === 'single').length > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{columnConnections.filter(conn => conn.connectionType === 'single').length - 3} more
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Existing Joins Section */}
              {joins.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Link className="h-4 w-4" />
                    Active Joins ({joins.length})
                  </h4>
              {joins.map((join) => (
                <div key={join.id} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {join.sourceApplication}
                      </Badge>
                      <span className="text-sm font-medium">{join.sourceTable}</span>
                      <span className="text-xs text-muted-foreground">→</span>
                      <span className="text-sm font-medium">{join.targetTable}</span>
                      <Badge variant="outline" className="text-xs">
                        {join.targetApplication}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onJoinRemove(join.id)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{join.sourceTable}.{join.sourceColumn}</span>
                    <div className="h-px bg-border flex-1" />
                    <span className="text-sm">{join.targetTable}.{join.targetColumn}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <Select
                      value={join.joinType}
                      onValueChange={(value) => 
                        onJoinUpdate(join.id, { ...join, joinType: value as any })
                      }
                    >
                      <SelectTrigger className="w-32 h-7">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INNER">INNER JOIN</SelectItem>
                        <SelectItem value="LEFT">LEFT JOIN</SelectItem>
                        <SelectItem value="RIGHT">RIGHT JOIN</SelectItem>
                        <SelectItem value="FULL">FULL JOIN</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-muted-foreground">(datatype compatible)</span>
                  </div>
                </div>
              ))}
                </div>
              )}

              {/* Empty State */}
              {columnConnections.filter(conn => conn.connectionType === 'single').length === 0 && joins.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="p-3 rounded-full bg-slate-100 mb-2">
                    <Database className="h-6 w-6 text-slate-400" />
                  </div>
                  <h3 className="text-sm font-medium text-slate-600 mb-1">No columns selected</h3>
                  <p className="text-xs text-slate-500">
                    Select columns from the left panel to create connections and joins
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="mappings" className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Column Mappings</h3>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowMappingBuilder(true)}
                className="h-7"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Mapping
              </Button>
            </div>

            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {/* Active Mappings from Column Connections */}
              {columnConnections.filter(conn => conn.connectionType === 'mapped').length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <ArrowRight className="h-4 w-4" />
                    Active Column Mappings ({columnConnections.filter(conn => conn.connectionType === 'mapped').length})
                  </h4>
                  {columnConnections
                    .filter(conn => conn.connectionType === 'mapped')
                    .map((connection) => (
                      <div 
                        key={connection.id}
                        className="p-4 border rounded-lg bg-blue-50/30 border-blue-200"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {connection.sourceColumn.application}
                              </Badge>
                              <span className="text-sm font-medium">
                                {connection.sourceColumn.table}.{connection.sourceColumn.column}
                              </span>
                              <Badge 
                                variant="secondary" 
                                className={`text-xs ${getConnectionTypeColor(connection.sourceColumn.type)}`}
                              >
                                {connection.sourceColumn.type}
                              </Badge>
                            </div>
                            
                            <ArrowRight className="h-4 w-4 text-slate-400" />
                            
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {connection.targetColumn?.application}
                              </Badge>
                              <span className="text-sm font-medium">
                                {connection.targetColumn?.table}.{connection.targetColumn?.column}
                              </span>
                              <Badge 
                                variant="secondary" 
                                className={`text-xs ${getConnectionTypeColor(connection.targetColumn?.type || '')}`}
                              >
                                {connection.targetColumn?.type}
                              </Badge>
                            </div>
                          </div>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onRemoveConnection(connection.id)}
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <div className="flex items-center gap-2 mt-2">
                          {connection.sourceColumn.type === connection.targetColumn?.type ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                          )}
                          <Badge variant={connection.sourceColumn.type === connection.targetColumn?.type ? 'default' : 'secondary'} className="h-5">
                            {connection.sourceColumn.type === connection.targetColumn?.type ? 'Compatible' : 'Warning'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {connection.sourceColumn.type === connection.targetColumn?.type 
                              ? `datatype ${connection.sourceColumn.type} = ${connection.targetColumn?.type}` 
                              : `datatype ${connection.sourceColumn.type} ≠ ${connection.targetColumn?.type}`}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Traditional Mappings */}
              {mappings.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Link className="h-4 w-4" />
                    Traditional Mappings ({mappings.length})
                  </h4>
              {mappings.map((mapping) => (
                <div 
                  key={mapping.id} 
                  className={`p-4 border rounded-lg space-y-3 cursor-pointer transition-colors ${
                    selectedMapping === mapping.id ? 'bg-muted/50' : ''
                  }`}
                  onClick={() => setSelectedMapping(mapping.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {mapping.sourceApplication}
                      </Badge>
                      <span className="text-sm font-medium">{mapping.sourceTable}</span>
                      <span className="text-xs text-muted-foreground">→</span>
                      <span className="text-sm font-medium">{mapping.targetTable}</span>
                      <Badge variant="outline" className="text-xs">
                        {mapping.targetApplication}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMappingRemove(mapping.id);
                      }}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{mapping.sourceTable}.{mapping.sourceColumn}</span>
                    <div className="h-px bg-border flex-1" />
                    <span className="text-sm">{mapping.targetTable}.{mapping.targetColumn}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {getValidationIcon(mapping.validationStatus)}
                    <Badge variant={getValidationBadgeVariant(mapping.validationStatus)} className="h-5">
                      Validation
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {mapping.validationMessage}
                    </span>
                  </div>
                </div>
              ))}
                </div>
              )}

              {/* Empty State */}
              {columnConnections.filter(conn => conn.connectionType === 'mapped').length === 0 && mappings.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="p-3 rounded-full bg-slate-100 mb-2">
                    <ArrowRight className="h-6 w-6 text-slate-400" />
                  </div>
                  <h3 className="text-sm font-medium text-slate-600 mb-1">No mappings created</h3>
                  <p className="text-xs text-slate-500">
                    Create mappings by selecting columns and clicking "Map to" buttons
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="validation" className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-2xl font-bold text-green-600">
                    {validationResults.passed}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">Passed</p>
              </div>
              <div className="p-4 border rounded-lg text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <span className="text-2xl font-bold text-yellow-600">
                    {validationResults.warnings}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">Warnings</p>
              </div>
              <div className="p-4 border rounded-lg text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <span className="text-2xl font-bold text-red-600">
                    {validationResults.failed}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">Failed</p>
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-3">Selected Columns Summary</h4>
              <div className="space-y-2">
                {selectedColumns.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Badge variant="outline">{item.application}</Badge>
                    <span className="text-sm">{item.table}</span>
                    <Badge variant="secondary" className="h-5">
                      {item.columns.length} columns
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Join Builder Dialog */}
        {showJoinBuilder && (
          <JoinBuilder
            applications={applications}
            onJoinAdd={onJoinAdd}
            onClose={() => setShowJoinBuilder(false)}
          />
        )}

        {/* Mapping Builder Dialog */}
        {showMappingBuilder && (
          <MappingBuilder
            applications={applications}
            onMappingAdd={onMappingAdd}
            onClose={() => setShowMappingBuilder(false)}
          />
        )}
      </CardContent>
    </Card>
  );
};
