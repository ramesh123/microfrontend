import type { FieldTemplate } from '@/types/form';

/** Workflow node ids that should use `/databases/sap-actions` instead of legacy `s4hana-actions`. */
export const SAP_WORKFLOW_NODE_IDS = new Set(['sap', 's4hana']);

const SAP_ACTIONS_KLASS = 'sap-actions';
const LEGACY_SAP_ACTIONS_KLASSES = new Set(['s4hana-actions', 'shana-actions']);
const SAP_CONNECTION_TYPES = new Set(['sap', 's4hana']);

export function isSapConnectionType(connectionType: string | null | undefined): boolean {
  if (connectionType == null || String(connectionType).trim() === '') return false;
  return SAP_CONNECTION_TYPES.has(String(connectionType).trim().toLowerCase());
}

export function isSapWorkflowNode(nodeId: string | null | undefined): boolean {
  if (nodeId == null || String(nodeId).trim() === '') return false;
  return SAP_WORKFLOW_NODE_IDS.has(String(nodeId).trim().toLowerCase());
}

export function remapLegacySapActionsKlass(
  klass: string | null | undefined,
): string | null | undefined {
  if (klass == null) return klass;
  const normalized = String(klass).trim().toLowerCase();
  if (LEGACY_SAP_ACTIONS_KLASSES.has(normalized)) {
    return SAP_ACTIONS_KLASS;
  }
  return klass;
}

/** Resolve API action klass — remaps deprecated s4hana-actions to sap-actions at the HTTP layer. */
export function resolveDatabaseActionsKlass(klass: string | null | undefined): string {
  return remapLegacySapActionsKlass(klass) ?? String(klass ?? '');
}

/** Connection vault: use sap-actions when connection_type is sap/s4hana and klass is legacy. */
export function resolveConnectionVaultActionsKlass(
  klass: string | null | undefined,
  connectionType?: string | null,
): string {
  if (isSapConnectionType(connectionType)) {
    const normalized = String(klass ?? '').trim().toLowerCase();
    if (!normalized || LEGACY_SAP_ACTIONS_KLASSES.has(normalized)) {
      return SAP_ACTIONS_KLASS;
    }
  }
  return resolveDatabaseActionsKlass(klass);
}

function patchEndpointBlock(block: Record<string, unknown>): Record<string, unknown> {
  const next = { ...block };
  if (typeof next.klass === 'string') {
    next.klass = remapLegacySapActionsKlass(next.klass);
  }
  if (next.fetch && typeof next.fetch === 'object') {
    const fetch = { ...(next.fetch as Record<string, unknown>) };
    if (typeof fetch.klass === 'string') {
      fetch.klass = remapLegacySapActionsKlass(fetch.klass);
    }
    next.fetch = fetch;
  }
  return next;
}

export function applySapNodeTemplatePatch(
  template: Record<string, FieldTemplate> | null | undefined,
  nodeId?: string | null,
): Record<string, FieldTemplate> | null | undefined {
  if (!template || !isSapWorkflowNode(nodeId)) return template;

  const patched: Record<string, FieldTemplate> = {};
  for (const [key, field] of Object.entries(template)) {
    if (!field || typeof field !== 'object') {
      patched[key] = field;
      continue;
    }
    const next = { ...field };
    if (next.fetch && typeof next.fetch === 'object') {
      const fetch = { ...next.fetch };
      if (typeof fetch.klass === 'string') {
        fetch.klass = remapLegacySapActionsKlass(fetch.klass) ?? fetch.klass;
      }
      next.fetch = fetch;
    }
    patched[key] = next;
  }
  return patched;
}

/** Patch get-node layer (template, get_data, save_node, data_preview) for SAP workflow nodes. */
export function patchSapWorkflowNodeData(
  nodeData: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null | undefined {
  if (!nodeData || !isSapWorkflowNode(nodeData.node_id as string | undefined)) {
    return nodeData;
  }

  const next: Record<string, unknown> = { ...nodeData };
  const node = next.node;
  if (!node || typeof node !== 'object') return next;

  const patchedNode = { ...(node as Record<string, unknown>) };

  if (patchedNode.get_data && typeof patchedNode.get_data === 'object') {
    patchedNode.get_data = patchEndpointBlock(
      patchedNode.get_data as Record<string, unknown>,
    );
  }
  if (patchedNode.save_node && typeof patchedNode.save_node === 'object') {
    patchedNode.save_node = patchEndpointBlock(
      patchedNode.save_node as Record<string, unknown>,
    );
  }
  if (patchedNode.data_preview && typeof patchedNode.data_preview === 'object') {
    patchedNode.data_preview = patchEndpointBlock(
      patchedNode.data_preview as Record<string, unknown>,
    );
  }
  if (patchedNode.template && typeof patchedNode.template === 'object') {
    patchedNode.template = applySapNodeTemplatePatch(
      patchedNode.template as Record<string, FieldTemplate>,
      nodeData.node_id as string,
    );
  }

  next.node = patchedNode;
  return next;
}

export function patchSapWorkflowNodeRecord(node: {
  data?: Record<string, unknown>;
} | null | undefined): typeof node {
  if (!node?.data) return node;
  const patchedData = patchSapWorkflowNodeData(node.data);
  if (patchedData === node.data) return node;
  return { ...node, data: patchedData };
}
