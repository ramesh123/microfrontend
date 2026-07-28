/** One element for the node[] array: unique JSON per virtual DB type. */
export interface NodeArrayItem {
  payload: Record<string, unknown>;
  node_id: string;
  dataset_type: string;
  group: string;
  display_name: string;
  klass_name: string;
  modules: string;
  icon: string;
  is_dataset: boolean;
  /** Set when saving to create-dataset (e.g. `"pipeline"`). */
  virtualdb_type?: string;
}

export function isSourceTypeForVirtualDb(nodeData: any): boolean {
  if (!nodeData) return false;
  const nodeId = (nodeData.node_id ?? '').toLowerCase();
  const group = (nodeData.group ?? '').toLowerCase();
  if (group === 'databases' || /postgres|mysql|mssql|oracle|snowflake|redshift|s3|dynamodb|mongodb|elasticsearch|trino|clickhouse|duckdb|singlestore|cockroachdb/i.test(nodeId)) return true;
  if (group === 'files' || /csv|parquet|json|excel|s3|sftp|blob/i.test(nodeId)) return true;
  if (nodeData.isDataset || /dataset/i.test(nodeId)) return true;
  if (/api|webhook|http/i.test(nodeId)) return true;
  if (nodeId === 'pipeline_reference') return true;
  return false;
}

/**
 * Virtual DB toggle when a node is first created: use API/node metadata if present,
 * otherwise default to enabled for source-compatible types when the workflow is Virtual DB mode.
 */
export function getInitialVirtualDbEnabled(
  nodeData: any,
  workflow: { virtualdb_mode?: boolean } | null | undefined
): boolean {
  const explicit =
    nodeData?.virtualDbEnabled ??
    nodeData?.virtualdb_enabled ??
    nodeData?.node?.payload?.virtual_db_enabled ??
    nodeData?.node?.payload?.virtualDbEnabled;
  if (typeof explicit === 'boolean') return explicit;
  if (Boolean(workflow?.virtualdb_mode) && isSourceTypeForVirtualDb(nodeData)) return true;
  return false;
}

/** Backend `virtualdb_type` per selected node — derived from connector/source, not always `pipeline`. */
export function getVirtualDbTypeForNodeData(nodeData: any): string {
  if (!nodeData) return 'databases';
  const nodeId = (nodeData.node_id ?? '').toLowerCase();
  const group = (nodeData.group ?? '').toLowerCase();
  if (nodeId === 'pipeline_reference') return 'pipeline';
  if (group === 'databases' || /postgres|mysql|mssql|oracle|snowflake|redshift|s3|dynamodb|mongodb|elasticsearch|trino|clickhouse|duckdb|singlestore|cockroachdb/i.test(nodeId)) {
    return 'databases';
  }
  if (group === 'files' || /csv|parquet|json|excel|s3|sftp|blob/i.test(nodeId)) return 'files';
  if (nodeData.isDataset || /dataset/i.test(nodeId)) return 'dataset';
  if (/api|webhook|http/i.test(nodeId)) return 'api';
  return 'databases';
}

function getDatasetTypeConfig(nodeData: any): { dataset_type: string; group: string; klass_name: string; modules: string; icon: string } {
  const nodeId = (nodeData?.node_id ?? '').toLowerCase();
  const group = (nodeData?.group ?? '').toLowerCase();
  if (group === 'databases' || /postgres|mysql|mssql|oracle|snowflake|redshift|s3|dynamodb|mongodb|elasticsearch|trino|clickhouse|duckdb|singlestore|cockroachdb/i.test(nodeId))
    return { dataset_type: 'Databases', group: 'Databases', klass_name: 'PostgresqlConnector', modules: 'connectors.databases.postgresql', icon: nodeData?.icon ?? 'postgres-sql' };
  if (group === 'files' || /csv|parquet|json|excel|s3|sftp|blob/i.test(nodeId))
    return { dataset_type: 'Files', group: 'Files', klass_name: 'FileConnector', modules: 'connectors.files', icon: nodeData?.icon ?? 'file-text' };
  if (nodeData?.isDataset || /dataset/i.test(nodeId))
    return { dataset_type: 'DataSet', group: 'DataSet', klass_name: 'DatasetConnector', modules: 'connectors.dataset', icon: nodeData?.icon ?? 'database' };
  if (/api|webhook|http/i.test(nodeId))
    return { dataset_type: 'API', group: 'API', klass_name: 'ApiConnector', modules: 'connectors.api', icon: nodeData?.icon ?? 'globe' };
  if (nodeId === 'pipeline_reference')
    return { dataset_type: 'Pipeline', group: 'Pipeline', klass_name: 'PipelineConnector', modules: 'connectors.pipeline', icon: nodeData?.icon ?? 'Workflow' };
  return { dataset_type: 'Databases', group: group || 'Databases', klass_name: 'PostgresqlConnector', modules: 'connectors.databases.postgresql', icon: nodeData?.icon ?? 'postgres-sql' };
}

function stripOutput(obj: Record<string, unknown>): Record<string, unknown> {
  if (obj === null || typeof obj !== 'object') return obj as Record<string, unknown>;
  const { output, ...rest } = obj;
  return rest;
}

function buildNodeArrayItem(
  nodeData: any,
  payloadWithoutOutput: Record<string, unknown>,
  virtualdbTypeOverride?: string
): NodeArrayItem {
  const config = getDatasetTypeConfig(nodeData);
  const displayName = nodeData?.display_name ?? nodeData?.name ?? 'Virtual Dataset';
  const nodeId = nodeData?.node_id ?? nodeData?.node?.node_id ?? 'virtual-db';
  const existingNode = nodeData?.node ?? {};
  const virtualdb_type = virtualdbTypeOverride ?? getVirtualDbTypeForNodeData(nodeData);
  return {
    payload: payloadWithoutOutput,
    node_id: nodeId,
    dataset_type: config.dataset_type,
    group: config.group,
    display_name: displayName,
    klass_name: existingNode.klass_name ?? config.klass_name,
    modules: existingNode.modules ?? config.modules,
    icon: config.icon,
    is_dataset: true,
    virtualdb_type,
  };
}

function buildNodeArrayForNonPipeline(nodeData: any): NodeArrayItem[] {
  const displayName = nodeData?.display_name ?? nodeData?.name ?? 'Virtual Dataset';
  const payload = { ...(nodeData?.node?.payload ?? {}), name: displayName };
  return [buildNodeArrayItem(nodeData, stripOutput(payload))];
}

/**
 * Pipeline reference: send one node entry from canvas data only (no flow-builder fetch).
 * Payload includes pipeline_workflow_id and selectedWorkflowNodeIds for the backend to resolve.
 */
function buildNodeArrayForPipeline(nodeData: any): NodeArrayItem[] {
  const workflowId = nodeData?.pipeline_workflow_id ?? nodeData?.node?.payload?.pipeline_workflow_id ?? '';
  const selectedIds: string[] =
    nodeData?.node?.payload?.selectedWorkflowNodeIds ??
    nodeData?.payload?.selectedWorkflowNodeIds ??
    nodeData?.selectedWorkflowNodeIds ??
    [];
  if (!workflowId || selectedIds.length === 0) return [];
  const displayName = nodeData?.display_name ?? nodeData?.name ?? 'Virtual Dataset';
  const payload = {
    ...(nodeData?.node?.payload ?? {}),
    name: displayName,
    pipeline_workflow_id: workflowId,
    selectedWorkflowNodeIds: selectedIds,
  };
  return [buildNodeArrayItem(nodeData, stripOutput(payload))];
}

function getNodeArrayForNode(nodeData: any): NodeArrayItem[] {
  const nodeId = (nodeData?.node_id ?? '').toLowerCase();
  if (nodeId === 'pipeline_reference') return buildNodeArrayForPipeline(nodeData);
  return buildNodeArrayForNonPipeline(nodeData);
}

/**
 * Build create-dataset payload from all nodes marked as virtualDbEnabled on the canvas.
 * Every enabled Virtual DB node contributes one or more config dicts to the list.
 * Returns { node: NodeArrayItem[] } (list of node config dictionaries) or null if no enabled nodes.
 */
export function buildPayloadFromEnabledNodes(
  nodes: Array<{ id: string; data?: any }>,
  options?: { /** Force the same virtualdb_type on every item (rare; prefer per-node defaults). */ forceVirtualdbType?: string }
): { node: NodeArrayItem[] } | null {
  const forceVirtualdbType = options?.forceVirtualdbType;
  const enabled = nodes.filter(
    (n) => n?.data?.virtualDbEnabled && isSourceTypeForVirtualDb(n.data)
  );
  if (enabled.length === 0) return null;
  const combined: NodeArrayItem[] = [];
  for (const node of enabled) {
    const items = getNodeArrayForNode(node?.data ?? {});
    if (forceVirtualdbType) {
      combined.push(...items.map((it) => ({ ...it, virtualdb_type: forceVirtualdbType })));
    } else {
      combined.push(...items);
    }
  }
  if (combined.length === 0) return null;
  return { node: combined };
}
