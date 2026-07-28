import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  formatDirectAnswer,
  postRunAssistantAnswer,
  postRunAssistantFollowUp,
  type RunAssistantAnswerData,
  type RunAssistantPayload,
} from '@/controllers/API/runAssistantApi';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import { getLatestChatHistoryApi } from '@/controllers/API/orchestrationApi';
import type { ChatMessage, DrawerState, RunExplainerStatus } from './types';

interface ChatHistoryEvent {
  event_id: string;
  user_request?: string;
  timestamp: string;
  response?: Record<string, unknown>;
  [key: string]: unknown;
}

function nowStamp() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function answerToAssistantMessage(answer: RunAssistantAnswerData): ChatMessage {
  const directText = formatDirectAnswer(answer.direct_answer);

  return {
    id: newId(),
    kind: 'assistant',
    title: 'Run Explainer',
    body: directText || 'Answer ready.',
    timestamp: nowStamp(),
    answer,
  };
}

function deriveRecordStatus(answer: RunAssistantAnswerData): string {
  const sources = answer.evidence_by_source ?? [];
  if (sources.length > 0) {
    const total = sources.reduce((sum, s) => sum + (s.total_rows ?? 0), 0);
    return `${total.toLocaleString()} records · ${sources.length} source${sources.length === 1 ? '' : 's'}`;
  }
  if (answer.evidence_rows?.length) {
    return `${answer.evidence_rows.length} evidence row${answer.evidence_rows.length === 1 ? '' : 's'}`;
  }
  return 'No evidence rows';
}

export function useRunAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      kind: 'assistant',
      title: 'Run Explainer',
      body: 'Ask a question about this reconciliation run. I can explain exceptions, unmatched records, reconciliation outcomes, and supporting evidence.',
      timestamp: nowStamp(),
    },
  ]);
  const [status, setStatus] = useState<RunExplainerStatus>('ready');
  const [drawer, setDrawer] = useState<DrawerState>({
    confidence: 'Pending',
    answer: null,
    recordStatus: 'Waiting',
  });
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string>('');

  const runTokenRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const agentRunIdRef = useRef<string | null>(null);

  const updateDrawerFromAnswer = useCallback((answer: RunAssistantAnswerData | null) => {
    if (!answer) return;
    setDrawer({
      confidence: answer.confidence ?? 'Pending',
      answer,
      recordStatus: deriveRecordStatus(answer),
    });
  }, []);

  const resetConversation = useCallback(() => {
    runTokenRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    agentRunIdRef.current = null;
    setMessages([
      {
        id: 'welcome',
        kind: 'assistant',
        title: 'Run Explainer',
        body: 'Ask anything about this run. I can explain unmatched records, summarize what changed, and show the evidence I used.',
        timestamp: nowStamp(),
      },
    ]);
    setStatus('ready');
    setDrawer({ confidence: 'Pending', answer: null, recordStatus: 'Waiting' });
    setSending(false);
    setConversationId('');
  }, []);

  const ask = useCallback(
    async (payload: RunAssistantPayload) => {
      if (sending) return;

      const token = ++runTokenRef.current;
      abortRef.current?.abort();
      const abortController = new AbortController();
      abortRef.current = abortController;

      setSending(true);
      setStatus('connecting');
      setDrawer({ confidence: 'Pending', answer: null, recordStatus: 'Loading' });

      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          kind: 'user',
          title: 'You',
          body: payload.question,
          timestamp: nowStamp(),
        },
        {
          id: newId(),
          kind: 'assistant',
          title: 'Run Explainer',
          body: 'Analyzing your question and gathering evidence…',
          timestamp: nowStamp(),
          isStreaming: true,
        },
      ]);

      try {
        const isFollowUp = Boolean(agentRunIdRef.current);
        const response = isFollowUp
          ? await postRunAssistantFollowUp({
              agent_run_id: agentRunIdRef.current!,
              question: payload.question,
              conversation_id: conversationId,
              answer_options: payload.answer_options,
              run_context: payload.run_context,
            })
          : await postRunAssistantAnswer(payload);

        if (token !== runTokenRef.current) return;
        if (abortController.signal.aborted) return;

        if (!response.status || !response.data) {
          throw new Error(response.message || 'Assistant request failed');
        }

        const answer = response.data;

        if (answer.conversation_id) {
          setConversationId(answer.conversation_id);
        }
        if (answer.agent_run_id) {
          agentRunIdRef.current = answer.agent_run_id;
        }

        updateDrawerFromAnswer(answer);
        setMessages((prev) => {
          const withoutLoading = prev.filter((m) => !m.isStreaming);
          return [...withoutLoading, answerToAssistantMessage(answer)];
        });
        setStatus('completed');
      } catch (err: unknown) {
        if (token !== runTokenRef.current) return;
        if ((err as Error)?.name === 'AbortError') return;

        const msg = getDisplayErrorMessage(err, 'Failed to get assistant answer');
        toast.error(msg);
        setMessages((prev) => [
          ...prev.filter((m) => !m.isStreaming),
          {
            id: newId(),
            kind: 'assistant',
            title: 'Run Explainer',
            body: `Error: ${msg}`,
            timestamp: nowStamp(),
          },
        ]);
        setStatus('failed');
      } finally {
        if (token === runTokenRef.current) setSending(false);
      }
    },
    [sending, updateDrawerFromAnswer, conversationId],
  );

  const loadConversation = useCallback(async (convId: string, flowId: string, userEmail: string) => {
    runTokenRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    agentRunIdRef.current = null;

    setSending(true);
    setStatus('connecting');
    setDrawer({ confidence: 'Pending', answer: null, recordStatus: 'Loading' });

    try {
      const response = await getLatestChatHistoryApi({
        flow_id: flowId,
        mode: 'RUN_ASSISTANT',
        user_name: userEmail,
        conversation_id: convId,
        limit: 50,
      });

      const events = (response?.events || []) as ChatHistoryEvent[];
      const chatMessages: ChatMessage[] = [];
      let latestAnswer: RunAssistantAnswerData | null = null;
      let agentRunId: string | null = null;

      const chronologicalEvents = [...events].sort((a, b) => {
        const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return tA - tB;
      });

      chronologicalEvents.forEach((event) => {
        chatMessages.push({
          id: `${event.event_id}-user`,
          kind: 'user',
          title: 'You',
          body: event.user_request || '',
          timestamp: new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });

        const rawAns = (event.response || event) as Record<string, unknown>;
        if (rawAns && (rawAns.direct_answer || rawAns.evidence_by_source || rawAns.evidence_rows || rawAns.confidence || rawAns.chart || rawAns.charts || rawAns.facts_used || rawAns['match-suggestions'] || rawAns.match_suggestions)) {
          const ans = { ...rawAns } as unknown as RunAssistantAnswerData;
          const ansObj = ans as unknown as Record<string, unknown>;
          const jsonFields = [
            'chart',
            'charts',
            'evidence_by_source',
            'evidence_rows',
            'facts_used',
            'queries_executed',
            'direct_answer',
            'download_bundle',
            'match-suggestions',
            'match_suggestions',
          ];
          jsonFields.forEach((field) => {
            if (typeof ansObj[field] === 'string' && (ansObj[field] as string).trim() !== '') {
              try {
                ansObj[field] = JSON.parse(ansObj[field] as string);
              } catch {
                // Leave it as string if parsing fails
              }
            }
          });

          if (ans.charts && !ans.chart) {
            ans.chart = ans.charts;
          }

          chatMessages.push({
            id: `${event.event_id}-ai`,
            kind: 'assistant',
            title: 'Run Explainer',
            body: ans.direct_answer ? formatDirectAnswer(ans.direct_answer) : 'Answer ready.',
            timestamp: new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            answer: ans,
          });
          latestAnswer = ans;
          if (ans.agent_run_id) {
            agentRunId = ans.agent_run_id;
          }
        }
      });

      if (chatMessages.length === 0) {
        setMessages([
          {
            id: 'welcome',
            kind: 'assistant',
            title: 'Run Explainer',
            body: 'Ask a question about this reconciliation run. I can explain exceptions, unmatched records, reconciliation outcomes, and supporting evidence.',
            timestamp: nowStamp(),
          },
        ]);
        setDrawer({ confidence: 'Pending', answer: null, recordStatus: 'Waiting' });
      } else {
        setMessages(chatMessages);
        if (latestAnswer) {
          updateDrawerFromAnswer(latestAnswer);
        } else {
          setDrawer({ confidence: 'Pending', answer: null, recordStatus: 'Waiting' });
        }
      }

      setConversationId(convId);
      agentRunIdRef.current = agentRunId;
      setStatus('ready');
    } catch (err) {
      console.error('Failed to load chat history:', err);
      toast.error('Failed to load chat history');
      setStatus('failed');
    } finally {
      setSending(false);
    }
  }, [updateDrawerFromAnswer]);

  return {
    messages,
    status,
    drawer,
    sending,
    conversationId,
    ask,
    resetConversation,
    loadConversation,
  };
}
