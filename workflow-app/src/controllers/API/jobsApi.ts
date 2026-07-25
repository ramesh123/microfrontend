import {
  ApiResponse,
  FlowJob,
  JobsFilter,
  StatusChartData,
  Task,
  TaskRunsChartData,
  TaskRunsChartRequest,
} from '@/types/jobs';
import api from './api';
import { executeApiRequestSilent } from '@/utils/exceptionHelper';
import { addDays, endOfDay, format, startOfDay } from 'date-fns';

// Prevent duplicate concurrent requests for same params
const pendingRequests: Map<string, Promise<any>> = new Map();

function makeKey(name: string, payload: any) {
  try {
    return `${name}:${JSON.stringify(payload)}`
  } catch (e) {
    return `${name}:${String(payload)}`
  }
}

function escapeSqlStringLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function normalizeFlowJobsQueryForTodayYesterday(q: string): string {
  const todayStr = formatLocalYmd(new Date());
  const yesterdayStr = formatLocalYmd(addDays(new Date(), -1));
  const targets = new Set([todayStr, yesterdayStr]);

  // Replace only the exact single-day BETWEEN clause produced by older clients.
  // Keep all other query formats unchanged.
  return q.replace(
    /created_at\s+BETWEEN\s+'(\d{4}-\d{2}-\d{2})'\s+AND\s+'(\d{4}-\d{2}-\d{2})'/gi,
    (match, fromStr: string, toStr: string) => {
      if (fromStr !== toStr) return match;
      if (!targets.has(fromStr)) return match;
      return `DATE(created_at) = '${fromStr}'`;
    },
  );
}

export function formatFlowStatusAxisLabel(status: string): string {
  return status
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function canonicalStatusKey(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, '_');
}

/**
 * Normalizes API responses such as `{ status: true, data: [{ status, count }] }`.
 * Returns one row per distinct API status (no aggregation into "Other").
 */
export function normalizeFlowStatusCountsResponse(raw: unknown): StatusChartData[] {
  const tallies = new Map<string, number>();

  const addEntry = (statusRaw: string, count: number) => {
    const key = canonicalStatusKey(statusRaw);
    if (!key) return;
    const n = Math.round(Number(count));
    if (!Number.isFinite(n)) return;
    tallies.set(key, (tallies.get(key) ?? 0) + n);
  };

  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (!row || typeof row !== 'object') continue;
      const o = row as Record<string, unknown>;
      const status = o.job_status ?? o.status ?? o.name ?? o.state;
      const count = o.count ?? o.cnt ?? o.total ?? o.value;
      if (status != null) addEntry(String(status), Number(count));
    }
  } else if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const nested = o.data ?? o.counts ?? o.result;
    if (nested !== undefined && nested !== raw) {
      return normalizeFlowStatusCountsResponse(nested);
    }
    for (const [k, v] of Object.entries(o)) {
      if (['data', 'message', 'success', 'error', 'total', 'status'].includes(k)) continue;
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) continue;
      const n = typeof v === 'number' ? v : Number(v);
      if (Number.isFinite(n)) addEntry(k, n);
    }
  }

  return [...tallies.entries()].map(([status, count]) => ({
    status,
    count,
    label: formatFlowStatusAxisLabel(status),
  }));
}

/** `YYYY-MM-DD` in local calendar — matches history.tsx date strings for `q`. */
function formatLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * SQL fragment for flow list API (`q`), same pattern as history.tsx:
 * `created_at BETWEEN 'YYYY-MM-DD' AND 'YYYY-MM-DD'`
 */
export function buildFlowJobsCreatedAtBetweenClause(filters: JobsFilter): string | undefined {
  if (filters.dateRange?.from) {
    const from = filters.dateRange.from;
    const to = filters.dateRange.to ?? filters.dateRange.from;
    const fromStr = formatLocalYmd(from);
    const toStr = formatLocalYmd(to);
    return `created_at BETWEEN '${fromStr}' AND '${toStr}'`;
  }

  if (filters.timeRange === 'all') {
    return undefined;
  }

  if (!filters.timeRange) {
    return undefined;
  }

  let from: Date;
  let to: Date = new Date();
  switch (filters.timeRange) {
    case 'today':
      from = new Date();
      break;
    case 'yesterday': {
      const y = addDays(new Date(), -1);
      from = y;
      to = y;
      break;
    }
    case 'last_15_days':
      from = addDays(new Date(), -15);
      break;
    case 'last_30_days':
      from = addDays(new Date(), -30);
      break;
    case 'last_90_days':
      from = addDays(new Date(), -90);
      break;
    case 'last_7_days':
    default:
      from = addDays(new Date(), -7);
      break;
  }

  const fromStr = formatLocalYmd(from);
  const toStr = formatLocalYmd(to);
  return `created_at BETWEEN '${fromStr}' AND '${toStr}'`;
}

/** Local `yyyy-MM-dd HH:mm` for status-counts API (start/end of day, no seconds). */
function formatFlowExecApiDateTime(d: Date): string {
  return format(d, 'yyyy-MM-dd HH:mm');
}

/** Body for POST `/flow-exec-details-log/get-status-counts` — empty strings = no time filter. */
export function buildFlowStatusCountsPayload(filters: JobsFilter): {
  flow_name: string;
  start_time: string;
  end_time: string;
} {
  const flow_name = filters.deploymentName ?? '';

  if (filters.timeRange === 'all' && !filters.dateRange?.from) {
    return { flow_name, start_time: '', end_time: '' };
  }

  let from: Date | undefined;
  let to: Date | undefined;

  if (filters.dateRange?.from) {
    from = filters.dateRange.from;
    to = filters.dateRange.to ?? filters.dateRange.from;
  } else if (filters.timeRange && filters.timeRange !== 'all') {
    to = new Date();
    switch (filters.timeRange) {
      case 'today':
        from = new Date();
        break;
      case 'yesterday': {
        const y = addDays(new Date(), -1);
        from = y;
        to = y;
        break;
      }
      case 'last_30_days':
        from = addDays(new Date(), -30);
        break;
      case 'last_7_days':
      default:
        from = addDays(new Date(), -7);
        break;
    }
  }

  if (!from) {
    return { flow_name, start_time: '', end_time: '' };
  }
  const end = to ?? from;
  return {
    flow_name,
    start_time: formatFlowExecApiDateTime(startOfDay(from)),
    end_time: formatFlowExecApiDateTime(endOfDay(end)),
  };
}

export const jobsApi = {
  getFlowStatusCounts: async (payload: {
    flow_name: string;
    start_time: string;
    end_time: string;
  }): Promise<StatusChartData[]> => {
    const key = makeKey('getFlowStatusCounts', payload);
    if (pendingRequests.has(key)) return pendingRequests.get(key)!;

    const promise = (async () => {
      try {
        const body: Record<string, string> = { flow_name: payload.flow_name };
        if (payload.start_time) body.start_time = payload.start_time;
        if (payload.end_time) body.end_time = payload.end_time;
        const responseData = await executeApiRequestSilent(
          () => api.post('/flow-exec-details-log/get-status-counts', body),
          'Failed to load flow status counts',
        );
        return normalizeFlowStatusCountsResponse(responseData);
      } finally {
        pendingRequests.delete(key);
      }
    })();

    pendingRequests.set(key, promise);
    return promise;
  },

  getFlowJobs: async (params: {
    skip?: number;
    limit?: number;
    /** When true, omit `skip` and `limit` so the API returns the full filtered set (used with date `q`). */
    omitPagination?: boolean;
    search_text?: string;
    q?: string;
    sort?: Record<string, "asc" | "desc">;
  }): Promise<ApiResponse<FlowJob>> => {
    // Convert sort object to JSON string if it exists
    const processedParams: Record<string, unknown> = {};
    if (params.search_text != null) {
      processedParams.search_text = params.search_text;
    }
    if (params.q != null) {
      processedParams.q =
        typeof params.q === 'string' ? normalizeFlowJobsQueryForTodayYesterday(params.q) : params.q;
    }
    if (params.sort) {
      processedParams.sort = JSON.stringify(params.sort);
    }
    if (!params.omitPagination) {
      processedParams.skip = params.skip ?? 0;
      processedParams.limit = params.limit ?? 10;
    }

    const key = makeKey('getFlowJobs', processedParams)
    if (pendingRequests.has(key)) return pendingRequests.get(key)

    const promise = (async () => {
      try {
        const responseData = await executeApiRequestSilent(
          () => api.get('/flow-exec-details-log', { params: processedParams }),
          'Failed to fetch flow jobs',
        );

        const data = Array.isArray(responseData) ? responseData : responseData?.data || [];

        const skip = params.skip ?? 0;
        const limit = params.limit ?? 10;
        const rawTotal = responseData?.total;
        const total =
          rawTotal !== undefined && rawTotal !== null && !Number.isNaN(Number(rawTotal))
            ? Number(rawTotal)
            : params.omitPagination
              ? data.length
              : data.length === limit
                ? skip * limit + data.length + 1
                : skip * limit + data.length;

        return {
          data,
          total,
          count: responseData?.count ?? data.length,
        };
      } finally {
        pendingRequests.delete(key)
      }
    })()

    pendingRequests.set(key, promise)
    return promise
  },

  getTasks: async (params: {
    flow_run_id: string;
    skip?: number;
    limit?: number;
    search_text?: string;
  }): Promise<ApiResponse<Task>> => {
    const flowId = escapeSqlStringLiteral(params.flow_run_id);
    const search = (params.search_text ?? '').trim();
    let q = `flow_run_id='${flowId}'`;
    if (search) {
      const term = escapeSqlStringLiteral(search);
      q += ` AND LOWER(task_name) LIKE LOWER('%${term}%')`;
    }
    const queryParams = {
      q,
      skip: params.skip || 0,
      limit: params.limit || 100,
      search_text: search,
    };
    const key = makeKey('getTasks', queryParams)
    if (pendingRequests.has(key)) return pendingRequests.get(key)

    const promise = (async () => {
      try {
        return executeApiRequestSilent(
          () => api.get('/task-details', { params: queryParams }),
          'Failed to fetch tasks',
        );
      } finally {
        pendingRequests.delete(key)
      }
    })()

    pendingRequests.set(key, promise)
    return promise
  },

  getTaskRunsChart: async (payload: TaskRunsChartRequest): Promise<TaskRunsChartData> => {
    const key = makeKey('getTaskRunsChart', payload);
    if (pendingRequests.has(key)) return pendingRequests.get(key)!;

    const promise = (async () => {
      try {
        const body = await executeApiRequestSilent(
          () => api.post('/task-details/get-task-runs-chart', payload),
          'Failed to load task runs chart',
        );
        const inner = body?.data ?? body;
        const chartData = Array.isArray(inner?.chartData)
          ? inner.chartData.map((row: Record<string, unknown>) => ({
              date: String(row.date ?? ''),
              Completed: Number(row.Completed ?? 0) || 0,
              Running: Number(row.Running ?? 0) || 0,
              Failed: Number(row.Failed ?? 0) || 0,
            }))
          : [];
        return {
          total: Number(inner?.total ?? 0) || 0,
          summary: (inner?.summary ?? {}) as TaskRunsChartData['summary'],
          chartData,
        };
      } finally {
        pendingRequests.delete(key);
      }
    })();

    pendingRequests.set(key, promise);
    return promise;
  },
};
