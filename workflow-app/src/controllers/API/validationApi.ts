// ValidationApi.tsx
import { toast } from 'sonner';
import api from "./api";
import { executeApiRequestSilent, getDisplayErrorMessage } from '@/utils/exceptionHelper';


// --- Existing APIs provided by user --- tr

export async function getApplicationsApi(params: any) {
  try {
    return await executeApiRequestSilent(
      () => api.post("/validation-component/get-validation-objects", params),
      'Failed to get application objects',
    );
  } catch (error) {
    console.error("Failed to get application objects:", error);
    toast.error(getDisplayErrorMessage(error, 'Failed to get application objects.'));
    throw error;
  }
}


export async function getTableFieldsDetailsApi(params: any) {
  try {
    return await executeApiRequestSilent(
      () => api.post("/validation-component/get-table-fields-details", params),
      'Failed to get table fields details',
    );
  } catch (error) {
    console.error("Failed to get table fields details:", error);
    toast.error(getDisplayErrorMessage(error, 'Failed to get table fields details.'));
    throw error;
  }
}

export async function getAllValidations(params?: {
  q?: string;
  object?: string;
  skip?: number;
  limit?: number;
  sort?: Record<string, "asc" | "desc">;
}) {
  try {
    const query = new URLSearchParams();

    if (params?.q) query.append("q", params.q);
    if (params?.object) query.append("object", params.object);
    if (params?.skip !== undefined) query.append("skip", String(params.skip));
    if (params?.limit !== undefined) query.append("limit", String(params.limit));

    if (params?.sort) {
      query.append("sort", JSON.stringify(params.sort));
    }

    return await executeApiRequestSilent(
      () => api.get(`/validation-component?${query.toString()}`),
      'Failed to fetch validations',
    );
  } catch (error) {
    console.error("Failed to fetch validations:", error);
    toast.error(getDisplayErrorMessage(error, 'Failed to fetch validations.'));
    throw error;
  }
}


export async function getValidationById(id: string) {
  try {
    return await executeApiRequestSilent(
      () => api.get(`/validation-component/${id}`),
      `Failed to fetch validation with ID ${id}`,
    );
  } catch (error) {
    console.error(`Failed to fetch validation with ID ${id}:`, error);
    toast.error(getDisplayErrorMessage(error, `Failed to fetch validation with ID ${id}.`));
    throw error;
  }
}

export async function createValidation(payload: any) {
  try {
    const data = await executeApiRequestSilent(
      () => api.post("/validation-component/update-validation", payload),
      'Failed to create validation',
    );
    toast.success("Validation created successfully.");
    return data;
  } catch (error) {
    console.error("Failed to create validation:", error);
    toast.error(getDisplayErrorMessage(error, 'Failed to create validation.'));
    throw error;
  }
}

export async function updateValidation(id: string, payload: any) {
  try {
    const updatePayload = { ...payload, update_id: String(id) || id };
    const data = await executeApiRequestSilent(
      () => api.post("/validation-component/update-validation", updatePayload),
      'Failed to update validation',
    );
    toast.success("Validation updated successfully.");
    return data;
  } catch (error) {
    console.error("Failed to update validation:", error);
    toast.error(getDisplayErrorMessage(error, 'Failed to update validation.'));
    throw error;
  }
}

export async function deleteValidation(id: string) {
  try {
    return await executeApiRequestSilent(
      () => api.delete(`/validation-component/${id}`),
      'Failed to delete validation',
    );
  } catch (error) {
    console.error("Failed to delete validation:", error);
    toast.error(getDisplayErrorMessage(error, 'Failed to delete validation.'));
    throw error;
  }
}

export const createVcId = async (payload: {
  application_id: string;
  object_type: string;
  module: string;
  sub_module: string;
  tcode: string;
  object: string;
  database_connection: string;
  validation_description: string;
}) => {
  try {
    return await executeApiRequestSilent(
      () => api.post("/validation-component/create-vcid", payload),
      'Failed to create validation ID',
    );
  } catch (error) {
    console.error("Failed to create validation ID:", error);
    toast.error(getDisplayErrorMessage(error, 'Failed to create validation ID.'));
    throw error;
  }
};

export async function executeValidationComponent(payload: { validation_id: string; parameters: Record<string, any> }) {
  try {
    return await executeApiRequestSilent(
      () => api.post("/validation-component/execute-validation-component", payload),
      'Failed to execute validation component',
    );
  } catch (error) {
    console.error("Failed to execute validation component:", error);
    toast.error(getDisplayErrorMessage(error, 'Failed to execute validation component.'));
    throw error;
  }
}
