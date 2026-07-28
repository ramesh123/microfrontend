import type { CoordinateExtent, FitViewOptions, Node } from "@xyflow/react";

import { isRuleChainInputNode } from "../ruleChainTbAdapter";

/** Approximate rule-node card size (matches `.rule-chain-df-node` min width / height). */
export const RULE_CHAIN_NODE_WIDTH = 176;
export const RULE_CHAIN_NODE_HEIGHT = 64;

/** Minimum horizontal wire length when a link is still too short. */
export const RULE_CHAIN_MIN_EDGE_LENGTH_PX = 80;

/** Clear gap between overlapping node boxes. */
export const RULE_CHAIN_NODE_GAP_PX = 16;

/** Horizontal step between pipeline columns (node width + min wire). */
export const RULE_CHAIN_COL_STEP = RULE_CHAIN_NODE_WIDTH + RULE_CHAIN_MIN_EDGE_LENGTH_PX;

/** Vertical step between stacked nodes in one column. */
export const RULE_CHAIN_ROW_STEP = RULE_CHAIN_NODE_HEIGHT + RULE_CHAIN_NODE_GAP_PX;

export type RuleChainFlowScale = "compact" | "medium" | "large";

export function countRuleChainNodes(nodes: Node[]): number {
  return nodes.filter((n) => !isRuleChainInputNode(n)).length;
}

/** Bounding box of all nodes on canvas (ThingsBoard uses stored layoutX/Y). */
export function ruleChainGraphSpan(nodes: Node[]): { width: number; height: number } {
  if (nodes.length === 0) return { width: 0, height: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y - RULE_CHAIN_NODE_HEIGHT / 2);
    maxX = Math.max(maxX, n.position.x + RULE_CHAIN_NODE_WIDTH);
    maxY = Math.max(maxY, n.position.y + RULE_CHAIN_NODE_HEIGHT / 2);
  }
  return { width: maxX - minX, height: maxY - minY };
}

/** Classify chain size like ThingsBoard (small editor zoom vs full-diagram overview). */
export function ruleChainFlowScale(nodes: Node[]): RuleChainFlowScale {
  const count = countRuleChainNodes(nodes);
  const { width, height } = ruleChainGraphSpan(nodes);
  if (count > 22 || width > 3000 || height > 2200) return "large";
  if (count > 7 || width > 1200 || height > 800) return "medium";
  return "compact";
}

/**
 * ThingsBoard-style fit: small chains open zoomed in; large chains fit the whole diagram
 * (overview like the reference screenshot).
 */
export function fitViewOptionsForRuleChain(nodes: Node[]): FitViewOptions {
  const scale = ruleChainFlowScale(nodes);
  const base = { duration: 280, includeHiddenNodes: false } satisfies FitViewOptions;

  switch (scale) {
    case "large":
      return {
        ...base,
        padding: 0.04,
        minZoom: 0.06,
        maxZoom: 0.72,
      };
    case "medium":
      return {
        ...base,
        padding: 0.06,
        minZoom: 0.22,
        maxZoom: 1,
      };
    default:
      return {
        ...base,
        duration: 220,
        padding: 0.05,
        minZoom: 0.35,
        maxZoom: 1.05,
      };
  }
}

/** Canvas zoom limits — large chains need deep zoom-out like ThingsBoard CE. */
export const RULE_CHAIN_MIN_ZOOM = 0.06;
export const RULE_CHAIN_MAX_ZOOM = 2.5;

/** Hide relation chips when zoomed out (reduces clutter on big flows). */
export const RULE_CHAIN_EDGE_LABEL_MIN_ZOOM = 0.42;

/** ThingsBoard CE link stroke — medium gray curved connections. */
export const RULE_CHAIN_EDGE_STROKE = "#808080";

/** Selected link highlight (unchanged when user picks an edge). */
export const RULE_CHAIN_EDGE_SELECTED_STROKE = "#e53935";

export function ruleChainEdgeStrokeForTheme(_colorMode: "light" | "dark"): string {
  return RULE_CHAIN_EDGE_STROKE;
}

/** Base Bezier curvature for horizontal TB-style links (bows away from node bodies). */
export const RULE_CHAIN_EDGE_BEZIER_CURVATURE = 0.38;

/** Spread curvature when several edges leave the same source (fan-out). */
export function ruleChainEdgeBezierCurvature(sourceId: string, edgeId: string, siblings: { id: string; target: string }[]): number {
  if (siblings.length <= 1) return RULE_CHAIN_EDGE_BEZIER_CURVATURE;
  const sorted = [...siblings].sort((a, b) =>
    a.target !== b.target ? a.target.localeCompare(b.target) : a.id.localeCompare(b.id),
  );
  const index = sorted.findIndex((e) => e.id === edgeId);
  const idx = index < 0 ? 0 : index;
  const center = (sorted.length - 1) / 2;
  const step = 0.12;
  return RULE_CHAIN_EDGE_BEZIER_CURVATURE + (idx - center) * step;
}

/** Padding around the diagram when panning (ThingsBoard-style dead zone past the flow). */
export const RULE_CHAIN_CANVAS_GAP = 24;

const EMPTY_CANVAS_EXTENT: CoordinateExtent = [
  [-120, -90],
  [240, 180],
];

/** Flow-coordinate pan limits from a nodes bounding rect + gap on all sides. */
export function ruleChainTranslateExtentFromBounds(
  bounds: { x: number; y: number; width: number; height: number },
  gap = RULE_CHAIN_CANVAS_GAP,
): CoordinateExtent {
  if (!Number.isFinite(bounds.x) || !Number.isFinite(bounds.y) || bounds.width <= 0 || bounds.height <= 0) {
    return EMPTY_CANVAS_EXTENT;
  }
  return [
    [bounds.x - gap, bounds.y - gap],
    [bounds.x + bounds.width + gap, bounds.y + bounds.height + gap],
  ];
}
