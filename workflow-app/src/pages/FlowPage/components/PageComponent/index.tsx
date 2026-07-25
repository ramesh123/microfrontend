import ForwardedIconComponent from "@/components/common/genericIconComponent";
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import { Button } from "@/components/ui/button";
import {
  Node,
  addEdge,
  Background,
  BackgroundVariant,
  Connection,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  NodeTypes,
  EdgeTypes,
  Edge,
  ConnectionMode,
} from "@xyflow/react";
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSidebarStore } from "@/stores/sidebarStore";
import { cn } from "@/lib/utils";
import { ZoomSlider } from "@/components/zoom-slider";
import GenericNode from "@/customNodes/GenericNode";
import { useNodeStore } from "@/stores/nodeStore";
import { useSaveWorkflow } from "@/hooks/use-save-flow";
import useFlowStore from "@/stores/flowStore";
import { isSupportedNodeTypes } from "@/utils/utils";
import { WORKFLOW_PIPELINE_DATA_TYPE } from "@/pages/FlowPage/SideBar/PipelineItem";
import { useFlowsManagerStore } from "@/stores/flowManagerStore";
import api from "@/controllers/API/api";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import SliderComponent from "@/components/common/sheet-component";
import { useExecuteWorkflow } from "@/hooks/use-execute-flow";
import { toast } from "sonner";
import { ExecuteWorkflowDialog, ExecuteParams } from "./ExecuteWorkflowDialog";
import { useAutoSave } from "@/hooks/use-auto-save";
import { CustomEdgeWithRemove } from "@/customEdges";
import { useSheetStore } from "@/stores/sheetStore";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { createDeployment, createDraftWorkflowApi, deleteDraftWorkflowApi, getDraftWorkflowByDraftIdApi, getVersionByIdApi, getVirtualDatasetByIdApi, getWorkflowByIdApi, saveWorkflow } from "@/controllers/API";
import {
  enrichVirtualDatasetNodesWithTemplates,
  ensureWorkflowViewport,
  normalizeVirtualDatasetToWorkflow,
} from "@/utils/workflowUtils";
import { prefetchNodeIconsForWorkflow } from "@/utils/styleUtils";
import {
  loadVirtualDbCanvasLayout,
  mergeVirtualDbLayoutIntoWorkflow,
  saveVirtualDbCanvasLayout,
} from "@/utils/virtualDbCanvasLayout";
import { eagerHydrateSourceNodesAfterWorkflowLoad } from "@/utils/eagerSourceNodePreview";
import { isRequestAborted } from "@/utils/apiAbort";
import {
  abortWorkflowLoadSession,
  getWorkflowLoadSignal,
  startWorkflowLoadSession,
} from "@/utils/workflowLoadSession";
import { WorkflowInfoSheet } from "./WorkflowInfoSheet";
import { SaveWorkflowDialog } from "./SaveWorkflowDialog";
import { WorkflowDetailsSaveDialog, hasWorkflowDetails } from "./WorkflowDetailsSaveDialog";
import { usePredicateChatStore } from '@/stores/usePredicateChatStore';
import { VersionsDropdown } from "../AiChatbox";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, Database, X, Loader, Clock, Badge } from "lucide-react";
import { buildPayloadFromEnabledNodes } from "@/utils/virtualDatasetPayload";
import AIimage from "@/assets/images/ai.png";
import VirtualDB from "@/components/common/virtualdb";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FlowNameOnlyForm } from "@/pages/HomePage/components/FlowNameOnlyForm";

type FormValues = z.infer<typeof formSchema>;
const edgeTypes: EdgeTypes = {
  customEdge: CustomEdgeWithRemove,
};

const STATUS_STYLES: { [key: string]: string } = {
  COMPLETED: "bg-green-100 text-green-700",
  RUNNING: "bg-blue-100 text-blue-700",
  FAILED: "bg-red-100 text-red-700",
};

const formSchema = z.object({
  flowName: z
    .string()
    .min(1, { message: "Flow name is required." })
    .min(3, { message: "Flow name must be at least 3 characters." })
    .max(50, { message: "Flow name must not exceed 50 characters." }),
  deploymentName: z
    .string()
    .min(1, { message: "Deployment name is required." })
    .min(3, { message: "Deployment name must be at least 3 characters." })
    .max(50, { message: "Deployment name must not exceed 50 characters." })
    .regex(/^[a-zA-Z0-9-_]+$/, {
      message:
        "Deployment name can only contain letters, numbers, hyphens, and underscores.",
    }),
});

// Create memoized node components outside the main component
const ViewModeGenericNode = React.memo((props: any) => <GenericNode {...props} mode="view" />);
const EditModeGenericNode = React.memo((props: any) => <GenericNode {...props} mode="edit" />);

ViewModeGenericNode.displayName = 'ViewModeGenericNode';
EditModeGenericNode.displayName = 'EditModeGenericNode';

// FlowStatusBadge component
const FlowStatusBadge = React.memo(({ status }: { status: string | null }) => {
  if (!status || !STATUS_STYLES[status]) {
    return null;
  }

  return (
    <span
      className={`px-2.5 py-1.5 text-xs font-semibold rounded-md flex items-center justify-center ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
});

FlowStatusBadge.displayName = 'FlowStatusBadge';

// Stable fit view options
const FIT_VIEW_OPTIONS = {
  padding: 0.2,
  minZoom: 0.1,
  maxZoom: 1,
};

function FlowWithDnD( {
  mode,
  onOpenAi,
  suppressNodeSheetBackdropClose,
}: {
  mode: "view" | "edit";
  onOpenAi?: () => void;
  /** When true, node config sheet dimmer ignores clicks (avoids closing sheet right after ASK AI closes). */
  suppressNodeSheetBackdropClose?: boolean;
}) {
  const isViewMode = mode === "view";
  const nodeTypes: NodeTypes = useMemo(() => ({
    genericNode: mode === "view" ? ViewModeGenericNode : EditModeGenericNode,
  }), [mode]);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const isCollapsed = useSidebarStore((state) => state.isCollapsed);
  const toggleSidebar = useSidebarStore((state) => state.toggleSidebar);
  const takeSnapshot = useFlowsManagerStore((state) => state.takeSnapshot);

  const currentWorkflow = useFlowStore((state) => state.currentWorkflow);   // Get stable references to handlers
  const onNodesChange = useFlowStore((state) => state.onNodesChange);
  const onEdgesChange = useFlowStore((state) => state.onEdgesChange);
  const onConnect = useFlowStore((state) => state.onConnect);
  const addNode = useFlowStore((state) => state.addNode);
  const setViewport = useFlowStore((state) => state.setViewport);
  const setOutputNode = useFlowStore((state) => state.setOutputNode);

  const setReactFlowInstance: any = useFlowStore((state) => state.setReactFlowInstance);
  const reactFlowInstance = useFlowStore((state) => state.reactFlowInstance);
  const [open, setOpen] = useState(false);

  const selectedNode = useFlowStore((state) => state.getSelectedNode());
  const sheetStore = useSheetStore();
  const isPredicateChatOpen = usePredicateChatStore((state) => state.isOpen);
  // const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Save workflow mutation
  const { mutate, isPending } = useSaveWorkflow();
  const { mutate: executeMutate, isPending: isExecuting } = useExecuteWorkflow();
  // const flowId = useFlowsManagerStore((state) => state.flowId);
  const currentFlowId = useFlowStore((state) => state.currentWorkflow?.flow_id);
  const queryClient = useQueryClient();
  const params = useParams<{ id?: string; draft_id?: string }>();
  const [searchParams] = useSearchParams();
  const workflowIdFromUrl = params.id; // database id from URL when on /workflows/:id
  const draftIdFromUrl = params.draft_id; // draft_id when on /draft_workflows/:draft_id
  const isFromVirtualDb = !draftIdFromUrl && searchParams.get('virtualdb') === '1';

  const [isInitialLoading, setIsInitialLoading] = useState(true);

  /**
   * When set, we should call update-dataset (not create).
   * Uses URL query only — not currentWorkflow.dataset_id (workflow API may set unrelated ids and mislabel the button).
   * After a successful create in this session, `persistedVirtualDatasetId` holds the new id until the route changes.
   */
  const [persistedVirtualDatasetId, setPersistedVirtualDatasetId] = useState<string | undefined>(undefined);
  useEffect(() => {
      setPersistedVirtualDatasetId(undefined);
      initialWorkflowStateRef.current = null;
      setIsDirty(false);
    }, [workflowIdFromUrl, draftIdFromUrl]);

  const virtualDatasetIdForUpdate = useMemo(() => {
    const fromUrl =
      searchParams.get('dataset_id') ??
      searchParams.get('datasetId') ??
      searchParams.get('update_id');
    const urlTrim = (fromUrl ?? '').trim();
    if (urlTrim.length > 0) return urlTrim;
    const persisted = (persistedVirtualDatasetId ?? '').trim();
    return persisted.length > 0 ? persisted : undefined;
  }, [searchParams, persistedVirtualDatasetId]);
  const backTarget = draftIdFromUrl ? '/draft_workflows' : isFromVirtualDb ? '/virtual-db' : '/workflows';
  const backLabel = draftIdFromUrl ? 'Go to draft workflows' : isFromVirtualDb ? 'Go to Virtual DBs' : 'Go to workflows';
  const navigate = useNavigate();
  const setCurrentWorkflow = useFlowStore((state) => state.setCurrentWorkflow);
  /** Run connector get_data for source nodes once per loaded workflow (see eagerSourceNodePreview). */
  const eagerSourcePreviewSigRef = useRef<string>("");

  const [showVersionsOnCanvas, setShowVersionsOnCanvas] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [versionsMessage, setVersionsMessage] = useState<string | null>(null);
  const [versionSearchQuery, setVersionSearchQuery] = useState("");
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  const loadDraftVersions = useCallback(async () => {
    const flowId = useFlowStore.getState().currentWorkflow?.flow_id;
    if (!flowId) {
      setVersionsMessage("No workflow selected");
      setVersions([]);
      setSelectedVersionId(null);
      return;
    }
    setIsLoadingVersions(true);
    setVersionsMessage(null);
    setVersions([]);
    try {
      const res = await api.post("/draft-flow-builder/get-versions", { flow_id: flowId, version: "" });
      const data = res?.data ?? res;
      if (Array.isArray(data?.data) && data.data.length > 0) {
        const sortedVersions = [...data.data].sort((a, b) => {
          const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
          const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
          return dateB - dateA;
        });
        setVersions(sortedVersions);
        setVersionsMessage(null);
        const latestVersion = sortedVersions[0];
        const latestVersionId = latestVersion?.draft_id ?? latestVersion?.id;
        if (latestVersionId) setSelectedVersionId(latestVersionId);
      } else {
        setVersionsMessage("No previous versions");
        setVersions([]);
        setSelectedVersionId(null);
      }
    } catch (error) {
      console.error("Error loading versions:", error);
      toast.error("Failed to load versions");
      setVersionsMessage("Failed to load versions");
      setVersions([]);
      setSelectedVersionId(null);
    } finally {
      setIsLoadingVersions(false);
    }
  }, []);

  useEffect(() => {
    if (showVersionsOnCanvas && draftIdFromUrl && currentFlowId) {
      void loadDraftVersions();
    }
  }, [showVersionsOnCanvas, draftIdFromUrl, currentFlowId, loadDraftVersions]);

  useEffect(() => {
    setShowVersionsOnCanvas(false);
  }, [draftIdFromUrl]);

  const filteredVersions = useMemo(() => {
    if (!versionSearchQuery.trim()) return versions;
    const query = versionSearchQuery.toLowerCase();
    return versions.filter(
      (v) =>
        (v.version ?? v.name ?? v.version_name ?? v.display_name ?? "")
          .toLowerCase()
          .includes(query) ||
        (v.description ?? "").toLowerCase().includes(query)
    );
  }, [versions, versionSearchQuery]);

  const handleCanvasVersionSelect = useCallback(
    async (draftId: string) => {
      try {
        setSelectedVersionId(draftId);
        const res = await getVersionByIdApi({ draft_id: draftId });
        const workflow = (res as any)?.data ?? res;
        if (workflow?.data?.nodes != null || workflow?.flow_id || workflow?.id) {
          useFlowStore.getState().setSkipIdApiFetchOnce(true);
          useFlowStore.getState().setSkipAiChatLoadConversationsOnce(true);
          const withVp = ensureWorkflowViewport(workflow);
          await prefetchNodeIconsForWorkflow(withVp.data?.nodes ?? []);
          setCurrentWorkflow(withVp);
          toast.success("Version loaded");
        } else {
          toast.error("Failed to load version");
        }
      } catch (error) {
        console.error("Error loading version:", error);
        toast.error("Failed to load version");
      }
    },
    [setCurrentWorkflow]
  );

  /** Clear stale canvas before paint when route id changes so the previous workflow never flashes. */
  useLayoutEffect(() => {
    const cw = useFlowStore.getState().currentWorkflow;
    if (draftIdFromUrl) {
      const loaded =
        cw?.id != null ? String((cw as { draft_id?: string }).draft_id ?? cw.id) : '';
      if (loaded && loaded !== String(draftIdFromUrl)) {
        setCurrentWorkflow(null as any);
      }
      return;
    }
    if (workflowIdFromUrl) {
      const loaded = cw?.id != null ? String(cw.id) : '';
      const urlId = String(workflowIdFromUrl);
      const idMismatch = loaded && loaded !== urlId;
      /** Same URL id but different mode (normal vs ?virtualdb=1) must not reuse the same canvas payload. */
      const modeMismatch =
        !!cw &&
        loaded === urlId &&
        Boolean(cw.virtualdb_mode) !== isFromVirtualDb;
      if (idMismatch || modeMismatch) {
        setCurrentWorkflow(null as any);
      }
    }
  }, [workflowIdFromUrl, draftIdFromUrl, setCurrentWorkflow, isFromVirtualDb]);

  const [isDirty, setIsDirty] = useState(false);
   const [flowStatus, setFlowStatus] = useState<string | null>(null);
   const initialWorkflowStateRef = useRef<string | null>(null);

  useEffect(() => {
    if (currentWorkflow?.data?.nodes && currentWorkflow?.data?.edges) {
      // Create a stable representation of the workflow state for "dirty" comparison.
      // We round positions to avoid float jitter and only track core configuration.
      const getStableState = () => {
        return JSON.stringify({
          nodes: currentWorkflow.data.nodes.map(n => ({
            id: n.id,
            type: n.type,
            position: {
              x: Math.round(n.position.x),
              y: Math.round(n.position.y)
            },
            // Only track structural/config data that requires a save
            data: {
              node_id: n.data?.node_id,
              name: n.data?.name,
              display_name: n.data?.display_name,
              pipeline_workflow_id: n.data?.pipeline_workflow_id,
              isDataset: n.data?.isDataset,
              node: n.data?.node ? {
                payload: n.data.node.payload,
              } : undefined,
            }
          })),
          edges: currentWorkflow.data.edges.map(e => ({
            id: e.id,
            source: e.source,
            target: e.target,
          }))
        });
      };

      const currentState = getStableState();

      if (!initialWorkflowStateRef.current || isInitialLoading) {
        initialWorkflowStateRef.current = currentState;
        setIsDirty(false);
      } else {
        const hasChanged = currentState !== initialWorkflowStateRef.current;
        setIsDirty(hasChanged);
      }
    }
  }, [currentWorkflow?.data?.nodes, currentWorkflow?.data?.edges, isInitialLoading]);
  const [isExecuteDialogOpen, setIsExecuteDialogOpen] = useState(false);
  const [isInfoSheetOpen, setIsInfoSheetOpen] = useState(false);
  const [isVirtualDBSheetOpen, setIsVirtualDBSheetOpen] = useState(false);
  const [isSavingVirtualDb, setIsSavingVirtualDb] = useState(false);
  const [isVirtualDBCreateDialogOpen, setIsVirtualDBCreateDialogOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isDetailsSaveDialogOpen, setIsDetailsSaveDialogOpen] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isBackConfirmDialogOpen, setIsBackConfirmDialogOpen] = useState(false);
  const navigateToWorkflowsAfterSaveRef = useRef(false);
  const navigateTargetAfterSaveRef = useRef<string>('/workflows');
  const skipIdApiAfterSaveDraftRef = useRef(false); // after save-as-draft, use create-draft-workflow response only — do not call id API
  const flowName = useFlowStore((state) => state.currentWorkflow?.name);
  const deploymentName = useFlowStore((state) => state.currentWorkflow?.deployment_name);
  const workflowDisplayName = useFlowStore((state) =>
    state.currentWorkflow?.display_name ||
    state.currentWorkflow?.name
  );
  const setFlowDetails = useFlowsManagerStore((state) => state.setFlowDetails);
  // Listen for sidebar back button (MousePointer2 icon) - show save/cancel/navigate popup
  useEffect(() => {
    const handler = () => {
      setIsBackConfirmDialogOpen(true);
    };
    window.addEventListener('workflow-back-click', handler);
    return () => window.removeEventListener('workflow-back-click', handler);
  }, []);

  const findOutputNode = (nodes, edges) => {
    return nodes?.find(node =>
      !edges?.some(edge => edge.source === node.id)
    );
  };
  // Auto-save hook: saves workflow every 5 minutes after workflow is created
  // Only enable after workflow has been saved at least once (has an id from backend)
  // useAutoSave({
  //   enabled: !!currentWorkflow?.id, // Only enable after workflow has an id (from backend)
  //   interval: 2.5 * 60 * 1000, // 2.5 minutes in milliseconds
  // });

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const grabbingElement =
        document.getElementsByClassName("cursor-grabbing")[0];
      if (grabbingElement) {
        document.body.removeChild(grabbingElement);
      }
      // Dropped a pipeline/workflow from sidebar: add a node that shows the workflow name and opens the workflow when expanded
      let pipelinePayload: { workflowId?: string; name?: string; flow_id?: string } | null = null;
      if (event.dataTransfer.types.includes(WORKFLOW_PIPELINE_DATA_TYPE)) {
        try {
          const raw = event.dataTransfer.getData(WORKFLOW_PIPELINE_DATA_TYPE);
          pipelinePayload = raw ? JSON.parse(raw) : null;
        } catch (_) {
          /* ignore */
        }
      }
      if (!pipelinePayload && event.dataTransfer.types.includes('text/plain')) {
        try {
          const raw = event.dataTransfer.getData('text/plain');
          const parsed = raw ? JSON.parse(raw) : null;
          if (parsed && typeof parsed.workflowId === 'string') pipelinePayload = parsed;
        } catch (_) {
          /* ignore */
        }
      }
      if (pipelinePayload?.workflowId) {
        const name =
          pipelinePayload.name ?? pipelinePayload.workflowId ?? 'Pipeline';
        takeSnapshot();
        addNode(
          {
            type: 'genericNode',
            data: {
              isPipelineWorkflow: true,
              workflowId: pipelinePayload.workflowId,
              flow_id: pipelinePayload.flow_id ?? undefined,
              display_name: name,
              name,
            },
          } as any,
          { x: event.clientX, y: event.clientY }
        );
        return;
      }
      const dataType = event.dataTransfer.types.find(isSupportedNodeTypes);
      if (dataType) {
        takeSnapshot();
        const nodeData = JSON.parse(event.dataTransfer.getData(dataType));
        if (!nodeData) return;
        addNode(nodeData, { x: event.clientX, y: event.clientY });
      }
    },
    [addNode, takeSnapshot]
  );

  // Handle viewport changes (pan and zoom) and save to store
  const onMoveEnd = useCallback(
    (_event: any, viewport: any) => {
      setViewport(viewport);
    },
    [setViewport]
  );

  

  const onSave = () => {
    if (!hasWorkflowDetails(currentWorkflow)) {
      setIsDetailsSaveDialogOpen(true);
    } else {
      setIsSaveDialogOpen(true);
    }
  }

  const onSaveAsDraft = async (description: string = '') => {
    // Get the latest workflow from the store (after onDetailsSubmit may have updated it)
    const workflowToSave = useFlowStore.getState().currentWorkflow;
    if (!workflowToSave) {
      toast.error("No workflow to save");
      return;
    }
    setIsSavingDraft(true);
    useFlowStore.getState().setIsSavingDraft(true); // Prevent AiChatDialog from calling compile
    useFlowStore.getState().setSkipOpenAiAfterSaveDraft(true); // Close AI chat and prevent re-open
    try {
      const res = await createDraftWorkflowApi(workflowToSave, description);
      const data = res as any;
      let saved = data?.data ?? data;
      if (!saved) {
        toast.error("Failed to save draft");
        return;
      }
      // Preserve fields from request like create-draft-workflow / release response handling
      const w = workflowToSave;
      if ((!saved.org_id || saved.org_id.length === 0) && w.org_id?.length) saved = { ...saved, org_id: w.org_id };
      if (!saved.project && w.project) saved = { ...saved, project: w.project };
      if (!saved.storage_engine && w.storage_engine) saved = { ...saved, storage_engine: w.storage_engine };
      if (!saved.execution_engine && w.execution_engine) saved = { ...saved, execution_engine: w.execution_engine };
      if (!saved.target_output && w.target_output) saved = { ...saved, target_output: w.target_output };
      if (!saved.business_process && w.business_process) saved = { ...saved, business_process: w.business_process };
      if (!saved.process_id && w.process_id) saved = { ...saved, process_id: w.process_id };
      if (w.cycle_wise !== undefined) saved = { ...saved, cycle_wise: w.cycle_wise };
      // Merge response with current workflow - keep our nodes/data, overlay saved metadata. Do not call any other APIs.
      const merged = { ...workflowToSave, ...saved, data: saved.data ?? workflowToSave.data };
      skipIdApiAfterSaveDraftRef.current = true;
      setCurrentWorkflow(ensureWorkflowViewport(merged));
      // Invalidate and refetch draft-workflows query to show the updated list
      queryClient.invalidateQueries({ queryKey: ['draft-workflows'] });
      queryClient.refetchQueries({ queryKey: ['draft-workflows'] });
      toast.success("Draft saved");
      setIsSaveDialogOpen(false);
      setIsDetailsSaveDialogOpen(false);
      if (navigateToWorkflowsAfterSaveRef.current) {
        navigateToWorkflowsAfterSaveRef.current = false;
        navigate(navigateTargetAfterSaveRef.current);
      }
    } catch (e) {
      console.error("Save as draft failed", e);
      toast.error("Failed to save draft");
      throw e;
    } finally {
      setIsSavingDraft(false);
      useFlowStore.getState().setIsSavingDraft(false);
    }
  };

  const onRelease = () => {
    // Get the latest workflow from the store (after onDetailsSubmit may have updated it)
    const workflowData = useFlowStore.getState().currentWorkflow;
    if (!workflowData) {
      toast.error("No workflow to release");
      return;
    }
    const isDraftRoute = !!draftIdFromUrl;
    const flowIdForDelete = workflowData?.flow_id;
    mutate(
      { flowName: flowName, deploymentName: deploymentName, workflow: workflowData, isRelease: true },
      {
        onSuccess: async () => {
          if (isDraftRoute && flowIdForDelete) {
            try {
              await deleteDraftWorkflowApi({ flow_id: flowIdForDelete });
              queryClient.invalidateQueries({ queryKey: ['draft-workflows'] });
            } catch (e) {
              console.error('Failed to delete draft after release:', e);
              toast.error('Draft workflow was released but failed to remove from drafts.');
            }
          }
          // Invalidate and refetch workflows query to show the updated list
          queryClient.invalidateQueries({ queryKey: ['projects'] });
          queryClient.refetchQueries({ queryKey: ['projects'] });
          if (isFromVirtualDb) {
            queryClient.invalidateQueries({ queryKey: ['virtual-dataset-list'] });
          }
          setIsSaveDialogOpen(false);
          setIsDetailsSaveDialogOpen(false);
          navigateToWorkflowsAfterSaveRef.current = false;
          navigate(isFromVirtualDb ? '/virtual-db' : '/workflows');
        }
      }
    );
    setIsDetailsSaveDialogOpen(false);
  }


  useEffect(() => {
    if (!workflowIdFromUrl && !draftIdFromUrl) {
      abortWorkflowLoadSession();
      setIsInitialLoading(false);
      return;
    }
    setIsInitialLoading(true);
    const signal = startWorkflowLoadSession();
    const isActive = () => !signal.aborted;

    const applyFlowStatus = async (flowId: string) => {
      if (!isActive()) return;
      try {
        const response = await api.post(
          "/flow-builder/get-flow-status",
          { flow_id: flowId },
          { signal },
        );
        if (!isActive()) return;
        if (response.data && response.data.status) setFlowStatus(response.data.data);
        else setFlowStatus(null);
      } catch (statusError) {
        if (isRequestAborted(statusError)) return;
        console.error("Failed to fetch flow status:", statusError);
        if (isActive()) setFlowStatus(null);
      }
    };

    const fetchFlowStatus = async () => {
      // After save-as-draft: do not call id API; workflow was already set from create-draft-workflow response
      if (skipIdApiAfterSaveDraftRef.current) {
        skipIdApiAfterSaveDraftRef.current = false;
        setIsInitialLoading(false);
        return;
      }
      // After version select in AI chatbox: workflow was set from get-version-by-id only — do not call id API again
      if (useFlowStore.getState().skipIdApiFetchOnce) {
        useFlowStore.getState().setSkipIdApiFetchOnce(false);
        setIsInitialLoading(false);
        return;
      }

      const loadedWorkflow = useFlowStore.getState().currentWorkflow;

      // Draft route: load via GET api/draft-flow-builder/:draft_id (not flow-builder/:id)
      if (draftIdFromUrl) {
        try {
          const needsToFetch =
            !loadedWorkflow ||
            String((loadedWorkflow as any)?.draft_id ?? (loadedWorkflow as any)?.id) !== draftIdFromUrl;
          if (needsToFetch) {
            console.log('Loading draft workflow (draft-flow-builder/' + draftIdFromUrl + '):', draftIdFromUrl);
            const res: any = await getDraftWorkflowByDraftIdApi(draftIdFromUrl, { signal });
            if (!isActive()) return;
            const workflowData =
              res &&
              typeof res === "object" &&
              (res.id != null || res.draft_id != null || res.flow_id != null) &&
              res.data &&
              typeof res.data === "object"
                ? res
                : (res?.data ?? res);
            const hasWorkflow =
              workflowData &&
              typeof workflowData === "object" &&
              (workflowData.draft_id != null ||
                workflowData.flow_id != null ||
                workflowData.id != null ||
                (workflowData.data && (workflowData.data?.nodes || workflowData.data?.edges)));
            if (hasWorkflow) {
              const normalized = { ...workflowData, draft_id: workflowData.draft_id ?? draftIdFromUrl };
              const withViewport = ensureWorkflowViewport(normalized);
              await prefetchNodeIconsForWorkflow(withViewport.data?.nodes ?? []);
              if (!isActive()) return;
              setCurrentWorkflow(withViewport);
              if (withViewport.flow_id) await applyFlowStatus(withViewport.flow_id);
              else if (isActive()) setFlowStatus(null);
            } else if (isActive()) {
              toast.error("Draft workflow not found");
              setFlowStatus(null);
            }
          } else if (loadedWorkflow?.flow_id) {
            await applyFlowStatus(loadedWorkflow.flow_id);
          }
        } catch (error) {
          if (isRequestAborted(error)) return;
          console.error("Failed to load draft workflow:", error);
          if (isActive()) {
            toast.error("Failed to load draft workflow");
            setFlowStatus(null);
          }
        } finally {
          if (isActive()) setIsInitialLoading(false);
        }
        return;
      }

      if (!workflowIdFromUrl) {
        if (isActive()) {
          setFlowStatus(null);
          setIsInitialLoading(false);
        }
        return;
      }
      try {
        const needsToFetch =
          !loadedWorkflow ||
          String(loadedWorkflow.id) !== String(workflowIdFromUrl) ||
          Boolean(loadedWorkflow.virtualdb_mode) !== isFromVirtualDb;

        if (needsToFetch) {
          if (isFromVirtualDb) {
            console.log('Fetching Virtual DB flow from GET /virtual-dataset/:id', workflowIdFromUrl);
            const vdRes: any = await getVirtualDatasetByIdApi(workflowIdFromUrl, { signal });
            if (!isActive()) return;
            const normalized = normalizeVirtualDatasetToWorkflow(vdRes, workflowIdFromUrl);
            if (!normalized?.data?.nodes?.length) {
              console.error('Virtual DB response missing nodes for id:', workflowIdFromUrl);
              if (isActive()) {
                toast.error('Virtual DB not found');
                setFlowStatus(null);
              }
              return;
            }
            console.log('Loading Virtual DB workflow:', {
              id: normalized.id,
              flow_id: normalized.flow_id,
            });
            const withTemplates = await enrichVirtualDatasetNodesWithTemplates(normalized, { signal });
            if (!isActive()) return;
            const withViewport = ensureWorkflowViewport(withTemplates);
            const savedLayout = loadVirtualDbCanvasLayout(String(workflowIdFromUrl));
            const withLayout = mergeVirtualDbLayoutIntoWorkflow(withViewport, savedLayout);
            await prefetchNodeIconsForWorkflow(withLayout.data?.nodes ?? []);
            if (!isActive()) return;
            setCurrentWorkflow(withLayout);
            if (isActive()) setFlowStatus(null);
          } else {
            console.log('Fetching workflow from API by database id (from URL):', workflowIdFromUrl);
            const res: any = await getWorkflowByIdApi({ id: workflowIdFromUrl }, { signal });
            if (!isActive()) return;
            if (res?.id && res?.updated_at) {
              console.log('Loading workflow from API:', {
                id: res.id,
                flow_id: res.flow_id,
                storage_engine: res.storage_engine,
                execution_engine: res.execution_engine,
                target_output: res.target_output,
                business_process: res.business_process,
              });

              const resWithViewport = ensureWorkflowViewport(res);
              await prefetchNodeIconsForWorkflow(resWithViewport.data?.nodes ?? []);
              if (!isActive()) return;
              setCurrentWorkflow(resWithViewport);

              if (resWithViewport.flow_id) {
                await applyFlowStatus(resWithViewport.flow_id);
              }
            } else if (isActive()) {
              console.error('Workflow not found for id:', workflowIdFromUrl);
              toast.error('Workflow not found');
            }
          }
        } else if (loadedWorkflow?.flow_id && !isFromVirtualDb) {
          await applyFlowStatus(loadedWorkflow.flow_id);
        }
      } catch (error) {
        if (isRequestAborted(error)) return;
        console.error("Failed to fetch workflow or flow status:", error);
        if (isActive()) setFlowStatus(null);
      } finally {
        if (isActive()) {
          // Small delay to ensure state settles before we start tracking changes
           setTimeout(() => {
             if (isActive()) setIsInitialLoading(false);
           }, 2000);
        }
      }
    };

    void fetchFlowStatus();

    return () => abortWorkflowLoadSession();
  }, [workflowIdFromUrl, draftIdFromUrl, setCurrentWorkflow, isFromVirtualDb]);

  useEffect(() => {
    if (!isInitialLoading && reactFlowInstance && currentWorkflow?.data?.nodes?.length) {
      // Small timeout to ensure nodes are rendered before fitting view
      const timer = setTimeout(() => {
        reactFlowInstance.fitView(FIT_VIEW_OPTIONS);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isInitialLoading, reactFlowInstance, currentWorkflow?.data?.nodes?.length]);

  /** After load: for nodes with no upstream edges only, call get_data (postgresql-actions, file-actions, …) to fill preview when output is empty. */
  useEffect(() => {
    if (!currentWorkflow?.flow_id || !currentWorkflow?.data?.nodes?.length) {
      eagerSourcePreviewSigRef.current = "";
      return;
    }

    const sig = `${currentWorkflow.flow_id}::${String(currentWorkflow.id ?? "")}::${String(workflowIdFromUrl ?? "")}::${String(draftIdFromUrl ?? "")}::${isFromVirtualDb ? "v" : "n"}`;
    if (eagerSourcePreviewSigRef.current === sig) return;

    const signal = getWorkflowLoadSignal();
    const expectedFlowId = currentWorkflow.flow_id;
    if (!signal) return;

    const frame = requestAnimationFrame(() => {
      void (async () => {
        try {
          await eagerHydrateSourceNodesAfterWorkflowLoad({
            signal,
            expectedFlowId,
          });
          if (!signal.aborted) {
            eagerSourcePreviewSigRef.current = sig;
          }
        } catch (e) {
          if (isRequestAborted(e)) return;
          console.warn("Eager source node preview after workflow load failed:", e);
        }
      })();
    });

    return () => cancelAnimationFrame(frame);
  }, [
    currentWorkflow?.flow_id,
    currentWorkflow?.id,
    workflowIdFromUrl,
    draftIdFromUrl,
    isFromVirtualDb,
  ]);

  /** Persist node positions + viewport locally — GET /virtual-dataset often rebuilds nodes in a line without layout. */
  const virtualDbCanvasLayoutSig = useMemo(() => {
    if (!isFromVirtualDb || !currentWorkflow?.virtualdb_mode) return "";
    const nodes = currentWorkflow?.data?.nodes ?? [];
    const vp = currentWorkflow?.data?.viewport;
    return JSON.stringify({
      vp,
      pos: nodes.map((n: any) => [n.id, n?.position?.x ?? 0, n?.position?.y ?? 0]),
    });
  }, [isFromVirtualDb, currentWorkflow?.virtualdb_mode, currentWorkflow?.data?.nodes, currentWorkflow?.data?.viewport]);

  useEffect(() => {
    if (!isFromVirtualDb || !workflowIdFromUrl || !virtualDbCanvasLayoutSig) return;
    const key = String(workflowIdFromUrl);
    const t = window.setTimeout(() => {
      const wf = useFlowStore.getState().currentWorkflow;
      if (wf?.virtualdb_mode && wf?.data?.nodes?.length && String(wf.id) === key) {
        saveVirtualDbCanvasLayout(key, wf);
      }
    }, 500);
    return () => window.clearTimeout(t);
  }, [virtualDbCanvasLayoutSig, isFromVirtualDb, workflowIdFromUrl]);
  
  useEffect(() => {
    const nodes = currentWorkflow?.data?.nodes || [];
    const edges = currentWorkflow?.data?.edges || [];
  
    const outputNode = findOutputNode(nodes, edges);
    setOutputNode(outputNode);
  
    console.log("Detected Output Node:", outputNode);
  }, [currentWorkflow?.data?.nodes, currentWorkflow?.data?.edges]);
  

  const onExecuteClick = () => {
    console.log("Execute clicked - currentFlowId:", currentFlowId, "flowName:", flowName, "deploymentName:", deploymentName);

    // Fixed: Check if values exist and provide helpful error messages
    if (!currentFlowId) {
      toast.error("Flow ID is missing. Please save the workflow first.");
      return;
    }

    if (!flowName) {
      toast.error("Flow name is missing. Please save the workflow first.");
      return;
    }

    if (!deploymentName) {
      toast.error("Deployment name is missing. Please save the workflow first.");
      return;
    }

    // Open the execute dialog
    console.log("Opening execute dialog");
    setIsExecuteDialogOpen(true);
  };
  const workflowName = currentWorkflow?.display_name || currentWorkflow?.name || 'Untitled Workflow';
  const isLongName = workflowName.length > 20; // Show tooltip if name is longer than 20 chars

  const onExecuteConfirm = (params: ExecuteParams) => {
    const payload = {
      flow_name: flowName,
      file_name: deploymentName,
      flow_id: currentFlowId,
      flow_run_id: "",
      stmtdate: params.stmtdate,
      process_cycle: params.process_cycle,
      execution_number: params.exec_number,
    };
    executeMutate(payload);
    setIsExecuteDialogOpen(false);
  };

  const onClearWorkflow = () => {
    // Clear all nodes and edges from the workflow
    if (currentWorkflow) {
      setCurrentWorkflow({
        ...currentWorkflow,
        data: {
          ...currentWorkflow.data,
          nodes: [],
          edges: [],
        },
      });
      toast.success("Workflow cleared successfully");
    }
  };

  const handleSaveVirtualDb = useCallback(async () => {
    if (!flowName?.trim()) {
      toast.error("Save the workflow with a name before saving Virtual DB.");
      return;
    }
    const nodes = (currentWorkflow?.data?.nodes ?? []) as Array<{ id: string; data?: any }>;
    const payload = buildPayloadFromEnabledNodes(nodes);
    if (!payload || !payload.node?.length) {
      toast.error("Enable at least one node as Virtual DB (click the database icon on nodes) before saving.");
      return;
    }
    const body = {
      ...payload,
      name: flowName.trim(),
      ...(virtualDatasetIdForUpdate
        ? { dataset_id: virtualDatasetIdForUpdate, update_id: virtualDatasetIdForUpdate }
        : {}),
    };
    setIsSavingVirtualDb(true);
    try {
      if (virtualDatasetIdForUpdate) {
        const res = await api.post("/virtual-dataset/update-dataset", body);
        toast.success("Virtual DB updated successfully.");
        const updatedId =
          (res as any)?.data?.dataset_id ??
          (res as any)?.data?.data?.dataset_id ??
          (res as any)?.data?.update_id;
        if (updatedId != null && String(updatedId).trim() !== "") {
          setPersistedVirtualDatasetId(String(updatedId));
        }
      } else {
        const res = await api.post("/virtual-dataset/create-dataset", body);
        toast.success("Virtual DB saved successfully.");
        const createdId =
          (res as any)?.data?.dataset_id ??
          (res as any)?.data?.data?.dataset_id ??
          (res as any)?.data?.id ??
          (res as any)?.data?.update_id;
        if (createdId != null && String(createdId).trim() !== "") {
          setPersistedVirtualDatasetId(String(createdId));
        }
      }
      const wf = useFlowStore.getState().currentWorkflow;
      if (wf && workflowIdFromUrl) {
        saveVirtualDbCanvasLayout(String(workflowIdFromUrl), wf);
      }
      navigate("/virtual-db");
    } catch (err: any) {
      toast.error(getDisplayErrorMessage(err, "Failed to save Virtual DB."));
    } finally {
      setIsSavingVirtualDb(false);
    }
  }, [currentWorkflow?.data?.nodes, flowName, virtualDatasetIdForUpdate, navigate, workflowIdFromUrl]);

  return ( 
    <>
      <div
        className={`w-full bg-canvas ${isViewMode ? "h-[85vh]" : "h-full"}`}
        ref={reactFlowWrapper}
      >
        <ReactFlow
          key={workflowIdFromUrl ?? draftIdFromUrl ?? 'flow-canvas'}
          nodes={currentWorkflow?.data?.nodes ?? []}
          edges={currentWorkflow?.data?.edges ?? []}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={!isViewMode ? onConnect : undefined}
          onMoveEnd={onMoveEnd}
          nodesDraggable={!isViewMode}
          nodesConnectable={!isViewMode}
          elementsSelectable={true}
          fitView={true}
          minZoom={0.3}
          maxZoom={2}
          fitViewOptions={FIT_VIEW_OPTIONS}
          zoomOnScroll={true}
          zoomOnPinch={true}
          panOnDrag={true}
          onInit={(instance) => {
            setReactFlowInstance(instance);
          }}
          connectionMode={ConnectionMode.Strict}
          className="theme-attribution"
          // Performance optimizations
          nodeOrigin={[0.5, 0.5]}
          deleteKeyCode={isViewMode ? null : 'Delete'}
          selectNodesOnDrag={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Cross}
            size={2}
            gap={20}
            className="!bg-background"
          />

          {/* Top-left: Components button when sidebar collapsed (landing icon is in top nav bar) */}
          {!draftIdFromUrl && isCollapsed && (

            <Panel
              className={cn( 
                "rounded-md ring-offset-0 flex gap-1.5 bg-background text-foreground shadow transition-all duration-300",
                "pointer-events-auto !mt-2 !ml-3 items-center"
              )}
              position="top-left"
            >
              <Button
                onClick={toggleSidebar}
                variant="primary"
                className="h-10 !px-2"
                size="default"
                data-testid="flow-sidebar-trigger"
              >
                <ForwardedIconComponent
                  name="PanelRightClose"
                  className="h-4 w-4"
                />
                <span className="text-foreground">Components</span>
              </Button>
            </Panel>
          )}
          
          <Panel position="top-left" className="!ml-3 pointer-events-auto">
            <div
              className="inline-flex max-w-full items-center rounded-full border border-border/60 bg-muted/80 px-4 py-[4px] text-sm font-medium text-foreground shadow-sm backdrop-blur-sm mt-2 gap-2"
              title={isLongName ? workflowName : undefined}
            >
              <span 
                className="truncate leading-tight select-text cursor-pointer hover:text-primary transition-colors"
                onClick={() => {
                  navigator.clipboard.writeText(workflowName);
                  toast.success("Workflow name copied to clipboard");
                }}
              >
                {workflowName}
              </span>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(workflowName);
                  toast.success("Workflow name copied to clipboard");
                }}
                className="hover:text-primary transition-colors flex items-center justify-center shrink-0"
                title="Copy workflow name"
              >
                <ForwardedIconComponent name="Copy" className="h-3.5 w-3.5" />
              </button>
            </div>
          </Panel>

          <Panel position="top-right" className="flex gap-1 items-center">
            {/* Cognito AI – open AI chat */}
            {onOpenAi && !isViewMode && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onOpenAi}
                    className="flex items-center justify-center p-0.5 border-0 bg-transparent cursor-pointer rounded hover:opacity-80 transition-opacity h-8 w-8"
                  >
                    <img src={AIimage} alt="Cognito AI" className="h-7 w-7 object-contain" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Ask AI</p>
                </TooltipContent>
              </Tooltip>
            )}
            {/* <FlowStatusBadge status={flowStatus} /> */}
            {!isViewMode && (
            <>
            {/* Virtual DB – opens sheet; create-dataset API runs from the sheet */}
            {isFromVirtualDb && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="bg-background h-[1.7rem] w-[0.7rem] text-foreground"
                  size="default"
                  onClick={() => setIsVirtualDBSheetOpen(true)}
                >
                  <Database className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <span>Virtual DB overview (use the DB icon on each source node to include it)</span>
              </TooltipContent>
            </Tooltip>
            )}
            {/* Create Workflow (Plus) – hidden on draft workflow view */}
            {!draftIdFromUrl && (
            <Tooltip>
            <TooltipTrigger asChild>
              <Link to="/workflows/create">
                <Button
                  variant="outline"
                  className="bg-background h-[1.7rem] w-[0.7rem] text-foreground disabled:cursor-not-allowed"
                  size="default"
                >
                  <Plus/>
                </Button>
              </Link>
            </TooltipTrigger>

            <TooltipContent>
              <span>Create Workflow</span>
            </TooltipContent>
          </Tooltip>
            )}

            {/* Save workflow — hidden in Virtual DB mode (use Virtual DB sheet / dataset save instead) */}
            {!isFromVirtualDb && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="bg-background h-[1.7rem] w-[0.7rem] text-foreground disabled:cursor-not-allowed"
                  size="default"
                  onClick={onSave}
                  disabled={isViewMode || isPending || !isDirty}
                >
                  <ForwardedIconComponent
                    name={isPending ? "Loader2" : "Save"}
                    className={cn("h-2 w-2", isPending && "animate-spin")}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isPending ? "Saving workflow..." : !isDirty ? "No changes to save" : "Save workflow"}</p>
              </TooltipContent>
            </Tooltip>
            )}

            {/* Execute Button */}
            {!isFromVirtualDb && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="bg-background h-[1.7rem] w-[0.7rem] text-foreground disabled:cursor-not-allowed"
                  size="default"
                  onClick={() => {
                    console.log("Button clicked directly");
                    onExecuteClick();
                  }}
                  disabled={isViewMode || isExecuting }
                >
                  <ForwardedIconComponent
                    name={isExecuting ? "Loader2" : "CirclePlay"}
                    className={cn("h-2 w-2", isExecuting && "animate-spin")}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isExecuting ? "Executing workflow..." : "Execute workflow"}</p>
              </TooltipContent>
            </Tooltip>
            )}
            {/* Clear Button */}
            <AlertDialog>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="bg-background h-[1.7rem] w-[0.7rem] text-foreground"
                      size="default"
                    >
                      <ForwardedIconComponent name="Trash2" className="h-2 w-2" />
                    </Button>
                  </AlertDialogTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Clear workflow</p>
                </TooltipContent>
              </Tooltip>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete all nodes and connections from your current workflow.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onClearWorkflow} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Clear Workflow
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Info Button */}
            {/* <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="bg-background h-[1.7rem] w-[0.7rem] text-foreground"
                  size="default"
                  onClick={() => setIsInfoSheetOpen(true)}
                >
                  <ForwardedIconComponent name="Info" className="h-2 w-2" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Workflow information</p>
              </TooltipContent>
            </Tooltip> */}

            {draftIdFromUrl && mode === "edit" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setShowVersionsOnCanvas((v) => !v)}
                    className={cn(
                      "bg-background h-[1.7rem] w-[0.7rem] text-foreground",
                      showVersionsOnCanvas && "ring-1 ring-primary/40 bg-primary/10"
                    )}
                    size="default"
                  >
                    <Clock className="h-2 w-2" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Versions</p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* Back Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="bg-background h-[1.7rem] w-[0.7rem] text-foreground"
                  size="default"
                  onClick={() => setIsBackConfirmDialogOpen(true)}
                >
                  <ForwardedIconComponent name="ArrowLeft" className="h-2 w-2" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Return to previous page</p>
              </TooltipContent>
            </Tooltip>
            </>
                )}
          </Panel>

          {draftIdFromUrl && !isViewMode && showVersionsOnCanvas && (
            <Panel
              position="top-right"
              className="pointer-events-auto z-[20] !mt-15 w-[min(248px,calc(100vw-1.75rem))] flex justify-end pr-3"
            >
              <VersionsDropdown
                open
                searchQuery={versionSearchQuery}
                onSearchChange={setVersionSearchQuery}
                isLoading={isLoadingVersions}
                versions={versions}
                versionsMessage={versionsMessage}
                filteredVersions={filteredVersions}
                selectedVersionId={selectedVersionId}
                onVersionSelect={handleCanvasVersionSelect}
              />
            </Panel>
          )}

          <ZoomSlider position="bottom-left" />
        </ReactFlow>
      </div>

      <SliderComponent
        config={Object.keys(selectedNode || {}).length > 0 && selectedNode}
        onClose={() => sheetStore.setIsOpen(false)}
        mode={mode}
        disablePointerEvents={isPredicateChatOpen}
        suppressBackdropClose={suppressNodeSheetBackdropClose}
      />

      <ExecuteWorkflowDialog
        open={isExecuteDialogOpen}
        onOpenChange={setIsExecuteDialogOpen}
        onExecute={onExecuteConfirm}
        isExecuting={isExecuting}
      />

      <WorkflowInfoSheet
        open={isInfoSheetOpen}
        onOpenChange={setIsInfoSheetOpen}
      />

      <Sheet open={isVirtualDBSheetOpen} onOpenChange={setIsVirtualDBSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-7xl overflow-y-auto p-0 rounded-l-xl">
          <SheetHeader className="p-4 pb-2 border-b flex flex-row items-center justify-between gap-2 space-y-0">
            <SheetTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Virtual DB
            </SheetTitle>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                size="sm"
                disabled={isSavingVirtualDb}
                onClick={() => void handleSaveVirtualDb()}
              >
                {isSavingVirtualDb ? (
                  <Loader className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {virtualDatasetIdForUpdate ? "Update dataset" : "Create dataset"}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-full"
                onClick={() => setIsVirtualDBSheetOpen(false)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>
          <div className="px-4 py-2 min-h-[50vh] mt-0">
            <VirtualDB onlyVirtualDbEnabled />
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={isVirtualDBCreateDialogOpen} onOpenChange={setIsVirtualDBCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Virtual DB</DialogTitle>
            <DialogDescription>
              Enter a name for your workflow. The Virtual DB option is checked so this workflow will open in Virtual DB mode.
            </DialogDescription>
          </DialogHeader>
          <FlowNameOnlyForm
            key={isVirtualDBCreateDialogOpen ? 'virtualdb-create-open' : 'virtualdb-create-closed'}
            defaultVirtualDb={true}
            submitButtonLabel="Create Virtual DB"
            onCancel={() => setIsVirtualDBCreateDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <SaveWorkflowDialog
        open={isSaveDialogOpen}
        onOpenChange={setIsSaveDialogOpen}
        onSaveAsDraft={onSaveAsDraft}
        onRelease={onRelease}
        isSavingDraft={isSavingDraft}
        isReleasing={isPending}
        virtualDbMode={isFromVirtualDb}
      />

      <WorkflowDetailsSaveDialog
        open={isDetailsSaveDialogOpen}
        onOpenChange={setIsDetailsSaveDialogOpen}
        onSaveAsDraft={onSaveAsDraft}
        onRelease={onRelease}
        onDetailsSubmit={(workflowUpdate) => {
          // Get the latest workflow from the store to ensure we're merging with current state
          const latestWorkflow = useFlowStore.getState().currentWorkflow;
          if (latestWorkflow) {
            setCurrentWorkflow({ ...latestWorkflow, ...workflowUpdate });
          }
        }}
        isSavingDraft={isSavingDraft}
        isReleasing={isPending}
        virtualDbMode={isFromVirtualDb}
      />

      <AlertDialog open={isBackConfirmDialogOpen} onOpenChange={setIsBackConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave workflow?</AlertDialogTitle>
            <AlertDialogDescription>
              Would you like to save your workflow before leaving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsBackConfirmDialogOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="outline"
              className="disabled:cursor-not-allowed"
              disabled={!isDirty}
              onClick={() => {
                setIsBackConfirmDialogOpen(false);
                navigateToWorkflowsAfterSaveRef.current = true;
                navigateTargetAfterSaveRef.current = backTarget;
                onSave();
              }}
            >
              Save
            </Button>
            <Button
              onClick={() => {
                setIsBackConfirmDialogOpen(false);
                navigate(backTarget);
              }}
            >
              {backLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function PageComponent({
  mode,
  onOpenAi,
  suppressNodeSheetBackdropClose,
}: {
  mode: "view" | "edit";
  onOpenAi?: () => void;
  suppressNodeSheetBackdropClose?: boolean;
}) {
  return (
    <FlowWithDnD
      mode={mode}
      onOpenAi={onOpenAi}
      suppressNodeSheetBackdropClose={suppressNodeSheetBackdropClose}
    />
  );
}
