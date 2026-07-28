import type { Edge, Node } from '@xyflow/react';

export function serializeEnergyGraph(nodes: Node[], edges: Edge[]): string {
  const normalizedNodes = nodes
    .map((node) => ({
      id: node.id,
      x: Math.round(Number(node.position?.x ?? 0)),
      y: Math.round(Number(node.position?.y ?? 0)),
      label:
        node.data && typeof node.data === 'object' && 'label' in node.data
          ? String((node.data as { label?: unknown }).label ?? '')
          : '',
      type:
        node.data && typeof node.data === 'object' && 'type' in node.data
          ? String((node.data as { type?: unknown }).type ?? '')
          : '',
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const normalizedEdges = edges
    .map((edge) => ({ source: String(edge.source), target: String(edge.target) }))
    .sort((a, b) => `${a.source}-${a.target}`.localeCompare(`${b.source}-${b.target}`));

  return JSON.stringify({ nodes: normalizedNodes, edges: normalizedEdges });
}

function nodeDisplayName(node: Node): string {
  const data = node.data as { label?: string; type?: string } | undefined;
  return String(data?.label ?? data?.type ?? '').trim();
}

function sanitizeHierarchySegment(value: string): string {
  return value.replace(/[/\\]+/g, '').trim();
}

/** First root → first-child chain of node names (e.g. SMB → PCSS). */
export function buildFirstNodeNamePath(nodes: Node[], edges: Edge[]): string[] {
  if (!nodes.length) return [];

  const roots = nodes.filter((node) => !edges.some((edge) => String(edge.target) === node.id));
  const path: string[] = [];
  const visited = new Set<string>();
  let currentId: string | null = (roots[0] ?? nodes[0]).id;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const node = nodes.find((item) => item.id === currentId);
    if (!node) break;

    const name = sanitizeHierarchySegment(nodeDisplayName(node));
    if (name) path.push(name);

    const nextEdge = edges.find((edge) => String(edge.source) === currentId);
    currentId = nextEdge ? String(nextEdge.target) : null;
  }

  return path;
}
