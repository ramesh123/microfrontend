import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ArrowLeft, Send, Loader2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AIimage from '@/assets/images/ai.png';
import {
  createWorkspaceConversation,
  fetchConversationMessages,
  postConversationMessageStream,
  workspaceChartResponseToChartJson,
  type WorkspaceMessageItem,
  type WorkspaceDomainItem,
} from '@/controllers/API/semanticsApi';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ChartDetail } from './chartTypes';
import { ChartDetailTabbedPreview } from './ChartDetailTabbedPreview';
import { dashboardChartSpecToChartDetail } from './chartFetchUtils';
import type { DashboardChartSpec } from '@/controllers/API/agenticApi';
import type { TenantInfo } from './index';
import { WorkspaceDashboardChartActions } from './WorkspaceDashboardChartActions';
import { useAuth } from '@/context/auth/authContext';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';

interface WorkspaceChatProps {
  tenant: TenantInfo;
  domain: WorkspaceDomainItem;
  conversationId: string | null;
  /** From `/agentic-run/create` state — prefill and auto-send first message once. */
  initialUserQuery?: string | null;
  onInitialUserQueryConsumed?: () => void;
  onBackToConversations: () => void;
  onConversationCreated: (conversationId: string) => void;
}

/** Chart artifact from stream event artifact name "response" */
export interface StreamChartArtifact {
  chart_type: string;
  /** Persisted chart id from the assistant — required to attach this chart to a dashboard. */
  chart_id?: string;
  chart_title?: string;
  dashboard_title?: string;
  data: Array<Record<string, unknown>>;
  chart_payload?: Record<string, unknown>;
  rows?: Record<string, unknown>[];
  sql?: string;
  metrics?: string[];
  dimensions?: string[];
  insight_text?: string;
  narrative_text?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  /** From artifact name "response" – show chart in conversation */
  chartArtifact?: StreamChartArtifact | null;
  /** From artifact name "summary" – payload.text */
  summaryText?: string | null;
  /** From artifact name "inference" – payload.text */
  inferenceText?: string | null;
}

/** Map streaming / API chart artifact to ChartDetail for Am5MiniChart + tabbed preview. */
export function streamArtifactToChartDetail(artifact: StreamChartArtifact, messageId: string): ChartDetail {
  const title = artifact.chart_title ?? artifact.dashboard_title ?? 'Chart';
  const spec: DashboardChartSpec = {
    chart_type: artifact.chart_type || 'line',
    title,
    chart_title: artifact.chart_title,
    metric_name: title,
    chart_data: artifact.data ?? [],
    chart_payload: artifact.chart_payload,
    sql: artifact.sql,
    insight_text: artifact.insight_text,
    narrative_text: artifact.narrative_text,
  };
  return {
    ...dashboardChartSpecToChartDetail(spec),
    chart_id: artifact.chart_id?.trim() || `workspace-msg-${messageId}`,
  };
}

/** Parse SSE stream: handle event/token/artifact; accumulate narration and collect chart/summary/inference */
async function readConversationStream(
  response: Response,
  onUpdate: (update: {
    narration: string;
    chartArtifact: StreamChartArtifact | null;
    summaryText: string | null;
    inferenceText: string | null;
  }) => void
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = '';
  let narration = '';
  let chartArtifact: StreamChartArtifact | null = null;
  let summaryText: string | null = null;
  let inferenceText: string | null = null;

  const flush = () => {
    onUpdate({ narration, chartArtifact, summaryText, inferenceText });
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (raw === '[DONE]' || raw === '') continue;
      try {
        const parsed = JSON.parse(raw) as {
          event?: string;
          text?: string;
          name?: string;
          payload?: Record<string, unknown> & { text?: string };
        };
        const event = parsed.event;
        if (event === 'token' && typeof parsed.text === 'string') {
          narration += parsed.text;
          flush();
        } else if (event === 'artifact' && parsed.name && parsed.payload) {
          const payload = parsed.payload;
          if (parsed.name === 'response') {
            const data = (payload.data as Array<Record<string, unknown>>) ?? payload.rows ?? [];
            const cid =
              typeof payload.chart_id === 'string' && payload.chart_id.trim()
                ? payload.chart_id.trim()
                : typeof (payload as { chart?: { chart_id?: string } }).chart?.chart_id === 'string'
                  ? String((payload as { chart?: { chart_id?: string } }).chart?.chart_id).trim()
                  : undefined;
            chartArtifact = {
              chart_type: (payload.chart_type as string) ?? 'line',
              chart_id: cid,
              chart_title: payload.chart_title as string | undefined,
              dashboard_title: payload.dashboard_title as string | undefined,
              data: Array.isArray(data) ? data : [],
              chart_payload: payload.chart_payload as Record<string, unknown> | undefined,
              rows: payload.rows as Record<string, unknown>[] | undefined,
              sql: payload.sql as string | undefined,
              metrics: payload.metrics as string[] | undefined,
              dimensions: payload.dimensions as string[] | undefined,
              insight_text:
                typeof payload.insight_text === 'string' ? payload.insight_text : undefined,
              narrative_text:
                typeof payload.narrative_text === 'string' ? payload.narrative_text : undefined,
            };
            flush();
          } else if (parsed.name === 'summary' && typeof payload.text === 'string') {
            summaryText = payload.text;
            flush();
          } else if (parsed.name === 'inference' && typeof payload.text === 'string') {
            inferenceText = payload.text;
            flush();
          }
        }
      } catch {
        // Skip unparseable or unexpected SSE lines
      }
    }
  }
  if (buffer.startsWith('data: ')) {
    try {
      const parsed = JSON.parse(buffer.slice(6).trim()) as { event?: string; text?: string };
      if (parsed.event === 'token' && typeof parsed.text === 'string') {
        narration += parsed.text;
        flush();
      }
    } catch {
      // ignore
    }
  }
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

/** chart_json / data_json may live on the message, under assistant_message, or as `response` (agent chart body). */
function resolveChartJson(m: WorkspaceMessageItem): unknown {
  if (m.chart_json != null) return m.chart_json;
  const nested = m.assistant_message;
  if (isRecord(nested) && nested.chart_json != null) return nested.chart_json;
  const r = (m as WorkspaceMessageItem & { response?: unknown }).response;
  if (isRecord(r)) {
    const synthesized = workspaceChartResponseToChartJson(r);
    if (synthesized) return synthesized;
  }
  return undefined;
}

function resolveDataJson(m: WorkspaceMessageItem): unknown {
  if (m.data_json != null) return m.data_json;
  const nested = m.assistant_message;
  if (isRecord(nested)) return nested.data_json;
  return undefined;
}

function resolveMessageSql(m: WorkspaceMessageItem): string | undefined {
  if (typeof m.sql_text === 'string' && m.sql_text.trim()) return m.sql_text.trim();
  const nested = m.assistant_message;
  if (isRecord(nested) && typeof nested.sql_text === 'string' && nested.sql_text.trim()) {
    return nested.sql_text.trim();
  }
  return undefined;
}

/**
 * Build the same StreamChartArtifact shape as streaming "response" artifacts so ChartDetailTabbedPreview can render
 * when reopening a conversation loaded from GET/POST messages (chart_json / data_json).
 * Renders via ChartDetailTabbedPreview + Am5MiniChart (same as dashboard AI).
 */
function streamChartArtifactFromApiMessage(m: WorkspaceMessageItem): StreamChartArtifact | null {
  const cj = resolveChartJson(m);
  if (isRecord(cj)) {
    const data =
      Array.isArray(cj.data)
        ? cj.data
        : Array.isArray(cj.rows)
          ? cj.rows
          : [];
    const cid =
      typeof cj.chart_id === 'string' && cj.chart_id.trim() ? cj.chart_id.trim() : undefined;
    return {
      chart_type: String(cj.chart_type ?? 'line'),
      chart_id: cid,
      chart_title: cj.chart_title != null ? String(cj.chart_title) : undefined,
      dashboard_title: cj.dashboard_title != null ? String(cj.dashboard_title) : undefined,
      data: data as Array<Record<string, unknown>>,
      chart_payload: isRecord(cj.chart_payload) ? cj.chart_payload : undefined,
      sql: typeof cj.sql === 'string' ? cj.sql : resolveMessageSql(m),
      metrics: Array.isArray(cj.metrics) ? (cj.metrics as string[]) : undefined,
      dimensions: Array.isArray(cj.dimensions) ? (cj.dimensions as string[]) : undefined,
      insight_text: typeof cj.insight_text === 'string' ? cj.insight_text : undefined,
      narrative_text: typeof cj.narrative_text === 'string' ? cj.narrative_text : undefined,
    };
  }

  const dj = resolveDataJson(m);
  if (isRecord(dj)) {
    const rows = Array.isArray(dj.rows) ? dj.rows : [];
    const cid =
      typeof dj.chart_id === 'string' && dj.chart_id.trim() ? dj.chart_id.trim() : undefined;
    return {
      chart_type: String(dj.chart_type ?? 'line'),
      chart_id: cid,
      chart_title: dj.chart_title != null ? String(dj.chart_title) : undefined,
      dashboard_title: dj.dashboard_title != null ? String(dj.dashboard_title) : undefined,
      data: rows as Array<Record<string, unknown>>,
      rows: rows as Record<string, unknown>[],
      sql: typeof dj.sql === 'string' ? dj.sql : resolveMessageSql(m),
      insight_text: typeof dj.insight_text === 'string' ? dj.insight_text : undefined,
      narrative_text: typeof dj.narrative_text === 'string' ? dj.narrative_text : undefined,
    };
  }

  return null;
}

function summaryTextFromMessage(m: WorkspaceMessageItem): string | null {
  const extra = m as { summary_text?: string };
  if (typeof extra.summary_text === 'string') return extra.summary_text;
  const sj = m.summary_json;
  if (isRecord(sj) && typeof sj.text === 'string') return sj.text;
  return null;
}

function inferenceTextFromMessage(m: WorkspaceMessageItem): string | null {
  const extra = m as { inference_text?: string };
  if (typeof extra.inference_text === 'string') return extra.inference_text;
  const ij = m.inference_json;
  if (isRecord(ij) && typeof ij.text === 'string') return ij.text;
  return null;
}

export function messagesFromApi(items: WorkspaceMessageItem[]): ChatMessage[] {
  return items.map((m, i) => {
    const roleRaw = String(m.sender ?? m.role ?? '').toLowerCase();
    const role = (roleRaw === 'user' ? 'user' : 'assistant') as 'user' | 'assistant';
    const content =
      typeof m.message_text === 'string'
        ? m.message_text
        : typeof m.content === 'string'
          ? m.content
          : m.message_text != null || m.content != null
            ? String(m.message_text ?? m.content)
            : '';
    const extra = (m as { chart_artifact?: StreamChartArtifact }) || {};
    const fromApi = streamChartArtifactFromApiMessage(m);
    return {
      id: m.message_id ?? `msg-${i}-${m.created_at ?? ''}`,
      role,
      content,
      chartArtifact: extra.chart_artifact ?? fromApi ?? null,
      summaryText: summaryTextFromMessage(m),
      inferenceText: inferenceTextFromMessage(m),
    };
  });
}

export default function WorkspaceChat({
  tenant,
  domain,
  conversationId,
  initialUserQuery = null,
  onInitialUserQueryConsumed,
  onBackToConversations,
  onConversationCreated,
}: WorkspaceChatProps) {
  const auth = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const skipLoadAfterCreateRef = useRef(false);
  const consumedInitialQueryRef = useRef(false);

  const lastAssistantWithChartIdx = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (
        m.role === 'assistant' &&
        m.chartArtifact &&
        m.chartArtifact.data &&
        m.chartArtifact.data.length > 0
      ) {
        return i;
      }
    }
    return -1;
  }, [messages]);

  const loadMessages = useCallback(async (convId: string) => {
    setLoading(true);
    try {
      const list = await fetchConversationMessages(convId);
      setMessages(messagesFromApi(list));
    } catch (error) {
      toast.error(getDisplayErrorMessage(error, 'Failed to load messages'));
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!conversationId) return;
    if (skipLoadAfterCreateRef.current) {
      skipLoadAfterCreateRef.current = false;
      return;
    }
    loadMessages(conversationId);
  }, [conversationId, loadMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSendFirstMessage = useCallback(
    async (queryOverride?: string) => {
      const userQuery = (queryOverride ?? inputValue).trim();
      if (!userQuery || sending) return;
      setSending(true);
      setInputValue('');
      try {
        const res = await createWorkspaceConversation(tenant.tenantId, domain.domain_id, {
          // user_query: userQuery,
        });
        const id = res.conversation_id;
        if (id) {
          setMessages([
            { id: 'user-0', role: 'user', content: userQuery },
            { id: 'assistant-0', role: 'assistant', content: '', isStreaming: true },
          ]);
          skipLoadAfterCreateRef.current = true;
          onConversationCreated(id);
          toast.success('Conversation started');
          setSending(false);
          const response = await postConversationMessageStream(id, { user_query: userQuery });
          if (!response.ok) throw new Error(response.statusText);
          await readConversationStream(response, (update) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === 'assistant-0'
                  ? {
                      ...m,
                      content: update.narration,
                      chartArtifact: update.chartArtifact ?? undefined,
                      summaryText: update.summaryText ?? undefined,
                      inferenceText: update.inferenceText ?? undefined,
                      isStreaming: false,
                    }
                  : m,
              ),
            );
          });
          setMessages((prev) =>
            prev.map((m) =>
              m.id === 'assistant-0' ? { ...m, isStreaming: false } : m,
            ),
          );
        }
      } catch (err: unknown) {
        toast.error(getDisplayErrorMessage(err, 'Failed to start conversation'));
        setSending(false);
      }
    },
    [sending, inputValue, tenant.tenantId, domain.domain_id, onConversationCreated],
  );

  useEffect(() => {
    if (conversationId) return;
    if (consumedInitialQueryRef.current) return;
    const q = initialUserQuery?.trim();
    if (!q) return;
    consumedInitialQueryRef.current = true;
    onInitialUserQueryConsumed?.();
    setInputValue(q);
    void handleSendFirstMessage(q);
  }, [conversationId, initialUserQuery, onInitialUserQueryConsumed, handleSendFirstMessage]);

  const handleSendMessage = async () => {
    const userQuery = inputValue.trim();
    if (!userQuery || sending || !conversationId) return;
    setInputValue('');
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userQuery,
    };
    const assistantId = `assistant-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: 'assistant', content: '', isStreaming: true },
    ]);
    setSending(true);
    try {
      const response = await postConversationMessageStream(conversationId, {
        user_query: userQuery,
        resume_context: true,
      });
      if (!response.ok) {
        const t = await response.text();
        throw new Error(t || response.statusText);
      }
      await readConversationStream(response, (update) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: update.narration,
                  chartArtifact: update.chartArtifact ?? undefined,
                  summaryText: update.summaryText ?? undefined,
                  inferenceText: update.inferenceText ?? undefined,
                  isStreaming: false,
                }
              : m,
          ),
        );
      });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, isStreaming: false } : m,
        ),
      );
    } catch (err: unknown) {
      const msg = getDisplayErrorMessage(err, 'Failed to send message');
      toast.error(msg);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `Error: ${msg}`, isStreaming: false }
            : m,
        ),
      );
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (conversationId) handleSendMessage();
      else handleSendFirstMessage();
    }
  };

  // New conversation: show header + single prominent chat input
  if (!conversationId) {
    return (
      <div className="flex flex-col h-full w-full bg-background">
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-background shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 shrink-0"
            onClick={onBackToConversations}
            title="Back to conversations"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="text-base font-semibold truncate">New chat</h1>
        </div>
        <div className="flex-1 flex flex-col justify-end p-4">
          <div className="max-w-2xl w-full mx-auto">
            <p className="text-sm text-muted-foreground mb-3">
              Start a conversation. Your first message is sent as <code className="text-xs bg-muted px-1 rounded">user_query</code>.
              When the assistant returns a chart with a <code className="text-xs bg-muted px-1 rounded">chart_id</code>, you can
              create a dashboard, update one, or add the chart to an existing dashboard below the reply.
            </p>
            <div className="flex gap-2 rounded-lg border border-input bg-card p-3 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your question or request..."
                rows={3}
                className={cn(
                  'flex-1 resize-none bg-transparent text-sm placeholder:text-muted-foreground',
                  'focus:outline-none min-h-[60px] max-h-[200px]',
                )}
                disabled={sending}
              />
              <Button
                size="sm"
                className="h-9 shrink-0 self-end"
                onClick={() => void handleSendFirstMessage()}
                disabled={sending || !inputValue.trim()}
              >
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Existing conversation: messages + sticky chat input
  return (
    <div className="flex min-h-0 flex-1 flex-col h-full w-full bg-background">
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-background shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 shrink-0"
          onClick={onBackToConversations}
          title="Back to conversations"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-base font-semibold truncate">{domain.display_name ?? domain.domain_id}</h1>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="max-w-5xl mx-auto px-4 py-3 space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={msg.id}
                className={cn(
                  'flex gap-2',
                  msg.role === 'user' && 'flex-row-reverse',
                  msg.role === 'assistant' &&
                    msg.chartArtifact &&
                    msg.chartArtifact.data?.length > 0 &&
                    'w-full',
                )}
              >
                <div
                  className={cn(
                    'flex-shrink-0 size-8 rounded-full flex items-center justify-center overflow-hidden',
                    msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted',
                  )}
                >
                  {msg.role === 'user' ? (
                    <User className="size-4" />
                  ) : (
                    <img src={AIimage} alt="AI" className="h-8 w-8 object-contain" aria-hidden />
                  )}
                </div>
                <div
                  className={cn(
                    'rounded-lg px-3 py-2 min-w-0',
                    msg.role === 'user'
                      ? 'max-w-[85%] bg-primary text-primary-foreground'
                      : 'bg-muted border border-border/50',
                    msg.role === 'assistant' &&
                      msg.chartArtifact &&
                      msg.chartArtifact.data?.length > 0 &&
                      'w-full max-w-full flex-1',
                    msg.role === 'assistant' &&
                      !(msg.chartArtifact && msg.chartArtifact.data?.length > 0) &&
                      'max-w-[85%]',
                  )}
                >
                  {msg.role === 'assistant' && (
                    <div className="space-y-3">
                      {msg.content ? (
                        <div className="text-sm whitespace-pre-wrap break-words">{msg.content}</div>
                      ) : msg.isStreaming ? (
                        <div className="flex gap-1 py-1">
                          <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      ) : (!(msg.chartArtifact && msg.chartArtifact.data?.length > 0) && !msg.summaryText && !msg.inferenceText) ? (
                        <div className="text-sm text-muted-foreground italic">No data available for this query</div>
                      ) : null}
                      {msg.chartArtifact && msg.chartArtifact.data?.length > 0 && (
                        <div className="mt-2 w-full min-w-0 space-y-3">
                          <ChartDetailTabbedPreview
                            variant="compact"
                            detail={streamArtifactToChartDetail(msg.chartArtifact, msg.id)}
                          />
                          <WorkspaceDashboardChartActions
                            tenantId={tenant.tenantId}
                            domainId={domain.domain_id}
                            chart={streamArtifactToChartDetail(msg.chartArtifact, msg.id)}
                            compact
                            currentUserName={
                              auth.state?.authInfo?.user?.username ??
                              auth.state?.authInfo?.user?.email ??
                              undefined
                            }
                          />
                        </div>
                      )}
                      {msg.summaryText && (
                        <div className="text-xs">
                          <p className="font-medium text-muted-foreground mb-0.5">Summary</p>
                          <p className="text-muted-foreground whitespace-pre-wrap">{msg.summaryText}</p>
                        </div>
                      )}
                      {msg.inferenceText && (
                        <div className="text-xs">
                          <p className="font-medium text-muted-foreground mb-0.5">Inference</p>
                          <p className="text-muted-foreground whitespace-pre-wrap">{msg.inferenceText}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {msg.role === 'user' && (
                    <>
                      {msg.content ? (
                        <div className="text-sm whitespace-pre-wrap break-words">{msg.content}</div>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky composer: stays at bottom when the page or an ancestor scrolls */}
      <div className="sticky bottom-0 z-20 shrink-0 border-t bg-background/95 shadow-[0_-4px_24px_-8px_rgba(0,0,0,0.12)] backdrop-blur-sm supports-[backdrop-filter]:bg-background/80">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-end gap-2 rounded-lg border border-input bg-card px-3 py-2 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Send a message..."
              rows={1}
              className={cn(
                'flex-1 resize-none bg-transparent text-sm placeholder:text-muted-foreground',
                'focus:outline-none min-h-[24px] max-h-[120px] py-1.5',
              )}
              disabled={sending}
            />
            <Button
              size="sm"
              className="h-8 w-8 p-0 shrink-0"
              onClick={handleSendMessage}
              disabled={sending || !inputValue.trim()}
            >
              {sending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
