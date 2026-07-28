import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ChartSelectorSkeleton } from '../ChartFormulator/ChartFormulatorSkeletons';
import { Card } from '@/components/ui/card';
import { ChartType, ChartDiagramIcon } from './ChartConfigurator';
import { ChartTypeThumbnail, hasChartTypeThumbnail } from './ChartTypeThumbnail';
import { getChartPreviewIcon } from './ChartPreviewIcons';
import {
  getDashboardCharts,
  DashboardChartComponent,
  saveChart,
  updateChart,
  CreateChartPayload,
  getSavedChartIdFromResponse,
} from '@/pages/Visualization/API/chartsApi';
import { resolveChartCustomizationsForApi } from '../chartCustomizationsPayload';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import useFlowStore from '@/stores/flowStore';
import { saveNodeDetailsApi } from '@/controllers/API';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { buildWorkflowChartParamsFromNodeAndForm } from '../workflowChartParamsFromNodeAndForm';

// Use centralized diagrammatic icon renderer from ChartConfigurator
const getChartIcon = (uniqueId: string, key: string) => {
  const typeStr = (uniqueId || key || '').toString();
  return (props: any) => <ChartDiagramIcon type={typeStr} {...props} />;
};

interface ChartSelectorProps {
  onSelectChart: (chart: ChartType & { uniqueId: string }) => void;
  selectedChartId?: string;
  isViewOnly?: boolean;
}

export function ChartSelector({ onSelectChart, selectedChartId, isViewOnly = false }: ChartSelectorProps) {
  const location = useLocation();
  const showSaveButton = location.pathname.includes('workflow');
  const workflowPersistedChartId = useFlowStore((s) => {
    const n = s.getSelectedNode();
    const raw = n?.data?.node?.payload?.chart_id;
    if (raw === undefined || raw === null) return null;
    const t = String(raw).trim();
    return t || null;
  });
  const isWorkflowUpdate = !!workflowPersistedChartId;
  const [isSaving, setIsSaving] = useState(false);
  const [sections, setSections] = useState<Array<{ section: string; components: DashboardChartComponent[] }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaveChartNameDialogOpen, setIsSaveChartNameDialogOpen] = useState(false);
  const [chartNameToSave, setChartNameToSave] = useState('');

  useEffect(() => {
    const fetchCharts = async () => {
      setIsLoading(true);
      try {
        const response = await getDashboardCharts();
        if (response.status && response.data) {
          setSections(response.data);
        }
      } catch (error) {
        console.error('Failed to load charts:', error);
        toast.error('Failed to load charts');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCharts();
  }, []);

  const handleChartSelect = (component: DashboardChartComponent) => {
    const Icon = getChartIcon(component.unique_id, component.key);
    onSelectChart({
      name: component.name,
      icon: Icon,
      uniqueId: component.unique_id,
    });
  };

  // Flatten all charts from all sections into a single array
  const allCharts = sections.flatMap((section) => section.components);

  const handleSave = () => {
    if (!selectedChartId) {
      toast.error('Please select a chart before saving');
      return;
    }

    const selectedNode = useFlowStore.getState().getSelectedNode();
    if (!selectedNode) {
      toast.error('No node selected. Please select a charts node.');
      return;
    }

    // Find the selected chart from allCharts
    const selectedChart = allCharts.find(chart => chart.unique_id === selectedChartId);
    if (!selectedChart) {
      toast.error('Selected chart not found');
      return;
    }

    // Set initial chart name and open dialog
    setChartNameToSave(selectedChart.name || '');
    setIsSaveChartNameDialogOpen(true);
  };

  const handleConfirmSaveChartWithName = async () => {
    if (!chartNameToSave.trim()) {
      toast.error('Please enter a chart name');
      return;
    }

    if (!selectedChartId) {
      toast.error('Please select a chart before saving');
      return;
    }

    const selectedNode = useFlowStore.getState().getSelectedNode();
    if (!selectedNode) {
      toast.error('No node selected. Please select a charts node.');
      return;
    }

    // Find the selected chart from allCharts
    const selectedChart = allCharts.find(chart => chart.unique_id === selectedChartId);
    if (!selectedChart) {
      toast.error('Selected chart not found');
      return;
    }

    const saveEndpointConfig = selectedNode?.data?.node?.save_node;
    if (!saveEndpointConfig?.module || !saveEndpointConfig?.klass) {
      toast.error('Save API endpoint is not configured for this node.');
      return;
    }

    setIsSaving(true);
    setIsSaveChartNameDialogOpen(false);

    try {
      // Get current workflow and flow_id
      const currentWorkflow = useFlowStore.getState().currentWorkflow;
      const flow_id = currentWorkflow?.flow_id || '';

      const nodePayload = selectedNode.data.node.payload || {};
      const formValues = (typeof window !== 'undefined' && (window as any).__chartFormValues) || {};
      const formParams = (typeof window !== 'undefined' && (window as any).__chartFormParams) || [];
      const params = buildWorkflowChartParamsFromNodeAndForm({ nodePayload, formValues, formParams });

      const visualization_name = selectedChart.unique_id || selectedChart.name.toLowerCase().replace(/\s+/g, '_');

      // Build the saveChart payload with exact structure
      const saveChartPayload: CreateChartPayload = {
        flow_id: flow_id,
        visualization_name: visualization_name,
        chart_name: chartNameToSave.trim(),
        params: params,
      };

      const mergedCustomizations = resolveChartCustomizationsForApi(
        typeof window !== 'undefined' ? (window as any).__chartCustomizationOptions : null,
        null,
        visualization_name || '',
      );
      if (mergedCustomizations) {
        saveChartPayload.customization = mergedCustomizations;
      }

      // Add stmt_date if available
      if (nodePayload.stmt_date || nodePayload.stmtDate || formValues.stmt_date) {
        saveChartPayload.stmt_date = nodePayload.stmt_date || nodePayload.stmtDate || formValues.stmt_date;
      }

      // Include node_id / unique_id if available (for workflow context)
      const nid = selectedNode.id;
      let workflowNodeKey = '';
      if (nid) {
        workflowNodeKey = flow_id + '_' + nid;
        (saveChartPayload as any).node_id = workflowNodeKey;
        (saveChartPayload as any).unique_id = workflowNodeKey;
      }

      const existingChartIdRaw = nodePayload.chart_id;
      const isPersistedUpdate =
        existingChartIdRaw !== undefined &&
        existingChartIdRaw !== null &&
        String(existingChartIdRaw).trim() !== '';
      const persistedChartId = isPersistedUpdate ? String(existingChartIdRaw).trim() : '';
      const chartDataAny = nodePayload.chart_data as Record<string, any> | undefined;
      const previousUniqueIdForUpdate = isPersistedUpdate
        ? String(
            nodePayload.unique_id ??
              nodePayload.node_id ??
              chartDataAny?.unique_id ??
              chartDataAny?.node_id ??
              workflowNodeKey,
          ).trim()
        : '';

      const chartResponse = isPersistedUpdate
        ? await updateChart({
            chart_id: persistedChartId,
            payload: {
              data: {
                ...saveChartPayload,
                id: persistedChartId,
                ...(previousUniqueIdForUpdate ? { previous_unique_id: previousUniqueIdForUpdate } : {}),
              },
              actions: 'update_chart',
              stmt_date: saveChartPayload.stmt_date || '',
            },
          } as any)
        : await saveChart(saveChartPayload);

      const savedChartId =
        getSavedChartIdFromResponse(chartResponse) ??
        (isPersistedUpdate ? persistedChartId : undefined);

      if (!chartResponse?.status || savedChartId == null) {
        toast.error(chartResponse?.message || 'Failed to save chart (missing id)');
        return;
      }

      const { chart_name: _omitChartName, chart_id: _omitChartId, ...restNodePayload } =
        selectedNode.data.node.payload || {};

      const prevChartData =
        typeof nodePayload.chart_data === 'object' && nodePayload.chart_data != null
          ? nodePayload.chart_data
          : {};

      // Build the payload structure for saveNodeDetailsApi; chart_id from save-chart follows chart_name
      const updatedNodeData = {
        ...selectedNode.data,
        node: {
          ...selectedNode.data.node,
          payload: {
            ...restNodePayload,
            chart_name: chartNameToSave.trim(),
            chart_id: savedChartId,
            key: 'on-submit',
            params: saveChartPayload.params,
            actions: isPersistedUpdate ? 'update_chart' : 'create_chart',
            is_pandas: selectedNode.data.node.payload?.is_pandas || false,
            is_polars: selectedNode.data.node.payload?.is_polars || false,
            visualization_name: visualization_name,
            chart_data: {
              ...prevChartData,
              params: saveChartPayload.params,
              flow_id,
              visualization_name,
            },
          },
        },
      };

      const savePayload = {
        ...updatedNodeData,
        current_node_id: selectedNode.id,
        flow_id: flow_id,
      };

      const nodeResponse = await saveNodeDetailsApi(saveEndpointConfig, savePayload);

      useFlowStore.getState().updateNodeData(selectedNode.id, nodeResponse);

      toast.success(isPersistedUpdate ? 'Chart updated successfully' : 'Chart saved successfully');
      setChartNameToSave('');
    } catch (error) {
      console.error('Failed to save chart:', error);
      toast.error('Failed to save chart configuration');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <ChartSelectorSkeleton />;
  }
  

  return (
    <div className="flex h-auto flex-col overflow-hidden p-1">
      <div className="flex items-center justify-end gap-10 mb-0 w-full">
        <div className="flex-1 min-w-0">
          <div className="w-full overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="flex items-center gap-2">
              {allCharts.map((component) => {
                const vizName = component.unique_id || component.key || component.name;
                const key = (vizName + '').toLowerCase();

                const renderPreview = () => {
                  if (hasChartTypeThumbnail(vizName)) {
                    return (
                      <ChartTypeThumbnail
                        vizName={vizName}
                        size="md"
                        className="transition-transform duration-200 group-hover:scale-[1.03]"
                      />
                    );
                  }

                  const PreviewIcon = getChartPreviewIcon(key, component.name);
                  if (PreviewIcon) {
                    return (
                      <PreviewIcon className="size-10 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                    );
                  }

                  const Icon = getChartIcon(component.unique_id, component.key);
                  return (
                    <Icon className="size-10 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                  );
                };

                return (
                  <Card
                    key={component.unique_id}
                    onClick={isViewOnly ? undefined : () => handleChartSelect(component)}
                    className={`group flex ${isViewOnly ? 'opacity-100' : 'cursor-pointer'} flex-col items-center justify-center
                     gap-0 px-4 py-1 min-w-auto transition-all duration-200 hover:scale-100
                      ${isViewOnly ? '' : 'hover:border-primary hover:shadow-md'} flex-shrink-0 ${
                      selectedChartId === component.unique_id 
                        ? 'border-primary border-1 bg-primary/5' 
                        : 'border-border'
                    }`}
                  >
                    <div className="flex size-10 items-center justify-center shrink-0 text-primary" aria-hidden>
                      {renderPreview()}
                    </div>
                    <span className="text-center text-[10px] font-medium leading-tight text-foreground">
                      {component.name.replace(/chart$/i, '').trim()}
                    </span>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>

        {showSaveButton && (
          <div className="flex-shrink-0">
            <Button 
              size="sm" 
              onClick={handleSave}
              disabled={isSaving || !selectedChartId}
              className="disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isWorkflowUpdate ? 'Updating...' : 'Saving...'}
                </>
              ) : (
                isWorkflowUpdate ? 'Update Chart' : 'Save Chart'
              )}
            </Button>
          </div>
        )}
      </div>

      <AlertDialog
        open={isSaveChartNameDialogOpen}
        onOpenChange={setIsSaveChartNameDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isWorkflowUpdate ? 'Update Chart' : 'Save Chart'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isWorkflowUpdate
                ? 'Confirm the chart name and update the saved chart configuration on this node.'
                : 'Enter a name for your chart to save it.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="save-chart-name">Chart Name</Label>
            <Input
              id="save-chart-name"
              value={chartNameToSave}
              onChange={(e) => setChartNameToSave(e.target.value)}
              placeholder="e.g., Sales by Region"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && chartNameToSave.trim()) {
                  handleConfirmSaveChartWithName();
                }
              }}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsSaveChartNameDialogOpen(false);
              setChartNameToSave('');
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSaveChartWithName}
              disabled={!chartNameToSave.trim() || isSaving}
            >
              {isSaving ? (isWorkflowUpdate ? 'Updating...' : 'Saving...') : isWorkflowUpdate ? 'Update' : 'Save'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
