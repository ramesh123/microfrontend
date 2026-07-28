import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import { useParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import useFlowStore from '@/stores/flowStore';
import useDataValidationStore from '@/stores/dataValidationStore';
import { useSheetStore } from '@/stores/sheetStore';
import { saveNodeDetailsApi } from '@/controllers/API';
import { FetchAPIParams } from '@/types/form';
import ColumnMappingTab from '../column-mapping-tab';
import ConnectionSelector from '../input-connection-selector';
import KeyValidationTab from '../key-validation-tab';
import {
  DataValidationConnectionsPanel,
  type DataValidationPanelTab,
} from '../data-validation-connections-panel';
import { cn } from '@/lib/utils';

interface ColumnMappingComponentProps {
  nodeData?: { [key: string]: any };
  saveEndpointConfig: FetchAPIParams;
  onSave: () => void;
  onCancel: () => void;
  mode: 'view' | 'edit';
}

const ColumnMappingComponent: React.FC<ColumnMappingComponentProps> = ({
  nodeData,
  saveEndpointConfig,
  onSave,
  onCancel,
  mode = 'edit',
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [configTab, setConfigTab] = useState<DataValidationPanelTab>('column-mapping');
  const { id: flow_id } = useParams();

  const {
    mappings,
    keyValidationPairs,
    selectedSourceId,
    selectedTargetId,
    setMappings,
    setKeyValidationPairs,
    setSelectedSourceId,
    setSelectedTargetId,
  } = useDataValidationStore();

  const buildPayload = () => {
    const nodes = useFlowStore.getState().currentWorkflow?.data?.nodes ?? [];
    const sourceNode: any = nodes.find((n) => n.id === selectedSourceId);
    const targetNode: any = nodes.find((n) => n.id === selectedTargetId);

    const validationPayload = {
      column_mappings: mappings.map((m) => ({
        sourceColumnId: m.sourceColumn.id,
        targetColumnId: m.targetColumn.id,
      })),
      key_validation_pairs: keyValidationPairs.map((p) => ({
        keyColumnId: p.keyColumn.id,
        validationColumnId: p.validationColumn.id,
      })),
      source_key: mappings.map((m) => m.sourceColumn.name).filter(Boolean),
      target_key: mappings.map((m) => m.targetColumn.name).filter(Boolean),
      source_validation_column: keyValidationPairs.map((p) => p.keyColumn.name).filter(Boolean),
      target_validation_column: keyValidationPairs.map((p) => p.validationColumn.name).filter(Boolean),
      source_data: sourceNode ? JSON.stringify(sourceNode.data?.node?.output?.data) : '[]',
      target_data: targetNode ? JSON.stringify(targetNode.data?.node?.output?.data) : '[]',
      validation_type: keyValidationPairs.length > 0 ? 'key_validation' : 'basic',
      saved_node: true,
    };

    return {
      ...nodeData?.data,
      flow_id: flow_id,
      current_node_id: nodeData?.id,
      node: {
        ...nodeData?.data?.node,
        payload: {
          ...nodeData?.data?.node?.payload,
          ...validationPayload,
        },
      },
    };
  };

  const handleSave = useCallback(async () => {
    if (!saveEndpointConfig || !saveEndpointConfig.module || !saveEndpointConfig.klass) {
      toast.error('Save API endpoint is not configured for this node.');
      return;
    }

    setIsLoading(true);

    try {
      const finalApiPayload = buildPayload();
      const response = await saveNodeDetailsApi(saveEndpointConfig, finalApiPayload);

      useFlowStore.getState().updateNodeData(nodeData?.id, response);
      toast.success('Data validation saved successfully!');
      onSave();
    } catch (error) {
      console.error('Save failed:', error);
      const errorMessage = getDisplayErrorMessage(error, 'Please try again.');
      toast.error(`Failed to save data validation. ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [saveEndpointConfig, nodeData, flow_id, mappings, keyValidationPairs, selectedSourceId, selectedTargetId, onSave]);

  const setDataValidationHeaderActions = useSheetStore((s) => s.setDataValidationHeaderActions);

  const isReadOnly = mode === 'view';

  /** Refs avoid re-registering sheet header on every mappings/handleSave identity change (infinite loop). */
  const handleSaveRef = useRef(handleSave);
  const onCancelRef = useRef(onCancel);
  handleSaveRef.current = handleSave;
  onCancelRef.current = onCancel;

  useEffect(() => {
    setDataValidationHeaderActions({
      onSave: () => {
        void handleSaveRef.current();
      },
      onCancel: () => {
        onCancelRef.current();
      },
      isSaving: isLoading,
      saveDisabled: isReadOnly || isLoading,
    });
    return () => setDataValidationHeaderActions(null);
  }, [isLoading, isReadOnly, setDataValidationHeaderActions]);

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col items-stretch gap-2">
      <ConnectionSelector
        selectedSourceId={selectedSourceId}
        selectedTargetId={selectedTargetId}
        onSourceSelect={setSelectedSourceId}
        onTargetSelect={setSelectedTargetId}
        className="shrink-0 self-start"
      />

      <Tabs
        value={configTab}
        onValueChange={(v) => setConfigTab(v as DataValidationPanelTab)}
        className="flex min-h-0 w-full flex-1 flex-col"
      >
        <TabsList className="inline-flex h-8 w-fit max-w-full shrink-0 justify-start gap-0 self-start rounded-md bg-muted/50 p-0.5">
          <TabsTrigger value="column-mapping" className="px-3 text-xs sm:text-sm">
            Column Mapping
          </TabsTrigger>
          <TabsTrigger value="key-validation" className="px-3 text-xs sm:text-sm">
            Key & Validation
          </TabsTrigger>
        </TabsList>

        <div
          className={cn(
            'mt-1 flex flex-1 flex-col gap-2 lg:min-h-0 lg:flex-row lg:items-stretch lg:gap-3',
            configTab === 'key-validation'
              ? 'min-h-[280px] lg:h-[min(440px,56vh)] lg:max-h-[min(440px,56vh)]'
              : 'min-h-[240px] lg:h-[min(280px,38vh)] lg:max-h-[min(280px,38vh)]',
          )}
        >
          <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:h-full lg:min-h-0 lg:flex-[1_1_65%]">
            <TabsContent
              value="column-mapping"
              className="mt-0 flex h-full min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
            >
              <ColumnMappingTab
                mappings={mappings}
                onSetMappings={setMappings}
                selectedSourceId={selectedSourceId}
                selectedTargetId={selectedTargetId}
                isReadOnly={isReadOnly}
              />
            </TabsContent>
            <TabsContent
              value="key-validation"
              className="mt-0 flex h-full min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
            >
              <KeyValidationTab
                pairs={keyValidationPairs}
                onSetPairs={setKeyValidationPairs}
                selectedSourceId={selectedSourceId}
                selectedTargetId={selectedTargetId}
                isReadOnly={isReadOnly}
              />
            </TabsContent>
          </div>

          {configTab === 'column-mapping' && (
            <DataValidationConnectionsPanel
              activeTab={configTab}
              mappings={mappings}
              keyValidationPairs={keyValidationPairs}
              onRemoveMapping={(id) => setMappings(mappings.filter((m) => m.id !== id))}
              onRemovePair={(id) => setKeyValidationPairs(keyValidationPairs.filter((p) => p.id !== id))}
              readOnly={isReadOnly}
              className="min-h-[200px] h-full w-full shrink-0 lg:min-h-0 lg:h-full lg:w-[300px] lg:max-w-[340px] lg:flex-[0_0_32%] lg:self-stretch xl:w-[320px]"
            />
          )}
        </div>
      </Tabs>
    </div>
  );
};

export default ColumnMappingComponent;
