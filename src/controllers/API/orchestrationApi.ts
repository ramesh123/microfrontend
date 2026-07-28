import api from "./api";
import { HierarchyItem, Organization, Perspective } from "@/types/orchestration";
import { toast } from "sonner";
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import { useRbacStore } from "@/stores/useRBACStore";


export async function getAllPerspectivesApi() {
  try {
    const res = await api.get(`/perspectives?skip=0&limit=100`);
    if (res.status === 200) {
      return res.data;
    }
  } catch (error) {
    throw error;
  }
}

export async function getAllOrganizationsApi(org_ids?: string[], userRole?: string) {
  try {
    const params: any = {
      skip: 0,
      limit: 100,
      q: ''
    }

    // Skip query filter if user is Admin
    if (userRole !== 'Admin' && org_ids && Array.isArray(org_ids) && org_ids.length > 0) {
      const orgIdsFormatted = org_ids.map(id => `'${id}'`).join(',');
      params.q = `org_id in (${orgIdsFormatted})`;
    }

    const res = await api.get(`/organization-setup`, { params });
    if (res.status === 200) {
      return res.data;
    }
  } catch (error) {
    throw error;
  }
}

export const createOrganizationFlowApi = async (organization: HierarchyItem) => {
  try {
    const res = await api.post(`/organization-setup/create-org-setup`, organization);
    if (res.status === 200 || res.status === 201) {
      return res.data;
    }
    throw new Error(res.data.message || 'Failed to create organization.');
  } catch (error) {
    console.error("Failed to create organization:", error);
    toast.error("Failed to create organization.");
    throw error;
  }
};

export const deleteOrganizationApi = async (id: string) => {
  try {
    const res = await api.post(`/organization-setup/delete-org-setup`, { update_id: id.toString() });
    if (res.status === 200 || res.status === 201) {
      toast.success(res.data.message);
      return res.data;
    }
    throw new Error(res.data.message || 'Failed to delete organization.');
  } catch (error) {
    console.error("Failed to delete organization:", error);
    toast.error(getDisplayErrorMessage(error, 'Failed to delete organization.'));
    throw error;
  }
};

export const createPerspectiveApi = async (perspective: Perspective) => {
  try {
    const res = await api.post(`/perspectives/create-perspectives`, perspective);
    if (res.status === 200 || res.status === 201) {
      return res.data;
    }
    throw new Error(res.data.message || 'Failed to create perspective.');
  } catch (error) {
    console.error("Failed to create perspective:", error);
    throw error;
  }
};

export const updatePerspectiveApi = async (perspective: Perspective) => {
  try {
    const res = await api.post(`/perspectives/update-perspectives`, perspective);
    if (res.status === 200 || res.status === 201) {
      return res.data;
    }
    throw new Error(res.data.message || 'Failed to update perspective.');
  } catch (error) {
    console.error("Failed to update perspective:", error);
    throw error;
  }
};

export const deletePerspectiveApi = async (id: string) => {
  try {
    const res = await api.post(`/perspectives/delete-perspectives`, { unique_id: id });
    if (res.status === 200 || res.status === 201) {
      toast.success(res.data.message);
      return res.data;
    }
    throw new Error(res.data.message || 'Failed to delete perspective.');
  } catch (error) {
    console.error("Failed to delete perspective:", error);
    toast.error(getDisplayErrorMessage(error, 'Failed to delete perspective.'));
    throw error;
  }
};

export const getProductGroupApi = async () => {
  try {
    const res = await api.get(`/product-group`);
    if (res.status === 200) {
      return res.data;
    }
    throw new Error(res.data.message || 'Failed to get product group.');
  } catch (error) {
    console.error("Failed to get product group:", error);
    toast.error(getDisplayErrorMessage(error, 'Failed to get product group.'));
    throw error;
  }
};

// Pipeline Generator API Types
export interface UploadedFile {
  file_name: string;
  unique_id: string;
  encrypted_file_key: string;
}

export interface CompileUserRequestPayload {
  user_request: string;
  flow_id: string;
  conversation_id: string | null;
  uploaded_files?: UploadedFile[];
}

export interface ConversationState {
  conversation_id: string;
  user_request: string;
  intent_ir?: any;
  missing?: string[];
}

export interface NodeReference {
  id: string;
  node_id: string;
  name: string;
}

export interface ClarificationNode {
  id: string;
  node_id: string;
  name: string;
  config: any;
  config_source: string;
  missing_fields: string[];
  field_options: { [key: string]: any };
}

export interface Clarification {
  question: string;
  options: { [key: string]: any };
  node_ref: NodeReference;
  missing_fields: string[];
}

export interface ResumeUserRequestPayload {
  flow_id: string;
  conversation_id: string;
  event_id: string;
  answers: {
    [key: string]: string | any; // For level-1 clarification
  } | {
    node_ref: NodeReference; // For level-2 clarification
    config: { [key: string]: any };
  };
  conversation_state?: {
    conversation_id: string;
    user_request: string;
  };
  uploaded_files?: UploadedFile[];
}

export interface AIFlowNode {
  id: string;
  node_id: string;
  label: string;
  group: string;
  config: any;
}

export interface AIFlowEdge {
  from: string;
  to: string;
}

export interface WorkflowData {
  nodes: any[];
  edges: any[];
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
}

export interface CompileUserRequestResponse {
  status: 'ok' | 'needs_clarification' | 'error';
  conversation_id?: string;
  event_id?: string;
  data?: any; // Complete workflow data from backend
  pipeline?: { // New: Pipeline structure with nodes and edges
    nodes: AIFlowNode[];
    edges: AIFlowEdge[];
  };
  node_configs?: ClarificationNode[]; // New: Node configurations for level-2 clarification
  nodes?: ClarificationNode[]; // Legacy: For level-2 clarification or backward compatibility
  edges?: AIFlowEdge[]; // Legacy: For level-2 clarification or backward compatibility
  clarification?: Clarification | null; // For level-2 clarification
  message?: string;
  question?: string;
  questions?: string; // Alternative field name
  options?: { [key: string]: string[] }; // For level-1 clarification
  conversation_state?: ConversationState;
  conversation_name?: string; // New: Conversation name from backend
  validation?: { // New: Validation errors and warnings
    errors: any[];
    warnings: any[];
  };
}

// Pipeline Generator APIs
export const compileUserRequestApi = async (payload: CompileUserRequestPayload) => {
  try {
    // Get current user's email from RBAC store
    const currentUser = useRbacStore.getState().currentUser;

    const res = await api.post(`/pipeline-generator/compile-unified-request`, {
      payload: {
        ...payload,
        user_name: currentUser?.email || ''
      }
    });
    if (res.status === 200 || res.status === 201) {
      return res.data;
    }
    throw new Error(res.data.message || 'Failed to compile user request.');
  } catch (error) {
    console.error("Failed to compile user request:", error);
    throw error;
  }
};

export const resumeUserRequestApi = async (payload: ResumeUserRequestPayload) => {
  try {

    const res = await api.post(`/pipeline-generator/resume-unified-request`, {
      payload: payload
    });
    if (res.status === 200 || res.status === 201) {
      return res.data;
    }
    throw new Error(res.data.message || 'Failed to resume user request.');
  } catch (error) {
    console.error("Failed to resume user request:", error);
    throw error;
  }
};

// Chat History APIs
export const getAllConversationsApi = async (payload: {
  flow_id: string;
  mode: 'PIPELINE' | 'PREDICATE' | 'JOIN' | 'NWAY_MATCH' | 'RUN_ASSISTANT';
  user_name: string;
}) => {
  try {
    const res = await api.post(`/chat-history/all-conversations`, payload);
    if (res.status === 200 || res.status === 201) {
      return res.data;
    }
    throw new Error(res.data.message || 'Failed to fetch conversations.');
  } catch (error) {
    console.error("Failed to fetch conversations:", error);
    throw error;
  }
};

export const getLatestChatHistoryApi = async (payload: {
  flow_id: string;
  mode: 'PIPELINE' | 'PREDICATE' | 'JOIN' | 'NWAY_MATCH' | 'RUN_ASSISTANT';
  user_name: string;
  conversation_id: string;
  limit?: number;
}) => {
  try {
    const res = await api.post(`/chat-history/latest-chat-history`, payload);
    if (res.status === 200 || res.status === 201) {
      return res.data;
    }
    throw new Error(res.data.message || 'Failed to fetch chat history.');
  } catch (error) {
    console.error("Failed to fetch chat history:", error);
    throw error;
  }
};

export const deleteChatHistoryApi = async (payload: {
  conversation_id: string;
}) => {
  try {
    const res = await api.post(`/chat-history/delete-chat`, payload);
    if (res.status === 200 || res.status === 201) {
      return res.data;
    }
    throw new Error(res.data.message || 'Failed to delete chat.');
  } catch (error) {
    console.error("Failed to delete chat:", error);
    throw error;
  }
};

export const renameChatHistoryApi = async (payload: {
  conversation_id: string;
  new_chat_name: string;
}) => {
  try {
    const res = await api.post(`/chat-history/rename-chat`, payload);
    if (res.status === 200 || res.status === 201) {
      return res.data;
    }
    throw new Error(res.data.message || 'Failed to rename chat.');
  } catch (error) {
    console.error("Failed to rename chat:", error);
    throw error;
  }
};


export async function getOrganizationsApi() {
  try {
    const res = await api.get('/organization?skip=0&limit=100');

    if (res.status === 200) {
      return res.data;
    }

    throw new Error('Failed to fetch organizations');
  } catch (error) {
    throw error;
  }
}