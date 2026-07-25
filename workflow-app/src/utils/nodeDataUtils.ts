import { getNodeDataByUniqueIdApi } from '@/controllers/API';
import { toast } from 'sonner';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import { isRequestAborted } from '@/utils/apiAbort';

/**
 * Fetches the actual data for a node using its unique_id
 * @param flow_id - The workflow ID
 * @param node_id - The node ID
 * @param unique_id - The unique identifier for the node data
 * @returns The node's data array
 */
export async function fetchNodeDataByUniqueId(
  flow_id: string,
  node_id: string,
  unique_id: string
): Promise<any[]> {
  try {
    const response = await getNodeDataByUniqueIdApi({
      flow_id,
      node_id,
      unique_id,
    });

    if (response.status && response.data) {
      return response.data;
    } else {
      console.warn(`No data found for unique_id: ${unique_id}`);
      return [];
    }
  } catch (error) {
    console.error(`Failed to fetch data for unique_id: ${unique_id}`, error);
    toast.error(getDisplayErrorMessage(error, 'Failed to fetch node data'));
    return [];
  }
}

/**
 * Extracts node output data, fetching from API if only unique_id is stored
 * @param node - The node object
 * @param flow_id - The workflow ID (optional, only needed if data needs to be fetched)
 * @returns The node's output data array
 */

export async function getNodeOutputData(node: any, flow_id?: string): Promise<any[]> {
  if (!node?.data?.node?.output) {
    return [];
  }

  const output = node.data.node.output;

  // If data is already available, return it (preferred path after workflow load)
  if (output.data && Array.isArray(output.data) && output.data.length > 0) {
    return output.data;
  }

  // If unique_id is available and flow_id is provided, fetch the data
  // This is a fallback for cases where data wasn't preloaded

  if (output.unique_id && flow_id) { 
    console.log(`Fetching data on-demand for node ${node.id} with unique_id ${output.unique_id}`);
    return await fetchNodeDataByUniqueId(flow_id, node.id, output.unique_id);
  }

  return [];
}

/** Transform nodes must run on upstream input, not their own prior execute output. */
const EXECUTE_ALWAYS_UPSTREAM_NODE_IDS = new Set(['filter_data']);

export function executeUsesUpstreamDataframeOnly(nodeId: string | undefined): boolean {
  return nodeId != null && EXECUTE_ALWAYS_UPSTREAM_NODE_IDS.has(nodeId);
}

/**
 * Resolves row data for get_data `dataframe`. Filter-style nodes always use the
 * direct upstream node; others may reuse this node's output after a prior run.
 */
export async function resolveExecuteDataframe(
  nodeId: string | undefined,
  currentNode: any,
  upstreamNodes: any[],
  flow_id?: string,
): Promise<any[]> {
  const upstream = upstreamNodes?.[0];
  if (executeUsesUpstreamDataframeOnly(nodeId)) {
    return upstream ? getNodeOutputData(upstream, flow_id) : [];
  }

  const selfOutput = currentNode?.data?.node?.output;
  if (selfOutput?.data && Array.isArray(selfOutput.data) && selfOutput.data.length > 0) {
    return getNodeOutputData(currentNode, flow_id);
  }

  return upstream ? getNodeOutputData(upstream, flow_id) : [];
}

/**
 * Creates node output structure with unique_id AND data for in-memory use
 * Data will be stripped when saving to database
 * @param response - The full API response object
 * @returns Output object with all response fields including unique_id and data
 */
export function createNodeOutputWithUniqueId(response: any) {
  const data = response.data || [];

  // Extract columns from data if not provided by the API
  let columns = response.columns;
  if (!columns && Array.isArray(data) && data.length > 0) {
    // Extract column names from the first data object
    columns = Object.keys(data[0]);
  }

  // Return the full response with extracted columns
  return {
    ...response,
    data,
    columns: columns || [],
  };
}

export async function hydrateNodeOutputAfterExecution(
  flowId: string | undefined,
  nodeId: string,
  executionResponse: any,
  options?: { signal?: AbortSignal },
) {
  let nodeOutput: any;

  if (executionResponse?.unique_id) {
    nodeOutput = createNodeOutputWithUniqueId(executionResponse);

    if (flowId && !hasInlineExecutionRows(executionResponse)) {
      try {
        const fetchResponse = await getNodeDataByUniqueIdApi(
          {
            flow_id: flowId,
            node_id: nodeId,
            unique_id: executionResponse.unique_id,
          },
          { signal: options?.signal },
        );

        if (fetchResponse?.status && hasInlineExecutionRows(fetchResponse)) {
          nodeOutput = {
            ...nodeOutput,
            data: fetchResponse.data,
            columns: fetchResponse.columns || nodeOutput.columns || [],
          };
        }
      } catch (error) {
        if (isRequestAborted(error)) throw error;
        console.error(
          `Failed to hydrate execution data for node ${nodeId} with unique_id ${executionResponse.unique_id}:`,
          error
        );
      }
    }
  } else {
    const data = executionResponse?.data || [];
    let columns = executionResponse?.columns;
    if (!columns && Array.isArray(data) && data.length > 0) {
      columns = Object.keys(data[0]);
    }
    nodeOutput = {
      ...executionResponse,
      data,
      columns: columns || [],
    };
  }

  return nodeOutput;
}

/** N-Way Matching execute output: `{ data: { [sourceName]: row[] } }`. */
export function hasNWayMatchingPreview(output: any): boolean {
  const root = output?.data;
  if (!root || typeof root !== 'object' || Array.isArray(root)) return false;
  return Object.values(root).some((v) => Array.isArray(v) && v.length > 0);
}

/** True when execute/transform response already includes row payloads (flat array or N-way source map). */
export function hasInlineExecutionRows(response: any): boolean {
  if (!response || typeof response !== 'object') return false;
  if (Array.isArray(response.data) && response.data.length > 0) return true;
  return hasNWayMatchingPreview(response);
}

/** Drop heavy matching rows from in-memory store; keep unique_id for lazy Data Preview reload. */
export function stripNWayMatchingOutputForMemory(output: any) {
  if (output == null || typeof output !== 'object') return output;
  if (!hasNWayMatchingPreview(output)) return output;
  return {
    ...output,
    data: output.unique_id ? {} : output.data,
  };
}

/**
 * Strips row payloads from node output before persisting workflow when `unique_id` exists
 * (rows can be refetched). If there is no `unique_id`, output is left unchanged.
 */
export function stripDataForSave(nodeOutput: any) {
  if (nodeOutput == null || typeof nodeOutput !== 'object') {
    return nodeOutput;
  }
  if (!nodeOutput.unique_id) {
    return nodeOutput;
  }

  return {
    ...nodeOutput,
    data: [],
  };
}

/**
 * Source nodes with Virtual DB enabled: persist execution preview metadata (columns, unique_id, etc.)
 * without row payloads — same idea as {@link stripDataForSave} but also applies when there is no unique_id
 * yet (columns-only preview after execute).
 */
export function stripVirtualDbSourceOutputForSave(nodeOutput: any) {
  if (nodeOutput == null || typeof nodeOutput !== 'object') {
    return undefined;
  }
  if (nodeOutput.unique_id) {
    return stripDataForSave(nodeOutput);
  }
  return {
    ...nodeOutput,
    data: [],
  };
}

/**
 * Checks if a node has executable output (either data or unique_id)
 * @param node - The node object
 * @returns True if the node has output available
 */
export function hasNodeOutput(node: any): boolean {
  if (!node?.data?.node?.output) {
    return false;
  }

  const output = node.data.node.output;
  
  // Has actual data
  if (output.data && Array.isArray(output.data) && output.data.length > 0) {
    return true;
  }

  // Has unique_id reference
  if (output.unique_id) {
    return true;
  }

  return false;
}

/** Label used for reconciliation carryover `records` keys — matches form save wiring. */
export function getReconciliationCarryOverSourceLabel(node: any): string {
  const d = node?.data as Record<string, unknown> | undefined;
  const inner = d?.node as Record<string, unknown> | undefined;
  const payload = inner?.payload as Record<string, unknown> | undefined;
  return (
    (payload?.table as string | undefined) ||
    (d?.display_name as string | undefined) ||
    String(node?.id ?? 'Unknown')
  );
}

function deriveColumnsFromRecordRows(rows: unknown[], fallbackOutput?: any): string[] {
  if (Array.isArray(rows) && rows.length > 0 && rows[0] && typeof rows[0] === 'object') {
    return Object.keys(rows[0] as object);
  }
  if (Array.isArray(fallbackOutput?.columns) && fallbackOutput.columns.length > 0) {
    return fallbackOutput.columns;
  }
  return [];
}

function matchesReconciliationCarryOverSourceName(node: any, sourceName: string): boolean {
  const sn = String(sourceName);
  const d = node?.data as Record<string, unknown> | undefined;
  const inner = d?.node as Record<string, unknown> | undefined;
  const payload = inner?.payload as Record<string, unknown> | undefined;
  return (
    node?.id === sn ||
    d?.display_name === sn ||
    inner?.display_name === sn ||
    payload?.table === sn ||
    d?.name === sn ||
    d?.label === sn
  );
}

export type ReconciliationCarryOverExecuteResult =
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; error: string };

/**
 * Builds execute payload fields for reconciliation_carryover.
 * Prefers direct upstream parent(s) (same as preview), refreshes `columns` from row data,
 * and sends `records` as a flat row array (execute API contract).
 */
export async function buildReconciliationCarryOverExecutePayload(
  basePayload: Record<string, unknown>,
  flowId: string,
  context: {
    nodes: any[];
    directUpstreamNodes: any[];
    allUpstreamNodes?: any[];
  },
): Promise<ReconciliationCarryOverExecuteResult> {
  const { nodes, directUpstreamNodes, allUpstreamNodes } = context;
  const upstreamPool =
    allUpstreamNodes && allUpstreamNodes.length > 0 ? allUpstreamNodes : directUpstreamNodes;

  let sourceNodes = directUpstreamNodes.filter(Boolean);

  if (sourceNodes.length === 0) {
    const savedSourceName = basePayload.source_name;
    let sourceNode =
      savedSourceName != null && savedSourceName !== ''
        ? upstreamPool.find((n) => matchesReconciliationCarryOverSourceName(n, String(savedSourceName)))
        : undefined;

    if (!sourceNode && savedSourceName) {
      sourceNode = nodes?.find((n) => matchesReconciliationCarryOverSourceName(n, String(savedSourceName)));
    }
    if (!sourceNode && upstreamPool.length > 0 && (savedSourceName == null || savedSourceName === '')) {
      sourceNode = upstreamPool[0];
    }
    if (!sourceNode) {
      return {
        ok: false,
        error:
          savedSourceName != null && savedSourceName !== ''
            ? `Source node "${savedSourceName}" not found in upstream nodes`
            : 'No upstream source node connected. Connect a source and save.',
      };
    }
    sourceNodes = [sourceNode];
  }

  const firstParent = sourceNodes[0];
  const sourceName = getReconciliationCarryOverSourceLabel(firstParent);
  const records = await getNodeOutputData(firstParent, flowId);

  if (!Array.isArray(records) || records.length === 0) {
    return {
      ok: false,
      error: 'No data available from source node. Please execute the source node first.',
    };
  }

  const columns = deriveColumnsFromRecordRows(
    records,
    (firstParent?.data as any)?.node?.output,
  );

  const payload: Record<string, unknown> = {
    ...basePayload,
    source_name: sourceName,
    records,
    columns,
    response_type: 'json',
    output_format: basePayload.output_format ?? 'json',
    custom_filters: basePayload.custom_filters ?? '',
    stmtDate: new Date().toISOString().split('T')[0],
  };
  delete payload.dataframe;
  delete payload.node_id;

  return { ok: true, payload };
}

