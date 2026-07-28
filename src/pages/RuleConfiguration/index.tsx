import React, { useState, useEffect, useMemo } from 'react';
import { ConnectionsPage } from './ConnectionsPage';
import { FiltersConfiguration } from './FiltersConfiguration';
import { DataSource } from './types/mapping';
import { toast } from 'sonner';
import { ApiRequestError, getDisplayErrorMessage } from '@/utils/exceptionHelper';
import useFlowStore from '@/stores/flowStore';
import { saveNodeDetailsApi } from '@/controllers/API';
import { useExecuteWorkflow } from '@/hooks/use-execute-flow';
import { X } from 'lucide-react';
import { useValidationStore } from '@/stores/validationStore';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RuleHeader } from './components/RuleHeader';
import { AddRuleDialog } from './components/AddRuleDialog';
import { RuleTabsContent } from './components/RuleTabsContent';
import { useRuleManagement, ValidationRule } from './hooks/useRuleManagement';
import { useFilterSave } from './hooks/useFilterSave';
import { getNodeOutputData } from '@/utils/nodeDataUtils';
import { compressDataString } from '@/utils/compressionUtils';
import { getNodeDataByUniqueIdApi } from '@/controllers/API';
import { useRuleConfigurationStore } from '@/stores/ruleConfigurationStore';

interface RuleConfigurationProps {
  onClose?: () => void;
}

function RuleConfiguration({ onClose }: RuleConfigurationProps = {}) {
  const currentNode = useFlowStore((state) => state.getSelectedNode());
  const { mutate: executeWorkflow } = useExecuteWorkflow();
  const [isSaving, setIsSaving] = useState(false);
  const [submitRules, setSubmitRules] = useState<any>(null);
  const [getOperationsPayloadFn, setGetOperationsPayloadFn] = useState<(() => any) | null>(null);
  const [columnFiltersBySource, setColumnFiltersBySource] = useState<Record<string, any>>({});
  
  // Validation store for selected row data
  const { 
    connectionsWithSelectedData,
    setSelectedRowData,
    setConnectionsWithSelectedData,
    columnFiltersBySource: storeColumnFilters,
    setColumnFiltersBySource: setStoreColumnFilters,
    validationRulesMap,
    setValidationRulesMap,
    upsertValidationRule,
    removeValidationRule,
    submitRules: storeSubmitRules,
    setSubmitRules: setStoreSubmitRules,
  } = useValidationStore();

  const setRuleConfigPayload = useRuleConfigurationStore((state) => state.setSavedPayload);
  const clearRuleConfigPayload = useRuleConfigurationStore((state) => state.clearPayloadForNode);

  // Load submitRules from store when component mounts or node changes
  useEffect(() => {
    if (storeSubmitRules) {
      setSubmitRules(storeSubmitRules);
      console.log('📋 Loaded submitRules from store:', {
        field_rules: storeSubmitRules.field_rules?.length || 0,
        rule_configuration: storeSubmitRules.rule_configuration?.length || 0,
      });
    }
  }, [storeSubmitRules]);

  // Reset validation store and local connection state when node changes
  // For new nodes (saved_node is false), reset submitRules and ruleOperations
  // For saved nodes, preserve submitRules from the store
  useEffect(() => {
    if (!currentNode?.id) return;
    const payload = currentNode?.data?.node?.payload || {};
    const savedNode = !!payload?.saved_node;
    const store = useValidationStore.getState();
    
    if (!savedNode) {
      // New node - reset everything including submitRules and ruleOperations
      store.reset();
      setStoreSubmitRules(null);
      setSubmitRules(null);
      console.log('🔄 New node detected - resetting all rules and operations');
    } else {
      // Saved node - preserve submitRules from the store
      const savedSubmitRules = store.submitRules;
      store.reset();
      if (savedSubmitRules) {
        // Restore submitRules after reset
        setStoreSubmitRules(savedSubmitRules);
        setSubmitRules(savedSubmitRules);
        console.log('📋 Saved node detected - preserving submitRules from store');
      }
    }
    
    setDragDropConnections([]);
    setConnectionKeyStates({});
    setColumnFiltersBySource({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNode?.id, setStoreSubmitRules]);

  useEffect(() => {
    const nodeId = currentNode?.id;
    return () => {
      if (nodeId) {
        clearRuleConfigPayload(nodeId);
      }
    };
  }, [currentNode?.id, clearRuleConfigPayload]);
  
  // Get upstream nodes (previous nodes in the flow)
  const upstreamNodes = useMemo(() => {
    if (!currentNode?.id) return [];
    return useFlowStore.getState().getUpstreamNodes(currentNode.id);
  }, [currentNode?.id]);

  // Convert upstream nodes to DataSource format
  const flowDataSources = useMemo<DataSource[]>(() => {
    return upstreamNodes.map((node: any) => {
      const nodeName = node.data?.display_name || 
                      node.data?.node?.name || 
                      node.data?.label || 
                      node.id;
      
      const outputColumns = node.data?.node?.output?.columns || [];
      const outputData = node.data?.node?.output?.data || [];
      
      // Create columns from output with better type detection
      const columns = outputColumns.map((colName: string) => {
        // Try to detect type from actual data
        let detectedType = 'string';
        if (outputData.length > 0) {
          const sampleValue = outputData[0]?.[colName];
          if (typeof sampleValue === 'number') {
            detectedType = Number.isInteger(sampleValue) ? 'integer' : 'decimal';
          } else if (typeof sampleValue === 'boolean') {
            detectedType = 'boolean';
          } else if (sampleValue instanceof Date) {
            detectedType = 'datetime';
          }
        }
        
        return {
          name: colName,
          type: detectedType,
          selected: false
        };
      });

      console.log(`📊 DataSource created for ${nodeName}:`, {
        columnsCount: columns.length,
        dataRowsCount: outputData.length,
        nodeId: node.id
      });

      return {
        id: node.id,
        name: nodeName,
        type: 'mysql' as const, // Default type, could be enhanced based on node type
        connected: true,
        tables: [{
          name: nodeName,
          columns,
          selected: false
        }]
      };
    });
  }, [upstreamNodes]);

  const [dataSources, setDataSources] = useState<DataSource[]>(flowDataSources);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<{ application: string; table: string; column: string; type: string }[]>([]);
  const [columnConnections, setColumnConnections] = useState<{ id: string; sourceColumn: any; targetColumn?: any; connectionType: 'single' | 'mapped' }[]>([]);
  const [dragDropConnections, setDragDropConnections] = useState<{
    id: string;
    sourceColumn: any;
    targetColumn: any;
    connectionType: 'drag-drop' | 'manual';
    singleRule?: boolean;
    singleRuleType?: string;
    singleOperation?: string;
    constantValue?: any;
    ruleId?: string | null;
    ruleName?: string;
  }[]>([]);

  // Update dataSources when flowDataSources changes
  useEffect(() => {
    if (flowDataSources.length > 0) {
      console.log('🔄 Using real data from upstream nodes:', flowDataSources.length, 'sources');
      setDataSources(flowDataSources);
      // Auto-select all sources and their columns
      const allTableNames = flowDataSources.flatMap(source => source.tables.map(table => table.name));
      setSelectedTables(allTableNames);
      
      // Auto-select all columns for all tables
      const updatedDataSources = flowDataSources.map(source => ({
        ...source,
        tables: source.tables.map(table => ({
          ...table,
          selected: true,
          columns: table.columns.map(column => ({
            ...column,
            selected: true
          }))
        }))
      }));
      setDataSources(updatedDataSources);
    } else {
      // No mock data fallback - use empty data sources
      console.log('⚠️ No upstream nodes found - using empty data sources');
      setDataSources([]);
      setSelectedTables([]);
    }
  }, [flowDataSources]);

  // Sync dragDropConnections with store whenever they change
  useEffect(() => {
    if (dragDropConnections.length > 0) {
      console.log('🔄 Syncing dragDropConnections with store:', dragDropConnections.length);
      setConnectionsWithSelectedData(dragDropConnections);
    }
  }, [dragDropConnections, setConnectionsWithSelectedData]);

  // Initialize connections from payload when component loads
  useEffect(() => {
    const payload = currentNode?.data?.node?.payload;
    const savedNode = !!payload?.saved_node;
    
    console.log('🔄 Initializing connections from payload/store:', {
      hasPayload: !!payload,
      hasFieldRules: !!payload?.field_rules,
      fieldRulesCount: payload?.field_rules?.length || 0,
      storeConnectionsCount: connectionsWithSelectedData.length,
      currentDragDropConnections: dragDropConnections.length
    });
    
    // Priority 1: Load from store if saved is true and we don't have local connections
    if (savedNode && connectionsWithSelectedData.length > 0 && dragDropConnections.length === 0) {
      console.log('📝 Loading connections from validation store:', connectionsWithSelectedData.length);
      setDragDropConnections(connectionsWithSelectedData);
      return;
    }
    
    // Priority 2: Load from payload field_rules if available and we don't have connections
    if (payload?.field_rules && Array.isArray(payload.field_rules) && payload.field_rules.length > 0 && dragDropConnections.length === 0) {
      console.log('📝 Converting payload field_rules to connections:', payload.field_rules.length);
      
      const connectionsFromPayload = payload.field_rules
        .filter((rule: any) => rule?.sourceColumn && rule?.targetColumn) // Filter out invalid rules
        .map((rule: any, index: number) => {
          const sourceCol = rule.sourceColumn || {};
          const targetCol = rule.targetColumn || {};
          
          const connectionId = `${sourceCol.application || 'unknown'}_${sourceCol.table || 'unknown'}_${sourceCol.name || 'unknown'}_to_${targetCol.application || 'unknown'}_${targetCol.table || 'unknown'}_${targetCol.name || 'unknown'}_${Date.now()}_${index}`;
          const derivedRuleName =
            rule?.rule ||
            (sourceCol.table
              ? `${sourceCol.table}_VS_${targetCol.table || sourceCol.table}`
              : `${sourceCol.application || 'SOURCE'}_VS_${targetCol.application || 'TARGET'}`);
          const storeRuleEntry = isPlainObject(validationRulesMap)
            ? validationRulesMap[derivedRuleName]
            : undefined;
          const resolvedRuleId = storeRuleEntry?.uiState?.id || storeRuleEntry?.id || null;
          
          return {
            id: connectionId,
            sourceColumn: {
              name: sourceCol.name || '',
              type: sourceCol.type || 'string',
              table: sourceCol.table || '',
              source: sourceCol.source || 'left',
              application: sourceCol.application || ''
            },
            targetColumn: {
              name: targetCol.name || '',
              type: targetCol.type || 'string',
              table: targetCol.table || '',
              source: targetCol.source || 'right',
              application: targetCol.application || ''
            },
            connectionType: 'drag-drop' as const,
            ruleName: derivedRuleName,
            ruleId: resolvedRuleId,
          };
        });
      
      console.log('✅ Created connections from payload:', connectionsFromPayload);
      setDragDropConnections(connectionsFromPayload);
      
      // Also store in validation store for persistence
      setConnectionsWithSelectedData(connectionsFromPayload);
    } else if (dragDropConnections.length === 0) {
      console.log('ℹ️ No connections to load from payload or store');
    }
  }, [currentNode?.data?.node?.payload, connectionsWithSelectedData.length, dragDropConnections.length, setConnectionsWithSelectedData, validationRulesMap]);

  // Initialize connection key states from payload/store field_rules when component loads or payload changes
  useEffect(() => {
    const payload = currentNode?.data?.node?.payload;

    const aggregatedFieldRules: any[] = [];

    if (Array.isArray(payload?.field_rules)) {
      aggregatedFieldRules.push(...payload.field_rules);
    }

    if (isPlainObject(payload?.rules)) {
      Object.values(payload?.rules as Record<string, any>).forEach((ruleData: any) => {
        if (Array.isArray(ruleData?.field_rules)) {
          aggregatedFieldRules.push(...ruleData.field_rules);
        }
      });
    }

    if (isPlainObject(validationRulesMap)) {
      Object.values(validationRulesMap as Record<string, any>).forEach((ruleData: any) => {
        if (Array.isArray(ruleData?.field_rules)) {
          aggregatedFieldRules.push(...ruleData.field_rules);
        }
      });
    }

    if (aggregatedFieldRules.length === 0) {
      return;
    }

    const connectionIdsByBase: Record<string, string[]> = {};

    dragDropConnections.forEach((connection) => {
      const sourceCol = connection.sourceColumn || {};
      const targetCol = connection.targetColumn || {};

      const baseId = `${sourceCol.application}-${sourceCol.table}-${sourceCol.name || sourceCol.column}-to-${targetCol.application}-${targetCol.table}-${targetCol.name || targetCol.column}`;

      if (!connectionIdsByBase[baseId]) {
        connectionIdsByBase[baseId] = [];
      }
      connectionIdsByBase[baseId].push(connection.id);
    });

    const desiredState: Record<string, { isPrimaryKey: boolean; isValidationKey: boolean }> = {};

    aggregatedFieldRules.forEach((rule) => {
      if (!rule?.sourceColumn || !rule?.targetColumn) {
        return;
      }

      const sourceColumn = rule.sourceColumn;
      const targetColumn = rule.targetColumn;

      const baseConnectionId = `${sourceColumn.application}-${sourceColumn.table}-${sourceColumn.name}-to-${targetColumn.application}-${targetColumn.table}-${targetColumn.name}`;

      const keyStates = {
        isPrimaryKey: Boolean(sourceColumn.isPrimaryKey || targetColumn.isPrimaryKey),
        isValidationKey: Boolean(sourceColumn.isValidationKey || targetColumn.isValidationKey),
      };

      desiredState[baseConnectionId] = keyStates;

      const matchingConnectionIds = connectionIdsByBase[baseConnectionId] || [];

      matchingConnectionIds.forEach((connectionId) => {
        desiredState[connectionId] = keyStates;
      });
    });

    if (Object.keys(desiredState).length === 0) {
      return;
    }

    setConnectionKeyStates((prev) => {
      let hasChanges = false;
      const updatedState = { ...prev };

      Object.entries(desiredState).forEach(([connectionId, state]) => {
        const current = prev[connectionId];
        if (
          !current ||
          current.isPrimaryKey !== state.isPrimaryKey ||
          current.isValidationKey !== state.isValidationKey
        ) {
          updatedState[connectionId] = state;
          hasChanges = true;
        }
      });

      return hasChanges ? updatedState : prev;
    });
  }, [
    currentNode?.data?.node?.payload,
    validationRulesMap,
    dragDropConnections,
  ]);

  const convertConnectionsToFieldRules = (connections: any[]): any[] => {
    return connections.map((conn) => {
      const derivedRuleName = conn.singleRule
        ? `${conn.sourceColumn.table}_VS_${conn.sourceColumn.table}`
        : `${conn.sourceColumn.table}_VS_${conn.targetColumn.table}`;
      const ruleName = conn.ruleName || derivedRuleName;

      const keyState = getConnectionKeyState(conn.id);

      const rule = {
        rule: ruleName,
        sourceColumn: {
          name: conn.sourceColumn?.name || '',
          type: conn.sourceColumn?.type || 'string',
          table: conn.sourceColumn?.table || '',
          source: conn.sourceColumn?.source || 'left',
          application: conn.sourceColumn?.application || '',
          isPrimaryKey: keyState.isPrimaryKey,
          isValidationKey: keyState.isValidationKey,
        },
        targetColumn: conn.singleRule
          ? {
              name: conn.sourceColumn?.name || '',
              type: conn.sourceColumn?.type || 'string',
              table: conn.sourceColumn?.table || '',
              source: conn.sourceColumn?.source || 'left',
              application: conn.sourceColumn?.application || '',
              isPrimaryKey: false,
              isValidationKey: true,
              singleRule: true,
              singleRuleType: conn.singleRuleType,
              constantValue: conn.constantValue,
              singleOperation: conn.singleOperation,
            }
          : {
              name: conn.targetColumn?.name || '',
              type: conn.targetColumn?.type || 'string',
              table: conn.targetColumn?.table || '',
              source: conn.targetColumn?.source || 'right',
              application: conn.targetColumn?.application || '',
              isPrimaryKey: keyState.isPrimaryKey,
              isValidationKey: keyState.isValidationKey,
            },
      };

      if (
        conn.singleRule &&
        conn.singleRuleType === 'text' &&
        conn.constantValue
      ) {
        (rule.targetColumn as any).json = JSON.stringify({
          type: 'constant',
          value: conn.constantValue,
          operation: conn.singleOperation || 'equals',
          sourceColumn: {
            name: conn.sourceColumn?.name,
            table: conn.sourceColumn?.table,
            application: conn.sourceColumn?.application,
          },
          constantValue: conn.constantValue,
          ruleType: 'single_rule_text',
        });
      }

      if (
        conn.singleRule &&
        conn.singleRuleType === 'field' &&
        conn.singleOperation
      ) {
        (rule.targetColumn as any).json = JSON.stringify({
          type: 'field',
          operation: conn.singleOperation,
          sourceColumn: {
            name: conn.sourceColumn?.name,
            table: conn.sourceColumn?.table,
            application: conn.sourceColumn?.application,
          },
          ruleType: 'single_rule_field',
        });
      }

      return rule;
    });
  };

  const autoValidateConnections = (connections: any[]) => {
    const fieldRules = convertConnectionsToFieldRules(connections);
    const ruleConfigurations: any[] = [];

    connections.forEach((conn) => {
      const sourceValue = conn.sourceColumnValue;
      const targetValue = conn.targetColumnValue || conn.constantValue;
      const valuesMatch =
        sourceValue !== undefined &&
        targetValue !== undefined &&
        String(sourceValue) === String(targetValue);

      if (valuesMatch && !conn.singleRule) {
        const derivedRuleName = `${conn.sourceColumn.table}_VS_${conn.targetColumn.table}`;
        const ruleName = conn.ruleName || derivedRuleName;
        ruleConfigurations.push({
          rule: ruleName,
          connectionId: conn.id,
          sourceColumn: {
            name: conn.sourceColumn.name,
            type: conn.sourceColumn.type,
            table: conn.sourceColumn.table,
            application: conn.sourceColumn.application,
            operation: 'equal',
            category: 'arithmetic',
            config: { compareValue: targetValue },
            applied: false,
            originalValue: sourceValue,
          },
          targetColumn: {
            name: conn.targetColumn.name,
            type: conn.targetColumn.type,
            table: conn.targetColumn.table,
            application: conn.targetColumn.application,
            operation: 'equal',
            category: 'arithmetic',
            config: { compareValue: sourceValue },
            applied: false,
            originalValue: targetValue,
          },
          validationStatus: {
            isValid: true,
            comparison: 'equal',
            sourceValue,
            targetValue,
            autoValidated: true,
          },
          description: 'Auto-validated: Values are equal',
          example: `${sourceValue} = ${targetValue} → PASS (Auto-validated)`,
        });
      }
    });

    return {
      field_rules: fieldRules,
      rule_configuration: ruleConfigurations,
      autoValidated: ruleConfigurations.length > 0,
    };
  };

  const savedNode = !!currentNode?.data?.node?.payload?.saved_node;
  const [selectedMappingForPreview, setSelectedMappingForPreview] = useState<any>(null);
  const [selectedColumnForFilter, setSelectedColumnForFilter] = useState<{ name: string; type: string; table?: string; isSource: boolean; isTarget: boolean } | null>(null);
  const [filtersByColumn, setFiltersByColumn] = useState<Record<string, any>>({});
  const [showMergeView, setShowMergeView] = useState(false);
  const [selectedSourceTab, setSelectedSourceTab] = useState<string>('');
  const [isAddRuleDialogOpen, setIsAddRuleDialogOpen] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  
  const [leftDropZoneTables, setLeftDropZoneTables] = useState<Set<string>>(
    new Set()
  );
  const [rightDropZoneTables, setRightDropZoneTables] = useState<Set<string>>(
    new Set()
  );

  const sourceRestrictedTables = React.useMemo(() => {
    const restricted = new Set<string>();

    if (leftDropZoneTables.size === 0) {
      rightDropZoneTables.forEach((table) => restricted.add(table));
    }

    return restricted;
  }, [leftDropZoneTables.size, rightDropZoneTables]);

  const validationRestrictedTables = React.useMemo(() => {
    const restricted = new Set<string>();

    if (rightDropZoneTables.size === 0) {
      leftDropZoneTables.forEach((table) => restricted.add(table));
    }

    return restricted;
  }, [leftDropZoneTables, rightDropZoneTables.size]);

  const handleDropZoneTablesChange = React.useCallback(
    (leftTables: Set<string>, rightTables: Set<string>) => {
      setLeftDropZoneTables(leftTables);
      setRightDropZoneTables(rightTables);
    },
    []
  );

  const handleSubmitRules = React.useCallback((rules: any) => {
    setSubmitRules((prev) => {
      if (prev && prev.field_rules) {
        const existingFieldRules = prev.field_rules || [];
        const newFieldRules = rules.field_rules || [];

        const mergedFieldRules = [...existingFieldRules];
        newFieldRules.forEach((newRule: any) => {
          const isDuplicate = existingFieldRules.some(
            (existing: any) =>
              existing.rule === newRule.rule &&
              existing.sourceColumn?.name === newRule.sourceColumn?.name &&
              existing.targetColumn?.name === newRule.targetColumn?.name
          );

          if (!isDuplicate) {
            mergedFieldRules.push(newRule);
          }
        });

        const existingRuleConfig = prev.rule_configuration || [];
        const newRuleConfig = rules.rule_configuration || [];
        const mergedRuleConfig = [...existingRuleConfig];

        newRuleConfig.forEach((newConfig: any) => {
          const isDuplicate = existingRuleConfig.some(
            (existing: any) =>
              existing.rule === newConfig.rule &&
              existing.sourceColumn?.name === newConfig.sourceColumn?.name &&
              existing.targetColumn?.name === newConfig.targetColumn?.name
          );

          if (!isDuplicate) {
            mergedRuleConfig.push(newConfig);
          }
        });

        const updatedRules = {
          field_rules: mergedFieldRules,
          rule_configuration: mergedRuleConfig,
          timestamp: new Date().toISOString(),
        };

        // Store in validation store
        setStoreSubmitRules(updatedRules);

        toast.success(
          `Rules updated: ${mergedFieldRules.length} field rule(s) total`
        );

        return updatedRules;
      }

      // Store in validation store
      setStoreSubmitRules(rules);

      toast.success(
        `Rules set: ${rules.field_rules?.length || 0} field rule(s)`
      );
      return rules;
    });
  }, [setStoreSubmitRules]);

  const handleDataSourceUpdate = (
    sourceId: string,
    updatedSource: DataSource
  ) => {
    setDataSources((prev) =>
      prev.map((source) => (source.id === sourceId ? updatedSource : source))
    );
  };

  const handleColumnSelected = (
    columns: {
      application: string;
      table: string;
      column: string;
      type: string;
    }[]
  ) => {
    setSelectedColumns(columns);

    const newConnections = columns.map((column) => ({
      id: `${column.application}-${column.table}-${column.column}`,
      sourceColumn: column,
      connectionType: 'single' as const,
    }));

    setColumnConnections((prev) => {
      const existingMappedConnections = prev.filter(
        (conn) => conn.connectionType === 'mapped'
      );
      return [...existingMappedConnections, ...newConnections];
    });
  };

  const handleAddSource = (newSource: Omit<DataSource, 'id'>) => {
    const sourceWithId: DataSource = {
      ...newSource,
      id: Date.now().toString(),
    };
    setDataSources((prev) => [...prev, sourceWithId]);
  };

  // Use rule management hook
  const {
    rules,
    activeRuleId,
    ruleViewStates,
    getRuleViewState,
    setRuleViewState,
    removeRule,
    setActiveRuleId,
    setRules,
  } = useRuleManagement();

  // Use filter save hook - pass activeRuleId and rules to store filters per rule
  const {
    handleFilterSave,
    filterConditionsBySource,
    setFilterConditionsBySource,
  } = useFilterSave(currentNode, activeRuleId, rules);

  const isPlainObject = (value: unknown): value is Record<string, any> => {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  };

  const areFilterMapsEqual = (
    first?: Record<string, any>,
    second?: Record<string, any>
  ): boolean => {
    const mapA = isPlainObject(first) ? first : {};
    const mapB = isPlainObject(second) ? second : {};

    const keysA = Object.keys(mapA);
    const keysB = Object.keys(mapB);

    if (keysA.length !== keysB.length) {
      return false;
    }

    return keysA.every((key) => {
      const valueA = mapA[key];
      const valueB = mapB[key];

      try {
        return JSON.stringify(valueA) === JSON.stringify(valueB);
      } catch (error) {
        console.warn('Failed to compare filter values for key', key, error);
        return false;
      }
    });
  };

  const areRuleMapsEqual = (
    first?: Record<string, any>,
    second?: Record<string, any>
  ): boolean => {
    const mapA = isPlainObject(first) ? first : {};
    const mapB = isPlainObject(second) ? second : {};

    const keysA = Object.keys(mapA);
    const keysB = Object.keys(mapB);

    if (keysA.length !== keysB.length) {
      return false;
    }

    return keysA.every((key) => {
      try {
        return JSON.stringify(mapA[key]) === JSON.stringify(mapB[key]);
      } catch (error) {
        console.warn('Failed to compare rule values for key', key, error);
        return false;
      }
    });
  };

  const normalizeRulesMap = (
    rawMap?: Record<string, any>,
    seed: number = Date.now()
  ): Record<string, any> => {
    if (!isPlainObject(rawMap)) {
      return {};
    }

    const normalizedEntries: Record<string, any> = {};

    Object.entries(rawMap).forEach(([ruleName, value], index) => {
      const safeValue = isPlainObject(value) ? { ...value } : {};
      const existingUiState = isPlainObject(safeValue.uiState) ? safeValue.uiState : {};
      const existingId = existingUiState.id || safeValue.id;
      const ruleId = existingId || `rule_${ruleName}_${seed + index}`;

      normalizedEntries[ruleName] = {
        ...safeValue,
        uiState: {
          ...existingUiState,
          id: ruleId,
          name: ruleName,
        },
      };
    });

    return normalizedEntries;
  };

  const buildRulesFromMap = (rulesMap?: Record<string, any>): ValidationRule[] => {
    if (!isPlainObject(rulesMap)) {
      return [];
    }

    return Object.keys(rulesMap).map((ruleName) => {
      const ruleData = rulesMap[ruleName] || {};
      const uiState = isPlainObject(ruleData.uiState) ? ruleData.uiState : {};
      const ruleId = uiState.id || ruleData.id || `rule_${ruleName}`;

      return {
        id: ruleId,
        name: ruleName,
        connections: ruleData.connections || [],
      } as ValidationRule;
    });
  };

  // Load column_filters and filter_conditions from payload and validation store when component loads
  // This effect runs after dataSources and setFilterConditionsBySource are available
  useEffect(() => {
    if (!currentNode?.id || !dataSources || dataSources.length === 0 || !setFilterConditionsBySource) return;
    const payload = currentNode?.data?.node?.payload;
    
    // Create mapping between source names (table names) and source IDs
    const sourceNameToIdMap: Record<string, string> = {};
    dataSources.forEach(source => {
      source.tables.forEach(table => {
        sourceNameToIdMap[table.name] = source.id;
        sourceNameToIdMap[source.name] = source.id;
        sourceNameToIdMap[source.id] = source.id;
      });
    });
    
    // Try to load column_filters from validation store first
    const safeStoreFilters = isPlainObject(storeColumnFilters) ? storeColumnFilters : {};
    
    if (Object.keys(safeStoreFilters).length > 0) {
      setColumnFiltersBySource((prev) => {
        return areFilterMapsEqual(prev, safeStoreFilters) ? prev : safeStoreFilters;
      });
    } else {
      // Load column_filters from payload - check inside each rule's source keys
      if (payload) {
        const loadedColumnFilters: Record<string, any> = {};
        
        // Iterate through all keys in payload to find rule dictionaries
        Object.keys(payload).forEach(key => {
          const ruleData = payload[key];
          // Check if this is a rule dictionary (has datasets, field_rules, or source keys)
          if (ruleData && typeof ruleData === 'object' && !Array.isArray(ruleData)) {
            // Check each key in the rule data for source keys
            Object.keys(ruleData).forEach(sourceKey => {
              // Skip known rule-level keys
              if (['datasets', 'field_rules', 'rule_configuration'].includes(sourceKey)) {
                return;
              }
              
              // This might be a source key - check if it has column_filters
              const sourceData = ruleData[sourceKey];
              if (sourceData && typeof sourceData === 'object' && sourceData.column_filters) {
                loadedColumnFilters[sourceKey] = sourceData.column_filters;
                // Also store by source ID if we can find it
                const sourceId = sourceNameToIdMap[sourceKey];
                if (sourceId) {
                  loadedColumnFilters[sourceId] = sourceData.column_filters;
                }
              }
            });
          }
        });
        
        if (Object.keys(loadedColumnFilters).length > 0) {
          setColumnFiltersBySource((prev) => {
            return areFilterMapsEqual(prev, loadedColumnFilters) ? prev : loadedColumnFilters;
          });

          if (!areFilterMapsEqual(safeStoreFilters, loadedColumnFilters)) {
            setStoreColumnFilters(loadedColumnFilters);
          }
        }
      }
    }
    
    // Load filter_conditions from payload to display in code editor
    // Only load filters for the active rule
    if (payload && activeRuleId && rules && rules.length > 0) {
      const activeRule = rules.find(r => r.id === activeRuleId);
      const activeRuleName = activeRule?.name;
      
      // If no active rule found, skip loading filters
      if (!activeRuleName) {
        return;
      }
      
      const loadedFilterConditions: Record<string, any[]> = {};
      
      // Iterate through all keys in payload to find rule dictionaries
      Object.keys(payload).forEach(key => {
        const ruleData = payload[key];
        // Check if this is a rule dictionary (has datasets, field_rules, or source keys)
        // Only load filters for the active rule
        if (key === activeRuleName && ruleData && typeof ruleData === 'object' && !Array.isArray(ruleData)) {
          // Check each key in the rule data for source keys
          Object.keys(ruleData).forEach(sourceKey => {
            // Skip known rule-level keys
            if (['datasets', 'field_rules', 'rule_configuration'].includes(sourceKey)) {
              return;
            }
            
            // This might be a source key - check if it has filter_conditions
            const sourceData = ruleData[sourceKey];
            if (sourceData && typeof sourceData === 'object' && Array.isArray(sourceData.filter_conditions) && sourceData.filter_conditions.length > 0) {
              // Store using ruleId:sourceId key for per-rule isolation
              const sourceId = sourceNameToIdMap[sourceKey] || sourceKey;
              const stateKey = `${activeRuleId}:${sourceId}`;
              loadedFilterConditions[stateKey] = sourceData.filter_conditions;
              // Also store by sourceId for backward compatibility
              loadedFilterConditions[sourceId] = sourceData.filter_conditions;
              loadedFilterConditions[sourceKey] = sourceData.filter_conditions;
            }
          });
        }
      });
      
      // Also check top-level filter_conditions_by_source
      // Only load filters for the active rule (filter by rule name in filter conditions)
      if (payload.filter_conditions_by_source && typeof payload.filter_conditions_by_source === 'object') {
        Object.keys(payload.filter_conditions_by_source).forEach(sourceKey => {
          const conditions = payload.filter_conditions_by_source[sourceKey];
          if (Array.isArray(conditions) && conditions.length > 0) {
            // Filter conditions by active rule name
            const ruleFilterConditions = conditions.filter((filter: any) => {
              // If filter has rule property, only include if it matches active rule
              if (filter?.rule && activeRuleName) {
                return filter.rule === activeRuleName;
              }
              // If no rule property, include only if no active rule (backward compatibility)
              return !activeRuleName;
            });
            
            if (ruleFilterConditions.length > 0) {
              const sourceId = sourceNameToIdMap[sourceKey] || sourceKey;
              const stateKey = `${activeRuleId}:${sourceId}`;
              loadedFilterConditions[stateKey] = ruleFilterConditions;
              // Also store by sourceId for backward compatibility
              loadedFilterConditions[sourceId] = ruleFilterConditions;
              loadedFilterConditions[sourceKey] = ruleFilterConditions;
            }
          }
        });
      }
      
      // Update filterConditionsBySource in the hook if we have loaded data
      // Only load filters for the active rule - reset filters when switching rules
      if (Object.keys(loadedFilterConditions).length > 0) {
        setFilterConditionsBySource((prev: Record<string, any[]>) => {
          // Start with existing state - keep filters for other rules
          const newState: Record<string, any[]> = { ...prev };
          
          // Remove filters for the current active rule (to reset them)
          if (activeRuleId) {
            Object.keys(newState).forEach(key => {
              if (key.startsWith(`${activeRuleId}:`)) {
                delete newState[key];
              }
            });
          }
          
          // Add loaded filters for the active rule
          Object.keys(loadedFilterConditions).forEach(key => {
            if (loadedFilterConditions[key] && loadedFilterConditions[key].length > 0) {
              newState[key] = loadedFilterConditions[key];
            }
          });
          
          return newState;
        });
        
        // Store filters per rule in validation store
        if (activeRuleId && activeRuleName && setStoreColumnFilters) {
          try {
            const ruleFilters: Record<string, any> = {};
            Object.keys(loadedFilterConditions).forEach(key => {
              const filterData = loadedFilterConditions[key];
              if (Array.isArray(filterData) && filterData.length > 0) {
                if (key.startsWith(`${activeRuleId}:`)) {
                  const sourceId = key.replace(`${activeRuleId}:`, '');
                  ruleFilters[sourceId] = filterData;
                } else if (!key.includes(':')) {
                  // Also store source-only keys for this rule
                  ruleFilters[key] = filterData;
                }
              }
            });
            
            if (Object.keys(ruleFilters).length > 0) {
              const existingRuleFilters = isPlainObject(safeStoreFilters)
                ? safeStoreFilters[`rule_${activeRuleId}`]
                : undefined;

              const shouldUpdateRuleFilters = !areFilterMapsEqual(
                existingRuleFilters,
                ruleFilters
              );

              if (shouldUpdateRuleFilters) {
                const nextStoreFilters = {
                  ...safeStoreFilters,
                  [`rule_${activeRuleId}`]: ruleFilters
                };

                setStoreColumnFilters(nextStoreFilters);
              }
            }
          } catch (error) {
            console.error('Error storing filters for rule:', error);
          }
        }
      }
    }
  }, [
    currentNode?.id,
    currentNode?.data?.node?.payload,
    storeColumnFilters,
    setStoreColumnFilters,
    dataSources,
    setFilterConditionsBySource,
    activeRuleId,
    rules
  ]);
  
  const activeRuleConnections = useMemo(() => {
    if (!activeRuleId) {
      return dragDropConnections;
    }

    const activeRule = rules.find((rule) => rule.id === activeRuleId);
    const activeRuleName = activeRule?.name;

    return dragDropConnections.filter((connection: any) => {
      if (connection.ruleId && connection.ruleId === activeRuleId) {
        return true;
      }

      const sourceTable = connection?.sourceColumn?.table || 'SOURCE';
      const targetTable =
        connection?.targetColumn?.table ||
        connection?.sourceColumn?.table ||
        'TARGET';
      const derivedRuleName = connection?.ruleName
        ? connection.ruleName
        : connection?.singleRule
        ? `${sourceTable}_VS_${sourceTable}`
        : `${sourceTable}_VS_${targetTable}`;

      if (activeRuleName && derivedRuleName === activeRuleName) {
        return true;
      }

      if (!connection.ruleId && !connection.ruleName && rules.length <= 1) {
        return true;
      }

      return false;
    });
  }, [activeRuleId, dragDropConnections, rules]);
  
  // Get connected sources for the active rule based on connections (moved outside conditional for hooks)
  const activeRuleSources = useMemo(() => {
    if (!activeRuleId) return [];
    
    const tableNamesSet = new Set<string>();
    activeRuleConnections.forEach((conn: any) => {
      if (conn.sourceColumn?.table) {
        tableNamesSet.add(conn.sourceColumn.table);
      }
      if (conn.targetColumn?.table) {
        tableNamesSet.add(conn.targetColumn.table);
      }
    });

    const matchingSources: DataSource[] = [];
    dataSources.forEach((source) => {
      const hasMatchingTable = source.tables.some((table) =>
        tableNamesSet.has(table.name)
      );
      if (hasMatchingTable) {
        matchingSources.push(source);
      }
    });

    return matchingSources;
  }, [activeRuleId, activeRuleConnections, dataSources]);

  // If no sources found, use all dataSources
  const sourcesToShow = activeRuleSources.length > 0 ? activeRuleSources : dataSources;

  // Update selected tab when sources change (for filter node view inside rules)
  useEffect(() => {
    const anyRuleShowingFilterNode = Object.values(ruleViewStates).some(state => state.showFilterNode);
    if (anyRuleShowingFilterNode && sourcesToShow.length > 0 && (!selectedSourceTab || !sourcesToShow.find(s => s.id === selectedSourceTab))) {
      setSelectedSourceTab(sourcesToShow[0].id);
    }
  }, [ruleViewStates, sourcesToShow, selectedSourceTab]);
  
  // Track if rules have been initialized to prevent resetting
  const rulesInitializedRef = React.useRef(false);
  
  // Initialize rules from validation store or payload when component loads (only once per node)
  useEffect(() => {
    const payload = currentNode?.data?.node?.payload;

    if (rulesInitializedRef.current || rules.length > 0) {
      return;
    }

    const storeRules = isPlainObject(validationRulesMap) ? validationRulesMap : {};
    const storeHasRules = Object.keys(storeRules).length > 0;

    let sourceRulesMap: Record<string, any> | undefined;
    let shouldPersistToStore = false;

    if (storeHasRules) {
      sourceRulesMap = storeRules;
    } else if (isPlainObject(payload?.rules)) {
      sourceRulesMap = normalizeRulesMap(payload?.rules);
      shouldPersistToStore = true;
    } else if (Array.isArray(payload?.rules) && payload.rules.length > 0) {
      const arrayRulesMap: Record<string, any> = {};
      payload.rules.forEach((rule: any, index: number) => {
        const ruleName =
          rule?.name || rule?.ruleName || rule?.uiState?.name || `Rule ${index + 1}`;
        arrayRulesMap[ruleName] = { ...rule };
      });
      sourceRulesMap = normalizeRulesMap(arrayRulesMap);
      shouldPersistToStore = true;
    } else if (Array.isArray(payload?.field_rules) && payload.field_rules.length > 0) {
      const groupedRules: Record<string, any> = {};
      payload.field_rules.forEach((fieldRule: any) => {
        const ruleName =
          fieldRule?.rule ||
          `${fieldRule?.sourceColumn?.table || 'SOURCE'}_VS_${fieldRule?.targetColumn?.table || 'TARGET'}`;
        if (!groupedRules[ruleName]) {
          groupedRules[ruleName] = { field_rules: [] };
        }
        groupedRules[ruleName].field_rules = [
          ...(groupedRules[ruleName].field_rules || []),
          fieldRule,
        ];
      });
      sourceRulesMap = normalizeRulesMap(groupedRules);
      shouldPersistToStore = true;
    }

    if (sourceRulesMap && Object.keys(sourceRulesMap).length > 0) {
      if (shouldPersistToStore && !areRuleMapsEqual(storeRules, sourceRulesMap)) {
        setValidationRulesMap(sourceRulesMap);
      }

      const loadedRules = buildRulesFromMap(sourceRulesMap);

      if (loadedRules.length > 0) {
        setRules(loadedRules);
        const firstRuleId = loadedRules[0].id;
        setActiveRuleId(firstRuleId);
        setRuleViewState(firstRuleId, {
          showFiltersPage: false,
          showConnectionsPage: false,
        });
        rulesInitializedRef.current = true;
      }
    }
  }, [
    currentNode?.data?.node?.payload,
    currentNode?.id,
    validationRulesMap,
    rules.length,
    setRules,
    setActiveRuleId,
    setRuleViewState,
    setValidationRulesMap,
  ]);

  // Reset initialization flag when node changes
  useEffect(() => {
    if (currentNode?.id) {
      rulesInitializedRef.current = false;
    }
  }, [currentNode?.id]);

  // Rule management functions
  const addRule = (name: string) => {
    const ruleName = name.trim() || `Rule ${rules.length + 1}`;

    const duplicateRule = rules.some(
      (rule) => rule.name.toLowerCase() === ruleName.toLowerCase()
    );

    if (duplicateRule) {
      toast.info('A rule with this name already exists');
      return;
    }

    const newRule: ValidationRule = {
      id: `rule_${ruleName}_${Date.now()}`,
      name: ruleName,
      connections: []
    };
    setRules(prev => {
      // Mark as initialized when manually adding rules
      rulesInitializedRef.current = true;
      return [...prev, newRule];
    });
    setActiveRuleId(newRule.id);
    // Show default view (sources and connections panel) for the new rule
    setRuleViewState(newRule.id, { showFiltersPage: false, showConnectionsPage: false });
    setIsAddRuleDialogOpen(false);
    setNewRuleName('');

    // Only include field_rules if there's existing data, don't create empty arrays for new rules
    const existingRuleData = isPlainObject(validationRulesMap?.[ruleName])
      ? validationRulesMap[ruleName]
      : {};
    
    const newRuleData: Record<string, any> = {
      ...existingRuleData,
      connections: [],
      uiState: {
        id: newRule.id,
        name: ruleName,
      },
    };
    
    // Only include field_rules and rule_configuration if they exist in existing data
    // Don't create empty arrays for new rules
    if (Array.isArray(existingRuleData.field_rules) && existingRuleData.field_rules.length > 0) {
      newRuleData.field_rules = existingRuleData.field_rules;
    }
    if (Array.isArray(existingRuleData.rule_configuration) && existingRuleData.rule_configuration.length > 0) {
      newRuleData.rule_configuration = existingRuleData.rule_configuration;
    }
    
    upsertValidationRule(ruleName, newRuleData);
  };

  // Enhanced removeRule to also clean up connections
  const removeRuleWithConnections = (ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;
    
    // Remove connections associated with this rule
    const ruleConnections = dragDropConnections.filter(conn => {
      const connection = conn as any;
      const ruleName = connection.singleRule
        ? `${connection.sourceColumn.table}_VS_${connection.sourceColumn.table}`
        : `${connection.sourceColumn.table}_VS_${connection.targetColumn.table}`;
      return rule.name === ruleName;
    });
    
    ruleConnections.forEach(conn => {
      handleDragDropConnectionRemove(conn.id);
    });
    
    // Call hook's removeRule after cleaning up connections
    removeValidationRule(rule.name);
    removeRule(ruleId);
  };

  // Get connections for the active rule
  // activeRuleConnections is defined earlier in the file for use across rule views.
  
  // Store K/V button states for each connection
  const [connectionKeyStates, setConnectionKeyStates] = useState<Record<string, {
    isPrimaryKey: boolean;
    isValidationKey: boolean;
  }>>({});

  const handleSave = async () => {
    if (!currentNode?.data?.node?.save_node) {
      toast.error('Save endpoint not configured for this node');
      return;
    }

    setIsSaving(true);
    try {
      // Convert connections to field_rules if not already done
      let fieldRulesToSave = submitRules?.field_rules || [];
      let ruleConfigToSave = submitRules?.rule_configuration || [];
      
      // Always ensure field_rules are saved from connections (even if no operations)
      if (dragDropConnections.length > 0) {
        // Try to get operations payload from ConnectionsPage if available
        // This will include operations configured even if "Submit Rules" wasn't clicked
        if (getOperationsPayloadFn) {
          try {
            const operationsPayload = getOperationsPayloadFn();
            if (operationsPayload) {
              // If we don't have field_rules yet, use from operations payload
              if (fieldRulesToSave.length === 0) {
                fieldRulesToSave = operationsPayload.field_rules || [];
              }
              
              // Always merge rule_configuration from operations payload (if available)
              if (operationsPayload.rule_configuration && operationsPayload.rule_configuration.length > 0) {
                // Get existing connection IDs from current rule_configuration
                const existingConfigIds = new Set();
                ruleConfigToSave.forEach((category: any) => {
                  if (category.operations) {
                    category.operations.forEach((op: any) => {
                      if (op.connectionId) {
                        existingConfigIds.add(op.connectionId);
                      }
                    });
                  }
                });
                
                // Merge operations payload
                operationsPayload.rule_configuration.forEach((category: any) => {
                  const existingCategory = ruleConfigToSave.find((c: any) => c.category === category.category);
                  if (existingCategory) {
                    // Merge operations, avoiding duplicates
                    const newOps = (category.operations || []).filter((op: any) => 
                      !existingConfigIds.has(op.connectionId)
                    );
                    if (newOps.length > 0) {
                      existingCategory.operations = [...(existingCategory.operations || []), ...newOps];
                    }
                  } else {
                    // Add new category
                    ruleConfigToSave.push(category);
                  }
                });
                
                console.log('✅ Merged operations payload from ConnectionsPage:', {
                  fieldRules: fieldRulesToSave.length,
                  ruleConfig: ruleConfigToSave.length
                });
              }
            }
          } catch (error) {
            console.warn('⚠️ Could not get operations payload:', error);
          }
        }
        
        // If we still don't have field_rules yet, convert connections
        // Merge dragDropConnections with connectionsWithSelectedData to include single side rules
        if (fieldRulesToSave.length === 0) {
          // Merge all connections (including single side rules from store)
          const allConnectionsToConvert = [...dragDropConnections];
          
          // Add single side rules from store that aren't already in dragDropConnections
          connectionsWithSelectedData.forEach((storeConn: any) => {
            const isSingleRule = storeConn.singleRule;
            if (isSingleRule) {
              const exists = dragDropConnections.some((conn: any) => conn.id === storeConn.id);
              if (!exists) {
                allConnectionsToConvert.push(storeConn);
                console.log('✅ Including single side rule from store:', storeConn.id);
              }
            }
          });
          
          fieldRulesToSave = convertConnectionsToFieldRules(allConnectionsToConvert);
          console.log('✅ Converted connections to field_rules:', {
            total: fieldRulesToSave.length,
            dragDropCount: dragDropConnections.length,
            storeCount: connectionsWithSelectedData.length,
            singleRules: fieldRulesToSave.filter((r: any) => r.targetColumn?.singleRule).length
          });
        }
        
        // Check for auto-validation (matching values) if no operations payload
        if (ruleConfigToSave.length === 0) {
          const autoValidated = autoValidateConnections(dragDropConnections);
          
          // If no rule_configuration exists but we have auto-validated connections, use them
          if (autoValidated.autoValidated) {
            ruleConfigToSave = autoValidated.rule_configuration;
            toast.success(`Auto-validated ${autoValidated.rule_configuration.length} connection(s) with matching values`);
          }
        }
      }
      
      // Create datasets structure same as multisource validation - stringified JSON data from previous nodes
      const datasets: { [key: string]: string } = {};
      
      // Get upstream nodes (previous nodes in the workflow)
      const getUpstreamNodes = useFlowStore.getState().getUpstreamNodes;
      const upstreamNodesForData = currentNode?.id ? getUpstreamNodes(currentNode.id) : [];
      
      // For each upstream node, get its data and store as compressed (gzip+base64) JSON
      for (const node of upstreamNodesForData) {
        const rawNodeName =
          node.data?.display_name ||
          node.data?.node?.payload?.display_name ||
          node.data?.node?.payload?.table ||
          node.data?.node?.payload?.dataset_name ||
          node.data?.label ||
          node.id;
        const normalizedNodeName = rawNodeName ? String(rawNodeName) : String(node.id);
        const flow_id = useFlowStore.getState().currentWorkflow?.flow_id;
        
        try {
          let nodeData: any = [];
          
          // Try to get data from node output first
          if (node.data?.node?.output?.data && node.data.node.output.data.length > 0) {
            nodeData = node.data.node.output.data;
          } else if (flow_id) {
            // Fallback: get data from upstream node via API
            nodeData = await getNodeOutputData(node, flow_id);
          }
          
          // Compress the dataframe using gzip+base64
          const dataframeString = JSON.stringify(nodeData);
          const compressedData = compressDataString(dataframeString);
          datasets[normalizedNodeName] = compressedData;
        } catch (error) {
          console.error(`Failed to get/compress data for node ${normalizedNodeName}:`, error);
          // Fallback to empty compressed data
          datasets[normalizedNodeName] = compressDataString(JSON.stringify([]));
        }
      }
      
      // Fallback: if no upstream nodes, use current dataSources structure
      if (Object.keys(datasets).length === 0) {
        dataSources.forEach(source => {
          const sourceKey = source.name || source.id;
          // Store empty array compressed
          datasets[sourceKey] = compressDataString(JSON.stringify([]));
        });
      }

      // Create mapping from connection IDs to user-defined rule names
      const connectionIdToUserRuleMap = new Map<string, string>();
      dragDropConnections.forEach((connection) => {
        if (connection.ruleId) {
          const userRule = rules.find((r) => r.id === connection.ruleId);
          if (userRule) {
            connectionIdToUserRuleMap.set(connection.id, userRule.name);
          }
        } else if (connection.ruleName) {
          // Check if ruleName is a user-defined rule name
          const userRule = rules.find((r) => r.name === connection.ruleName);
          if (userRule) {
            connectionIdToUserRuleMap.set(connection.id, userRule.name);
          }
        }
      });

      // Group field_rules and rule_configuration by user-defined rule name
      // But keep the table mapping rule name (like MSV_TEST_1_VS_MSV_TEST_2) in the rule field
      const rulesGroupedByUserRuleName = new Map<string, {
        ruleName: string;
        ruleId?: string | null;
        sources: Set<string>;
        field_rules: any[];
        rule_configuration: any[];
      }>();

      const ruleNameToIdMap = new Map<string, string>();
      rules.forEach((rule) => {
        ruleNameToIdMap.set(rule.name, rule.id);
        // Initialize groups for all user-defined rules
        rulesGroupedByUserRuleName.set(rule.name, {
            ruleName: rule.name,
          ruleId: rule.id,
          sources: new Set<string>(),
          field_rules: [] as any[],
          rule_configuration: [] as any[],
        });
      });

      const getGroupForConnection = (connectionId?: string, tableMappingRuleName?: string): {
        ruleName: string;
        ruleId?: string | null;
        sources: Set<string>;
        field_rules: any[];
        rule_configuration: any[];
      } | null => {
        if (!connectionId) {
          // If no connection ID, try to use the first rule
          if (rules.length > 0) {
            return rulesGroupedByUserRuleName.get(rules[0].name) || null;
          }
          return null;
        }

        const userRuleName = connectionIdToUserRuleMap.get(connectionId);
        if (userRuleName) {
          return rulesGroupedByUserRuleName.get(userRuleName) || null;
        }

        // Fallback: if no mapping found, try to find a rule that matches the table mapping rule name
        // This handles cases where connections were created before rules were created
        if (tableMappingRuleName && rules.length > 0) {
          // Check if any rule has connections with this table mapping rule name
          for (const rule of rules) {
            const ruleConnections = dragDropConnections.filter((conn) => {
              if (conn.ruleId === rule.id) {
                const sourceTable = conn.sourceColumn?.table;
                const targetTable = conn.targetColumn?.table;
                const derivedRuleName = sourceTable
                  ? `${sourceTable}_VS_${targetTable || sourceTable}`
                  : null;
                return derivedRuleName === tableMappingRuleName;
              }
              return false;
            });
            if (ruleConnections.length > 0) {
              return rulesGroupedByUserRuleName.get(rule.name) || null;
            }
          }
        }

        // Final fallback: use the first rule if available
        if (rules.length > 0) {
          return rulesGroupedByUserRuleName.get(rules[0].name) || null;
        }

        return null;
      };

      const addSourcesFromColumns = (
        group: {
          sources: Set<string>;
        },
        sourceColumn?: { table?: string },
        targetColumn?: { table?: string }
      ) => {
        if (sourceColumn?.table) {
          group.sources.add(sourceColumn.table);
        }
        if (targetColumn?.table) {
          group.sources.add(targetColumn.table);
        }
      };

      // Process field rules - keep the table mapping rule name in the rule field
      // Group each field rule by its respective user-defined rule name
      fieldRulesToSave.forEach((fieldRule: any) => {
        // Determine the table mapping rule name first
        const sourceTable = fieldRule?.sourceColumn?.table;
        const targetTable = fieldRule?.targetColumn?.table;
        const tableMappingRuleName = sourceTable
          ? `${sourceTable}_VS_${targetTable || sourceTable}`
          : fieldRule?.rule;

        // First, try to find the user-defined rule name from the fieldRule's rule property
        // The rule property might contain a user-defined rule name
        let targetRuleName: string | null = null;
        if (fieldRule?.rule) {
          // Check if the rule property matches any user-defined rule name
          const matchingUserRule = rules.find((r) => r.name === fieldRule.rule);
          if (matchingUserRule) {
            targetRuleName = matchingUserRule.name;
          }
        }

        // Find the connection that matches this field rule
        const matchingConnection = dragDropConnections.find((conn) => {
          return (
            conn.sourceColumn?.name === fieldRule.sourceColumn?.name &&
            conn.sourceColumn?.table === fieldRule.sourceColumn?.table &&
            conn.targetColumn?.name === fieldRule.targetColumn?.name &&
            conn.targetColumn?.table === fieldRule.targetColumn?.table
          );
        });

        // Determine which group this field rule belongs to
        let group: { ruleName: string; ruleId?: string | null; sources: Set<string>; field_rules: any[]; rule_configuration: any[]; } | null = null;
        
        if (targetRuleName) {
          // If we found a user-defined rule name from the fieldRule itself, use that
          group = rulesGroupedByUserRuleName.get(targetRuleName) || null;
        } else if (matchingConnection) {
          // Otherwise, use the connection to determine the rule
          group = getGroupForConnection(matchingConnection.id, tableMappingRuleName);
        }

        if (!group) {
          // If no matching connection found, use the first rule as fallback
          if (rules.length > 0) {
            const fallbackGroup = rulesGroupedByUserRuleName.get(rules[0].name);
            if (fallbackGroup) {
              // Keep the table mapping rule name in the rule field
              const normalizedFieldRule = {
                ...fieldRule,
                rule: tableMappingRuleName || fieldRule?.rule,
              };
              fallbackGroup.field_rules.push(normalizedFieldRule);
              addSourcesFromColumns(fallbackGroup, normalizedFieldRule.sourceColumn, normalizedFieldRule.targetColumn);
            }
          }
          return;
        }

        // Keep the table mapping rule name in the rule field (not the user-defined rule name)
        const normalizedFieldRule = {
          ...fieldRule,
          rule: tableMappingRuleName || fieldRule?.rule,
        };

        group.field_rules.push(normalizedFieldRule);
        addSourcesFromColumns(group, normalizedFieldRule.sourceColumn, normalizedFieldRule.targetColumn);
      });

      // Process rule configurations - preserve category structure from ConnectionsPage
      // ruleConfigToSave should be an array of category objects: [{ category: "String Operations", operations: [...] }]
      ruleConfigToSave.forEach((categoryConfig: any) => {
        // Check if this is a category object (has category and operations)
        if (categoryConfig?.category && Array.isArray(categoryConfig?.operations)) {
            // Process each operation in this category
            // Group each operation by its respective user-defined rule name
            categoryConfig.operations.forEach((operation: any) => {
              // Determine the table mapping rule name first
              const sourceTable = operation?.sourceColumn?.table;
              const targetTable = operation?.targetColumn?.table;
              const tableMappingRuleName = sourceTable
                ? `${sourceTable}_VS_${targetTable || sourceTable}`
                : operation?.rule;

              // First, try to find the user-defined rule name from the operation's rule property
              // The rule property might contain a user-defined rule name
              let targetRuleName: string | null = null;
              if (operation?.rule) {
                // Check if the rule property matches any user-defined rule name
                const matchingUserRule = rules.find((r) => r.name === operation.rule);
                if (matchingUserRule) {
                  targetRuleName = matchingUserRule.name;
                }
              }

              // Find the connection that matches this operation
              const matchingConnection = dragDropConnections.find((conn) => {
                return (
                  conn.id === operation.connectionId ||
                  (conn.sourceColumn?.name === operation.sourceColumn?.name &&
                    conn.sourceColumn?.table === operation.sourceColumn?.table &&
                    conn.targetColumn?.name === operation.targetColumn?.name &&
                    conn.targetColumn?.table === operation.targetColumn?.table)
                );
              });

              // Determine which group this operation belongs to
              let group: { ruleName: string; ruleId?: string | null; sources: Set<string>; field_rules: any[]; rule_configuration: any[]; } | null = null;
              
              if (targetRuleName) {
                // If we found a user-defined rule name from the operation itself, use that
                group = rulesGroupedByUserRuleName.get(targetRuleName) || null;
              } else if (matchingConnection) {
                // Otherwise, use the connection to determine the rule
                group = getGroupForConnection(matchingConnection.id, tableMappingRuleName);
              }

            if (!group) {
              // If no matching connection found, use the first rule as fallback
              if (rules.length > 0) {
                const fallbackGroup = rulesGroupedByUserRuleName.get(rules[0].name);
                if (fallbackGroup) {
                  // Update the rule field to use table mapping rule name
                  const operationEntry = {
                    ...operation,
                    rule: tableMappingRuleName || operation?.rule,
                  };
                  
                  // Find or create the category in the group's rule_configuration
                  let categoryEntry = fallbackGroup.rule_configuration.find(
                    (cat: any) => cat.category === categoryConfig.category
                  );
                  if (!categoryEntry) {
                    categoryEntry = {
                      category: categoryConfig.category,
                      operations: [],
                    };
                    fallbackGroup.rule_configuration.push(categoryEntry);
                  }
                  categoryEntry.operations.push(operationEntry);
                  addSourcesFromColumns(fallbackGroup, operationEntry.sourceColumn, operationEntry.targetColumn);
                }
              }
              return;
            }

            // Update the rule field to use table mapping rule name
            const operationEntry = {
              ...operation,
              rule: tableMappingRuleName || operation?.rule,
            };
            
            // Find or create the category in the group's rule_configuration
            let categoryEntry = group.rule_configuration.find(
              (cat: any) => cat.category === categoryConfig.category
            );
            if (!categoryEntry) {
              categoryEntry = {
                category: categoryConfig.category,
                operations: [],
              };
              group.rule_configuration.push(categoryEntry);
            }
            categoryEntry.operations.push(operationEntry);
            addSourcesFromColumns(group, operationEntry.sourceColumn, operationEntry.targetColumn);
          });
          return;
        }

        // Handle legacy format (individual operations without category structure)
        // This handles cases where ruleConfig is a single operation object
        const operation = categoryConfig;
        // Determine the table mapping rule name first
        const sourceTable = operation?.sourceColumn?.table;
        const targetTable = operation?.targetColumn?.table;
        const tableMappingRuleName = sourceTable
          ? `${sourceTable}_VS_${targetTable || sourceTable}`
          : operation?.rule;

        // First, try to find the user-defined rule name from the operation's rule property
        let targetRuleName: string | null = null;
        if (operation?.rule) {
          // Check if the rule property matches any user-defined rule name
          const matchingUserRule = rules.find((r) => r.name === operation.rule);
          if (matchingUserRule) {
            targetRuleName = matchingUserRule.name;
          }
        }

        const matchingConnection = dragDropConnections.find((conn) => {
          return (
            conn.id === operation.connectionId ||
            (conn.sourceColumn?.name === operation.sourceColumn?.name &&
              conn.sourceColumn?.table === operation.sourceColumn?.table &&
              conn.targetColumn?.name === operation.targetColumn?.name &&
              conn.targetColumn?.table === operation.targetColumn?.table)
          );
        });

        // Determine which group this operation belongs to
        let group: { ruleName: string; ruleId?: string | null; sources: Set<string>; field_rules: any[]; rule_configuration: any[]; } | null = null;
        
        if (targetRuleName) {
          // If we found a user-defined rule name from the operation itself, use that
          group = rulesGroupedByUserRuleName.get(targetRuleName) || null;
        } else if (matchingConnection) {
          // Otherwise, use the connection to determine the rule
          group = getGroupForConnection(matchingConnection.id, tableMappingRuleName);
        }

        if (!group) {
          // If no matching connection found, use the first rule as fallback
          if (rules.length > 0) {
            const fallbackGroup = rulesGroupedByUserRuleName.get(rules[0].name);
            if (fallbackGroup) {
              const operationEntry = {
                ...operation,
                rule: tableMappingRuleName || operation?.rule,
              };
              
              // Add to a default category
              let categoryEntry = fallbackGroup.rule_configuration.find(
                (cat: any) => cat.category === (operation?.category || 'Operations')
              );
              if (!categoryEntry) {
                categoryEntry = {
                  category: operation?.category || 'Operations',
                  operations: [],
                };
                fallbackGroup.rule_configuration.push(categoryEntry);
              }
              categoryEntry.operations.push(operationEntry);
              addSourcesFromColumns(fallbackGroup, operationEntry.sourceColumn, operationEntry.targetColumn);
            }
          }
          return;
        }

        // Update the rule field to use table mapping rule name
        const operationEntry = {
          ...operation,
          rule: tableMappingRuleName || operation?.rule,
        };
        
        // Add to the appropriate category
        let categoryEntry = group.rule_configuration.find(
          (cat: any) => cat.category === (operation?.category || 'Operations')
        );
        if (!categoryEntry) {
          categoryEntry = {
            category: operation?.category || 'Operations',
            operations: [],
          };
          group.rule_configuration.push(categoryEntry);
        }
        categoryEntry.operations.push(operationEntry);
        addSourcesFromColumns(group, operationEntry.sourceColumn, operationEntry.targetColumn);
      });

      const existingPayload = currentNode?.data?.node?.payload || {};
      const existingRulesPayload = isPlainObject(existingPayload?.rules)
        ? (existingPayload.rules as Record<string, any>)
        : {};

      const tableNameToSourceIdsMap: Record<string, string[]> = {};
      const tableNameSet = new Set<string>();
      const sourceIdToTableNames: Record<string, string[]> = {};

      dataSources.forEach((source) => {
        source.tables.forEach((table) => {
          tableNameSet.add(table.name);
          if (!tableNameToSourceIdsMap[table.name]) {
            tableNameToSourceIdsMap[table.name] = [];
          }
          tableNameToSourceIdsMap[table.name].push(source.id);

          if (!sourceIdToTableNames[source.id]) {
            sourceIdToTableNames[source.id] = [];
          }
          sourceIdToTableNames[source.id].push(table.name);
          });
        });
        
      const rulesPlainObject: Record<string, any> = {};

      // Build rules object with field_rules and rule_configuration inside each rule
      rulesGroupedByUserRuleName.forEach((group, userRuleName) => {
        const existingRuleEntryFromRules = isPlainObject(existingRulesPayload[userRuleName])
          ? existingRulesPayload[userRuleName]
          : {};
        const legacyRuleEntry = isPlainObject(existingPayload[userRuleName])
          ? existingPayload[userRuleName]
          : {};
        const mergedExistingRuleEntry = {
          ...legacyRuleEntry,
          ...existingRuleEntryFromRules,
        };

        const ruleEntry: Record<string, any> = {};

        if (group.ruleId) {
          const existingUiState = isPlainObject(mergedExistingRuleEntry.uiState)
            ? mergedExistingRuleEntry.uiState
            : undefined;
          ruleEntry.uiState = {
            ...(existingUiState || {}),
            id: group.ruleId,
            name: userRuleName,
          };
        } else if (mergedExistingRuleEntry.uiState) {
          ruleEntry.uiState = mergedExistingRuleEntry.uiState;
        }

        // Add field_rules and rule_configuration inside the rule entry
        // These should have the table mapping rule name (like MSV_TEST_1_VS_MSV_TEST_2) in the rule field
        // Always include field_rules and rule_configuration for each rule to ensure proper organization
        // Priority: new group data > existing merged data > empty array
        if (group.field_rules.length > 0) {
          // Use new field_rules from the group (filtered by this rule)
          ruleEntry.field_rules = group.field_rules;
        } else if (Array.isArray(mergedExistingRuleEntry.field_rules) && mergedExistingRuleEntry.field_rules.length > 0) {
          // Preserve existing field_rules if new ones are empty
          ruleEntry.field_rules = mergedExistingRuleEntry.field_rules;
        } else {
          // Initialize with empty array for consistency
          ruleEntry.field_rules = [];
        }
        
        if (group.rule_configuration.length > 0) {
          // Use new rule_configuration from the group (filtered by this rule)
          ruleEntry.rule_configuration = group.rule_configuration;
        } else if (Array.isArray(mergedExistingRuleEntry.rule_configuration) && mergedExistingRuleEntry.rule_configuration.length > 0) {
          // Preserve existing rule_configuration if new ones are empty
          ruleEntry.rule_configuration = mergedExistingRuleEntry.rule_configuration;
        } else {
          // Initialize with empty array for consistency
          ruleEntry.rule_configuration = [];
        }

        const sourceNamesForRule = new Set<string>();
        group.sources.forEach((sourceName) => sourceNamesForRule.add(sourceName));

        Object.keys(mergedExistingRuleEntry).forEach((key) => {
          if (['field_rules', 'rule_configuration', 'uiState'].includes(key)) {
            return;
          }
          if (tableNameSet.has(key)) {
            sourceNamesForRule.add(key);
          }
        });

        sourceNamesForRule.forEach((sourceName) => {
          const possibleKeys = new Set<string>();
          possibleKeys.add(sourceName);

          const relatedSourceIds = tableNameToSourceIdsMap[sourceName] || [];
          relatedSourceIds.forEach((id) => {
            possibleKeys.add(id);
            if (group.ruleId) {
              possibleKeys.add(`${group.ruleId}:${id}`);
            }
          });

          if (group.ruleId) {
            possibleKeys.add(`${group.ruleId}:${sourceName}`);
          }

          const existingSourceEntry = isPlainObject(mergedExistingRuleEntry[sourceName])
            ? mergedExistingRuleEntry[sourceName]
            : {};

          const columnFilters = Array.from(possibleKeys).reduce((acc: any, key) => {
            if (acc) return acc;
            if (columnFiltersBySource[key]) {
              return columnFiltersBySource[key];
            }
            if (sourceIdToTableNames[key]) {
              const tableNames = sourceIdToTableNames[key];
              for (const table of tableNames) {
                if (columnFiltersBySource[table]) {
                  return columnFiltersBySource[table];
                }
              }
            }
            return acc;
          }, undefined as any);

          // Get filter_conditions from local state first (newly added filters)
          // CRITICAL: Only use rule-specific keys (ruleId:sourceId format) when ruleId is present
          // This ensures per-rule isolation and prevents cross-rule contamination
          const filterConditionsFromState = (() => {
            if (!group.ruleId) {
              // If no ruleId, check non-rule-specific keys (backward compatibility)
              return Array.from(possibleKeys).reduce((acc: any, key) => {
                if (acc) return acc;
                if (Array.isArray(filterConditionsBySource[key]) && filterConditionsBySource[key].length > 0) {
                  return filterConditionsBySource[key];
                }
                return acc;
              }, undefined as any);
            }
            
            // If ruleId is present, ONLY check rule-specific keys (ruleId:sourceId format)
            const ruleSpecificKeys = Array.from(possibleKeys)
              .filter(key => typeof key === 'string' && (key.startsWith(`${group.ruleId}:`) || key === group.ruleId))
              .concat(
                // Also create rule-specific keys from source IDs
                [sourceName, ...(tableNameToSourceIdsMap[sourceName] || [])].map(id => `${group.ruleId}:${id}`)
              );
            
            return ruleSpecificKeys.reduce((acc: any, key) => {
              if (acc) return acc;
              if (Array.isArray(filterConditionsBySource[key]) && filterConditionsBySource[key].length > 0) {
                return filterConditionsBySource[key];
              }
              return acc;
            }, undefined as any);
          })();

          // Also get filter_conditions from validation store (previously saved filters)
          let filterConditionsFromStore: any[] | undefined;
          if (group.ruleId) {
            const storeRuleFilters = storeColumnFilters?.[`rule_${group.ruleId}`];
            if (storeRuleFilters && typeof storeRuleFilters === 'object') {
              const sourceIdCandidates = [sourceName, ...(tableNameToSourceIdsMap[sourceName] || [])];
              for (const candidate of sourceIdCandidates) {
                const storeFilters = storeRuleFilters[candidate];
                if (Array.isArray(storeFilters) && storeFilters.length > 0) {
                  // Check if these are filter_conditions (have 'filter' property) vs filters (have 'filter_type' but no 'filter')
                  const hasFilterProperty = storeFilters.some((f: any) => 
                    f && typeof f === 'object' && typeof f.filter === 'string' && f.filter.trim().length > 0
                  );
                  if (hasFilterProperty) {
                    // These are filter_conditions from the store (previously saved filters)
                    filterConditionsFromStore = storeFilters;
                    break;
                  }
                }
              }
            }
          }

          // Merge filter_conditions from state and store, removing duplicates by id
          let filterConditions: any[] | undefined;
          if (filterConditionsFromState || filterConditionsFromStore) {
            const merged: any[] = [];
            const seenIds = new Set<string>();
            
            // First add from store (previously saved filters)
            if (Array.isArray(filterConditionsFromStore)) {
              filterConditionsFromStore.forEach((filter: any) => {
                if (filter?.id && !seenIds.has(filter.id)) {
                  seenIds.add(filter.id);
                  merged.push(filter);
                }
              });
            }
            
            // Then add from state (newly added filters), avoiding duplicates
            if (Array.isArray(filterConditionsFromState)) {
              filterConditionsFromState.forEach((filter: any) => {
                if (filter?.id && !seenIds.has(filter.id)) {
                  seenIds.add(filter.id);
                  merged.push(filter);
                } else if (!filter?.id) {
                  // Include filters without id (legacy support)
                  merged.push(filter);
                }
              });
            }
            
            filterConditions = merged.length > 0 ? merged : undefined;
          }

          // If still no filter_conditions, check existing source entry
          if (!filterConditions && existingSourceEntry?.filter_conditions) {
            filterConditions = Array.isArray(existingSourceEntry.filter_conditions) 
              ? existingSourceEntry.filter_conditions 
              : undefined;
          }

          let filters = existingSourceEntry?.filters;

          if (!filters && group.ruleId) {
            const storeRuleFilters = storeColumnFilters?.[`rule_${group.ruleId}`];
            if (storeRuleFilters && typeof storeRuleFilters === 'object') {
              const sourceIdCandidates = [sourceName, ...(tableNameToSourceIdsMap[sourceName] || [])];
              for (const candidate of sourceIdCandidates) {
                // Check for filters array (not filter_conditions)
                const candidateFilters = storeRuleFilters[candidate];
                if (Array.isArray(candidateFilters)) {
                  // Check if this array contains filters (has filter_type or other filter properties)
                  const hasFilterProperties = candidateFilters.some((f: any) => 
                    f?.filter_type || f?.column || f?.condition
                  );
                  if (hasFilterProperties && !candidateFilters.some((f: any) => f?.filter)) {
                    // This is a filters array, not filter_conditions
                    filters = candidateFilters;
                    break;
                  }
                }
              }
            }
          }

          if (!filters) {
            const sourceIdCandidates = [sourceName, ...(tableNameToSourceIdsMap[sourceName] || [])];
            for (const candidate of sourceIdCandidates) {
              if (filtersByColumn[candidate]) {
                filters = filtersByColumn[candidate];
                break;
              }
            }
          }

          const sourceEntry: Record<string, any> = {};

          if (columnFilters) {
            sourceEntry.column_filters = columnFilters;
          } else if (existingSourceEntry?.column_filters) {
            sourceEntry.column_filters = existingSourceEntry.column_filters;
          }

          if (filters) {
            sourceEntry.filters = filters;
          } else if (existingSourceEntry?.filters) {
            sourceEntry.filters = existingSourceEntry.filters;
          }

          if (filterConditions) {
            sourceEntry.filter_conditions = filterConditions;
          } else if (existingSourceEntry?.filter_conditions) {
            sourceEntry.filter_conditions = existingSourceEntry.filter_conditions;
          }

          if (Object.keys(sourceEntry).length > 0) {
            ruleEntry[sourceName] = sourceEntry;
          } else if (Object.keys(existingSourceEntry || {}).length > 0) {
            ruleEntry[sourceName] = existingSourceEntry;
          }
        });

        // Always include field_rules and rule_configuration for each rule to ensure proper organization
        // Even if ruleEntry has other properties but missing these arrays, ensure they're included
        if (!ruleEntry.hasOwnProperty('field_rules')) {
          ruleEntry.field_rules = mergedExistingRuleEntry?.field_rules || [];
        }
        if (!ruleEntry.hasOwnProperty('rule_configuration')) {
          ruleEntry.rule_configuration = mergedExistingRuleEntry?.rule_configuration || [];
        }
        
        // Always include the rule entry, even if it has no field_rules or rule_configuration
        // This ensures all rules are saved individually with their respective keys
        if (Object.keys(ruleEntry).length > 0 || mergedExistingRuleEntry) {
          // If ruleEntry is empty but mergedExistingRuleEntry has data, use mergedExistingRuleEntry
          // But ensure it has field_rules and rule_configuration
          if (Object.keys(ruleEntry).length === 0 && Object.keys(mergedExistingRuleEntry || {}).length > 0) {
            const finalEntry = {
              ...mergedExistingRuleEntry,
              field_rules: mergedExistingRuleEntry.field_rules || [],
              rule_configuration: mergedExistingRuleEntry.rule_configuration || [],
            };
            rulesPlainObject[userRuleName] = finalEntry;
          } else {
            rulesPlainObject[userRuleName] = ruleEntry;
          }
        }
      });
      
      // Ensure ALL rules are included in the payload, even if they weren't processed above
      rules.forEach((rule) => {
        if (!rulesPlainObject[rule.name]) {
          // Rule wasn't processed, check if it exists in existing payload
          const existingRuleEntryFromRules = isPlainObject(existingRulesPayload[rule.name])
            ? existingRulesPayload[rule.name]
            : {};
          const legacyRuleEntry = isPlainObject(existingPayload[rule.name])
            ? existingPayload[rule.name]
            : {};
          const mergedExistingRuleEntry = {
            ...legacyRuleEntry,
            ...existingRuleEntryFromRules,
          };
          
          // If existing entry has data, include it
          // But ensure it has field_rules and rule_configuration arrays for consistency
          if (Object.keys(mergedExistingRuleEntry).length > 0) {
            const finalRuleEntry = {
              ...mergedExistingRuleEntry,
              field_rules: mergedExistingRuleEntry.field_rules || [],
              rule_configuration: mergedExistingRuleEntry.rule_configuration || [],
            };
            rulesPlainObject[rule.name] = finalRuleEntry;
          } else {
            // For new rules without existing data, include uiState with empty arrays for consistency
            // This ensures each rule has field_rules and rule_configuration organized under its name
            rulesPlainObject[rule.name] = {
              uiState: {
                id: rule.id,
                name: rule.name,
              },
              field_rules: [],
              rule_configuration: [],
            };
          }
        }
      });
      
      const {
        datasets: _existingDatasets,
        field_rules: _existingFieldRules,
        rule_configuration: _existingRuleConfig,
        filter_conditions: _existingFilterConditions,
        filter_conditions_by_source: _existingFilterConditionsBySource,
        filters: _existingFilters,
        rules: _existingRules,
        ...restPayload
      } = existingPayload;

      const ruleNames = rules.map((r) => r.name);
      const cleanedRestPayload = { ...restPayload };
      ruleNames.forEach((ruleName) => {
        if (cleanedRestPayload[ruleName]) {
          delete cleanedRestPayload[ruleName];
        }
      });
      
      // Merge filter_conditions_by_source from current node payload (includes derive column filters)
      // This ensures derive column filters saved via useFilterSave are included in the saved payload
      const currentFilterConditionsBySource = currentNode?.data?.node?.payload?.filter_conditions_by_source || {};
      const mergedFilterConditionsBySource = {
        ...(isPlainObject(_existingFilterConditionsBySource) ? _existingFilterConditionsBySource : {}),
        ...(isPlainObject(currentFilterConditionsBySource) ? currentFilterConditionsBySource : {}),
      };
      
      // Also merge top-level filter_conditions from current node payload
      const currentFilterConditions = Array.isArray(currentNode?.data?.node?.payload?.filter_conditions)
        ? currentNode.data.node.payload.filter_conditions
        : [];
      const existingFilterConditions = Array.isArray(_existingFilterConditions)
        ? _existingFilterConditions
        : [];
      
      // Merge filter_conditions - append new ones, avoid duplicates by id
      const mergedFilterConditions = [...existingFilterConditions];
      const existingIds = new Set(existingFilterConditions.map((f: any) => f.id).filter(Boolean));
      currentFilterConditions.forEach((filter: any) => {
        if (filter?.id && !existingIds.has(filter.id)) {
          mergedFilterConditions.push(filter);
          existingIds.add(filter.id);
        } else if (!filter?.id) {
          // If no id, add it anyway (might be a new filter)
          mergedFilterConditions.push(filter);
        }
      });
      
      // Build validation payload - field_rules and rule_configuration are ONLY inside rules, not at top level
      const validationPayload = {
        ...cleanedRestPayload,
        datasets: datasets,
        rules: rulesPlainObject,
        saved_node: true,
        // Include filter_conditions and filter_conditions_by_source to preserve derive column filters
        ...(mergedFilterConditions.length > 0 && { filter_conditions: mergedFilterConditions }),
        ...(Object.keys(mergedFilterConditionsBySource).length > 0 && { 
          filter_conditions_by_source: mergedFilterConditionsBySource 
        }),
      };

      // Create finalData structure like nway validation
      const finalData = JSON.parse(JSON.stringify(currentNode.data));
      finalData.node.payload = validationPayload;
      finalData.current_node_id = currentNode.id;
      // Get flow_id from currentWorkflow (source of truth), then currentNode
      finalData.flow_id = useFlowStore.getState().currentWorkflow?.flow_id || currentNode.data.flow_id;
 
      // Log rule_configuration structure
      if (submitRules?.rule_configuration) {
        submitRules.rule_configuration.forEach(() => {
        
        });
      } else {
      }
      
      if (submitRules) {
      
        
        // Log the new field_rules and rule_configuration structure
        if (submitRules.field_rules) {
        }
        if (submitRules.rule_configuration) {
        }
      } else {
      }

      const response = await saveNodeDetailsApi(currentNode.data.node.save_node, finalData);
      
      // Update the node data in the store
      useFlowStore.getState().updateNodeData(currentNode.id, response);
      
      const payloadForStore = response?.node?.payload || validationPayload;
      if (currentNode.id && payloadForStore) {
        setRuleConfigPayload(payloadForStore, currentNode.id);
      }
      
      toast.success('Rule configuration saved successfully');
    } catch (error) {
      if (!(error instanceof ApiRequestError)) {
        toast.error(getDisplayErrorMessage(error, 'Failed to save rule configuration'));
      }
    } finally {
      setIsSaving(false);
    }
  };


  const handleTableToggle = (tableName: string) => {
    // Multiple selection logic - allow multiple sources to be selected
    setSelectedTables(prev => 
      prev.includes(tableName) 
        ? prev.filter(name => name !== tableName)
        : [...prev, tableName]
    );
    
    // Auto-select all columns for the toggled source
    setDataSources(prev => 
      prev.map(source => {
        const updatedTables = source.tables.map(table => {
          if (table.name === tableName) {
            // Toggle table selection and all its columns
            const newSelected = !table.selected;
            const updatedColumns = table.columns.map(column => ({
              ...column,
              selected: newSelected
            }));
            return { ...table, selected: newSelected, columns: updatedColumns };
          }
          return table;
        });
        return { ...source, tables: updatedTables };
      })
    );
  };

  const handleDragDropConnectionAdd = (
    sourceColumn: any,
    targetColumn: any,
    ruleContext?: { ruleId?: string; ruleName?: string }
  ) => {
    // Generate unique ID with timestamp to allow multiple connections between same columns
    const connectionId = `${sourceColumn.application}-${sourceColumn.table}-${sourceColumn.column}-to-${targetColumn.application}-${targetColumn.table}-${targetColumn.column}-${Date.now()}`;
    const resolvedRuleId = ruleContext?.ruleId || activeRuleId || null;
    let resolvedRuleName = ruleContext?.ruleName;

    if (!resolvedRuleName && resolvedRuleId) {
      const matchingRule = rules.find((rule) => rule.id === resolvedRuleId);
      if (matchingRule?.name) {
        resolvedRuleName = matchingRule.name;
      }
    }

    if (!resolvedRuleName) {
      const sourceTableName = sourceColumn?.table || 'SOURCE';
      const targetTableName =
        targetColumn?.table || sourceTableName || 'TARGET';
      resolvedRuleName = `${sourceTableName}_VS_${targetTableName}`;
    }
    
    const newConnection = {
      id: connectionId,
      sourceColumn,
      targetColumn,
      connectionType: 'drag-drop' as const,
      ruleId: resolvedRuleId,
      ruleName: resolvedRuleName,
    };
    
   
    setDragDropConnections(prev => {
      const updated = [...prev, newConnection];
    
      return updated;
    });
  };

  const handleDragDropConnectionRemove = (connectionId: string) => {
    console.log('🗑️ Removing connection:', connectionId);
    
    setDragDropConnections(prev => {
      const filtered = prev.filter(conn => conn.id !== connectionId);
      console.log('🗑️ Updated dragDropConnections:', filtered.length, 'remaining');
      return filtered;
    });
    
    // Also remove from connectionsWithSelectedData if it exists there
    const currentStoreConnections = connectionsWithSelectedData || [];
    const filteredStoreConnections = currentStoreConnections.filter(conn => conn.id !== connectionId);
    console.log('🗑️ Updated store connections:', filteredStoreConnections.length, 'remaining');
    setConnectionsWithSelectedData(filteredStoreConnections);
    
    // Also remove from payload field_rules if it exists
    if (currentNode?.data?.node?.payload?.field_rules) {
      const updatedPayload = { ...currentNode.data.node.payload };
      const fieldRules = [...updatedPayload.field_rules];
      
      // Find and remove the matching rule
      const ruleIndex = fieldRules.findIndex((rule: any) => {
        const ruleConnectionId = `${rule.sourceColumn.application}_${rule.sourceColumn.table}_${rule.sourceColumn.name}_to_${rule.targetColumn.application}_${rule.targetColumn.table}_${rule.targetColumn.name}`;
        return connectionId.includes(ruleConnectionId);
      });
      
      if (ruleIndex !== -1) {
        fieldRules.splice(ruleIndex, 1);
        updatedPayload.field_rules = fieldRules;
        
        // Update the node data in the store
        const updatedNodeData = {
          ...currentNode.data,
          node: {
            ...currentNode.data.node,
            payload: updatedPayload
          }
        };
        
        console.log('🗑️ Updated payload field_rules:', fieldRules.length, 'remaining');
        useFlowStore.getState().updateNodeData(currentNode.id, updatedNodeData);
      }
    }
    
    // Remove from local connection key states
    setConnectionKeyStates(prev => {
      const newStates = { ...prev };
      delete newStates[connectionId];
      console.log('🗑️ Removed from connection key states:', connectionId);
      return newStates;
    });
  };

  // Handle K/V button clicks
  const handleKeyButtonClick = (connectionId: string, keyType: 'primary' | 'validation') => {
    // Prevent any default behavior or propagation that might delete the connection
    console.log('🔑 Key button clicked:', { connectionId, keyType });
    
    // Check if this is a single-rule connection by checking store
    const storeConnections = useValidationStore.getState().connectionsWithSelectedData || [];
    const isSingleRule = storeConnections.some((c: any) => c.id === connectionId && c.singleRule);
    
    // For single-rule connections, toggle validation state
    if (isSingleRule && keyType === 'validation') {
      // Toggle validation state for single-rule connections
      const currentState = connectionKeyStates[connectionId] || { isPrimaryKey: false, isValidationKey: false };
      setConnectionKeyStates(prev => ({
        ...prev,
        [connectionId]: { isPrimaryKey: false, isValidationKey: !currentState.isValidationKey }
      }));
      return; // Early return for single-rule - don't update payload
    }
    
    // Get current state first - try multiple ID formats for single-rule connections
    let currentState = connectionKeyStates[connectionId] || { isPrimaryKey: false, isValidationKey: false };
    
    // For single-rule connections, try to find by source column name
    if (!currentState || (!currentState.isPrimaryKey && !currentState.isValidationKey)) {
      // Try to match by extracting source column from connectionId
      const connectionIdParts = connectionId.split('-');
      if (connectionIdParts.includes('single')) {
        // For single-rule: format is "application-table-name-single-timestamp"
        // Try to match by source column
        Object.keys(connectionKeyStates).forEach(key => {
          if (key.includes(connectionIdParts[connectionIdParts.length - 2]) || 
              connectionId.includes(key.split('-')[0])) {
            currentState = connectionKeyStates[key] || currentState;
          }
        });
      }
    }
    
    // Update local state for immediate UI feedback
    setConnectionKeyStates(prev => {
      const newState = keyType === 'primary' 
        ? { isPrimaryKey: !currentState.isPrimaryKey, isValidationKey: false }
        : { isPrimaryKey: false, isValidationKey: !currentState.isValidationKey };
      
      return {
        ...prev,
        [connectionId]: newState
      };
    });
    
    // Also update the payload field_rules if it exists (only for normal connections, not single-rule)
    if (currentNode?.data?.node?.payload?.field_rules) {
      const updatedPayload = { ...currentNode.data.node.payload };
      const fieldRules = [...updatedPayload.field_rules];
      
      // Find the matching rule and update it
      for (let i = 0; i < fieldRules.length; i++) {
        const rule = fieldRules[i];
        if (rule.sourceColumn && rule.targetColumn) {
          const ruleConnectionId = `${rule.sourceColumn.table}_${rule.sourceColumn.name}_${rule.targetColumn.table}_${rule.targetColumn.name}`;
          
          // Match by various ID formats
          if (ruleConnectionId === connectionId || 
              connectionId.includes(rule.sourceColumn.table) ||
              connectionId.includes(rule.sourceColumn.name)) {
            
            // Update the sourceColumn with new key states
            fieldRules[i] = {
              ...rule,
              sourceColumn: {
                ...rule.sourceColumn,
                isPrimaryKey: keyType === 'primary' ? !currentState.isPrimaryKey : false,
                isValidationKey: keyType === 'validation' ? !currentState.isValidationKey : false
              }
            };
            break;
          }
        }
      }
      
      updatedPayload.field_rules = fieldRules;
      
      // Update the node data
      const updatedNodeData = {
        ...currentNode.data,
        node: {
          ...currentNode.data.node,
          payload: updatedPayload
        }
      };
      
      useFlowStore.getState().updateNodeData(currentNode.id, updatedNodeData);
    }
  };

  // Get key state for a connection from local state or payload
  const getConnectionKeyState = (connectionId: string) => {
    // Check if this is a single-rule connection first
    const storeConnections = useValidationStore.getState().connectionsWithSelectedData || [];
    const isSingleRule = storeConnections.some((c: any) => c.id === connectionId && c.singleRule);
    
    // For single-rule connections, return current state (disabled by default)
    if (isSingleRule) {
      // Return state from local state if exists, otherwise default to disabled
      const existingState = connectionKeyStates[connectionId];
      if (existingState) {
        return existingState;
      }
      // Default to disabled for single-rule connections
      return { isPrimaryKey: false, isValidationKey: false };
    }
    
    // First check if we have exact match in local state
    if (connectionKeyStates[connectionId]) {
      return connectionKeyStates[connectionId];
    }
    
    // For single-rule connections (by ID format), try to match by ID
    if (connectionId.includes('-single-')) {
      // Single-rule format: "application-table-name-single-timestamp"
      // Try to find exact match first
      if (connectionKeyStates[connectionId]) {
        return connectionKeyStates[connectionId];
      }
      
      // Single-rule connections should default to disabled (not validation)
      return { isPrimaryKey: false, isValidationKey: false };
    }
    
    // If no exact match, try to find by matching the core connection properties
    // Extract core properties from connectionId (format: application_table_column_to_application_table_column_timestamp)
    const parts = connectionId.split('_to_');
    if (parts.length === 2) {
      const [sourcePart, targetPart] = parts;
      const sourceParts = sourcePart.split('_');
      const targetParts = targetPart.split('_');
      
      // Remove timestamp from target part (last element)
      if (targetParts.length > 3) {
        targetParts.pop(); // Remove timestamp
      }
      
      if (sourceParts.length >= 3 && targetParts.length >= 3) {
        const sourceApplication = sourceParts[0];
        const sourceTable = sourceParts[1];
        const sourceColumn = sourceParts.slice(2).join('_'); // Handle column names with underscores
        const targetApplication = targetParts[0];
        const targetTable = targetParts[1];
        const targetColumn = targetParts.slice(2).join('_'); // Handle column names with underscores
        
        // Create the base connection ID without timestamp
        const baseConnectionId = `${sourceApplication}_${sourceTable}_${sourceColumn}_to_${targetApplication}_${targetTable}_${targetColumn}`;
        
        // Check if we have this base connection in our state
        if (connectionKeyStates[baseConnectionId]) {
          return connectionKeyStates[baseConnectionId];
        }
        
        // If still not found, check payload directly
        const payload = currentNode?.data?.node?.payload;
        if (payload?.field_rules && Array.isArray(payload.field_rules)) {
          for (const rule of payload.field_rules) {
            if (rule.sourceColumn && rule.targetColumn &&
                rule.sourceColumn.application === sourceApplication &&
                rule.sourceColumn.table === sourceTable &&
                rule.sourceColumn.name === sourceColumn &&
                rule.targetColumn.application === targetApplication &&
                rule.targetColumn.table === targetTable &&
                rule.targetColumn.name === targetColumn) {
              
              return {
                isPrimaryKey: rule.sourceColumn.isPrimaryKey || false,
                isValidationKey: rule.sourceColumn.isValidationKey || false
              };
            }
          }
        }
      }
    }
    
    return { isPrimaryKey: false, isValidationKey: false };
  };

  const handleShowDataGrid = (mapping: any) => {
    setSelectedMappingForPreview(mapping);
  };

  const handleCloseDataGrid = () => {
    setSelectedMappingForPreview(null);
  };

  const handleSelectionChange = (selectedData: {
    sourceRow: any;
    targetRow: any;
    mapping: any;
  }) => {
    // Store the selected row data
    setSelectedRowData(selectedData);
    
    const activeRule = activeRuleId
      ? rules.find((rule) => rule.id === activeRuleId)
      : null;
    const activeRuleName = activeRule?.name;

    // Get connection IDs that belong to this specific mapping
    const mappingConnectionIds = new Set<string>();
    if (selectedData.mapping?.connections) {
      selectedData.mapping.connections.forEach((conn: any) => {
        if (conn.id) {
          mappingConnectionIds.add(conn.id);
        }
      });
    }

    // Helper to check if connection belongs to the specific mapping
    const belongsToMapping = (connection: any) => {
      return mappingConnectionIds.has(connection.id);
    };

    const belongsToActiveRule = (connection: any) => {
      if (!activeRuleId) {
        return true;
      }

      if (connection.ruleId && connection.ruleId === activeRuleId) {
        return true;
      }

      const sourceTable = connection?.sourceColumn?.table || 'SOURCE';
      const targetTable =
        connection?.targetColumn?.table ||
        connection?.sourceColumn?.table ||
        'TARGET';
      const derivedRuleName = connection?.ruleName
        ? connection.ruleName
        : connection?.singleRule
        ? `${sourceTable}_VS_${sourceTable}`
        : `${sourceTable}_VS_${targetTable}`;

      if (activeRuleName && derivedRuleName === activeRuleName) {
        return true;
      }

      if (!connection.ruleId && !connection.ruleName && rules.length <= 1) {
        return true;
      }

      return false;
    };

    if (selectedData.sourceRow || selectedData.targetRow) {
      // Only update connections that belong to this specific mapping
      const connectionsWithData = dragDropConnections.map((connection) => {
        // Only update connections that belong to both the active rule AND this specific mapping
        if (!belongsToActiveRule(connection) || !belongsToMapping(connection)) {
          return connection;
        }

        const sourceValue = selectedData.sourceRow?.[
          connection.sourceColumn?.name as string
        ] ?? null;
        const targetColumnName = connection.targetColumn?.name as
          | string
          | undefined;
        const targetValue = targetColumnName
          ? selectedData.targetRow?.[targetColumnName] ?? connection.constantValue ?? null
          : connection.constantValue ?? null;
        
        return {
          ...connection,
          sourceColumnValue: sourceValue,
          targetColumnValue: targetValue,
          hasSelectedData:
            sourceValue !== null || targetValue !== null,
        };
      });
      
      setDragDropConnections(connectionsWithData);

      const existingConnections = connectionsWithSelectedData || [];
      // Only update connections that belong to this specific mapping
      const updatedConnectionsMap = new Map(
        connectionsWithData
          .filter((connection) => belongsToActiveRule(connection) && belongsToMapping(connection))
          .map((connection) => [connection.id, connection])
      );

      const mergedConnections = existingConnections.map((existing) => {
        // Only update if it belongs to the mapping, otherwise preserve existing
        if (belongsToMapping(existing)) {
          const updated = updatedConnectionsMap.get(existing.id);
          return updated ? { ...existing, ...updated } : existing;
        }
        return existing;
      });

      updatedConnectionsMap.forEach((connection, connectionId) => {
        const exists = mergedConnections.some(
          (existing) => existing.id === connectionId
        );
        if (!exists) {
          mergedConnections.push(connection);
        }
      });
      
      setConnectionsWithSelectedData(mergedConnections);
    }
    // Don't clear connections when no data is selected - preserve existing ones
  };







  // Check if any rule is showing filters or connections page (for backward compatibility)
  // Note: This is now handled per-rule inside the rule tabs
  const anyRuleShowingFilters = Object.values(ruleViewStates).some(state => state.showFiltersPage);
  const anyRuleShowingConnections = Object.values(ruleViewStates).some(state => state.showConnectionsPage);
  
 
  // If showing filters page globally (fallback), render it with connections on left and filters on right
  if (anyRuleShowingFilters && false) { // Disabled - now handled inside rules
    const allConnections = dragDropConnections.map(conn => ({
      id: conn.id,
      sourceColumn: conn.sourceColumn,
      targetColumn: conn.targetColumn,
      connectionType: conn.connectionType,
      sourceColumnValue: (conn as any).sourceColumnValue,
      targetColumnValue: (conn as any).targetColumnValue,
      hasSelectedData: (conn as any).hasSelectedData,
      singleRule: (conn as any).singleRule,
      singleRuleType: (conn as any).singleRuleType,
      constantValue: (conn as any).constantValue,
      singleOperation: (conn as any).singleOperation
    }));

    const connectionsMap = new Map();
    allConnections.forEach(conn => {
      connectionsMap.set(conn.id, conn);
    });
    connectionsWithSelectedData.forEach(storeConn => {
      const existing = connectionsMap.get(storeConn.id);
      if (existing) {
        connectionsMap.set(storeConn.id, {
          ...existing,
          ...storeConn
        });
      } else {
        connectionsMap.set(storeConn.id, storeConn);
      }
    });
    
    const connectionsToUse = Array.from(connectionsMap.values());

    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-[1800px] p-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mb-4 text-sm text-slate-600">
            <button
              onClick={() => {
                // Reset all rule view states
                // Reset all rule view states - handled by hook
                // Individual rule view states are managed per rule
              }}
              className="hover:text-slate-900 underline"
            >
              Connections
            </button>
            <span>/</span>
            <span className="text-slate-900 font-medium">Filters</span>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-12 gap-4 h-[calc(100vh-120px)]">
            {/* Left Side - Connections List (Same as ConnectionsPage) */}
            <div className="col-span-4 flex flex-col overflow-hidden">
              <div className="h-full overflow-y-auto">
                <ConnectionsPage
                  connections={connectionsToUse}
                  onBack={() => {
                    // Reset all rule view states
                    // Reset all rule view states - handled by hook
                // Individual rule view states are managed per rule
                  }}
                  onClose={() => onClose?.()}
                  onSubmitRules={handleSubmitRules}
                  connectionKeyStates={connectionKeyStates}
                  getConnectionKeyState={getConnectionKeyState}
                />
              </div>
            </div>

            {/* Right Side - Filters Configuration */}
            <div className="col-span-8 flex flex-col overflow-hidden">
              <div className="h-full bg-white border border-slate-200 rounded-lg p-6 overflow-y-auto">
                <FiltersConfiguration
                  connections={connectionsToUse}
                  selectedColumn={selectedColumnForFilter}
                  dataSources={dataSources}
                  onFiltersChange={(filters) => {
                    console.log('Filters changed:', filters);
                    // Store filters in state or validation store if needed
                  }}
                  onColumnSelect={setSelectedColumnForFilter}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If showing connections page globally (fallback), render it
  if (anyRuleShowingConnections && false) { // Disabled - now handled inside rules
    // Only show drag-drop connections (user-created connections)
    const allConnections = dragDropConnections.map(conn => ({
      id: conn.id,
      sourceColumn: conn.sourceColumn,
      targetColumn: conn.targetColumn,
      connectionType: conn.connectionType,
      sourceColumnValue: (conn as any).sourceColumnValue,
      targetColumnValue: (conn as any).targetColumnValue,
      hasSelectedData: (conn as any).hasSelectedData
    }));

    // Determine which connections to use
    // Merge store connections (which have selected row data) with allConnections
    // Prioritize store connections for their selected row data
    const connectionsMap = new Map();
    
    // First add all connections
    allConnections.forEach(conn => {
      connectionsMap.set(conn.id, conn);
    });
    
    // Then update/merge with store connections that have selected data
    connectionsWithSelectedData.forEach(storeConn => {
      const existing = connectionsMap.get(storeConn.id);
      if (existing) {
        // Merge store data (selected row values) into existing connection
        connectionsMap.set(storeConn.id, {
          ...existing,
          ...storeConn
        });
      } else {
        // Add new store connection
        connectionsMap.set(storeConn.id, storeConn);
      }
    });
    
    const connectionsToUse = Array.from(connectionsMap.values());
    
    console.log('📄 Rendering ConnectionsPage with connections:', {
      dragDropConnectionsCount: dragDropConnections.length,
      storeConnectionsCount: connectionsWithSelectedData.length,
      usingStore: connectionsWithSelectedData.length > 0,
      totalConnectionsToUse: connectionsToUse.length,
      connections: connectionsToUse.map(c => ({
        source: `${c.sourceColumn.table}.${c.sourceColumn.name}`,
        target: `${c.targetColumn.table}.${c.targetColumn.name}`,
        rule: `${c.sourceColumn.table}_VS_${c.targetColumn.table}`
      }))
    });

    return (
      <ConnectionsPage
        connections={connectionsToUse}
        onBack={() => {
          // Reset all rule view states - handled by hook
          // Individual rule view states are managed per rule
        }}
        onClose={() => onClose?.()}
        onSubmitRules={handleSubmitRules}
        connectionKeyStates={connectionKeyStates}
        getConnectionKeyState={getConnectionKeyState}
      />
    );
  }

  useEffect(() => {
    if (!rules || rules.length === 0) {
      return;
    }

    setDragDropConnections((prev) => {
      let hasChanges = false;
      const updated = prev.map((connection) => {
        if (connection.ruleId && connection.ruleName) {
          return connection;
        }

        const sourceTable = connection?.sourceColumn?.table || 'SOURCE';
        const targetTable =
          connection?.targetColumn?.table ||
          connection?.sourceColumn?.table ||
          'TARGET';
        const derivedRuleName = connection?.ruleName
          ? connection.ruleName
          : connection?.singleRule
          ? `${sourceTable}_VS_${sourceTable}`
          : `${sourceTable}_VS_${targetTable}`;

        const matchingRule = rules.find((rule) => rule.name === derivedRuleName);
        if (matchingRule) {
          hasChanges = true;
          return {
            ...connection,
            ruleId: matchingRule.id,
            ruleName: matchingRule.name,
          };
        }

        return connection;
      });

      return hasChanges ? updated : prev;
    });
  }, [rules]);

  useEffect(() => {
    if (!currentNode?.id || upstreamNodes.length === 0) {
      return;
    }

    const flowId =
      useFlowStore.getState().currentWorkflow?.flow_id || currentNode.data?.flow_id;

    if (!flowId) {
      return;
    }

    const nodesNeedingData = upstreamNodes.filter((node: any) => {
      const output = node?.data?.node?.output;
      if (!output || !output.unique_id) {
        return false;
      }
      if (Array.isArray(output.data) && output.data.length > 0) {
        return false;
      }
      return true;
    });

    if (nodesNeedingData.length === 0) {
      return;
    }

    let isCancelled = false;

    const loadDataForNodes = async () => {
      const store = useFlowStore.getState();

      await Promise.all(
        nodesNeedingData.map(async (node: any) => {
          try {
            const response = await getNodeDataByUniqueIdApi({
              flow_id: flowId,
              node_id: node.id,
              unique_id: node?.data?.node?.output?.unique_id,
            });

            if (
              !isCancelled &&
              response?.status &&
              Array.isArray(response?.data) &&
              response.data.length > 0
            ) {
              store.updateNodeData(node.id, {
                node: {
                  ...node.data?.node,
                  output: {
                    ...node.data?.node?.output,
                    data: response.data,
                  },
                },
              });
            }
          } catch (error) {
            console.error(`Failed to hydrate upstream node ${node.id} data:`, error);
          }
        })
      );
    };

    loadDataForNodes();

    return () => {
      isCancelled = true;
    };
  }, [currentNode?.id, upstreamNodes]);

  return (
    <div className="h-screen w-full flex flex-col bg-background text-foreground">
      {/* Header with Add Rule Button */}
      <RuleHeader
        onAddRule={() => setIsAddRuleDialogOpen(true)}
        onSave={handleSave}
        isSaving={isSaving}
      />

      {/* Rules Tabs */}
      <Tabs 
        value={activeRuleId || ""} 
               onValueChange={(newRuleId) => {
                 // Reset filters when switching rules - only show filters for the new rule
                 if (activeRuleId && newRuleId && activeRuleId !== newRuleId) {
                   try {
                     // Clear filterConditionsBySource for the previous rule
                     setFilterConditionsBySource((prev: Record<string, any[]>) => {
                       const newState: Record<string, any[]> = {};
                       // Keep filters for other rules (ruleId:sourceId keys that don't match previous rule)
                       Object.keys(prev).forEach(key => {
                         if (key.includes(':')) {
                           const [ruleId] = key.split(':');
                           // Keep filters for other rules (not the previous active rule)
                           if (ruleId !== activeRuleId) {
                             newState[key] = prev[key];
                           }
                         } else {
                           // Keep source-only keys for backward compatibility
                           newState[key] = prev[key];
                         }
                       });
                       return newState;
                     });
                   } catch (error) {
                     console.error('Error resetting filters when switching rules:', error);
                   }
                   
                   // Load filters for the new rule from validation store
                   try {
                     const newRuleFilters = storeColumnFilters?.[`rule_${newRuleId}`];
                     if (newRuleFilters && typeof newRuleFilters === 'object') {
                       const loadedFilters: Record<string, any[]> = {};
                       Object.keys(newRuleFilters).forEach(sourceKey => {
                         const filterData = newRuleFilters[sourceKey];
                         if (Array.isArray(filterData) && filterData.length > 0) {
                           const stateKey = `${newRuleId}:${sourceKey}`;
                           loadedFilters[stateKey] = filterData;
                           // Also store by sourceId for backward compatibility
                           loadedFilters[sourceKey] = filterData;
                         }
                       });
                       
                       if (Object.keys(loadedFilters).length > 0) {
                         setFilterConditionsBySource((prev: Record<string, any[]>) => ({
                           ...prev,
                           ...loadedFilters
                         }));
                       }
                     }
                   } catch (error) {
                     console.error('Error loading filters for rule:', error);
                   }
                 }
                 
                 setActiveRuleId(newRuleId);
                 // Show default view when a rule is clicked (sources and connections panel)
                 if (newRuleId) {
                   setRuleViewState(newRuleId, { showFiltersPage: false, showConnectionsPage: false });
                 }
               }}
        className="flex-1 flex flex-col min-h-0"
      >
        <TabsList className="m-2 self-start">
          {rules.map(rule => (
            <TabsTrigger key={rule.id} value={rule.id} className="relative group">
              {rule.name}
              <span
                role="button"
                aria-label={`Remove rule ${rule.name}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeRuleWithConnections(rule.id);
                }}
                className="absolute -top-1 -right-1 p-0.5 rounded-full bg-muted-foreground/20 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground transition-opacity"
              >
                <X className="h-3 w-3" />
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {rules.map(rule => {
          const ruleViewState = getRuleViewState(rule.id);
          
          return (
            <RuleTabsContent
              key={rule.id}
              rule={rule}
              activeRuleId={activeRuleId}
              ruleViewState={ruleViewState}
              onSetRuleViewState={(updates) => setRuleViewState(rule.id, updates)}
              activeRuleConnections={activeRuleConnections}
              connectionKeyStates={connectionKeyStates}
              getConnectionKeyState={getConnectionKeyState}
              onSubmitRules={handleSubmitRules}
              onClose={onClose}
              currentNode={currentNode}
              sourcesToShow={sourcesToShow}
              selectedSourceTab={selectedSourceTab}
              onSourceTabChange={setSelectedSourceTab}
              onFilterSave={(filterType?: string, data?: any, sourceId?: string) => handleFilterSave(filterType, data, sourceId)}
              filterConditionsBySource={filterConditionsBySource}
              selectedColumnForFilter={selectedColumnForFilter}
              onColumnSelect={setSelectedColumnForFilter}
              storedColumnFilters={columnFiltersBySource}
              onFiltersChange={(filters) => {
                console.log('Filters changed:', filters);
                // filters can be either:
                // 1. { sourceName: string, column_filters: any } - from column filters screen
                // 2. { [columnKey]: FilterNode } - from filtersByColumn update
                if (filters?.sourceName && filters?.column_filters) {
                  // Store column_filters JSON for this source in both local state and validation store
                  const updatedFilters = {
                    ...columnFiltersBySource,
                    [filters.sourceName]: filters.column_filters
                  };
                  setColumnFiltersBySource(updatedFilters);
                  setStoreColumnFilters(updatedFilters);
                } else if (selectedColumnForFilter) {
                  const columnKey = `${selectedColumnForFilter.isSource ? 'source' : 'target'}_${selectedColumnForFilter.name}`;
                  setFiltersByColumn(prev => ({
                    ...prev,
                    [columnKey]: filters[columnKey]
                  }));
                }
              }}
          dataSources={dataSources}
          selectedTables={selectedTables}
          onTableToggle={handleTableToggle}
          onSave={handleSave}
              onCancel={() => onClose?.()}
              onShowFiltersPanel={() => {
                if (activeRuleId) {
                  setRuleViewState(activeRuleId, { showFiltersPage: true });
                }
              }}
              onShowDataGrid={handleShowDataGrid}
              onCloseDataGrid={handleCloseDataGrid}
              onSelectionChange={handleSelectionChange}
              selectedMappingForPreview={selectedMappingForPreview}
              validationResults={currentNode?.data?.node?.output?.data}
              onConnectionRemove={handleDragDropConnectionRemove}
              onConnectionAdd={handleDragDropConnectionAdd}
              validationRulesMap={validationRulesMap}
              onDataSourceUpdate={handleDataSourceUpdate}
              onAddSource={handleAddSource}
              onColumnSelected={handleColumnSelected}
              sourceRestrictedTables={sourceRestrictedTables}
              validationRestrictedTables={validationRestrictedTables}
                onDropZoneTablesChange={handleDropZoneTablesChange}
                onKeyButtonClick={handleKeyButtonClick}
              savedNode={savedNode}
              upstreamNodes={upstreamNodes}
            />
          );
        })}
        {rules.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="text-lg font-medium">No Validation Rules</p>
              <p className="text-sm">Click "Add Match Rule" to get started.</p>
              </div>
              </div>
        )}
      </Tabs>

      {/* Add Rule Dialog */}
      <AddRuleDialog
        open={isAddRuleDialogOpen}
        onOpenChange={setIsAddRuleDialogOpen}
        ruleName={newRuleName}
        onRuleNameChange={setNewRuleName}
        onAdd={addRule}
      />
    </div>
  );
}

export default RuleConfiguration;
