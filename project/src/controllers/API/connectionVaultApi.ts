import api from './api';
import { executeApiRequestSilent } from '@/utils/exceptionHelper';

export type ConnectionVaultListResponse = {
  status?: boolean;
  message?: string;
  data?: unknown[];
};

export const ANALYTICS_STUDIO_CONNECTION_SOURCES = [
  'databases',
  'storage',
  'notifications',
  'ingestion',
] as const;

export type AnalyticsStudioConnectionSource =
  (typeof ANALYTICS_STUDIO_CONNECTION_SOURCES)[number];

export type ConnectionVaultAllConnectionsResponse = {
  status?: boolean;
  message?: string;
  data?: unknown;
};

export async function fetchConnectionGroup(
  path: string,
  body: Record<string, unknown>,
): Promise<ConnectionVaultListResponse> {
  return executeApiRequestSilent(
    () => api.post<ConnectionVaultListResponse>(path, body),
    'Failed to load connections',
  );
}

export async function fetchAllConnections(
  sources: AnalyticsStudioConnectionSource[] = [...ANALYTICS_STUDIO_CONNECTION_SOURCES],
): Promise<ConnectionVaultAllConnectionsResponse> {
  return executeApiRequestSilent(
    () =>
      api.post<ConnectionVaultAllConnectionsResponse>('/flow-builder/get-all-connections', {
        source: sources,
      }),
    'Failed to load connections',
  );
}

export const CONNECTION_VAULT_GROUPS = [
  'Databases',
  'Data warehouse',
  'Enterprise Integration',
  'Notifications',
  'BPM',
  'Ingestion',
  'Lakehouse',
  'OT - BMS',
  'OT - Field Protocols',
  'OT - Industrial',
  'OT - Messaging',
  'OT - Network & Infrastructure',
  'OT - Utilities',
  'Orchestration',
  'Storage',
  'compute',
  'streaming',
] as const;

type ConnectionVaultFormResponse = {
  status?: boolean;
  message?: string;
  data?: unknown[];
};

function mergeConnectionVaultFormResults(
  results: (ConnectionVaultFormResponse | null)[],
): ConnectionVaultFormResponse {
  const merged: unknown[] = [];
  const seenFormIds = new Set<string>();

  for (const result of results) {
    if (!result?.status || !Array.isArray(result.data)) continue;
    for (const item of result.data) {
      const formId =
        item && typeof item === 'object' && 'form_id' in item
          ? String((item as { form_id: string }).form_id)
          : '';
      if (formId && seenFormIds.has(formId)) continue;
      if (formId) seenFormIds.add(formId);
      merged.push(item);
    }
  }

  return {
    status: merged.length > 0,
    message: 'Success',
    data: merged,
  };
}

async function fetchConnectionVaultFormsByGroup(
  group: string,
  options?: { formId?: string; onlyNode?: boolean },
): Promise<ConnectionVaultFormResponse | null> {
  return executeApiRequestSilent<ConnectionVaultFormResponse>(
    () =>
      api.post('/react-forms/get-form', {
        form_id: options?.formId ?? '',
        form_type: 'connection_vault',
        ...(options?.onlyNode ? { only_node: true } : {}),
        group,
      }),
    `Failed to load connection vault forms for group "${group}"`,
  );
}

export async function fetchConnectionVaultConnectors() {
  const results = await Promise.all(
    CONNECTION_VAULT_GROUPS.map((group) =>
      fetchConnectionVaultFormsByGroup(group, { onlyNode: true }),
    ),
  );
  return mergeConnectionVaultFormResults(results);
}

export async function fetchConnectionFormSchema(formId: string) {
  const result = await executeApiRequestSilent<ConnectionVaultFormResponse>(
    () =>
      api.post('/react-forms/get-form', {
        form_id: formId,
        form_type: 'connection_vault',
      }),
    'Failed to load form schema',
  );
  if (result?.status && result.data && result.data.length > 0) {
    return result.data[0];
  }
  return null;
}

export function resolveConnectionModule(
  schema?: { save_connection?: { module?: string } } | null,
  fallback = 'databases',
): string {
  return schema?.save_connection?.module ?? fallback;
}

export async function fetchConnectionById(module: string, connectionId: string) {
  return executeApiRequestSilent<ConnectionVaultListResponse>(
    () => api.post(`/${module}/get-connections`, { connection_id: connectionId }),
    'Failed to load connection details',
  );
}

export async function fetchConnectionsByType(
  module: string,
  connectionType: string,
): Promise<ConnectionVaultListResponse> {
  return fetchConnectionGroup(`/${module}/get-connections`, {
    connection_type: connectionType,
  });
}

export async function deleteConnection(module: string, connectionId: string) {
  return executeApiRequestSilent<{ status?: boolean; message?: string }>(
    () => api.post(`/${module}/delete-connection`, { connection_id: connectionId }),
    'Failed to delete connection',
  );
}

export async function updateConnection(apiUrl: string, payload: Record<string, unknown>) {
  return executeApiRequestSilent<{ status?: boolean; message?: string }>(
    () => api.post(apiUrl, payload),
    'Failed to update connection',
  );
}

export async function createConnection(apiUrl: string, payload: Record<string, unknown>) {
  return executeApiRequestSilent<{ status?: boolean; message?: string }>(
    () => api.post(apiUrl, payload),
    'Failed to create connection',
  );
}
