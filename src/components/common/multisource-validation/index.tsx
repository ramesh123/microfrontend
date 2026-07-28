import React, { useMemo, useEffect, useState } from 'react';
import useFlowStore from '@/stores/flowStore';
import useSourceNodes from '@/hooks/use-source-nodes';
import { Source } from '@/types';
import useDataValidationStore from '@/stores/nwayvalidationstore';
import { ColumnMappingComponent } from './components/column-mapping-component';

interface FlowNode {
  id: string;
  data: {
    display_name?: string;
    node?: {
      title?: string;
      payload?: {
        table: string;
        tag?: string;
        datasets?: any; // Add the datasets property here
      };
      output?: {
        columns?: string[],
        data?: any[]
      };
    };
  };
}

interface MultiSourceValidationProps {
  flowId?: string;
}

function MultiSourceValidation({ flowId }: MultiSourceValidationProps = {}) {
  const { initializeState, reset } = useDataValidationStore();
  const currentNode = useFlowStore((state) => state.getSelectedNode());
  const [sourceNodes, setSourceNodes] = useState<FlowNode[]>([]);

  // Fetch sourceNodes only when currentNodeId changes
  useEffect(() => {
    if (currentNode?.id) {
      const getUpstreamNodes = useFlowStore.getState().getUpstreamNodes;
      const nodes = getUpstreamNodes(currentNode?.id);
      setSourceNodes(nodes as FlowNode[]);
    } else {
      setSourceNodes([]);
    }
  }, [currentNode]);

  // Create sources from sourceNodes
  const sources = useMemo<Source[]>(() => {
    if (!sourceNodes || sourceNodes.length === 0) return [];
    
    return sourceNodes.map((node: FlowNode, index: number) => ({
      id: node.id,
      name: node.data.node?.payload?.table || node.data.display_name || node.id,
      tag: node.data.node?.payload?.tag || `tag${index + 1}`,
      selected: true,
      data: node.data.node?.output?.data || [],
      columns: (node.data.node?.output?.columns || []).map((colName: string, colIndex: number) => ({
        id: `col${colIndex}`,
        name: colName,
        type: 'string',
        sourceId: node.id,
      })),
    }));
  }, [sourceNodes]);

  // Initialize state when sources or payload changes
  useEffect(() => {
    const payload = currentNode?.data?.node?.payload;
    
    if (payload && sources.length > 0) {
      initializeState(payload, sources);
    } else {
      reset();
    }
  }, [sources, currentNode?.data?.node?.payload]); // Only depend on sources and payload

  const saveEndpointConfig = currentNode?.data?.node?.save_node || {};

  const handleSave = () => {
    console.log('Save completed. The flow store should be updated by the save logic.');
  };

  const handleCancel = () => {
    console.log('Operation cancelled');
  };

  return (
    <div className="h-screen w-full bg-background text-foreground">
      {currentNode ? (
        <ColumnMappingComponent
          nodeData={currentNode}
          sources={sources}
          saveEndpointConfig={saveEndpointConfig}
          onSave={handleSave}
          onCancel={handleCancel}
          flowId={flowId}
        />
      ) : (
        <div className="flex h-full items-center justify-center">
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
            <h3 className="text-lg font-medium text-foreground">No Multi-Source Validation Node Found</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Please select a "Multi-Source Validation" node in the flow to configure it.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default MultiSourceValidation;
