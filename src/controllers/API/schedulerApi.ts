import api from './api';
import { executeApiRequestSilent } from '@/utils/exceptionHelper';

export interface SchedulerTemplate {
  template: Record<string, any>;
  payload: Record<string, string>;
}

export interface SchedulerData {
  id: number;
  created_at: string;
  updated_at: string;
  entity_id: string;
  name: string;
  workflow: any;
  scan_type: string;
  statement_date: string;
  scheduler: string;
  settings: Record<string, any>;
  notification_email: any;
  is_active: boolean;
}

export interface SchedulerListResponse {
  data: SchedulerData[];
  total: number;
  count: number;
}

export interface SchedulerListParams {
  q?: string;
  search_text?: string;
  skip?: number;
  limit?: number;
  sort?: string;
  fields?: string;
  view?: string;
}

export const getSchedulerTemplate = async (): Promise<SchedulerTemplate> => {
  return executeApiRequestSilent(
    () => api.post<SchedulerTemplate>('/scheduler/get-scheduler-template', {}),
    'Failed to load scheduler configuration',
  );
};

export const getSchedulers = async (
  params?: SchedulerListParams,
): Promise<SchedulerListResponse> => {
  return executeApiRequestSilent(
    () => api.get<SchedulerListResponse>('/scheduler', { params }),
    'Failed to load schedulers',
  );
};

export const getSchedulerById = async (id: string | number): Promise<SchedulerData> => {
  return executeApiRequestSilent(
    () => api.get<SchedulerData>(`/scheduler/${id}`),
    'Failed to load scheduler details',
  );
};

export const addScheduler = async (data: unknown): Promise<unknown> => {
  return executeApiRequestSilent(
    () => api.post('/scheduler/add-scheduler', data),
    'Failed to create scheduler',
  );
};

export const updateScheduler = async (updateId: string, data: Record<string, unknown>): Promise<unknown> => {
  return executeApiRequestSilent(
    () =>
      api.post('/scheduler/update-scheduler', {
        update_id: updateId,
        ...data,
      }),
    'Failed to update scheduler',
  );
};

export const deleteScheduler = async (deleteId: string): Promise<unknown> => {
  return executeApiRequestSilent(
    () =>
      api.post('/scheduler/delete-scheduler', {
        delete_id: deleteId,
      }),
    'Failed to delete scheduler',
  );
};
