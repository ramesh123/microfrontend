import type { Edge, Node } from "@xyflow/react";

import type { RuleChainSummary } from "@/controllers/API/ruleChainsApi";

/**
 * ThingsBoard-style {@link https://thingsboard.io/docs/ rule chain entity} payload
 * for `save-rule-chain-entity` (name, type, debugMode, configuration, additionalInfo with layout).
 */

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function pickChainDescription(chain: RuleChainSummary | null): string {
  if (!chain) return "";
  if (typeof chain.description === "string" && chain.description.trim()) return chain.description.trim();
  const ai = chain.additionalInfo;
  if (isRecord(ai) && typeof ai.description === "string" && ai.description.trim()) return ai.description.trim();
  const sn = chain.additional_info;
  if (isRecord(sn) && typeof sn.description === "string" && sn.description.trim()) return sn.description.trim();
  return "";
}

function chainAdditionalInfoRecord(chain: RuleChainSummary | null): Record<string, unknown> | null {
  if (!chain) return null;
  if (isRecord(chain.additionalInfo)) return { ...chain.additionalInfo };
  if (isRecord(chain.additional_info)) return { ...chain.additional_info };
  return null;
}

function chainConfigurationRecord(chain: RuleChainSummary | null): Record<string, unknown> {
  if (!chain || chain.configuration == null) return {};
  if (isRecord(chain.configuration)) return { ...chain.configuration };
  return {};
}

/** JSON-serialize React Flow nodes/edges for `additionalInfo.layout` (ThingsBoard UI / gateway). */
export function cloneReactFlowLayout(nodes: Node[], edges: Edge[]): { nodes: unknown[]; edges: unknown[] } {
  return {
    nodes: JSON.parse(JSON.stringify(nodes)) as unknown[],
    edges: JSON.parse(JSON.stringify(edges)) as unknown[],
  };
}

const DEFAULT_CONFIGURATION: Record<string, unknown> = {
  type: "processing-chain",
  description: "",
  version: 1,
  retryStrategy: {
    retries: 3,
    failureAction: "log",
  },
  metadata: {
    createdBy: "system",
    useCase: "IoT Gateway workflow",
  },
};

const DEFAULT_ADDITIONAL_INFO: Record<string, unknown> = {
  description: "",
  uiState: {
    zoomLevel: 1,
    offset: { x: 0, y: 0 },
  },
  tags: ["iot", "gateway"],
  color: "#2E86C1",
  icon: "chart-network",
};

/**
 * Build a ThingsBoard-shaped rule chain entity object for `POST …/save-rule-chain-entity` body `{ payload: this }`.
 */
export function buildTbRuleChainEntityPayload(args: {
  chainId: string;
  chain: RuleChainSummary | null;
  nodes: Node[];
  edges: Edge[];
  viewport?: { x: number; y: number; zoom: number } | null;
}): Record<string, unknown> {
  const { chainId, chain, nodes, edges, viewport } = args;
  const desc = pickChainDescription(chain);
  const existingConfig = chainConfigurationRecord(chain);
  const configuration: Record<string, unknown> = {
    ...DEFAULT_CONFIGURATION,
    ...existingConfig,
    metadata: isRecord(DEFAULT_CONFIGURATION.metadata)
      ? { ...DEFAULT_CONFIGURATION.metadata, ...(isRecord(existingConfig.metadata) ? existingConfig.metadata : {}) }
      : existingConfig.metadata,
  };
  if (typeof configuration.description !== "string" || !configuration.description.trim()) {
    configuration.description =
      (typeof existingConfig.description === "string" && existingConfig.description.trim()
        ? existingConfig.description
        : desc) || "Gateway workflow";
  }

  const priorAdd = chainAdditionalInfoRecord(chain);
  const priorRest: Record<string, unknown> = priorAdd ? { ...priorAdd } : {};
  delete priorRest.layout;
  delete priorRest.uiState;
  const priorUi = priorAdd?.uiState;
  const layout = cloneReactFlowLayout(nodes, edges);
  const priorZoom = isRecord(priorUi) && typeof priorUi.zoomLevel === "number" ? priorUi.zoomLevel : undefined;
  const priorOff = isRecord(priorUi) && isRecord(priorUi.offset) ? priorUi.offset : null;
  const additionalInfo: Record<string, unknown> = {
    ...DEFAULT_ADDITIONAL_INFO,
    ...priorRest,
    description:
      (typeof priorRest.description === "string" && priorRest.description.trim()
        ? priorRest.description
        : desc) ||
      (typeof DEFAULT_ADDITIONAL_INFO.description === "string" ? DEFAULT_ADDITIONAL_INFO.description : "") ||
      "IOT Gateway rule chain",
    layout,
    uiState: {
      zoomLevel: viewport?.zoom ?? priorZoom ?? 1,
      offset: {
        x: viewport != null ? viewport.x : typeof priorOff?.x === "number" ? priorOff.x : 0,
        y: viewport != null ? viewport.y : typeof priorOff?.y === "number" ? priorOff.y : 0,
      },
    },
  };

  const debugMode = Boolean(chain?.debugMode ?? chain?.debug_mode ?? false);
  const name = (chain?.name?.trim() || "Rule chain").trim();
  const type = typeof chain?.type === "string" && chain.type.trim() ? chain.type.trim() : "CORE";

  const entity: Record<string, unknown> = {
    id: { entityType: "RULE_CHAIN", id: chainId },
    name,
    type,
    debugMode,
    configuration,
    additionalInfo,
  };

  if (typeof chain?.version === "number" && Number.isFinite(chain.version)) {
    entity.version = chain.version;
  }
  if (typeof chain?.root === "boolean") {
    entity.root = chain.root;
  }

  return entity;
}
