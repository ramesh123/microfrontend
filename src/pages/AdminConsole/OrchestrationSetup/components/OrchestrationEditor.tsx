import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  type Node,
  type Edge,
  type Connection,
  addEdge,
  type ReactFlowInstance,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Organization, OrchestrationItemType, HierarchyItem } from '@/types/orchestration';
import { useOrganizationStore } from '@/stores/organizationStore';
import { useOrchestrationStore } from '@/stores/orchestrationStore';
import { OrchestrationNodePalette } from './OrchestrationNodePalette';
import { HierarchyNodeWithControls } from '../nodes/HierarchyNodeWithControls';
import { HierarchyItemEditModal } from '@/modals/HierarchyItemEditModal';
import { toast } from 'sonner';
import { getDisplayErrorMessage, resolveApiErrorMessage } from '@/utils/exceptionHelper';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save } from 'lucide-react';
import { orchestrationNodeApi } from '@/controllers/API/orchestrationNodeApi';
import { useRbacStore } from '@/stores/useRBACStore';

interface OrchestrationEditorProps {
  initialOrganization: Organization;
  onClose: () => void;
  isCreating: boolean;
}

interface NodeProps {
  unique_id?: string;
}



const edgeProps = {
  type: 'smoothstep',
  style: { strokeWidth: 2, stroke: '#9810fa' },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#9810fa', width: 15, height: 15 }
};

const transformOrgToFlow = (org: Organization) => {
  const nodes: any[] = [];
  const edges: Edge[] = [];

  const addNodeAndChildren = (item: HierarchyItem, parentItem?: HierarchyItem) => {
    if (!item) return;
    const safePosition = (item.position && typeof item.position.x === 'number' && typeof item.position.y === 'number')
      ? item.position : { x: Math.random() * 400, y: Math.random() * 400 };

    // Store the full item data in the node
    nodes.push({
      id: item.unique_id || item.id,
      unique_id: item.unique_id || item.id,
      type: 'hierarchyNode',
      position: safePosition,
      data: {
        label: item.name,
        type: item.type,
        fullData: item
      }
    });

    // Create edge from parent to this child
    if (parentItem) {
      edges.push({
        id: `e-${parentItem.unique_id || parentItem.id}-${item.unique_id || item.id}`,
        source: parentItem.unique_id || parentItem.id,
        target: item.unique_id || item.id,
        ...edgeProps
      });
    }

    if (item.children && Array.isArray(item.children)) {
      item.children.forEach((child: HierarchyItem) => {
        addNodeAndChildren(child, item);
      });
    }
  };

  if (org.hierarchy) addNodeAndChildren(org.hierarchy);
  if (org.unconnectedNodes && Array.isArray(org.unconnectedNodes)) {
    org.unconnectedNodes.forEach(node => {
      const safePosition = (node.position && typeof node.position.x === 'number' && typeof node.position.y === 'number')
        ? node.position : { x: Math.random() * 400, y: Math.random() * 400 };
      nodes.push({
        id: node.unique_id || node.id,
        unique_id: node.unique_id || node.id,
        type: 'hierarchyNode',
        position: safePosition,
        data: {
          label: node.name,
          type: node.type,
          fullData: node
        }
      });
    });
  }
  return { initialNodes: nodes, initialEdges: edges };
};

const reconstructHierarchy = (nodes: Node[], edges: Edge[]) => {
  const nodeMap = new Map(nodes.map(n => [n.id, { ...n, children: [] }]));
  const rootNodes = new Set(nodes.map(n => n.id));

  edges.forEach(edge => {
    const parent = nodeMap.get(edge.source);
    const child = nodeMap.get(edge.target);
    if (parent && child) {
      (parent.children as any).push(child);
      rootNodes.delete(edge.target);
    }
  });

  const buildHierarchyItem = (node: any): HierarchyItem => ({
    ...node.data.fullData,
    id: node.id,
    unique_id: node.id,
    name: node.data.label,
    type: node.data.type,
    position: node.position,
    children: node.children.map(buildHierarchyItem),
  });

  const hierarchyRoots = Array.from(rootNodes).map(id => nodeMap.get(id)!);
  const orgNode = hierarchyRoots.find(n => n.data.type === 'organization');
  const unconnectedNodes = hierarchyRoots.filter(n => n.data.type !== 'organization').map(buildHierarchyItem);

  return {
    hierarchy: orgNode ? buildHierarchyItem(orgNode) : null,
    unconnectedNodes
  };
};


export function OrchestrationEditor({ initialOrganization, onClose, isCreating }: OrchestrationEditorProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const { initialNodes, initialEdges } = useMemo(() => transformOrgToFlow(initialOrganization), [initialOrganization]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<any, Edge> | null>(null);
  const [editingNode, setEditingNode] = useState<Node | null>(null);
  const [orgDetails, setOrgDetails] = useState<Partial<Organization>>(initialOrganization);

  const { getOrganizationPerspectives, currentUser } = useRbacStore();
  const { setCurrentOrganization } = useOrchestrationStore();
const nodeTypes: any = {
  hierarchyNode: HierarchyNodeWithControls,
};
  // When editing an existing orchestration, set the organization from the hierarchy data
  useEffect(() => {
    if (initialOrganization?.org_id && initialOrganization?.org_name) {
      setCurrentOrganization({
        id: initialOrganization.org_id,
        name: initialOrganization.org_name
      });
    }
  }, [initialOrganization, setCurrentOrganization]);
const [isDirty, setIsDirty] = useState(false);

const onConnect = useCallback((params: Connection) => {
  setEdges((eds) => addEdge({ ...params, ...edgeProps }, eds));
}, [setEdges]);
  const onDragOver = useCallback((event: React.DragEvent) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }, []);

  const onDrop = useCallback((event: React.DragEvent) => { 
    event.preventDefault();
    if (!reactFlowWrapper.current || !reactFlowInstance) return;
    const dataString = event.dataTransfer.getData('application/reactflow');
    if (!dataString) return;
    
    const { nodeType, isExistingOrg, existingOrgData } = JSON.parse(dataString) as { 
      nodeType: OrchestrationItemType; 
      isExistingOrg?: boolean;
      existingOrgData?: any;
    };

    if (typeof nodeType === 'undefined' || !nodeType) { return; }
    
    // For organization nodes, check if one already exists
    if (nodeType === 'organization') {
      const existingOrgNode = nodes.find(node => node.data.type === 'organization');
      if (existingOrgNode) {
        toast.info("Only one organization node is allowed per setup.");
        return;
      }
    }
    const position = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });

    const newNode: any = {
      id: isExistingOrg ? `org-${existingOrgData.apiId}` : `${nodeType}-${Date.now()}`,
      unique_id: isExistingOrg ? `org-${existingOrgData.apiId}` : `${nodeType}-${Date.now()}`,
      type: 'hierarchyNode',
      position,
      data: { 
        label: isExistingOrg ? existingOrgData.name : `New ${nodeType.replace(/([A-Z])/g, ' $1').trim()}`, 
        type: nodeType,
        fullData: isExistingOrg ? existingOrgData : undefined,
        isExistingOrg
      }
    };

    setNodes(nds => nds.concat(newNode));
    if (isExistingOrg) {
      toast.success(`Importing existing organization "${existingOrgData.name}"...`);
      
      // Fetch full details and fill the form
      const fetchFullDetails = async () => {
        try {
          const fullDetails = await orchestrationNodeApi.getOrganizationSetup(existingOrgData.apiId);
          const data = fullDetails?.data || fullDetails;
          
          // Note: map keys if necessary to match OrganizationFormData
          const mappedData = {
            ...data,
            name: data.organization_name || data.name,
            apiId: data.id || data.apiId,
          };

          const updatedNode = {
            ...newNode,
            data: {
              ...newNode.data,
              fullData: mappedData
            }
          };

          setNodes(nds => nds.map(n => n.id === newNode.id ? updatedNode : n));
          setEditingNode(updatedNode);
          toast.success(`Loaded details for "${mappedData.name}".`);
        } catch (error) {
          console.error("Failed to fetch full org details:", error);
          toast.error("Failed to load full organization details. Using available data.");
          setEditingNode(newNode);
        }
      };

      fetchFullDetails();
    } else {
      toast.info(`Added new ${nodeType} node to the canvas.`);
    }
  }, [reactFlowInstance, setNodes, nodes]);
const onNodeDragStop = useCallback((_: any, node: any) => {
  setNodes((nds) =>
    nds.map((n: any) =>
      n.unique_id === node.unique_id
        ? { ...n, position: node.position }
        : n
    )
  );
}, [setNodes]);
useEffect(() => {
  // If it's a new setup (both initialNodes and initialEdges are empty), 
  // it's dirty if any nodes or edges have been added.
  if (initialNodes.length === 0 && initialEdges.length === 0) {
    setIsDirty(nodes.length > 0 || edges.length > 0);
    return;
  }

  const currentState = JSON.stringify({
    nodes: nodes.map((n) => ({
      id: n.id,
      position: n.position,
      data: n.data,
    })),
    edges,
  });

  const initialState = JSON.stringify({
    nodes: initialNodes.map((n) => ({
      id: n.id,
      position: n.position,
      data: n.data,
    })),
    edges: initialEdges,
  });

  setIsDirty(currentState !== initialState);
}, [nodes, edges, initialNodes, initialEdges]);
  const handleDeleteNode = useCallback((nodeId: string) => { 
    const nodesToDelete = new Set<string>();
    const queue = [nodeId];

    while (queue.length > 0) { 
      const currentId = queue.shift()!;
      if (!nodesToDelete.has(currentId)) {
        nodesToDelete.add(currentId);
        const children = edges.filter(e => e.source === currentId).map(e => e.target);
        queue.push(...children);
      }
    } 

    setNodes(nds => nds.filter(n => !nodesToDelete.has(n.id)));
    setEdges(eds => eds.filter(e => !nodesToDelete.has(e.source) && !nodesToDelete.has(e.target)));
    toast.success(`Deleted node and its descendants.`);

  }, [edges, setNodes, setEdges]);

  const handleSaveNodeData = useCallback((nodeId: string, data: any) => {
    setNodes(nds => nds.map((node: any) => {
      if (node.unique_id === nodeId) {
        const updatedNode = { ...node, data: { ...node.data, label: data.name, fullData: data } };
        if (node.data.type === 'organization') {
          setOrgDetails(prev => ({ ...prev, ...data }));
        }
        return updatedNode;
      }
      return node;
    }));
    toast.success(`Updated "${data.name}".`);
    setEditingNode(null);
  }, [setNodes]);

  const handleSaveAndClose = async () => {
    const { hierarchy, unconnectedNodes } = reconstructHierarchy(nodes, edges);

    if (!hierarchy) {
      toast.error("An organization node is required to save the flow.");
      return;
    }

    try {
      // Find the organization node to get the org_id from the API response
      const orgNode = nodes.find(node => node.data.type === 'organization');
      
      // Try to get org_id from node data, then fallback to initialOrganization
      const orgApiId = orgNode?.data?.fullData?.apiId || 
                       orgNode?.data?.apiData?.id || 
                       initialOrganization?.org_id;
      
      if (!orgApiId) {
        toast.error("Please save the organization node first to get the org_id.");
        return;
      }

      // Prepare the organization setup data
      const setupData: any = {
        org_id: orgApiId.toString(),
        hierarchy: hierarchy,
        org_name: orgDetails.name || hierarchy.name,
        unconnectedNodes: unconnectedNodes
      };

      // If updating, include the setup ID as update_id
      if (!isCreating && initialOrganization?.id) {
        setupData.update_id = initialOrganization.id.toString();
      }
      
      // Call the organization setup API
      const setupResponse: any = isCreating 
        ? await orchestrationNodeApi.createOrganizationSetup(setupData)
        : await orchestrationNodeApi.updateOrganizationSetup(setupData);

      if (setupResponse.status === true) {
        toast.success(setupResponse.message);
        await getOrganizationPerspectives(currentUser, currentUser);
      } else {
        toast.error(resolveApiErrorMessage(setupResponse, 'Failed to save organization setup'));
      }

      onClose();
    } catch (error) {
      console.error("Error saving organization setup:", error);
      toast.error(getDisplayErrorMessage(error, 'Failed to save organization setup'));
    }
  };

  const nodesWithCallbacks = useMemo(() => { 
    return nodes.map((node: any) => ({
      ...node,
      data: { ...node.data, onEdit: () => setEditingNode(node), onDelete: () => handleDeleteNode(node.id) }
    }))
  }, [nodes, handleDeleteNode]);

  /** ID of the organization node already on the canvas (if any) */
  const placedExistingOrgId = useMemo(() => {
    const orgNode = nodes.find(n => n.data.type === 'organization');
    const rawId = orgNode?.data?.fullData?.apiId || orgNode?.data?.apiData?.id;
    return rawId ? Number(rawId) : null;
  }, [nodes]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <header className="sticky top-0 z-30 flex shrink-0 items-center justify-between gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="min-w-0">
          <h2 className="truncate text-[16px] font-semibold">Orchestration Editor: {orgDetails.org_name}</h2>
          <p className="text-xs text-muted-foreground">Build your organization&apos;s hierarchy visually.</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="outline" className="!h-8 !px-2" onClick={onClose}><ArrowLeft className="mr-0 h-4 w-4" />Back</Button>
          <Button 
            className="!h-8 !px-2 disabled:cursor-not-allowed disabled:opacity-50" 
            onClick={handleSaveAndClose} 
            disabled={!isDirty}
          >
            <Save className="mr-0 h-4 w-4" />
            Save & Close
          </Button>       
          </div>
      </header>
      <div className="flex min-h-0 flex-1 gap-2 p-2">
        <OrchestrationNodePalette 
          organizations={[]} 
          placedExistingOrgId={placedExistingOrgId}
          isEditMode={!!editingNode}
        />
        <div className="h-100vh flex-grow rounded-lg border bg-muted/20" ref={reactFlowWrapper}>
          <ReactFlowProvider>
            <ReactFlow nodes={nodesWithCallbacks} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onInit={(instance) => setReactFlowInstance(instance)} onDrop={onDrop} onDragOver={onDragOver} onNodeDragStop={onNodeDragStop} nodeTypes={nodeTypes} defaultViewport={{ x: 0, y: 0, zoom: 0.8 }} minZoom={0.1} maxZoom={2}>
              <Controls /><Background gap={16} size={1} />
            </ReactFlow>
          </ReactFlowProvider>
        </div>
      </div>
      {editingNode && <HierarchyItemEditModal node={editingNode} isOpen={!!editingNode} onClose={() => setEditingNode(null)} onSave={handleSaveNodeData} />}
    </div>
  );

}
