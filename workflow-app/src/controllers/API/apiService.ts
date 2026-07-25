import { FetchConfig, FormFieldOption, SaveNodeConfig } from '@/types/form';
import api from './api';
import { executeApiRequest, rethrowApiError } from '@/utils/exceptionHelper';
import { resolveDatabaseActionsKlass } from '@/utils/sapNodeActions';

// --- Template Replacer Utility ---
const replaceTemplateStrings = (obj: any, values: Record<string, any>): any => {
  if (Array.isArray(obj)) {
    return obj.map(item => replaceTemplateStrings(item, values));
  }
  if (typeof obj === 'object' && obj !== null) {
    return Object.keys(obj).reduce((acc, key) => {
      acc[key] = replaceTemplateStrings(obj[key], values);
      return acc;
    }, {} as any);
  }
  if (typeof obj === 'string') {
    const match = obj.match(/^{{(.*)}}$/);
    if (match && match[1]) {
      const key = match[1];
      // Return the actual value if it exists and is not empty, otherwise return empty string
      const value = values[key];
      return (value !== undefined && value !== null && value !== '') ? value : '';
    }
  }
  return obj;
};

const getDependencies = (obj: any): string[] => { 
  const deps = new Set<string>();
  const findDeps = (o: any) => { 
    if (Array.isArray(o)) { 
      o.forEach(findDeps);
    } else if (typeof o === 'object' && o !== null) {
      Object.values(o).forEach(findDeps);
    } else if (typeof o === 'string') { 
      const match = o.match(/^{{(.*)}}$/);
      if (match && match[1]) {
        deps.add(match[1]);
      }
    }
  };
  findDeps(obj);
  return Array.from(deps);
}


// --- MOCK API ROUTER ---
// This function simulates a backend. It intercepts API calls and returns mock data.
const mockApiRouter = async (fetchConfig: FetchConfig, payload: any): Promise<any> => {
  console.log(`[Mock API] Intercepted call to ${fetchConfig.module}/${fetchConfig.klass} with payload:`, payload);
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay

  if (fetchConfig.klass.includes('get-connections')) { 
    return [
      { label: 'Main PostgreSQL DB', value: 'pg_main_conn' },
      { label: 'Legacy PostgreSQL DB', value: 'pg_legacy_conn' },
    ];
  }

 

  if (fetchConfig.klass.includes('postgresql-actions')) {  

    const action = payload?.actions || payload?.payload?.actions;
    const data = payload?.data || payload?.payload?.data || {};

    switch (action) {   
      case 'get_databases':
        if (data.connection) { 
          return [{ label: 'Production DB', value: 'prod_db' }, { label: 'Staging DB', value: 'stg_db' }];
        }
        return [];
      case 'get_schemas':
        if (data.database === 'prod_db') {
          return [{ label: 'public', value: 'public' }, { label: 'analytics', value: 'analytics' }];
        }
        return [{ label: 'public', value: 'public' }];
      case 'get_tables':
        if (data.schema === 'analytics') {
          return [{ label: 'user_sessions', value: 'user_sessions' }, { label: 'daily_reports', value: 'daily_reports' }];
        }
        return [{ label: 'users', value: 'users' }, { label: 'products', value: 'products' }];
      case 'get_columns':
        if (data.table === 'users') {  
          return [{ label: 'id', value: 'id' }, { label: 'name', value: 'name' }, { label: 'email', value: 'email' }];
        }
        return [{ label: 'id', value: 'id' }, { label: 'data', value: 'data' }, { label: 'timestamp', value: 'timestamp' }];
      default:
        return [];
    }
  }

  if (fetchConfig.klass.includes('create-workflow-node')) {  
    console.log('[Mock API] Simulating save:', payload);
    return { success: true, savedData: payload };
  }

  return [];
};

/** True only when template `fetch.klass` is exactly `"excel-actions"` (same as backend JSON). */
export function isExcelActionsFetchConfig(fetchConfig: { klass?: string } | null | undefined): boolean {
  return fetchConfig?.klass === 'excel-actions';
}

function isWriteSftpMode(formValues: Record<string, any> | undefined): boolean {
  if (!formValues) return false;
  const mode = String(formValues.mode ?? '').toLowerCase();
  const type = String(formValues.type ?? '').toLowerCase();
  return mode === 'write' && type === 'sftp';
}

/**
 * `{{skip_footer}}` / `{{skip_row}}` often appear in `files/*` fetch params (including templates that omit
 * `klass`). Editing those fields must not refetch dropdowns or call sheet/excel APIs — they are not
 * structural inputs (connection, path, file id, etc.).
 *
 * **Write + SFTP + `file_name`:** the name is the destination file being authored; it must not trigger
 * `excel-actions` / `files` sheet fetches (same placeholder may appear in params for the payload only).
 */
export function shouldSkipExcelActionsTriggerForChangedField(
  fetchConfig: { klass?: string; module?: string } | null | undefined,
  changedFieldName: string | undefined,
  formValues?: Record<string, any>
): boolean {
  if (!changedFieldName) return false;

  if (isWriteSftpMode(formValues) && changedFieldName === 'file_name') {
    const mod = String(fetchConfig?.module ?? '').toLowerCase();
    if (mod === 'files' || isExcelActionsFetchConfig(fetchConfig)) return true;
  }

  if (changedFieldName !== 'skip_footer' && changedFieldName !== 'skip_row') return false;
  const mod = String(fetchConfig?.module ?? '').toLowerCase();
  if (mod === 'files') return true;
  return isExcelActionsFetchConfig(fetchConfig);
}

/** True when a plain form field change must not cascade into dependent `fetch` / `{{…}}` refetches. */
export function shouldSkipCascadeRefetchForChangedKey(
  changedFieldKey: string | undefined,
  formValues?: Record<string, any>
): boolean {
  if (changedFieldKey === 'skip_footer' || changedFieldKey === 'skip_row') return true;
  if (changedFieldKey === 'file_name' && isWriteSftpMode(formValues)) return true;
  return false;
}

/**
 * Excel write + SFTP: `sftp` uses get-connections only; `excel-actions` must not run until
 * `sftp_destination_path` is set (that field has no fetch — it should not indirectly trigger excel-actions).
 */
export function shouldBlockExcelActionsForWriteSftp(
  fetchConfig: { klass?: string },
  formValues: Record<string, any>
): boolean {
  if (!isExcelActionsFetchConfig(fetchConfig)) return false;
  const mode = String(formValues?.mode ?? '').toLowerCase();
  const type = String(formValues?.type ?? '').toLowerCase();
  if (mode !== 'write' || type !== 'sftp') return false;
  const dest = formValues?.sftp_destination_path;
  return dest == null || String(dest).trim() === '';
}

// --- Main Fetch Function ---
export const fetchDynamicOptions = async (
  fetchConfig: FetchConfig,
  formValues: Record<string, any>
): Promise<FormFieldOption[]> => {
  if (shouldBlockExcelActionsForWriteSftp(fetchConfig, formValues)) {
    return [];
  }

  const mod = String(fetchConfig.module ?? '').toLowerCase();
  const klassTrim = fetchConfig.klass != null ? String(fetchConfig.klass).trim() : '';
  if (mod === 'files' && !klassTrim) {
    console.warn('[fetchDynamicOptions] Skipping files fetch: missing `fetch.klass`');
    return [];
  }

  const resolvedParams = replaceTemplateStrings(fetchConfig.params, formValues);

  // Add stmtDate to the payload data if this is an excel-actions call
  let bodyPayload = resolvedParams;

  // If this is a get-files call for master_data, ensure all required fields are requested
  if (
    fetchConfig.module === 'files' &&
    fetchConfig.klass === 'get-files' &&
    bodyPayload?.file_category === 'master_data'
  ) {
    bodyPayload = {
      ...bodyPayload,
      fields: JSON.stringify([
        'unique_id as value',
        'display_name as label',
        'file_name',
        'file_type',
        'encrypted_file_key',
        'sheet_name',
      ]),
    };
  }

  if (isExcelActionsFetchConfig(fetchConfig) && bodyPayload?.payload?.data) {
    bodyPayload = {
      ...bodyPayload,
      payload: {
        ...bodyPayload.payload,
        data: {
          ...bodyPayload.payload.data,
          stmtDate: formValues.stmtDate
        }
      }
    };
  }

  const resolvedKlass = resolveDatabaseActionsKlass(fetchConfig.klass);
  const url = `/${fetchConfig.module}/${resolvedKlass}`;
  const httpMethod = (fetchConfig.method || 'POST').toUpperCase();

  try {
    const result = await executeApiRequest(
      () =>
        httpMethod === 'GET'
          ? api.get(url, { params: bodyPayload })
          : api.post(url, bodyPayload),
      `Failed to load options for ${resolvedKlass}`,
    );

    let data: FormFieldOption[];

    if (Array.isArray(result)) {
      if (result.length > 0 && typeof result[0] === 'object' && 'label' in result[0]) {
        data = result as FormFieldOption[];
      } else {
        data = result.map((item: unknown) => ({
          label: String(item),
          value: String(item),
        }));
      }
    } else if (result?.data && Array.isArray(result.data)) {
      if (result.data.length > 0 && typeof result.data[0] === 'object' && 'label' in result.data[0]) {
        data = result.data as FormFieldOption[];
      } else {
        data = result.data.map((item: unknown) => ({
          label: String(item),
          value: String(item),
        }));
      }
    } else {
      console.error('API did not return a valid array format:', result);
      return [];
    }

    console.log(`[API Response] Transformed ${data.length} options for ${fetchConfig.klass}:`, data);
    return data;
  } catch (error) {
    console.error(`Failed to fetch from ${url}:`, error);
    await rethrowApiError(error, `Failed to load options for ${fetchConfig.klass}`);
  }
};

export const getFieldDependencies = (fetchConfig: FetchConfig): string[] => {
  return getDependencies(fetchConfig.params);
}

export const uploadFileApi = async (formData: FormData): Promise<any> => {
  return executeApiRequest(
    () => api.post('/files/upload-file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
    'Failed to upload file',
  );
};

// --- New Save Function ---
export const saveFormData = async (
  saveConfig: SaveNodeConfig,
  formValues: Record<string, any>,
  payloadTemplate: Record<string, any>,
  flowId?: string
): Promise<Record<string, any>> => {
  let finalPayload = replaceTemplateStrings(payloadTemplate, formValues);

  // Add flow_id to payload if provided and if payload has a flow_id property
  if (flowId && finalPayload.hasOwnProperty('flow_id')) {
    finalPayload.flow_id = flowId;
    console.log('[saveFormData] Adding flow_id to payload:', flowId);
  }

  const resolvedKlass = resolveDatabaseActionsKlass(saveConfig.klass);
  const url = `/${saveConfig.module}/${resolvedKlass}/`;
  const httpMethod = (saveConfig.method || 'POST').toUpperCase();

  try {
    const data = await executeApiRequest<Record<string, any>>(
      () =>
        httpMethod === 'GET'
          ? api.get(url, { params: finalPayload })
          : api.post(url, finalPayload),
      'Failed to save form data',
    );
    return data.savedData || data;
  } catch (error) {
    console.error(`Failed to save to ${url}:`, error);
    await rethrowApiError(error, 'Failed to save form data');
  }
};

// Interface for the API response data
interface Option {
  value: number | string;
  label: string;
}

interface ApiResponse {
  status: boolean;
  message: string;
  data: Option[];
}

export const fetchDatabaseConnections = async (): Promise<Option[]> => {
  console.log("Fetching database connections...");

  const payload = {
    fields: '["id as value", "name as label"]',
    connection_type: "",
  };

  try {
    const response = await executeApiRequest<ApiResponse>(
      () => api.post<ApiResponse>('/databases/get-connections', payload),
      'Failed to fetch database connections',
    );
    if (response?.status) {
      return response.data ?? [];
    }
    return [];
  } catch (error) {
    console.error('Error fetching database connections:', error);
    await rethrowApiError(error, 'Failed to fetch database connections');
  }
};



export const runDatabaseAction = async (data: { payload: any }) => {
  const { payload } = data;
  return executeApiRequest(
    () => api.post('/databases/sap-actions', { payload }),
    'Database action failed',
  );
};

export const getSapValidationParams = async (payload: any): Promise<any> => {
  console.log('Fetching SAP validation params with payload:', payload);
  const result = await executeApiRequest(
    () => api.post('/sap-validation-engine/get-validation-parms', payload),
    'Failed to fetch SAP validation params',
  );
  console.log('Fetched SAP validation params:', result);
  return result;
};

interface OrgPerspectiveResponse {
  status: boolean;
  message: string;
  data: {
    org_details: Array<{
      value: number;
      label: string;
    }>;
    perspective_details: Array<{
      value: number;
      label: string;
    }>;
  };
}

export const getOrganizationPerspectiveIds = async (username: string): Promise<OrgPerspectiveResponse> => {
  console.log('Fetching organization and perspective details for username:', username);

  const result = await executeApiRequest<OrgPerspectiveResponse>(
    () => api.post<OrgPerspectiveResponse>('/organization/get-org-id-perspective-ids', { username }),
    'Failed to fetch organization and perspective details',
  );
  console.log('Fetched org and perspective details:', result);
  return result;
};


export const getPerspectiveOrganizationIds = async (payload: { org_id: string }) => {
  const result = await executeApiRequest(
    () => api.post('/perspectives/get-perspectives-org-id', payload),
    'Failed to fetch perspective details',
  );
  return result;
};

export const createFileDatasetApi = async (payload: any): Promise<any> => {
  return executeApiRequest(
    () => api.post('/files/create-file', payload),
    'Failed to create file dataset',
  );
};
