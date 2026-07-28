import React, { useState, useMemo, useRef, useCallback, useEffect, useLayoutEffect, Suspense } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import { Switch } from '@/components/ui/switch';
import { useReactFlow } from '@xyflow/react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Settings,
  ChevronRight,
  Workflow,
  Zap,
  LogIn,
  LogOut,
  Check,
  Loader2,
  Shield,
  AlertTriangle,
  ArrowRight,
  GitBranch,
  Box,
  X,
  Lock,
  LockOpen,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { cn } from '@/lib/utils';
import type { FormFieldOption } from '@/types/form';
import { fetchProjectsApi, getWorkflowByIdApi } from '@/controllers/API';
import { useRbacStore } from '@/stores/useRBACStore';
import useFlowStore from '@/stores/flowStore';
import { useQuery } from '@tanstack/react-query';
import { getNodeIcon } from '@/utils/styleUtils';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  type NodeTypes,
  type Node as RFNode,
} from '@xyflow/react';
import GenericNode from '@/customNodes/GenericNode';
import { ZoomSlider } from '@/components/zoom-slider';

export interface SubflowNode {
  id: string;
  label: string;
  icon?: string;
  type?: string;
}

export interface NodeConnection {
  id: string;
  sourceId: string;
  targetId: string;
}

/** Input node with optional replacement: when set, payload inputConnections use replaceable target node id(s) as targetId (one connection per replaceable node). */
export interface SubflowInputNode {
  id: string;
  /** Legacy: single replaceable target (when reading old payloads). */
  replaceableTargetNodeId?: string;
  /** Replaceable downstream node ids in parent flow; one connection is emitted per id for each incoming edge. */
  replaceableTargetNodeIds?: string[];
}

export interface SubflowSavePayload {
  selectedWorkflowId: string | null;
  selectedWorkflowLabel: string | null;
  /** Present only when reading legacy payloads; we no longer write it. */
  selectedWorkflowFlowId?: string | null;
  inputNodes: SubflowInputNode[];
  outputNodes: string[];
  inputConnections: NodeConnection[];
  outputConnections: NodeConnection[];
  propagateErrors: boolean;
  strictIsolation: boolean;
}

export interface SubflowViewProps {
  workflowFiles?: { id: string; label: string; flowId?: string }[];
  inputNodes?: SubflowNode[];
  outputNodes?: SubflowNode[];
  upstreamNodes?: string[];
  downstreamNodes?: string[];
  selectedInputNodeIds?: string[];
  selectedOutputNodeIds?: string[];
  onInputNodesChange?: (ids: string[]) => void;
  onOutputNodesChange?: (ids: string[]) => void;
  onSave?: (payload: SubflowSavePayload) => void;
  onCancel?: () => void;
  savedConfig?: SubflowSavePayload | null;
  /** When true, config is read-only; show Unlock to edit. After save, parent typically sets this. */
  locked?: boolean;
  /** Called when user clicks Unlock to edit. */
  onUnlock?: () => void;
  /** Called when user clicks Lock to lock workflow & strict isolation again. */
  onLock?: () => void;
}

// ── Lazy icon resolver for flow nodes ────────────────────────────
function NodeIconResolved({ name, className }: { name?: string; className?: string }) {
  const [IconComp, setIconComp] = useState<React.ComponentType<any> | null>(null);

  useEffect(() => {
    if (!name) return;
    let cancelled = false;
    getNodeIcon(name).then((comp) => {
      if (!cancelled) setIconComp(() => comp);
    });
    return () => { cancelled = true; };
  }, [name]);

  if (!IconComp) return <Box className={className} />;

  return (
    <Suspense fallback={<Box className={className} />}>
      <IconComp className={className} />
    </Suspense>
  );
}

// ── Read-only node for the mini viewer ──────────────────────────
const ViewOnlyNode = React.memo((props: any) => <GenericNode {...props} mode="view" />);
ViewOnlyNode.displayName = 'ViewOnlyNode';

const miniViewerNodeTypes: NodeTypes = { genericNode: ViewOnlyNode };

// ── Popover that floats on the flow canvas when a node is clicked ──
interface NodePopoverInfo {
  nodeId: string;
  nodeLabel: string;
  icon?: string;
  type?: string;
  x: number;
  y: number;
}

/** Downstream node for replaceable selection */
interface DownstreamNodeOption {
  id: string;
  label: string;
  type?: string;
}

function FlowNodePopover({
  info,
  isInput,
  isOutput,
  isIntermediate,
  hasNoUpstream,
  downstreamNodes,
  onMarkInput,
  onMarkOutput,
  onClose,
}: {
  info: NodePopoverInfo;
  isInput: boolean;
  isOutput: boolean;
  /** Node has both upstream and downstream connections — do not show Set as Input/Output */
  isIntermediate: boolean;
  hasNoUpstream: boolean;
  downstreamNodes: DownstreamNodeOption[];
  onMarkInput: (id: string, label: string, icon?: string, type?: string, replaceableTargetNodeIds?: string[]) => void;
  onMarkOutput: (id: string, label: string, icon?: string, type?: string) => void;
  onClose: () => void;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  type Step = 'main' | 'replace-prompt' | 'replaceable-picker';
  const [step, setStep] = useState<Step>('main');
  const [replaceDataSource, setReplaceDataSource] = useState(false);
  const [selectedReplaceableIds, setSelectedReplaceableIds] = useState<Set<string>>(new Set());

  const showReplacePromptAfterSetInput = hasNoUpstream && downstreamNodes.length > 0;
  const hasMultipleDownstream = downstreamNodes.length > 1;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (step === 'replaceable-picker') {
          setStep('replace-prompt');
          setSelectedReplaceableIds(new Set());
        } else if (step === 'replace-prompt') {
          setStep('main');
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('mousedown', handler);
    window.addEventListener('keydown', escHandler);
    return () => {
      window.removeEventListener('mousedown', handler);
      window.removeEventListener('keydown', escHandler);
    };
  }, [onClose, step]);

  const handleSetAsInput = () => {
    if (isInput) {
      onMarkInput(info.nodeId, info.nodeLabel, info.icon, info.type);
      onClose();
      return;
    }
    if (showReplacePromptAfterSetInput) {
      setStep('replace-prompt');
      setReplaceDataSource(false);
      return;
    }
    onMarkInput(info.nodeId, info.nodeLabel, info.icon, info.type);
    onClose();
  };

  const handleReplacePromptConfirm = () => {
    if (!replaceDataSource) {
      onMarkInput(info.nodeId, info.nodeLabel, info.icon, info.type);
      onClose();
      return;
    }
    if (hasMultipleDownstream) {
      setStep('replaceable-picker');
      setSelectedReplaceableIds(new Set(downstreamNodes.map((n) => n.id)));
    } else {
      onMarkInput(info.nodeId, info.nodeLabel, info.icon, info.type, downstreamNodes.map((n) => n.id));
      onClose();
    }
  };

  const handleConfirmReplaceable = () => {
    onMarkInput(info.nodeId, info.nodeLabel, info.icon, info.type, Array.from(selectedReplaceableIds));
    setStep('main');
    setSelectedReplaceableIds(new Set());
    onClose();
  };

  const toggleReplaceable = (id: string) => {
    setSelectedReplaceableIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div
      ref={popoverRef}
      className="absolute z-50 animate-in fade-in zoom-in-95 duration-150"
      style={{ left: info.x, top: info.y }}
    >
      <div className={cn('rounded-lg border bg-popover shadow-lg', step === 'replaceable-picker' ? 'w-48 p-2' : 'w-48 p-2')}>
        <p className="mb-2 truncate text-xs font-semibold text-foreground px-1">{info.nodeLabel}</p>

        {step === 'replaceable-picker' ? (
          <div className="flex flex-col gap-2">
            <p className="text-[11px] text-muted-foreground px-1">
              Select node to pass the data
            </p>
            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
              {downstreamNodes.map((n) => (
                <label
                  key={n.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs cursor-pointer hover:bg-muted/60"
                >
                  <Checkbox
                    checked={selectedReplaceableIds.has(n.id)}
                    onCheckedChange={() => toggleReplaceable(n.id)}
                  />
                  <span className="truncate font-medium text-foreground/90">{n.label}</span>
                  {/* {n.type && (
                    <span className="text-[10px] text-muted-foreground shrink-0">({n.type})</span>
                  )} */}
                </label>
              ))}
            </div>
            <div className="flex gap-1.5 pt-1">
              <Button
                size="sm"
                variant="outline"
                className="!h-7 text-xs flex-1"
                onClick={() => { setStep('replace-prompt'); setSelectedReplaceableIds(new Set()); }}
              >
                Back
              </Button>
              <Button
                size="sm"
                className="!h-7 text-xs flex-1"
                onClick={handleConfirmReplaceable}
                disabled={selectedReplaceableIds.size === 0}
              >
                Confirm
              </Button>
            </div>
          </div>
        ) : step === 'replace-prompt' ? (
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs cursor-pointer hover:bg-muted/60">
              <Checkbox
                checked={replaceDataSource}
                onCheckedChange={(v) => setReplaceDataSource(Boolean(v))}
              />
              <p className="text-[11px] text-muted-foreground px-1">
                Replace this node?
              </p>
            </label>
            <div className="flex gap-1.5 pt-1">
              <Button
                size="sm"
                variant="outline"
                className="!h-7 text-xs flex-1"
                onClick={() => setStep('main')}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="!h-7 text-xs flex-1"
                onClick={handleReplacePromptConfirm}
              >
                Confirm
              </Button>
            </div>
          </div>
        ) : isIntermediate ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] text-muted-foreground px-1">
              Intermediate node — cannot be set as input or output.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <button
              onClick={handleSetAsInput}
              className={cn(
                'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                isInput
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                  : 'hover:bg-muted text-foreground/80'
              )}
            >
              <LogIn className="h-3.5 w-3.5" />
              {isInput ? 'Remove from Input' : 'Set as Input'}
            </button>
            <button
              onClick={() => { onMarkOutput(info.nodeId, info.nodeLabel, info.icon, info.type); onClose(); }}
              className={cn(
                'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                isOutput
                  ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                  : 'hover:bg-muted text-foreground/80'
              )}
            >
              <LogOut className="h-3.5 w-3.5" />
              {isOutput ? 'Remove from Output' : 'Set as Output'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Full-height ReactFlow viewer with click-to-select nodes ──────
function SubflowMiniViewerFull({
  workflowFlowId,
  workflowName,
  inputNodeIds,
  outputNodeIds,
  onMarkInput,
  onMarkOutput,
  readOnly = false,
}: {
  workflowFlowId: string;
  workflowName?: string;
  inputNodeIds: string[];
  outputNodeIds: string[];
  onMarkInput: (id: string, label: string, icon?: string, type?: string, replaceableTargetNodeIds?: string[]) => void;
  onMarkOutput: (id: string, label: string, icon?: string, type?: string) => void;
  readOnly?: boolean;
}) {
  const { data: workflowData, isLoading, isError } = useQuery({
    queryKey: ['subflow-preview', workflowFlowId],
    queryFn: () => getWorkflowByIdApi({ id: workflowFlowId }),
    enabled: !!workflowFlowId,
    staleTime: 1000 * 60 * 5,
  });
  const { fitView } = useReactFlow();
  useEffect(() => {
    const handleResize = () => {
      requestAnimationFrame(() => {
        fitView({ padding: 0.3 });
      });
    };
  
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [fitView]);
  const rawNodes = workflowData?.data?.nodes ?? [];
  const edges = workflowData?.data?.edges ?? [];

  const inputSet = useMemo(() => new Set(inputNodeIds), [inputNodeIds]);
  const outputSet = useMemo(() => new Set(outputNodeIds), [outputNodeIds]);

  const [popover, setPopover] = useState<NodePopoverInfo | null>(null);

  /** For the popover node: has no incoming edges (entry/source node) */
  const popoverHasNoUpstream = useMemo(() => {
    if (!popover) return false;
    return !edges.some((e: any) => e.target === popover.nodeId);
  }, [popover, edges]);

  /** Immediate downstream nodes of the popover node for "replace CSV/PostgreSQL" flow */
  const popoverDownstreamNodes = useMemo((): DownstreamNodeOption[] => {
    if (!popover) return [];
    return edges
      .filter((e: any) => e.source === popover.nodeId)
      .map((e: any) => {
        const target = rawNodes.find((n: any) => n.id === e.target);
        const d = target?.data as any;
        return {
          id: e.target,
          label: d?.display_name || d?.name || e.target,
          type: d?.type || (target as any)?.type,
        };
      });
  }, [popover, edges, rawNodes]);

  /** Popover node is intermediate: has both upstream and downstream connections */
  const popoverIsIntermediate = useMemo(() => {
    if (!popover) return false;
    const hasUpstream = edges.some((e: any) => e.target === popover.nodeId);
    const hasDownstream = edges.some((e: any) => e.source === popover.nodeId);
    return hasUpstream && hasDownstream;
  }, [popover, edges]);

  const nodes = useMemo(
    () =>
      rawNodes.map((n: any) => {
        const isIn = inputSet.has(n.id) || inputSet.has((n.data as any)?.display_name || (n.data as any)?.name || '');
        const isOut = outputSet.has(n.id) || outputSet.has((n.data as any)?.display_name || (n.data as any)?.name || '');
        return {
          ...n,
          className: cn(
            n.className,
            isIn && !isOut && 'subflow-node-input',
            isOut && !isIn && 'subflow-node-output',
            isIn && isOut && 'subflow-node-both',
          ),
        };
      }),
    [rawNodes, inputSet, outputSet]
  );

  const containerRef = useRef<HTMLDivElement>(null);

  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: RFNode) => {
      if (readOnly) return;
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const d = node.data as any;
      const label = d?.display_name || d?.name || node.id;
      setPopover({
        nodeId: node.id,
        nodeLabel: label,
        icon: d?.icon,
        type: d?.type || node.type,
        x: event.clientX - rect.left + 8,
        y: event.clientY - rect.top + 8,
      });
    },
    [readOnly]
  );

  const handlePaneClick = useCallback(() => setPopover(null), []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 h-full">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Loading workflow preview...</span>
      </div>
    );
  }

  if (isError || rawNodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-sm text-muted-foreground">No preview available</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-full w-full flex flex-col min-h-0">
      {/* Workflow name header (edit mode) */}
      {workflowName && (
        <div className="flex-shrink-0 flex items-center gap-2 border-b border-border/60 bg-card/80 backdrop-blur-sm px-3 py-0">
          <Workflow className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-semibold text-foreground truncate" title={workflowName}>
            {workflowName}
          </span>
        </div>
      )}
      <div className="flex-1 min-h-0  relative">
        <ReactFlow
          nodes={nodes}
          className="h-full w-full"
          edges={edges}
          nodeTypes={miniViewerNodeTypes}
          fitView
          fitViewOptions={{ padding: 0.5 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={true}
          panOnDrag={true}
          zoomOnScroll={true}
          zoomOnPinch={true}
          zoomOnDoubleClick={false}
          minZoom={0.1}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={0.5} color="#d4d4d8" />
          <ZoomSlider position="bottom-left" className="!bg-background/95 border-none shadow-none" />
        </ReactFlow>
      </div>

      {popover && (
        <FlowNodePopover
          info={popover}
          isInput={inputSet.has(popover.nodeId)}
          isOutput={outputSet.has(popover.nodeId)}
          isIntermediate={popoverIsIntermediate}
          hasNoUpstream={popoverHasNoUpstream}
          downstreamNodes={popoverDownstreamNodes}
          onMarkInput={onMarkInput}
          onMarkOutput={onMarkOutput}
          onClose={() => setPopover(null)}
        />
      )}

      {/* Legend for colored rings */}
      {(inputNodeIds.length > 0 || outputNodeIds.length > 0) && (
        <div className="absolute bottom-3 right-3 flex items-center gap-3 rounded-lg border bg-background/90 backdrop-blur-sm px-3 py-1.5 text-[10px] font-medium text-muted-foreground shadow-sm">
          {inputNodeIds.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-400" />
              Input ({inputNodeIds.length})
            </span>
          )}
          {outputNodeIds.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-orange-400" />
              Output ({outputNodeIds.length})
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Step Progress Indicator ──────────────────────────────────────
function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    { label: 'Workflow', icon: Workflow },
    { label: 'Nodes', icon: GitBranch },
    { label: 'Connections', icon: Zap },
  ];


}

// ── Connection Map with interactive click-to-connect lines ───────
// Declarative SVG paths: positions are measured into state so they survive tab switches.
function ConnectionMap({
  title,
  icon,
  leftLabel,
  rightLabel,
  leftNodes,
  rightNodes,
  accentClass,
  portColorClass,
  strokeColor,
  connections,
  onAddConnection,
  onRemoveConnection,
  readOnly = false,
}: {
  title: string;
  icon: React.ReactNode;
  leftLabel: string;
  rightLabel: string;
  leftNodes: { id: string; label: string; icon?: string; type?: string }[];
  rightNodes: { id: string; label: string; icon?: string; type?: string }[];
  emptyText?: string;
  accentClass: string;
  portColorClass: string;
  strokeColor: string;
  connections: NodeConnection[];
  onAddConnection: (sourceId: string, targetId: string) => void;
  onRemoveConnection: (connectionId: string) => void;
  readOnly?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leftColRef = useRef<HTMLDivElement>(null);
  const rightColRef = useRef<HTMLDivElement>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);

  // Declarative path state instead of imperative SVG manipulation
  const [pathData, setPathData] = useState<{ id: string; d: string; endX: number; endY: number }[]>([]);
  const [svgSize, setSvgSize] = useState({ w: 0, h: 0 });

  const measure = useCallback(() => {
    const container = containerRef.current;
    const leftCol = leftColRef.current;
    const rightCol = rightColRef.current;
    if (!container || !leftCol || !rightCol) return;

    const containerRect = container.getBoundingClientRect();
    if (containerRect.width === 0 || containerRect.height === 0) return;

    const paths: { id: string; d: string; endX: number; endY: number }[] = [];

    connections.forEach((conn) => {
      const lPortEl = leftCol.querySelector<HTMLDivElement>(
        `[data-node-id="${conn.sourceId}"] [data-port="right"]`
      );
      const rPortEl = rightCol.querySelector<HTMLDivElement>(
        `[data-node-id="${conn.targetId}"] [data-port="left"]`
      );
      if (!lPortEl || !rPortEl) return;

      const lRect = lPortEl.getBoundingClientRect();
      const rRect = rPortEl.getBoundingClientRect();
      if (lRect.width === 0 || rRect.width === 0) return;

      const x1 = lRect.right - containerRect.left;
      const y1 = lRect.top + lRect.height / 2 - containerRect.top;
      const x2 = rRect.left - containerRect.left;
      const y2 = rRect.top + rRect.height / 2 - containerRect.top;
      const midX = (x1 + x2) / 2;

      paths.push({
        id: conn.id,
        d: `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`,
        endX: x2,
        endY: y2,
      });
    });

    setSvgSize({ w: containerRect.width, h: containerRect.height });
    setPathData(paths);
  }, [connections]);

  // Measure on mount and whenever dependencies change
  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(measure));
    return () => cancelAnimationFrame(id);
  }, [leftNodes, rightNodes, connections, measure]);

  // Re-measure on window resize
  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  // Re-measure when container becomes visible (tab switch) via IntersectionObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          requestAnimationFrame(() => requestAnimationFrame(measure));
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(container);

    const resizeObs = new ResizeObserver(() => {
      requestAnimationFrame(measure);
    });
    resizeObs.observe(container);

    return () => {
      observer.disconnect();
      resizeObs.disconnect();
    };
  }, [measure]);

  useEffect(() => {
    if (!connectingFrom) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConnectingFrom(null);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setConnectingFrom(null);
      }
    };
    window.addEventListener('keydown', handleEscape);
    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [connectingFrom]);

  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!connectingFrom) {
      setMousePos(null);
      return;
    }
    const container = containerRef.current;
    if (!container) return;
    const onMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };
    container.addEventListener('mousemove', onMove);
    return () => container.removeEventListener('mousemove', onMove);
  }, [connectingFrom]);

  const handleLeftPortClick = useCallback((nodeId: string) => {
    if (readOnly) return;
    setConnectingFrom((prev) => (prev === nodeId ? null : nodeId));
  }, [readOnly]);

  const handleRightPortClick = useCallback(
    (nodeId: string) => {
      if (readOnly || !connectingFrom) return;
      const existing = connections.find(
        (c) => c.sourceId === connectingFrom && c.targetId === nodeId
      );
      if (existing) {
        onRemoveConnection(existing.id);
      } else {
        onAddConnection(connectingFrom, nodeId);
      }
      setConnectingFrom(null);
    },
    [readOnly, connectingFrom, connections, onAddConnection, onRemoveConnection]
  );

  const isLeftNodeConnected = useCallback(
    (id: string) => connections.some((c) => c.sourceId === id),
    [connections]
  );
  const isRightNodeConnected = useCallback(
    (id: string) => connections.some((c) => c.targetId === id),
    [connections]
  );

  // Compute dragging path from the connecting source port to the mouse
  const dragPath = useMemo(() => {
    if (!connectingFrom || !mousePos) return null;
    const leftCol = leftColRef.current;
    const container = containerRef.current;
    if (!leftCol || !container) return null;
    const portEl = leftCol.querySelector<HTMLDivElement>(
      `[data-node-id="${connectingFrom}"] [data-port="right"]`
    );
    if (!portEl) return null;
    const cRect = container.getBoundingClientRect();
    const pRect = portEl.getBoundingClientRect();
    if (pRect.width === 0) return null;
    const fx = pRect.right - cRect.left;
    const fy = pRect.top + pRect.height / 2 - cRect.top;
    const midX = (fx + mousePos.x) / 2;
    return `M ${fx} ${fy} C ${midX} ${fy}, ${midX} ${mousePos.y}, ${mousePos.x} ${mousePos.y}`;
  }, [connectingFrom, mousePos]);

  if (leftNodes.length === 0 && rightNodes.length === 0) return null;

  const hasBothSides = leftNodes.length > 0 && rightNodes.length > 0;

  return (
    <div className="rounded-xl border border-border bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden">
      {/* <div className="flex items-center gap-2 border-b border-border/60 bg-gradient-to-r from-muted/40 via-muted/20 to-transparent px-4 py-2.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
          {icon}
        </div>
        <span className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
          {title}
        </span>
        <ArrowRight className="h-3 w-3 text-muted-foreground/40 mx-1" />
        <Badge variant="outline" className="text-[10px] border-primary/20 text-primary bg-primary/5 font-semibold">
          {connections.length} connection{connections.length !== 1 ? 's' : ''}
        </Badge>
        {!readOnly && connectingFrom && (
          <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600 bg-amber-50 font-semibold animate-pulse">
            Click a target node...
          </Badge>
        )}
      </div> */}

      {hasBothSides ? (
        <>
          <div ref={containerRef} className="relative px-6 py-5">
            {/* Declarative SVG -- rendered from state, always correct */}
            <svg
              className="pointer-events-none absolute inset-0"
              width={svgSize.w || '100%'}
              height={svgSize.h || '100%'}
              viewBox={svgSize.w ? `0 0 ${svgSize.w} ${svgSize.h}` : undefined}
              style={{ overflow: 'visible' }}
            >
              {pathData.map((p) => (
                <React.Fragment key={p.id}>
                  <path d={p.d} stroke="#9CA3AF" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.6" />
                  <circle cx={p.endX} cy={p.endY} r="2" fill="#9CA3AF" opacity="0.8" />
                </React.Fragment>
              ))}
              {dragPath && (
                <path d={dragPath} stroke="#3b82f6" strokeWidth="2" fill="none" strokeDasharray="4,4" opacity="0.7" />
              )}
            </svg>

            <div className="flex items-start justify-between gap-6">
              <div ref={leftColRef} className="flex flex-col gap-3 items-center min-w-[80px]">
                <span className="w-full mb-0.5 text-[9px] font-semibold uppercase text-center">
                  {leftLabel}
                </span>
                {leftNodes.map((node) => (
                  <div
                    key={node.id}
                    data-node-id={node.id}
                    className={cn(
                      'group relative flex flex-col items-center gap-1.5 w-[80px] select-none',
                      !readOnly && 'cursor-pointer'
                    )}
                    onClick={() => handleLeftPortClick(node.id)}
                  >
                    <div
                      className={cn(
                        'relative flex h-11 w-11 items-center justify-center rounded-xl border bg-gradient-to-br from-muted/60 to-muted/30 shadow-sm transition-all hover:border-primary/30 hover:shadow-md',
                        connectingFrom === node.id && 'border-primary/60 shadow-md ring-2 ring-primary/20',
                        isLeftNodeConnected(node.id) && !connectingFrom && 'border-primary/30 bg-primary/5',
                        !connectingFrom && !isLeftNodeConnected(node.id) && 'border-border/60'
                      )}
                    >
                      <NodeIconResolved name={node.icon || node.type} className="h-5 w-5 text-foreground/70" />
                      <div
                        data-port="right"
                        className={cn(
                          'absolute -right-[5px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-gray-300 bg-white transition-all cursor-pointer hover:scale-125',
                          connectingFrom === node.id && 'ring-2 ring-blue-300 ring-offset-1 border-gray-500 bg-gray-100',
                          isLeftNodeConnected(node.id) && !connectingFrom && 'border-gray-500 bg-gray-100'
                        )}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-foreground/70 text-center leading-tight w-full truncate" title={node.label}>
                      {node.label}
                    </span>
                  </div>
                ))}
              </div>

              <div ref={rightColRef} className="flex flex-col gap-3 items-center min-w-[80px]">
                <span className="w-full mb-0.5 text-[9px] font-semibold uppercase text-center">
                  {rightLabel}
                </span>
                {rightNodes.map((node) => (
                  <div
                    key={node.id}
                    data-node-id={node.id}
                    className={cn(
                      'group relative flex flex-col items-center gap-1.5 w-[80px] select-none',
                      !readOnly && connectingFrom && 'cursor-pointer',
                    )}
                    onClick={() => handleRightPortClick(node.id)}
                  >
                    <div
                      className={cn(
                        'relative flex h-11 w-11 items-center justify-center rounded-xl border bg-gradient-to-br from-muted/60 to-muted/30 shadow-sm transition-all hover:shadow-md',
                        connectingFrom && 'hover:ring-1 hover:ring-primary/40',
                        isRightNodeConnected(node.id) && 'border-primary/30 bg-primary/5',
                        !isRightNodeConnected(node.id) && 'border-border/60'
                      )}
                    >
                      <div
                        data-port="left"
                        className={cn(
                          'absolute -left-[5px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-gray-300 bg-white transition-all cursor-pointer hover:scale-125',
                          connectingFrom && 'ring-1 ring-blue-200',
                          isRightNodeConnected(node.id) && 'border-gray-500 bg-gray-100'
                        )}
                      />
                      <NodeIconResolved name={node.icon || node.type} className="h-5 w-5 text-foreground/70" />
                    </div>
                    <span className="text-[10px] font-medium text-foreground/70 text-center leading-tight w-full truncate" title={node.label}>
                      {node.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {connections.length > 0 && (
            <div className="border-t border-border/40 px-4 py-2.5 space-y-1.5">
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
                Active Connections
              </span>
              {connections.map((conn) => {
                const leftNode = leftNodes.find((n) => n.id === conn.sourceId);
                const rightNode = rightNodes.find((n) => n.id === conn.targetId);
                return (
                  <div
                    key={conn.id}
                    className="flex items-center gap-2 rounded-md bg-muted/30 px-2.5 py-1.5 text-[11px] group"
                  >
                    <span className="font-medium text-foreground/80 truncate">
                      {leftNode?.label ?? conn.sourceId}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                    <span className="font-medium text-foreground/80 truncate">
                      {rightNode?.label ?? conn.targetId}
                    </span>
                    {!readOnly && (
                      <button
                        onClick={() => onRemoveConnection(conn.id)}
                        className="ml-auto shrink-0 rounded-full p-1 bg-destructive/10 text-destructive/70 hover:bg-destructive/20 hover:text-destructive transition-all"
                        aria-label="Remove connection"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="px-4 py-3 space-y-2">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
            Selected Nodes
          </span>
          {(leftNodes.length > 0 ? leftNodes : rightNodes).map((node) => (
            <div
              key={node.id}
              className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
            >
              <NodeIconResolved name={node.icon || node.type} className="h-4 w-4 text-foreground/60 shrink-0" />
              <span className="text-xs font-medium text-foreground/80 truncate">{node.label}</span>
            </div>
          ))}
          {leftNodes.length === 0 && rightNodes.length > 0 && (
            <p className="text-[10px] text-muted-foreground/60 italic pt-1">
              No upstream nodes found to map connections from.
            </p>
          )}
          {rightNodes.length === 0 && leftNodes.length > 0 && (
            <p className="text-[10px] text-muted-foreground/60 italic pt-1">
              No downstream nodes found to map connections to.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main SubflowView ─────────────────────────────────────────────
function SubflowView({
  workflowFiles: workflowFilesProp,
  inputNodes: inputNodesProp,
  outputNodes: outputNodesProp,
  upstreamNodes: upstreamProp,
  downstreamNodes: downstreamProp,
  selectedInputNodeIds: controlledInputIds,
  selectedOutputNodeIds: controlledOutputIds,
  onInputNodesChange,
  onOutputNodesChange,
  onSave,
  onCancel,
  savedConfig,
  locked = false,
  onUnlock,
  onLock,
}: SubflowViewProps) {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(
    savedConfig?.selectedWorkflowId ?? null
  );
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [propagateErrors, setPropagateErrors] = useState(
    savedConfig?.propagateErrors ?? true
  );
  const [strictIsolation, setStrictIsolation] = useState(
    savedConfig?.strictIsolation ?? false
  );
  const [internalInputIds, setInternalInputIds] = useState<string[]>(() => {
    const raw = savedConfig?.inputNodes ?? [];
    return raw.map((n) => (typeof n === 'string' ? n : n.id));
  });
  const [internalOutputIds, setInternalOutputIds] = useState<string[]>(
    savedConfig?.outputNodes ?? []
  );
  const [inputConnections, setInputConnections] = useState<NodeConnection[]>(() => {
    const rawInputNodes = savedConfig?.inputNodes ?? [];
    const savedConns = savedConfig?.inputConnections ?? [];
    const seen = new Set<string>();
    return savedConns
      .map((c) => {
        const inputNode = rawInputNodes.find(
          (n) =>
            typeof n === 'object' &&
            (n.replaceableTargetNodeIds?.includes(c.targetId) || n.replaceableTargetNodeId === c.targetId)
        );
        if (inputNode && typeof inputNode === 'object') {
          return { ...c, targetId: inputNode.id, id: `${c.sourceId}-${inputNode.id}` };
        }
        return c;
      })
      .filter((c) => {
        const key = `${c.sourceId}-${c.targetId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  });
  const [outputConnections, setOutputConnections] = useState<NodeConnection[]>(
    savedConfig?.outputConnections ?? []
  );
  /** Input node id -> replaceable downstream node ids (UI state; payload uses inputNodes[].replaceableTargetNodeIds). */
  const [replaceableByInput, setReplaceableByInput] = useState<Record<string, string[]>>(() => {
    const raw = savedConfig?.inputNodes ?? [];
    const out: Record<string, string[]> = {};
    raw.forEach((n) => {
      if (typeof n !== 'object') return;
      const ids = n.replaceableTargetNodeIds ?? (n.replaceableTargetNodeId ? [n.replaceableTargetNodeId] : []);
      if (ids.length) out[n.id] = ids;
    });
    return out;
  });

  const initialStateRef = useRef<{
    inputs: string[];
    outputs: string[];
    inputConnections: NodeConnection[];
    outputConnections: NodeConnection[];
    propagateErrors: boolean;
    strictIsolation: boolean;
  } | null>(null);

  const selectedInputIds = controlledInputIds ?? internalInputIds;
  const setSelectedInputIds = (ids: string[]) => {
    if (onInputNodesChange) onInputNodesChange(ids);
    else setInternalInputIds(ids);
  };
  const selectedOutputIds = controlledOutputIds ?? internalOutputIds;
  const setSelectedOutputIds = (ids: string[]) => {
    if (onOutputNodesChange) onOutputNodesChange(ids);
    else setInternalOutputIds(ids);
  };

  useEffect(() => {
    initialStateRef.current = {
      inputs: selectedInputIds,
      outputs: selectedOutputIds,
      inputConnections,
      outputConnections,
      propagateErrors,
      strictIsolation,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addInputConnection = useCallback((sourceId: string, targetId: string) => {
    setInputConnections((prev) => [
      ...prev,
      { id: `${sourceId}-${targetId}-${Date.now()}`, sourceId, targetId },
    ]);
  }, []);

  const removeInputConnection = useCallback((id: string) => {
    setInputConnections((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const addOutputConnection = useCallback((sourceId: string, targetId: string) => {
    setOutputConnections((prev) => [
      ...prev,
      { id: `${sourceId}-${targetId}-${Date.now()}`, sourceId, targetId },
    ]);
  }, []);

  const removeOutputConnection = useCallback((id: string) => {
    setOutputConnections((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // ── Sync state from savedConfig when it updates (e.g. after parent saves) ──
  // UI shows saved data until user edits and clicks Save again.
  const prevSavedConfigRef = useRef(savedConfig);
  useEffect(() => {
    if (savedConfig == null) return;
    if (prevSavedConfigRef.current === savedConfig) return;
    prevSavedConfigRef.current = savedConfig;
    const wfId = savedConfig.selectedWorkflowId ?? savedConfig?.selectedWorkflowFlowId ?? null;
    setSelectedWorkflowId(wfId);
    prevWorkflowRef.current = wfId;
    setPropagateErrors(savedConfig.propagateErrors ?? true);
    setStrictIsolation(savedConfig.strictIsolation ?? false);

    const rawInputNodes = savedConfig.inputNodes ?? [];
    const inputIds = rawInputNodes.map((n) => (typeof n === 'string' ? n : n.id));
    setInternalInputIds(inputIds);

    const replaceable: Record<string, string[]> = {};
    rawInputNodes.forEach((n) => {
      if (typeof n !== 'object') return;
      const ids = n.replaceableTargetNodeIds ?? (n.replaceableTargetNodeId ? [n.replaceableTargetNodeId] : []);
      if (ids.length) replaceable[n.id] = ids;
    });
    setReplaceableByInput(replaceable);

    setInternalOutputIds(savedConfig.outputNodes ?? []);

    // Restore inputConnections for UI: payload targetIds are replaceable (parent-flow) nodes; show as subflow input node ids. Dedupe by (sourceId, subflowInputId) so we don't accumulate duplicates across restore/save cycles.
    const savedInputConns = savedConfig.inputConnections ?? [];
    const seenUi = new Set<string>();
    const uiInputConnections = savedInputConns
      .map((c) => {
        const inputNode = rawInputNodes.find(
          (n) =>
            typeof n === 'object' &&
            (n.replaceableTargetNodeIds?.includes(c.targetId) || n.replaceableTargetNodeId === c.targetId)
        );
        if (inputNode && typeof inputNode === 'object') {
          return { ...c, targetId: inputNode.id, id: `${c.sourceId}-${inputNode.id}` };
        }
        return c;
      })
      .filter((c) => {
        const key = `${c.sourceId}-${c.targetId}`;
        if (seenUi.has(key)) return false;
        seenUi.add(key);
        return true;
      });
    setInputConnections(uiInputConnections);
    setOutputConnections(savedConfig.outputConnections ?? []);
  }, [savedConfig]);

  // ── Reset node selections & connections only when user changes workflow (draft) ──
  const prevWorkflowRef = useRef(selectedWorkflowId);
  const isRestoringRef = useRef(!!savedConfig?.selectedWorkflowId);
  useEffect(() => {
    if (prevWorkflowRef.current === selectedWorkflowId) return;
    prevWorkflowRef.current = selectedWorkflowId;
    if (isRestoringRef.current) {
      isRestoringRef.current = false;
      return;
    }
    setInternalInputIds([]);
    setInternalOutputIds([]);
    setReplaceableByInput({});
    setInputConnections([]);
    setOutputConnections([]);
    onInputNodesChange?.([]);
    onOutputNodesChange?.([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorkflowId]);

  // ── API: fetch workflows ──
  const { currentUser, activePerspective } = useRbacStore();
  const userOrgIds = currentUser?.organizationIds || [];
  const activePerspectiveId =
    activePerspective?.perspective_id ?? (activePerspective as { id?: string })?.id;

  const { data: projects = [], isLoading: flowsLoading } = useQuery({
    queryKey: ['subflow-projects', userOrgIds.join(','), activePerspectiveId],
    queryFn: () =>
      fetchProjectsApi(
        {
          fields: [
            'name', 'description', 'created_at', 'updated_at',
            'deployment_name', 'locked', 'flow_id', 'workflow_origin',
          ],
          org_id: userOrgIds,
          perspective_ids: activePerspectiveId ? [activePerspectiveId] : undefined,
          q: 'virtualdb_mode=false',
        },
        currentUser?.role
      ),
    staleTime: 1000 * 60 * 5,
  });

  const workflowFiles = useMemo(() => {
    if (workflowFilesProp?.length) return workflowFilesProp;
    const list = Array.isArray(projects) ? projects : (projects as any)?.data ?? [];
    return list.map((w: any) => ({
      id: String(w.id),
      label: w.name || w.display_name || String(w.id),
      flowId: w.flow_id as string | undefined,
    }));
  }, [workflowFilesProp, projects]);

  const workflowOptions: FormFieldOption[] = useMemo(
    () => workflowFiles.map((f) => ({ value: f.id, label: f.label })),
    [workflowFiles]
  );
  const selectedWorkflow = workflowFiles.find((f) => f.id === selectedWorkflowId);

  const workflowPreviewId = selectedWorkflowId
    ?? savedConfig?.selectedWorkflowFlowId
    ?? null;

  // ── Fetch selected workflow to resolve node label/icon/type for saved inputs/outputs (reopen after save) ──
  const { data: previewWorkflowData, isError: previewFetchError } = useQuery({
    queryKey: ['subflow-preview', workflowPreviewId],
    queryFn: () => getWorkflowByIdApi({ id: workflowPreviewId! }),
    enabled: !!workflowPreviewId,
    staleTime: 1000 * 60 * 5,
  });

  /** Saved workflow id is set but flow is no longer in the list or preview fetch failed (e.g. deleted). */
  const isWorkflowDeleted =
    !!workflowPreviewId &&
    (!selectedWorkflow || previewFetchError);
  const workflowNodeMeta = useMemo(() => {
    const nodes = previewWorkflowData?.data?.nodes ?? [];
    const map: Record<string, { label: string; icon?: string; type?: string }> = {};
    nodes.forEach((n: any) => {
      const id = n.id;
      const label = (n.data as any)?.display_name || (n.data as any)?.name || id;
      map[id] = { label, icon: (n.data as any)?.icon, type: (n.data as any)?.type || n.type };
    });
    return map;
  }, [previewWorkflowData?.data?.nodes]);

  /** Node IDs that have no outgoing edges (sink nodes) — default as output nodes */
  const nodesWithNoDownstream = useMemo(() => {
    const nodes = previewWorkflowData?.data?.nodes ?? [];
    const edges = previewWorkflowData?.data?.edges ?? [];
    const sourceIds = new Set(edges.map((e: any) => e.source));
    return nodes.filter((n: any) => !sourceIds.has(n.id)).map((n: any) => n.id);
  }, [previewWorkflowData?.data?.nodes, previewWorkflowData?.data?.edges]);

  // ── Default output: when workflow loads and no outputs selected, select nodes with no downstream ──
  useEffect(() => {
    if (!workflowPreviewId || !previewWorkflowData || nodesWithNoDownstream.length === 0) return;
    if (selectedOutputIds.length > 0) return;
    setSelectedOutputIds(nodesWithNoDownstream);
  }, [workflowPreviewId, previewWorkflowData, nodesWithNoDownstream.join(',')]);

  // ── Input/output nodes are selected from the workflow preview (click on nodes), not from API list ──
  const inputNodes: SubflowNode[] = useMemo(() => {
    if (inputNodesProp?.length) return inputNodesProp;
    return [];
  }, [inputNodesProp]);

  const outputNodes: SubflowNode[] = useMemo(() => {
    if (outputNodesProp?.length) return outputNodesProp;
    return [];
  }, [outputNodesProp]);

  // ── Resolve upstream / downstream from flow store edges ──
  const flowNodes = useFlowStore((s) => s.currentWorkflow?.data.nodes);
  const flowEdges = useFlowStore((s) => s.currentWorkflow?.data.edges);
  const selectedNodeId = useMemo(
    () => flowNodes?.find((n) => n.selected)?.id,
    [flowNodes]
  );

  const upstreamAsNodes = useMemo(() => {
    if (upstreamProp?.length) {
      return upstreamProp.map((name, i) => ({ id: `up-${i}`, label: name }));
    }
    if (!selectedNodeId || !flowEdges || !flowNodes) return [];
    const sourceIds = new Set(
      flowEdges.filter((e) => e.target === selectedNodeId).map((e) => e.source)
    );
    return flowNodes
      .filter((n) => sourceIds.has(n.id))
      .map((n) => ({
        id: n.id,
        label: (n.data as any)?.display_name || (n.data as any)?.name || n.id,
        icon: (n.data as any)?.icon,
        type: (n.data as any)?.type || n.type,
      }));
  }, [upstreamProp, selectedNodeId, flowEdges, flowNodes]);

  const downstreamAsNodes = useMemo(() => {
    if (downstreamProp?.length) {
      return downstreamProp.map((name, i) => ({ id: `down-${i}`, label: name }));
    }
    if (!selectedNodeId || !flowEdges || !flowNodes) return [];
    const targetIds = new Set(
      flowEdges.filter((e) => e.source === selectedNodeId).map((e) => e.target)
    );
    return flowNodes
      .filter((n) => targetIds.has(n.id))
      .map((n) => ({
        id: n.id,
        label: (n.data as any)?.display_name || (n.data as any)?.name || n.id,
        icon: (n.data as any)?.icon,
        type: (n.data as any)?.type || n.type,
      }));
  }, [downstreamProp, selectedNodeId, flowEdges, flowNodes]);

  // ── Prune stale connections when node selections change ──
  useEffect(() => {
    const validTargets = new Set(selectedInputIds);
    const validSources = new Set(upstreamAsNodes.map((n) => n.id));
    setInputConnections((prev) =>
      prev.filter((c) => validSources.has(c.sourceId) && validTargets.has(c.targetId))
    );
  }, [selectedInputIds, upstreamAsNodes]);

  useEffect(() => {
    const validSources = new Set(selectedOutputIds);
    const validTargets = new Set(downstreamAsNodes.map((n) => n.id));
    setOutputConnections((prev) =>
      prev.filter((c) => validSources.has(c.sourceId) && validTargets.has(c.targetId))
    );
  }, [selectedOutputIds, downstreamAsNodes]);

  // ── Metadata for nodes selected directly from the flow canvas (keyed by node id) ──
  const canvasNodeMetaRef = useRef<Record<string, { icon?: string; type?: string; label?: string }>>({});

  // ── Derived data for connection maps ──
  // Use workflow node meta for saved ids (reopen); canvas meta for current-session picks
  const selectedInputNodeObjects = useMemo(() => {
    const fromApi = inputNodes.filter((n) => selectedInputIds.includes(n.id));
    const apiIdSet = new Set(fromApi.map((n) => n.id));
    const canvasMeta = canvasNodeMetaRef.current;
    const fromCanvas = selectedInputIds
      .filter((id) => !apiIdSet.has(id))
      .map((id) => {
        const wf = workflowNodeMeta[id];
        const canvas = canvasMeta[id];
        const label = canvas?.label ?? wf?.label ?? id;
        const icon = canvas?.icon ?? wf?.icon;
        const type = canvas?.type ?? wf?.type;
        return { id, label, icon, type };
      });
    return [...fromApi, ...fromCanvas];
  }, [inputNodes, selectedInputIds, workflowNodeMeta]);

  const selectedOutputNodeObjects = useMemo(() => {
    const fromApi = outputNodes.filter((n) => selectedOutputIds.includes(n.id));
    const apiIdSet = new Set(fromApi.map((n) => n.id));
    const canvasMeta = canvasNodeMetaRef.current;
    const fromCanvas = selectedOutputIds
      .filter((id) => !apiIdSet.has(id))
      .map((id) => {
        const wf = workflowNodeMeta[id];
        const canvas = canvasMeta[id];
        const label = canvas?.label ?? wf?.label ?? id;
        const icon = canvas?.icon ?? wf?.icon;
        const type = canvas?.type ?? wf?.type;
        return { id, label, icon, type };
      });
    return [...fromApi, ...fromCanvas];
  }, [outputNodes, selectedOutputIds, workflowNodeMeta]);

  const totalSelected = selectedInputIds.length + selectedOutputIds.length;

  const currentStep = !selectedWorkflowId ? 0 : totalSelected === 0 ? 1 : 2;

  // ── Save / Cancel ──
  const handleSave = () => {
    if (onInputNodesChange) onInputNodesChange(selectedInputIds);
    if (onOutputNodesChange) onOutputNodesChange(selectedOutputIds);

    // Payload inputNodes: each selected input with replaceable target node id(s) (for parent-flow connection targetIds).
    const payloadInputNodes: SubflowInputNode[] = selectedInputIds.map((id) => {
      const ids = replaceableByInput[id];
      if (!ids?.length) return { id };
      return { id, replaceableTargetNodeIds: ids };
    });

    // Payload inputConnections: one connection per (sourceId, replaceable targetId); dedupe so multiple inputs / replaceable nodes don't create duplicate entries.
    const seenPayload = new Set<string>();
    const payloadInputConnections: NodeConnection[] = inputConnections.flatMap((c) => {
      const replaceableIds = replaceableByInput[c.targetId];
      if (replaceableIds?.length) {
        return replaceableIds.map((targetId) => ({
          ...c,
          targetId,
          id: `${c.sourceId}-${targetId}`,
        }));
      }
      return [c];
    }).filter((c) => {
      const key = `${c.sourceId}-${c.targetId}`;
      if (seenPayload.has(key)) return false;
      seenPayload.add(key);
      return true;
    });

    const payload: SubflowSavePayload = {
      selectedWorkflowId,
      selectedWorkflowLabel: selectedWorkflow?.label ?? null,
      inputNodes: payloadInputNodes,
      outputNodes: selectedOutputIds,
      inputConnections: payloadInputConnections,
      outputConnections,
      propagateErrors,
      strictIsolation,
    };

    if (onSave) {
      onSave(payload);
    } else {
      console.log('Subflow save', payload);
    }
  };

  const handleCancel = () => {
    const init = initialStateRef.current;
    if (init) {
      setSelectedInputIds(init.inputs ?? []);
      setSelectedOutputIds(init.outputs ?? []);
      setInputConnections(init.inputConnections ?? []);
      setOutputConnections(init.outputConnections ?? []);
      setPropagateErrors(init.propagateErrors ?? true);
      setStrictIsolation(init.strictIsolation ?? false);
    }
    onCancel?.();
  };

  const showInputMap = selectedInputIds.length > 0;
  const showOutputMap = selectedOutputIds.length > 0;
  const hasAnyConnections = showInputMap || showOutputMap;

  const handleFlowMarkInput = useCallback(
    (nodeId: string, nodeLabel: string, icon?: string, type?: string, replaceableTargetNodeIds?: string[]) => {
      canvasNodeMetaRef.current[nodeId] = { icon, type, label: nodeLabel };
      if (selectedInputIds.includes(nodeId)) {
        setSelectedInputIds(selectedInputIds.filter((id) => id !== nodeId));
        setReplaceableByInput((prev) => {
          const next = { ...prev };
          delete next[nodeId];
          return next;
        });
      } else {
        setSelectedInputIds([...selectedInputIds, nodeId]);
        setReplaceableByInput((prev) => ({
          ...prev,
          [nodeId]: replaceableTargetNodeIds ?? [],
        }));
      }
    },
    [selectedInputIds]
  );

  const handleFlowMarkOutput = useCallback(
    (nodeId: string, nodeLabel: string, icon?: string, type?: string) => {
      canvasNodeMetaRef.current[nodeId] = { icon, type, label: nodeLabel };
      if (selectedOutputIds.includes(nodeId)) {
        setSelectedOutputIds(selectedOutputIds.filter((id) => id !== nodeId));
      } else {
        setSelectedOutputIds([...selectedOutputIds, nodeId]);
      }
    },
    [selectedOutputIds]
  );

  return (
<div className="flex h-[91vh] flex-col overflow-hidden bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
  <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0 overflow-hidden">
        {/* ── Left Panel: Options ── */}
        <ResizablePanel defaultSize={20} minSize={22} maxSize={50}>
          <div className="flex flex-col h-full">
            {/* Lock only hides workflow + strict isolation; Unlock reveals them */}
            {locked && (
              <div className="flex-shrink-0 flex items-center justify-between gap-2 border-b border-border/60 bg-muted/20 px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  {/* <Lock className="h-4 w-4 text-amber-500 shrink-0" /> */}
                  <span className="text-xs font-medium text-muted-foreground truncate">Workflow &amp; strict isolation locked</span>
                </div>
                {onUnlock && (
                  <Button onClick={onUnlock} size="sm" className="!h-6 !px-1 text-xs font-semibold shrink-0" variant='outline'>
                    <LockOpen className="h-3 w-3" />
                    {/* Unlock */}
                  </Button>
                )}
              </div>
            )}
            {/* When unlocked, show Lock option to lock workflow & strict isolation again */}
            {!locked && onLock && (
              <div className="flex-shrink-0 flex items-center justify-between gap-2 border-b border-border/60 bg-muted/20 px-3 py-2.5">
                <span className="text-xs font-medium text-muted-foreground truncate">Workflow &amp; strict isolation</span>
                <Button onClick={onLock} size="sm" className="!h-6 !px-1 text-xs font-semibold shrink-0" variant='outline'>
                  <Lock className="h-3 w-3" />
                  {/* Lock */}
                </Button>
              </div>
            )}

            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-4 px-3 py-3">
                {/* Workflow Selector — only when unlocked */}
                {!locked && (
                  <div className="space-y-2">
                    <Label className="font-semibold text-sm">Workflow</Label>
                    <Combobox
                      options={workflowOptions}
                      value={selectedWorkflowId ?? ''}
                      onChange={(v) => setSelectedWorkflowId(v ? String(v) : null)}
                      placeholder={flowsLoading ? 'Loading workflows...' : 'Choose a workflow...'}
                      searchPlaceholder="Search workflows..."
                      emptyText="No workflow found."
                      className="!border-slate-300 !text-foreground !h-8 w-full whitespace-nowrap"
                    />
                    {flowsLoading && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading...
                      </div>
                    )}
                  </div>
                )}

                {/* Strict isolation toggle — only when unlocked */}
                {!locked && (
                  <div className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2 bg-muted/10">
                    <div className="flex items-start gap-2">
                      <Shield className="h-4 w-4 text-primary mt-0.5" />
                      <div className="leading-tight">
                        <p className="text-xs font-semibold text-foreground">Strict isolation</p>
                        <p className="text-[10px] text-muted-foreground">
                          Block parent variables unless explicitly mapped
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={strictIsolation}
                      onCheckedChange={setStrictIsolation}
                      aria-label="Toggle strict isolation"
                      className="
                        !h-4 !w-7
                        [&>span]:!h-3 [&>span]:!w-3
                        [&>span]:data-[state=checked]:!translate-x-3
                        [&>span]:data-[state=unchecked]:!translate-x-0.5
                      "
                    />
                  </div>
                )}

                {/* ── Connection Tabs: Input / Output — always enabled (including lock mode) ── */}
                {hasAnyConnections && (
                  <Tabs defaultValue={showInputMap ? 'input' : 'output'} className="w-full mt-1">
                    <TabsList className="w-full">
                      <TabsTrigger value="input" disabled={!showInputMap} className="flex-1 gap-1.5 text-xs">
                        <LogIn className="h-3.5 w-3.5" />
                        Input
                        {inputConnections.length > 0 && (
                          <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px] font-bold rounded">
                            {inputConnections.length}
                          </Badge>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="output" disabled={!showOutputMap} className="flex-1 gap-1.5 text-xs">
                        <LogOut className="h-3.5 w-3.5" />
                        Output
                        {outputConnections.length > 0 && (
                          <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px] font-bold rounded">
                            {outputConnections.length}
                          </Badge>
                        )}
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="input">
                      {showInputMap && (
                        <ConnectionMap
                          title="Input Connections"
                          icon={<LogIn className="h-3 w-3 text-primary" />}
                          leftLabel="Upstream Nodes"
                          rightLabel="Selected Inputs"
                          leftNodes={upstreamAsNodes}
                          rightNodes={selectedInputNodeObjects}
                          accentClass=""
                          portColorClass="border-primary shadow-primary/20"
                          strokeColor="hsl(var(--primary))"
                          connections={inputConnections}
                          onAddConnection={addInputConnection}
                          onRemoveConnection={removeInputConnection}
                          readOnly={false}
                        />
                      )}
                    </TabsContent>

                    <TabsContent value="output">
                      {showOutputMap && (
                        <ConnectionMap
                          title="Output Connections"
                          icon={<LogOut className="h-3 w-3 text-primary" />}
                          leftLabel="Selected Outputs"
                          rightLabel="Downstream Nodes"
                          leftNodes={selectedOutputNodeObjects}
                          rightNodes={downstreamAsNodes}
                          accentClass=""
                          portColorClass="border-primary shadow-primary/20"
                          strokeColor="hsl(var(--primary))"
                          connections={outputConnections}
                          onAddConnection={addOutputConnection}
                          onRemoveConnection={removeOutputConnection}
                          readOnly={false}
                        />
                      )}
                    </TabsContent>
                  </Tabs>
                )}
              </div>
            </ScrollArea>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* ── Right Panel: Flow Preview ── */}
        <ResizablePanel defaultSize={70} minSize={40}>
          {isWorkflowDeleted ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 bg-muted/10">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-destructive/30 bg-destructive/5">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold text-destructive">This flow is deleted</p>
                <p className="text-xs text-muted-foreground/70">
                  The selected workflow is no longer available. Unlock and choose another workflow.
                </p>
              </div>
            </div>
          ) : workflowPreviewId ? (
            <div className="h-full relative">
              <ReactFlowProvider>
                <SubflowMiniViewerFull
                  workflowFlowId={workflowPreviewId}
                  workflowName={selectedWorkflow?.label ?? undefined}
                  inputNodeIds={selectedInputIds}
                  outputNodeIds={selectedOutputIds}
                  onMarkInput={handleFlowMarkInput}
                  onMarkOutput={handleFlowMarkOutput}
                  readOnly={false}
                />
              </ReactFlowProvider>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-3 bg-muted/10">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-dashed border-border/60 bg-muted/20">
                <Workflow className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-muted-foreground/70">No workflow selected</p>
                <p className="text-xs text-muted-foreground/50">Select a workflow to preview its flow</p>
              </div>
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* ── Footer: summary strip + actions (Save independent of lock) ── */}
      <div className="border-t border-border/60 bg-card/80 backdrop-blur-sm">
        {totalSelected > 0 && (
          <div className="flex items-center gap-3 border-b border-border/40 px-4 py-2.5 text-xs text-muted-foreground">
            <Zap className="h-3 w-3 text-primary" />
            <span>
              <span className="font-semibold text-foreground">{selectedInputIds.length}</span> input{selectedInputIds.length !== 1 ? 's' : ''}
              {' '}&middot;{' '}
              <span className="font-semibold text-foreground">{selectedOutputIds.length}</span> output{selectedOutputIds.length !== 1 ? 's' : ''}
              {workflowPreviewId && (
                <>
                  {' '}&middot;{' '}
                  {isWorkflowDeleted ? (
                    <span className="font-medium text-destructive">This flow is deleted</span>
                  ) : selectedWorkflow ? (
                    <span className="font-medium">{selectedWorkflow.label}</span>
                  ) : null}
                </>
              )}
            </span>
          </div>
        )}
        <div className="flex items-center justify-end gap-2 px-4 py-3">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="!h-9 px-5 text-[13px] font-semibold rounded-lg"
          >
            {locked ? 'Close' : 'Cancel'}
          </Button>
          <Button
            onClick={handleSave}
            disabled={totalSelected === 0}
            className="!h-9 px-5 text-[13px] font-semibold shadow-sm shadow-primary/20 rounded-lg transition-all hover:shadow-md hover:shadow-primary/25"
          >
            Save Configuration
            {totalSelected > 0 && (
              <Badge
                variant="secondary"
                className="ml-2 h-5 rounded-md bg-primary-foreground/20 text-primary-foreground text-[10px] font-bold px-1.5"
              >
                {totalSelected}
              </Badge>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default SubflowView;
