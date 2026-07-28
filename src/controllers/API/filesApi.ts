import type { AxiosProgressEvent } from 'axios';
import api from './api';
import {
  ApiRequestError,
  executeApiRequestSilent,
  isApiResponseSuccess,
  resolveApiErrorMessage,
  throwIfApiErrorResponse,
  type ApiErrorResponse,
} from '@/utils/exceptionHelper';

function isFormFieldRecord(value: unknown): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    'name' in value &&
    'display_name' in value
  );
}

/** Normalizes `/files/get-files` payloads (`data` array or nested list). */
export function normalizeMasterDataFilesData(data: unknown): unknown[] | null {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    for (const key of ['files', 'records', 'items', 'results', 'data']) {
      const candidate = record[key];
      if (Array.isArray(candidate)) return candidate;
    }
  }
  return null;
}

/** Extracts form field definitions from `/react-forms/get-form` responses. */
export function extractGetFormFieldList(result: {
  status?: unknown;
  data?: unknown;
}): unknown[] | null {
  if (!isApiResponseSuccess(result?.status)) return null;
  const raw = result.data;
  if (raw == null) return null;

  // Case 1: data is an array
  if (Array.isArray(raw) && raw.length > 0) {
    const first = raw[0];
    if (first && typeof first === 'object' && !Array.isArray(first)) {
      const block = first as Record<string, unknown>;
      
      // If the first element is a form definition containing fields, return those fields
      if (Array.isArray(block.form_data)) return block.form_data;
      if (Array.isArray(block.fields)) return block.fields;
      
      // Handle object-based form_data within the first element
      if (block.form_data && typeof block.form_data === 'object') {
        return Object.values(block.form_data as object);
      }
      
      // If it's just an array of field objects (not a form definition)
      if (isFormFieldRecord(first)) return raw;
      
      const values = Object.values(block);
      if (values.length > 0 && isFormFieldRecord(values[0])) return values;
      if (values.length > 0 && Array.isArray(values[0])) return values[0];
    }
  }

  // Case 2: data is a single object (block)
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const block = raw as Record<string, unknown>;
    if (Array.isArray(block.form_data)) return block.form_data;
    if (Array.isArray(block.fields)) return block.fields;
    
    if (block.form_data && typeof block.form_data === 'object') {
      return Object.values(block.form_data as object);
    }
    
    const values = Object.values(raw as object);
    if (values.length > 0 && isFormFieldRecord(values[0])) return values;
  }

  return null;
}

export type MasterDataFilesResponse = {
  status?: boolean;
  message?: string;
  data?: unknown[];
};

export const getMasterDataFiles = async (payload?: any): Promise<MasterDataFilesResponse> => {
  const finalPayload = payload || { file_category: 'master_data' };
  return executeApiRequestSilent(
    () => api.post<MasterDataFilesResponse>('/files/get-files', finalPayload),
    'Failed to fetch files',
  );
};

export const getFileData = async (uniqueId: string): Promise<unknown> => {
  return executeApiRequestSilent(
    () =>
      api.post('/files/view-data', {
        payload: { unique_id: uniqueId },
      }),
    'Failed to load file data',
  );
};

export const createGlobalField = async (payload: {
  master_id: string;
  master_type: string;
  key_name: string;
  key_description: string;
  key_value: string;
}): Promise<unknown> => {
  return executeApiRequestSilent(
    () => api.post('/validation-component/create-global-fields', payload),
    'Failed to create global field',
  );
};

export type ExcelSheetNamesUploadContext = {
  file_name: string;
  unique_id: string;
  encrypted_file_key: string;
  file_category?: string;
};

export async function getExcelSheetNamesForUploadedFile(
  ctx: ExcelSheetNamesUploadContext,
  options?: { signal?: AbortSignal },
): Promise<string[]> {
  const file_category = ctx.file_category ?? 'master_data';
  const requestBody = {
    params: {
      payload: {
        data: {
          file_name: ctx.file_name,
          unique_id: ctx.unique_id,
          file_category,
          encrypted_file_key: ctx.encrypted_file_key,
        },
        klass: 'excel',
        actions: 'get_sheet_names',
      },
    },
  };
  const raw = await executeApiRequestSilent<unknown>(
    () => api.post('/files/excel-actions', requestBody, { signal: options?.signal }),
    'Failed to fetch sheet names',
  );
  if (Array.isArray(raw)) return raw.map(String);
  if (raw && typeof raw === 'object' && 'data' in raw) {
    const inner = (raw as { data: unknown }).data;
    if (Array.isArray(inner)) return inner.map(String);
  }
  if (raw && typeof raw === 'object') {
    throwIfApiErrorResponse(raw as ApiErrorResponse, 'Failed to fetch sheet names');
  }
  return [];
}

export type CreateUploadedFileApiPayload = {
  file_name: string;
  display_name: string;
  encrypted_file_key: string;
  unique_id: string;
  size: string;
  sheet_name: string;
  delimiter: string;
  file_type: string;
  file_category: string;
  created_by: string;
  updated_by: string;
  comments?: string;
};

export async function createUploadedFileRecord(
  payload: CreateUploadedFileApiPayload,
): Promise<void> {
  await executeApiRequestSilent(
    () => api.post('/files/create-file', payload),
    'Failed to create file record',
  );
}

export type UploadedFileRef = {
  file_name: string;
  unique_id: string;
  encrypted_file_key: string;
  size: string;
};

export async function createUploadedFileRecordsForSheets(options: {
  upload: UploadedFileRef;
  sheetNames: string[];
  file_category?: string;
  file_type?: string;
}): Promise<{ succeeded: string[]; failed: { sheet: string; error: string }[] }> {
  const file_category = options.file_category ?? 'master_data';
  const file_type = options.file_type ?? 'excel';
  const dot = options.upload.file_name.lastIndexOf('.');
  const baseName =
    dot > 0 ? options.upload.file_name.slice(0, dot) : options.upload.file_name;

  const succeeded: string[] = [];
  const failed: { sheet: string; error: string }[] = [];

  for (const sheet_name of options.sheetNames) {
    const payload: CreateUploadedFileApiPayload = {
      file_name: options.upload.file_name,
      display_name: `${baseName} — ${sheet_name}`,
      encrypted_file_key: options.upload.encrypted_file_key,
      unique_id: options.upload.unique_id,
      size: options.upload.size,
      sheet_name,
      delimiter: '',
      file_type,
      file_category,
      created_by: '',
      updated_by: '',
    };
    try {
      await createUploadedFileRecord(payload);
      succeeded.push(sheet_name);
    } catch (e: unknown) {
      failed.push({
        sheet: sheet_name,
        error: e instanceof Error ? e.message : 'Request failed',
      });
    }
  }

  return { succeeded, failed };
}

export type ViewMasterDataFilePayload = {
  unique_id: string;
  file_name: string;
  encrypted_file_key: string;
  file_type?: string;
  delimiter?: string;
  sheet_name?: string;
};

export type ViewMasterDataFileResponse = {
  status?: boolean;
  data?: unknown[];
  columns?: string[];
  message?: string;
};

export async function viewMasterDataFileData(
  payload: ViewMasterDataFilePayload,
): Promise<ViewMasterDataFileResponse> {
  const file_type = payload.file_type ?? 'excel';
  const delimiter = payload.delimiter ?? '';
  const viewPayload: Record<string, string> = {
    unique_id: String(payload.unique_id),
    file_type,
    file_name: payload.file_name,
    encrypted_file_key: payload.encrypted_file_key,
    delimiter,
  };
  if (payload.sheet_name != null && payload.sheet_name !== '') {
    viewPayload.sheet_name = payload.sheet_name;
  }
  return executeApiRequestSilent(
    () =>
      api.post<ViewMasterDataFileResponse>('/files/view-data', {
        payload: viewPayload,
      }),
    'Failed to load file data',
  );
}

/** @deprecated Use viewMasterDataFileData */
export async function viewUploadedFileData(payload: ViewMasterDataFilePayload): Promise<unknown> {
  return viewMasterDataFileData(payload);
}

export type FileUploadApiResponse = {
  unique_id?: string;
  file_name?: string;
  encrypted_file_key?: string;
  size?: string;
  message?: string;
  status?: boolean;
};

export async function uploadMasterDataFile(
  formData: FormData,
  onUploadProgress?: (event: AxiosProgressEvent) => void,
): Promise<FileUploadApiResponse> {
  return executeApiRequestSilent(
    () =>
      api.post<FileUploadApiResponse>('/files/upload-file', formData, {
        headers: { 'Content-Type': 'multipart/form-data', Accept: 'application/json' },
        onUploadProgress,
      }),
    'File upload failed',
  );
}

export async function fetchMasterDataUploadFormSchema(): Promise<unknown[]> {
  const result = await executeApiRequestSilent<{
    status?: boolean;
    message?: string;
    data?: { form_data?: unknown[] }[];
  }>(
    () =>
      api.post('/react-forms/get-form', {
        form_id: 'master_data_upload_form',
      }),
    'Failed to load form schema',
  );
  const fields = extractGetFormFieldList(result);
  if (fields) return fields;
  if (isApiResponseSuccess(result?.status)) {
    return [];
  }
  throw new ApiRequestError(
    resolveApiErrorMessage(result, result?.message || 'Failed to load form schema'),
    result as ApiErrorResponse,
  );
}

export async function createMasterDataFile(
  payload: CreateUploadedFileApiPayload,
): Promise<void> {
  await createUploadedFileRecord(payload);
}

export type UpdateMasterDataFilePayload = {
  file_id: string;
  file_name: string;
  display_name: string;
  encrypted_file_key: string;
  unique_id: string;
  size: string;
  sheet_name: string;
  delimiter: string;
  file_type: string;
  file_category: string;
  created_by: string;
  updated_by: string;
  comments?: string;
};

export async function updateMasterDataFile(payload: UpdateMasterDataFilePayload): Promise<void> {
  await executeApiRequestSilent(
    () => api.post('/files/update-file', payload),
    'Failed to update file',
  );
}

export async function downloadMasterDataFile(fileId: string | number): Promise<string> {
  const data = await executeApiRequestSilent<string>(
    () =>
      api.post<string>('/files/download-file', {
        unique_id: [String(fileId)],
      }),
    'Failed to download file',
  );
  if (!data) {
    throw new Error('File URL not found in response');
  }
  return data;
}

export async function getFileUrl(options: { uniqueId?: string; encryptedFileKey?: string }): Promise<string> {
  const payload: any = {};
  if (options.uniqueId) {
    payload.unique_id = [options.uniqueId];
  }
  if (options.encryptedFileKey) {
    payload.encrypted_file_key = [options.encryptedFileKey];
  }
  const data = await executeApiRequestSilent<string>(
    () =>
      api.post<string>('/files/download-file', payload),
    'Failed to get file URL',
  );
  if (!data) {
    throw new Error('File URL not found in response');
  }
  return data;
}

export async function deleteMasterDataFiles(fileIds: Array<string | number>): Promise<void> {
  await executeApiRequestSilent(
    () =>
      api.post('/files/delete-file', {
        unique_id: fileIds.map(String),
      }),
    'Failed to delete file',
  );
}

export async function getMasterDataFileById<T>(fileId: string | number): Promise<T> {
  return executeApiRequestSilent(
    () => api.get<T>(`/files/${fileId}`),
    'Failed to load file details',
  );
}
