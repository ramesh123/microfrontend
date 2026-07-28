import { useCallback, useEffect, useId, useState, type MouseEvent } from 'react';
import { Link2, Loader2, Pencil, PlusCircle, Send, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiV2 } from '@/controllers/API/api';
import {
  addChartToDashboard,
  deleteDashboard,
  extractDashboardIdFromCreateResponse,
  extractDashboardIdFromLocationHeader,
  fetchDashboards,
  fetchDashboardsSlash,
  updateDashboardTitles,
  type ChartActionsResponse,
  type DashboardItem,
} from '@/controllers/API/agenticApi';
import { toast } from 'sonner';
import type { ChartDetail } from './chartTypes';
import { useAuth } from '@/context/auth/authContext';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';

function mergeDashboardLists(a: DashboardItem[], b: DashboardItem[]): DashboardItem[] {
  const seen = new Set<string>();
  const out: DashboardItem[] = [];
  for (const d of a) {
    const id = d.dashboard_id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(d);
  }
  for (const d of b) {
    const id = d.dashboard_id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(d);
  }
  return out;
}

export interface WorkspaceDashboardChartActionsProps {
  tenantId: string;
  domainId: string;
  chart: ChartDetail;
  /**
   * When the user adds to this dashboard id, use {@link onAddToCurrentDashboard}
   * instead of the default attach API (e.g. parent appends last and refreshes).
   */
  currentDashboardId?: string;
  onAddToCurrentDashboard?: (detail: ChartDetail, title?: string) => Promise<void>;
  /** Called after a successful create / update / add (e.g. close sidebar). */
  onActionComplete?: () => void;
  currentUserEmail?: string;
  currentUserName?: string;
  /** Compact layout for inline use under chat messages */
  compact?: boolean;
}

/** True when chart_id looks like a server-persisted id (not a client placeholder). */
export function chartDetailHasLinkableChartId(chart: ChartDetail): boolean {
  const id = chart.chart_id?.trim();
  if (!id) return false;
  return !id.startsWith('workspace-msg-');
}

/**
 * True after drill or filter changed the view (GET /charts/…/actions lineage or breadcrumb).
 * Used to show dashboard link actions in the workspace sidebar without a chat thread.
 */
export function chartActionsIndicateExploration(
  actions: ChartActionsResponse | null | undefined,
): boolean {
  if (!actions) return false;
  const depth = actions.lineage_summary?.depth ?? 0;
  if (depth > 0) return true;
  const crumbs = actions.breadcrumb ?? [];
  if (crumbs.length > 1) return true;
  if (crumbs.length === 1) {
    const fa = crumbs[0]?.filters_added;
    if (Array.isArray(fa) && fa.length > 0) return true;
  }
  const ls = actions.lineage_summary;
  if (
    ls?.current_chart_id &&
    ls?.root_chart_id &&
    String(ls.current_chart_id) !== String(ls.root_chart_id)
  ) {
    return true;
  }
  return false;
}

export function WorkspaceDashboardChartActions({
  tenantId,
  domainId,
  chart,
  currentDashboardId,
  onAddToCurrentDashboard,
  onActionComplete,
  currentUserEmail,
  currentUserName,
  compact = false,
}: WorkspaceDashboardChartActionsProps) {
  const queryId = useId();
  const auth = useAuth();
  const canLink = chartDetailHasLinkableChartId(chart);

  const [selectedAction, setSelectedAction] = useState<'create' | 'replace' | 'add' | null>(null);
  const [newDashboardName, setNewDashboardName] = useState('');
  const [createIncludeDescription, setCreateIncludeDescription] = useState(false);
  const [newDashboardDescription, setNewDashboardDescription] = useState('');
  const [isCreatingDashboard, setIsCreatingDashboard] = useState(false);
  const [replaceDashboards, setReplaceDashboards] = useState<DashboardItem[]>([]);
  const [replaceDashboardsLoading, setReplaceDashboardsLoading] = useState(false);
  const [selectedReplaceDashboardId, setSelectedReplaceDashboardId] = useState<string | null>(null);
  const [updateDashboardTitle, setUpdateDashboardTitle] = useState('');
  const [updateChartTitle, setUpdateChartTitle] = useState('');
  const [isUpdatingDashboard, setIsUpdatingDashboard] = useState(false);
  const [deletingDashboardId, setDeletingDashboardId] = useState<string | null>(null);
  const [selectedAddDashboardId, setSelectedAddDashboardId] = useState<string | null>(null);
  const [customChartTitle, setCustomChartTitle] = useState('');
  const [isAddingChartToDashboard, setIsAddingChartToDashboard] = useState(false);

  const panelChartDetail = chart;

  useEffect(() => {
    const loadForPicker = selectedAction === 'replace' || selectedAction === 'add';
    if (!loadForPicker || !tenantId) return;
    let cancelled = false;
    setReplaceDashboardsLoading(true);
    (async () => {
      try {
        const [r1, r2] = await Promise.allSettled([
          fetchDashboards(tenantId),
          fetchDashboardsSlash(tenantId),
        ]);
        const list1 = r1.status === 'fulfilled' ? (r1.value.dashboards ?? []) : [];
        const list2 = r2.status === 'fulfilled' ? (r2.value.dashboards ?? []) : [];
        if (cancelled) return;
        setReplaceDashboards(mergeDashboardLists(list1, list2));
      } catch (error) {
        if (!cancelled) toast.error(getDisplayErrorMessage(error, 'Failed to load dashboards'));
      } finally {
        if (!cancelled) setReplaceDashboardsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedAction, tenantId]);

  useEffect(() => {
    if (!panelChartDetail) return;
    if (selectedAction === 'replace') {
      setUpdateChartTitle(
        (panelChartDetail.title ?? panelChartDetail.metric_name ?? '').trim() || 'Chart',
      );
    }
    if (selectedAction === 'add') {
      setCustomChartTitle(
        (panelChartDetail.title ?? panelChartDetail.metric_name ?? '').trim() || 'Chart',
      );
    }
  }, [selectedAction, panelChartDetail?.chart_id]);

  const handleSelectAction = useCallback((action: 'create' | 'replace' | 'add') => {
    setSelectedAction(action);
    setNewDashboardName('');
    setCreateIncludeDescription(false);
    setNewDashboardDescription('');
    if (action !== 'replace') {
      setSelectedReplaceDashboardId(null);
      setUpdateDashboardTitle('');
      setUpdateChartTitle('');
    }
    if (action !== 'add') {
      setSelectedAddDashboardId(null);
      setCustomChartTitle('');
    }
  }, []);

  const handleCreateDashboard = useCallback(async () => {
    if (!newDashboardName.trim() || !chart || isCreatingDashboard) return;

    const chartIdForAttach = panelChartDetail.chart_id?.trim();
    if (!chartIdForAttach) {
      toast.error('No chart id to attach to the new dashboard');
      return;
    }

    setIsCreatingDashboard(true);
    try {
      const payload = {
        tenant_id: tenantId,
        domain_id: domainId,
        name: newDashboardName.trim(),
        description: createIncludeDescription ? newDashboardDescription.trim() : '',
        created_by: auth.state?.authInfo.user?.username || currentUserName || 'unknown_user',
      };

      const response = await apiV2.post('/dashboards', payload);
      const createOk = response.status >= 200 && response.status < 300;
      if (!createOk) {
        toast.error('Failed to create dashboard.');
        return;
      }

      let createBody: unknown = response.data;
      if (typeof createBody === 'string' && createBody.trim().startsWith('{')) {
        try {
          createBody = JSON.parse(createBody) as unknown;
        } catch (error) {
          /* keep string */
        }
      }

      const newDashboardId =
        extractDashboardIdFromCreateResponse(createBody) ??
        extractDashboardIdFromLocationHeader(response.headers);

      if (!newDashboardId) {
        toast.error(
          'Dashboard may have been created, but no dashboard id was found in the response (body or Location header), so the chart could not be linked.',
        );
        onActionComplete?.();
        return;
      }

      try {
        await addChartToDashboard(newDashboardId, chartIdForAttach);
      } catch (attachErr: unknown) {
        const attachMsg =
          (attachErr as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          (getDisplayErrorMessage(attachErr, 'Failed to attach chart'));
        toast.error(
          typeof attachMsg === 'string'
            ? `Dashboard created, but attaching chart failed: ${attachMsg}`
            : 'Dashboard created, but attaching chart failed',
        );
        onActionComplete?.();
        return;
      }

      toast.success(`Dashboard "${newDashboardName.trim()}" created and chart linked.`);
      onActionComplete?.();
    } catch (err: unknown) {
      toast.error(getDisplayErrorMessage(err, 'Failed to create dashboard'));
    } finally {
      setIsCreatingDashboard(false);
    }
  }, [
    newDashboardName,
    createIncludeDescription,
    newDashboardDescription,
    chart,
    isCreatingDashboard,
    tenantId,
    domainId,
    currentUserName,
    auth.state?.authInfo.user?.username,
    onActionComplete,
    panelChartDetail.chart_id,
  ]);

  const handleAddChartToExistingDashboard = useCallback(async () => {
    if (!selectedAddDashboardId || !panelChartDetail?.chart_id?.trim() || isAddingChartToDashboard) return;
    const chartIdForAttach = panelChartDetail.chart_id.trim();
    const useCurrentDashboardHandler =
      Boolean(currentDashboardId?.trim()) &&
      selectedAddDashboardId === currentDashboardId?.trim() &&
      onAddToCurrentDashboard;
    const titleVal = customChartTitle.trim() || undefined;
    setIsAddingChartToDashboard(true);
    try {
      if (useCurrentDashboardHandler) {
        await onAddToCurrentDashboard!(panelChartDetail, titleVal);
      } else {
        await addChartToDashboard(selectedAddDashboardId, chartIdForAttach, titleVal);
        toast.success('Chart added to dashboard');
      }
      onActionComplete?.();
    } catch (attachErr: unknown) {
      toast.error(getDisplayErrorMessage(attachErr, 'Failed to attach chart'));
    } finally {
      setIsAddingChartToDashboard(false);
    }
  }, [
    selectedAddDashboardId,
    panelChartDetail,
    customChartTitle,
    isAddingChartToDashboard,
    currentDashboardId,
    onAddToCurrentDashboard,
    onActionComplete,
  ]);

  const handleDeleteDashboardRow = useCallback(
    async (dashboardId: string, e: MouseEvent) => {
      e.stopPropagation();
      if (!window.confirm('Delete this dashboard? This cannot be undone.')) return;
      setDeletingDashboardId(dashboardId);
      try {
        await deleteDashboard(dashboardId);
        toast.success('Dashboard deleted');
        setReplaceDashboards((prev) => prev.filter((d) => d.dashboard_id !== dashboardId));
        if (selectedReplaceDashboardId === dashboardId) {
          setSelectedReplaceDashboardId(null);
          setUpdateDashboardTitle('');
        }
      } catch (err: unknown) {
        toast.error(getDisplayErrorMessage(err, 'Failed to delete dashboard'));
      } finally {
        setDeletingDashboardId(null);
      }
    },
    [selectedReplaceDashboardId],
  );

  const handleApplyDashboardUpdate = useCallback(async () => {
    if (!selectedReplaceDashboardId || !panelChartDetail?.chart_id?.trim() || isUpdatingDashboard) return;
    const dashTitle = updateDashboardTitle.trim();
    const chTitle = updateChartTitle.trim();
    if (!dashTitle || !chTitle) {
      toast.error('Enter dashboard title and chart title');
      return;
    }
    setIsUpdatingDashboard(true);
    try {
      await updateDashboardTitles(selectedReplaceDashboardId, {
        action: 'update_titles',
        title: dashTitle,
        chart_updates: [{ chart_id: panelChartDetail.chart_id.trim(), title: chTitle }],
      });
      toast.success('Dashboard updated');
      setReplaceDashboards((prev) =>
        prev.map((d) =>
          d.dashboard_id === selectedReplaceDashboardId ? { ...d, title: dashTitle } : d,
        ),
      );
    } catch (err: unknown) {
      toast.error(getDisplayErrorMessage(err, 'Failed to update dashboard'));
    } finally {
      setIsUpdatingDashboard(false);
    }
  }, [
    selectedReplaceDashboardId,
    panelChartDetail,
    updateDashboardTitle,
    updateChartTitle,
    isUpdatingDashboard,
  ]);

  const wrap = compact ? 'rounded-lg border border-border/60 bg-muted/20 px-3 py-3' : '';

  return (
    <div className={wrap}>
      <div className="mb-2 flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-violet-500/10 shadow-inner ring-1 ring-primary/10">
          <Sparkles className="size-4 text-primary" />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
            Dashboard actions
          </p>
          <p className="text-[10px] text-muted-foreground">Create, update, or link this chart</p>
        </div>
      </div>
      {!canLink && (
        <p className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-950 dark:text-amber-100">
          Linking requires a saved chart id from the assistant. When the response includes{' '}
          <code className="rounded bg-muted px-0.5">chart_id</code>, you can add this chart to a dashboard.
        </p>
      )}
      <div className="grid grid-cols-1 gap-2">
        <button
          type="button"
          disabled={!canLink}
          className={`flex items-center gap-3 rounded-xl border p-3 text-left shadow-sm transition-all ${
            selectedAction === 'create'
              ? 'border-primary/50 bg-gradient-to-r from-primary/10 to-violet-500/5 ring-1 ring-primary/20'
              : 'border-border/60 bg-card/80 hover:border-primary/35 hover:bg-muted/40 hover:shadow-md'
          } ${!canLink ? 'cursor-not-allowed opacity-60' : ''}`}
          onClick={() => canLink && handleSelectAction('create')}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/10">
            <PlusCircle className="size-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-foreground">Create new dashboard</div>
            <div className="text-xs text-muted-foreground">
              Build a new dashboard with this chart as the starting point
            </div>
          </div>
          <div
            className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${
              selectedAction === 'create' ? 'border-primary bg-primary' : 'border-muted-foreground/40'
            }`}
          >
            {selectedAction === 'create' && <div className="size-2 rounded-full bg-primary-foreground" />}
          </div>
        </button>

        {selectedAction === 'create' && canLink && (
          <div className="space-y-3 px-1 pb-2">
            <div className="flex min-w-0 items-center gap-2">
              <Input
                value={newDashboardName}
                onChange={(e) => setNewDashboardName(e.target.value)}
                placeholder="Enter new dashboard name..."
                className="h-9 min-w-0 flex-1 bg-muted/20 text-sm shadow-inner focus-visible:bg-background"
                disabled={isCreatingDashboard}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (newDashboardName.trim() && !isCreatingDashboard) void handleCreateDashboard();
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                className="h-9 w-9 shrink-0 p-0"
                onClick={() => void handleCreateDashboard()}
                disabled={isCreatingDashboard || !newDashboardName.trim()}
                aria-label="Create dashboard"
              >
                {isCreatingDashboard ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </Button>
            </div>
            <div className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-muted/20 px-2 py-2">
              <Checkbox
                id={`${queryId}-desc`}
                checked={createIncludeDescription}
                onCheckedChange={(v) => setCreateIncludeDescription(v === true)}
                disabled={isCreatingDashboard}
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor={`${queryId}-desc`} className="cursor-pointer text-xs font-medium leading-none pt-0.5">
                  Add description
                </Label>
                {createIncludeDescription ? (
                  <Textarea
                    value={newDashboardDescription}
                    onChange={(e) => setNewDashboardDescription(e.target.value)}
                    placeholder="Optional dashboard description…"
                    rows={3}
                    className="resize-none bg-background text-sm"
                    disabled={isCreatingDashboard}
                  />
                ) : null}
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          disabled={!canLink}
          className={`flex items-center gap-3 rounded-xl border p-3 text-left shadow-sm transition-all ${
            selectedAction === 'replace'
              ? 'border-primary/50 bg-gradient-to-r from-primary/10 to-violet-500/5 ring-1 ring-primary/20'
              : 'border-border/60 bg-card/80 hover:border-primary/35 hover:bg-muted/40 hover:shadow-md'
          } ${!canLink ? 'cursor-not-allowed opacity-60' : ''}`}
          onClick={() => canLink && handleSelectAction('replace')}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/20 to-primary/5 ring-1 ring-violet-500/15">
            <Pencil className="size-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-foreground">Update dashboard</div>
            <div className="text-xs text-muted-foreground">
              Select a dashboard, then update its title and this chart&apos;s title (replace slot)
            </div>
          </div>
          <div
            className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${
              selectedAction === 'replace' ? 'border-primary bg-primary' : 'border-muted-foreground/40'
            }`}
          >
            {selectedAction === 'replace' && <div className="size-2 rounded-full bg-primary-foreground" />}
          </div>
        </button>

        {selectedAction === 'replace' && canLink && (
          <div className="space-y-3 rounded-xl border border-border/60 bg-muted/15 p-3">
            {replaceDashboardsLoading ? (
              <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                <Loader2 className="size-4 shrink-0 animate-spin" />
                Loading dashboards…
              </div>
            ) : replaceDashboards.length === 0 ? (
              <p className="text-xs text-muted-foreground">No dashboards for this tenant.</p>
            ) : (
              <ul className="max-h-40 space-y-1 overflow-y-auto pr-1">
                {replaceDashboards.map((d) => {
                  const selected = selectedReplaceDashboardId === d.dashboard_id;
                  const label = d.title ?? d.name ?? d.dashboard_id;
                  return (
                    <li key={d.dashboard_id}>
                      <div
                        className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors ${
                          selected
                            ? 'border-primary/50 bg-primary/10'
                            : 'border-transparent bg-background/80 hover:bg-muted/40'
                        }`}
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 truncate text-left text-xs font-medium"
                          onClick={() => {
                            setSelectedReplaceDashboardId(d.dashboard_id);
                            setUpdateDashboardTitle((d.title ?? d.name ?? '').trim());
                          }}
                        >
                          {label}
                        </button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 shrink-0 text-destructive hover:text-destructive"
                          title="Delete dashboard"
                          disabled={deletingDashboardId === d.dashboard_id}
                          onClick={(e) => void handleDeleteDashboardRow(d.dashboard_id, e)}
                        >
                          {deletingDashboardId === d.dashboard_id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">Dashboard title</Label>
                <Input
                  value={updateDashboardTitle}
                  onChange={(e) => setUpdateDashboardTitle(e.target.value)}
                  placeholder="Dashboard title"
                  className="h-9 text-sm"
                  disabled={!selectedReplaceDashboardId || isUpdatingDashboard}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">Chart title (this chart)</Label>
                <Input
                  value={updateChartTitle}
                  onChange={(e) => setUpdateChartTitle(e.target.value)}
                  placeholder="Chart title"
                  className="h-9 text-sm"
                  disabled={!selectedReplaceDashboardId || isUpdatingDashboard}
                />
              </div>
              <Button
                type="button"
                className="w-full"
                size="sm"
                disabled={
                  !selectedReplaceDashboardId ||
                  !updateDashboardTitle.trim() ||
                  !updateChartTitle.trim() ||
                  !panelChartDetail.chart_id?.trim() ||
                  isUpdatingDashboard
                }
                onClick={() => void handleApplyDashboardUpdate()}
              >
                {isUpdatingDashboard ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Updating…
                  </>
                ) : (
                  'Apply update'
                )}
              </Button>
            </div>
          </div>
        )}

        <button
          type="button"
          disabled={!canLink}
          className={`flex items-center gap-3 rounded-xl border p-3 text-left shadow-sm transition-all ${
            selectedAction === 'add'
              ? 'border-primary/50 bg-gradient-to-r from-primary/10 to-violet-500/5 ring-1 ring-primary/20'
              : 'border-border/60 bg-card/80 hover:border-primary/35 hover:bg-muted/40 hover:shadow-md'
          } ${!canLink ? 'cursor-not-allowed opacity-60' : ''}`}
          onClick={() => canLink && handleSelectAction('add')}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/15 to-primary/5 ring-1 ring-emerald-500/20">
            <Link2 className="size-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-foreground">Add to existing dashboard</div>
            <div className="text-xs text-muted-foreground">Pick a dashboard, then add this chart to it</div>
          </div>
          <div
            className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${
              selectedAction === 'add' ? 'border-primary bg-primary' : 'border-muted-foreground/40'
            }`}
          >
            {selectedAction === 'add' && <div className="size-2 rounded-full bg-primary-foreground" />}
          </div>
        </button>

        {selectedAction === 'add' && canLink && (
          <div className="space-y-3 rounded-xl border border-border/60 bg-muted/15 p-3">
            {replaceDashboardsLoading ? (
              <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                <Loader2 className="size-4 shrink-0 animate-spin" />
                Loading dashboards…
              </div>
            ) : replaceDashboards.length === 0 ? (
              <p className="text-xs text-muted-foreground">No dashboards for this tenant.</p>
            ) : (
              <ul className="max-h-40 space-y-1 overflow-y-auto pr-1">
                {replaceDashboards.map((d) => {
                  const selected = selectedAddDashboardId === d.dashboard_id;
                  const label = d.title ?? d.name ?? d.dashboard_id;
                  return (
                    <li key={d.dashboard_id}>
                      <button
                        type="button"
                        className={`w-full truncate rounded-lg border px-2 py-1.5 text-left text-xs font-medium transition-colors ${
                          selected
                            ? 'border-primary/50 bg-primary/10'
                            : 'border-transparent bg-background/80 hover:bg-muted/40'
                        }`}
                        onClick={() => setSelectedAddDashboardId(d.dashboard_id)}
                      >
                        {label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {selectedAddDashboardId && (
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">Chart title (optional)</Label>
                <Input
                  value={customChartTitle}
                  onChange={(e) => setCustomChartTitle(e.target.value)}
                  placeholder="Chart title"
                  className="h-9 text-sm"
                  disabled={isAddingChartToDashboard}
                />
              </div>
            )}
            <Button
              type="button"
              className="w-full"
              size="sm"
              disabled={
                !selectedAddDashboardId || !panelChartDetail.chart_id?.trim() || isAddingChartToDashboard
              }
              onClick={() => void handleAddChartToExistingDashboard()}
            >
              {isAddingChartToDashboard ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Adding…
                </>
              ) : (
                'Add chart to dashboard'
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
