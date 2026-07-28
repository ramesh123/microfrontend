import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  useReactFlow,
  type NodeTypes,
  type NodeProps,
  type ReactFlowInstance,
} from '@xyflow/react';
import { Loader2, AlertCircle, Workflow, Check, XCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getWorkflowByIdApi } from '@/controllers/API';
import NodeIcon from '../NodeIcon';
import { ZoomSlider } from '@/components/zoom-slider';

const MiniNode = React.memo(({ data, selected }: NodeProps<any>) => {
  const { display_name, icon } = data;
  return (
    <div className="flex flex-col items-center" style={{ width: 80 }}>
      <div
        className={`relative bg-card border rounded-xl shadow-sm flex items-center justify-center transition-shadow ${
          selected
            ? 'ring-2 ring-primary ring-offset-2 ring-offset-background border-primary shadow-md'
            : 'border-gray-300 dark:border-white'
        }`}
        style={{ width: 52, height: 52 }}
      >
        <NodeIcon icon={icon} className="dark:!text-blue-600" />
        <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-gray-400 !border-gray-300" />
        <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-gray-400 !border-gray-300" />
      </div>
      <span className="text-[9px] font-medium text-foreground/70 text-center leading-tight mt-1 w-full truncate">
        {display_name}
      </span>
    </div>
  );
});
MiniNode.displayName = 'MiniNode';

const miniNodeTypes: NodeTypes = { genericNode: MiniNode };

const FIT_VIEW_OPTIONS = { minZoom: 0.2, maxZoom: 1 };

// Popover shown on node click: "Mark node as selected" / "Deselect the marked node"
interface NodePopoverInfo {
  nodeId: string;
  nodeLabel: string;
  x: number;
  y: number;
}

function NodeSelectPopover({
  info,
  isSelected,
  onMarkSelected,
  onDeselect,
  onClose,
}: {
  info: NodePopoverInfo;
  isSelected: boolean;
  onMarkSelected: (nodeId: string) => void;
  onDeselect: (nodeId: string) => void;
  onClose: () => void;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', handler);
    window.addEventListener('keydown', escHandler);
    return () => {
      window.removeEventListener('mousedown', handler);
      window.removeEventListener('keydown', escHandler);
    };
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      className="absolute z-50 animate-in fade-in zoom-in-95 duration-150"
      style={{ left: info.x, top: info.y }}
    >
      <div className="w-52 rounded-lg border bg-popover p-2 shadow-lg">
        <p className="mb-2 truncate text-xs font-semibold text-foreground px-1">{info.nodeLabel}</p>
        <div className="flex flex-col gap-1">
          {isSelected ? (
            <button
              type="button"
              onClick={() => { onDeselect(info.nodeId); onClose(); }}
              className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors bg-primary/10 text-primary hover:bg-primary/20"
            >
              <XCircle className="h-3.5 w-3.5" />
              Unmark the Data Object from VirtualDB
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { onMarkSelected(info.nodeId); onClose(); }}
              className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted text-foreground/80"
            >
              <Check className="h-3.5 w-3.5" />
              Mark for Data Object to VirtualDB
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface SubflowEmbeddedViewerProps {
  workflowFlowId: string;
  workflowLabel?: string;
  /** Loading message. Default "Loading subflow...". Use "Loading workflow..." for pipeline nodes. */
  loadingLabel?: string;
  /** Optional height for the viewer (e.g. "70vh", "600px"). When set, canvas uses this for full-screen layout. */
  embeddedHeight?: string | number;
  /** Selected node ids from the workflow (for pipeline -> Virtual DB). When set, these nodes are shown as selected. */
  selectedWorkflowNodeIds?: string[];
  /** Called when user selects/deselects nodes in the workflow. Pass selected node ids to persist (e.g. for Virtual DB). */
  onSelectedNodesChange?: (nodeIds: string[]) => void;
}

function SubflowEmbeddedViewerInner({
  workflowFlowId,
  workflowLabel,
  loadingLabel = 'Loading subflow...',
  embeddedHeight,
  selectedWorkflowNodeIds = [],
  onSelectedNodesChange,
}: SubflowEmbeddedViewerProps) {
  const containerHeight = embeddedHeight ?? 260;
  const canvasHeight = typeof containerHeight === 'number' ? containerHeight - 25 : `calc(${containerHeight} - 25px)`;
  const { data: workflowData, isLoading, isError } = useQuery({
    queryKey: ['subflow-embedded-preview', workflowFlowId],
    queryFn: () => getWorkflowByIdApi({ id: workflowFlowId }),
    enabled: !!workflowFlowId,
    staleTime: 1000 * 60 * 5,
  });

  const nodesFromApi = useMemo(() => workflowData?.data?.nodes ?? [], [workflowData]);
  const edges = useMemo(() => workflowData?.data?.edges ?? [], [workflowData]);
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);
  const flowContainerRef = useRef<HTMLDivElement | null>(null);
  const [popover, setPopover] = useState<NodePopoverInfo | null>(null);

  const nodes = useMemo(
    () =>
      nodesFromApi.map((n: any) => ({
        ...n,
        selected: selectedWorkflowNodeIds.includes(n.id),
      })),
    [nodesFromApi, selectedWorkflowNodeIds]
  );

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: { id: string; data?: any }) => {
      if (!onSelectedNodesChange) return;
      const container = flowContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const label = node.data?.display_name ?? node.data?.name ?? node.id;
      setPopover({
        nodeId: node.id,
        nodeLabel: label,
        x: event.clientX - rect.left + 8,
        y: event.clientY - rect.top + 8,
      });
    },
    [onSelectedNodesChange]
  );

  const onPaneClick = useCallback(() => {
    setPopover(null);
  }, []);

  const onMarkSelected = useCallback(
    (nodeId: string) => {
      if (!onSelectedNodesChange || selectedWorkflowNodeIds.includes(nodeId)) return;
      onSelectedNodesChange([...selectedWorkflowNodeIds, nodeId]);
    },
    [onSelectedNodesChange, selectedWorkflowNodeIds]
  );

  const onDeselectNode = useCallback(
    (nodeId: string) => {
      if (!onSelectedNodesChange) return;
      onSelectedNodesChange(selectedWorkflowNodeIds.filter((id) => id !== nodeId));
    },
    [onSelectedNodesChange, selectedWorkflowNodeIds]
  );

  console.log('[SubflowEmbeddedViewer] workflowFlowId:', workflowFlowId);
  console.log('[SubflowEmbeddedViewer] nodes count:', nodesFromApi.length, 'edges count:', edges.length);
  if (nodesFromApi.length > 0) {
    console.log('[SubflowEmbeddedViewer] node positions:', nodesFromApi.map((n: any) => ({ id: n.id, x: n.position?.x, y: n.position?.y })));
  }

  const onInit = useCallback((instance: ReactFlowInstance) => {
    console.log('[SubflowEmbeddedViewer] onInit fired');
    rfInstanceRef.current = instance;
    setTimeout(() => {
      instance.fitView({ padding: 0.3 });
      console.log('[SubflowEmbeddedViewer] fitView called after delay');
    }, 200);
  }, []);

  useEffect(() => {
    if (rfInstanceRef.current && nodesFromApi.length > 0) {
      const timer = setTimeout(() => {
        rfInstanceRef.current?.fitView({ padding: 0.3 });
        console.log('[SubflowEmbeddedViewer] fitView re-triggered after nodes loaded');
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [nodesFromApi]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 w-full" style={{ height: containerHeight, minHeight: 250 }}>
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-[10px] text-muted-foreground">{loadingLabel}</span>
      </div>
    );
  }

  if (isError || nodesFromApi.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 w-full" style={{ height: containerHeight, minHeight: 250 }}>
        <AlertCircle className="h-5 w-5 text-muted-foreground/50" />
        <span className="text-[10px] text-muted-foreground">No preview available</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full flex-1 min-h-0" style={{ height: containerHeight }}>
      {workflowLabel && (
        <div className="flex items-center gap-1.5 px-2 py-1 border-b border-border/40 bg-muted/30 shrink-0">
          <Workflow className="h-3 w-3 text-primary" />
          <span className="text-[10px] font-semibold text-foreground truncate">{workflowLabel}</span>
          <span className="text-[9px] text-muted-foreground ml-auto">
            {nodesFromApi.length} nodes
            {onSelectedNodesChange && (
              <>
                <span className="ml-1 text-muted-foreground/80">· Click a node for Mark selected / Deselect</span>
                {selectedWorkflowNodeIds.length > 0 && (
                  <span className="ml-1 text-primary"> · {selectedWorkflowNodeIds.length} selected for Virtual DB</span>
                )}
              </>
            )}
          </span>
        </div>
      )}
      <div
        ref={flowContainerRef}
        className="flex-1 min-h-0 w-full relative bg-canvas"
        style={{ height: canvasHeight }}
        onWheel={(e) => e.stopPropagation()}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={miniNodeTypes}
          onInit={onInit}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          defaultViewport={{ x: 0, y: 0, zoom: 0.5 }}
          fitView
          fitViewOptions={{ padding: 0.3, ...FIT_VIEW_OPTIONS }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={true}
          panOnDrag={true}
          zoomOnScroll={true}
          zoomOnPinch={true}
          zoomOnDoubleClick={true}
          minZoom={0.3}
          maxZoom={2}
          nodeOrigin={[0.5, 0.5]}
          className="theme-attribution"
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Cross}
            size={2}
            gap={20}
            className="!bg-background"
          />
          <ZoomSlider position="bottom-left" />
        </ReactFlow>

        {popover && onSelectedNodesChange && (
          <NodeSelectPopover
            info={popover}
            isSelected={selectedWorkflowNodeIds.includes(popover.nodeId)}
            onMarkSelected={onMarkSelected}
            onDeselect={onDeselectNode}
            onClose={() => setPopover(null)}
          />
        )}
      </div>
    </div>
  );
}

export default function SubflowEmbeddedViewer(props: SubflowEmbeddedViewerProps) {
  return (
    <ReactFlowProvider>
      <SubflowEmbeddedViewerInner {...props} />
    </ReactFlowProvider>
  );
}
