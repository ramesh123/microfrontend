import React, { memo, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  NodeProps,
  Edge,
  Node,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { 
  Building2, 
  GitBranch, 
  Database, 
  Pencil, 
  Trash2, 
  X,
  Network
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ENERGY_CATEGORY_META, getEnergyNodeConfig, type EnergyNodeConfig } from './energyNodeConfig';
import { WorkflowStyleNodeCard } from './WorkflowStyleNodeCard';
import { hierarchyItemToNodeDetails } from './energyNodeDetails';

// --- Custom Node Component ---

const LEGACY_NODE_TYPES_CONFIG = {
  organization: {
    label: 'SETUP',
    color: 'bg-purple-600',
    icon: Building2,
  },
  'business process': {
    label: 'PROCESS',
    color: 'bg-green-600',
    icon: Network,
  },
  project: {
    label: 'EXECUTION',
    color: 'bg-red-600',
    icon: Database,
  },
  location: {
    label: 'SETUP',
    color: 'bg-purple-600',
    icon: Building2,
  },
};

function resolveVisualNodeConfig(rawType: string, deviceIcon?: string): EnergyNodeConfig {
  const typeKey = rawType.toLowerCase();
  if (rawType.trim() || deviceIcon) {
    return getEnergyNodeConfig(rawType, deviceIcon);
  }

  const legacyConfig = LEGACY_NODE_TYPES_CONFIG[typeKey as keyof typeof LEGACY_NODE_TYPES_CONFIG];
  const base = ENERGY_CATEGORY_META.OTHER;

  return {
    icon: legacyConfig?.icon ?? Building2,
    category: 'OTHER',
    abbr: legacyConfig?.label?.slice(0, 2) ?? 'ND',
    label: legacyConfig?.label ?? 'Node',
    badgeColor: legacyConfig?.color ?? base.badgeColor,
    iconBg: base.iconBg,
    iconColor: base.iconColor,
    borderColor: base.borderColor,
  };
}

const VisualHierarchyNode = memo(({ data }: NodeProps<any>) => {
  const rawType = String(data.type ?? '').trim();
  const deviceDetails = data.deviceDetails ?? hierarchyItemToNodeDetails(data as Record<string, unknown>);
  const config = resolveVisualNodeConfig(rawType, deviceDetails?.device_icon);

  return (
    <WorkflowStyleNodeCard
      label={String(data.label ?? 'Node')}
      type={rawType || 'node'}
      config={config}
      deviceDetails={deviceDetails}
      isReadOnly
    />
  );
});

// --- Layout Helper ---

const transformToFlow = (hierarchy: any) => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  
  const processNode = (item: any, defaultX = 0, defaultY = 0, level = 0) => {
    if (!item) return;

    const id = item.unique_id || item.id || `node-${Math.random()}`;
    
    // Use position from API if available, otherwise use defaults
    const position = item.position && typeof item.position.x === 'number' && typeof item.position.y === 'number'
      ? item.position
      : { x: defaultX, y: defaultY };

    nodes.push({
      id,
      type: 'visualNode',
      position,
      data: {
        label: item.name,
        type: item.type || (level === 0 ? 'location' : 'device'),
        deviceDetails: hierarchyItemToNodeDetails(item as Record<string, unknown>),
      },
    });

    if (item.children && Array.isArray(item.children)) {
      item.children.forEach((child: any, index: number) => {
        const childId = child.unique_id || child.id || `node-${Math.random()}`;
        
        edges.push({
          id: `e-${id}-${childId}`,
          source: id,
          target: childId,
          type: 'smoothstep',
          style: { stroke: '#38bdf8', strokeWidth: 2 },
          animated: false,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#38bdf8',
            width: 14,
            height: 14,
          },
        });

        // If child doesn't have a position, calculate one based on parent
        processNode(child, position.x + (index * 50), position.y + 150, level + 1);
      });
    }
  };

  processNode(hierarchy);
  return { nodes, edges };
};

// --- Fit View Component ---

function FitViewOnLoad() {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const timer = setTimeout(() => {
      fitView({ padding: 0.2, duration: 400 });
    }, 100);
    return () => clearTimeout(timer);
  }, [fitView]);
  return null;
}

// --- Main Visualizer Component ---

const nodeTypes = {
  visualNode: VisualHierarchyNode,
};

interface HierarchyVisualizerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  data: any;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function HierarchyVisualizer({ 
  isOpen, 
  onOpenChange, 
  data,
  onEdit,
  onDelete
}: HierarchyVisualizerProps) {
  const { nodes, edges } = useMemo(() => {
    if (!data?.hierarchy) return { nodes: [], edges: [] };
    return transformToFlow(data.hierarchy);
  }, [data]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1200px] h-[80vh] p-0 overflow-hidden border-none shadow-2xl">
        <div className="flex flex-col h-full bg-white rounded-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b bg-white z-20">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-800">{data?.location_name || 'Hierarchy View'}</h2>
            </div>
            <div className="flex items-center gap-3">
              {onEdit ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full hover:bg-gray-100"
                  onClick={onEdit}
                >
                  <Pencil className="h-4 w-4 text-gray-600" />
                </Button>
              ) : null}
              {onDelete ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full hover:bg-gray-100"
                  onClick={onDelete}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              ) : null}
              <Button 
                variant="destructive" 
                className="h-9 px-6 rounded-full font-bold text-sm bg-[#ff4d4d] hover:bg-[#ff3333]"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </div>
          </div>

          {/* Flow Area */}
          <div className="flex-1 relative bg-[#f8f9fc]">
            <ReactFlowProvider>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                fitView
                nodesDraggable={false}
                nodesConnectable={false}
                zoomOnScroll={true}
                panOnDrag={true}
                proOptions={{ hideAttribution: true }}
              >
                <Background 
                  color="#e2e8f0" 
                  gap={20} 
                  size={1} 
                  variant={BackgroundVariant.Dots} 
                />
                <FitViewOnLoad />
              </ReactFlow>
            </ReactFlowProvider>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
