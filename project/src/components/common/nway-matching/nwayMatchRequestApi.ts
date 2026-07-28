
import api from '@/controllers/API/api.tsx';

// Flexible interfaces that allow for extension
interface CompileNwayMatchRequestPayload {
    conversation_id?: string;
    user_request: string;
    flow_id: string;
    execute?: boolean;
    user_name: string;
    max_rows?: number;
    sources: any[];
    [key: string]: any; // Allow additional properties
}

interface ResumeNwayMatchRequestPayload {
    conversation_id: string;
    event_id: string;
    answers: any;
    [key: string]: any; // Allow additional properties
}

// Response interfaces with flexible structure
interface SuccessResponse {
    status: 'ok';
    conversation_id: string;
    conversation_name?: string;
    event_id: string;
    rules?: any[];
    transformed_config?: any[];
    warnings?: string[];
    message?: string;
    [key: string]: any; // Allow additional properties
}

interface ClarificationResponse {
    status: 'needs_clarification';
    conversation_name?: string;
    conversation_id: string;
    event_id: string;
    question: string;
    options?: any;
    conversation_state?: any;
    [key: string]: any; // Allow additional properties
}

type CompileNwayMatchResponse = SuccessResponse | ClarificationResponse;
type ResumeNwayMatchResponse = SuccessResponse | ClarificationResponse;

/**
 * Compile N-way match request based on natural language query
 * Endpoint: POST /api/semantic-nway-match/compile-nway-request
 */
export async function compileNwayMatchRequest(
    payload: CompileNwayMatchRequestPayload
): Promise<CompileNwayMatchResponse> {
    console.log('N-way Match Compile Request:', JSON.stringify(payload, null, 2));

    const response = await api.post<CompileNwayMatchResponse>(
        '/semantic-nway-match/compile-nway-request',
        payload
    );

    console.log('N-way Match Compile Response:', response.data);

    return response.data;
}

/**
 * Resume N-way match request after clarification
 * Endpoint: POST /api/semantic-nway-match/resume-nway-request
 */
export async function resumeNwayMatchRequest(
    payload: ResumeNwayMatchRequestPayload
): Promise<ResumeNwayMatchResponse> {
    console.log('N-way Match Resume Request:', JSON.stringify(payload, null, 2));

    const response = await api.post<ResumeNwayMatchResponse>(
        '/semantic-nway-match/resume-nway-request',
        payload
    );

    console.log('N-way Match Resume Response:', response.data);

    return response.data;
}

// Type guards
export function isSuccessResponse(response: CompileNwayMatchResponse | ResumeNwayMatchResponse): response is SuccessResponse {
    return response.status === 'ok';
}

export function isClarificationResponse(response: CompileNwayMatchResponse | ResumeNwayMatchResponse): response is ClarificationResponse {
    return response.status === 'needs_clarification';
}

// Export types for use in other files
export type {
    CompileNwayMatchRequestPayload,
    CompileNwayMatchResponse,
    SuccessResponse,
    ClarificationResponse,
    ResumeNwayMatchRequestPayload,
    ResumeNwayMatchResponse
};
