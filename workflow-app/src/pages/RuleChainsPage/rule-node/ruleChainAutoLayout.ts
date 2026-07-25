import type { Edge, Node } from "@xyflow/react";

import { RULE_CHAIN_COL_STEP, RULE_CHAIN_NODE_WIDTH, RULE_CHAIN_ROW_STEP } from "./ruleChainCanvasLogic";
import { isRuleChainInputNode, RULE_CHAIN_INPUT_NODE_ID, ruleChainInputPositionForEntry } from "../ruleChainTbAdapter";

const ORIGIN_X = 100;
const ORIGIN_Y = 64;

/** True when TB metadata has no usable layout (stacked at origin or heavy overlap). */
export function nodesNeedAutoLayout(nodes: Node[]): boolean {
  const rule = nodes.filter((n) => !isRuleChainInputNode(n));
  if (rule.length <= 1) return false;

  const allOrigin = rule.every((n) => Math.abs(n.position.x) < 8 && Math.abs(n.position.y) < 8);
  if (allOrigin) return true;

  let overlaps = 0;
  for (let i = 0; i < rule.length; i++) {
    for (let j = i + 1; j < rule.length; j++) {
      const dx = Math.abs(rule[i].position.x - rule[j].position.x);
      const dy = Math.abs(rule[i].position.y - rule[j].position.y);
      if (dx < RULE_CHAIN_NODE_WIDTH * 0.85 && dy < RULE_CHAIN_ROW_STEP * 0.85) overlaps += 1;
    }
  }
  return overlaps > Math.max(2, Math.floor(rule.length * 0.25));
}

/**
 * Layered left-to-right layout (ThingsBoard / pipeline style).
 * Mirrors a rule chain execution path: entry nodes → branches in columns → outputs to the right.
 */
export function autoLayoutRuleChainNodes(nodes: Node[], edges: Edge[]): Node[] {
  const ruleNodes = nodes.filter((n) => !isRuleChainInputNode(n));
  if (ruleNodes.length === 0) return nodes;

  const ruleIds = new Set(ruleNodes.map((n) => n.id));
  const outgoing = new Map<string, string[]>();

  outgoing.set(RULE_CHAIN_INPUT_NODE_ID, []);
  for (const id of ruleIds) outgoing.set(id, []);
  for (const e of edges) {
    if (e.source === RULE_CHAIN_INPUT_NODE_ID && ruleIds.has(e.target)) {
      outgoing.set(RULE_CHAIN_INPUT_NODE_ID, [...(outgoing.get(RULE_CHAIN_INPUT_NODE_ID) ?? []), e.target]);
      continue;
    }
    if (!ruleIds.has(e.source) || !ruleIds.has(e.target)) continue;
    outgoing.get(e.source)!.push(e.target);
  }

  const entryFromInput = outgoing.get(RULE_CHAIN_INPUT_NODE_ID) ?? [];
  const entryIds = new Set<string>(entryFromInput);
  for (const id of ruleIds) {
    const hasRuleIncoming = edges.some((e) => e.target === id && ruleIds.has(e.source));
    if (!hasRuleIncoming) entryIds.add(id);
  }
  if (entryIds.size === 0) entryIds.add(ruleNodes[0]!.id);

  const layer = new Map<string, number>();
  const queue: { id: string; depth: number }[] = [...entryIds].map((id) => ({ id, depth: 0 }));
  for (const id of entryIds) layer.set(id, 0);

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    for (const target of outgoing.get(id) ?? []) {
      if (!ruleIds.has(target)) continue;
      const nextDepth = depth + 1;
      const prev = layer.get(target);
      if (prev === undefined || nextDepth > prev) {
        layer.set(target, nextDepth);
        queue.push({ id: target, depth: nextDepth });
      }
    }
  }

  for (const id of ruleIds) {
    if (!layer.has(id)) layer.set(id, 0);
  }

  const byLayer = new Map<number, string[]>();
  for (const [id, L] of layer) {
    const list = byLayer.get(L) ?? [];
    list.push(id);
    byLayer.set(L, list);
  }

  const positions = new Map<string, { x: number; y: number }>();
  const sortedLayers = [...byLayer.keys()].sort((a, b) => a - b);

  for (const L of sortedLayers) {
    const ids = (byLayer.get(L) ?? []).sort((a, b) => {
      const na = nodes.find((n) => n.id === a);
      const nb = nodes.find((n) => n.id === b);
      return (na?.position.y ?? 0) - (nb?.position.y ?? 0);
    });
    const colX = ORIGIN_X + L * RULE_CHAIN_COL_STEP;
    ids.forEach((id, row) => {
      positions.set(id, { x: colX, y: ORIGIN_Y + row * RULE_CHAIN_ROW_STEP });
    });
  }

  const firstEntry = [...entryIds][0];
  const anchor = firstEntry ? positions.get(firstEntry) : { x: ORIGIN_X, y: ORIGIN_Y };

  return nodes.map((n) => {
    if (isRuleChainInputNode(n)) {
      return {
        ...n,
        position: ruleChainInputPositionForEntry({
          x: anchor?.x ?? ORIGIN_X,
          y: anchor?.y ?? ORIGIN_Y,
        }),
      };
    }
    const p = positions.get(n.id);
    return p ? { ...n, position: { x: Math.round(p.x), y: Math.round(p.y) } } : n;
  });
}
