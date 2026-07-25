import type { AxiosRequestConfig } from 'axios';
import { apiV2 } from './api';
import { executeApiRequestSilent } from '@/utils/exceptionHelper';

export function apiV2Get<T>(
  url: string,
  config?: AxiosRequestConfig,
  fallbackMessage = 'Request failed',
): Promise<T> {
  return executeApiRequestSilent<T>(
    () => apiV2.get<T>(url, config),
    fallbackMessage,
  );
}

export function apiV2Post<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
  fallbackMessage = 'Request failed',
): Promise<T> {
  return executeApiRequestSilent<T>(
    () => apiV2.post<T>(url, data, config),
    fallbackMessage,
  );
}

export function apiV2Patch<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
  fallbackMessage = 'Request failed',
): Promise<T> {
  return executeApiRequestSilent<T>(
    () => apiV2.patch<T>(url, data, config),
    fallbackMessage,
  );
}

export function apiV2Put<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
  fallbackMessage = 'Request failed',
): Promise<T> {
  return executeApiRequestSilent<T>(
    () => apiV2.put<T>(url, data, config),
    fallbackMessage,
  );
}

export function apiV2Delete<T = unknown>(
  url: string,
  config?: AxiosRequestConfig,
  fallbackMessage = 'Request failed',
): Promise<T> {
  return executeApiRequestSilent<T>(
    () => apiV2.delete<T>(url, config),
    fallbackMessage,
  );
}
