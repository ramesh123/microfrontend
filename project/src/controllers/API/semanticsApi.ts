import { apiV2, API_V2_BASE_URL } from '@/controllers/API/api';
import {
  executeApiRequestSilent,
  rethrowApiError,
  throwIfApiErrorResponse,
  type ApiErrorResponse,
} from '@/utils/exceptionHelper';

async function v2Get<T>(
  url: string,
  config?: Parameters<typeof apiV2.get>[1],
  fallback = 'Request failed',
): Promise<T> {
  return executeApiRequestSilent<T>(() => apiV2.get<T>(url, config), fallback);
}

async function v2Post<T>(
  url: string,
  data?: unknown,
  config?: Parameters<typeof apiV2.post>[2],
  fallback = 'Request failed',
): Promise<T> {
  return executeApiRequestSilent<T>(() => apiV2.post<T>(url, data, config), fallback);
}

async function v2Patch<T>(
  url: string,
  data?: unknown,
  config?: Parameters<typeof apiV2.patch>[2],
  fallback = 'Request failed',
): Promise<T> {
  return executeApiRequestSilent<T>(() => apiV2.patch<T>(url, data, config), fallback);
}

async function v2Put<T>(
  url: string,
  data?: unknown,
  config?: Parameters<typeof apiV2.put>[2],
  fallback = 'Request failed',
): Promise<T> {
  return executeApiRequestSilent<T>(() => apiV2.put<T>(url, data, config), fallback);
}

async function v2Delete<T = unknown>(
  url: string,
  config?: Parameters<typeof apiV2.delete>[1],
  fallback = 'Request failed',
): Promise<T> {
  return executeApiRequestSilent<T>(() => apiV2.delete<T>(url, config), fallback);
}


// --- Types ---

export interface TenantListItem {
  tenant_id: string;
  display_name: string;
  status: string;
  domain_id: string | null;
}

export interface TenantListResponse {
  tenants: TenantListItem[];
  limit: number;
}

/** Response from GET /workspace/tenants - workspace-scoped tenant list */
export interface WorkspaceTenantItem {
  tenant_id: string;
  tenant_name?: string;
  display_name?: string;
  status?: string;
  domain_id?: string | null;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export type WorkspaceTenantsResponse = WorkspaceTenantItem[] | { tenants: WorkspaceTenantItem[] };

/** Domain from GET /workspace/tenants/{tenant_id}/domains */
export interface WorkspaceDomainItem {
  domain_id: string;
  display_name?: string;
  scan_status?: string;
  deployment_status?: string;
  current_run_id?: string | null;
  current_run_display_name?: string | null;
  last_scan_id?: string | null;
  last_scanned_at?: string | null;
  tables_detected?: number;
  [key: string]: unknown;
}

export interface WorkspaceTenantDomainsResponse {
  tenant_id: string;
  domains: WorkspaceDomainItem[];
}

/** Conversation from GET .../domains/{domain_id}/conversations */
export interface WorkspaceConversationItem {
  conversation_id: string;
  title?: string | null;
  display_name?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export type WorkspaceConversationsResponse =
  | WorkspaceConversationItem[]
  | { conversations: WorkspaceConversationItem[] };

/** Message in GET /workspace/conversations/{conversation_id}/messages */
export interface WorkspaceMessageItem {
  message_id?: string;
  conversation_id?: string;
  tenant_id?: string;
  domain_id?: string;
  run_id?: string | null;
  sender?: 'user' | 'assistant' | string;
  message_text?: string | null;
  sql_text?: string | null;
  data_json?: unknown;
  chart_json?: unknown;
  inference_json?: unknown;
  summary_json?: unknown;
  created_at?: string;
  /** Legacy/alias */
  role?: 'user' | 'assistant' | string;
  content?: string;
  [key: string]: unknown;
}

/** Response shape: GET /workspace/conversations/{conversation_id}/messages */
export interface WorkspaceConversationMessagesResponse {
  conversation_id: string;
  messages: WorkspaceMessageItem[];
  paging?: {
    limit: number;
    cursor: string | null;
    returned: number;
    has_more: boolean;
    next_cursor: string | null;
  };
}

export type WorkspaceMessagesResponse =
  | WorkspaceMessageItem[]
  | WorkspaceConversationMessagesResponse;

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

/**
 * Maps workspace agent `response` JSON (chart_id, rows, chart_payload, sql, …) to the
 * `chart_json` shape expected by chart UI: `{ data, chart_type, chart_title, chart_payload, … }`.
 */
export function workspaceChartResponseToChartJson(
  resp: Record<string, unknown>,
): Record<string, unknown> | null {
  const data =
    Array.isArray(resp.data)
      ? resp.data
      : Array.isArray(resp.rows)
        ? resp.rows
        : null;
  if (data === null) return null;
  const out: Record<string, unknown> = {
    chart_id: resp.chart_id,
    chart_type: resp.chart_type,
    chart_title: resp.chart_title,
    data,
  };
  if (isRecord(resp.chart_payload)) out.chart_payload = resp.chart_payload;
  if (typeof resp.sql === 'string') out.sql = resp.sql;
  if (Array.isArray(resp.metrics)) out.metrics = resp.metrics;
  if (Array.isArray(resp.dimensions)) out.dimensions = resp.dimensions;
  return out;
}

/** POST body: `{ conversation_id, message_id, response: { … }, context_used }` with no `messages` array. */
function assistantMessagesFromEnvelopeResponse(raw: Record<string, unknown>): WorkspaceMessageItem[] {
  const resp = raw.response;
  if (!isRecord(resp)) return [];
  const chart_json = workspaceChartResponseToChartJson(resp);
  if (!chart_json) return [];
  return [
    {
      message_id: typeof raw.message_id === 'string' ? raw.message_id : undefined,
      conversation_id: typeof raw.conversation_id === 'string' ? raw.conversation_id : undefined,
      sender: 'assistant',
      role: 'assistant',
      chart_json,
      sql_text: typeof resp.sql === 'string' ? resp.sql : undefined,
    } as WorkspaceMessageItem,
  ];
}

/**
 * Flattens API variants into a linear list of messages:
 * - `{ messages: [...] }` with flat or nested turns
 * - `{ user_message, assistant_message }` (single turn; chart_json on assistant)
 * - `{ conversation_id, message_id, response, context_used }` — chart rows + amCharts payload on `response`
 * - `[ ... ]` array of flat or nested turns
 * Nested turns use `user_message` / `assistant_message` objects.
 * Normalizes sender/role to lowercase `user` | `assistant` for chart update logic.
 */
export function normalizeWorkspaceApiMessages(raw: unknown): WorkspaceMessageItem[] {
  if (raw == null) return [];

  if (Array.isArray(raw)) {
    return expandWorkspaceMessageList(raw);
  }

  if (!isRecord(raw)) return [];

  if (Array.isArray(raw.messages) && raw.messages.length > 0) {
    return expandWorkspaceMessageList(raw.messages);
  }

  const fromEnvelope = assistantMessagesFromEnvelopeResponse(raw);
  if (fromEnvelope.length > 0) {
    return fromEnvelope;
  }

  if (raw.user_message != null || raw.assistant_message != null) {
    const out: WorkspaceMessageItem[] = [];
    if (isRecord(raw.user_message)) {
      out.push(flattenWorkspaceMessageRecord(raw.user_message, 'user'));
    }
    if (isRecord(raw.assistant_message)) {
      out.push(flattenWorkspaceMessageRecord(raw.assistant_message, 'assistant'));
    }
    return out;
  }

  return [];
}

function flattenWorkspaceMessageRecord(
  m: Record<string, unknown>,
  defaultRole: 'user' | 'assistant',
): WorkspaceMessageItem {
  const senderRaw = m.sender ?? m.role ?? defaultRole;
  const s = typeof senderRaw === 'string' ? senderRaw.toLowerCase().trim() : defaultRole;
  const normalizedRole: 'user' | 'assistant' =
    s === 'assistant' ? 'assistant' : s === 'user' ? 'user' : defaultRole;
  return {
    ...m,
    sender: normalizedRole,
    role: normalizedRole,
  } as WorkspaceMessageItem;
}

function expandWorkspaceMessageList(items: unknown[]): WorkspaceMessageItem[] {
  const out: WorkspaceMessageItem[] = [];
  for (const item of items) {
    if (!isRecord(item)) continue;
    if (item.user_message != null || item.assistant_message != null) {
      if (isRecord(item.user_message)) {
        out.push(flattenWorkspaceMessageRecord(item.user_message, 'user'));
      }
      if (isRecord(item.assistant_message)) {
        out.push(flattenWorkspaceMessageRecord(item.assistant_message, 'assistant'));
      }
      continue;
    }
    const sr = String(item.sender ?? item.role ?? '').toLowerCase().trim();
    const inferred: 'user' | 'assistant' = sr === 'assistant' ? 'assistant' : 'user';
    out.push(flattenWorkspaceMessageRecord(item, inferred));
  }
  return out;
}

export interface CreateTenantPayload {
  tenant_id: string;
  display_name: string;
  domain_id?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateTenantResponse {
  tenant_id: string;
  display_name: string;
  status: string;
  domain_id: string | null;
}

export interface TenantDomainResponse {
  tenant_id: string;
  domain_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

/** Catalog entry from GET /packs (domains available to attach to a tenant). */
export interface PackListItem {
  /** Primary id from API — sent as `domain_id` in POST /tenant/domain. */
  industry?: string;
  domain_id?: string;
  pack_id?: string;
  id?: string;
  display_name?: string;
  name?: string;
  version?: string | number | null;
  release_date?: string | null;
  notes?: string | null;
  [key: string]: unknown;
}

/** Turn e.g. `retail_fuel_monitoring` into "Retail fuel monitoring" for UI. */
export function formatIndustrySlugForDisplay(slug: string): string {
  const s = slug.trim();
  if (!s) return s;
  return s
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function normalizePacksResponse(raw: unknown): PackListItem[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw as PackListItem[];
  if (typeof raw === 'object' && raw !== null) {
    const o = raw as Record<string, unknown>;
    for (const key of ['packs', 'domains', 'items']) {
      const v = o[key];
      if (Array.isArray(v)) return v as PackListItem[];
    }
  }
  return [];
}

/** Stable id for POST /tenant/domain (`industry` from GET /packs, or legacy fields). */
export function packItemDomainId(p: PackListItem): string | null {
  const id =
    (typeof p.domain_id === 'string' && p.domain_id) ||
    (typeof p.industry === 'string' && p.industry) ||
    (typeof p.pack_id === 'string' && p.pack_id) ||
    (typeof p.id === 'string' && p.id);
  return id || null;
}

export async function fetchPacks(): Promise<PackListItem[]> {
  const data = await v2Get<unknown>('/packs');
  return normalizePacksResponse(data);
}

/** Link tenant to a domain (POST /tenant/domain). */
export async function postTenantDomain(tenantId: string, domainId: string): Promise<TenantDomainResponse> {
  const data = await v2Post<TenantDomainResponse>('/tenant/domain', {
    tenant_id: tenantId,
    domain_id: domainId,
  });
  return data;
}

// --- API Calls ---

export async function fetchTenants(limit = 200): Promise<TenantListResponse> {
  const data = await v2Get<TenantListResponse>('/tenants', {
    params: { limit },
  });
  return data;
}

/** Fetch tenants for the current workspace (GET /workspace/tenants) */
export async function fetchWorkspaceTenants(limit = 200): Promise<TenantListItem[]> {
  const data = await v2Get<WorkspaceTenantsResponse>('/workspace/tenants', {
    params: { limit },
  });
  const raw = Array.isArray(data) ? data : (data as { tenants: WorkspaceTenantItem[] }).tenants ?? [];
  return raw.map((t) => ({
    tenant_id: t.tenant_id,
    display_name: t.tenant_name ?? t.display_name ?? t.tenant_id,
    status: t.status ?? 'active',
    domain_id: t.domain_id ?? null,
  }));
}

/** Fetch domains for a tenant (GET /workspace/tenants/{tenant_id}/domains) */
export async function fetchTenantDomains(tenantId: string): Promise<WorkspaceTenantDomainsResponse> {
  return v2Get<WorkspaceTenantDomainsResponse>(
    `/workspace/tenants/${tenantId}/domains`,
    undefined,
    'Failed to fetch tenant domains',
  );
}

/** Schema payload for POST /workspace/deployments (snake_case). */
export interface WorkspaceDeploymentSchemaPayload {
  connection_id: string;
  database: string;
  schemas: { name: string; tables: string[] }[];
}

/** Start or trigger deployment (POST /workspace/deployments). schema_payload required for initial build. */
export interface PostWorkspaceDeploymentPayload {
  tenant_id: string;
  domain_id: string;
  schema_payload?: WorkspaceDeploymentSchemaPayload;
  /** Business / semantic context for the deployment (matches API contract). */
  context_text?: string;
  /** e.g. "full" for full semantic build */
  mode?: string;
}

export async function postWorkspaceDeployment(payload: PostWorkspaceDeploymentPayload): Promise<{ run_id?: string; status?: string }> {
  const data = await v2Post<{ run_id?: string; status?: string }>('/workspace/deployments', payload);
  return data;
}

/** Fetch tenant-wide conversations (GET /workspace/tenants/{tenant_id}/conversations) — call on tenant select */
export async function fetchTenantConversations(tenantId: string): Promise<WorkspaceConversationItem[]> {
  const data = await v2Get<WorkspaceConversationsResponse>(
    `/workspace/tenants/${tenantId}/conversations`
  );
  const raw = Array.isArray(data) ? data : (data as { conversations: WorkspaceConversationItem[] }).conversations ?? [];
  return raw;
}

/** Fetch conversations for a tenant+domain (GET /workspace/tenants/{tenant_id}/domains/{domain_id}/conversations) */
export async function fetchDomainConversations(
  tenantId: string,
  domainId: string
): Promise<WorkspaceConversationItem[]> {
  const data = await v2Get<WorkspaceConversationsResponse>(
    `/workspace/tenants/${tenantId}/domains/${domainId}/conversations`
  );
  const raw = Array.isArray(data) ? data : (data as { conversations: WorkspaceConversationItem[] }).conversations ?? [];
  return raw;
}

/** Create conversation (POST /workspace/tenants/{tenant_id}/domains/{domain_id}/conversations). Body includes user_query, tenant_id, domain_id. */
export async function createWorkspaceConversation(
  tenantId: string,
  domainId: string,
  payload: {
    // user_query: string;
    run_id?: string | null;
    source_chart_id?: string | null;
  },
): Promise<{ conversation_id: string; [key: string]: unknown }> {
  const body: Record<string, unknown> = {
    // user_query: payload.user_query,
    tenant_id: tenantId,
    domain_id: domainId,
  };
  if (payload.run_id != null && String(payload.run_id).trim() !== '') {
    body.run_id = payload.run_id;
  }
  if (payload.source_chart_id != null && String(payload.source_chart_id).trim() !== '') {
    body.source_chart_id = payload.source_chart_id;
  }
  const data = await v2Post<{ conversation_id: string; [key: string]: unknown }>(
    `/workspace/tenants/${tenantId}/domains/${domainId}/conversations`,
    body,
  );
  return data;
}

/**
 * GET /charts/{chart_id}/conversations — resolve the workspace conversation tied to a chart (if any).
 * Sends chart_id in the request params as required by the API.
 * Response shape may vary; we normalize to a single conversation_id when present.
 */
export async function fetchChartConversationId(chartId: string): Promise<string | null> {
  const data = await v2Get<unknown>(`/charts/${encodeURIComponent(chartId)}/conversations`, {
    params: { chart_id: chartId },
  });
  if (data == null) return null;
  if (typeof data === 'string' && data.trim() !== '') return data.trim();
  if (typeof data !== 'object' || Array.isArray(data)) return null;
  const o = data as Record<string, unknown>;
  const direct =
    o.conversation_id ?? o.conversationId ?? o.id;
  if (typeof direct === 'string' && direct.trim() !== '') return direct.trim();
  const convs = o.conversations;
  if (Array.isArray(convs) && convs.length > 0) {
    const first = convs[0];
    if (first && typeof first === 'object' && !Array.isArray(first)) {
      const c = first as Record<string, unknown>;
      const id = c.conversation_id ?? c.conversationId ?? c.id;
      if (typeof id === 'string' && id.trim() !== '') return id.trim();
    }
  }
  return null;
}

function normalizeWorkspaceConversationItem(raw: unknown): WorkspaceConversationItem | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const id = o.conversation_id ?? o.conversationId ?? o.id;
  if (typeof id !== 'string' || !id.trim()) return null;
  return { ...o, conversation_id: id.trim() } as WorkspaceConversationItem;
}

/**
 * GET /charts/{chart_id}/conversations — all workspace threads tied to this chart (when the API returns a list).
 */
export async function fetchChartConversationsList(chartId: string): Promise<WorkspaceConversationItem[]> {
  const data = await v2Get<unknown>(`/charts/${encodeURIComponent(chartId)}/conversations`, {
    params: { chart_id: chartId },
  });
  if (data == null) return [];
  if (Array.isArray(data)) {
    return data.map(normalizeWorkspaceConversationItem).filter(Boolean) as WorkspaceConversationItem[];
  }
  if (typeof data === 'string' && data.trim() !== '') {
    return [{ conversation_id: data.trim() }];
  }
  if (typeof data !== 'object' || Array.isArray(data)) return [];
  const o = data as Record<string, unknown>;
  const convs = o.conversations;
  if (Array.isArray(convs)) {
    return convs.map(normalizeWorkspaceConversationItem).filter(Boolean) as WorkspaceConversationItem[];
  }
  const direct = o.conversation_id ?? o.conversationId ?? o.id;
  if (typeof direct === 'string' && direct.trim() !== '') {
    const one = normalizeWorkspaceConversationItem(data);
    return one ? [one] : [];
  }
  return [];
}

/** Fetch conversation messages (GET /workspace/conversations/{conversation_id}/messages) */
export async function fetchConversationMessages(
  conversationId: string
): Promise<WorkspaceMessageItem[]> {
  const full = await fetchConversationMessagesWithMeta(conversationId);
  return full.messages;
}

/** Same as GET messages; includes conversation_id from body-shaped API responses. */
export async function fetchConversationMessagesWithMeta(conversationId: string): Promise<{
  conversation_id: string;
  messages: WorkspaceMessageItem[];
  paging?: WorkspaceConversationMessagesResponse['paging'];
}> {
  const data = await v2Get<WorkspaceMessagesResponse>(
    `/workspace/conversations/${conversationId}/messages`,
    { params: { conversation_id: conversationId } }
  );
  const messages = normalizeWorkspaceApiMessages(data);
  if (Array.isArray(data)) {
    return { conversation_id: conversationId, messages };
  }
  const obj = data as WorkspaceConversationMessagesResponse & Record<string, unknown>;
  return {
    conversation_id: obj?.conversation_id ?? conversationId,
    messages,
    paging: obj?.paging,
  };
}

/** Delete a workspace conversation (DELETE /workspace/conversations/{conversation_id}). */
export async function deleteWorkspaceConversation(conversationId: string): Promise<void> {
  await v2Delete(`/workspace/conversations/${conversationId}`, {
    params: { conversation_id: conversationId },
  });
}

/** List / refresh conversation messages via POST /workspace/conversations/{conversation_id}/messages. */
export async function postWorkspaceConversationMessagesList(
  conversationId: string,
  userQuery: string,
  opts?: {
    chart_id?: string | null;
    selected_category?: string | null;
    /** First message in a thread: false; follow-ups: true. Defaults to true if omitted. */
    resume_context?: boolean;
  },
): Promise<{
  conversation_id: string;
  messages: WorkspaceMessageItem[];
  paging?: WorkspaceConversationMessagesResponse['paging'];
}> {
  const body: Record<string, unknown> = {
    // conversation_id: conversationId,
    user_query: userQuery,
    resume_context: opts?.resume_context ?? true,
    stream: false,
  };
  if (opts?.chart_id != null && String(opts.chart_id).trim() !== '') {
    body.chart_id = opts.chart_id;
  }
  if (opts?.selected_category != null && String(opts.selected_category).trim() !== '') {
    body.selected_category = String(opts.selected_category).trim();
  }
  const data = await v2Post<WorkspaceMessagesResponse>(
    `/workspace/conversations/${conversationId}/messages`,
    body,
  );
  const messages = normalizeWorkspaceApiMessages(data);
  if (Array.isArray(data)) {
    return { conversation_id: conversationId, messages };
  }
  const obj = data as WorkspaceConversationMessagesResponse & Record<string, unknown>;
  return {
    conversation_id: obj?.conversation_id ?? conversationId,
    messages,
    paging: obj?.paging,
  };
}

/** POST /workspace/conversations/{conversation_id}/messages with user_query and stream=true. Returns raw Response for SSE reading. */
export function postConversationMessageStream(
  conversationId: string,
  payload: { user_query: string; stream?: boolean; resume_context?: boolean }
): Promise<Response> {
  const url = `${API_V2_BASE_URL}/workspace/conversations/${conversationId}/messages`;
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, stream: true }),
    credentials: 'include',
  });
}

/** Deployment status for polling (GET /workspace/tenants/{tenant_id}/domains/{domain_id}/deployment-status) */
export interface DeploymentStatusResponse {
  deployment_status?: string;
  run_id?: string | null;
  [key: string]: unknown;
}

export async function getDeploymentStatus(
  tenantId: string,
  domainId: string
): Promise<DeploymentStatusResponse> {
  const data = await v2Get<DeploymentStatusResponse>(
    `/workspace/tenants/${tenantId}/domains/${domainId}/deployment-status`
  );
  return data;
}

/** Single deployment item from GET /workspace/deployments */
export interface WorkspaceDeploymentItem {
  run_id: string;
  tenant_id: string;
  domain_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  is_canonical?: boolean;
  version_no?: number;
  display_name?: string | null;
  superseded_by_run_id?: string | null;
  completed_at?: string | null;
  [key: string]: unknown;
}

/** Response from GET /workspace/deployments?tenant_id=&domain_id=&limit= */
export interface WorkspaceDeploymentsResponse {
  tenant_id: string;
  domain_id: string;
  deployments: WorkspaceDeploymentItem[];
}

export async function fetchWorkspaceDeployments(
  tenantId: string,
  domainId: string,
  limit = 50
): Promise<WorkspaceDeploymentsResponse> {
  const data = await v2Get<WorkspaceDeploymentsResponse>('/workspace/deployments', {
    params: { tenant_id: tenantId, domain_id: domainId, limit },
  });
  return data;
}

/** POST /workspace/deployments/{run_id}/rerun — triggers a new deployment run (e.g. monitor trend mode). */
export async function rerunWorkspaceDeployment(
  runId: string
): Promise<{ run_id?: string; status?: string; [key: string]: unknown }> {
  const data = await v2Post<{ run_id?: string; status?: string; [key: string]: unknown }>(
    `/workspace/deployments/${encodeURIComponent(runId)}/rerun`,
    { trend_mode: 'monitor' }
  );
  return data;
}

export async function createTenant(payload: CreateTenantPayload): Promise<CreateTenantResponse> {
  const data = await v2Post<CreateTenantResponse>('/tenants', payload);
  return data;
}

/** PATCH /api/v2/tenants/{tenant_id} — body includes tenant_id and display_name */
export interface UpdateTenantPayload {
  tenant_id: string;
  display_name: string;
}

export async function updateTenant(
  tenantId: string,
  payload: UpdateTenantPayload
): Promise<CreateTenantResponse> {
  const data = await v2Patch<CreateTenantResponse>(`/tenants/${tenantId}`, payload);
  return data;
}

export async function fetchTenantDomain(tenantId: string): Promise<TenantDomainResponse> {
  const data = await v2Get<TenantDomainResponse>('/tenant/domain', {
    params: { tenant_id: tenantId },
  });
  return data;
}

// --- Config View GET APIs ---

export interface TenantScopeResponse {
  tenant_id: string;
  domain_id: string;
  connection_id: string;
  database: string;
  schema: string;
  tables: string[];
  status: string;
}

export async function fetchTenantScope(tenantId: string): Promise<TenantScopeResponse> {
  const data = await v2Get<TenantScopeResponse>('/tenant/scope', {
    params: { tenant_id: tenantId },
  });
  return data;
}

export interface ContextExtractionFile {
  file_id: string;
  filename: string;
  content_type: string;
  metadata: {
    source_type?: string;
    source_title?: string;
  };
  created_at: string;
}

export interface ContextExtraction {
  extraction_id: string;
  context_id: string;
  extraction_type: string;
  payload: Record<string, unknown>;
  raw_text: string;
  files: ContextExtractionFile[];
  status: string | null;
  notes: string | null;
  created_at: string;
}

export interface ContextExtractionsResponse {
  extractions: ContextExtraction[];
}

export async function fetchContextExtractions(tenantId: string): Promise<ContextExtractionsResponse> {
  const data = await v2Get<ContextExtractionsResponse>('/context/extractions', {
    params: { tenant_id: tenantId },
  });
  return data;
}

export interface EntityMappingCandidate {
  table: string;
  column: string;
  confidence: number;
  mapped_entity_type: string;
  source?: string;
}

export interface EntityMappingAgent {
  agent_run_id: string;
  job_id: string;
  mapping_id: string;
  tenant_id: string;
  domain_id: string;
  connection_id: string;
  database_name: string;
  schema_name: string;
  table_name: string;
  chunk_index: number;
  chunk_label: string;
  request_payload: Record<string, unknown>;
  response_payload: {
    candidates: EntityMappingCandidate[];
  };
  error_message: string | null;
  created_at: string;
}

export interface EntityMappingAgentsResponse {
  agents: EntityMappingAgent[];
}

export async function fetchEntityMappingAgents(tenantId: string): Promise<EntityMappingAgentsResponse> {
  const data = await v2Get<EntityMappingAgentsResponse>('/onboard/map/agents', {
    params: { tenant_id: tenantId },
  });
  return data;
}

export interface SemanticsDimensionRecord {
  dimension_id?: string;
  id?: string;
  name?: string;
  keys?: unknown[];
  attributes?: unknown[];
  confidence?: number;
  [key: string]: unknown;
}

export interface SemanticsFactRecord {
  fact_id?: string;
  id?: string;
  table_name?: string;
  name?: string;
  grain?: string;
  time_column?: string;
  measures?: unknown[];
  [key: string]: unknown;
}

export interface SemanticsMetricRecord {
  metric_id?: string;
  metric_name?: string;
  type?: string;
  sql?: string;
  grain?: string;
  dimensions?: unknown[];
  tables?: unknown[];
  status?: string;
  confidence?: number;
  description?: string;
  connection_id?: string;
  database?: string;
  schema?: string;
  [key: string]: unknown;
}

export interface DimensionsListResponse {
  dimensions?: SemanticsDimensionRecord[];
}

export interface FactsListResponse {
  facts?: SemanticsFactRecord[];
}

export interface MetricsListResponse {
  metrics?: SemanticsMetricRecord[];
}

export interface JobResultResponse {
  result?: {
    mapping_id?: string;
    candidates?: EntityMappingCandidate[];
    [key: string]: unknown;
  };
}

export async function fetchDimensions(tenantId: string): Promise<DimensionsListResponse> {
  return v2Get<DimensionsListResponse>(
    '/dimensions',
    { params: { tenant_id: tenantId } },
    'Failed to fetch dimensions',
  );
}

export async function fetchFacts(tenantId: string): Promise<FactsListResponse> {
  return v2Get<FactsListResponse>(
    '/facts',
    { params: { tenant_id: tenantId } },
    'Failed to fetch facts',
  );
}

export async function fetchMetricsApi(tenantId: string): Promise<MetricsListResponse> {
  return v2Get<MetricsListResponse>(
    '/metrics',
    { params: { tenant_id: tenantId } },
    'Failed to fetch metrics',
  );
}

export async function fetchReviewSummary(tenantId: string) {
  return v2Get('/review/summary', { params: { tenant_id: tenantId } }, 'Failed to fetch review summary');
}

// --- Additional GET APIs ---

/** Domain from GET /context/domains (catalog for tenant creation). */
export interface ContextDomainItem {
  domain_id: string;
  display_name?: string;
  [key: string]: unknown;
}

export interface ContextDomainsResponse {
  domains?: ContextDomainItem[];
}

export async function fetchDomains(): Promise<ContextDomainsResponse> {
  return v2Get<ContextDomainsResponse>(
    '/context/domains',
    undefined,
    'Failed to fetch domains',
  );
}

export async function fetchHierarchies(tenantId: string) {
  return v2Get('/hierarchies', { params: { tenant_id: tenantId } }, 'Failed to fetch hierarchies');
}

export async function fetchJobResult(jobId: string): Promise<JobResultResponse> {
  return v2Get<JobResultResponse>(
    `/jobs/${jobId}/result`,
    undefined,
    'Failed to fetch job result',
  );
}

/** POST /onboard/scan-connection/async — returns HTTP status (e.g. 202) and body (job_id when accepted). */
export async function postOnboardScanConnectionAsync(
  payload: Record<string, unknown>,
): Promise<{ httpStatus: number; data: Record<string, unknown> }> {
  try {
    const res = await apiV2.post<Record<string, unknown>>(
      '/onboard/scan-connection/async',
      payload,
    );
    throwIfApiErrorResponse(res.data as ApiErrorResponse, 'Schema scan failed');
    return { httpStatus: res.status, data: res.data ?? {} };
  } catch (error) {
    return rethrowApiError(error, 'Schema scan failed');
  }
}

// --- Tenant delete API ---
export async function deleteTenant(tenantId: string, purge: boolean = true) {
  return v2Delete(`/tenants/${tenantId}`, {
    params: { purge: purge },
  }, 'Failed to delete tenant');
}
// --- Certification APIs ---

export async function certifyMetric(tenantId: string, metricId: string) {
  return v2Post('/metrics/certify', { tenant_id: tenantId, metric_id: metricId }, undefined, 'Failed to certify metric');
}

export async function certifyFact(tenantId: string, factId: string) {
  return v2Post('/facts/certify', { tenant_id: tenantId, fact_id: factId }, undefined, 'Failed to certify fact');
}

export async function certifyDimension(tenantId: string, dimensionId: string) {
  return v2Post('/dimensions/certify', { tenant_id: tenantId, dimension_id: dimensionId }, undefined, 'Failed to certify dimension');
}

export async function certifyHierarchy(tenantId: string, hierarchyName: string) {
  return v2Post('/hierarchies/certify', { tenant_id: tenantId, hierarchy_name: hierarchyName }, undefined, 'Failed to certify hierarchy');
}

export async function certifyEntity(tenantId: string, entityId: string) {
  return v2Post('/entities/certify', { tenant_id: tenantId, entity_id: entityId }, undefined, 'Failed to certify entity');
}

export async function certifyGlossaryTerm(tenantId: string, termId: string) {
  return v2Post('/glossary/certify', { tenant_id: tenantId, term_id: termId }, undefined, 'Failed to certify glossary term');
}

// --- Certify All (bulk) APIs — pass only tenant_id to certify all items of that type ---

export async function certifyAllMetrics(tenantId: string) {
  return v2Post('/metrics/certify', { tenant_id: tenantId }, undefined, 'Failed to certify metrics');
}

export async function certifyAllFacts(tenantId: string) {
  return v2Post('/facts/certify', { tenant_id: tenantId }, undefined, 'Failed to certify facts');
}

export async function certifyAllDimensions(tenantId: string) {
  return v2Post('/dimensions/certify', { tenant_id: tenantId }, undefined, 'Failed to certify dimensions');
}

export async function certifyAllHierarchies(tenantId: string) {
  return v2Post('/hierarchies/certify', { tenant_id: tenantId }, undefined, 'Failed to certify hierarchies');
}

export async function certifyAllEntities(tenantId: string) {
  return v2Post('/entities/certify', { tenant_id: tenantId }, undefined, 'Failed to certify entities');
}

export async function certifyAllGlossary(tenantId: string) {
  return v2Post('/glossary/certify', { tenant_id: tenantId }, undefined, 'Failed to certify glossary');
}
