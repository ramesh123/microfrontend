import { useCallback, useEffect, useId, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEventSource } from '@/hooks/useEventSource';
import {
  Loader2,
  Info,
  User,
  ArrowDown,
  Send,
  CheckCircle2,
  Search,
  Database,
  FileCode2,
  FileText,
  LayoutDashboard,
  AlertTriangle,
  Sparkles,
  WifiOff,
  RefreshCw,
  SendHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  fetchAgenticRunChatHistory,
  fetchAgenticRunEvents,
  getAgenticStreamUrl,
  type AgenticRunEvent,
} from '@/controllers/API/agenticApi';
import {
  fetchWorkspaceDeployments,
  type WorkspaceDeploymentItem,
} from '@/controllers/API/semanticsApi';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { AGENT_RENDERER_MAP } from './AgentRenderers';
import type { ChartDetail } from './chartTypes';
import {
  WorkspaceChartChatSidebar,
  mergeChartOverridesIntoArtifacts,
} from './WorkspaceChartChatSidebar';
import { DataQualityRulesReviewPanel } from './DataQualityRulesReviewPanel';
import { DataQualityRulesSnapshot } from './DataQualityRulesSnapshot';

// Same as agentic run: only these agents get cards; others become system messages
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

/** Same as AgenticOnboarding — domain pack id for data quality observability runs */
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

/** Same as AgenticOnboarding: GET /agentic/runs/{id}/events poll interval while the run is live */
const AGENTIC_CHAT_LIVE_POLL_INTERVAL_MS = 2_000;

/** Same as AgenticOnboarding ARTIFACT_READY_STATUSES — count toward “step done” for progress % */
const ARTIFACT_READY_STATUSES = new Set<string>(['inference_ready', 'summary_ready', 'raw_json_ready']);

export interface AgenticChatHistoryMessage {
  message_id: string;
  run_id: string;
  sender: 'user' | 'system' | 'agent' | string;
  agent_name?: string;
  status?: string;
  message: string;
  event_id?: string | null;
  logical_event_id?: string | null;
  stage_name?: string | null;
  stage_seq?: number | null;
  payload_compacted?: boolean;
  artifacts?: any;
  dashboard_id?: string | null;
  dashboard_title?: string | null;
  chart_ids?: string[];
  chart_titles?: string[];
  created_at: string;
  /** Set when building timeline from chathistory.json or API */
  _timelineType?: 'user' | 'system' | 'agent';
  /** Best artifacts for renderer (normalized from raw_json); set when building timeline */
  _artifactsForRenderer?: Record<string, unknown>;
}

function pickDeploymentRunId(deployments: WorkspaceDeploymentItem[]): string | null {
  if (!deployments.length) return null;
  const canonical = deployments.find((d) => d.is_canonical);
  if (canonical?.run_id) return canonical.run_id;
  const sorted = [...deployments].sort(
    (a, b) =>
      new Date(b.updated_at ?? b.created_at).getTime() -
      new Date(a.updated_at ?? a.created_at).getTime()
  );
  return sorted[0]?.run_id ?? null;
}

export interface AgenticChatHistoryProps {
  runId: string;
  /** When true, fetch from GET /agentic/runs/{runId}/chat?limit=200&include_stages=true instead of static JSON */
  fetchFromApi?: boolean;
  /** When set with domainId, dashboard charts show the workspace AI control. */
  tenantId?: string;
  domainId?: string;
  /**
   * When `configured` and `runId` is empty, resolves run_id via GET /workspace/deployments?tenant_id=&domain_id=
   * before loading chat history.
   */
  deploymentStatus?: string | null;
  /** Labels for navigating to workspace new chat */
  tenantName?: string;
  domainName?: string;
  /**
   * When the agentic pipeline reaches a terminal state (from /events and/or chat body), parent may
   * refresh workspace deployment metadata — e.g. GET /workspace/deployments still shows `running` until refetched.
   */
  onPipelineTerminal?: (runId: string) => void;
}

// --- Agent icon map (same as agentic run) ---
type IconKey = 'search' | 'database' | 'code' | 'report' | 'dashboard' | 'model' | 'warning';

const AGENT_ICON_MAP: Record<string, IconKey> = {
  PlanningAgent: 'search',
  PlannerAgent: 'search',
  'Planner Agent': 'search',
  'Planning Agent': 'search',
  HierarchyBootstrapAgent: 'database',
  'Hierarchy Bootstrap Agent': 'database',
  SchemaAgent: 'database',
  'Schema Agent': 'database',
  ProfilingAgent: 'database',
  'Profiling Agent': 'database',
  ContextAgent: 'search',
  'Context Agent': 'search',
  GlossaryAgent: 'code',
  'Glossary Agent': 'code',
  JoinAgent: 'code',
  'Join Agent': 'code',
  MetricAgent: 'model',
  'Metric Agent': 'model',
  SemanticModelAgent: 'model',
  'Semantic Model Agent': 'model',
  RollupPlannerAgent: 'code',
  'Rollup Planner Agent': 'code',
  ChartPlannerAgent: 'report',
  'Chart Planner Agent': 'report',
  QualityGateAgent: 'search',
  'Quality Gate Agent': 'search',
  DashboardAgent: 'dashboard',
  'Dashboard Agent': 'dashboard',
  AnomalyDetectionAgent: 'warning',
  'Anomaly Detection Agent': 'warning',
  AnomalyDashboardAgent: 'dashboard',
  'Anomaly Dashboard Agent': 'dashboard',
  CorrelationAgent: 'report',
  'Correlation Agent': 'report',
  CorrelationDashboardAgent: 'dashboard',
  'Correlation Dashboard Agent': 'dashboard',
  DataQualityWorkflowRouter: 'search',
  DataQualitySchemaAgent: 'database',
  DatasetStagePlannerAgent: 'search',
  'Dataset Stage Planner Agent': 'search',
  DataQualityProfilingAgent: 'database',
  DuplicateDetectionAgent: 'warning',
  FreshnessAndStabilityAgent: 'report',
  DataQualityRuleAgent: 'code',
  DataQualityReviewGate: 'warning',
  DataEnrichmentOpportunityAgent: 'model',
  DataTrustScoringAgent: 'model',
  TrendAnalysisAgent: 'report',
  'Trend Analysis Agent': 'report',
  IssueRegisterAgent: 'code',
  'Issue Register Agent': 'code',
  DataQualityDashboardAgent: 'dashboard',
  system: 'search',
};

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

function formatAgentName(name: string): string {
  return name.replace(/([A-Z])/g, ' $1').trim();
}

function getAgentIconKey(agentName: string): IconKey {
  return AGENT_ICON_MAP[agentName] ?? AGENT_ICON_MAP[agentName.replace(/\s+/g, '')] ?? 'search';
}

function getRendererKey(agentName: string): string | null {
  const normalized = agentName.replace(/\s+/g, '');
  if (AGENT_RENDERER_MAP[normalized]) return normalized;
  if (agentName === 'Planner Agent' || agentName === 'Planning Agent') return 'PlanningAgent';
  return null;
}

/** Normalize JSON artifacts so they match what AgentRenderers expect (unwrap raw_json like chathistory.json). */
function getArtifactsForRenderer(artifacts: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!artifacts || typeof artifacts !== 'object') return null;
  const raw = artifacts.raw_json;
  if (raw != null && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return artifacts as Record<string, unknown>;
}

/** Align with AgenticOnboarding.effectiveAgentName for terminal checks on GET /events */
function effectiveAgentName(agentName: string): string {
  const trimmed = (agentName ?? '').trim();
  if (!trimmed) return trimmed;
  const noSpace = trimmed.replace(/\s+/g, '');
  if (noSpace === 'DashboardStoryAgent') return 'DashboardAgent';
  if (noSpace === 'PlannerAgent') return 'PlanningAgent';
  return noSpace;
}

/** Dashboard-style terminal statuses (matches AgenticOnboarding.isDashboardTerminalEvent). */
function isDashboardTerminalStatus(status: string): boolean {
  if (status === 'completed' || status === 'failed') return true;
  return status === 'raw_json_ready' || status === 'summary_ready';
}

/**
 * True when a chat row or event belongs to the data-quality pack — not the standard semantic pack.
 * Do not key off AnomalyDetectionAgent (also runs at the end of semantic builds).
 */
function rowIndicatesDataQualityWorkflow(
  agentName: string | null | undefined,
  artifacts?: Record<string, unknown> | null
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

function dashboardAgentTerminalInEvents(events: AgenticRunEvent[], agentKey: string): boolean {
  const dash = events.filter((e) => effectiveAgentName(e.agent_name) === agentKey);
  if (dash.length === 0) return false;
  const sorted = [...dash].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const last = sorted[sorted.length - 1]!;
  return isDashboardTerminalStatus(String(last.status ?? ''));
}

function semanticPipelineTerminalFromEvents(events: AgenticRunEvent[]): boolean {
  return (
    dashboardAgentTerminalInEvents(events, 'DashboardAgent') ||
    dashboardAgentTerminalInEvents(events, 'AnomalyDashboardAgent') ||
    dashboardAgentTerminalInEvents(events, 'CorrelationDashboardAgent')
  );
}

function isDqDashboardTerminalStatus(status: string): boolean {
  if (status === 'completed' || status === 'failed') return true;
  return status === 'raw_json_ready' || status === 'summary_ready';
}

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
    return isDqDashboardTerminalStatus(st);
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

function eventsIndicateDataQualityPipeline(events: AgenticRunEvent[]): boolean {
  return events.some((e) =>
    rowIndicatesDataQualityWorkflow(
      e.agent_name,
      e.artifacts as Record<string, unknown> | null | undefined
    )
  );
}

/** Terminal for live poll: semantic dashboard vs data quality review gate / rule completion */
function pipelineTerminalFromEvents(events: AgenticRunEvent[], domainId?: string | null): boolean {
  if (events.length > 0 && events.some((e) => String(e.status ?? '').toLowerCase() === 'failed')) {
    return true;
  }
  const isDq =
    (domainId ?? '').trim() === DATA_QUALITY_OBSERVABILITY_DOMAIN_ID ||
    eventsIndicateDataQualityPipeline(events);
  if (isDq) return dataQualityRunTerminal(events);
  return semanticPipelineTerminalFromEvents(events);
}

function dqMessagesLookLikeDataQualityPipeline(messages: AgenticChatHistoryMessage[]): boolean {
  return messages.some((m) =>
    rowIndicatesDataQualityWorkflow(
      m.agent_name,
      m.artifacts as Record<string, unknown> | undefined
    )
  );
}

/**
 * When GET /events lags, chat rows can already show the DQ dashboard (or success narration) as done.
 * Treat that as pipeline terminal so we stop polling and parent can refresh workspace deployment status.
 */
/** Chat rows can show workflow failure while the last agent row is still `running` in the timeline. */
function messagesIndicateRunFailure(messages: AgenticChatHistoryMessage[]): boolean {
  const sysFailed = messages.some((m) => {
    const isSys = m._timelineType === 'system' || m.sender === 'system';
    if (!isSys || typeof m.message !== 'string') return false;
    return /agentic workflow failed|workflow failed|run failed/i.test(m.message);
  });
  if (sysFailed) return true;
  return messages.some((m) => m._timelineType === 'agent' && m.status === 'failed');
}

function messagesIndicateDataQualityPipelineTerminal(
  messages: AgenticChatHistoryMessage[],
  domainId?: string | null
): boolean {
  const domainDq = (domainId ?? '').trim() === DATA_QUALITY_OBSERVABILITY_DOMAIN_ID;
  if (!domainDq && !dqMessagesLookLikeDataQualityPipeline(messages)) return false;

  const narrationDone = messages.some((m) => {
    const isSys = m._timelineType === 'system' || m.sender === 'system';
    if (!isSys || typeof m.message !== 'string') return false;
    return /completed successfully|resumed after rule review and completed|workflow completed/i.test(
      m.message
    );
  });
  if (narrationDone) return true;

  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (m._timelineType !== 'agent' || !m.agent_name) continue;
    if (effectiveAgentName(m.agent_name) !== 'DataQualityDashboardAgent') continue;
    return isDqDashboardTerminalStatus(m.status ?? '');
  }
  return false;
}

/** Semantic / workspace pack finished when a terminal dashboard agent row exists in chat. */
function messagesIndicateSemanticPipelineTerminal(messages: AgenticChatHistoryMessage[]): boolean {
  const narrationDone = messages.some((m) => {
    const isSys = m._timelineType === 'system' || m.sender === 'system';
    if (!isSys || typeof m.message !== 'string') return false;
    return /completed successfully|workflow completed|semantic model.*ready/i.test(m.message);
  });
  if (narrationDone) return true;

  const terminalKeys = ['DashboardAgent', 'AnomalyDashboardAgent', 'CorrelationDashboardAgent'] as const;
  for (const key of terminalKeys) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]!;
      if (m._timelineType !== 'agent' || !m.agent_name) continue;
      if (effectiveAgentName(m.agent_name) !== key) continue;
      return isDashboardTerminalStatus(m.status ?? '');
    }
  }
  return false;
}

/** Prefer completed / artifact-ready rows over running or stream when collapsing per-agent history. */
function messageStatusRank(m: AgenticChatHistoryMessage): number {
  const s = m.status ?? '';
  if (s === 'completed' || s === 'failed') return 3;
  if (ARTIFACT_READY_STATUSES.has(s)) return 2;
  if (s === 'awaiting_rule_review') return 2;
  const key = m.agent_name ? effectiveAgentName(m.agent_name) : '';
  if (
    (key === 'DashboardAgent' ||
      key === 'AnomalyDashboardAgent' ||
      key === 'CorrelationDashboardAgent' ||
      key === 'DataQualityDashboardAgent') &&
    isDashboardTerminalStatus(s)
  ) {
    return 2;
  }
  if (s === 'started' || s === 'running' || s === 'in_progress' || s === 'stream') return 0;
  return 1;
}

function messageIsCompletedLike(m: AgenticChatHistoryMessage): boolean {
  const key = m.agent_name ? effectiveAgentName(m.agent_name) : '';
  const s = m.status ?? '';
  if (s === 'completed' || s === 'failed') return true;
  if (ARTIFACT_READY_STATUSES.has(s)) return true;
  if (key === 'DataQualityReviewGate' && s === 'awaiting_rule_review') return true;
  if (
    (key === 'DashboardAgent' ||
      key === 'AnomalyDashboardAgent' ||
      key === 'CorrelationDashboardAgent' ||
      key === 'DataQualityDashboardAgent') &&
    isDashboardTerminalStatus(s)
  ) {
    return true;
  }
  return false;
}

/** Build collapsed timeline from raw chat API rows (shared by initial load and live refresh). */
function buildTimelineFromRawMessages(
  raw: AgenticChatHistoryMessage[],
  effectiveRunId: string,
  domainId?: string | null
): AgenticChatHistoryMessage[] {
  const runIdFromData = raw[0]?.run_id || effectiveRunId || '';

  const rawIndicatesDataQuality = raw.some((m) =>
    rowIndicatesDataQualityWorkflow(m.agent_name, m.artifacts as Record<string, unknown> | undefined)
  );
  const useDataQualityPipeline =
    (domainId ?? '').trim() === DATA_QUALITY_OBSERVABILITY_DOMAIN_ID || rawIndicatesDataQuality;
  const pipelineAgentSet = new Set<string>(
    useDataQualityPipeline ? [...DATA_QUALITY_PIPELINE_AGENTS] : [...RECOGNIZED_AGENTS]
  );

  const userMsg: AgenticChatHistoryMessage = {
    message_id: 'msg_user_initial',
    run_id: runIdFromData,
    sender: 'user',
    message: useDataQualityPipeline
      ? 'Please run data quality observability on the selected data.'
      : 'Please create a semantic model for my data analyzing the selected tables.',
    created_at: raw[0]
      ? new Date(new Date(raw[0].created_at).getTime() - 2000).toISOString()
      : new Date().toISOString(),
  };

  const systemMessages = raw.filter(
    (m) =>
      m.sender === 'system' ||
      (m.sender === 'agent' && m.agent_name === 'system') ||
      (m.sender === 'agent' &&
        m.agent_name &&
        !pipelineAgentSet.has(effectiveAgentName(m.agent_name)))
  );

  const agentMessages = raw.filter(
    (m) =>
      m.sender === 'agent' &&
      m.agent_name &&
      m.agent_name !== 'system' &&
      pipelineAgentSet.has(effectiveAgentName(m.agent_name))
  );
  const agentLastByKey = new Map<string, AgenticChatHistoryMessage>();
  const agentFirstTime = new Map<string, number>();
  const agentBestArtifacts = new Map<string, Record<string, unknown>>();
  agentMessages.forEach((m) => {
    const key = effectiveAgentName(m.agent_name!);
    const t = new Date(m.created_at).getTime();
    if (!agentFirstTime.has(key)) agentFirstTime.set(key, t);
    const existing = agentLastByKey.get(key);
    const newRank = messageStatusRank(m);
    const existingRank = existing ? messageStatusRank(existing) : -1;
    if (!existing || newRank > existingRank) {
      agentLastByKey.set(key, m);
    } else if (newRank === existingRank && t > new Date(existing.created_at).getTime()) {
      agentLastByKey.set(key, m);
    }
    const art = m.artifacts as Record<string, unknown> | undefined;
    if (art && typeof art === 'object' && Object.keys(art).length > 0) {
      const normalized = getArtifactsForRenderer(art) ?? art;
      const current = agentBestArtifacts.get(key);
      const hasRawJson = art.raw_json != null && typeof art.raw_json === 'object';
      if (hasRawJson && messageIsCompletedLike(m)) {
        agentBestArtifacts.set(key, normalized);
      } else if (!current) {
        agentBestArtifacts.set(key, normalized);
      } else if (hasRawJson) {
        agentBestArtifacts.set(key, normalized);
      }
    }
  });
  // `/chat` can surface a newer `awaiting_rule_review` row after `completed`; both look "completed-like"
  // in `messageIsCompletedLike`, so the merge may keep the wrong row. Prefer terminal gate when present.
  const reviewGateKey = 'DataQualityReviewGate';
  const reviewGateRows = agentMessages.filter(
    (m) => m.agent_name && effectiveAgentName(m.agent_name) === reviewGateKey,
  );
  if (reviewGateRows.length > 0) {
    const terminalGateRows = reviewGateRows.filter((m) => {
      const s = (m.status ?? '').toLowerCase();
      return s === 'completed' || s === 'failed';
    });
    if (terminalGateRows.length > 0) {
      const bestGate = terminalGateRows.reduce((a, b) =>
        new Date(a.created_at).getTime() >= new Date(b.created_at).getTime() ? a : b,
      );
      agentLastByKey.set(reviewGateKey, bestGate);
    }
  }
  const agentOrder = [...agentLastByKey.keys()].sort(
    (a, b) => (agentFirstTime.get(a) ?? 0) - (agentFirstTime.get(b) ?? 0)
  );

  if (agentOrder.includes('PlanningAgent')) {
    const current = agentBestArtifacts.get('PlanningAgent');
    const hasSteps = current && Array.isArray(current.steps) && (current.steps as string[]).length > 0;
    if (!hasSteps) {
      const planMsg = raw.find(
        (m) =>
          (m.sender === 'system' || (m.sender === 'agent' && m.agent_name === 'system')) &&
          typeof m.message === 'string' &&
          m.message.includes('Plan created:')
      );
      const match = planMsg?.message?.match(/Plan created:\s*(.+)/);
      const stepsStr = match?.[1]?.trim();
      const steps = stepsStr ? stepsStr.split(/\s*;\s*/).map((s) => s.trim()).filter(Boolean) : [];
      if (steps.length > 0) {
        agentBestArtifacts.set('PlanningAgent', { steps });
      }
    }
  }

  type TimelineEntry =
    | { type: 'user'; msg: AgenticChatHistoryMessage }
    | { type: 'system'; msg: AgenticChatHistoryMessage }
    | { type: 'agent'; msg: AgenticChatHistoryMessage };
  const entries: TimelineEntry[] = [{ type: 'user', msg: userMsg }];
  const systemWithTime = systemMessages.map((msg) => ({
    type: 'system' as const,
    msg,
    t: new Date(msg.created_at).getTime(),
  }));
  const agentWithTime = agentOrder.map((name) => {
    const msg = agentLastByKey.get(name)!;
    const bestArtifacts = agentBestArtifacts.get(name);
    const msgWithArtifacts = bestArtifacts
      ? { ...msg, _artifactsForRenderer: bestArtifacts }
      : msg;
    return { type: 'agent' as const, msg: msgWithArtifacts, t: new Date(msg.created_at).getTime() };
  });
  const rest = [...systemWithTime, ...agentWithTime].sort((a, b) => a.t - b.t);
  rest.forEach(({ type, msg }) => entries.push({ type, msg }));

  return entries.map((e) => ({
    ...e.msg,
    _timelineType: e.type,
  })) as AgenticChatHistoryMessage[];
}

const runningCardVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
};

const completedCardVariants = {
  initial: { opacity: 0, y: 12, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
};

export default function AgenticChatHistory({
  runId,
  fetchFromApi,
  tenantId,
  domainId,
  deploymentStatus,
  tenantName,
  domainName,
  onPipelineTerminal,
}: AgenticChatHistoryProps) {
  const navigate = useNavigate();
  const followUpQueryId = useId();
  const [followUpInput, setFollowUpInput] = useState('');
  const canStartWorkspaceChat = !!(tenantId?.trim() && domainId?.trim());

  const goToNewWorkspaceChat = useCallback(() => {
    const q = followUpInput.trim();
    if (!q) {
      toast.info('Type a question first');
      return;
    }
    if (!canStartWorkspaceChat) {
      toast.error('Tenant and domain context are required to open workspace chat.');
      return;
    }
    const tid = tenantId!.trim();
    const did = domainId!.trim();
    navigate('/exploratory-analysis/agentic-run/create', {
      state: {
        tenantId: tid,
        tenantName: tenantName?.trim() || tid,
        domainId: did,
        domainName: domainName?.trim() || did,
        initialUserQuery: q,
      },
    });
  }, [
    followUpInput,
    canStartWorkspaceChat,
    tenantId,
    domainId,
    tenantName,
    domainName,
    navigate,
  ]);

  const onFollowUpKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        goToNewWorkspaceChat();
      }
    },
    [goToNewWorkspaceChat],
  );

  const [cognitoChart, setCognitoChart] = useState<ChartDetail | null>(null);
  const [chartOverrides, setChartOverrides] = useState<Record<string, ChartDetail>>({});
  const handleOpenCognitoChart = useCallback((detail: ChartDetail) => {
    setCognitoChart(detail);
  }, []);

  const [messages, setMessages] = useState<AgenticChatHistoryMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  /** Resolved run id for API mode — drives SSE + poll (same pattern as AgenticOnboarding). */
  const [resolvedRunIdForLive, setResolvedRunIdForLive] = useState<string | null>(null);
  /**
   * Pipeline finished when Anomaly Dashboard completes/fails, or when a data quality run hits the
   * review gate / rule completion (from GET /events). `null` = not yet known — keep SSE + poll open.
   */
  const [pipelineTerminal, setPipelineTerminal] = useState<boolean | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fetchStartedRef = useRef(false);
  const lastRunIdRef = useRef<string | null>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, []);

  const isDataQualityPipeline = useMemo(() => {
    if ((domainId ?? '').trim() === DATA_QUALITY_OBSERVABILITY_DOMAIN_ID) return true;
    return messages.some((m) =>
      rowIndicatesDataQualityWorkflow(
        m.agent_name,
        m.artifacts as Record<string, unknown> | undefined
      )
    );
  }, [domainId, messages]);

  const effectivePipelineTerminal = useMemo(
    () =>
      pipelineTerminal === true ||
      (Boolean(fetchFromApi) &&
        (messagesIndicateRunFailure(messages) ||
          (isDataQualityPipeline
            ? messagesIndicateDataQualityPipelineTerminal(messages, domainId)
            : messagesIndicateSemanticPipelineTerminal(messages)))),
    [pipelineTerminal, fetchFromApi, messages, domainId, isDataQualityPipeline]
  );

  const streamAndPollActive =
    Boolean(fetchFromApi && resolvedRunIdForLive) && !effectivePipelineTerminal;

  /** Parent refetches deployments once per terminal completion; reset when run id changes or run goes non-terminal (resume). */
  const pipelineTerminalNotifiedRunRef = useRef<string | null>(null);
  const pipelineTerminalPrevRunRef = useRef<string | null>(null);
  useEffect(() => {
    const run = resolvedRunIdForLive;
    if (run !== pipelineTerminalPrevRunRef.current) {
      pipelineTerminalNotifiedRunRef.current = null;
      pipelineTerminalPrevRunRef.current = run;
    }
    if (!run || !fetchFromApi || !onPipelineTerminal) return;
    if (!effectivePipelineTerminal) {
      if (pipelineTerminalNotifiedRunRef.current === run) pipelineTerminalNotifiedRunRef.current = null;
      return;
    }
    if (pipelineTerminalNotifiedRunRef.current === run) return;
    pipelineTerminalNotifiedRunRef.current = run;
    onPipelineTerminal(run);
  }, [resolvedRunIdForLive, fetchFromApi, effectivePipelineTerminal, onPipelineTerminal]);

  const pipelineAgentNames = useMemo(
    () => (isDataQualityPipeline ? [...DATA_QUALITY_PIPELINE_AGENTS] : [...RECOGNIZED_AGENTS]),
    [isDataQualityPipeline],
  );

  /** Only while the run is paused for human review — hide once the gate completes (history view). */
  const awaitingDataQualityRuleReview = useMemo(
    () =>
      messages.some(
        (m) =>
          m._timelineType === 'agent' &&
          m.agent_name &&
          effectiveAgentName(m.agent_name) === 'DataQualityReviewGate' &&
          m.status === 'awaiting_rule_review',
      ),
    [messages],
  );

  /** Gate row can stay `awaiting_*` in edge cases; hide Resume if post-gate pack agents already finished. */
  const dataQualityPastRuleReviewPhase = useMemo(() => {
    if (!isDataQualityPipeline) return false;
    const terminalStatus = (key: string, status: string | undefined) => {
      const s = (status ?? '').toLowerCase();
      if (s === 'completed' || s === 'failed') return true;
      if (key === 'DataQualityDashboardAgent' && isDqDashboardTerminalStatus(status ?? '')) return true;
      return false;
    };
    const postGateKeys = [
      'DataEnrichmentOpportunityAgent',
      'DataTrustScoringAgent',
      'TrendAnalysisAgent',
      'AnomalyDetectionAgent',
      'IssueRegisterAgent',
      'DataQualityDashboardAgent',
    ] as const;
    return messages.some((m) => {
      if (m._timelineType !== 'agent' || !m.agent_name) return false;
      const key = effectiveAgentName(m.agent_name);
      if (!postGateKeys.includes(key as (typeof postGateKeys)[number])) return false;
      return terminalStatus(key, m.status);
    });
  }, [isDataQualityPipeline, messages]);

  const agenticRunIdForRules = (resolvedRunIdForLive ?? runId?.trim() ?? '').trim();

  const showDataQualityRulesReview =
    isDataQualityPipeline &&
    Boolean(tenantId?.trim()) &&
    Boolean(domainId?.trim()) &&
    Boolean(agenticRunIdForRules) &&
    awaitingDataQualityRuleReview &&
    !dataQualityPastRuleReviewPhase;

  // Stream opens as soon as we have run_id — same idea as onboarding (do not gate on /events first).
  const { status: sseStatus, reconnect: sseReconnect } = useEventSource<AgenticRunEvent>({
    url:
      streamAndPollActive && resolvedRunIdForLive
        ? getAgenticStreamUrl(resolvedRunIdForLive)
        : null,
    enabled: streamAndPollActive,
    reconnect: true,
    maxRetries: 2,
    retryDelay: 20000,
  });

  /** Same formula as AgenticOnboarding: completed / ready agents ÷ pipeline length (see ARTIFACT_READY_STATUSES). */
  const { progress, completedCount } = useMemo(() => {
    if (!streamAndPollActive) {
      return { progress: 100, completedCount: 0 };
    }
    const count = pipelineAgentNames.filter((name) => {
      const m = messages.find(
        (x) =>
          x._timelineType === 'agent' &&
          x.agent_name &&
          effectiveAgentName(x.agent_name) === name,
      );
      const s = m?.status;
      if (!s) return false;
      if (s === 'completed') return true;
      if (name === 'DataQualityReviewGate' && s === 'awaiting_rule_review') return true;
      if (name === 'DataQualityDashboardAgent' && isDqDashboardTerminalStatus(s)) return true;
      return ARTIFACT_READY_STATUSES.has(s);
    }).length;
    const pct =
      pipelineAgentNames.length > 0 ? Math.round((count / pipelineAgentNames.length) * 100) : 0;
    return { progress: Math.min(100, pct), completedCount: count };
  }, [messages, streamAndPollActive, pipelineAgentNames]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    // Show button if we are scrolled up more than 100px from the bottom
    const isScrolledUp = scrollHeight - scrollTop - clientHeight > 100;
    setShowScrollButton(isScrolledUp);
  };

  useEffect(() => {
    setCognitoChart(null);
    setChartOverrides({});
  }, [runId]);

  useEffect(() => {
    const statusLower = (deploymentStatus ?? '').toLowerCase();
    const needsDeploymentLookup =
      fetchFromApi &&
      statusLower === 'configured' &&
      Boolean(tenantId?.trim()) &&
      Boolean(domainId?.trim()) &&
      !runId?.trim();

    const effectiveRunIdForDedupe = needsDeploymentLookup
      ? `deployments:${tenantId}:${domainId}`
      : runId;

    if (fetchFromApi && fetchStartedRef.current && lastRunIdRef.current === effectiveRunIdForDedupe) {
      fetchStartedRef.current = false;
      return;
    }
    if (fetchFromApi) {
      fetchStartedRef.current = true;
      lastRunIdRef.current = effectiveRunIdForDedupe;
    }

    let mounted = true;
    setLoading(true);
    setError(null);
    setResolvedRunIdForLive(null);
    setPipelineTerminal(null);

    const loadRaw = (async (): Promise<{
      raw: AgenticChatHistoryMessage[];
      effectiveRunId: string;
    }> => {
      let chatRunId = runId?.trim() ?? '';

      if (fetchFromApi && needsDeploymentLookup) {
        const res = await fetchWorkspaceDeployments(tenantId!, domainId!, 50);
        const picked = pickDeploymentRunId(res.deployments ?? []);
        if (!picked) {
          throw new Error('No deployment run found for this tenant and domain.');
        }
        chatRunId = picked;
      }

      if (fetchFromApi) {
        if (!chatRunId) {
          throw new Error('Missing run id for chat history.');
        }
        const data = await fetchAgenticRunChatHistory(chatRunId, 200, true);
        const raw = (data.messages || []) as AgenticChatHistoryMessage[];
        return { raw, effectiveRunId: chatRunId };
      }

      const res = await fetch('/chathistory.json');
      if (!res.ok) throw new Error('Failed to load chat history');
      const data = (await res.json()) as { messages?: AgenticChatHistoryMessage[] };
      const raw = (data.messages || []) as AgenticChatHistoryMessage[];
      return { raw, effectiveRunId: runId?.trim() ?? '' };
    })();

    loadRaw
      .then(({ raw, effectiveRunId }) => {
        const timelineMessages = buildTimelineFromRawMessages(raw, effectiveRunId, domainId);
        setMessages(timelineMessages);
        if (fetchFromApi && effectiveRunId) {
          setResolvedRunIdForLive(effectiveRunId);
          void fetchAgenticRunEvents(effectiveRunId, 200)
            .then(({ events }) => {
              if (!mounted) return;
              setPipelineTerminal(pipelineTerminalFromEvents(events, domainId));
            })
            .catch(() => {
              if (mounted) setPipelineTerminal(null);
            });
        }
        setLoading(false);
        setTimeout(() => scrollToBottom(), 100);
      })
      .catch((err: unknown) => {
        if (mounted) {
          setError((err as Error)?.message || 'Failed to load chat history');
        }
      })
      .finally(() => {
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [runId, fetchFromApi, tenantId, domainId, deploymentStatus, scrollToBottom]);

  useEffect(() => {
    if (!fetchFromApi || !resolvedRunIdForLive || effectivePipelineTerminal) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const [eventsRes, chatRes] = await Promise.all([
          fetchAgenticRunEvents(resolvedRunIdForLive, 200),
          fetchAgenticRunChatHistory(resolvedRunIdForLive, 200, true),
        ]);
        if (cancelled) return;
        if (pipelineTerminalFromEvents(eventsRes.events, domainId)) {
          setPipelineTerminal(true);
        }
        const raw = (chatRes.messages || []) as AgenticChatHistoryMessage[];
        setMessages(buildTimelineFromRawMessages(raw, resolvedRunIdForLive, domainId));
        setTimeout(() => scrollToBottom(), 100);
      } catch {
        // next poll retries (same as onboarding)
      }
    };
    void tick();
    const id = window.setInterval(tick, AGENTIC_CHAT_LIVE_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [fetchFromApi, resolvedRunIdForLive, effectivePipelineTerminal, scrollToBottom, domainId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground h-full">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm">Loading history...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-red-500 h-full">
        <Info className="h-5 w-5 mr-2" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground h-full">
        <span className="text-sm">No chat history available.</span>
      </div>
    );
  }

  const liveProgressStatusText =
    sseStatus === 'connecting'
      ? 'Connecting to agents...'
      : sseStatus === 'connected'
        ? `Agent is working... (${completedCount}/${pipelineAgentNames.length} complete)`
        : sseStatus === 'error'
          ? 'Connection lost, reconnecting...'
          : sseStatus === 'closed'
            ? 'Connection closed'
            : 'Initializing...';

  return (
    <div className="flex flex-col h-full min-h-0 w-full min-w-0 bg-background self-stretch">
      {streamAndPollActive && (
        <div className="shrink-0 px-4 py-2 border-b border-border/50 bg-background">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground min-w-0">{liveProgressStatusText}</p>
            <div className="flex items-center gap-1.5 shrink-0">
              {sseStatus === 'connected' && (
                <>
                  <Loader2 className="size-3.5 text-primary animate-spin" />
                  <span className="text-xs text-muted-foreground hidden sm:inline">Processing...</span>
                </>
              )}
              {sseStatus === 'error' && (
                <>
                  <WifiOff className="size-3.5 text-amber-500" />
                  <span className="text-xs text-amber-600 hidden sm:inline">Reconnecting...</span>
                </>
              )}
              {sseStatus === 'closed' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs gap-1"
                  onClick={() => sseReconnect()}
                >
                  <RefreshCw className="size-3" />
                  Reconnect
                </Button>
              )}
            </div>
          </div>
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
      )}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto min-h-0 relative bg-muted/20 flex flex-col items-stretch"
      >
        <div className="max-w-full mx-auto w-full px-4 pt-3 pb-3 space-y-2 flex-shrink-0">
          <AnimatePresence mode="sync">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user' || msg._timelineType === 'user';
            const isSystemNarration =
              msg._timelineType === 'system' ||
              (msg.sender === 'system' && !msg.agent_name) ||
              (msg.sender === 'agent' && msg.agent_name === 'system');
            const agentName = msg.agent_name || (msg.sender === 'agent' ? 'Agent' : '');
            const isCompleted = messageIsCompletedLike(msg);
            const isFailed = msg.status === 'failed';
            const isRunning =
              !isCompleted &&
              !isFailed &&
              (msg.status === 'in_progress' ||
                msg.status === 'started' ||
                msg.status === 'running' ||
                msg.status === 'stream' ||
                msg.status === 'needs_review');

            // 1) User message — right-aligned bubble (same as agentic run initial prompt)
            if (isUser) {
              return (
                <motion.div
                  key={msg.message_id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-end mb-3"
                >
                  <div className="max-w-[85%] rounded-md bg-muted/60 border border-border/50 px-3 py-1">
                    <p className="text-xs leading-relaxed">{msg.message}</p>
                  </div>
                </motion.div>
              );
            }

            // 2) System narration: subtle left-aligned text like agentic run
            if (isSystemNarration) {
              return (
                <motion.p
                  key={msg.message_id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-muted-foreground leading-relaxed pl-1 py-0.5"
                >
                  {msg.message}
                </motion.p>
              );
            }

            // 3) Agent: running card (blue border, spinner, icon, name, message)
            if (agentName && isRunning) {
              const icon = getAgentIconKey(agentName);
              const displayName = agentName === 'Agent' ? 'Agent' : formatAgentName(agentName);
              return (
                <motion.div
                  key={msg.message_id}
                  variants={runningCardVariants}
                  initial="initial"
                  animate="animate"
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-md border border-primary/20 bg-primary/5"
                >
                  <Loader2 className="size-3.5 text-primary animate-spin shrink-0" />
                  <EventIcon icon={icon} className="text-primary animate-pulse" />
                  <span className="text-sm flex-1 min-w-0">
                    <span className="font-medium">{displayName}</span>
                    {msg.message && (
                      <span className="text-muted-foreground ml-1.5 text-xs">{msg.message}</span>
                    )}
                  </span>
                </motion.div>
              );
            }

            // 4) Agent: failed card
            if (agentName && isFailed) {
              const icon = getAgentIconKey(agentName);
              const displayName = agentName === 'Agent' ? 'Agent' : formatAgentName(agentName);
              return (
                <motion.div
                  key={msg.message_id}
                  variants={completedCardVariants}
                  initial="initial"
                  animate="animate"
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-md border border-red-500/20 bg-red-500/5"
                >
                  <AlertTriangle className="size-3.5 text-red-500 shrink-0" />
                  <EventIcon icon={icon} className="text-red-500" />
                  <span className="text-sm flex-1 min-w-0">
                    <span className="font-medium">{displayName}</span>
                    <span className="text-red-600 ml-1.5 text-xs">Failed</span>
                  </span>
                </motion.div>
              );
            }

            // 5) Agent: completed accordion — use same AgentRenderers as agentic run; show inference & summary inside
            if (agentName && isCompleted) {
              const icon = getAgentIconKey(agentName);
              const displayName = agentName === 'Agent' ? 'Agent' : formatAgentName(agentName);
              const rendererKey = getRendererKey(agentName);
              const Renderer = rendererKey ? AGENT_RENDERER_MAP[rendererKey] : null;
              const rawArtifacts = (msg.artifacts ?? msg._artifactsForRenderer) as Record<string, unknown> | null | undefined;
              const artifactsForRenderer =
                msg._artifactsForRenderer ??
                getArtifactsForRenderer(msg.artifacts as Record<string, unknown> | null | undefined);
              const isDashboardLike =
                rendererKey === 'DashboardAgent' ||
                rendererKey === 'DataQualityDashboardAgent' ||
                rendererKey === 'AnomalyDashboardAgent' ||
                rendererKey === 'CorrelationDashboardAgent';
              const hasArtifacts = artifactsForRenderer && Object.keys(artifactsForRenderer).length > 0;

              const mergedArtifactsForRenderer =
                chartOverrides &&
                Object.keys(chartOverrides).length > 0 &&
                artifactsForRenderer &&
                rendererKey &&
                (rendererKey === 'DashboardAgent' ||
                  rendererKey === 'DataQualityDashboardAgent' ||
                  rendererKey === 'AnomalyDashboardAgent' ||
                  rendererKey === 'CorrelationDashboardAgent')
                  ? mergeChartOverridesIntoArtifacts(artifactsForRenderer, chartOverrides)
                  : artifactsForRenderer;

              /** Some API messages list chart_ids on the message; artifacts may omit them after compaction. */
              const artifactsForDashboardFetch =
                mergedArtifactsForRenderer &&
                typeof mergedArtifactsForRenderer === 'object' &&
                rendererKey &&
                (rendererKey === 'DashboardAgent' ||
                  rendererKey === 'DataQualityDashboardAgent' ||
                  rendererKey === 'AnomalyDashboardAgent' ||
                  rendererKey === 'CorrelationDashboardAgent')
                  ? (() => {
                      const base = mergedArtifactsForRenderer as Record<string, unknown>;
                      const fromArt = base.chart_ids as string[] | undefined;
                      const fromMsg = msg.chart_ids;
                      if (
                        (!fromArt || fromArt.length === 0) &&
                        Array.isArray(fromMsg) &&
                        fromMsg.length > 0
                      ) {
                        return {
                          ...base,
                          chart_ids: fromMsg,
                          chart_titles: msg.chart_titles ?? base.chart_titles ?? [],
                        };
                      }
                      return mergedArtifactsForRenderer;
                    })()
                  : mergedArtifactsForRenderer;

              const summaryText =
                (typeof rawArtifacts?.summary_raw_text === 'string' && rawArtifacts.summary_raw_text) ||
                (typeof rawArtifacts?.summary === 'string' && rawArtifacts.summary) ||
                null;
              const inferenceText =
                (typeof rawArtifacts?.inference_raw_text === 'string' && rawArtifacts.inference_raw_text) ||
                (typeof rawArtifacts?.inference === 'string' && rawArtifacts.inference) ||
                null;

              return (
                <motion.div
                  key={msg.message_id}
                  variants={completedCardVariants}
                  initial="initial"
                  animate="animate"
                  transition={{ duration: 0.35, ease: 'easeOut', delay: 0.05 }}
                >
                  <Accordion type="single" collapsible>
                    <AccordionItem value={msg.message_id} className="border rounded-md bg-card last:border-b">
                      <AccordionTrigger className="px-3 py-2 text-xs hover:no-underline">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                          <EventIcon icon={icon} className="text-emerald-600" />
                          <span className="font-medium text-xs">{displayName}</span>
                          {msg.message && (
                            <span className="text-muted-foreground font-normal text-xs ml-1.5 truncate max-w-[200px]">
                              {msg.message}
                            </span>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-3">
                        <div
                          className={cn(
                            'overflow-y-auto pr-1 space-y-3',
                            isDashboardLike ? 'max-h-[420px]' : 'max-h-[280px]',
                          )}
                        >
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
                          {Renderer && hasArtifacts ? (
                            <Renderer
                              artifacts={artifactsForDashboardFetch ?? mergedArtifactsForRenderer!}
                              onCognitoChart={
                                tenantId && domainId ? handleOpenCognitoChart : undefined
                              }
                            />
                          ) : hasArtifacts ? (
                            <pre className="text-xs font-mono bg-muted/30 p-2 rounded border border-border/30 overflow-x-auto">
                              {JSON.stringify(artifactsForRenderer, null, 2)}
                            </pre>
                          ) : !summaryText && !inferenceText ? (
                            <p className="text-xs text-muted-foreground">No details available</p>
                          ) : null}
                          {effectiveAgentName(agentName) === 'DataQualityRuleAgent' &&
                          dataQualityPastRuleReviewPhase &&
                          msg.status === 'completed' &&
                          tenantId?.trim() &&
                          domainId?.trim() &&
                          agenticRunIdForRules ? (
                            <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Rules for this run
                              </p>
                              <DataQualityRulesSnapshot
                                tenantId={tenantId.trim()}
                                domainId={domainId.trim()}
                                runId={agenticRunIdForRules}
                                enabled
                              />
                            </div>
                          ) : null}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </motion.div>
              );
            }

            // Fallback: left-aligned bubble for other agent/system messages
            if (msg.agent_name || msg.sender === 'agent') {
              const icon = getAgentIconKey(agentName);
              const displayName = agentName === 'Agent' ? 'Agent' : formatAgentName(agentName);
              return (
                <motion.div
                  key={msg.message_id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-md border border-border/50 bg-card"
                >
                  <EventIcon icon={icon} className="text-muted-foreground" />
                  <span className="text-sm flex-1 min-w-0">
                    <span className="font-medium">{displayName}</span>
                    {msg.message && (
                      <span className="text-muted-foreground ml-1.5 text-xs">{msg.message}</span>
                    )}
                  </span>
                </motion.div>
              );
            }

            return null;
          })}
          </AnimatePresence>
        </div>
      </div>

      {showDataQualityRulesReview && tenantId && domainId ? (
        <div className="shrink-0 border-t border-border/50 bg-muted/15 px-4 py-3">
          <DataQualityRulesReviewPanel
            tenantId={tenantId}
            domainId={domainId}
            agenticRunId={agenticRunIdForRules}
            enabled
            onResumeSuccess={async (info) => {
              if (!info.isRunQueued) return;
              setPipelineTerminal(false);
              if (!resolvedRunIdForLive) return;
              await new Promise<void>((resolve) => {
                requestAnimationFrame(() => resolve());
              });
              sseReconnect();
              try {
                const [eventsRes, chatRes] = await Promise.all([
                  fetchAgenticRunEvents(resolvedRunIdForLive, 200),
                  fetchAgenticRunChatHistory(resolvedRunIdForLive, 200, true),
                ]);
                setPipelineTerminal(pipelineTerminalFromEvents(eventsRes.events, domainId));
                const raw = (chatRes.messages || []) as AgenticChatHistoryMessage[];
                setMessages(buildTimelineFromRawMessages(raw, resolvedRunIdForLive, domainId));
                setTimeout(() => scrollToBottom(), 100);
              } catch {
                /* live poll effect will retry */
              }
            }}
          />
        </div>
      ) : null}

      {cognitoChart && tenantId && domainId ? (
        <WorkspaceChartChatSidebar
          tenantId={tenantId}
          domainId={domainId}
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

      {/* Input Area (Mock to match AI Chatbox styling) */}
      <div className="border-t border-border bg-background flex-shrink-0 relative">
        <AnimatePresence>
          {showScrollButton && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              onClick={scrollToBottom}
              className="absolute -top-12 left-1/2 -translate-x-1/2 bg-background border border-border/50 text-foreground shadow-md rounded-full p-2 hover:bg-muted transition-colors z-50"
              aria-label="Scroll to bottom"
            >
              <ArrowDown className="size-4" />
            </motion.button>
          )}
        </AnimatePresence>
        <div className="max-w-3xl mx-auto w-full px-4 py-3">
          <div className="flex min-h-0 flex-col space-y-2">
            <label htmlFor={followUpQueryId} className="sr-only">
              Follow-up message to open in workspace chat
            </label>
            <div className="relative">
              <textarea
                id={followUpQueryId}
                value={followUpInput}
                onChange={(e) => setFollowUpInput(e.target.value)}
                onKeyDown={onFollowUpKeyDown}
                disabled={!canStartWorkspaceChat}
                title={
                  canStartWorkspaceChat
                    ? 'Opens a new workspace chat with your message'
                    : 'Connect tenant and domain (e.g. from domain conversations) to start a workspace chat'
                }
                placeholder={
                  canStartWorkspaceChat
                    ? 'Ask a follow-up — opens new workspace chat…'
                    : 'Workspace chat unavailable without tenant & domain context'
                }
                rows={1}
                className="w-full min-h-[20px] resize-none rounded-xl border-2 border-border bg-muted/40 px-3 pb-3 pr-12 pt-3 text-sm shadow-none transition-colors placeholder:text-muted-foreground/80 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-0 disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                disabled={!canStartWorkspaceChat || !followUpInput.trim()}
                onClick={() => void goToNewWorkspaceChat()}
                className="absolute bottom-3 right-2 z-10 flex size-9 items-center justify-center rounded-md text-primary transition-[opacity,transform] hover:opacity-80 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40"
                aria-label="Open new workspace chat"
                title="Go to new workspace chat"
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
      </div>
    </div>
  );
}
