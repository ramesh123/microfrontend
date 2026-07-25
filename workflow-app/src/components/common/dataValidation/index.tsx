import React, { useMemo, useEffect, useCallback } from 'react';
import { Column, NodeData, ColumnMapping, KeyValidationPair } from '@/types/dataValidation';
import useFlowStore from '@/stores/flowStore';
import useSourceNodes from '@/hooks/use-source-nodes';
import useDataValidationStore from '@/stores/dataValidationStore';
import ColumnMappingComponent from './components/column-mapping-component';

interface ExtendedNodeData extends NodeData {
  node?: {
    output?: {
      columns?: string[];
    };
    payload?: {
      column_mappings?: { sourceColumnId: string; targetColumnId: string }[];
      key_validation_pairs?: { keyColumnId: string; validationColumnId: string }[];
      saved_node?: boolean;
    };
    save_node?: any;
  };
  columns?: string[];
}

interface ExtendedNode {
  id: string;
  data: ExtendedNodeData & {
    type: string;
  };
}

function DataValidationEnhanced({
  mode,
  onClose,
}: {
  mode: 'view' | 'edit';
  onClose?: () => void;
}) {
  const currentNode = useFlowStore.getState().getSelectedNode();
  const { sourceNodes } = useSourceNodes();
  const { setMappings, setKeyValidationPairs, reset } = useDataValidationStore();

  const allAvailableColumns = useMemo(() => {
    const allCols: Column[] = [];
    sourceNodes.forEach(node => {
      const nodeData = node.data as unknown as ExtendedNodeData;
      const nodeColumns: any = (nodeData?.node?.output?.columns || nodeData?.columns || []).map((colName: string, index: number) => ({
        id: `${node.id}_col_${index}`,
        name: colName,
        type: 'VARCHAR'
      }));
      allCols.push(...nodeColumns);
    });
    return allCols;
  }, [sourceNodes]);

  useEffect(() => {
    const payload = currentNode?.data?.node?.payload;
    const hasSavedNode = payload?.saved_node === true;

    if (hasSavedNode && payload) {
      const findColumnById = (id: string): Column | null => allAvailableColumns.find(c => c.id === id) || null;

      const restoredMappings: ColumnMapping[] = (payload.column_mappings || []).map((m: any, i: number) => {
        const sourceColumn = findColumnById(m.sourceColumnId);
        const targetColumn = findColumnById(m.targetColumnId);
        if (sourceColumn && targetColumn) {
          return {
            id: `map-init-${sourceColumn.id}-${targetColumn.id}`,
            sourceColumn,
            targetColumn,
            colorIndex: i % 10,
          };
        }
        return null;
      }).filter((m): m is ColumnMapping => m !== null);

      const restoredPairs: KeyValidationPair[] = (payload.key_validation_pairs || []).map((p: any, i: number) => {
        const keyColumn = findColumnById(p.keyColumnId);
        const validationColumn = findColumnById(p.validationColumnId);
        if (keyColumn && validationColumn) {
          return {
            id: `pair-init-${keyColumn.id}-${validationColumn.id}`,
            keyColumn,
            validationColumn,
            colorIndex: i % 10, // This property is optional in KeyValidationPair
          } as KeyValidationPair; // Use type assertion to assert that the object is of type KeyValidationPair
        }
        return null;
      }).filter((p): p is KeyValidationPair => p !== null);
      setMappings(restoredMappings);
      setKeyValidationPairs(restoredPairs);

    } else {
      reset();
    }
  }, [currentNode, allAvailableColumns, setMappings, setKeyValidationPairs, reset]);

  const saveEndpointConfig = currentNode?.data?.node?.save_node || {};

  const handleSave = useCallback(() => {
    // Success toast and node update happen inside ColumnMappingComponent.
  }, []);

  const handleCancel = useCallback(() => {
    onClose?.();
  }, [onClose]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background text-foreground">
      <div className="relative mx-auto flex min-h-0 w-full max-w-full flex-1 flex-col px-2 py-1">
        {currentNode ? (
          <ColumnMappingComponent
            nodeData={currentNode}
            saveEndpointConfig={saveEndpointConfig}
            onSave={handleSave}
            onCancel={handleCancel}
            mode={mode}
          />
        ) : (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4">
              <div className="text-muted-foreground">
                <svg
                  className="mx-auto h-12 w-12 text-muted-foreground/50"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-foreground">No Data Validation Node Found</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Please ensure a "Data Validation" node is present in the flow.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DataValidationEnhanced;
