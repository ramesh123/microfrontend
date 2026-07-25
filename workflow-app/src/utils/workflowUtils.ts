import { stripDataForSave, stripVirtualDbSourceOutputForSave } from './nodeDataUtils';
import { getNodesWithoutInputs } from './nodeUtils';
import {
  sanitizeApiConnectorPayloadForWire,
  serializeApiConnectorKeyValueMapsForApi,
} from './apiConnectorPayload';
import { isRequestAborted } from './apiAbort';

/**
 * Clear inline row payloads before persisting workflow — config only, no execution data.
 * - Top-level `payload.records` (e.g. reconciliation carryover: `{ [sourceName]: rows[] }`)
 * - Per-rule `payload.rules[].records` (e.g. N-way matching)
 * - `payload.dataframe` (upstream row data is rehydrated at execute time, not stored on workflow save)
 * - Merge node: `payload.source_data` and `payload.target_data` (same as execute-time row wiring)
 */
function withStrippedRuleRecordsAndStmtDate(
  payload: any,
  stmtDate: string,
  nodeTypeId?: string
): any {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }
  const next = { ...payload, stmtDate, records: {} };
  if (Object.prototype.hasOwnProperty.call(next, 'dataframe')) {
    delete next.dataframe;
  }
  if (String(nodeTypeId ?? '').toLowerCase() === 'merge') {
    if (Object.prototype.hasOwnProperty.call(next, 'source_data')) {
      delete next.source_data;
    }
    if (Object.prototype.hasOwnProperty.call(next, 'target_data')) {
      delete next.target_data;
    }
  }
  if (Array.isArray(next.rules)) {
    next.rules = next.rules.map((rule: any) => {
      if (!rule || typeof rule !== 'object') return rule;
      return { ...rule, records: {} };
    });
  }
  return next;
}

/** Default viewport for React Flow when the API omits it. */
export function ensureWorkflowViewport(workflow: any): any {
  if (!workflow?.data) return workflow;
  if (workflow.data.viewport) return workflow;
  return {
    ...workflow,
    data: {
      ...workflow.data,
      viewport: { x: 133.3, y: 187.695, zoom: 0.77 },
    },
  };
}

/**
 * Shallow-copies the workflow graph so `node.data.node.output.data` row arrays are never
 * serialized in the subsequent `JSON.stringify` deep clone. Row payloads are not persisted
 * in workflow saves anyway (see strip rules below); omitting them avoids multi‑second
 * freezes and OOM when previews hold 100k+ rows per node.
 */
function workflowWithClearedOutputRowArraysForSaveClone(workflow: any): any {
  if (!workflow?.data?.nodes) return workflow;
  return {
    ...workflow,
    data: {
      ...workflow.data,
      nodes: workflow.data.nodes.map((node: any) => {
        const output = node?.data?.node?.output;
        const rowData = output?.data;
        if (!output || !Array.isArray(rowData) || rowData.length === 0) {
          return node;
        }
        const nodeInner = node.data?.node;
        if (!node.data || !nodeInner) return node;
        return {
          ...node,
          data: {
            ...node.data,
            node: {
              ...nodeInner,
              output: {
                ...output,
                data: [],
              },
            },
          },
        };
      }),
    },
  };
}

/**
 * Prepares workflow for saving by stripping data from nodes
 * - Source nodes (no inputs): Remove all output data (they fetch fresh data on execute), except
 *   Virtual DB sources (`virtualDbEnabled`): keep columns / unique_id via {@link stripVirtualDbSourceOutputForSave}
 * - Nodes with unique_id: Keep metadata but set data to [] (refetch on load); no unique_id: output unchanged
 * - Payloads with inline row data: Set top-level `payload.records` and each `payload.rules[].records`
 *   to `{}` (reconciliation carryover + N-way matching); remove `payload.dataframe` on every node;
 *   merge nodes also drop `source_data` / `target_data`
 * @param workflow - The workflow object with full data
 * @returns Workflow with stripped data for database storage
 */
export function prepareWorkflowForSave(workflow: any) {
  if (!workflow?.data?.nodes) {
    return workflow;
  }

  // Avoid cloning huge in-memory preview arrays; same persisted shape after strip.
  const workflowForClone = workflowWithClearedOutputRowArraysForSaveClone(workflow);
  const workflowToSave = JSON.parse(JSON.stringify(workflowForClone));

  // Fix any invalid node/edge ids for Virtual DB mode before any graph-based processing


  // Get today's date for stmtDate
  const today = new Date();
  const stmtDate = today.toISOString().split('T')[0];

  // Get source nodes (nodes with no incoming connections - these are always source columns)
  const sourceNodeIds = getNodesWithoutInputs(workflowToSave.data.edges || []);
  const sourceNodeSet = new Set(sourceNodeIds);

  console.log('=== Preparing Workflow for Save ===');
  console.log('Total nodes:', workflowToSave.data.nodes.length);
  console.log('Source-only nodes (no incoming edges, will have output cleared):', Array.from(sourceNodeSet));

  // Strip data from nodes based on their type
 workflowToSave.data.nodes = workflowToSave.data.nodes.map((node: any) => {
  const nodeId = node.id;
  const hasOutput = !!node?.data?.node?.output;
  const hasUniqueId = !!node?.data?.node?.output?.unique_id;

  // ✅ Strip `output` from node.data level (outside the `node` sub-key)
  const { output: _dataOutput, ...dataWithoutOutput } = node.data ?? {};

  if (sourceNodeSet.has(nodeId)) {
    const virtualDbSource = node?.data?.virtualDbEnabled === true;
    const nextOutput =
      virtualDbSource && hasOutput
        ? stripVirtualDbSourceOutputForSave(node.data.node.output)
        : undefined;
    const updatedNode = {
      ...node,
      data: {
        ...dataWithoutOutput,        // ← not node.data
        node: { ...node.data.node, output: nextOutput },
      },
    };
    if (updatedNode.data?.node?.payload) {
      const nextPayload = withStrippedRuleRecordsAndStmtDate(
        updatedNode.data.node.payload,
        stmtDate,
        updatedNode.data?.node_id
      );
      if (updatedNode.data?.node_id === "api_connector") {
        sanitizeApiConnectorPayloadForWire(nextPayload);
        serializeApiConnectorKeyValueMapsForApi(nextPayload);
      }
      updatedNode.data.node.payload = nextPayload;
    }
    return updatedNode;
  }

  if (hasOutput && hasUniqueId) {
    const updatedNode = {
      ...node,
      data: {
        ...dataWithoutOutput,        // ← not node.data
        node: { ...node.data.node, output: stripDataForSave(node.data.node.output) },
      },
    };
    if (updatedNode.data?.node?.payload) {
      const nextPayload = withStrippedRuleRecordsAndStmtDate(
        updatedNode.data.node.payload,
        stmtDate,
        updatedNode.data?.node_id
      );
      if (updatedNode.data?.node_id === "api_connector") {
        sanitizeApiConnectorPayloadForWire(nextPayload);
        serializeApiConnectorKeyValueMapsForApi(nextPayload);
      }
      updatedNode.data.node.payload = nextPayload;
    }
    return updatedNode;
  }

  const updatedNode = { ...node, data: { ...dataWithoutOutput } }; // ← not node.data
  if (updatedNode.data?.node?.payload) {
    const nextPayload = withStrippedRuleRecordsAndStmtDate(
      updatedNode.data.node.payload,
      stmtDate,
      updatedNode.data?.node_id
    );
    if (updatedNode.data?.node_id === "api_connector") {
      sanitizeApiConnectorPayloadForWire(nextPayload);
      serializeApiConnectorKeyValueMapsForApi(nextPayload);
    }
    updatedNode.data.node.payload = nextPayload;
  }
  return updatedNode;
});
  console.log('=== Workflow preparation complete ===');

  return workflowToSave;
}

/**
 * Builds React Flow graph from Virtual DB API `node` array (GET /virtual-dataset list/detail shape).
 */
function buildCanvasFromVirtualDatasetNodeList(root: any, urlId: string): any {
  const virtualNodes = root.node as any[];
  const dataset_id = root.dataset_id ?? root.datasetId;
  const recordId = root.id ?? urlId;

  const flowNodes = virtualNodes.map((n: any, i: number) => {
    const rfId =
      n.sub_dataset_id != null && String(n.sub_dataset_id).length > 0
        ? `vd-${n.sub_dataset_id}`
        : `vd-${recordId}-${i}-${n.node_id ?? 'n'}`;
    const payload = { ...(n.payload ?? {}) };
    const nodeIdLower = String(n.node_id ?? '').toLowerCase();
    const isPipeline = nodeIdLower === 'pipeline_reference';

    const baseNodeBlock =
      typeof n.node === 'object' && n.node !== null
        ? { ...n.node, payload, klass_name: n.klass_name ?? (n.node as any).klass_name, modules: n.modules ?? (n.node as any).modules }
        : {
            payload,
            klass_name: n.klass_name,
            modules: n.modules,
          };

    const data: Record<string, unknown> = {
      node_id: n.node_id,
      display_name: n.display_name ?? 'Node',
      name: n.display_name ?? 'Node',
      icon: n.icon,
      group: n.group,
      klass_name: n.klass_name,
      modules: n.modules,
      node: baseNodeBlock,
      virtualDbEnabled: true,
      saved_node: true,
      isExpanded: false,
      status: 'idle',
    };

    if (isPipeline) {
      data.pipeline_workflow_id = payload.pipeline_workflow_id ?? '';
      data.node = {
        ...(typeof n.node === 'object' && n.node !== null ? n.node : {}),
        payload: {
          ...payload,
          pipeline_workflow_id: payload.pipeline_workflow_id,
          selectedWorkflowNodeIds: payload.selectedWorkflowNodeIds ?? [],
        },
        klass_name: n.klass_name,
        modules: n.modules,
      };
    }

    return {
      id: rfId,
      type: 'genericNode',
      position: { x: 80 + i * 300, y: 120 },
      data,
    };
  });

  return {
    id: recordId,
    name: root.name,
    dataset_id,
    virtualdb_mode: true,
    data: {
      nodes: flowNodes,
      edges: [],
      viewport: { x: 133.3, y: 187.695, zoom: 0.77 },
    },
  };
}

/**
 * Maps GET /virtual-dataset/:id response into the workflow shape used by the canvas
 * (aligned with GET /flow-builder/:id where possible, or Virtual DB `node[]` config rows).
 */
export function normalizeVirtualDatasetToWorkflow(raw: any, urlId: string): any | null {
  if (!raw || typeof raw !== 'object') return null;

  const top = raw.data !== undefined && typeof raw.data === 'object' && !Array.isArray(raw.data) ? raw.data : raw;

  const candidate = top.workflow ?? top.flow ?? top.flow_data ?? top;
  const dataBlock = candidate?.data ?? top.data ?? top;
  const canvasNodes = dataBlock?.nodes ?? candidate?.nodes ?? top.nodes;

  if (Array.isArray(canvasNodes) && canvasNodes.length > 0) {
    const viewport =
      dataBlock?.viewport ??
      candidate?.viewport ??
      top.viewport ?? { x: 133.3, y: 187.695, zoom: 0.77 };

    const id = candidate?.id ?? top.id ?? raw.id ?? urlId;
    const name = candidate?.name ?? top.name ?? raw.name;
    const flow_id = candidate?.flow_id ?? top.flow_id ?? raw.flow_id;
    const deployment_name = candidate?.deployment_name ?? top.deployment_name ?? raw.deployment_name;
    const dataset_id = top.dataset_id ?? raw.dataset_id ?? candidate?.dataset_id;

    return {
      ...candidate,
      id,
      name,
      flow_id,
      deployment_name,
      dataset_id,
      virtualdb_mode: true,
      data: {
        nodes: canvasNodes,
        edges: [],
        viewport,
      },
    };
  }

  if (Array.isArray(top.node) && top.node.length > 0) {
    return buildCanvasFromVirtualDatasetNodeList(top, urlId);
  }

  return null;
}

/**
 * Virtual-dataset responses usually omit `node.template` / `save_node` (same as `buildCanvasFromVirtualDatasetNodeList`).
 * Hydrate from `/nodes/get-node` — the same source used when adding a node from the sidebar — so Configuration forms render.
 */
export async function enrichVirtualDatasetNodesWithTemplates(
  workflow: any,
  options?: { signal?: AbortSignal },
): Promise<any> {
  if (!workflow?.data?.nodes?.length) return workflow;

  const { getNodeDetailsApi } = await import('@/controllers/API');
  const signal = options?.signal;

  const nodes = workflow.data.nodes as any[];
  const needsFetch = nodes.filter((n) => {
    if (!n?.data?.node_id) return false;
    const missingTemplate = !n?.data?.node?.template;
    const missingDesc =
      n.data?.description == null || String(n.data.description).trim() === '';
    return missingTemplate || missingDesc;
  });
  if (needsFetch.length === 0) return workflow;

  const uniqueIds = [...new Set(needsFetch.map((n) => String(n.data.node_id)))];
  const detailsByNodeId = new Map<string, any>();

  await Promise.all(
    uniqueIds.map(async (nodeId) => {
      if (signal?.aborted) return;
      try {
        const res: any = await getNodeDetailsApi({ node_id: nodeId }, { signal });
        const apiNode = res?.data;
        if (apiNode?.node) detailsByNodeId.set(nodeId, apiNode);
      } catch (e) {
        if (isRequestAborted(e)) throw e;
        console.warn('[enrichVirtualDatasetNodesWithTemplates] get-node failed for', nodeId, e);
      }
    })
  );

  const updatedNodes = nodes.map((node) => {
    const nodeId = node?.data?.node_id != null ? String(node.data.node_id) : '';
    const api = nodeId ? detailsByNodeId.get(nodeId) : null;
    if (!api?.node) return node;

    const mergedPayload = {
      ...(api.node.payload ?? {}),
      ...(node.data.node?.payload ?? {}),
    };

    return {
      ...node,
      data: {
        ...node.data,
        description: api.description ?? node.data.description,
        type: api.type ?? node.data.type,
        show_node: api.show_node ?? node.data.show_node ?? true,
        node: {
          ...api.node,
          ...node.data.node,
          template: api.node.template ?? node.data.node?.template,
          save_node: api.node.save_node ?? node.data.node?.save_node,
          get_data: api.node.get_data ?? node.data.node?.get_data,
          payload: mergedPayload,
          klass_name: node.data.node?.klass_name ?? api.node.klass_name,
          modules: node.data.node?.modules ?? api.node.modules,
        },
      },
    };
  });

  return {
    ...workflow,
    data: {
      ...workflow.data,
      nodes: updatedNodes,
    },
  };
}

/**
 * Fetches data for all nodes with unique_ids and executes source nodes
 * @param workflow - The workflow with nodes
 * @returns Workflow with all node data populated from APIs
 */
export async function fetchWorkflowNodeData( 
  workflow: any,
  options: { executeSourceNodes?: boolean } = { executeSourceNodes: true }
) {
  if (!workflow?.data?.nodes || !workflow.flow_id) {
    return workflow;
  }

  const { getNodeDataByUniqueIdApi, saveNodeDetailsApi } = await import('@/controllers/API');
  const { getNodesWithoutInputs } = await import('@/utils/nodeUtils');

  // Get source nodes (nodes with no incoming connections)
  const sourceNodeIds = getNodesWithoutInputs(workflow.data.edges || []);
  const sourceNodeSet = new Set(sourceNodeIds);

  // Find ALL nodes with unique_ids (fetch data for all of them)
  const nodesToFetch = workflow.data.nodes.filter(
    (node: any) => node?.data?.node?.output?.unique_id
  );

  // Find source nodes that DON'T have unique_ids (need execution)
  // Only include these if executeSourceNodes option is true
  const sourceNodesToExecute = options.executeSourceNodes
    ? workflow.data.nodes.filter(
        (node: any) => sourceNodeSet.has(node.id) &&
                       node?.data?.saved_node &&
                       !node?.data?.node?.output?.unique_id
      )
    : [];

  console.log(`Fetching data for ${nodesToFetch.length} nodes with unique_ids...`);
  if (options.executeSourceNodes) {
    console.log(`Executing ${sourceNodesToExecute.length} source nodes without unique_ids...`);
  } else {
    console.log('Skipping source node execution (executeSourceNodes: false)');
  }

  try {
    // Prepare all fetch/execute promises
    const allPromises: Promise<any>[] = [];

    // 1. Fetch data for nodes with unique_ids
    nodesToFetch.forEach((node: any) => {
      const uniqueId = node.data.node.output.unique_id;
      const promise = getNodeDataByUniqueIdApi({
        flow_id: workflow.flow_id,
        node_id: node.id,
        unique_id: uniqueId,
      }).then(response => ({
        nodeId: node.id,
        type: 'unique_id',
        success: response?.status,
        response: response,
      })).catch(error => {
        console.error(`Failed to fetch data for node ${node.id}:`, error);
        return { nodeId: node.id, type: 'unique_id', success: false, response: null };
      });
      allPromises.push(promise);
    });

    // 2. Execute source nodes
    sourceNodesToExecute.forEach((node: any) => {
      const endPoint = node?.data?.node?.get_data || node?.data?.node?.save_node;
      if (!endPoint) return;

      const basePayload = node.data.node.payload || {};
      const payload = {
        ...basePayload,
        current_node_id: node.id,
        flow_id: workflow.flow_id,
        response_type: "json",
      };

      const promise = saveNodeDetailsApi(endPoint, { payload })
        .then(response => ({
          nodeId: node.id,
          type: 'source',
          success: response?.status,
          response: response,
        })).catch(error => {
          console.error(`Failed to execute source node ${node.id}:`, error);
          return { nodeId: node.id, type: 'source', success: false, response: null };
        });
      allPromises.push(promise);
    });

    // Execute all fetches and executions in parallel
    const results = await Promise.all(allPromises);
    
    // Create a map of results by node ID
    const resultsMap = new Map();
    let successCount = 0;
    results.forEach(result => {
      if (result.success && result.response) {
        resultsMap.set(result.nodeId, result.response);
        successCount++;
      }
    });

    console.log(`Successfully loaded data for ${successCount}/${results.length} nodes`);

    /**
     * Merge hydration/execute response into existing output.
     * get-node-unique-id-data often returns { status, data, columns } without `unique_id`;
     * replacing `output` entirely would drop it and break save / later refetches.
     */
    const mergeNodeOutput = (previous: any, response: any) => {
      const prevObj = previous && typeof previous === 'object' ? previous : {};
      const resObj = response && typeof response === 'object' ? response : {};
      return {
        ...prevObj,
        ...resObj,
        unique_id: prevObj.unique_id ?? resObj.unique_id,
      };
    };

    // Update nodes with fetched/executed data
    const updatedNodes = workflow.data.nodes.map((node: any) => {
      if (resultsMap.has(node.id)) {
        const response = resultsMap.get(node.id);
        const previousOutput = node.data?.node?.output;
        return {
          ...node,
          data: {
            ...node.data,
            node: {
              ...node.data.node,
              output: mergeNodeOutput(previousOutput, response),
            },
          },
        };
      }
      return node;
    });

    return {
      ...workflow,
      data: {
        ...workflow.data,
        nodes: updatedNodes,
      },
    };
  } catch (error) {
    console.error('Failed to fetch workflow node data:', error);
    return workflow;
  }
}

