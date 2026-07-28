import type { RunAssistantAnswerData } from '@/controllers/API/runAssistantApi';

export type ChatMessageKind = 'user' | 'assistant' | 'activity';

export type ChatMessage = {
  id: string;
  kind: ChatMessageKind;
  title: string;
  body: string;
  timestamp: string;
  answer?: RunAssistantAnswerData;
  activity?: {
    step?: string;
    source?: string;
    observation?: string;
    next?: string;
  };
  isStreaming?: boolean;
};

export type RunExplainerStatus = 'ready' | 'connecting' | 'completed' | 'failed';

export type DrawerState = {
  confidence: string;
  answer: RunAssistantAnswerData | null;
  recordStatus: string;
};
