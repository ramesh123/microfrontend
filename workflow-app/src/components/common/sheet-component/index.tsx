import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Loader2,
  Download,
  CheckCircle2,
  XCircle,
  Rows3,
  Sparkles,
  Layers2,
} from "lucide-react";
import NodeIcon from "@/customNodes/GenericNode/components/NodeIcon";
import { getNodeDetailsApi, getNodeDataByUniqueIdApi, saveNodeDetailsApi } from "@/controllers/API";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { useAgGridTheme } from "@/hooks/useAgGridTheme";
import useFlowStore from "@/stores/flowStore";
ModuleRegistry.registerModules([AllCommunityModule]);
import { useQuery } from "@tanstack/react-query";
import ForwardedIconComponent from "../genericIconComponent";
import BottomSheetSetting from "../bottomSheetSetting";
import NodeDetailsPage from "@/pages/NodeDetailsPage";
import { patchSapWorkflowNodeData, patchSapWorkflowNodeRecord } from "@/utils/sapNodeActions";
import { AgGridReact } from "ag-grid-react";
import { useSheetStore } from "@/stores/sheetStore";
import { cn, isSonnerToastInteraction } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import NodeName from "@/customNodes/GenericNode/components/NodeName";
import { AlgoNodeData } from "@/types/flow";
import { toast } from "sonner";
import DataValidationTable from "../dataValidation/components/data-validation-table";
import NWayValidationTable from "../nway-validation/components/nway-data-validation-table";
import NWayMatchingTable from "../nway-matching/components/nway-matching-table";
import DataCollectorPreview from "../dataCollector/DataCollectorPreview";
import ReconciliationCarryOverTable from "../reconciliationCarryOver/reconciliationCarryOverTable";
import ReportingResultsTable from "../reporting-results-table";
import { buildSavePayload } from "./SheetComponentHelper";
import {
  getUpstreamDisplayNameForPayload,
  shouldBuildKeyedDataframeForExcelWrite,
} from "@/utils/transformTemplate";
import { ResultsTable } from "../multisource-validation/components/ResultsTable";
import ValidationResultsDisplay from "@/pages/RuleConfiguration/ValidationResultsDisplay";
import {
  buildReconciliationCarryOverExecutePayload,
  createNodeOutputWithUniqueId,
  getNodeOutputData,
  hasNWayMatchingPreview,
  hydrateNodeOutputAfterExecution,
  resolveExecuteDataframe,
  stripNWayMatchingOutputForMemory,
} from '@/utils/nodeDataUtils';
import { buildWorkflowChartParamsFromNodeAndForm } from '../../../pages/charts/workflowChartParamsFromNodeAndForm';
import { isDeduplicationNodeId } from "@/utils/workflowNodeId";
import './sheet-ag-grid.css';
import { getDisplayErrorMessage, resolveApiErrorMessage } from "@/utils/exceptionHelper";

/** SAP/Excel columns like "Ref.key (header) 1" must not be parsed as nested paths. */
const SHEET_PREVIEW_GRID_OPTIONS = { suppressFieldDotNotation: true };

function buildSheetColumnDefs(columns: any[]) {
  return columns.map((column: any) => {
    const field =
      typeof column === "string" ? column : column.field || column.name || String(column);
    return {
      field,
      headerName:
        typeof column === "string" ? column : column.headerName || column.name || String(column),
    };
  });
}

/**
 * Normalize API output into column list + row array.
 * Important: `output.columns === []` is truthy in JS — must still infer keys from the first data row.
 */
function extractColumnsAndDataFromOutput(output: any): { columns: any[]; data: any[] } {
  let columns: any[] = [];
  let data: any[] = [];

  if (!output) return { columns, data };

  if (Array.isArray(output.columns) && output.columns.length > 0 && output.data != null) {
    columns = output.columns;
    data = Array.isArray(output.data) ? output.data : [];
  } else if (
    output.data &&
    typeof output.data === 'object' &&
    !Array.isArray(output.data) &&
    Array.isArray(output.data.data) &&
    output.data.data.length > 0
  ) {
    data = output.data.data;
    columns =
      Array.isArray(output.data.columns) && output.data.columns.length > 0
        ? output.data.columns
        : Object.keys(output.data.data[0] || {});
  } else if (Array.isArray(output.data) && output.data.length > 0) {
    data = output.data;
    columns = Object.keys(output.data[0] || {});
  } else if (Array.isArray(output) && output.length > 0) {
    data = output;
    columns = Object.keys(output[0] || {});
  }

  if (data.length > 0 && columns.length === 0) {
    columns = Object.keys(data[0] || {});
  }

  return { columns, data };
}

/**
 * Excel (and similar) execute responses may return `data` as a map of tab name → { data, columns }.
 * Example: { status, message, data: { Sheet_A: { data: [...], columns: [...] }, Sheet_B: { ... } } }.
 */
function parseMultiTabSheetOutput(output: any): { key: string; colDefs: any[]; rowData: any[] }[] | null {
  if (!output || typeof output !== "object") return null;

  let tabRoot: Record<string, any> | null = null;
  if (output.data && typeof output.data === "object" && !Array.isArray(output.data)) {
    const inner = output.data as Record<string, any>;
    const innerKeys = Object.keys(inner);
    // Single flat table nested under `data`: { data: [...], columns: [...] }
    if (
      innerKeys.includes("data") &&
      Array.isArray(inner.data) &&
      innerKeys.length <= 3 &&
      innerKeys.every((k) => ["data", "columns", "rows_count"].includes(k))
    ) {
      return null;
    }
    tabRoot = inner;
  } else {
    return null;
  }

  const keys = Object.keys(tabRoot);
  if (keys.length === 0) return null;

  const sheets: { key: string; colDefs: any[]; rowData: any[] }[] = [];

  for (const key of keys) {
    const block = tabRoot[key];
    if (!block || typeof block !== "object" || Array.isArray(block) || !Array.isArray(block.data)) {
      return null;
    }
    const data = block.data as any[];
    let columns: any[] =
      Array.isArray(block.columns) && block.columns.length > 0
        ? block.columns
        : data.length > 0
          ? Object.keys(data[0] || {})
          : [];
    if (data.length > 0 && columns.length === 0) {
      columns = Object.keys(data[0] || {});
    }

    const colDefs = buildSheetColumnDefs(columns);

    sheets.push({ key, colDefs, rowData: data });
  }

  return sheets.length > 0 ? sheets : null;
}

/** Merge get-node-unique-id API response into existing output without dropping `unique_id`. */
function mergeUniqueIdApiResponse(previous: any, response: any) {
  const prevObj = previous && typeof previous === "object" ? previous : {};
  const resObj = response && typeof response === "object" ? response : {};
  return {
    ...prevObj,
    ...resObj,
    unique_id: prevObj.unique_id ?? resObj.unique_id,
  };
}

/** True when we should lazy-fetch rows via unique_id (no grid-ready preview yet). */
function outputNeedsUniqueIdFetch(output: any): boolean {
  if (!output?.unique_id) return false;
  if (parseMultiTabSheetOutput(output)?.length) return false;
  if (hasNWayMatchingPreview(output)) return false;
  const { columns, data } = extractColumnsAndDataFromOutput(output);
  if (columns.length > 0 && data.length > 0) return false;
  return true;
}

function outputHasGridPreview(output: any): boolean {
  if (parseMultiTabSheetOutput(output)?.length) return true;
  if (hasNWayMatchingPreview(output)) return true;
  const { columns, data } = extractColumnsAndDataFromOutput(output);
  return columns.length > 0 && data.length > 0;
}

/** Node types whose Data Preview can be megabytes — never write full rows into the flow store. */
function usesLocalDataPreviewCache(nodeId: string | undefined): boolean {
  return nodeId === 'nway_matching' || nodeId === 'nway_validation';
}

/**
 * Source connectors (postgres, file/csv, etc.) expose `get_data` (e.g. postgresql-actions, file-actions).
 * Preview can be loaded the same way as Execute, without requiring unique_id.
 */
function canFetchPreviewViaGetData(node: any): boolean {
  const d = node?.data;
  if (!d?.saved_node) return false;
  const getData = d?.node?.get_data;
  if (!getData?.module || !getData?.klass) return false;
  const nid = d?.node_id;
  if (!nid) return false;
  const skip = new Set([
    "merge",
    "charts",
    "reporting",
    "validation",
    "nway_validation",
    "nway_matching",
    "multisource_validation",
    "data_collector",
    "reconciliation_carryover",
    "custom_scripts",
    "subflow_view",
    "pipeline_reference",
    "data_validation",
  ]);
  if (skip.has(nid)) return false;
  return true;
}

/** Build AG Grid column defs and row data from a node's stored output (same shapes as sheet output processing). */
function parseNodeOutputToGrid(output: any): { colDefs: any[]; rowData: any[] } {
  const empty = { colDefs: [] as any[], rowData: [] as any[] };
  const { columns, data } = extractColumnsAndDataFromOutput(output);
  if (!columns.length || !data.length) return empty;

  const colDefs = buildSheetColumnDefs(columns);

  return { colDefs, rowData: data };
}

/** Fuzzy Match execute preview: `duplicate_groups` is an array of row arrays — flatten for one grid with a group index. */
function flattenFuzzyMatchDuplicateGroups(duplicateGroups: unknown): { colDefs: any[]; rowData: any[] } {
  const rowData: any[] = [];
  if (!Array.isArray(duplicateGroups)) return { colDefs: [], rowData: [] };
  let groupIndex = 0;
  for (const group of duplicateGroups) {
    if (!Array.isArray(group) || group.length === 0) continue;
    groupIndex += 1;
    for (const row of group) {
      if (row && typeof row === "object" && !Array.isArray(row)) {
        rowData.push({ ...row, _group: groupIndex });
      }
    }
  }
  if (rowData.length === 0) return { colDefs: [], rowData: [] };
  const keySet = new Set<string>();
  rowData.forEach((r) => Object.keys(r).forEach((k) => keySet.add(k)));
  const ordered = [
    "_group",
    ...[...keySet].filter((k) => k !== "_group").sort(),
  ];
  const colDefs = ordered.map((field) => ({
    field,
    headerName: field === "_group" ? "Group" : String(field),
    sortable: true,
  }));
  return { colDefs, rowData };
}

function formatFuzzySummaryLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface SliderComponentProps {
  config: any;
  onClose?: () => void;
  mode?: "view" | "edit";
  disablePointerEvents?: boolean;
  /** When true, dimmed backdrop ignores pointer events (e.g. after closing ASK AI so a ghost click does not close the sheet). */
  suppressBackdropClose?: boolean;
}

const SliderComponent = ({
  config,
  mode,
  onClose,
  disablePointerEvents,
  suppressBackdropClose,
}: SliderComponentProps) => {
  // const nodeRef = useRef<{ onClickExecute: () => void }>(null); // define ref type
  // Use Zustand selector to make selectedNode reactive to store changes
  const selectedNode = useFlowStore((state) => state.getSelectedNode());
  const [sourceNodes, setSourceNodes] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isDataPreviewLoading, setIsDataPreviewLoading] = useState(false);
  /** True while fetching upstream nodes' output via get-node-unique-id-data so configuration can use that data. */
  const [isHydratingUpstreamForConfig, setIsHydratingUpstreamForConfig] = useState(false);
  /** Large structured previews (e.g. nway_matching) — kept out of the flow store to avoid freezing the canvas. */
  const [localDataPreviewOutput, setLocalDataPreviewOutput] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("config");
  // const { sourceNodes }: any = useSourceNodes();
  // Column Definitions: Defines & controls grid columns.
  const [colDefs, setColDefs] = useState([]);
  const [rowData, setRowData] = useState([]);
  /** When API returns `data` as multiple named tables (e.g. Excel write preview). */
  const [excelMultiSheets, setExcelMultiSheets] = useState<
    { key: string; colDefs: any[]; rowData: any[] }[] | null
  >(null);
  const [activeExcelSheetTab, setActiveExcelSheetTab] = useState<string>("");
  const excelTabGridRef = useRef<any>(null);
  const currentNodeId = useFlowStore((state) => state.current_node_id);
  const sheetStore = useSheetStore();
  const sheetOpen = useSheetStore((state) => state.isOpen);
  const dataValidationHeaderActions = useSheetStore((state) => state.dataValidationHeaderActions);
  const currentWorkflow = useFlowStore((state) => state.currentWorkflow);
  const gridRef = useRef<any>(null);
  const mergeSourceGridRef = useRef<any>(null);
  const mergeTargetGridRef = useRef<any>(null);

  /** Merge node: toggle between merged result and upstream source/target previews. */
  const [mergeDataPreviewTab, setMergeDataPreviewTab] = useState<'output' | 'inputs'>('output');
  const [mergeInputTab, setMergeInputTab] = useState<'source' | 'target'>('source');

  /** Fuzzy Match: dialog shows duplicate_groups grid; main preview is always deduplicated output. */
  const [fuzzyDuplicateGroupsDialogOpen, setFuzzyDuplicateGroupsDialogOpen] = useState(false);

  const { agTheme, theme } = useAgGridTheme();

  const nodeIdForTemplate = selectedNode?.data?.node_id ?? config?.data?.node_id;
  const shouldFetchNodeTemplate = Boolean(sheetOpen && selectedNode?.id && nodeIdForTemplate);

  const {
    data: nodeTemplateLayer,
    isLoading: isNodeTemplateLoading,
    isError: isNodeTemplateError,
  } = useQuery({
    queryKey: ['nodeDetails', nodeIdForTemplate, selectedNode?.id],
    queryFn: async () => {
      if (!nodeIdForTemplate) return null;
      const response = await getNodeDetailsApi({ node_id: nodeIdForTemplate });
      const layer = response?.data ?? response;
      return patchSapWorkflowNodeData(layer as Record<string, unknown>) ?? layer;
    },
    enabled: shouldFetchNodeTemplate,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const mergedNodeDetailsForPage = useMemo(() => {
    if (!selectedNode?.id) return null;
    if (!nodeIdForTemplate) return selectedNode;
    if (shouldFetchNodeTemplate && isNodeTemplateLoading) return null;
    if (isNodeTemplateError) return patchSapWorkflowNodeRecord(selectedNode);
    if (nodeTemplateLayer) {
      const base = selectedNode.data;
      const api = nodeTemplateLayer as Record<string, unknown>;
      const storeNode = base?.node ?? {};
      const apiNode = (api?.node as Record<string, unknown>) ?? {};
      const isMergeNode = base?.node_id === 'merge';
      return patchSapWorkflowNodeRecord({
        ...selectedNode,
        data: {
          ...base,
          ...api,
          ...(isMergeNode
            ? {
              // For merge, never allow template/API layers to overwrite user-edited workflow labels.
              display_name: base?.display_name,
              name: base?.name,
            }
            : {}),
          node: {
            ...storeNode,
            ...apiNode,
            payload: storeNode.payload,
          },
        },
      });
    }
    return patchSapWorkflowNodeRecord(selectedNode);
  }, [
    selectedNode,
    nodeIdForTemplate,
    nodeTemplateLayer,
    shouldFetchNodeTemplate,
    isNodeTemplateLoading,
    isNodeTemplateError,
  ]);

  useEffect(() => {
    if (isNodeTemplateError && shouldFetchNodeTemplate) {
      toast.error("Could not load the latest node template. Showing saved configuration.");
    }
  }, [isNodeTemplateError, shouldFetchNodeTemplate]);

  useEffect(() => {
    if (selectedNode?.id) {
      const sourceNode = useFlowStore.getState().getUpstreamNodes(selectedNode.id);
      setSourceNodes(sourceNode);
    }
    // Don't reset tab when node updates - let user stay on their current tab
  }, [selectedNode]);

  // Reset to Configuration whenever the sheet closes/opens or the selected node changes.
  // useLayoutEffect so activeTab is "config" before Data Preview's useEffect runs on the same
  // paint — otherwise leaving Data Preview on node A then opening node B briefly kept
  // activeTab==="data" and triggered get-node-unique-id-data for B without clicking Data Preview.
  useLayoutEffect(() => {
    setActiveTab("config");
    setLocalDataPreviewOutput(null);
  }, [sheetOpen, selectedNode?.id]);

  // Release large nway preview payloads from the global store when the sheet closes.
  useEffect(() => {
    if (sheetOpen) return;
    setLocalDataPreviewOutput(null);
    const node = useFlowStore.getState().getSelectedNode();
    if (node?.data?.node_id !== 'nway_matching') return;
    const output = node.data?.node?.output;
    if (!hasNWayMatchingPreview(output)) return;
    const stripped = stripNWayMatchingOutputForMemory(output);
    useFlowStore.getState().updateNodeData(node.id, {
      node: { ...node.data.node, output: stripped },
    });
  }, [sheetOpen]);

  const upstreamConfigHydrateSeqRef = useRef(0);

  /** When on Configuration: load unique_id row data for direct upstream nodes (skipped on Data Preview tab). */
  useEffect(() => {
    if (!sheetOpen || !selectedNode?.id || activeTab !== 'config') {
      setIsHydratingUpstreamForConfig(false);
      return;
    }
    const flow_id = currentWorkflow?.flow_id;
    if (!flow_id) {
      setIsHydratingUpstreamForConfig(false);
      return;
    }

    const upstream = useFlowStore.getState().getUpstreamNodes(selectedNode.id);
    const needUniqueIdHydration = (upstream ?? []).filter((n: any) =>
      outputNeedsUniqueIdFetch(n?.data?.node?.output)
    );
    const needGetDataHydration = (upstream ?? []).filter((n: any) =>
      !outputHasGridPreview(n?.data?.node?.output) &&
      !n?.data?.node?.output?.unique_id &&
      canFetchPreviewViaGetData(n)
    );

    if (needUniqueIdHydration.length === 0 && needGetDataHydration.length === 0) {
      setIsHydratingUpstreamForConfig(false);
      return;
    }

    const seq = ++upstreamConfigHydrateSeqRef.current;
    let cancelled = false;
    setIsHydratingUpstreamForConfig(true);

    void (async () => {
      try {
        await Promise.all([
          ...needUniqueIdHydration.map(async (flowNode: any) => {
            const output = flowNode?.data?.node?.output;
            if (!output?.unique_id) return;
            const response = await getNodeDataByUniqueIdApi({
              flow_id,
              node_id: flowNode.id,
              unique_id: String(output.unique_id),
            });
            if (cancelled || seq !== upstreamConfigHydrateSeqRef.current) return;
            if (response == null || (response as { status?: boolean }).status === false) return;

            const latest = useFlowStore.getState().currentWorkflow?.data?.nodes?.find(
              (x: any) => x.id === flowNode.id
            );
            if (!latest) return;
            const merged = mergeUniqueIdApiResponse(latest.data?.node?.output, response);
            useFlowStore.getState().updateNodeData(flowNode.id, {
              node: {
                ...latest.data.node,
                output: merged,
              },
            });
          }),
          ...needGetDataHydration.map(async (flowNode: any) => {
            const basePayload = flowNode.data?.node?.payload ?? {};
            const payload = {
              ...basePayload,
              current_node_id: flowNode.id,
              flow_id,
              response_type: "json" as const,
              stmtDate: new Date().toISOString().split("T")[0],
              dataframe: JSON.stringify([]),
            };
            const endPoint = flowNode.data?.node?.get_data;
            const requestBody = { payload: { ...payload, node_id: flowNode.id, flow_id } };
            const execResponse = await saveNodeDetailsApi(endPoint, requestBody);
            if (cancelled || seq !== upstreamConfigHydrateSeqRef.current) return;
            if (execResponse == null || (execResponse as { status?: boolean }).status === false) return;

            const latest = useFlowStore.getState().currentWorkflow?.data?.nodes?.find(
              (x: any) => x.id === flowNode.id
            );
            if (!latest) return;
            const nodeOutput = await hydrateNodeOutputAfterExecution(flow_id, String(flowNode.id), execResponse);
            useFlowStore.getState().updateNodeData(flowNode.id, {
              node: {
                ...latest.data.node,
                output: nodeOutput,
              },
            });
          })
        ]);
        if (!cancelled && seq === upstreamConfigHydrateSeqRef.current && selectedNode?.id) {
          setSourceNodes(useFlowStore.getState().getUpstreamNodes(selectedNode.id));
        }
      } catch (e) {
        console.error("Upstream unique_id/get_data hydrate for configuration failed:", e);
      } finally {
        if (!cancelled && seq === upstreamConfigHydrateSeqRef.current) {
          setIsHydratingUpstreamForConfig(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      setIsHydratingUpstreamForConfig(false);
    };
  }, [sheetOpen, selectedNode?.id, currentWorkflow?.flow_id, activeTab]);

  const previewHydrateSeqRef = useRef(0);

  // Data Preview tab: hydrate rows via unique_id API and/or get_data (postgres/file sources) when the grid is still empty.
  useEffect(() => {
    if (!sheetOpen || activeTab !== "data" || !selectedNode?.id) {
      setIsDataPreviewLoading(false);
      return;
    }
    const flow_id = currentWorkflow?.flow_id;
    if (!flow_id) {
      setIsDataPreviewLoading(false);
      return;
    }

    const output = selectedNode?.data?.node?.output;
    if (outputHasGridPreview(output) || outputHasGridPreview(localDataPreviewOutput)) {
      setIsDataPreviewLoading(false);
      return;
    }

    const seq = ++previewHydrateSeqRef.current;
    let cancelled = false;
    setIsDataPreviewLoading(true);

    void (async () => {
      const nodeId = selectedNode.id;

      try {
        // 1) Prefer refetch by unique_id when the workflow persisted one (rows stripped on save).
        if (outputNeedsUniqueIdFetch(output)) {
          const response = await getNodeDataByUniqueIdApi({
            flow_id,
            node_id: nodeId,
            unique_id: String(output!.unique_id),
          });
          if (cancelled || seq !== previewHydrateSeqRef.current) return;
          if (response == null || (response as { status?: boolean }).status === false) return;

          const curUnique = useFlowStore.getState().getSelectedNode();
          if (!curUnique || curUnique.id !== nodeId) return;

          const merged = mergeUniqueIdApiResponse(curUnique.data?.node?.output, response);
          if (usesLocalDataPreviewCache(curUnique.data?.node_id)) {
            setLocalDataPreviewOutput(merged);
          } else {
            useFlowStore.getState().updateNodeData(nodeId, {
              node: {
                ...curUnique.data.node,
                output: merged,
              },
            });
          }
        }

        if (cancelled || seq !== previewHydrateSeqRef.current) return;

        let cur = useFlowStore.getState().getSelectedNode();
        if (!cur || cur.id !== nodeId) return;
        const outAfter = cur.data?.node?.output;
        if (outputHasGridPreview(outAfter)) return;

        // 2) Source nodes without a persisted unique_id: call get_data (e.g. postgresql-actions, file-actions).
        // Nodes that already ran and have unique_id should use step 1 only — not re-execute get_data.
        if (outAfter?.unique_id) return;
        if (!canFetchPreviewViaGetData(cur)) return;

        const basePayload = cur.data?.node?.payload ?? {};
        const payload = {
          ...basePayload,
          current_node_id: nodeId,
          flow_id,
          response_type: "json" as const,
          stmtDate: new Date().toISOString().split("T")[0],
          dataframe: JSON.stringify([]),
        };
        const endPoint = cur.data?.node?.get_data;
        const requestBody = { payload: { ...payload, node_id: nodeId, flow_id } };
        const execResponse = await saveNodeDetailsApi(endPoint, requestBody);
        if (cancelled || seq !== previewHydrateSeqRef.current) return;
        if (execResponse == null || (execResponse as { status?: boolean }).status === false) return;

        cur = useFlowStore.getState().getSelectedNode();
        if (!cur || cur.id !== nodeId) return;

        const nodeOutput = await hydrateNodeOutputAfterExecution(flow_id, String(nodeId), execResponse);
        useFlowStore.getState().updateNodeData(nodeId, {
          node: {
            ...cur.data.node,
            output: nodeOutput,
          },
        });
      } catch (e) {
        console.error("Data preview hydrate failed:", e);
      } finally {
        if (!cancelled && seq === previewHydrateSeqRef.current) {
          setIsDataPreviewLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      setIsDataPreviewLoading(false);
    };
  }, [
    sheetOpen,
    activeTab,
    selectedNode?.id,
    currentWorkflow?.flow_id,
    selectedNode?.data?.saved_node,
    selectedNode?.data?.node_id,
    selectedNode?.data?.node?.output?.unique_id,
    localDataPreviewOutput,
    // Re-run when get_data endpoint identity changes (template load)
    selectedNode?.data?.node?.get_data?.module,
    selectedNode?.data?.node?.get_data?.klass,
  ]);

  useEffect(() => {
    // N-Way Matching / validation use dedicated preview tables, not AG Grid rowData.
    if (usesLocalDataPreviewCache(selectedNode?.data?.node_id)) {
      setColDefs([]);
      setRowData([]);
      setExcelMultiSheets(null);
      setActiveExcelSheetTab("");
      return;
    }

    // Always clear grid first when node changes
    setColDefs([]);
    setRowData([]);
    setExcelMultiSheets(null);
    setActiveExcelSheetTab("");

    const output = selectedNode?.data?.node?.output;

    if (output) {
      const multi = parseMultiTabSheetOutput(output);
      if (multi && multi.length > 0) {
        setExcelMultiSheets(multi);
        setActiveExcelSheetTab(multi[0].key);
        console.log("Multi-tab sheet output:", multi.map((s) => s.key));
        return;
      }

      const { columns, data } = extractColumnsAndDataFromOutput(output);

      if (columns.length > 0 && data.length > 0) {
        console.log('Found columns and data, processing...');
        const colDefs = buildSheetColumnDefs(columns);
        console.log('Final colDefs:', colDefs);
        console.log('Final rowData length:', data.length);
        setColDefs(colDefs);
        setRowData(data);
      } else {
        console.log('No columns or data found, grid already cleared');
      }
    } else {
      console.log('No output found, grid already cleared');
    }
    console.log('==========================================');
  }, [currentNodeId, selectedNode]);

  useEffect(() => {
    setMergeDataPreviewTab('output');
    setMergeInputTab('source');
  }, [selectedNode?.id]);

  useEffect(() => {
    setFuzzyDuplicateGroupsDialogOpen(false);
  }, [selectedNode?.id, selectedNode?.data?.node?.output?.unique_id]);

  const mergePayload = selectedNode?.data?.node?.payload;
  const mergeSourceFlowNode = useMemo(() => {
    if (selectedNode?.data?.node_id !== 'merge' || !mergePayload?.source_name || !Array.isArray(sourceNodes)) {
      return null;
    }
    return sourceNodes.find((n: any) => n.id === mergePayload.source_name) ?? null;
  }, [selectedNode?.data?.node_id, mergePayload?.source_name, sourceNodes]);

  const mergeTargetFlowNode = useMemo(() => {
    if (selectedNode?.data?.node_id !== 'merge' || !mergePayload?.target_name || !Array.isArray(sourceNodes)) {
      return null;
    }
    return sourceNodes.find((n: any) => n.id === mergePayload.target_name) ?? null;
  }, [selectedNode?.data?.node_id, mergePayload?.target_name, sourceNodes]);

  const mergeSourceInputGrid = useMemo(
    () => parseNodeOutputToGrid(mergeSourceFlowNode?.data?.node?.output),
    [mergeSourceFlowNode],
  );
  const mergeTargetInputGrid = useMemo(
    () => parseNodeOutputToGrid(mergeTargetFlowNode?.data?.node?.output),
    [mergeTargetFlowNode],
  );

  const mergeSourceDisplayName =
    mergeSourceFlowNode?.data?.display_name ?? mergeSourceFlowNode?.data?.name ?? 'Source';
  const mergeTargetDisplayName =
    mergeTargetFlowNode?.data?.display_name ?? mergeTargetFlowNode?.data?.name ?? 'Target';

  /** Execute API returns matched_count / unmatched_count / rows_count on merge output. */
  const mergeOutputSummary = useMemo(() => {
    const out = selectedNode?.data?.node?.output as
      | {
        matched_count?: number;
        unmatched_count?: number;
        rows_count?: number;
        message?: string;
      }
      | undefined;
    if (selectedNode?.data?.node_id !== 'merge' || !out) return null;
    const { matched_count, unmatched_count, rows_count } = out;
    if (
      matched_count === undefined &&
      unmatched_count === undefined &&
      rows_count === undefined
    ) {
      return null;
    }
    return { matched_count, unmatched_count, rows_count, message: out.message };
  }, [selectedNode?.data?.node_id, selectedNode?.data?.node?.output]);

  const fuzzyMatchDataPreview = useMemo(() => {
    if (!isDeduplicationNodeId(selectedNode?.data?.node_id)) return null;
    const out = selectedNode.data.node.output as
      | {
          summary?: Record<string, unknown>;
          duplicate_groups?: unknown;
        }
      | undefined;
    if (!out || typeof out !== "object") {
      return {
        summary: null as Record<string, unknown> | null,
        dupGrid: { colDefs: [] as any[], rowData: [] as any[] },
        duplicateGroupCount: 0,
      };
    }
    const summary =
      out.summary && typeof out.summary === "object" && !Array.isArray(out.summary)
        ? (out.summary as Record<string, unknown>)
        : null;
    const raw = out.duplicate_groups;
    const duplicateGroups = Array.isArray(raw) ? raw : [];
    const duplicateGroupCount = duplicateGroups.filter(
      (g) => Array.isArray(g) && g.length > 0
    ).length;
    const dupGrid = duplicateGroupCount > 0 ? flattenFuzzyMatchDuplicateGroups(duplicateGroups) : { colDefs: [] as any[], rowData: [] as any[] };
    return { summary, dupGrid, duplicateGroupCount };
  }, [selectedNode?.data?.node_id, selectedNode?.data?.node?.output]);

  // Log when switching to data tab
  useEffect(() => {
    if (activeTab === 'data') {
      console.log('==========================================');
      console.log('SWITCHED TO DATA TAB (useEffect)');
      console.log('==========================================');
      console.log('Tab State:', {
        activeTab,
        selectedNodeId: selectedNode?.id,
        nodeType: selectedNode?.data?.node_id,
        colDefsLength: colDefs?.length,
        rowDataLength: rowData?.length,
        hasOutput: !!selectedNode?.data?.node?.output,
      });
      console.log('Current ColDefs:', colDefs);
      console.log('Current RowData (first 3 rows):', rowData?.slice(0, 3));
      console.log('==========================================');
    }
  }, [activeTab, selectedNode, colDefs, rowData]);

  const isMergeNode = selectedNode?.data?.node_id === 'merge';
  const { display_name: configDisplayName, description, icon } = config?.data || {};
  const displayName =
    selectedNode?.data?.display_name ?? selectedNode?.data?.name ?? configDisplayName ?? "";
  const isSubflowViewNode = selectedNode?.data?.node_id === "subflow_view";

  const handleTitleSave = (newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (!selectedNode?.id) return;

    if (isMergeNode) {
      const currentName = selectedNode?.data?.display_name ?? selectedNode?.data?.name;
      if (trimmed === currentName) return;
      useFlowStore.getState().updateNodeData(selectedNode.id, {
        display_name: trimmed,
        name: trimmed,
      });
      return;
    }

    // Non-merge nodes: only update the workflow label (display_name).
    if (trimmed === displayName) return;
    useFlowStore.getState().updateNodeData(selectedNode.id, { display_name: trimmed });
  };

  const handleSheetClose = () => {
    // If closing subflow view while unlocked, re-lock so config is not persisted and node reopens locked
    const node = useFlowStore.getState().getSelectedNode();
    if (node?.data?.node_id === 'subflow_view' && node?.data?.subflow_config_locked === false) {
      useFlowStore.getState().updateNodeData(node.id, { ...node.data, subflow_config_locked: true });
    }
    sheetStore.setIsOpen(false);
    onClose?.();
  };

  const handleSave = async () => {
    //setIsLoading(true);
    const saveEndpointConfig = selectedNode?.data?.node?.save_node || {};
    try {
      const finalApiPayload = buildSavePayload(selectedNode);
      const response = await saveNodeDetailsApi(saveEndpointConfig, finalApiPayload);

      useFlowStore.getState().updateNodeData(selectedNode.id, response);

      toast.success("Configuration saved successfully!");
      //onSave();

    } catch (error) {
      const errorMessage = getDisplayErrorMessage(error, 'An unknown error occurred.');
      toast.error(`Failed to save configuration: ${errorMessage}`);
    } finally {
      //setIsLoading(false);
    }
  };
  const handleExecute = useCallback(async (event: React.MouseEvent, node: AlgoNodeData) => {
    const nodes = useFlowStore.getState().currentWorkflow?.data?.nodes;
    const currentWorkflow = useFlowStore.getState().currentWorkflow;
    const flow_id = currentWorkflow?.flow_id || '';

    // `config` is a React Flow node: { id, data, ... }. Support data-only shapes too.
    const nodeAny = node as any;
    const targetId =
      nodeAny?.id ??
      nodeAny?.data?.current_node_id ??
      nodeAny?.current_node_id;
    const nodeData: any = nodes?.find((n: any) => n.id === targetId);

    if (!nodeData?.data?.saved_node) {
      return toast.error("Node not saved. Please save the node configuration first.");
    }
    // if (!executedNodeData?.id) {
    //   return toast.error("Node not saved. Please save the node configuration first.");
    // }
    // const workflowNodeId = String(executedNodeData.id);
    // const nodeDetails = await getSingleWorkflowNode(workflowNodeId);
    if (nodeData?.data?.saved_node) {
      let payload: any = {};
      const basePayload =
        nodeData?.data?.node?.payload ?? selectedNode?.data?.node?.payload;

      // Special payload handling for the merge node
      if (nodeData.data.node_id === 'merge') {
        const sourceName = basePayload.source_name;
        const targetName = basePayload.target_name;

        // Find the full source and target nodes from the available sourceNodes
        const sourceNode = sourceNodes.find((n: any) => n.id === sourceName);
        const targetNode = sourceNodes.find((n: any) => n.id === targetName);

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
          current_node_id: targetId,
          flow_id: currentWorkflow?.flow_id,
          source_data: JSON.stringify(sourceData),
          target_data: JSON.stringify(targetData),
        };
        // Ensure the old dataframe key is not sent to avoid confusion
        delete payload.dataframe;

      } else if (nodeData.data.node_id === 'concat') {
        payload = {
          ...basePayload,
          current_node_id: targetId,
          flow_id: currentWorkflow?.flow_id,
          response_type: "json",
        };
        delete payload.dataframe;
      } else if (nodeData?.data?.node_id === "nway_validation") {
        payload = {
          ...basePayload,
          current_node_id: targetId,
          flow_id: currentWorkflow?.flow_id,
          response_type: "json",
        };
        delete payload.dataframe;
      } else if (nodeData?.data?.node_id === "multisource_validation") {
        payload = {
          ...basePayload,
          current_node_id: targetId,
          flow_id: currentWorkflow?.flow_id,
          response_type: "json",
        };
        delete payload.dataframe;
      }
      else if (nodeData?.data?.node_id === "data_collector") {
        const sourceName = 'NWay Matching';
        // Find by name or display_name for consistency
        const sourceNode = sourceNodes.find((n: any) =>
          n.name === sourceName ||
          (n.data as any)?.display_name === sourceName ||
          (n.data as any)?.node?.display_name === sourceName
        );
        const records = await getNodeOutputData(sourceNode, flow_id);
        payload = {
          ...basePayload,
          records: records || [],
          current_node_id: targetId,
          flow_id: currentWorkflow?.flow_id,
          response_type: "json",
          stmtDate: new Date().toISOString().split('T')[0],
        };
        delete payload.dataframe;
      } else if (nodeData?.data?.node_id === "reconciliation_carryover") {
        const directUpstream = useFlowStore.getState().getUpstreamNodes(String(targetId));
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
          setIsExecuting(false);
          return;
        }

        payload = {
          ...carryOverResult.payload,
          current_node_id: targetId,
          flow_id: currentWorkflow?.flow_id,
        };

      } else if (nodeData?.data?.node_id === "validation") {
        payload = {
          ...basePayload,
          current_node_id: targetId,
          flow_id: currentWorkflow?.flow_id,
          response_type: "json",
        };
        delete payload.dataframe;
      } else if (nodeData?.data?.node_id === "nway_matching") {
        // Prefer previous node IDs in rules[].records (source name → node id), not row data.
        const upstreamNodes = useFlowStore.getState().getUpstreamNodes(String(targetId));
        const recordsBySourceName: Record<string, string> = {};
        for (const upstream of upstreamNodes) {
          const sourceName =
            (upstream.data as any)?.node?.payload?.table ||
            (upstream.data as any)?.display_name ||
            upstream.id;
          recordsBySourceName[sourceName] = upstream.id;
        }
        const executeFlowId = currentWorkflow?.flow_id || flow_id;
        const rulesWithNodeIds = Array.isArray(basePayload?.rules)
          ? basePayload.rules.map((rule: any) => ({
              ...rule,
              records: { ...recordsBySourceName },
              flow_id: executeFlowId || rule.flow_id,
            }))
          : basePayload?.rules;
        payload = {
          ...basePayload,
          rules: rulesWithNodeIds,
          current_node_id: targetId,
          flow_id: currentWorkflow?.flow_id,
          response_type: "json",
        };
        delete payload.dataframe;
      } else if (nodeData?.data?.node_id === "custom_scripts") {
        const outputData = selectedNode?.data?.node?.output?.data?.length > 0
          ? await getNodeOutputData(selectedNode, flow_id)
          : sourceNodes[0] ? await getNodeOutputData(sourceNodes[0], flow_id) : [];

        payload = {
          ...basePayload,
          current_node_id: targetId,
          flow_id: currentWorkflow?.flow_id,
          response_type: "json",
          dataframe: JSON.stringify(outputData),
        };
      } else if (
        shouldBuildKeyedDataframeForExcelWrite(
          nodeData?.data?.node_id,
          basePayload?.mode,
          useFlowStore.getState().getUpstreamNodes(String(targetId)).length
        )
      ) {
        const upstreamNodes = useFlowStore
          .getState()
          .getUpstreamNodes(String(targetId));
        const dataframeKeyed: Record<string, string> = {};
        for (const sourceNode of upstreamNodes) {
          const nodeDisplayName = getUpstreamDisplayNameForPayload(sourceNode);
          const outputData = await getNodeOutputData(sourceNode, flow_id);
          dataframeKeyed[nodeDisplayName] = JSON.stringify(outputData ?? []);
        }
        payload = {
          ...basePayload,
          current_node_id: targetId,
          flow_id: currentWorkflow?.flow_id,
          response_type: "json",
          stmtDate: new Date().toISOString().split("T")[0],
          dataframe: dataframeKeyed,
        };
      }
      else if (nodeData?.data?.node_id === "reporting") {
        // Fetch and print upstream nodes
        const upstreamNodes = useFlowStore.getState().getUpstreamNodes(selectedNode?.id || '');

        // Add dataframe key with output data from each connected node (key = display name, value = output)
        const dataframeData: { [key: string]: any } = {};

        for (const sourceNode of upstreamNodes) {
          const nodeId = sourceNode.id;
          const nodeDisplayName = sourceNode.data?.node?.display_name ||
            sourceNode.data?.display_name ||
            sourceNode.data?.node?.name ||
            sourceNode.data?.label ||
            `Node ${nodeId}`;

          // Get the output data from the source node (from store)
          const sourceOutput = sourceNode?.data?.node?.output;

          // Check if it's a validation node with nested data structure
          const isValidationNode = sourceNode?.data?.name === 'validation' ||
            sourceNode?.data?.node?.klass_name === 'ValidationComponent' ||
            sourceNode?.data?.node?.modules?.includes('validation');

          if (isValidationNode && sourceOutput?.data && typeof sourceOutput.data === 'object' && !Array.isArray(sourceOutput.data)) {
            // For validation nodes, pass validation set keys directly as top-level keys
            // Dataframe: validationSet1: {...}, validationSet2: {...}
            Object.entries(sourceOutput.data).forEach(([validationSetKey, validationSetData]: [string, any]) => {
              if (validationSetData && validationSetData.data && Array.isArray(validationSetData.data)) {
                // Add validation set data to dataframe under validation set key (direct key)
                dataframeData[validationSetKey] = validationSetData;
              }
            });
          } else if (sourceOutput) {
            // For non-validation nodes, pass the entire output object directly to dataframe
            dataframeData[nodeDisplayName] = sourceOutput;
          }
        }

        payload = {
          ...basePayload,
          current_node_id: targetId,
          flow_id: currentWorkflow?.flow_id,
          response_type: "json",
          stmtDate: new Date().toISOString().split('T')[0],
          dataframe: dataframeData
        };

      } else if (nodeData?.data?.node_id === "charts") {
        // For charts node, use the chart_data stored in payload from create chart button
        const chartData = basePayload?.chart_data;

        if (!chartData) {
          toast.error("Please create a chart first before executing.");
          setIsExecuting(false);
          return;
        }

        const formValues =
          typeof window !== "undefined" && (window as any).__chartFormValues
            ? (window as any).__chartFormValues
            : {};
        const formParams =
          typeof window !== "undefined" && (window as any).__chartFormParams
            ? (window as any).__chartFormParams
            : [];
        const mergedParams = buildWorkflowChartParamsFromNodeAndForm({
          nodePayload: basePayload || {},
          formValues,
          formParams,
        });

        const outputData = selectedNode?.data?.node?.output?.data?.length > 0
          ? await getNodeOutputData(selectedNode, flow_id)
          : sourceNodes[0] ? await getNodeOutputData(sourceNodes[0], flow_id) : [];

        // Persisted `chart_id` on the node is for save/update configuration only.
        // Execution runs the transformation on the upstream dataframe (same as workflow
        // preview in ChartFormulator): always create_chart, never update_chart here.
        const {
          chart_id: _omitChartIdFromChartData,
          actions: _omitActionsFromChartData,
          params: _omitStaleParamsFromChartData,
          ...chartDataForExecute
        } = chartData && typeof chartData === "object"
          ? (chartData as Record<string, unknown>)
          : {};
        payload = {
          key: "on-submit",
          ...chartDataForExecute,
          params: mergedParams,
          actions: "create_chart",
          is_pandas: false,
          is_polars: false,
          current_node_id: targetId,
          flow_id: currentWorkflow?.flow_id || chartData.flow_id,
          response_type: "json",
          stmtDate: new Date().toISOString().split('T')[0],
          dataframe: JSON.stringify(outputData),
          node_id: targetId
        };
      } else {
        const upstreamForExecute = useFlowStore
          .getState()
          .getUpstreamNodes(String(targetId));
        const outputData = await resolveExecuteDataframe(
          nodeData?.data?.node_id,
          nodeData,
          upstreamForExecute.length > 0 ? upstreamForExecute : sourceNodes,
          flow_id,
        );

        payload = {
          ...basePayload,
          current_node_id: targetId,
          flow_id: currentWorkflow?.flow_id,
          response_type: "json",
          stmtDate: new Date().toISOString().split('T')[0],
          dataframe: JSON.stringify(outputData),
        };
      }
      const endPoint: any = nodeData?.data?.node?.get_data || nodeData?.data?.node?.save_node;
      const isGetDataEndpoint = !!nodeData?.data?.node?.get_data;
      setIsExecuting(true);
      try {
        // Wrap with payload key for get_data (execution), but not for save_node (configuration save)
        // Add node_id and flow_id inside the payload
     const requestBody = isGetDataEndpoint
    ? { payload: { ...payload, node_id: targetId, flow_id } }
    : { ...payload, node_id: targetId, flow_id };

  const response = await saveNodeDetailsApi(endPoint, requestBody);

  // Handle API failure response
  if (response?.status === false) {
    toast.error(resolveApiErrorMessage(response, "Node execution failed"));
    return;
  }

  // Treat success unless explicitly false
  if (response != null) {
    let nodeOutput = await hydrateNodeOutputAfterExecution(
      currentWorkflow?.flow_id,
      String(targetId),
      response
    );

    if (usesLocalDataPreviewCache(nodeData?.data?.node_id)) {
      setLocalDataPreviewOutput(nodeOutput);
      nodeOutput = stripNWayMatchingOutputForMemory(nodeOutput);
    }

    selectedNode.data.node.output = nodeOutput;

    useFlowStore.getState().updateNodeData(
      selectedNode.id,
      selectedNode.data
    );

    console.log('Node Execution - Node updated in store:', {
      nodeId: selectedNode.id,
      outputDataLength: nodeOutput.data?.length || 0,
      outputColumns: nodeOutput.columns?.length || 0,
      hasUniqueId: !!nodeOutput.unique_id,
      hasResults: !!nodeOutput.results,
      resultsLength: nodeOutput.results?.length || 0,
      nodeOutputKeys: Object.keys(nodeOutput || {}),
    });

    const updatedNodeData = {
      ...nodeData.data.node,
    };

    useFlowStore.getState().updateNodeData(
      String(targetId),
      { node: updatedNodeData }
    );

    console.log('Node execution response:', response);
    console.log('Updated node data with output');

    toast.success("Node executed successfully");
  }

} catch (error: unknown) {
  toast.error(getDisplayErrorMessage(error, "Node execution failed"));

} finally {
  setIsExecuting(false);
}
    }
  }, [sourceNodes, selectedNode]);

  const handleDownloadCSV = useCallback(() => {
    const nodeName = selectedNode?.data?.display_name || selectedNode?.data?.name || 'data';
    const dateStr = new Date().toISOString().split('T')[0];

    if (selectedNode?.data?.node_id === 'merge' && mergeDataPreviewTab === 'inputs') {
      const ref = mergeInputTab === 'source' ? mergeSourceGridRef : mergeTargetGridRef;
      const suffix = mergeInputTab === 'source' ? 'source_input' : 'target_input';
      if (ref.current?.api) {
        ref.current.api.exportDataAsCsv({
          fileName: `${nodeName}_${suffix}_${dateStr}.csv`,
          columnSeparator: ',',
        });
        toast.success('Data exported successfully');
      } else {
        toast.error('No data available to export');
      }
      return;
    }

    if (excelMultiSheets?.length && activeExcelSheetTab) {
      if (excelTabGridRef.current?.api) {
        excelTabGridRef.current.api.exportDataAsCsv({
          fileName: `${nodeName}_${activeExcelSheetTab}_${dateStr}.csv`,
          columnSeparator: ',',
        });
        toast.success('Data exported successfully');
      } else {
        toast.error('No data available to export');
      }
      return;
    }

    if (gridRef.current?.api) {
      gridRef.current.api.exportDataAsCsv({
        fileName: `${nodeName}_${dateStr}.csv`,
        columnSeparator: ',',
      });
      toast.success('Data exported successfully');
    } else {
      toast.error('No data available to export');
    }
  }, [selectedNode, mergeDataPreviewTab, mergeInputTab, excelMultiSheets, activeExcelSheetTab]);

  /** When header text is selected, stop the click from reaching AG Grid so it does not toggle sort. */
  const handleHeaderClickCapture = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const inHeaderText =
      target.closest(
        '.ag-header-cell-label, .ag-header-group-cell-label, .ag-header-cell-text, .ag-header-group-text',
      ) != null;
    if (!inHeaderText) return;

    const sel = window.getSelection();
    const text = sel?.toString()?.trim() ?? '';
    if (!text) return;

    const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
    if (!range) return;
    const ancestor = range.commonAncestorContainer;
    const ancestorEl =
      ancestor.nodeType === Node.ELEMENT_NODE
        ? (ancestor as Element)
        : ancestor.parentElement;
    if (!ancestorEl?.closest?.('.ag-header')) return;

    e.stopPropagation();
    e.preventDefault();
  }, []);

  return (
    <>
      {sheetStore.isOpen && (
        <div
          className={cn(
            'fixed inset-0 z-40 bg-black/50 animate-in fade-in duration-200',
            suppressBackdropClose && 'pointer-events-none',
          )}
          onClick={
            suppressBackdropClose
              ? undefined
              : (e) => {
                  if (isSonnerToastInteraction(e.target)) return;
                  handleSheetClose();
                }
          }
          aria-hidden
        />
      )}
      <Sheet modal={false} open={sheetStore.isOpen} onOpenChange={(val) => !val && handleSheetClose()}>
        <SheetContent
          onFocusOutside={(e) => e.preventDefault()}
          side="right"
          style={{
            width: "96vw",
            maxWidth: "96vw",
            pointerEvents: disablePointerEvents ? 'none' : 'auto'
          }}
          className="rounded-l-3xl flex flex-col gap-0"
        >
          <>
            <SheetHeader className="flex-shrink-0 p-1 gap-0">
              <SheetTitle className="flex items-center gap-1">
                {(() => {
                  // Compute custom image URL only for dataset nodes with icon info
                  let imageUrl: string | null = null;
                  if (selectedNode?.data?.isDataset || selectedNode?.data?.node_id?.toLowerCase().includes('dataset')) {
                    const fileName = selectedNode?.data?.node?.payload?.file_name || selectedNode?.data?.payload?.file_name;
                    const uniqueId = selectedNode?.data?.node?.payload?.icon_unique_id || selectedNode?.data?.payload?.icon_unique_id || selectedNode?.data?.node?.payload?.unique_id || selectedNode?.data?.payload?.unique_id;
                    imageUrl = fileName && uniqueId ? `/user-uploads/${uniqueId}/${fileName}` : null;
                  }
                  
                  return <NodeIcon icon={icon} imageUrl={imageUrl} />;
                })()}
                <NodeName className="w-64" name={displayName} onSave={handleTitleSave} />
                <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
                  {selectedNode?.data?.node_id === "data_validation" && dataValidationHeaderActions && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 shrink-0"
                        onClick={dataValidationHeaderActions.onCancel}
                        disabled={dataValidationHeaderActions.isSaving}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        className="h-8 shrink-0"
                        onClick={() => void dataValidationHeaderActions.onSave()}
                        disabled={dataValidationHeaderActions.saveDisabled || dataValidationHeaderActions.isSaving}
                      >
                        {dataValidationHeaderActions.isSaving ? "Saving..." : "Save"}
                      </Button>
                    </>
                  )}
                  {selectedNode &&
                    selectedNode?.data?.node_id === 'nway_validation' &&
                    <>
                      <Button variant="outline" className="mr-2">
                        <span>Cancel</span>
                      </Button>
                      <Button variant="outline" className="mr-2" onClick={handleSave}>
                        <span>Save</span>
                      </Button>
                    </>
                  }
                  <Button
                    variant="default"
                    size="sm"
                    className="h-8 shrink-0 disabled:cursor-not-allowed"
                    onClick={(event: React.MouseEvent) => handleExecute(event, config)}
                    disabled={mode === "view"}
                  >
                    {isExecuting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        <span>Executing...</span>
                      </>
                    ) : (
                      <>
                        <ForwardedIconComponent name="play" className="w-4 h-4" />
                        <span>Execute</span>
                      </>
                    )}
                  </Button>
                </div>
              </SheetTitle>
              {selectedNode?.data?.node_id !== "subflow_view" && (
                <SheetDescription>{description}</SheetDescription>
              )}
            </SheetHeader>

            {/* <GenericNode ref={nodeRef} data={config} selected={false} /> */}

            <Tabs
              defaultValue="config"
              value={activeTab}
              onValueChange={setActiveTab}
              className={`w-full flex flex-col flex-1 overflow-hidden ${
                isSubflowViewNode ? "gap-0" : selectedNode?.data?.node_id === "data_validation" ? "gap-1" : "gap-2"
              }`}
            >
              <div className="flex items-center justify-between flex-shrink-0 px-0">
                {selectedNode?.data?.node_id !== "subflow_view" && (
                  <TabsList>
                    <TabsTrigger value="config">
                      <ForwardedIconComponent name="settings" className="w-4 h-4" />
                      <span>Configuration</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="data"
                      onClick={() => {
                        console.log('==========================================');
                        console.log('DATA PREVIEW TAB CLICKED');
                        console.log('==========================================');
                        console.log('Current State:', {
                          selectedNodeId: selectedNode?.id,
                          nodeType: selectedNode?.data?.node_id,
                          hasOutput: !!selectedNode?.data?.node?.output,
                          hasOutputData: !!selectedNode?.data?.node?.output?.data,
                          hasOutputColumns: !!selectedNode?.data?.node?.output?.columns,
                          dataLength: selectedNode?.data?.node?.output?.data?.length,
                          columnsLength: selectedNode?.data?.node?.output?.columns?.length,
                          uniqueId: selectedNode?.data?.node?.output?.unique_id,
                          currentColDefs: colDefs,
                          currentRowData: rowData,
                          rowDataLength: rowData?.length,
                          colDefsLength: colDefs?.length,
                        });
                        console.log('Full Output Object:', selectedNode?.data?.node?.output);
                        console.log('==========================================');
                      }}
                    >
                      <ForwardedIconComponent name="sheet" className="w-4 h-4" />Data Preview
                    </TabsTrigger>
                    <TabsTrigger value="logs">
                      <ForwardedIconComponent name="logs" className="w-4 h-4" />Logs Preview</TabsTrigger>
                  </TabsList>
                )}
                <BottomSheetSetting />
              </div>
              <TabsContent value="config" className="mt-0 w-full flex-1 overflow-hidden gap-0 p-0">
                <div
                  className={cn(
                    "h-full w-full gap-0 overflow-y-auto",
                    selectedNode?.data?.node_id === "data_validation"
                      ? "flex min-h-0 flex-col px-2 py-0.5"
                      : selectedNode?.data?.node_id === "data_enrichment" ||
                          isDeduplicationNodeId(selectedNode?.data?.node_id)
                        ? "flex min-h-0 flex-col px-4 py-2 sm:px-6 md:px-8"
                        : "px-3 sm:px-4",
                  )}
                >
                  {(isNodeTemplateLoading && shouldFetchNodeTemplate) || isHydratingUpstreamForConfig ? (
                    <div className="flex flex-col items-center justify-center gap-2 min-h-[200px] py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {isHydratingUpstreamForConfig && !(isNodeTemplateLoading && shouldFetchNodeTemplate)
                          ? "Loading upstream data for configuration…"
                          : "Loading configuration…"}
                      </span>
                    </div>
                  ) : selectedNode?.id && activeTab === 'config' ? (
                    <NodeDetailsPage
                      nodeDetailsData={mergedNodeDetailsForPage ?? selectedNode}
                      onClose={() => sheetStore.setIsOpen(false)}
                      mode={mode}
                    />
                  ) : selectedNode?.id && activeTab !== 'config' ? null : (
                    <div className="flex items-center justify-center h-[200px]">
                      <div className="flex flex-col gap-4 items-center justify-center">
                        <ForwardedIconComponent name="squareDashedMousePointer" className="w-16 h-16 text-primary/30" />
                        <span className="text-muted-foreground font-normal text-lg">Please Drag Node inside the canvas to open configuration</span>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
              {selectedNode?.data?.node_id !== "subflow_view" && (
                <>
                  <TabsContent
                    value="data"
                    className="mt-0 flex w-full min-h-0 flex-1 flex-col overflow-hidden bg-background text-foreground"
                  >
                    {/* Download button - only show for AG Grid tables */}
                    {!['multisource_validation', 'nway_matching', 'validation', 'nway_validation'].includes(selectedNode?.data?.node_id) && (
                      <div
                        className={
                          selectedNode?.data?.node_id === 'merge'
                            ? 'flex justify-between items-center mb-2 flex-shrink-0 gap-2 pl-2'
                            : 'flex justify-end mb-2 flex-shrink-0'
                        }
                      >
                        {selectedNode?.data?.node_id === 'merge' && (
                          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant={mergeDataPreviewTab === 'output' ? 'default' : 'outline'}
                              size="sm"
                              className="!h-8 shrink-0"
                              onClick={() => setMergeDataPreviewTab('output')}
                            >
                              Merge output
                            </Button>
                            <Button
                              type="button"
                              variant={mergeDataPreviewTab === 'inputs' ? 'default' : 'outline'}
                              size="sm"
                              className="!h-8 shrink-0"
                              onClick={() => setMergeDataPreviewTab('inputs')}
                            >
                              Input nodes data
                            </Button>
                            {mergeOutputSummary && (
                              <div className="flex min-w-0 flex-wrap items-center gap-2 px-2 py-1.5 dark:bg-muted/15">
                                {mergeOutputSummary.matched_count !== undefined && (
                                  <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/[0.08] px-2.5 py-1 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400">
                                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 opacity-80" />
                                    <span className="text-xs font-semibold tabular-nums">
                                      {mergeOutputSummary.matched_count}
                                    </span>
                                    <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-800/80 dark:text-emerald-400/90">
                                      matched
                                    </span>
                                  </div>
                                )}
                                {mergeOutputSummary.unmatched_count !== undefined && (
                                  <div className="flex items-center gap-1.5 rounded-full border border-rose-500/25 bg-rose-500/[0.08] px-2.5 py-1 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400">
                                    <XCircle className="h-3.5 w-3.5 shrink-0 opacity-80" />
                                    <span className="text-xs font-semibold tabular-nums">
                                      {mergeOutputSummary.unmatched_count}
                                    </span>
                                    <span className="text-[10px] font-medium uppercase tracking-wide text-rose-800/80 dark:text-rose-400/90">
                                      unmatched
                                    </span>
                                  </div>
                                )}
                                {mergeOutputSummary.rows_count !== undefined && (
                                  <div className="flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/[0.08] px-2.5 py-1 text-primary dark:border-primary/30 dark:bg-primary/10">
                                    <Rows3 className="h-3.5 w-3.5 shrink-0 opacity-80" />
                                    <span className="text-xs font-semibold tabular-nums">
                                      {mergeOutputSummary.rows_count}
                                    </span>
                                    <span className="text-[10px] font-medium uppercase tracking-wide text-primary/90">
                                      rows
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        <Button
                          variant="outline"
                          onClick={handleDownloadCSV}
                          className="flex items-center gap-2 !h-8"
                        >
                          <Download className="h-4 w-4" />
                          <span>Download CSV</span>
                        </Button>
                      </div>
                    )}
                    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background px-2">
                      {isDataPreviewLoading && (
                        <div
                          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-background/80 backdrop-blur-[1px]"
                          aria-busy="true"
                          aria-live="polite"
                        >
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          <span className="text-sm text-muted-foreground">Loading preview…</span>
                        </div>
                      )}

                      {activeTab !== 'data' ? null : selectedNode?.data?.node_id === 'data_validation' ? (
                        selectedNode?.data?.node?.output &&
                        <DataValidationTable config={selectedNode.data.node.output} />
                      ) : selectedNode?.data?.node_id === 'nway_validation' ? (
                        (localDataPreviewOutput ?? selectedNode?.data?.node?.output) &&
                        <NWayValidationTable
                          apiResponse={localDataPreviewOutput ?? selectedNode.data.node.output}
                        />
                      ) : selectedNode?.data?.node_id === 'nway_matching' ? (
                        (localDataPreviewOutput ?? selectedNode?.data?.node?.output) && (
                          <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
                            <NWayMatchingTable
                              apiResponse={localDataPreviewOutput ?? selectedNode.data.node.output}
                            />
                          </div>
                        )
                      ) : selectedNode?.data?.node_id === 'data_collector' ? (
                        selectedNode?.data?.node?.output &&
                        <DataCollectorPreview response={selectedNode.data.node.output} />
                      )
                        // : selectedNode?.data?.node_id === 'reconciliation_carryover' ? (
                        //   selectedNode?.data?.node?.output &&
                        //   <ReconciliationCarryOverTable response={selectedNode.data.node.output} />
                        // )
                        : selectedNode?.data?.node_id === 'multisource_validation' ? (
                          selectedNode?.data?.node?.output &&
                          <ResultsTable
                            apiResponse={selectedNode.data.node.output}
                            flowId={currentWorkflow?.flow_id}
                            currentNodeId={selectedNode.id}
                          />
                        ) : selectedNode?.data?.node_id === 'validation' ? (
                          selectedNode?.data?.node?.output &&
                          <ValidationResultsDisplay
                            validationResponse={selectedNode.data.node.output}
                          />
                        ) : selectedNode?.data?.node_id === 'reporting' ? (
                          selectedNode?.data?.node?.output ? (
                            // Render tabbed interface for reporting node output
                            (() => {
                              const output = selectedNode.data.node.output;
                              const outputData = output?.data || {};
                              const outputKeys = Object.keys(outputData);

                              // Helper function to check if data has NWay validation structure
                              const hasNWayStructure = (data: any) => {
                                return data?.data && Array.isArray(data.data) &&
                                  data.data.some((pair: any) =>
                                    pair?.records && Array.isArray(pair.records) &&
                                    pair.records.some((record: any) =>
                                      Object.keys(record).some(key => key.endsWith('_DATA'))
                                    )
                                  );
                              };

                              // Helper function to check if data has rule-based structure
                              const hasRuleBasedStructure = (data: any) => {
                                return data?.data && Array.isArray(data.data) &&
                                  data.data.length > 0 &&
                                  Array.isArray(data.data[0]) &&
                                  data.data[0].length > 0 &&
                                  typeof data.data[0][0] === 'object' &&
                                  !Object.keys(data.data[0][0]).some(key => key.endsWith('_DATA'));
                              };

                              if (outputKeys.length === 0) {
                                return (
                                  <div className="flex h-64 items-center justify-center text-muted-foreground">
                                    <div className="text-center">
                                      <p className="text-lg font-medium">No reporting data available</p>
                                      <p className="text-sm mt-2">Execute the reporting node to see results</p>
                                    </div>
                                  </div>
                                );
                              }

                              // If only one output, show it directly without tabs
                              if (outputKeys.length === 1) {
                                const key = outputKeys[0];
                                const data = outputData[key];

                                if (hasNWayStructure(data)) {
                                  return <ReportingResultsTable apiResponse={{
                                    status: true,
                                    message: 'Success',
                                    data: { [key]: data }
                                  }} />;
                                } else if (hasRuleBasedStructure(data)) {
                                  // Extract and flatten data from rule-based structure
                                  const flattenedData: any[] = [];
                                  const columns = new Set<string>();

                                  data.data.forEach((recordArray: any[]) => {
                                    if (Array.isArray(recordArray) && recordArray.length > 0) {
                                      recordArray.forEach((record: any) => {
                                        if (typeof record === 'object' && record !== null) {
                                          flattenedData.push(record);
                                          Object.keys(record).forEach(key => columns.add(key));
                                        }
                                      });
                                    }
                                  });

                                  const agColDefs = buildSheetColumnDefs(Array.from(columns)).map((col) => ({
                                    ...col,
                                    sortable: true,
                                    filter: true,
                                    resizable: true,
                                  }));

                                  return (
                                    <div className="h-full w-full sheet-data-preview-grid" onClickCapture={handleHeaderClickCapture}>
                                      <AgGridReact
                                        ref={gridRef}
                                        theme={agTheme}
                                        gridOptions={SHEET_PREVIEW_GRID_OPTIONS}
                                        rowData={flattenedData}
                                        columnDefs={agColDefs}
                                        pagination={true}
                                        paginationPageSize={20}
                                        enableCellTextSelection={true}
                                      />
                                    </div>
                                  );
                                } else {
                                  // Fallback to default AG Grid
                                  return (
                                    <div className="h-full w-full sheet-data-preview-grid" onClickCapture={handleHeaderClickCapture}>
                                      <AgGridReact
                                        ref={gridRef}
                                        theme={agTheme}
                                        gridOptions={SHEET_PREVIEW_GRID_OPTIONS}
                                        rowData={rowData || []}
                                        columnDefs={colDefs}
                                        pagination={true}
                                        enableCellTextSelection={true}
                                      />
                                    </div>
                                  );
                                }
                              }

                              // Multiple outputs - show tabs
                              return (
                                <Tabs defaultValue={outputKeys[0]} className="w-full">
                                  <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                                    {outputKeys.map((key) => (
                                      <TabsTrigger key={key} value={key} className="text-xs">
                                        {key}
                                      </TabsTrigger>
                                    ))}
                                  </TabsList>

                                  {outputKeys.map((key) => {
                                    const data = outputData[key];

                                    return (
                                      <TabsContent key={key} value={key} className="mt-4">
                                        {hasNWayStructure(data) ? (
                                          <ReportingResultsTable apiResponse={{
                                            status: true,
                                            message: 'Success',
                                            data: { [key]: data }
                                          }} />
                                        ) : hasRuleBasedStructure(data) ? (
                                          // Show AG Grid for rule-based validation data
                                          (() => {
                                            const flattenedData: any[] = [];
                                            const columns = new Set<string>();

                                            data.data.forEach((recordArray: any[]) => {
                                              if (Array.isArray(recordArray) && recordArray.length > 0) {
                                                recordArray.forEach((record: any) => {
                                                  if (typeof record === 'object' && record !== null) {
                                                    flattenedData.push(record);
                                                    Object.keys(record).forEach(col => columns.add(col));
                                                  }
                                                });
                                              }
                                            });

                                            const agColDefs = buildSheetColumnDefs(Array.from(columns)).map((col) => ({
                                              ...col,
                                              sortable: true,
                                              filter: true,
                                              resizable: true,
                                            }));

                                            return (
                                              <div className="h-full w-full sheet-data-preview-grid" onClickCapture={handleHeaderClickCapture}>
                                                <AgGridReact
                                                  ref={gridRef}
                                                  theme={agTheme}
                                                  gridOptions={SHEET_PREVIEW_GRID_OPTIONS}
                                                  rowData={flattenedData}
                                                  columnDefs={agColDefs}
                                                  pagination={true}
                                                  paginationPageSize={20}
                                                  enableCellTextSelection={true}
                                                />
                                              </div>
                                            );

                                          })()
                                        ) : (
                                          // Fallback to default AG Grid
                                          <div className="h-full w-full sheet-data-preview-grid" onClickCapture={handleHeaderClickCapture}>
                                            <AgGridReact
                                              ref={gridRef}
                                              theme={agTheme}
                                              gridOptions={SHEET_PREVIEW_GRID_OPTIONS}
                                              rowData={rowData || []}
                                              columnDefs={colDefs}
                                              pagination={true}
                                              enableCellTextSelection={true}
                                            />
                                          </div>
                                        )}
                                      </TabsContent>
                                    );
                                  })}
                                </Tabs>
                              );
                            })()
                          ) : (
                            <div className="flex h-64 items-center justify-center text-muted-foreground">
                              <div className="text-center">
                                <p className="text-lg font-medium">No reporting data available</p>
                                <p className="text-sm mt-2">Execute the reporting node to see results</p>
                              </div>
                            </div>
                          )
                        ) : excelMultiSheets && excelMultiSheets.length > 0 ? (
                          <Tabs
                            value={activeExcelSheetTab || excelMultiSheets[0]?.key}
                            onValueChange={setActiveExcelSheetTab}
                            className="flex min-h-0 w-full flex-1 flex-col gap-2"
                          >
                            <TabsList className="flex h-auto max-h-32 w-full flex-shrink-0 flex-wrap justify-start gap-1 overflow-x-auto">
                              {excelMultiSheets.map((s) => (
                                <TabsTrigger
                                  key={s.key}
                                  value={s.key}
                                  className="max-w-[220px] shrink-0 truncate text-xs"
                                  title={s.key}
                                >
                                  {s.key}
                                </TabsTrigger>
                              ))}
                            </TabsList>
                            {excelMultiSheets.map((s) => (
                              <TabsContent
                                key={s.key}
                                value={s.key}
                                className="mt-0 min-h-[320px] flex-1 overflow-hidden data-[state=inactive]:hidden"
                              >
                                <div
                                  className="h-full min-h-[320px] w-full sheet-data-preview-grid"
                                  onClickCapture={handleHeaderClickCapture}
                                >
                                  <AgGridReact
                                    ref={
                                      (activeExcelSheetTab || excelMultiSheets[0]?.key) === s.key
                                        ? excelTabGridRef
                                        : undefined
                                    }
                                    key={`excel-multi-${selectedNode?.id}-${s.key}-${s.colDefs?.length}-${s.rowData?.length}`}
                                    theme={agTheme}
                                    gridOptions={SHEET_PREVIEW_GRID_OPTIONS}
                                    rowData={s.rowData || []}
                                    columnDefs={s.colDefs}
                                    pagination={true}
                                    paginationPageSize={20}
                                    enableCellTextSelection={true}
                                  />
                                </div>
                              </TabsContent>
                            ))}
                          </Tabs>
                        ) : selectedNode?.data?.node_id === 'merge' ? (
                          <div className="flex flex-col gap-2 min-h-[360px] w-full flex-1">
                            {mergeDataPreviewTab === 'output' ? (
                              <>
                                <div className="h-full min-h-[320px] w-full sheet-data-preview-grid" onClickCapture={handleHeaderClickCapture}>
                                  <AgGridReact
                                    ref={gridRef}
                                    key={`grid-merge-out-${selectedNode?.id}-${colDefs?.length}-${rowData?.length}`}
                                    theme={agTheme}
                                    gridOptions={SHEET_PREVIEW_GRID_OPTIONS}
                                    rowData={rowData || []}
                                    columnDefs={colDefs}
                                    pagination={true}
                                    enableCellTextSelection={true}
                                  />
                                </div>
                              </>
                            ) : (
                              <Tabs
                                value={mergeInputTab}
                                onValueChange={(v) => setMergeInputTab(v as 'source' | 'target')}
                                className="flex w-full flex-col gap-2 flex-1 min-h-0"
                              >
                                <TabsList className="grid h-9 w-full max-w-lg grid-cols-2 flex-shrink-0">
                                  <TabsTrigger value="source" className="truncate text-xs">
                                    Source: {mergeSourceDisplayName}
                                  </TabsTrigger>
                                  <TabsTrigger value="target" className="truncate text-xs">
                                    Target: {mergeTargetDisplayName}
                                  </TabsTrigger>
                                </TabsList>
                                <TabsContent value="source" className="mt-0 min-h-[320px] flex-1 overflow-hidden">
                                  {mergeSourceInputGrid.colDefs.length === 0 ? (
                                    <div className="flex min-h-[240px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                                      No source data — run the source node first.
                                    </div>
                                  ) : (
                                    <div className="h-full min-h-[320px] w-full sheet-data-preview-grid" onClickCapture={handleHeaderClickCapture}>
                                      <AgGridReact
                                        ref={mergeSourceGridRef}
                                        key={`merge-src-${mergeSourceInputGrid.rowData.length}-${mergeSourceInputGrid.colDefs.length}`}
                                        theme={agTheme}
                                        gridOptions={SHEET_PREVIEW_GRID_OPTIONS}
                                        rowData={mergeSourceInputGrid.rowData}
                                        columnDefs={mergeSourceInputGrid.colDefs}
                                        pagination={true}
                                        paginationPageSize={20}
                                        enableCellTextSelection={true}
                                      />
                                    </div>
                                  )}
                                </TabsContent>
                                <TabsContent value="target" className="mt-0 min-h-[320px] flex-1 overflow-hidden">
                                  {mergeTargetInputGrid.colDefs.length === 0 ? (
                                    <div className="flex min-h-[240px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                                      No target data — run the target node first.
                                    </div>
                                  ) : (
                                    <div className="h-full min-h-[320px] w-full sheet-data-preview-grid" onClickCapture={handleHeaderClickCapture}>
                                      <AgGridReact
                                        ref={mergeTargetGridRef}
                                        key={`merge-tgt-${mergeTargetInputGrid.rowData.length}-${mergeTargetInputGrid.colDefs.length}`}
                                        theme={agTheme}
                                        gridOptions={SHEET_PREVIEW_GRID_OPTIONS}
                                        rowData={mergeTargetInputGrid.rowData}
                                        columnDefs={mergeTargetInputGrid.colDefs}
                                        pagination={true}
                                        paginationPageSize={20}
                                        enableCellTextSelection={true}
                                      />
                                    </div>
                                  )}
                                </TabsContent>
                              </Tabs>
                            )}
                          </div>
                        ) : isDeduplicationNodeId(selectedNode?.data?.node_id) && fuzzyMatchDataPreview ? (
                          <div className="flex min-h-[360px] w-full min-w-0 flex-1 flex-col gap-2">
                            {fuzzyMatchDataPreview.summary &&
                              Object.keys(fuzzyMatchDataPreview.summary).length > 0 && (
                                <div className="w-full min-w-0 flex-shrink-0 overflow-hidden rounded-xl border border-border bg-background shadow-sm">
                                  <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-7 py-1.5">
                                    <div className="flex min-w-0 items-center gap-1.5">
                                      <span className="text-lg font-semibold text-foreground">Summary</span>
                                    </div>
                                    {fuzzyMatchDataPreview.duplicateGroupCount > 0 && (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="!h-8 shrink-0 gap-1 border-border px-2.5 text-[11px] font-medium text-foreground "
                                        onClick={() => setFuzzyDuplicateGroupsDialogOpen(true)}
                                      >
                                        Duplicate groups
                                
                                      </Button>
                                    )}
                                  </div>
                                  <dl className="flex w-full min-w-0 items-stretch gap-1.5 px-2.5 py-2 sm:gap-2">
                                    {Object.entries(fuzzyMatchDataPreview.summary).map(([k, v]) => {
                                      const display =
                                        v === null || v === undefined ? "—" : String(v);
                                      return (
                                        <div
                                          key={k}
                                          className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg border border-border bg-muted/20 px-1.5 py-2 text-center sm:px-2"
                                        >
                                          
                                          <dt className="w-full min-w-0 text-[10px] font-semibold uppercase leading-tight tracking-wide sm:text-[9px]">
                                            {formatFuzzySummaryLabel(k)}
                                          </dt>
                                          <dd className="w-full min-w-0 break-words text-sm font-semibold tabular-nums leading-tight text-foreground">
                                            {display}
                                          </dd>
                                        </div>
                                      );
                                    })}
                                  </dl>
                                </div>
                              )}
                            {(!fuzzyMatchDataPreview.summary ||
                              Object.keys(fuzzyMatchDataPreview.summary).length === 0) &&
                              fuzzyMatchDataPreview.duplicateGroupCount > 0 && (
                                <div className="flex flex-shrink-0 justify-end rounded-xl border border-border bg-muted/30 px-3 py-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 gap-1.5 border-border px-2.5 text-xs font-medium text-foreground"
                                    onClick={() => setFuzzyDuplicateGroupsDialogOpen(true)}
                                  >
                                    <Layers2 className="h-3.5 w-3.5 opacity-80" />
                                    Duplicate groups
                                    <span className="rounded border border-border bg-background px-1.5 py-0.5 font-mono tabular-nums text-[11px]">
                                      {fuzzyMatchDataPreview.duplicateGroupCount}
                                    </span>
                                  </Button>
                                </div>
                              )}
                            <div
                              className="sheet-data-preview-grid h-full min-h-[280px] w-full min-w-0 flex-1"
                              onClickCapture={handleHeaderClickCapture}
                            >
                              <AgGridReact
                                ref={gridRef}
                                key={`grid-fuzzy-${selectedNode?.id}-${colDefs?.length}-${rowData?.length}`}
                                theme={agTheme}
                                gridOptions={SHEET_PREVIEW_GRID_OPTIONS}
                                rowData={rowData || []}
                                columnDefs={colDefs}
                                pagination={true}
                                paginationPageSize={20}
                                enableCellTextSelection={true}
                              />
                            </div>
                            <Dialog
                              open={fuzzyDuplicateGroupsDialogOpen}
                              onOpenChange={setFuzzyDuplicateGroupsDialogOpen}
                            >
                              <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
                                <DialogHeader className="border-b border-border px-4 py-3 text-left">
                                  <DialogTitle>Duplicate groups</DialogTitle>
                                  <p className="text-sm text-muted-foreground">
                                    Rows in each group are potential duplicates; the Group column indexes each group.
                                  </p>
                                </DialogHeader>
                                <div className="min-h-[280px] flex-1 overflow-hidden px-2 pb-4 pt-0 sm:px-4">
                                  <div className="sheet-data-preview-grid h-[min(60vh,520px)] w-full">
                                    {fuzzyMatchDataPreview.dupGrid.rowData.length > 0 ? (
                                      <AgGridReact
                                        key={`fuzzy-dup-dialog-${selectedNode?.id}-${fuzzyMatchDataPreview.dupGrid.colDefs.length}-${fuzzyMatchDataPreview.dupGrid.rowData.length}`}
                                        theme={agTheme}
                                        gridOptions={SHEET_PREVIEW_GRID_OPTIONS}
                                        rowData={fuzzyMatchDataPreview.dupGrid.rowData}
                                        columnDefs={fuzzyMatchDataPreview.dupGrid.colDefs}
                                        pagination={true}
                                        paginationPageSize={20}
                                        enableCellTextSelection={true}
                                      />
                                    ) : (
                                      <p className="p-4 text-sm text-muted-foreground">
                                        No duplicate group rows in this response.
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        ) : (
                          <div className="h-full w-full sheet-data-preview-grid" onClickCapture={handleHeaderClickCapture}>
                            <AgGridReact
                              ref={gridRef}
                              key={`grid-${selectedNode?.id}-${theme}-${colDefs?.length}-${rowData?.length}`}
                              theme={agTheme}
                              gridOptions={SHEET_PREVIEW_GRID_OPTIONS}
                              rowData={rowData || []}
                              columnDefs={colDefs}
                              pagination={true}
                              enableCellTextSelection={true}
                            />
                          </div>
                        )
                      }
                    </div>
                  </TabsContent>
                  <TabsContent value="logs" className="w-full flex-1 overflow-hidden mt-4">
                    <div className="w-full h-full overflow-y-auto px-4">
                      {/* Logs content will go here */}
                    </div>
                  </TabsContent>
                </>
              )}
            </Tabs>
          </>
        </SheetContent>
      </Sheet>
    </>
  );
};
export default SliderComponent;
