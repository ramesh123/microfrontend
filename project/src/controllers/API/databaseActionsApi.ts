import api from './api';
import { executeApiRequestSilent } from '@/utils/exceptionHelper';
import { fetchConnectionGroup } from './connectionVaultApi';

export async function fetchPostgresqlConnectionsForForms(fields?: string) {
  return fetchConnectionGroup('/databases/get-connections', {
    ...(fields ? { fields } : {}),
    connection_type: 'postgresql',
  });
}

export async function postPostgresqlAction<T = unknown>(
  payload: Record<string, unknown>,
  fallbackMessage = 'Database action failed',
) {
  return executeApiRequestSilent<T>(
    () => api.post<T>('/databases/postgresql-actions', { payload }),
    fallbackMessage,
  );
}
