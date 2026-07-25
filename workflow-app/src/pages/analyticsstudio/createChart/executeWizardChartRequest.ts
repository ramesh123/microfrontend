import { createChartStreaming, type CreateChartPayload } from "@/pages/Visualization/API/chartsApi";
import { extractCompleteJSON } from "@/pages/charts/ChartFormulator/streamingUtils";
import { parseWizardChartResponse } from "./parseWizardChartResponse";

export interface WizardChartRequestResult {
  chartData: Array<{ category: string; value: number; originalData: Record<string, unknown> }>;
  rawChartResponse: Record<string, unknown> | null;
}

const pendingWizardChartRequests = new Map<string, Promise<WizardChartRequestResult>>();

function buildWizardChartRequestKey(payload: CreateChartPayload, chartHint: string): string {
  return `${chartHint}::${JSON.stringify(payload)}`;
}

function isPivotLike(item: Record<string, unknown>): boolean {
  const hasDataObject =
    item.data && typeof item.data === "object" && !Array.isArray(item.data);
  if (!hasDataObject) return false;
  const rowsOk = Array.isArray(item.rows) || (item.rows && typeof item.rows === "object");
  const colsOk = Array.isArray(item.columns) || (item.columns && typeof item.columns === "object");
  return Boolean(rowsOk && colsOk && (item.apply_metrics_on != null || item.metrics != null));
}

function extractStreamItem(
  item: unknown,
): { chunks: unknown[]; raw: Record<string, unknown> | null } {
  if (!item || typeof item !== "object") {
    return { chunks: [], raw: null };
  }

  const record = item as Record<string, unknown>;
  let raw: Record<string, unknown> | null = null;
  let chunks: unknown[] = [];

  if (
    (record.x_axis && record.columns && Array.isArray(record.data)) ||
    (record.columns && Array.isArray(record.data))
  ) {
    raw = {
      ...(record.x_axis ? { x_axis: record.x_axis } : {}),
      data: record.data,
      columns: record.columns,
      ...(record.dimensions ? { dimensions: record.dimensions } : {}),
      ...(record.hierarchy ? { hierarchy: record.hierarchy } : {}),
      ...(record.metrics ? { metrics: record.metrics } : {}),
    };
  }

  if (isPivotLike(record)) {
    raw = {
      rows: record.rows,
      columns: record.columns,
      data: record.data,
      apply_metrics_on: record.apply_metrics_on,
      metrics: record.metrics,
      schema: record.schema,
    };
    chunks = [record];
    return { chunks, raw };
  }

  if (Array.isArray(record.data)) {
    chunks = record.data;
  } else if (Array.isArray(record.payload)) {
    chunks = record.payload;
  } else if (Array.isArray(record.result)) {
    chunks = record.result;
  } else if (Array.isArray(record.rows)) {
    chunks = record.rows;
  } else {
    chunks = [record];
  }

  return { chunks, raw };
}

async function runWizardChartRequest(
  payload: CreateChartPayload,
  chartHint: string,
): Promise<WizardChartRequestResult> {
  const streamResponse = await createChartStreaming(payload);

  if (!streamResponse.ok) {
    const text = await streamResponse.text().catch(() => "");
    throw new Error(text || `Failed to create chart (${streamResponse.status})`);
  }

  if (!streamResponse.body) {
    throw new Error("Chart streaming response has no body");
  }

  const reader = streamResponse.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let rawChartResponse: Record<string, unknown> | null = null;
  const streamedRows: unknown[] = [];

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const { parsed, remaining } = extractCompleteJSON(buffer);
    buffer = remaining;

    for (const item of parsed) {
      if (
        item &&
        typeof item === "object" &&
        (item as Record<string, unknown>).detail &&
        ((item as Record<string, any>).detail?.status === false ||
          ((item as Record<string, any>).detail?.status_code ?? 0) >= 400)
      ) {
        throw new Error(String((item as Record<string, any>).detail?.message || "Failed to create chart"));
      }

      const { chunks, raw } = extractStreamItem(item);
      if (raw) rawChartResponse = raw;
      if (chunks.length) streamedRows.push(...chunks);
    }
  }

  if (buffer.trim()) {
    const { parsed } = extractCompleteJSON(buffer);
    for (const item of parsed) {
      const { chunks, raw } = extractStreamItem(item);
      if (raw) rawChartResponse = raw;
      if (chunks.length) streamedRows.push(...chunks);
    }
  }

  if (rawChartResponse) {
    return parseWizardChartResponse(rawChartResponse, chartHint, payload.params?.metrics);
  }

  if (streamedRows.length > 0) {
    const fallbackResponse = { data: streamedRows };
    return parseWizardChartResponse(fallbackResponse, chartHint, payload.params?.metrics);
  }

  return { chartData: [], rawChartResponse: null };
}

export async function executeWizardChartRequest(
  payload: CreateChartPayload,
  chartHint: string,
): Promise<WizardChartRequestResult> {
  const key = buildWizardChartRequestKey(payload, chartHint);
  const existing = pendingWizardChartRequests.get(key);
  if (existing) return existing;

  const promise = runWizardChartRequest(payload, chartHint).finally(() => {
    pendingWizardChartRequests.delete(key);
  });

  pendingWizardChartRequests.set(key, promise);
  return promise;
}
