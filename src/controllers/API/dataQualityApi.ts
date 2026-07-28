import { apiV2 } from '@/controllers/API/api';

/** Query params for GET /api/v2/data-quality/rules — list rules for review. */
export interface DataQualityRulesListPayload {
  tenant_id: string;
  domain_id: string;
  /** Agentic run id (e.g. run_…); omit or null if backend resolves latest quality run. */
  run_id?: string | null;
}

export interface DataQualitySqlPreview {
  error?: string | null;
  notes?: string[];
  source?: string | null;
  status?: string | null;
  sample_sql?: string | null;
  validation_sql?: string | null;
}

export interface DataQualityExecutionPlan {
  notes?: string[];
  sample_sql?: string | null;
  validation_sql?: string | null;
  executor_kind?: string | null;
  sql_preview?: DataQualitySqlPreview | null;
  parameter_hints?: Record<string, unknown> | null;
  sql_preview_source?: string | null;
  sql_preview_status?: string | null;
}

export interface DataQualityRuleRow {
  rule_id: string;
  quality_run_id?: string | null;
  run_id?: string | null;
  rule_type?: string | null;
  severity?: string | null;
  table_name?: string | null;
  column_name?: string | null;
  reference_table?: string | null;
  reference_column?: string | null;
  source_text?: string | null;
  executor_kind?: string | null;
  execution_plan?: DataQualityExecutionPlan | null;
  sql_preview?: DataQualitySqlPreview | null;
  sql_preview_status?: string | null;
  sql_preview_source?: string | null;
  condition_json?: Record<string, unknown> | null;
  source?: string | null;
  confidence?: string | null;
  rule_status?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
  result?: unknown;
}

export interface DataQualityRulesListResponse {
  tenant_id?: string;
  domain_id?: string;
  run_id?: string | null;
  rules?: DataQualityRuleRow[];
}

export async function fetchDataQualityRules(
  params: DataQualityRulesListPayload
): Promise<DataQualityRulesListResponse> {
  const query: Record<string, string> = {
    tenant_id: params.tenant_id.trim(),
    domain_id: params.domain_id.trim(),
  };
  const runId = params.run_id?.trim();
  if (runId) query.run_id = runId;

  const res = await apiV2.get<DataQualityRulesListResponse>('/data-quality/rules', {
    params: query,
  });
  return res.data;
}

/** PATCH /api/v2/data-quality/rules/{rule_id} — approve, reject, or persist edits. */
export interface PatchDataQualityRulePayload {
  tenant_id: string;
  domain_id: string;
  rule_status?: 'active' | 'rejected' | 'needs_review' | string;
  source_text?: string | null;
  review_notes?: string | null;
}

export async function patchDataQualityRule(
  ruleId: string,
  payload: PatchDataQualityRulePayload
): Promise<unknown> {
  const res = await apiV2.patch<unknown>(
    `/data-quality/rules/${encodeURIComponent(ruleId)}`,
    payload
  );
  return res.data;
}

/**
 * POST /api/v2/data-quality/rules/{rule_id}/review — approve, reject, or edit.
 * - **approve**: optional `review_notes`; optional `condition_json` (hints / allowed_values from UI).
 * - **reject**: `review_notes` should explain why (no `condition_json`).
 * - **edit**: `condition_json` includes steward `allowed_values` / hints plus `source_text` (natural language rule).
 */
export interface DataQualityRuleReviewPayload {
  tenant_id: string;
  /** `ui:` + auth `username` (or email if username empty), e.g. `ui:jsmith`. */
  reviewed_by: string;
  action: 'approve' | 'reject' | 'edit' | string;
  review_notes?: string | null;
  /**
   * **Approve / edit.** `allowed_values` from steward lines plus other `parameter_hints` keys; **edit** also sends `source_text` in this object.
   * Omit for **reject** (reject body is tenant_id, reviewed_by, action, review_notes only).
   */
  condition_json?: Record<string, unknown> | null;
}

export async function postDataQualityRuleReview(
  ruleId: string,
  payload: DataQualityRuleReviewPayload
): Promise<unknown> {
  const res = await apiV2.post<unknown>(
    `/data-quality/rules/${encodeURIComponent(ruleId)}/review`,
    payload
  );
  return res.data;
}

/**
 * POST /api/v2/data-quality/runs/{run_id}/resume-after-rule-review
 * Backend expects every rule for the run to be accepted (`active`) or rejected before this succeeds.
 */
export interface ResumeDataQualityRunPayload {
  tenant_id: string;
  domain_id: string;
  run_id: string;
}

/** POST resume-after-rule-review JSON body (shape may grow with backend). */
export interface ResumeDataQualityRunResponse {
  status?: string | null;
  run_id?: string | null;
  job_id?: string | null;
  resume_mode?: string | null;
  [key: string]: unknown;
}

function extractResumeStatusString(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const o = data as Record<string, unknown>;
  const top = o.status ?? o.run_status ?? o.state;
  if (typeof top === 'string' && top.trim()) return top.trim();
  const nested = o.data;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const n = (nested as Record<string, unknown>).status;
    if (typeof n === 'string' && n.trim()) return n.trim();
  }
  return '';
}

/**
 * True when resume-after-rule-review succeeded enough that the client should reconnect streams / refetch.
 * Originally only `queued`; backends also return `running`, `started`, or omit `status` when OK.
 */
export function isDataQualityResumeRunQueued(data: unknown): boolean {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const o = data as Record<string, unknown>;
  const s = extractResumeStatusString(data).toLowerCase();
  if (s) {
    return (
      s === 'queued' ||
      s === 'running' ||
      s === 'started' ||
      s === 'resumed' ||
      s === 'processing' ||
      s === 'in_progress' ||
      s === 'accepted' ||
      s === 'success' ||
      s === 'ok'
    );
  }
  if (typeof o.run_id === 'string' && o.run_id.trim()) return true;
  if (typeof o.job_id === 'string' && o.job_id.trim()) return true;
  return Object.keys(o).length === 0;
}

export async function postResumeDataQualityRun(
  payload: ResumeDataQualityRunPayload
): Promise<ResumeDataQualityRunResponse> {
  const runId = payload.run_id.trim();
  const res = await apiV2.post<ResumeDataQualityRunResponse>(
    `/data-quality/runs/${encodeURIComponent(runId)}/resume-after-rule-review`,
    {
      tenant_id: payload.tenant_id.trim(),
      domain_id: payload.domain_id.trim(),
    }
  );
  return (res.data ?? {}) as ResumeDataQualityRunResponse;
}

/** Normalize backend / table cell value to a v2-relative GET path (no leading slash) for `apiV2.get`. */
export function normalizeDataQualityEvidenceRequestPath(raw: string): string {
  let s = raw.trim();
  if (!s) throw new Error("Empty evidence path");
  if (s.startsWith("http://") || s.startsWith("https://")) {
    let u: URL;
    try {
      u = new URL(s);
    } catch {
      throw new Error("Invalid evidence URL");
    }
    const pathname = u.pathname;
    const q = u.search ?? "";
    const v2Idx = pathname.indexOf("/api/v2/");
    if (v2Idx >= 0) {
      s = pathname.slice(v2Idx + "/api/v2/".length) + q;
    } else {
      const lead = pathname.startsWith("/") ? pathname.slice(1) : pathname;
      s = lead + q;
    }
  } else {
    if (s.startsWith("/api/v2/")) s = s.slice("/api/v2/".length);
    else if (s.startsWith("/api/v2")) s = s.slice("/api/v2".length);
    if (s.startsWith("/")) s = s.slice(1);
  }
  return s;
}

/** Turn common list payload shapes into table rows. */
export function normalizeEvidenceResponseToRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const o = data as Record<string, unknown>;
    /** DQ duplicate / trust evidence GET returns `{ candidate, evidence_rows, … }` — table is `evidence_rows`. */
    if (Array.isArray(o.evidence_rows)) return o.evidence_rows as Record<string, unknown>[];
    if (Array.isArray(o.rows)) return o.rows as Record<string, unknown>[];
    if (Array.isArray(o.data)) return o.data as Record<string, unknown>[];
    if (Array.isArray(o.records)) return o.records as Record<string, unknown>[];
    if (Array.isArray(o.items)) return o.items as Record<string, unknown>[];
    if (Array.isArray(o.results)) return o.results as Record<string, unknown>[];
    const nested = o.data;
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      const d = nested as Record<string, unknown>;
      if (Array.isArray(d.evidence_rows)) return d.evidence_rows as Record<string, unknown>[];
    }
    return [o];
  }
  return [];
}

/**
 * GET evidence detail for dashboard / rule tables. `evidencePath` is usually a row cell:
 * relative v2 path (e.g. `data-quality/...`) or full URL containing `/api/v2/`.
 */
export async function fetchDataQualityEvidenceTable(
  evidencePath: string,
): Promise<Record<string, unknown>[]> {
  const rel = normalizeDataQualityEvidenceRequestPath(evidencePath);
  const res = await apiV2.get<unknown>(rel);
  return normalizeEvidenceResponseToRows(res.data);
}

/** GET /api/v2/data-quality/runs/{run_id} — persisted run summary after workflow completes. */
export interface DataQualityRunArtifacts {
  run_summary?: string;
  dashboard?: string;
  excel_report?: string;
  tables?: string;
  rules?: string;
  rule_review_queue?: string;
  resume_after_rule_review?: string;
  duplicates?: string;
  remediation?: string;
  enrichment_opportunities?: string;
  enrichment_questions?: string;
  [key: string]: string | undefined;
}

export interface DataQualityRunDetailResponse {
  quality_run_id?: string;
  run_id?: string;
  tenant_id?: string;
  domain_id?: string;
  connection_id?: string;
  database_name?: string;
  schema_name?: string;
  status?: string;
  overall_trust_score?: string | number;
  critical_issue_count?: number;
  warning_issue_count?: number;
  dashboard_id?: string;
  dashboard_title?: string;
  dashboard_chart_count?: number;
  duplicate_candidate_count?: number;
  exact_duplicate_candidate_count?: number;
  fuzzy_duplicate_candidate_count?: number;
  active_rule_count?: number;
  needs_review_rule_count?: number;
  unsupported_rule_count?: number;
  rejected_rule_count?: number;
  rule_review_required?: boolean;
  review_queue_pending_count?: number;
  workflow_status?: string;
  stale_table_count?: number;
  tables_without_freshness_column_count?: number;
  stability_issue_count?: number;
  enrichment_opportunity_count?: number;
  external_lookup_opportunity_count?: number;
  remediation_action_count?: number;
  critical_remediation_action_count?: number;
  artifacts?: DataQualityRunArtifacts | Record<string, string>;
  remediation_summary?: Record<string, unknown>;
  recommended_actions?: Record<string, unknown>[];
  summary?: Record<string, unknown>;
  created_at?: string;
  completed_at?: string;
  [key: string]: unknown;
}

export async function fetchDataQualityRunDetail(
  runId: string,
  params: { tenant_id: string; domain_id: string }
): Promise<DataQualityRunDetailResponse> {
  const rid = runId.trim();
  const res = await apiV2.get<DataQualityRunDetailResponse>(
    `/data-quality/runs/${encodeURIComponent(rid)}`,
    {
      params: {
        tenant_id: params.tenant_id.trim(),
        domain_id: params.domain_id.trim(),
      },
    }
  );
  return (res.data ?? {}) as DataQualityRunDetailResponse;
}

/** GET a JSON artifact URL from `run.artifacts` (relative path or full `/api/v2/...` URL). */
export async function fetchDataQualityArtifactJson(pathOrUrl: string): Promise<unknown> {
  const rel = normalizeDataQualityEvidenceRequestPath(pathOrUrl);
  const res = await apiV2.get<unknown>(rel);
  return res.data;
}

function buildDataQualityExcelReportPath(
  runId: string,
  tenant_id: string,
  domain_id: string
): string {
  const q = new URLSearchParams({ tenant_id, domain_id });
  return `data-quality/reports/${encodeURIComponent(runId)}/excel?${q.toString()}`;
}

/**
 * GET `data-quality/reports/{run_id}/excel?tenant_id=&domain_id=` and save the file (no run-summary call).
 */
export async function downloadDataQualityExcelReport(params: {
  runId: string;
  tenant_id: string;
  domain_id: string;
}): Promise<void> {
  const tenant_id = params.tenant_id.trim();
  const domain_id = params.domain_id.trim();
  const runId = params.runId.trim();
  if (!runId || !tenant_id || !domain_id) {
    throw new Error('Missing tenant, domain, or run id');
  }

  const path = buildDataQualityExcelReportPath(runId, tenant_id, domain_id);
  const rel = normalizeDataQualityEvidenceRequestPath(path);
  const res = await apiV2.get<Blob>(rel, { responseType: 'blob' });

  const cd = res.headers['content-disposition'];
  let filename = `data-quality-${runId}.xlsx`;
  if (cd && typeof cd === 'string') {
    const m = /filename\*=UTF-8''([^;\s]+)|filename="([^"]+)"|filename=([^;\s]+)/i.exec(cd);
    const rawName = m?.[1] ?? m?.[2] ?? m?.[3];
    if (rawName) {
      try {
        filename = decodeURIComponent(rawName.replace(/["']/g, '').trim());
      } catch {
        filename = rawName.replace(/["']/g, '').trim();
      }
    }
  }

  const blob = res.data;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

/** Query params for GET /api/v2/data-quality/trends */
export interface DataQualityTrendsQuery {
  tenant_id: string;
  domain_id: string;
  run_id: string;
}

export interface DataQualityTrendsSummary {
  trend_row_count?: number;
  improved_metric_count?: number;
  worsened_metric_count?: number;
  baseline_metric_count?: number;
  unchanged_metric_count?: number;
  changed_metric_count?: number;
  [key: string]: unknown;
}

/** One card from GET /data-quality/trends `cards` array (server-driven KPI tiles). */
export interface DataQualityTrendCard {
  card_key: string;
  title: string;
  value: string | number;
  subtitle?: string | null;
  note?: string | null;
  trend_status?: string | null;
  evidence_path?: string | null;
  delta_value?: string | null;
  delta_pct?: string | null;
  [key: string]: unknown;
}

/** One row from GET /data-quality/trends `trends` array. */
export interface DataQualityTrendRow {
  object_type?: string | null;
  object_key?: string | null;
  object_name?: string | null;
  metric_name?: string | null;
  previous_value_num?: string | null;
  previous_value_text?: string | null;
  current_value_num?: string | null;
  current_value_text?: string | null;
  delta_value?: string | null;
  delta_pct?: string | null;
  trend_status?: string | null;
  directionality?: string | null;
  [key: string]: unknown;
}

/** One column definition on a `chart_plan` entry with `chart_type: "table"`. */
export interface DataQualityChartPlanTableColumn {
  field: string;
  label: string;
}

/**
 * Server-driven chart from GET /data-quality/trends `chart_plan`.
 * `chart_type` drives UI: `column` (vertical bars), `bar` (horizontal delta bars),
 * `pie` (category/value table), `summary_cards`, `table`.
 */
export interface DataQualityChartPlanEntry {
  chart_key: string;
  chart_type: string;
  title: string;
  subtitle?: string | null;
  summary?: Record<string, unknown> | null;
  x_field?: string | null;
  y_field?: string | null;
  series_fields?: string[] | null;
  rows?: Record<string, unknown>[] | null;
  columns?: DataQualityChartPlanTableColumn[] | null;
  [key: string]: unknown;
}

export interface DataQualityTrendsResponse {
  tenant_id?: string;
  domain_id?: string;
  run_id?: string | null;
  trend_scope_key?: string | null;
  baseline_run_id?: string | null;
  summary?: DataQualityTrendsSummary | null;
  cards?: DataQualityTrendCard[] | null;
  trends?: DataQualityTrendRow[] | null;
  chart_plan?: DataQualityChartPlanEntry[] | null;
  [key: string]: unknown;
}

/** GET /api/v2/data-quality/trends?tenant_id=&domain_id=&run_id= */
export async function fetchDataQualityTrends(
  params: DataQualityTrendsQuery
): Promise<DataQualityTrendsResponse> {
  const tenant_id = params.tenant_id.trim();
  const domain_id = params.domain_id.trim();
  const run_id = params.run_id.trim();
  if (!tenant_id || !domain_id || !run_id) {
    throw new Error('Missing tenant_id, domain_id, or run_id');
  }
  const res = await apiV2.get<DataQualityTrendsResponse>('/data-quality/trends', {
    params: { tenant_id, domain_id, run_id },
  });
  return (res.data ?? {}) as DataQualityTrendsResponse;
}
