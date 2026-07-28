import { useCallback, useEffect, useMemo, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import {
  CheckCircle2,
  Loader2,
  Monitor,
  User,
  X,
} from 'lucide-react';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import TableWithPagination from '@/common/tableWithPagination';
import {
  FlowJobsDateFilter,
  FlowDateFilterValue,
  resolveFlowDateFilterToYmd,
} from '@/components/common/FlowJobsDateFilter';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth/authContext';
import {
  fetchConversationMessages,
  fetchDomainConversations,
  type WorkspaceConversationItem,
  type WorkspaceMessageItem,
} from '@/controllers/API/semanticsApi';
import { toast } from 'sonner';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import AIimage from '@/assets/images/ai.png';
import { ChartDetailTabbedPreview } from '@/pages/ExploratoryAnalysis/AgenticSemantics/ChartDetailTabbedPreview';
import {
  messagesFromApi,
  streamArtifactToChartDetail,
  type ChatMessage,
} from '@/pages/ExploratoryAnalysis/AgenticSemantics/WorkspaceChat';

const DEFAULT_DATE_FILTER: FlowDateFilterValue = { mode: 'all' };

function formatShortDate(s: string | null | undefined): string {
  if (!s) return '—';
  try {
    const d = new Date(s);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '—';
  }
}

function strField(c: WorkspaceConversationItem, keys: string[]): string {
  for (const k of keys) {
    const v = c[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

/** Backend sometimes returns the raw prompt on the conversation object. */
function exactQuestionFromConversationMeta(c: WorkspaceConversationItem): string {
  return strField(c, [
    'user_query',
    'first_user_query',
    'initial_query',
    'initial_user_query',
    'query',
    'prompt',
    'first_message',
    'last_user_query',
  ]);
}

/** First non-empty user message text from GET …/messages (exact question). */
function firstUserQuestionFromWorkspaceMessages(items: WorkspaceMessageItem[]): string {
  for (const m of items) {
    const roleRaw = String(m.sender ?? m.role ?? '').toLowerCase();
    if (roleRaw !== 'user') continue;
    const content =
      typeof m.message_text === 'string'
        ? m.message_text
        : typeof m.content === 'string'
          ? m.content
          : m.message_text != null || m.content != null
            ? String(m.message_text ?? m.content)
            : '';
    const t = content.trim();
    if (t) return t;
  }
  return '';
}

function firstUserTextFromChatMessages(msgs: ChatMessage[]): string {
  const u = msgs.find((m) => m.role === 'user' && m.content?.trim());
  return u?.content?.trim() ?? '';
}

/** Fallback when no first user message is available (summary title or id). */
function conversationFallbackLabel(c: WorkspaceConversationItem): string {
  const t = c.title ?? c.display_name;
  if (typeof t === 'string' && t.trim()) return t.trim();
  const id = String(c.conversation_id ?? '').trim();
  if (id.length <= 28) return id;
  return `${id.slice(0, 14)}…${id.slice(-10)}`;
}

function parseYmdToStartOfDay(ymd: string): number | null {
  if (!ymd?.trim()) return null;
  const d = new Date(`${ymd.trim()}T00:00:00`);
  const t = d.getTime();
  return Number.isNaN(t) ? null : t;
}

function parseYmdToEndOfDay(ymd: string): number | null {
  if (!ymd?.trim()) return null;
  const d = new Date(`${ymd.trim()}T23:59:59.999`);
  const t = d.getTime();
  return Number.isNaN(t) ? null : t;
}

function withinFlowDateFilter(iso: string | undefined, filter: FlowDateFilterValue): boolean {
  if (filter.mode === 'all') return true;
  if (!iso) return true;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return true;

  const { fromDate, toDate } = resolveFlowDateFilterToYmd(filter);
  if (!fromDate || !toDate) return true;

  const from = parseYmdToStartOfDay(fromDate);
  const to = parseYmdToEndOfDay(toDate);
  if (from == null || to == null) return true;
  return t >= from && t <= to;
}

function MonitorMessageThread({ messages, loading }: { messages: ChatMessage[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (messages.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No messages in this conversation.</p>;
  }

  const firstAssistantIndex = messages.findIndex((m) => m.role === 'assistant');

  return (
    <div className="space-y-2 pb-2">
      {messages.map((msg, i) => (
        <div key={msg.id}>
          {msg.role === 'assistant' && i === firstAssistantIndex && i > 0 && messages[i - 1]?.role === 'user' && (
            <p className="mb-4 text-xs text-muted-foreground pl-12">Thinking complete</p>
          )}
          <div
            className={cn(
              'flex gap-3',
              msg.role === 'user' && 'flex-row-reverse',
              msg.role === 'assistant' &&
              msg.chartArtifact &&
              msg.chartArtifact.data &&
              msg.chartArtifact.data.length > 0 &&
              'w-full',
            )}
          >
            <div
              className={cn(
                'flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full',
                msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted',
              )}
            >
              {msg.role === 'user' ? (
                <User className="size-4" />
              ) : (
                <img src={AIimage} alt="" className="size-9 object-contain" aria-hidden />
              )}
            </div>
            <div
              className={cn(
                'min-w-0 rounded-2xl px-4 py-2.5',
                msg.role === 'user'
                  ? 'max-w-[90%] bg-primary text-primary-foreground shadow-sm'
                  : 'w-full max-w-full flex-1 border border-border/60 bg-card',
              )}
            >
              {msg.role === 'assistant' && (
                <div className="space-y-3">
                  {msg.content ? (
                    <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">{msg.content}</div>
                  ) : msg.isStreaming ? (
                    <div className="flex gap-1 py-1">
                      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: '0ms' }} />
                      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: '150ms' }} />
                      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: '300ms' }} />
                    </div>
                  ) : null}
                  {msg.chartArtifact && msg.chartArtifact.data && msg.chartArtifact.data.length > 0 && (
                    <div className="mt-2 w-full min-w-0 rounded-lg border border-border/50 bg-background p-2">
                      <ChartDetailTabbedPreview variant="compact" detail={streamArtifactToChartDetail(msg.chartArtifact, msg.id)} />
                    </div>
                  )}
                  {msg.summaryText && (
                    <div className="text-xs">
                      <p className="mb-0.5 font-medium text-muted-foreground">Summary</p>
                      <p className="whitespace-pre-wrap text-muted-foreground">{msg.summaryText}</p>
                    </div>
                  )}
                  {msg.inferenceText && (
                    <div className="text-xs">
                      <p className="mb-0.5 font-medium text-muted-foreground">Inference</p>
                      <p className="whitespace-pre-wrap text-muted-foreground">{msg.inferenceText}</p>
                    </div>
                  )}
                </div>
              )}
              {msg.role === 'user' && msg.content && (
                <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export type DashboardConversationMonitorProps = {
  tenantId: string;
  domainId: string;
};

type MonitorTableRow = {
  id: string;
  _sortQuestion: string;
  conversation: WorkspaceConversationItem;
  _displayQuestion: string;
  _loadingPlaceholder: boolean;
  sessionUser: string;
  created: string;
  updated: string;
  createdSort: number;
  updatedSort: number;
};

export function DashboardConversationMonitor({ tenantId, domainId }: DashboardConversationMonitorProps) {
  const { state: authState } = useAuth();
  const sessionUsername = useMemo(() => {
    const u = authState?.authInfo?.user;
    if (!u) return '—';
    const name = u.username?.trim() || u.email?.trim() || u.name?.trim();
    return name || '—';
  }, [authState?.authInfo?.user]);

  const [rows, setRows] = useState<WorkspaceConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<FlowDateFilterValue>(DEFAULT_DATE_FILTER);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [sortState, setSortState] = useState<{ id: string; desc: boolean } | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [selected, setSelected] = useState<WorkspaceConversationItem | null>(null);
  const [sheetMessages, setSheetMessages] = useState<ChatMessage[]>([]);
  const [sheetLoading, setSheetLoading] = useState(false);
  /** conversation_id → first user message (exact question), from API meta or message fetch */
  const [firstUserQuestionById, setFirstUserQuestionById] = useState<Record<string, string>>({});
  const [enrichingQuestions, setEnrichingQuestions] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setFirstUserQuestionById({});
    try {
      const list = await fetchDomainConversations(tenantId, domainId);
      setRows(list ?? []);
    } catch (error) {
      toast.error(getDisplayErrorMessage(error, 'Could not load conversations for this domain'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId, domainId]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  /** Resolve summarized list titles to the first user message per thread (exact question). */
  useEffect(() => {
    if (!rows.length) {
      setFirstUserQuestionById({});
      setEnrichingQuestions(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      const fromMeta: Record<string, string> = {};
      for (const c of rows) {
        const id = c.conversation_id?.trim();
        if (!id) continue;
        const meta = exactQuestionFromConversationMeta(c);
        if (meta) fromMeta[id] = meta;
      }
      if (!cancelled) setFirstUserQuestionById((prev) => ({ ...prev, ...fromMeta }));

      const needsFetch = rows.filter((c) => {
        const id = c.conversation_id?.trim();
        return Boolean(id && !fromMeta[id!]);
      });

      if (needsFetch.length === 0) {
        if (!cancelled) setEnrichingQuestions(false);
        return;
      }

      if (!cancelled) setEnrichingQuestions(true);
      const BATCH = 6;
      for (let i = 0; i < needsFetch.length; i += BATCH) {
        if (cancelled) break;
        const slice = needsFetch.slice(i, i + BATCH);
        await Promise.all(
          slice.map(async (c) => {
            const id = c.conversation_id!.trim();
            try {
              const raw = await fetchConversationMessages(id);
              const q = firstUserQuestionFromWorkspaceMessages(raw);
              if (q && !cancelled) {
                setFirstUserQuestionById((prev) => ({ ...prev, [id]: q }));
              }
            } catch {
              // keep fallback label
            }
          }),
        );
      }
      if (!cancelled) setEnrichingQuestions(false);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((c) => {
      const created = c.created_at ?? c.updated_at;
      return withinFlowDateFilter(typeof created === 'string' ? created : undefined, dateFilter);
    });
  }, [rows, dateFilter]);

  const allTableRows = useMemo(() => {
    return filtered.map((c, rowIdx) => {
      const cid = c.conversation_id?.trim() ?? '';
      const fromMap = cid ? firstUserQuestionById[cid] : '';
      const fromMeta = exactQuestionFromConversationMeta(c);
      const hasExact = Boolean(fromMap || fromMeta);
      const display = hasExact
        ? (fromMap || fromMeta)
        : enrichingQuestions
          ? 'Loading question…'
          : conversationFallbackLabel(c);
      const createdIso = typeof c.created_at === 'string' ? c.created_at : '';
      const updatedIso = typeof c.updated_at === 'string' ? c.updated_at : '';
      return {
        id: cid || `row-${rowIdx}`,
        _sortQuestion: display,
        conversation: c,
        _displayQuestion: display,
        _loadingPlaceholder: !hasExact && enrichingQuestions,
        sessionUser: sessionUsername,
        created: formatShortDate(createdIso || undefined),
        updated: formatShortDate(updatedIso || undefined),
        createdSort: createdIso ? Date.parse(createdIso) || 0 : 0,
        updatedSort: updatedIso ? Date.parse(updatedIso) || 0 : 0,
      };
    });
  }, [filtered, firstUserQuestionById, enrichingQuestions, sessionUsername]);

  const sortedTableRows = useMemo(() => {
    if (!sortState) return allTableRows;
    const { id, desc } = sortState;
    const sortKey =
      id === 'question'
        ? '_sortQuestion'
        : id === 'sessionUser'
          ? 'sessionUser'
          : id === 'created'
            ? 'createdSort'
            : id === 'updated'
              ? 'updatedSort'
              : '_sortQuestion';

    return [...allTableRows].sort((a, b) => {
      const av = a[sortKey as keyof MonitorTableRow];
      const bv = b[sortKey as keyof MonitorTableRow];
      if (typeof av === 'number' && typeof bv === 'number') {
        return desc ? bv - av : av - bv;
      }
      return desc
        ? String(bv).localeCompare(String(av))
        : String(av).localeCompare(String(bv));
    });
  }, [allTableRows, sortState]);

  const pageCount = Math.max(1, Math.ceil(sortedTableRows.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const displayRows = useMemo(() => {
    const start = safePage * pageSize;
    return sortedTableRows.slice(start, start + pageSize);
  }, [sortedTableRows, safePage, pageSize]);

  useEffect(() => {
    setPage(0);
  }, [dateFilter, pageSize]);

  const handlePaginationChange = useCallback(
    ({
      currentPage: nextPage,
      limit,
      sortedColumns,
    }: {
      currentPage: number;
      limit: number;
      sortedColumns?: Record<string, 'asc' | 'desc'>;
    }) => {
      if (limit !== pageSize) {
        setPageSize(limit);
        setPage(0);
      } else {
        setPage(nextPage);
      }

      if (sortedColumns !== undefined) {
        const entries = Object.entries(sortedColumns);
        const next =
          entries.length > 0
            ? { id: entries[0][0], desc: entries[0][1] === 'desc' }
            : null;
        setSortState((prev) => {
          const changed =
            (prev?.id ?? null) !== (next?.id ?? null) ||
            (prev?.desc ?? null) !== (next?.desc ?? null);
          if (changed) {
            setPage(0);
          }
          return next;
        });
      }
    },
    [pageSize],
  );

  const openConversation = useCallback(async (c: WorkspaceConversationItem) => {
    const id = c.conversation_id?.trim();
    if (!id) return;
    setSelected(c);
    setSheetOpen(true);
    setSheetLoading(true);
    setSheetMessages([]);
    try {
      const raw = await fetchConversationMessages(id);
      setSheetMessages(messagesFromApi(raw));
    } catch (error) {
      toast.error(getDisplayErrorMessage(error, 'Could not load this conversation'));
      setSheetMessages([]);
    } finally {
      setSheetLoading(false);
    }
  }, []);

  const sheetHeaderTitle = useMemo(() => {
    if (!selected) return 'Conversation';
    const fromLoaded = sheetMessages.length > 0 ? firstUserTextFromChatMessages(sheetMessages) : '';
    const id = selected.conversation_id?.trim();
    const fromMap = id ? firstUserQuestionById[id] : '';
    const fromMeta = exactQuestionFromConversationMeta(selected);
    return fromLoaded || fromMap || fromMeta || conversationFallbackLabel(selected);
  }, [selected, sheetMessages, firstUserQuestionById]);

  const monitorColumns = useMemo<ColumnDef<MonitorTableRow>[]>(
    () => [
      {
        id: 'question',
        header: 'Question',
        accessorKey: '_sortQuestion',
        size: 480,
        cell: ({ row }) => {
          const conv = row.original.conversation;
          const display = row.original._displayQuestion;
          const loadingPh = row.original._loadingPlaceholder;
          return (
            <button
              type="button"
              onClick={() => void openConversation(conv)}
              className={cn(
                'inline-flex max-w-full items-start gap-2 text-left text-sm text-primary hover:underline',
                loadingPh && 'text-muted-foreground',
              )}
            >
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground opacity-70 hover:opacity-100" />
              <span className="min-w-0 break-words [overflow-wrap:anywhere]">{display}</span>
            </button>
          );
        },
      },
      {
        id: 'sessionUser',
        header: 'User',
        accessorKey: 'sessionUser',
        size: 140,
      },
      {
        id: 'created',
        header: 'Created',
        accessorKey: 'createdSort',
        size: 140,
        cell: ({ row }) => row.original.created,
      },
      {
        id: 'updated',
        header: 'Last updated',
        accessorKey: 'updatedSort',
        size: 140,
        cell: ({ row }) => row.original.updated,
      },
    ],
    [openConversation],
  );

  return (
    <div className="flex min-h-[320px] min-w-0 flex-col gap-3">
      <FlowJobsDateFilter
        value={dateFilter}
        onChange={setDateFilter}
        isLoading={loading}
        idPrefix="conversation-monitor"
        className="w-full shrink-0"
      />

      <div className="relative min-h-0 flex-1">
        <TableWithPagination<MonitorTableRow>
          data={displayRows}
          columns={monitorColumns}
          totalRows={sortedTableRows.length}
          loading={loading}
          pagination={{
            steps: [10, 25, 50],
            currentPage: safePage,
            pageSize,
          }}
          paginationSummary="range"
          scrollContainerClassName="max-h-[min(70vh,640px)] w-full overflow-auto"
          onChangePagination={handlePaginationChange}
        />
      </div>

      <Sheet
        open={sheetOpen}
        onOpenChange={(o) => {
          setSheetOpen(o);
          if (!o) {
            setSelected(null);
            setSheetMessages([]);
          }
        }}
      >
        <SheetContent
          side="right"
          hideClose
          className="flex h-full w-[min(97vw,85rem)] min-w-0 max-w-none flex-col gap-0 overflow-visible p-0"
        >
          <SheetClose
            type="button"
            className={cn(
              'absolute left-[-3.5rem] top-2 z-[70] flex size-11 items-center justify-center rounded-full border bg-background shadow-md',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            )}
            aria-label="Close panel"
          >
            <X className="size-4" strokeWidth={2.25} />
            <span className="sr-only">Close</span>
          </SheetClose>
          <SheetHeader className="shrink-0 border-b border-border/60 px-6 py-4 text-left">
            <div className="flex items-center gap-2">
              <Monitor className="size-4 text-muted-foreground" />
              <SheetTitle className="text-base leading-snug [overflow-wrap:anywhere]">
                {sheetHeaderTitle}
              </SheetTitle>
            </div>
            <SheetDescription className="text-xs">Workspace messages for this thread.</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <MonitorMessageThread messages={sheetMessages} loading={sheetLoading} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
