import { apiV2 } from '@/controllers/API/api';

// --- Constants ---
export const ASK_TENANT_ID = 'BT_01';
export const ASK_DOMAIN_ID = 'lpg_production_distribution';
export const ASK_QUERY_LIMIT = 100;
export const ASK_CHART_LIMIT = 200;

// --- Types ---

export interface AskQueryRequest {
  question: string;
  tenant_id: string;
  limit: number;
  explain: boolean;
}

export interface AskQueryResponse {
  metrics: string[];
  dimensions: string[];
  chart_id: string;
  sql: string;
  rows: Record<string, string | number>[];
  by_company_sql: string | null;
  by_company_rows: Record<string, string | number>[] | null;
  semantic_validation: unknown;
  lineage: {
    models: string[];
    tables: string[];
  };
}

export interface AskChartRequest {
  tenant_id: string;
  domain_id: string;
  question: string;
  limit: number;
}

export interface AskChartQueueResponse {
  chart_id: string;
  status: 'queued';
}

export type AskChartType = 'bar' | 'line' | 'pie';

export interface AskChartReadyResponse {
  chart_id: string;
  status: 'ready';
  chart_type: AskChartType;
  chart_payload: Record<string, unknown>;
  data: Array<{ value: number; category: string }>;
  sql: string;
  params: string[];
  rows_json: Record<string, unknown>[];
  error_message: string | null;
}

export interface AskChartPendingResponse {
  chart_id: string;
  status: 'queued' | 'processing';
}

export type AskChartPollResponse = AskChartReadyResponse | AskChartPendingResponse;

// --- API Functions ---

export async function postQuery(payload: AskQueryRequest): Promise<AskQueryResponse> {
  const res = await apiV2.post('/query', payload);
  return res.data;
}

export async function postChartRequest(payload: AskChartRequest): Promise<AskChartQueueResponse> {
  const res = await apiV2.post('/charts', payload);
  return res.data;
}

export async function getChartStatus(chartId: string): Promise<AskChartPollResponse> {
  const res = await apiV2.get(`/charts/${chartId}`);
  return res.data;
}
