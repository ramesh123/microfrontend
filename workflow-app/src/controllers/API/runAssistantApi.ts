import api from './api';
import { toast } from 'sonner';
import {
  ApiRequestError,
  assertBlobNotApiError,
  executeApiRequestSilent,
  getDisplayErrorMessage,
  resolveApiErrorMessage,
} from '@/utils/exceptionHelper';

export type RunContext = {
  workflow_id: string;
  flow_id: string;
  flow_run_id: string;
  process_cycle: string;
  execution_number: string;
  stmt_date: string;
};

export type RunAssistantPayload = {
  question: string;
  conversation_id?: string;
  run_context: RunContext;
  user_context: {
    user_id: string;
    session_id: string;
    channel: string;
    locale: string;
    timezone: string;
  };
  answer_options: {
    stream: boolean;
    include_trace: boolean;
    include_evidence_rows: boolean;
    include_technical_detail: boolean;
    max_evidence_rows: number;
    evidence_page: number;
  };
};

export type RunAssistantStreamPayload = {
  agent_run_id: string;
};

export type RunAssistantAnswerOptions = RunAssistantPayload['answer_options'];

export type RunAssistantFollowUpPayload = {
  agent_run_id: string;
  question: string;
  conversation_id?: string;
  answer_options: RunAssistantAnswerOptions;
  run_context?: RunContext;
};

export type DirectAnswerEntry = {
  matched_count?: number;
  unmatched_count?: number;
  [key: string]: unknown;
};

export type EvidenceBySource = {
  source_name: string;
  status_type: string;
  table_name: string;
  total_rows: number;
  sample_row_count: number;
  sample_rows: Array<Record<string, unknown>>;
};

export type DownloadBundle = {
  bundle_id: string;
  bundle_type: string;
  status_type: string;
  file_count: number;
  download_url: string;
  manifest_path?: string;
};

export type QueryExecuted = {
  query_engine: string;
  query_text: string;
  purpose: string;
  target: string;
};

export type MatchSuggestionGroupSourceSheet = {
  source: string;
  sheet_name: string;
  record_count: number;
};

export type MatchSuggestionGroup = {
  group_id: string;
  group_label: string;
  suggested_record_count: number;
  confidence: string;
  download_id?: string;
  explanation?: string;
  source_sheets?: MatchSuggestionGroupSourceSheet[];
  download?: {
    record_count: number;
    source_sheets: MatchSuggestionGroupSourceSheet[];
    download_id?: string;
  };
  suggestion_id?: string;
  file_name?: string;
  record_count?: number;
  encrypted_file_key?: string;
  view_data_endpoint?: string;
  view_data_payload?: {
    payload: {
      encrypted_file_key: string;
      file_name: string;
      file_type: string;
      type: string;
    };
  };
  download_endpoint?: string;
  download_payload?: {
    download_id: string;
  };
  suggestion_status?: string;
  can_force_match?: boolean;
  not_matched_reason?: string;
  system_ref_ids?: Record<string, string[]>;
};

export type MatchSuggestionDownloadOption = {
  suggestion_id?: string;
  download_id?: string;
  file_name?: string;
  record_count?: number;
  source_sheets?: MatchSuggestionGroupSourceSheet[];
  encrypted_file_key?: string;
  view_data_endpoint?: string;
  view_data_payload?: {
    payload: {
      encrypted_file_key: string;
      file_name: string;
      file_type: string;
      type: string;
    };
  };
  download_endpoint?: string;
  download_payload?: {
    download_id: string;
  };
  group_id?: string;
  download_action?: string;
  suggestion_status?: string;
  can_force_match?: boolean;
  not_matched_reason?: string;
  system_ref_ids?: Record<string, string[]>;
};

export type MatchSuggestions = {
  status: boolean;
  requested: boolean;
  source?: string;
  flow_id?: string;
  stmt_date?: string;
  intent_reason?: string;
  summary?: {
    group_count: number;
    has_downloadable_groups: boolean;
  };
  groups: MatchSuggestionGroup[];
  download_options: MatchSuggestionDownloadOption[];
  retrieval_status: 'fetched' | 'not_requested' | 'not_available' | 'failed';
  message?: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RunAssistantChartParamValue = any;

export type RunAssistantChartData = {
  columns?: string[];
  data?: Array<Record<string, unknown>>;
  chart_name?: string;
  visualization_name?: string;
  status?: boolean;
  params?: {
    dimensions?: RunAssistantChartParamValue[];
    metrics?: RunAssistantChartParamValue[];
    operator?: string | null;
    color?: RunAssistantChartParamValue;
    column?: RunAssistantChartParamValue;
    row?: RunAssistantChartParamValue;
    [key: string]: unknown;
  };
  ui_hints?: {
    show_legend?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type RunAssistantAnswerData = {
  agent_run_id?: string;
  conversation_id?: string;
  stream_url?: string;
  direct_answer?: string | Record<string, DirectAnswerEntry>;
  confidence?: string;
  facts_used?: string[];
  files_queried?: string[];
  nodes_considered?: string[];
  evidence_rows?: Array<Record<string, unknown>>;
  evidence_by_source?: EvidenceBySource[];
  download_bundle?: DownloadBundle;
  queries_executed?: QueryExecuted[];
  evidence_pagination?: {
    page: number;
    page_size: number;
    total_rows: number;
    total_pages: number;
  };
  open_questions?: string[];
  next_best_action?: string;
  technical_summary?: string;
  summary_observation?: string;
  inferred_rule_reason?: string;
  inferred_rule_context?: Record<string, unknown>;
  question?: string;
  resolved_context?: Record<string, unknown>;
  workflow_name?: string;
  trace_available?: boolean;
  chart?: RunAssistantChartData;
  charts?: RunAssistantChartData;
  'match-suggestions'?: MatchSuggestions;
  match_suggestions?: MatchSuggestions;
};

export type RunAssistantAnswerResponse = {
  status: boolean;
  message?: string;
  data?: RunAssistantAnswerData;
};

export type RunAssistantStreamEvent = {
  event?: string;
  payload?: Record<string, unknown>;
  answer?: { answer_payload?: RunAssistantAnswerData } & RunAssistantAnswerData;
  status?: string;
};

/** Axios fetch-adapter streaming POST; returns native `Response` for `body.getReader()`. */
async function runAssistantStreamingPost(
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

export async function postRunAssistantAnswer(
  payload: RunAssistantPayload,
): Promise<RunAssistantAnswerResponse> {
  const json = await executeApiRequestSilent(
    () => api.post<RunAssistantAnswerResponse>('/run-assistant/answer', payload),
    'Failed to get assistant answer',
  );
  return json as RunAssistantAnswerResponse;
}

export async function postRunAssistantFollowUp(
  payload: RunAssistantFollowUpPayload,
): Promise<RunAssistantAnswerResponse> {
  const json = await executeApiRequestSilent(
    () => api.post<RunAssistantAnswerResponse>('/run-assistant/follow-up', payload),
    'Failed to get assistant follow-up answer',
  );
  return json as RunAssistantAnswerResponse;
}

export async function postRunAssistantStream(
  payload: RunAssistantStreamPayload,
  signal?: AbortSignal,
): Promise<Response> {
  try {
    return await runAssistantStreamingPost(
      '/run-assistant/stream',
      payload,
      signal,
      'Failed to stream assistant answer',
    );
  } catch (error: unknown) {
    console.error('Failed to stream assistant answer:', error);
    if ((error as Error)?.name === 'AbortError') throw error;
    if (error instanceof ApiRequestError) throw error;
    toast.info(getDisplayErrorMessage(error, 'Failed to stream assistant answer.'));
    throw error;
  }
}

export async function getRunAssistantRun(agentRunId: string): Promise<RunAssistantAnswerResponse> {
  const json = await executeApiRequestSilent(
    () => api.get<RunAssistantAnswerResponse>(`/run-assistant/run/${encodeURIComponent(agentRunId)}`),
    'Failed to fetch assistant run',
  );
  return json as RunAssistantAnswerResponse;
}

export function extractAnswerFromPayload(
  parsed: RunAssistantStreamEvent,
): RunAssistantAnswerData | null {
  if (parsed.answer) {
    return parsed.answer.answer_payload ?? (parsed.answer as RunAssistantAnswerData);
  }
  const payload = parsed.payload;
  if (!payload) return null;
  if (payload.direct_answer || payload.confidence || payload.facts_used) {
    return payload as RunAssistantAnswerData;
  }
  return null;
}

function dispatchStreamEvent(
  eventName: string,
  parsed: RunAssistantStreamEvent,
  onEvent: (eventName: string, parsed: RunAssistantStreamEvent) => void,
) {
  const resolvedEvent = eventName || parsed.event || 'message';
  onEvent(resolvedEvent, parsed);
}

function tryParseStreamChunk(
  raw: string,
  onEvent: (eventName: string, parsed: RunAssistantStreamEvent) => void,
): void {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '[DONE]') return;

  try {
    const parsed = JSON.parse(trimmed) as RunAssistantStreamEvent;
    dispatchStreamEvent(parsed.event ?? 'message', parsed, onEvent);
    return;
  } catch {
    /* not plain JSON — try SSE block parsing below */
  }

  let eventName = 'message';
  const dataLines: string[] = [];

  for (const line of trimmed.split('\n')) {
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (dataLines.length === 0) return;

  try {
    const parsed = JSON.parse(dataLines.join('\n')) as RunAssistantStreamEvent;
    dispatchStreamEvent(eventName, parsed, onEvent);
  } catch {
    /* ignore malformed chunks */
  }
}

/** Read SSE/NDJSON chunks from POST `/run-assistant/stream` response body. */
export async function readRunAssistantStream(
  response: Response,
  onEvent: (eventName: string, parsed: RunAssistantStreamEvent) => void,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split(/\r?\n\r?\n/);
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      tryParseStreamChunk(part, onEvent);
    }

    const lines = buffer.split(/\r?\n/);
    if (lines.length > 1) {
      const completeLines = lines.slice(0, -1);
      buffer = lines[lines.length - 1] ?? '';
      for (const line of completeLines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith('data:') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
          tryParseStreamChunk(trimmed.startsWith('data:') ? trimmed : `data: ${trimmed}`, onEvent);
        }
      }
    }
  }

  if (buffer.trim()) {
    tryParseStreamChunk(buffer, onEvent);
  }
}

function extractDownloadFilename(contentDisposition: string | undefined, fallback: string): string {
  if (!contentDisposition) return fallback;
  const match = contentDisposition.match(/filename="([^"]+)"|filename=([^\s;]+)/i);
  if (!match) return fallback;
  return (match[1] || match[2]).replace(/^["']|["']$/g, '');
}

export async function downloadRunAssistantBundle(bundleId: string): Promise<void> {
  const fallbackMessage = 'Failed to download evidence bundle';

  try {
    const response = await api.post(
      '/run-assistant/download',
      { bundle_id: bundleId },
      { responseType: 'blob' },
    );

    const blob = response.data as Blob;
    await assertBlobNotApiError(blob, fallbackMessage);

    const contentDisposition = response.headers?.['content-disposition'] as string | undefined;
    const filename = extractDownloadFilename(contentDisposition, `run-assistant-${bundleId}.zip`);

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error: unknown) {
    console.error('Failed to download run assistant bundle:', error);
    toast.info(getDisplayErrorMessage(error, fallbackMessage));
    throw error;
  }
}

export function formatDirectAnswer(
  directAnswer: RunAssistantAnswerData['direct_answer'],
): string {
  if (!directAnswer) return '';
  if (typeof directAnswer === 'string') return directAnswer;

  return Object.entries(directAnswer)
    .map(([source, counts]) => {
      if (counts && typeof counts === 'object') {
        const matched = counts.matched_count ?? '—';
        const unmatched = counts.unmatched_count ?? '—';
        return `${source}: matched ${matched}, unmatched ${unmatched}`;
      }
      return `${source}: ${JSON.stringify(counts)}`;
    })
    .join('\n');
}
