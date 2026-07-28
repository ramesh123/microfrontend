import { apiV2Delete, apiV2Get } from './apiV2Request';

export interface ExploratoryJobListParams {
  job_type?: string;
  limit?: number;
  offset?: number;
  status?: string;
}

export interface ExploratoryJobsListResponse {
  jobs?: unknown[];
  total?: number;
  [key: string]: unknown;
}

export async function fetchExploratoryJobs(params: ExploratoryJobListParams) {
  return apiV2Get<ExploratoryJobsListResponse>(
    '/jobs',
    { params },
    'Failed to fetch jobs',
  );
}

export async function fetchExploratoryJobDetail<T = unknown>(jobId: string) {
  return apiV2Get<T>(`/jobs/${jobId}`, undefined, 'Failed to fetch job details');
}

export async function deleteExploratoryJob(
  jobId: string,
  tenantId: string,
): Promise<void> {
  await apiV2Delete(
    `/jobs/${encodeURIComponent(jobId)}`,
    {
      params: { tenant_id: tenantId },
      data: { job_id: jobId, tenant_id: tenantId },
    },
    'Failed to delete job',
  );
}
