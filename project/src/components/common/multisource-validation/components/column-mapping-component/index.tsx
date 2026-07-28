import { useState, useMemo, useCallback } from 'react';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import { Source } from '@/types';
import { saveNodeDetailsApi } from '@/controllers/API';
import { toast } from 'sonner';
import useFlowStore from '@/stores/flowStore';
import useDataValidationStore from '@/stores/nwayvalidationstore';
import { FetchAPIParams, FlowNode } from '@/types/form';
import { ConnectionsPanel } from '../ConnectionsPanel';
import { FlowDiagram } from '../FlowDiagram';
import { SourceSelection } from '../SourceSelection';
import MultiSourceValidationHelper from './MultiSourceValidationHelper';

interface ColumnMappingComponentProps {
  nodeData: FlowNode;
  sources: Source[];
  saveEndpointConfig: FetchAPIParams;
  onSave: () => void;
  onCancel: () => void;
  flowId?: string;
}

export function ColumnMappingComponent({
  nodeData,
  sources,
  saveEndpointConfig,
  onSave,
  onCancel,
  flowId,
}: ColumnMappingComponentProps) {
  const [isLoading, setIsLoading] = useState(false);
  const flow_id = useFlowStore((state) => state.currentWorkflow?.flow_id);

  const {
    connections,
    aggregationRules,
    connectionTypes,
    selectedSourceIds,
    sourceOrder,
    toggleSource,
    addConnection,
    removeConnection,
    setConnectionType,
    updateAggregationRule,
    reorderSources,
  } = useDataValidationStore();

  const displaySources = useMemo(() => {
    // Sort sources according to sourceOrder, fallback to original order if sourceOrder is empty
    const sortedSources = sourceOrder.length > 0
      ? sourceOrder.map(id => sources.find(s => s.id === id)).filter(Boolean) as Source[]
      : sources;

    return sortedSources.map(s => ({
      ...s,
      selected: selectedSourceIds.includes(s.id),
    }));
  }, [sources, selectedSourceIds, sourceOrder]);

  const flowSources = useMemo(() => {
    // Sort sources according to sourceOrder, fallback to original order if sourceOrder is empty
    const sortedSources = sourceOrder.length > 0
      ? sourceOrder.map(id => sources.find(s => s.id === id)).filter(Boolean) as Source[]
      : sources;

    return sortedSources.filter(s => selectedSourceIds.includes(s.id));
  }, [sources, selectedSourceIds, sourceOrder]);


  const handleSave = async () => {
    if (!saveEndpointConfig?.module || !saveEndpointConfig?.klass) {
      toast.error('Save API endpoint is not configured for this node.');
      return;
    }
    if (connections.length === 0) {
      toast.warning("Please create at least one connection to save.");
      return;
    }
    setIsLoading(true);
    try {
      const multiSourceValidationHelper = new MultiSourceValidationHelper()
      const finalApiPayload = multiSourceValidationHelper.buildSavePayload(nodeData)
      const response = await saveNodeDetailsApi(saveEndpointConfig, finalApiPayload);

      useFlowStore.getState().updateNodeData(nodeData.id, response);

      toast.success("Configuration saved successfully!");
      onSave();

    } catch (error) {
      const errorMessage = getDisplayErrorMessage(error, 'An unknown error occurred.');
      toast.error(`Failed to save configuration: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <SourceSelection
        sources={displaySources}
        onToggleSource={toggleSource}
        onReorderSources={reorderSources}
        onSave={handleSave}
        onCancel={onCancel}
        isLoading={isLoading}
      />

      <div className="flex-1 flex flex-col lg:flex-row gap-2 p-2 min-h-0">
        <div className="flex-1 h-full lg:w-[920px] lg:max-w-[920px] lg:h-full">
          <FlowDiagram
            sources={flowSources}
            connections={connections}
            onAddConnection={addConnection}
            onRemoveConnection={removeConnection}
            connectionTypes={connectionTypes}
          />
        </div>
        <div className="w-full lg:w-[420px] lg:max-w-[420px] flex-shrink-0">
          <ConnectionsPanel
            sources={sources}
            connections={connections}
            connectionTypes={connectionTypes}
            aggregationRules={aggregationRules}
            onSetConnectionType={setConnectionType}
            onUpdateAggregationRule={updateAggregationRule}
            onRemoveConnection={removeConnection}
          />
        </div>
      </div>
    </div>
  );
}
