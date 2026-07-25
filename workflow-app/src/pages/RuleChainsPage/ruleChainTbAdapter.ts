import { MarkerType, type Edge, type Node } from "@xyflow/react";

import type { RuleChainFlowNodeData } from "./components/RuleChainFlowNode";
import { inferDefaultRelationTypes } from "./rule-node/inferRelationTypes";
import { autoLayoutRuleChainNodes, nodesNeedAutoLayout } from "./rule-node/ruleChainAutoLayout";
import { RULE_CHAIN_COL_STEP, RULE_CHAIN_EDGE_STROKE } from "./rule-node/ruleChainCanvasLogic";
import { reconcileRuleChainNodeSpacing } from "./rule-node/ruleChainNodeSpacing";
import { RULE_CHAIN_LEGACY_SOURCE_HANDLE_ID, RULE_CHAIN_TARGET_HANDLE_ID } from "./ruleChainHandles";
import { segmentStyleFromClazz } from "./ruleChainTbSegmentTheme";

export { segmentStyleFromClazz };

/** ThingsBoard entity id shape */
export type TbEntityId = {
  entityType?: string;
  id: string;
};

export type TbRuleNode = {
  id?: TbEntityId;
  type?: string;
  name?: string;
  /** ThingsBoard rule node inactive flag (ui-ngx “Disabled”). */
  disabled?: boolean;
  configuration?: Record<string, unknown>;
  additionalInfo?: Record<string, unknown>;
  debugSettings?: unknown;
  singletonMode?: boolean;
  queueName?: unknown;
  configurationVersion?: number;
  createdTime?: number;
  externalId?: unknown;
};

export type TbConnection = {
  fromIndex: number;
  toIndex: number;
  type?: string;
};

/** Payload aligned with ThingsBoard `RuleChainMetaData` / save metadata API */
export type TbRuleChainMetadata = {
  ruleChainId?: TbEntityId;
  firstNodeIndex?: number;
  nodes?: TbRuleNode[];
  connections?: TbConnection[];
  /** ThingsBoard sends `null` when version is unset; include explicitly on save. */
  version?: number | null;
  ruleChainConnections?: unknown;
};

/** ThingsBoard rule-node entity id (UUID v4 string inside `id`). */
const TB_RULE_NODE_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Human-readable rule-node type from Java `clazz` (for subtitle under custom `name`, ThingsBoard-style). */
export function humanizeRuleNodeClazz(clazz: string): string {
  const last = (clazz || "").split(".").pop() || "";
  if (last.length < 2) return last.trim();
  let t = last.replace(/^Tb/i, "").replace(/Node$/i, "");
  t = t.replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  t = t.replace(/([a-z\d])([A-Z])/g, "$1 $2");
  const words = t
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ""))
    .filter(Boolean);
  return words.join(" ") || last;
}

function layoutXY(additional: Record<string, unknown> | undefined): { x: number; y: number } {
  if (!additional) return { x: 0, y: 0 };
  const x = Number(additional.layoutX ?? additional.layoutx ?? 0);
  const y = Number(additional.layoutY ?? additional.layouty ?? 0);
  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function isTbEntityId(v: unknown): v is TbEntityId {
  return isRecord(v) && typeof v.id === "string" && Boolean(v.id.trim());
}

/** Detect ThingsBoard-style metadata (indexed nodes + connections). */
export function isTbRuleChainMetadata(raw: unknown): raw is TbRuleChainMetadata {
  if (!isRecord(raw)) return false;
  const nodes = raw.nodes;
  if (!Array.isArray(nodes) || nodes.length === 0) return false;
  const conns = raw.connections;
  if (conns != null && !Array.isArray(conns)) return false;
  const first = nodes[0];
  if (!isRecord(first)) return false;
  const clazz = typeof first.type === "string" ? first.type : "";
  const looksLikeTbClazz =
    clazz.includes(".") && (/thingsboard|rule\.engine/i.test(clazz) || clazz.includes("org.thingsboard"));
  const looksLikeTbNode = isTbEntityId(first.id) && first.id.entityType === "RULE_NODE";
  return looksLikeTbClazz || looksLikeTbNode;
}

function unwrapMetadataResponse(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  if ("data" in raw && raw.data != null) return raw.data;
  if ("ruleChainMetaData" in raw) return (raw as { ruleChainMetaData: unknown }).ruleChainMetaData;
  return raw;
}

export function parseRuleChainMetadataPayload(raw: unknown): TbRuleChainMetadata | null {
  const inner = unwrapMetadataResponse(raw);
  if (!isRecord(inner)) return null;
  const nodes = inner.nodes;
  if (!Array.isArray(nodes) || nodes.length === 0) return null;
  const normalized = {
    ...inner,
    connections: Array.isArray(inner.connections) ? (inner.connections as TbConnection[]) : [],
  } as TbRuleChainMetadata;
  return isTbRuleChainMetadata(normalized) ? normalized : null;
}

/** Legacy editor shape: `{ configuration: { nodes, edges } }` from `saveRuleChainEntity`. */
export function tryParseLegacyEntityConfiguration(raw: unknown): { nodes: Node[]; edges: Edge[] } | null {
  if (!isRecord(raw)) return null;
  const conf = raw.configuration;
  if (!isRecord(conf)) return null;
  const n = conf.nodes;
  const e = conf.edges;
  if (!Array.isArray(n) || !Array.isArray(e)) return null;
  return { nodes: n as Node[], edges: e as Edge[] };
}

/** Virtual ThingsBoard-style chain input (not persisted in `RuleChainMetaData.nodes`). */
export const RULE_CHAIN_INPUT_NODE_ID = "__tb_rule_chain_input__";

/** Horizontal gap between Input node and the entry rule node (matches auto-layout). */
export const RULE_CHAIN_INPUT_OFFSET_X = 248;

export function ruleChainInputPositionForEntry(entry: { x: number; y: number }): { x: number; y: number } {
  return {
    x: Math.round(entry.x - RULE_CHAIN_INPUT_OFFSET_X),
    y: Math.round(entry.y),
  };
}

export function isRuleChainInputNode(node: Node): boolean {
  return Boolean((node.data as RuleChainFlowNodeData)?.isRuleChainInput);
}

export function inferFirstNodeIndex(rfNodes: Node[], edges: Edge[]): number {
  const ruleNodes = rfNodes.filter((n) => !isRuleChainInputNode(n));
  if (ruleNodes.length === 0) return 0;
  const incomingFromRule = new Set(
    edges
      .filter((e) => {
        const src = rfNodes.find((n) => n.id === e.source);
        return src && !isRuleChainInputNode(src);
      })
      .map((e) => e.target),
  );
  for (let i = 0; i < ruleNodes.length; i++) {
    if (!incomingFromRule.has(ruleNodes[i].id)) return i;
  }
  return 0;
}

function createVirtualInputNode(position: { x: number; y: number }): Node {
  return {
    id: RULE_CHAIN_INPUT_NODE_ID,
    type: "ruleChainInput",
    position,
    draggable: false,
    selectable: true,
    focusable: false,
    data: {
      label: "Input",
      isRuleChainInput: true,
      categoryCode: "INPUT",
      categoryColor: "#1e88e5",
      clazz: "org.thingsboard.rule.engine.internal.TbInputNode",
      type: "Input",
      configuration: {},
    } as RuleChainFlowNodeData,
  };
}

const CHAIN_INPUT_EDGE_STROKE = RULE_CHAIN_EDGE_STROKE;

/**
 * Prepend virtual Input node and connect it to the entry rule node.
 * ThingsBoard: incoming messages hit `nodes[firstNodeIndex]` first; there is no separate edge in
 * `RuleChainMetaData.connections` for “Input” — we model that as one `Success` link from the virtual Input node.
 */
export function withVirtualRuleChainInput(
  ruleNodes: Node[],
  edges: Edge[],
  firstNodeIndex: number,
): { nodes: Node[]; edges: Edge[] } {
  if (ruleNodes.some((n) => n.id === RULE_CHAIN_INPUT_NODE_ID)) {
    return { nodes: ruleNodes, edges };
  }
  const filtered = ruleNodes.filter((n) => !isRuleChainInputNode(n));
  if (filtered.length === 0) {
    return { nodes: [createVirtualInputNode({ x: 96, y: 168 })], edges: [] };
  }
  const idx = Math.min(Math.max(0, Math.floor(firstNodeIndex)), filtered.length - 1);
  const first = filtered[idx] ?? filtered[0];
  const inputPos = ruleChainInputPositionForEntry(first.position);
  const inputNode = createVirtualInputNode(inputPos);
  const nextEdges = [...edges];
  const exists = nextEdges.some((e) => e.source === RULE_CHAIN_INPUT_NODE_ID && e.target === first.id);
  if (!exists) {
    nextEdges.push({
      id: `tb-input-${first.id}-success`,
      source: RULE_CHAIN_INPUT_NODE_ID,
      target: first.id,
      sourceHandle: RULE_CHAIN_LEGACY_SOURCE_HANDLE_ID,
      targetHandle: RULE_CHAIN_TARGET_HANDLE_ID,
      type: "ruleChainDeletable",
      data: { relationType: "Success" },
      markerEnd: { type: MarkerType.ArrowClosed, color: CHAIN_INPUT_EDGE_STROKE, width: 9, height: 9 },
      style: { stroke: CHAIN_INPUT_EDGE_STROKE, strokeWidth: 1.5 },
    });
  }
  return { nodes: [inputNode, ...ruleNodes], edges: nextEdges };
}

/**
 * Convert ThingsBoard metadata into React Flow nodes/edges.
 * React Flow node `id` is the TB RULE_NODE uuid when present so saves stay stable.
 */
export function tbMetadataToReactFlow(meta: TbRuleChainMetadata): { nodes: Node[]; edges: Edge[] } {
  const list = meta.nodes ?? [];
  const connections = meta.connections ?? [];

  const nodes: Node[] = list.map((tb) => {
    const tbId = tb.id?.id?.trim();
    /** React Flow needs a stable string id; TB may omit `id` on new nodes until save. */
    const id = tbId && TB_RULE_NODE_UUID.test(tbId) ? tbId : crypto.randomUUID();
    const clazz = (tb.type ?? "").trim();
    const { categoryCode, categoryColor, typeLabel } = segmentStyleFromClazz(clazz);
    const add = tb.additionalInfo as Record<string, unknown> | undefined;
    const pos = layoutXY(add);
    const desc = typeof add?.description === "string" ? add.description : "";
    const iconUrl =
      typeof add?.iconUrl === "string"
        ? add.iconUrl.trim()
        : typeof add?.icon_url === "string"
          ? add.icon_url.trim()
          : undefined;
    const iconName =
      typeof add?.icon === "string"
        ? add.icon.trim()
        : typeof add?.materialIcon === "string"
          ? add.materialIcon.trim()
          : undefined;

    const rel = inferDefaultRelationTypes(clazz);
    const label = (tb.name ?? clazz.split(".").pop() ?? "Node").trim() || "Node";

    const data: RuleChainFlowNodeData = {
      label,
      description: desc || undefined,
      categoryCode,
      categoryColor,
      clazz: clazz || undefined,
      type: typeLabel,
      configuration: isRecord(tb.configuration) ? { ...tb.configuration } : {},
      ...(typeof tb.disabled === "boolean" && tb.disabled ? { disabled: true } : {}),
      ...(tbId && TB_RULE_NODE_UUID.test(tbId) ? { tbEntityId: tbId } : {}),
      ...(iconUrl ? { iconUrl } : {}),
      ...(iconName ? { iconName } : {}),
      ...(rel?.length ? { relationTypes: rel } : {}),
      tbPreserve: {
        debugSettings: tb.debugSettings,
        singletonMode: tb.singletonMode,
        queueName: tb.queueName,
        configurationVersion: tb.configurationVersion,
        createdTime: tb.createdTime,
        externalId: tb.externalId,
      },
    };

    return {
      id,
      type: "ruleChainNode",
      position: pos,
      data,
    };
  });

  const idByIndex = (i: number) => nodes[i]?.id;
  const edges: Edge[] = connections.map((c, idx) => {
    const from = idByIndex(c.fromIndex);
    const to = idByIndex(c.toIndex);
    const rel = (c.type ?? "Success").trim() || "Success";
    if (!from || !to) {
      return null;
    }
    return {
      id: `tb-${from}-${to}-${rel}-${idx}`,
      source: from,
      target: to,
      sourceHandle: RULE_CHAIN_LEGACY_SOURCE_HANDLE_ID,
      targetHandle: RULE_CHAIN_TARGET_HANDLE_ID,
      type: "ruleChainDeletable",
      data: { relationType: rel },
    };
  });

  const cleanedEdges = edges.filter(Boolean) as Edge[];
  const nodesWithOutgoingLabels = mergeOutgoingRelationLabelsIntoNodes(nodes, cleanedEdges);
  const laidOutBase = nodesNeedAutoLayout(nodesWithOutgoingLabels)
    ? autoLayoutRuleChainNodes(nodesWithOutgoingLabels, cleanedEdges)
    : nodesWithOutgoingLabels;
  const laidOut = reconcileRuleChainNodeSpacing(laidOutBase, cleanedEdges);
  const firstIdx =
    typeof meta.firstNodeIndex === "number" && Number.isFinite(meta.firstNodeIndex) ? meta.firstNodeIndex : 0;
  return withVirtualRuleChainInput(laidOut, cleanedEdges, firstIdx);
}

function edgeRelationType(e: Edge): string {
  const d = e.data as Record<string, unknown> | undefined;
  const r = d?.relationType;
  if (typeof r === "string" && r.trim()) return r.trim();
  return "Success";
}

/** After load, union `relationTypes` with labels already present on outgoing edges (TB metadata has no per-node relation list). */
function mergeOutgoingRelationLabelsIntoNodes(nodes: Node[], edges: Edge[]): Node[] {
  const outgoing = new Map<string, Set<string>>();
  for (const e of edges) {
    const r = edgeRelationType(e);
    if (!outgoing.has(e.source)) outgoing.set(e.source, new Set());
    outgoing.get(e.source)!.add(r);
  }
  return nodes.map((n) => {
    if (isRuleChainInputNode(n)) return n;
    const extra = outgoing.get(n.id);
    if (!extra?.size) return n;
    const d = n.data as RuleChainFlowNodeData;
    const base = d.relationTypes?.filter((x): x is string => typeof x === "string" && Boolean(x.trim())) ?? [];
    const merged = [...new Set([...base, ...extra])];
    if (merged.length === base.length && base.length > 0) return n;
    return { ...n, data: { ...d, relationTypes: merged } };
  });
}

/**
 * Serialize one React Flow rule node to ThingsBoard `RuleNode` shape for save-rule-chain-metadata.
 * Matches ui-ngx: new nodes omit `id` until the server assigns `RULE_NODE` ids; only persisted
 * nodes include `id: { entityType: "RULE_NODE", id }` (from metadata load via `tbEntityId`).
 */
export function flowNodeToTbRuleNode(rfNode: Node): TbRuleNode {
  const n = rfNode;
  const d = n.data as RuleChainFlowNodeData;
  const clazz = d.clazz ?? "";
  const tbIdStr = (d.tbEntityId?.trim() || "").trim();
  const id: TbEntityId | undefined =
    tbIdStr && TB_RULE_NODE_UUID.test(tbIdStr) ? { entityType: "RULE_NODE", id: tbIdStr } : undefined;

  const additionalInfo: Record<string, unknown> = {
    description: d.description ?? "",
    layoutX: Math.round(n.position.x),
    layoutY: Math.round(n.position.y),
  };

  const p = d.tbPreserve;
  /** ThingsBoard `RuleNode` JSON always includes these keys on save. */
  const configurationVersion =
    p?.configurationVersion !== undefined &&
    typeof p.configurationVersion === "number" &&
    Number.isFinite(p.configurationVersion)
      ? p.configurationVersion
      : 0;
  const debugSettings = p?.debugSettings !== undefined ? p.debugSettings : null;
  const singletonMode = p?.singletonMode !== undefined ? Boolean(p.singletonMode) : false;
  const queueName = p?.queueName !== undefined ? p.queueName : null;

  const base: TbRuleNode = {
    ...(id ? { id } : {}),
    type: clazz,
    name: d.label ?? "Node",
    disabled: Boolean(d.disabled),
    configurationVersion,
    configuration: { ...(d.configuration ?? {}) },
    additionalInfo,
    debugSettings,
    singletonMode,
    queueName,
  };

  if (p?.createdTime !== undefined) base.createdTime = p.createdTime;
  if (p?.externalId !== undefined) base.externalId = p.externalId;

  return base;
}

/**
 * Build ThingsBoard metadata from the current canvas.
 */
export function reactFlowToTbMetadata(
  rfNodes: Node[],
  rfEdges: Edge[],
  chainId: string,
  opts?: { firstNodeIndex?: number; version?: number | null },
): TbRuleChainMetadata {
  const ruleNodes = rfNodes.filter((n) => !isRuleChainInputNode(n));
  const indexById = new Map<string, number>();
  ruleNodes.forEach((n, i) => indexById.set(n.id, i));

  const nodes: TbRuleNode[] = ruleNodes.map((n) => flowNodeToTbRuleNode(n));

  const connections: TbConnection[] = rfEdges
    .filter((e) => {
      const s = rfNodes.find((n) => n.id === e.source);
      const t = rfNodes.find((n) => n.id === e.target);
      return Boolean(s && t && !isRuleChainInputNode(s) && !isRuleChainInputNode(t));
    })
    .map((e) => {
      const fi = indexById.get(e.source);
      const ti = indexById.get(e.target);
      if (fi === undefined || ti === undefined) return null;
      return {
        fromIndex: fi,
        toIndex: ti,
        type: edgeRelationType(e),
      };
    })
    .filter(Boolean) as TbConnection[];

  const firstNodeIndex =
    typeof opts?.firstNodeIndex === "number" && Number.isFinite(opts.firstNodeIndex)
      ? opts.firstNodeIndex
      : inferFirstNodeIndex(rfNodes, rfEdges);

  /** Match ThingsBoard `RuleChainMetaData` save shape (including `version: null` when unset). */
  const version =
    typeof opts?.version === "number" && Number.isFinite(opts.version) ? opts.version : null;
  return {
    ruleChainId: { entityType: "RULE_CHAIN", id: chainId },
    firstNodeIndex,
    nodes,
    connections,
    version,
  };
}
