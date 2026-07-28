import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import {
  assertBlobNotApiError,
  executeApiRequestSilent,
  rethrowApiError,
} from "@/utils/exceptionHelper";

/** Execute an IoT gateway axios call with standardized exception handling. */
export async function iotSilent<T>(
  client: AxiosInstance,
  request: () => Promise<AxiosResponse<T>>,
  fallbackMessage = "Request failed",
): Promise<T> {
  return executeApiRequestSilent(request, fallbackMessage);
}

export async function iotSilentBlob(
  client: AxiosInstance,
  request: () => Promise<AxiosResponse<Blob>>,
  fallbackMessage = "Request failed",
): Promise<Blob> {
  try {
    const res = await request();
    await assertBlobNotApiError(res.data, fallbackMessage);
    return res.data;
  } catch (error) {
    await rethrowApiError(error, fallbackMessage);
  }
}

export async function iotPost<T>(
  client: AxiosInstance,
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
  fallbackMessage = "Request failed",
): Promise<T> {
  return iotSilent(client, () => client.post<T>(url, body, config), fallbackMessage);
}

export async function iotGet<T>(
  client: AxiosInstance,
  url: string,
  config?: AxiosRequestConfig,
  fallbackMessage = "Request failed",
): Promise<T> {
  return iotSilent(client, () => client.get<T>(url, config), fallbackMessage);
}

export async function iotPut<T>(
  client: AxiosInstance,
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
  fallbackMessage = "Request failed",
): Promise<T> {
  return iotSilent(client, () => client.put<T>(url, body, config), fallbackMessage);
}

export async function iotDelete(
  client: AxiosInstance,
  url: string,
  config?: AxiosRequestConfig,
  fallbackMessage = "Request failed",
): Promise<void> {
  await iotSilent(client, () => client.delete(url, config), fallbackMessage);
}
