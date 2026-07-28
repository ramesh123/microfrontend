import api from "./api";
import { FetchAPIParams, FetchProjectsParams } from "@/types/form";
import { AlgoNodeData } from "@/types/flow";
import { useRbacStore } from "@/stores/useRBACStore";
import { compressPayloadData } from "@/utils/compressionUtils";
import {
  assertBlobNotApiError,
  executeApiRequest,
  executeApiRequestSilent,
  rethrowApiError,
} from "@/utils/exceptionHelper";
import {
  isApiConnectorLikePayload,
  sanitizeApiConnectorPayloadForWire,
  serializeApiConnectorKeyValueMapsForApi,
} from "@/utils/apiConnectorPayload";
import { resolveDatabaseActionsKlass } from "@/utils/sapNodeActions";
import { isRequestAborted, type ApiRequestOptions } from "@/utils/apiAbort";

// Inflight/dedupe map to avoid duplicate concurrent requests for same endpoint+payload
const pendingRequests: Map<string, Promise<any>> = new Map();

function makeKey(name: string, payload: any) {
  try {
    return `${name}:${JSON.stringify(payload)}`
  } catch (e) {
    return `${name}:${String(payload)}`
  }
}

export async function getNodeList() {
  return executeApiRequest(
    () => api.post(`/nodes/get-nodes-list`, {}),
    'Failed to fetch node list',
  );
}

export async function getNodeDetailsApi(payload: any, options?: ApiRequestOptions) {
  try {
    const res = await api.post(`/nodes/get-node`, payload, { signal: options?.signal });
    if ((res.data as { status?: boolean })?.status === false) {
      return Promise.resolve({ status: 200 });
    }
    return res.data;
  } catch (error) {
    if (isRequestAborted(error)) throw error;
    return Promise.resolve({ status: 200 });
  }
}

export async function saveNodeDetailsApi(
  apiUrl: FetchAPIParams,
  payload: any,
  options?: ApiRequestOptions,
) {
  const resolvedKlass = resolveDatabaseActionsKlass(apiUrl.klass);
  const url = `/${apiUrl.module}/${resolvedKlass}`;
  // Deep clone to avoid mutating original payload
  const payloadToSend = JSON.parse(JSON.stringify(payload));

    // Add stmtDate (today's date in YYYY-MM-DD format) to the payload
    const today = new Date();
    const stmtDate = today.toISOString().split('T')[0];

    // Add stmtDate inside the appropriate nested structure
    if (payloadToSend.payload) {
      // For execution requests: add to payload
      payloadToSend.payload.stmtDate = stmtDate;
    } else if (payloadToSend.node?.payload) {
      // For save requests: add to node.payload
      payloadToSend.node.payload.stmtDate = stmtDate;
    } else {
      // Fallback: add at top level
      payloadToSend.stmtDate = stmtDate;
    }

    // Clear output key from node before saving
    if (payloadToSend.node?.output) {
      console.log('🗑️  Clearing node.output before save (output will be regenerated on execution)');
      payloadToSend.node.output = undefined;
    }

    // Strip top-level `output` (some node saves spread full node data; execution results must not be sent to create-workflow-node)
    if (Object.prototype.hasOwnProperty.call(payloadToSend, "output")) {
      delete payloadToSend.output;
    }

    if (
      payloadToSend.payload &&
      Object.prototype.hasOwnProperty.call(payloadToSend.payload, "output")
    ) {
      delete payloadToSend.payload.output;
    }

    // Never send execution results inside node.payload (e.g. create-workflow-node); preview uses node.output in the store, not payload.output
    if (
      payloadToSend.node?.payload &&
      Object.prototype.hasOwnProperty.call(payloadToSend.node.payload, "output")
    ) {
      delete payloadToSend.node.payload.output;
    }

    // Compress dataframe and datasets if they exist
    // Check both payload structures but avoid double compression
    // Priority: compress node.payload first (more specific), then payload.payload if different

    let compressedNodePayload = false;

    // Check if node.payload exists (nested structure like node forms)
    if (payloadToSend.node?.payload && typeof payloadToSend.node.payload === "object") {
      const nodePayload = payloadToSend.node.payload as Record<string, unknown>;
      // Only flatten/stringify API Connector key-value maps. Chart and other nodes
      // use structured `params` (metrics, dimensions arrays); blindly String()ing
      // them produces "[object Object]" on the wire.
      if (isApiConnectorLikePayload(nodePayload)) {
        sanitizeApiConnectorPayloadForWire(nodePayload);
        serializeApiConnectorKeyValueMapsForApi(nodePayload);
      }
    }
    if (payloadToSend.payload && typeof payloadToSend.payload === "object") {
      const flatPayload = payloadToSend.payload as Record<string, unknown>;
      if (isApiConnectorLikePayload(flatPayload)) {
        sanitizeApiConnectorPayloadForWire(flatPayload);
        serializeApiConnectorKeyValueMapsForApi(flatPayload);
      }
    }

    // Check if node.payload exists (nested structure like node forms)
    if (payloadToSend.node?.payload) {
      payloadToSend.node.payload = compressPayloadData(payloadToSend.node.payload);
      compressedNodePayload = true;
      console.log('Compressed node.payload structure');
    }

    // Check if payload.payload exists (wrapper structure like execute calls)
    // Only compress if it's different from node.payload
    if (payloadToSend.payload && !compressedNodePayload) {
      payloadToSend.payload = compressPayloadData(payloadToSend.payload);
      console.log('Compressed payload.payload structure');
    }

  return executeApiRequest(
    () => api.post(url, payloadToSend, { signal: options?.signal }),
    'Failed to save node details',
  );
}

export async function getWorkflowByIdApi(payload: any, options?: ApiRequestOptions) {
  const signal = options?.signal;
  if (!signal) {
    const key = makeKey('getWorkflowByIdApi', payload);
    if (pendingRequests.has(key)) return pendingRequests.get(key);

    const promise = (async () => {
      try {
        return await executeApiRequest(
          () => api.get(`/flow-builder/${payload.id}`),
          'Failed to fetch workflow',
        );
      } finally {
        pendingRequests.delete(key);
      }
    })();

    pendingRequests.set(key, promise);
    return promise;
  }

  return executeApiRequest(
    () => api.get(`/flow-builder/${payload.id}`, { signal }),
    'Failed to fetch workflow',
  );
}

/** GET /virtual-dataset/:id — flow / canvas payload for Virtual DB (replaces flow-builder for virtualdb routes). */
export async function getVirtualDatasetByIdApi(id: string, options?: ApiRequestOptions) {
  const signal = options?.signal;
  if (!signal) {
    const key = makeKey('getVirtualDatasetByIdApi', { id });
    if (pendingRequests.has(key)) return pendingRequests.get(key);

    const promise = (async () => {
      try {
        return await executeApiRequest(
          () => api.get(`/virtual-dataset/${encodeURIComponent(id)}`),
          'Failed to fetch virtual dataset',
        );
      } finally {
        pendingRequests.delete(key);
      }
    })();

    pendingRequests.set(key, promise);
    return promise;
  }

  return executeApiRequest(
    () => api.get(`/virtual-dataset/${encodeURIComponent(id)}`, { signal }),
    'Failed to fetch virtual dataset',
  );
}

export async function deleteNodeDetailsApi(apiUrl: FetchAPIParams, payload: any) {
  const url = `/${apiUrl.module}/${apiUrl.klass}`;
  return executeApiRequest(
    () => api.post(url, payload),
    'Failed to delete',
  );
}

export async function getSingleWorkflowNode(id: string) {
  return executeApiRequest(
    () => api.get(`/work-flow-nodes/${id}`),
    'Failed to fetch workflow node',
  );
}

export async function fetchDropdownOptionsApi(apiUrl: FetchAPIParams, params: any) {
  const resolvedKlass = resolveDatabaseActionsKlass(apiUrl.klass);
  const url = `/${apiUrl.module}/${resolvedKlass}`;
  return executeApiRequest(
    () => api.get(url, { params }),
    'Failed to fetch dropdown options',
  );
}


export async function fetchProjectsApi(params: FetchProjectsParams, userRole?: string) {
  // Format org_id array for PostgreSQL array overlap operator
  // Example: ["19", "14"] => org_id && ARRAY['19','14']::varchar[]
  let queryString = undefined;

  // Skip org_id filter if user is Admin
  if (userRole !== 'Admin' && params.org_id && Array.isArray(params.org_id) && params.org_id.length > 0) {
    const orgIdsFormatted = params.org_id.map(id => `'${id}'`).join(',');
    queryString = `org_id && ARRAY[${orgIdsFormatted}]::varchar[]`;
  }

  // Add perspective_ids filter if provided
  let perspectiveQuery = undefined;
  if (params.perspective_ids && Array.isArray(params.perspective_ids) && params.perspective_ids.length > 0) {
    const perspectiveIdsFormatted = params.perspective_ids.map(id => `'${id}'`).join(',');
    perspectiveQuery = `perspective_ids && ARRAY[${perspectiveIdsFormatted}]::varchar[]`;
  }

  console.log('Fetching projects with org query:', queryString);
  console.log('Fetching projects with perspective query:', perspectiveQuery);

  let workflowQuery = params.q || undefined;
  let finalQuery = undefined;

  // Combine all query parts with AND
  const queryParts = [queryString, perspectiveQuery, workflowQuery].filter(Boolean);
  if (queryParts.length > 0) {
    finalQuery = queryParts.join(' AND ');
  }

  console.log('Final query:', finalQuery);

  return executeApiRequest(
    () => api.get('/flow-builder', {
      params: {
        fields: params.fields ? JSON.stringify(params.fields) : undefined,
        q: finalQuery,
        skip: params.skip,
        limit: params.limit,
        sort: params.sort,
        search_text: params.search_text
      }
    }),
    'Failed to fetch workflows',
  );
}

export async function getDraftWorkflowsApi(params?: { skip?: number; limit?: number; search_text?: string; sort?: string }) {
  const { activePerspective } = useRbacStore.getState();

  const body: any = {
    skip: params?.skip,
    limit: params?.limit,
    search_text: params?.search_text,
    sort: params?.sort
  };
  if (activePerspective) {
    const perspectiveId = activePerspective?.perspective_id || activePerspective?.id;
    if (perspectiveId) {
      body.perspective_id = [String(perspectiveId)];
    }
  }

  return executeApiRequest(
    () => api.post('/draft-flow-builder/get-draft-workflows', body),
    'Failed to fetch draft workflows',
  );
}


/** Load a draft workflow version by draft_id (POST /draft-flow-builder/get-version-by-id). */
export async function getVersionByIdApi(payload: { draft_id: string }) {
  return executeApiRequest(
    () => api.post('/draft-flow-builder/get-version-by-id', payload),
    'Failed to load version',
  );
}

/** Load a draft workflow by draft_id (GET /draft-flow-builder/:draft_id). Used when opening from draft workflows menu. */
export async function getDraftWorkflowByDraftIdApi(draftId: string, options?: ApiRequestOptions) {
  return executeApiRequest(
    () => api.get(`/draft-flow-builder/${draftId}`, { signal: options?.signal }),
    'Failed to load draft workflow',
  );
}

/**
 * Save or update a draft workflow via create-draft-workflow API.
 * Uses the same payload as the release workflow API (flow-builder/create-workflow): prepareWorkflowForSave + statement_date.
 * Adds draft_id ("" for new, or existing id for update). Optional description is passed in draft_nodes.
 */
export async function createDraftWorkflowApi(payload: AlgoNodeData, description?: string) {
  const { prepareWorkflowForSave } = await import('@/utils/workflowUtils');
  const workflowToSave = prepareWorkflowForSave(payload);
  const today = new Date();
  const statementDate = today.toISOString().split('T')[0];
  const releasePayload = {
    ...workflowToSave,
    statement_date: statementDate,
    stmt_date: statementDate,
  };
  const workflowOrigin = (payload as any)?.workflow_origin ?? 'Manual';
  const draftPayload: Record<string, unknown> = {
    ...releasePayload,
    draft_id: payload?.id != null && payload.id !== '' ? String(payload.id) : '',
    version: 0,
    workflow_origin: workflowOrigin,
  };
  // Embed workflow_origin in data blob so it persists and round-trips when backend returns draft (list or single fetch)
  if (draftPayload.data && typeof draftPayload.data === 'object') {
    (draftPayload.data as Record<string, unknown>).workflow_origin = workflowOrigin;
  } else {
    draftPayload.data = { workflow_origin: workflowOrigin };
  }
  if (description != null && description.trim() !== '') {
    draftPayload.draft_nodes = description.trim();
  }
  return executeApiRequest(
    () => api.post('/draft-flow-builder/create-draft-workflow', draftPayload),
    'Failed to save draft workflow',
  );
}

/** Delete a draft workflow after releasing. Payload: { flow_id: string } */
export async function deleteDraftWorkflowApi(payload: { flow_id: string }) {
  return executeApiRequest(
    () => api.post('/draft-flow-builder/delete-draft-workflow', payload),
    'Failed to delete draft workflow',
  );
}

export const saveWorkflow = async (payload: AlgoNodeData) => {
  // Import prepareWorkflowForSave to strip data before sending
  const { prepareWorkflowForSave } = await import('@/utils/workflowUtils');
  const workflowToSave = prepareWorkflowForSave(payload);

  // Add statement_date as today's date in YYYY-MM-DD format
  const today = new Date();
  const statementDate = today.toISOString().split('T')[0];

  const payloadWithStatementDate = {
    ...workflowToSave,
    statement_date: statementDate,
    stmt_date: statementDate,
  };

  console.log('saveWorkflow - Statement date:', statementDate);

  const result = await executeApiRequest(
    () => api.post('/flow-builder/create-workflow', payloadWithStatementDate),
    'Failed to save workflow',
  );
  console.log('saveWorkflow - Backend response:', result);
  return result;
};

export const createDeployment = async (payload: any) => {
  return executeApiRequest(
    () => api.post('/flow-deployment/create-deployment', payload),
    'Failed to create deployment',
  );
};

export const editWorkflow = async (payload: AlgoNodeData) => {
  // Import prepareWorkflowForSave to strip data before sending
  const { prepareWorkflowForSave } = await import('@/utils/workflowUtils');
  const workflowToSave = prepareWorkflowForSave(payload);

  return executeApiRequest(
    () => api.post('/flow-builder/update-workflow', workflowToSave),
    'Failed to save workflow',
  );
};

export const updateWorkflow = async (payload: any) => {
  // Import prepareWorkflowForSave to strip data before sending
  const { prepareWorkflowForSave } = await import('@/utils/workflowUtils');
  const workflowToSave = prepareWorkflowForSave(payload);

  // Remove 'id' field and use 'updated_id' instead (update API expects updated_id, not id)
  const { id, ...workflowWithoutId } = workflowToSave;
  const updatePayload = {
    ...workflowWithoutId,
    updated_id: String(payload.id), // Convert id to string for update API
  };

  return executeApiRequest(
    () => api.post('/flow-builder/update-workflow', updatePayload),
    'Failed to update workflow',
  );
};

// Flow Builder Node Upstream and Downstream Details
export async function getUpstreamDownstreamDetailsApi(params: any) {
  return executeApiRequest(
    () => api.get('/flow-builder/get-node-data', { params }),
    'Failed to fetch node data',
  );
}

export async function getAllRolesApi() {
  return executeApiRequestSilent(
    () => api.get(`/roles`),
    'Failed to fetch roles',
  );
}

export async function deleteRoleApi(roleName: string) {
  return executeApiRequestSilent(
    () => api.post(`/roles/delete-role`, { name: roleName }),
    'Failed to delete role',
  );
}

// Validation Component

export async function getApplicationsApi(params: any) {
  return executeApiRequest(
    () => api.post(`/validation-component/get-validation-objects`, params),
    'Failed to fetch validation objects',
  );
}

export async function getTableFieldsDetailsApi(params: any) {
  return executeApiRequest(
    () => api.post(`/validation-component/get-table-fields-details`, params),
    'Failed to fetch table field details',
  );
}

// Project API
export async function getProjectsNamesApi() {
  const { currentUser } = useRbacStore.getState();
  const userOrgIds = currentUser?.organizationIds || [];
  const params: any = {};
  if (userOrgIds.length > 0) {
    const orgIdsFormatted = userOrgIds.map(id => `'${id}'`).join(',');
    params.q = `org_id && ARRAY[${orgIdsFormatted}]::varchar[]`;
  }
  return executeApiRequest(
    () => api.get(`/projects`, { params }),
    'Failed to fetch projects',
  );
}

export async function createProjectApi(params: any) {
  return executeApiRequest(
    () => api.post(`/projects`, params),
    'Failed to create project',
  );
}

export async function getBusinessProcessApi() {
  const { currentUser } = useRbacStore.getState();
  const userOrgIds = currentUser?.organizationIds || [];

  const params: any = {};
  if (userOrgIds.length > 0) {
    const orgIdsFormatted = userOrgIds.map((id: string) => `'${id}'`).join(',');
    params.q = `org_id in (${orgIdsFormatted})`;
  }

  return executeApiRequest(
    () => api.get(`/business-process`, { params }),
    'Failed to fetch business processes',
  );
}

// Flow Builder Get Node Data API
export async function getFlowBuilderNodeDataApi(params: any) {
  return executeApiRequest(
    () => api.get(`/flow-builder/get-node-data`, { params }),
    'Failed to fetch node data',
  );
}

// Get Node Data by Unique ID
const uniqueIdFetchInflight = new Map<string, Promise<unknown>>();

export async function getNodeDataByUniqueIdApi(
  payload: {
    flow_id: string;
    node_id: string;
    unique_id: string;
  },
  options?: ApiRequestOptions,
) {
  const signal = options?.signal;
  const key = `${payload.flow_id}:${payload.node_id}:${payload.unique_id}`;
  if (!signal) {
    const inflight = uniqueIdFetchInflight.get(key);
    if (inflight) return inflight;

    const promise = (async () => {
      return executeApiRequest(
        () => api.post(`/transformations/get-node-unique-id-data`, payload),
        'Failed to fetch node data',
      );
    })().finally(() => {
      uniqueIdFetchInflight.delete(key);
    });

    uniqueIdFetchInflight.set(key, promise);
    return promise;
  }

  return executeApiRequest(
    () => api.post(`/transformations/get-node-unique-id-data`, payload, { signal }),
    'Failed to fetch node data',
  );
}

// Create File Dataset API
export async function createFileDatasetApi(payload: any) {
  return executeApiRequest(
    () => api.post(`/files/create-file`, payload),
    'Failed to create file dataset',
  );
}

// Export Workflow API
export async function exportWorkflowApi(export_id: string) {
  try {
    const res = await api.post(`/flow-builder/export-workflow`,
      { export_id },
      {
        responseType: 'blob',
        headers: {
          'Accept': 'application/octet-stream'
        }
      }
    );

    if (res.status === 200) {
      await assertBlobNotApiError(res.data as Blob, 'Failed to export workflow');

      // Extract filename from Content-Disposition header
      const contentDisposition = res.headers['content-disposition'];
      let filename = `${export_id}.zip`;

      if (contentDisposition) {
        // Match filename with or without quotes, non-greedy to avoid capturing trailing quotes
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"|filename=([^\s;]+)/i);
        if (filenameMatch) {
          // Use the first non-null capture group (either quoted or unquoted filename)
          filename = filenameMatch[1] || filenameMatch[2];
          // Remove any trailing quotes if they exist
          filename = filename.replace(/^["']|["']$/g, '');
        }
      }

      // Create a blob from the response data
      const blob = new Blob([res.data], { type: 'application/octet-stream' });

      // Create a temporary URL for the blob
      const url = window.URL.createObjectURL(blob);

      // Create a temporary anchor element and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();

      // Clean up
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      return { success: true, filename };
    }
    throw new Error('Failed to export workflow');
  } catch (error) {
    await rethrowApiError(error, 'Failed to export workflow');
  }
}

// Rollback Workflow API
export async function rollbackWorkflowApi(flowId: string): Promise<{ status: string; message: string }> {
  return executeApiRequest(
    () => api.post('/flow-run/rollback-workflow', { flow_id: flowId }),
    'Failed to rollback workflow',
  );
}

// Import Workflow API
export async function importWorkflowApi(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  return executeApiRequest(
    () => api.post(`/flow-builder/import-workflow`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }),
    'Failed to import workflow',
  );
}

