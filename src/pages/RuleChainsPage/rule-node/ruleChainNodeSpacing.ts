import type { Edge, Node } from "@xyflow/react";

import {
  inferFirstNodeIndex,
  isRuleChainInputNode,
  RULE_CHAIN_INPUT_NODE_ID,
  ruleChainInputPositionForEntry,
} from "../ruleChainTbAdapter";
import {
  RULE_CHAIN_MIN_EDGE_LENGTH_PX,
  RULE_CHAIN_NODE_GAP_PX,
  RULE_CHAIN_NODE_HEIGHT,
  RULE_CHAIN_NODE_WIDTH,
} from "./ruleChainCanvasLogic";

export type RuleChainNodeRect = { x: number; y: number; w: number; h: number };

/** Flow bounds for a rule node (`nodeOrigin` is left-center). */
export function ruleChainNodeRect(node: Node): RuleChainNodeRect {
  const h = RULE_CHAIN_NODE_HEIGHT;
  return {
    x: node.position.x,
    y: node.position.y - h / 2,
    w: RULE_CHAIN_NODE_WIDTH,
    h,
  };
}

function rectsOverlap(a: RuleChainNodeRect, b: RuleChainNodeRect, gap: number): boolean {
  return a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
}

function resolvePairOverlap(
  a: RuleChainNodeRect,
  b: RuleChainNodeRect,
  gap: number,
): { dx: number; dy: number } {
  const penX = Math.min(a.x + a.w + gap - b.x, b.x + b.w + gap - a.x);
  const penY = Math.min(a.y + a.h + gap - b.y, b.y + b.h + gap - a.y);
  if (penX <= 0 || penY <= 0) return { dx: 0, dy: 0 };

  const cxA = a.x + a.w / 2;
  const cyA = a.y + a.h / 2;
  const cxB = b.x + b.w / 2;
  const cyB = b.y + b.h / 2;

  if (penX < penY) {
    return { dx: cxB >= cxA ? penX : -penX, dy: 0 };
  }
  return { dx: 0, dy: cyB >= cyA ? penY : -penY };
}

export function ruleChainHasOverlappingNodes(nodes: Node[]): boolean {
  const rule = nodes.filter((n) => !isRuleChainInputNode(n));
  for (let i = 0; i < rule.length; i++) {
    for (let j = i + 1; j < rule.length; j++) {
      if (rectsOverlap(ruleChainNodeRect(rule[i]!), ruleChainNodeRect(rule[j]!), RULE_CHAIN_NODE_GAP_PX)) {
        return true;
      }
    }
  }
  return false;
}

/** True when a left-to-right link has less than the minimum wire length. */
export function ruleChainHasShortWires(nodes: Node[], edges: Edge[]): boolean {
  for (const e of edges) {
    if (e.source === RULE_CHAIN_INPUT_NODE_ID) continue;
    const src = nodes.find((n) => n.id === e.source);
    const tgt = nodes.find((n) => n.id === e.target);
    if (!src || !tgt || isRuleChainInputNode(src) || isRuleChainInputNode(tgt)) continue;

    const wireLen = tgt.position.x - (src.position.x + RULE_CHAIN_NODE_WIDTH);
    if (wireLen >= 0 && wireLen < RULE_CHAIN_MIN_EDGE_LENGTH_PX) return true;
  }
  return false;
}

export function ruleChainNodesNeedSpacingFix(nodes: Node[], edges: Edge[]): boolean {
  return ruleChainHasOverlappingNodes(nodes) || ruleChainHasShortWires(nodes, edges);
}

/** Push overlapping rule nodes apart only when boxes collide. */
export function separateOverlappingRuleChainNodes(nodes: Node[], maxIterations = 12): Node[] {
  const gap = RULE_CHAIN_NODE_GAP_PX;
  const byId = new Map(nodes.map((n) => [n.id, { ...n, position: { ...n.position } }]));
  const ruleIds = [...byId.values()].filter((n) => !isRuleChainInputNode(n)).map((n) => n.id);

  for (let iter = 0; iter < maxIterations; iter++) {
    let moved = false;
    for (let i = 0; i < ruleIds.length; i++) {
      for (let j = i + 1; j < ruleIds.length; j++) {
        const na = byId.get(ruleIds[i]!)!;
        const nb = byId.get(ruleIds[j]!)!;
        const ra = ruleChainNodeRect(na);
        const rb = ruleChainNodeRect(nb);
        if (!rectsOverlap(ra, rb, gap)) continue;
        const { dx, dy } = resolvePairOverlap(ra, rb, gap);
        if (dx === 0 && dy === 0) continue;
        byId.set(nb.id, {
          ...nb,
          position: {
            x: Math.round(nb.position.x + dx),
            y: Math.round(nb.position.y + dy),
          },
        });
        moved = true;
      }
    }
    if (!moved) break;
  }

  return nodes.map((n) => byId.get(n.id) ?? n);
}

/** Nudge targets only when a horizontal wire is shorter than the minimum. */
export function enforceRuleChainMinimumEdgeLength(nodes: Node[], edges: Edge[]): Node[] {
  const byId = new Map(nodes.map((n) => [n.id, { ...n, position: { ...n.position } }]));

  for (const e of edges) {
    if (e.source === RULE_CHAIN_INPUT_NODE_ID) continue;
    const src = byId.get(e.source);
    const tgt = byId.get(e.target);
    if (!src || !tgt || isRuleChainInputNode(src) || isRuleChainInputNode(tgt)) continue;

    const wireLen = tgt.position.x - (src.position.x + RULE_CHAIN_NODE_WIDTH);
    if (wireLen < 0 || wireLen >= RULE_CHAIN_MIN_EDGE_LENGTH_PX) continue;

    const shift = RULE_CHAIN_MIN_EDGE_LENGTH_PX - wireLen;
    byId.set(tgt.id, {
      ...tgt,
      position: { ...tgt.position, x: Math.round(tgt.position.x + shift) },
    });
  }

  return nodes.map((n) => byId.get(n.id) ?? n);
}

export function anchorRuleChainInputNode(nodes: Node[], edges: Edge[]): Node[] {
  const rule = nodes.filter((n) => !isRuleChainInputNode(n));
  const input = nodes.find((n) => isRuleChainInputNode(n));
  if (!input || rule.length === 0) return nodes;

  const idx = inferFirstNodeIndex(nodes, edges);
  const entry = rule[Math.min(Math.max(0, idx), rule.length - 1)];
  if (!entry) return nodes;

  const inputPos = ruleChainInputPositionForEntry(entry.position);
  return nodes.map((n) => (n.id === input.id ? { ...n, position: inputPos } : n));
}

/** Snap a drop point to the grid and clear any node overlap. */
export function snapRuleChainFlowPositionClearOfNodes(
  pos: { x: number; y: number },
  nodes: Node[],
  grid = 15,
): { x: number; y: number } {
  const snap = (v: number) => Math.round(v / grid) * grid;
  let candidate = { x: snap(pos.x), y: snap(pos.y) };
  const stepX = RULE_CHAIN_NODE_WIDTH + RULE_CHAIN_MIN_EDGE_LENGTH_PX;
  const stepY = RULE_CHAIN_NODE_HEIGHT + RULE_CHAIN_NODE_GAP_PX;
  const probes: { x: number; y: number }[] = [
    { x: 0, y: 0 },
    { x: stepX, y: 0 },
    { x: 0, y: stepY },
    { x: -stepX, y: 0 },
    { x: 0, y: -stepY },
    { x: stepX, y: stepY },
  ];

  for (const probe of probes) {
    const test = { x: snap(candidate.x + probe.x), y: snap(candidate.y + probe.y) };
    const ghost: Node = { id: "__probe__", type: "ruleChainNode", position: test, data: {} };
    const others = nodes.filter((n) => !isRuleChainInputNode(n));
    const overlaps = others.some((n) =>
      rectsOverlap(ruleChainNodeRect(ghost), ruleChainNodeRect(n), RULE_CHAIN_NODE_GAP_PX),
    );
    if (!overlaps) return test;
    candidate = test;
  }

  return candidate;
}

/** Fix overlaps and short wires only when needed; always re-anchor Input. */
export function ensureRuleChainNodeSpacing(nodes: Node[], edges: Edge[]): Node[] {
  let next = nodes;
  if (ruleChainHasOverlappingNodes(next)) next = separateOverlappingRuleChainNodes(next);
  if (ruleChainHasShortWires(next, edges)) next = enforceRuleChainMinimumEdgeLength(next, edges);
  if (ruleChainHasOverlappingNodes(next)) next = separateOverlappingRuleChainNodes(next);
  return anchorRuleChainInputNode(next, edges);
}

/** Preserve saved layout; adjust only when overlap or wire length requires it. */
export function reconcileRuleChainNodeSpacing(nodes: Node[], edges: Edge[]): Node[] {
  if (!ruleChainNodesNeedSpacingFix(nodes, edges)) {
    return anchorRuleChainInputNode(nodes, edges);
  }
  return ensureRuleChainNodeSpacing(nodes, edges);
}
