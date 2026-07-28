import exceptionMessages from "@/json/exception_codes_ui.json";
import { toast } from 'sonner';
import type { AxiosResponse } from 'axios';
import { isRequestAborted } from '@/utils/apiAbort';

type ExceptionCodeMap = {
  [key: string]: {
    message: string;
    http_status: number;
    color?: string;
  };
};

export type ApiErrorResponse = {
  status?: boolean | string;
  exception_code?: string;
  status_code?: number;
  message?: string;
  detail?: unknown;
  error?: unknown;
};

const formatDetail = (detail: unknown): string | undefined => {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) =>
        item && typeof item === 'object' && item !== null && 'msg' in item
          ? String((item as { msg: unknown }).msg)
          : JSON.stringify(item),
      )
      .join('; ');
  }
  if (detail != null && typeof detail === 'object') return JSON.stringify(detail);
  return detail != null ? String(detail) : undefined;
};

const exceptionMap =
  exceptionMessages.exception_codes as ExceptionCodeMap;

export class ApiRequestError extends Error {
  exception_code?: string;
  status_code?: number;
  data?: ApiErrorResponse;

  constructor(message: string, data?: ApiErrorResponse) {
    super(message);
    this.name = 'ApiRequestError';
    this.exception_code = data?.exception_code;
    this.status_code = data?.status_code;
    this.data = data;
  }
}

/** Look up a user-facing message for an exception_code in exception_codes_ui.json. */
export const getExceptionMessage = (
  exceptionCode?: string,
  fallbackMessage = 'Something went wrong.',
): string => {
  if (!exceptionCode) return fallbackMessage;

  return exceptionMap?.[exceptionCode]?.message || fallbackMessage;
};

/** Get status color based on exception_code or status_code. */
export const getExceptionColor = (
  data?: ApiErrorResponse | null,
  fallbackColor?: string,
): string | undefined => {
  if (!data) return fallbackColor;

  if (data.exception_code) {
    const mappedColor = exceptionMap?.[data.exception_code]?.color;
    if (mappedColor) return mappedColor;
  }

  if (data.status_code) {
    const statusColorMap: Record<number, string> = {
      400: '#F59E0B',
      401: '#EF4444',
      403: '#DC2626',
      404: '#3B82F6',
      408: '#8B5CF6',
      409: '#EAB308',
      422: '#F59E0B',
      429: '#F97316',
      500: '#DC2626',
      501: '#6366F1',
      502: '#DC2626',
      503: '#DC2626',
      504: '#8B5CF6',
      507: '#991B1B',
    };
    const mappedColor = statusColorMap[data.status_code];
    if (mappedColor) return mappedColor;
  }

  return fallbackColor;
};

/** Convert a hex color string to transparent RGBA styling for toast backgrounds and borders. */
export const getToastStyle = (color?: string): Record<string, string> | undefined => {
  if (!color) return undefined;

  const cleanHex = color.replace('#', '');
  let r = 0, g = 0, b = 0;
  if (cleanHex.length === 3) {
    r = parseInt(cleanHex[0] + cleanHex[0], 16);
    g = parseInt(cleanHex[1] + cleanHex[1], 16);
    b = parseInt(cleanHex[2] + cleanHex[2], 16);
  } else if (cleanHex.length === 6) {
    r = parseInt(cleanHex.substring(0, 2), 16);
    g = parseInt(cleanHex.substring(2, 4), 16);
    b = parseInt(cleanHex.substring(4, 6), 16);
  }

  return {
    background: `linear-gradient(rgba(${r}, ${g}, ${b}, 0.08), rgba(${r}, ${g}, ${b}, 0.08)), var(--background, #ffffff)`,
    color: color,
    border: `1px solid rgba(${r}, ${g}, ${b}, 0.2)`,
  };
};

const hasNonEmptyApiMessage = (data: ApiErrorResponse): boolean =>
  data.message != null && String(data.message).trim() !== '';

/** True when API body `status` indicates success (`true`, `"true"`, `1`, etc.). */
export function isApiResponseSuccess(status: unknown): boolean {
  if (status === true || status === 1) return true;
  if (typeof status === 'string') {
    const normalized = status.trim().toLowerCase();
    return normalized === 'true' || normalized === 'success' || normalized === 'ok';
  }
  return false;
}

/** True when API body `status` explicitly indicates failure. */
export function isApiResponseFailure(status: unknown): boolean {
  if (status === false || status === 0) return true;
  if (typeof status === 'string') {
    const normalized = status.trim().toLowerCase();
    return normalized === 'false' || normalized === 'error' || normalized === 'failed';
  }
  return false;
}

/** Toast API `message` in green when `status` is success, red when failure. */
export function toastApiResponseMessage(
  data: ApiErrorResponse | null | undefined,
  fallbackError = 'Something went wrong.',
): void {
  if (!data || !hasNonEmptyApiMessage(data)) return;
  if (isApiResponseSuccess(data.status)) {
    toast.success(String(data.message).trim());
    return;
  }
  if (isApiResponseFailure(data.status)) {
    const color = getExceptionColor(data);
    toast.error(resolveApiErrorMessage(data, fallbackError), {
      style: getToastStyle(color),
    });
  }
}

/**
 * Resolve a user-facing error message from an API response body.
 * Priority: (1) `message` when present and non-empty, (2) `exception_code` → JSON map,
 * (3) `detail` / `error`, (4) caller fallback.
 */
export const resolveApiErrorMessage = (
  data?: ApiErrorResponse | null,
  fallbackMessage = 'Something went wrong.',
): string => {
  if (!data) return fallbackMessage;

  if (hasNonEmptyApiMessage(data)) {
    return String(data.message).trim();
  }

  if (data.exception_code) {
    const mapped = exceptionMap?.[data.exception_code]?.message;
    if (mapped) return mapped;
  }

  return (
    formatDetail(data.detail) ||
    (typeof data.error === 'string' ? data.error : undefined) ||
    fallbackMessage
  );
};

/**
 * User-facing message for UI catch blocks and inline errors.
 * Uses API `message` first, then `exception_code` mapping, then axios/fallback.
 */
export function getDisplayErrorMessage(
  error: unknown,
  fallbackMessage = 'Something went wrong.',
): string {
  if (error instanceof ApiRequestError) {
    return error.message;
  }
  return resolveAxiosErrorMessage(error, fallbackMessage);
}

/** Resolve a user-facing error message from an axios error or API response body. */
export const resolveAxiosErrorMessage = (
  error: unknown,
  fallbackMessage = 'Something went wrong.'
): string => {
  const err = error as {
    response?: { data?: ApiErrorResponse };
    message?: string;
  };

  const data = err?.response?.data;
  if (data) {
    return resolveApiErrorMessage(data, data.message || err?.message || fallbackMessage);
  }

  return err?.message || fallbackMessage;
};

/** Throw when the API body indicates failure (`status: false`) without showing a toast. */
export const throwIfApiErrorResponse = (
  data: ApiErrorResponse | null | undefined,
  fallbackMessage: string,
): void => {
  if (!isApiResponseFailure(data?.status)) return;

  const message = resolveApiErrorMessage(data, fallbackMessage);
  throw new ApiRequestError(message, data);
};

/** Throw when the API body indicates failure (`status: false`). */
export const handleApiErrorResponse = (
  data: ApiErrorResponse | null | undefined,
  fallbackMessage: string,
): void => {
  if (!isApiResponseFailure(data?.status)) return;

  if (typeof window !== 'undefined' && window.location.pathname.replace(/\/$/, '') === '/workflows') {
    return;
  }

  const message = resolveApiErrorMessage(data, fallbackMessage);
  const color = getExceptionColor(data);
  toast.error(message, {
    style: getToastStyle(color),
  });
  throw new ApiRequestError(message, data);
};

export const parseBlobAsApiError = async (blob: Blob): Promise<ApiErrorResponse | null> => {
  try {
    const text = await blob.text();
    if (!text) return null;
    return JSON.parse(text) as ApiErrorResponse;
  } catch {
    return null;
  }
};

/** Resolve error message when axios error response body is a Blob (e.g. file download failures). */
export const resolveAxiosBlobErrorMessage = async (
  error: unknown,
  fallbackMessage = 'Something went wrong.',
): Promise<string> => {
  const err = error as { response?: { data?: unknown; status?: number }; message?: string };
  if (!err?.response) {
    return resolveAxiosErrorMessage(error, fallbackMessage);
  }

  const { data, status } = err.response;
  if (data instanceof Blob) {
    const text = await data.text();
    try {
      const parsed = JSON.parse(text) as ApiErrorResponse;
      return resolveApiErrorMessage(parsed, parsed.message || `Server error: ${status}`);
    } catch {
      return text || `Server responded with status ${status}`;
    }
  }

  return resolveAxiosErrorMessage(error, fallbackMessage);
};

/** Inspect a blob (without consuming it) and throw if it is a JSON API error payload. */
export const assertBlobNotApiError = async (
  blob: Blob,
  fallbackMessage: string,
): Promise<void> => {
  const contentType = blob.type?.toLowerCase() ?? '';
  if (!contentType.includes('json') && !contentType.includes('problem') && blob.size > 2048) return;

  const parsed = await parseBlobAsApiError(blob.slice(0, blob.size, blob.type));
  if (!parsed) return;

  const hasFastApiError = parsed.detail != null || typeof parsed.error === 'string';
  if (parsed.status === false || hasFastApiError) {
    const message = resolveApiErrorMessage(parsed, fallbackMessage);
    throw new ApiRequestError(message, parsed);
  }
};

/** Re-throw as ApiRequestError with resolved message (no toast; callers display errors). */
export async function rethrowApiError(
  error: unknown,
  fallbackMessage: string,
): Promise<never> {
  if (isRequestAborted(error)) throw error;
  if (error instanceof ApiRequestError) throw error;

  const err = error as { response?: { data?: unknown } };
  const message =
    err?.response?.data instanceof Blob
      ? await resolveAxiosBlobErrorMessage(error, fallbackMessage)
      : resolveAxiosErrorMessage(error, fallbackMessage);

  throw new ApiRequestError(
    message,
    err?.response?.data instanceof Blob ? undefined : (err?.response?.data as ApiErrorResponse),
  );
}

/** Execute an axios request with standardized exception handling. */
export async function executeApiRequest<T>(
  request: () => Promise<AxiosResponse<T>>,
  fallbackMessage = 'Something went wrong.',
): Promise<T> {
  try {
    const res = await request();
    handleApiErrorResponse(res.data as ApiErrorResponse, fallbackMessage);
    return res.data;
  } catch (error) {
    if (isRequestAborted(error)) throw error;
    if (error instanceof ApiRequestError) throw error;

    const err = error as { response?: { data?: ApiErrorResponse; status?: number } };
    const message = resolveAxiosErrorMessage(error, fallbackMessage);
    const apiError = err?.response?.data || (err?.response?.status ? { status_code: err.response.status } : undefined);
    const color = getExceptionColor(apiError);
    toast.error(message, {
      style: getToastStyle(color),
    });
    throw new ApiRequestError(message, err?.response?.data);
  }
}

/** Like executeApiRequest but does not toast — callers show error.message. */
export async function executeApiRequestSilent<T>(
  request: () => Promise<AxiosResponse<T>>,
  fallbackMessage = 'Something went wrong.',
): Promise<T> {
  try {
    const res = await request();
    throwIfApiErrorResponse(res.data as ApiErrorResponse, fallbackMessage);
    return res.data;
  } catch (error) {
    await rethrowApiError(error, fallbackMessage);
  }
}