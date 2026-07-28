import type { Edge } from "@xyflow/react";

export const RULE_CHAIN_TARGET_HANDLE_ID = "in";
export const RULE_CHAIN_LEGACY_SOURCE_HANDLE_ID = "out";

const HANDLE_PREFIX = "rel:";

/** Stable React Flow handle id for an outgoing relation label. */
export function relationToHandleId(relation: string): string {
  const t = relation.trim();
  if (!t) return RULE_CHAIN_LEGACY_SOURCE_HANDLE_ID;
  return `${HANDLE_PREFIX}${t}`;
}

export function relationFromHandleId(handleId: string | null | undefined): string | null {
  if (!handleId) return null;
  if (handleId === RULE_CHAIN_LEGACY_SOURCE_HANDLE_ID) return "Success";
  if (handleId.startsWith(HANDLE_PREFIX)) return handleId.slice(HANDLE_PREFIX.length) || null;
  return null;
}

/** Port fill color (semantic); ring color comes from theme CSS on `.rule-chain-df-handle`. */
export function handleColorForRelation(relation: string, colorMode: "light" | "dark" = "light"): string {
  const t = relation.trim().toLowerCase();
  if (t === "failure" || t === "false") return colorMode === "dark" ? "#ef5350" : "#f44336";
  if (
    t === "success" ||
    t === "true" ||
    t === "cleared" ||
    t === "created" ||
    t === "updated" ||
    t === "default"
  ) {
    return colorMode === "dark" ? "#66bb6a" : "#4caf50";
  }
  return colorMode === "dark" ? "#42a5f5" : "#1e88e5";
}

export type RuleChainOutputHandle = {
  id: string;
  label: string;
  color: string;
};

/** One output port on the right; link label is chosen in the connect dialog. */
export function resolveVisibleOutputHandles(
  _clazz?: string | undefined,
  _relationTypes?: string[] | undefined,
  _outgoingUsed?: string[],
  colorMode: "light" | "dark" = "light",
): RuleChainOutputHandle[] {
  return [
    {
      id: RULE_CHAIN_LEGACY_SOURCE_HANDLE_ID,
      label: "Out",
      color: handleColorForRelation("Success", colorMode),
    },
  ];
}

/** Map saved edges to the single visible source/target handles on Datafusion-style nodes. */
export function normalizeRuleChainEdgeHandles(edges: Edge[]): Edge[] {
  return edges.map((e) => ({
    ...e,
    sourceHandle: RULE_CHAIN_LEGACY_SOURCE_HANDLE_ID,
    targetHandle: RULE_CHAIN_TARGET_HANDLE_ID,
  }));
}
