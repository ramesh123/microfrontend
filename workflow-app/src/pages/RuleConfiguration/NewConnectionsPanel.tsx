import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, X, Link, Plus, Trash2, Play } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useValidationStore } from '@/stores/validationStore';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';

interface Column {
  name: string;
  type: string;
  source: 'left' | 'right';
  table: string;
  application: string;
}

interface Connection {
  id: string;
  sourceColumn: Column;
  targetColumn: Column;
  connectionType: 'drag-drop' | 'manual';
}

interface NewConnectionsPanelProps {
  connections: Connection[];
  onConnectionRemove: (connectionId: string) => void;
  onConnectionAdd: (sourceColumn: Column, targetColumn: Column, ruleContext?: { ruleId?: string; ruleName?: string }) => void;
  dataSources?: any[];
  selectedTables?: string[];
  onShowDataGrid?: (mapping: any) => void;
  upstreamNodes?: any[];
  onDropZoneTablesChange?: (leftTables: Set<string>, rightTables: Set<string>) => void;
  onKeyButtonClick?: (connectionId: string, keyType: 'primary' | 'validation') => void;
  getConnectionKeyState?: (connectionId: string) => { isPrimaryKey: boolean; isValidationKey: boolean };
  useStoreConnections?: boolean;
  onShowFilters?: () => void;
  ruleId?: string;
  ruleName?: string;
  onRuleOperatorsChange?: (operators: Record<number, 'AND' | 'OR'>) => void;
}

export const NewConnectionsPanel: React.FC<NewConnectionsPanelProps> = ({
  connections,
  onConnectionRemove,
  onConnectionAdd,
  dataSources = [],
  selectedTables = [],
  onShowDataGrid,
  upstreamNodes = [],
  onDropZoneTablesChange,
  onKeyButtonClick,
  getConnectionKeyState,
  useStoreConnections = false,
  onShowFilters,
  ruleId,
  ruleName,
  onRuleOperatorsChange
}) => { 
  const [leftInput, setLeftInput] = useState<Column | null>(null);
  const [rightInput, setRightInput] = useState<Column | null>(null);
  const [dragOverZone, setDragOverZone] = useState<'left' | 'right' | null>(null);
  const [singleRuleType, setSingleRuleType] = useState<'text' | 'value' | null>(null);
  const [singleOp, setSingleOp] = useState<{ op: 'is_null' | 'equals'; value: string }>({ op: 'is_null', value: '' });

  // Store connection operators (AND/OR) between individual connections
  const [connectionOperators, setConnectionOperators] = useState<Record<string, 'AND' | 'OR'>>({});

  // Notify parent when operators change
  React.useEffect(() => {
    if (onRuleOperatorsChange) {
      // Convert connection operators to the format expected by parent
      onRuleOperatorsChange(connectionOperators as any);
    }
  }, [connectionOperators, onRuleOperatorsChange]);

  // Track which tables are currently in use in drop zones
  const getUsedTablesInDropZones = React.useCallback(() => {
    const usedTables = new Set<string>();
    
    if (leftInput) {
      const tableKey = `${leftInput.application}.${leftInput.table}`;
      usedTables.add(tableKey);
    }
    
    if (rightInput) {
      const tableKey = `${rightInput.application}.${rightInput.table}`;
      usedTables.add(tableKey);
    }
    
    return usedTables;
  }, [leftInput, rightInput]);

  // Check if a table is already used in drop zones
  const isTableUsedInDropZones = React.useCallback((sourceName: string, tableName: string) => {
    const tableKey = `${sourceName}.${tableName}`;
    return getUsedTablesInDropZones().has(tableKey);
  }, [getUsedTablesInDropZones]);

  // Get connections from store
  const { connectionsWithSelectedData, setConnectionsWithSelectedData } = useValidationStore();

  const deriveRuleName = React.useCallback((connection: any) => {
    if (connection?.ruleName) return connection.ruleName;
    const sourceTable = connection?.sourceColumn?.table;
    const targetTable = connection?.targetColumn?.table;
    if (connection?.singleRule) {
      const table = sourceTable || targetTable || 'SOURCE';
      return `${table}_VS_${table}`;
    }
    if (sourceTable && targetTable) {
      return `${sourceTable}_VS_${targetTable}`;
    }
    return undefined;
  }, []);

  const relevantStoreConnections = React.useMemo(() => {
    if (!connectionsWithSelectedData || connectionsWithSelectedData.length === 0) {
      return [];
    }

    return connectionsWithSelectedData.filter((storeConn: any) => {
      const connRuleId = storeConn?.ruleId;
      const connRuleName = deriveRuleName(storeConn);

      if (ruleId && connRuleId) {
        return connRuleId === ruleId;
      }

      if (ruleId && !connRuleId && ruleName) {
        return connRuleName === ruleName;
      }

      if (ruleName && connRuleName) {
        return connRuleName === ruleName;
      }

      if (!ruleId && !ruleName) {
        return true;
      }

      return false;
    });
  }, [connectionsWithSelectedData, ruleId, ruleName, deriveRuleName]);

  // CRITICAL: Merge connections from props and store
  // Priority: Store connections first (most up-to-date), then merge with props
  // This ensures all connections (previous + new) are displayed
  const displayConnections = useMemo(() => {
    // CRITICAL: Start with store connections first (they contain all persisted connections)
    const merged: any[] = [];
    const connectionIds = new Set<string>();
    
    // First, add all store connections (previous + new)
    relevantStoreConnections.forEach((storeConn: any) => {
      if (!connectionIds.has(storeConn.id)) {
        merged.push(storeConn);
        connectionIds.add(storeConn.id);
      }
    });
    
    // Then, add props connections that aren't already in store
    connections.forEach((propConn: any) => {
      if (!connectionIds.has(propConn.id)) {
        merged.push(propConn);
        connectionIds.add(propConn.id);
      } else {
        // If connection exists in both, prefer store version (it has more metadata)
        const storeIndex = merged.findIndex((c: any) => c.id === propConn.id);
        if (storeIndex >= 0) {
          // Merge store and props data, prioritizing store
          merged[storeIndex] = {
            ...propConn,
            ...merged[storeIndex],
            // Preserve store metadata
            sourceColumnValue: merged[storeIndex].sourceColumnValue || propConn.sourceColumnValue,
            targetColumnValue: merged[storeIndex].targetColumnValue || propConn.targetColumnValue,
            hasSelectedData: merged[storeIndex].hasSelectedData || propConn.hasSelectedData,
          };
        }
      }
    });
    
    console.log('🔍 Display Connections (Store First):', {
      total: merged.length,
      fromStore: relevantStoreConnections.length,
      fromProps: connections.length,
      singleRule: merged.filter((c: any) => c.singleRule).length,
      normal: merged.filter((c: any) => !c.singleRule).length,
    });
    
    return merged;
  }, [connections, relevantStoreConnections]);
  
  // Debug logging for connections
  React.useEffect(() => {
    console.log('🔍 NewConnectionsPanel - Connection Sources:', {
      propsConnections: connections.length,
      storeConnections: relevantStoreConnections.length,
      displayConnections: displayConnections.length,
      usingStore: relevantStoreConnections.length > 0
    });
    
    if (displayConnections.length > 0) {
      console.log('📋 Displaying connections:', displayConnections.map(c => ({
        id: c.id,
        source: `${c.sourceColumn.table}.${c.sourceColumn.name}`,
        target: `${c.targetColumn.table}.${c.targetColumn.name}`
      })));
    }
  }, [connections.length, relevantStoreConnections.length, displayConnections.length]);
  
  // CRITICAL: Store connections in store when they change
  // CRITICAL: Always MERGE, never replace - this preserves previous connections
  // CRITICAL: Check for duplicates by table+column combination to prevent triple appending
  React.useEffect(() => {
    if (connections.length > 0) {
      // Get current connections from store
      const currentConnections = connectionsWithSelectedData || [];
      
      // CRITICAL: Check for duplicates by table+column combination, not just ID
      // This prevents the same connection from being added multiple times
      const getConnectionKey = (conn: any) => {
        const sourceTable = conn.sourceColumn?.table || '';
        const sourceCol = conn.sourceColumn?.name || '';
        const targetTable = conn.targetColumn?.table || '';
        const targetCol = conn.targetColumn?.name || '';
        return `${sourceTable}.${sourceCol}→${targetTable}.${targetCol}`;
      };
      
      const storeConnectionKeys = new Set(currentConnections.map(getConnectionKey));
      
      // Merge: update existing connections, add new ones (check by table+column, not ID)
      const mergedConnections: any[] = [...currentConnections];
      connections.forEach((propConn: any) => {
        if (!propConn?.id) return;
        
        const propConnKey = getConnectionKey(propConn);
        const existingIndex = mergedConnections.findIndex((c: any) => getConnectionKey(c) === propConnKey);
        
        if (existingIndex >= 0) {
          // Update existing connection (merge data) - same table+column combination
          mergedConnections[existingIndex] = { ...mergedConnections[existingIndex], ...propConn };
        } else if (!storeConnectionKeys.has(propConnKey)) {
          // Add new connection only if it doesn't exist by table+column combination
          mergedConnections.push(propConn);
        }
      });
      
      // Only update if there are actual changes (new connections or updates)
      const hasNewConnections = connections.some((propConn: any) => {
        if (!propConn?.id) return false;
        const propConnKey = getConnectionKey(propConn);
        return !storeConnectionKeys.has(propConnKey);
      });
      
      if (hasNewConnections || mergedConnections.length !== currentConnections.length) {
        console.log('📝 Merged connections to store (preserving previous, preventing duplicates):', {
          previous: currentConnections.length,
          new: mergedConnections.length - currentConnections.length,
          total: mergedConnections.length,
        });
        setConnectionsWithSelectedData(mergedConnections);
      }
    }
    // CRITICAL: Don't clear store if connections is empty
    // Store might have connections that should be preserved
  }, [connections, setConnectionsWithSelectedData, connectionsWithSelectedData]);

  // Notify parent when drop zone tables change
  React.useEffect(() => {
    if (onDropZoneTablesChange) {
      const leftTables = new Set<string>();
      const rightTables = new Set<string>();
      
      if (leftInput) {
        const tableKey = `${leftInput.application}.${leftInput.table}`;
        leftTables.add(tableKey);
      }
      
      if (rightInput) {
        const tableKey = `${rightInput.application}.${rightInput.table}`;
        rightTables.add(tableKey);
      }
      
      onDropZoneTablesChange(leftTables, rightTables);
    }
  }, [leftInput, rightInput, onDropZoneTablesChange]);

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
    setDragOverZone(null);

    try {
      const droppedData = JSON.parse(e.dataTransfer.getData('application/json'));

      console.log('🎯 Drop event:', { zone, droppedData });

      // Restrict dropping based on source panel
      if (zone === 'left' && droppedData.source === 'left') {
        // Only allow left panel columns in source column area
        setLeftInput(droppedData);
        console.log('✅ Set left input:', droppedData);
      } else if (zone === 'right' && droppedData.source === 'right') {
        // Only allow right panel columns in target column area
        setRightInput(droppedData);
        console.log('✅ Set right input:', droppedData);
      } else {
        // Show feedback for incorrect drop
        const correctZone = droppedData.source === 'left' ? 'left (Source)' : 'right (Validation)';
        const attemptedZone = zone === 'left' ? 'Source' : 'Validation';
        toast.error(
          `Cannot drop ${droppedData.source === 'left' ? 'Source' : 'Validation'} column in ${attemptedZone} drop zone. Please drop in the ${correctZone} zone.`,
          { duration: 3000 }
        );
        console.log('❌ Invalid drop:', { expected: droppedData.source, got: zone });
      }
    } catch (error) {
      console.error('Error parsing dropped data:', error);
      toast.error(getDisplayErrorMessage(error, 'Error processing dropped column'), { duration: 2000 });
    }
  };

  const handleCreateConnection = () => {
    // If both sides present, create normal connection
    if (leftInput && rightInput) {
      // CRITICAL: Check for duplicate column mapping before creating connection
      const sourceTable = leftInput?.table || '';
      const sourceColName = leftInput?.name || '';
      const targetTable = rightInput?.table || '';
      const targetColName = rightInput?.name || '';
      
      // Check in displayConnections (which includes both dragDropConnections and store connections)
      const isDuplicate = displayConnections.some((conn: any) => {
        const connSourceTable = conn.sourceColumn?.table || '';
        const connSourceCol = conn.sourceColumn?.name || '';
        const connTargetTable = conn.targetColumn?.table || '';
        const connTargetCol = conn.targetColumn?.name || '';
        
        // Check if source and target columns match (same table and column name)
        return (
          connSourceTable === sourceTable &&
          connSourceCol === sourceColName &&
          connTargetTable === targetTable &&
          connTargetCol === targetColName
        );
      });
      
      // If duplicate found, show error and prevent addition
      if (isDuplicate) {
        toast.error(
          `This column mapping already exists: "${sourceTable}.${sourceColName}" → "${targetTable}.${targetColName}". Please choose different columns.`,
          {
            duration: 4000,
          }
        );
        return; // Don't create the connection
      }
      
      onConnectionAdd(leftInput, rightInput, { ruleId, ruleName });
      setLeftInput(null);
      setRightInput(null);
      setSingleRuleType(null);
      setSingleOp({ op: 'is_null', value: '' });
      return;
    }

    // If only one side present with type selected, create a single-side connection
    const single = leftInput || rightInput;
    if (single && singleRuleType != null) {
      // Create connection with metadata
      const generatedId = `${single.application}-${single.table}-${single.name}-single-${Date.now()}`;
      const currentValue = singleRuleType === 'text' ? singleOp.value : (singleOp.op === 'equals' ? singleOp.value : '');
      const singleConn: any = {
        id: generatedId,
        sourceColumn: {
          ...single,
          name: single.name,
          type: single.type,
          source: single.source,
          table: single.table,
          application: single.application
        },
        targetColumn: {
          ...single,
          name: single.name,
          type: single.type,
          source: single.source,
          table: single.table,
          application: single.application
        },
        connectionType: 'manual',
        singleRule: true,
        singleRuleType,
        singleOperation: singleRuleType === 'value' ? singleOp.op : undefined,
        constantValue: singleRuleType === 'text' ? currentValue : undefined,
        ruleId: ruleId || null,
        ruleName:
          ruleName ||
          deriveRuleName({
            sourceColumn: single,
            targetColumn: single,
            singleRule: true,
          }),
      };
      // Store in validation store with metadata
      const current = connectionsWithSelectedData || [];
      setConnectionsWithSelectedData([...current, singleConn]);
      // For single-rule connections, don't call onConnectionAdd - they're only stored in the store
      // The displayConnections merge logic will pick them up from the store
      console.log('✅ Created single-rule connection:', {
        id: generatedId,
        sourceColumn: single.name,
        singleRule: true,
        constantValue: singleRuleType === 'text' ? currentValue : undefined,
        singleOperation: singleRuleType === 'value' ? singleOp.op : undefined
      });
      setLeftInput(null);
      setRightInput(null);
      setSingleRuleType(null);
      setSingleOp({ op: 'is_null', value: '' });
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

  // Group connections by table pairs (including single-side rules)
  const groupedConnections = useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    
    displayConnections.forEach((connection: any) => {
      // For single-side rules, use a special grouping key
      if (connection.singleRule) {
        const key = `single-${connection.sourceColumn.table}`;
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(connection);
      } else {
        const sourceTable = connection.sourceColumn.table;
        const targetTable = connection.targetColumn.table;
        const key = `${sourceTable}-${targetTable}`;
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(connection);
      }
    });

    return groups;
  }, [displayConnections]);

  // Create table mappings from grouped connections (including single-side rules)
  const tableMappings = useMemo(() => {
    return Object.entries(groupedConnections).map(([key, connections]) => {
      // Handle single-side rules differently
      if (key.startsWith('single-')) {
        const sourceTableName = key.replace('single-', '');
        const sourceDataSource = dataSources.find(source => 
          source.tables.some((table: any) => table.name === sourceTableName)
        );
        if (!sourceDataSource) return null;
        const sourceTableData = sourceDataSource.tables.find((table: any) => table.name === sourceTableName);
        const sourceNode = upstreamNodes.find((node: any) => node.id === sourceDataSource.id);
        // Get rule information from the first connection or props
        const firstConnection = connections[0] as any;
        const mappingRuleId = firstConnection?.ruleId || ruleId;
        const mappingRuleName = firstConnection?.ruleName || ruleName;
        
        return {
          id: `mapping-single-${sourceTableName}`,
          sourceTable: {
            sourceId: sourceDataSource.id,
            tableName: sourceTableName,
            sourceName: sourceDataSource.name
          },
          targetTable: null, // No target for single-side rules
          connections,
          sourceTableColumns: sourceTableData?.columns || [],
          targetTableColumns: [],
          sourceNodeData: sourceNode?.data?.node?.output?.data || null,
          targetNodeData: null,
          isSingleRule: true,
          ruleId: mappingRuleId,
          ruleName: mappingRuleName
        };
      }
      
      const [sourceTableName, targetTableName] = key.split('-');
      
      // Find the source and target table details
      const sourceDataSource = dataSources.find(source => 
        source.tables.some((table: any) => table.name === sourceTableName)
      );
      const targetDataSource = dataSources.find(source => 
        source.tables.some((table: any) => table.name === targetTableName)
      );

      if (!sourceDataSource || !targetDataSource) return null;

      const mappingId = `mapping-${sourceTableName}-${targetTableName}`;
      
      // Get all columns from the source and target tables
      const sourceTableData = sourceDataSource.tables.find((table: any) => table.name === sourceTableName);
      const targetTableData = targetDataSource.tables.find((table: any) => table.name === targetTableName);

      // Get actual node data from upstream nodes
      const sourceNode = upstreamNodes.find((node: any) => node.id === sourceDataSource.id);
      const targetNode = upstreamNodes.find((node: any) => node.id === targetDataSource.id);

      // Get rule information from the first connection
      const firstConnection = connections[0] as any;
      const connectionRuleId = firstConnection?.ruleId || ruleId;
      const connectionRuleName = firstConnection?.ruleName || ruleName;
      
      return {
        id: mappingId,
        sourceTable: {
          sourceId: sourceDataSource.id,
          tableName: sourceTableName,
          sourceName: sourceDataSource.name
        },
        targetTable: {
          sourceId: targetDataSource.id,
          tableName: targetTableName,
          sourceName: targetDataSource.name
        },
        connections,
        sourceTableColumns: sourceTableData?.columns || [],
        targetTableColumns: targetTableData?.columns || [],
        sourceNodeData: sourceNode?.data?.node?.output?.data || null,
        targetNodeData: targetNode?.data?.node?.output?.data || null,
        isSingleRule: false,
        ruleId: connectionRuleId,
        ruleName: connectionRuleName
      };
    }).filter(Boolean);
  }, [groupedConnections, dataSources, upstreamNodes, ruleId, ruleName]);

  const handleShowDataGrid = (mapping: any) => {
    if (!onShowDataGrid) return;
    
    // Don't automatically populate first row data - only show the data preview
    // Data will be populated only when user explicitly selects a row
    const updatedMapping = {
      ...mapping,
      connections: mapping.connections.map((conn: any) => ({
        ...conn,
        // Preserve existing selected data if available, otherwise don't set hasSelectedData
        hasSelectedData: conn.hasSelectedData || false,
        // Only preserve existing values, don't auto-populate from first row
        sourceColumnValue: conn.sourceColumnValue ?? null,
        targetColumnValue: conn.targetColumnValue ?? null,
      }))
    };
    onShowDataGrid(updatedMapping);
  };

  const handleRemoveMapping = (mappingId: string) => {
    console.log('🗑️ Removing entire table mapping:', mappingId);
    const mapping = tableMappings.find(m => m.id === mappingId);
    if (mapping) {
      console.log('  ├─ Found mapping with', mapping.connections.length, 'connections');
      
      // Get all connection IDs to remove
      const connectionIdsToRemove = mapping.connections.map(conn => conn.id);
      console.log('  ├─ Connection IDs to remove:', connectionIdsToRemove);
      
      // Remove all connections from parent component in one batch
      connectionIdsToRemove.forEach(connectionId => {
        onConnectionRemove(connectionId);
      });
      
      // Remove all connections from store in one operation
      const updatedStoreConnections = connectionsWithSelectedData.filter(
        conn => !connectionIdsToRemove.includes(conn.id)
      );
      setConnectionsWithSelectedData(updatedStoreConnections);
      
      console.log('  ├─ Removed', connectionIdsToRemove.length, 'connections from parent');
      console.log('  ├─ Store connections before:', connectionsWithSelectedData.length);
      console.log('  ├─ Store connections after:', updatedStoreConnections.length);
      console.log('  └─ ✅ Entire table mapping removed successfully');
    } else {
      console.log('  └─ ❌ Mapping not found!');
    }
  };

  return (
    <TooltipProvider>
      <Card className="flex flex-col p-0 gap-0 overflow-hidden" style={{ height: '100%', maxHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <CardHeader className="p-2 flex-shrink-0 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Create Connections
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {displayConnections.length} connections
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex flex-col flex-1 min-h-0 p-4">
        <div className="flex-shrink-0 space-y-4">
       
          {/* Column Drop Areas - Single Line */}
          <div className="flex items-center gap-4">
          {/* Source Column */}
          <div className="flex-1">
            <div
              className={`p-2 rounded-lg border-2 border-dashed min-h-16 transition-all duration-200 ${
                dragOverZone === 'left'
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-slate-300 bg-slate-50/50'
              }`}
              onDragOver={(e) => handleDragOver(e, 'left')}
              onDrop={(e) => handleDrop(e, 'left')}
              onDragLeave={handleDragLeave}
            >
              {leftInput ? (
                <div className="flex items-center justify-center">
                  <div className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 h-8 shadow-sm max-w-full">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-sm font-medium text-slate-800 truncate max-w-[100px] cursor-help">
                          {leftInput.name}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{leftInput.name}</p>
                      </TooltipContent>
                    </Tooltip>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setLeftInput(null)}
                      className="h-4 w-4 p-0 hover:bg-red-100 flex-shrink-0"
                    >
                      <X className="h-3 w-3 text-red-500" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-8 text-center">
                  <div>
                    <Link className="h-5 w-5 text-slate-400 mx-auto mb-1" />
                    <p className="text-xs text-slate-500">Drag from Source Data Objects</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Arrow */}
          <div className="flex items-center">
            <ArrowRight className="h-5 w-5 text-slate-400" />
          </div>

          {/* Target Column */}
          <div className="flex-1">
            <div
              className={`p-2 rounded-lg border-2 border-dashed min-h-16 transition-all duration-200 ${
                dragOverZone === 'right'
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-slate-300 bg-slate-50/50'
              }`}
              onDragOver={leftInput && !rightInput && singleRuleType != null ? undefined : (e) => handleDragOver(e, 'right')}
              onDrop={leftInput && !rightInput && singleRuleType != null ? undefined : (e) => handleDrop(e, 'right')}
              onDragLeave={leftInput && !rightInput && singleRuleType != null ? undefined : handleDragLeave}
            >
              {rightInput ? (
                <div className="flex items-center justify-center">
                  <div className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 h-8 shadow-sm max-w-full">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-sm font-medium text-slate-800 truncate max-w-[100px] cursor-help">
                          {rightInput.name}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{rightInput.name}</p>
                      </TooltipContent>
                    </Tooltip>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRightInput(null)}
                      className="h-4 w-4 p-0 hover:bg-red-100 flex-shrink-0"
                    >
                      <X className="h-3 w-3 text-red-500" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-2 text-center">
                  {leftInput && !rightInput && singleRuleType != null ? (
                    <div className="flex items-center gap-2 w-full justify-center">
                      {singleRuleType === 'text' ? (
                        <input
                          className="h-8 border border-slate-200 rounded px-2 text-xs w-full max-w-xs"
                          placeholder="Enter constant value"
                          value={singleOp.value}
                          onChange={(e) => setSingleOp({ ...singleOp, value: e.target.value })}
                        />
                      ) : (
                        <Select 
                          value={singleOp.op} 
                          onValueChange={(v) => {
                            setSingleOp({ op: v as 'is_null' | 'equals', value: v === 'equals' ? singleOp.value : '' });
                          }}
                        >
                          <SelectTrigger className="h-8 w-[140px] text-xs">
                            <SelectValue placeholder="Select operation" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="is_null">is null</SelectItem>
                            <SelectItem value="not_null">not null</SelectItem>

                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  ) : (
                    <div>
                      <Link className="h-5 w-5 text-slate-400 mx-auto mb-1" />
                      <p className="text-xs text-slate-500">Drag from Validation Data Objects</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Add Connection Button */}
          <div className="flex items-center">
            <Button
              onClick={handleCreateConnection}
              disabled={
                (!leftInput && !rightInput) || 
                ((leftInput || rightInput) && !leftInput && !rightInput && singleRuleType == null)
              }
              className={`!h-8 !w-8 p-0 rounded-full ${
                (leftInput && rightInput) || (leftInput && singleRuleType != null) || (rightInput && singleRuleType != null)
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>

          {/* Type selector outside of drop area when only source is selected */}
          {leftInput && !rightInput && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-slate-600">Type</span>
              <Select value={singleRuleType ?? undefined} onValueChange={(v) => setSingleRuleType(v as 'text' | 'value')}>
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">text</SelectItem>
                  <SelectItem value="value">value</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Table Mappings Section - Scrollable */}
        {tableMappings.length > 0 && (
          <div className="flex flex-col mt-4">
            {/* Fixed Header */}
            <div className="flex items-center justify-between pb-3 border-b mb-3">
              <h4 className="text-sm font-medium text-slate-700">Table Mappings</h4>
            </div>
            {/* Scrollable Table Mappings List - Only this section scrolls */}
            <div
              className="pr-2"
              style={{
                height: '300px',
                maxHeight: '400px',
                overflowY: 'auto',
                overflowX: 'hidden',
                position: 'relative',
                WebkitOverflowScrolling: 'touch'
              }}
            >
              {tableMappings.map((mapping, mappingIndex) => (
                <React.Fragment key={mapping.id}>
                <div className="border border-slate-200 rounded-lg bg-white flex flex-col mt-2">
                  {/* Table Mapping Header - Fixed within card */}
                  <div className="flex items-center justify-between p-3 border-b border-slate-100 flex-shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="text-sm font-medium text-slate-700">
                          {mapping.sourceTable.tableName}
                        </span>
                      </div>
                      {!mapping.isSingleRule && (
                        <>
                          <ArrowRight className="h-4 w-4 text-slate-400" />
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
                          <ArrowRight className="h-4 w-4 text-slate-400" />
                          <span className="text-sm font-medium text-slate-500 italic">
                            Single-side rules
                          </span>
                        </>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {mapping.connections.length} Conn.
                      </Badge>
                      {/* Display rule name if available */}
                      {ruleName && (
                        <Badge variant="secondary" className="text-xs">
                          Rule: {ruleName}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Execute Icon for showing data grid */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleShowDataGrid(mapping)}
                            className="h-8 w-8 p-0 text-green-600 hover:text-green-800 hover:bg-green-50"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Execute and show data
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveMapping(mapping.id)}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Remove table mapping
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  {/* Connections List - Scrollable */}
                  <div className="flex flex-col flex-1 min-h-0">
                    <div className="p-3 pb-2 flex-shrink-0">
                      <h5 className="text-xs font-medium text-slate-600 uppercase tracking-wide">Connections</h5>
                    </div>
                    <div className="px-3 pb-3 overflow-y-auto max-h-[300px]">
                      {mapping.connections.map((connection: any, index) => {
                      const keyState = getConnectionKeyState ? getConnectionKeyState(connection.id) : { isPrimaryKey: false, isValidationKey: false };
                      
                      // Debug log for single-rule connections
                      if (connection.singleRule) {
                        console.log('🔍 Rendering single-rule connection:', {
                          id: connection.id,
                          sourceColumn: connection.sourceColumn?.name,
                          constantValue: connection.constantValue,
                          singleRule: connection.singleRule,
                          singleRuleType: connection.singleRuleType
                        });
                      }
                      
                      return (
                        <React.Fragment key={connection.id}>
                          {/* AND/OR Dropdown between connections (not between mappings) */}
                          {index > 0 && (
                            <div className="flex items-center justify-start my-1.5 ml-1">
                              <Select
                                value={connectionOperators[connection.id] || 'AND'}
                                onValueChange={(value: 'AND' | 'OR') => {
                                  setConnectionOperators(prev => ({
                                    ...prev,
                                    [connection.id]: value
                                  }));
                                }}
                              >
                                <SelectTrigger className="w-16 h-6 text-[10px] font-semibold px-2">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="AND" className="text-xs">AND</SelectItem>
                                  <SelectItem value="OR" className="text-xs">OR</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          <div
                            className="flex items-center gap-1.5 justify-between bg-muted/40 p-1.5 rounded-md text-xs"
                          >
                          <div className="flex items-center gap-1.5 flex-1">
                            <span className="text-xs font-medium text-slate-500">{index + 1}.</span>
                            {connection.singleRule ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-medium text-slate-800">
                                  {connection.sourceColumn?.name || 'unknown'} -&gt; {connection.singleRuleType === 'value' 
                                    ? (connection.singleOperation || 'is_null').replace(/_/g, '')
                                    : `constant value(${connection.constantValue || ''})`}
                                </span>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className={cn(
                                    "h-5 w-5 text-[10px] p-0",
                                    keyState.isValidationKey && "bg-green-600 text-white hover:bg-green-700 border-none"
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    console.log('🔑 V button clicked for single-rule connection:', connection.id);
                                    onKeyButtonClick?.(connection.id, 'validation');
                                  }}
                                  title="Validation Column"
                                >
                                  V
                                </Button>
                              </div>
                            ) : (
                              <>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-xs font-medium text-slate-800 cursor-help truncate">
                                      {connection.sourceColumn.name}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{connection.sourceColumn.table}.{connection.sourceColumn.name}</p>
                                  </TooltipContent>
                                </Tooltip>
                                <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0 mx-1" />
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-xs font-medium text-slate-800 cursor-help truncate">
                                      {connection.targetColumn.name}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{connection.targetColumn.table}.{connection.targetColumn.name}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </>
                            )}
                          </div>
                          
                          {/* K/V Buttons with conditional rendering for single-side constant/field rules */}
                          <div className="flex gap-1 ml-2 items-center">
                            {!connection.singleRule && (
                              <>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className={cn(
                                    "h-5 w-5 text-[10px] p-0",
                                    keyState.isPrimaryKey && "bg-yellow-600 text-white hover:bg-yellow-700 border-none"
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onKeyButtonClick?.(connection.id, 'primary');
                                  }}
                                  title="Set as Key"
                                >
                                  K
                                </Button>
                                
                                {/* V Button (Validation Key) - Only for normal connections */}
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className={cn(
                                    "h-5 w-5 text-[10px] p-0",
                                    keyState.isValidationKey && "bg-green-600 text-white hover:bg-green-700 border-none"
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onKeyButtonClick?.(connection.id, 'validation');
                                  }}
                                  title="Set as Validation"
                                >
                                  V
                                </Button>
                              </>
                            )}
                            
                            {/* Delete Button - Always show */}
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-5 w-5 text-[10px] p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                console.log('🗑️ Deleting individual connection:', connection.id);
                                
                                // Remove from parent component
                                onConnectionRemove(connection.id);
                                
                                // Also remove from store
                                const updatedConnections = connectionsWithSelectedData.filter(conn => conn.id !== connection.id);
                                setConnectionsWithSelectedData(updatedConnections);
                                
                                console.log('  └─ Connection removed from both parent and store');
                              }}
                              title="Delete Connection"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </React.Fragment>
                      );
                    })}
                    </div>
                  </div>

                </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {/* Current Connection Creation */}
        {tableMappings.length === 0 && displayConnections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center flex-shrink-0">
            <div className="p-4 rounded-full bg-slate-100 mb-4">
              <Link className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-600 mb-2">No connections created</h3>
            <p className="text-sm text-slate-500 max-w-md">
              Drag columns from Source Data Objects and Validation Data Objects into the input areas above to create connections.
            </p>
          </div>
        ) : null}
      </CardContent>
      </Card>
    </TooltipProvider>
  );
};