import { memo, useState, useCallback, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Handle, Position, NodeProps, useReactFlow, useUpdateNodeInternals } from '@xyflow/react';
import { 
  Database, Webhook, FileText, Bot, HelpCircle, Trash2, Play, Pencil, MoreHorizontal, 
  ChevronDown, ChevronUp, Clock, CheckCircle, XCircle, Loader, 
  Copy,
  Expand,
  Minimize,
  Maximize,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import NodeIcon from './components/NodeIcon';
import useFlowStore from '@/stores/flowStore';
import { AlgoNodeData } from '@/types/flow';
import { useNodeStore } from '@/stores/nodeStore';
import { useSheetStore } from '@/stores/sheetStore';
import { saveNodeDetailsApi } from '@/controllers/API';
import ShadTooltip from '@/components/common/shadTooltipComponent';
import { toast } from 'sonner';
import DeleteConfirmationModal from '@/modals/deleteConfirmationModal';
import { buildReconciliationCarryOverExecutePayload, createNodeOutputWithUniqueId, getNodeOutputData, hydrateNodeOutputAfterExecution } from '@/utils/nodeDataUtils';
import { isSourceTypeForVirtualDb } from '@/utils/virtualDatasetPayload';
import { normalizeWorkflowNodeId } from '../../utils/workflowNodeId';
import {
  getUpstreamDisplayNameForPayload,
  shouldBuildKeyedDataframeForExcelWrite,
} from '@/utils/transformTemplate';

const SubflowEmbeddedViewer = lazy(() => import('./components/SubflowEmbeddedViewer'));

interface GenericNodeProps extends NodeProps<any> {
  mode?: "view" | "edit";
}

/** Per-type config for create-dataset: dataset_type, group, klass_name, modules, icon. */
function getDatasetTypeConfig(nodeData: any): {
  dataset_type: string;
  group: string;
  klass_name: string;
  modules: string;
  icon: string;
  defaultGetData: Record<string, unknown>;
} {
  const nodeId = (nodeData?.node_id ?? '').toLowerCase();
  const group = (nodeData?.group ?? '').toLowerCase();
  if (group === 'databases' || /postgres|mysql|mssql|oracle|snowflake|redshift|s3|dynamodb|mongodb|elasticsearch|trino|clickhouse|duckdb|singlestore|cockroachdb/i.test(nodeId))
    return { dataset_type: 'Databases', group: 'Databases', klass_name: 'PostgresqlConnector', modules: 'connectors.databases.postgresql', icon: nodeData?.icon ?? 'postgres-sql', defaultGetData: { klass: 'postgresql-actions', method: 'post', module: 'databases' } };
  if (group === 'files' || /csv|parquet|json|excel|s3|sftp|blob/i.test(nodeId))
    return { dataset_type: 'Files', group: 'Files', klass_name: 'FileConnector', modules: 'connectors.files', icon: nodeData?.icon ?? 'file-text', defaultGetData: { klass: 'file-actions', method: 'post', module: 'files' } };
  if (nodeData?.isDataset || /dataset/i.test(nodeId))
    return { dataset_type: 'DataSet', group: 'DataSet', klass_name: 'DatasetConnector', modules: 'connectors.dataset', icon: nodeData?.icon ?? 'database', defaultGetData: { klass: 'dataset-actions', method: 'post', module: 'dataset' } };
  if (/api|webhook|http/i.test(nodeId))
    return { dataset_type: 'API', group: 'API', klass_name: 'ApiConnector', modules: 'connectors.api', icon: nodeData?.icon ?? 'globe', defaultGetData: { klass: 'api-actions', method: 'post', module: 'api' } };
  if (nodeId === 'pipeline_reference')
    return { dataset_type: 'Pipeline', group: 'Pipeline', klass_name: 'PipelineConnector', modules: 'connectors.pipeline', icon: nodeData?.icon ?? 'Workflow', defaultGetData: { klass: 'pipeline-actions', method: 'post', module: 'pipeline' } };
  return { dataset_type: 'Databases', group: group || 'Databases', klass_name: 'PostgresqlConnector', modules: 'connectors.databases.postgresql', icon: nodeData?.icon ?? 'postgres-sql', defaultGetData: { klass: 'postgresql-actions', method: 'post', module: 'databases' } };
}

/** One element for the node[] array: unique JSON per virtual DB type with payload + type-specific fields. */
interface NodeArrayItem {
  payload: Record<string, unknown>;
  node_id: string;
  dataset_type: string;
  group: string;
  display_name: string;
  klass_name: string;
  modules: string;
  icon: string;
  is_dataset: boolean;
}

function buildNodeArrayItem(nodeData: any, payloadWithoutOutput: Record<string, unknown>): NodeArrayItem {
  const config = getDatasetTypeConfig(nodeData);
  const displayName = nodeData?.display_name ?? nodeData?.name ?? 'Virtual Dataset';
  const nodeId = nodeData?.node_id ?? nodeData?.node?.node_id ?? 'virtual-db';
  const existingNode = nodeData?.node ?? {};
  return {
    payload: payloadWithoutOutput,
    node_id: nodeId,
    dataset_type: config.dataset_type,
    group: config.group,
    display_name: displayName,
    klass_name: existingNode.klass_name ?? config.klass_name,
    modules: existingNode.modules ?? config.modules,
    icon: config.icon,
    is_dataset: true,
  };
}

/** Remove output key from payload so it is not sent to the API. */
function stripOutput(obj: Record<string, unknown>): Record<string, unknown> {
  if (obj === null || typeof obj !== 'object') return obj as Record<string, unknown>;
  const { output, ...rest } = obj;
  return rest;
}

/** Build create-dataset payload. Only the node key is sent; all other keys are omitted. */
function buildCreateDatasetPayload(_nodeData: any, nodeArray: NodeArrayItem[]): Record<string, unknown> {
  return { node: nodeArray };
}

/** Build node array for non-pipeline: single item with unique JSON for this virtual DB type. */
function buildNodeArrayForNonPipeline(nodeData: any): NodeArrayItem[] {
  const displayName = nodeData?.display_name ?? nodeData?.name ?? 'Virtual Dataset';
  const payload = { ...(nodeData?.node?.payload ?? {}), name: displayName };
  const payloadClean = stripOutput(payload);
  return [buildNodeArrayItem(nodeData, payloadClean)];
}

/** Build node array for pipeline: one entry from canvas payload (no flow-builder fetch). */
function buildNodeArrayForPipeline(nodeData: any): NodeArrayItem[] {
  const workflowId = nodeData?.pipeline_workflow_id ?? nodeData?.node?.payload?.pipeline_workflow_id ?? '';
  const selectedIds: string[] =
    nodeData?.node?.payload?.selectedWorkflowNodeIds ??
    nodeData?.payload?.selectedWorkflowNodeIds ??
    nodeData?.selectedWorkflowNodeIds ??
    [];
  if (!workflowId || selectedIds.length === 0) return [];
  const displayName = nodeData?.display_name ?? nodeData?.name ?? 'Virtual Dataset';
  const payload = {
    ...(nodeData?.node?.payload ?? {}),
    name: displayName,
    pipeline_workflow_id: workflowId,
    selectedWorkflowNodeIds: selectedIds,
  };
  const payloadClean = stripOutput(payload);
  return [buildNodeArrayItem(nodeData, payloadClean)];
}

/** Build node array for a single node (pipeline or non-pipeline). */
function getNodeArrayForNode(nodeData: any): NodeArrayItem[] {
  const nodeId = (nodeData?.node_id ?? '').toLowerCase();
  if (nodeId === 'pipeline_reference') return buildNodeArrayForPipeline(nodeData);
  return buildNodeArrayForNonPipeline(nodeData);
}

// Memoized Icon component for performance
const MemoizedNodeIcon = memo(NodeIcon);

// Memoized Status Badge for performance
const StatusBadge = memo(({ status }: { status?: string }) => {
  const currentStatus = status || 'idle';
  const visuals = {
    success: { Icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Success' },
    error: { Icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100', label: 'Error' },
    running: { Icon: Loader, color: 'text-purple-600', bgColor: 'bg-purple-100', label: 'Running' },
    idle: { Icon: Clock, color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Idle' },
  };
  const { Icon, color, bgColor, label } = visuals[currentStatus];
  return (
    <Badge variant="outline" className={cn("gap-1.5 pl-2 pr-2.5 w-full justify-start", bgColor, color)}>
      <Icon className={cn("h-3.5 w-3.5", currentStatus === 'running' && 'animate-spin')} />
      <span className="font-medium">{label}</span>
    </Badge>
  );
});

StatusBadge.displayName = 'StatusBadge';

function GenericNodeInner(props: GenericNodeProps) {
  const { data, id, selected, mode } = props;
  const [searchParams] = useSearchParams();
  const { deleteElements, getEdges } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const [isHovered, setIsHovered] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const setIsOpen = useSheetStore((state) => state.setIsOpen);

  const updateNodeDataInStore = useFlowStore((state) => state.updateNodeData);
  const currentWorkflow = useFlowStore((state) => state.currentWorkflow);

  /** Match SideBar / FlowPage: URL flag or workflow saved as Virtual DB (not only query param). */
  const virtualdbUrlFlag = searchParams.get('virtualdb');
  const virtualDbMode =
    virtualdbUrlFlag === '1' || Boolean(currentWorkflow?.virtualdb_mode);
  // Do not gate on `virtualDbEnabled` or the button vanishes after disable when `virtualDbMode` is false.
  const isSourceForVdb = isSourceTypeForVirtualDb(data);
  const showVirtualDbButton = virtualDbMode && isSourceForVdb;

  const isViewMode = mode === "view";
  const { display_name, icon, status, executionTime, outputRows, isExpanded, groupColor } = data;
  const currentStatus = status || 'idle';
  const isPipelineNode = data.node_id === 'pipeline_reference';
  const pipelineWorkflowId = data.pipeline_workflow_id ?? data.node?.payload?.pipeline_workflow_id;
  const isSubflowNode = data.node_id === 'subflow_view';
  const subflowConfig = data.node?.payload;
  const subflowFlowId = subflowConfig?.selectedWorkflowFlowId ?? subflowConfig?.selectedWorkflowId;
    // Memoize the icon render to prevent re-renders (no icon-well on canvas)
  const renderNodeIcon = useCallback(() => {
    let imageUrl: string | null = null;
    // Only use custom image URL for dataset nodes that have a custom uploaded icon
    if (data.isDataset || data.node_id?.toLowerCase().includes('dataset')) {
      const fileName = data?.node?.payload?.file_name || data?.payload?.file_name;
      const uniqueId = data?.node?.payload?.icon_unique_id || data?.payload?.icon_unique_id || data?.node?.payload?.unique_id || data?.payload?.unique_id;
      imageUrl = fileName && uniqueId ? `/user-uploads/${uniqueId}/${fileName}` : null;
    }
    
    return (
      <MemoizedNodeIcon icon={icon} className="dark:!text-blue-600" imageUrl={imageUrl} />
    );
  }, [icon, data]);

  /** Must update Zustand — ReactFlow is controlled via `nodes={currentWorkflow.data.nodes}`; `setNodes()` alone is overwritten on the next render. */
  const updateNodeData = useCallback(
    (newData: Partial<AlgoNodeData>) => {
      updateNodeDataInStore(id, newData);
    },
    [id, updateNodeDataInStore]
  );
  
  const handleDelete = useCallback(() => {
    if (isViewMode) return;
    setIsDeleteModalOpen(true);
  }, [isViewMode]);

  const handleDeleteConfirm = useCallback(() => {
    deleteElements({ nodes: [{ id }] });
    setIsDeleteModalOpen(false);
  }, [id, deleteElements]);

  // Simulate execution flow
  const onClickExecute = useCallback(async (_event: React.MouseEvent, node: AlgoNodeData) => {
    if (isViewMode) return;
    const nodes = useFlowStore.getState().currentWorkflow?.data?.nodes;
    const currentWorkflow = useFlowStore.getState().currentWorkflow;
    const flow_id = currentWorkflow?.flow_id || '';
    const targetId: any = node?.current_node_id ?? node?.id;
    const nodeData: any = nodes?.find((n: any) => n.id === targetId);

    // return;

    if (!nodeData?.data?.saved_node) {
      toast.info("Please setup the Configuration and Save")
    }

    if (nodeData?.data?.saved_node) {
      let payload: any;
      const basePayload = nodeData.data.node.payload;

      // Special payload handling for the merge node
      if (nodeData.data.node_id === 'merge') {
        const sourceName = basePayload.source_name;
        const targetName = basePayload.target_name;

        // Find the full source and target nodes from the available sourceNodes
        const sourceNode: any = nodes?.find((n: any) => n.id === sourceName);
        const targetNode: any = nodes?.find((n: any) => n.id === targetName);

        // Validate that both source and target nodes have been executed and have output data or unique_id
        const sourceHasOutput = sourceNode?.data?.node?.output?.unique_id || sourceNode?.data?.node?.output?.data;
        const targetHasOutput = targetNode?.data?.node?.output?.unique_id || targetNode?.data?.node?.output?.data;
        
        if (!sourceHasOutput || !targetHasOutput) {
          toast.error("Please execute the source and target nodes first to provide data for the merge.");
          return; // Stop execution if data is missing
        }

        // Fetch actual data if using unique_id
        const sourceData = await getNodeOutputData(sourceNode, flow_id);
        const targetData = await getNodeOutputData(targetNode, flow_id);

        // Construct the specific payload for the merge action
        payload = {
          ...basePayload,
          response_type: "json",
          source_data: JSON.stringify(sourceData),
          target_data: JSON.stringify(targetData),
        };
        // Ensure the old dataframe key is not sent to avoid confusion
        delete payload.dataframe;

      }
      else if (nodeData.data.node_id === 'concat') {
        payload = {
          ...basePayload,
          response_type: "json",
        };
        delete payload.dataframe;
      }

      else if (nodeData?.data?.node_id === "nway_validation") {
        payload = {
          ...basePayload,
          response_type: "json",
        };
        delete payload.dataframe;
      }       else if (nodeData?.data?.node_id === "multisource_validation") {
        payload = {
          ...basePayload,
          response_type: "json",
        };
        delete payload.dataframe;
      }
      else if (
        ["report", "final_report"].includes(normalizeWorkflowNodeId(nodeData?.data?.node_id))
      ) {
        payload = {
          ...basePayload,
          response_type: "json",
        };
        delete payload.dataframe;
      } else if (nodeData?.data?.node_id === "reporting") {
        // For reporting nodes, use the dataframe from the node's payload (already constructed correctly)
        // Don't reconstruct it from predecessor nodes as it's already properly formatted
        payload = {
          ...basePayload,
          response_type: "json",
        };
        // Keep the dataframe from basePayload - it's already correctly constructed in the reporting form
      } else if (nodeData?.data?.node_id === "reconciliation_carryover") {
        const directUpstream = useFlowStore
          .getState()
          .getUpstreamNodes(String(targetId));
        const carryOverResult = await buildReconciliationCarryOverExecutePayload(
          basePayload,
          flow_id,
          {
            nodes: nodes ?? [],
            directUpstreamNodes: directUpstream,
            allUpstreamNodes: useFlowStore.getState().getAllUpstreamNodes(String(targetId)),
          },
        );

        if (carryOverResult.ok === false) {
          toast.error(carryOverResult.error);
          return;
        }

        payload = carryOverResult.payload;
      }
       else {
        // Default logic for other nodes.
        // Check for predecessor nodes to pass their data as 'dataframe'.
        const incomingEdges = getEdges().filter(edge => edge.target === targetId);
        const predecessorNodeIds = incomingEdges.map(edge => edge.source);

        if (predecessorNodeIds.length > 0) {
            const predecessorNodes = predecessorNodeIds
              .map((pid) => nodes?.find((n: any) => n.id === pid))
              .filter(Boolean) as any[];

            if (
              shouldBuildKeyedDataframeForExcelWrite(
                nodeData.data.node_id,
                basePayload?.mode,
                predecessorNodes.length
              )
            ) {
              const dataframeKeyed: Record<string, string> = {};
              for (const predecessorNode of predecessorNodes) {
                const label = getUpstreamDisplayNameForPayload(predecessorNode);
                const sourceData = await getNodeOutputData(predecessorNode, flow_id);
                dataframeKeyed[label] = JSON.stringify(sourceData ?? []);
              }
              payload = {
                ...basePayload,
                response_type: "json",
                dataframe: dataframeKeyed,
              };
            } else {
            const predecessorNode = predecessorNodes[0];
            if (predecessorNode) {
                const sourceData = await getNodeOutputData(predecessorNode, flow_id);
                payload = {
                    ...basePayload,
                    response_type: "json",
                    dataframe: JSON.stringify(sourceData),
                };
                // CSV write + upstream: backend needs upstream dataset id
                if (
                  nodeData.data.node_id === 'csv' &&
                  String(basePayload?.mode ?? '').toLowerCase() === 'write'
                ) {
                  const upstreamUid = predecessorNode?.data?.node?.output?.unique_id;
                  if (upstreamUid) {
                    payload.previous_unique_id = upstreamUid;
                  }
                }
            } else {
                // Should not happen in a valid flow.
                payload = { ...basePayload, response_type: "json" };
                delete payload.dataframe;
            }
            }
        } else {
            // No predecessors, so this is a source node. Do not add 'dataframe'.
            payload = {
                ...basePayload,
                response_type: "json",
            };
            delete payload.dataframe;
        }
      }
      let endPoint: any = nodeData?.data?.node?.get_data || nodeData?.data?.node?.save_node;
      const isGetDataEndpoint = !!nodeData?.data?.node?.get_data;
      try {
        //wraping inside payload and adding node_id and flow_id inside the payload
        const requestBody = isGetDataEndpoint
          ? { payload: { ...payload, node_id: targetId, flow_id } }
          : { ...payload, node_id: targetId, flow_id };
        const response = await saveNodeDetailsApi(endPoint, requestBody);
        if (response.status) {
          const nodeOutput = await hydrateNodeOutputAfterExecution(
            flow_id,
            targetId,
            response
          );

          // Create a new node data object for immutability
          // Merge response data (which might contain updated payload/template) with existing node data
          const newNodeData = {
            ...nodeData.data,
            ...response,
            node: {
              ...(response.node || nodeData.data.node),
              output: nodeOutput,
            },
          };

          console.log('Node Execution - Updating node:', {
            nodeId: targetId,
            nodeName: newNodeData.display_name,
            hasColumns: !!nodeOutput.columns,
            columns: nodeOutput.columns,
            dataLength: nodeOutput.data?.length,
            firstRow: nodeOutput.data?.[0]
          });

          // Update only the specific node's data in the store
          updateNodeDataInStore(targetId, newNodeData);

          toast.success("Node executed successfully.");
        } else {
          // Handle cases where the API returns a non-success status
          // toast.error(response.message || "Failed to execute node.");
        }
      } catch (error) {
        toast.error("An error occurred. Please check if the source node has been executed.");
      }
    }
  }, [isViewMode, updateNodeDataInStore, getEdges]);

    const onNodeClick = useCallback((_event: React.MouseEvent, node: AlgoNodeData) => {
      let targetId: any = node?.current_node_id ?? node?.id;
      useFlowStore.getState().getNode(targetId);
      setIsOpen(true);
    }, [setIsOpen]);

  const onClickEnableVirtualDb = useCallback(() => {
    if (isViewMode) return;
    const currentlyOn = data?.virtualDbEnabled === true;
    const enabling = !currentlyOn;
    updateNodeData({ virtualDbEnabled: enabling });
    // Do not call onNodesChange(select) here: a second applyNodeChanges right after updateNodeData
    // can run with a stale nodes snapshot and drop the virtualDbEnabled merge.
  }, [data?.virtualDbEnabled, isViewMode, updateNodeData]);
  
  const toggleExpand = useCallback(() => {
    const newExpandedState = !isExpanded;
    updateNodeData({ isExpanded: newExpandedState });
    setTimeout(() => updateNodeInternals(id), 50);
  }, [isExpanded, id, updateNodeInternals, updateNodeData]);

  const bodyStyle = {
    borderColor: currentStatus === 'running' ? 'transparent' : groupColor,
    boxShadow: selected ? `0 0 12px ${groupColor}` : 'none',
  };

  // Check if node should be animated
  const shouldAnimate = data?.animated === true;

  // Improved render strategy: ensure icon wrapper is stable during animation
  const iconWrapperStyle = shouldAnimate
    ? {
        backfaceVisibility: 'hidden' as const,
        WebkitBackfaceVisibility: 'hidden' as const,
      }
    : undefined;

  return (
    <>
      <div
        className={cn(
          "algo-node",
          isExpanded && (isSubflowNode && subflowFlowId ? "expanded-subflow" : "expanded"),
          shouldAnimate && "node-pop-animation"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {(isHovered || selected) && (
          <div className="algo-node-actions">
            <ShadTooltip content="Execute">
              <Button variant="ghost" size="xs" className="algo-node-action-button disabled:cursor-not-allowed" onClick={(event ) => onClickExecute(event, data)} title="Execute" disabled={isViewMode}><Play className="h-3 w-3 text-purple-500" /></Button>
            </ShadTooltip>
            {showVirtualDbButton && (
              <ShadTooltip content={data?.virtualDbEnabled ? 'DB selected (click to deselect)' : 'Enable as Virtual DB'}>
                <Button
                  variant="ghost"
                  size="xs"
                  className="algo-node-action-button disabled:cursor-not-allowed"
                  onClick={(e) => { e.stopPropagation(); onClickEnableVirtualDb(); }}
                  title={data?.virtualDbEnabled ? 'DB selected (click to deselect)' : 'Enable as Virtual DB'}
                  disabled={isViewMode}
                >
                  <Database className={cn("h-3 w-3", data?.virtualDbEnabled ? "text-green-600" : "text-primary")} />
                </Button>
              </ShadTooltip>
            )}
            <ShadTooltip content="Edit">
              <Button variant="ghost" size="xs" className="algo-node-action-button disabled:cursor-not-allowed" onClick={(event ) => onNodeClick(event, data)} title="Edit" disabled={isViewMode}><Pencil className="h-3 w-3 text-blue-500" /></Button>
            </ShadTooltip>
            <ShadTooltip content="Delete">
              <Button variant="ghost" size="xs" className="algo-node-action-button text-red-500 hover:text-red-600 disabled:cursor-not-allowed" onClick={handleDelete} title="Delete" disabled={isViewMode}><Trash2 className="h-3 w-3 text-red-500" /></Button>
            </ShadTooltip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="xs" className="algo-node-action-button" title="More"><MoreHorizontal className="h-3 w-3 text-purple-500" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={toggleExpand}>
                  {isExpanded ? <Minimize className="mr-2 h-4 w-4" /> : <Maximize className="mr-2 h-4 w-4" />}
                  <span>{isExpanded ? 'Minimize' : 'Maximize'}</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Copy className="mr-2 h-4 w-4" />
                  <span>Duplicate</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        <div 
          className={cn("algo-node-body", selected && "selected", currentStatus === 'running' && 'running')}
          style={bodyStyle}
          onClick={(event) => onNodeClick(event, data)}
        >
          {!isExpanded ? (
            <div className="algo-node-icon-wrapper" style={iconWrapperStyle}>
              {renderNodeIcon()}
            </div>
          ) : isPipelineNode && pipelineWorkflowId ? (
            <div className="w-full h-full flex flex-col overflow-hidden rounded-xl" onClick={(e) => e.stopPropagation()}>
              <Suspense fallback={
                <div className="flex items-center justify-center gap-2 h-[250px]">
                  <Loader className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-[10px] text-muted-foreground">Loading...</span>
                </div>
              }>
                <SubflowEmbeddedViewer
                  workflowFlowId={pipelineWorkflowId}
                  workflowLabel={display_name}
                  loadingLabel="Loading workflow..."
                />
              </Suspense>
            </div>
          ) : isSubflowNode && subflowFlowId ? (
            <div className="w-full h-full flex flex-col overflow-hidden rounded-xl" onClick={(e) => e.stopPropagation()}>
              <Suspense fallback={
                <div className="flex items-center justify-center gap-2 h-[250px]">
                  <Loader className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-[10px] text-muted-foreground">Loading...</span>
                </div>
              }>
                <SubflowEmbeddedViewer
                  workflowFlowId={subflowFlowId}
                  workflowLabel={subflowConfig?.selectedWorkflowLabel ?? undefined}
                />
              </Suspense>
            </div>
          ) : (
            <div className="p-3 w-full flex flex-col gap-2 text-left">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg">
                  {renderNodeIcon()}
                </div>
                <h3 className="font-bold text-foreground flex-grow truncate">{display_name}</h3>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{data?.description}</p>
              
              <div className="algo-node-details !p-0 !border-t-0 !bg-transparent">
                <div className="w-full space-y-2 pt-2 border-t mt-2">
                    <div className="algo-node-stat">
                      <span>Status</span>
                      <StatusBadge status={currentStatus} />
                    </div>
                    {executionTime && (
                      <div className="algo-node-stat">
                        <span>Time</span>
                        <span className="font-mono">{executionTime}</span>
                      </div>
                    )}
                    {outputRows !== undefined && (
                      <div className="algo-node-stat">
                        <span>Rows</span>
                        <span className="font-mono">{outputRows.toLocaleString()}</span>
                      </div>
                    )}
                </div>
              </div>
            </div>
          )}
          {/* <div 
            className="algo-status-dot"
            style={{ backgroundColor: statusColors[currentStatus] }}
          ></div> */}
          <ShadTooltip content="Target">
            <Handle type="target" position={Position.Left} className="algo-handle react-flow__handle-target" />
          </ShadTooltip>
          <ShadTooltip content="Source">
            <Handle type="source" position={Position.Right} className="algo-handle react-flow__handle-source" />
          </ShadTooltip>
        </div>
        
        <div className="algo-node-label">{display_name}</div>
      </div>

      <DeleteConfirmationModal 
        open={isDeleteModalOpen}
        setOpen={setIsDeleteModalOpen}
        description={`Are you sure you want to delete this node ${display_name} ?`}
        note="This action cannot be undone."
        onConfirm={handleDeleteConfirm} children={undefined} />
    </>
  );
}

GenericNodeInner.displayName = 'GenericNode';

// Custom comparison function for memo to optimize re-renders // Only re-render if essential props change
const arePropsEqual = (prevProps: GenericNodeProps, nextProps: GenericNodeProps) => {
  if (prevProps.selected !== nextProps.selected) return false;    // Always re-render if selected state changes
  if (prevProps.mode !== nextProps.mode) return false;     // Always re-render if mode changes

  const prevData = prevProps.data;     // Compare critical data properties that affect rendering

  const nextData = nextProps.data;

  return (
    prevData.display_name === nextData.display_name &&
    prevData.icon === nextData.icon &&
    prevData.status === nextData.status &&
    prevData.isExpanded === nextData.isExpanded &&
    prevData.executionTime === nextData.executionTime &&
    prevData.outputRows === nextData.outputRows &&
    prevData.groupColor === nextData.groupColor &&
    prevData.description === nextData.description &&
    prevData.saved_node === nextData.saved_node &&
    prevData.pipeline_workflow_id === nextData.pipeline_workflow_id &&
    prevData.node_id === nextData.node_id &&
    prevData.group === nextData.group &&
    prevData.virtualDbEnabled === nextData.virtualDbEnabled &&
   (prevData.node?.payload?.selectedWorkflowFlowId ?? prevData.node?.payload?.selectedWorkflowId) ===
   (nextData.node?.payload?.selectedWorkflowFlowId ?? nextData.node?.payload?.selectedWorkflowId)
  );
};

export default memo(GenericNodeInner, arePropsEqual);

