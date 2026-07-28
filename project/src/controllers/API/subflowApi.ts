import api from './api';

interface SubflowNodesPayload {
  workflow_id: string;
  flow_name: string;
  action: 'get_input_nodes' | 'get_output_nodes';
}

interface SubflowNodesResponse {
  status: boolean;
  message: string;
  data: string[];
}

export async function fetchSubflowNodes(
  payload: SubflowNodesPayload
): Promise<string[]> {
  const res = await api.post<SubflowNodesResponse>(
    '/subflows/get-nodes',
    payload
  );
  if (res.data?.status && Array.isArray(res.data.data)) {
    return res.data.data;
  }
  throw new Error(res.data?.message || 'Failed to fetch subflow nodes');
}

export async function fetchSubflowInputNodes(
  workflowId: string,
  flowName: string
): Promise<string[]> {
  return fetchSubflowNodes({
    workflow_id: workflowId,
    flow_name: flowName,
    action: 'get_input_nodes',
  });
}

export async function fetchSubflowOutputNodes(
  workflowId: string,
  flowName: string
): Promise<string[]> {
  return fetchSubflowNodes({
    workflow_id: workflowId,
    flow_name: flowName,
    action: 'get_output_nodes',
  });
}
