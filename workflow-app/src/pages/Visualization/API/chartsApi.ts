import type { AxiosResponse } from 'axios'
import { toast } from 'sonner'
import {
  ApiRequestError,
  executeApiRequestSilent,
  getDisplayErrorMessage,
  resolveApiErrorMessage,
  rethrowApiError,
} from '@/utils/exceptionHelper'
import api, { API_BASE_URL } from '@/controllers/API/api';
import { buildListSourceTypeQuery } from './listSourceTypeQuery';

async function chartsApiRequest<T>(
  request: () => Promise<AxiosResponse<T>>,
  fallbackMessage: string,
): Promise<T> {
  try {
    return await executeApiRequestSilent<T>(request, fallbackMessage);
  } catch (error) {
    console.error(fallbackMessage, error);
    if ((error as Error).name !== 'AbortError') {
      toast.error(getDisplayErrorMessage(error, fallbackMessage));
    }
    throw error;
  }
}

/** Streaming POST via axios fetch adapter; wrapped as native `Response` for `body.getReader()`. */
async function postStreamingResponse(
  path: string,
  body: unknown,
  signal: AbortSignal | undefined,
  fallbackMessage: string,
): Promise<Response> {
  const url = path.startsWith('')
    ? path
    : `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

  const axiosRes = await api.post<ReadableStream<Uint8Array>>(url, body, {
    adapter: 'fetch',
    responseType: 'stream',
    signal,
    validateStatus: () => true,
    headers: { 'Content-Type': 'application/json' },
  });

  const { status, statusText, data: stream } = axiosRes;

  if (status < 200 || status >= 300) {
    let errBody = null;
    try {
      if (stream) {
        const text = await new Response(stream).text();
        errBody = text ? JSON.parse(text) : null;
      } else if (axiosRes.data && typeof axiosRes.data === 'object' && !(axiosRes.data instanceof ReadableStream)) {
        errBody = axiosRes.data;
      }
    } catch {
      /* ignore parse errors */
    }
    const message = resolveApiErrorMessage(errBody, `${fallbackMessage} (${status})`);
    toast.error(message);
    throw new ApiRequestError(message, errBody ?? undefined);
  }

  const headers = new Headers();
  Object.entries(axiosRes.headers ?? {}).forEach(([key, value]) => {
    if (value != null) headers.set(key, String(value));
  });

  return new Response(stream, { status, statusText, headers });
}

// In-memory pending request map to avoid duplicate concurrent API calls
const pendingRequests: Map<string, Promise<any>> = new Map();

export async function getCharts(params?: {
  skip?: number
  limit?: number
  fields?: string[]
  q?: string
  analyticsStudio?: boolean
}) {
  const skip = params?.skip ?? 0
  const limit = params?.limit ?? 100
  const fields = params?.fields || []
  const q = buildListSourceTypeQuery(params?.q, params?.analyticsStudio)

  const queryParams = new URLSearchParams()
  queryParams.append('skip', String(skip))
  queryParams.append('limit', String(limit))
  if (fields.length > 0) {
    queryParams.append('fields', JSON.stringify(fields))
  }
  if (q.trim().length > 0) {
    queryParams.append('q', q)
  }

  const key = `getCharts:${queryParams.toString()}`
  if (pendingRequests.has(key)) return pendingRequests.get(key)

  const promise = (async () => {
    try {
      return await chartsApiRequest(() => api.get(`/charts?${queryParams.toString()}`), 'Failed to fetch charts');
    } finally {
      pendingRequests.delete(key)
    }
  })()

  pendingRequests.set(key, promise)
  return promise
}

export async function getChartById(id: string) {
  const key = `getChartById:${id}`
  if (pendingRequests.has(key)) return pendingRequests.get(key)

  const promise = (async () => {
    try {
      return await chartsApiRequest(() => api.get(`/charts/${id}`), `Failed to fetch chart with ID ${id}`);
    } finally {
      pendingRequests.delete(key)
    }
  })()

  pendingRequests.set(key, promise)
  return promise
}

export interface GetColumnsResponse {
  status: boolean;
  sources: Array<{
    name: string;
    columns: string[];
  }>;
}

export interface FlowIdOption {
  id: string;
  name: string;
  flow_id?: string;
}

export interface FlowIdsResponse {
  status?: boolean;
  data?: FlowIdOption[];
}

export async function getFlowIds(): Promise<FlowIdsResponse> {
  const key = 'getFlowIds'
  if (pendingRequests.has(key)) return pendingRequests.get(key)

  const promise = (async () => {
    try {
      const response = await chartsApiRequest<unknown>(() => api.get('/flow-builder', {
        params: {
          fields: JSON.stringify(['id', 'name', 'flow_id', 'workflow_id', 'display_name', 'statement_date']),
        },
      }), 'Failed to fetch flow IDs');

      let flowData: any[] = [];
      if (Array.isArray(response)) {
        flowData = response;
      } else if (response && typeof response === 'object') {
        const o = response as Record<string, unknown>;
        if (Array.isArray(o.data)) {
          flowData = o.data;
        } else {
          const possibleArrays = Object.values(o).filter((val): val is unknown[] => Array.isArray(val));
          if (possibleArrays.length > 0) flowData = possibleArrays[0];
        }
      }

      const formattedData: FlowIdOption[] = flowData
        .filter((item: any) => item)
        .map((item: any) => {
          const id = item.id || item.workflow_id || item.flow_id;
          const name = item.name || item.display_name || item.workflow_name || id || 'Unnamed Flow';
          const flow_id = item.flow_id || item.workflow_id || item.id || id;
          return {
            id: String(id || ''),
            name: String(name || ''),
            flow_id: String(flow_id || id || ''),
          };
        })
        .filter((item: FlowIdOption) => item.id && item.flow_id);

      return { status: true, data: formattedData };
    } finally {
      pendingRequests.delete(key)
    }
  })()

  pendingRequests.set(key, promise)
  return promise
}

export async function getColumns(payload: {
  flow_id: string;
  stmt_date: string;
  source: string;
}): Promise<GetColumnsResponse> {
  const key = `getColumns:${JSON.stringify(payload)}`
  if (pendingRequests.has(key)) return pendingRequests.get(key)

  const promise = (async () => {
    try {
      return await chartsApiRequest<GetColumnsResponse>(
        () => api.post('/charts/get-columns', payload),
        'Failed to fetch columns',
      );
    } finally {
      pendingRequests.delete(key)
    }
  })()

  pendingRequests.set(key, promise)
  return promise
}

/** Analytics Studio database source — separate payload shape; does not affect workflow getColumns. */
export type AnalyticsStudioDatabaseColumnsPayload =
  | {
      flow_id: string;
      source_type: 'database';
      connection_id: string;
      database_name: string;
      schema_name: string;
      table_name: string;
      params: {
        fetch_type: 'table';
      };
    }
  | {
      flow_id: string;
      source_type: 'database';
      connection_id: string;
      database_name: string;
      params: {
        fetch_type: 'query';
        query: string;
      };
    };

export interface AnalyticsStudioDatabaseColumnItem {
  file_name: string;
  columns: string[];
  source_type: string;
  connection_id: string;
}

export interface AnalyticsStudioDatabaseColumnsResponse {
  status: boolean;
  message: string;
  data: AnalyticsStudioDatabaseColumnItem[];
}

export async function getAnalyticsStudioDatabaseColumns(
  payload: AnalyticsStudioDatabaseColumnsPayload,
): Promise<AnalyticsStudioDatabaseColumnsResponse> {
  const key = `getAnalyticsStudioDatabaseColumns:${JSON.stringify(payload)}`;
  if (pendingRequests.has(key)) return pendingRequests.get(key);

  const promise = (async () => {
    try {
      return await chartsApiRequest<AnalyticsStudioDatabaseColumnsResponse>(
        () => api.post('/charts/get-columns', payload),
        'Failed to fetch columns',
      );
    } finally {
      pendingRequests.delete(key);
    }
  })();

  pendingRequests.set(key, promise);
  return promise;
}

export interface DashboardChartComponent {
  key: string;
  name: string;
  unique_id: string;
  image: string;
  execute_action: string;
  tags: string[];
}

export interface DashboardChartSection {
  section: string;
  components: DashboardChartComponent[];
}

export interface DashboardChartsResponse {
  status: boolean;
  message: string;
  data: DashboardChartSection[];
}

export async function getDashboardCharts(): Promise<DashboardChartsResponse> {
  const key = 'getDashboardCharts'
  if (pendingRequests.has(key)) return pendingRequests.get(key)

  const promise = (async () => {
    try {
      return await chartsApiRequest<DashboardChartsResponse>(
        () => api.post('/charts/dashboard-charts', {}),
        'Failed to fetch dashboard charts',
      );
    } finally {
      pendingRequests.delete(key)
    }
  })()

  pendingRequests.set(key, promise)
  return promise
}

export interface ChartFormParameter {
  name: string;
  label: string;
  type: string;
  placeholder: string;
  key: string;
  api?: string;
  params?: any;
  display_value: string;
  callback: boolean;
  validators: {
    required: boolean;
  };
  options?: any[];
  depends_on?: string[];
  depends_value?: any[];
  popover?: {
    [key: string]: ChartFormParameter[];
  };
  'popover-timerange'?: {
    [key: string]: ChartFormParameter[];
  };
}

export interface ChartFormResponse {
  status: boolean;
  message: string;
  data: {
    key: string;
    name: string;
    unique_id: string;
    image: string;
    tags: string[];
    parameters: ChartFormParameter[];
    unique_uuid: string;
  };
}

export async function getDashboardChartForm(uniqueId: string): Promise<ChartFormResponse> {
  const key = `getDashboardChartForm:${uniqueId}`
  if (pendingRequests.has(key)) return pendingRequests.get(key)

  const promise = (async () => {
    try {
      return await chartsApiRequest<ChartFormResponse>(
        () => api.post('/charts/get-dashboard-chart-form', { unique_id: uniqueId }),
        'Failed to fetch chart form',
      );
    } finally {
      pendingRequests.delete(key)
    }
  })()

  pendingRequests.set(key, promise)
  return promise
}

export interface CreateChartPayload {
  flow_id: string;
  visualization_name: string;
  chart_name?: string;
  /** Who can access the saved chart */
  visibility?: 'personal' | 'team' | 'public';
  stmt_date?: string;
  /** Analytics Studio wizard: connection vs analytical dataset creation path */
  chart_origin?: 'connection' | 'analytical_dataset';
  /** Analytics Studio wizard: source analytical dataset id when chart_origin is analytical_dataset */
  dataset_id?: number | string;
  /** Analytics Studio: database connection vs virtual dataset data source */
  source_type?: 'database' | 'virtual_db' | string;
  connection_id?: string | number;
  database_name?: string;
  schema_name?: string;
  table_name?: string;
  /** Only sent with `update_chart`: last persisted workflow/chart identity before this edit */
  previous_unique_id?: string;
  /** Chart appearance options (font sizes, KPI card color scheme, etc.) */
  customization?: Record<string, unknown>;
  params: {
    metrics?: Array<{ columns: string; operation?: string; alias?: string }>;
    dimensions?: Array<{ columns: string; alias?: string }>;
    group_by?: Array<{ columns: string; aggregate?: string; alias?: string }>;
    filters?: Array<{ columns: string; operator: string; value: any }>;
    is_drilldown?: boolean;
    drill_filters?: Array<{ column: string; value: any }>;
    drill_columns?: Array<{ column: string }>;
    /** Level-by-level drilldown config for save: each level has drill_filters and drill_columns */
    drilldown_levels?: Array<{ drill_filters: Array<{ column: string; value: any }>; drill_columns?: Array<{ column: string }> }>;
    /** Drill through: return raw rows for the selected slice */
    is_drill_through?: boolean;
    drill_through_columns?: Array<{ column: string; value: any }>;
    source: string;
    limit?: number;
  };
}

export interface CreateChartResponse {
  status: boolean;
  message: string;
  data: any[];
  columns: string[];
  drilldown_applied: boolean;
}

export async function createChart(payload: CreateChartPayload | any): Promise<CreateChartResponse> {
  try {
    // If caller already passed the wrapped request body (contains payload.data),
    // use it as-is to avoid double-wrapping. Otherwise, wrap the payload.
    const requestBody = (payload && payload.payload && payload.payload.data)
      ? payload
      : {
          payload: {
            data: payload,
            actions: 'create_chart',
            stmt_date: payload?.stmt_date || ''
          }
        }
    // Ensure wrapped payload includes `unique_id` when `node_id` is present
    try {
      const dataObj = requestBody?.payload?.data;
      if (dataObj && !dataObj.unique_id && dataObj.node_id) {
        dataObj.unique_id = dataObj.node_id;
      }
    } catch (e) {
      // ignore
    }
    console.debug('createChart requestBody:', requestBody)
    const key = `createChart:${JSON.stringify(requestBody)}`
    if (pendingRequests.has(key)) {
      console.warn('createChart already in progress for same payload — returning existing promise')
      return pendingRequests.get(key)
    }

    const promise = chartsApiRequest<CreateChartResponse>(
      () => api.post('/transformations/transformations-actions', requestBody),
      'Failed to create chart',
    ).finally(() => {
      pendingRequests.delete(key)
    })

    pendingRequests.set(key, promise)
    return promise
  } catch (error) {
    console.error('Failed to create chart:', error)
    throw error
  }
}

/**
 * Create chart with streaming support for large datasets
 * Returns the raw Response object for streaming
 */
export async function createChartStreaming(
  payload: CreateChartPayload | any, 
  signal?: AbortSignal
): Promise<Response> {
  try {
    // Avoid double-wrapping if payload already in the { payload: { data: ... } } shape
    const requestBody = (payload && payload.payload && payload.payload.data)
      ? payload
      : {
          payload: {
            data: payload,
            actions: 'create_chart',
            stmt_date: payload?.stmt_date || ''
          }
        }
    // Ensure wrapped payload includes `unique_id` when `node_id` is present
    try {
      const dataObj = requestBody?.payload?.data;
      if (dataObj && !dataObj.unique_id && dataObj.node_id) {
        dataObj.unique_id = dataObj.node_id;
      }
    } catch (e) {
      // ignore
    }
    console.debug('createChartStreaming requestBody:', requestBody)
    return await postStreamingResponse(
      '/transformations/transformations-actions',
      requestBody,
      signal,
      'Failed to create chart',
    );
  } catch (error) {
    console.error('Failed to create chart with streaming:', error);
    if ((error as Error).name === 'AbortError') throw error;
    if (error instanceof ApiRequestError) throw error;
    toast.error(getDisplayErrorMessage(error, 'Failed to create chart'));
    await rethrowApiError(error, 'Failed to create chart');
  }
}

export interface SaveChartResponse {
  status: boolean;
  message: string;
  data?: any;
}

/** Resolves chart row id from save-chart (`data.data.id`) or flatter update-chart bodies. */
export function getSavedChartIdFromResponse(res: SaveChartResponse | any): string | number | undefined {
  const nested = res?.data?.data?.id;
  if (nested != null) return nested;
  const flat = res?.data?.id;
  if (flat != null) return flat;
  return undefined;
}

export async function saveChart(payload: CreateChartPayload): Promise<SaveChartResponse> {
  return chartsApiRequest<SaveChartResponse>(
    () => api.post('/charts/save-chart', payload),
    'Failed to save chart',
  );
}

export interface UpdateChartPayload extends CreateChartPayload {
  chart_id?: string | number;
  id?: string | number;
}

export interface UpdateChartResponse {
  status: boolean;
  message: string;
  data: any[];
  columns: string[];
  drilldown_applied: boolean;
}

export async function updateChart(payload: UpdateChartPayload | any): Promise<UpdateChartResponse> {
  try {
    // If caller already passed the wrapped request body (contains payload.data),
    // use it as-is to avoid double-wrapping. Otherwise, wrap the payload.
    const requestBody = (payload && payload.payload && payload.payload.data)
      ? payload
      : {
          payload: {
            data: payload,
            actions: 'update_chart',
            stmt_date: payload?.stmt_date || ''
          }
        }
    // Same as create: workflow payloads carry `node_id`; ensure `unique_id` is set for update-chart.
    // Default `previous_unique_id` when omitted so backends always receive it on update.
    try {
      const dataObj = requestBody?.payload?.data;
      if (dataObj && !dataObj.unique_id && dataObj.node_id) {
        dataObj.unique_id = dataObj.node_id;
      }
      if (dataObj) {
        const prevRaw = dataObj.previous_unique_id;
        const hasPrev = prevRaw != null && String(prevRaw).trim() !== '';
        if (!hasPrev) {
          const fallback = String(dataObj.unique_id ?? dataObj.node_id ?? '').trim();
          if (fallback) dataObj.previous_unique_id = fallback;
        }
      }
    } catch (e) {
      // ignore
    }

    console.debug('updateChart requestBody:', requestBody)
    const key = `updateChart:${JSON.stringify(requestBody)}`
    if (pendingRequests.has(key)) {
      console.warn('updateChart already in progress for same payload — returning existing promise')
      return pendingRequests.get(key)
    }

    const promise = chartsApiRequest<UpdateChartResponse>(
      () => api.post('/charts/update-chart', requestBody),
      'Failed to update chart',
    ).finally(() => {
      pendingRequests.delete(key)
    })

    pendingRequests.set(key, promise)
    return promise
  } catch (error) {
    console.error('Failed to update chart:', error)
    throw error
  }
}

/**
 * Update chart with streaming support for large datasets
 * Returns the raw Response object for streaming
 */
export async function updateChartStreaming(
  payload: UpdateChartPayload | any, 
  signal?: AbortSignal
): Promise<Response> {
  try {
    // Avoid double-wrapping if payload already in the { payload: { data: ... } } shape
    const requestBody = (payload && payload.payload && payload.payload.data)
      ? payload
      : {
          payload: {
            data: payload,
            actions: 'update_chart',
            stmt_date: payload?.stmt_date || ''
          }
        }
    try {
      const dataObj = requestBody?.payload?.data;
      if (dataObj && !dataObj.unique_id && dataObj.node_id) {
        dataObj.unique_id = dataObj.node_id;
      }
      if (dataObj) {
        const prevRaw = dataObj.previous_unique_id;
        const hasPrev = prevRaw != null && String(prevRaw).trim() !== '';
        if (!hasPrev) {
          const fallback = String(dataObj.unique_id ?? dataObj.node_id ?? '').trim();
          if (fallback) dataObj.previous_unique_id = fallback;
        }
      }
    } catch (e) {
      // ignore
    }

    console.debug('updateChartStreaming requestBody:', requestBody)
    return await postStreamingResponse(
      '/charts/update-chart',
      requestBody,
      signal,
      'Failed to update chart',
    );
  } catch (error) {
    console.error('Failed to update chart with streaming:', error);
    if ((error as Error).name === 'AbortError') throw error;
    if (error instanceof ApiRequestError) throw error;
    toast.error(getDisplayErrorMessage(error, 'Failed to update chart'));
    await rethrowApiError(error, 'Failed to update chart');
  }
}

export interface GetUniqueValuesPayload {
  flow_id: string;
  stmt_date?: string;
  source?: string;
  column: string;
}

export interface GetUniqueValuesResponse {
  status: boolean;
  message: string;
  column: string;
  unique_values: string[];
}

export async function getUniqueValues(payload: GetUniqueValuesPayload): Promise<GetUniqueValuesResponse> {
  const key = `getUniqueValues:${JSON.stringify(payload)}`
  if (pendingRequests.has(key)) return pendingRequests.get(key)

  const promise = (async () => {
    try {
      return await chartsApiRequest<GetUniqueValuesResponse>(
        () => api.post('/charts/get-unique-values', payload),
        'Failed to fetch unique values',
      );
    } finally {
      pendingRequests.delete(key)
    }
  })()

  pendingRequests.set(key, promise)
  return promise
}

/** Analytics Studio database source — separate payload; does not affect workflow getUniqueValues. */
export type AnalyticsStudioUniqueValuesPayload =
  | {
      flow_id: string;
      source_type: 'database';
      connection_id: string;
      database_name: string;
      schema_name: string;
      table_name: string;
      column: string;
      params: {
        fetch_type: 'table';
        limit: number;
      };
    }
  | {
      flow_id: string;
      source_type: 'database';
      connection_id: string;
      database_name: string;
      column: string;
      params: {
        fetch_type: 'query';
        query: string;
        limit: number;
      };
    };

export async function getAnalyticsStudioUniqueValues(
  payload: AnalyticsStudioUniqueValuesPayload,
): Promise<GetUniqueValuesResponse> {
  const key = `getAnalyticsStudioUniqueValues:${JSON.stringify(payload)}`;
  if (pendingRequests.has(key)) return pendingRequests.get(key);

  const promise = (async () => {
    try {
      return await chartsApiRequest<GetUniqueValuesResponse>(
        () => api.post('/charts/get-unique-values', payload),
        'Failed to fetch unique values',
      );
    } finally {
      pendingRequests.delete(key);
    }
  })();

  pendingRequests.set(key, promise);
  return promise;
}

export interface DeleteChartPayload {
  chart_id: number;
}

export interface DeleteChartResponse {
  status: boolean;
  message: string;
  data?: any;
}

export async function deleteChart(payload: DeleteChartPayload): Promise<DeleteChartResponse> {
  return chartsApiRequest<DeleteChartResponse>(
    () => api.post('/charts/delete-chart', payload),
    'Failed to delete chart',
  );
} 