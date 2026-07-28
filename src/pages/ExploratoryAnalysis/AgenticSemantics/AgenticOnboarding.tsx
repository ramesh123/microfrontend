import { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2,
  Search,
  Database,
  FileCode2,
  FileText,
  LayoutDashboard,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Sparkles,
  Bot,
  WifiOff,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { useEventSource } from '@/hooks/useEventSource';
import { getAgenticStreamUrl, fetchAgenticRunEvents, type AgenticRunEvent } from '@/controllers/API/agenticApi';
import { AGENT_RENDERER_MAP } from './AgentRenderers';
import type { ChartDetail } from './chartTypes';
import {
  WorkspaceChartChatSidebar,
  mergeChartOverridesIntoArtifacts,
} from './WorkspaceChartChatSidebar';
import { DataQualityRulesReviewPanel } from './DataQualityRulesReviewPanel';
import type { TenantInfo, SchemaPayload } from './index';

// --- Constants ---

/** GET /agentic/runs/{id}/events poll interval; polling stops when a terminal dashboard agent completes */
const AGENTIC_EVENTS_POLL_INTERVAL_MS = 2_000;

const RECOGNIZED_AGENTS = [
  'PlanningAgent',
  'HierarchyBootstrapAgent',
  'SchemaAgent',
  'ProfilingAgent',
  'ContextAgent',
  'OntologyAgent',
  'GlossaryAgent',
  'JoinAgent',
  'MetricAgent',
  'SemanticModelAgent',
  'RollupPlannerAgent',
  'ChartPlannerAgent',
  'QualityGateAgent',
  'DashboardAgent',
  'AnomalyDetectionAgent',
  'AnomalyDashboardAgent',
  'CorrelationAgent',
  'CorrelationDashboardAgent',
] as const;

/**
 * Map live/event agent_name strings to canonical RECOGNIZED_AGENTS keys (same intent as AgenticChatHistory
 * getRendererKey + icon aliases: spaces removed, PlannerAgent → PlanningAgent, DashboardStoryAgent → DashboardAgent).
 */
function effectiveAgentName(agentName: string): string {
  const trimmed = (agentName ?? '').trim();
  if (!trimmed) return trimmed;
  const noSpace = trimmed.replace(/\s+/g, '');
  if (noSpace === 'DashboardStoryAgent') return 'DashboardAgent';
  if (noSpace === 'PlannerAgent') return 'PlanningAgent';
  return noSpace;
}

/**
 * True when an event belongs to the data-quality pack — not the standard semantic pack.
 * Do not key off AnomalyDetectionAgent (also runs at the end of semantic builds).
 * Matches AgenticChatHistory.rowIndicatesDataQualityWorkflow.
 */
function rowIndicatesDataQualityWorkflow(
  agentName: string | null | undefined,
  artifacts?: Record<string, unknown> | null,
): boolean {
  const an = agentName ? effectiveAgentName(agentName) : '';
  if (
    an === 'DataQualityWorkflowRouter' ||
    an === 'DataQualitySchemaAgent' ||
    an === 'DatasetStagePlannerAgent' ||
    an === 'DataQualityProfilingAgent' ||
    an === 'DuplicateDetectionAgent' ||
    an === 'FreshnessAndStabilityAgent' ||
    an === 'DataQualityRuleAgent' ||
    an === 'DataQualityReviewGate' ||
    an === 'DataEnrichmentOpportunityAgent' ||
    an === 'DataTrustScoringAgent' ||
    an === 'TrendAnalysisAgent' ||
    an === 'IssueRegisterAgent' ||
    an === 'DataQualityDashboardAgent'
  ) {
    return true;
  }
  return artifacts?.workflow_kind === 'data_quality';
}

/** Workspace domain id for the data quality observability pack (matches backend domain_id). */
const DATA_QUALITY_OBSERVABILITY_DOMAIN_ID = 'data_quality_observability';

const DATA_QUALITY_PIPELINE_AGENTS = [
  'PlanningAgent',
  'DataQualityWorkflowRouter',
  'DataQualitySchemaAgent',
  'DatasetStagePlannerAgent',
  'DataQualityProfilingAgent',
  'DuplicateDetectionAgent',
  'FreshnessAndStabilityAgent',
  'DataQualityRuleAgent',
  'DataQualityReviewGate',
  'DataEnrichmentOpportunityAgent',
  'DataTrustScoringAgent',
  'TrendAnalysisAgent',
  'AnomalyDetectionAgent',
  'IssueRegisterAgent',
  'DataQualityDashboardAgent',
] as const;

/** Dashboard-style terminal statuses (shared with DataQualityDashboardAgent). */
function isDashboardTerminalEvent(status: string): boolean {
  if (status === 'completed' || status === 'failed') return true;
  return status === 'raw_json_ready' || status === 'summary_ready';
}

/**
 * Stop live poll when the run is waiting on the user, or when the last event shows a finished phase.
 * `awaiting_rule_review` is terminal only if no later events exist (resume appends after the gate).
 * Full DQ pack ends when **DataQualityDashboardAgent** reaches a terminal status after trend / anomaly / issue-register steps (stops GET /events polling).
 */
function dataQualityRunTerminal(events: AgenticRunEvent[]): boolean {
  if (events.length === 0) return false;
  const sorted = [...events].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const awaitingIdx = sorted.findIndex(
    (evt) =>
      effectiveAgentName(evt.agent_name) === 'DataQualityReviewGate' &&
      evt.status === 'awaiting_rule_review'
  );
  if (awaitingIdx >= 0 && sorted.slice(awaitingIdx + 1).length === 0) {
    return true;
  }

  const last = sorted[sorted.length - 1]!;
  const lastKey = effectiveAgentName(last.agent_name);
  const st = (last.status ?? '').toString();

  if (lastKey === 'DataQualityReviewGate') {
    return st === 'completed' || st === 'failed';
  }

  const hasDashboard = sorted.some((e) => effectiveAgentName(e.agent_name) === 'DataQualityDashboardAgent');
  const hasTrust = sorted.some((e) => effectiveAgentName(e.agent_name) === 'DataTrustScoringAgent');

  if (lastKey === 'DataQualityDashboardAgent') {
    return isDashboardTerminalEvent(st);
  }
  if (!hasDashboard && lastKey === 'DataTrustScoringAgent') {
    return st === 'completed' || st === 'failed';
  }
  if (!hasDashboard && !hasTrust && lastKey === 'DataEnrichmentOpportunityAgent') {
    return st === 'completed' || st === 'failed';
  }

  if (lastKey === 'DataQualityRuleAgent') {
    if (st === 'needs_review') return true;
    if (st === 'completed' || st === 'failed') {
      const seenPostRule = sorted.some((e) =>
        [
          'DataEnrichmentOpportunityAgent',
          'DataTrustScoringAgent',
          'TrendAnalysisAgent',
          'AnomalyDetectionAgent',
          'IssueRegisterAgent',
          'DataQualityDashboardAgent',
        ].includes(effectiveAgentName(e.agent_name))
      );
      return !seenPostRule;
    }
  }
  return false;
}

/** True when the latest DataQualityDashboardAgent event is terminal (run finished with dashboard). */
function dataQualityDashboardTerminalReached(events: AgenticRunEvent[]): boolean {
  const dash = events.filter((e) => effectiveAgentName(e.agent_name) === 'DataQualityDashboardAgent');
  if (dash.length === 0) return false;
  const sorted = [...dash].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const last = sorted[sorted.length - 1]!;
  return isDashboardTerminalEvent(String(last.status ?? ''));
}

/** True when the latest AnomalyDashboardAgent event is terminal (aligns with SSE / card completion). */
function anomalyDashboardTerminalInEvents(events: AgenticRunEvent[]): boolean {
  const dash = events.filter((e) => effectiveAgentName(e.agent_name) === 'AnomalyDashboardAgent');
  if (dash.length === 0) return false;
  const sorted = [...dash].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const last = sorted[sorted.length - 1]!;
  return isDashboardTerminalEvent(String(last.status ?? ''));
}

/**
 * When the DQ progress bar may show 100%. Never true for review-gate / rule-agent human pauses
 * (`dataQualityRunTerminal` is still true there, which previously forced 100% incorrectly).
 */
function dataQualityProgressAllowFull(events: AgenticRunEvent[]): boolean {
  if (dataQualityDashboardTerminalReached(events)) return true;
  if (events.length === 0) return false;
  const sorted = [...events].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const last = sorted[sorted.length - 1]!;
  const lastKey = effectiveAgentName(last.agent_name);
  const st = String(last.status ?? '');
  const hasDashboard = sorted.some((e) => effectiveAgentName(e.agent_name) === 'DataQualityDashboardAgent');
  const hasTrust = sorted.some((e) => effectiveAgentName(e.agent_name) === 'DataTrustScoringAgent');

  if (
    !hasDashboard &&
    !hasTrust &&
    lastKey === 'DataEnrichmentOpportunityAgent' &&
    (st === 'completed' || st === 'failed')
  ) {
    return true;
  }
  return false;
}

/** Derive planning steps from system narration when artifacts omit steps (matches AgenticChatHistory). */
function parsePlanCreatedStepsFromText(text: string): string[] {
  if (!text.includes('Plan created:')) return [];
  const match = text.match(/Plan created:\s*(.+)/);
  const stepsStr = match?.[1]?.trim();
  if (!stepsStr) return [];
  return stepsStr.split(/\s*;\s*/).map((s) => s.trim()).filter(Boolean);
}

// --- Types ---

type EventStatus = 'pending' | 'running' | 'complete' | 'error';
type IconKey = 'search' | 'database' | 'code' | 'report' | 'dashboard' | 'model' | 'warning';

/** Ready statuses that carry artifacts to show (inference/summary/raw_json) before "completed" */
const ARTIFACT_READY_STATUSES = new Set<string>(['inference_ready', 'summary_ready', 'raw_json_ready']);

interface AgentStreamChunk {
  id: string;
  content: string;
  timestamp: number;
}

interface AgentState {
  agentName: string;
  status: 'running' | 'ready' | 'completed' | 'failed';
  runningMessage: string;
  completedEvent: AgenticRunEvent | null;
  /** First activity time for ordering; see activitySortTs */
  timestamp: number;
  /** Latest activity (stream or status update) for timeline sort — keeps cards aligned with stream time */
  activitySortTs: number;
  /** Token / line stream attributed to this agent (not shown as global grey lines) */
  streamChunks: AgentStreamChunk[];
}

interface SystemMessage {
  id: string;
  content: string;
  timestamp: number;
}

function getPlanningStepsFallback(systemMessages: SystemMessage[]): string[] {
  for (const msg of systemMessages) {
    const steps = parsePlanCreatedStepsFromText(msg.content);
    if (steps.length > 0) return steps;
  }
  return [];
}

/** When API artifacts omit `steps`, merge fallback from "Plan created:" system lines. */
function mergePlanningArtifactsIfNeeded(
  agentName: string,
  baseArtifacts: Record<string, unknown> | null,
  rawArtifacts: Record<string, unknown> | null,
  fallbackSteps: string[] | undefined
): Record<string, unknown> | null {
  if (agentName !== 'PlanningAgent' || !fallbackSteps?.length) return baseArtifacts;
  const rawSteps = rawArtifacts && Array.isArray((rawArtifacts as { steps?: unknown }).steps)
    ? ((rawArtifacts as { steps: string[] }).steps)
    : [];
  const parsedSteps =
    baseArtifacts && Array.isArray((baseArtifacts as { steps?: unknown }).steps)
      ? ((baseArtifacts as { steps: string[] }).steps)
      : [];
  if (rawSteps.length > 0 || parsedSteps.length > 0) return baseArtifacts;
  return { ...(baseArtifacts ?? {}), steps: fallbackSteps };
}

// --- Agent name → icon mapping ---

const AGENT_ICON_MAP: Record<string, IconKey> = {
  PlanningAgent: 'search',
  HierarchyBootstrapAgent: 'database',
  SchemaAgent: 'database',
  ProfilingAgent: 'database',
  ContextAgent: 'search',
  GlossaryAgent: 'code',
  JoinAgent: 'code',
  MetricAgent: 'model',
  SemanticModelAgent: 'model',
  RollupPlannerAgent: 'code',
  ChartPlannerAgent: 'report',
  DashboardStoryAgent: 'dashboard',
  DashboardAgent: 'dashboard',
  AnomalyDetectionAgent: 'warning',
  AnomalyDashboardAgent: 'dashboard',
  CorrelationAgent: 'report',
  CorrelationDashboardAgent: 'dashboard',
  QualityGateAgent: 'search',
  OntologyAgent: 'model',
  DataQualityWorkflowRouter: 'search',
  DataQualitySchemaAgent: 'database',
  DatasetStagePlannerAgent: 'search',
  DataQualityProfilingAgent: 'database',
  DuplicateDetectionAgent: 'warning',
  FreshnessAndStabilityAgent: 'report',
  DataQualityRuleAgent: 'code',
  DataQualityReviewGate: 'warning',
  DataEnrichmentOpportunityAgent: 'model',
  DataTrustScoringAgent: 'model',
  TrendAnalysisAgent: 'report',
  IssueRegisterAgent: 'code',
  DataQualityDashboardAgent: 'dashboard',
  system: 'search',
};

// --- Icon component ---

function EventIcon({ icon, className }: { icon: IconKey; className?: string }) {
  const cls = cn('size-3.5 shrink-0', className);
  switch (icon) {
    case 'search':
      return <Search className={cls} />;
    case 'database':
      return <Database className={cls} />;
    case 'code':
      return <FileCode2 className={cls} />;
    case 'report':
      return <FileText className={cls} />;
    case 'dashboard':
      return <LayoutDashboard className={cls} />;
    case 'model':
      return <Sparkles className={cls} />;
    case 'warning':
      return <AlertTriangle className={cls} />;
    default:
      return <CheckCircle2 className={cls} />;
  }
}

// --- Agent name formatter ---

function formatAgentName(name: string): string {
  return name.replace(/([A-Z])/g, ' $1').trim();
}

// --- Animation variants ---

const runningCardVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, x: -30, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0, overflow: 'hidden' as const },
};

const completedCardVariants = {
  initial: { opacity: 0, y: 12, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
};

const systemMsgVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
};

function AgentStreamLog({ chunks, className }: { chunks: AgentStreamChunk[]; className?: string }) {
  if (chunks.length === 0) return null;
  return (
    <div className={cn('rounded-md border border-border/40 bg-muted/15 px-2 py-1.5 space-y-1', className)}>
      <p className="text-[10px] font-medium text-muted-foreground">Stream</p>
      <div className="space-y-0.5 max-h-[200px] overflow-y-auto pr-0.5 [scrollbar-gutter:stable]">
        {chunks.map((c) => (
          <p key={c.id} className="text-[11px] text-muted-foreground whitespace-pre-wrap break-words leading-relaxed">
            {c.content}
          </p>
        ))}
      </div>
    </div>
  );
}

/** `dashboard_id` for Insights deep-link (top-level or inside `raw_json`). */
function dataQualityDashboardIdFromArtifacts(
  raw: Record<string, unknown> | null | undefined
): string {
  if (!raw || typeof raw !== 'object') return '';
  const pick = (obj: Record<string, unknown>) => {
    const id = obj.dashboard_id;
    return typeof id === 'string' && id.trim() ? id.trim() : '';
  };
  const top = pick(raw);
  if (top) return top;
  const rj = raw.raw_json;
  if (rj && typeof rj === 'object' && !Array.isArray(rj)) {
    return pick(rj as Record<string, unknown>);
  }
  return '';
}

function DataQualityDashboardOpenInInsights({
  tenantId,
  tenantName,
  dashboardId,
  dashboardTitle,
  chartsCount,
  viewsCount,
}: {
  tenantId: string;
  tenantName: string;
  dashboardId: string;
  dashboardTitle: string;
  chartsCount: number | null;
  viewsCount: number | null;
}) {
  const navigate = useNavigate();
  const onClick = useCallback(() => {
    navigate('/exploratory-analysis/insights', {
      state: {
        tenantId,
        tenantName,
        openDashboardId: dashboardId,
      },
    });
  }, [navigate, tenantId, tenantName, dashboardId]);

  return (
    <div className="rounded-md border border-border/50 bg-muted/20 px-3 py-2.5 space-y-2 text-xs">
      {dashboardTitle ? <p className="font-medium text-foreground">{dashboardTitle}</p> : null}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
        {chartsCount != null && chartsCount >= 0 ? (
          <span>
            {chartsCount} {chartsCount === 1 ? 'chart' : 'charts'}
          </span>
        ) : null}
        {viewsCount != null && viewsCount > 0 ? (
          <span>
            {viewsCount} {viewsCount === 1 ? 'view' : 'views'}
          </span>
        ) : null}
      </div>
      <Button type="button" size="sm" className="h-8 gap-1.5 text-xs" onClick={onClick}>
        <LayoutDashboard className="size-3.5 shrink-0" />
        View dashboard
      </Button>
    </div>
  );
}

function firstMeaningfulLine(text: string): string {
  const line = text
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return line ?? '';
}

/** Collapsed row subtitle: prefer first line of summary/inference when API message is generic */
function getAccordionSubtitle(event: AgenticRunEvent): string | null {
  const msg = (event.message ?? '').trim();
  const raw = event.artifacts as Record<string, unknown> | null;
  const summary =
    (typeof raw?.summary_raw_text === 'string' && raw.summary_raw_text.trim()) ||
    (typeof raw?.summary === 'string' && String(raw.summary).trim()) ||
    '';
  const inference =
    (typeof raw?.inference_raw_text === 'string' && raw.inference_raw_text.trim()) ||
    (typeof raw?.inference === 'string' && String(raw.inference).trim()) ||
    '';
  const generic =
    !msg ||
    /^(?:[\w\s]+ )?(?:[Aa]gent )?completed\.?$/i.test(msg) ||
    /^ready\.?$/i.test(msg);
  if (generic && summary) {
    const line = firstMeaningfulLine(summary);
    if (line) return line.length > 160 ? `${line.slice(0, 157)}…` : line;
  }
  if (generic && inference && !summary) {
    const line = firstMeaningfulLine(inference);
    if (line) return line.length > 160 ? `${line.slice(0, 157)}…` : line;
  }
  return msg || null;
}

/** Unwrap CorrelationAgent `artifacts.raw_json` for highlight lines. */
function parsedCorrelationMetrics(raw: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!raw?.raw_json || typeof raw.raw_json !== 'object' || Array.isArray(raw.raw_json)) return null;
  return raw.raw_json as Record<string, unknown>;
}

/** Top summary line for Schema / Profiling / Context cards (aligned with AgentRenderers artifact fields). */
function getAgentHighlightLine(
  agentName: string,
  phase: 'running' | 'ready' | 'completed',
  event: AgenticRunEvent | null
): string | null {
  if (agentName === 'HierarchyBootstrapAgent') {
    const raw = event?.artifacts as Record<string, unknown> | null | undefined;
    const parsed = raw ? getArtifactsForRenderer(raw, event?.status) : null;
    const rj =
      parsed ??
      (raw?.raw_json != null &&
      typeof raw.raw_json === 'object' &&
      !Array.isArray(raw.raw_json)
        ? (raw.raw_json as Record<string, unknown>)
        : null);
    const ids = Array.isArray(rj?.hierarchy_ids) ? (rj.hierarchy_ids as unknown[]).length : 0;
    const domain = typeof rj?.domain_id === 'string' ? rj.domain_id.trim() : '';
    const persisted = typeof rj?.persisted_count === 'number' ? rj.persisted_count : null;
    if (domain && ids > 0) {
      return `Hierarchy bootstrap: ${domain} · ${ids} ${ids === 1 ? 'hierarchy' : 'hierarchies'}${
        persisted != null ? ` · ${persisted} persisted` : ''
      }`;
    }
    return phase === 'running' ? 'Bootstrapping hierarchies…' : 'Hierarchy bootstrap complete.';
  }
  if (agentName === 'SchemaAgent') {
    return 'Scanning schema for tables.';
  }
  if (agentName === 'ProfilingAgent') {
    const raw = event?.artifacts as Record<string, unknown> | null | undefined;
    const parsed = raw ? getArtifactsForRenderer(raw, event?.status) : null;
    const tables =
      typeof parsed?.tables === 'number'
        ? parsed.tables
        : raw && typeof raw.tables === 'number'
          ? raw.tables
          : null;
    if (tables != null && tables >= 0) {
      return `Profiling completed: detected ${tables} ${tables === 1 ? 'table' : 'tables'}.`;
    }
    return phase === 'running' ? 'Profiling tables…' : 'Profiling completed.';
  }
  if (agentName === 'ContextAgent') {
    const raw = event?.artifacts as Record<string, unknown> | null | undefined;
    const parsed = raw ? getArtifactsForRenderer(raw, event?.status) : null;
    const glossary =
      (parsed?.glossary_terms as Array<{ term: string }> | undefined) ??
      (raw?.glossary_terms as Array<{ term: string }> | undefined) ??
      [];
    const termCount = Array.isArray(glossary) ? glossary.length : 0;
    const entities =
      typeof parsed?.entities === 'number'
        ? parsed.entities
        : raw && typeof raw.entities === 'number'
          ? raw.entities
          : null;
    if (termCount > 0) {
      return `Context applied: ${termCount} ${termCount === 1 ? 'term' : 'terms'} detected.`;
    }
    if (entities != null && entities > 0) {
      return `Context applied: ${entities} ${entities === 1 ? 'entity' : 'entities'} discovered.`;
    }
    return phase === 'running' ? 'Applying business context…' : 'Context applied.';
  }
  if (agentName === 'MetricAgent') {
    const raw = event?.artifacts as Record<string, unknown> | null | undefined;
    const parsed = raw ? getArtifactsForRenderer(raw, event?.status) : null;
    const defs =
      (parsed?.metric_defs_detail as Array<{ metric_name?: string }> | undefined) ??
      (raw?.metric_defs_detail as Array<{ metric_name?: string }> | undefined) ??
      [];
    const names = Array.isArray(defs)
      ? defs.map((d) => (typeof d?.metric_name === 'string' ? d.metric_name.trim() : '')).filter(Boolean)
      : [];
    if (names.length > 0) {
      const joined = names.join(', ');
      const max = 280;
      const list = joined.length > max ? `${joined.slice(0, max - 1)}…` : joined;
      return `Metrics generated: ${list}`;
    }
    const count =
      typeof parsed?.metrics === 'number'
        ? parsed.metrics
        : raw && typeof raw.metrics === 'number'
          ? raw.metrics
          : null;
    if (count != null && count > 0) {
      return `Metrics generated: ${count} ${count === 1 ? 'metric' : 'metrics'}.`;
    }
    return phase === 'running' ? 'Generating metrics…' : 'Metrics generated.';
  }
  if (agentName === 'SemanticModelAgent') {
    return 'Semantic model classified.';
  }
  if (agentName === 'CorrelationAgent') {
    const raw = event?.artifacts as Record<string, unknown> | null | undefined;
    const rj = parsedCorrelationMetrics(raw);
    const pairs = typeof rj?.correlation_pair_count === 'number' ? rj.correlation_pair_count : null;
    const metrics = typeof rj?.metric_count === 'number' ? rj.metric_count : null;
    const anomalies = typeof rj?.anomaly_count === 'number' ? rj.anomaly_count : null;
    const parts: string[] = [];
    if (pairs != null) parts.push(`${pairs} correlation ${pairs === 1 ? 'pair' : 'pairs'}`);
    if (metrics != null) parts.push(`${metrics} ${metrics === 1 ? 'metric' : 'metrics'}`);
    if (anomalies != null) parts.push(`${anomalies} ${anomalies === 1 ? 'anomaly' : 'anomalies'}`);
    if (parts.length > 0) {
      return `Correlation analysis: ${parts.join(', ')}.`;
    }
    return phase === 'running' ? 'Running correlation analysis…' : 'Correlation analysis ready.';
  }
  if (
    agentName === 'DashboardAgent' ||
    agentName === 'DataQualityDashboardAgent' ||
    agentName === 'AnomalyDashboardAgent' ||
    agentName === 'CorrelationDashboardAgent'
  ) {
    const raw = event?.artifacts as Record<string, unknown> | null | undefined;
    const parsed = raw ? getArtifactsForRenderer(raw, event?.status) : null;
    let title =
      typeof parsed?.dashboard_title === 'string' && parsed.dashboard_title.trim()
        ? String(parsed.dashboard_title).trim()
        : '';
    if (!title && raw && typeof raw.dashboard_title === 'string' && raw.dashboard_title.trim()) {
      title = raw.dashboard_title.trim();
    }
    if (!title && raw?.raw_json != null && typeof raw.raw_json === 'object' && !Array.isArray(raw.raw_json)) {
      const t = (raw.raw_json as Record<string, unknown>).dashboard_title;
      if (typeof t === 'string' && t.trim()) title = t.trim();
    }
    const chartCount =
      raw && typeof raw.chart_count === 'number' && raw.chart_count >= 0 ? raw.chart_count : null;
    if (title) {
      return chartCount != null
        ? `Dashboard ready: ${title} (${chartCount} ${chartCount === 1 ? 'chart' : 'charts'})`
        : `Dashboard ready: ${title}`;
    }
    return phase === 'running' ? 'Building dashboard…' : 'Dashboard ready.';
  }
  if (agentName === 'DataQualityWorkflowRouter') {
    const raw = event?.artifacts as Record<string, unknown> | null | undefined;
    const kind = typeof raw?.workflow_kind === 'string' ? raw.workflow_kind : '';
    if (kind) return `Workflow: ${kind}`;
    return phase === 'running' ? 'Selecting data quality workflow…' : 'Data quality workflow selected.';
  }
  if (agentName === 'DataQualitySchemaAgent') {
    const raw = event?.artifacts as Record<string, unknown> | null | undefined;
    const tables = typeof raw?.tables === 'number' ? raw.tables : null;
    const names = Array.isArray(raw?.table_names) ? (raw.table_names as string[]).filter(Boolean) : [];
    if (tables != null && tables >= 0) {
      const sample = names.slice(0, 3).join(', ');
      return sample
        ? `Schema scan: ${tables} ${tables === 1 ? 'table' : 'tables'} (${sample}${names.length > 3 ? '…' : ''})`
        : `Schema scan: ${tables} ${tables === 1 ? 'table' : 'tables'}.`;
    }
    return phase === 'running' ? 'Scanning schema for data quality…' : 'Schema scan complete.';
  }
  if (agentName === 'DatasetStagePlannerAgent') {
    const raw = event?.artifacts as Record<string, unknown> | null | undefined;
    const sc = typeof raw?.stage_count === 'number' ? raw.stage_count : null;
    const jc = typeof raw?.join_stage_count === 'number' ? raw.join_stage_count : null;
    const fc = typeof raw?.filter_stage_count === 'number' ? raw.filter_stage_count : null;
    const edges = typeof raw?.lineage_edge_count === 'number' ? raw.lineage_edge_count : null;
    if (sc != null) {
      const bits = [
        jc != null ? `${jc} join` : null,
        fc != null ? `${fc} filter` : null,
        edges != null ? `${edges} lineage edges` : null,
      ].filter(Boolean);
      return bits.length > 0
        ? `Stage plan: ${sc} stages (${bits.join(', ')}).`
        : `Stage plan: ${sc} ${sc === 1 ? 'stage' : 'stages'}.`;
    }
    return phase === 'running'
      ? 'Planning multi-table data quality stages…'
      : 'Multi-table data quality stage plan prepared.';
  }
  if (agentName === 'DataQualityProfilingAgent') {
    const raw = event?.artifacts as Record<string, unknown> | null | undefined;
    const pt = typeof raw?.profiled_tables === 'number' ? raw.profiled_tables : null;
    const pc = typeof raw?.profiled_columns === 'number' ? raw.profiled_columns : null;
    if (pt != null && pc != null) {
      return `Profiling: ${pt} ${pt === 1 ? 'table' : 'tables'}, ${pc} ${pc === 1 ? 'column' : 'columns'}.`;
    }
    return phase === 'running' ? 'Profiling tables for quality signals…' : 'Profiling complete.';
  }
  if (agentName === 'DuplicateDetectionAgent') {
    const raw = event?.artifacts as Record<string, unknown> | null | undefined;
    const n = typeof raw?.duplicate_candidate_count === 'number' ? raw.duplicate_candidate_count : null;
    if (n != null) return `Duplicate detection: ${n} ${n === 1 ? 'candidate' : 'candidates'}.`;
    return phase === 'running' ? 'Detecting duplicate candidates…' : 'Duplicate detection complete.';
  }
  if (agentName === 'FreshnessAndStabilityAgent') {
    const raw = event?.artifacts as Record<string, unknown> | null | undefined;
    const stale = typeof raw?.stale_table_count === 'number' ? raw.stale_table_count : null;
    const stab = typeof raw?.stability_issue_count === 'number' ? raw.stability_issue_count : null;
    if (stale != null || stab != null) {
      return `Freshness & stability: ${stale ?? 0} stale, ${stab ?? 0} stability issues.`;
    }
    return phase === 'running' ? 'Evaluating freshness and stability…' : 'Freshness and stability evaluated.';
  }
  if (agentName === 'DataQualityRuleAgent') {
    const raw = event?.artifacts as Record<string, unknown> | null | undefined;
    const rc = typeof raw?.rule_count === 'number' ? raw.rule_count : null;
    if (raw?.review_required === true) {
      const pending = typeof raw?.review_pending_count === 'number' ? raw.review_pending_count : null;
      return pending != null
        ? `Rules extracted; ${pending} ${pending === 1 ? 'item' : 'items'} pending review.`
        : 'Rules extracted; review required before validation.';
    }
    if (rc != null) return `${rc} ${rc === 1 ? 'rule' : 'rules'} classified.`;
    return phase === 'running' ? 'Extracting data quality rules…' : 'Rules ready.';
  }
  if (agentName === 'DataQualityReviewGate') {
    const raw = event?.artifacts as Record<string, unknown> | null | undefined;
    const q = typeof raw?.review_queue_pending_count === 'number' ? raw.review_queue_pending_count : null;
    if (q != null) return `Review gate: ${q} ${q === 1 ? 'item' : 'items'} in queue.`;
    return 'Review gate: resolve rules to resume the run.';
  }
  if (agentName === 'TrendAnalysisAgent') {
    const raw = event?.artifacts as Record<string, unknown> | null | undefined;
    const tr = typeof raw?.trend_row_count === 'number' ? raw.trend_row_count : null;
    const imp = typeof raw?.improved_metric_count === 'number' ? raw.improved_metric_count : null;
    const wor = typeof raw?.worsened_metric_count === 'number' ? raw.worsened_metric_count : null;
    if (tr != null) {
      const bits = [
        imp != null ? `${imp} improved` : null,
        wor != null ? `${wor} worsened` : null,
      ].filter(Boolean);
      return bits.length > 0 ? `Trends: ${tr} rows · ${bits.join(', ')}.` : `Trends: ${tr} rows persisted.`;
    }
    return phase === 'running' ? 'Persisting trend snapshots…' : 'Trend snapshots persisted.';
  }
  if (agentName === 'AnomalyDetectionAgent') {
    const raw = event?.artifacts as Record<string, unknown> | null | undefined;
    const ac = typeof raw?.anomaly_count === 'number' ? raw.anomaly_count : null;
    const cc = typeof raw?.critical_anomaly_count === 'number' ? raw.critical_anomaly_count : null;
    if (ac != null) {
      return cc != null
        ? `Anomalies: ${ac} persisted (${cc} critical).`
        : `Anomalies: ${ac} persisted.`;
    }
    return phase === 'running' ? 'Deriving anomaly records…' : 'Anomaly records persisted.';
  }
  if (agentName === 'IssueRegisterAgent') {
    const raw = event?.artifacts as Record<string, unknown> | null | undefined;
    const ic = typeof raw?.issue_count === 'number' ? raw.issue_count : null;
    const open = typeof raw?.open_issue_count === 'number' ? raw.open_issue_count : null;
    if (ic != null) {
      return open != null ? `Issues: ${ic} in register (${open} open).` : `Issues: ${ic} in register.`;
    }
    return phase === 'running' ? 'Deriving issue register…' : 'Issue register updated.';
  }
  return null;
}

function AgentCardTopLine({ text }: { text: string }) {
  return (
    <p className="text-[12px] text-muted-foreground leading-snug border-b border-border/30 bg-muted/15 px-1 pt-0 pb-3">
      {text}
    </p>
  );
}

// --- Running agent card ---

function RunningAgentCard({ state }: { state: AgentState }) {
  const icon = AGENT_ICON_MAP[state.agentName] ?? 'search';
  const highlight = getAgentHighlightLine(state.agentName, 'running', state.completedEvent);
  return (
    <motion.div
      key={`${state.agentName}-running`}
      variants={runningCardVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="rounded-md border border-primary/20 bg-primary/5 overflow-hidden"
    >
      {highlight && <AgentCardTopLine text={highlight} />}
      <div className="flex items-center gap-2.5 px-3 py-2">
        <Loader2 className="size-3.5 text-primary animate-spin shrink-0" />
        <EventIcon icon={icon} className="text-primary animate-pulse" />
        <span className="text-sm flex-1 min-w-0">
          <span className="font-medium">{formatAgentName(state.agentName)}</span>
          {state.runningMessage && (
            <span className="text-muted-foreground ml-1.5 text-xs">{state.runningMessage}</span>
          )}
        </span>
      </div>
      {state.streamChunks.length > 0 && (
        <div className="px-3 pb-2">
          <AgentStreamLog chunks={state.streamChunks} />
        </div>
      )}
    </motion.div>
  );
}

/** Status priority: completed > ready > failed > running (higher = more final) */
const STATUS_PRIORITY: Record<string, number> = {
  running: 0,
  started: 0,
  ready: 1,
  failed: 2,
  completed: 3,
};

/** API sends inference_html, inference_raw_text, summary_html, summary_raw_text — normalize for display */
function getArtifactsForRenderer(
  artifacts: Record<string, unknown> | null | undefined,
  eventStatus?: string
): Record<string, unknown> | null {
  if (!artifacts || typeof artifacts !== 'object') return null;
  // Prefer key that matches the event status; API uses *_html and *_raw_text
  if (eventStatus === 'raw_json_ready' && artifacts.raw_json != null) {
    const r = artifacts.raw_json;
    if (typeof r === 'object' && r !== null && !Array.isArray(r)) return r as Record<string, unknown>;
    if (typeof r === 'string') return { text: r };
  }
  if (eventStatus === 'summary_ready') {
    const s = artifacts.summary ?? artifacts.summary_raw_text ?? artifacts.summary_html;
    if (typeof s === 'object' && s !== null && !Array.isArray(s)) return s as Record<string, unknown>;
    if (typeof s === 'string') return { summary: s, text: s };
    const rawText = artifacts.summary_raw_text;
    if (typeof rawText === 'string') return { summary: rawText, text: rawText };
  }
  if (eventStatus === 'inference_ready') {
    const i = artifacts.inference ?? artifacts.inference_raw_text ?? artifacts.inference_html;
    if (typeof i === 'object' && i !== null && !Array.isArray(i)) return i as Record<string, unknown>;
    if (typeof i === 'string') return { inference: i, text: i };
    const rawText = artifacts.inference_raw_text;
    if (typeof rawText === 'string') return { inference: rawText, text: rawText };
  }
  // Fallback: raw_json > summary* > inference* > as-is
  const raw = artifacts.raw_json;
  if (raw != null && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  const summary = artifacts.summary ?? artifacts.summary_raw_text;
  if (typeof summary === 'object' && summary !== null && !Array.isArray(summary)) return summary as Record<string, unknown>;
  if (typeof summary === 'string') return { summary, text: summary };
  const inference = artifacts.inference ?? artifacts.inference_raw_text;
  if (typeof inference === 'object' && inference !== null && !Array.isArray(inference)) return inference as Record<string, unknown>;
  if (typeof inference === 'string') return { inference, text: inference };
  return artifacts as Record<string, unknown>;
}

const DASHBOARD_RENDERER_AGENTS = new Set([
  'DashboardAgent',
  'DataQualityDashboardAgent',
  'AnomalyDashboardAgent',
  'CorrelationDashboardAgent',
]);

/** Artifact-ready dashboard rows should render charts (via CompletedAgentAccordion), same as AgenticChatHistory. */
function agentReadyEventShouldShowCharts(agentName: string, event: AgenticRunEvent): boolean {
  if (!DASHBOARD_RENDERER_AGENTS.has(agentName)) return false;
  const raw = event.artifacts as Record<string, unknown> | null;
  const payload = getArtifactsForRenderer(raw ?? undefined, event.status);
  if (!payload || typeof payload !== 'object') return false;
  const chartDetails = payload.chart_details;
  if (Array.isArray(chartDetails) && chartDetails.length > 0) return true;
  const chartIds = payload.chart_ids;
  if (Array.isArray(chartIds) && chartIds.length > 0) return true;
  if (typeof payload.chart_count === 'number' && payload.chart_count > 0) return true;
  if (typeof payload.dashboard_id === 'string' && payload.dashboard_id.trim()) return true;
  return false;
}

// --- Completed/ready agent accordion card (memoized) ---

// --- Ready agent card: summary + inference outside collapse (while fetching) ---

const ReadyAgentCard = memo(function ReadyAgentCard({
  agentName,
  event,
  streamChunks = [],
  fallbackPlanningSteps,
}: {
  agentName: string;
  event: AgenticRunEvent;
  streamChunks?: AgentStreamChunk[];
  /** From system "Plan created:" lines when artifacts lack steps (AgenticChatHistory parity). */
  fallbackPlanningSteps?: string[];
}) {
  const icon = AGENT_ICON_MAP[agentName] ?? 'search';
  const rawArtifacts = event.artifacts as Record<string, unknown> | null;
  const summaryText =
    (typeof rawArtifacts?.summary_raw_text === 'string' && rawArtifacts.summary_raw_text) ||
    (typeof rawArtifacts?.summary === 'string' && rawArtifacts.summary) ||
    null;
  const inferenceText =
    (typeof rawArtifacts?.inference_raw_text === 'string' && rawArtifacts.inference_raw_text) ||
    (typeof rawArtifacts?.inference === 'string' && rawArtifacts.inference) ||
    null;
  const subtitle = getAccordionSubtitle(event);
  const highlight = getAgentHighlightLine(agentName, 'ready', event);

  return (
    <motion.div
      key={`${agentName}-ready`}
      variants={completedCardVariants}
      initial="initial"
      animate="animate"
      transition={{ duration: 0.35, ease: 'easeOut', delay: 0.1 }}
      className="rounded-md border border-primary/20 bg-card overflow-hidden"
    >
      {highlight && <AgentCardTopLine text={highlight} />}
      <div className="px-3 py-2 border-b border-border/50 bg-muted/20">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
          <EventIcon icon={icon} className="text-emerald-600" />
          <span className="font-medium text-sm">{formatAgentName(agentName)}</span>
          <span className="text-[10px] text-muted-foreground font-normal">(ready)</span>
        </div>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground mt-1 pl-6">{subtitle}</p>
        )}
      </div>
      <div className="px-3 py-2 space-y-3 text-xs">
        {streamChunks.length > 0 && <AgentStreamLog chunks={streamChunks} />}
        {agentName === 'PlanningAgent' && fallbackPlanningSteps && fallbackPlanningSteps.length > 0 && (
          <div>
            <p className="font-medium text-muted-foreground mb-1">Plan steps</p>
            <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground">
              {fallbackPlanningSteps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>
        )}
        {summaryText && (
          <div>
            <p className="font-medium text-muted-foreground mb-1">Summary</p>
            <p className="text-muted-foreground whitespace-pre-wrap">{summaryText}</p>
          </div>
        )}
        {inferenceText && (
          <div>
            <p className="font-medium text-muted-foreground mb-1">Inference</p>
            <p className="text-muted-foreground whitespace-pre-wrap">{inferenceText}</p>
          </div>
        )}
        {!summaryText && !inferenceText && event.message && (
          <p className="text-muted-foreground">{event.message}</p>
        )}
      </div>
    </motion.div>
  );
});

// --- Completed agent: accordion with previous render logic only (Renderer / text / JSON / message) ---

const CompletedAgentAccordion = memo(function CompletedAgentAccordion({
  agentName,
  event,
  streamChunks = [],
  fallbackPlanningSteps,
  onCognitoChart,
  chartOverrides,
  insightsLinkTenant,
}: {
  agentName: string;
  event: AgenticRunEvent;
  streamChunks?: AgentStreamChunk[];
  fallbackPlanningSteps?: string[];
  onCognitoChart?: (detail: ChartDetail) => void;
  chartOverrides?: Record<string, ChartDetail>;
  /** When set, Data Quality dashboard agent shows “View dashboard” instead of inline charts. */
  insightsLinkTenant?: Pick<TenantInfo, 'tenantId' | 'displayName'>;
}) {
  const icon = AGENT_ICON_MAP[agentName] ?? 'search';
  const rawArtifacts = event.artifacts as Record<string, unknown> | null;
  const artifacts = mergePlanningArtifactsIfNeeded(
    agentName,
    getArtifactsForRenderer(rawArtifacts ?? undefined, event.status),
    rawArtifacts,
    fallbackPlanningSteps
  );
  const subtitle = getAccordionSubtitle(event);
  const Renderer = AGENT_RENDERER_MAP[agentName];
  const isDashboard =
    agentName === 'DashboardAgent' || agentName === 'DataQualityDashboardAgent';
  const isAnomalyDashboard = agentName === 'AnomalyDashboardAgent';
  const isCorrelationDashboard = agentName === 'CorrelationDashboardAgent';
  // Dashboard chart data lives in raw_json; ensure renderer gets it so charts show
  const dashboardChartPayload =
    isDashboard &&
    rawArtifacts?.raw_json != null &&
    typeof rawArtifacts.raw_json === 'object' &&
    !Array.isArray(rawArtifacts.raw_json)
      ? (rawArtifacts.raw_json as Record<string, unknown>)
      : artifacts;
  const anomalyDashboardPayload =
    isAnomalyDashboard &&
    rawArtifacts?.raw_json != null &&
    typeof rawArtifacts.raw_json === 'object' &&
    !Array.isArray(rawArtifacts.raw_json)
      ? (rawArtifacts.raw_json as Record<string, unknown>)
      : artifacts;
  const correlationDashboardPayload =
    isCorrelationDashboard &&
    rawArtifacts?.raw_json != null &&
    typeof rawArtifacts.raw_json === 'object' &&
    !Array.isArray(rawArtifacts.raw_json)
      ? (rawArtifacts.raw_json as Record<string, unknown>)
      : artifacts;
  const rendererPayload = isDashboard
    ? dashboardChartPayload
    : isAnomalyDashboard
      ? anomalyDashboardPayload
      : isCorrelationDashboard
        ? correlationDashboardPayload
        : artifacts;
  const hasCharts =
    isDashboard &&
    Array.isArray(dashboardChartPayload?.chart_details) &&
    (dashboardChartPayload.chart_details as unknown[]).length > 0;
  const hasTextOnly = artifacts && typeof artifacts.text === 'string';
  const hasContent =
    artifacts &&
    (Object.keys(artifacts).length > 0 ||
      hasTextOnly ||
      (isDashboard && (dashboardChartPayload?.charts != null || hasCharts)) ||
      (isAnomalyDashboard &&
        (anomalyDashboardPayload?.chart_ids != null || anomalyDashboardPayload?.chart_count != null)) ||
      (isCorrelationDashboard &&
        (correlationDashboardPayload?.chart_ids != null || correlationDashboardPayload?.chart_count != null)));

  const summaryText =
    (typeof rawArtifacts?.summary_raw_text === 'string' && rawArtifacts.summary_raw_text) ||
    (typeof rawArtifacts?.summary === 'string' && rawArtifacts.summary) ||
    null;
  const inferenceText =
    (typeof rawArtifacts?.inference_raw_text === 'string' && rawArtifacts.inference_raw_text) ||
    (typeof rawArtifacts?.inference === 'string' && rawArtifacts.inference) ||
    null;
  const highlight = getAgentHighlightLine(agentName, 'completed', event);

  const artifactPayloadForRenderer =
    chartOverrides && Object.keys(chartOverrides).length > 0 && rendererPayload
      ? mergeChartOverridesIntoArtifacts(rendererPayload as Record<string, unknown>, chartOverrides)
      : rendererPayload;

  const dqInsightsDashId =
    agentName === 'DataQualityDashboardAgent'
      ? dataQualityDashboardIdFromArtifacts(rawArtifacts as Record<string, unknown> | null)
      : '';
  const dqInsightsTenantId = insightsLinkTenant?.tenantId?.trim() ?? '';
  const showDqOpenInInsights =
    agentName === 'DataQualityDashboardAgent' &&
    Boolean(dqInsightsDashId) &&
    Boolean(dqInsightsTenantId);

  const dqPayload = dashboardChartPayload as Record<string, unknown> | undefined;
  const dqOpenTitle =
    (typeof dqPayload?.dashboard_title === 'string' && dqPayload.dashboard_title.trim()
      ? String(dqPayload.dashboard_title).trim()
      : '') ||
    (typeof rawArtifacts?.dashboard_title === 'string' && rawArtifacts.dashboard_title.trim()
      ? rawArtifacts.dashboard_title.trim()
      : '');
  const dqOpenCharts: number | null =
    typeof dqPayload?.chart_count === 'number'
      ? dqPayload.chart_count
      : typeof dqPayload?.charts === 'number'
        ? dqPayload.charts
        : hasCharts && Array.isArray(dashboardChartPayload?.chart_details)
          ? (dashboardChartPayload!.chart_details as unknown[]).length
          : null;
  const dqOpenViews =
    typeof dqPayload?.views === 'number' && dqPayload.views >= 0 ? dqPayload.views : null;

  return (
    <motion.div
      key={`${agentName}-completed`}
      variants={completedCardVariants}
      initial="initial"
      animate="animate"
      transition={{ duration: 0.35, ease: 'easeOut', delay: 0.1 }}
    >
      {highlight && <AgentCardTopLine text={highlight} />}
      <Accordion type="single" collapsible>
        <AccordionItem value={agentName} className="border rounded-md bg-card last:border-b">
          <AccordionTrigger className="px-3 py-2 text-xs hover:no-underline">
            <div className="flex flex-col items-start gap-0.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                <EventIcon icon={icon} className="text-emerald-600" />
                <span className="font-medium text-sm">{formatAgentName(agentName)}</span>
              </div>
              {subtitle && (
                <span className="text-[11px] text-muted-foreground font-normal ml-6">
                  {subtitle}
                </span>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-3">
            <div className={cn(
              'overflow-y-auto pr-1 space-y-3',
              isDashboard ? 'max-h-[600px]' : isAnomalyDashboard || isCorrelationDashboard ? 'max-h-[460px]' : 'max-h-[280px]',
            )}>
              {streamChunks.length > 0 && <AgentStreamLog chunks={streamChunks} className="mb-1" />}
              {(summaryText || inferenceText) && (
                <div className="space-y-3 text-xs">
                  {summaryText && (
                    <div>
                      <p className="font-medium text-muted-foreground mb-1">Summary</p>
                      <p className="text-muted-foreground whitespace-pre-wrap">{summaryText}</p>
                    </div>
                  )}
                  {inferenceText && (
                    <div>
                      <p className="font-medium text-muted-foreground mb-1">Inference</p>
                      <p className="text-muted-foreground whitespace-pre-wrap">{inferenceText}</p>
                    </div>
                  )}
                </div>
              )}
              {showDqOpenInInsights && insightsLinkTenant ? (
                <DataQualityDashboardOpenInInsights
                  tenantId={dqInsightsTenantId}
                  tenantName={insightsLinkTenant.displayName}
                  dashboardId={dqInsightsDashId}
                  dashboardTitle={dqOpenTitle}
                  chartsCount={dqOpenCharts}
                  viewsCount={dqOpenViews}
                />
              ) : Renderer && artifactPayloadForRenderer && !hasTextOnly ? (
                <Renderer artifacts={artifactPayloadForRenderer} onCognitoChart={onCognitoChart} />
              ) : hasTextOnly ? (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{String(artifacts?.text ?? '')}</p>
              ) : hasContent ? (
                <pre className="text-xs font-mono bg-muted/30 p-2 rounded border border-border/30 overflow-x-auto whitespace-pre-wrap break-words">
                  {JSON.stringify(artifacts, null, 2)}
                </pre>
              ) : event.message ? (
                <p className="text-xs text-muted-foreground">{event.message}</p>
              ) : (
                <p className="text-xs text-muted-foreground">No details available</p>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </motion.div>
  );
});

// --- Failed agent card ---

function FailedAgentCard({ state }: { state: AgentState }) {
  const icon = AGENT_ICON_MAP[state.agentName] ?? 'warning';
  return (
    <motion.div
      variants={completedCardVariants}
      initial="initial"
      animate="animate"
      transition={{ duration: 0.3 }}
      className="rounded-md border border-red-500/20 bg-red-500/5 overflow-hidden"
    >
      <div className="flex items-center gap-2.5 px-3 py-2">
        <AlertTriangle className="size-3.5 text-red-500 shrink-0" />
        <EventIcon icon={icon} className="text-red-500" />
        <span className="text-sm flex-1 min-w-0">
          <span className="font-medium">{formatAgentName(state.agentName)}</span>
          <span className="text-red-600 ml-1.5 text-xs">Failed</span>
        </span>
      </div>
      {state.streamChunks.length > 0 && (
        <div className="px-3 pb-2">
          <AgentStreamLog chunks={state.streamChunks} />
        </div>
      )}
    </motion.div>
  );
}

// --- Main Component ---

interface AgenticOnboardingProps {
  tenant: TenantInfo;
  runId: string;
  schemaPayload: SchemaPayload;
  onComplete: () => void;
  onSkip: () => void;
}

export default function AgenticOnboarding({
  tenant,
  runId,
  schemaPayload,
  onComplete,
  onSkip,
}: AgenticOnboardingProps) {
  const [cognitoChart, setCognitoChart] = useState<ChartDetail | null>(null);
  const [chartOverrides, setChartOverrides] = useState<Record<string, ChartDetail>>({});
  const handleOpenCognitoChart = useCallback((detail: ChartDetail) => {
    setCognitoChart(detail);
  }, []);

  const [agentStates, setAgentStates] = useState<Map<string, AgentState>>(new Map());
  const [systemMessages, setSystemMessages] = useState<SystemMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(true);
  const [polledEvents, setPolledEvents] = useState<AgenticRunEvent[]>([]);
  /**
   * After resume returns `queued`, GET /events can briefly still look "terminal" (review gate).
   * While true: keep the 2s events poll + stream alive until `dataQualityRunTerminal` becomes false.
   */
  const [resumePollAfterRuleReview, setResumePollAfterRuleReview] = useState(false);
  /** After a successful Resume, keep the rule review UI hidden for this run. */
  const [dataQualityRulesReviewDismissed, setDataQualityRulesReviewDismissed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const processedEventsRef = useRef<Set<string>>(new Set());
  const agentOrderRef = useRef<string[]>([]);

  const isDataQualityPipeline = useMemo(() => {
    if (tenant.domainId === DATA_QUALITY_OBSERVABILITY_DOMAIN_ID) return true;
    return polledEvents.some((e) =>
      rowIndicatesDataQualityWorkflow(
        e.agent_name,
        e.artifacts as Record<string, unknown> | null | undefined,
      ),
    );
  }, [tenant.domainId, polledEvents]);

  const pipelineAgentNames = useMemo(
    () => (isDataQualityPipeline ? [...DATA_QUALITY_PIPELINE_AGENTS] : [...RECOGNIZED_AGENTS]),
    [isDataQualityPipeline],
  );

  // Reset timeline when switching runs
  useEffect(() => {
    processedEventsRef.current = new Set();
    agentOrderRef.current = [];
    setPolledEvents([]);
    setAgentStates(new Map());
    setSystemMessages([]);
    setIsProcessing(true);
    setResumePollAfterRuleReview(false);
    setDataQualityRulesReviewDismissed(false);
    setCognitoChart(null);
    setChartOverrides({});
  }, [runId]);

  /**
   * When GET /agentic/runs/{id}/events polling should pause (no new interval / no in-flight poll loop).
   * Must match “run finished” signals used for SSE and processing, or the poll keeps firing after the stream ends.
   */
  const stopEventsPollTerminal = useMemo(() => {
    if (isDataQualityPipeline) {
      return (
        dataQualityRunTerminal(polledEvents) || dataQualityProgressAllowFull(polledEvents)
      );
    }
    const anomaly = agentStates.get('AnomalyDashboardAgent')?.status;
    const fromState = anomaly === 'completed' || anomaly === 'failed';
    return fromState || anomalyDashboardTerminalInEvents(polledEvents);
  }, [isDataQualityPipeline, polledEvents, agentStates]);

  /** When resume re-queues the run, keep polling even if the last /events snapshot still looks terminal. */
  const pauseEventsPoll = useMemo(
    () => stopEventsPollTerminal && !resumePollAfterRuleReview,
    [stopEventsPollTerminal, resumePollAfterRuleReview]
  );

  useEffect(() => {
    if (!resumePollAfterRuleReview) return;
    if (!isDataQualityPipeline) return;
    if (!dataQualityRunTerminal(polledEvents)) {
      setResumePollAfterRuleReview(false);
    }
  }, [polledEvents, resumePollAfterRuleReview, isDataQualityPipeline]);

  /**
   * Semantic runs: SSE follows `isProcessing` (stops when Anomaly Dashboard is done).
   * Data quality: keep SSE through review-gate / rule-review pauses (`isProcessing` may be false), and
   * close only once the pack is truly finished (dashboard terminal — `dataQualityProgressAllowFull`).
   */
  const agenticSseEnabled = useMemo(() => {
    if (!isDataQualityPipeline) return isProcessing;
    return !dataQualityProgressAllowFull(polledEvents);
  }, [isDataQualityPipeline, isProcessing, polledEvents]);

  // Stream stays open for live connection; agent UI is driven by GET /events polling (same payload shape).
  const { status: sseStatus, reconnect: sseReconnect } = useEventSource<AgenticRunEvent>({
    url: getAgenticStreamUrl(runId),
    enabled: agenticSseEnabled,
    reconnect: true,
    maxRetries: 2,
    retryDelay: 20000,
  });

  useEffect(() => {
    if (!isProcessing) return;
    if (pauseEventsPoll) return;
    let cancelled = false;
    const load = async () => {
      try {
        const { events } = await fetchAgenticRunEvents(runId);
        if (!cancelled) setPolledEvents(events);
      } catch {
        // next poll retries
      }
    };
    void load();
    const id = window.setInterval(load, AGENTIC_EVENTS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isProcessing, runId, pauseEventsPoll]);

  // Process unprocessed events from GET /events (same fields as SSE) so UI does not depend on stream delivery
  useEffect(() => {
    const toProcess = polledEvents.filter((evt) => !processedEventsRef.current.has(evt.event_id));
    let pipelineTerminalDone = false;
    const pipelineAgentSet = new Set<string>(
      isDataQualityPipeline ? [...DATA_QUALITY_PIPELINE_AGENTS] : [...RECOGNIZED_AGENTS],
    );

    if (toProcess.length > 0) {
    const systemAdds: Array<{ id: string; content: string; timestamp: number }> = [];
    const streamAddsByAgent = new Map<string, AgentStreamChunk[]>();
    const agentUpdates = new Map<
      string,
      { status: 'running' | 'ready' | 'completed' | 'failed'; event: AgenticRunEvent | null; message: string; ts: number }
    >();

    for (const evt of toProcess) {
      processedEventsRef.current.add(evt.event_id);
      const { agent_name, status, message, event_id, created_at } = evt;
      const ts = new Date(created_at).getTime();

      if (agent_name === 'AgentConversation') {
        systemAdds.push({ id: event_id, content: message, timestamp: ts });
        continue;
      }
      if (status === 'stream') {
        const streamKey = effectiveAgentName(agent_name);
        if (pipelineAgentSet.has(streamKey)) {
          if (!streamAddsByAgent.has(streamKey)) streamAddsByAgent.set(streamKey, []);
          streamAddsByAgent.get(streamKey)!.push({ id: event_id, content: message, timestamp: ts });
          if (!agentOrderRef.current.includes(streamKey)) {
            agentOrderRef.current.push(streamKey);
          }
        } else {
          systemAdds.push({ id: event_id, content: message, timestamp: ts });
        }
        continue;
      }

      const agentKey = effectiveAgentName(agent_name);

      if (pipelineAgentSet.has(agentKey)) {
        const mappedStatus =
          status === 'completed'
            ? 'completed'
            : status === 'failed'
              ? 'failed'
              : ARTIFACT_READY_STATUSES.has(status)
                ? 'ready'
                : status === 'started' || status === 'running'
                  ? 'running'
                  : isDataQualityPipeline &&
                      agentKey === 'DataQualityRuleAgent' &&
                      status === 'needs_review'
                    ? 'running'
                    : isDataQualityPipeline &&
                        agentKey === 'DataQualityReviewGate' &&
                        status === 'awaiting_rule_review'
                      ? 'completed'
                    : null;
        if (mappedStatus) {
          const priority = STATUS_PRIORITY[mappedStatus] ?? -1;
          const existing = agentUpdates.get(agentKey);
          const existingPriority = existing ? STATUS_PRIORITY[existing.status] ?? -1 : -1;
          if (priority >= existingPriority) {
            agentUpdates.set(agentKey, {
              status: mappedStatus,
              event: mappedStatus === 'failed' ? null : evt,
              message,
              ts,
            });
          }
          if (!agentOrderRef.current.includes(agentKey)) {
            agentOrderRef.current.push(agentKey);
          }
          if (
            agentKey === 'AnomalyDashboardAgent' &&
            (mappedStatus === 'completed' || mappedStatus === 'failed')
          ) {
            pipelineTerminalDone = true;
          }
          if (
            agentKey === 'AnomalyDashboardAgent' &&
            mappedStatus === 'ready' &&
            isDashboardTerminalEvent(status)
          ) {
            pipelineTerminalDone = true;
          }
        }
        continue;
      }

      systemAdds.push({ id: event_id, content: message, timestamp: ts });
    }

    // Ensure DashboardAgent terminal state is never missed (completed, or last ready if no completed)
    const dashboardTerminalEvt = [...toProcess]
      .reverse()
      .find((evt) => {
        const key = effectiveAgentName(evt.agent_name);
        if (key !== 'DashboardAgent') return false;
        return isDashboardTerminalEvent(evt.status);
      });
    if (dashboardTerminalEvt) {
      const isFailed = dashboardTerminalEvt.status === 'failed';
      const isCompleted = dashboardTerminalEvt.status === 'completed';
      const mapped: 'completed' | 'ready' | 'failed' = isFailed ? 'failed' : isCompleted ? 'completed' : 'ready';
      const existing = agentUpdates.get('DashboardAgent');
      const existingPriority = existing ? STATUS_PRIORITY[existing.status] ?? -1 : -1;
      const newPriority = STATUS_PRIORITY[mapped] ?? -1;
      if (!existing || newPriority >= existingPriority) {
        agentUpdates.set('DashboardAgent', {
          status: mapped,
          event: isFailed ? null : dashboardTerminalEvt,
          message: dashboardTerminalEvt.message ?? 'Dashboard Agent completed',
          ts: new Date(dashboardTerminalEvt.created_at).getTime(),
        });
      }
    }

    const anomalyDashboardTerminalEvt = [...toProcess]
      .reverse()
      .find((evt) => {
        const key = effectiveAgentName(evt.agent_name);
        if (key !== 'AnomalyDashboardAgent') return false;
        return isDashboardTerminalEvent(evt.status);
      });
    if (anomalyDashboardTerminalEvt) {
      const isFailed = anomalyDashboardTerminalEvt.status === 'failed';
      const isCompleted = anomalyDashboardTerminalEvt.status === 'completed';
      const mapped: 'completed' | 'ready' | 'failed' = isFailed ? 'failed' : isCompleted ? 'completed' : 'ready';
      const existing = agentUpdates.get('AnomalyDashboardAgent');
      const existingPriority = existing ? STATUS_PRIORITY[existing.status] ?? -1 : -1;
      const newPriority = STATUS_PRIORITY[mapped] ?? -1;
      if (!existing || newPriority >= existingPriority) {
        agentUpdates.set('AnomalyDashboardAgent', {
          status: mapped,
          event: isFailed ? null : anomalyDashboardTerminalEvt,
          message: anomalyDashboardTerminalEvt.message ?? 'Anomaly Dashboard Agent completed',
          ts: new Date(anomalyDashboardTerminalEvt.created_at).getTime(),
        });
        pipelineTerminalDone = true;
      }
    }

    const correlationDashboardTerminalEvt = [...toProcess]
      .reverse()
      .find((evt) => {
        const key = effectiveAgentName(evt.agent_name);
        if (key !== 'CorrelationDashboardAgent') return false;
        return isDashboardTerminalEvent(evt.status);
      });
    if (correlationDashboardTerminalEvt) {
      const isFailed = correlationDashboardTerminalEvt.status === 'failed';
      const isCompleted = correlationDashboardTerminalEvt.status === 'completed';
      const mapped: 'completed' | 'ready' | 'failed' = isFailed ? 'failed' : isCompleted ? 'completed' : 'ready';
      const existing = agentUpdates.get('CorrelationDashboardAgent');
      const existingPriority = existing ? STATUS_PRIORITY[existing.status] ?? -1 : -1;
      const newPriority = STATUS_PRIORITY[mapped] ?? -1;
      if (!existing || newPriority >= existingPriority) {
        agentUpdates.set('CorrelationDashboardAgent', {
          status: mapped,
          event: isFailed ? null : correlationDashboardTerminalEvt,
          message: correlationDashboardTerminalEvt.message ?? 'Correlation Dashboard Agent completed',
          ts: new Date(correlationDashboardTerminalEvt.created_at).getTime(),
        });
      }
    }

    if (isDataQualityPipeline) {
      const dqDashboardTerminalEvt = [...toProcess]
        .reverse()
        .find((evt) => {
          const key = effectiveAgentName(evt.agent_name);
          if (key !== 'DataQualityDashboardAgent') return false;
          return isDashboardTerminalEvent(evt.status);
        });
      if (dqDashboardTerminalEvt) {
        const isFailed = dqDashboardTerminalEvt.status === 'failed';
        const isCompleted = dqDashboardTerminalEvt.status === 'completed';
        const mapped: 'completed' | 'ready' | 'failed' = isFailed ? 'failed' : isCompleted ? 'completed' : 'ready';
        const existing = agentUpdates.get('DataQualityDashboardAgent');
        const existingPriority = existing ? STATUS_PRIORITY[existing.status] ?? -1 : -1;
        const newPriority = STATUS_PRIORITY[mapped] ?? -1;
        if (!existing || newPriority >= existingPriority) {
          agentUpdates.set('DataQualityDashboardAgent', {
            status: mapped,
            event: isFailed ? null : dqDashboardTerminalEvt,
            message: dqDashboardTerminalEvt.message ?? 'Data quality dashboard ready',
            ts: new Date(dqDashboardTerminalEvt.created_at).getTime(),
          });
        }
      }
    }

    if (systemAdds.length > 0) {
      setSystemMessages((prev) => [...prev, ...systemAdds]);
    }

    if (agentUpdates.size > 0 || streamAddsByAgent.size > 0) {
      setAgentStates((prev) => {
        const next = new Map(prev);
        for (const [agent_name, update] of agentUpdates) {
          const existing = next.get(agent_name);
          const existingPriority = existing ? STATUS_PRIORITY[existing.status] ?? -1 : -1;
          const newPriority = STATUS_PRIORITY[update.status] ?? -1;
          const forceApply =
            (agent_name === 'DashboardAgent' ||
              agent_name === 'AnomalyDashboardAgent' ||
              agent_name === 'CorrelationDashboardAgent' ||
              agent_name === 'DataQualityDashboardAgent') &&
            update.status === 'completed';
          if (forceApply || newPriority >= existingPriority) {
            const firstTs = existing?.timestamp ?? update.ts;
            next.set(agent_name, {
              agentName: agent_name,
              status: update.status,
              runningMessage: update.message,
              completedEvent: update.event,
              timestamp: firstTs,
              activitySortTs: Math.max(existing?.activitySortTs ?? firstTs, update.ts),
              streamChunks: existing?.streamChunks ?? [],
            });
          }
        }
        for (const [agentKey, chunks] of streamAddsByAgent) {
          if (chunks.length === 0) continue;
          const existing = next.get(agentKey);
          const mergedChunks = [...(existing?.streamChunks ?? []), ...chunks];
          const maxChunkTs = Math.max(...chunks.map((c) => c.timestamp));
          const firstTs = existing?.timestamp ?? maxChunkTs;
          next.set(agentKey, {
            agentName: agentKey,
            status: existing?.status ?? 'running',
            runningMessage: existing?.runningMessage ?? '',
            completedEvent: existing?.completedEvent ?? null,
            timestamp: firstTs,
            activitySortTs: Math.max(existing?.activitySortTs ?? firstTs, maxChunkTs),
            streamChunks: mergedChunks,
          });
        }
        return next;
      });
    }
    }

    if (
      isDataQualityPipeline &&
      dataQualityRunTerminal(polledEvents) &&
      !resumePollAfterRuleReview
    ) {
      pipelineTerminalDone = true;
    }

    if (isDataQualityPipeline && dataQualityProgressAllowFull(polledEvents)) {
      pipelineTerminalDone = true;
    }

    if (!isDataQualityPipeline && anomalyDashboardTerminalInEvents(polledEvents)) {
      pipelineTerminalDone = true;
    }

    if (pipelineTerminalDone) {
      setIsProcessing(false);
    } else if (sseStatus === 'closed') {
      setIsProcessing(false);
    }
  }, [polledEvents, sseStatus, isDataQualityPipeline, resumePollAfterRuleReview]);

  // Progress: semantic runs end on Anomaly Dashboard; data quality runs end on review gate / rule completion.
  const { completedCount, progress } = useMemo(() => {
    // Count "ready" as well as "completed" — many agents only emit artifact_ready before the run ends
    const count = pipelineAgentNames.filter((name) => {
      const s = agentStates.get(name)?.status;
      return s === 'completed' || s === 'ready';
    }).length;
    const anomalyDashState = agentStates.get('AnomalyDashboardAgent')?.status;
    const terminal = (s: string | undefined) => s === 'completed' || s === 'failed';
    const semanticPipelineTerminal =
      terminal(anomalyDashState) || anomalyDashboardTerminalInEvents(polledEvents);
    const dashboardPipelineTerminal = isDataQualityPipeline
      ? dataQualityRunTerminal(polledEvents)
      : semanticPipelineTerminal;
    const pct =
      pipelineAgentNames.length > 0
        ? Math.round((count / pipelineAgentNames.length) * 100)
        : 0;
    const capped = Math.min(100, pct);
    const progressValue = isDataQualityPipeline
      ? dataQualityProgressAllowFull(polledEvents)
        ? 100
        : capped
      : !isProcessing || dashboardPipelineTerminal
        ? 100
        : capped;
    return {
      completedCount: count,
      progress: progressValue,
    };
  }, [agentStates, isProcessing, polledEvents, isDataQualityPipeline, pipelineAgentNames]);

  // Build ordered timeline entries
  const timeline = useMemo(() => {
    const entries: Array<
      | { kind: 'system'; msg: SystemMessage }
      | { kind: 'agent'; state: AgentState }
    > = [];

    // System messages in arrival order
    systemMessages.forEach((msg) => {
      entries.push({ kind: 'system', msg });
    });

    // Agent states in order of first appearance
    const orderedAgents = agentOrderRef.current
      .map((name) => agentStates.get(name))
      .filter((s): s is AgentState => !!s);

    orderedAgents.forEach((state) => {
      entries.push({ kind: 'agent', state });
    });

    const orderIndex = (agentName: string) => {
      const i = agentOrderRef.current.indexOf(agentName);
      return i === -1 ? 10_000 : i;
    };

    // System lines: event time. Terminal agent cards (ready/completed/failed): first-activity time
    // so completed steps stay in pipeline order. Running agent(s): pinned to the end so stream
    // updates do not reorder the live card above finished steps.
    entries.sort((a, b) => {
      const primary = (e: (typeof entries)[number]) => {
        if (e.kind === 'system') return e.msg.timestamp;
        if (e.state.status === 'running') return Number.MAX_SAFE_INTEGER;
        return e.state.timestamp;
      };
      const tsA = primary(a);
      const tsB = primary(b);
      if (tsA !== tsB) return tsA - tsB;
      if (a.kind === 'system' && b.kind === 'system') return 0;
      if (a.kind === 'agent' && b.kind === 'agent')
        return orderIndex(a.state.agentName) - orderIndex(b.state.agentName);
      return a.kind === 'system' ? -1 : 1;
    });

    return entries;
  }, [agentStates, systemMessages]);

  const planningStepsFallback = useMemo(
    () => getPlanningStepsFallback(systemMessages),
    [systemMessages]
  );

  // Auto-scroll when agent rows or stream chunks change
  const scrollTrigger = useMemo(() => {
    let streamCount = 0;
    agentStates.forEach((s) => {
      streamCount += s.streamChunks?.length ?? 0;
    });
    return agentStates.size + systemMessages.length + streamCount;
  }, [agentStates, systemMessages]);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [scrollTrigger]);

  // Schema info for prompt
  const tableCount = schemaPayload.schemas?.[0]?.tables?.length ?? 0;

  const showDataQualityRulesReview = useMemo(() => {
    if (dataQualityRulesReviewDismissed) return false;
    if (isProcessing || !isDataQualityPipeline) return false;
    if (!dataQualityRunTerminal(polledEvents)) return false;
    if (!tenant.tenantId?.trim() || !tenant.domainId?.trim()) return false;
    return true;
  }, [
    dataQualityRulesReviewDismissed,
    isProcessing,
    isDataQualityPipeline,
    polledEvents,
    tenant.tenantId,
    tenant.domainId,
  ]);

  const dataQualityDashboardDone = useMemo(
    () => dataQualityDashboardTerminalReached(polledEvents),
    [polledEvents]
  );

  // Footer status text
  const getFooterStatus = useCallback(() => {
    if (!isProcessing) {
      if (isDataQualityPipeline && dataQualityDashboardDone) {
        return 'Data quality dashboard ready';
      }
      return isDataQualityPipeline ? 'Data quality run complete' : 'Semantic model setup complete';
    }
    switch (sseStatus) {
      case 'connecting':
        return 'Connecting to agents...';
      case 'connected':
        return `Agent is working... (${completedCount}/${pipelineAgentNames.length} complete)`;
      case 'error':
        return 'Connection lost, reconnecting...';
      case 'closed':
        return 'Connection closed';
      default:
        return 'Initializing...';
    }
  }, [
    isProcessing,
    sseStatus,
    completedCount,
    isDataQualityPipeline,
    pipelineAgentNames.length,
    dataQualityDashboardDone,
  ]);

  return (
    <div className="flex flex-col h-full w-full bg-background">
      {/* Header */}
      <div className="px-4 py-2 border-b bg-background">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold tracking-tight">
              {isDataQualityPipeline ? 'Data quality observability' : 'Setting up your semantic model'}
            </h1>
            <p className="text-xs text-muted-foreground">
              {tenant.displayName} &middot; Run {runId}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {isProcessing && sseStatus === 'connected' && (
              <>
                <Loader2 className="size-3.5 text-primary animate-spin" />
                <span className="text-xs text-muted-foreground">Processing...</span>
              </>
            )}
            {sseStatus === 'error' && (
              <>
                <WifiOff className="size-3.5 text-amber-500" />
                <span className="text-xs text-amber-600">Reconnecting...</span>
              </>
            )}
            {sseStatus === 'closed' && agenticSseEnabled && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs gap-1"
                onClick={sseReconnect}
              >
                <RefreshCw className="size-3" />
                Reconnect
              </Button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-2 h-1 w-full rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: '0%' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        <span className="text-[10px] text-muted-foreground mt-0.5 block">{progress}%</span>
      </div>

      {/* Message stream */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <div className="px-4 py-3 space-y-2">
            {/* Initial prompt */}
            <div className="flex justify-end mb-3">
              <div className="max-w-[85%] rounded-md bg-muted/60 border border-border/50 px-3 py-1">
                <p className="text-xs leading-relaxed">
                  {isDataQualityPipeline ? (
                    <>
                      AI agents are running a <strong>data quality</strong> workflow for{' '}
                      <strong>{tenant.displayName}</strong>
                      {tableCount > 0 ? (
                        <>
                          {' '}
                          (<strong>{tableCount}</strong> tables from your selection)
                        </>
                      ) : null}
                      . Stay on this screen until the run reaches the review gate or completes.
                    </>
                  ) : (
                    <>
                      AI agent is currently analyzing{' '}
                      {tableCount > 0 && (
                        <>
                          <strong>{tableCount}</strong> tables{' '}
                        </>
                      )}
                      for <strong>{tenant.displayName}</strong>. Please stay on this screen while the semantic model is
                      being generated.
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Timeline entries */}
            <AnimatePresence mode="sync">
              {timeline.map((entry) => {
                if (entry.kind === 'system') {
                  return (
                    <motion.div
                      key={entry.msg.id}
                      variants={systemMsgVariants}
                      initial="initial"
                      animate="animate"
                      transition={{ duration: 0.2 }}
                    >
                      <p className="text-xs text-muted-foreground leading-relaxed pl-1 py-0.5">
                        {entry.msg.content}
                      </p>
                    </motion.div>
                  );
                }

                if (entry.kind === 'agent') {
                  const { state } = entry;

                  if (state.status === 'running') {
                    return <RunningAgentCard key={`${state.agentName}-running`} state={state} />;
                  }

                  if (state.status === 'ready' && state.completedEvent) {
                    if (agentReadyEventShouldShowCharts(state.agentName, state.completedEvent)) {
                      return (
                        <CompletedAgentAccordion
                          key={`${state.agentName}-ready-charts`}
                          agentName={state.agentName}
                          event={state.completedEvent}
                          streamChunks={state.streamChunks}
                          fallbackPlanningSteps={planningStepsFallback}
                          chartOverrides={chartOverrides}
                          insightsLinkTenant={{
                            tenantId: tenant.tenantId,
                            displayName: tenant.displayName,
                          }}
                          onCognitoChart={
                            tenant.tenantId && tenant.domainId ? handleOpenCognitoChart : undefined
                          }
                        />
                      );
                    }
                    return (
                      <ReadyAgentCard
                        key={`${state.agentName}-ready`}
                        agentName={state.agentName}
                        event={state.completedEvent}
                        streamChunks={state.streamChunks}
                        fallbackPlanningSteps={planningStepsFallback}
                      />
                    );
                  }

                  if (state.status === 'completed' && state.completedEvent) {
                    return (
                      <CompletedAgentAccordion
                        key={`${state.agentName}-completed`}
                        agentName={state.agentName}
                        event={state.completedEvent}
                        streamChunks={state.streamChunks}
                        fallbackPlanningSteps={planningStepsFallback}
                        chartOverrides={chartOverrides}
                        insightsLinkTenant={{
                          tenantId: tenant.tenantId,
                          displayName: tenant.displayName,
                        }}
                        onCognitoChart={
                          tenant.tenantId && tenant.domainId ? handleOpenCognitoChart : undefined
                        }
                      />
                    );
                  }

                  if (state.status === 'failed') {
                    return <FailedAgentCard key={`${state.agentName}-failed`} state={state} />;
                  }
                }

                return null;
              })}
            </AnimatePresence>

            {showDataQualityRulesReview ? (
              <div className="pt-2">
                <DataQualityRulesReviewPanel
                  tenantId={tenant.tenantId}
                  domainId={tenant.domainId}
                  agenticRunId={runId}
                  enabled
                  onResumeSuccess={async (info) => {
                    setDataQualityRulesReviewDismissed(true);
                    if (!info.isRunQueued) return;
                    setResumePollAfterRuleReview(true);
                    setIsProcessing(true);
                    await new Promise<void>((resolve) => {
                      requestAnimationFrame(() => resolve());
                    });
                    sseReconnect();
                    try {
                      const { events } = await fetchAgenticRunEvents(runId);
                      setPolledEvents(events);
                    } catch {
                      /* poll effect will retry */
                    }
                  }}
                />
              </div>
            ) : null}

            {/* Typing indicator */}
            {isProcessing && (
              <div className="flex items-center gap-1 py-1 mt-1">
                <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}

          </div>
      </div>

      {cognitoChart && tenant.tenantId && tenant.domainId ? (
        <WorkspaceChartChatSidebar
          tenantId={tenant.tenantId}
          domainId={tenant.domainId}
          runId={runId}
          chart={cognitoChart}
          onClose={() => setCognitoChart(null)}
          onChartReplaced={(replaced) => {
            setChartOverrides((prev) => ({ ...prev, [replaced.chart_id]: replaced }));
            setCognitoChart((prev) =>
              prev && prev.chart_id === replaced.chart_id ? replaced : prev,
            );
          }}
        />
      ) : null}

      {/* Footer */}
      <div className="border-t bg-background px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Bot className="size-3.5 text-muted-foreground/60" />
          <span className="text-xs text-muted-foreground">{getFooterStatus()}</span>
        </div>
        {/* <div className="flex items-center gap-1.5">
          {!isProcessing && (
            <Button
              size="sm"
              className="h-7 px-2.5 text-xs gap-1"
              onClick={onComplete}
            >
              Proceed to Chat
              <ChevronRight className="size-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={onSkip}
          >
            Skip
          </Button>
        </div> */}
      </div>
    </div>
  );
}
