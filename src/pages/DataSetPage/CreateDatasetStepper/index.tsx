// src/pages/DataSetPage/CreateDatasetStepper/index.tsx
import { useState, useEffect, useMemo, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Node, NodeDetails } from '@/types/dataset';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Check, ChevronRight } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import { getDatasetById, createDataset, updateDataset, getNodeDetails } from '@/controllers/API/datasetApi';
import Step1ConnectorSelection from '@/components/common/datasets/Steps/Step1ConnectorSelection';
import Step2Configuration from '@/components/common/datasets/Steps/Step2Configuration';
import Step2ConfigurationFiles from '@/components/common/datasets/Steps/Step2Configuration/Step2ConfigurationFiles';
import Step3Properties from '@/components/common/datasets/Steps/Step3Properties';
import Step4Preview from '@/components/common/datasets/Steps/Step4Preview';
import Step5ChartColumns from '@/components/common/datasets/Steps/Step5ChartColumns';
import DatasetStepLoading from '@/components/common/datasets/DatasetStepLoading';
import { normalizeChartColumns } from '@/components/common/datasets/Steps/Step5ChartColumns/types';
import {
  type DatasetSemanticMappings,
  hasSemanticMappingData,
  normalizeSemanticMappings,
  semanticMappingsFromChartColumns,
} from '@/components/common/datasets/Steps/Step5ChartColumns/semanticMapping';
import { ColDef } from 'ag-grid-community';

const BASE_STEPS = [
  { id: 1, name: 'Type' },
  { id: 2, name: 'Configuration' },
  { id: 3, name: 'Properties' },
  { id: 4, name: 'Preview' },
];
const SEMANTIC_MAPPING_STEP = { id: 5, name: 'Semantic Mapping' };

function hasSavedChartColumns(value: unknown): boolean {
  const normalized = normalizeChartColumns(value);
  return !!(
    normalized.x_axis ||
    normalized.dimensions.length ||
    normalized.metrics.length ||
    normalized.filters.length
  );
}

function loadSemanticState(
  payload: Record<string, unknown> | null | undefined,
  properties: any[] | null,
) {
  const selectedProperties = (properties || []).filter((property) => property.isSelected !== false && property.name);
  const savedSemantic = payload?.semantic_mappings;
  const savedChartColumns = payload?.chart_columns;

  if (hasSemanticMappingData(savedSemantic)) {
    const columns = normalizeSemanticMappings(savedSemantic, selectedProperties);
    return {
      semanticMappings: { columns } satisfies DatasetSemanticMappings,
      enabled: true,
    };
  }

  if (hasSavedChartColumns(savedChartColumns)) {
    const columns = semanticMappingsFromChartColumns(
      normalizeChartColumns(savedChartColumns),
      selectedProperties,
    );
    return {
      semanticMappings: { columns } satisfies DatasetSemanticMappings,
      enabled: true,
    };
  }

  return {
    semanticMappings: null,
    enabled: false,
  };
}

interface CreateDatasetStepperProps {
  onStep2Complete?: (config: Record<string, any>) => void;
  onAddToTable?: (config: Record<string, any>, properties?: any[], nodeDetails?: any) => void;
  initialSelectedNode?: any;
  disableNodeSelection?: boolean;
  isVirtualEditMode?: boolean;
  onClose?: () => void;
  /** When true, Step1 shows API + Pipeline (Select Workflow / Select Node). Defaults to path-based /virtual-db detection when not provided. */
  isVirtualDb?: boolean;
}

const CreateDatasetStepper = ({ onStep2Complete, onAddToTable, initialSelectedNode = null, disableNodeSelection = false, isVirtualEditMode = false, onClose, isVirtualDb }: CreateDatasetStepperProps) => {  

  const navigate = useNavigate();
  const { datasetId } = useParams<{ datasetId?: string }>();
  const isEditing = !!datasetId;
  const [isLoading, setIsLoading] = useState(isEditing);
  const [currentStep, setCurrentStep] = useState(isEditing ? 2 : 1);
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(isEditing ? new Set([1, 2]) : new Set([1]));
  const [direction, setDirection] = useState(1);
  const [selectedNode, setSelectedNode] = useState<Node | null>(() => {
    if (!initialSelectedNode) return null;
    // Normalize NodeDetails -> Node if needed
    const src: any = initialSelectedNode;
    return {
      node_id: src.node_id ?? src.nodeId ?? src.id,
      name: src.name ?? src.display_name ?? '',
      display_name: src.display_name ?? src.name ?? '',
      group: src.group ?? '',
      icon: src.icon ?? '',
      description: src.description ?? ''
    } as Node;
  });
  const [nodeDetails, setNodeDetails] = useState<NodeDetails | null>(null);
  const [configurationData, setConfigurationData] = useState<Record<string, any> | null>(null);
  const [propertiesData, setPropertiesData] = useState<any[] | null>(null);
  const [previewColDefs, setPreviewColDefs] = useState<ColDef[]>([]);
  const [previewRowData, setPreviewRowData] = useState<any[]>([]);
  const [semanticMappingsData, setSemanticMappingsData] = useState<DatasetSemanticMappings | null>(null);
  const [enableAnalyticalChartColumns, setEnableAnalyticalChartColumns] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const steps = useMemo(
    () =>
      enableAnalyticalChartColumns || visitedSteps.has(5)
        ? [...BASE_STEPS, SEMANTIC_MAPPING_STEP]
        : BASE_STEPS,
    [enableAnalyticalChartColumns, visitedSteps],
  );

  useEffect(() => {  
    if (isEditing && datasetId) { 
      setIsLoading(true);
      getDatasetById(Number(datasetId)).then(dataset => { 
        // Extract configuration from the correct location - dataset.node.payload contains the actual form values
        const nodePayload = dataset.node?.payload || {};
        const config = { 
          ...nodePayload, 
          name: dataset.name, 
          datasetName: dataset.name, 
          response_type: 'json' 
        };
        
        getNodeDetails(dataset.node_id).then(details => {
          setNodeDetails(details);
          const nodeForSelection: Node = { 
            node_id: details.node_id,
            name: details.name,
            display_name: details.display_name,
            group: details.group,
            icon: details.icon,
            description: '',
          };
          setSelectedNode(nodeForSelection);
          setConfigurationData(config);
          // Properties can be in payload (new location), node.properties, or root properties (old locations)
          setPropertiesData(dataset.node?.payload?.properties || dataset.node?.properties || dataset.properties || null);
          const payload = {
            ...(dataset.node?.payload ?? {}),
            ...(dataset.payload ?? {}),
          } as Record<string, unknown>;
          const semanticState = loadSemanticState(
            payload,
            dataset.node?.payload?.properties || dataset.node?.properties || dataset.properties || null,
          );
          setSemanticMappingsData(semanticState.semanticMappings);
          setEnableAnalyticalChartColumns(semanticState.enabled);
          setVisitedSteps(new Set([1, 2, 3, 4, ...(semanticState.enabled ? [5] : [])]));
          setCurrentStep(2);
        });

      }).catch((error) => {
        toast.error(getDisplayErrorMessage(error, 'Failed to load dataset for editing.'));
        navigate('/dashboard/datasets');
      }).finally(() => setIsLoading(false));
    }
  }, [datasetId, isEditing, navigate]);

  // If an initialSelectedNode is provided (e.g., from previous Add to Table), pre-fill and lock selection.
  useEffect(() => {
    if (initialSelectedNode) {
      const src: any = initialSelectedNode;
      const node: Node = {
        node_id: src.node_id ?? src.nodeId ?? src.id,
        name: src.name ?? src.display_name ?? '',
        display_name: src.display_name ?? src.name ?? '',
        group: src.group ?? '',
        icon: src.icon ?? '',
        description: src.description ?? ''
      };
      setSelectedNode(node);

      // Mark step 2 as visited so user can move forward, but keep Step 1 visible.
      setVisitedSteps(prev => {
        const s = new Set(prev);
        s.add(2);
        return s;
      });

      // Preload previous configuration as defaults for Step 2.
      const initialPayload = src?.node?.payload ?? src?.payload;
      if (initialPayload) {
        setConfigurationData({
          ...initialPayload,
          datasetName: initialPayload.name ?? initialPayload.datasetName ?? ''
        });
        if (Array.isArray(initialPayload.properties)) {
          setPropertiesData(initialPayload.properties);
          setVisitedSteps(prev => {
            const s = new Set(prev);
            s.add(3);
            return s;
          });
        }
        if (initialPayload.chart_columns || initialPayload.semantic_mappings) {
          const semanticState = loadSemanticState(initialPayload, initialPayload.properties || null);
          setSemanticMappingsData(semanticState.semanticMappings);
          setEnableAnalyticalChartColumns(semanticState.enabled);
        }
      }

      // Keep optional node details if available.
      if (src?.node && src?.node_id) {
        setNodeDetails(src as NodeDetails);
      } else if (src.node) {
        setNodeDetails(src.node as NodeDetails);
      } else if (src.payload) {
        setNodeDetails(src as NodeDetails);
      }

      // In Virtual DB edit mode (selection locked), open directly on Step 2.
      if (disableNodeSelection) {
        setCurrentStep(2);
      }
    }
  }, [initialSelectedNode, disableNodeSelection]);

  const goToStep = (step: number) => { if (visitedSteps.has(step) && step !== currentStep) { setDirection(step > currentStep ? 1 : -1); setCurrentStep(step); } };
  const handleNodeSelection = (node: Node) => {
    if (disableNodeSelection) return; // prevent manual changes when locked
    if (selectedNode?.node_id !== node.node_id) {
      setNodeDetails(null); setConfigurationData(null); setPropertiesData(null); setSemanticMappingsData(null); setEnableAnalyticalChartColumns(false);
      setVisitedSteps(new Set([1, 2]));
      // Clear preview data when selecting a different node
      setPreviewColDefs([]); setPreviewRowData([]);
    } else {
      setVisitedSteps(prev => new Set(prev).add(2));
      // Don't clear preview data if it's the same node - keep existing data
    }
    setSelectedNode(node); setDirection(1); setCurrentStep(2);
  };
  const handleConfigurationComplete = (details: NodeDetails, config: Record<string, any>) => {
    console.log('[CreateDatasetStepper] Received config from Step2:', config);
    console.log('[CreateDatasetStepper] Output fields:', {
      output_local: config.output_local,
      output_remote: config.output_remote,
      local_output_fields: config.local_output_fields,
      remote_output_fields: config.remote_output_fields
    });
    setNodeDetails(details);
    setConfigurationData(config);
    if (onStep2Complete) onStep2Complete(config);
    setVisitedSteps(prev => new Set(prev).add(3));
    setDirection(1);
    setCurrentStep(3);
  };
  const handlePropertiesComplete = (props: any[]) => {
    setPropertiesData(props);
    setSemanticMappingsData(null);
    setEnableAnalyticalChartColumns(false);
    setVisitedSteps(prev => new Set(prev).add(4));
    setDirection(1);
    setCurrentStep(4);
  };

  const handleEnableAnalyticalChange = (enabled: boolean) => {
    setEnableAnalyticalChartColumns(enabled);
    if (!enabled) {
      setSemanticMappingsData(null);
    }
  };

  const handleSemanticMappingsChange = useCallback((semanticMappings: DatasetSemanticMappings) => {
    setSemanticMappingsData(semanticMappings);
  }, []);

  const handlePreviewContinue = async () => {
    if (enableAnalyticalChartColumns) {
      setVisitedSteps(prev => new Set(prev).add(5));
      setDirection(1);
      setCurrentStep(5);
      return;
    }

    setSemanticMappingsData(null);

    if (isVirtualDb && onAddToTable && nodeDetails && configurationData) {
      setIsSaving(true);
      try {
        onAddToTable(configurationData, propertiesData || [], nodeDetails);
        toast.success(isVirtualEditMode ? 'Data updated successfully' : 'Data added to table successfully');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    await handleSave();
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setDirection(-1);
      setCurrentStep(currentStep - 1);
    } else if (onClose) {
      onClose();
    } else {
      navigate('/datasets');
    }
  };

  const handleSave = async () => {
    if (!nodeDetails || !configurationData) {
      toast.error("Configuration is missing.");
      throw new Error("Configuration is missing.");
    }

    setIsSaving(true);
    try {
    // Filter only selected properties for saving
    const finalProperties = (propertiesData || []).filter(p => p.isSelected !== false);
    const payload = JSON.parse(JSON.stringify(nodeDetails.node.payload));
    Object.keys(payload).forEach(key => { // payload //
      const placeholder = payload[key];
      if (typeof placeholder === 'string' && placeholder.startsWith('{{') && placeholder.endsWith('}}')) {
        const dataKey = placeholder.replace(/{{|}}/g, '');
        payload[key] = configurationData[dataKey] ?? '';
      } else {
        payload[key] = payload[key];
      }
    });

    // Add custom fields from file configuration if they exist in configurationData (for file datasets)
    const fileConfigFields = [
      'source_name', 'file_name_custom', 'file_date_pattern',
      'tdate', 'tmonth', 'date_folder_pattern', 'date_folder_date', 'date_folder_month',
      'move_input_to_process', 'remote_process_path', 'move_file', 'date_of_file',
      'remote_path_pending', 'remote_path_processed', 'local_path_pending', 'local_path_processed',
      'remote_matched_outputpath', 'remote_unmatched_output_path', 'remote_autorefundpath',
      'output_path', 'output_filename', 'output_datepattern',
      // Add the new dynamic fields from Step2ConfigurationFiles
      'output_fields', 'local_input_fields', 'remote_input_fields',
      'rollback_output_fields', 'rollback_input_fields', 'input_local', 'input_remote',
      // Add output fields
      'output_local', 'output_remote', 'local_output_fields', 'remote_output_fields',
      // Add dataset icon fields
      'file_name', 'icon_encrypted_file_key', 'icon_unique_id', 'icon_size', 'file_category'
    ];

    fileConfigFields.forEach(field => {
      if (configurationData[field] !== undefined) {
        payload[field] = configurationData[field];
      }
    });

    console.log('[CreateDatasetStepper] Final payload before submission:', payload);
    console.log('[CreateDatasetStepper] Output fields in payload:', {
      output_local: payload.output_local,
      output_remote: payload.output_remote,
      local_output_fields: payload.local_output_fields,
      remote_output_fields: payload.remote_output_fields
    });

    // FIX: Ensure node_id is included in the submission data for both create and update
    const submissionData = {
      name: configurationData.datasetName,
      node_id: nodeDetails.node_id,
      type: nodeDetails.name,
      icon: configurationData.icon_unique_id || configurationData.icon_encrypted_file_key || nodeDetails.icon,
      description: nodeDetails.description,
      display_name: nodeDetails.display_name,
      klass_name: nodeDetails.klass_name,
      show_node: nodeDetails.show_node,
      modules: nodeDetails.modules,
      group: nodeDetails.group,
      node: {
        save_node: nodeDetails.node.save_node,
        get_data: nodeDetails.node.get_data,
        template: nodeDetails.node.template,
        payload: {
          ...payload,
          name: configurationData?.datasetName,
          properties: finalProperties,
          ...(enableAnalyticalChartColumns && semanticMappingsData ? { semantic_mappings: semanticMappingsData } : {}),
        }
      }
    };

    const promise = isEditing
      ? updateDataset(Number(datasetId), submissionData)
      : createDataset(submissionData);

    await toast.promise(promise, {
      loading: isEditing ? 'Updating dataset...' : 'Creating dataset...',
      success: () => {
        // Dispatch event to refresh datasets in sidebar
        window.dispatchEvent(new CustomEvent('dataset-updated'));
        if (onClose) {
          onClose();
        } else {
          navigate('/datasets');
        }
        return `Dataset ${isEditing ? 'updated' : 'created'} successfully!`;
      },
      error: (err: any) => `Failed to save dataset: ${err.message}`,
    });
    } catch (error) {
      setIsSaving(false);
      throw error;
    }
  };


  if (isLoading) {
    return <DatasetStepLoading message="Loading dataset..." className="min-h-[80vh] w-full" />;
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return <Step1ConnectorSelection onNodeSelect={handleNodeSelection} disabled={disableNodeSelection} initialSelectedNode={selectedNode}  />;
      case 2:
        if (!selectedNode) return null;

        // Determine if this is a file dataset based on selectedNode group
        // Use selectedNode instead of nodeDetails because selectedNode is set immediately
        const isFileDataset = selectedNode.group === 'Files';

        // Use Step2ConfigurationFiles for file datasets, Step2Configuration for database datasets
        if (isFileDataset) {
          return <Step2ConfigurationFiles
            key={selectedNode.node_id}
            nodeId={selectedNode.node_id}
            onConfigurationComplete={handleConfigurationComplete}
            initialData={configurationData}
            onBack={handleBack}
            isEditing={isEditing}
          />;
        } else {
          return <Step2Configuration
            key={selectedNode.node_id}
            nodeId={selectedNode.node_id}
            onConfigurationComplete={handleConfigurationComplete}
            initialData={configurationData}
            onBack={handleBack}
            previewColDefs={previewColDefs}
            previewRowData={previewRowData}
            setPreviewColDefs={setPreviewColDefs}
            setPreviewRowData={setPreviewRowData}
            isEditing={isEditing}
          />;
        }
      case 3:
        if (!nodeDetails || !configurationData) return null;
        return <Step3Properties
          nodeDetails={nodeDetails}
          configurationData={configurationData}
          onPropertiesComplete={handlePropertiesComplete}
          initialData={propertiesData}
          onBack={handleBack}
        />;
      case 4:
        if (!nodeDetails || !configurationData) return null;
        return <Step4Preview
          nodeDetails={nodeDetails}
          configurationData={configurationData}
          propertiesData={propertiesData || []}
          onBack={handleBack}
          enableAnalytical={enableAnalyticalChartColumns}
          onEnableAnalyticalChange={handleEnableAnalyticalChange}
          onContinue={handlePreviewContinue}
          isSaving={isSaving}
          isEditing={isEditing}
          isVirtualEditMode={isVirtualEditMode}
        />;
      case 5:
        if (!nodeDetails || !configurationData) return null;
        return <Step5ChartColumns
          propertiesData={propertiesData || []}
          initialData={semanticMappingsData}
          onSemanticMappingsChange={handleSemanticMappingsChange}
          onBack={handleBack}
          onSave={handleSave}
          onAddToTable={onAddToTable}
          configurationData={configurationData}
          nodeDetails={nodeDetails}
          isVirtualEditMode={isVirtualEditMode}
          isEditing={isEditing}
        />;
      default: return null;
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-card rounded-lg border">
      <header className="shrink-0 border-b p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleBack} className="h-7 w-7"><ArrowLeft className="h-4 w-4" /></Button>
            <h1 className="text-[16px] font-semibold">{isVirtualEditMode ? 'Edit Dataset' : (isEditing ? 'Edit Dataset' : 'Add Dataset')}</h1>
          </div>
          <nav className="flex items-center gap-1">{steps.map((step, index) => (<div key={step.id} className="flex items-center gap-1"><div className={`flex items-center gap-2 ${visitedSteps.has(step.id) ? 'cursor-pointer' : 'cursor-not-allowed'}`} onClick={() => goToStep(step.id)}><div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${currentStep > step.id ? 'bg-primary text-primary-foreground border-primary' : currentStep === step.id ? 'bg-primary/20 text-primary border-primary' : 'bg-muted text-muted-foreground border-transparent'}`}>{visitedSteps.has(step.id) && currentStep > step.id ? <Check className="h-3 w-3" /> : step.id}</div><span className={`font-medium text-sm ${currentStep >= step.id ? 'text-foreground' : 'text-muted-foreground'}`}>{step.name}</span></div>{index < steps.length - 1 && (<ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />)}</div>))}</nav>
          <div className="flex items-center gap-2 invisible"><Button variant="ghost" size="icon" className="h-7 w-7"><ArrowLeft className="h-4 w-4" /></Button></div>
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={currentStep} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.2 }} className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

export default CreateDatasetStepper;