import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  PanelRight,
  PanelRightClose,
  RefreshCw,
  Rocket,
  Search,
  SquarePen,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  fetchDomainConversations,
  fetchWorkspaceDeployments,
  rerunWorkspaceDeployment,
  deleteWorkspaceConversation,
  type WorkspaceConversationItem,
  type WorkspaceDeploymentItem,
} from '@/controllers/API/semanticsApi';
import AgenticChatHistory from './AgenticChatHistory';
import type { TenantInfo } from './index';
import type { WorkspaceDomainItem } from '@/controllers/API/semanticsApi';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';

interface DomainConversationsProps {
  tenant: TenantInfo;
  domain: WorkspaceDomainItem;
  onBack: () => void;
  onSelectConversation: (conversationId: string) => void;
}

function formatDate(s: string | null | undefined): string {
  if (!s) return '';
  try {
    const d = new Date(s);
    return d.toLocaleDateString(undefined, { dateStyle: 'short' }) + ' ' + d.toLocaleTimeString(undefined, { timeStyle: 'short' });
  } catch (error) {
    return String(s);
  }
}

/** "Today 12:54 PM" / "Yesterday …" / short date — matches deployment run list reference. */
function formatRunWhen(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = new Date();
    const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diffDays = Math.round((day(d) - day(now)) / 86400000);
    const timeStr = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    if (diffDays === 0) return `Today ${timeStr}`;
    if (diffDays === -1) return `Yesterday ${timeStr}`;
    return (
      d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
      ' ' +
      d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    );
  } catch {
    return formatDate(iso);
  }
}

function formatDurationShort(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
}

type RunUiStatus = 'running' | 'completed' | 'failed' | 'neutral';

function deploymentUiStatus(status: string): RunUiStatus {
  const s = status.toLowerCase();
  if (s.includes('fail') || s.includes('error')) return 'failed';
  if (
    s.includes('complete') ||
    s.includes('success') ||
    s === 'done' ||
    s === 'finished' ||
    s === 'succeeded'
  ) {
    return 'completed';
  }
  if (
    s.includes('running') ||
    s.includes('pending') ||
    s.includes('progress') ||
    s === 'queued' ||
    s === 'in_progress'
  ) {
    return 'running';
  }
  return 'neutral';
}

function readNumber(...vals: unknown[]): number | undefined {
  for (const v of vals) {
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
    }
  }
  return undefined;
}

function deploymentExtras(d: WorkspaceDeploymentItem) {
  const o = d as Record<string, unknown>;
  return {
    agentsTotal: readNumber(o.agent_count, o.agents_total, o.total_agents, o.n_agents),
    agentsDone: readNumber(o.agents_completed, o.completed_agents, o.agents_succeeded),
    warnings: readNumber(o.warning_count, o.warnings, o.warning_total),
    durationSec: readNumber(o.duration_seconds, o.duration_secs, o.elapsed_seconds),
  };
}

function effectiveDurationSeconds(d: WorkspaceDeploymentItem, durationSec?: number): number | undefined {
  if (durationSec != null && durationSec >= 0) return durationSec;
  const end = d.completed_at ?? d.updated_at;
  if (!end || !d.created_at) return undefined;
  const sec = (new Date(end).getTime() - new Date(d.created_at).getTime()) / 1000;
  return sec >= 0 ? sec : undefined;
}

function runTitle(d: WorkspaceDeploymentItem): string {
  const name = d.display_name?.trim();
  if (name) return name;
  if (d.version_no != null && Number.isFinite(d.version_no)) return `Deployment v${d.version_no}`;
  return d.run_id;
}

function progressBarPercent(ui: RunUiStatus): number {
  if (ui === 'completed') return 100;
  if (ui === 'failed') return 32;
  if (ui === 'running') return 48;
  return 12;
}

/** Aligns with workspace chat: canonical run first if present, otherwise newest by activity. */
function orderedDeploymentsForDomain(deployments: WorkspaceDeploymentItem[]): WorkspaceDeploymentItem[] {
  if (!deployments.length) return [];
  const byDateDesc = (a: WorkspaceDeploymentItem, b: WorkspaceDeploymentItem) =>
    new Date(b.updated_at ?? b.created_at).getTime() - new Date(a.updated_at ?? a.created_at).getTime();
  const canonical = deployments.find((d) => d.is_canonical);
  if (canonical) {
    const others = deployments.filter((d) => d.run_id !== canonical.run_id).sort(byDateDesc);
    return [canonical, ...others];
  }
  return [...deployments].sort(byDateDesc);
}

export default function DomainConversations({
  tenant,
  domain,
  onBack,
  onSelectConversation,
}: DomainConversationsProps) {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<WorkspaceConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  /** Right sidebar: collapsed initially (ChatGPT-style), expand to show conversation list */
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deployments, setDeployments] = useState<WorkspaceDeploymentItem[]>([]);
  const [deploymentsLoading, setDeploymentsLoading] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<WorkspaceDeploymentItem | null>(null);
  const [rerunningRunId, setRerunningRunId] = useState<string | null>(null);
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
  const [conversationToDelete, setConversationToDelete] = useState<{
    id: string;
    label: string;
  } | null>(null);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const list = await fetchDomainConversations(tenant.tenantId, domain.domain_id);
      setConversations(list ?? []);
    } catch {
      setError(true);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [tenant.tenantId, domain.domain_id]);

  const initialFetchDone = useRef(false);
  useEffect(() => {
    if (initialFetchDone.current) return;
    initialFetchDone.current = true;
    loadConversations();
  }, [loadConversations]);

  const loadDeployments = useCallback(
    async (opts?: { silent?: boolean }): Promise<WorkspaceDeploymentItem[]> => {
      const silent = opts?.silent === true;
      if (!silent) setDeploymentsLoading(true);
      try {
        const res = await fetchWorkspaceDeployments(tenant.tenantId, domain.domain_id, 50);
        const list = res.deployments ?? [];
        setDeployments(list);
        return list;
      } catch {
        setDeployments([]);
        return [];
      } finally {
        if (!silent) setDeploymentsLoading(false);
      }
    },
    [tenant.tenantId, domain.domain_id]
  );

  // Call deployment API only once when landing on this page (after domain click)
  const deploymentsFetchedRef = useRef(false);
  useEffect(() => {
    if (deploymentsFetchedRef.current) return;
    deploymentsFetchedRef.current = true;
    void loadDeployments();
  }, [loadDeployments]);

  const orderedDeployments = useMemo(() => orderedDeploymentsForDomain(deployments), [deployments]);

  // Default to first ordered run (canonical or latest); recover if current run disappears after refresh
  useEffect(() => {
    if (deploymentsLoading || orderedDeployments.length === 0) return;
    setSelectedDeployment((prev) => {
      if (!prev) return orderedDeployments[0];
      const stillThere = orderedDeployments.some((d) => d.run_id === prev.run_id);
      return stillThere ? prev : orderedDeployments[0];
    });
  }, [deploymentsLoading, orderedDeployments]);

  /** Background refresh only — must not set `deploymentsLoading` or the chat panel unmounts and retriggers terminal → infinite loop. */
  const handleDeploymentPipelineTerminal = useCallback(() => {
    void loadDeployments({ silent: true });
  }, [loadDeployments]);

  const handleRerunDeployment = useCallback(async () => {
    if (!selectedDeployment) return;
    const runId = selectedDeployment.run_id;
    setRerunningRunId(runId);
    try {
      const data = await rerunWorkspaceDeployment(runId);
      toast.success('Rerun started');
      const list = await loadDeployments({ silent: true });
      const nextRunId = typeof data?.run_id === 'string' ? data.run_id : null;
      if (nextRunId) {
        const next = list.find((d) => d.run_id === nextRunId);
        if (next) setSelectedDeployment(next);
      }
    } catch {
      toast.error(getDisplayErrorMessage(error, 'Could not rerun deployment'));
    } finally {
      setRerunningRunId(null);
    }
  }, [selectedDeployment, loadDeployments]);

  const domainLabel = domain.display_name ?? domain.domain_id;

  const filteredConversations = searchQuery.trim()
    ? conversations.filter(
        (c) =>
          (c.title ?? '')
            .toLowerCase()
            .includes(searchQuery.trim().toLowerCase()) ||
          (c.display_name ?? '')
            .toLowerCase()
            .includes(searchQuery.trim().toLowerCase())
      )
    : conversations;

  const handleDeleteConversation = useCallback(async (conversationId: string) => {
    setDeletingConversationId(conversationId);
    // Optimistic remove to keep list snappy
    setConversations((prev) => prev.filter((c) => c.conversation_id !== conversationId));
    try {
      await deleteWorkspaceConversation(conversationId);
      toast.success('Conversation deleted');
    } catch (error) {
      toast.error(getDisplayErrorMessage(error, 'Failed to delete conversation'));
      await loadConversations();
    } finally {
      setDeletingConversationId((cur) => (cur === conversationId ? null : cur));
    }
  }, [loadConversations]);

  return (
    <div className="flex flex-col h-full min-h-0 w-full">
      <div className="sticky top-0 z-10 flex items-center gap-3 px-1 py-1 border-b bg-background shrink-0">
        <Button variant="ghost" size="sm" className="h-9 w-9 p-0 shrink-0 rounded-lg" onClick={onBack} title="Back to domains">
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold tracking-tight text-foreground truncate">{domainLabel}</h1>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{tenant.displayName}</p>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 min-w-0">
        {/* Main content: deployments / chat history */}
        <div className="flex flex-col flex-1 min-h-0 min-w-0 bg-muted/20">
          {conversationToDelete && (
            <div
              role="status"
              className="shrink-0 z-20 flex items-center justify-between gap-3 px-3 py-2 border-b border-destructive/20 bg-destructive/5"
            >
              <p className="text-xs text-foreground min-w-0">
                Delete <span className="font-medium">{conversationToDelete.label}</span>? This cannot be undone.
              </p>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="!h-7 text-xs px-2"
                  disabled={!!deletingConversationId}
                  onClick={() => setConversationToDelete(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="!h-7 text-xs px-2"
                  disabled={!!deletingConversationId || !conversationToDelete}
                  onClick={async () => {
                    if (!conversationToDelete) return;
                    const id = conversationToDelete.id;
                    setConversationToDelete(null);
                    await handleDeleteConversation(id);
                  }}
                >
                  {deletingConversationId ? <Loader2 className="size-3.5 animate-spin" /> : 'Delete'}
                </Button>
              </div>
            </div>
          )}
          {deploymentsLoading ? (
            <div className="flex flex-1 flex-col items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Loading deployments for {tenant.displayName} · {domainLabel}...</p>
            </div>
          ) : deployments.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-full border border-border bg-background">
                <Rocket className="size-5 text-muted-foreground" aria-hidden />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">No deployment runs yet</p>
                <p className="text-xs text-muted-foreground">
                  {tenant.displayName} · {domainLabel}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 min-w-0">
              <aside
                className="flex w-[min(260px,34vw)] min-w-[196px] max-w-[300px] shrink-0 flex-col border-r border-border bg-background"
                aria-label="Deployment runs"
              >
                <div className="shrink-0 px-3 pb-2 pt-3">
                  <p className="text-xs font-medium uppercase tracking-wide">Runs</p>
                </div>
                <Separator className="shrink-0" />
                <ScrollArea className="min-h-0 flex-1">
                  <ul className="space-y-3 p-2 pb-4" role="list">
                    {orderedDeployments.map((d) => {
                      const isSelected = selectedDeployment?.run_id === d.run_id;
                      const ui = deploymentUiStatus(d.status);
                      const extras = deploymentExtras(d);
                      const dur = effectiveDurationSeconds(d, extras.durationSec);
                      const pct = progressBarPercent(ui);
                      const fillClass = cn(
                        'h-full rounded-full',
                        ui === 'failed' && 'bg-destructive',
                        ui === 'neutral' && 'bg-muted-foreground/45',
                        (ui === 'running' || ui === 'completed') && 'bg-green-600',
                        ui === 'running' && 'animate-pulse'
                      );
                      const agentLabel =
                        extras.agentsTotal != null
                          ? extras.agentsDone != null &&
                            extras.agentsDone < extras.agentsTotal
                            ? `${extras.agentsDone}/${extras.agentsTotal} agents`
                            : `${extras.agentsTotal} agents`
                          : null;
                      const showWarnings = extras.warnings != null && extras.warnings > 0;

                      return (
                        <li key={d.run_id}>
                          <button
                            type="button"
                            aria-current={isSelected ? 'true' : undefined}
                            onClick={() => setSelectedDeployment(d)}
                            className={cn(
                              'w-full rounded-xl border p-3 text-left shadow-sm transition-colors',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                              isSelected
                                ? 'border-primary/40 bg-primary/10 ring-1 ring-primary/15'
                                : 'border-border bg-muted/25 hover:bg-muted/40'
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="line-clamp-2 text-xs font-semibold leading-snug text-foreground">
                                {runTitle(d)}
                              </span>
                              <div className="flex shrink-0 flex-col items-end gap-1">
                                {ui === 'running' ? (
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium capitalize text-primary">
                                    <span
                                      className="size-1.5 shrink-0 rounded-full bg-primary"
                                      aria-hidden
                                    />
                                    {d.status.toLowerCase()}
                                  </span>
                                ) : ui === 'failed' ? (
                                  <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium capitalize text-destructive">
                                    {d.status.toLowerCase()}
                                  </span>
                                ) : ui === 'completed' ? (
                                  <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium capitalize text-green-800">
                                    {d.status.toLowerCase()}
                                  </span>
                                ) : (
                                  <Badge variant="outline" className="px-2 py-0 text-[10px] font-normal capitalize">
                                    {d.status}
                                  </Badge>
                                )}
                                {d.is_canonical ? (
                                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    Active
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                              <span className='text-xs'>{formatRunWhen(d.created_at)}</span>
                              {agentLabel ? (
                                <>
                                  <span className="text-border" aria-hidden>
                                    ·
                                  </span>
                                  <span className='text-xs'>{agentLabel}</span>
                                </>
                              ) : null}
                              {showWarnings ? (
                                <>
                                  <span className="text-border" aria-hidden>
                                    ·
                                  </span>
                                  <span className="inline-flex items-center gap-0.5 tabular-nums">
                                    <AlertTriangle className="size-3.5 shrink-0 text-foreground/70" aria-hidden />
                                    {extras.warnings}
                                  </span>
                                </>
                              ) : null}
                              {dur != null ? (
                                <>
                                  <span className="text-border" aria-hidden>
                                    ·
                                  </span>
                                  <span className="tabular-nums">{formatDurationShort(dur)}</span>
                                </>
                              ) : null}
                            </div>

                            <div
                              className="mt-3 h-1 w-full overflow-hidden rounded-full bg-muted"
                              aria-hidden
                            >
                              <div className={fillClass} style={{ width: `${pct}%` }} />
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </ScrollArea>
              </aside>

              <section className="flex min-w-0 flex-1 flex-col bg-card/40">
                {selectedDeployment ? (
                  <>
                    <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {selectedDeployment.display_name?.trim() || selectedDeployment.run_id}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatDate(selectedDeployment.created_at)} · <span className="font-mono">{selectedDeployment.run_id}</span>
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 gap-2"
                        disabled={!!rerunningRunId}
                        onClick={handleRerunDeployment}
                        title="Rerun this deployment with monitor trend mode"
                      >
                        {rerunningRunId === selectedDeployment.run_id ? (
                          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                        ) : (
                          <RefreshCw className="size-4 shrink-0" aria-hidden />
                        )}
                        Rerun
                      </Button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-hidden">
                      <AgenticChatHistory
                        runId={selectedDeployment.run_id}
                        fetchFromApi
                        tenantId={tenant.tenantId}
                        domainId={domain.domain_id}
                        deploymentStatus={domain.deployment_status}
                        tenantName={tenant.displayName}
                        domainName={domain.display_name ?? domain.domain_id}
                        onPipelineTerminal={handleDeploymentPipelineTerminal}
                      />
                    </div>
                  </>
                ) : (
                  <div className="flex flex-1 items-center justify-center px-4 py-12 text-sm text-muted-foreground">
                    Loading run…
                  </div>
                )}
              </section>
            </div>
          )}
        </div>

        {/* Right sidebar: ChatGPT-style, collapsed initially */}
        <div
          className={cn(
            'flex flex-col border-l border-border/60 bg-background shrink-0 transition-[width] duration-200 ease-out overflow-hidden',
            sidebarExpanded ? 'w-[280px]' : 'w-12'
          )}
        >
          {sidebarExpanded ? (
            <>
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/50 shrink-0">
                <span className="text-sm font-medium text-foreground">Conversations</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="!h-8 w-8 p-0 shrink-0 rounded-lg"
                  onClick={() => setSidebarExpanded(false)}
                  title="Collapse sidebar"
                >
                  <PanelRightClose className="size-4" />
                </Button>
              </div>
              <div className="flex-1 min-h-0 overflow-auto p-3 flex flex-col">
                {/* New chat + Search chats (ChatGPT-style top actions) */}
                <div className="space-y-0.5 shrink-0 mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/exploratory-analysis/agentic-run/create', {
                        state: {
                          tenantId: tenant.tenantId,
                          tenantName: tenant.displayName,
                          domainId: domain.domain_id,
                          domainName: domain.display_name ?? domain.domain_id,
                        },
                      });
                    }}
                    className=" !h-8 w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-muted/50 focus:bg-muted/50 focus:outline-none"
                  >
                    <SquarePen className="size-4 text-foreground shrink-0" />
                    <span className="text-sm font-medium text-foreground">New chat</span>
                  </button>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground shrink-0 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search chats"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className=" !h-8 w-full pl-9 pr-3 py-2.5 rounded-lg text-sm bg-muted/30 border-0 focus:ring-2 focus:ring-ring focus:outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                </div>
                {loading && (
                  <div className="flex flex-col items-center justify-center py-4">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    <p className="mt-2 text-xs text-muted-foreground">Loading...</p>
                  </div>
                )}
                {!loading && error && (
                  <div className="flex flex-col items-center justify-center py-4 gap-2">
                    <p className="text-xs text-muted-foreground text-center">Failed to load</p>
                    <Button variant="outline" size="sm" className="text-xs" onClick={loadConversations}>
                      Retry
                    </Button>
                  </div>
                )}
                {!loading && !error && (
                  <div className="space-y-1 min-h-0 flex flex-col">
                    {conversations.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
                        <MessageSquare className="size-8 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">No conversations yet</p>
                      </div>
                    ) : filteredConversations.length === 0 ? (
                      <div className="py-4 text-center">
                        <p className="text-xs text-muted-foreground">No chats match your search</p>
                      </div>
                    ) : (
                      <ul className="space-y-0.5 flex-1 min-h-0 overflow-auto">
                        {filteredConversations.map((conv) => (
                          <li key={conv.conversation_id}>
                            <div
                              className={cn(
                                'w-full flex items-center gap-1 rounded-lg transition-colors',
                                'hover:bg-muted/50 focus-within:bg-muted/50',
                              )}
                            >
                              <button
                                type="button"
                                onClick={() => onSelectConversation(conv.conversation_id)}
                                className={cn(
                                  'flex-1 min-w-0 flex items-center gap-2 p-2.5 rounded-lg text-left focus:outline-none',
                                )}
                              >
                                <MessageSquare className="size-3.5 text-muted-foreground shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-xs truncate">
                                    {conv.title ?? conv.display_name ?? 'Conversation'}
                                  </div>
                                  {conv.updated_at && (
                                    <div className="text-xs text-muted-foreground truncate">
                                      {formatDate(conv.updated_at)}
                                    </div>
                                  )}
                                </div>
                              </button>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
                                    title="Conversation options"
                                    onClick={(e) => e.stopPropagation()}
                                    disabled={deletingConversationId === conv.conversation_id}
                                  >
                                    <MoreHorizontal className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onSelect={(e) => {
                                      e.preventDefault();
                                      const label = conv?.title ?? conv?.display_name ?? conv.conversation_id;
                                      setConversationToDelete({ id: conv.conversation_id, label });
                                    }}
                                    disabled={deletingConversationId === conv.conversation_id}
                                  >
                                    <Trash2 className="size-4 mr-2 text-destructive" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-12 w-12 p-0 rounded-none shrink-0 border-0"
              onClick={() => setSidebarExpanded(true)}
              title="Show conversations"
            >
              <PanelRight className="size-5 text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
