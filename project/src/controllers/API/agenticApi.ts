import { apiV2, API_V2_BASE_URL } from '@/controllers/API/api';
import { executeApiRequestSilent } from '@/utils/exceptionHelper';

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


// ─── Types: POST /tenant/scope ───────────────────────────────────────────────

export interface SetTenantScopePayload {
  tenant_id: string;
  domain_id: string;
  connection_id: string;
  database: string;
  schema: string;
  tables?: string[];
  /** Optional context for this tenant scope (API key: context_text). */
  context_text?: string;
}

// ─── Types: POST /agentic/runs ───────────────────────────────────────────────

export interface StartAgenticRunPayload {
  tenant_id: string;
  domain_id: string;
  mode: 'full' | string;
}

export interface StartAgenticRunResponse {
  run_id: string;
  status: string;
  job_id: string;
}

// ─── Types: SSE event from /agentic/runs/{run_id}/stream ─────────────────────

export interface AgenticRunEvent {
  event_id: string;
  run_id: string;
  agent_name: string;
  status: 'started' | 'running' | 'completed' | 'failed' | 'stream' | string;
  message: string;
  artifacts: Record<string, unknown> | null;
  created_at: string;
}

// ─── Types: GET /agentic/runs/{run_id}/events ────────────────────────────────

export interface AgenticRunEventsResponse {
  events: AgenticRunEvent[];
}

// ─── Types: POST /chat ───────────────────────────────────────────────────────

export interface ChatQueryPayload {
  question: string;
  tenant_id: string;
  domain_id?: string;
  mode?: 'sync' | 'async';
}

export interface ChatSyncResponseData {
  metrics?: string[];
  dimensions?: string[];
  sql?: string;
  rows?: Record<string, unknown>[];
  chart_id?: string | null;
  chart_type?: string | null;
  chart_payload?: Record<string, unknown> | null;
  data?: Record<string, unknown>[] | null;
}

export interface ChatSyncResponse {
  chat_id: string | null;
  status: 'complete';
  response: ChatSyncResponseData;
  error_message: string | null;
}

export interface ChatAsyncResponse {
  chat_id: string;
  status: 'queued';
  response: null;
  error_message: string | null;
}

export type ChatResponse = ChatSyncResponse | ChatAsyncResponse;

// ─── Types: GET /dashboards & GET /dashboards/ ─────────────────────────────

export interface ChartPlanItem {
  type: string;
  table: string;
  intent: string;
  metric: string;
  time_column: string;
  metric_column: string;
  category_column: string | null;
}

export interface DashboardItem {
  dashboard_id: string;
  tenant_id: string;
  domain_id: string;
  title: string;
  name?: string;
  /** When `"system"`, dashboard is read-only for delete; `"user"` allows delete. */
  dashboard_type?: string | null;
  chart_count?: number;
  latest_agentic_run_id?: string | null;
  latest_refresh_id?: string | null;
  created_at: string | null;
  chart_plan: ChartPlanItem[];
}

export interface DashboardsListResponse {
  dashboards: DashboardItem[];
}

// ─── Types: GET /dashboards/{dashboard_id} ───────────────────────────────────

export interface DashboardChartSpec {
  sql?: string;
  type?: string;
  chart_type?: string;
  stats?: { avg?: number; max?: number; min?: number; count?: number; total?: number };
  table?: string;
  intent?: string;
  metric?: string;
  insight?: { type?: string; value?: number; summary?: string };
  chart_id?: string;
  narrative?: { top?: string; bottom?: string; summary?: string };
  chart_data?: Array<Record<string, unknown>>;
  dimensions?: string[];
  rows_count?: number;
  metric_name?: string;
  time_column?: string;
  chart_payload?: Record<string, unknown>;
  metric_column?: string;
  category_column?: string | null;
  title?: string;
  chart_title?: string;
  dashboard_title?: string;
  insight_text?: string;
  narrative_text?: string;
  /** Links to workspace chat threads for this chart row */
  conversation_ids?: string[];
}

export interface DashboardSpecStoryCard {
  title: string;
  summary: string;
}

export interface DashboardSpec {
  story?: { cards?: DashboardSpecStoryCard[]; title?: string };
  title?: string;
  charts?: DashboardChartSpec[];
}

/** Chart row returned on GET /dashboards/{id} when charts are embedded on the dashboard object. */
export interface DashboardEmbeddedChart {
  entry_id?: string;
  chart_id: string;
  position?: number;
  title_override?: string | null;
  title?: string;
  chart_type?: string;
  chart_source?: string;
  status?: string;
  /** SQL used to build chart_data (shown on Query tab). */
  sql?: string | null;
  chart_payload?: Record<string, unknown>;
  chart_data?: Array<Record<string, unknown>>;
  insight_text?: string | null;
  narrative_text?: string | null;
  /** Workspace chat threads linked to this chart (GET /dashboards/{id} `charts[]`). */
  conversation_ids?: string[];
}

export interface DashboardByIdResponse {
  dashboard_id: string;
  tenant_id: string;
  domain_id: string;
  title: string;
  dashboard_type?: string | null;
  spec?: DashboardSpec;
  /** New API shape: charts with inline chart_data (same dashboard also exposes spec in some builds). */
  charts?: DashboardEmbeddedChart[];
  /**
   * Data-quality dashboards: array of chart definitions with `rows`, `chart_key`, `chart_type`, etc.
   * (Distinct from list-item {@link ChartPlanItem} metric intents — detected at runtime by `chart_key` + `rows`.)
   */
  chart_plan?: unknown[];
}

/**
 * Table tab and {@link ChartDetail.chart_data} use top-level `chart_data`. Correlation (and similar)
 * dashboards often send rows only in `chart_payload.data` with `chart_data: []`.
 */
export function coerceDashboardChartDataRows(spec: {
  chart_data?: Array<Record<string, unknown>>;
  chart_type?: string;
  type?: string;
  chart_payload?: Record<string, unknown> | null | undefined;
}): Array<Record<string, unknown>> {
  const direct = spec.chart_data ?? [];
  if (direct.length > 0) return direct;
  const p = spec.chart_payload;
  if (p && Array.isArray(p.data) && p.data.length > 0) {
    return p.data as Array<Record<string, unknown>>;
  }
  const ct = (spec.chart_type ?? spec.type ?? "").toLowerCase();
  if (ct.includes("scatter_regression") && p && Array.isArray(p.scatter_data) && p.scatter_data.length > 0) {
    return p.scatter_data as Array<Record<string, unknown>>;
  }
  return [];
}

/**
 * Prefer top-level `insight_text` / `narrative_text`; some correlation payloads nest copies under
 * `chart_payload` only.
 */
function firstNonEmptyString(
  ...candidates: Array<string | null | undefined>
): string | undefined {
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return undefined;
}

export function coerceDashboardInsightNarrative(spec: {
  insight_text?: string | null;
  narrative_text?: string | null;
  chart_payload?: Record<string, unknown> | null | undefined;
}): { insight_text?: string; narrative_text?: string } {
  const p = spec.chart_payload;
  const insight = firstNonEmptyString(
    spec.insight_text ?? undefined,
    p && typeof p.insight_text === "string" ? p.insight_text : undefined,
  );
  const narrative = firstNonEmptyString(
    spec.narrative_text ?? undefined,
    p && typeof p.narrative_text === "string" ? p.narrative_text : undefined,
  );
  const out: { insight_text?: string; narrative_text?: string } = {};
  if (insight) out.insight_text = insight;
  if (narrative) out.narrative_text = narrative;
  return out;
}

function embeddedChartToSpec(entry: DashboardEmbeddedChart): DashboardChartSpec {
  const rows = coerceDashboardChartDataRows({
    chart_data: entry.chart_data,
    chart_type: entry.chart_type,
    type: entry.chart_type,
    chart_payload: entry.chart_payload,
  });
  const first = rows[0] as Record<string, unknown> | undefined;
  const payloadSeries = entry.chart_payload?.series;
  const series0 =
    Array.isArray(payloadSeries) && payloadSeries.length > 0
      ? (payloadSeries[0] as Record<string, unknown>)
      : undefined;

  const cp = entry.chart_payload as { metric?: string } | undefined;
  let metric_name =
    (typeof series0?.name === 'string' && series0.name) ||
    (typeof cp?.metric === 'string' && cp.metric) ||
    '';

  if (!metric_name && first) {
    const keys = Object.keys(first);
    const numericKey = keys.find(
      (k) => k !== 'date' && k !== 'category' && k !== 'period' && typeof first[k] === 'number',
    );
    metric_name = numericKey ?? 'value';
  }
  if (!metric_name) metric_name = 'Metric';

  let category_column: string | null = null;
  if (typeof series0?.nameField === 'string') {
    category_column = series0.nameField;
  } else if (first && typeof first.category === 'string') {
    category_column = 'category';
  } else if (first) {
    for (const k of ['region', 'zone', 'zone_name']) {
      if (k in first && first[k] != null && k !== metric_name) {
        category_column = k;
        break;
      }
    }
  }

  const convIds = Array.isArray(entry.conversation_ids)
    ? entry.conversation_ids.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
    : undefined;

  return {
    chart_id: entry.chart_id,
    chart_type: entry.chart_type,
    type: entry.chart_type,
    title: entry.title_override ?? entry.title,
    chart_title: entry.title_override ?? entry.title,
    chart_data: rows,
    metric_name,
    metric: metric_name,
    intent: entry.chart_source ?? 'chart',
    chart_payload: entry.chart_payload,
    category_column,
    sql: entry.sql ?? undefined,
    insight_text: entry.insight_text ?? undefined,
    narrative_text: entry.narrative_text ?? undefined,
    ...(convIds && convIds.length > 0 ? { conversation_ids: convIds } : {}),
  };
}

function summarizeDataQualityPlanSummary(summary: unknown): string | undefined {
  if (!summary || typeof summary !== 'object') return undefined;
  const o = summary as Record<string, unknown>;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(o)) {
    if (parts.length >= 5) break;
    if (v != null && typeof v === 'object') continue;
    if (v == null) continue;
    parts.push(`${k.replace(/_/g, ' ')}: ${String(v)}`);
  }
  return parts.length ? parts.join(' · ') : undefined;
}

function isDataQualityStyleChartPlanEntry(x: unknown): x is Record<string, unknown> & {
  rows: Record<string, unknown>[];
  chart_key: string;
} {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return typeof o.chart_key === 'string' && Array.isArray(o.rows);
}

function rowNumericKeys(row: Record<string, unknown>, exclude: Set<string>): string[] {
  return Object.keys(row).filter((k) => !exclude.has(k) && typeof row[k] === 'number');
}

/** XY bar charts pick the first numeric field as the value; put primary metrics before other numbers. */
function reorderRowKeys(row: Record<string, unknown>, leadingKeys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of leadingKeys) {
    if (k in row) out[k] = row[k];
  }
  for (const k of Object.keys(row)) {
    if (!(k in out)) out[k] = row[k];
  }
  return out;
}

/**
 * Maps data-quality `chart_plan[]` (each item has `rows`, `chart_key`, `chart_type`) into
 * {@link DashboardChartSpec} (bars, stacked, horizontal, table, table_heatmap, …).
 */
function dataQualityChartPlanToDashboardSpecs(
  chartPlan: unknown[] | null | undefined,
): DashboardChartSpec[] {
  if (!Array.isArray(chartPlan) || chartPlan.length === 0) return [];
  if (!chartPlan.some(isDataQualityStyleChartPlanEntry)) return [];

  return chartPlan.filter(isDataQualityStyleChartPlanEntry).map((entry) => {
    const rawRows = entry.rows as Record<string, unknown>[];
    const chartKey = String(entry.chart_key ?? '').trim() || 'dq_chart';
    const title =
      (typeof entry.title === 'string' && entry.title.trim()) || chartKey.replace(/_/g, ' ');
    const apiChartType = String(entry.chart_type ?? 'bar').toLowerCase();
    const yField = typeof entry.y_field === 'string' ? entry.y_field.trim() : '';
    const xField = typeof entry.x_field === 'string' ? entry.x_field.trim() : '';
    const firstRow = rawRows[0];

    const entryRec = entry as Record<string, unknown>;
    const displayColsRaw = entryRec.display_columns;
    const display_columns =
      Array.isArray(displayColsRaw)
        ? (displayColsRaw as Array<{ field?: unknown; label?: unknown; evidence?: unknown }>)
            .filter((c) => c && typeof c.field === 'string')
            .map((c) => ({
              field: String(c.field),
              ...(typeof c.label === 'string' ? { label: c.label } : {}),
              ...(c.evidence === true ? { evidence: true } : {}),
            }))
        : undefined;

    let category_column: string | null = null;
    let chart_type = 'bar';
    let metric_name = 'Value';
    let rowKeyOrder: string[] | null = null;

    if (apiChartType === 'table') {
      chart_type = 'table';
      metric_name = 'Table';
    } else if (apiChartType === 'table_heatmap') {
      chart_type = 'table_heatmap';
      metric_name = 'Missingness';
      if (firstRow && 'column_name' in firstRow) category_column = 'column_name';
    } else if (firstRow) {
      const keys = Object.keys(firstRow);

      if (yField && keys.includes(yField) && xField && keys.includes(xField)) {
        category_column = yField;
        metric_name = xField.replace(/_/g, ' ');
        rowKeyOrder = [yField, xField];
      } else if (apiChartType === 'stacked_bar') {
        const catCandidates = [
          'rule_id',
          'column_name',
          'table_name',
          'category',
          'title',
          'period',
          'date',
        ];
        const cat =
          catCandidates.find((c) => keys.includes(c) && typeof firstRow[c] === 'string') ??
          keys.find((k) => typeof firstRow[k] === 'string') ??
          null;
        const nums = cat ? rowNumericKeys(firstRow, new Set([cat])) : rowNumericKeys(firstRow, new Set());
        if (cat && nums.length >= 2) {
          category_column = cat;
          chart_type = 'stacked_bar';
          metric_name = nums.map((n) => n.replace(/_/g, ' ')).join(' · ');
          rowKeyOrder = [cat, ...nums];
        } else if (cat && nums.length === 1) {
          category_column = cat;
          chart_type = 'bar';
          metric_name = nums[0]?.replace(/_/g, ' ') ?? 'Value';
          rowKeyOrder = [cat, nums[0]!];
        } else {
          chart_type = 'bar';
        }
      } else if (apiChartType === 'bar' && keys.includes('table_name')) {
        const nums = rowNumericKeys(firstRow, new Set(['table_name']));
        const valueKey = nums.find((k) => k.includes('score') || k.includes('count')) ?? nums[0] ?? 'value';
        category_column = 'table_name';
        metric_name = valueKey.replace(/_/g, ' ');
        rowKeyOrder = ['table_name', valueKey];
      } else {
        const strKey = keys.find((k) => typeof firstRow[k] === 'string');
        const numKey = keys.find((k) => typeof firstRow[k] === 'number');
        category_column = strKey ?? keys[0] ?? null;
        const nk = numKey ?? 'value';
        metric_name = nk.replace(/_/g, ' ');
        if (category_column && numKey) rowKeyOrder = [category_column, numKey];
      }
    }

    if (apiChartType === 'horizontal_bar') {
      chart_type = 'horizontal_bar';
    } else if (apiChartType === 'stacked_bar' && chart_type !== 'stacked_bar') {
      chart_type = 'bar';
    }

    const keyOrder =
      chart_type === 'table' || chart_type === 'table_heatmap'
        ? null
        : rowKeyOrder && rowKeyOrder.length > 0
          ? rowKeyOrder
          : null;
    const rows = keyOrder ? rawRows.map((r) => reorderRowKeys(r, keyOrder)) : rawRows.map((r) => ({ ...r }));

    const insight = summarizeDataQualityPlanSummary(entry.summary);

    const chart_payload: Record<string, unknown> = { chart_key: chartKey };
    if (display_columns?.length) chart_payload.display_columns = display_columns;
    if (entryRec.summary != null && typeof entryRec.summary === 'object') {
      chart_payload.summary = entryRec.summary;
    }
    const dataSource = entryRec.data_source;
    if (typeof dataSource === 'string' && dataSource.trim()) {
      chart_payload.data_source = dataSource.trim();
    }
    if (chart_type === 'table_heatmap' && firstRow) {
      const heatDefaults = ['null_pct', 'completeness_score'] as const;
      const heatFields = heatDefaults.filter((f) => f in firstRow && typeof firstRow[f] === 'number');
      if (heatFields.length) chart_payload.heatmap_value_fields = [...heatFields];
    }

    return {
      chart_id: chartKey,
      chart_type,
      type: chart_type,
      title,
      chart_title: title,
      chart_data: rows,
      metric_name,
      metric: metric_name,
      intent: 'data_quality',
      category_column,
      ...(Object.keys(chart_payload).length > 0 ? { chart_payload } : {}),
      ...(insight ? { insight_text: insight } : {}),
    };
  });
}

/**
 * Ensures `spec.charts` is populated: uses legacy `spec.charts` when non-empty,
 * otherwise maps root `charts[]` (with inline chart_data) into the same shape.
 */
export function normalizeDashboardByIdResponse(
  res: DashboardByIdResponse,
): DashboardByIdResponse {
  const specCharts = res.spec?.charts;
  const embedded = res.charts;
  if (embedded?.length && (!specCharts || specCharts.length === 0)) {
    const mapped = [...embedded]
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map(embeddedChartToSpec);
    return {
      ...res,
      spec: {
        ...res.spec,
        title: res.spec?.title ?? res.title,
        charts: mapped,
      },
    };
  }
  if (!specCharts || specCharts.length === 0) {
    const dqCharts = dataQualityChartPlanToDashboardSpecs(res.chart_plan);
    if (dqCharts.length > 0) {
      return {
        ...res,
        spec: {
          ...(res.spec ?? {}),
          title: res.spec?.title ?? res.title,
          charts: dqCharts,
        },
      };
    }
  }
  return res;
}

// ─── Types: GET /charts/{chart_id} ───────────────────────────────────────────

export interface ChartStatusResponse {
  chart_id: string;
  status: string;
  chart_type?: string | null;
  chart_payload?: Record<string, unknown> | null;
  data?: Record<string, unknown>[] | null;
  sql?: string | null;
  rows_json?: Record<string, unknown>[] | null;
  /** Present on drill / chart status; use with `rows_json` to pick the category axis field (e.g. `region`). */
  interaction_context?: {
    current_level?: string | null;
    group_dimensions?: string[] | null;
  } | null;
  error_message?: string | null;
  conversation_ids?: string[];
  insight_text?: string | null;
  narrative_text?: string | null;
  stats_json?: {
    avg?: number;
    max?: number;
    min?: number;
    count?: number;
    total?: number;
  } | null;
}

// ─── Types: GET /charts/{chart_id}/actions ────────────────────────────────────

export interface ChartActionsFilterField {
  kind: string;
  field: string;
  label: string;
}

export interface ChartDrilldownAction {
  label: string;
  distance?: number;
  priority?: number;
  relation?: string;
  action_type: string;
  hierarchy_id: string;
  source_level_id: string;
  target_level_id: string;
  reason?: string;
}

export interface ChartActionsBreadcrumbItem {
  chart_id: string;
  title?: string | null;
  level_id?: string | null;
  interaction_type?: string | null;
  source_level_id?: string | null;
  target_level_id?: string | null;
  filters_added?: unknown[];
  selected_dimension?: string | null;
  selected_value?: string | null;
  action_label?: string | null;
  hierarchy_id?: string | null;
}

export interface ChartActionsLineageSummary {
  root_chart_id?: string | null;
  parent_chart_id?: string | null;
  depth?: number;
  current_chart_id?: string | null;
  can_go_back?: boolean;
  back_chart_id?: string | null;
  lineage_path_chart_ids?: string[];
}

export interface ChartActionsResponse {
  chart_id: string;
  available_filters: ChartActionsFilterField[];
  available_drilldowns: ChartDrilldownAction[];
  available_dimension_navigation: ChartDrilldownAction[];
  suggested_drilldowns: ChartDrilldownAction[];
  available_areas?: {
    dimensions?: string[];
    time?: string[];
    series?: string[];
    drill_paths?: { hierarchy_id: string; current_level: string }[];
  };
  breadcrumb?: ChartActionsBreadcrumbItem[];
  lineage_summary?: ChartActionsLineageSummary;
}

/** Body for POST /charts/{chart_id}/actions — apply drill / navigation (shape may evolve with backend). */
export interface PostChartActionBody {
  action_type: string;
  hierarchy_id: string;
  source_level_id: string;
  target_level_id: string;
  selected_value?: string | null;
}

/** Body for POST /charts/{chart_id}/drill-down */
export interface ChartDrillDownBody {
  target_level_id: string;
  selected_dimension: string;
  selected_value: string;
}

/** POST /charts/{chart_id}/filter — apply dimension filters */
export interface ChartFilterClause {
  field: string;
  operator: string;
  value: string;
}

export interface PostChartFilterBody {
  filters: ChartFilterClause[];
}

// ─── Types: GET /agentic/runs/{run_id}/chat ──────────────────────────────────

export interface AgenticChatHistoryMessage {
  message_id: string;
  run_id: string;
  sender: 'system' | 'agent' | string;
  agent_name?: string | null;
  status?: string | null;
  message: string;
  event_id?: string | null;
  logical_event_id?: string | null;
  stage_name?: string | null;
  stage_seq?: number | null;
  payload_compacted?: boolean;
  artifacts?: Record<string, unknown>;
  dashboard_id?: string | null;
  dashboard_title?: string | null;
  chart_ids?: string[];
  chart_titles?: string[];
  created_at: string;
}

export interface AgenticChatHistoryPaging {
  limit: number;
  cursor: string | null;
  returned: number;
  has_more: boolean;
  next_cursor: string | null;
}

export interface AgenticChatHistoryResponse {
  messages: AgenticChatHistoryMessage[];
  paging?: AgenticChatHistoryPaging;
}

// ─── API Functions ───────────────────────────────────────────────────────────

/** POST /tenant/scope — persist active connection scope for a tenant */
export async function setTenantScope(payload: SetTenantScopePayload): Promise<{ ok: boolean }> {
  const data = await v2Post<{ ok: boolean }>('/tenant/scope', payload);
  return data;
}

/** POST /agentic/runs — start a multi-agent semantic build run */
export async function startAgenticRun(payload: StartAgenticRunPayload): Promise<StartAgenticRunResponse> {
  const data = await v2Post<StartAgenticRunResponse>('/agentic/runs', payload);
  return data;
}

/** GET /agentic/runs/{run_id}/events — fetch events (polling fallback) */
export async function fetchAgenticRunEvents(runId: string, limit = 200): Promise<AgenticRunEventsResponse> {
  const data = await v2Get<AgenticRunEventsResponse>(`/agentic/runs/${runId}/events`, {
    params: { run_id: runId }
  });
  return data;
}

/** Build SSE URL for /agentic/runs/{run_id}/stream (used with native EventSource) */
export function getAgenticStreamUrl(runId: string): string {
  return `${API_V2_BASE_URL}/agentic/runs/${runId}/stream`;
}

/** POST /chat — send a natural language question */
export async function sendChat(payload: ChatQueryPayload): Promise<ChatResponse> {
  const data = await v2Post<ChatResponse>('/chat', payload);
  return data;
}

/** Build SSE URL for /chat/{chat_id}/stream (used with native EventSource) */
export function getChatStreamUrl(chatId: string): string {
  return `${API_V2_BASE_URL}/chat/${chatId}/stream`;
}

/** GET /dashboards — list dashboards for a tenant (tenant_id in query params) */
export async function fetchDashboards(tenantId: string, domainId?: string): Promise<DashboardsListResponse> {
  const data = await v2Get<DashboardsListResponse>('/dashboards', {
    params: { tenant_id: tenantId, ...(domainId && { domain_id: domainId }) },
  });
  return data;
}

/** GET /dashboards/ — separate list endpoint; same tenant_id params as {@link fetchDashboards} */
export async function fetchDashboardsSlash(tenantId: string, domainId?: string): Promise<DashboardsListResponse> {
  const data = await v2Get<DashboardsListResponse>('/dashboards/', {
    params: { tenant_id: tenantId, ...(domainId && { domain_id: domainId }) },
  });
  return data;
}

/** GET /dashboards/{dashboard_id} — fetch single dashboard with spec and charts */
export async function fetchDashboardById(dashboardId: string): Promise<DashboardByIdResponse> {
  const data = await v2Get<DashboardByIdResponse>(`/dashboards/${dashboardId}`);
  return data;
}

/** Response from POST /dashboards/{dashboard_id}/refresh */
export interface DashboardRefreshResponse {
  refresh_id: string;
  dashboard_id: string;
  status: string;
  job_id?: string;
}

/** Response from GET /dashboards/{dashboard_id}/refresh/{refresh_id} */
export interface DashboardRefreshStatusResponse {
  refresh_id: string;
  dashboard_id: string;
  tenant_id?: string;
  domain_id?: string;
  status: string;
  trigger_source?: string;
  requested_by?: string | null;
  request_payload?: { dashboard_id: string };
  error_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** POST /dashboards/{dashboard_id}/refresh — start dashboard refresh. Returns refresh_id for status polling. */
export async function refreshDashboard(dashboardId: string): Promise<DashboardRefreshResponse> {
  const data = await v2Post<DashboardRefreshResponse>(`/dashboards/${dashboardId}/refresh`, { dashboard_id: dashboardId });
  return data;
}

/** GET /dashboards/{dashboard_id}/refresh/{refresh_id} — get dashboard refresh status. */
export async function getDashboardRefreshStatus(dashboardId: string, refreshId: string): Promise<DashboardRefreshStatusResponse> {
  const data = await v2Get<DashboardRefreshStatusResponse>(`/dashboards/${dashboardId}/refresh/${refreshId}`, {
    params: { dashboard_id: dashboardId, refresh_id: refreshId },
  });
  return data;
}

/** Body for PATCH /dashboards/{dashboard_id} — update dashboard and chart titles */
export interface DashboardChartTitleUpdateItem {
  chart_id: string;
  title: string;
}

export interface UpdateDashboardTitlesBody {
  action: 'update_titles';
  title: string;
  chart_updates: DashboardChartTitleUpdateItem[];
}

/** DELETE /dashboards/{dashboard_id} — request body includes dashboard_id */
export async function deleteDashboard(dashboardId: string): Promise<void> {
  await v2Delete(`/dashboards/${encodeURIComponent(dashboardId)}`, {
    data: { dashboard_id: dashboardId },
  });
}

/** DELETE /dashboards/{dashboard_id}/charts/{chart_id} — body includes dashboard_id and chart_id */
export async function deleteDashboardChart(dashboardId: string, chartId: string): Promise<void> {
  await v2Delete(
    `/dashboards/${encodeURIComponent(dashboardId)}/charts/${encodeURIComponent(chartId)}`,
    {
      data: { dashboard_id: dashboardId, chart_id: chartId },
    },
  );
}

/** Body for PUT /dashboards/{dashboard_id}/charts/{chart_id} — persist chart order */
export interface ReorderDashboardChartsBody {
  chart_ids: string[];
}

/**
 * PUT /dashboards/{dashboard_id}/charts/{chart_id} — update chart order.
 * `chartPathId` is typically any chart id on the dashboard (e.g. first in the ordered list).
 */
export async function reorderDashboardCharts(
  dashboardId: string,
  chartPathId: string,
  body: ReorderDashboardChartsBody,
): Promise<void> {
  await v2Put(
    `/dashboards/${encodeURIComponent(dashboardId)}/charts/order`,
    body,
    {
    },
  );
}

/** PATCH /dashboards/{dashboard_id} — replace / update titles (dashboard_id in body) */
export async function updateDashboardTitles(
  dashboardId: string,
  body: UpdateDashboardTitlesBody,
): Promise<unknown> {
  return v2Patch(
    `/dashboards/${encodeURIComponent(dashboardId)}`,
    { dashboard_id: dashboardId, ...body },
    undefined,
    'Failed to update dashboard titles',
  );
}

/**
 * Pull dashboard id from POST /dashboards/ (or similar) response bodies.
 * Handles nested shapes and string/number ids (walks common wrapper keys).
 */
export function extractDashboardIdFromCreateResponse(data: unknown): string | null {
  const visit = (node: unknown, depth: number): string | null => {
    if (depth > 8 || node == null) return null;
    if (typeof node === 'string') {
      const t = node.trim();
      return t || null;
    }
    if (typeof node === 'number' && Number.isFinite(node)) {
      return String(node);
    }
    if (typeof node !== 'object' || Array.isArray(node)) return null;
    const o = node as Record<string, unknown>;
    for (const k of ['dashboard_id', 'id', 'dashboardId']) {
      const v = o[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
      if (typeof v === 'number' && Number.isFinite(v)) return String(v);
    }
    const childKeys = [
      'data',
      'dashboard',
      'result',
      'payload',
      'item',
      'body',
      'response',
      'record',
      'value',
    ];
    for (const k of childKeys) {
      const inner = visit(o[k], depth + 1);
      if (inner) return inner;
    }
    return null;
  };
  return visit(data, 0);
}

/** When POST /dashboards/ returns 201 with Location: .../dashboards/{id} */
export function extractDashboardIdFromLocationHeader(headers: unknown): string | null {
  if (headers == null || typeof headers !== 'object') return null;
  const h = headers as Record<string, unknown> & { get?: (name: string) => string | undefined };
  let loc: string | undefined;
  if (typeof h.get === 'function') {
    loc = h.get('location') ?? h.get('Location');
  }
  if (typeof loc !== 'string' || !loc.trim()) {
    const raw = h['location'] ?? h['Location'];
    loc = typeof raw === 'string' ? raw : undefined;
  }
  if (!loc?.trim()) return null;
  const m = loc.match(/\/dashboards\/([^/?#]+)/);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

/** POST /dashboards/{dashboard_id}/charts — attach a chart to a dashboard */
export async function addChartToDashboard(dashboardId: string, chartId: string, title?: string): Promise<unknown> {
  const body: Record<string, unknown> = { dashboard_id: dashboardId, chart_id: chartId };
  if (title !== undefined) {
    body.title = title;
  }
  return v2Post(
    `/dashboards/${encodeURIComponent(dashboardId)}/charts`,
    body,
    undefined,
    'Failed to add chart to dashboard',
  );
}

/** GET /charts/{chart_id} — get chart status and payload */
export async function fetchChart(chartId: string, refresh = false): Promise<ChartStatusResponse> {
  const data = await v2Get<ChartStatusResponse>(`/charts/${encodeURIComponent(chartId)}`, {
    params: refresh ? { refresh: true } : undefined,
  });
  return data;
}

/** GET /charts/{chart_id}/actions — drilldowns, filters, breadcrumb, lineage for interactive charts */
export async function fetchChartActions(chartId: string): Promise<ChartActionsResponse> {
  const data = await v2Get<ChartActionsResponse>(
    `/charts/${encodeURIComponent(chartId)}/actions`,
  );
  return data;
}

/**
 * POST /charts/{chart_id}/actions — execute drill / navigation.
 * Returns updated chart payload when the API responds with a chart body.
 */
export async function postChartAction(
  chartId: string,
  body: PostChartActionBody,
): Promise<ChartStatusResponse> {
  const data = await v2Post<ChartStatusResponse>(
    `/charts/${encodeURIComponent(chartId)}/actions`,
    body,
  );
  return data;
}

/** POST /charts/{chart_id}/drill-down — drill from a selected dimension value to a target hierarchy level */
export async function postChartDrillDown(
  chartId: string,
  body: ChartDrillDownBody,
): Promise<ChartStatusResponse> {
  const data = await v2Post<ChartStatusResponse>(
    `/charts/${encodeURIComponent(chartId)}/drill-down`,
    body,
  );
  return data;
}

/** POST /charts/{chart_id}/back — navigate to parent view in chart lineage */
export async function postChartBack(chartId: string): Promise<ChartStatusResponse> {
  const data = await v2Post<ChartStatusResponse>(
    `/charts/${encodeURIComponent(chartId)}/back`,
  );
  return data;
}

/** POST /charts/{chart_id}/filter — apply filters (e.g. dimension = value) */
export async function postChartFilter(
  chartId: string,
  body: PostChartFilterBody,
): Promise<ChartStatusResponse> {
  const data = await v2Post<ChartStatusResponse>(
    `/charts/${encodeURIComponent(chartId)}/filter`,
    body,
  );
  return data;
}

/** GET /agentic/runs/{run_id}/chat — fetch chat history */
export async function fetchAgenticRunChatHistory(
  runId: string,
  limit = 200,
  includeStages = true
): Promise<AgenticChatHistoryResponse> {
  const data = await v2Get<AgenticChatHistoryResponse>(`/agentic/runs/${runId}/chat`, {
    params: { run_id: runId, limit, include_stages: includeStages },
  });
  return data;
}
