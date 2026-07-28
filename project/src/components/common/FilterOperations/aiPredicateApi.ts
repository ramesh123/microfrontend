
import api from '@/controllers/API/api.tsx';
import { useRbacStore } from '@/stores/useRBACStore';

interface TableSchema {
  column: string;
  type: string;
  description: string;
}

interface TableContext {
  schema: TableSchema[];
  data: any[];
}

interface GenerateAiPredicatePayload {
  table_context: TableContext;
  user_request: string;
  conversation_id?: string | null;
  flow_id: string;
  debug?: boolean;
  execute?: boolean;
  max_rows?: number;
}

interface GenerateAiPredicateRequest {
  payload: GenerateAiPredicatePayload;
}

interface ConversationState {
  conversation_id: string;
  user_request: string;
}

interface ClarificationOptions {
  [key: string]: string[];
}

// Response types
interface SuccessResponse {
  status: 'ok';
  conversation_id?: string;
  code?: string;
  warnings?: string[];
  execution_status?: string;
  execution_output?: any[];
  execution_error?: string | null;
  message?: string;
  event_id?: string;
  [key: string]: any;
}

interface ClarificationResponse {
  status: 'needs_clarification';
  conversation_id?: string;
  event_id?: string;
  question?: string;
  missing_columns?: string[];
  options?: ClarificationOptions;
  type?: string;
  conversation_state?: ConversationState;
  issue_type?: string;
  columns?: string[];
  execution_error?: string;
  [key: string]: any;
}

type GenerateAiPredicateResponse = SuccessResponse | ClarificationResponse;

// Resume API types
interface ResumeAiPredicatePayload {
  conversation_id: string;
  event_id: string;
  answers: {
    columns: { [key: string]: string };
  };
  execute?: boolean;
  max_rows?: number;
}

/**
 * Generate AI predicate based on natural language query
 * Endpoint: POST /api/predicate-generator/compile-user-request
 */
export async function generateAiPredicate(
  payload: GenerateAiPredicatePayload
): Promise<GenerateAiPredicateResponse> {
  // Get current user's email from RBAC store
  const currentUser = useRbacStore.getState().currentUser;

  // Wrap payload in "payload" key and add user_name inside payload as required by backend
  const request = {
    payload: {
      ...payload,
      user_name: currentUser?.email || ''
    }
  };

  // Log the request payload for debugging
  console.log('AI Predicate Request:', JSON.stringify(request, null, 2));

  const response = await api.post<GenerateAiPredicateResponse>(
    '/predicate-generator/compile-user-request',
    request
  );

  // Log the response for debugging
  console.log('AI Predicate Response:', response.data);

  return response.data;
}

/**
 * Resume AI predicate generation after clarification
 * Endpoint: POST /api/predicate-generator/resume-user-request
 */
export async function resumeAiPredicate(
  payload: ResumeAiPredicatePayload
): Promise<GenerateAiPredicateResponse> {
  // Wrap payload in "payload" key as required by backend
  const request = { payload };

  console.log('AI Predicate Resume Request:', JSON.stringify(request, null, 2));

  const response = await api.post<GenerateAiPredicateResponse>(
    '/predicate-generator/resume-user-request',
    request
  );

  console.log('AI Predicate Resume Response:', response.data);

  return response.data;
}

// Type guards
export function isSuccessResponse(response: GenerateAiPredicateResponse): response is SuccessResponse {
  return response.status === 'ok';
}

export function isClarificationResponse(response: GenerateAiPredicateResponse): response is ClarificationResponse {
  return response.status === 'needs_clarification';
}

// Export types for use in other files
export type {
  TableSchema,
  TableContext,
  GenerateAiPredicatePayload,
  GenerateAiPredicateRequest,
  GenerateAiPredicateResponse,
  SuccessResponse,
  ClarificationResponse,
  ConversationState,
  ClarificationOptions,
  ResumeAiPredicatePayload
};
