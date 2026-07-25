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

import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  ChevronRight,
  Network,
  Save,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Crosshair,
  Info,
  Layers,
  GitBranch,
} from 'lucide-react';
import {
  createLocationHierarchy,
  updateLocationHierarchy,
  getAllLocationSetups,
  resolveLocationSetupFields,
  resolveLocationSetupUpdateId,
  resolveHierarchyMeta,
  extractHierarchyIdsFromSetups,
  extractHierarchyNamesFromSetups,
  type EnergySetup,
  type DeviceTypeData,
  type LocationSetupContext,
  extractDeviceTypesFromSetupAssets,
  fetchSetupDeviceTypes,
  resolveSetupAssetScope,
  type UpdateLocationHierarchyPayload,
} from '@/controllers/API/energySectorApi';
import { EnergyNodePalette } from './EnergyNodePalette';
import { EnergyNode } from './EnergyNode';
import { LocationSelectForm } from '@/components/forms/LocationSelectForm';
import { serializeEnergyGraph, buildFirstNodeNamePath } from './energyGraphUtils';
import {
  deviceTypeToNodeDetails,
  hierarchyItemToNodeDetails,
  nodeDetailsToHierarchyFields,
  type EnergyNodeDeviceDetails,
} from './energyNodeDetails';
import { toast } from 'sonner';

export type HierarchyNode = {
  unique_id: string;
  name: string;
  type: string;
  child_id?: string;
  position: {
    x: number;
    y: number;
  };
  children?: HierarchyNode[];
  [key: string]: unknown;
};

export type LocationHierarchyPayload = {
  location_id: string;
  location_name: string;
  hierarchy_id: string;
  hierarchy_name: string;
  logo: string;
  description: string;
  hierarchy: HierarchyNode;
  unconnected_nodes: unknown[];
  domain?: string;
  sub_domain?: string;
};

interface EnergySectorEditorProps {
  initialSetup: EnergySetup | null;
  onClose: (savedResult?: unknown) => void;
  isCreating: boolean;
  isWizardMode?: boolean;
  onBack?: () => void;
  locationContext?: LocationSetupContext;
}

const nodeTypes = {
  energyNode: EnergyNode,
};

const edgeProps = {
  type: 'smoothstep',
  style: { strokeWidth: 2, stroke: '#38bdf8' },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#38bdf8', width: 14, height: 14 },
};

const StepIndicator = ({ currentStep }: { currentStep: number }) => {
  const steps = [
    { number: 1, label: 'Scope', completed: currentStep > 1 },
    { number: 2, label: 'Build', completed: currentStep > 2 },
    { number: 3, label: 'Finish', completed: false },
  ];

  return (
    <div className="inline-flex items-center rounded-lg border bg-background p-1 shadow-sm">
      {steps.map((step, index) => {
        const isActive = currentStep === step.number;
        const isCompleted = step.completed;

        return (
          <div key={step.number} className="flex items-center">
            <div className={`flex items-center gap-1.5 rounded-md px-2 py-1 ${isActive ? 'bg-primary/10' : ''}`}>
              <div
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                  isCompleted
                    ? 'bg-primary text-primary-foreground'
                    : isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'border bg-muted text-muted-foreground'
                }`}
              >
                {isCompleted ? (
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span>{step.number}</span>
                )}
              </div>
              <span
                className={`text-xs font-medium ${
                  isActive || isCompleted ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <ChevronRight className={`mx-0.5 h-3.5 w-3.5 ${isCompleted ? 'text-primary' : 'text-muted-foreground/40'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
};

export function EnergySectorEditor({
  initialSetup,
  onClose,
  isCreating,
  isWizardMode = false,
  onBack,
  locationContext,
}: EnergySectorEditorProps) {
  const isUpdateMode = !isCreating && !isWizardMode;
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'editor' | 'form'>('editor');
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [baselineSnapshot, setBaselineSnapshot] = useState<string | null>(null);

  // Transform hierarchy to flow nodes/edges
  useEffect(() => {
    setBaselineSnapshot(null);

    if (initialSetup && (initialSetup as any).hierarchy) {
      const hierarchy = (initialSetup as any).hierarchy;
      const newNodes: Node[] = [];
      const newEdges: Edge[] = [];

      const processNode = (item: any, level = 0) => {
        if (!item) return;

        const id = item.unique_id || item.id || `energy-${Math.random()}`;
        
        newNodes.push({
          id,
          type: 'energyNode',
          position: item.position || { x: 100 + level * 150, y: 100 + level * 100 },
          data: {
            label: item.name,
            type: item.type || 'device',
            deviceDetails: hierarchyItemToNodeDetails(item as Record<string, unknown>),
          },
        });

        if (item.children && Array.isArray(item.children)) {
          item.children.forEach((child: any) => {
            const childId = child.unique_id || child.id || `energy-${Math.random()}`;
            newEdges.push({
              id: `e-${id}-${childId}`,
              source: id,
              target: childId,
              ...edgeProps
            });
            processNode(child, level + 1);
          });
        }
      };

      processNode(hierarchy);

      const unconnectedNodes = (initialSetup as { unconnected_nodes?: unknown[] }).unconnected_nodes;
      if (Array.isArray(unconnectedNodes)) {
        unconnectedNodes.forEach((item: any) => {
          if (!item) return;
          const id = item.unique_id || item.id || `energy-${Math.random()}`;
          newNodes.push({
            id,
            type: 'energyNode',
            position: item.position || { x: 100, y: 100 },
            data: {
              label: item.name,
              type: item.type || 'device',
              deviceDetails: hierarchyItemToNodeDetails(item as Record<string, unknown>),
            },
          });
        });
      }

      setNodes(newNodes);
      setEdges(newEdges);

      if (isUpdateMode) {
        setBaselineSnapshot(serializeEnergyGraph(newNodes, newEdges));
      }
      return;
    }

    setNodes([]);
    setEdges([]);
  }, [initialSetup, isUpdateMode, setNodes, setEdges]);

  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<Node, Edge> | null>(null);
  const [deviceTypes, setDeviceTypes] = useState<DeviceTypeData[]>(() =>
    extractDeviceTypesFromSetupAssets(initialSetup?.assets),
  );
  const [isLoadingDeviceTypes, setIsLoadingDeviceTypes] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const deviceTypesLoadKeyRef = useRef<string | null>(null);

  const assetScopeKey = useMemo(() => {
    const scope = resolveSetupAssetScope(initialSetup, locationContext);
    return [
      initialSetup?.id ?? 'new',
      scope.location || locationContext?.location_name || '',
      scope.domain || locationContext?.domain || '',
      scope.sub_domain || locationContext?.sub_domain || '',
    ].join('|');
  }, [
    initialSetup?.id,
    initialSetup?.location,
    initialSetup?.domain,
    initialSetup?.sub_domain,
    locationContext?.location_name,
    locationContext?.domain,
    locationContext?.sub_domain,
  ]);

  useEffect(() => {
    const prefetched = extractDeviceTypesFromSetupAssets(initialSetup?.assets);
    if (prefetched.length > 0) {
      setDeviceTypes(prefetched);
      deviceTypesLoadKeyRef.current = assetScopeKey;
      return;
    }

    if (deviceTypesLoadKeyRef.current === assetScopeKey) {
      return;
    }
    deviceTypesLoadKeyRef.current = assetScopeKey;

    let cancelled = false;

    const loadDeviceTypes = async () => {
      setIsLoadingDeviceTypes(true);
      try {
        const types = await fetchSetupDeviceTypes(initialSetup, locationContext);
        if (!cancelled) {
          setDeviceTypes(types);
        }
      } catch (error) {
        console.error('Failed to fetch device types:', error);
        if (!cancelled) {
          toast.error('Failed to load device types');
          setDeviceTypes([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingDeviceTypes(false);
        }
      }
    };

    void loadDeviceTypes();

    return () => {
      cancelled = true;
    };
  }, [assetScopeKey, initialSetup?.assets]);

  useEffect(() => {
    if (!deviceTypes.length) return;

    setNodes((nds) =>
      nds.map((node) => {
        const data = node.data as { type?: string; deviceDetails?: EnergyNodeDeviceDetails };
        const existing = data.deviceDetails;
        if (existing?.domain || existing?.sub_domain || existing?.location) return node;

        const device = deviceTypes.find((entry) => entry.device_type === String(data.type ?? ''));
        if (!device) return node;

        return {
          ...node,
          data: {
            ...node.data,
            deviceDetails: deviceTypeToNodeDetails(device),
          },
        };
      }),
    );
  }, [deviceTypes, setNodes]);

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({ ...params, ...edgeProps }, eds));
  }, [setEdges]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    toast.success('Component removed');
  }, [setNodes, setEdges]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowWrapper.current || !reactFlowInstance) return;

      const rawData = event.dataTransfer.getData('application/reactflow');
      
      if (!rawData) return;

      const { nodeType, label, deviceDetails } = JSON.parse(rawData) as {
        nodeType: string;
        label?: string;
        deviceDetails?: EnergyNodeDeviceDetails;
      };
      const nodeId = `energy-${Date.now()}`;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      let resolvedDetails = deviceDetails;
      if (!resolvedDetails) {
        const device = deviceTypes.find((entry) => entry.device_type === nodeType);
        if (device) resolvedDetails = deviceTypeToNodeDetails(device);
      }

      const newNode: Node = {
        id: nodeId,
        type: 'energyNode',
        position,
        data: {
          label: label || nodeType,
          type: nodeType,
          deviceDetails: resolvedDetails,
          onDelete: () => handleDeleteNode(nodeId),
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [deviceTypes, handleDeleteNode, reactFlowInstance, setNodes]
  );

  // Update nodes with delete callback
  const nodesWithCallbacks = useMemo(() => {
    return nodes.map((node) => ({
      ...node,
      data: { 
        ...node.data, 
        onDelete: () => handleDeleteNode(node.id),
      }
    }));
  }, [nodes, handleDeleteNode]);

  const hasChanges = useMemo(() => {
    if (!isUpdateMode || !baselineSnapshot) return false;
    return serializeEnergyGraph(nodes, edges) !== baselineSnapshot;
  }, [baselineSnapshot, edges, isUpdateMode, nodes]);

  const buildHierarchyPayload = useCallback((): LocationHierarchyPayload | null => {
    if (!initialSetup) return null;

    const { location_id, location_name } = resolveLocationSetupFields(initialSetup, locationContext);
    if (!location_id) return null;

    const resolvedLocationName = location_name || String(initialSetup.domain ?? 'Location');
    const existingHierarchy = (initialSetup as { hierarchy?: HierarchyNode }).hierarchy;

    const buildHierarchyNode = (nodeId: string, visited = new Set<string>()): HierarchyNode => {
      if (visited.has(nodeId)) {
        return {
          unique_id: nodeId,
          name: nodeId,
          type: 'device',
          child_id: nodeId,
          position: { x: 0, y: 0 },
          children: [],
        };
      }

      visited.add(nodeId);
      const node = nodes.find((item) => item.id === nodeId);
      const label = node && node.data && typeof node.data === 'object' && 'label' in node.data ? String((node.data as any).label ?? nodeId) : nodeId;
      const type = node && node.data && typeof node.data === 'object' && 'type' in node.data ? String((node.data as any).type ?? 'device') : 'device';
      const deviceDetails =
        node?.data && typeof node.data === 'object' && 'deviceDetails' in node.data
          ? ((node.data as { deviceDetails?: EnergyNodeDeviceDetails }).deviceDetails)
          : undefined;
      const position = node && node.position ? { x: Number((node.position as any).x ?? 0), y: Number((node.position as any).y ?? 0) } : { x: 0, y: 0 };
      const childEdges = edges.filter((edge) => String(edge.source) === nodeId);
      const children = childEdges.map((edge) => buildHierarchyNode(String(edge.target), new Set(visited)));

      return {
        unique_id: nodeId,
        child_id: nodeId,
        name: label,
        type,
        position,
        children,
        ...nodeDetailsToHierarchyFields(deviceDetails),
      };
    };

    const rootIds = nodes
      .filter((node) => !edges.some((edge) => String(edge.target) === node.id))
      .map((node) => node.id);

    const finalRootIds = rootIds.length > 0 ? rootIds : nodes.map((node) => node.id);
    const hierarchyChildren = finalRootIds.map((rootId) => buildHierarchyNode(rootId));

    return {
      location_id,
      location_name: resolvedLocationName,
      hierarchy_id: '',
      hierarchy_name: '',
      logo: String((initialSetup as { logo?: string }).logo ?? ''),
      description: String((initialSetup as { description?: string }).description ?? ''),
      domain: String(initialSetup.domain ?? resolveSetupAssetScope(initialSetup, locationContext).domain ?? ''),
      sub_domain: String(
        initialSetup.sub_domain ??
          (initialSetup as Record<string, unknown>).subDomain ??
          resolveSetupAssetScope(initialSetup, locationContext).sub_domain ??
          '',
      ),
      hierarchy: {
        unique_id: existingHierarchy?.unique_id ?? `root-${location_id}`,
        name: existingHierarchy?.name ?? resolvedLocationName,
        type: existingHierarchy?.type ?? String(initialSetup.domain ?? 'location'),
        position: existingHierarchy?.position ?? { x: 0, y: 0 },
        children: hierarchyChildren,
        industry_type: String(existingHierarchy?.industry_type ?? ''),
        country: String(existingHierarchy?.country ?? ''),
        state: String(existingHierarchy?.state ?? ''),
        city: String(existingHierarchy?.city ?? ''),
        email: String(existingHierarchy?.email ?? ''),
      },
      unconnected_nodes: nodes
        .filter((node) => !edges.some((edge) => String(edge.target) === node.id || String(edge.source) === node.id))
        .map((node) => {
          const deviceDetails =
            node.data && typeof node.data === 'object' && 'deviceDetails' in node.data
              ? ((node.data as { deviceDetails?: EnergyNodeDeviceDetails }).deviceDetails)
              : undefined;

          return {
            unique_id: node.id,
            name: node.data && typeof node.data === 'object' && 'label' in node.data ? String((node.data as any).label ?? '') : '',
            type: node.data && typeof node.data === 'object' && 'type' in node.data ? String((node.data as any).type ?? '') : '',
            position: node.position ? { x: Number((node.position as any).x ?? 0), y: Number((node.position as any).y ?? 0) } : { x: 0, y: 0 },
            ...nodeDetailsToHierarchyFields(deviceDetails),
          };
        }),
    };
  }, [edges, initialSetup, locationContext, nodes]);

  const attachHierarchyMeta = useCallback(
    async (payload: LocationHierarchyPayload, keepExistingId: boolean): Promise<LocationHierarchyPayload> => {
      let existingHierarchyIds: string[] = [];
      let existingHierarchyNames: string[] = [];
      try {
        const response = await getAllLocationSetups(payload.location_id);
        existingHierarchyIds = extractHierarchyIdsFromSetups(response.data ?? []);
        existingHierarchyNames = extractHierarchyNamesFromSetups(response.data ?? []);
      } catch {
        existingHierarchyIds = [];
        existingHierarchyNames = [];
      }

      const nodeNamePath = buildFirstNodeNamePath(nodes, edges);
      const meta = resolveHierarchyMeta(initialSetup, {
        existingHierarchyIds,
        existingHierarchyNames,
        keepExistingId,
        locationId: payload.location_id,
        locationName: payload.location_name,
        nodeNamePath,
      });
      return { ...payload, ...meta };
    },
    [edges, initialSetup, nodes],
  );

  const handleUpdate = async () => {
    if (!isUpdateMode || !hasChanges || isSaving) return;

    const payload = buildHierarchyPayload();
    const updateId = resolveLocationSetupUpdateId(initialSetup);

    if (!updateId) {
      toast.error('Missing update id for hierarchy update.');
      return;
    }

    if (!payload) {
      toast.error('Missing location information for hierarchy update.');
      return;
    }

    setIsSaving(true);
    try {
      const payloadWithMeta = await attachHierarchyMeta(payload, true);
      const updatePayload: UpdateLocationHierarchyPayload = {
        update_id: updateId,
        location_id: payloadWithMeta.location_id,
        location_name: payloadWithMeta.location_name,
        hierarchy_id: payloadWithMeta.hierarchy_id,
        hierarchy_name: payloadWithMeta.hierarchy_name,
        logo: payloadWithMeta.logo,
        description: payloadWithMeta.description,
        hierarchy: payloadWithMeta.hierarchy,
        unconnected_nodes: payloadWithMeta.unconnected_nodes,
      };

      await updateLocationHierarchy(updatePayload);
      toast.success('Hierarchy updated successfully');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update hierarchy.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (isUpdateMode) {
      await handleUpdate();
      return;
    }

    if (!isWizardMode) {
      toast.success('Visual configuration saved. Now complete the energy system details.');
      setMode('form');
      return;
    }

    if (isSaving) return;

    const payload = buildHierarchyPayload();
    if (!payload) {
      toast.error('Missing location information for hierarchy creation.');
      return;
    }

    setIsSaving(true);
    try {
      const payloadWithMeta = await attachHierarchyMeta(payload, false);
      if (!payloadWithMeta.hierarchy_id.trim() || !payloadWithMeta.hierarchy_name.trim()) {
        toast.error('Could not generate hierarchy ID or name. Add nodes to the canvas and try again.');
        return;
      }
      const result = await createLocationHierarchy(payloadWithMeta);
      toast.success('Hierarchy saved successfully');
      onClose(result);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save hierarchy.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFormSuccess = (data: unknown) => {
    console.log('Final Setup Data:', data);
    onClose();
  };

  const handleBackClick = () => {
    if (mode === 'form') {
      setMode('editor');
    } else if (onBack) {
      onBack();
    } else {
      onClose();
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleFitView = () => {
    reactFlowInstance?.fitView({ padding: 0.2, maxZoom: 1 });
  };

  const handleZoomIn = () => {
    reactFlowInstance?.zoomIn({ duration: 200 });
  };

  const handleZoomOut = () => {
    reactFlowInstance?.zoomOut({ duration: 200 });
  };

  const canvasToolbarItems = [
    ...(isUpdateMode
      ? []
      : [{ icon: Save, label: 'Save layout', color: 'text-emerald-600', onClick: handleSave, disabled: isSaving }]),
    { icon: GitBranch, label: 'Hierarchy view', color: 'text-blue-600', onClick: () => toast.info('Hierarchy view coming soon') },
    { icon: Layers, label: 'Layers', color: 'text-purple-600', onClick: () => toast.info('Layers panel coming soon') },
    { icon: Info, label: 'Properties', color: 'text-sky-600', onClick: () => toast.info('Properties panel coming soon') },
    { icon: ZoomIn, label: 'Zoom in', color: 'text-amber-600', onClick: handleZoomIn },
    { icon: ZoomOut, label: 'Zoom out', color: 'text-amber-600', onClick: handleZoomOut },
    { icon: Crosshair, label: 'Fit to view', color: 'text-indigo-600', onClick: handleFitView },
  ];

  const pageTitle = isUpdateMode ? 'Update Setup' : initialSetup?.domain || 'New Setup';
  const pageDescription = isUpdateMode
    ? 'Modify the hierarchy layout and save your changes.'
    : mode === 'editor'
      ? 'Arrange assets and define hierarchy relationships.'
      : 'Provide specific details for your renewable energy system.';

  return (
    <div className="w-full h-full flex flex-col bg-background">
      <header className="z-10 flex flex-wrap items-center justify-between gap-3 border-b bg-background px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Network className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-foreground">
              {pageTitle}
            </h2>
            <p className="text-xs text-muted-foreground">
              {pageDescription}
            </p>
          </div>
        </div>
        
        {isWizardMode && mode === 'editor' && <StepIndicator currentStep={2} />}
        
        <div className="flex gap-2">
          <Button variant="outline" size="icon" className='!h-9 !w-9' onClick={toggleFullscreen} title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button variant="outline" className='!px-3 !h-9' onClick={handleBackClick}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {mode === 'form' ? 'Back to Editor' : 'Back'}
          </Button>
          {mode === 'editor' && !isUpdateMode && (
            <Button className='!px-3 !h-9' onClick={handleSave} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save & Continue'}
            </Button>
          )}
          {mode === 'editor' && isUpdateMode && hasChanges && (
            <Button className='!px-3 !h-9' onClick={() => void handleUpdate()} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'Updating...' : 'Update & Continue'}
            </Button>
          )}
        </div>
      </header>

      <div className="relative flex-grow overflow-hidden bg-muted/40">
        {mode === 'editor' ? (
          <div className="flex h-full gap-2 p-2">
            {!isFullscreen && (
              <EnergyNodePalette
                deviceTypes={deviceTypes}
                isLoading={isLoadingDeviceTypes}
                isUpdateMode={isUpdateMode}
              />
            )}
            <div className="relative flex-grow overflow-hidden rounded-xl border bg-background shadow-inner" ref={reactFlowWrapper}>
              <div className="absolute left-0 right-0 top-0 z-10 flex items-center gap-0.5 border-b bg-background/95 px-2 py-1 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                {canvasToolbarItems.map((item) => (
                  <Button
                    key={item.label}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-muted/60"
                    title={item.label}
                    onClick={item.onClick}
                    disabled={item.disabled}
                  >
                    <item.icon className={`h-4 w-4 ${item.color}`} />
                  </Button>
                ))}
              </div>
              <ReactFlowProvider>
                <ReactFlow<Node, Edge>
                  nodes={nodesWithCallbacks}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onInit={setReactFlowInstance}
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  nodeTypes={nodeTypes}
                  defaultViewport={{ x: 0, y: 0, zoom: 1 }}
                  minZoom={0.4}
                  maxZoom={1.5}
                  fitView
                  fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
                  className="bg-muted/30 pt-10"
                >
                  <Controls />
                  <Background gap={20} size={1} color="var(--border)" />
                </ReactFlow>
              </ReactFlowProvider>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-auto p-8">
            <div className="max-w-4xl mx-auto">
              <LocationSelectForm 
                onSuccess={handleFormSuccess}
                className="shadow-xl border-none"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
