import api from './api';
import { Dataset, DatasetApiResponse, NodeList, NodeDetails, DatasetListItem, PreviewData, ColumnDataResponse } from '@/types/dataset';
import { executeApiRequestSilent } from '@/utils/exceptionHelper';
import { resolveDatabaseActionsKlass } from '@/utils/sapNodeActions';

export const getNodesList = async (body: { group: string[] }): Promise<NodeList> => {
  const response = await executeApiRequestSilent<{ data: NodeList }>(
    () => api.post('/nodes/get-nodes-list', body),
    'Failed to fetch nodes list',
  );
  return response.data;
};

export const getNodeDetails = async (nodeId: string): Promise<NodeDetails> => {
  const response = await executeApiRequestSilent<{ data: NodeDetails }>(
    () => api.post('/nodes/get-node', { node_id: nodeId }),
    'Failed to fetch node details',
  );
  return response.data;
};

export const performDatabaseAction = async (
  module: string,
  klass: string,
  params: unknown,
): Promise<ColumnDataResponse> => {
  const resolvedKlass = resolveDatabaseActionsKlass(klass);
  return executeApiRequestSilent<ColumnDataResponse>(
    () => api.post(`/${module.toLowerCase()}/${resolvedKlass}`, params),
    'Database action failed',
  );
};

export const getDataPreview = async (
  module: string,
  klass: string,
  payload: unknown,
): Promise<PreviewData> => {
  const resolvedKlass = resolveDatabaseActionsKlass(klass);
  const response = await executeApiRequestSilent<ColumnDataResponse & PreviewData>(
    () => api.post(`/${module.toLowerCase()}/${resolvedKlass}`, { payload }),
    'Failed to load data preview',
  );

  let data: unknown[] = [];
  let columns: string[] = [];

  if (response) {
    if (Array.isArray(response)) {
      data = response;
      columns = data.length > 0 ? Object.keys(data[0] as object) : [];
    } else if (response.status && response.data && response.columns) {
      data = response.data || [];
      columns = response.columns || [];
    } else if (response.data && Array.isArray(response.data)) {
      data = response.data;
      columns = data.length > 0 ? Object.keys(data[0] as object) : [];
    }
  }

  return {
    data: data || [],
    columns: columns || [],
  };
};

export const getAllDatasets = async (params: {
  q?: string;
  skip?: number;
  limit?: number;
  search_text?: string;
  sort?: Record<string, 'asc' | 'desc'>;
} = {}): Promise<DatasetApiResponse> => {
  const queryParams = new URLSearchParams();
  if (params.q) queryParams.append('q', params.q);
  if (params.skip !== undefined) queryParams.append('skip', String(params.skip));
  if (params.limit !== undefined) queryParams.append('limit', String(params.limit));
  if (params.search_text) queryParams.append('search_text', params.search_text);
  if (params.sort) queryParams.append('sort', JSON.stringify(params.sort));

  const result = await executeApiRequestSilent(
    () => api.get<DatasetApiResponse>(`/dataset?${queryParams.toString()}`),
    'Failed to fetch datasets',
  );
  return result || { data: [], total: 0, count: 0 };
};

export const getDatasetById = async (id: number): Promise<Dataset> => {
  return executeApiRequestSilent(
    () => api.get<Dataset>(`/dataset/${id}`),
    'Failed to fetch dataset',
  );
};

export const getDatasetsForType = async (body: { dataset_type: string }): Promise<{ data: DatasetListItem[] }> => {
  const response = await executeApiRequestSilent<{ data: DatasetListItem[] }>(
    () => api.post('/dataset/get-dataset-list', body),
    'Failed to fetch dataset list',
  );
  return response || { data: [] };
};

export const createDataset = async (data: unknown): Promise<string> => {
  return executeApiRequestSilent(
    () => api.post<string>('/dataset/create-dataset', data),
    'Failed to create dataset',
  );
};

export const updateDataset = async (id: number, data: unknown): Promise<string> => {
  return executeApiRequestSilent(
    () => api.post<string>('/dataset/update-dataset', {
      update_id: String(id),
      ...(data as object),
    }),
    'Failed to update dataset',
  );
};

export const deleteDataset = async (datasetId: number): Promise<string> => {
  return executeApiRequestSilent(
    () => api.post<string>('/dataset/delete-dataset', { dataset_id: String(datasetId) }),
    'Failed to delete dataset',
  );
};

export interface FileUploadResponse {
  encrypted_file_key?: string;
  file_name?: string;
  unique_id?: string;
  size?: number | string;
  [key: string]: unknown;
}

export const uploadFile = async (
  module: string,
  klass: string,
  formData: FormData,
): Promise<FileUploadResponse> => {
  const result = await executeApiRequestSilent<FileUploadResponse | { data?: FileUploadResponse }>(
    () => api.post(`/${module}/${klass}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
    'Failed to upload file',
  );
  const payload = (result as { data?: FileUploadResponse })?.data ?? result;
  return payload ?? {};
};
