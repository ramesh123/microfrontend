import type { Edge, Node } from "@xyflow/react";

import { RULE_CHAIN_INPUT_NODE_ID } from "../ruleChainTbAdapter";
import { reconcileRuleChainNodeSpacing } from "./ruleChainNodeSpacing";
import {
  readRuleChainClipboardPayload,
  writeRuleChainClipboardPayload,
  type RuleChainClipboardPayload,
} from "./ruleChainSessionClipboard";

export function getRuleChainCopySelection(getNodes: () => Node[], getEdges: () => Edge[]): {
  nodes: Node[];
  edges: Edge[];
} | null {
  const selectedNodes = getNodes().filter((n) => n.selected && n.id !== RULE_CHAIN_INPUT_NODE_ID);
  if (selectedNodes.length === 0) return null;
  const idSet = new Set(selectedNodes.map((n) => n.id));
  const internalEdges = getEdges().filter((e) => idSet.has(e.source) && idSet.has(e.target));
  return { nodes: selectedNodes, edges: internalEdges };
}

export function copyRuleChainSelectionToSessionClipboard(getNodes: () => Node[], getEdges: () => Edge[]): boolean {
  const sel = getRuleChainCopySelection(getNodes, getEdges);
  if (!sel) return false;
  writeRuleChainClipboardPayload(sel.nodes, sel.edges);
  return true;
}

const SNAP = 8;

function snapGrid(v: number): number {
  return Math.round(v / SNAP) * SNAP;
}

function clonePastedNode(n: Node, idMap: Map<string, string>, delta: { dx: number; dy: number }): Node {
  const newId = crypto.randomUUID();
  idMap.set(n.id, newId);
  const data = { ...(n.data as Record<string, unknown>) };
  delete data.tbEntityId;
  return {
    ...n,
    id: newId,
    position: {
      x: snapGrid(n.position.x + delta.dx),
      y: snapGrid(n.position.y + delta.dy),
    },
    selected: false,
    data,
  };
}

/**
 * @param anchorFlow — When set, the pasted cluster is translated so its position **centroid** matches this point
 *   (fits `nodeOrigin={[0.5,0.5]}`). Otherwise uses a fixed +40,+40 offset (toolbar / ⌘V).
 */
export function pasteRuleChainClipboardIntoCanvas(
  payload: RuleChainClipboardPayload,
  setNodes: (fn: (nds: Node[]) => Node[]) => void,
  setEdges: (fn: (eds: Edge[]) => Edge[]) => void,
  anchorFlow?: { x: number; y: number },
): number {
  const idMap = new Map<string, string>();
  const raw = payload.nodes as Node[];
  let dx = 40;
  let dy = 40;
  if (anchorFlow && raw.length > 0) {
    const cx = raw.reduce((s, n) => s + (n as Node).position.x, 0) / raw.length;
    const cy = raw.reduce((s, n) => s + (n as Node).position.y, 0) / raw.length;
    dx = anchorFlow.x - cx;
    dy = anchorFlow.y - cy;
  }
  const newNodes = raw.map((n) => clonePastedNode(n as Node, idMap, { dx, dy }));
  const rawEdges = payload.edges ?? [];
  const newEdges: Edge[] = rawEdges
    .filter((e) => idMap.has(e.source) && idMap.has(e.target))
    .map((e, i) => ({
      ...(e as Edge),
      id: `paste-${crypto.randomUUID()}-${i}`,
      source: idMap.get(e.source)!,
      target: idMap.get(e.target)!,
      selected: false,
    }));
  setEdges((eds) => {
    const nextEdges = [...eds, ...newEdges];
    setNodes((nds) =>
      reconcileRuleChainNodeSpacing(
        [...nds.map((n) => ({ ...n, selected: false })), ...newNodes.map((n) => ({ ...n, selected: true }))],
        nextEdges,
      ),
    );
    return nextEdges;
  });
  return newNodes.length;
}

export function pasteFromSessionClipboardIfAny(
  setNodes: (fn: (nds: Node[]) => Node[]) => void,
  setEdges: (fn: (eds: Edge[]) => Edge[]) => void,
): number {
  const p = readRuleChainClipboardPayload();
  if (!p?.nodes.length) return 0;
  return pasteRuleChainClipboardIntoCanvas(p, setNodes, setEdges);
}
