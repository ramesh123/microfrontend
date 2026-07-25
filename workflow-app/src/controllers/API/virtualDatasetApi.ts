import api from './api';
import { executeApiRequestSilent } from '@/utils/exceptionHelper';

export async function getVirtualDatasetsList() {
  return executeApiRequestSilent(
    () => api.get('/virtual-dataset', {}),
    'Failed to fetch virtual datasets',
  );
}

export async function deleteVirtualDataset(datasetId: string) {
  return executeApiRequestSilent(
    () =>
      api.post('/virtual-dataset/delete-dataset', {
        dataset_id: datasetId,
        update_id: datasetId,
      }),
    'Failed to delete virtual dataset',
  );
}

export async function deleteVirtualSubDataset(datasetId: string, subDatasetId: string) {
  return executeApiRequestSilent(
    () =>
      api.post('/virtual-dataset/delete-sub-dataset', {
        dataset_id: datasetId,
        sub_dataset_id: subDatasetId,
      }),
    'Failed to delete sub dataset',
  );
}

export async function saveVirtualDataset(
  path: '/virtual-dataset/create-dataset' | '/virtual-dataset/update-dataset',
  payload: Record<string, unknown>,
) {
  return executeApiRequestSilent(
    () => api.post(path, payload),
    'Failed to save virtual dataset',
  );
}

export async function createVirtualDatasetWithFallback(payload: Record<string, unknown>) {
  try {
    return await saveVirtualDataset('/virtual-dataset/update-dataset', payload);
  } catch {
    return saveVirtualDataset('/virtual-dataset/create-dataset', payload);
  }
}
