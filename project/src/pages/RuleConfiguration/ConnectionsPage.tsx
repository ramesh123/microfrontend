import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ChevronRight, Trash2 } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useValidationStore } from '@/stores/validationStore';
import useFlowStore from '@/stores/flowStore';
import { ValidationOperationsPanel } from './ValidationOperationsPanel';

interface Connection {
  id: string;
  sourceColumn: {
    name: string;
    type: string;
    source: 'left' | 'right';
    table: string;
    application: string;
  };
  targetColumn: {
    name: string;
    type: string;
    source: 'left' | 'right';
    table: string;
    application: string;
  };
  connectionType: 'drag-drop' | 'manual' | 'single' | 'mapped' | 'mapping' | 'join';
  // New fields for selected row data
  sourceColumnValue?: any;
  targetColumnValue?: any;
  hasSelectedData?: boolean;
}

interface ConnectionsPageProps {
  connections: Connection[];
  onBack: () => void;
  onClose: () => void;
  onSubmitRules?: (submitRules: any) => void;
  connectionKeyStates?: Record<string, { isPrimaryKey: boolean; isValidationKey: boolean }>;
  getConnectionKeyState?: (connectionId: string) => { isPrimaryKey: boolean; isValidationKey: boolean };
  hideHeader?: boolean; // Hide breadcrumb, submit button, and back button
  hideValidationOperations?: boolean; // Hide validation operations panel and validation results
  onColumnSelect?: (column: { name: string; type: string; table?: string; isSource: boolean; isTarget: boolean } | null) => void; // For filters screen
}

export const ConnectionsPage: React.FC<ConnectionsPageProps> = ({
  connections,
  onBack,
  onClose,
  onSubmitRules,
  connectionKeyStates: propConnectionKeyStates,
  getConnectionKeyState: propGetConnectionKeyState,
  hideHeader = false,
  hideValidationOperations = false,
  onColumnSelect,
}) => {
  // State for operations
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [targetFields, setTargetFields] = useState<{
    source: boolean;
    target: boolean;
  }>({ source: false, target: false });
  
  // Store operations per connection ID
  const [connectionOperations, setConnectionOperations] = useState<Record<string, {
    sourceOperations: {
      validationCategory: string;
      operationType: string;
      operationConfig: any;
      result: any;
    };
    targetOperations: {
      validationCategory: string;
      operationType: string;
      operationConfig: any;
      result: any;
    };
    operationResult: any;
    validationStatus: any;
  }>>({});
  
  // Use K/V button states from props
  const connectionKeyStates = propConnectionKeyStates || {};
  
  // Current operation state (for UI)
  const [currentOperationState, setCurrentOperationState] = useState<{
    validationCategory: string;
    operationType: string;
    operationConfig: any;
  }>({
    validationCategory: '',
    operationType: '',
    operationConfig: {}
  });

  // Store usage
  const {
    selectedRowData,
    currentOperationResult,
    currentValidationStatus,
    ruleOperations,
    currentConnection,
    setCurrentOperationResult,
    setCurrentValidationStatus,
    addRuleOperation,
    setCurrentConnection
  } = useValidationStore();

  // Use connections from props directly (parent component already manages store sync)
  const displayConnections = connections;
  // Note: Removed automatic store sync to prevent infinite loops
  // Store is already being synced in parent component (index.tsx) when connections are added/removed

  // Load saved rules from store when component mounts
  React.useEffect(() => {
    if (ruleOperations && ruleOperations.length > 0) {
      console.log('📋 Loading saved rules from store:', ruleOperations);
      
      // Restore operations for each connection
      const restoredOperations: Record<string, any> = {};
      
      ruleOperations.forEach((ruleOp: any) => {
        // Find the connection that matches this rule operation
        const matchingConnection = connections.find(conn => 
          conn.id === ruleOp.connectionId ||
          `${conn.sourceColumn.table}.${conn.sourceColumn.name}` === `${ruleOp.sourceTable}.${ruleOp.sourceColumn}` &&
          `${conn.targetColumn.table}.${conn.targetColumn.name}` === `${ruleOp.targetTable}.${ruleOp.targetColumn}`
        );
        
        if (matchingConnection) {
          // Reconstruct the operation result and validation status
          const operationResult = {
            category: ruleOp.operations.source?.category || ruleOp.operations.target?.category || '',
            operation: ruleOp.operations.source?.type || ruleOp.operations.target?.type || '',
            config: ruleOp.operations.source?.config || ruleOp.operations.target?.config || {},
            results: {
              source: ruleOp.operations.source?.result,
              target: ruleOp.operations.target?.result
            }
          };
          
          const validationStatus = ruleOp.validation ? {
            isValid: ruleOp.validation.isValid,
            comparison: ruleOp.validation.comparison,
            sourceValue: ruleOp.validation.sourceValue,
            targetValue: ruleOp.validation.targetValue
          } : null;
          
          restoredOperations[matchingConnection.id] = {
            sourceOperations: {
              validationCategory: ruleOp.operations.source?.category || '',
              operationType: ruleOp.operations.source?.type || '',
              operationConfig: ruleOp.operations.source?.config || {},
              result: ruleOp.operations.source?.result
            },
            targetOperations: {
              validationCategory: ruleOp.operations.target?.category || '',
              operationType: ruleOp.operations.target?.type || '',
              operationConfig: ruleOp.operations.target?.config || {},
              result: ruleOp.operations.target?.result
            },
            operationResult: operationResult,
            validationStatus: validationStatus
          };
          
          console.log(`✅ Restored operations for connection ${matchingConnection.id}:`, restoredOperations[matchingConnection.id]);
        }
      });
      
      // Update the connection operations state
      if (Object.keys(restoredOperations).length > 0) {
        setConnectionOperations(restoredOperations);
        console.log('🔄 Restored all connection operations:', restoredOperations);
        
        // Auto-select the first connection with operations
        const firstConnectionWithOps = connections.find(conn => restoredOperations[conn.id]);
        if (firstConnectionWithOps && !selectedConnection) {
          setSelectedConnection(firstConnectionWithOps);
          setCurrentConnection(firstConnectionWithOps);
          setTargetFields({ source: true, target: false });
          console.log('🎯 Auto-selected first connection with operations:', firstConnectionWithOps.id);
        }
      }
    }
  }, [ruleOperations, connections, selectedConnection]);

  // Load operations from rule_configuration in payload (priority over store)
  // Filter by active rule - only load operations for connections in the current rule
  React.useEffect(() => {
    // Get payload from parent component via useFlowStore
    const currentNode = useFlowStore.getState().getSelectedNode();
    const payload = currentNode?.data?.node?.payload;
    
    // Also check submitRules from store
    const storeSubmitRules = useValidationStore.getState().submitRules;
    
    // Priority: rule_configuration from payload > rule_configuration from submitRules store
    let ruleConfiguration: any[] = [];
    
    if (Array.isArray(payload?.rule_configuration) && payload.rule_configuration.length > 0) {
      ruleConfiguration = payload.rule_configuration;
      console.log('📋 Loading rule_configuration from node payload:', ruleConfiguration.length, 'categories');
    } else if (Array.isArray(storeSubmitRules?.rule_configuration) && storeSubmitRules.rule_configuration.length > 0) {
      ruleConfiguration = storeSubmitRules.rule_configuration;
      console.log('📋 Loading rule_configuration from store submitRules:', ruleConfiguration.length, 'categories');
    }
    
    if (ruleConfiguration.length === 0 || connections.length === 0) return;
    
    // Get rule names from current connections (connections are already filtered by active rule)
    const ruleNamesFromConnections = new Set<string>();
    connections.forEach(conn => {
      const ruleName = (conn as any).ruleName || `${conn.sourceColumn.table}_VS_${conn.targetColumn.table}`;
      if (ruleName) {
        ruleNamesFromConnections.add(ruleName);
      }
    });
    
    console.log('🔍 Filtering rule_configuration by rule names:', Array.from(ruleNamesFromConnections));
    
    // Parse rule_configuration and restore operations - only for the current rule(s)
    const restoredOperations: Record<string, any> = {};
    
    ruleConfiguration.forEach((categoryConfig: any) => {
      // Check if this is a category object (has category and operations)
      if (categoryConfig?.category && Array.isArray(categoryConfig?.operations)) {
        categoryConfig.operations.forEach((operation: any) => {
          // Filter by rule name - only process operations that match current rule(s)
          const operationRule = operation?.rule;
          if (operationRule && ruleNamesFromConnections.size > 0) {
            if (!ruleNamesFromConnections.has(operationRule)) {
              console.log(`⏭️  Skipping operation for rule "${operationRule}" (not in current rule set)`);
              return;
            }
          }
          
          const connectionId = operation?.connectionId;
          if (!connectionId) return;
          
          // Find the connection that matches this operation
          const matchingConnection = connections.find(conn => 
            conn.id === connectionId ||
            (
              conn.sourceColumn.table === operation?.sourceColumn?.table &&
              conn.sourceColumn.name === operation?.sourceColumn?.name &&
              conn.targetColumn.table === operation?.targetColumn?.table &&
              conn.targetColumn.name === operation?.targetColumn?.name
            )
          );
          
          if (matchingConnection) {
            const sourceCol = operation.sourceColumn || {};
            const targetCol = operation.targetColumn || {};
            
            // Determine primary category (use source or target, whichever has a category)
            const primaryCategory = sourceCol.category || targetCol.category || '';
            const primaryOperation = sourceCol.operation || targetCol.operation || '';
            const primaryConfig = sourceCol.config || targetCol.config || {};
            
            // Reconstruct operation result
            const operationResult = {
              category: primaryCategory,
              operation: primaryOperation,
              config: primaryConfig,
              results: {
                source: sourceCol.result,
                target: targetCol.result
              }
            };
            
            // Reconstruct validation status
            const validationStatus = operation.validationStatus ? {
              isValid: operation.validationStatus.isValid,
              comparison: operation.validationStatus.comparison,
              sourceValue: operation.validationStatus.sourceValue,
              targetValue: operation.validationStatus.targetValue
            } : null;
            
            restoredOperations[matchingConnection.id] = {
              sourceOperations: {
                validationCategory: sourceCol.category || '',
                operationType: sourceCol.operation || '',
                operationConfig: sourceCol.config || {},
                result: sourceCol.result || null
              },
              targetOperations: {
                validationCategory: targetCol.category || '',
                operationType: targetCol.operation || '',
                operationConfig: targetCol.config || {},
                result: targetCol.result || null
              },
              operationResult: operationResult,
              validationStatus: validationStatus
            };
            
            console.log(`✅ Restored operations from rule_configuration for connection ${matchingConnection.id}:`, restoredOperations[matchingConnection.id]);
          }
        });
      }
    });
    
    // Update connection operations state (merge with existing, but rule_configuration takes priority)
    if (Object.keys(restoredOperations).length > 0) {
      setConnectionOperations((prev) => {
        // Merge with existing operations, but rule_configuration takes priority
        const merged = { ...prev, ...restoredOperations };
        console.log('🔄 Restored operations from rule_configuration:', Object.keys(merged).length, 'connections');
        return merged;
      });
      
      // Auto-select the first connection with operations if none selected
      if (!selectedConnection) {
        const firstConnectionWithOps = connections.find(conn => restoredOperations[conn.id]);
        if (firstConnectionWithOps) {
          setSelectedConnection(firstConnectionWithOps);
          setCurrentConnection(firstConnectionWithOps);
          // Check which column has operations and select that one
          const ops = restoredOperations[firstConnectionWithOps.id];
          if (ops?.sourceOperations?.validationCategory && ops?.sourceOperations?.operationType) {
            setTargetFields({ source: true, target: false });
            // Set the operation state to match saved operations
            setCurrentOperationState({
              validationCategory: ops.sourceOperations.validationCategory || '',
              operationType: ops.sourceOperations.operationType || '',
              operationConfig: ops.sourceOperations.operationConfig || {}
            });
          } else if (ops?.targetOperations?.validationCategory && ops?.targetOperations?.operationType) {
            setTargetFields({ source: false, target: true });
            // Set the operation state to match saved operations
            setCurrentOperationState({
              validationCategory: ops.targetOperations.validationCategory || '',
              operationType: ops.targetOperations.operationType || '',
              operationConfig: ops.targetOperations.operationConfig || {}
            });
          } else {
            setTargetFields({ source: true, target: false });
          }
          console.log('🎯 Auto-selected first connection with operations from rule_configuration:', firstConnectionWithOps.id);
        }
      } else if (selectedConnection && restoredOperations[selectedConnection.id]) {
        // If a connection is already selected and has restored operations, update the state
        const ops = restoredOperations[selectedConnection.id];
        if (targetFields.source && ops?.sourceOperations?.validationCategory && ops?.sourceOperations?.operationType) {
          setCurrentOperationState({
            validationCategory: ops.sourceOperations.validationCategory || '',
            operationType: ops.sourceOperations.operationType || '',
            operationConfig: ops.sourceOperations.operationConfig || {}
          });
        } else if (targetFields.target && ops?.targetOperations?.validationCategory && ops?.targetOperations?.operationType) {
          setCurrentOperationState({
            validationCategory: ops.targetOperations.validationCategory || '',
            operationType: ops.targetOperations.operationType || '',
            operationConfig: ops.targetOperations.operationConfig || {}
          });
        }
      }
    }
  }, [connections, selectedConnection, currentConnection?.id, targetFields, setCurrentOperationState]);

  // Auto-select first validation category when connection or target field is selected (if no saved operations)
  React.useEffect(() => {
    if (selectedConnection && (targetFields.source || targetFields.target)) {
      const connectionOps = getCurrentConnectionOperations();
      
      // Check if there's a saved operation for the selected field
      const savedOps = targetFields.source 
        ? connectionOps?.sourceOperations 
        : connectionOps?.targetOperations;
      
      // Only set defaults if there's no saved operation
      if (!savedOps?.validationCategory || !savedOps?.operationType) {
        // Don't auto-select - let user choose the category and operation
        // Only clear if we're switching fields and there's no saved operation
        if (!currentOperationState.validationCategory && !currentOperationState.operationType) {
          // Keep state empty - user should select
          return;
        }
      } else {
        // Use saved operation if available
        setCurrentOperationState({
          validationCategory: savedOps.validationCategory || '',
          operationType: savedOps.operationType || '',
          operationConfig: savedOps.operationConfig || {}
        });
      }
    }
  }, [selectedConnection, targetFields, connectionOperations]);

  // Auto-select first operation type when validation category is selected (if no saved operation type)
  React.useEffect(() => {
    if (selectedConnection && currentOperationState.validationCategory && !currentOperationState.operationType) {
      const connectionOps = getCurrentConnectionOperations();
      
      // Check if there's a saved operation type for the selected field
      const savedOps = targetFields.source 
        ? connectionOps?.sourceOperations 
        : connectionOps?.targetOperations;
      
      // Only set default if saved operation category matches and there's no saved operation type
      const shouldUseSaved = savedOps?.validationCategory === currentOperationState.validationCategory;
      
      if (shouldUseSaved && savedOps?.operationType) {
        // Use saved operation type
        setCurrentOperationState(prev => ({
          ...prev,
          operationType: savedOps.operationType || '',
          operationConfig: savedOps.operationConfig || {}
        }));
      } else if (!shouldUseSaved) {
        // Don't auto-select - let user choose the operation type
        // Keep operationType empty
        return;
      }
      // If we get here, there's no saved operation but category is selected - don't auto-select operation
    }
  }, [selectedConnection, currentOperationState.validationCategory, targetFields, connectionOperations]);

  // Helper function to get main form data from store
  // const getMainFormData = () => {
  //   return {
  //     primary_table: primary_table || '',
  //     primary_key_fields: primary_key_fields || '',
  //     primary_key_value: primary_key_value || '',
  //     selected_secondary_tables: selected_secondary_tables || '',
  //     table_mappings: table_mappings || []
  //   };
  // };

  // Helper function to create complete payload with field_rules and rule_configuration
  const createCompletePayload = () => {
    const rulesPayload = getAllRulesPayload();
    
    if (!rulesPayload) return null;

    return {
      // Return field_rules and rule_configuration directly without wrapping in rules key
      field_rules: rulesPayload.field_rules || [],
      rule_configuration: rulesPayload.rule_configuration || [],
      timestamp: new Date().toISOString()
    };
  };

  // Helper functions to get/set operations for current connection
  const getCurrentConnectionOperations = () => {
    if (!selectedConnection) return null;
    return connectionOperations[selectedConnection.id] || {
      sourceOperations: { validationCategory: '', operationType: '', operationConfig: {}, result: null },
      targetOperations: { validationCategory: '', operationType: '', operationConfig: {}, result: null },
      operationResult: null,
      validationStatus: null
    };
  };

  const setCurrentConnectionOperations = (operations: any) => {
    if (!selectedConnection) return;
    setConnectionOperations(prev => ({
      ...prev,
      [selectedConnection.id]: operations
    }));
  };

  const getCurrentOperationResult = () => {
    return getCurrentConnectionOperations()?.operationResult || null;
  };

  const getCurrentValidationStatus = () => {
    return getCurrentConnectionOperations()?.validationStatus || null;
  };

  // Use getConnectionKeyState from props
  const getConnectionKeyState = propGetConnectionKeyState || ((connectionId: string) => ({ isPrimaryKey: false, isValidationKey: false }));

  // Group connections by table pairs
  const tableMappings = React.useMemo(() => {
    console.log('Processing connections:', connections.length, connections);
    
    const grouped = connections.reduce((acc, connection) => {
      const key = `${connection.sourceColumn.table}-${connection.targetColumn.table}`;
      if (!acc[key]) {
        acc[key] = {
          sourceTable: connection.sourceColumn.table,
          targetTable: connection.targetColumn.table,
          connections: []
        };
      }
      acc[key].connections.push(connection);
      return acc;
    }, {} as Record<string, { sourceTable: string; targetTable: string; connections: Connection[] }>);

    const result = Object.values(grouped);
    console.log('Grouped connections:', result);
    return result;
  }, [connections]);

  // Validation categories based on requirements
  const validationCategories = [
    { value: 'arithmetic', label: 'Arithmetic Operations' },
    { value: 'string', label: 'String Operations' },
    { value: 'mathematical', label: 'Mathematical Operations' },
    { value: 'aggregate', label: 'Aggregations' },
    { value: 'error', label: 'Error Validations' }
  ];

  // Operation types by category
  const getOperationTypes = (category: string) => {
    switch (category) {
      case 'arithmetic':
        return [
          { value: 'equal', label: 'Equal (=)' },
          { value: 'not_equal', label: 'Not Equal (≠)' },
          { value: 'greater_than', label: 'Greater Than (>)' },
          { value: 'less_than', label: 'Less Than (<)' },
          { value: 'greater_equal', label: 'Greater Equal (≥)' },
          { value: 'less_equal', label: 'Less Equal (≤)' }
        ];
      case 'string':
        return [
          { value: 'substring', label: 'Substring' },
          { value: 'concat', label: 'Concatenate' },
          { value: 'upper', label: 'Uppercase' },
          { value: 'lower', label: 'Lowercase' },
          { value: 'trim', label: 'Trim' },
          { value: 'replace', label: 'Replace' },
          { value: 'length', label: 'Length' }
        ];
      case 'mathematical':
        return [
          { value: 'add', label: 'Add (+)' },
          { value: 'subtract', label: 'Subtract (-)' },
          { value: 'multiply', label: 'Multiply (×)' },
          { value: 'divide', label: 'Divide (÷)' },
          { value: 'modulo', label: 'Modulo (%)' },
          { value: 'power', label: 'Power (^)' },
          { value: 'abs', label: 'Absolute Value' },
          { value: 'round', label: 'Round' }
        ];
      case 'aggregate':
        return [
          { value: 'count', label: 'Count' },
          { value: 'sum', label: 'Sum' },
          { value: 'avg', label: 'Average' },
          { value: 'min', label: 'Minimum' },
          { value: 'max', label: 'Maximum' }
        ];
      case 'error':
        return [
          { value: 'null_check', label: 'Null Check' },
          { value: 'empty_check', label: 'Empty Check' },
          { value: 'format_check', label: 'Format Check' },
          { value: 'range_check', label: 'Range Check' },
          { value: 'pattern_check', label: 'Pattern Check' },
          { value: 'data_type_check', label: 'Data Type Check' }
        ];
      default:
        return [];
    }
  };

  // Generate backend payload for operations
  const generateBackendPayload = () => {
    if (!selectedConnection) return null;
    
    const currentOps = getCurrentConnectionOperations();
    const operationResult = currentOps?.operationResult;
    const validationStatus = currentOps?.validationStatus;

    if (!operationResult) return null;

    // Use values from the connection object (which should have the actual data)
    const sourceValue = selectedConnection.sourceColumnValue;
    const targetValue = selectedConnection.targetColumnValue;

    const payload = {
      connectionId: selectedConnection.id || `${selectedConnection.sourceColumn.table}-${selectedConnection.targetColumn.table}`,
      sourceTable: selectedConnection.sourceColumn.table,
      targetTable: selectedConnection.targetColumn.table,
      sourceColumn: selectedConnection.sourceColumn.name,
      targetColumn: selectedConnection.targetColumn.name,
      sourceValue: sourceValue,
      targetValue: targetValue,
      operations: {
        source: operationResult.results.source !== undefined ? {
          category: operationResult.category,
          type: operationResult.operation,
          config: operationResult.config,
          result: operationResult.results.source,
          applied: true
        } : {
          applied: false,
          originalValue: sourceValue
        },
        target: operationResult.results.target !== undefined ? {
          category: operationResult.category,
          type: operationResult.operation,
          config: operationResult.config,
          result: operationResult.results.target,
          applied: true
        } : {
          applied: false,
          originalValue: targetValue
        }
      },
      validation: validationStatus ? {
        isValid: validationStatus.isValid,
        comparison: validationStatus.comparison,
        sourceValue: validationStatus.sourceValue,
        targetValue: validationStatus.targetValue,
        sourceCurrentValue: validationStatus.sourceValue,
        targetCurrentValue: validationStatus.targetValue
      } : null,
      timestamp: new Date().toISOString(),
      // Append complete operation result JSON
      completeOperationResult: operationResult,
      // Append all stored rule operations
      allRuleOperations: ruleOperations
    };

    return payload;
  };

  // Helper function to get operation descriptions
  const getOperationDescription = (operation: string): string => {
    const descriptions: Record<string, string> = {
      // Arithmetic Operations
      'equal': 'Checks if values are equal',
      'not_equal': 'Checks if values are not equal',
      'greater_than': 'Checks if value is greater than compare value',
      'less_than': 'Checks if value is less than compare value',
      'greater_equal': 'Checks if value is greater than or equal to compare value',
      'less_equal': 'Checks if value is less than or equal to compare value',
      
      // String Operations
      'substring': 'Extracts a portion of the string',
      'concat': 'Joins strings together',
      'upper': 'Converts string to uppercase',
      'lower': 'Converts string to lowercase',
      'trim': 'Removes leading and trailing whitespace',
      'replace': 'Replaces occurrences of a substring',
      'length': 'Returns the length of the string',
      
      // Mathematical Operations
      'add': 'Adds a value to the column',
      'subtract': 'Subtracts a value from the column',
      'multiply': 'Multiplies the column by a value',
      'divide': 'Divides the column by a value',
      'modulo': 'Returns the remainder of division',
      'power': 'Raises the value to a power',
      'abs': 'Returns absolute value (removes negative sign)',
      'round': 'Rounds the value to specified precision',
      
      // Aggregate Operations
      'count': 'Counts the number of records',
      'sum': 'Calculates the total sum of values',
      'avg': 'Calculates the average (mean) of values',
      'min': 'Finds the minimum value',
      'max': 'Finds the maximum value',
      
      // Error Validations
      'null_check': 'Validates that value is not null',
      'empty_check': 'Validates that string is not empty',
      'format_check': 'Validates value matches specific format',
      'range_check': 'Validates value is within specified range',
      'pattern_check': 'Validates value matches regex pattern'
    };
    
    return descriptions[operation] || 'Performs operation on the data';
  };

  // Helper function to get operation examples
  const getOperationExample = (operation: string, config: any): string => {
    const examples: Record<string, (config: any) => string> = {
      'equal': (cfg) => `${cfg.compareValue || 25} = ${cfg.compareValue || 25} → PASS`,
      'not_equal': (cfg) => `${cfg.compareValue || 0} ≠ ${cfg.compareValue || 0} → PASS`,
      'greater_than': (cfg) => `${(cfg.compareValue || 100) + 50} > ${cfg.compareValue || 100} → PASS`,
      'less_than': (cfg) => `${(cfg.compareValue || 1000) - 100} < ${cfg.compareValue || 1000} → PASS`,
      'greater_equal': (cfg) => `${cfg.compareValue || 5} ≥ ${cfg.compareValue || 5} → PASS`,
      'less_equal': (cfg) => `${cfg.compareValue || 3} ≤ ${cfg.compareValue || 3} → PASS`,
      
      'substring': (cfg) => `john.doe@example.com → john.doe@e (start: ${cfg.start || 0}, end: ${cfg.end || 10})`,
      'concat': (cfg) => `John → John${cfg.appendValue || ' (Employee)'}`,
      'upper': () => `Product Name → PRODUCT NAME`,
      'lower': () => `UserName → username`,
      'trim': () => `  Order Details  → Order Details`,
      'replace': (cfg) => `123-456-7890 → 1234567890 (find: "${cfg.find || '-'}", replace: "${cfg.replace || ''}")`,
      'length': () => `SKU-12345 → 9`,
      
      'add': (cfg) => `100.00 + ${cfg.addend || 10.50} → ${(100 + (cfg.addend || 10.50)).toFixed(2)}`,
      'subtract': (cfg) => `100.00 - ${cfg.subtrahend || 15.00} → ${(100 - (cfg.subtrahend || 15.00)).toFixed(2)}`,
      'multiply': (cfg) => `50.00 × ${cfg.multiplier || 2} → ${(50 * (cfg.multiplier || 2)).toFixed(2)}`,
      'divide': (cfg) => `100.00 ÷ ${cfg.divisor || 2} → ${(100 / (cfg.divisor || 2)).toFixed(2)}`,
      'modulo': (cfg) => `23 % ${cfg.divisor || 10} → ${23 % (cfg.divisor || 10)}`,
      'power': (cfg) => `5 ^ ${cfg.exponent || 2} → ${Math.pow(5, cfg.exponent || 2)}`,
      'abs': () => `-15.5 → 15.5`,
      'round': (cfg) => `123.456 (precision: ${cfg.precision || 2}) → 123.46`,
      
      'count': () => `[1, 2, 3, 4, 5] → 5`,
      'sum': () => `[10, 20, 30, 40] → 100`,
      'avg': () => `[10, 20, 30, 40] → 25`,
      'min': () => `[10, 20, 5, 30] → 5`,
      'max': () => `[10, 20, 50, 30] → 50`,
      
      'null_check': () => `john@example.com → PASS, null → FAIL`,
      'empty_check': () => `'Product Details' → PASS, '' → FAIL`,
      'format_check': (cfg) => `'2025-10-14' (${cfg.format || 'YYYY-MM-DD'}) → PASS, '10/14/2025' → FAIL`,
      'range_check': (cfg) => `25 (min: ${cfg.min || 18}, max: ${cfg.max || 65}) → PASS, 70 → FAIL`,
      'pattern_check': (cfg) => `'1234567890' (${cfg.pattern || '^[0-9]{10}$'}) → PASS, 'abc1234567' → FAIL`
    };
    
    const exampleFn = examples[operation];
    return exampleFn ? exampleFn(config) : 'Example output';
  };

  // Get all rules payload for backend
  const getAllRulesPayload = () => {
    console.log('📋 getAllRulesPayload - Processing connections:', {
      totalConnections: connections.length,
      connections: connections.map(c => ({
        id: c.id,
        source: `${c.sourceColumn.table}.${c.sourceColumn.name}`,
        target: `${c.targetColumn.table}.${c.targetColumn.name}`
      }))
    });
    
    // Group connections by table pairs to create rule names
    const ruleGroups: Record<string, Connection[]> = {};
    
    connections.forEach(connection => {
      const derivedRuleName = `${connection.sourceColumn.table}_VS_${connection.targetColumn.table}`;
      const ruleName = (connection as any).ruleName || derivedRuleName;
      if (!ruleGroups[ruleName]) {
        ruleGroups[ruleName] = [];
      }
      ruleGroups[ruleName].push(connection);
    });

    console.log('📊 Rule Groups:', {
      totalGroups: Object.keys(ruleGroups).length,
      groups: Object.entries(ruleGroups).map(([ruleName, conns]) => ({
        ruleName,
        connectionCount: conns.length
      }))
    });

    // Generate field_rules array
    const fieldRules: any[] = [];
    
    connections.forEach(connection => {
      const derivedRuleName = `${connection.sourceColumn.table}_VS_${connection.targetColumn.table}`;
      const ruleName = (connection as any).ruleName || derivedRuleName;
      const keyState = getConnectionKeyState(connection.id);
      
      fieldRules.push({
        rule: ruleName,
        sourceColumn: {
          name: connection.sourceColumn.name,
          type: connection.sourceColumn.type,
          table: connection.sourceColumn.table,
          source: connection.sourceColumn.source,
          application: connection.sourceColumn.application,
          isPrimaryKey: keyState.isPrimaryKey,
          isValidationKey: keyState.isValidationKey
        },
        targetColumn: {
          name: connection.targetColumn.name,
          type: connection.targetColumn.type,
          table: connection.targetColumn.table,
          source: connection.targetColumn.source,
          application: connection.targetColumn.application,
          isPrimaryKey: keyState.isPrimaryKey,
          isValidationKey: keyState.isValidationKey
        }
      });
    });

    console.log('✅ Generated field_rules:', {
      totalRules: fieldRules.length,
      rules: fieldRules.map(r => ({
        rule: r.rule,
        source: r.sourceColumn.name,
        target: r.targetColumn.name
      }))
    });

    // Generate rule_configuration array organized by categories
    // Define operation categories mapping
    const categoryLabels: Record<string, string> = {
      'arithmetic': 'Arithmetic Operations',
      'string': 'String Operations',
      'mathematical': 'Mathematical Operations',
      'aggregate': 'Aggregate Operations',
      'error': 'Error Validations'
    };
    
    console.log('🔍 Connection Operations State:', {
      totalConnections: connections.length,
      connectionOperationsKeys: Object.keys(connectionOperations),
      connectionOperations: Object.entries(connectionOperations).map(([id, ops]: [string, any]) => ({
        id,
        hasOperationResult: !!ops?.operationResult,
        hasSourceOps: !!ops?.sourceOperations,
        hasTargetOps: !!ops?.targetOperations,
        sourceOperationType: ops?.sourceOperations?.operationType,
        targetOperationType: ops?.targetOperations?.operationType,
        sourceCategory: ops?.sourceOperations?.validationCategory,
        targetCategory: ops?.targetOperations?.validationCategory,
        operationResult: ops?.operationResult
      }))
    });
    
    // Group operations by category
    const operationsByCategory: Record<string, any[]> = {};
    
    connections.forEach(connection => {
      const derivedRuleName = `${connection.sourceColumn.table}_VS_${connection.targetColumn.table}`;
      const ruleName = (connection as any).ruleName || derivedRuleName;
      const connectionOps = connectionOperations[connection.id];
      
      console.log(`🔎 Processing connection ${connection.id}:`, {
        ruleName,
        hasConnectionOps: !!connectionOps,
        hasOperationResult: !!connectionOps?.operationResult,
        sourceOps: connectionOps?.sourceOperations,
        targetOps: connectionOps?.targetOperations,
        operationResult: connectionOps?.operationResult,
        fullConnectionOps: connectionOps
      });
      
      // Check if operations are applied - either operationResult OR individual source/target operations
      const hasSourceOperations = !!(connectionOps?.sourceOperations?.operationType && connectionOps?.sourceOperations?.validationCategory);
      const hasTargetOperations = !!(connectionOps?.targetOperations?.operationType && connectionOps?.targetOperations?.validationCategory);
      const hasOperationResult = !!connectionOps?.operationResult;
      
      console.log(`  ├─ Has source operations: ${hasSourceOperations}`, connectionOps?.sourceOperations);
      console.log(`  ├─ Has target operations: ${hasTargetOperations}`, connectionOps?.targetOperations);
      console.log(`  └─ Has operation result: ${hasOperationResult}`, connectionOps?.operationResult);
      
      // Only add to rule_configuration if operations are applied
      if (hasOperationResult || hasSourceOperations || hasTargetOperations) {
        const operationResult = connectionOps?.operationResult || {};
        
        // Build source column config - prioritize sourceOperations first
        let sourceConfig = {};
        let sourceOperation = '';
        let sourceCategory = '';
        
        if (hasSourceOperations) {
          // If source has specific operations, use them
          sourceConfig = connectionOps.sourceOperations.operationConfig || {};
          sourceOperation = connectionOps.sourceOperations.operationType || '';
          sourceCategory = connectionOps.sourceOperations.validationCategory || '';
          console.log('  ├─ Using source operations:', { sourceOperation, sourceCategory, sourceConfig });
        } else if (operationResult?.results?.source !== undefined) {
          // If source was transformed using the shared operation, use the shared config
          sourceConfig = operationResult.config || {};
          sourceOperation = operationResult.operation || '';
          sourceCategory = operationResult.category || '';
          console.log('  ├─ Using operation result for source:', { sourceOperation, sourceCategory, sourceConfig });
        }
        
        // Build target column config - prioritize targetOperations first
        let targetConfig = {};
        let targetOperation = '';
        let targetCategory = '';
        
        if (hasTargetOperations) {
          // If target has specific operations, use them
          targetConfig = connectionOps.targetOperations.operationConfig || {};
          targetOperation = connectionOps.targetOperations.operationType || '';
          targetCategory = connectionOps.targetOperations.validationCategory || '';
          console.log('  ├─ Using target operations:', { targetOperation, targetCategory, targetConfig });
        } else if (operationResult?.results?.target !== undefined) {
          // If target was transformed using the shared operation, use the shared config
          targetConfig = operationResult.config || {};
          targetOperation = operationResult.operation || '';
          targetCategory = operationResult.category || '';
          console.log('  ├─ Using operation result for target:', { targetOperation, targetCategory, targetConfig });
        }
        
        // Determine the primary category for this operation
        const primaryCategory = sourceCategory || targetCategory || 'error';
        console.log('  └─ Primary category:', primaryCategory);
        
        // Create the operation entry
        const operationEntry = {
          rule: ruleName,
          connectionId: connection.id,
          sourceColumn: {
            name: connection.sourceColumn.name,
            type: connection.sourceColumn.type,
            table: connection.sourceColumn.table,
            application: connection.sourceColumn.application,
            operation: sourceOperation,
            category: sourceCategory,
            config: sourceConfig,
            applied: !!(connectionOps.sourceOperations?.operationConfig && Object.keys(connectionOps.sourceOperations.operationConfig).length > 0) || 
                     !!(operationResult.results?.source !== undefined)
          },
          targetColumn: {
            name: connection.targetColumn.name,
            type: connection.targetColumn.type,
            table: connection.targetColumn.table,
            application: connection.targetColumn.application,
            operation: targetOperation,
            category: targetCategory,
            config: targetConfig,
            applied: !!(connectionOps.targetOperations?.operationConfig && Object.keys(connectionOps.targetOperations.operationConfig).length > 0) || 
                     !!(operationResult.results?.target !== undefined)
          },
          validationStatus: connectionOps?.validationStatus || 'passed',
          description: `${sourceOperation || targetOperation} - ${getOperationDescription(sourceOperation || targetOperation)}`
        };
        
        // Add example if config has values
        const exampleConfig = sourceConfig && Object.keys(sourceConfig).length > 0 ? sourceConfig : targetConfig;
        if (exampleConfig && Object.keys(exampleConfig).length > 0) {
          operationEntry['example'] = getOperationExample(sourceOperation || targetOperation, exampleConfig);
        }
        
        // Group by category
        if (!operationsByCategory[primaryCategory]) {
          operationsByCategory[primaryCategory] = [];
        }
        operationsByCategory[primaryCategory].push(operationEntry);
        
        console.log(`✅ Added operation to category "${primaryCategory}":`, {
          rule: operationEntry.rule,
          sourceOp: operationEntry.sourceColumn.operation,
          targetOp: operationEntry.targetColumn.operation,
          totalInCategory: operationsByCategory[primaryCategory].length
        });
      } else {
        console.log(`❌ Skipping connection ${connection.id} - no operations configured`);
      }
    });
    
    // Convert to the required array structure with category grouping
    const ruleConfiguration: any[] = [];
    Object.entries(operationsByCategory).forEach(([categoryKey, operations]) => {
      ruleConfiguration.push({
        category: categoryLabels[categoryKey] || categoryKey,
        operations: operations
      });
    });

    console.log('🔧 Rule Configuration Generated:', {
      totalCategories: ruleConfiguration.length,
      categories: ruleConfiguration.map(cat => ({
        category: cat.category,
        operationCount: cat.operations.length,
        operations: cat.operations.map((op: any) => ({
          rule: op.rule,
          sourceOp: op.sourceColumn.operation,
          targetOp: op.targetColumn.operation,
          sourceCategory: op.sourceColumn.category,
          targetCategory: op.targetColumn.category
        }))
      })),
      fullStructure: ruleConfiguration
    });

    // Create the new payload structure
    const newPayload = {
      field_rules: fieldRules,
      rule_configuration: ruleConfiguration
    };

    // Also keep the old comprehensive payload for backward compatibility (optional)
    const allConnectionsPayload = connections.map(connection => {
      const connectionOps = connectionOperations[connection.id];
      const sourceValue = connection.sourceColumnValue;
      const targetValue = connection.targetColumnValue;

      if (!connectionOps?.operationResult) {
        return {
          connectionId: connection.id,
          sourceTable: connection.sourceColumn.table,
          targetTable: connection.targetColumn.table,
          sourceColumn: connection.sourceColumn.name,
          targetColumn: connection.targetColumn.name,
          sourceValue: sourceValue,
          targetValue: targetValue,
          operations: {
            source: { applied: false, originalValue: sourceValue },
            target: { applied: false, originalValue: targetValue }
          },
          validation: null,
          hasOperations: false
        };
      }

      const operationResult = connectionOps.operationResult;
      const validationStatus = connectionOps.validationStatus;

      return {
        connectionId: connection.id,
        sourceTable: connection.sourceColumn.table,
        targetTable: connection.targetColumn.table,
        sourceColumn: connection.sourceColumn.name,
        targetColumn: connection.targetColumn.name,
        sourceValue: sourceValue,
        targetValue: targetValue,
        operations: {
          source: operationResult.results.source !== undefined ? {
            category: operationResult.category,
            type: operationResult.operation,
            config: operationResult.config,
            result: operationResult.results.source,
            applied: true
          } : {
            applied: false,
            originalValue: sourceValue
          },
          target: operationResult.results.target !== undefined ? {
            category: operationResult.category,
            type: operationResult.operation,
            config: operationResult.config,
            result: operationResult.results.target,
            applied: true
          } : {
            applied: false,
            originalValue: targetValue
          }
        },
        validation: validationStatus ? {
          isValid: validationStatus.isValid,
          comparison: validationStatus.comparison,
          sourceValue: validationStatus.sourceValue,
          targetValue: validationStatus.targetValue,
          sourceCurrentValue: validationStatus.sourceValue,
          targetCurrentValue: validationStatus.targetValue
        } : null,
        hasOperations: true,
        timestamp: new Date().toISOString()
      };
    });

    // Return only field_rules and rule_configuration (no rules key)
    return newPayload;
  };

  const handleApplyOperation = () => {
    if (!selectedConnection || !currentOperationState.operationType || !currentOperationState.validationCategory) return;
    if (!targetFields.source && !targetFields.target) return;

    const sourceValue = selectedConnection.sourceColumnValue;
    const targetValue = selectedConnection.targetColumnValue;
    
    // Get current connection operations - preserve existing data
    const currentOps = getCurrentConnectionOperations();
    const existingResults = currentOps?.operationResult?.results || {};
    const results: any = { ...existingResults };

    // Prepare updated operations object - preserve existing operations
    let updatedOps: any = {
      ...currentOps,
      sourceOperations: currentOps?.sourceOperations || { validationCategory: '', operationType: '', operationConfig: {}, result: null },
      targetOperations: currentOps?.targetOperations || { validationCategory: '', operationType: '', operationConfig: {}, result: null }
    };

    // Perform operation only on the selected column
    if (targetFields.source) {
      // Source is selected - perform operation on source value only
      const result = executeOperation(
        currentOperationState.validationCategory, 
        currentOperationState.operationType, 
        sourceValue, 
        currentOperationState.operationConfig
      );
      results.source = result;
      
      // Update ONLY source operations, preserve target operations
      updatedOps.sourceOperations = {
          validationCategory: currentOperationState.validationCategory,
          operationType: currentOperationState.operationType,
          operationConfig: currentOperationState.operationConfig,
          result: result
      };
    } else if (targetFields.target) {
      // Target is selected - perform operation on target value only
      const result = executeOperation(
        currentOperationState.validationCategory, 
        currentOperationState.operationType, 
        targetValue, 
        currentOperationState.operationConfig
      );
      results.target = result;
      
      // Update ONLY target operations, preserve source operations
      updatedOps.targetOperations = {
          validationCategory: currentOperationState.validationCategory,
          operationType: currentOperationState.operationType,
          operationConfig: currentOperationState.operationConfig,
          result: result
      };
    }

    const operationResultData = {
      category: currentOperationState.validationCategory,
      operation: currentOperationState.operationType,
      targetFields: targetFields,
      input: {
        source: sourceValue,
        target: targetValue
      },
      config: currentOperationState.operationConfig,
      results: results
    };

    // Update operation result for this connection - preserve all operations
    updatedOps.operationResult = operationResultData;
    setCurrentConnectionOperations(updatedOps);

    // Debug logging to verify config is being saved
    console.log('💾 Operation Applied:', {
      connectionId: selectedConnection?.id,
      category: currentOperationState.validationCategory,
      operation: currentOperationState.operationType,
      config: currentOperationState.operationConfig,
      targetFields: targetFields,
      preservedSourceOps: updatedOps.sourceOperations,
      preservedTargetOps: updatedOps.targetOperations
    });

    // Also store in global store
    setCurrentOperationResult(operationResultData);
  };

  // Unified operation execution
  const executeOperation = (category: string, type: string, inputValue: any, config: any) => {
    switch (category) {
      case 'arithmetic':
        return performArithmeticOperation(type, inputValue, config);
      case 'string':
        return performStringOperation(type, inputValue, config);
      case 'mathematical':
        return performMathematicalOperation(type, inputValue, config);
      case 'aggregate':
        return performAggregateOperation(type, inputValue, config);
      case 'error':
        return performErrorValidation(type, inputValue, config);
        default:
        return inputValue;
    }
  };

  // Arithmetic operations (121233 = 123203)
  const performArithmeticOperation = (type: string, inputValue: any, config: any) => {
    // Parse input value - handle both string and number types
    const input = typeof inputValue === 'string' ? parseFloat(inputValue) : Number(inputValue);
    const expected = typeof config.expectedValue === 'string' ? parseFloat(config.expectedValue) : Number(config.expectedValue);
    
    // Check if parsing failed
    if (isNaN(input) || isNaN(expected)) {
      console.warn('⚠️ Arithmetic operation failed - invalid numeric values:', { inputValue, expectedValue: config.expectedValue });
      return { error: 'Invalid numeric values', input: inputValue, expected: config.expectedValue };
    }

    console.log('🔢 Arithmetic Operation:', { type, input, expected });

    switch (type) {
      case 'equal':
        return input === expected;
      case 'not_equal':
        return input !== expected;
      case 'greater_than':
        return input > expected;
      case 'less_than':
        return input < expected;
      case 'greater_equal':
        return input >= expected;
      case 'less_equal':
        return input <= expected;
      default:
        return false;
    }
  };

  // String operations (MMT-68900032 = 20068900032 with substring)
  const performStringOperation = (type: string, inputValue: any, config: any) => {
    const str = String(inputValue || '');
    
    switch (type) {
      case 'substring':
        const start = config.start || 0;
        const end = config.end || str.length;
        return str.substring(start, end);
      case 'concat':
        return `${str}${config.appendText || ''}`;
      case 'upper':
        return str.toUpperCase();
      case 'lower':
        return str.toLowerCase();
      case 'trim':
        return str.trim();
      case 'replace':
        const search = config.search || '';
        const replace = config.replace || '';
        return str.replace(new RegExp(search, 'g'), replace);
      case 'length':
        return str.length;
      default:
        return str;
    }
  };

  // Mathematical operations (with additional derived column)
  const performMathematicalOperation = (type: string, inputValue: any, config: any) => {
    // Parse input value - handle both string and number types
    const num = typeof inputValue === 'string' ? parseFloat(inputValue) : Number(inputValue);
    const operand = typeof config.operand === 'string' ? parseFloat(config.operand) : Number(config.operand);

    // Check if parsing failed
    if (isNaN(num)) {
      console.warn('⚠️ Mathematical operation failed - invalid input value:', inputValue);
      return { error: 'Invalid numeric input', input: inputValue };
    }
    
    if (isNaN(operand) && !['abs', 'round'].includes(type)) {
      console.warn('⚠️ Mathematical operation failed - invalid operand:', config.operand);
      return { error: 'Invalid operand', operand: config.operand };
    }

    console.log('🧮 Mathematical Operation:', { type, num, operand });

    switch (type) {
      case 'add':
        return num + operand;
      case 'subtract':
        return num - operand;
      case 'multiply':
        return num * operand;
      case 'divide':
        return operand !== 0 ? num / operand : { error: 'Division by zero' };
      case 'modulo':
        return operand !== 0 ? num % operand : { error: 'Division by zero' };
      case 'power':
        return Math.pow(num, operand);
      case 'abs':
        return Math.abs(num);
      case 'round':
        return Math.round(num);
      default:
        return num;
    }
  };

  // Aggregate operations (count/sum for integer/long/float)
  const performAggregateOperation = (type: string, inputValue: any, config: any) => {
    // Parse input value - handle both string and number types
    const num = typeof inputValue === 'string' ? parseFloat(inputValue) : Number(inputValue);
    const dataType = config.dataType || 'integer';

    console.log('📊 Aggregate Operation:', { type, inputValue, num, dataType });

    // Only allow aggregates on numeric data types
    if (['integer', 'long', 'float', 'number', 'decimal'].includes(dataType)) {
      // Check if num is valid
      if (isNaN(num) && type !== 'count') {
        console.warn('⚠️ Aggregate operation failed - invalid numeric value:', inputValue);
        return { error: 'Invalid numeric value', input: inputValue };
      }

      switch (type) {
        case 'count':
          return inputValue != null ? 1 : 0;
        case 'sum':
          return num;
        case 'avg':
          return num;
        case 'min':
          return num;
        case 'max':
          return num;
        default:
          return num;
      }
    } else {
      return { error: 'Aggregate operations only supported for numeric data types', dataType };
    }
  };

  // Error validations (technical evaluation)
  const performErrorValidation = (type: string, inputValue: any, config: any) => {
    console.log('🔍 Error Validation:', { type, inputValue, config });

    switch (type) {
      case 'null_check':
        const nullCheckResult = inputValue != null;
        return { isValid: nullCheckResult, message: nullCheckResult ? 'Value is not null' : 'Value is null' };
      
      case 'empty_check':
        const emptyCheckResult = inputValue !== '' && inputValue != null;
        return { isValid: emptyCheckResult, message: emptyCheckResult ? 'Value is not empty' : 'Value is empty' };
      
      case 'format_check':
        const pattern = config.pattern || '';
        if (!pattern) {
          return { isValid: false, message: 'No pattern specified', error: 'Pattern required' };
        }
        try {
          const regex = new RegExp(pattern);
          const formatCheckResult = regex.test(String(inputValue || ''));
          return { isValid: formatCheckResult, message: formatCheckResult ? 'Format matches pattern' : 'Format does not match pattern', pattern };
        } catch (error) {
          return { isValid: false, message: 'Invalid regex pattern', error: String(error) };
        }
      
      case 'range_check':
        const min = typeof config.min === 'string' ? parseFloat(config.min) : Number(config.min);
        const max = typeof config.max === 'string' ? parseFloat(config.max) : Number(config.max);
        const value = typeof inputValue === 'string' ? parseFloat(inputValue) : Number(inputValue);
        
        if (isNaN(value)) {
          return { isValid: false, message: 'Invalid numeric value for range check', input: inputValue };
        }
        
        const rangeCheckResult = value >= min && value <= max;
        return { 
          isValid: rangeCheckResult, 
          message: rangeCheckResult ? `Value (${value}) is within range [${min}, ${max}]` : `Value (${value}) is outside range [${min}, ${max}]`,
          value, min, max
        };
      
      case 'pattern_check':
        const checkPattern = config.pattern || '.*';
        try {
          const patternRegex = new RegExp(checkPattern);
          const patternCheckResult = patternRegex.test(String(inputValue || ''));
          return { 
            isValid: patternCheckResult, 
            message: patternCheckResult ? 'Value matches pattern' : 'Value does not match pattern',
            pattern: checkPattern
          };
        } catch (error) {
          return { isValid: false, message: 'Invalid regex pattern', error: String(error) };
        }
      
      case 'data_type_check':
        const expectedType = config.expectedType || 'string';
        let isValid = false;
        let actualType: string = typeof inputValue;
        
        switch (expectedType) {
          case 'integer':
            const intVal = typeof inputValue === 'string' ? parseFloat(inputValue) : Number(inputValue);
            isValid = Number.isInteger(intVal) && !isNaN(intVal);
            actualType = isValid ? 'integer' : 'not an integer';
            break;
          case 'float':
          case 'number':
          case 'decimal':
            const floatVal = typeof inputValue === 'string' ? parseFloat(inputValue) : Number(inputValue);
            isValid = !isNaN(floatVal);
            actualType = isValid ? 'number' : 'not a number';
            break;
          case 'string':
            isValid = typeof inputValue === 'string';
            break;
          case 'boolean':
            isValid = typeof inputValue === 'boolean';
            break;
          default:
            isValid = true;
        }
        
        return { 
          isValid, 
          message: isValid ? `Value is ${expectedType}` : `Value is ${actualType}, expected ${expectedType}`,
          expectedType,
          actualType
        };
      
      default:
        return { isValid: true, message: 'Unknown validation type', type };
    }
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background p-0">
        <div className="max-w-full">
        {/* Fixed Header - only show if not hidden */}
        {!hideHeader && (
          <div className="sticky top-0 z-10 bg-white border-b border-slate-200 p-1 mb-2 ">
            <div className="flex justify-between items-center">
              <nav className="flex items-center space-x-2 text-sm text-slate-600">
                <button 
                  onClick={onBack}
                  className="hover:text-slate-800 hover:underline"
                >
                  Data Sources
                </button>
                {/* <ChevronRight className="h-4 w-4" />
                <button 
                  onClick={onBack}
                  className="hover:text-slate-800 hover:underline"
                >
                  Table Selection
                </button> */}
                <ChevronRight className="h-4 w-4" />
                <span className="text-slate-800 font-medium">Rule Configuration</span>
              </nav>
              <div className="flex items-center gap-2">
              {(() => {
                // Count operations applied from connectionOperations state
                const operationsAppliedCount = Object.keys(connectionOperations).filter(connId => {
                  const ops = connectionOperations[connId];
                  const hasSourceOps = !!(ops?.sourceOperations?.operationType && ops?.sourceOperations?.validationCategory);
                  const hasTargetOps = !!(ops?.targetOperations?.operationType && ops?.targetOperations?.validationCategory);
                  const hasOperationResult = !!ops?.operationResult;
                  return hasSourceOps || hasTargetOps || hasOperationResult;
                }).length;
                
                // Get submitted rules from store to show accurate count
                const storeSubmitRules = useValidationStore.getState().submitRules;
                const submittedRulesCount = storeSubmitRules?.rule_configuration?.length || 0;
                
                // Show operations applied badge if there are operations in current state
                if (operationsAppliedCount > 0) {
                  return (
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                      {operationsAppliedCount} Operations Applied
                    </Badge>
                  );
                }
                
                // Show saved rules badge if there are submitted rules in store
                if (submittedRulesCount > 0) {
                  return (
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                      {submittedRulesCount} Saved Rules
                    </Badge>
                  );
                }
                
                return null;
              })()}
              <Button
                variant="outline"
                   size="sm"
                   onClick={() => {
                     const completePayload = createCompletePayload();
                     if (completePayload) {
                       console.log('🎯 ========================================');
                       console.log('🎯 SUBMITTING RULES - COMPLETE PAYLOAD');
                       console.log('🎯 ========================================');
                       console.log(`📋 Total Field Rules: ${completePayload.field_rules.length}`);
                       console.log(`⚙️  Total Rule Configurations: ${completePayload.rule_configuration.length}`);
                       console.log('📦 Complete Payload:', JSON.stringify(completePayload, null, 2));
                       
                       console.log('\n🔧 Connection Operations being stored:');
                       console.log(`   Total connections with operations: ${Object.keys(connectionOperations).length}`);
                       Object.keys(connectionOperations).forEach((id, index) => {
                         const ops = connectionOperations[id];
                         console.log(`   ${index + 1}. Connection ID: ${id}`);
                         console.log(`      - Has operation result: ${!!ops?.operationResult}`);
                         console.log(`      - Source operation: ${ops?.sourceOperations?.operationType || 'none'}`);
                         console.log(`      - Target operation: ${ops?.targetOperations?.operationType || 'none'}`);
                       });
                       console.log('');
                       
                      // Store operations from connectionOperations state - update existing or add new
                      Object.keys(connectionOperations).forEach(connectionId => {
                        const connectionOps = connectionOperations[connectionId];
                        if (connectionOps?.operationResult) {
                          const connection = connections.find(conn => conn.id === connectionId);
                          if (connection) {
                            // Check if this EXACT rule already exists in ruleOperations by connectionId only
                            const existingRuleIndex = ruleOperations?.findIndex((rule: any) => 
                              rule.connectionId === connection.id
                            );
                            
                            const ruleOperationData = {
                              connectionId: connection.id,
                              sourceTable: connection.sourceColumn.table,
                              targetTable: connection.targetColumn.table,
                              sourceColumn: connection.sourceColumn.name,
                              targetColumn: connection.targetColumn.name,
                              sourceValue: connection.sourceColumnValue,
                              targetValue: connection.targetColumnValue,
                              operations: {
                                source: {
                                  category: connectionOps.sourceOperations?.validationCategory,
                                  type: connectionOps.sourceOperations?.operationType,
                                  config: connectionOps.sourceOperations?.operationConfig,
                                  result: connectionOps.sourceOperations?.result,
                                  applied: !!connectionOps.sourceOperations?.result
                                },
                                target: {
                                  category: connectionOps.targetOperations?.validationCategory,
                                  type: connectionOps.targetOperations?.operationType,
                                  config: connectionOps.targetOperations?.operationConfig,
                                  result: connectionOps.targetOperations?.result,
                                  applied: !!connectionOps.targetOperations?.result
                                }
                              },
                              validation: connectionOps.validationStatus,
                              timestamp: new Date().toISOString()
                            };
                            
                            // Always add the rule operation (store will handle updates)
                            addRuleOperation(ruleOperationData);
                            
                            if (existingRuleIndex === -1 || !ruleOperations || ruleOperations.length === 0) {
                              console.log(`✅ Added new rule for connection: ${connection.id}`);
                            } else {
                              console.log(`🔄 Updated existing rule for connection: ${connection.id}`);
                            }
                          }
                        }
                      });
                       
                      // Pass submit rules to parent component
                      if (onSubmitRules) {
                        onSubmitRules(completePayload);
                        console.log('✅ Submit rules passed to parent component:', completePayload);
                        
                        // Log the new field_rules and rule_configuration structure
                        if (completePayload.field_rules) {
                          console.log('📋 Field Rules Generated:', JSON.stringify(completePayload.field_rules, null, 2));
                          console.log('📊 Total Field Rules:', completePayload.field_rules.length);
                        }
                        if (completePayload.rule_configuration) {
                          console.log('⚙️ Rule Configuration Generated:', JSON.stringify(completePayload.rule_configuration, null, 2));
                          console.log('🔧 Total Rule Configurations:', completePayload.rule_configuration.length);
                          
                          // Log individual config keys (same as parameters in derive column)
                          console.log('🔑 CONFIG KEYS STRUCTURE (same as parameters in derive column):');
                          completePayload.rule_configuration.forEach((ruleConfig: any, index: number) => {
                            console.log(`\n   Rule ${index + 1}: ${ruleConfig.rule}`);
                            console.log(`   ├─ Source Column: ${ruleConfig.sourceColumn.name}`);
                            console.log(`   │  ├─ Operation: ${ruleConfig.sourceColumn.operation || 'NO OPERATION'}`);
                            console.log(`   │  └─ Config:`, JSON.stringify(ruleConfig.sourceColumn.config));
                            console.log(`   └─ Target Column: ${ruleConfig.targetColumn.name}`);
                            console.log(`      ├─ Operation: ${ruleConfig.targetColumn.operation || 'NO OPERATION'}`);
                            console.log(`      └─ Config:`, JSON.stringify(ruleConfig.targetColumn.config));
                          });
                          
                          // Additional debug: Log connectionOperations state
                          console.log('\n🔍 DEBUG - connectionOperations state:', connectionOperations);
                        }
                      }
                     }
                   }}
                   disabled={(() => {
                     // Count connections with operations applied
                     const opsCount = Object.keys(connectionOperations).filter(connId => {
                       const ops = connectionOperations[connId];
                       const hasSourceOps = !!(ops?.sourceOperations?.operationType && ops?.sourceOperations?.validationCategory);
                       const hasTargetOps = !!(ops?.targetOperations?.operationType && ops?.targetOperations?.validationCategory);
                       const hasOperationResult = !!ops?.operationResult;
                       return hasSourceOps || hasTargetOps || hasOperationResult;
                     }).length;
                     return opsCount === 0;
                   })()}
                   className="text-xs"
                 >
                   {(() => {
                     // Count connections with operations applied
                     const opsCount = Object.keys(connectionOperations).filter(connId => {
                       const ops = connectionOperations[connId];
                       const hasSourceOps = !!(ops?.sourceOperations?.operationType && ops?.sourceOperations?.validationCategory);
                       const hasTargetOps = !!(ops?.targetOperations?.operationType && ops?.targetOperations?.validationCategory);
                       const hasOperationResult = !!ops?.operationResult;
                       return hasSourceOps || hasTargetOps || hasOperationResult;
                     }).length;
                     
                     // Also count from store if available
                     const storeSubmitRules = useValidationStore.getState().submitRules;
                     const storeRulesCount = storeSubmitRules?.rule_configuration?.length || 0;
                     
                     if (opsCount > 0) {
                       return `Submit All Rules (${opsCount} operations)`;
                     } else if (storeRulesCount > 0) {
                       return `Submit All Rules (${storeRulesCount} saved)`;
                     }
                     return 'Submit All Rules (0 operations)';
                   })()}
                 </Button>
             
              <Button
                variant="outline"
                  size="sm"
                onClick={onBack}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              </div>
              </div>
            </div>
          )}
          
          {/* Three Panel Layout - Only show middle/right panels if validation operations are not hidden */}
          <div className={`grid ${hideValidationOperations ? 'grid-cols-1' : 'grid-cols-3'} gap-4 ${hideValidationOperations ? 'h-full' : 'h-[400px]'}`}>
            
            {/* Left Panel - Connections */}
            <div className={`bg-white border border-slate-200 rounded-lg p-4 overflow-y-auto ${hideValidationOperations ? 'h-full' : ''}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-slate-800">Connections</h3>
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                  Total: {connections.length}
                </Badge>
              </div>
              <div className="space-y-3">
                 {tableMappings.map((mapping, mappingIndex) => (
                   <div key={`${mapping.sourceTable}-${mapping.targetTable}`} className="space-y-2">
                     {/* Table Mapping Header */}
                     <div className="flex items-center gap-2 mb-2">
                       <div className="w-2 h-2 rounded-full bg-green-500"></div>
                       <span className="text-xs font-medium text-slate-800">{mapping.sourceTable}</span>
                       <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                       <span className="text-xs font-medium text-slate-800">{mapping.targetTable}</span>
                       <Badge variant="outline" className="text-xs bg-slate-100">
                         {mapping.connections.length} connections
                       </Badge>
                     </div>
                    
                    {/* Individual Connections */}
                    {mapping.connections.map((connection, index) => (
                      <div 
                        key={connection.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedConnection?.id === connection.id 
                            ? 'bg-blue-50 border-blue-300 shadow-sm' 
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                         onClick={(e) => {
                           // If in filters mode, clicking connection should select the connection
                           if (hideValidationOperations && onColumnSelect) {
                             // Just select the connection, don't select column yet
                             setSelectedConnection(connection);
                             return;
                           }
                           // Normal mode: select connection for operations
                          setSelectedConnection(connection);
                          setCurrentConnection(connection); // Store in global store
                          // Load operations for this connection
                          const connectionOps = getCurrentConnectionOperations();
                          if (connectionOps) {
                            // Check if there are saved operations - if so, use them; otherwise defaults will be set by useEffect
                            const hasSourceOps = connectionOps.sourceOperations?.validationCategory;
                            const hasTargetOps = connectionOps.targetOperations?.validationCategory;
                            
                            if (hasSourceOps || hasTargetOps) {
                              // Use saved operations if available
                              const savedOps = hasSourceOps ? connectionOps.sourceOperations : connectionOps.targetOperations;
                              setCurrentOperationState({
                                validationCategory: savedOps.validationCategory || '',
                                operationType: savedOps.operationType || '',
                                operationConfig: savedOps.operationConfig || {}
                              });
                              // Prefer source if it has operations, otherwise use target
                              const useSource = !!hasSourceOps;
                              setTargetFields({ 
                                source: useSource, 
                                target: !useSource && !!hasTargetOps
                              });
                            } else {
                              // No saved operations - defaults will be set by useEffect when targetFields is set
                              setCurrentOperationState({
                                validationCategory: '',
                                operationType: '',
                                operationConfig: {}
                              });
                              setTargetFields({ source: true, target: false }); // Default to source
                            }
                          } else {
                            // No operations yet - defaults will be set by useEffect
                            setCurrentOperationState({
                              validationCategory: '',
                              operationType: '',
                              operationConfig: {}
                            });
                            setTargetFields({ source: true, target: false }); // Default to source
                          }
                         }}
                      >
                         <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
                             <span className="text-sm font-medium text-slate-800">
                               {index + 1}. 
                             </span>
                             {/* Source Column - Clickable in filters mode */}
                             <span 
                               className={`text-sm font-medium ${
                                 hideValidationOperations && onColumnSelect
                                   ? 'text-blue-600 hover:text-blue-800 hover:underline cursor-pointer px-2 py-1 rounded hover:bg-blue-50'
                                   : 'text-slate-800'
                               }`}
                               onClick={(e) => {
                                 if (hideValidationOperations && onColumnSelect) {
                                   e.stopPropagation();
                                   onColumnSelect({
                                     name: connection.sourceColumn.name,
                                     type: connection.sourceColumn.type || 'string',
                                     table: connection.sourceColumn.table,
                                     isSource: true,
                                     isTarget: false
                                   });
                                   setSelectedConnection(connection);
                                 }
                               }}
                             >
                               {connection.sourceColumn.name}
                             </span>
                             <span className="text-sm text-slate-500">→</span>
                             {/* Target Column - Clickable in filters mode */}
                             {connection.targetColumn && !(connection as any).singleRule ? (
                               <span 
                                 className={`text-sm font-medium ${
                                   hideValidationOperations && onColumnSelect
                                     ? 'text-blue-600 hover:text-blue-800 hover:underline cursor-pointer px-2 py-1 rounded hover:bg-blue-50'
                                     : 'text-slate-800'
                                 }`}
                                 onClick={(e) => {
                                   if (hideValidationOperations && onColumnSelect) {
                                     e.stopPropagation();
                                     onColumnSelect({
                                       name: connection.targetColumn.name,
                                       type: connection.targetColumn.type || 'string',
                                       table: connection.targetColumn.table,
                                       isSource: false,
                                       isTarget: true
                                     });
                                     setSelectedConnection(connection);
                                   }
                                 }}
                               >
                                 {connection.targetColumn.name}
                               </span>
                             ) : (connection as any).singleRule ? (
                               <span className="text-sm font-medium text-slate-800">
                                 {((connection as any).singleRuleType === 'field' 
                                   ? ((connection as any).singleOperation || 'is_null').replace(/_/g, '')
                                   : `constant value(${(connection as any).constantValue || ''})`)}
                               </span>
                             ) : null}
                             {!hideValidationOperations && (() => {
                               const ops = connectionOperations[connection.id];
                               const hasSourceOps = !!(ops?.sourceOperations?.operationType && ops?.sourceOperations?.validationCategory);
                               const hasTargetOps = !!(ops?.targetOperations?.operationType && ops?.targetOperations?.validationCategory);
                               const hasOperationResult = !!ops?.operationResult;
                               const hasOperations = hasSourceOps || hasTargetOps || hasOperationResult;
                               
                               // Also check from store
                               const storeSubmitRules = useValidationStore.getState().submitRules;
                               const hasInStore = storeSubmitRules?.rule_configuration?.some((ruleConfig: any) => 
                                 ruleConfig?.operations?.some((op: any) => {
                                   const matchConnection = op.connectionId === connection.id ||
                                     (op.sourceColumn?.table === connection.sourceColumn.table &&
                                      op.sourceColumn?.name === connection.sourceColumn.name &&
                                      op.targetColumn?.table === connection.targetColumn.table &&
                                      op.targetColumn?.name === connection.targetColumn.name);
                                   return matchConnection && (op.sourceColumn?.applied || op.targetColumn?.applied);
                                 })
                               );
                               
                               const hasInRuleOperations = ruleOperations?.some((rule: any) => 
                                 rule.connectionId === connection.id || 
                                 (rule.sourceTable === connection.sourceColumn.table && 
                                  rule.sourceColumn === connection.sourceColumn.name &&
                                  rule.targetTable === connection.targetColumn.table &&
                                  rule.targetColumn === connection.targetColumn.name)
                               );
                               
                               if (hasOperations) {
                                 return (
                                   <div className="flex items-center gap-1">
                                     <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                     <span className="text-xs text-green-600 font-medium">Operations Applied</span>
                                   </div>
                                 );
                               } else if (hasInStore || hasInRuleOperations) {
                                 return (
                                   <div className="flex items-center gap-1">
                                     <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                     <span className="text-xs text-blue-600 font-medium">Rule Saved</span>
                                   </div>
                                 );
                               }
                               return null;
                             })()}
                           </div>
                           
                           <div className="flex items-center gap-2">
                             {!hideValidationOperations && (() => {
                               const ops = connectionOperations[connection.id];
                               const hasSourceOps = !!(ops?.sourceOperations?.operationType && ops?.sourceOperations?.validationCategory);
                               const hasTargetOps = !!(ops?.targetOperations?.operationType && ops?.targetOperations?.validationCategory);
                               const hasOperationResult = !!ops?.operationResult;
                               
                               // Check from store
                               const storeSubmitRules = useValidationStore.getState().submitRules;
                               const storeOps = storeSubmitRules?.rule_configuration?.find((ruleConfig: any) => 
                                 ruleConfig?.operations?.some((op: any) => 
                                   op.connectionId === connection.id ||
                                   (op.sourceColumn?.table === connection.sourceColumn.table &&
                                    op.sourceColumn?.name === connection.sourceColumn.name &&
                                    op.targetColumn?.table === connection.targetColumn.table &&
                                    op.targetColumn?.name === connection.targetColumn.name)
                                 )
                               )?.operations?.find((op: any) => 
                                 op.connectionId === connection.id ||
                                 (op.sourceColumn?.table === connection.sourceColumn.table &&
                                  op.sourceColumn?.name === connection.sourceColumn.name &&
                                  op.targetColumn?.table === connection.targetColumn.table &&
                                  op.targetColumn?.name === connection.targetColumn.name)
                               );
                               
                               const showSource = hasSourceOps || ops?.operationResult?.results?.source !== undefined || storeOps?.sourceColumn?.applied;
                               const showTarget = hasTargetOps || ops?.operationResult?.results?.target !== undefined || storeOps?.targetColumn?.applied;
                               
                               if (showSource || showTarget) {
                                 return (
                                   <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 font-semibold">
                                     {showSource ? 'S' : ''}{showTarget ? 'T' : ''}
                                   </Badge>
                                 );
                               }
                               return null;
                             })()}
                             <Badge variant="outline" className="text-xs">
                               {index + 1}
                             </Badge>
                           </div>
                         </div>
                      </div>
                    ))}
                  </div>
                ))}
            </div>
          </div>
          
            {/* Middle and Right Panels - Operations and Results - Only show if not hidden */}
            {!hideValidationOperations && (
              <ValidationOperationsPanel
                selectedConnection={selectedConnection}
                targetFields={targetFields}
                setTargetFields={setTargetFields}
                currentOperationState={currentOperationState}
                setCurrentOperationState={setCurrentOperationState}
                getCurrentConnectionOperations={getCurrentConnectionOperations}
                validationCategories={validationCategories}
                getOperationTypes={getOperationTypes}
                handleApplyOperation={handleApplyOperation}
                getCurrentOperationResult={getCurrentOperationResult}
                getCurrentValidationStatus={getCurrentValidationStatus}
                setCurrentConnectionOperations={setCurrentConnectionOperations}
                setCurrentValidationStatus={setCurrentValidationStatus}
              />
            )}
                    </div>
        </div>
      </div>
    </TooltipProvider>
  );
};