import React, { useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  useReactFlow,
  type Node,
  type Edge,
  type NodeTypes,
  MarkerType,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Organization, OrchestrationItemType, HierarchyItem } from '@/types/orchestration';
import { HierarchyNodeWithControls } from '../nodes/HierarchyNodeWithControls';

interface OrchestrationViewerProps {
  organization: Organization;
}

const nodeTypes: NodeTypes = {
  hierarchyNode: HierarchyNodeWithControls,
};

const levelColors: Record<OrchestrationItemType, string> = {
  organization: '#ef4444',
  businessUnit: '#f97316',
  application: '#eab308',
  businessProcess: '#84cc16',
  transaction: '#22c55e',
  table: '#14b8a6',
  project: '#3b82f6',
};

const transformDataToFlow = (org: Organization): { nodes: Node[]; edges: Edge[] } => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const edgeStyle = { strokeWidth: 1.5, stroke: '#9810fa' };
  const markerEnd = { type: MarkerType.ArrowClosed, color: '#9810fa', width: 15, height: 15 };

  const addNodeAndChildren = (item: HierarchyItem) => {
    if (!item) return;

    const safePosition =
      item.position && typeof item.position.x === 'number' && typeof item.position.y === 'number'
        ? item.position
        : { x: 0, y: 0 };

    nodes.push({
      id: item.unique_id,
      type: 'hierarchyNode',
      position: safePosition,
      data: { label: item.name, type: item.type, color: levelColors[item.type], isReadOnly: true },
    });

    if (item.children && Array.isArray(item.children)) {
      item.children.forEach((child: HierarchyItem) => {
        edges.push({
          id: `e-${item.unique_id}-${child.unique_id}`,
          source: item.unique_id,
          target: child.unique_id,
          type: 'smoothstep',
          style: edgeStyle,
          markerEnd,
        });
        addNodeAndChildren(child);
      });
    }
  };

  if (org.hierarchy) {
    addNodeAndChildren(org.hierarchy);
  }

  return { nodes, edges };
};

function FitViewOnLoad({ nodeCount }: { nodeCount: number }) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (nodeCount === 0) return;
    const timer = window.setTimeout(() => {
      fitView({ padding: 0.2, maxZoom: 1, duration: 200 });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [nodeCount, fitView]);

  return null;
}

function OrchestrationFlowCanvas({ organization }: OrchestrationViewerProps) {
  const { nodes, edges } = useMemo(() => transformDataToFlow(organization), [organization]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      zoomOnScroll={false}
      panOnScroll={false}
      zoomOnDoubleClick={false}
      panOnDrag
      proOptions={{ hideAttribution: true }}
      className="bg-muted/10"
    >
      <FitViewOnLoad nodeCount={nodes.length} />
      <Background gap={12} size={1} />
    </ReactFlow>
  );
}

export function OrchestrationViewer({ organization }: OrchestrationViewerProps) {
  return (
    <div className="h-full w-full">
      <ReactFlowProvider>
        <OrchestrationFlowCanvas organization={organization} />
      </ReactFlowProvider>
    </div>
  );
}
