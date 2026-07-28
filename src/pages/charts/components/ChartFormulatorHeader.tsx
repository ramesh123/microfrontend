import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Pencil, Save } from 'lucide-react';
import { useNavigate ,useParams} from 'react-router-dom';
import useFlowStore from '@/stores/flowStore';
import { Label } from '@/components/ui/label';
import DropdownV2 from '@/components/ui/DropdownV2';
import { fetchProjectsApi } from '@/controllers/API/index';
import { toast } from 'sonner';
import { useRbacStore } from '@/stores/useRBACStore';
import ShadTooltip from '@/components/common/shadTooltipComponent';

interface ChartFormulatorHeaderProps {
  flowId: string;
  onFlowIdChange: (flowId: string) => void;
  onLoadColumns: (flowId?: string, stmtDate?: string) => void;
  onSaveChart?: () => void;
  isLoading?: boolean;
  isSaving?: boolean;
  isEditMode?: boolean;
  isViewOnly?: boolean;
  editChartId?: string | null;
  /** When in edit mode, if user changes flow ID, call this to switch to create mode (e.g. navigate to create route). */
  onSwitchToCreateMode?: () => void;
  /** Analytics Studio preloads columns — do not auto-select workflow flow_id from the store. */
  disableWorkflowAutoLoad?: boolean;
  embedded?: boolean;
  onEmbeddedClose?: () => void;
}

export function ChartFormulatorHeader({
  flowId,
  onFlowIdChange,
  onLoadColumns,
  onSaveChart,
  isLoading = false,
  isSaving = false,
  isEditMode = false,
  isViewOnly = false,
  editChartId = null,
  onSwitchToCreateMode,
  disableWorkflowAutoLoad = false,
  embedded = false,
  onEmbeddedClose,
}: ChartFormulatorHeaderProps) {
  const navigate = useNavigate();
  const [flowIds, setFlowIds] = useState<Array<{ id: string; name: string; flow_id: string }>>([]);
  const [isLoadingFlowIds, setIsLoadingFlowIds] = useState(false);
  const params = useParams<{ workflowname?: string, sidebar?: string }>();
  const { currentUser } = useRbacStore();
  const currentWorkflow = useFlowStore((state) => state.currentWorkflow);

  // In create mode: if there's a current workflow in the flow store and no flowId selected,
  // auto-select it and load columns once.
  useEffect(() => {
    if (disableWorkflowAutoLoad) return;
    if (!isEditMode && !flowId && currentWorkflow?.flow_id && !isLoadingFlowIds && !isViewOnly) {
      onFlowIdChange(currentWorkflow.flow_id);
      onLoadColumns(currentWorkflow.flow_id);
    }
    // only run when flow id from store changes or edit/view mode changes
  }, [
    disableWorkflowAutoLoad,
    currentWorkflow?.flow_id,
    isEditMode,
    flowId,
    isLoadingFlowIds,
    isViewOnly,
    onFlowIdChange,
    onLoadColumns,
  ]);

  useEffect(() => {
    const fetchFlowIds = async () => {
      setIsLoadingFlowIds(true);
      try {
        const response = await fetchProjectsApi({
          fields: ['id', 'name', 'flow_id']
        }, currentUser?.role);
        
        if (response) {
          // Handle different response structures
          let flowData: any[] = [];
          
          if (Array.isArray(response)) {
            flowData = response;
          } else if (response?.data && Array.isArray(response.data)) {
            flowData = response.data;
          } else if (response && typeof response === 'object') {
            const possibleArrays = Object.values(response).filter((val: any) => Array.isArray(val));
            if (possibleArrays.length > 0) {
              flowData = possibleArrays[0];
            }
          }
          
          // Extract flow_id from the data and format it
          const formattedData = flowData
            .filter((item: any) => item && (item.flow_id || item.id))
            .map((item: any) => {
              const flow_id = item.flow_id || item.id;
              const name = item.name || item.display_name || flow_id || 'Unnamed Flow';
              const id = item.id || flow_id;
              
              return {
                id: String(id || ''),
                name: String(name || ''),
                flow_id: String(flow_id || ''),
              };
            })
            .filter((item) => item.flow_id); // Filter out items without flow_id
          setFlowIds(formattedData);
        } else {
          setFlowIds([]);
        }
      } catch (error) {
        console.error('Failed to load flow IDs:', error);
        toast.error('Failed to load flow IDs');
        setFlowIds([]);
      } finally {
        setIsLoadingFlowIds(false);
      }
    };

    fetchFlowIds();
  }, [currentUser?.role]);
const firstlettercaps = (str: string) => {
    const s = String(str || '').trim();
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }
  // Convert flowIds to DropdownV2 options format
  const dropdownOptions = useMemo(() => {
    return flowIds.map((flow) => ({
      // show labels with first-letter capitalized
      label: firstlettercaps(String(flow.name || flow.flow_id || flow.id)),
      value: flow.flow_id || flow.id,
    }));
  }, [flowIds]);

  return (
    <header className="flex h-9 items-center justify-between border-b bg-background">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            if (embedded && onEmbeddedClose) {
              onEmbeddedClose();
              return;
            }
            const workflowName = params.workflowname;
            if (workflowName) {
              const workflow =
                currentWorkflow &&
                (String(currentWorkflow.id) === String(workflowName) ||
                  String(currentWorkflow.flow_id) === String(workflowName) ||
                  String(currentWorkflow.workflow_id) === String(workflowName))
                  ? currentWorkflow
                  : undefined;
              navigate(`/reconciliation/operations/${workflowName}?tab=analytics&view=recontab`, {
                state: workflow ? { workflow, viewMode: 'recontab' } : undefined,
              });
            } else {
              navigate(-1);
            }
          }}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-sm font-semibold">{embedded ? 'Edit Chart' : 'Chart Formulator'}</h1>
      </div>

      <div className="flex items-center gap-2">
        {!disableWorkflowAutoLoad && (
          <div className="flex items-center gap-2">
            <Label htmlFor="flow-id" className="text-sm text-muted-foreground">
              Flow ID:
            </Label>
            <div className="w-50 h-8 ">
              <DropdownV2
                Disabled={isLoadingFlowIds || isLoading || isViewOnly}
                size="small"
                options={dropdownOptions}
                value={flowId}
                onChange={(value) => {
                  onFlowIdChange(value);
                  // Automatically call get_columns API when flow ID is selected
                  if (value) {
                    onLoadColumns(value);
                  }
                  // In edit mode, changing flow ID switches to create mode
                  if (isEditMode && onSwitchToCreateMode) {
                    onSwitchToCreateMode();
                  }
                }}
                placeholder={
                  isLoadingFlowIds
                    ? 'Loading...'
                    : isLoading
                    ? 'Loading columns...'
                    : (!isEditMode && currentWorkflow?.name) // create mode only
                    ? String(currentWorkflow.name)
                    : 'Select flow ID'
                }
                searchable={true}
                ShowIcon={true}
              />
            </div>
          </div>
        )}

        {onSaveChart && (
          <Button
            variant="outline"
            size="sm"
            onClick={onSaveChart}
            disabled={isSaving || isLoading || isViewOnly}
            className="flex items-center gap-2 !h-8 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            {isEditMode ? (isSaving ? 'Saving...' : 'Update Chart Name') : (isSaving ? 'Saving...' : 'Save Chart')}
          </Button>
        )}

        {isViewOnly && (
          <ShadTooltip content="Edit Chart" side="left">
          <Button
            className="!h-8 !px-2"
            variant="default"
            size="sm"
            onClick={() => {
              // Prefer full reconciliation edit route when workflow id and chart id available
              if (params.workflowname && editChartId) {
                navigate(`/reconciliation/operations/${params.workflowname}/charts/${editChartId}/edit`);
                return;
              }

              // Fallback: if we only have a chart id (editChartId), navigate to formulator edit
              if (editChartId) {
                navigate(`/charts/formulator/edit/${editChartId}`);
                return;
              }

              // Last resort: fall back to using workflowname (existing behavior)
              navigate(`/charts/formulator/edit/${params.workflowname || ''}`);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          </ShadTooltip>
        )}
      </div>
    </header>
  );
}

