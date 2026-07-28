import type { Edge, Node } from "@xyflow/react";

const STORAGE_KEY = "vite-rule-chain-clipboard-v1";

export type RuleChainClipboardPayload = {
  /** Schema version for forward compatibility */
  v: 1;
  copiedAt: string;
  nodes: Node[];
  edges: Edge[];
};

export function writeRuleChainClipboardPayload(nodes: Node[], edges: Edge[]): void {
  const payload: RuleChainClipboardPayload = {
    v: 1,
    copiedAt: new Date().toISOString(),
    nodes: JSON.parse(JSON.stringify(nodes)) as Node[],
    edges: JSON.parse(JSON.stringify(edges)) as Edge[],
  };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function readRuleChainClipboardPayload(): RuleChainClipboardPayload | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<RuleChainClipboardPayload>;
    if (p.v !== 1 || !Array.isArray(p.nodes) || p.nodes.length === 0) return null;
    return {
      v: 1,
      copiedAt: typeof p.copiedAt === "string" ? p.copiedAt : "",
      nodes: p.nodes as Node[],
      edges: Array.isArray(p.edges) ? (p.edges as Edge[]) : [],
    };
  } catch {
    return null;
  }
}

export function clearRuleChainClipboard(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
