import type { FormApiLogicStep } from '../../../types';
import { getValueByPath } from '../../../lib/logic/form-logic.utils';

function resolveTokenValue(
  key: string,
  row: Record<string, unknown> | null,
  formValues?: Record<string, string>,
): string {
  if (formValues && key in formValues) return String(formValues[key] ?? '');
  if (!row) return '';
  const value = row[key] ?? getValueByPath(row, key);
  return value == null ? '' : String(value);
}

/** Replace `{column_id}` / `{field_name}` tokens using the table row (and optional form values). */
export function interpolateRowTokens(
  template: string,
  row: Record<string, unknown> | null,
  formValues?: Record<string, string>,
  options?: { encode?: boolean },
): string {
  if (!template) return template;
  const encode = options?.encode ?? false;
  return template.replace(/\{([^}]+)\}/g, (_, rawKey: string) => {
    const value = resolveTokenValue(rawKey.trim(), row, formValues);
    return encode ? encodeURIComponent(value) : value;
  });
}

/** Apply row tokens to URL, query params, and body before calling the API. */
export function applyRowContextToStep(
  step: FormApiLogicStep,
  row: Record<string, unknown> | null,
  formValues?: Record<string, string>,
): FormApiLogicStep {
  return {
    ...step,
    url: interpolateRowTokens(step.url, row, formValues, { encode: true }),
    queryParams: (step.queryParams ?? []).map((param) => ({
      ...param,
      value: interpolateRowTokens(param.value, row, formValues, { encode: false }),
    })),
    requestBody: step.requestBody
      ? interpolateRowTokens(step.requestBody, row, formValues, { encode: false })
      : step.requestBody,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Pick the best object to read field keys from (supports `data` wrappers). */
export function resolveLoadPayload(
  data: unknown,
  loadResponsePath?: string,
): unknown {
  if (loadResponsePath?.trim()) {
    return getValueByPath(data, loadResponsePath.trim()) ?? data;
  }
  if (!isRecord(data)) return data;

  if (isRecord(data.data) && !Array.isArray(data.data)) {
    const envelopeKeys = ['data', 'success', 'message', 'status', 'error', 'errors', 'meta'];
    const keys = Object.keys(data);
    const mostlyEnvelope = keys.every((key) =>
      envelopeKeys.includes(key.toLowerCase()),
    );
    if (mostlyEnvelope || keys.length <= 4) return data.data;
  }
  return data;
}

/** Read a field value from the load payload using response key / name. */
export function readFieldFromPayload(
  payload: unknown,
  responseKey: string | undefined,
  fieldName: string,
): unknown {
  const key = responseKey?.trim() || fieldName;
  const direct = getValueByPath(payload, key);
  if (direct !== undefined) return direct;

  const underData = getValueByPath(payload, `data.${key}`);
  if (underData !== undefined) return underData;

  if (isRecord(payload)) {
    const match = Object.keys(payload).find(
      (entry) => entry.toLowerCase() === key.toLowerCase(),
    );
    if (match) return payload[match];
  }
  return undefined;
}

export function formatFieldValue(value: unknown, type: string): string {
  if (value == null) return '';
  if (type === 'checkbox') {
    return value === true ||
      String(value).toLowerCase() === 'true' ||
      value === 1 ||
      value === '1'
      ? 'true'
      : 'false';
  }
  if (Array.isArray(value)) return value.map(String).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
