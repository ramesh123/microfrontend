import { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Search,
  ChevronRight,
  Loader2,
  Bot,
  Square,
  History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { sendChat, type ChatSyncResponse } from '@/controllers/API/agenticApi';
import { toast } from 'sonner';
import type { TenantInfo } from './index';
import AgenticChatHistory from './AgenticChatHistory';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';

// --- Types ---

type MessageRole = 'user' | 'assistant';

interface SuggestedAction {
  id: string;
  label: string;
}

interface ReasoningStep {
  id: string;
  label: string;
  detail?: string;
  status: 'complete' | 'running';
}

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  reasoning?: ReasoningStep[];
  showReasoning?: boolean;
  isStreaming?: boolean;
  timestamp: number;
}

// --- Suggestions ---

const SUGGESTED_ACTIONS: SuggestedAction[] = [
  { id: 'top-plants', label: 'Top 5 Plants by Production' },
  { id: 'monthly-sales', label: 'Monthly Sales Summary' },
  { id: 'rejection-analysis', label: 'Rejection Analysis by Zone' },
  { id: 'distributor-perf', label: 'Distributor Performance' },
];

// --- Format response rows into markdown table ---

function formatResponseContent(response: ChatSyncResponse['response']): string {
  const rows = response.rows ?? response.data ?? [];

  if (!rows || rows.length === 0) {
    return 'No data found for this query.';
  }

  let result = '';

  // Build markdown table from rows
  const headers = Object.keys(rows[0]);
  result += `| ${headers.join(' | ')} |\n`;
  result += `| ${headers.map(() => '---').join(' | ')} |\n`;
  rows.slice(0, 20).forEach((row: Record<string, unknown>) => {
    result += `| ${headers.map((h) => String(row[h] ?? '')).join(' | ')} |\n`;
  });

  if (rows.length > 20) {
    result += `\n*Showing 20 of ${rows.length} rows*`;
  }

  return result;
}

// --- Main Component ---

interface ChatWindowProps {
  tenant: TenantInfo;
  runId: string;
  onBackToSchema: () => void;
}

export default function ChatWindow({ tenant, runId, onBackToSchema: _onBackToSchema }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async (text?: string) => {
    const question = text ?? inputValue.trim();
    if (!question || isGenerating) return;

    setInputValue('');
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsGenerating(true);

    const assistantId = `assistant-${Date.now()}`;

    // Show loading placeholder with reasoning in progress
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: 'assistant',
        content: '',
        reasoning: [
          { id: 'r1', label: 'Searching semantic model', status: 'running' },
        ],
        showReasoning: true,
        isStreaming: true,
        timestamp: Date.now(),
      },
    ]);

    try {
      const response = await sendChat({
        question,
        tenant_id: tenant.tenantId,
        domain_id: tenant.domainId,
        mode: 'sync',
      });

      // Build reasoning steps from response
      const reasoning: ReasoningStep[] = [
        { id: 'r1', label: 'Searched semantic model', status: 'complete' },
      ];

      if (response.status === 'complete') {
        const syncResponse = response as ChatSyncResponse;

        if (syncResponse.response.sql) {
          reasoning.push({ id: 'r2', label: 'Generated SQL query', status: 'complete' });
        }

        const rowCount = syncResponse.response.rows?.length ?? syncResponse.response.data?.length ?? 0;
        if (rowCount > 0) {
          reasoning.push({
            id: 'r3',
            label: 'Executed query',
            detail: `${rowCount} rows returned`,
            status: 'complete',
          });
        }

        const content = formatResponseContent(syncResponse.response);

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content, reasoning, showReasoning: false, isStreaming: false }
              : m,
          ),
        );
      } else {
        // Async/queued response — inform user
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: 'Your query has been queued and is being processed. Results will appear shortly.',
                  reasoning: [{ id: 'r1', label: 'Query queued', status: 'complete' }],
                  showReasoning: false,
                  isStreaming: false,
                }
              : m,
          ),
        );
      }
    } catch (error: unknown) {
      toast.error(
        getDisplayErrorMessage(error, 'Failed to get response'),
      );

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: 'Sorry, I encountered an error processing your question. Please try again.',
                reasoning: [{ id: 'r1', label: 'Error occurred', status: 'complete' }],
                showReasoning: false,
                isStreaming: false,
              }
            : m,
        ),
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleReasoning = (id: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, showReasoning: !m.showReasoning } : m,
      ),
    );
  };

  return (
    <div className="flex flex-col h-full w-full bg-background">
      {/* Header with History Menu Item */}
      <div className="flex justify-between items-center px-4 py-2 border-b border-border/30 bg-card">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <span className="text-sm font-semibold">Semantic Chat</span>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 h-8 text-xs">
              <History className="size-3.5" />
              Chat History
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[400px] sm:w-[540px] flex flex-col p-0">
            <SheetHeader className="px-6 py-4 border-b">
              <SheetTitle className="text-base">Run Chat History</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-hidden">
              <AgenticChatHistory
                runId={runId}
                tenantId={tenant.tenantId}
                domainId={tenant.domainId}
                tenantName={tenant.displayName}
                domainName={tenant.domainId}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full max-w-xl mx-auto px-4">
            <div className="size-10 rounded-md bg-primary/10 flex items-center justify-center mb-3">
              <Bot className="size-5 text-primary" />
            </div>
            <h2 className="text-sm font-semibold mb-1">Ask me about your data</h2>
            <p className="text-xs text-muted-foreground text-center mb-4">
              Your semantic model for {tenant.displayName} is ready. Ask questions in natural language.
            </p>

            {/* Suggested actions */}
            <div className="flex flex-wrap justify-center gap-1.5">
              {SUGGESTED_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => handleSend(action.label)}
                  className={cn(
                    'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md',
                    'text-xs font-medium border border-border/50 bg-card',
                    'hover:bg-muted/50 hover:border-primary/30 transition-colors',
                  )}
                >
                  <span>{action.label}</span>
                  <ChevronRight className="size-3 text-muted-foreground/60" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.length > 0 && (
          <div className="max-w-3xl mx-auto px-4 py-3 space-y-3">
            {messages.map((msg) => {
              if (msg.role === 'user') {
                return (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[80%] rounded-md bg-primary text-primary-foreground px-3 py-2">
                      <p className="text-sm">{msg.content}</p>
                    </div>
                  </div>
                );
              }

              // Assistant message
              return (
                <div key={msg.id} className="space-y-2">
                  {/* Reasoning trace */}
                  {msg.reasoning && msg.reasoning.length > 0 && (
                    <div>
                      <button
                        type="button"
                        onClick={() => toggleReasoning(msg.id)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
                      >
                        <Sparkles className="size-3 text-primary/60" />
                        <span>See reasoning trace</span>
                        <ChevronRight
                          className={cn(
                            'size-3 transition-transform',
                            msg.showReasoning && 'rotate-90',
                          )}
                        />
                      </button>

                      {msg.showReasoning && (
                        <div className="space-y-1 ml-1">
                          {msg.reasoning.map((step) => (
                            <div
                              key={step.id}
                              className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border/40 bg-card"
                            >
                              {step.status === 'complete' ? (
                                <Search className="size-3.5 text-emerald-600 shrink-0" />
                              ) : (
                                <Loader2 className="size-3.5 text-primary animate-spin shrink-0" />
                              )}
                              <span className="text-sm">
                                <span className="font-medium">{step.label}</span>
                                {step.detail && (
                                  <span className="text-muted-foreground ml-1.5">{step.detail}</span>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Content */}
                  {msg.content && (
                    <div className="prose prose-sm max-w-none text-sm leading-relaxed">
                      {msg.content.split('\n').map((line, i) => {
                        // Simple markdown table rendering
                        if (line.startsWith('|')) {
                          return (
                            <span key={i} className="font-mono text-xs block">
                              {line}
                            </span>
                          );
                        }
                        // Bold text
                        if (line.includes('**')) {
                          const parts = line.split(/\*\*(.*?)\*\*/g);
                          return (
                            <span key={i} className="block">
                              {parts.map((part, j) =>
                                j % 2 === 1 ? (
                                  <strong key={j}>{part}</strong>
                                ) : (
                                  <span key={j}>{part}</span>
                                ),
                              )}
                            </span>
                          );
                        }
                        // List items
                        if (line.startsWith('- ')) {
                          return (
                            <span key={i} className="block ml-3">
                              {line}
                            </span>
                          );
                        }
                        if (line.trim() === '') return <br key={i} />;
                        return (
                          <span key={i} className="block">
                            {line}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Streaming indicator */}
                  {msg.isStreaming && !msg.content && (
                    <div className="flex items-center gap-1 py-1">
                      <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Suggestions bar (when messages exist) */}
      {messages.length > 0 && !isGenerating && (
        <div className="px-4 py-1.5 border-t border-border/30">
          <div className="max-w-3xl mx-auto flex items-center gap-1.5 overflow-x-auto">
            {SUGGESTED_ACTIONS.filter(
              (a) => !messages.some((m) => m.role === 'user' && m.content === a.label),
            )
              .slice(0, 3)
              .map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => handleSend(action.label)}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-1 rounded-md shrink-0',
                    'text-[11px] font-medium border border-border/40 bg-card',
                    'hover:bg-muted/50 hover:border-primary/30 transition-colors',
                  )}
                >
                  {action.label}
                  <ChevronRight className="size-2.5 text-muted-foreground/60" />
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t bg-background">
        <div className="max-w-3xl mx-auto px-4 py-2.5">
          <div className="relative flex items-end gap-2 rounded-md border border-border/60 bg-card px-3 py-2 focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me about your data..."
              rows={1}
              className={cn(
                'flex-1 resize-none bg-transparent text-sm placeholder:text-muted-foreground/60',
                'focus:outline-none min-h-[24px] max-h-[120px]',
              )}
              style={{ lineHeight: '1.5' }}
              disabled={isGenerating}
            />
            <div className="flex items-center gap-1 shrink-0 pb-0.5">
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground/50 mr-1">
                <Sparkles className="size-3" />
                <span>Semantic AI</span>
              </div>
              {isGenerating ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-7 p-0 hover:bg-muted/50"
                  onClick={() => setIsGenerating(false)}
                >
                  <Square className="size-3.5" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-7 p-0 hover:bg-muted/50"
                  onClick={() => handleSend()}
                  disabled={!inputValue.trim()}
                >
                  <Send className="size-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
