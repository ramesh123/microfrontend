import api, { API_BASE_URL } from './api';
import { toast } from 'sonner';
import {
  ApiRequestError,
  assertBlobNotApiError,
  executeApiRequestSilent,
  getDisplayErrorMessage,
  resolveApiErrorMessage,
  rethrowApiError,
} from '@/utils/exceptionHelper';

// Prevent duplicate concurrent requests for the same payload/action
const pendingRequests: Map<string, Promise<any>> = new Map();

function makeKey(name: string, payload: any) {
  try {
    return `${name}:${JSON.stringify(payload)}`
  } catch (e) {
    return `${name}:${String(payload)}`
  }
}

function unwrapResponseData<T>(json: unknown): T {
  if (json && typeof json === 'object' && 'data' in json) {
    return (json as { data: T }).data;
  }
  return json as T;
}

/** Axios fetch-adapter streaming POST; returns native `Response` for `body.getReader()`. */
async function reconciliationStreamingPost(
  path: string,
  body: unknown,
  signal: AbortSignal | undefined,
  fallbackMessage: string,
): Promise<Response> {
  const axiosRes = await api.post<ReadableStream<Uint8Array>>(path, body, {
    adapter: 'fetch',
    responseType: 'stream',
    signal,
    validateStatus: () => true,
  });

  const { status, statusText, data: stream } = axiosRes;

  if (status < 200 || status >= 300) {
    let errBody = null;
    try {
      if (stream) {
        const text = await new Response(stream).text();
        errBody = text ? JSON.parse(text) : null;
      } else if (
        axiosRes.data &&
        typeof axiosRes.data === 'object' &&
        !(axiosRes.data instanceof ReadableStream)
      ) {
        errBody = axiosRes.data;
      }
    } catch {
      /* ignore parse errors */
    }
    const message = resolveApiErrorMessage(errBody, `${fallbackMessage} (${status})`);
    toast.info(message);
    throw new ApiRequestError(message, errBody ?? undefined);
  }

  const headers = new Headers();
  Object.entries(axiosRes.headers ?? {}).forEach(([key, value]) => {
    if (value != null) headers.set(key, String(value));
  });

  return new Response(stream, { status, statusText, headers });
}

async function reconciliationPost<T>(
  path: string,
  payload: unknown,
  fallbackMessage: string,
): Promise<T> {
  try {
    const json = await executeApiRequestSilent(
      () => api.post(path, payload),
      fallbackMessage,
    );
    return unwrapResponseData<T>(json);
  } catch (error: unknown) {
    console.error(fallbackMessage, error);
    if ((error as Error)?.name !== 'AbortError') {
      toast.info(getDisplayErrorMessage(error, fallbackMessage));
    }
    throw error;
  }
}


export interface GetSummaryCardsPayload {
  flow_id: string;
  stmt_date?: string;
  [key: string]: any;
}

export interface GetSummaryTablePayload {
  flow_id: string;
  stmt_date?: string;
  [key: string]: any;
}

/** Summary table row shape from API: { status, message, data: SummaryTableRow[] } */
export interface SummaryTableRow {
  source: string;
  flow_id: string;
  flow_name: string;
  flow_run_id: string;
  statement_date: string;
  cycle_number: string;
  execution_date_time: string;
  matched_count: number;
  matched_amount: number;
  unmatched_count: number;
  unmatched_amount: number;
  carry_forward_matched_amount: number;
  carry_forward_matched_count: number;
  carry_forward_unmatched_amount: number;
  carry_forward_unmatched_count: number;
  reversal_amount: number;
  reversal_count: number;
  force_matched_amount: number;
  force_matched_count: number;
  closing_balance: number;
  rollback_awaiting: number;
  auth_awaiting: number;
}

export interface GetDashboardDataPayload {
  flow_id: string;
  stmt_date?: string;
  cycle_number?: string;
  payload: {
    operation: string;
    source_name?: string;
  };
}

export interface SaveTablePayload {
  flow_id: string;
  table_id: string;
  settings: {
    gFilter: any[];
    sortoptions: {
      active: string;
      direction: string;
    };
  };
  data: any[];
}

export interface GetProcessExecutionPayload {
  flow_id: string;
}

export interface GetReportFilesPayload {
  flow_id: string;
  process_cycle?: string;
  execution_number?: string;
  stmt_date?: string;
}

export interface DownloadReportFilePayload {
  flow_id: string;
  file_name: string;
  process_cycle?: string;
  execution_number?: string;
  stmt_date?: string;
}

export interface GetMinioFilesPayload {
  flow_id: string;
  stmt_date: string;
}

export interface DownloadMinioFilePayload {
  file_path: string;
}

export interface GetReconSourceColumnsPayload {
  flow_id: string;
}

export interface GetDashboardDataStreamingPayload {
  flow_id: string;
  stmt_date?: string;
  cycle_number?: string;
  payload: {
    operation: string;
    source_name?: string | boolean;
    all_records: boolean;
  };
}

export interface BulkUploadForceMatchPayload {
  flow_id: string;
  operation: string;
  comments: string;
  stmt_date: string;
  cycle_number?: string;
  file: File;
}

export interface UploadBulkForceMatchRecordsPayload {
  flow_id: string;
  stmt_date: string;
  cycle_number?: string;
  match_records: boolean;
  file: File;
}

export interface DownloadBulkForceMatchRecordsPayload {
  flow_id: string;
  stmt_date: string;
  source_columns: Array<{ source_name: string; columns: string[] }>;
  is_unmatched: boolean;
  is_matched: boolean;
}

export interface GetForceMatchSuggestionsPayload {
  flow_id: string;
  stmt_date?: string;
  cycle_number?: string;
  flow_run_id?: string;
  execution_number?: string;
}

export interface ForceMatchSuggestionDownloadSheet {
  source: string;
  sheet_name: string;
  record_count: number;
}

export interface ForceMatchSuggestionDownload {
  download_id: string;
  file_name: string;
  download_url?: string;
  download_endpoint?: string;
  download_method?: string;
  record_count: number;
  source_sheets: ForceMatchSuggestionDownloadSheet[];
  encrypted_file_key?: string;
}

export interface ForceMatchSuggestionItem {
  suggestion_id: string;
  not_matched_reason: string;
  suggestion_status?: string;
  can_force_match?: boolean;
  system_ref_ids?: Record<string, string[]>;
  download: ForceMatchSuggestionDownload;
}

export interface ForceMatchSuggestionsResponse {
  status?: boolean;
  message?: string;
  ui_message?: string;
  strategy?: {
    strategy_name?: string;
    confidence_thresholds?: {
      minimum?: number;
      [key: string]: unknown;
    };
    generated_by?: string;
    [key: string]: unknown;
  };
  data?: ForceMatchSuggestionItem[];
}

function extractDownloadFilename(contentDisposition: string | undefined, fallback: string): string {
  if (!contentDisposition) return fallback;
  const match = contentDisposition.match(/filename="([^"]+)"|filename=([^\s;]+)/i);
  if (!match) return fallback;
  return (match[1] || match[2]).replace(/^["']|["']$/g, "");
}

export async function downloadForceMatchSuggestionFile(download: ForceMatchSuggestionDownload) {
  const fallbackMessage = "Failed to download force match suggestion file";

  try {
    const response = await api.post(
      "/summary/download-force-match-suggestion",
      {
        download_id: download.download_id,
      },
      {
        responseType: "blob",
      }
    );

    await assertBlobNotApiError(response.data, fallbackMessage);

    const blob = response.data as Blob;
    const contentDisposition = response.headers?.["content-disposition"] as string | undefined;
    const filename = extractDownloadFilename(contentDisposition, download.file_name || "suggestion-download");

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error: unknown) {
    console.error(fallbackMessage, error);
    toast.info(getDisplayErrorMessage(error, fallbackMessage));
    throw error;
  }
}

export interface PerformActionPayload {
  flow_id: string;
  operation?: string;
  comments: string;
  stmt_date?: string;
  cycle_number?: string;
  records: Array<Record<string, string[]>>;
}

/**
 * Get summary cards data
 */
export async function getSummaryCards(payload: GetSummaryCardsPayload) {
  const key = makeKey('getSummaryCards', payload)
  if (pendingRequests.has(key)) return pendingRequests.get(key)

  const promise = (async () => {
    try {
      return await reconciliationPost('/summary/get-summary-cards', payload, 'Failed to fetch summary cards');
    } finally {
      pendingRequests.delete(key)
    }
  })()

  pendingRequests.set(key, promise)
  return promise
}

/**
 * Get summary table data
 */
export async function getSummaryTable(payload: GetSummaryTablePayload) {
  const key = makeKey('getSummaryTable', payload)
  if (pendingRequests.has(key)) return pendingRequests.get(key)

  const promise = (async () => {
    try {
      const response = await executeApiRequestSilent(
        () => api.post('/summary/get-summary-table', payload),
        'Failed to fetch summary table',
      );
      const body = response as { status?: boolean; message?: string; data?: SummaryTableRow[] };
      const rows = Array.isArray(body?.data) ? body.data : (Array.isArray(response) ? response : []);
      return {
        status: body?.status ?? true,
        message: body?.message,
        data: rows,
      };
    } catch (error: unknown) {
      console.error('Failed to fetch summary table:', error);
      if ((error as Error)?.name !== 'AbortError') {
        toast.info(getDisplayErrorMessage(error, 'Failed to fetch summary table.'));
      }
      throw error;
    } finally {
      pendingRequests.delete(key)
    }
  })()

  pendingRequests.set(key, promise)
  return promise
}

/**
 * Get dashboard data for clicked cell
 */
export async function getDashboardData(payload: GetDashboardDataPayload) {
  const key = makeKey('getDashboardData', payload)
  if (pendingRequests.has(key)) return pendingRequests.get(key)

  const promise = (async () => {
    try {
      return await reconciliationPost('/summary/get-dashboard-data', payload, 'Failed to fetch dashboard data');
    } finally {
      pendingRequests.delete(key)
    }
  })()

  pendingRequests.set(key, promise)
  return promise
}

/**
 * Get available statement dates for a flow
 */
export async function getStatementDates(payload: { flow_id: string }) {
  const key = makeKey('getStatementDates', payload)
  if (pendingRequests.has(key)) return pendingRequests.get(key)

  const promise = (async () => {
    try {
      return await reconciliationPost('/summary/get-statement-date', payload, 'Failed to fetch statement dates');
    } finally {
      pendingRequests.delete(key)
    }
  })()

  pendingRequests.set(key, promise)
  return promise
}

/**
 * Save chart table settings and data
 */
export async function saveChartTable(payload: SaveTablePayload) {
  return reconciliationPost('/chart-table/save-table', payload, 'Failed to save table');
}

/**
 * Get process execution dropdown options
 */
export async function getProcessExecution(payload: GetProcessExecutionPayload) {
  const key = makeKey('getProcessExecution', payload)
  if (pendingRequests.has(key)) return pendingRequests.get(key)

  const promise = (async () => {
    try {
      return await reconciliationPost(
        '/flow-reports/get-process-execution',
        payload,
        'Failed to fetch process execution options',
      );
    } finally {
      pendingRequests.delete(key)
    }
  })()

  pendingRequests.set(key, promise)
  return promise
}

/**
 * Get report files list
 */
export async function getReportFiles(payload: GetReportFilesPayload) {
  const key = makeKey('getReportFiles', payload)
  if (pendingRequests.has(key)) return pendingRequests.get(key)

  const promise = (async () => {
    try {
      return await reconciliationPost('/flow-reports/get-report-files', payload, 'Failed to fetch report files');
    } finally {
      pendingRequests.delete(key)
    }
  })()

  pendingRequests.set(key, promise)
  return promise
}

/**
 * Download report file
 */
export async function downloadReportFile(payload: DownloadReportFilePayload) {
  try {
    const blob = await executeApiRequestSilent(
      () =>
        api.post('/flow-reports/download-report-file', payload, { responseType: 'blob' }),
      'Failed to download report file',
    );
    return blob;
  } catch (error: unknown) {
    console.error('Failed to download report file:', error);
    toast.info(getDisplayErrorMessage(error, 'Failed to download report file.'));
    throw error;
  }
}

/**
 * List files stored for a flow in MinIO (reconciliation reports bucket).
 */
export async function getMinioFilesForFlow(payload: GetMinioFilesPayload) {
  const key = makeKey('getMinioFilesForFlow', payload);
  if (pendingRequests.has(key)) return pendingRequests.get(key);

  const promise = (async () => {
    try {
      return await reconciliationPost('/flow-reports/get-minio-files', payload, 'Failed to fetch MinIO files');
    } finally {
      pendingRequests.delete(key);
    }
  })();

  pendingRequests.set(key, promise);
  return promise;
}

function resolveDownloadHrefFromMinioResponse(data: unknown, filePath: string): string | null {
  if (data == null) return null;
  if (typeof data === 'string') {
    const s = data.trim();
    if (!s) return null;
    if (s.startsWith('http://') || s.startsWith('https://')) return s;
    if (s.startsWith('/')) return `${API_BASE_URL.replace(/\/$/, '')}${s}`;
    return `${API_BASE_URL.replace(/\/$/, '')}/${s.replace(/^\/+/, '')}`;
  }
  if (typeof data === 'object') {
    const o = data as Record<string, unknown>;
    const inner = (o.data ?? o) as Record<string, unknown>;
    const url =
      (typeof inner.url === 'string' && inner.url) ||
      (typeof inner.download_url === 'string' && inner.download_url) ||
      (typeof inner.signed_url === 'string' && inner.signed_url) ||
      (typeof inner.file_url === 'string' && inner.file_url) ||
      (typeof inner.path === 'string' && inner.path);
    if (url) return resolveDownloadHrefFromMinioResponse(url, filePath);
  }
  return null;
}

/**
 * Request a download for a MinIO object path. Handles JSON (URL/path) or binary blob responses.
 */
export async function downloadMinioFileFromFlow(payload: DownloadMinioFilePayload) {
  try {
    const response = await api.post('/flow-reports/download-minio-file', payload, {
      responseType: 'blob',
    });
    if (response.status !== 200) throw new Error('Download failed');

    const blob: Blob = response.data;
    const ct = blob.type || '';

    if (ct.includes('json') || ct === '' || ct === 'text/plain') {
      const text = await blob.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        const href = resolveDownloadHrefFromMinioResponse(text.trim(), payload.file_path);
        if (href) {
          window.open(href, '_blank', 'noopener,noreferrer');
          return;
        }
        throw new Error('Unexpected download response');
      }
      const href = resolveDownloadHrefFromMinioResponse(parsed, payload.file_path);
      if (href) {
        window.open(href, '_blank', 'noopener,noreferrer');
        return;
      }
      throw new Error('No download URL in response');
    }

    const disposition = (response.headers?.['content-disposition'] || '') as string;
    const nameMatch = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    let fileName = nameMatch?.[1]?.replace(/['"]/g, '')?.trim();
    if (!fileName) {
      const parts = payload.file_path.split(/[/\\]/);
      fileName = parts[parts.length - 1] || 'download';
    }
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error: unknown) {
    console.error('Failed to download MinIO file:', error);
    toast.info(getDisplayErrorMessage(error, 'Failed to download MinIO file.'));
    throw error;
  }
}

/**
 * Get reconciliation source columns
 */
export async function getReconSourceColumns(payload: GetReconSourceColumnsPayload) {
  const key = makeKey('getReconSourceColumns', payload)
  if (pendingRequests.has(key)) return pendingRequests.get(key)

  const promise = (async () => {
    try {
      return await reconciliationPost(
        '/summary/get-recon-source-columns',
        payload,
        'Failed to fetch source columns',
      );
    } finally {
      pendingRequests.delete(key)
    }
  })()

  pendingRequests.set(key, promise)
  return promise
}

/**
 * Get dashboard data with streaming support.
 * Returns a native `Response` for consumers using `response.body.getReader()`.
 */
export async function getDashboardDataStreaming(
  payload: GetDashboardDataStreamingPayload,
  signal?: AbortSignal
): Promise<Response> {
  try {
    return await reconciliationStreamingPost(
      '/summary/get-dashboard-data',
      payload,
      signal,
      'Failed to fetch dashboard data',
    );
  } catch (error: unknown) {
    console.error('Failed to fetch dashboard data (streaming):', error);
    if ((error as Error)?.name === 'AbortError') throw error;
    if (error instanceof ApiRequestError) throw error;
    toast.info(getDisplayErrorMessage(error, 'Failed to fetch dashboard data.'));
    await rethrowApiError(error, 'Failed to fetch dashboard data.');
  }
}

/**
 * Bulk upload force match with file
 */
export async function bulkUploadForceMatch(payload: BulkUploadForceMatchPayload) {
  const formData = new FormData();
  formData.append('file', payload.file);
  formData.append('flow_id', payload.flow_id);
  formData.append('operation', payload.operation);
  formData.append('comments', payload.comments);
  formData.append('stmt_date', payload.stmt_date);
  if (payload.cycle_number) {
    formData.append('cycle_number', payload.cycle_number);
  }

  return reconciliationPost(
    '/summary/bulk-upload-force-match',
    formData,
    'Failed to upload bulk force match',
  );
}

/**
 * Upload bulk force match records
 */
export async function uploadBulkForceMatchRecords(payload: UploadBulkForceMatchRecordsPayload) {
  try {
    const formData = new FormData();
    formData.append('file', payload.file);
    formData.append('stmt_date', payload.stmt_date);
    formData.append('match_records', String(payload.match_records));
    if (payload.cycle_number) {
      formData.append('cycle_number', payload.cycle_number);
    }

    const json = await executeApiRequestSilent(
      () =>
        api.post(
          `/summary/upload-bulk-force-match-records?flow_id=${encodeURIComponent(payload.flow_id)}`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } },
        ),
      'Failed to upload bulk force match records',
    );
    return (json as { data?: unknown })?.data ?? json;
  } catch (error: unknown) {
    console.error('Failed to upload bulk force match records:', error);
    if ((error as Error)?.name !== 'AbortError') {
      toast.info(getDisplayErrorMessage(error, 'Failed to upload bulk force match records.'));
    }
    throw error;
  }
}

/**
 * Download bulk force match records
 */
export async function downloadBulkForceMatchRecords(payload: DownloadBulkForceMatchRecordsPayload) {
  const fallbackMessage = 'Failed to download bulk force match records';
  try {
    const response = await api.post('/summary/download-bulk-force-match-records', payload, {
      responseType: 'blob',
    });
    await assertBlobNotApiError(response.data, fallbackMessage);
    return {
      data: response.data,
      headers: response.headers,
    };
  } catch (error: unknown) {
    console.error(fallbackMessage, error);
    toast.info(getDisplayErrorMessage(error, fallbackMessage));
    throw error;
  }
}

/**
 * Fetch force match suggestions for the current reconciliation context.
 */
export async function getForceMatchSuggestions(payload: GetForceMatchSuggestionsPayload) {
  const key = makeKey('getForceMatchSuggestions', payload);
  if (pendingRequests.has(key)) return pendingRequests.get(key);

  const promise = (async () => {
    try {
      let flowRunId = payload.flow_run_id;
      let stmtDate = payload.stmt_date;
      let executionNumber = payload.execution_number;

      if (!flowRunId && payload.flow_id) {
        try {
          const datesRes = await getStatementDates({ flow_id: payload.flow_id });
          const datesList = Array.isArray(datesRes) ? datesRes : (datesRes?.data || []);
          if (datesList.length > 0) {
            let matched;
            if (stmtDate) {
              matched = datesList.find((item: any) => item?.stmt_date === stmtDate);
            } else {
              matched = datesList[0];
            }
            if (matched) {
              if (matched.flow_run_id) {
                flowRunId = matched.flow_run_id;
              }
              if (!stmtDate && matched.stmt_date) {
                stmtDate = matched.stmt_date;
              }
              if (!executionNumber && matched.execution_number) {
                executionNumber = matched.execution_number;
              }
            }
          }
        } catch (err) {
          console.error('Failed to auto-fetch flow_run_id from statement dates:', err);
        }
      }

      const finalPayload = {
        ...payload,
        flow_run_id: flowRunId || undefined,
        stmt_date: stmtDate || undefined,
        execution_number: executionNumber || undefined,
      };

      const response = await executeApiRequestSilent(
        () => api.post('/summary/get-force-match-suggestions', finalPayload),
        'Failed to fetch force match suggestions',
      );
      const body = response as ForceMatchSuggestionsResponse;
      return {
        status: body?.status ?? true,
        message: body?.message,
        ui_message: body?.ui_message,
        strategy: body?.strategy,
        data: Array.isArray(body?.data) ? body.data : [],
      } satisfies ForceMatchSuggestionsResponse;
    } finally {
      pendingRequests.delete(key);
    }
  })();

  pendingRequests.set(key, promise);
  return promise;
}

export interface ViewForceMatchSuggestionDataPayload {
  encrypted_file_key: string;
  sheet_name: string;
  type: string;
  file_type?: string;
  file_name?: string;
}

export interface ViewForceMatchSuggestionDataResponse {
  status?: boolean;
  data?: any[];
  columns?: string[];
  message?: string;
}

export async function viewForceMatchSuggestionData(
  payload: ViewForceMatchSuggestionDataPayload,
): Promise<ViewForceMatchSuggestionDataResponse> {
  return executeApiRequestSilent(
    () => api.post('/files/view-data', { payload }),
    'Failed to load force match suggestion data',
  );
}

/**
 * Perform action on records (force match, rollback, authorize, reject)
 */
export async function performReconciliationAction(
  action: 'force_match' | 'rollback' | 'authorize' | 'reject',
  payload: PerformActionPayload
) {
  try {
    const operation = payload.operation;
    const endpoints: Record<string, string> = {
      force_match: '/summary/force-match-records',
      rollback: '/summary/rollback-matched-records',
      authorize: (operation?.toLowerCase() === 'rollback_waiting' || operation?.toLowerCase() === 'rollback-waiting')
        ? '/summary/authorize-rollback-records'
        : '/summary/authorize-force-match-records',
      reject: (operation?.toLowerCase() === 'rollback_waiting' || operation?.toLowerCase() === 'rollback-waiting')
        ? '/summary/reject-rollback-records'
        : '/summary/reject-force-match-records',
    };

    const url = endpoints[action];
    if (!url) {
      throw new Error('No endpoint configured for this action');
    }

    return await executeApiRequestSilent(
      () => api.post(url, payload),
      'Failed to perform action',
    );
  } catch (error: unknown) {
    console.error('Failed to perform action:', error);
    if ((error as Error)?.name !== 'AbortError') {
      toast.info(getDisplayErrorMessage(error, 'Failed to perform action.'));
    }
    throw error;
  }
}

export async function getcycleWiseData(payload: { flow_id: string, stmt_date: string }) {
  const key = makeKey('getcycleWiseData', payload)
  if (pendingRequests.has(key)) return pendingRequests.get(key)

  const promise = (async () => {
    try {
      return await executeApiRequestSilent(
        () => api.post('/summary/get-cycle', payload),
        'Failed to fetch cycle wise data',
      );
    } catch (error: unknown) {
      console.error('Failed to fetch cycle wise data:', error);
      toast.info(getDisplayErrorMessage(error, 'Failed to fetch cycle wise data.'));
      throw error;
    } finally {
      pendingRequests.delete(key)
    }
  })()

  pendingRequests.set(key, promise)
  return promise
}

export interface GetReconciliationSummaryTrendsPayload {
  flow_id: string;
  start_date: string;
  end_date: string;
}

export interface GetAgeingSummaryPayload {
  flow_id: string;
  flow_run_id?: string;
  statement_date?: string;
  cycle_number?: string;
  execution_number?: string;
  source_name?: string[];
}

export interface ReconciliationSummaryTrendRow {
  flow_id: string;
  flow_name: string;
  statement_date: string;
  cycle_number: string;
  total_matched_amount: number;
  total_unmatched_amount: number;
  total_reversal_amount: number;
  total_matched_count: number;
  total_unmatched_count: number;
  total_reversal_count: number;
  matched_rate: number;
  unmatched_rate: number;
}

export interface TotalMatchedUnmatchedCountRow {
  total_matched_amount: number;
  total_unmatched_amount: number;
  total_reversal_amount: number;
  total_matched_count: number;
  total_unmatched_count: number;
  total_reversal_count: number;
  matched_rate: number;
  unmatched_rate: number;
}

export interface RemarksWiseAgeingSummaryRow {
  source_name: string;
  remarks: string;
  '0 Days': number;
  '1 Day': number;
  '2-7 Days': number;
  '8-15 Days': number;
  '16-30 Days': number;
  '>30 Days': number;
  total_count: number;
  total_amount: number;
  flow_id: string;
  flow_run_id: string;
}

export interface AgeingSummaryRow {
  flow_id: string;
  flow_run_id: string;
  statement_date: string;
  source_name: string;
  days_unmatched: number;
  source_count: number;
  source_amount: number;
  remarks: string;
  remarks_count: number;
  ERP_Invoice_count?: number;
  ERP_Invoice_amount?: number;
  // Backwards-compatible optional fields from the prior response shape.
  flow_name?: string;
  cycle_number?: string;
  source?: string;
  days_1_to_3_amount?: number;
  days_4_to_6_amount?: number;
  days_7_to_15_amount?: number;
  days_16_to_30_amount?: number;
  above_30_days_amount?: number;
  days_1_to_3_count?: number;
  days_4_to_6_count?: number;
  days_7_to_15_count?: number;
  days_16_to_30_count?: number;
  days_above_30_count?: number;
}

export async function getTotalMatchedUnmatchedCount(payload: GetReconciliationSummaryTrendsPayload) {
  const key = makeKey('getTotalMatchedUnmatchedCount', payload);
  if (pendingRequests.has(key)) return pendingRequests.get(key);

  const promise = (async () => {
    try {
      const rows = await reconciliationPost<TotalMatchedUnmatchedCountRow[]>(
        '/reconciliation-summary/get-total-matched-unmatched-count',
        payload,
        'Failed to fetch aging summary',
      );
      const list = Array.isArray(rows) ? rows : [];
      return list[0] ?? null;
    } finally {
      pendingRequests.delete(key);
    }
  })();

  pendingRequests.set(key, promise);
  return promise;
}

export async function getReconciliationSummaryTrends(payload: GetReconciliationSummaryTrendsPayload) {
  const key = makeKey('getReconciliationSummaryTrends', payload);
  if (pendingRequests.has(key)) return pendingRequests.get(key);

  const promise = (async () => {
    try {
      const rows = await reconciliationPost<ReconciliationSummaryTrendRow[]>(
        '/reconciliation-summary/get-reconciliation-summary-trends',
        payload,
        'Failed to fetch reconciliation trends',
      );
      return Array.isArray(rows) ? rows : [];
    } finally {
      pendingRequests.delete(key);
    }
  })();

  pendingRequests.set(key, promise);
  return promise;
}

export async function getAgeingSummary(payload: GetAgeingSummaryPayload) {
  const key = makeKey('getAgeingSummary', payload);
  if (pendingRequests.has(key)) return pendingRequests.get(key);

  const promise = (async () => {
    try {
      const rows = await reconciliationPost<AgeingSummaryRow[]>(
        '/reconciliation-summary/get-ageing-summary',
        payload,
        'Failed to fetch ageing summary',
      );
      return Array.isArray(rows) ? rows : [];
    } finally {
      pendingRequests.delete(key);
    }
  })();

  pendingRequests.set(key, promise);
  return promise;
}

export async function getRemarksWiseAgeingSummary(payload: GetAgeingSummaryPayload) {
  const key = makeKey('getRemarksWiseAgeingSummary', payload);
  if (pendingRequests.has(key)) return pendingRequests.get(key);

  const promise = (async () => {
    try {
      const rows = await reconciliationPost<RemarksWiseAgeingSummaryRow[]>(
        '/reconciliation-summary/remarks-wise-ageing-summary',
        payload,
        'Failed to fetch remarks-wise ageing summary',
      );
      return Array.isArray(rows) ? rows : [];
    } finally {
      pendingRequests.delete(key);
    }
  })();

  pendingRequests.set(key, promise);
  return promise;
}

export interface GetRemarksWiseAgeingSummaryDetailsPayload {
  flow_id: string;
  flow_run_id: string;
  statement_date: string;
  source_name: string[];
  cycle_number: string;
  execution_number: string;
  remarks: string;
  reconciliation_status: string[];
  ageing_bucket: string;
  limit: number;
  offset: number;
  page: number;
  sort: string;
}

export interface RemarksWiseAgeingSummaryDetailsGroup {
  source_name: string;
  reconciliation_status: string;
  count: number;
  records: Record<string, unknown>[];
}

export async function getRemarksWiseAgeingSummaryDetails(
  payload: GetRemarksWiseAgeingSummaryDetailsPayload,
) {
  return reconciliationPost<RemarksWiseAgeingSummaryDetailsGroup[]>(
    '/reconciliation-summary/remarks-wise-ageing-summary-details',
    payload,
    'Failed to fetch remarks-wise ageing summary details',
  );
}


export interface GetReconciliationSummaryDetailsPayload {
  flow_id: string;
  flow_run_id: string;
  statement_date: string;
  source_name: string | string[];
  cycle_number: string;
  execution_number: string;
  remarks: string;
  days_unmatched: string;
  sort: string;
  search_term: string;
}
export async function getReconciliationSummaryDetails(
  payload: GetReconciliationSummaryDetailsPayload,
) {
  return reconciliationPost(
    '/reconciliation-summary/get-ageing-summary-details',
    payload,
    'Failed to fetch reconciliation summary details',
  );
}

export interface GetReconciliationDetailsPayload {
  flow_id: string;
  flow_run_id: string;
  statement_date: string;
  source_name: string[];
  cycle_number: string;
  execution_number: string;
  reconciliation_status: string[];
}
export async function getReconciliationDetails(
  payload: GetReconciliationDetailsPayload,
) {
  return reconciliationPost(
    '/reconciliation-summary/get-reconciliation-summary-details',
    payload,
    'Failed to fetch reconciliation details',
  );
}

export interface DownloadReconciliationSummaryDetailsPayload {
  flow_id: string;
  flow_run_id: string;
  statement_date: string;
  source_name: string[];
  cycle_number: string;
  execution_number: string;
  reconciliation_status: string[];
  file_type: 'excel' | 'csv';
  is_data: boolean;
}

export async function downloadReconciliationSummaryDetails(
  payload: DownloadReconciliationSummaryDetailsPayload,
) {
  const fallbackMessage = "Failed to download reconciliation summary details";
  try {
    const response = await api.post(
      "/reconciliation-summary/download-reconciliation-summary-details",
      payload,
      {
        responseType: "blob",
      }
    );

    await assertBlobNotApiError(response.data, fallbackMessage);

    const blob = response.data as Blob;
    const contentDisposition = response.headers?.["content-disposition"] as string | undefined;
    const filename = extractDownloadFilename(contentDisposition, `reconciliation-summary-details.${payload.file_type === 'excel' ? 'xlsx' : 'csv'}`);

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error: unknown) {
    console.error(fallbackMessage, error);
    toast.info(getDisplayErrorMessage(error, fallbackMessage));
    throw error;
  }
}