import axios, { type AxiosInstance } from "axios";
import { API_BASE_URL } from "./api";
import { iotDelete, iotGet, iotPost } from "./iotGatewayApiHelper";

const client: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

client.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("access_token");
  if (token) {
    config.headers.set("authentication", token);
  }
  return config;
});

/** ThingsBoard page shape returned by gateway */
export type TbPageData<T> = {
  data: T[];
  totalPages?: number;
  totalElements?: number;
  hasNext?: boolean;
};

export type RuleChainSummary = {
  id: { id: string; entityType?: string };
  name: string;
  /** ThingsBoard chain type, e.g. `CORE`. */
  type?: string;
  root?: boolean;
  debugMode?: boolean;
  debug_mode?: boolean;
  version?: number;
  /** ThingsBoard-style ms timestamp */
  createdTime?: number;
  created_time?: string;
  description?: string;
  /** ThingsBoard `additionalInfo` (description, layout, uiState, tags, …). */
  additionalInfo?: Record<string, unknown>;
  additional_info?: Record<string, unknown>;
  /** ThingsBoard rule chain `configuration` object (merged on entity save). */
  configuration?: Record<string, unknown> | null;
};

/** ThingsBoard component descriptor (subset used by the rule chain palette). */
export type RuleNodeComponentDescriptor = {
  type: string;
  clazz: string;
  name: string;
  clusteringMode?: string;
  configurationVersion?: number;
  configurationDescriptor?: {
    nodeDefinition?: {
      description?: string;
      details?: string;
      /** ThingsBoard ui-ngx `configDirective` → `RuleChainService.ruleNodeConfigComponents` key. */
      configDirective?: string;
      ruleChainNode?: boolean;
      inEnabled?: boolean;
      outEnabled?: boolean;
      relationTypes?: string[];
      customRelations?: boolean;
      defaultConfiguration?: Record<string, unknown>;
      icon?: string;
      iconUrl?: string;
    };
  };
};

/** In-flight dedupe for identical list requests (e.g. React StrictMode double effect). */
const listRuleChainsInflight = new Map<string, Promise<TbPageData<RuleChainSummary>>>();

export async function listRuleChains(
  page = 0,
  page_size = 10,
  search_text = "",
): Promise<TbPageData<RuleChainSummary>> {
  const key = `${page}|${page_size}|${search_text}`;
  const hit = listRuleChainsInflight.get(key);
  if (hit) return hit;
  const p = (async () => {
    try {
      return await iotPost<TbPageData<RuleChainSummary>>(
        client,
        "/rule-chain/list-rule-chains",
        { page, page_size, search_text },
        undefined,
        "Failed to load rule chains",
      );
    } finally {
      listRuleChainsInflight.delete(key);
    }
  })();
  listRuleChainsInflight.set(key, p);
  return p;
}

/** Fetch one rule chain — POST `/rule-chain/get-rule-chain` with `{ rule_chain_id }`. */
export async function getRuleChain(rule_chain_id: string): Promise<RuleChainSummary> {
  return iotPost<RuleChainSummary>(
    client,
    "/rule-chain/get-rule-chain",
    { rule_chain_id },
    undefined,
    "Failed to load rule chain",
  );
}

/**
 * Load rule chain graph metadata for one chain.
 * POST `/api/rule-chain/get-rule-chain-metadata` — body `{ rule_chain_id }`.
 */
export async function getRuleChainMetadata(rule_chain_id: string): Promise<Record<string, unknown>> {
  return iotPost<Record<string, unknown>>(
    client,
    "/rule-chain/get-rule-chain-metadata",
    { rule_chain_id },
    undefined,
    "Failed to load rule chain metadata",
  );
}

/**
 * Persist the full node graph for an existing chain.
 * POST `/rule-chain/save-rule-chain-metadata` — body `{ rule_chain_id, payload }` where `payload`
 * matches ThingsBoard `RuleChainMetaData` (camelCase): `ruleChainId`, `nodes`, `connections`,
 * `version` (number or `null`), `firstNodeIndex`; each node includes `id` (`RULE_NODE`), `type`, `name`,
 * `configurationVersion`, `configuration`, `additionalInfo`, `debugSettings`, `singletonMode`, `queueName`.
 */
export async function saveRuleChainMetadata(
  rule_chain_id: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return iotPost<Record<string, unknown>>(
    client,
    "/rule-chain/save-rule-chain-metadata",
    { rule_chain_id, payload },
    undefined,
    "Failed to save rule chain metadata",
  );
}

/**
 * Upsert rule-chain–related payload (e.g. single rule node after configure dialog).
 * POST `/api/rule-chain/save-rule-chain-entity` — body `{ payload }`.
 */
export async function saveRuleChainEntity(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  return iotPost<Record<string, unknown>>(
    client,
    "/rule-chain/save-rule-chain-entity",
    { payload },
    undefined,
    "Failed to save rule chain entity",
  );
}

export async function createRuleChain(body: {
  name: string;
  debugMode?: boolean;
  type?: string;
  configuration?: Record<string, unknown>;
  additionalInfo?: Record<string, unknown>;
}): Promise<RuleChainSummary> {
  return iotPost<RuleChainSummary>(client, "/rule-chain", body, undefined, "Failed to create rule chain");
}

/** Gateway create — POST `/rule-chain/create-rule-chain`. */
export async function createRuleChainGateway(body: {
  name: string;
  debugMode: boolean;
  description?: string;
}): Promise<unknown> {
  const additional_info = body.description?.trim()
    ? { description: body.description.trim() }
    : {};
  return iotPost<unknown>(
    client,
    "/rule-chain/create-rule-chain",
    {
      name: body.name.trim(),
      debugMode: body.debugMode,
      type: "CORE",
      configuration: {},
      additional_info,
    },
    undefined,
    "Failed to create rule chain",
  );
}

export async function deleteRuleChain(id: string): Promise<void> {
  await iotDelete(client, `/rule-chain/${encodeURIComponent(id)}`, undefined, "Failed to delete rule chain");
}

/** Gateway delete by id in JSON body. */
export async function deleteRuleChainGateway(rule_chain_id: string): Promise<void> {
  await iotPost(client, "/rule-chain/delete-rule-chain", { rule_chain_id }, undefined, "Failed to delete rule chain");
}

/** Set root rule chain — POST `/rule-chain/set-root-rule-chain` with `{ rule_chain_id }`. */
export async function setRootRuleChain(rule_chain_id: string): Promise<Record<string, unknown>> {
  return iotPost<Record<string, unknown>>(
    client,
    "/rule-chain/set-root-rule-chain",
    { rule_chain_id },
    undefined,
    "Failed to set root rule chain",
  );
}

/** Comma-separated component types for rule-chain palette requests. */
export const RULE_CHAIN_DEFAULT_COMPONENT_TYPES =
  "FILTER,ENRICHMENT,TRANSFORMATION,ACTION,EXTERNAL,FLOW";

function normalizeComponentsResponse(raw: unknown): RuleNodeComponentDescriptor[] {
  if (Array.isArray(raw)) return raw as RuleNodeComponentDescriptor[];
  if (raw && typeof raw === "object" && "data" in raw && Array.isArray((raw as { data: unknown }).data)) {
    return (raw as { data: RuleNodeComponentDescriptor[] }).data;
  }
  return [];
}

/** POST `/rule-chain/get-components` — palette items for the rule chain editor. */
export async function getRuleChainComponents(body: {
  component_types: string;
  rule_chain_type: string;
}): Promise<RuleNodeComponentDescriptor[]> {
  const data = await iotPost<unknown>(
    client,
    "/rule-chain/get-components",
    body,
    undefined,
    "Failed to load rule chain components",
  );
  return normalizeComponentsResponse(data);
}

/** Legacy GET `/components` (gateway); prefer {@link getRuleChainComponents}. */
export async function fetchRuleNodeComponents(ruleChainType = "CORE"): Promise<RuleNodeComponentDescriptor[]> {
  const q = new URLSearchParams({
    componentTypes: RULE_CHAIN_DEFAULT_COMPONENT_TYPES,
    ruleChainType,
  });
  return iotGet<RuleNodeComponentDescriptor[]>(
    client,
    `/components?${q}`,
    undefined,
    "Failed to load rule node components",
  );
}

/**
 * Rule-node event / debug log query.
 * POST `/rule-chain/get-event-telemetry`.
 */
export type RuleNodeEventsQuery = {
  rule_chain_id: string;
  tenant_id: string;
  node_id: string;
  start_time?: string | number;
  end_time?: string | number;
  page?: number;
  page_size?: number;
  event_type?: string;
};

export async function getRuleNodeEvents(payload: RuleNodeEventsQuery): Promise<unknown> {
  return iotPost<unknown>(
    client,
    "/rule-chain/get-event-telemetry",
    {
      rule_chain_id: payload.rule_chain_id,
      tenant_id: payload.tenant_id,
      node_id: payload.node_id,
      start_time: payload.start_time ?? "",
      end_time: payload.end_time ?? "",
      page_size: payload.page_size ?? 10,
      page: payload.page ?? 0,
      event_type: payload.event_type ?? "DEBUG_RULE_NODE",
    },
    undefined,
    "Failed to load rule node events",
  );
}
