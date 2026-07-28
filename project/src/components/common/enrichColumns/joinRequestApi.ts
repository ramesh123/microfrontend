
import api from '@/controllers/API/api.tsx';

interface TableSchema {
    column: string;
    type: string;
}

interface TableContext {
    table_name: string;
    schema: TableSchema[];
    data: any[];
}

interface CompileJoinRequestPayload {
    conversation_id?: string;
    user_request: string;
    flow_id: string;
    source_context: TableContext;
    target_context: TableContext;
    execute?: boolean;
    user_name: string;
    max_rows?: number;
}

interface ResumeJoinRequestPayload {
    conversation_id: string;
    event_id: string;
    answers: {
        columns: {
            [key: string]: string[];
        };
    };
}

// Response types
interface SuccessResponse {
    status: 'ok';
    conversation_id: string;
    conversation_name?: string;
    event_id: string;
    source_key_columns: string[];
    target_key_columns: string[];
    source_extra_columns: string[] | null;
    source_filter: string[] | null;
    target_filter: string[] | null;
    warnings?: string[];
    execution_status?: string | null;
    execution_output?: any[] | null;
    execution_error?: string | null;
    message?: string;
}

interface ClarificationResponse {
    status: 'needs_clarification';
    conversation_name?: string;
    conversation_id: string;
    event_id: string;
    question: string;
    missing_columns?: string[];
    options: {
        [key: string]: string[];
    };
    conversation_state?: any;
}

type CompileJoinRequestResponse = SuccessResponse | ClarificationResponse;
type ResumeJoinRequestResponse = SuccessResponse | ClarificationResponse;

/**
 * Compile join request based on natural language query
 * Endpoint: POST /api/semantic-lookup/compile-join-request
 */
export async function compileJoinRequest(
    payload: CompileJoinRequestPayload
): Promise<CompileJoinRequestResponse> {
    console.log('Join Request Compile:', JSON.stringify(payload, null, 2));

    const response = await api.post<CompileJoinRequestResponse>(
        '/semantic-lookup/compile-join-request',
        payload
    );

    console.log('Join Request Compile Response:', response.data);

    return response.data;
}

/**
 * Resume join request after clarification
 * Endpoint: POST /api/semantic-lookup/resume-join-request
 */
export async function resumeJoinRequest(
    payload: ResumeJoinRequestPayload
): Promise<ResumeJoinRequestResponse> {
    console.log('Join Request Resume:', JSON.stringify(payload, null, 2));

    const response = await api.post<ResumeJoinRequestResponse>(
        '/semantic-lookup/resume-join-request',
        payload
    );

    console.log('Join Request Resume Response:', response.data);

    return response.data;
}

// Type guards
export function isSuccessResponse(response: CompileJoinRequestResponse | ResumeJoinRequestResponse): response is SuccessResponse {
    return response.status === 'ok';
}

export function isClarificationResponse(response: CompileJoinRequestResponse | ResumeJoinRequestResponse): response is ClarificationResponse {
    return response.status === 'needs_clarification';
}

// Export types for use in other files
export type {
    TableSchema,
    TableContext,
    CompileJoinRequestPayload,
    CompileJoinRequestResponse,
    SuccessResponse,
    ClarificationResponse,
    ResumeJoinRequestPayload,
    ResumeJoinRequestResponse
};
