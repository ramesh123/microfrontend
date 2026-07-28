import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bot,
  Check,
  GripVertical,
  LayoutDashboard,
  Layers2,
  Link2,
  Loader2,
  Download,
  Monitor,
  Maximize2,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  TrendingUp,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  fetchDashboards,
  fetchDashboardById,
  addChartToDashboard,
  deleteDashboard,
  deleteDashboardChart,
  reorderDashboardCharts,
  refreshDashboard,
  getDashboardRefreshStatus,
  normalizeDashboardByIdResponse,
  fetchChartActions,
  postChartDrillDown,
  postChartBack,
  postChartFilter,
  type ChartActionsResponse,
  type ChartDrillDownBody,
  type PostChartFilterBody,
  type ChartStatusResponse,
  type DashboardItem,
  type DashboardByIdResponse,
  type DashboardChartSpec,
  type DashboardRefreshStatusResponse,
} from '@/controllers/API/agenticApi';
import { fetchWorkspaceTenants, type TenantListItem } from '@/controllers/API/semanticsApi';
import { downloadDataQualityExcelReport } from '@/controllers/API/dataQualityApi';
import { toast } from 'sonner';
import {
  chartStatusResponseToChartDetail,
  dashboardChartSpecToChartDetail,
  fetchChartUntilReady,
  isTerminalChartStatus,
} from '@/pages/ExploratoryAnalysis/AgenticSemantics/chartFetchUtils';
import {
  getExplorationChartHeadline,
  type ChartDrilldownUiHandlers,
  DashboardChartExpandedModalContent,
  DashboardSingleChartCard,
} from '@/pages/ExploratoryAnalysis/AgenticSemantics/DashboardChartCards';
import type {
  ChartDetail,
  DashboardCardTab,
} from '@/pages/ExploratoryAnalysis/AgenticSemantics/chartTypes';
import BaseModal from '@/modals/baseModal';
import { WorkspaceChartChatSidebar } from '@/pages/ExploratoryAnalysis/AgenticSemantics/WorkspaceChartChatSidebar';
import { DashboardConversationMonitor } from '@/pages/ExploratoryAnalysis/DashboardConversationMonitor';
import { DataQualityTrendsView } from '@/pages/ExploratoryAnalysis/DataQualityTrendsView';
import { cn } from '@/lib/utils';
import AIimage from '@/assets/images/ai.png';
import { HatGlasses } from 'lucide-react';
import ShadTooltip from '@/components/ui/shadTooltipComponent';
import api, { API_BASE_URL } from '@/controllers/API/api';
import {
  executeApiRequestSilent,
  getDisplayErrorMessage,
  resolveApiErrorMessage,
} from '@/utils/exceptionHelper';
import { filterHiddenDataQualityCharts } from '@/pages/ExploratoryAnalysis/insightsHiddenCharts';

function toApiPath(url: string): string {
  if (url.startsWith(API_BASE_URL)) {
    const path = url.slice(API_BASE_URL.length);
    return path.startsWith('/') ? path : `/${path}`;
  }
  if (url.startsWith('/api/')) return url.slice(4);
  if (url.startsWith('/api')) return url.slice(4) || '/';
  return url;
}

export async function fetchWithFallback<T>(
  url: string | undefined | null,
  mockData: T,
): Promise<T> {
  if (!url) return mockData;
  try {
    return await executeApiRequestSilent<T>(
      () => api.get(toApiPath(url)),
      'Request failed',
    );
  } catch {
    return mockData;
  }
}

function formatDate(s: string | null | undefined): string {
  if (!s) return '—';
  try {
    const d = new Date(s);
    return d.toLocaleDateString(undefined, { dateStyle: 'short' }) + ' ' + d.toLocaleTimeString(undefined, { timeStyle: 'short' });
  } catch {
    return String(s);
  }
}

/** Only user-owned dashboards may be deleted (not system). */
function isUserDashboard(d: Pick<DashboardItem, 'dashboard_type'> | null | undefined): boolean {
  return String(d?.dashboard_type ?? '').toLowerCase() === 'user';
}

/** System (or non-user) dashboards are read-only in the list card treatment. */
function isSystemDashboard(d: Pick<DashboardItem, 'dashboard_type'> | null | undefined): boolean {
  return String(d?.dashboard_type ?? '').toLowerCase() === 'system';
}

const DATA_QUALITY_OBSERVABILITY_DOMAIN_ID = 'data_quality_observability';

/**
 * Reads `current_run_id` from data-quality dashboard payloads (chart `summary` objects or `chart_plan`).
 */
function extractDataQualityCurrentRunIdFromDashboard(
  detail: DashboardByIdResponse | null,
): string | null {
  if (!detail) return null;
  const rootSummary = (detail as unknown as Record<string, unknown>).summary;
  if (rootSummary && typeof rootSummary === 'object' && !Array.isArray(rootSummary)) {
    const id = (rootSummary as Record<string, unknown>).current_run_id;
    if (typeof id === 'string' && id.trim()) return id.trim();
  }
  const charts = detail.spec?.charts ?? [];
  for (const c of charts) {
    const cp = c.chart_payload;
    if (!cp || typeof cp !== 'object') continue;
    const s = cp.summary;
    if (s && typeof s === 'object' && !Array.isArray(s)) {
      const id = (s as Record<string, unknown>).current_run_id;
      if (typeof id === 'string' && id.trim()) return id.trim();
    }
  }
  const plan = detail.chart_plan;
  if (Array.isArray(plan)) {
    for (const entry of plan) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const summ = (entry as Record<string, unknown>).summary;
      if (summ && typeof summ === 'object' && !Array.isArray(summ)) {
        const id = (summ as Record<string, unknown>).current_run_id;
        if (typeof id === 'string' && id.trim()) return id.trim();
      }
    }
  }
  const raw = detail as unknown as Record<string, unknown>;
  for (const key of ['latest_agentic_run_id', 'current_run_id', 'quality_run_id', 'run_id'] as const) {
    const v = raw[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/** Data-quality dashboards: one full-width chart row (Insights grid + slideshow). */
function isDataQualityDashboardGrid(
  dashboard: DashboardByIdResponse | null,
  charts: ChartDetail[],
  /** When GET /dashboards/:id omits `domain_id`, list row still has it (e.g. observability pack). */
  domainIdFallback?: string | null,
): boolean {
  if (!dashboard) return false;
  const dt = String(dashboard.dashboard_type ?? '').toLowerCase();
  if (dt === 'data_quality' || dt.includes('data_quality')) return true;
  const domain = String(dashboard.domain_id ?? domainIdFallback ?? '').toLowerCase();
  if (domain === DATA_QUALITY_OBSERVABILITY_DOMAIN_ID) {
    return true;
  }
  if (
    charts.length > 0 &&
    charts.every((c) => String(c.intent ?? '').toLowerCase() === 'data_quality')
  ) {
    return true;
  }
  return false;
}

/** Dashboard list card / header: data-quality observability (hide Insights category tabs + chart counts). */
function isDataQualityDashboardItem(
  d: Pick<DashboardItem, 'dashboard_type' | 'domain_id'> | null | undefined,
): boolean {
  if (!d) return false;
  const dt = String(d.dashboard_type ?? '').toLowerCase();
  if (dt === 'data_quality' || dt.includes('data_quality')) return true;
  const domain = String(d.domain_id ?? '').toLowerCase();
  if (domain === DATA_QUALITY_OBSERVABILITY_DOMAIN_ID) return true;
  if (domain === 'data_quality' || domain.includes('data_quality')) return true;
  return false;
}

/** Tabs on the dashboard list: group by inferred intent from title + metadata. */
export type InsightsListTab = 'correlation' | 'dashboard_agent' | 'anomaly';

function isCorrelationDashboardItem(
  d: Pick<DashboardItem, 'title' | 'name' | 'latest_agentic_run_id'> | null | undefined,
): boolean {
  if (!d) return false;
  return categorizeDashboardForTab(d as DashboardItem) === 'correlation';
}

function isAnomalyDashboardItem(
  d: Pick<DashboardItem, 'title' | 'name' | 'latest_agentic_run_id'> | null | undefined,
): boolean {
  if (!d) return false;
  return categorizeDashboardForTab(d as DashboardItem) === 'anomaly';
}

function categorizeDashboardForTab(d: DashboardItem): InsightsListTab {
  const text = `${d.title ?? ''} ${d.name ?? ''}`.toLowerCase();
  // Substring match so "… Anomaly …" titles always land here (regex \banomal\b missed "anomaly").
  if (
    text.includes('anomaly') ||
    text.includes('anomalies') ||
    text.includes('anomoly') ||
    text.includes('outlier')
  ) {
    return 'anomaly';
  }
  if (/\bcorrelation\b|correlations|correlation dashboard/i.test(text)) return 'correlation';
  if (d.latest_agentic_run_id?.trim()) return 'dashboard_agent';
  if (isUserDashboard(d)) return 'dashboard_agent';
  return 'dashboard_agent';
}

/** Icons + tints per dashboard category (tabs + list cards). */
const INSIGHTS_TAB_ICONS: Record<
  InsightsListTab,
  {
    Icon: LucideIcon;
    iconClass: string;
    wrapClass: string;
    tabTriggerActive: string;
    badgeClass: string;
  }
> = {
  correlation: {
    Icon: Link2,
    iconClass: 'text-violet-600 dark:text-violet-400',
    wrapClass: 'bg-violet-500/15 ring-1 ring-violet-500/25',
    tabTriggerActive:
      ' data-[state=active]:text-foreground data-[state=active]:shadow-sm',
    badgeClass: 'border-transparent dark:text-violet-200',
  },
  dashboard_agent: {
    Icon: HatGlasses,
    iconClass: 'text-emerald-600 dark:text-emerald-400',
    wrapClass: 'bg-emerald-500/15 ring-1 ring-emerald-500/25',
    tabTriggerActive:
      ' data-[state=active]:text-foreground data-[state=active]:shadow-sm',
    badgeClass: 'border-transparent text-emerald-800 dark:text-emerald-200',
  },
  anomaly: {
    Icon: AlertTriangle,
    iconClass: 'text-amber-600 dark:text-amber-400',
    wrapClass: 'bg-amber-500/15 ring-1 ring-amber-500/25',
    tabTriggerActive:
      ' data-[state=active]:text-foreground data-[state=active]:shadow-sm',
    badgeClass: 'border-transparent text-amber-900 dark:text-amber-200',
  },
};

function InsightsDashboardGridCard({
  d,
  deletingDashboardId,
  onSelect,
  onRequestDelete,
}: {
  d: DashboardItem;
  deletingDashboardId: string | null;
  onSelect: (d: DashboardItem) => void;
  onRequestDelete: (d: DashboardItem) => void;
}) {
  const userDash = isUserDashboard(d);
  const systemDash = isSystemDashboard(d);
  const kind = categorizeDashboardForTab(d);
  const ic = INSIGHTS_TAB_ICONS[kind];
  const CardIcon = ic.Icon;
  const dqListItem = isDataQualityDashboardItem(d);
  return (
    <div
      className={cn(
        'group relative rounded-lg border bg-card text-left transition-colors hover:bg-muted/30',
        userDash
          ? 'border-primary/30 hover:border-primary/45'
          : 'border-border/80 hover:border-primary/25',
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(d)}
        className="flex w-full flex-col items-start gap-2 p-4 pr-12 text-left"
      >
        <div className="flex w-full items-center gap-2">
          <div
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
              ic.wrapClass,
            )}
          >
            <CardIcon className={cn('size-5', ic.iconClass)} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
            <ShadTooltip content={d.title ?? d.name ?? d.dashboard_id}>
              <div className="min-w-0 flex-1 truncate text-xs font-medium cursor-pointer">
                {d.title ?? d.name ?? d.dashboard_id}
              </div>
            </ShadTooltip>
              {userDash ? (
                <Badge
                  variant="outline"
                  className="h-5 shrink-0 border-primary/35 bg-primary/5 px-1.5 text-[10px] font-medium text-primary"
                >
                  User
                </Badge>
              ) : systemDash ? (
                <Badge variant="secondary" className="h-5 shrink-0 px-1.5 text-[10px] font-medium">
                  System
                </Badge>
              ) : d.dashboard_type ? (
                <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[10px] font-normal">
                  {d.dashboard_type}
                </Badge>
              ) : null}
            </div>
            <div className="text-[10px] text-muted-foreground font-mono truncate">{d.domain_id}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {!dqListItem ? (
            <>
              <span>{d.chart_count ?? d.chart_plan?.length ?? 0} charts</span>
              <span>·</span>
            </>
          ) : null}
          <span>{formatDate(d.created_at)}</span>
        </div>
      </button>
      {isUserDashboard(d) && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`absolute right-2 top-2 size-8 text-muted-foreground transition-opacity hover:text-destructive ${
            deletingDashboardId === d.dashboard_id
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
          }`}
          title="Delete dashboard"
          disabled={deletingDashboardId === d.dashboard_id}
          onClick={(e) => {
            e.stopPropagation();
            onRequestDelete(d);
          }}
        >
          {deletingDashboardId === d.dashboard_id ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
        </Button>
      )}
    </div>
  );
}

/** Backend refresh job statuses — map to blur strength and label. */
function normalizeRefreshStatusKey(status: string | null | undefined): string {
  return String(status ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
}

function getRefreshStatusLabel(status: string | null | undefined): string {
  const k = normalizeRefreshStatusKey(status);
  if (!k) return 'Refreshing…';
  if (k.includes('queue') || k === 'pending' || k === 'waiting') return 'Queued…';
  if (k.includes('partial')) return 'Partial refresh…';
  if (k === 'charts_refreshed' || k.includes('charts_refreshed')) return 'Charts updated…';
  if (k === 'running' || k === 'processing' || k === 'refreshing' || k === 'in_progress') return 'Refreshing charts…';
  if (k === 'completed' || k === 'complete' || k === 'success' || k === 'done') return 'Done';
  if (k === 'failed' || k === 'error') return 'Failed';
  return 'Refreshing…';
}

/** 0–3: which pipeline stage is “lit” for the overlay rail. */
function getRefreshPipelinePhase(status: string | null | undefined): number {
  const k = normalizeRefreshStatusKey(status);
  if (!k) return 1;
  if (k.includes('queue') || k === 'pending' || k === 'waiting') return 0;
  if (k === 'running' || k === 'processing' || k === 'refreshing' || k === 'in_progress') return 1;
  if (k.includes('partial')) return 2;
  if (k === 'charts_refreshed' || k.includes('charts_refreshed')) return 3;
  if (k === 'completed' || k === 'complete' || k === 'success' || k === 'done') return 3;
  return 1;
}

/** Blur / dim / slight scale while refresh is in flight; stronger for early pipeline stages. */
function getRefreshVisualClass(status: string | null | undefined): string {
  const k = normalizeRefreshStatusKey(status);
  if (!k) return 'blur-[3px] brightness-[0.97] scale-[0.996]';
  if (k.includes('queue') || k === 'pending' || k === 'waiting') {
    return 'blur-md brightness-[0.9] scale-[0.988] saturate-[0.92]';
  }
  if (k.includes('partial')) return 'blur-sm brightness-[0.93] scale-[0.993]';
  if (k === 'charts_refreshed' || k.includes('charts_refreshed')) {
    return 'blur-[0.5px] brightness-[0.99] scale-[0.998]';
  }
  if (k === 'running' || k === 'processing' || k === 'refreshing' || k === 'in_progress') {
    return 'blur-sm brightness-[0.94] scale-[0.991]';
  }
  return 'blur-[3px] brightness-[0.97] scale-[0.996]';
}

const REFRESH_PIPELINE = [
  { label: 'Queue', Icon: Layers2 },
  { label: 'Sync', Icon: Zap },
  { label: 'Charts', Icon: BarChart3 },
  { label: 'Ready', Icon: Sparkles },
] as const;

function DashboardRefreshOverlay({ status }: { status: string | null }) {
  const phase = getRefreshPipelinePhase(status);
  const label = getRefreshStatusLabel(status);
  const barPct = Math.min(96, 18 + phase * 22);

  return (
    <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden rounded-lg">
      <div className="absolute inset-0 bg-gradient-to-b from-background/25 via-transparent to-background/40" />
      <div
        className="absolute -left-[20%] top-[-30%] h-[min(55%,22rem)] w-[min(55%,22rem)] rounded-full bg-primary/20 blur-3xl animate-refresh-orb"
        aria-hidden
      />
      <div
        className="absolute -right-[15%] bottom-[-25%] h-[min(50%,18rem)] w-[min(50%,18rem)] rounded-full bg-primary/12 blur-3xl animate-refresh-orb [animation-delay:1.4s]"
        aria-hidden
      />
      <div
        className="absolute left-1/2 top-1/2 h-[min(70%,24rem)] w-[min(90%,36rem)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl animate-pulse"
        aria-hidden
      />

      <div className="absolute left-1/2 top-[min(12%,5rem)] w-[min(92%,26rem)] -translate-x-1/2 px-3">
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-background/75 p-4 shadow-lg shadow-primary/5 backdrop-blur-xl dark:bg-background/65">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.12] dark:opacity-[0.18]"
            style={{
              background:
                'linear-gradient(120deg, transparent 0%, hsl(var(--primary) / 0.5) 45%, transparent 70%)',
            }}
          />
          <div className="relative flex items-start gap-3">
            
            <div className="min-w-0 flex-1 pt-0.5 justify-center items-center">
              <p className="mt-0.5 truncate text-sm font-medium text-foreground">{label}</p>
            </div>
          </div>

          <div className="relative mt-4 h-1.5 overflow-hidden rounded-full bg-muted/80">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary/70 via-primary to-primary/90 transition-[width] duration-700 ease-out"
              style={{ width: `${barPct}%` }}
            />
            <div className="absolute inset-0 overflow-hidden rounded-full">
              <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-white/35 to-transparent animate-refresh-shimmer" />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-1">
            {REFRESH_PIPELINE.map((step, i) => {
              const Icon = step.Icon;
              const active = i === phase;
              const done = i < phase;
              return (
                <div
                  key={step.label}
                  className={cn(
                    'flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-0.5 py-1 transition-colors duration-500',
                    active && 'bg-primary/10',
                    done && !active && 'opacity-80',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full border text-[10px] transition-all duration-500',
                      done
                        ? 'border-primary/40 bg-primary/15 text-primary'
                        : active
                          ? 'border-primary/50 bg-primary/20 text-primary shadow-[0_0_12px_hsl(var(--primary)/0.35)]'
                          : 'border-border/60 bg-muted/40 text-muted-foreground',
                    )}
                  >
                    {done ? (
                      <Check className="size-3.5 stroke-[2.5]" />
                    ) : (
                      <Icon className={cn('size-3.5', active && 'animate-pulse')} strokeWidth={2} />
                    )}
                  </div>
                  <span
                    className={cn(
                      'max-w-full truncate text-[9px] font-medium uppercase tracking-wide',
                      active || done ? 'text-foreground' : 'text-muted-foreground/70',
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border/50 bg-background/60 px-3 py-1.5 text-[10px] text-muted-foreground backdrop-blur-md">
        <Loader2 className="size-3 animate-spin text-primary" />
        <span className="tabular-nums tracking-tight">Updating metrics</span>
      </div>
    </div>
  );
}

function isTerminalRefreshSuccess(res: DashboardRefreshStatusResponse): boolean {
  const s = normalizeRefreshStatusKey(res.status);
  if (s === 'failed' || s === 'error') return false;
  if (res.completed_at) return true;
  return (
    s === 'completed' ||
    s === 'complete' ||
    s === 'success' ||
    s === 'done' ||
    s === 'charts_refreshed'
  );
}

function isTerminalRefreshFailure(res: DashboardRefreshStatusResponse): boolean {
  const s = normalizeRefreshStatusKey(res.status);
  if (s === 'failed' || s === 'error') return true;
  return !!(res.error_message && res.error_message.trim());
}

function chartSpecToDetail(spec: DashboardChartSpec): ChartDetail {
  return dashboardChartSpecToChartDetail(spec);
}

/** Reorder chart details to match `ids` (append any missing ids at the end). */
function orderDetailsByIds(details: ChartDetail[], ids: string[]): ChartDetail[] {
  const map = new Map(details.map((d) => [d.chart_id, d]));
  const seen = new Set<string>();
  const ordered: ChartDetail[] = [];
  for (const id of ids) {
    const d = map.get(id);
    if (d) {
      ordered.push(d);
      seen.add(id);
    }
  }
  for (const d of details) {
    if (!seen.has(d.chart_id)) ordered.push(d);
  }
  return ordered;
}

type InsightsLocationState = {
  tenantId?: string;
  tenantName?: string;
  /** Open this dashboard after the list loads (e.g. from agentic onboarding). */
  openDashboardId?: string;
};

export default function Insights() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = (location.state as InsightsLocationState | null) ?? null;
  const stateTenantId = locationState?.tenantId;
  const stateOpenDashboardId = locationState?.openDashboardId?.trim() ?? '';
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string>(stateTenantId ?? '');
  const [dashboards, setDashboards] = useState<DashboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedDashboard, setSelectedDashboard] = useState<DashboardItem | null>(null);
  const [dashboardDetail, setDashboardDetail] = useState<DashboardByIdResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(false);
  /** `slotChartId` is the stable dashboard spec chart id; live data comes from `orderedChartDetails`. */
  const [expandedView, setExpandedView] = useState<{
    slotChartId: string;
    tab: DashboardCardTab;
  } | null>(null);
  /** Full-view grid: all charts, 3 per row, scrollable. */
  const [dashboardSlideshowOpen, setDashboardSlideshowOpen] = useState(false);
  /**
   * Data-quality (and any) dashboard detail: charts vs conversation monitor vs trends.
   * Trends tab is only shown for data-quality observability dashboards with a resolved run id.
   */
  const [detailSubview, setDetailSubview] = useState<'dashboard' | 'monitor' | 'trends'>('dashboard');
  const [refreshingDashboard, setRefreshingDashboard] = useState(false);
  /** Latest GET refresh status string while polling (drives blur strength + label). */
  const [refreshPollStatus, setRefreshPollStatus] = useState<string | null>(null);
  const [dqExcelDownloading, setDqExcelDownloading] = useState(false);
  const [deletingDashboardId, setDeletingDashboardId] = useState<string | null>(null);
  const [deleteDialogDashboard, setDeleteDialogDashboard] = useState<DashboardItem | null>(null);
  const [deleteDialogChart, setDeleteDialogChart] = useState<{
    dashboardId: string;
    chartId: string;
    title: string;
  } | null>(null);
  const [deletingChartId, setDeletingChartId] = useState<string | null>(null);
  /** Local chart order before save; `null` means use server order from spec charts. */
  const [chartOrderDraft, setChartOrderDraft] = useState<string[] | null>(null);
  const [savingChartOrder, setSavingChartOrder] = useState(false);
  const initialFetchDone = useRef(false);
  const stateSyncedRef = useRef(false);
  /** Consumes `openDashboardId` from location.state once per navigation. */
  const insightsDashboardDeepLinkTargetRef = useRef<string | null>(null);

  const [cognitoChart, setCognitoChart] = useState<ChartDetail | null>(null);
  /** Dashboard spec chart id for the chart whose Cognito sidebar is open (override key must stay stable after drill). */
  const [cognitoSlotChartId, setCognitoSlotChartId] = useState<string | null>(null);
  /** True when AI was opened from the dashboard toolbar — empty state hides chart preview (first chart still backs API context). */
  const [cognitoChatFromDashboardToolbar, setCognitoChatFromDashboardToolbar] = useState(false);
  /** Replaces dashboard chart data when assistant returns chart_json.data or data_json.rows. */
  const [chartOverrides, setChartOverrides] = useState<Record<string, ChartDetail>>({});
  /** GET /charts/{id}/actions — loaded lazily when user opens exploration on a card (not on initial dashboard load). */
  const [chartActionsById, setChartActionsById] = useState<Record<string, ChartActionsResponse | null>>({});
  const chartActionsByIdRef = useRef(chartActionsById);
  chartActionsByIdRef.current = chartActionsById;
  const chartActionsInflightRef = useRef<Set<string>>(new Set());
  const [chartActionsSlotLoading, setChartActionsSlotLoading] = useState<Record<string, boolean>>({});
  const [lineageLoadingChartId, setLineageLoadingChartId] = useState<string | null>(null);
  const [filterLoadingChartId, setFilterLoadingChartId] = useState<string | null>(null);
  /** Bumps when dashboard payload refreshes so chart actions are re-fetched for the same dashboard id. */
  const [chartActionsRefreshNonce, setChartActionsRefreshNonce] = useState(0);
  /** When true, chart delete, Ask Cognito, drag-reorder, and SQL editing are enabled. */
  const [dashboardEditMode, setDashboardEditMode] = useState(false);
  /** Local SQL text overrides keyed by dashboard spec chart id (slot). */
  const [sqlOverrides, setSqlOverrides] = useState<Record<string, string>>({});

  /** Dashboard list sub-views: Correlation / Dashboard Agent / Anomaly. */
  const [insightsListTab, setInsightsListTab] = useState<InsightsListTab>('dashboard_agent');

  /** Drilldown / exploration API + UI only for dashboards tied to a DashboardAgent run. */
  const isDashboardAgentDashboard = Boolean(selectedDashboard?.latest_agentic_run_id?.trim());

  const isCorrelationDashboard = isCorrelationDashboardItem(selectedDashboard);
  const isAnomalyDashboard = isAnomalyDashboardItem(selectedDashboard);

  const loadTenants = useCallback(async () => {
    setTenantsLoading(true);
    try {
      const list = await fetchWorkspaceTenants();
      setTenants(list);
      if (list.length > 0 && !tenantId) {
        setTenantId(stateTenantId ?? list[0].tenant_id);
      }
    } catch (error) {
      toast.error(getDisplayErrorMessage(error, 'Failed to load tenants'));
    } finally {
      setTenantsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  useEffect(() => {
    if (stateSyncedRef.current || !stateTenantId) return;
    stateSyncedRef.current = true;
    setTenantId(stateTenantId);
    initialFetchDone.current = false;
  }, [stateTenantId]);

  useEffect(() => {
    if (!stateOpenDashboardId) {
      insightsDashboardDeepLinkTargetRef.current = null;
    }
  }, [stateOpenDashboardId]);

  const tenantOptions = tenants.map((t) => ({ label: t.display_name, value: t.tenant_id }));

  const dashboardsByTab = useMemo(() => {
    const buckets: Record<InsightsListTab, DashboardItem[]> = {
      correlation: [],
      dashboard_agent: [],
      anomaly: [],
    };
    for (const d of dashboards) {
      buckets[categorizeDashboardForTab(d)].push(d);
    }
    return buckets;
  }, [dashboards]);

  /** Tenant only has data-quality dashboards — hide Correlation / Agent / Anomaly tabs and show one grid. */
  const hideInsightsListTabs = useMemo(
    () => dashboards.length > 0 && dashboards.every(isDataQualityDashboardItem),
    [dashboards],
  );

  const loadDashboards = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetchDashboards(tenantId);
      setDashboards(res.dashboards ?? []);
    } catch (error) {
      setError(true);
      setDashboards([]);
      toast.error(getDisplayErrorMessage(error, 'Failed to load dashboards'));
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) {
      setDashboards([]);
      setLoading(false);
      return;
    }
    initialFetchDone.current = false;
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    if (initialFetchDone.current) return;
    initialFetchDone.current = true;
    loadDashboards();
  }, [tenantId, loadDashboards]);

  const handleSelectDashboard = useCallback(async (d: DashboardItem) => {
    setSelectedDashboard(d);
    setDashboardDetail(null);
    setChartOverrides({});
    setSqlOverrides({});
    setDashboardEditMode(false);
    setChartActionsById({});
    setChartActionsRefreshNonce(0);
    setDashboardSlideshowOpen(false);
    setDetailSubview('dashboard');
    setDetailError(false);
    setDetailLoading(true);
    try {
      const res = await fetchDashboardById(d.dashboard_id);
      setDashboardDetail(
        normalizeDashboardByIdResponse({
          ...res,
          dashboard_type: res.dashboard_type ?? d.dashboard_type,
        }),
      );
    } catch (error) {
      setDetailError(true);
      toast.error(getDisplayErrorMessage(error, 'Failed to load dashboard details'));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!stateOpenDashboardId || !tenantId || loading) return;
    if (insightsDashboardDeepLinkTargetRef.current === stateOpenDashboardId) return;
    const match = dashboards.find((d) => d.dashboard_id === stateOpenDashboardId);
    if (!match) {
      insightsDashboardDeepLinkTargetRef.current = stateOpenDashboardId;
      navigate(location.pathname, {
        replace: true,
        state: {
          tenantId,
          tenantName: locationState?.tenantName,
        },
      });
      if (dashboards.length > 0) {
        toast.info('That dashboard was not found for this tenant.');
      }
      return;
    }
    insightsDashboardDeepLinkTargetRef.current = stateOpenDashboardId;
    void handleSelectDashboard(match).then(() => {
      navigate(location.pathname, {
        replace: true,
        state: {
          tenantId,
          tenantName: locationState?.tenantName,
        },
      });
    });
  }, [
    stateOpenDashboardId,
    tenantId,
    loading,
    dashboards,
    handleSelectDashboard,
    navigate,
    location.pathname,
    locationState?.tenantName,
  ]);

  const handleBackToDashboards = useCallback(() => {
    setSelectedDashboard(null);
    setDashboardDetail(null);
    setChartOverrides({});
    setSqlOverrides({});
    setDashboardEditMode(false);
    setChartActionsById({});
    setChartActionsRefreshNonce(0);
    setChartOrderDraft(null);
    setDetailError(false);
    setExpandedView(null);
    setDashboardSlideshowOpen(false);
    setDetailSubview('dashboard');
    setCognitoChart(null);
    setCognitoChatFromDashboardToolbar(false);
  }, []);

  useEffect(() => {
    setChartOrderDraft(null);
  }, [selectedDashboard?.dashboard_id]);

  const performDeleteDashboard = useCallback(
    async (d: DashboardItem) => {
      if (!isUserDashboard(d)) {
        toast.error('Only user dashboards can be deleted');
        return;
      }
      const id = d.dashboard_id;
      if (!id) return;
      setDeletingDashboardId(id);
      try {
        await deleteDashboard(id);
        toast.success('Dashboard deleted');
        setDashboards((prev) => prev.filter((x) => x.dashboard_id !== id));
        if (selectedDashboard?.dashboard_id === id) {
          handleBackToDashboards();
        }
      } catch (err: unknown) {
        toast.error(
          getDisplayErrorMessage(err, 'Failed to delete dashboard'),
        );
      } finally {
        setDeletingDashboardId(null);
      }
    },
    [selectedDashboard?.dashboard_id, handleBackToDashboards],
  );

  const performDeleteChart = useCallback(
    async (dashboardId: string, chartId: string) => {
      if (!dashboardId || !chartId) return;
      setDeletingChartId(chartId);
      try {
        await deleteDashboardChart(dashboardId, chartId);
        toast.success('Chart removed from dashboard');
        setDashboardDetail((prev) => {
          if (!prev?.spec?.charts) return prev;
          return {
            ...prev,
            spec: {
              ...prev.spec,
              charts: prev.spec.charts.filter((c) => (c.chart_id ?? '') !== chartId),
            },
          };
        });
        setChartOverrides((prev) => {
          const next = { ...prev };
          delete next[chartId];
          return next;
        });
        setDashboards((prev) =>
          prev.map((d) =>
            d.dashboard_id === dashboardId
              ? {
                  ...d,
                  chart_count: Math.max(0, (d.chart_count ?? 1) - 1),
                }
              : d,
            ),
        );
        setChartOrderDraft((prev) => {
          if (!prev) return null;
          const next = prev.filter((id) => id !== chartId);
          return next.length === 0 ? null : next;
        });
      } catch (err: unknown) {
        toast.error(
          getDisplayErrorMessage(err, 'Failed to remove chart'),
        );
      } finally {
        setDeletingChartId(null);
      }
    },
    [],
  );

  /** Opens delete confirmation dialog (keeps name used by grid delete control). */
  const handleDeleteDashboard = useCallback((d: DashboardItem) => {
    setDeleteDialogDashboard(d);
  }, []);

  const handleChartExpand = useCallback(
    (_detail: ChartDetail, tab: DashboardCardTab, slotChartId: string) => {
      setDashboardSlideshowOpen(false);
      setExpandedView({ slotChartId, tab });
    },
    [],
  );

  const handleRefreshDashboard = useCallback(async () => {
    const dashboardId = selectedDashboard?.dashboard_id;
    if (!dashboardId) return;
    setRefreshingDashboard(true);
    setRefreshPollStatus(null);
    try {
      const refreshRes = await refreshDashboard(dashboardId);
      const refreshId = refreshRes.refresh_id;
      if (!refreshId) {
        toast.error('Refresh started but no refresh_id returned');
        setRefreshingDashboard(false);
        setRefreshPollStatus(null);
        return;
      }
      toast.success('Dashboard refresh started');
      const pollIntervalMs = 2000;
      const maxAttempts = 150;
      let attempts = 0;
      const checkStatus = async (): Promise<'success' | 'failure' | 'continue'> => {
        const statusRes = await getDashboardRefreshStatus(dashboardId, refreshId);
        setRefreshPollStatus(statusRes.status ?? null);

        if (isTerminalRefreshFailure(statusRes)) {
          toast.error(
            resolveApiErrorMessage(
              { message: statusRes.error_message?.trim() },
              'Dashboard refresh failed',
            ),
          );
          return 'failure';
        }
        if (isTerminalRefreshSuccess(statusRes)) {
          const res = await fetchDashboardById(dashboardId);
          setDashboardDetail(
            normalizeDashboardByIdResponse({
              ...res,
              dashboard_type: res.dashboard_type ?? selectedDashboard?.dashboard_type,
            }),
          );
          setChartOverrides({});
          setChartActionsRefreshNonce((n) => n + 1);
          toast.success('Dashboard refreshed');
          return 'success';
        }
        return 'continue';
      };
      while (attempts < maxAttempts) {
        const outcome = await checkStatus();
        if (outcome !== 'continue') break;
        attempts += 1;
        await new Promise((r) => setTimeout(r, pollIntervalMs));
      }
      if (attempts >= maxAttempts) {
        toast.error('Refresh timed out');
      }
    } catch (error) {
      toast.error(getDisplayErrorMessage(error, 'Failed to refresh dashboard'));
    } finally {
      // Let blur/brightness ease out after data is loaded (slow reveal).
      await new Promise((r) => setTimeout(r, 450));
      setRefreshingDashboard(false);
      setRefreshPollStatus(null);
    }
  }, [selectedDashboard?.dashboard_id, selectedDashboard?.dashboard_type]);

  /** Must be memoized: a fresh `map()` every render would retrigger chart-actions `useEffect` and cause an infinite update loop. */
  const chartDetails = useMemo(
    () => dashboardDetail?.spec?.charts?.map(chartSpecToDetail) ?? [],
    [dashboardDetail?.spec?.charts],
  );

  const dataQualitySingleColumnGrid = useMemo(
    () =>
      isDataQualityDashboardGrid(
        dashboardDetail,
        chartDetails,
        selectedDashboard?.domain_id,
      ),
    [dashboardDetail, chartDetails, selectedDashboard?.domain_id],
  );

  const hideChartCountInDetailHeader = useMemo(
    () =>
      !!selectedDashboard &&
      (isDataQualityDashboardItem(selectedDashboard) || dataQualitySingleColumnGrid),
    [selectedDashboard, dataQualitySingleColumnGrid],
  );

  /** Agentic / quality run id for DQ Excel download (from dashboard payload / list). */
  const dataQualityRunIdForInsights = useMemo(() => {
    if (!selectedDashboard || !dashboardDetail) return null;
    const isDq =
      isDataQualityDashboardItem(selectedDashboard) ||
      isDataQualityDashboardGrid(dashboardDetail, chartDetails, selectedDashboard.domain_id);
    if (!isDq) return null;
    const fromDetail = extractDataQualityCurrentRunIdFromDashboard(dashboardDetail);
    const fromList = selectedDashboard.latest_agentic_run_id?.trim() ?? '';
    const rid = (fromDetail || fromList).trim();
    return rid || null;
  }, [chartDetails, dashboardDetail, selectedDashboard]);

  const isDataQualityDashboard = useMemo(() => {
    if (!selectedDashboard) return false;
    if (dashboardDetail) {
      return (
        isDataQualityDashboardItem(selectedDashboard) ||
        isDataQualityDashboardGrid(dashboardDetail, chartDetails, selectedDashboard.domain_id)
      );
    }
    return isDataQualityDashboardItem(selectedDashboard);
  }, [selectedDashboard, dashboardDetail, chartDetails]);

  const showDataQualityTrendsTab = isDataQualityDashboard;

  /** Correlation / anomaly / data-quality: Chart + Table only (no SQL, Insight, or drill). */
  const hideChartExplorationExtras =
    isCorrelationDashboard || isAnomalyDashboard || isDataQualityDashboard;

  useEffect(() => {
    if (!showDataQualityTrendsTab && detailSubview === 'trends') {
      setDetailSubview('dashboard');
    }
  }, [showDataQualityTrendsTab, detailSubview]);

  useEffect(() => {
    if (dashboardEditMode) return;
    setCognitoChart(null);
    setCognitoSlotChartId(null);
    setCognitoChatFromDashboardToolbar(false);
  }, [dashboardEditMode]);

  const chartOverridesRef = useRef(chartOverrides);
  chartOverridesRef.current = chartOverrides;

  /** Stable spec chart ids for this dashboard (used for overrides, actions, DnD — never replaced by drill). */
  const serverChartIds = useMemo(
    () => chartDetails.map((d) => d.chart_id),
    [chartDetails],
  );
  /** Stable across reorder — used to invalidate cached chart actions when the chart set changes. */
  const chartSetFingerprint = useMemo(
    () => [...serverChartIds].sort().join('\u0000'),
    [serverChartIds],
  );
  const orderedSlotChartIds = useMemo(
    () => orderDetailsByIds(chartDetails, chartOrderDraft ?? serverChartIds).map((d) => d.chart_id),
    [chartDetails, chartOrderDraft, serverChartIds],
  );
  /** One row per slot; `detail.chart_id` is the API’s current chart id after drill (may differ from slot). */
  const orderedChartDetails = useMemo(
    () =>
      orderedSlotChartIds.map((slotId) => {
        const override = chartOverrides[slotId];
        const spec = chartDetails.find((d) => d.chart_id === slotId);
        const base = override ?? spec!;
        const sqlOverride = sqlOverrides[slotId];
        if (sqlOverride === undefined) return base;
        return { ...base, sql: sqlOverride };
      }),
    [orderedSlotChartIds, chartOverrides, chartDetails, sqlOverrides],
  );

  /** Data-quality dashboards: omit summary/readiness/waterfall charts from the grid and slideshow. */
  const { visibleChartDetails, visibleSlotChartIds } = useMemo(() => {
    if (!isDataQualityDashboard) {
      return {
        visibleChartDetails: orderedChartDetails,
        visibleSlotChartIds: orderedSlotChartIds,
      };
    }
    const { details, slotIds } = filterHiddenDataQualityCharts(
      orderedChartDetails,
      orderedSlotChartIds,
    );
    return { visibleChartDetails: details, visibleSlotChartIds: slotIds };
  }, [isDataQualityDashboard, orderedChartDetails, orderedSlotChartIds]);

  const handleChartSqlChange = useCallback((slotChartId: string, sql: string) => {
    setSqlOverrides((prev) => ({ ...prev, [slotChartId]: sql }));
  }, []);

  const expandedModalDetail = useMemo(() => {
    if (!expandedView) return null;
    const idx = orderedSlotChartIds.indexOf(expandedView.slotChartId);
    if (idx < 0) return null;
    return orderedChartDetails[idx] ?? null;
  }, [expandedView, orderedSlotChartIds, orderedChartDetails]);

  /** Expanded chart modal: same headline as dashboard cards (latest breadcrumb title when drilled). */
  const expandedChartModalHeadline = useMemo(() => {
    if (!expandedModalDetail || !expandedView) return '';
    const act = chartActionsById[expandedView.slotChartId];
    return getExplorationChartHeadline(act, expandedModalDetail);
  }, [expandedModalDetail, expandedView, chartActionsById]);

  const dashboardChartIdsKey = useMemo(
    () => orderedSlotChartIds.join('\u0000'),
    [orderedSlotChartIds],
  );

  /** Drop cached drill actions when dashboard, chart membership, or refresh changes — user re-opens exploration to refetch. */
  useEffect(() => {
    if (!dashboardDetail || !isDashboardAgentDashboard) {
      setChartActionsById({});
      setChartActionsSlotLoading({});
      chartActionsInflightRef.current.clear();
      setFilterLoadingChartId(null);
      return;
    }
    setChartActionsById({});
    setChartActionsSlotLoading({});
    chartActionsInflightRef.current.clear();
    setFilterLoadingChartId(null);
  }, [
    dashboardDetail?.dashboard_id,
    isDashboardAgentDashboard,
    chartSetFingerprint,
    chartActionsRefreshNonce,
  ]);

  /**
   * GET /charts/{chart_id}/actions for a dashboard slot. Refetches when the effective chart id changes
   * (e.g. workspace AI returns a new chart id — cached actions for the old id are invalid).
   * @param overrideEffectiveChartId — use when `chartOverrides` is not flushed to refs yet (e.g. `onChartReplaced`).
   */
  const ensureChartActionsForSlot = useCallback(
    async (slotChartId: string, overrideEffectiveChartId?: string | null) => {
      if (!isDashboardAgentDashboard || !dashboardDetail) return;
      const fromOverride =
        typeof overrideEffectiveChartId === 'string' && overrideEffectiveChartId.trim() !== ''
          ? overrideEffectiveChartId.trim()
          : null;
      const effectiveId =
        fromOverride ??
        chartOverridesRef.current[slotChartId]?.chart_id ??
        chartDetails.find((d) => d.chart_id === slotChartId)?.chart_id ??
        slotChartId;
      const effectiveTrimmed = String(effectiveId).trim();
      const cached = chartActionsByIdRef.current[slotChartId];
      if (cached && cached.chart_id === effectiveTrimmed) return;
      if (chartActionsInflightRef.current.has(slotChartId)) return;
      chartActionsInflightRef.current.add(slotChartId);
      setChartActionsSlotLoading((prev) => ({ ...prev, [slotChartId]: true }));
      try {
        const res = await fetchChartActions(effectiveTrimmed).catch(() => null);
        setChartActionsById((prev) => ({ ...prev, [slotChartId]: res }));
      } finally {
        chartActionsInflightRef.current.delete(slotChartId);
        setChartActionsSlotLoading((prev) => ({ ...prev, [slotChartId]: false }));
      }
    },
    [isDashboardAgentDashboard, dashboardDetail, chartDetails],
  );

  const handleChartDrilldown = useCallback(
    async (slotChartId: string, payload: ChartDrillDownBody) => {
      const effectiveChartId =
        chartOverrides[slotChartId]?.chart_id ??
        chartDetails.find((d) => d.chart_id === slotChartId)?.chart_id ??
        slotChartId;
      try {
        const res = await postChartDrillDown(effectiveChartId, payload);
        let ready: ChartStatusResponse = res;
        if (!isTerminalChartStatus(res.status)) {
          ready = await fetchChartUntilReady(res.chart_id);
        }
        const detail = chartStatusResponseToChartDetail(ready);
        setChartOverrides((prev) => ({
          ...prev,
          [slotChartId]: { ...detail, chart_id: ready.chart_id },
        }));
        const nextActions = await fetchChartActions(ready.chart_id);
        setChartActionsById((prev) => ({ ...prev, [slotChartId]: nextActions }));
      } catch (err: unknown) {
        toast.error(getDisplayErrorMessage(err, 'Drilldown failed'));
      }
    },
    [chartDetails, chartOverrides],
  );

  const handleChartLineageBack = useCallback(
    async (slotChartId: string) => {
      const actions = chartActionsById[slotChartId];
      if (!actions) return;
      const effectiveChartId =
        chartOverrides[slotChartId]?.chart_id ??
        chartDetails.find((d) => d.chart_id === slotChartId)?.chart_id ??
        slotChartId;
      setLineageLoadingChartId(slotChartId);
      try {
        if (!actions.lineage_summary?.can_go_back) {
          toast.error('Could not go back');
          return;
        }
        const res = await postChartBack(effectiveChartId);
        let ready: ChartStatusResponse = res;
        if (!isTerminalChartStatus(res.status)) {
          ready = await fetchChartUntilReady(res.chart_id);
        }
        const detail = chartStatusResponseToChartDetail(ready);
        setChartOverrides((prev) => ({
          ...prev,
          [slotChartId]: { ...detail, chart_id: ready.chart_id },
        }));
        const nextActions = await fetchChartActions(ready.chart_id);
        setChartActionsById((prev) => ({ ...prev, [slotChartId]: nextActions }));
      } catch (err: unknown) {
        toast.error(getDisplayErrorMessage(err, 'Could not go back'));
      } finally {
        setLineageLoadingChartId(null);
      }
    },
    [chartActionsById, chartDetails, chartOverrides],
  );

  const handleChartFilter = useCallback(
    async (slotChartId: string, body: PostChartFilterBody) => {
      const effectiveChartId =
        chartOverrides[slotChartId]?.chart_id ??
        chartDetails.find((d) => d.chart_id === slotChartId)?.chart_id ??
        slotChartId;
      setFilterLoadingChartId(slotChartId);
      try {
        const res = await postChartFilter(effectiveChartId, body);
        let ready: ChartStatusResponse = res;
        if (!isTerminalChartStatus(res.status)) {
          ready = await fetchChartUntilReady(res.chart_id);
        }
        const detail = chartStatusResponseToChartDetail(ready);
        setChartOverrides((prev) => ({
          ...prev,
          [slotChartId]: { ...detail, chart_id: ready.chart_id },
        }));
        const nextActions = await fetchChartActions(ready.chart_id);
        setChartActionsById((prev) => ({ ...prev, [slotChartId]: nextActions }));
      } catch (err: unknown) {
        toast.error(getDisplayErrorMessage(err, 'Filter failed'));
      } finally {
        setFilterLoadingChartId((id) => (id === slotChartId ? null : id));
      }
    },
    [chartDetails, chartOverrides],
  );

  /** Effective chart for workspace chat (drill updates `chartOverrides` by slot id). */
  const workspaceChatSidebarChartDetail = useMemo(() => {
    if (!cognitoChart) return null;
    if (!cognitoSlotChartId) return cognitoChart;
    return chartOverrides[cognitoSlotChartId] ?? cognitoChart;
  }, [cognitoChart, cognitoSlotChartId, chartOverrides]);

  const getDrilldownUiForSlot = useCallback(
    (slotChartId: string): ChartDrilldownUiHandlers | undefined => {
      if (
        hideChartExplorationExtras ||
        !isDashboardAgentDashboard ||
        !handleChartDrilldown ||
        !handleChartLineageBack
      ) {
        return undefined;
      }
      return {
        actions: chartActionsById[slotChartId],
        loading: !!chartActionsSlotLoading?.[slotChartId],
        lineageBusy: lineageLoadingChartId === slotChartId,
        filterBusy: filterLoadingChartId === slotChartId,
        onDrillDown: (payload: ChartDrillDownBody) =>
          handleChartDrilldown(slotChartId, payload),
        onLineageBack: () => void handleChartLineageBack(slotChartId),
        onApplyChartFilter: handleChartFilter
          ? (body: PostChartFilterBody) => void handleChartFilter(slotChartId, body)
          : undefined,
        onExplorationOpen: ensureChartActionsForSlot
          ? () => void ensureChartActionsForSlot(slotChartId)
          : undefined,
      };
    },
    [
      hideChartExplorationExtras,
      isDashboardAgentDashboard,
      chartActionsById,
      chartActionsSlotLoading,
      lineageLoadingChartId,
      filterLoadingChartId,
      handleChartDrilldown,
      handleChartLineageBack,
      handleChartFilter,
      ensureChartActionsForSlot,
    ],
  );

  const chartOrderDirty = useMemo(
    () =>
      chartOrderDraft !== null &&
      chartOrderDraft.join('\u0000') !== serverChartIds.join('\u0000'),
    [chartOrderDraft, serverChartIds],
  );

  const handleSaveChartOrder = useCallback(async () => {
    const dashboardId = selectedDashboard?.dashboard_id;
    if (!dashboardId || !chartOrderDraft?.length) return;
    setSavingChartOrder(true);
    try {
      const pathChartId = chartOrderDraft[0];
      await reorderDashboardCharts(dashboardId, pathChartId, { chart_ids: chartOrderDraft });
      setDashboardDetail((prev) => {
        if (!prev?.spec?.charts) return prev;
        const byId = new Map(
          prev.spec.charts.map((c) => [c.chart_id as string, c] as const),
        );
        const charts = chartOrderDraft
          .map((id) => byId.get(id))
          .filter(Boolean) as DashboardChartSpec[];
        return { ...prev, spec: { ...prev.spec, charts } };
      });
      setChartOrderDraft(null);
      toast.success('Chart order saved');
    } catch (err: unknown) {
      toast.error(
        getDisplayErrorMessage(err, 'Failed to save chart order'),
      );
    } finally {
      setSavingChartOrder(false);
    }
  }, [chartOrderDraft, selectedDashboard?.dashboard_id]);

  const domainId =
    dashboardDetail?.domain_id ?? selectedDashboard?.domain_id ?? '';

  const handleDownloadDataQualityExcel = useCallback(async () => {
    const rid = dataQualityRunIdForInsights?.trim();
    const tid = tenantId?.trim();
    const did = domainId.trim();
    if (!rid || !tid || !did) return;
    setDqExcelDownloading(true);
    try {
      await downloadDataQualityExcelReport({ runId: rid, tenant_id: tid, domain_id: did });
      toast.success('Excel report downloaded');
    } catch (err: unknown) {
      toast.error(
        getDisplayErrorMessage(err, 'Failed to download Excel report'),
      );
    } finally {
      setDqExcelDownloading(false);
    }
  }, [dataQualityRunIdForInsights, domainId, tenantId]);

  /** Opens chart chat; conversation history loads only via History in the sidebar. */
  const handleOpenCognitoChart = useCallback((detail: ChartDetail, slotChartId?: string) => {
    setCognitoChatFromDashboardToolbar(false);
    setCognitoChart(detail);
    setCognitoSlotChartId(slotChartId ?? null);
  }, []);

  const handleCommitWorkspaceChartToDashboard = useCallback(
    async (detail: ChartDetail, title?: string) => {
      const dashboardId = selectedDashboard?.dashboard_id;
      const chartId = detail.chart_id?.trim();
      if (!dashboardId || !chartId) return;

      const alreadyAttached = dashboardDetail?.spec?.charts?.some(
        (chartSpec) => (chartSpec.chart_id ?? '').trim() === chartId,
      );
      if (alreadyAttached) {
        toast.info('Chart is already on this dashboard');
        return;
      }

      try {
        await addChartToDashboard(dashboardId, chartId, title);
        let refreshed = normalizeDashboardByIdResponse(
          await fetchDashboardById(dashboardId),
        );
        refreshed = {
          ...refreshed,
          dashboard_type: refreshed.dashboard_type ?? selectedDashboard?.dashboard_type,
        };

        const chartIds = (refreshed.spec?.charts ?? [])
          .map((c) => (c.chart_id ?? '').trim())
          .filter(Boolean);
        const orderWithNewLast = [...chartIds.filter((id) => id !== chartId), chartId];
        const needsReorder =
          orderWithNewLast.length > 0 &&
          orderWithNewLast.join('\u0000') !== chartIds.join('\u0000');

        if (needsReorder) {
          await reorderDashboardCharts(dashboardId, orderWithNewLast[0], {
            chart_ids: orderWithNewLast,
          });
          if (refreshed.spec?.charts) {
            const byId = new Map(
              refreshed.spec.charts.map((c) => [c.chart_id as string, c] as const),
            );
            const charts = orderWithNewLast
              .map((id) => byId.get(id))
              .filter(Boolean) as DashboardChartSpec[];
            refreshed = { ...refreshed, spec: { ...refreshed.spec, charts } };
          }
        }

        const refreshedChartCount =
          refreshed.spec?.charts?.length ?? refreshed.charts?.length ?? 0;
        setDashboardDetail(refreshed);
        setChartOrderDraft(null);
        setSelectedDashboard((prev) =>
          prev && prev.dashboard_id === dashboardId
            ? { ...prev, chart_count: refreshedChartCount }
            : prev,
        );
        setDashboards((prev) =>
          prev.map((d) =>
            d.dashboard_id === dashboardId
              ? { ...d, chart_count: refreshedChartCount }
              : d,
          ),
        );
        toast.success('Chart added to dashboard');
      } catch (error) {
        toast.error(getDisplayErrorMessage(error, 'Failed to add chart to dashboard'));
      }
    },
    [dashboardDetail?.spec?.charts, selectedDashboard?.dashboard_id, selectedDashboard?.dashboard_type],
  );

  const handleOpenDashboardAi = useCallback(() => {
    const first = visibleChartDetails[0];
    const firstSlot = visibleSlotChartIds[0];
    if (!first || !tenantId || !domainId) return;
    setCognitoChatFromDashboardToolbar(true);
    setCognitoChart(first);
    setCognitoSlotChartId(firstSlot ?? null);
  }, [visibleChartDetails, visibleSlotChartIds, tenantId, domainId]);

  const openDashboardSlideshow = useCallback(() => {
    if (visibleChartDetails.length === 0) return;
    setExpandedView(null);
    setDashboardSlideshowOpen(true);
  }, [visibleChartDetails.length]);

  const allChartsModalTitle =
    dashboardDetail?.spec?.story?.title ??
    dashboardDetail?.title ??
    selectedDashboard?.title ??
    selectedDashboard?.name ??
    'Dashboard';

  return (
    <div className="flex flex-col h-full w-full">
      <div className="shrink-0 border-b bg-background px-2 py-1">
        
        {selectedDashboard ? (
          <div className="group flex w-full items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 shrink-0"
              onClick={handleBackToDashboards}
              title="Back to dashboards"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-[16px] font-semibold tracking-tight truncate">
                {dashboardDetail?.title ?? selectedDashboard.title ?? selectedDashboard.name ?? 'Dashboard'}
              </h1>
              <p className="text-xs text-muted-foreground truncate">
                {detailSubview === 'monitor'
                  ? `${dashboardDetail?.domain_id ?? selectedDashboard.domain_id} · Conversation monitor`
                  : detailSubview === 'trends'
                    ? `${dashboardDetail?.domain_id ?? selectedDashboard.domain_id} · Trends`
                  : hideChartCountInDetailHeader
                    ? `${dashboardDetail?.domain_id ?? selectedDashboard.domain_id}`
                    : `${dashboardDetail?.domain_id ?? selectedDashboard.domain_id} · ${(chartDetails.length || selectedDashboard.chart_count) ?? 0} charts`}
              </p>
            </div>
            <Button
              variant={dashboardEditMode ? 'default' : 'outline'}
              size="sm"
              className="!h-8 shrink-0 gap-1.5 px-2.5 text-xs"
              onClick={() => setDashboardEditMode((on) => !on)}
              title={
                dashboardEditMode
                  ? 'Done editing — hide delete, chart AI, and SQL edit'
                  : 'Edit dashboard — enable delete, chart AI, reorder, and SQL edit'
              }
            >
              {dashboardEditMode ? (
                <Check className="size-3.5 shrink-0" aria-hidden />
              ) : (
                <Pencil className="size-3.5 shrink-0" aria-hidden />
              )}
              {dashboardEditMode ? 'Done' : 'Edit'}
            </Button>
            {dashboardEditMode && selectedDashboard && isUserDashboard(selectedDashboard) && (
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={() => handleDeleteDashboard(selectedDashboard)}
                disabled={deletingDashboardId === selectedDashboard?.dashboard_id || !selectedDashboard?.dashboard_id}
                title="Delete dashboard"
              >
                {deletingDashboardId === selectedDashboard?.dashboard_id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </Button>
            )}
            {tenantId && (
              <Tabs
                value={detailSubview}
                onValueChange={(v) =>
                  setDetailSubview(v as 'dashboard' | 'monitor' | 'trends')
                }
                className="w-fit shrink-0 gap-0"
              >
                <TabsList
                  className={cn(
                    'h-8 gap-0 p-0.5',
                    showDataQualityTrendsTab ? 'inline-flex w-auto flex-nowrap' : '',
                  )}
                >
                  <TabsTrigger value="dashboard" className="gap-1.5 px-2.5 text-xs sm:text-sm" title="Dashboard charts">
                    <LayoutDashboard className="size-3.5" />
                    Dashboard
                  </TabsTrigger>
                  <TabsTrigger
                    value="monitor"
                    disabled={!domainId}
                    className="gap-1.5 px-2.5 text-xs sm:text-sm"
                    title={domainId ? 'Questions and answers for this domain' : 'Domain required'}
                  >
                    <Monitor className="size-3.5" />
                    Monitor
                  </TabsTrigger>
                  {showDataQualityTrendsTab ? (
                    <TabsTrigger
                      value="trends"
                      disabled={!domainId || !dataQualityRunIdForInsights}
                      className="gap-1.5 px-2.5 text-xs sm:text-sm"
                      title={
                        dataQualityRunIdForInsights
                          ? 'Metric trends for this quality run'
                          : 'Run id required for trends'
                      }
                    >
                      <TrendingUp className="size-3.5" />
                      Trends
                    </TabsTrigger>
                  ) : null}
                </TabsList>
              </Tabs>
            )}
            {tenantId && domainId && visibleChartDetails.length > 0 && (
              <button
                type="button"
                onClick={handleOpenDashboardAi}
                className=" !h-8 shrink-0 rounded-md border border-border/60 bg-background p-0.5 hover:bg-muted/60 transition-colors"
                title="Ask AI about this dashboard (no chart preview until you send a message; history via sidebar)"
              >
                <img src={AIimage} alt="" className="size-7 object-contain" aria-hidden />
                <span className="sr-only">Open AI for this dashboard</span>
              </button>
            )}
            {visibleChartDetails.length > 0 && (
              <Button
                variant="outline"
                size="icon"
                className="!h-8 w-8 shrink-0"
                onClick={openDashboardSlideshow}
                title="View all charts — 3 per row, scroll for more"
              >
                <Maximize2 className="size-4" />
                <span className="sr-only">Open all dashboard charts in a scrollable grid</span>
              </Button>
            )}
            {dataQualityRunIdForInsights && tenantId && domainId ? (
              <Button
                variant="outline"
                size="sm"
                className="!h-8 shrink-0 gap-1.5 px-2.5 text-xs"
                onClick={handleDownloadDataQualityExcel}
                disabled={dqExcelDownloading}
                title="Download data quality Excel report"
              >
                {dqExcelDownloading ? (
                  <Loader2 className="size-3.5 animate-spin shrink-0" />
                ) : (
                  <Download className="size-3.5 shrink-0" />
                )}
                Download
              </Button>
            ) : null}
            <Button
              variant="primary"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleRefreshDashboard}
              disabled={refreshingDashboard || !selectedDashboard?.dashboard_id}
              title="Refresh dashboard"
            >
              {refreshingDashboard ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            </Button>
            
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 flex-wrap p-0">
            <div className="flex items-center gap-2 min-w-0">
              <Button variant="outline" size="icon" className="h-8 w-8 shrink-0 border-none hover:bg-transparent !text-foreground" onClick={() => navigate('/exploratory-analysis/agentic-run')}>
                <ArrowLeft className="size-4" />
              </Button>
              <div>
                <TrendingUp className='h-4 w-4 text-primary'/>
              </div>
              <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
                Dashboards
              </h2>
            </div>
              <div className="flex items-center gap-2">
              <div className="w-56">
                <Combobox
                  options={tenantOptions}
                  value={tenantId}
                  onChange={(v) => {
                    setTenantId(String(v));
                    initialFetchDone.current = false;
                  }}
                  placeholder={tenantsLoading ? 'Loading tenants...' : 'Select tenant'}
                  searchPlaceholder="Search tenants..."
                  emptyText="No tenants found."
                  isLoading={tenantsLoading}
                  disabled={tenantsLoading}
                  className="!h-7.5"
                />
              </div>
              <Button
                variant="primary"
                size="icon"
                className="h-7.5 w-8 shrink-0"
                onClick={() => { initialFetchDone.current = false; loadDashboards(); }}
                disabled={loading || !tenantId}
                title="Refresh"
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              </Button>
              <Button
                variant="default"
                size="icon"
                className="h-7.5 w-40 shrink-0"
                onClick={() => {
                  const tenantName =
                    tenants.find((t) => t.tenant_id === tenantId)?.display_name ?? tenantId;
                  const firstDomainId = dashboards[0]?.domain_id;
                  navigate('/exploratory-analysis/agentic-run/create', {
                    state: {
                      tenantId,
                      tenantName,
                      ...(firstDomainId
                        ? { domainId: firstDomainId, domainName: firstDomainId }
                        : {}),
                    },
                  });
                }}
                disabled={!tenantId}
                title="New dashboard (agent chat)"
              >
                <Plus className="size-4" />
                <span>New dashboard</span>
              </Button>
         
            </div>
          </div>
        )}
      </div>

      <div
        className={cn(
          'flex-1 overflow-auto',
          dataQualitySingleColumnGrid
            ? 'bg-muted/100 p-4 sm:p-2 md:p-2'
            : 'p-2',
        )}
      >
        {selectedDashboard ? (
          <>
            {detailLoading && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">Loading dashboard...</p>
              </div>
            )}
            {!detailLoading && detailError && (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <p className="text-sm text-muted-foreground">Failed to load dashboard details</p>
                <Button variant="outline" size="sm" onClick={() => selectedDashboard && handleSelectDashboard(selectedDashboard)}>
                  Retry
                </Button>
              </div>
            )}
            {!detailLoading && !detailError && dashboardDetail && (
              detailSubview === 'monitor' && tenantId && domainId ? (
                <DashboardConversationMonitor tenantId={tenantId} domainId={domainId} />
              ) : detailSubview === 'trends' &&
                tenantId &&
                domainId.trim() &&
                dataQualityRunIdForInsights ? (
                <DataQualityTrendsView
                  tenantId={tenantId}
                  domainId={domainId.trim()}
                  runId={dataQualityRunIdForInsights}
                  padded={false}
                />
              ) : (
                <div className="relative rounded-lg">
                  <div
                    className={cn(
                      'rounded-lg transition-[filter,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[filter,transform]',
                      refreshingDashboard
                        ? getRefreshVisualClass(refreshPollStatus)
                        : 'blur-0 brightness-100 scale-100 saturate-100',
                    )}
                  >
                    {visibleChartDetails.length > 0 ? (
                      <DashboardChartsDetailView
                        chartDetails={visibleChartDetails}
                        slotChartIds={visibleSlotChartIds}
                        singleChartColumnLayout={dataQualitySingleColumnGrid}
                        dashboardEditMode={dashboardEditMode}
                        onReorderChartIds={dashboardEditMode ? setChartOrderDraft : undefined}
                        orderDirty={chartOrderDirty}
                        onSaveOrder={handleSaveChartOrder}
                        savingOrder={savingChartOrder}
                        onExpandChart={handleChartExpand}
                        getDrilldownUiForSlot={getDrilldownUiForSlot}
                        hideSqlInsightDrill={hideChartExplorationExtras}
                        onCognitoChart={
                          dashboardEditMode && tenantId && domainId
                            ? handleOpenCognitoChart
                            : undefined
                        }
                        onChartSqlChange={handleChartSqlChange}
                        canDeleteCharts={dashboardEditMode}
                        deletingChartId={deletingChartId}
                        onRequestDeleteChart={(detail, slotChartId) => {
                          const dashboardId = selectedDashboard?.dashboard_id;
                          if (!dashboardId) return;
                          setDeleteDialogChart({
                            dashboardId,
                            chartId: slotChartId,
                            title: detail.title ?? detail.metric_name ?? slotChartId,
                          });
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 gap-2">
                        <BarChart3 className="size-10 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">No chart data for this dashboard</p>
                      </div>
                    )}
                  </div>
                  {refreshingDashboard && <DashboardRefreshOverlay status={refreshPollStatus} />}
                </div>
              )
            )}
            <BaseModal
              open={dashboardSlideshowOpen}
              setOpen={(open) => {
                if (!open) setDashboardSlideshowOpen(false);
              }}
              size="x-large"
              className="max-w-[95vw]"
            >
              <BaseModal.Header
                // description={`Three charts per row. Scroll vertically to see all ${mergedChartDetails.length} chart${mergedChartDetails.length === 1 ? '' : 's'}.`}
              >
                {allChartsModalTitle} · {visibleChartDetails.length} chart
                {visibleChartDetails.length === 1 ? '' : 's'}
              </BaseModal.Header>
              <BaseModal.Content overflowHidden className="min-h-0 flex flex-1 flex-col">
                <div
                  className={cn(
                    'min-h-0 max-h-[min(88vh,920px)] flex-1 overflow-y-auto overflow-x-hidden pr-1 [scrollbar-gutter:stable]',
                    dataQualitySingleColumnGrid && 'bg-muted',
                  )}
                >
                  <div
                    className={cn(
                      'grid grid-cols-1 gap-2 pb-2',
                      !dataQualitySingleColumnGrid && 'md:grid-cols-3',
                    )}
                  >
                    {visibleChartDetails.map((detail, i) => (
                      <DashboardSingleChartCard
                        key={visibleSlotChartIds[i]}
                        detail={detail}
                        chartSlotId={visibleSlotChartIds[i]}
                        compact
                        onExpand={handleChartExpand}
                        dashboardEditMode={dashboardEditMode}
                        onCognitoClick={
                          dashboardEditMode && tenantId && domainId
                            ? (d) => handleOpenCognitoChart(d, visibleSlotChartIds[i])
                            : undefined
                        }
                        canDelete={dashboardEditMode}
                        deleting={deletingChartId === visibleSlotChartIds[i]}
                        onDelete={() => {
                          const dashboardId = selectedDashboard?.dashboard_id;
                          if (!dashboardId) return;
                          setDeleteDialogChart({
                            dashboardId,
                            chartId: visibleSlotChartIds[i],
                            title: detail.title ?? detail.metric_name ?? visibleSlotChartIds[i],
                          });
                        }}
                        onSqlChange={(sql) => handleChartSqlChange(visibleSlotChartIds[i], sql)}
                      />
                    ))}
                  </div>
                </div>
              </BaseModal.Content>
            </BaseModal>

            <BaseModal
              open={!!expandedView}
              setOpen={(open) => {
                if (!open) setExpandedView(null);
              }}
              size="x-large"
              className="max-w-4xl"
            >
              <BaseModal.Header description={expandedModalDetail?.intent ?? ''}>
                {expandedChartModalHeadline ||
                  expandedModalDetail?.metric_name ||
                  expandedModalDetail?.title ||
                  'Chart'}
              </BaseModal.Header>
              <BaseModal.Content>
                {expandedModalDetail && expandedView ? (
                  <DashboardChartExpandedModalContent
                    key={expandedView.slotChartId}
                    detail={expandedModalDetail}
                    drilldownUi={getDrilldownUiForSlot(expandedView.slotChartId)}
                    drilldownScopeKey={expandedView.slotChartId}
                    initialTab={expandedView.tab}
                    hideSqlInsightDrill={hideChartExplorationExtras}
                    dashboardEditMode={dashboardEditMode}
                    onSqlChange={(sql) => handleChartSqlChange(expandedView.slotChartId, sql)}
                  />
                ) : null}
              </BaseModal.Content>
            </BaseModal>

            {cognitoChart && workspaceChatSidebarChartDetail && tenantId && domainId ? (
              <WorkspaceChartChatSidebar
                tenantId={tenantId}
                domainId={domainId}
                chart={workspaceChatSidebarChartDetail}
                hideEmptyStateChartPreview={cognitoChatFromDashboardToolbar}
                chatHeaderTitle={
                  cognitoChatFromDashboardToolbar ? 'Ask about this dashboard' : undefined
                }
                chatHeaderContext={
                  cognitoChatFromDashboardToolbar ? allChartsModalTitle : undefined
                }
                chatComposerPlaceholder={
                  cognitoChatFromDashboardToolbar
                    ? "Ask anything about this dashboard's charts and data..."
                    : undefined
                }
                domainScopedConversationHistory={cognitoChatFromDashboardToolbar}
                drilldownUi={
                  isDashboardAgentDashboard && cognitoSlotChartId
                    ? getDrilldownUiForSlot(cognitoSlotChartId)
                    : undefined
                }
                drilldownScopeKey={cognitoSlotChartId ?? undefined}
                onClose={() => {
                  setCognitoChart(null);
                  setCognitoSlotChartId(null);
                  setCognitoChatFromDashboardToolbar(false);
                }}
                onChartReplaced={(replaced) => {
                  setCognitoChart((prev) => (prev ? replaced : null));
                  if (
                    isDashboardAgentDashboard &&
                    cognitoSlotChartId &&
                    replaced.chart_id?.trim()
                  ) {
                    void ensureChartActionsForSlot(cognitoSlotChartId, replaced.chart_id);
                  }
                }}
                onChartCommitted={handleCommitWorkspaceChartToDashboard}
                currentDashboardId={selectedDashboard?.dashboard_id}
                isDataQualityDashboard={isDataQualityDashboard}
              />
            ) : null}
          </>
        ) : (
          <>
            {loading && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">Loading dashboards...</p>
              </div>
            )}

            {!loading && error && (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <p className="text-sm text-muted-foreground">Failed to load dashboards</p>
                <Button variant="outline" size="sm" onClick={loadDashboards}>
                  Retry
                </Button>
              </div>
            )}

            {!tenantId && (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <LayoutDashboard className="size-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Select a tenant above to view dashboards</p>
              </div>
            )}

            {tenantId && !loading && !error && dashboards.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <LayoutDashboard className="size-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No dashboards for this tenant</p>
              </div>
            )}

            {!loading && !error && dashboards.length > 0 && hideInsightsListTabs && (
              <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {dashboards.map((d) => (
                  <InsightsDashboardGridCard
                    key={d.dashboard_id}
                    d={d}
                    deletingDashboardId={deletingDashboardId}
                    onSelect={handleSelectDashboard}
                    onRequestDelete={handleDeleteDashboard}
                  />
                ))}
              </div>
            )}

            {!loading && !error && dashboards.length > 0 && !hideInsightsListTabs && (
              <Tabs
                value={insightsListTab}
                onValueChange={(v) => setInsightsListTab(v as InsightsListTab)}
                className="w-full gap-0"
              >
                <TabsList className="grid !h-9 w-full max-w-2xl grid-cols-1 gap-1 bg-muted sm:grid-cols-3">
                  {(
                    [
                      { key: 'correlation' as const, label: 'Correlation Dashboard' },
                      { key: 'dashboard_agent' as const, label: 'Dashboard Agent' },
                      { key: 'anomaly' as const, label: 'Anomaly' },
                    ] as const
                  ).map(({ key, label }) => {
                    const cfg = INSIGHTS_TAB_ICONS[key];
                    const TabIcon = cfg.Icon;
                    return (
                      <TabsTrigger
                        key={key}
                        value={key}
                        className={cn(
                          'gap-1.5 px-2 py-1 text-xs font-medium sm:text-sm',
                          cfg.tabTriggerActive,
                        )}
                      >
                        <TabIcon className={cn('size-4 shrink-0', cfg.iconClass)} aria-hidden />
                        <span className="truncate">{label}</span>
                        <Badge
                          variant="secondary"
                          className={cn(
                            'ml-0.5 h-5 min-w-5 shrink-0 justify-center px-1.5 text-[10px]',
                            cfg.badgeClass,
                          )}
                        >
                          {dashboardsByTab[key].length}
                        </Badge>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                {(['correlation', 'dashboard_agent', 'anomaly'] as const).map((tabKey) => {
                  const ec = INSIGHTS_TAB_ICONS[tabKey];
                  const EmptyIcon = ec.Icon;
                  return (
                  <TabsContent key={tabKey} value={tabKey} className="mt-0 outline-none">
                    {dashboardsByTab[tabKey].length === 0 ? (
                      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-14 text-center">
                        <EmptyIcon className={cn('size-12', ec.iconClass)} aria-hidden />
                        <p className="mt-3 text-sm font-medium text-foreground">No dashboards in this tab</p>
                        <p className="mt-1 max-w-md px-4 text-xs text-muted-foreground">
                          {tabKey === 'correlation' &&
                            'Titles containing “correlation” are grouped here.'}
                          {tabKey === 'dashboard_agent' &&
                            'User dashboards and dashboards from an agent run appear here.'}
                          {tabKey === 'anomaly' &&
                            'Titles mentioning “anomaly” or “outlier” are grouped here.'}
                        </p>
                      </div>
                    ) : (
                      <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {dashboardsByTab[tabKey].map((d) => (
                          <InsightsDashboardGridCard
                            key={d.dashboard_id}
                            d={d}
                            deletingDashboardId={deletingDashboardId}
                            onSelect={handleSelectDashboard}
                            onRequestDelete={handleDeleteDashboard}
                          />
                        ))}
                      </div>
                    )}
                  </TabsContent>
                );
                })}
              </Tabs>
            )}
          </>
        )}
      </div>

      <AlertDialog
        open={!!deleteDialogDashboard}
        onOpenChange={(open) => {
          if (!open) setDeleteDialogDashboard(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete dashboard?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{' '}
              <span className="font-medium text-foreground">
                {deleteDialogDashboard?.title ?? deleteDialogDashboard?.name ?? deleteDialogDashboard?.dashboard_id}
              </span>
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className='!h-8'>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive', className: '!h-8' })} 
              onClick={(e) => {
                e.preventDefault();
                const d = deleteDialogDashboard;
                setDeleteDialogDashboard(null);
                if (d) void performDeleteDashboard(d);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

      <AlertDialog
        open={!!deleteDialogChart}
        onOpenChange={(open) => {
          if (!open) setDeleteDialogChart(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove chart from dashboard?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove{' '}
              <span className="font-medium text-foreground">{deleteDialogChart?.title}</span> from this dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="!h-8">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive', className: '!h-8' })}
              onClick={(e) => {
                e.preventDefault();
                const dashboardId = deleteDialogChart?.dashboardId;
                const chartId = deleteDialogChart?.chartId;
                setDeleteDialogChart(null);
                if (dashboardId && chartId) void performDeleteChart(dashboardId, chartId);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SortableChartGridItem({
  id,
  detail,
  chartSlotId,
  onExpand,
  onCognitoClick,
  canDelete,
  deleting,
  onDelete,
  hideSqlInsightDrill,
  dashboardEditMode,
  onSqlChange,
}: {
  id: string;
  detail: ChartDetail;
  chartSlotId: string;
  onExpand: (d: ChartDetail, tab: DashboardCardTab, slotChartId: string) => void;
  onCognitoClick?: (d: ChartDetail) => void;
  canDelete?: boolean;
  deleting?: boolean;
  onDelete?: () => void;
  hideSqlInsightDrill?: boolean;
  dashboardEditMode?: boolean;
  onSqlChange?: (sql: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !dashboardEditMode,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.92 : undefined,
    zIndex: isDragging ? 2 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} className="min-w-0">
      <DashboardSingleChartCard
        detail={detail}
        chartSlotId={chartSlotId}
        onExpand={onExpand}
        onCognitoClick={onCognitoClick}
        canDelete={canDelete}
        deleting={deleting}
        onDelete={onDelete}
        hideSqlInsightDrill={hideSqlInsightDrill}
        dashboardEditMode={dashboardEditMode}
        onSqlChange={onSqlChange}
        dragHandle={
          dashboardEditMode ? (
            <button
              type="button"
              className={cn(
                'touch-none rounded p-0.5 text-muted-foreground',
                'hover:bg-muted/60 hover:text-foreground',
                'cursor-grab active:cursor-grabbing',
                isDragging && 'bg-muted/40 text-foreground',
              )}
              {...attributes}
              {...listeners}
              title="Drag to reorder"
              aria-label="Drag to reorder chart"
            >
              <GripVertical className="size-4 shrink-0" aria-hidden />
            </button>
          ) : undefined
        }
      />
    </div>
  );
}

interface DashboardChartsDetailViewProps {
  chartDetails: ChartDetail[];
  /** Same length as `chartDetails` — stable dashboard spec chart ids (DnD, actions, overrides). */
  slotChartIds: string[];
  /** Data-quality dashboards: one chart per row (full width). */
  singleChartColumnLayout?: boolean;
  dashboardEditMode?: boolean;
  onExpandChart: (detail: ChartDetail, tab: DashboardCardTab, slotChartId: string) => void;
  /** Drill wiring for expanded chart only (not inline cards). */
  getDrilldownUiForSlot?: (slotChartId: string) => ChartDrilldownUiHandlers | undefined;
  /** Correlation dashboards: Chart + Table only (no SQL, Insight, or drill). */
  hideSqlInsightDrill?: boolean;
  onCognitoChart?: (detail: ChartDetail, slotChartId: string) => void;
  onChartSqlChange?: (slotChartId: string, sql: string) => void;
  canDeleteCharts?: boolean;
  deletingChartId?: string | null;
  onRequestDeleteChart?: (detail: ChartDetail, slotChartId: string) => void;
  onReorderChartIds?: (ids: string[]) => void;
  orderDirty?: boolean;
  onSaveOrder?: () => void;
  savingOrder?: boolean;
}

function DashboardChartsDetailView({
  chartDetails,
  slotChartIds,
  singleChartColumnLayout = false,
  dashboardEditMode = false,
  onExpandChart,
  getDrilldownUiForSlot,
  hideSqlInsightDrill = false,
  onCognitoChart,
  onChartSqlChange,
  canDeleteCharts,
  deletingChartId,
  onRequestDeleteChart,
  onReorderChartIds,
  orderDirty,
  onSaveOrder,
  savingOrder,
}: DashboardChartsDetailViewProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  /** Charts are always visible (no collapse). Kept so `{expanded && …}` in JSX never throws if partially merged. */
  const expanded = true;

  const orderedIds = slotChartIds;

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!onReorderChartIds) return;
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = orderedIds.indexOf(String(active.id));
      const newIndex = orderedIds.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return;
      onReorderChartIds(arrayMove(orderedIds, oldIndex, newIndex));
    },
    [orderedIds, onReorderChartIds],
  );

  if (!chartDetails.length) {
    return null;
  }

  const chartCards = chartDetails.map((detail, index) => {
    const slotChartId = slotChartIds[index] ?? detail.chart_id;
    return (
      <SortableChartGridItem
        key={slotChartId}
        id={slotChartId}
        detail={detail}
        chartSlotId={slotChartId}
        onExpand={onExpandChart}
        onCognitoClick={onCognitoChart ? (d) => onCognitoChart(d, slotChartId) : undefined}
        canDelete={canDeleteCharts}
        deleting={deletingChartId === slotChartId}
        onDelete={
          canDeleteCharts && onRequestDeleteChart
            ? () => onRequestDeleteChart(detail, slotChartId)
            : undefined
        }
        hideSqlInsightDrill={hideSqlInsightDrill}
        dashboardEditMode={dashboardEditMode}
        onSqlChange={onChartSqlChange ? (sql) => onChartSqlChange(slotChartId, sql) : undefined}
      />
    );
  });

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        {orderDirty && onSaveOrder && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/25 bg-primary/5 px-3 py-1">
            <p className="text-xs text-muted-foreground">Chart order has changed.</p>
            <Button
              type="button"
              size="sm"
              className="!h-8"
              onClick={onSaveOrder}
              disabled={savingOrder}
            >
              {savingOrder ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />
              ) : null}
              Save order
            </Button>
          </div>
        )}
        {expanded && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={orderedIds} strategy={rectSortingStrategy}>
              <div
                className={cn(
                  'grid grid-cols-1 gap-2',
                  !singleChartColumnLayout && 'md:grid-cols-2',
                )}
              >
                {chartCards}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}

// ─── Original Insights component (commented out) ─────────────────────────────────
/*
type Insight = {
  id: string
  priority: 'High' | 'Medium' | 'Low'
  title: string
  subtitle?: string
  confidence?: number
  time?: string
}

const MOCK_DATA: Insight[] = [
  { id: '1', priority: 'High', title: 'Sales dip in Tenali', subtitle: 'Product X is main driver', confidence: 0.86, time: '2 hours ago' },
  { id: '2', priority: 'Medium', title: 'Pace risk detected in 3 sales areas', subtitle: 'May miss monthly targets', confidence: 0.72, time: '5 hours ago' },
  { id: '3', priority: 'Medium', title: 'Product Y outperforming in North region', subtitle: 'Exceeding forecast by 12%', confidence: 0.78, time: '1 day ago' },
]

export default function Insights({ dataUrl }: { dataUrl?: string }) {
  const [data, setData] = useState<Insight[]>(MOCK_DATA)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Insight | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  ... (rest of original component with grouped High/Medium/Low and detail card)
}
*/
