/**
 * After workflow load, optionally prefetch connector preview for nodes with no upstream edges
 * (sources) by calling each node's get_data (e.g. postgresql-actions, file-actions).
 */
import { saveNodeDetailsApi } from '@/controllers/API';
import { hydrateNodeOutputAfterExecution } from '@/utils/nodeDataUtils';
import { isSourceNode } from '@/utils/nodeUtils';
import useFlowStore from '@/stores/flowStore';
import { isRequestAborted, type ApiRequestOptions } from '@/utils/apiAbort';

export type EagerSourcePreviewOptions = ApiRequestOptions & {
  /** Skip updates when the active workflow flow_id no longer matches. */
  expectedFlowId?: string;
};

/** Same shape logic as sheet-component extractColumnsAndDataFromOutput (subset for "has preview"). */
function outputHasGridPreview(output: any): boolean {
  if (!output) return false;
  let columns: any[] = [];
  let data: any[] = [];

  if (Array.isArray(output.columns) && output.columns.length > 0 && output.data != null) {
    columns = output.columns;
    data = Array.isArray(output.data) ? output.data : [];
  } else if (
    output.data &&
    typeof output.data === 'object' &&
    !Array.isArray(output.data) &&
    Array.isArray((output.data as any).data) &&
    (output.data as any).data.length > 0
  ) {
    data = (output.data as any).data;
    columns =
      Array.isArray((output.data as any).columns) && (output.data as any).columns.length > 0
        ? (output.data as any).columns
        : Object.keys((output.data as any).data[0] || {});
  } else if (Array.isArray(output.data) && output.data.length > 0) {
    data = output.data;
    columns = Object.keys(output.data[0] || {});
  }

  if (data.length > 0 && columns.length === 0) {
    columns = Object.keys(data[0] || {});
  }

  return columns.length > 0 && data.length > 0;
}

function canEagerFetchSourceGetData(node: any): boolean {
  // Eager fetching source data on workflow load is disabled for all source nodes.
  // Data should only be fetched when the user explicitly clicks on Data Preview,
  // or when opening a downstream configuration that requires the upstream node's columns.
  return false;
}

function isStillActiveWorkflow(
  expectedFlowId: string | undefined,
  signal?: AbortSignal,
): boolean {
  if (signal?.aborted) return false;
  if (!expectedFlowId) return true;
  return useFlowStore.getState().currentWorkflow?.flow_id === expectedFlowId;
}

/**
 * For each workflow source node (no incoming edges) with get_data, call connector preview if output is still empty.
 * Updates the flow store as each response returns. Failures are logged; one failure does not block others.
 */
export async function eagerHydrateSourceNodesAfterWorkflowLoad(
  options?: EagerSourcePreviewOptions,
): Promise<void> {
  const signal = options?.signal;
  const expectedFlowId = options?.expectedFlowId;

  const wf = useFlowStore.getState().currentWorkflow;
  if (!wf?.flow_id || !wf.data?.nodes?.length) return;
  if (!isStillActiveWorkflow(expectedFlowId ?? wf.flow_id, signal)) return;

  const flowId = wf.flow_id;
  const edges = wf.data.edges ?? [];
  const nodes = wf.data.nodes as any[];

  const targets = nodes.filter((n) => {
    if (!n?.id) return false;
    if (!isSourceNode(n.id, edges)) return false;
    if (!canEagerFetchSourceGetData(n)) return false;
    if (outputHasGridPreview(n.data?.node?.output)) return false;
    return true;
  });

  if (targets.length === 0) return;

  await Promise.allSettled(
    targets.map(async (node: any) => {
      const nodeId = node.id;
      if (!isStillActiveWorkflow(expectedFlowId ?? flowId, signal)) return;
      try {
        const basePayload = node.data?.node?.payload ?? {};
        const payload = {
          ...basePayload,
          current_node_id: nodeId,
          flow_id: flowId,
          response_type: 'json' as const,
          stmtDate: new Date().toISOString().split('T')[0],
          dataframe: JSON.stringify([]),
        };
        const endPoint = node.data?.node?.get_data;
        const requestBody = { payload: { ...payload, node_id: nodeId, flow_id: flowId } };
        const execResponse = await saveNodeDetailsApi(endPoint, requestBody, { signal });
        if (!isStillActiveWorkflow(expectedFlowId ?? flowId, signal)) return;
        if (execResponse == null || (execResponse as { status?: boolean }).status === false) return;

        const latest = useFlowStore.getState().currentWorkflow?.data?.nodes?.find((x: any) => x.id === nodeId);
        if (!latest) return;

        const nodeOutput = await hydrateNodeOutputAfterExecution(
          flowId,
          String(nodeId),
          execResponse,
          { signal },
        );
        if (!isStillActiveWorkflow(expectedFlowId ?? flowId, signal)) return;

        useFlowStore.getState().updateNodeData(nodeId, {
          node: {
            ...latest.data.node,
            output: nodeOutput,
          },
        });
      } catch (e) {
        if (isRequestAborted(e)) return;
        console.warn('[eagerSourceNodePreview] get_data failed for source node', nodeId, e);
      }
    }),
  );
}
