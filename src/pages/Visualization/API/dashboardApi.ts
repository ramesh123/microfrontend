import api from '@/controllers/API/api';
import { toast } from 'sonner';
import { executeApiRequestSilent, getDisplayErrorMessage } from '@/utils/exceptionHelper';
import { buildListSourceTypeQuery } from './listSourceTypeQuery';



// Lightweight in-memory map to prevent duplicate concurrent requests for the same action.
const pendingRequests: Map<string, Promise<any>> = new Map();

export async function getDashboards(params?: {
  skip?: number
  limit?: number
  fields?: string[]
  q?: string
  flow_id?: string
  analyticsStudio?: boolean
}) {
  const skip = params?.skip ?? 0
  const limit = params?.limit ?? 100
  const fields = params?.fields || []
  const flow_id = params?.flow_id
  const q = buildListSourceTypeQuery(params?.q, params?.analyticsStudio)

  const queryParams = new URLSearchParams()
  queryParams.append('skip', String(skip))
  queryParams.append('limit', String(limit))
  if (fields.length > 0) {
    queryParams.append('fields', JSON.stringify(fields))
  }
  if (q.trim().length > 0) {
    queryParams.append('q', q)
  }
  if (flow_id) {
    queryParams.append('flow_id', flow_id)
  }

  const key = `getDashboards:${queryParams.toString()}`
  if (pendingRequests.has(key)) return pendingRequests.get(key)

  const promise = (async () => {
    try {
      return await executeApiRequestSilent(
        () => api.get(`/dashboards?${queryParams.toString()}`),
        'Failed to fetch dashboards',
      );
    } catch (error) {
      console.error("Failed to fetch dashboards:", error);
      toast.error(getDisplayErrorMessage(error, 'Failed to fetch dashboards.'));
      throw error;
    } finally {
      pendingRequests.delete(key)
    }
  })()

  pendingRequests.set(key, promise)
  return promise
}

export async function getDashboardById(id: string) {
  const key = `getDashboardById:${id}`
  if (pendingRequests.has(key)) return pendingRequests.get(key)

  const promise = (async () => {
    try {
      return await executeApiRequestSilent(
        () => api.get(`/dashboards/${id}`),
        `Failed to fetch dashboard with ID ${id}`,
      );
    } catch (error) {
      console.error(`Failed to fetch dashboard with ID ${id}:`, error);
      toast.error(getDisplayErrorMessage(error, `Failed to fetch dashboard with ID ${id}.`));
      throw error;
    } finally {
      pendingRequests.delete(key)
    }
  })()

  pendingRequests.set(key, promise)
  return promise
}

export interface CreateDashboardPayload {
  flow_id?: string;
  source_type?: string;
  workflow_type?: string;
  execution_id?: string;
  dashboard_title: string;
  charts: Array<{
    chart_id: number;
    chart_name: string;
  }>;
  widgets?: Array<{
    id: string;
    type: string;
    chart_id: number;
    title: string;
  }>;
  layout: Array<{
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
    static: boolean;
  }>;
  dashboard_filter?: Array<{
    column: string;
    op: string;
    val: string;
    cond: string;
  }>;
  tags?: Array<{
    name: string;
    value: string;
  }>;
  roles?: string[];
  created_by?: string;
  created_user?: string;
  changed_by?: string;
}

export interface CreateDashboardResponse {
  status: boolean;
  message: string;
  data?: any;
}

export async function createDashboard(payload: CreateDashboardPayload): Promise<CreateDashboardResponse> {
  try {
    const key = 'createDashboard'
    if (pendingRequests.has(key)) {
      console.warn('createDashboard already in progress — returning existing promise')
      return pendingRequests.get(key)
    }

    const promise = (async () => {
      try {
        return await executeApiRequestSilent(
          () => api.post('/dashboards/save-dashboards', payload),
          'Failed to create dashboard',
        );
      } catch (error) {
        console.error('Failed to create dashboard:', error);
        toast.error(getDisplayErrorMessage(error, 'Failed to create dashboard.'));
        throw error;
      } finally {
        pendingRequests.delete(key);
      }
    })();

    pendingRequests.set(key, promise);
    return promise;
  } catch (error) {
    console.error('Failed to create dashboard:', error);
    toast.error(getDisplayErrorMessage(error, 'Failed to create dashboard.'));
    throw error;
  }
}

export async function deleteDashboard(id: string | number) {
  try {
    return await executeApiRequestSilent(
      () => api.delete(`/dashboards/${id}`, { data: { id } }),
      'Failed to delete dashboard',
    );
  } catch (error) {
    console.error(`Failed to delete dashboard with ID ${id}:`, error);
    toast.error(getDisplayErrorMessage(error, 'Failed to delete dashboard.'));
    throw error;
  }
}

export async function updateDashboard(id: string | number, payload: CreateDashboardPayload): Promise<CreateDashboardResponse> {
  try {
    const key = `updateDashboard:${id}`
    if (pendingRequests.has(key)) {
      console.warn('updateDashboard already in progress for', id, '— returning existing promise')
      return pendingRequests.get(key)
    }

    const promise = (async () => {
      try {
        return await executeApiRequestSilent(
          () => api.post('/dashboards/update-dashboard', payload),
          'Failed to update dashboard',
        );
      } catch (error) {
        console.error('Failed to update dashboard:', error);
        toast.error(getDisplayErrorMessage(error, 'Failed to update dashboard.'));
        throw error;
      } finally {
        pendingRequests.delete(key);
      }
    })();

    pendingRequests.set(key, promise);
    return promise;
  } catch (error) {
    console.error('Failed to update dashboard:', error);
    toast.error(getDisplayErrorMessage(error, 'Failed to update dashboard.'));
    throw error;
  }
}

