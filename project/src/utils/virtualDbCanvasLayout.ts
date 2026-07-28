/**
 * Persist React Flow node positions + viewport for Virtual DB workflows.
 * GET /virtual-dataset/:id often rebuilds the canvas from `node[]` without layout;
 * we merge saved layout from localStorage so positions survive navigation.
 */

const STORAGE_PREFIX = 'virtualdb_canvas_layout:';

export type VirtualDbCanvasLayout = {
  nodePositions: Record<string, { x: number; y: number }>;
  viewport?: { x: number; y: number; zoom: number };
};

function storageKey(datasetId: string): string {
  return `${STORAGE_PREFIX}${datasetId}`;
}

export function saveVirtualDbCanvasLayout(
  datasetId: string,
  workflow: { data?: { nodes?: Array<{ id: string; position?: { x: number; y: number } }>; viewport?: { x: number; y: number; zoom: number } } } | null
): void {
  if (!datasetId?.trim() || !workflow?.data?.nodes?.length) return;
  try {
    const nodePositions: Record<string, { x: number; y: number }> = {};
    for (const n of workflow.data.nodes) {
      if (!n?.id || !n.position) continue;
      nodePositions[n.id] = { x: n.position.x, y: n.position.y };
    }
    const payload: VirtualDbCanvasLayout = {
      nodePositions,
      viewport: workflow.data.viewport,
    };
    localStorage.setItem(storageKey(datasetId.trim()), JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function loadVirtualDbCanvasLayout(datasetId: string): VirtualDbCanvasLayout | null {
  if (!datasetId?.trim()) return null;
  try {
    const raw = localStorage.getItem(storageKey(datasetId.trim()));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VirtualDbCanvasLayout;
    if (!parsed || typeof parsed.nodePositions !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Apply saved positions + viewport onto a workflow (mutates a cloned workflow).
 */
export function mergeVirtualDbLayoutIntoWorkflow<T extends { data?: { nodes?: any[]; viewport?: any; edges?: any[] } }>(
  workflow: T,
  layout: VirtualDbCanvasLayout | null
): T {
  if (!layout || !workflow?.data?.nodes?.length) return workflow;

  const out = JSON.parse(JSON.stringify(workflow)) as T;
  const nodes = out.data!.nodes!;
  for (const node of nodes) {
    const pos = layout.nodePositions[node.id];
    if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
      node.position = { x: pos.x, y: pos.y };
    }
  }
  if (layout.viewport && typeof layout.viewport.x === 'number' && typeof layout.viewport.y === 'number') {
    out.data!.viewport = {
      ...out.data!.viewport,
      ...layout.viewport,
      zoom: layout.viewport.zoom ?? out.data!.viewport?.zoom ?? 0.77,
    };
  }
  return out;
}
