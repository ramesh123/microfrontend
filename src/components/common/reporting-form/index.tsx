import React, { useState, useEffect, useRef } from 'react';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { GripVertical, Pencil, X, Check } from 'lucide-react';
import useFlowStore from '@/stores/flowStore';
import { toast } from 'sonner';
import { saveNodeDetailsApi } from '@/controllers/API';
import { data } from 'react-router';

interface ReportingFormProps {
  nodeData?: any;
  onSave?: (data: any) => void;
  onCancel?: () => void;
  mode?: "view" | "edit";
}

interface ColumnData {
  name: string;
  type: string;
  source: string;
  sourceNodeId?: string;
  sourceNodeName?: string;
  selected: boolean;
  displayColumn?: string;
  datatype?: string;
  fillNullValue?: string;
  required?: boolean;
}

interface NodeData {
  nodeId: string;
  nodeName: string;
  columns: ColumnData[];
  sourceNodeId?: string;
  sourceNodeName?: string;
}

const ReportingForm: React.FC<ReportingFormProps> = ({
  nodeData,
  onSave,
  onCancel,
  mode = "edit", // default
}) => {
  const [formData, setFormData] = useState({
    column: '',
    displayColumn: '',
    datatype: '',
    fillNullValue: ''
  });

  const [nodeDataList, setNodeDataList] = useState<NodeData[]>([]);
  const [selectedTab, setSelectedTab] = useState<string>('');
  const [sourceNodes, setSourceNodes] = useState<any>([]);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({
    displayColumn: '',
    datatype: '',
    fillNullValue: '',
    required: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const selectedNode = useFlowStore((state) => state.getSelectedNode());
  const upstreamNodes = useFlowStore.getState().getUpstreamNodes(selectedNode?.id || '');
  const datatypeOptions = [
    'string',
    'object',
    'number',
    'varchar',
    'integer',
    'decimal',
    'boolean',
    'timestamp',
    'date',
    'text'
  ];


  // Fetch previous node data and organize by connected nodes
  useEffect(() => {
    const selectedNode = useFlowStore.getState().getSelectedNode();
    
    if (selectedNode?.id) {
      const upstreamNodes = useFlowStore.getState().getUpstreamNodes(selectedNode.id);
      
      setSourceNodes(upstreamNodes);
      console.log('Upstream nodes for selected node:', upstreamNodes);
      const nodeDataArray: NodeData[] = [];
      
      // Check if there's existing saved column mapping with order
      const existingColumnMappingRaw = selectedNode?.data?.node?.payload?.column_mapping;
      let existingColumnMapping: any[] = [];
      let existingColumnMappingByNode: { [key: string]: any[] } = {};
      
      // Handle both old array format and new object format
      if (Array.isArray(existingColumnMappingRaw)) {
        existingColumnMapping = existingColumnMappingRaw;
      } else if (existingColumnMappingRaw && typeof existingColumnMappingRaw === 'object') {
        // Keep the object format for node-specific lookups
        existingColumnMappingByNode = existingColumnMappingRaw;
        // Also convert to array for backward compatibility
        existingColumnMapping = Object.values(existingColumnMappingRaw).flat();
        
        console.log('Loaded column mapping from store:', {
          nodes: Object.keys(existingColumnMappingByNode),
          totalColumns: existingColumnMapping.length
        });
      }
      
      
      // Process each connected upstream node
      upstreamNodes.forEach((sourceNode: any) => {
        const nodeId = sourceNode.id;
        // Try to get display_name from various possible locations
        const nodeDisplayName = sourceNode.data?.node?.display_name || 
                               sourceNode.data?.display_name || 
                               sourceNode.data?.node?.name || 
                               sourceNode.data?.label || 
                               `Node ${nodeId}`;
        
        
        // Try to extract columns from source node's output data
        const sourceOutput = sourceNode?.data?.node?.output;
        
        // FIRST: Check for validation node data structure (special handling for validation nodes)
        const isValidationNode = sourceNode?.data?.name === 'validation' || 
                                sourceNode?.data?.node?.klass_name === 'ValidationComponent' ||
                                sourceNode?.data?.node?.modules?.includes('validation');
        
        
        // For validation nodes, create separate tabs for each validation set
        if (isValidationNode && sourceOutput?.data && typeof sourceOutput.data === 'object') {
          // Each key in output.data represents a validation set (e.g., MSV_TEST_1_VS_MSV_TEST_2)
          Object.entries(sourceOutput.data).forEach(([validationSetKey, validationSetData]: [string, any]) => {
            const validationSetColumns: ColumnData[] = [];
            
            // Extract columns from the validation set's data array
            if (validationSetData?.data && Array.isArray(validationSetData.data) && validationSetData.data.length > 0) {
              const firstDataRecord = validationSetData.data[0];
              
              // Extract columns from the first record in the data array
              if (firstDataRecord && typeof firstDataRecord === 'object') {
                Object.keys(firstDataRecord).forEach((columnName: string) => {
                  // Skip internal validation fields
                  if (!['MATCHED_COLS', 'UNMATCHED_COLS', 'OVERALL_VALIDATION_STATUS'].includes(columnName)) {
                    const columnType = typeof firstDataRecord[columnName];
                    
                    // Check if we have saved display column data from store
                    const savedColumnData = existingColumnMapping.find((mapping: any) => 
                      mapping.column_name === columnName && 
                      mapping.source_node_name === validationSetKey
                    );
                    
                    validationSetColumns.push({
                      name: columnName,
                      type: columnType,
                      source: `${validationSetKey}_data`,
                      sourceNodeId: nodeId,
                      sourceNodeName: `${validationSetKey}`,
                      selected: false,
                      displayColumn: savedColumnData?.display_column || columnName,
                      datatype: savedColumnData?.datatype || columnType,
                      fillNullValue: savedColumnData?.fill_null_value || '',
                      required: savedColumnData?.required || false
                    });
                  }
                });
              }
            }
            
            // Apply saved column order if it exists for this validation set
            let orderedValidationColumns = validationSetColumns;
            
            // First, try to get columns from the node-specific mapping (object format)
            let validationSetMappings: any[] = [];
            const validationKey = validationSetKey;
            if (existingColumnMappingByNode[validationKey]) {
              validationSetMappings = existingColumnMappingByNode[validationKey];
              console.log(`Found node-specific mapping for validation set ${validationKey}:`, validationSetMappings.length, 'columns');
            } else if (Array.isArray(existingColumnMapping) && existingColumnMapping.length > 0) {
              // Fall back to filtering from the flattened array
              validationSetMappings = existingColumnMapping.filter((mapping: any) => 
                mapping.source_node_name === `${nodeDisplayName} - ${validationSetKey}` ||
                mapping.source_node_name === validationSetKey
              );
              console.log(`Using filtered mapping for validation set ${validationKey}:`, validationSetMappings.length, 'columns');
            }
            
            if (validationSetMappings.length > 0) {
              orderedValidationColumns = validationSetColumns.sort((a, b) => {
                const aMapping = validationSetMappings.find((mapping: any) => mapping.column_name === a.name);
                const bMapping = validationSetMappings.find((mapping: any) => mapping.column_name === b.name);
                
                const aOrder = aMapping?.order ?? 999;
                const bOrder = bMapping?.order ?? 999;
                
                return aOrder - bOrder;
              });
              
              // Ensure orderedValidationColumns is an array
              if (!Array.isArray(orderedValidationColumns)) {
                console.warn(`orderedValidationColumns is not an array for ${validationSetKey}:`, orderedValidationColumns);
                orderedValidationColumns = [];
              }
              
              orderedValidationColumns = orderedValidationColumns.map(column => {
                const savedMapping = validationSetMappings.find((mapping: any) => mapping.column_name === column.name);
                if (savedMapping) {
                  return {
                    ...column,
                    displayColumn: savedMapping.display_column || column.name,
                    datatype: savedMapping.datatype || column.type,
                    fillNullValue: savedMapping.fill_null_value || '',
                    required: savedMapping.required || false
                  };
                }
                return column;
              });
              
              console.log(`Applied saved order for validation set ${validationKey}:`, orderedValidationColumns.map((col, index) => ({
                index,
                name: col.name,
                displayColumn: col.displayColumn,
                order: validationSetMappings.find((m: any) => m.column_name === col.name)?.order
              })));
            }
            
            // Add as a separate tab for this validation set
            if (orderedValidationColumns.length > 0) {
              const tabData = {
                nodeId: `${nodeId}_${validationSetKey}`,
                nodeName: `${validationSetKey}`,
                columns: orderedValidationColumns,
                sourceNodeId: nodeId,
                sourceNodeName: `${nodeDisplayName} - ${validationSetKey}`
              };
              nodeDataArray.push(tabData);
            }
          });
          
          // Skip further processing for this validation node since we've created tabs for each validation set
          return;
        }
        
        // For non-validation nodes, proceed with regular column extraction
        const columns: ColumnData[] = [];
        
        // Helper function to extract columns from pairwise results
        function extractColumnsFromPairwiseResults(pairwiseResults: any, columns: ColumnData[]) {
          if (Array.isArray(pairwiseResults)) {
            pairwiseResults.forEach((pair: any, pairIndex: number) => {
              if (pair.records && Array.isArray(pair.records)) {
                pair.records.forEach((record: any, recordIndex: number) => {
                  // Look for keys ending with _DATA
                  Object.keys(record).forEach((key: string) => {
                    if (key.endsWith('_DATA')) {
                      const dataObject = record[key];
                      
                      if (dataObject && typeof dataObject === 'object') {
                        Object.keys(dataObject).forEach((columnName: string) => {
                          // Skip validation_result, matched_columns, unmatched_columns, remarks
                          if (!['validation_result', 'matched_columns', 'unmatched_columns', 'remarks'].includes(columnName)) {
                            const columnType = typeof dataObject[columnName];
                            columns.push({
                              name: columnName,
                              type: columnType,
                              source: `${key}`,
                              sourceNodeId: nodeId,
                              sourceNodeName: nodeDisplayName,
                              selected: false,
                              displayColumn: columnName,
                              datatype: columnType,
                              fillNullValue: ''
                            });
                          }
                        });
                      }
                    }
                  });
                });
              }
            });
          }
        }
        
        // Method 1: Check if we have pairwise_results in the output data
        if (sourceOutput?.data?.pairwise_results) {
          const pairwiseResults = sourceOutput.data.pairwise_results;
          console.log(`[${nodeDisplayName}] Method 1 - Found pairwise_results in output.data:`, pairwiseResults);
          extractColumnsFromPairwiseResults(pairwiseResults, columns);
        }
        
        // Method 2: Check if we have data array with pairwise_results
        if (columns.length === 0 && sourceOutput?.data && Array.isArray(sourceOutput.data) && sourceOutput.data.length > 0) {
          const firstRecord = sourceOutput.data[0];
          if (firstRecord.pairwise_results) {
            const pairwiseResults = firstRecord.pairwise_results;
            console.log(`[${nodeDisplayName}] Method 2 - Found pairwise_results in data array:`, pairwiseResults);
            extractColumnsFromPairwiseResults(pairwiseResults, columns);
          }
        }
        
        // Method 3: Check for direct data with _DATA keys (NWay validation structure)
        if (columns.length === 0 && sourceOutput?.data && Array.isArray(sourceOutput.data)) {
          sourceOutput.data.forEach((pair: any) => {
            if (pair?.records && Array.isArray(pair.records)) {
              pair.records.forEach((record: any) => {
                Object.keys(record).forEach((key: string) => {
                  if (key.endsWith('_DATA')) {
                    const dataObject = record[key];
                    if (dataObject && typeof dataObject === 'object') {
                      Object.keys(dataObject).forEach((columnName: string) => {
                        if (!['validation_result', 'matched_columns', 'unmatched_columns', 'remarks'].includes(columnName)) {
                          const columnType = typeof dataObject[columnName];
                          columns.push({
                            name: columnName,
                            type: columnType,
                            source: `${key}`,
                            sourceNodeId: nodeId,
                            sourceNodeName: nodeDisplayName,
                            selected: false,
                            displayColumn: columnName,
                            datatype: columnType,
                            fillNullValue: ''
                          });
                        }
                      });
                    }
                  }
                });
              });
            }
          });
        }
        
        // Method 4: Check for multi-source validation data structure (output.data.results)
        if (columns.length === 0 && sourceOutput?.data?.results && Array.isArray(sourceOutput.data.results) && sourceOutput.data.results.length > 0) {
          console.log(`[${nodeDisplayName}] Method 4 - Found multi-source validation results:`, sourceOutput.data.results);
          const firstResult = sourceOutput.data.results[0];
          if (firstResult && typeof firstResult === 'object') {
            Object.keys(firstResult).forEach((columnName: string) => {
              const columnType = typeof firstResult[columnName];
              columns.push({
                name: columnName,
                type: columnType,
                source: 'multisource_results',
                sourceNodeId: nodeId,
                sourceNodeName: nodeDisplayName,
                selected: false,
                displayColumn: columnName,
                datatype: columnType,
                fillNullValue: ''
              });
            });
          }
        }
        
        // Method 5: Check for nway matching data structure (output.data with dataset keys)
        if (columns.length === 0 && sourceOutput?.data && typeof sourceOutput.data === 'object' && !Array.isArray(sourceOutput.data)) {
          console.log(`[${nodeDisplayName}] Checking Method 5 - NWay matching data structure`);
          console.log(`[${nodeDisplayName}] Data keys:`, Object.keys(sourceOutput.data));
          
          // For nway matching, create separate tabs for each dataset
          Object.entries(sourceOutput.data).forEach(([datasetKey, datasetData]: [string, any]) => {
            console.log(`[${nodeDisplayName}] Processing dataset: ${datasetKey}`);
            
            if (Array.isArray(datasetData) && datasetData.length > 0) {
              const firstRecord = datasetData[0];
              console.log(`[${nodeDisplayName}] Dataset ${datasetKey} has ${datasetData.length} records`);
              console.log(`[${nodeDisplayName}] First record keys:`, Object.keys(firstRecord));
              
              // Extract columns from the first record
              Object.keys(firstRecord).forEach((columnName: string) => {
                // Skip internal matching fields
                if (!['SYSTEM_REF_ID', 'MATCH_REF_ID', 'GROUP_REF_ID', 'MATCH_REF_ID', 'Match', 'RECONCILIATION_STATUS', 'RECON_EXECUTION_ID', 'Rule Name', 'Final Match'].includes(columnName)) {
                  const columnType = typeof firstRecord[columnName];
                  
                  // Check if we have saved display column data from store
                  const savedColumnData = existingColumnMapping.find((mapping: any) => 
                    mapping.column_name === columnName && 
                    mapping.source_node_name === `${nodeDisplayName} - ${datasetKey}`
                  );
                  
                  columns.push({
                    name: columnName,
                    type: columnType,
                    source: `${datasetKey}_data`,
                    sourceNodeId: nodeId,
                    sourceNodeName: `${nodeDisplayName} - ${datasetKey}`,
                    selected: false,
                    displayColumn: savedColumnData?.display_column || columnName,
                    datatype: savedColumnData?.datatype || columnType,
                    fillNullValue: savedColumnData?.fill_null_value || '',
                    required: savedColumnData?.required || false
                  });
                }
              });
            }
          });
        }
        
        // Method 6: Check for merge node output structure (status, message, data, columns)
        if (columns.length === 0 && sourceOutput?.status && sourceOutput?.data && Array.isArray(sourceOutput.data) && sourceOutput?.columns && Array.isArray(sourceOutput.columns)) {
          console.log(`[${nodeDisplayName}] Checking Method 6 - Merge node output structure`);
          console.log(`[${nodeDisplayName}] Data length:`, sourceOutput.data.length);
          console.log(`[${nodeDisplayName}] Columns length:`, sourceOutput.columns.length);
          
          // Extract columns from the columns array
          sourceOutput.columns.forEach((columnName: string) => {
            // Check if we have saved display column data from store
            const savedColumnData = existingColumnMapping.find((mapping: any) => 
              mapping.column_name === columnName && 
              mapping.source_node_name === nodeDisplayName
            );
            
            columns.push({
              name: columnName,
              type: 'string',
              source: 'merge_output',
              sourceNodeId: nodeId,
              sourceNodeName: nodeDisplayName,
              selected: false,
              displayColumn: savedColumnData?.display_column || columnName,
              datatype: savedColumnData?.datatype || 'string',
              fillNullValue: savedColumnData?.fill_null_value || '',
              required: savedColumnData?.required || false
            });
          });
        }
        
        // Method 7: Fallback to regular columns array
        if (columns.length === 0 && sourceOutput?.columns && Array.isArray(sourceOutput.columns)) {
          sourceOutput.columns.forEach((columnName: string) => {
            // Check if we have saved display column data from store
            const savedColumnData = existingColumnMapping.find((mapping: any) => 
              mapping.column_name === columnName && 
              mapping.source_node_name === nodeDisplayName
            );
            
            columns.push({
              name: columnName,
              type: 'string',
              source: 'node_columns',
              sourceNodeId: nodeId,
              sourceNodeName: nodeDisplayName,
              selected: false,
              displayColumn: savedColumnData?.display_column || columnName,
              datatype: savedColumnData?.datatype || 'string',
              fillNullValue: savedColumnData?.fill_null_value || '',
              required: savedColumnData?.required || false
            });
          });
        }
        
        // Method 8: Check for rule-based validation data structure (fallback)
        if (columns.length === 0 && sourceOutput?.data && typeof sourceOutput.data === 'object') {
          Object.values(sourceOutput.data).forEach((ruleData: any) => {
            if (ruleData?.data && Array.isArray(ruleData.data) && ruleData.data.length > 0) {
              const firstRecord = ruleData.data[0];
              if (Array.isArray(firstRecord) && firstRecord.length > 0 && typeof firstRecord[0] === 'object') {
                Object.keys(firstRecord[0]).forEach((columnName: string) => {
                  // Check if we have saved display column data from store
                  const savedColumnData = existingColumnMapping.find((mapping: any) => 
                    mapping.column_name === columnName && 
                    mapping.source_node_name === nodeDisplayName
                  );
                  
                  columns.push({
                    name: columnName,
                    type: typeof firstRecord[0][columnName],
                    source: 'rule_data',
                    sourceNodeId: nodeId,
                    sourceNodeName: nodeDisplayName,
                    selected: false,
                    displayColumn: savedColumnData?.display_column || columnName,
                    datatype: savedColumnData?.datatype || typeof firstRecord[0][columnName],
                    fillNullValue: savedColumnData?.fill_null_value || '',
                    required: savedColumnData?.required || false
                  });
                });
              }
            }
          });
        }
        
        // Log which method was used for this node
        if (columns.length > 0) {
          console.log(`[${nodeDisplayName}] ✅ Successfully extracted ${columns.length} columns using one of the methods`);
        } else {
          console.log(`[${nodeDisplayName}] ❌ No columns extracted - no matching data structure found`);
        }
        
        // For nway matching nodes, create separate tabs for each dataset
        if (nodeData?.data?.node_id === 'nway_matching' && sourceOutput?.data && typeof sourceOutput.data === 'object' && !Array.isArray(sourceOutput.data)) {
          console.log(`[${nodeDisplayName}] Processing NWay matching with separate dataset tabs`);
          
          Object.entries(sourceOutput.data).forEach(([datasetKey, datasetData]: [string, any]) => {
            console.log(`[${nodeDisplayName}] Creating tab for dataset: ${datasetKey}`);
            
            if (Array.isArray(datasetData) && datasetData.length > 0) {
              const datasetColumns: ColumnData[] = [];
              const firstRecord = datasetData[0];
              
              // Extract columns from the first record
              Object.keys(firstRecord).forEach((columnName: string) => {
                // Skip internal matching fields
                if (!['SYSTEM_REF_ID', 'MATCH_REF_ID', 'GROUP_REF_ID', 'MATCH_REF_ID', 'Match', 'RECONCILIATION_STATUS', 'RECON_EXECUTION_ID', 'Rule Name', 'Final Match'].includes(columnName)) {
                  const columnType = typeof firstRecord[columnName];
                  
                  // Check if we have saved display column data from store
                  const savedColumnData = existingColumnMapping.find((mapping: any) => 
                    mapping.column_name === columnName && 
                    mapping.source_node_name === `${nodeDisplayName} - ${datasetKey}`
                  );
                  
                  datasetColumns.push({
                    name: columnName,
                    type: columnType,
                    source: `${datasetKey}_data`,
                    sourceNodeId: nodeId,
                    sourceNodeName: `${nodeDisplayName} - ${datasetKey}`,
                    selected: false,
                    displayColumn: savedColumnData?.display_column || columnName,
                    datatype: savedColumnData?.datatype || columnType,
                    fillNullValue: savedColumnData?.fill_null_value || '',
                    required: savedColumnData?.required || false
                  });
                }
              });
              
              // Apply saved column order for this dataset
              let orderedDatasetColumns = datasetColumns;
              const datasetTabName = `${nodeDisplayName} - ${datasetKey}`;
              
              // Try to get columns from the node-specific mapping
              let datasetColumnMappings: any[] = [];
              if (existingColumnMappingByNode[datasetTabName]) {
                datasetColumnMappings = existingColumnMappingByNode[datasetTabName];
              } else if (Array.isArray(existingColumnMapping) && existingColumnMapping.length > 0) {
                datasetColumnMappings = existingColumnMapping.filter((mapping: any) => 
                  mapping.source_node_name === datasetTabName
                );
              }
              
              if (datasetColumnMappings.length > 0) {
                orderedDatasetColumns = datasetColumns.sort((a, b) => {
                  const aMapping = datasetColumnMappings.find((mapping: any) => mapping.column_name === a.name);
                  const bMapping = datasetColumnMappings.find((mapping: any) => mapping.column_name === b.name);
                  
                  const aOrder = aMapping?.order ?? 999;
                  const bOrder = bMapping?.order ?? 999;
                  
                  return aOrder - bOrder;
                });
                
                // Apply saved values
                orderedDatasetColumns = orderedDatasetColumns.map(column => {
                  const savedMapping = datasetColumnMappings.find((mapping: any) => mapping.column_name === column.name);
                  if (savedMapping) {
                    return {
                      ...column,
                      displayColumn: savedMapping.display_column || column.name,
                      datatype: savedMapping.datatype || column.type,
                      fillNullValue: savedMapping.fill_null_value || '',
                      required: savedMapping.required || false
                    };
                  }
                  return column;
                });
              }
              
              if (orderedDatasetColumns.length > 0) {
                nodeDataArray.push({
                  nodeId: `${nodeId}_${datasetKey}`,
                  nodeName: datasetTabName,
                  columns: orderedDatasetColumns,
                  sourceNodeId: nodeId,
                  sourceNodeName: datasetTabName
                });
                console.log(`[${nodeDisplayName}] Created tab for ${datasetKey} with ${orderedDatasetColumns.length} columns`);
              }
            }
          });
        } else {
          // Regular processing for non-nway matching nodes
        // Remove duplicate columns based on name for this node
        const uniqueColumns = columns.reduce((acc: ColumnData[], current: ColumnData) => {
          const existingColumn = acc.find(col => col.name === current.name);
          if (!existingColumn) {
            acc.push(current);
          }
          return acc;
        }, []);
        
        // Apply saved column order if it exists
        let orderedColumns = uniqueColumns;
        
        // First, try to get columns from the node-specific mapping (object format)
        let nodeColumnMappings: any[] = [];
        if (existingColumnMappingByNode[nodeDisplayName]) {
          nodeColumnMappings = existingColumnMappingByNode[nodeDisplayName];
          console.log(`Found node-specific mapping for ${nodeDisplayName}:`, nodeColumnMappings.length, 'columns');
        } else if (Array.isArray(existingColumnMapping) && existingColumnMapping.length > 0) {
          // Fall back to filtering from the flattened array
          nodeColumnMappings = existingColumnMapping.filter((mapping: any) => 
            mapping.source_node_id === nodeId || mapping.source_node_name === nodeDisplayName
          );
          console.log(`Using filtered mapping for ${nodeDisplayName}:`, nodeColumnMappings.length, 'columns');
        }
        
        if (nodeColumnMappings.length > 0) {
          // Sort columns based on saved order
          orderedColumns = uniqueColumns.sort((a, b) => {
            const aMapping = nodeColumnMappings.find((mapping: any) => mapping.column_name === a.name);
            const bMapping = nodeColumnMappings.find((mapping: any) => mapping.column_name === b.name);
            
            const aOrder = aMapping?.order ?? 999;
            const bOrder = bMapping?.order ?? 999;
            
            return aOrder - bOrder;
          });
          
          // Ensure orderedColumns is an array
          if (!Array.isArray(orderedColumns)) {
            console.warn(`orderedColumns is not an array for ${nodeDisplayName}:`, orderedColumns);
            orderedColumns = [];
          }
          
          // Apply saved values (displayColumn, datatype, fillNullValue, required)
          orderedColumns = orderedColumns.map(column => {
            const savedMapping = nodeColumnMappings.find((mapping: any) => mapping.column_name === column.name);
            if (savedMapping) {
              return {
                ...column,
                displayColumn: savedMapping.display_column || column.name,
                datatype: savedMapping.datatype || column.type,
                fillNullValue: savedMapping.fill_null_value || '',
                required: savedMapping.required || false
              };
            }
            return column;
          });
          
          console.log(`Applied saved order for node ${nodeDisplayName}:`, orderedColumns.map((col, index) => ({
            index,
            name: col.name,
            displayColumn: col.displayColumn,
            datatype: col.datatype,
            order: nodeColumnMappings.find((m: any) => m.column_name === col.name)?.order
          })));
        }
        
        if (orderedColumns.length > 0) {
          nodeDataArray.push({
            nodeId,
            nodeName: nodeDisplayName,
            columns: orderedColumns,
            sourceNodeId: nodeId,
            sourceNodeName: nodeDisplayName
          });
          }
        }
      });
      
      console.log('=== FINAL RESULTS ===');
      console.log('Total tabs created:', nodeDataArray.length);
      console.log('Tab details:', nodeDataArray.map(n => ({
        nodeId: n.nodeId,
        nodeName: n.nodeName,
        columnsCount: n.columns.length
      })));
      
      setNodeDataList(nodeDataArray);
      
      // Set the first tab as selected if available
      if (nodeDataArray.length > 0 && !selectedTab) {
        setSelectedTab(nodeDataArray[0].nodeId);
        console.log('✅ Selected first tab:', nodeDataArray[0].nodeId);
      } else if (nodeDataArray.length === 0) {
        console.log('❌ No tabs created - nodeDataArray is empty!');
      }
    }
  }, [nodeData, selectedNode]);

  const handleSave = () => {
    onSave?.(formData);
  };

  const handleCancel = () => {
    onCancel?.();
  };

  const getCurrentNodeData = () => {
    return nodeDataList.find(node => node.nodeId === selectedTab);
  };

  const updateNodeColumns = (nodeId: string, updatedColumns: ColumnData[]) => {
    // Ensure updatedColumns is an array
    const columnsArray = Array.isArray(updatedColumns) ? updatedColumns : [];
    
    if (columnsArray.length === 0) {
      console.warn(`No columns provided for updateNodeColumns for node: ${nodeId}`);
      return;
    }
    
    setNodeDataList(prev => prev.map(node => 
      node.nodeId === nodeId 
        ? { ...node, columns: columnsArray }
        : node
    ));
    
    // Update the store with the new column mapping
    const selectedNode = useFlowStore.getState().getSelectedNode();
    if (selectedNode?.id) {
      const currentNodeData = nodeDataList.find(node => node.nodeId === nodeId);
      if (currentNodeData) {
        const columnMapping = updatedColumns.map((col, index) => ({
          column_name: col.name,
          display_column: col.displayColumn || col.name,
          datatype: col.datatype || col.type,
          fill_null_value: col.fillNullValue || '',
          required: col.required || false,
          source_node_id: col.sourceNodeId,
          source_node_name: col.sourceNodeName,
          order: index // Preserve the order based on array position
        }));
        
        // Update the node payload in the store
        const updatedNodeData = {
          ...selectedNode.data,
          node: {
            ...selectedNode.data.node,
            payload: {
              ...selectedNode.data.node.payload,
              column_mapping: {
                ...selectedNode.data.node.payload.column_mapping,
                [currentNodeData.nodeName]: columnMapping
              }
            }
          }
        };
        
        useFlowStore.getState().updateNodeData(selectedNode.id, updatedNodeData);
      }
    }
  };

  const handleEdit = (columnName: string) => {
    const currentNodeData = getCurrentNodeData();
    const column = currentNodeData?.columns.find(col => col.name === columnName);
    if (column) {
      setEditingColumn(columnName);
      setEditFormData({
        displayColumn: column.displayColumn || column.name,
        datatype: column.datatype || column.type,
        fillNullValue: column.fillNullValue || '',
        required: column.required || false
      });
    }
  };

  const handleSaveEdit = async () => {
    if (editingColumn && selectedTab) {
      const currentNodeData = getCurrentNodeData();
      if (currentNodeData) {
        // Ensure columns is an array
        const columnsArray = Array.isArray(currentNodeData.columns) ? currentNodeData.columns : [];
        
        if (columnsArray.length === 0) {
          console.warn(`No columns found for node: ${currentNodeData.nodeName}`);
          return;
        }
        
        const updatedColumns = columnsArray.map(col => 
          col.name === editingColumn 
            ? { 
                ...col, 
                displayColumn: editFormData.displayColumn || col.name, // Ensure displayColumn is never empty
                datatype: editFormData.datatype || col.type,
                fillNullValue: editFormData.fillNullValue || '',
                required: editFormData.required || false
              }
            : col
        );
        
        // Update the state
        updateNodeColumns(selectedTab, updatedColumns);
        
        setEditingColumn(null);
        setEditFormData({ displayColumn: '', datatype: '', fillNullValue: '', required: false });
        
        // Show success message
        toast.success(`Column "${editingColumn}" updated successfully`);
      }
    }
  };

  const handleSaveAll = async () => {
    // Validate that all columns have proper display names
    const hasEmptyDisplayColumns = nodeDataList.some(node => 
      node.columns.some(col => !col.displayColumn || col.displayColumn.trim() === '')
    );
    
    if (hasEmptyDisplayColumns) {
      toast.warning('Please ensure all columns have display names before saving');
      return;
    }

    // Validate that we have data to save
    if (!nodeDataList || nodeDataList.length === 0) {
      toast.error('No data to save. Please ensure columns are properly configured.');
      return;
    }
    
    try {
      await saveReportingData(nodeDataList);
    } catch (error) {
      console.error('Error in handleSaveAll:', error);
      // Error is already handled in saveReportingData
    }
  };

  const handleCancelEdit = () => {
    setEditingColumn(null);
    setEditFormData({ displayColumn: '', datatype: '', fillNullValue: '', required: false });
  };

  const saveReportingData = async (nodeDataArray: NodeData[]) => {
    const selectedNode = useFlowStore.getState().getSelectedNode();
    const currentWorkflow = useFlowStore.getState().currentWorkflow;
    
    const saveEndpointConfig = selectedNode?.data?.node?.save_node;
    
    if (!saveEndpointConfig?.module || !saveEndpointConfig?.klass) {
      toast.error('Save API endpoint is not configured for this node.');
      return;
    }

    // Additional validation for endpoint configuration
    if (!saveEndpointConfig.module || !saveEndpointConfig.klass) {
      throw new Error('Save endpoint configuration is incomplete. Missing module or klass.');
    }

    setIsLoading(true);
    
    try {
      // Validate required data
      if (!selectedNode?.data) {
        throw new Error('No node data found. Please ensure a valid node is selected.');
      }

      if (!selectedNode?.id) {
        throw new Error('No node ID found. Please ensure a valid node is selected.');
      }

      // Build the complete template payload following NWay validation pattern
      const finalData = JSON.parse(JSON.stringify(selectedNode?.data));
      
      // Get the latest column mapping from the store instead of using local state
      const storeColumnMapping = selectedNode?.data?.node?.payload?.column_mapping || {};
      
      // Update the payload with reporting columns from all nodes
      // Use store data if available, otherwise fall back to local state
      const columnMappingByNode: { [nodeName: string]: any } = {};
      let globalOrder = 0;
      
      // If we have store data, use it; otherwise use local state
      if (Object.keys(storeColumnMapping).length > 0) {
        // Use data from store
        Object.entries(storeColumnMapping).forEach(([nodeName, columns]: [string, any]) => {
          // Ensure columns is an array
          const columnsArray = Array.isArray(columns) ? columns : [];
          
          if (columnsArray.length === 0) {
            console.warn(`No columns found for node: ${nodeName}`);
            return;
          }
          
          const updatedColumns = columnsArray.map((col: any) => ({
            column_name: col.column_name,
            display_column: col.display_column || col.column_name,
            datatype: col.datatype || 'string',
            fill_null_value: col.fill_null_value || '',
            required: col.required || false,
            source_node_id: col.source_node_id,
            source_node_name: col.source_node_name,
            order: globalOrder++
          }));
          columnMappingByNode[nodeName] = updatedColumns;
        });
      } else {
        // Fall back to local state
        nodeDataArray.forEach((nodeData) => {
          // Ensure columns is an array
          const columnsArray = Array.isArray(nodeData.columns) ? nodeData.columns : [];
          
          if (columnsArray.length === 0) {
            console.warn(`No columns found for node: ${nodeData.nodeName}`);
            return;
          }
          
          const nodeColumns = columnsArray.map((col) => {
            const displayColumn = col.displayColumn && col.displayColumn.trim() !== '' 
              ? col.displayColumn.trim() 
              : col.name;
            
            return {
              column_name: col.name,
              display_column: displayColumn,
              datatype: col.datatype || col.type,
              fill_null_value: col.fillNullValue || '',
              required: col.required || false,
              source_node_id: col.sourceNodeId,
              source_node_name: col.sourceNodeName,
              order: globalOrder++ // Global order across all nodes
            };
          });
          
          columnMappingByNode[nodeData.nodeName] = nodeColumns;
        });
      }
      
      // Ensure ALL upstream nodes are included in column_mapping, even if they have no columns
      // This is important for the API to know about all connected nodes
      sourceNodes.forEach((sourceNode: any) => {
        const nodeId = sourceNode.id;
        const nodeDisplayName = sourceNode.data?.node?.display_name || 
                               sourceNode.data?.display_name || 
                               sourceNode.data?.node?.name || 
                               sourceNode.data?.label || 
                               `Node ${nodeId}`;
        
        // Check if this is a validation node (we handle these differently with direct keys)
        const isValidationNode = sourceNode?.data?.name === 'validation' || 
                                sourceNode?.data?.node?.klass_name === 'ValidationComponent' ||
                                sourceNode?.data?.node?.modules?.includes('validation');
        
        // Check if this node is already in columnMappingByNode
        const isAlreadyIncluded = Object.keys(columnMappingByNode).some(key => 
          key === nodeDisplayName || key.startsWith(`${nodeDisplayName} - `)
        );
        
        if (!isAlreadyIncluded && !isValidationNode) {
          // Add empty column mapping for nodes that don't have columns extracted
          // Skip validation nodes as they use direct validation set keys
          console.log(`Adding empty column mapping for node: ${nodeDisplayName}`);
          columnMappingByNode[nodeDisplayName] = [];
        }
      });
      
      // Validate that we have column mapping data
      if (Object.keys(columnMappingByNode).length === 0) {
        throw new Error('No valid column mapping data found. Please ensure columns are properly configured.');
      }

      // Debug: Log the final columnMappingByNode before sending
      console.log('🔍 Final columnMappingByNode before API call:', columnMappingByNode);
      console.log('🔍 Column mapping keys:', Object.keys(columnMappingByNode));
      Object.entries(columnMappingByNode).forEach(([key, value]) => {
        console.log(`🔍 Column mapping for ${key}:`, {
          type: typeof value,
          isArray: Array.isArray(value),
          keys: typeof value === 'object' ? Object.keys(value) : 'N/A',
          hasSummary: typeof value === 'object' && value !== null ? 'summary' in value : false
        });
      });

      // Update the payload with the nested structure approach
      finalData.node.payload = {
        ...finalData.node.payload,
        column_mapping: columnMappingByNode as any, // Allow both arrays and objects for validation nodes
        node_id: selectedNode?.id,
        flow_id: currentWorkflow?.flow_id || selectedNode?.data?.flow_id
      };

      // Add dataframe key with output data from each connected node (key = display name, value = output)
      const dataframeData: { [key: string]: any } = {};
      
      // Validate source nodes
      if (!sourceNodes || sourceNodes.length === 0) {
        throw new Error('No source nodes found. Please ensure there are upstream nodes connected.');
      }
      
      // Direct output pass-through approach: Pass entire output from store upstream nodes
      sourceNodes.forEach((sourceNode: any) => {
        const nodeId = sourceNode.id;
        const nodeDisplayName = sourceNode.data?.node?.display_name || 
                               sourceNode.data?.display_name || 
                               sourceNode.data?.node?.name || 
                               sourceNode.data?.label || 
                               `Node ${nodeId}`;
        
        // Get the output data from the source node (from store upstream nodes data.node.output)
        const sourceOutput = sourceNode?.data?.node?.output;
        
        if (sourceOutput) {
          console.log(`[${nodeDisplayName}] Direct output pass-through from store`);
          console.log(`[${nodeDisplayName}] Output structure:`, {
            hasData: !!sourceOutput.data,
            hasColumns: !!sourceOutput.columns,
            hasStatus: !!sourceOutput.status,
            dataType: typeof sourceOutput.data,
            dataLength: Array.isArray(sourceOutput.data) ? sourceOutput.data.length : 'N/A',
            columnsLength: Array.isArray(sourceOutput.columns) ? sourceOutput.columns.length : 'N/A'
          });
          
          // Check if it's a validation node with nested data structure
          const isValidationNode = sourceNode?.data?.name === 'validation' || 
                                  sourceNode?.data?.node?.klass_name === 'ValidationComponent' ||
                                  sourceNode?.data?.node?.modules?.includes('validation');
          
          // Check if it's a multisource validation node
          const isMultisourceValidationNode = sourceNode?.data?.name === 'multisource_validation' || 
                                            sourceNode?.data?.node?.klass_name === 'MultisourceValidationComponent' ||
                                            sourceNode?.data?.node?.modules?.includes('multisource_validation');
          
          if (isValidationNode && sourceOutput.data && typeof sourceOutput.data === 'object' && !Array.isArray(sourceOutput.data)) {
            console.log(`[${nodeDisplayName}] Processing validation node with direct validation set keys`);
            
            // For validation nodes, pass validation set keys directly as top-level keys
            // Column mapping: validationSet1: [...], validationSet2: [...], summary: [...]
            // Dataframe: validationSet1: {...}, validationSet2: {...}
            
            Object.entries(sourceOutput.data).forEach(([validationSetKey, validationSetData]: [string, any]) => {
              console.log(`[${nodeDisplayName}] Processing validation set: ${validationSetKey}`);
              
              if (validationSetData && validationSetData.data && Array.isArray(validationSetData.data)) {
                // Add validation set data to dataframe under validation set key (direct key)
                dataframeData[validationSetKey] = validationSetData;
                
                // Extract columns from first record of validation set data
                if (validationSetData.data.length > 0) {
                  const firstRecord = validationSetData.data[0];
                  if (firstRecord && typeof firstRecord === 'object') {
                    const validationSetColumns = Object.keys(firstRecord).map((columnName: string, index: number) => ({
                      column_name: columnName,
                      display_column: columnName,
                      datatype: typeof firstRecord[columnName],
                      fill_null_value: '',
                      required: false,
                      source_node_id: nodeId,
                      source_node_name: validationSetKey,
                      order: globalOrder++
                    }));
                    columnMappingByNode[validationSetKey] = validationSetColumns;
                  }
                } else {
                  columnMappingByNode[validationSetKey] = [];
                }
              }
            });
            console.log("dataframeData",dataframeData);
            // Also add the summary data to column mapping if it exists
            if (sourceOutput.summary && Array.isArray(sourceOutput.summary)) {
              console.log(`[${nodeDisplayName}] Adding summary data to column mapping`);
              console.log(`[${nodeDisplayName}] Summary data:`, sourceOutput.summary);
              columnMappingByNode['summary'] = sourceOutput.summary;
              console.log(`[${nodeDisplayName}] Updated columnMappingByNode:`, columnMappingByNode);
            }
          } else if (isMultisourceValidationNode && sourceOutput.data && typeof sourceOutput.data === 'object' && !Array.isArray(sourceOutput.data)) {
            console.log(`[${nodeDisplayName}] Processing multisource validation node with nested data structure`);
            
            // For multisource validation nodes, create nested structure under node name for column mapping
            // Column mapping: nodeName -> { dataset1: [...], dataset2: [...] }
            columnMappingByNode[nodeDisplayName] = {};
            
            // Dataframe: dataset1: {...}, dataset2: {...} (direct dataset keys)
            
            Object.entries(sourceOutput.data).forEach(([datasetKey, datasetData]: [string, any]) => {
              console.log(`[${nodeDisplayName}] Processing dataset: ${datasetKey}`);
              
              if (datasetData && datasetData.data && Array.isArray(datasetData.data)) {
                // Add dataset data to dataframe under dataset key (not nested under node name)
                dataframeData[datasetKey] = datasetData;
                
                // Extract columns from first record of dataset data
                if (datasetData.data.length > 0) {
                  const firstRecord = datasetData.data[0];
                  if (firstRecord && typeof firstRecord === 'object') {
                    const datasetColumns = Object.keys(firstRecord).map((columnName: string, index: number) => ({
                      column_name: columnName,
                      display_column: columnName,
                      datatype: typeof firstRecord[columnName],
                      fill_null_value: '',
                      required: false,
                      source_node_id: nodeId,
                      source_node_name: `${nodeDisplayName}.${datasetKey}`,
                      order: globalOrder++
                    }));
                    columnMappingByNode[nodeDisplayName][datasetKey] = datasetColumns;
                  }
          } else {
                  columnMappingByNode[nodeDisplayName][datasetKey] = [];
                }
              }
            });
            
            // Also add the summary data to column mapping if it exists
            if (sourceOutput.summary && Array.isArray(sourceOutput.summary)) {
              console.log(`[${nodeDisplayName}] Adding summary data to column mapping`);
              console.log(`[${nodeDisplayName}] Summary data:`, sourceOutput.summary);
              columnMappingByNode[nodeDisplayName]['summary'] = sourceOutput.summary;
              console.log(`[${nodeDisplayName}] Updated columnMappingByNode:`, columnMappingByNode[nodeDisplayName]);
            }
          } else {
            // For non-validation nodes, use the direct output pass-through approach
            console.log(`[${nodeDisplayName}] Processing non-validation node with direct output`);
            
            // Pass the entire output object directly to dataframe
            dataframeData[nodeDisplayName] = sourceOutput;
            
            // Also add to column_mapping for API payload
            if (!columnMappingByNode[nodeDisplayName]) {
              columnMappingByNode[nodeDisplayName] = [];
            }
            
            // Extract columns for column_mapping if available
            if (sourceOutput.columns && Array.isArray(sourceOutput.columns)) {
              const nodeColumns = sourceOutput.columns.map((columnName: string, index: number) => ({
                column_name: columnName,
                display_column: columnName,
                datatype: 'string',
                fill_null_value: '',
                required: false,
                source_node_id: nodeId,
                source_node_name: nodeDisplayName,
                order: globalOrder++
              }));
              columnMappingByNode[nodeDisplayName] = nodeColumns;
            } else if (sourceOutput.data && Array.isArray(sourceOutput.data) && sourceOutput.data.length > 0) {
              // Extract columns from first record if no explicit columns array
              const firstRecord = sourceOutput.data[0];
              if (firstRecord && typeof firstRecord === 'object') {
                const nodeColumns = Object.keys(firstRecord).map((columnName: string, index: number) => ({
                  column_name: columnName,
                  display_column: columnName,
                  datatype: typeof firstRecord[columnName],
                  fill_null_value: '',
                  required: false,
                  source_node_id: nodeId,
                  source_node_name: nodeDisplayName,
                  order: globalOrder++
                }));
                columnMappingByNode[nodeDisplayName] = nodeColumns;
              }
            }
          }
        } else {
          // Ensure ALL upstream nodes are included in dataframe, even if they have no output
          // Skip validation nodes as they use direct validation set keys
          const isValidationNode = sourceNode?.data?.name === 'validation' || 
                                  sourceNode?.data?.node?.klass_name === 'ValidationComponent' ||
                                  sourceNode?.data?.node?.modules?.includes('validation');
          
          if (!isValidationNode) {
            console.log(`Adding empty dataframe entry for node with no output: ${nodeDisplayName}`);
            dataframeData[nodeDisplayName] = [];
            columnMappingByNode[nodeDisplayName] = [];
          }
        }
      });

      finalData.node.payload.dataframe = dataframeData;
      console.log('dataframeData:', dataframeData);
      console.log('dataframeData keys:', Object.keys(dataframeData));
      console.log('dataframeData structure:', JSON.stringify(Object.keys(dataframeData).reduce((acc, key) => {
        acc[key] = Array.isArray(dataframeData[key]) ? 'array' : typeof dataframeData[key];
        return acc;
      }, {} as any), null, 2));
      finalData.current_node_id = selectedNode?.id;
      finalData.flow_id = currentWorkflow?.flow_id || selectedNode?.data?.flow_id;

      // Validate the data before sending
      if (!finalData.node.payload.column_mapping || Object.keys(finalData.node.payload.column_mapping).length === 0) {
        throw new Error('No column mapping data found. Please ensure columns are properly configured.');
      }

      if (!finalData.node.payload.dataframe || Object.keys(finalData.node.payload.dataframe).length === 0) {
        throw new Error('No dataframe data found. Please ensure source nodes have output data.');
      }

   
      const response = await saveNodeDetailsApi(saveEndpointConfig, finalData);
      
      // Validate API response
      if (!response) {
        throw new Error('No response received from the server.');
      }

      if (response.error) {
        throw new Error(response.error.message || 'Server returned an error.');
      }
      
      // Update the node data in the store
      useFlowStore.getState().updateNodeData(selectedNode?.id, response);
      
      toast.success('Reporting configuration saved successfully!');
      
      // Call the onSave callback if provided
      if (onSave) {
        onSave(nodeDataArray);
      }
      
    } catch (error) {
      console.error('Save failed with error:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        selectedNode: selectedNode?.id,
        saveEndpointConfig,
        hasData: !!selectedNode?.data
      });
      
      const errorMessage = getDisplayErrorMessage(error, 'An unknown error occurred.');
      toast.error(`Failed to save reporting configuration: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);

    // Auto-scroll functionality
    const tableContainer = tableRef.current;
    if (tableContainer) {
      const containerRect = tableContainer.getBoundingClientRect();
      const scrollThreshold = 50; // pixels from edge to trigger scroll
      const scrollSpeed = 10; // pixels to scroll per frame

      // Check if we're near the top edge
      if (e.clientY - containerRect.top < scrollThreshold && tableContainer.scrollTop > 0) {
        tableContainer.scrollTop -= scrollSpeed;
      }
      // Check if we're near the bottom edge
      else if (containerRect.bottom - e.clientY < scrollThreshold && 
               tableContainer.scrollTop < tableContainer.scrollHeight - tableContainer.clientHeight) {
        tableContainer.scrollTop += scrollSpeed;
      }
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear dragOverIndex if we're actually leaving the table row
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverIndex(null);
    }
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndexValue = parseInt(e.dataTransfer.getData('text/plain'));
    
    setDragOverIndex(null);
    setDragIndex(null);
    
    if (dragIndexValue !== dropIndex && selectedTab) {
      const currentNodeData = getCurrentNodeData();
      if (currentNodeData) {
        // Ensure columns is an array
        const columnsArray = Array.isArray(currentNodeData.columns) ? currentNodeData.columns : [];
        
        if (columnsArray.length === 0) {
          console.warn(`No columns found for reordering in node: ${currentNodeData.nodeName}`);
          return;
        }
        
        const newColumns = [...columnsArray];
        const draggedItem = newColumns[dragIndexValue];
        newColumns.splice(dragIndexValue, 1);
        newColumns.splice(dropIndex, 0, draggedItem);
        
        // Update the columns with new order
        updateNodeColumns(selectedTab, newColumns);
        
        // Also update the store immediately with the new order
        const selectedNode = useFlowStore.getState().getSelectedNode();
        if (selectedNode?.id) {
          // Create column mapping with updated order
          const columnMapping = newColumns.map((col, index) => ({
            column_name: col.name,
            display_column: col.displayColumn || col.name,
            datatype: col.datatype || col.type,
            fill_null_value: col.fillNullValue || '',
            required: col.required || false,
            source_node_id: col.sourceNodeId,
            source_node_name: col.sourceNodeName,
            order: index // Set the new order based on position
          }));
          
          // Update the store with the new column mapping
          const existingColumnMapping = selectedNode.data.node.payload.column_mapping || {};
          const updatedNodeData = {
            ...selectedNode.data,
            node: {
              ...selectedNode.data.node,
              payload: {
                ...selectedNode.data.node.payload,
                column_mapping: {
                  ...existingColumnMapping,
                  [currentNodeData.nodeName]: columnMapping
                }
              }
            }
          };
          useFlowStore.getState().updateNodeData(selectedNode.id, updatedNodeData);
          
          console.log(`Reordered columns for ${currentNodeData.nodeName}:`, newColumns.map((col, idx) => ({
            order: idx,
            name: col.name,
            displayColumn: col.displayColumn
          })));
          
          // Show success message
          toast.success(`Column order updated for ${currentNodeData.nodeName}`);
        }
      }
    }
  };

  const handleDragEnd = () => {
    setDragOverIndex(null);
    setDragIndex(null);
  };

  const renderColumnTable = (columns: ColumnData[]) => {
    return (
      <div ref={tableRef} className="border rounded-lg max-h-120 overflow-y-auto relative shadow-sm">
        <Table>
          <TableHeader className="sticky top-0 bg-slate-50 z-10 border-b">
            <TableRow className="border-b">
              <TableHead className="w-8 bg-slate-50 border-b-0"></TableHead>
              <TableHead className="bg-slate-50 border-b-0 font-semibold text-slate-600">Column Name</TableHead>
              <TableHead className="bg-slate-50 border-b-0 font-semibold text-slate-600">Display Column</TableHead>
              <TableHead className="bg-slate-50 border-b-0 font-semibold text-slate-600">Data Type</TableHead>
              <TableHead className="bg-slate-50 border-b-0 font-semibold text-slate-600">Required</TableHead>
              <TableHead className="bg-slate-50 border-b-0 font-semibold text-slate-600">Fill Null Value</TableHead>
              <TableHead className="w-24 bg-slate-50 border-b-0 font-semibold text-slate-600">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(Array.isArray(columns) ? columns : []).map((column, index) => (
              <TableRow 
                key={`${column.name}-${index}`} // Use stable key based on name and position
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`cursor-move transition-colors text-sm ${
                  dragIndex === index ? 'opacity-50 bg-blue-50' : ''
                } ${
                  dragOverIndex === index && dragIndex !== index ? 'bg-green-50 border-t-2 border-green-500' : ''
                } hover:bg-slate-50`}
              >
                <TableCell className="w-8">
                  <GripVertical className="h-4 w-4 text-gray-400 cursor-grab" />
                </TableCell>
                
                {/* Column Name - Non-editable */}
                <TableCell>
                  <Badge variant="outline" className="font-mono bg-white text-slate-700 border-slate-200">
                    {column.name.toUpperCase()}
                  </Badge>
                </TableCell>
                
                {/* Display Column */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Input
                      value={editingColumn === column.name ? editFormData.displayColumn : (column.displayColumn || column.name)}
                      onChange={(e) => {
                        if (editingColumn === column.name) {
                          setEditFormData(prev => ({ ...prev, displayColumn: e.target.value }));
                        }
                      }}
                      className="w-full h-8"
                      disabled={editingColumn !== column.name}
                      placeholder={column.name} // Show original name as placeholder
                    />
                    {/* Show indicator if display column is different from original name */}
                    {column.displayColumn && column.displayColumn !== column.name && (
                      <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                        Renamed
                      </Badge>
                    )}
                  </div>
                </TableCell>
                
                {/* Data Type - Shows datatype values */}
                <TableCell>
                  {editingColumn === column.name ? (
                    <Select
                      value={editFormData.datatype}
                      onValueChange={(value) => setEditFormData(prev => ({ ...prev, datatype: value }))}
                    >
                      <SelectTrigger className="w-full h-8">
                        <SelectValue placeholder="Select datatype" />
                      </SelectTrigger>
                      <SelectContent>
                        {(Array.isArray(datatypeOptions) ? datatypeOptions : []).map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge 
                      variant="secondary" 
                      className="text-xs bg-slate-100 text-slate-500 dark:bg-slate-200 dark:text-slate-500 px-2 py-1 rounded font-mono"
                    >
                      {column.datatype || column.type}
                    </Badge>
                  )}
                </TableCell>
                
                {/* Required - Checkbox */}
                <TableCell>
                  <Checkbox
                    checked={editingColumn === column.name ? editFormData.required : (column.required || false)}
                    onCheckedChange={(checked) => {
                      if (editingColumn === column.name) {
                        setEditFormData(prev => ({ ...prev, required: checked as boolean }));
                      } else {
                        const currentNodeData = getCurrentNodeData();
                        if (currentNodeData) {
                          // Ensure columns is an array
                          const columnsArray = Array.isArray(currentNodeData.columns) ? currentNodeData.columns : [];
                          
                          if (columnsArray.length === 0) {
                            console.warn(`No columns found for node: ${currentNodeData.nodeName}`);
                            return;
                          }
                          
                          const updatedColumns = columnsArray.map(col => 
                            col.name === column.name 
                              ? { ...col, required: checked as boolean }
                              : col
                          );
                          updateNodeColumns(selectedTab, updatedColumns);
                        }
                      }
                    }}
                    disabled={editingColumn !== column.name && editingColumn !== null}
                  />
                </TableCell>
                
                {/* Fill Null Value */}
                <TableCell>
                  <Input
                    value={editingColumn === column.name ? editFormData.fillNullValue : (column.fillNullValue || '')}
                    onChange={(e) => {
                      if (editingColumn === column.name) {
                        setEditFormData(prev => ({ ...prev, fillNullValue: e.target.value }));
                      }
                    }}
                    placeholder="Enter null value"
                    className="w-full h-8"
                    disabled={editingColumn !== column.name}
                  />
                </TableCell>
                
                {/* Actions */}
                <TableCell>
                  <div className="flex gap-1">
                    {editingColumn === column.name ? (
                      <>
                        <Button
                          variant="outline"
                          onClick={handleSaveEdit}
                          className="h-6 w-6 p-0"
                          title="Save Changes"
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleCancelEdit}
                          className="h-6 w-6 p-0"
                          title="Cancel Edit"
                        >
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => handleEdit(column.name)}
                        className="h-6 w-6 p-0"
                        title="Edit Row"
                        disabled={editingColumn !== null && editingColumn !== column.name}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="w-full p-2 overflow-hidden">
      {/* Header with Cancel and Save Buttons */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Reporting Configuration</h3>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSaveAll}
            disabled={isLoading || nodeDataList.length === 0 || mode === 'view'} className='disabled:cursor-not-allowed'
          >
            {isLoading ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Tabs for Multiple Nodes */}
      {nodeDataList.length > 0 ? (
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className={`grid w-full ${nodeDataList.length <= 2 ? 'grid-cols-2' : nodeDataList.length <= 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
            {(Array.isArray(nodeDataList) ? nodeDataList : []).map((nodeData) => (
              <TabsTrigger key={nodeData.nodeId} value={nodeData.nodeId} className="text-xs">
                {nodeData.nodeName} ({Array.isArray(nodeData.columns) ? nodeData.columns.length : 0})
              </TabsTrigger>
            ))}
          </TabsList>
          
          {(Array.isArray(nodeDataList) ? nodeDataList : []).map((nodeData) => (
            <TabsContent key={nodeData.nodeId} value={nodeData.nodeId} className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <h4 className="text-md font-medium">Columns from {nodeData.nodeName}</h4>
                  <span className="text-sm text-gray-500">({Array.isArray(nodeData.columns) ? nodeData.columns.length : 0} columns)</span>
                </div>
                
                {/* Summary Badges */}
                {Array.isArray(nodeData.columns) && nodeData.columns.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Badge className="bg-slate-100 text-slate-800 px-3 py-1 rounded font-semibold">
                      Total Columns: {Array.isArray(nodeData.columns) ? nodeData.columns.length : 0}
                    </Badge>
                    <Badge className="bg-blue-100 text-blue-800 px-3 py-1 rounded font-semibold">
                      Selected: {Array.isArray(nodeData.columns) ? nodeData.columns.filter(col => col.selected).length : 0}
                    </Badge>
                    <Badge className="bg-green-100 text-green-800 px-3 py-1 rounded font-semibold">
                      Required: {Array.isArray(nodeData.columns) ? nodeData.columns.filter(col => col.required).length : 0}
                    </Badge>
                  </div>
                )}
                
                {Array.isArray(nodeData.columns) && nodeData.columns.length > 0 ? (
                  renderColumnTable(nodeData.columns)
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No columns found for {nodeData.nodeName}</p>
                  </div>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p>No connected nodes found. Connect nodes to the reporting node to see available columns.</p>
          <p className="text-xs mt-2">Make sure nodes are properly connected to the reporting node.</p>
        </div>
      )}
    </div>
  );
};

export default ReportingForm;
