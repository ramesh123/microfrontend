import { apiV2 } from '@/controllers/API/api';
import { executeApiRequestSilent } from '@/utils/exceptionHelper';

/** Single view item from GET /views (API may return objects with view_name, schema, etc.) */
export interface ViewItem {
  view_name: string;
  schema?: string;
  type?: string;
  source_table?: string;
  join_metadata?: unknown;
  created_at?: string;
  [key: string]: unknown;
}

/** GET /views?tenant_id=&domain_id= — list available views (objects or strings) */
export interface ViewsListResponse {
  views?: ViewItem[] | string[];
  [key: string]: unknown;
}

export async function fetchViews(
  tenantId: string,
  domainId: string = ''
): Promise<ViewItem[]> {
  const params: Record<string, string> = { tenant_id: tenantId };
  if (domainId) params.domain_id = domainId;
  const data = await executeApiRequestSilent<ViewsListResponse | ViewItem[]>(
    () => apiV2.get<ViewsListResponse | ViewItem[]>('/views', { params }),
    'Failed to load views',
  );
  const raw = Array.isArray(data) ? data : (data && typeof data === 'object' && 'views' in data ? (data as ViewsListResponse).views : []) ?? [];
  const list = Array.isArray(raw) ? raw : [];
  return list.map((item): ViewItem => {
    if (typeof item === 'string') return { view_name: item };
    if (item && typeof item === 'object' && 'view_name' in item && typeof (item as ViewItem).view_name === 'string') {
      return item as ViewItem;
    }
    return { view_name: String((item as Record<string, unknown>)?.view_name ?? '') };
  }).filter((v) => v.view_name);
}

/** GET /views/{view_name}/schema — column_name and data_type per column */
export interface ViewSchemaColumn {
  column_name: string;
  data_type: string;
  [key: string]: unknown;
}

export interface ViewSchemaResponse {
  view_name?: string;
  schema?: string;
  columns?: ViewSchemaColumn[];
  [key: string]: unknown;
}

export async function fetchViewSchema(
  viewName: string,
  tenantId: string,
  domainId: string = ''
): Promise<ViewSchemaColumn[]> {
  const params: Record<string, string> = { tenant_id: tenantId };
  if (domainId) params.domain_id = domainId;
  const data = await executeApiRequestSilent<ViewSchemaResponse>(
    () =>
      apiV2.get<ViewSchemaResponse>(
        `/views/${encodeURIComponent(viewName)}/schema`,
        { params }
      ),
    `Failed to load schema for ${viewName}`,
  );
  const raw = (data?.columns ?? []) as Array<{ column_name?: string; data_type?: string; name?: string; type?: string }>;
  if (!Array.isArray(raw)) return [];
  return raw.map((c) => ({
    column_name: c.column_name ?? c.name ?? '',
    data_type: c.data_type ?? c.type ?? '',
  }));
}

/** POST /views/query — execute SQL and return rows */
export interface ViewQueryPayload {
  tenant_id: string;
  domain_id: string;
  sql: string;
  limit?: number;
}

export interface ViewQueryResponse {
  rows?: Record<string, unknown>[];
  columns?: string[];
  data?: Record<string, unknown>[];
  [key: string]: unknown;
}

export async function executeViewQuery(payload: ViewQueryPayload): Promise<ViewQueryResponse> {
  return executeApiRequestSilent<ViewQueryResponse>(
    () =>
      apiV2.post<ViewQueryResponse>('/views/query', {
        tenant_id: payload.tenant_id,
        domain_id: payload.domain_id ?? '',
        sql: payload.sql,
        limit: payload.limit ?? 100,
      }),
    'Query failed',
  );
}
