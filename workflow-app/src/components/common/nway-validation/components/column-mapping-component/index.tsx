import { useMemo } from 'react';
import { Source } from '@/types';
import useDataValidationStore from '@/stores/nwayvalidationstore';
import { FetchAPIParams, FlowNode } from '@/types/form';
import { ConnectionsPanel } from '../ConnectionsPanel';
import { FlowDiagram } from '../FlowDiagram';
import { SourceSelection } from '../SourceSelection';

interface ColumnMappingComponentProps {
  nodeData: FlowNode;
  sources: Source[];
  saveEndpointConfig: FetchAPIParams;
  onSave: () => void;
  onCancel: () => void;
  mode: 'view' | 'edit';
}

export function ColumnMappingComponent({
  sources,
  mode='edit'

}: ColumnMappingComponentProps) {

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

  return (
    <div className="h-full flex flex-col bg-background">
      <SourceSelection
        sources={displaySources}
        onToggleSource={toggleSource}
        onReorderSources={reorderSources}
        mode={mode}
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
