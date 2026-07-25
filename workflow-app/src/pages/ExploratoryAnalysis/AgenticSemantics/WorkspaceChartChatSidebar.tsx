import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  History,
  Loader2,
  MessageSquare,
  Search,
  SendHorizontal,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import AIimage from '@/assets/images/ai.png';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import {
  createWorkspaceConversation,
  fetchChartConversationsList,
  fetchConversationMessagesWithMeta,
  fetchDomainConversations,
  postWorkspaceConversationMessagesList,
  workspaceChartResponseToChartJson,
  type WorkspaceConversationItem,
  type WorkspaceMessageItem,
} from '@/controllers/API/semanticsApi';
import { toast } from 'sonner';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import { cn } from '@/lib/utils';
import type { ChartDetail } from './chartTypes';
import {
  DashboardChartExpandedModalContent,
  DashboardSingleChartCard,
  type ChartDrilldownUiHandlers,
} from './DashboardChartCards';
import {
  WorkspaceDashboardChartActions,
  chartActionsIndicateExploration,
} from './WorkspaceDashboardChartActions';
import { messagesFromApi, streamArtifactToChartDetail } from './WorkspaceChat';

type SidePanelMode = 'closed' | 'history';

const CHAT_CONV_STORAGE_PREFIX = 'workspaceChartChat:conversationId';

function chartChatConvStorageKey(tenantId: string, domainId: string, chartId: string): string {
  return `${CHAT_CONV_STORAGE_PREFIX}:${tenantId}:${domainId}:${chartId}`;
}

/** Clears legacy persisted thread id for this chart slot (we no longer restore on open). */
function writeStoredChartConversationId(
  tenantId: string,
  domainId: string,
  chartId: string,
  conversationId: string | null,
): void {
  try {
    const key = chartChatConvStorageKey(tenantId, domainId, chartId);
    const t = conversationId?.trim();
    if (t) localStorage.setItem(key, t);
    else localStorage.removeItem(key);
  } catch (error) {
    // ignore quota / private mode
  }
}

function formatConversationIdLabel(id: string): string {
  const t = id.trim();
  if (t.length <= 22) return t;
  return `${t.slice(0, 12)}…${t.slice(-8)}`;
}

function mergeConversationLists(
  domain: WorkspaceConversationItem[],
  chart: WorkspaceConversationItem[],
  linkedIds: string[],
): WorkspaceConversationItem[] {
  const map = new Map<string, WorkspaceConversationItem>();

  const add = (c: WorkspaceConversationItem) => {
    const id = String(c.conversation_id ?? '').trim();
    if (!id) return;
    const prev = map.get(id);
    if (!prev) {
      map.set(id, { ...c, conversation_id: id });
      return;
    }
    const title =
      (typeof prev.title === 'string' && prev.title.trim()) ||
      (typeof prev.display_name === 'string' && prev.display_name.trim()) ||
      (typeof c.title === 'string' && c.title.trim()) ||
      (typeof c.display_name === 'string' && c.display_name.trim());
    map.set(id, {
      ...prev,
      ...c,
      conversation_id: id,
      ...(title ? { title } : {}),
    });
  };

  chart.forEach(add);
  linkedIds.forEach((rawId) => {
    const id = rawId.trim();
    if (!id || map.has(id)) return;
    map.set(id, {
      conversation_id: id,
      title: `Insight · ${formatConversationIdLabel(id)}`,
    });
  });
  domain.forEach(add);

  const list = Array.from(map.values());
  list.sort((a, b) => {
    const ta = (a.updated_at ?? a.created_at ?? '') as string;
    const tb = (b.updated_at ?? b.created_at ?? '') as string;
    return tb.localeCompare(ta);
  });
  return list;
}

function conversationRowLabel(c: WorkspaceConversationItem): string {
  const t = c.title ?? c.display_name;
  if (typeof t === 'string' && t.trim()) return t.trim();
  return formatConversationIdLabel(c.conversation_id);
}

function formatHistoryDate(s: string | null | undefined): string {
  if (!s) return '';
  try {
    const d = new Date(s);
    return (
      d.toLocaleDateString(undefined, { dateStyle: 'short' }) +
      ' ' +
      d.toLocaleTimeString(undefined, { timeStyle: 'short' })
    );
  } catch {
    return String(s);
  }
}

function resolveAssistantMessageField(
  msg: WorkspaceMessageItem,
  key: 'chart_json' | 'data_json',
): unknown {
  const top = msg[key];
  if (top != null) return top;
  const nested = msg.assistant_message;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const v = (nested as Record<string, unknown>)[key];
    if (v != null) return v;
  }
  if (key === 'chart_json') {
    const r = (msg as WorkspaceMessageItem & { response?: unknown }).response;
    if (r && typeof r === 'object' && !Array.isArray(r)) {
      const synthesized = workspaceChartResponseToChartJson(r as Record<string, unknown>);
      if (synthesized) return synthesized;
    }
  }
  return undefined;
}

function resolveSqlText(msg: WorkspaceMessageItem): string | null | undefined {
  if (msg.sql_text != null) return msg.sql_text;
  const nested = msg.assistant_message;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const s = (nested as Record<string, unknown>).sql_text;
    return typeof s === 'string' ? s : null;
  }
  return msg.sql_text;
}

/** `data_json.rows` on the same assistant message (GET history often sends full labels here). */
function resolveDataJsonRows(msg: WorkspaceMessageItem): Array<Record<string, unknown>> | null {
  const dj = resolveAssistantMessageField(msg, 'data_json');
  if (!dj || typeof dj !== 'object') return null;
  const rows = (dj as Record<string, unknown>).rows;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows as Array<Record<string, unknown>>;
}

/**
 * History APIs sometimes attach series in `chart_json.data` with null categories while `data_json.rows`
 * has the real dimension labels (e.g. category + metric). Prefer rows when chart data looks incomplete.
 */
function preferDataJsonRowsForChartData(
  chartData: Array<Record<string, unknown>>,
  msg: WorkspaceMessageItem,
): Array<Record<string, unknown>> {
  const alt = resolveDataJsonRows(msg);
  if (!alt || alt.length === 0) return chartData;

  const hasCategoryKey = chartData.some((r) => Object.prototype.hasOwnProperty.call(r, 'category'));
  if (!hasCategoryKey) return chartData;

  const categoriesMissing = chartData.every(
    (r) => r.category == null && r.Category == null && r.category_name == null,
  );
  if (!categoriesMissing) return chartData;

  const altHasLabels = alt.some((r) => {
    const c = r.category ?? r.Category ?? r.region ?? r.zone;
    return c != null && String(c).trim() !== '';
  });
  return altHasLabels ? alt : chartData;
}

/**
 * Map assistant `chart_json` onto a dashboard chart (preferred when present).
 * `chart_json.data` replaces `chart_data`; `chart_type` / `chart_title` override display.
 * If `chart_json.chart_id` is set, that id is used for overrides (target slot); otherwise `base.chart_id`.
 */
export function assistantChartJsonToChartDetail(
  base: ChartDetail,
  msg: WorkspaceMessageItem,
): ChartDetail | null {
  const cj = resolveAssistantMessageField(msg, 'chart_json');
  if (!cj || typeof cj !== 'object') return null;
  const o = cj as Record<string, unknown>;
  const data = o.data;
  if (!Array.isArray(data) || data.length === 0) return null;
  const chartType = String(o.chart_type ?? base.chart_type);
  const chartTitle = String(o.chart_title ?? base.title ?? base.metric_name);
  const cid = o.chart_id;
  const resolvedChartId =
    cid != null && String(cid).trim() !== '' ? String(cid) : base.chart_id;
  const insight =
    typeof o.insight_text === 'string' && o.insight_text.trim() ? o.insight_text.trim() : undefined;
  const narrative =
    typeof o.narrative_text === 'string' && o.narrative_text.trim()
      ? o.narrative_text.trim()
      : undefined;
  const cp = o.chart_payload;
  const chart_payload =
    cp != null && typeof cp === 'object' && !Array.isArray(cp)
      ? (cp as ChartDetail['chart_payload'])
      : undefined;
  const dims = o.dimensions;
  const category_column =
    Array.isArray(dims) &&
      dims.length > 0 &&
      typeof dims[0] === 'string' &&
      dims[0].trim() !== ''
      ? dims[0].trim()
      : undefined;
  const rawRows = data as Array<Record<string, unknown>>;
  const chart_data = preferDataJsonRowsForChartData(rawRows, msg);
  return {
    ...base,
    chart_id: resolvedChartId,
    chart_type: chartType,
    title: chartTitle,
    metric_name: chartTitle,
    chart_data,
    sql: resolveSqlText(msg)?.trim() || base.sql,
    ...(chart_payload != null ? { chart_payload } : {}),
    ...(category_column != null ? { category_column } : {}),
    ...(insight != null ? { insight_text: insight } : {}),
    ...(narrative != null ? { narrative_text: narrative } : {}),
  };
}

/** Map assistant message data_json.rows (+ sql) onto the dashboard chart it replaces. */
export function assistantDataJsonToChartDetail(
  base: ChartDetail,
  msg: WorkspaceMessageItem,
): ChartDetail | null {
  const dj = resolveAssistantMessageField(msg, 'data_json');
  if (!dj || typeof dj !== 'object') return null;
  const o = dj as Record<string, unknown>;
  const rows = o.rows;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const chartType = String(o.chart_type ?? base.chart_type);
  const chartTitle = String(o.chart_title ?? base.title ?? base.metric_name);
  const insight =
    typeof o.insight_text === 'string' && o.insight_text.trim() ? o.insight_text.trim() : undefined;
  const narrative =
    typeof o.narrative_text === 'string' && o.narrative_text.trim()
      ? o.narrative_text.trim()
      : undefined;
  return {
    ...base,
    chart_type: chartType,
    title: chartTitle,
    metric_name: chartTitle,
    chart_data: rows as Array<Record<string, unknown>>,
    sql: resolveSqlText(msg)?.trim() || base.sql,
    ...(insight != null ? { insight_text: insight } : {}),
    ...(narrative != null ? { narrative_text: narrative } : {}),
  };
}

/** Latest assistant message wins; `chart_json` takes precedence over `data_json.rows`. */
export function applyLatestAssistantChartToOverrides(
  messages: WorkspaceMessageItem[],
  baseChart: ChartDetail,
): ChartDetail | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    const sender = String(m.sender ?? m.role ?? '').toLowerCase();
    if (sender !== 'assistant') continue;
    const fromChartJson = assistantChartJsonToChartDetail(baseChart, m);
    if (fromChartJson) return fromChartJson;
    const fromDataJson = assistantDataJsonToChartDetail(baseChart, m);
    if (fromDataJson) return fromDataJson;
  }
  return null;
}

/** True if this assistant message carries chart_json or data_json rows that map to a chart. */
export function messageHasChartPayloadForDetail(
  base: ChartDetail,
  msg: WorkspaceMessageItem,
): boolean {
  return (
    assistantChartJsonToChartDetail(base, msg) != null ||
    assistantDataJsonToChartDetail(base, msg) != null
  );
}

/** Merge live chart updates from workspace chat into `chart_details` for agent renderers. */
export function mergeChartOverridesIntoArtifacts(
  artifacts: Record<string, unknown>,
  overrides: Record<string, ChartDetail> | undefined,
): Record<string, unknown> {
  if (!overrides || Object.keys(overrides).length === 0) return artifacts;
  const cd = artifacts.chart_details as ChartDetail[] | undefined;
  if (!Array.isArray(cd)) return artifacts;
  const merged = cd.map((d) => overrides[d.chart_id] ?? d);
  return { ...artifacts, chart_details: merged };
}

function messageRole(m: WorkspaceMessageItem): 'user' | 'assistant' {
  const r = String(m.sender ?? m.role ?? '').toLowerCase();
  return r === 'assistant' ? 'assistant' : 'user';
}

/**
 * POST /workspace/conversations/.../messages often returns only the latest turn (e.g. `{ response }` → one assistant
 * message). Replacing `cognitoMessages` with that array drops earlier turns and their charts. This merges so every
 * query’s assistant chart stays in order in the scrollable thread.
 */
function mergeWorkspaceMessagesAfterSend(
  previous: WorkspaceMessageItem[],
  incoming: WorkspaceMessageItem[],
  userQuery: string,
): WorkspaceMessageItem[] {
  const inc = incoming ?? [];
  if (inc.length === 0) return previous;

  if (inc.length === 1 && messageRole(inc[0]) === 'assistant') {
    const userMsg: WorkspaceMessageItem = {
      sender: 'user',
      role: 'user',
      message_text: userQuery,
      message_id: `local-user-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    };
    return previous.length === 0 ? [userMsg, inc[0]] : [...previous, userMsg, inc[0]];
  }

  if (inc.length >= previous.length) {
    return inc;
  }

  if (inc.length === 2 && messageRole(inc[0]) === 'user' && messageRole(inc[1]) === 'assistant') {
    return [...previous, inc[0], inc[1]];
  }

  const seen = new Set(
    previous
      .map((m) => m.message_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  );
  const extra = inc.filter((m) => {
    const id = m.message_id;
    return typeof id === 'string' && id.length > 0 && !seen.has(id);
  });
  return extra.length > 0 ? [...previous, ...extra] : previous;
}

/** Bouncing dots after “Thinking” (chart area / assistant pending). */
function ThinkingDots({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)} aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 rounded-full bg-current opacity-70"
          style={{
            animation: 'thinking-dot 1.05s ease-in-out infinite',
            animationDelay: `${i * 160}ms`,
          }}
        />
      ))}
      <style>{`
        @keyframes thinking-dot {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }
          40% { transform: translateY(-3px); opacity: 1; }
        }
      `}</style>
    </span>
  );
}

/** One column for exploration + conversation so chart width doesn’t change when a thread opens. */
const WORKSPACE_CHAT_COLUMN_CLASS = 'mx-auto w-full max-w-8xl space-y-4 px-4 py-1';

/** Centered “Thinking …” — matches compact loading state (no assistant avatar / chart-sized box). */
function AssistantThinkingCentered() {
  return (
    <div
      className="flex w-full flex-col items-center justify-center py-10 text-center"
      aria-live="polite"
      aria-busy="true"
    >
      <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground">
        <span className="text-foreground">Thinking</span>
        <ThinkingDots />
      </p>
    </div>
  );
}

/** Isolated composer so keystrokes do not re-render conversation charts (avoids chart blink). */
const WorkspaceChartChatComposer = memo(function WorkspaceChartChatComposer({
  queryId,
  placeholder,
  disabled,
  onSend,
  externalQuery,
  onExternalQueryConsumed,
}: {
  queryId: string;
  placeholder: string;
  disabled: boolean;
  onSend: (query: string) => void | Promise<void>;
  /** Set from hint chips — applied once then cleared via `onExternalQueryConsumed`. */
  externalQuery?: string | null;
  onExternalQueryConsumed?: () => void;
}) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const q = externalQuery?.trim();
    if (!q) return;
    setQuery(q);
    onExternalQueryConsumed?.();
  }, [externalQuery, onExternalQueryConsumed]);

  const handleSend = useCallback(() => {
    const q = query.trim();
    if (!q || disabled) return;
    setQuery('');
    void onSend(q);
  }, [query, disabled, onSend]);

  return (
    <div className="shrink-0 border-t border-border bg-background p-3">
      <div className="flex min-h-0 flex-col space-y-2">
        <label htmlFor={queryId} className="sr-only">
          Question for the assistant
        </label>
        <div className="relative">
          <Textarea
            id={queryId}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="min-h-[20px] resize-none rounded-xl border-2 bg-muted/40 px-3 pb-3 pr-12 pt-3 text-sm shadow-none transition-colors placeholder:text-muted-foreground/80 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-0 disabled:opacity-60"
            disabled={disabled}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button
            type="button"
            disabled={disabled || !query.trim()}
            onClick={handleSend}
            className="absolute bottom-2 right-2 z-10 flex size-9 items-center justify-center rounded-md text-primary transition-[opacity,transform] hover:opacity-80 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40"
            aria-label={disabled ? 'Sending…' : 'Send message'}
          >
            <SendHorizontal className="size-5" />
          </button>
        </div>
        <p className="text-center text-[10px] text-muted-foreground">
          <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[9px]">
            Enter
          </kbd>{' '}
          to send ·{' '}
          <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[9px]">
            Shift+Enter
          </kbd>{' '}
          new line
        </p>
      </div>
    </div>
  );
});

/** User bubble shown above “Thinking” while the send request is in flight (matches thread user styling). */
function PendingUserMessageBubble({ text }: { text: string }) {
  return (
    <div className="flex w-full justify-end">
      <div className="flex max-w-full flex-row-reverse gap-2">
        <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-primary-foreground">
          <User className="size-4" aria-hidden />
        </div>
        <div className="min-w-0 max-w-[85%] rounded-lg bg-primary px-3 py-2 text-primary-foreground">
          <div className="text-sm whitespace-pre-wrap break-words">{text}</div>
        </div>
      </div>
    </div>
  );
}

/**
 * Scrollable conversation: optional original chart, then each turn — same layout as {@link WorkspaceChat}
 * (avatars, bubbles, chart + dashboard actions under assistant replies). Loaded history uses the same mapping
 * as workspace chat (messagesFromApi / streamArtifactToChartDetail).
 */
const WorkspaceConversationThread = memo(function WorkspaceConversationThread({
  tenantId,
  domainId,
  currentUserEmail,
  currentUserName,
  baseChart,
  originalChart,
  messages,
  drilldownUi,
  drilldownScopeKey,
  showOriginalChart,
  isAssistantPending,
  pendingUserText,
  currentDashboardId,
  onAddToCurrentDashboard,
  showEmptyHints = false,
  isDataQualityDashboard = false,
  onPickHint,
}: {
  tenantId: string;
  domainId: string;
  currentUserEmail?: string;
  currentUserName?: string;
  baseChart: ChartDetail;
  originalChart: ChartDetail;
  messages: WorkspaceMessageItem[];
  drilldownUi?: ChartDrilldownUiHandlers;
  drilldownScopeKey?: string;
  showOriginalChart: boolean;
  isAssistantPending?: boolean;
  pendingUserText?: string | null;
  currentDashboardId?: string;
  onAddToCurrentDashboard?: (detail: ChartDetail, title?: string) => Promise<void>;
  showEmptyHints?: boolean;
  isDataQualityDashboard?: boolean;
  onPickHint?: (hint: string) => void;
}) {
  const chatMessages = useMemo(() => messagesFromApi(messages), [messages]);

  const latestAssistantChartIdx = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (String(m.sender ?? m.role ?? '').toLowerCase() !== 'assistant') continue;
      if (messageHasChartPayloadForDetail(baseChart, m)) return i;
    }
    return -1;
  }, [messages, baseChart]);

  const messageChartDetails = useMemo(
    () =>
      chatMessages.map((msg, idx) => {
        const wsMsg = messages[idx];
        const hasChart =
          msg.role === 'assistant' &&
          Boolean(msg.chartArtifact && (msg.chartArtifact.data?.length ?? 0) > 0);
        const chartDetailForActions =
          hasChart && msg.chartArtifact
            ? streamArtifactToChartDetail(msg.chartArtifact, msg.id)
            : null;
        const useDrilldownModal =
          drilldownUi != null &&
          wsMsg != null &&
          idx === latestAssistantChartIdx &&
          messageHasChartPayloadForDetail(baseChart, wsMsg);
        const drillDetail =
          useDrilldownModal && wsMsg
            ? (assistantChartJsonToChartDetail(baseChart, wsMsg) ??
              assistantDataJsonToChartDetail(baseChart, wsMsg))
            : null;
        return { hasChart, chartDetailForActions, useDrilldownModal, drillDetail };
      }),
    [chatMessages, messages, baseChart, latestAssistantChartIdx, drilldownUi],
  );

  return (
    <div className="space-y-4">
      <div className={WORKSPACE_CHAT_COLUMN_CLASS}>
        {showOriginalChart ? (
          <div className="w-full min-w-0 space-y-2">
            <DashboardSingleChartCard
              detail={originalChart}
              chartSlotId={drilldownScopeKey ?? originalChart.chart_id}
              drilldownUi={drilldownUi}
              compact
              className="shadow-md"
            />
          </div>
        ) : null}
        {chatMessages.map((msg, idx) => {
          const { hasChart, chartDetailForActions, useDrilldownModal, drillDetail } =
            messageChartDetails[idx];

          return (
            <div
              key={msg.id}
              className={cn(
                'flex gap-2',
                msg.role === 'user' && 'flex-row-reverse',
                msg.role === 'assistant' && hasChart && 'w-full',
              )}
            >
              <div
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full',
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
                  'min-w-0 rounded-lg px-3 py-2',
                  msg.role === 'user'
                    ? 'max-w-[85%] bg-primary text-primary-foreground'
                    : 'border border-border/50 bg-muted',
                  msg.role === 'assistant' && hasChart && 'w-full max-w-full flex-1',
                  msg.role === 'assistant' && !hasChart && 'max-w-[85%]',
                )}
              >
                {msg.role === 'assistant' && (
                  <div className="space-y-3">
                    {msg.content ? (
                      <div className="text-sm whitespace-pre-wrap break-words">{msg.content}</div>
                    ) : (!hasChart && !msg.summaryText && !msg.inferenceText) ? (
                      <div className="text-sm text-muted-foreground italic">No data available for this query</div>
                    ) : null}
                    {hasChart && chartDetailForActions && msg.chartArtifact && (
                      <div className="mt-2 w-full min-w-0 space-y-3">
                        <DashboardSingleChartCard
                          detail={useDrilldownModal && drillDetail ? drillDetail : chartDetailForActions}
                          chartSlotId={useDrilldownModal && drillDetail ? (drilldownScopeKey ?? drillDetail.chart_id) : chartDetailForActions.chart_id}
                          drilldownUi={useDrilldownModal ? drilldownUi : undefined}
                          compact
                          className="shadow-md"
                        />
                        <WorkspaceDashboardChartActions
                          tenantId={tenantId}
                          domainId={domainId}
                          chart={chartDetailForActions}
                          compact
                          currentDashboardId={currentDashboardId}
                          onAddToCurrentDashboard={onAddToCurrentDashboard}
                          currentUserEmail={currentUserEmail}
                          currentUserName={currentUserName}
                        />
                      </div>
                    )}
                    {msg.summaryText ? (
                      <div className="text-xs">
                        <p className="mb-0.5 font-medium text-muted-foreground">Summary</p>
                        <p className="whitespace-pre-wrap text-muted-foreground">{msg.summaryText}</p>
                      </div>
                    ) : null}
                    {msg.inferenceText ? (
                      <div className="text-xs">
                        <p className="mb-0.5 font-medium text-muted-foreground">Inference</p>
                        <p className="whitespace-pre-wrap text-muted-foreground">{msg.inferenceText}</p>
                      </div>
                    ) : null}
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
          );
        })}
        {isAssistantPending && pendingUserText?.trim() ? (
          <PendingUserMessageBubble text={pendingUserText.trim()} />
        ) : null}
        {isAssistantPending ? <AssistantThinkingCentered /> : null}
        {showEmptyHints && !isAssistantPending && !isDataQualityDashboard && onPickHint ? (
          <div className="pt-2">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Try asking
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[
                'Production by zone',
                'Production by region',
                'Production by sales area',
                'Production by customer',
                'Production by product',
              ].map((hint) => (
                <button
                  key={hint}
                  type="button"
                  className="rounded-full border border-border/60 bg-background px-2.5 py-1 text-left text-[11px] text-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
                  onClick={() => onPickHint(hint)}
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
});

export interface WorkspaceChartChatSidebarProps {
  tenantId: string;
  domainId: string;
  chart: ChartDetail | null;
  /** When true, the empty state shows hint chips only — no chart preview (e.g. dashboard toolbar entry). */
  hideEmptyStateChartPreview?: boolean;
  /** Overrides the default “Ask about this chart” sheet title. */
  chatHeaderTitle?: string;
  /** Overrides the subtitle line under the title (defaults to chart title / metric name). */
  chatHeaderContext?: string;
  /** Overrides the composer placeholder (defaults to chart-focused copy). */
  chatComposerPlaceholder?: string;
  /**
   * When true, History loads via GET .../tenants/{tenant}/domains/{domain}/conversations (domain-wide).
   * When false (default), History uses GET .../charts/{chart_id}/conversations (chart-scoped).
   */
  domainScopedConversationHistory?: boolean;
  /** Semantic deployment / agent run (included in create-conversation payload when set). */
  runId?: string | null;
  onClose: () => void;
  /** When the assistant returns chart rows, parent can merge into dashboard/agent views. */
  onChartReplaced?: (detail: ChartDetail) => void;
  /** Called only for a live assistant result that should be persisted as a new dashboard chart. */
  onChartCommitted?: (detail: ChartDetail, title?: string) => void;
  /** Open dashboard in Insights — manual “add to existing” uses {@link onChartCommitted} when ids match. */
  currentDashboardId?: string;
  /** Optional: current user's email for created_by field in dashboard creation. */
  currentUserEmail?: string;
  currentUserName?: string;
  /** Same drill/filter exploration as the expanded chart modal (Insights dashboard agent charts). */
  drilldownUi?: ChartDrilldownUiHandlers;
  /** Stable slot id when `chart` is tied to a dashboard card (keeps drill state when `chart_id` changes). */
  drilldownScopeKey?: string;
  isDataQualityDashboard?: boolean;
}

export function WorkspaceChartChatSidebar({
  tenantId,
  domainId,
  chart,
  hideEmptyStateChartPreview = false,
  chatHeaderTitle,
  chatHeaderContext,
  chatComposerPlaceholder,
  domainScopedConversationHistory = false,
  runId,
  onClose,
  onChartReplaced,
  onChartCommitted,
  currentDashboardId,
  currentUserEmail,
  currentUserName,
  drilldownUi,
  drilldownScopeKey,
  isDataQualityDashboard = false,
}: WorkspaceChartChatSidebarProps) {
  const queryId = useId();

  // Chat related states
  const [hintQuery, setHintQuery] = useState<string | null>(null);
  const [cognitoConversationId, setCognitoConversationId] = useState<string | null>(null);
  const [cognitoMessages, setCognitoMessages] = useState<WorkspaceMessageItem[]>([]);
  const [cognitoSending, setCognitoSending] = useState(false);
  /** Text just sent — shown above Thinking until the request finishes; textarea is cleared immediately. */
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  /** True while History is loading messages after picking a conversation. */
  const [historyActionLoading, setHistoryActionLoading] = useState(false);
  const [sidePanel, setSidePanel] = useState<SidePanelMode>('closed');
  const [historyListLoading, setHistoryListLoading] = useState(false);
  const [historyListItems, setHistoryListItems] = useState<WorkspaceConversationItem[]>([]);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  /** Latest assistant-generated chart (merged with base); drives in-panel Chart / Table / Query tabs. */
  const [conversationChartDetail, setConversationChartDetail] = useState<ChartDetail | null>(null);
  /** True after opening a thread from History; Back returns to empty / new-chat state for this chart. */
  const [threadOpenedFromHistory, setThreadOpenedFromHistory] = useState(false);

  const cognitoMessagesScrollRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ChartDetail | null>(chart);
  chartRef.current = chart;
  /** Chart the user selected when opening chat — not overwritten when assistant replaces `chart`. */
  const originalChartRef = useRef<ChartDetail | null>(null);
  const onChartReplacedRef = useRef(onChartReplaced);
  onChartReplacedRef.current = onChartReplaced;
  const onChartCommittedRef = useRef(onChartCommitted);
  onChartCommittedRef.current = onChartCommitted;

  useEffect(() => {
    const el = cognitoMessagesScrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
  }, [cognitoMessages, cognitoSending, pendingUserMessage]);

  /**
   * Session/localStorage key must stay stable while the assistant updates `chart.chart_id` (onChartReplaced).
   * Using `chart?.chart_id` in a restore effect caused an infinite GET /messages loop: fetch → replace chart → id changes → effect reruns.
   * Prefer dashboard slot id; otherwise pin the first `chart_id` seen for this mount.
   */
  const storageChartIdPinRef = useRef<string | null>(null);
  const storageChartId = useMemo(() => {
    if (drilldownScopeKey?.trim()) return drilldownScopeKey.trim();
    const cid = chart?.chart_id?.trim();
    if (!cid) return storageChartIdPinRef.current ?? '';
    if (!storageChartIdPinRef.current) storageChartIdPinRef.current = cid;
    return storageChartIdPinRef.current;
  }, [drilldownScopeKey, chart?.chart_id]);

  const linkedConversationIds =
    chart?.conversation_ids?.filter((id) => typeof id === 'string' && id.trim() !== '') ?? [];
  const linkedConversationIdsKey = linkedConversationIds.join('\u0001');

  const applyFetchedMessages = useCallback(
    (msgs: WorkspaceMessageItem[], resolvedConvId: string, baseChart: ChartDetail) => {
      const id = resolvedConvId.trim();
      setCognitoConversationId(id);
      setCognitoMessages(msgs);
      const replaced = applyLatestAssistantChartToOverrides(msgs, baseChart);
      if (replaced) {
        setConversationChartDetail(replaced);
        onChartReplacedRef.current?.(replaced);
      } else {
        setConversationChartDetail(null);
      }
    },
    [],
  );

  const loadConversationMessagesForId = useCallback(
    async (conversationId: string, openedFromHistory = false) => {
      const original = originalChartRef.current ?? chartRef.current;
      const trimmed = conversationId.trim();
      if (!trimmed || !original?.chart_id?.trim()) return;
      setHistoryActionLoading(true);
      try {
        const { messages: msgs, conversation_id: responseConvId } =
          await fetchConversationMessagesWithMeta(trimmed);
        applyFetchedMessages(msgs, responseConvId ?? trimmed, original);
        if (openedFromHistory) setThreadOpenedFromHistory(true);
      } catch (error) {
        toast.error(getDisplayErrorMessage(error, 'Could not load this conversation’s messages'));
      } finally {
        setHistoryActionLoading(false);
      }
    },
    [applyFetchedMessages],
  );

  /** History: chart-scoped (default) or domain-wide when `domainScopedConversationHistory`. */
  const refreshHistoryList = useCallback(async () => {
    const original = originalChartRef.current ?? chart;
    const linkedIds =
      original?.conversation_ids?.filter((id) => typeof id === 'string' && id.trim() !== '') ?? [];
    setHistoryListLoading(true);
    try {
      if (domainScopedConversationHistory) {
        if (!tenantId?.trim() || !domainId?.trim()) {
          setHistoryListItems([]);
          return;
        }
        const domainList = await fetchDomainConversations(tenantId, domainId);
        setHistoryListItems(mergeConversationLists(domainList, [], linkedIds));
      } else {
        const targetChartId = original?.chart_id;
        if (!targetChartId?.trim()) return;
        const chartList = await fetchChartConversationsList(targetChartId);
        setHistoryListItems(mergeConversationLists([], chartList, linkedIds));
      }
    } catch (error) {
      toast.error(getDisplayErrorMessage(error, 'Could not load conversations'));
      setHistoryListItems([]);
    } finally {
      setHistoryListLoading(false);
    }
  }, [
    domainScopedConversationHistory,
    tenantId,
    domainId,
    chart,
    linkedConversationIdsKey,
  ]);

  const onPickHistoryConversation = useCallback(
    async (conversationId: string) => {
      setSidePanel('closed');
      await loadConversationMessagesForId(conversationId, true);
    },
    [loadConversationMessagesForId],
  );

  /**
   * New session when tenant/domain/stable chart slot changes. Do not restore a prior thread from storage —
   * that avoided surprising the dashboard with stale GET /messages + chart overrides on open.
   * Deps must NOT use `chart.chart_id` alone — it changes when the assistant replaces the chart.
   */
  useEffect(() => {
    if (chart && !originalChartRef.current) {
      originalChartRef.current = chart;
    }
  }, [chart]);

  useEffect(() => {
    if (!storageChartId || !tenantId || !domainId) return;
    writeStoredChartConversationId(tenantId, domainId, storageChartId, null);
    originalChartRef.current = chartRef.current;
    setHintQuery(null);
    setCognitoConversationId(null);
    setCognitoMessages([]);
    setConversationChartDetail(null);
    setHistoryListItems([]);
    setHistorySearchQuery('');
    setSidePanel('closed');
    setThreadOpenedFromHistory(false);
    setPendingUserMessage(null);
  }, [storageChartId, tenantId, domainId]);

  /** Thread open from History or Send — includes text-only history with no assistant chart in messages. */
  const hasActiveConversationThread =
    Boolean(cognitoConversationId) || cognitoMessages.length > 0 || cognitoSending;
  const originalChart = originalChartRef.current ?? chart;
  /** Drill/filter applied: show embedded exploration chart when there is no thread yet. */
  const explorationShowsDashboardActions =
    drilldownUi != null && chartActionsIndicateExploration(drilldownUi.actions);

  const handleClose = useCallback(() => {
    setHintQuery(null);
    setPendingUserMessage(null);
    setThreadOpenedFromHistory(false);
    setHistorySearchQuery('');
    setSidePanel('closed');
    onClose();
  }, [onClose]);

  /** Leave a thread opened from History and return to the default panel (hints / new message). */
  const handleBackFromHistoryThread = useCallback(() => {
    if (storageChartId) {
      writeStoredChartConversationId(tenantId, domainId, storageChartId, null);
    }
    setCognitoConversationId(null);
    setCognitoMessages([]);
    setConversationChartDetail(null);
    setHintQuery(null);
    setPendingUserMessage(null);
    setThreadOpenedFromHistory(false);
  }, [tenantId, domainId, storageChartId]);

  const sendWorkspaceMessage = useCallback(
    async (queryText: string) => {
      const q = queryText.trim();
      if (!q || cognitoSending) return;
      if (!tenantId || !domainId) {
        toast.error('Missing tenant or domain');
        return;
      }
      const activeChart = originalChartRef.current ?? chart;
      if (!activeChart) return;
      const previous = {
        conversationId: cognitoConversationId,
        messages: cognitoMessages,
        chartDetail: conversationChartDetail,
      };
      setPendingUserMessage(q);
      setCognitoSending(true);
      try {
        let convId = cognitoConversationId?.trim() || null;
        if (convId) setCognitoConversationId(convId);

        /** First user send with no conversation yet → false; follow-ups → true. */
        const resumeContext = Boolean(convId) || cognitoMessages.length > 0;

        if (!convId) {
          const created = await createWorkspaceConversation(tenantId, domainId, {
            run_id: runId ?? null,
            source_chart_id: activeChart.chart_id,
          });
          convId =
            created.conversation_id ??
            (created as { id?: string }).id ??
            (created as { conversationId?: string }).conversationId ??
            null;
          if (!convId) {
            toast.error('Your request failed', {
              description: 'No conversation id returned from the server.',
            });
            setCognitoSending(false);
            setPendingUserMessage(null);
            return;
          }
          setCognitoConversationId(convId);
        }
        const { messages: msgs, conversation_id: responseConvId } =
          await postWorkspaceConversationMessagesList(convId, q, {
            chart_id: activeChart.chart_id,
            resume_context: resumeContext,
          });
        const finalConvId = (responseConvId ?? convId).trim();
        setCognitoConversationId(finalConvId);
        const mergedMsgs = mergeWorkspaceMessagesAfterSend(cognitoMessages, msgs, q);
        setCognitoMessages(mergedMsgs);
        const replaced = applyLatestAssistantChartToOverrides(mergedMsgs, activeChart);
        if (replaced) {
          setConversationChartDetail(replaced);
          onChartReplaced?.(replaced);
        }
        toast.success(resumeContext ? 'Message sent' : 'Conversation started');
      } catch (err: unknown) {
        const description = getDisplayErrorMessage(
          err,
          'Something went wrong. Your message and chart were not changed.',
        );
        setCognitoConversationId(previous.conversationId);
        setCognitoMessages(previous.messages);
        setConversationChartDetail(previous.chartDetail);
        toast.error('Your request failed', { description });
        throw err;
      } finally {
        setCognitoSending(false);
        setPendingUserMessage(null);
      }
    },
    [
      cognitoSending,
      tenantId,
      domainId,
      cognitoConversationId,
      cognitoMessages,
      conversationChartDetail,
      chart,
      runId,
      onChartReplaced,
      onChartCommitted,
    ],
  );

  const handleComposerSend = useCallback(
    async (queryText: string) => {
      try {
        await sendWorkspaceMessage(queryText);
      } catch {
        setHintQuery(queryText);
      }
    },
    [sendWorkspaceMessage],
  );

  const handleHintQueryConsumed = useCallback(() => {
    setHintQuery(null);
  }, []);

  const filteredHistoryListItems = useMemo(() => {
    const q = historySearchQuery.trim().toLowerCase();
    if (!q) return historyListItems;
    return historyListItems.filter((c) => {
      const label = conversationRowLabel(c).toLowerCase();
      const id = String(c.conversation_id ?? '').toLowerCase();
      return label.includes(q) || id.includes(q);
    });
  }, [historyListItems, historySearchQuery]);

  if (!chart) return null;

  const showEmptyHints = !cognitoConversationId && cognitoMessages.length === 0;

  const shouldShowEmptyHints = showEmptyHints && !explorationShowsDashboardActions;

  const mainScrollContent = (
    <WorkspaceConversationThread
      tenantId={tenantId}
      domainId={domainId}
      currentUserEmail={currentUserEmail}
      currentUserName={currentUserName}
      baseChart={originalChart}
      originalChart={originalChart}
      messages={cognitoMessages}
      drilldownUi={drilldownUi}
      drilldownScopeKey={drilldownScopeKey}
      showOriginalChart={!hideEmptyStateChartPreview || hasActiveConversationThread}
      isAssistantPending={cognitoSending}
      pendingUserText={pendingUserMessage}
      currentDashboardId={currentDashboardId}
      onAddToCurrentDashboard={
        onChartCommitted
          ? async (detail, title) => {
            await onChartCommitted(detail, title);
          }
          : undefined
      }
      showEmptyHints={shouldShowEmptyHints}
      isDataQualityDashboard={isDataQualityDashboard}
      onPickHint={setHintQuery}
    />
  );

  const historyPanelBody = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 px-2 pb-2 pt-1">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 shrink-0 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            placeholder="Search chats"
            value={historySearchQuery}
            onChange={(e) => setHistorySearchQuery(e.target.value)}
            className="h-9 w-full rounded-lg border-0 bg-muted/30 py-2.5 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {historyListLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
            <Loader2 className="size-5 shrink-0 animate-spin" aria-hidden />
            <span>Loading…</span>
          </div>
        ) : historyListItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <MessageSquare className="size-8 text-muted-foreground" aria-hidden />
            <p className="text-xs text-muted-foreground">No conversations yet</p>
            <p className="text-[11px] text-muted-foreground/90">Send a message below to create one.</p>
          </div>
        ) : filteredHistoryListItems.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-xs text-muted-foreground">No chats match your search</p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {filteredHistoryListItems.map((c) => {
              const id = c.conversation_id;
              return (
                <li key={id}>
                  <button
                    type="button"
                    className={cn(
                      'w-full rounded-lg p-2.5 text-left transition-colors',
                      'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    )}
                    onClick={() => void onPickHistoryConversation(id)}
                  >
                    <div className="flex items-start gap-2">
                      <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">
                          {conversationRowLabel(c)}
                        </div>
                        {(c.updated_at || c.created_at) && (
                          <div className="truncate text-xs text-muted-foreground">
                            {formatHistoryDate(c.updated_at ?? c.created_at)}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <Sheet open onOpenChange={(open) => !open && handleClose()}>
      <SheetContent
        side="right"
        className="flex h-full min-h-0 w-[90vw] min-w-0 max-w-none flex-col gap-0 overflow-visible rounded-l-xl border-border/80 p-0 shadow-2xl"
      >
        <div className="relative shrink-0 overflow-hidden rounded-tl-xl border-b border-border/60 bg-background px-3 pb-1 pt-3">
          <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-primary/15 blur-2xl" />
          <div className="relative flex flex-wrap items-start gap-2">
            <div className="flex min-w-0 flex-1 gap-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 shadow-sm">
                <Sparkles className="size-4 text-primary" aria-hidden />
              </div>
              <div className="min-w-0 flex-1 pt-0">
                <SheetTitle
                  id="workspace-chart-chat-panel-title"
                  className="text-sm font-semibold tracking-tight"
                >
                  {chatHeaderTitle ?? 'Ask about this chart'}
                </SheetTitle>
                <SheetDescription className="mt-0.5 flex flex-col gap-1 text-muted-foreground text-xs">
                  <span className="flex items-center gap-1 truncate">
                    <BarChart3 className="size-3 shrink-0 opacity-70" aria-hidden />
                    <span className="truncate text-xs text-foreground">
                      {chatHeaderContext ?? chart.title ?? chart.metric_name}
                    </span>
                  </span>
                </SheetDescription>
              </div>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              {threadOpenedFromHistory ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="!h-8 shrink-0 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={handleBackFromHistoryThread}
                  aria-label="Back to new chat"
                >
                  <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
                  <span className="hidden sm:inline">Back</span>
                </Button>
              ) : null}
              <Button
                type="button"
                variant={sidePanel === 'history' ? 'secondary' : 'outline'}
                size="sm"
                className="!h-8 gap-1 !px-2 text-xs"
                disabled={historyActionLoading}
                onClick={() => {
                  if (sidePanel !== 'history') void refreshHistoryList();
                  setSidePanel((p) => (p === 'history' ? 'closed' : 'history'));
                }}
                aria-pressed={sidePanel === 'history'}
                aria-label="Conversation history"
              >
                {historyActionLoading ? (
                  <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <History className="size-3.5 shrink-0" aria-hidden />
                )}
                <span className="hidden sm:inline">History</span>
              </Button>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div
              className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden scroll-smooth px-3 py-3"
              ref={cognitoMessagesScrollRef}
            >
              {mainScrollContent}
            </div>
          </div>

          {sidePanel === 'history' ? (
            <aside
              className="flex w-[min(20rem,42vw)] shrink-0 flex-col border-l border-border bg-muted/15"
              aria-label="Conversation history"
            >
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-background/80 px-2 py-1.5">
                <span className="truncate px-1 text-sm font-medium text-foreground">Conversations</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  aria-label="Close side panel"
                  onClick={() => setSidePanel('closed')}
                >
                  <X className="size-4" />
                </Button>
              </div>
              {historyPanelBody}
            </aside>
          ) : null}
        </div>

        <WorkspaceChartChatComposer
          queryId={queryId}
          placeholder={
            chatComposerPlaceholder ?? "Ask anything about this chart's data..."
          }
          disabled={cognitoSending}
          onSend={handleComposerSend}
          externalQuery={hintQuery}
          onExternalQueryConsumed={handleHintQueryConsumed}
        />
      </SheetContent>
    </Sheet>
  );
}
