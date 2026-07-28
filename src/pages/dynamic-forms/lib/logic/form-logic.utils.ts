import type {
  AppliedFormLogicState,
  AppliedLogicMappingSummary,
  FormApiLogicStep,
  FormApiQueryParam,
  FormApiResponseMapping,
  FormBuilderField,
  FormBuilderFieldOption,
  FormFieldValue,
  FormOptionMergeMode,
} from '../../types';
import { fieldHasOptionList, getFieldStaticOptions, isMappableFieldType } from '../field/field.utils';
import { coerceApiResponseToDateFieldValue } from '../date/form-date.utils';

export function createDefaultApiLogicStep(name = 'New step'): FormApiLogicStep {
  return {
    id: crypto.randomUUID(),
    name,
    method: 'GET',
    url: '/path',
    headers: [{ key: 'Content-Type', value: 'application/json' }],
    getRequestType: 'get_all',
    queryParams: [],
    requestBody: '',
    payloadFormat: 'none',
    mappings: [],
    sampleResponse: JSON.stringify(
      {
        data: [
          { id: 1, name: 'Option 1', deployment_name: 'OPTION_1' },
          { id: 2, name: 'Option 2', deployment_name: 'OPTION_2' },
        ],
        count: 2,
      },
      null,
      2,
    ),
  };
}

export function createDefaultResponseMapping(fieldId = ''): FormApiResponseMapping {
  return {
    id: crypto.randomUUID(),
    responseKey: '',
    fieldId,
    action: 'set_value',
  };
}

export function getValueByPath(data: unknown, path: string): unknown {
  const trimmed = path.trim();
  if (!trimmed) return undefined;

  const normalized = normalizeApiResponseData(data);

  return trimmed.split('.').reduce<unknown>((current, segment) => {
    if (current == null) return undefined;

    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) return undefined;
      return current[index];
    }

    if (!isRecord(current)) return undefined;
    return getRecordValue(current, segment);
  }, normalized);
}

function getRecordValue(record: Record<string, unknown>, segment: string): unknown {
  if (segment in record) return record[segment];

  const match = Object.keys(record).find((key) => key.toLowerCase() === segment.toLowerCase());
  return match ? record[match] : undefined;
}

export function normalizeApiResponseData(data: unknown): unknown {
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (!trimmed) return data;
    try {
      return JSON.parse(trimmed);
    } catch {
      return data;
    }
  }
  return data;
}

/** Resolve a mapped path, including common nested wrappers and sample fallback. */
export function resolveMappedValue(
  step: FormApiLogicStep,
  result: ApiStepTestResult,
  path: string,
): unknown {
  return resolveMappingRaw(step, result, {
    id: '',
    responseKey: path,
    fieldId: '',
    action: 'set_value',
  }).raw;
}

function getMappingSources(step: FormApiLogicStep, result: ApiStepTestResult): unknown[] {
  const sources: unknown[] = [normalizeApiResponseData(result.data)];

  if (result.source === 'live' && step.sampleResponse.trim()) {
    try {
      sources.push(normalizeApiResponseData(JSON.parse(step.sampleResponse)));
    } catch {
      // ignore invalid sample JSON
    }
  }

  return sources;
}

function findRecordKey(record: Record<string, unknown>, fieldName: string): string | null {
  if (fieldName in record) return fieldName;
  return Object.keys(record).find((key) => key.toLowerCase() === fieldName.toLowerCase()) ?? null;
}

function findArrayContainingField(
  data: unknown,
  fieldName: string,
  parentPath = '',
): { array: unknown[]; fieldKey: string; labelKey: string; arrayPath: string } | null {
  if (!isRecord(data)) return null;

  for (const [key, value] of Object.entries(data)) {
    const nextPath = parentPath ? `${parentPath}.${key}` : key;

    if (Array.isArray(value) && isObjectArray(value)) {
      const first = value[0] as Record<string, unknown>;
      const matchedKey = findRecordKey(first, fieldName);
      if (matchedKey) {
        const labelCandidates = ['name', 'label', 'title', 'description', matchedKey];
        const labelKey =
          labelCandidates.find((candidate) => findRecordKey(first, candidate) != null) ?? matchedKey;
        return { array: value, fieldKey: matchedKey, labelKey, arrayPath: nextPath };
      }
    }

    if (isRecord(value)) {
      const nested = findArrayContainingField(value, fieldName, nextPath);
      if (nested) return nested;
    }
  }

  return null;
}

export interface ResolvedMappingValue {
  raw: unknown;
  inferredValueKey?: string;
  inferredLabelKey?: string;
  resolvedPath?: string;
}

/** Resolve mapped value, including smart detection for fields inside list responses. */
export function resolveMappingRaw(
  step: FormApiLogicStep,
  result: ApiStepTestResult,
  mapping: FormApiResponseMapping,
): ResolvedMappingValue {
  const path = mapping.responseKey.trim();
  if (!path) return { raw: undefined };

  for (const source of getMappingSources(step, result)) {
    const direct = getValueByPath(source, path);
    if (direct != null) {
      return { raw: direct, resolvedPath: path };
    }

    const flexible = getValueFromCommonWrappers(source, path);
    if (flexible != null) {
      return { raw: flexible, resolvedPath: path };
    }
  }

  if (!path.includes('.')) {
    for (const source of getMappingSources(step, result)) {
      const match = findArrayContainingField(source, path);
      if (match) {
        return {
          raw: match.array,
          inferredValueKey: match.fieldKey,
          inferredLabelKey: match.labelKey,
          resolvedPath: match.arrayPath,
        };
      }
    }
  }

  return { raw: undefined };
}

export function resolveEffectiveResponseKey(
  mapping: FormApiResponseMapping,
  field?: FormBuilderField,
): string {
  const trimmed = mapping.responseKey.trim();
  if (trimmed) return trimmed;
  if (field?.apiSource?.responseKey?.trim()) return field.apiSource.responseKey.trim();
  if (field?.type === 'data_table') return 'data';
  return '';
}

export function resolveFieldApiResponseKey(field: FormBuilderField): string {
  const trimmed = field.apiSource?.responseKey?.trim();
  if (trimmed) return trimmed;
  if (field.type === 'data_table') return 'data';
  return '';
}

export function resolveMappingOptionKeys(
  mapping: FormApiResponseMapping,
  resolved: ResolvedMappingValue,
): { valueKey?: string; labelKey?: string } {
  const explicitValueKey = normalizeOptionKey(mapping.optionValueKey);
  const explicitLabelKey = normalizeOptionKey(mapping.optionLabelKey);

  return {
    valueKey: explicitValueKey ?? resolved.inferredValueKey,
    labelKey: explicitLabelKey ?? resolved.inferredLabelKey,
  };
}

function getValueFromCommonWrappers(data: unknown, path: string): unknown {
  if (!isRecord(data)) return undefined;

  const wrappers = ['data', 'result', 'response', 'payload', 'body', 'content'];
  for (const wrapper of wrappers) {
    const nested = getRecordValue(data, wrapper);
    if (nested == null) continue;

    const resolved = getValueByPath(nested, path);
    if (resolved != null) return resolved;
  }

  return undefined;
}

export function formatPreviewValue(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function isObjectArray(raw: unknown): raw is Record<string, unknown>[] {
  return Array.isArray(raw) && raw.some((item) => isRecord(item));
}

function mergeOptions(
  existing: FormBuilderFieldOption[],
  incoming: FormBuilderFieldOption[],
): FormBuilderFieldOption[] {
  const seen = new Set(existing.map((option) => option.value));
  const merged = [...existing];
  for (const option of incoming) {
    if (!seen.has(option.value)) {
      seen.add(option.value);
      merged.push(option);
    }
  }
  return merged;
}

function ensureOptionsForPrimitiveValues(
  field: FormBuilderField,
  values: string[],
): FormBuilderField {
  const existing = field.options ?? [];
  const extra = values
    .filter((value) => value.trim().length > 0)
    .filter((value) => !existing.some((option) => option.value === value))
    .map((value) => ({ value, label: value }));

  if (extra.length === 0) return field;
  return { ...field, options: [...existing, ...extra] };
}

export interface ApplyFieldMappingResult {
  field: FormBuilderField;
  value?: FormFieldValue;
  preview: string;
  applied: boolean;
}

function resolveOptionsArray(raw: unknown): unknown[] | null {
  if (Array.isArray(raw)) return raw;
  return unwrapOptionsArray(raw);
}

function formatOptionsPreview(
  count: number,
  valueKey?: string,
  labelKey?: string,
  sampleLabels?: string[],
): string {
  const keyHint = valueKey ? ` (${valueKey} → ${labelKey ?? valueKey})` : '';
  const sampleHint =
    sampleLabels && sampleLabels.length > 0
      ? `: ${sampleLabels.slice(0, 3).join(', ')}${count > 3 ? '…' : ''}`
      : '';
  return `${count} options${keyHint}${sampleHint}`;
}

function formatMissingOptionsPreview(valueKey?: string, labelKey?: string): string {
  if (valueKey) {
    return `0 options — no "${valueKey}" in list items${labelKey && labelKey !== valueKey ? ` (label: "${labelKey}")` : ''}`;
  }
  return '0 options — set value/label keys for your API fields';
}

export function resolveOptionMergeMode(
  field: FormBuilderField,
  mapping?: Pick<FormApiResponseMapping, 'action' | 'optionMergeMode'>,
): FormOptionMergeMode {
  if (mapping?.action === 'set_options' && mapping.optionMergeMode) {
    return mapping.optionMergeMode;
  }

  const source = field.dataSource ?? 'static';
  if (source === 'static_and_api') return 'append';
  if (source === 'api') return 'replace';
  return 'static_only';
}

function buildOptionsFromApi(
  field: FormBuilderField,
  parsedOptions: FormBuilderFieldOption[],
  mergeMode: FormOptionMergeMode,
): { options: FormBuilderFieldOption[]; staticOptions: FormBuilderFieldOption[]; dataSource: FormBuilderField['dataSource'] } {
  const staticOptions = getFieldStaticOptions(field);

  if (mergeMode === 'static_only') {
    return {
      options: staticOptions,
      staticOptions,
      dataSource: 'static',
    };
  }

  if (mergeMode === 'append') {
    return {
      options: mergeOptions(staticOptions, parsedOptions),
      staticOptions,
      dataSource: 'static_and_api',
    };
  }

  return {
    options: parsedOptions,
    staticOptions,
    dataSource: 'api',
  };
}

/** Applies set_value / set_options to a field, including smart handling for option lists. */
export function applyFieldMapping(
  field: FormBuilderField,
  raw: unknown,
  action: FormApiResponseMapping['action'],
  valueKey?: string,
  labelKey?: string,
  optionMergeMode?: FormOptionMergeMode,
): ApplyFieldMappingResult {
  if (raw == null) {
    return {
      field,
      preview: 'Key not found in response',
      applied: false,
    };
  }

  const resolvedValueKey = normalizeOptionKey(valueKey) ?? normalizeOptionKey(field.apiSource?.optionValueKey);
  const resolvedLabelKey = normalizeOptionKey(labelKey) ?? normalizeOptionKey(field.apiSource?.optionLabelKey);
  const optionsArray = resolveOptionsArray(raw);
  const treatArrayAsOptions =
    fieldHasOptionList(field.type) &&
    optionsArray != null &&
    (action === 'set_options' || action === 'set_value' || isObjectArray(optionsArray));

  if (treatArrayAsOptions) {
    const parsedOptions = parseApiResponseToOptions(
      optionsArray,
      resolvedValueKey,
      resolvedLabelKey,
    );

    if (parsedOptions.length === 0) {
      return {
        field,
        preview: formatMissingOptionsPreview(resolvedValueKey, resolvedLabelKey),
        applied: false,
      };
    }

    const mergeMode =
      action === 'set_options'
        ? resolveOptionMergeMode(field, { action, optionMergeMode })
        : 'append';

    if (action === 'set_options' && mergeMode === 'static_only') {
      const staticOptions = getFieldStaticOptions(field);
      return {
        field: {
          ...field,
          options: staticOptions,
          staticOptions,
          dataSource: 'static',
        },
        preview: `${staticOptions.length} hardcoded options only`,
        applied: staticOptions.length > 0,
      };
    }

    const built = buildOptionsFromApi(field, parsedOptions, mergeMode);
    const nextOptions =
      action === 'set_options'
        ? built.options
        : mergeOptions(field.options ?? [], parsedOptions);

    let nextField: FormBuilderField = {
      ...field,
      options: nextOptions,
      staticOptions: built.staticOptions,
      dataSource: action === 'set_options' ? built.dataSource : field.dataSource ?? 'static',
    };

    if (action === 'set_value' && Array.isArray(optionsArray) && !isObjectArray(optionsArray)) {
      const selected = optionsArray.map(String).filter(Boolean);
      nextField = ensureOptionsForPrimitiveValues(nextField, selected);
      return {
        field: nextField,
        value: selected,
        preview: `${parsedOptions.length} options, ${selected.length} selected`,
        applied: true,
      };
    }

    return {
      field: nextField,
      preview: formatOptionsPreview(
        nextOptions.length,
        resolvedValueKey,
        resolvedLabelKey,
        nextOptions.slice(0, 3).map((option) => option.label),
      ),
      applied: true,
    };
  }

  if (action === 'set_options') {
    return {
      field,
      preview: 'Set options requires a list — use path "data" or a field inside the list',
      applied: false,
    };
  }

  if (fieldHasOptionList(field.type) && !Array.isArray(raw)) {
    const coerced = String(raw);
    const nextField = ensureOptionsForPrimitiveValues(field, [coerced]);
    const value: FormFieldValue =
      field.type === 'multi_select' || field.type === 'checkbox_group' ? [coerced] : coerced;
    return {
      field: nextField,
      value,
      preview: coerced,
      applied: true,
    };
  }

  const coerced = coerceApiValueToFieldValue(field, raw);
  return {
    field,
    value: coerced,
    preview: formatPreviewValue(coerced),
    applied: true,
  };
}

export function previewMappingValue(
  field: FormBuilderField | undefined,
  mapping: FormApiResponseMapping,
  step: FormApiLogicStep,
  result: ApiStepTestResult,
): string {
  const resolved = resolveMappingRaw(step, result, mapping);
  const raw = resolved.raw;
  if (raw == null) {
    return 'Key not found — use "data" for lists or a field name like "deployment_name"';
  }

  const optionKeys = resolveMappingOptionKeys(mapping, resolved);
  const optionsArray = resolveOptionsArray(raw);
  const shouldPreviewOptions =
    mapping.action === 'set_options' ||
    (field && fieldHasOptionList(field.type) && optionsArray != null);

  if (shouldPreviewOptions && optionsArray != null) {
    const mergeMode =
      mapping.action === 'set_options' && field
        ? resolveOptionMergeMode(field, mapping)
        : 'append';
    const apiOptions = parseApiResponseToOptions(optionsArray, optionKeys.valueKey, optionKeys.labelKey);
    const pathHint =
      resolved.resolvedPath && resolved.resolvedPath !== mapping.responseKey.trim()
        ? ` via ${resolved.resolvedPath}`
        : '';

    if (mapping.action === 'set_options' && mergeMode === 'static_only') {
      const staticCount = field ? getFieldStaticOptions(field).length : 0;
      return `${staticCount} hardcoded options only${pathHint}`;
    }

    if (apiOptions.length > 0) {
      const previewOptions =
        mapping.action === 'set_options' && field && mergeMode === 'append'
          ? mergeOptions(getFieldStaticOptions(field), apiOptions)
          : apiOptions;

      const mergeHint =
        mapping.action === 'set_options' && mergeMode === 'append' ? ' (hardcoded + API)' : '';

      return `${formatOptionsPreview(
        previewOptions.length,
        optionKeys.valueKey,
        optionKeys.labelKey,
        previewOptions.map((option) => option.label),
      )}${mergeHint}${pathHint}`;
    }

    if (mapping.action === 'set_options') {
      return `${formatMissingOptionsPreview(optionKeys.valueKey, optionKeys.labelKey)}${pathHint}`;
    }
  }

  return formatPreviewValue(raw);
}

export interface ApiStepTestResult {
  ok: boolean;
  data: unknown;
  source: 'live' | 'sample';
  error?: string;
}

export async function executeApiLogicStep(step: FormApiLogicStep): Promise<ApiStepTestResult> {
  const requestUrl = buildStepRequestUrl(step);
  const init = buildStepFetchInit(step);

  try {
    const response = await fetch(requestUrl, init);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const data = await parseResponseBody(response);
    return { ok: true, data, source: 'live' };
  } catch (error) {
    try {
      const data = normalizeApiResponseData(JSON.parse(step.sampleResponse || '{}'));
      return {
        ok: true,
        data,
        source: 'sample',
        error: error instanceof Error ? error.message : 'Live request failed',
      };
    } catch {
      return {
        ok: false,
        data: {},
        source: 'sample',
        error: 'Live request failed and sample response JSON is invalid',
      };
    }
  }
}

export function listMappableFields(fields: FormBuilderField[]): FormBuilderField[] {
  return fields.filter((field) => field.visible && isMappableFieldType(field.type));
}

export function buildMappingPreview(
  mappings: FormApiResponseMapping[],
  fields: FormBuilderField[],
  step: FormApiLogicStep,
  result: ApiStepTestResult,
): { fieldLabel: string; responseKey: string; action: string; resolvedValue: string; missing: boolean }[] {
  const fieldMap = new Map(fields.map((field) => [field.id, field]));

  return mappings
    .filter((mapping) => {
      if (!mapping.fieldId) return false;
      const field = fieldMap.get(mapping.fieldId);
      return Boolean(resolveEffectiveResponseKey(mapping, field));
    })
    .map((mapping) => {
      const field = fieldMap.get(mapping.fieldId);
      const responseKey = resolveEffectiveResponseKey(mapping, field);
      const resolved = resolveMappingRaw(step, result, { ...mapping, responseKey });
      return {
        fieldLabel: field?.displayName ?? mapping.fieldId,
        responseKey,
        action: mapping.action.replace(/_/g, ' '),
        resolvedValue: previewMappingValue(field, { ...mapping, responseKey }, step, result),
        missing: resolved.raw == null,
      };
    });
}

export const API_MAPPING_ACTIONS = [
  { value: 'set_value' as const, label: 'Set value' },
  { value: 'set_options' as const, label: 'Set options' },
  { value: 'show_field' as const, label: 'Show field' },
  { value: 'hide_field' as const, label: 'Hide field' },
];

export const OPTION_MERGE_MODES = [
  { value: 'replace' as const, label: 'API only', hint: 'Replace hardcoded options with API list' },
  { value: 'append' as const, label: 'Hardcoded + API', hint: 'Keep manual options and add API options' },
  { value: 'static_only' as const, label: 'Hardcoded only', hint: 'Skip API — use manual options only' },
];

export const API_HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE'] as const;

export const PAYLOAD_FORMATS = [
  { value: 'none' as const, label: 'None', hint: 'No payload — URL only (GET all, etc.)' },
  { value: 'query_params' as const, label: 'Query params', hint: 'Send as ?key=value on the URL' },
  { value: 'json' as const, label: 'JSON body', hint: 'Send JSON in the request body' },
  { value: 'form_urlencoded' as const, label: 'Form URL encoded', hint: 'Send key=value pairs in the body' },
  { value: 'form_data' as const, label: 'Form data', hint: 'Send multipart form fields in the body' },
  { value: 'text' as const, label: 'Plain text body', hint: 'Send raw text in the body' },
  { value: 'xml' as const, label: 'XML body', hint: 'Send XML in the body' },
];

export function getPayloadFormatsForMethod(method: FormApiLogicStep['method']) {
  if (method === 'GET') {
    return PAYLOAD_FORMATS.filter((format) => format.value === 'none' || format.value === 'query_params');
  }
  return PAYLOAD_FORMATS;
}

/** @deprecated Use PAYLOAD_FORMATS / getPayloadFormatsForMethod instead */
export const GET_REQUEST_TYPES = [
  { value: 'get_all' as const, label: 'GET All', hint: 'No query params — fetch full list' },
  { value: 'get_by_id' as const, label: 'GET By ID', hint: 'Send id (or custom key) in the URL' },
  { value: 'get_with_params' as const, label: 'GET With Params', hint: 'Add any query params you need' },
];

/** @deprecated Use PAYLOAD_FORMATS instead */
export const RESPONSE_FORMATS = PAYLOAD_FORMATS;

/** @deprecated Use applyPayloadFormatChange instead */
export function applyGetRequestType(
  getRequestType: FormApiLogicStep['getRequestType'],
  currentParams: FormApiQueryParam[] = [],
): FormApiQueryParam[] {
  if (getRequestType === 'get_all') return [];
  if (getRequestType === 'get_by_id') {
    const existing = currentParams.find((param) => param.key.trim().toLowerCase() === 'id');
    return existing ? [existing] : [{ key: 'id', value: '' }];
  }
  return currentParams.length > 0 ? currentParams : [{ key: '', value: '' }];
}

export function resolvePayloadFormat(step: FormApiLogicStep) {
  if (step.payloadFormat) return step.payloadFormat;

  if (step.getRequestType === 'get_by_id' || step.getRequestType === 'get_with_params') {
    return 'query_params' as const;
  }

  if (step.method !== 'GET' && step.requestBody?.trim()) {
    return 'json' as const;
  }

  return 'none' as const;
}

export function applyPayloadFormatChange(
  payloadFormat: FormApiLogicStep['payloadFormat'],
  currentParams: FormApiQueryParam[] = [],
  currentBody = '',
): { queryParams: FormApiQueryParam[]; requestBody: string } {
  switch (payloadFormat) {
    case 'query_params':
    case 'form_urlencoded':
    case 'form_data':
      return {
        queryParams: currentParams.length > 0 ? currentParams : [{ key: 'id', value: '' }],
        requestBody: currentBody,
      };
    case 'json':
      return {
        queryParams: [],
        requestBody: currentBody.trim() ? currentBody : '{\n  "id": ""\n}',
      };
    case 'text':
      return { queryParams: [], requestBody: currentBody.trim() ? currentBody : '' };
    case 'xml':
      return {
        queryParams: [],
        requestBody: currentBody.trim() ? currentBody : '<request></request>',
      };
    case 'none':
    default:
      return { queryParams: [], requestBody: '' };
  }
}

export function appendQueryParams(url: string, params: FormApiLogicStep['queryParams']): string {
  const valid = (params ?? []).filter((param) => param.key.trim());
  if (valid.length === 0) return url;

  const separator = url.includes('?') ? '&' : '?';
  const query = valid
    .map((param) => `${encodeURIComponent(param.key.trim())}=${encodeURIComponent(param.value)}`)
    .join('&');

  return `${url}${separator}${query}`;
}

export function buildStepRequestUrl(step: FormApiLogicStep): string {
  const payloadFormat = resolvePayloadFormat(step);
  if (payloadFormat !== 'query_params') return step.url.trim();
  return appendQueryParams(step.url.trim(), step.queryParams);
}

function getValidPayloadParams(step: FormApiLogicStep): FormApiQueryParam[] {
  return (step.queryParams ?? []).filter((param) => param.key.trim());
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('json')) {
    return normalizeApiResponseData(await response.json());
  }
  return await response.text();
}

function setContentType(headers: Record<string, string>, value: string) {
  if (!headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = value;
  }
}

export function buildStepFetchInit(step: FormApiLogicStep): RequestInit {
  const headers: Record<string, string> = {};
  step.headers.forEach((header) => {
    if (header.key.trim()) {
      headers[header.key.trim()] = header.value;
    }
  });

  const init: RequestInit = {
    method: step.method,
    headers,
  };

  const payloadFormat = resolvePayloadFormat(step);
  const params = getValidPayloadParams(step);

  switch (payloadFormat) {
    case 'json':
      if (step.requestBody?.trim()) {
        init.body = step.requestBody;
        setContentType(headers, 'application/json');
      }
      break;
    case 'form_urlencoded':
      if (params.length > 0) {
        init.body = new URLSearchParams(
          params.map((param) => [param.key.trim(), param.value] as [string, string]),
        ).toString();
        setContentType(headers, 'application/x-www-form-urlencoded');
      }
      break;
    case 'form_data':
      if (params.length > 0) {
        const formData = new FormData();
        params.forEach((param) => formData.append(param.key.trim(), param.value));
        init.body = formData;
        delete headers['Content-Type'];
        delete headers['content-type'];
      }
      break;
    case 'text':
      if (step.requestBody?.trim()) {
        init.body = step.requestBody;
        setContentType(headers, 'text/plain');
      }
      break;
    case 'xml':
      if (step.requestBody?.trim()) {
        init.body = step.requestBody;
        setContentType(headers, 'application/xml');
      }
      break;
    case 'query_params':
    case 'none':
    default:
      break;
  }

  return init;
}

export function methodBadgeClass(method: string): string {
  switch (method) {
    case 'GET':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300';
    case 'POST':
      return 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300';
    case 'PUT':
    case 'PATCH':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300';
    case 'DELETE':
      return 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300';
    default:
      return 'bg-gray-surface text-gray-text';
  }
}

export function coerceApiValueToFieldValue(field: FormBuilderField, raw: unknown): FormFieldValue {
  if (raw == null) {
    if (field.type === 'checkbox' || field.type === 'switch') return false;
    if (field.type === 'multi_select' || field.type === 'checkbox_group' || field.type === 'multiple_file_upload') {
      return [];
    }
    return '';
  }

  if (field.type === 'checkbox' || field.type === 'switch') {
    if (typeof raw === 'boolean') return raw;
    return raw === 'true' || raw === 1 || raw === '1';
  }

  if (field.type === 'multi_select' || field.type === 'checkbox_group' || field.type === 'multiple_file_upload') {
    if (Array.isArray(raw)) return raw.map(String);
    return String(raw)
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }

  if (field.type === 'number') {
    return raw === '' ? '' : String(raw);
  }

  if (field.type === 'date') {
    return coerceApiResponseToDateFieldValue(raw);
  }

  if (field.type === 'data_table') {
    if (Array.isArray(raw) || (typeof raw === 'object' && raw !== null)) {
      return JSON.stringify(raw);
    }
    return String(raw);
  }

  if (field.type === 'big_number') {
    return raw === '' ? '' : String(raw);
  }

  if (typeof raw === 'object') {
    return JSON.stringify(raw);
  }

  return String(raw);
}

function unwrapOptionsArray(raw: unknown): unknown[] | null {
  if (Array.isArray(raw)) return raw;

  if (raw && typeof raw === 'object') {
    const record = raw as Record<string, unknown>;
    const nested = record.data ?? record.items ?? record.results ?? record.options ?? record.records;
    if (Array.isArray(nested)) return nested;
  }

  return null;
}

function normalizeOptionKey(key?: string): string | undefined {
  const trimmed = key?.trim();
  return trimmed ? trimmed : undefined;
}

function readOptionField(record: Record<string, unknown>, key?: string): unknown {
  if (!key) return undefined;
  const value = getRecordValue(record, key);
  if (value == null || value === '') return undefined;
  return value;
}

function autoPickOptionValue(record: Record<string, unknown>, index: number): string {
  const preferred = ['value', 'deployment_name', 'name', 'key', 'code', 'label', 'title'];
  for (const key of preferred) {
    const value = readOptionField(record, key);
    if (value != null) return String(value);
  }

  for (const value of Object.values(record)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
  }

  return `option_${index + 1}`;
}

function autoPickOptionLabel(record: Record<string, unknown>, fallbackValue: string): string {
  const preferred = ['label', 'name', 'title', 'description', 'deployment_name', 'displayName'];
  for (const key of preferred) {
    const value = readOptionField(record, key);
    if (value != null) return String(value);
  }
  return fallbackValue;
}

export function parseApiResponseToOptions(
  raw: unknown,
  valueKey?: string,
  labelKey?: string,
): FormBuilderFieldOption[] {
  const items = unwrapOptionsArray(raw);
  if (!items) return [];

  const normalizedValueKey = normalizeOptionKey(valueKey);
  const normalizedLabelKey = normalizeOptionKey(labelKey);

  return items.flatMap((item, index) => {
    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
      const str = String(item);
      return [{ value: str, label: str }];
    }

    if (!item || typeof item !== 'object') {
      return [{ value: `option_${index + 1}`, label: `Option ${index + 1}` }];
    }

    const record = item as Record<string, unknown>;
    const resolvedValue = normalizedValueKey
      ? readOptionField(record, normalizedValueKey)
      : autoPickOptionValue(record, index);

    if (resolvedValue == null) return [];

    const value = String(resolvedValue);
    const resolvedLabel = normalizedLabelKey
      ? readOptionField(record, normalizedLabelKey)
      : autoPickOptionLabel(record, value);

    return [
      {
        value,
        label: resolvedLabel == null ? value : String(resolvedLabel),
      },
    ];
  });
}

export async function applyApiLogicToForm(
  fields: FormBuilderField[],
  steps: FormApiLogicStep[],
): Promise<{ state: AppliedFormLogicState | null; fields: FormBuilderField[]; error?: string }> {
  if (steps.length === 0) {
    return { state: null, fields, error: 'Add at least one API step' };
  }

  const fieldById = new Map(fields.map((field) => [field.id, field]));
  const nextFields = fields.map((field) => ({ ...field }));
  const fieldIndexById = new Map(nextFields.map((field, index) => [field.id, index]));
  const values: Record<string, FormFieldValue> = {};
  const visibilityOverrides: Record<string, boolean> = {};
  const summary: AppliedLogicMappingSummary[] = [];
  const stepResults = new Map<string, ApiStepTestResult>();
  let successfulApplications = 0;

  for (const step of steps) {
    if (!step.url.trim()) {
      return { state: null, fields, error: `Step "${step.name}" is missing a URL` };
    }

    const result = await executeApiLogicStep(step);
    stepResults.set(step.id, result);
    if (!result.ok) {
      return { state: null, fields, error: result.error ?? `Step "${step.name}" failed` };
    }

    for (const mapping of step.mappings) {
      const field = mapping.fieldId ? fieldById.get(mapping.fieldId) : undefined;
      const responseKey = field ? resolveEffectiveResponseKey(mapping, field) : mapping.responseKey.trim();
      if (!mapping.fieldId || !responseKey) continue;

      if (!field) continue;

      const resolved = resolveMappingRaw(step, result, { ...mapping, responseKey });
      const optionKeys = resolveMappingOptionKeys(mapping, resolved);
      const actionLabel = API_MAPPING_ACTIONS.find((item) => item.value === mapping.action)?.label ?? mapping.action;

      if (mapping.action === 'show_field') {
        visibilityOverrides[field.id] = true;
        successfulApplications += 1;
        summary.push({
          fieldLabel: field.displayName,
          fieldName: field.name,
          responseKey: mapping.responseKey,
          action: actionLabel,
          value: 'visible',
        });
        continue;
      }

      if (mapping.action === 'hide_field') {
        visibilityOverrides[field.id] = false;
        successfulApplications += 1;
        summary.push({
          fieldLabel: field.displayName,
          fieldName: field.name,
          responseKey: mapping.responseKey,
          action: actionLabel,
          value: 'hidden',
        });
        continue;
      }

      const mappingResult = applyFieldMapping(
        field,
        resolved.raw,
        mapping.action,
        optionKeys.valueKey,
        optionKeys.labelKey,
        mapping.optionMergeMode,
      );
      summary.push({
        fieldLabel: field.displayName,
        fieldName: field.name,
        responseKey,
        action: actionLabel,
        value: mappingResult.preview,
      });

      if (!mappingResult.applied) continue;

      successfulApplications += 1;
      let appliedField = mappingResult.field;
      if (mapping.action === 'set_options' || field.type === 'data_table') {
        appliedField = {
          ...appliedField,
          dataSource: field.type === 'data_table' ? 'api' : appliedField.dataSource,
          apiSource: {
            stepId: step.id,
            responseKey,
            optionValueKey: optionKeys.valueKey,
            optionLabelKey: optionKeys.labelKey,
          },
        };
      }

      const fieldIndex = fieldIndexById.get(field.id);
      if (fieldIndex != null) {
        nextFields[fieldIndex] = appliedField;
        fieldById.set(field.id, appliedField);
      }

      if (mappingResult.value !== undefined) {
        values[appliedField.name] = mappingResult.value;
      }
    }
  }

  for (const field of nextFields) {
    if (field.dataSource !== 'api' && field.dataSource !== 'static_and_api') {
      continue;
    }

    const responseKey = resolveFieldApiResponseKey(field);
    if (!responseKey) continue;

    const step =
      steps.find((item) => item.id === field.apiSource?.stepId) ??
      (steps.length === 1 ? steps[0] : undefined);

    if (!step) continue;

    let result = stepResults.get(step.id);
    if (!result) {
      result = await executeApiLogicStep(step);
      stepResults.set(step.id, result);
      if (!result.ok) continue;
    }

    const raw = resolveMappedValue(step, result, responseKey);
    const actionLabel = fieldHasOptionList(field.type) ? 'Set options' : 'Set value';
    const mappingAction = fieldHasOptionList(field.type) ? 'set_options' : 'set_value';
    const inspectorMergeMode =
      field.dataSource === 'static_and_api'
        ? 'append'
        : field.dataSource === 'api'
          ? 'replace'
          : 'static_only';
    const mappingResult = applyFieldMapping(
      field,
      raw,
      mappingAction,
      field.apiSource.optionValueKey,
      field.apiSource.optionLabelKey,
      inspectorMergeMode,
    );

    summary.push({
      fieldLabel: field.displayName,
      fieldName: field.name,
      responseKey,
      action: actionLabel,
      value: mappingResult.preview,
    });

    if (!mappingResult.applied) continue;

    successfulApplications += 1;
    const fieldIndex = fieldIndexById.get(field.id);
    if (fieldIndex != null) {
      nextFields[fieldIndex] = mappingResult.field;
      fieldById.set(field.id, mappingResult.field);
    }

    if (mappingResult.value !== undefined) {
      values[mappingResult.field.name] = mappingResult.value;
    }
  }

  if (summary.length === 0) {
    const hasMappingRows = steps.some((step) => step.mappings.some((mapping) => mapping.fieldId));
    return {
      state: null,
      fields,
      error: hasMappingRows
        ? 'Enter a response path in the mapping row (e.g. data for tables). Column JSON keys alone are not enough.'
        : 'Add a response mapping row, or set Data source → API only with a response path on the field.',
    };
  }

  if (successfulApplications === 0) {
    const failedKeys = summary
      .filter((item) => item.value.includes('not found') || item.value.includes('No options'))
      .map((item) => item.responseKey)
      .filter(Boolean);

    return {
      state: null,
      fields,
      error:
        failedKeys.length > 0
          ? `Could not map: ${failedKeys.join(', ')}. For list responses use path "data" with Set options, or enter a field name like "deployment_name".`
          : 'Mapped keys were not found in the API response. Check response paths and sample JSON.',
    };
  }

  return {
    state: {
      values,
      visibilityOverrides,
      appliedAt: Date.now(),
      summary,
    },
    fields: nextFields,
  };
}
