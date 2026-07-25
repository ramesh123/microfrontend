import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  Loader2,
  Play,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import { useAuth } from '@/context/auth/authContext';
import type { IAuthUser } from '@/types/auth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  fetchDataQualityRules,
  isDataQualityResumeRunQueued,
  postDataQualityRuleReview,
  postResumeDataQualityRun,
  type DataQualityRuleRow,
  type DataQualitySqlPreview,
} from '@/controllers/API/dataQualityApi';

export type DataQualityResumeSuccessInfo = {
  status?: string | null;
  /** True when resume API returned `status: "queued"` (case-insensitive). */
  isRunQueued: boolean;
};

export interface DataQualityRulesReviewPanelProps {
  tenantId: string;
  domainId: string;
  agenticRunId: string;
  /** When true, loads rules once context is ready */
  enabled: boolean;
  /** After resume POST succeeds. Parents should reopen SSE + /events only when `info.isRunQueued`. */
  onResumeSuccess?: (info: DataQualityResumeSuccessInfo) => void | Promise<void>;
}

/** `ui:` + `username` from auth (not display name). Falls back to email, then `user`. */
function buildReviewedBy(user: IAuthUser | undefined): string {
  const raw = user?.username?.trim() || user?.email?.trim() || 'user';
  const safe = raw.replace(/:/g, '.').replace(/\s+/g, ' ').trim() || 'user';
  return `ui:${safe}`;
}

function getParameterHints(rule: DataQualityRuleRow): Record<string, unknown> | null {
  const hints = rule.execution_plan?.parameter_hints;
  if (!hints || typeof hints !== 'object' || Array.isArray(hints)) return null;
  return hints as Record<string, unknown>;
}

function hintAllowedValuesList(rule: DataQualityRuleRow): string[] {
  const hints = getParameterHints(rule);
  const raw = hints?.allowed_values;
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
}

/** One value per line, or comma-separated on a single line. */
function parseAllowedValuesInput(text: string | undefined): string[] {
  if (!text?.trim()) return [];
  const lines = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines.length === 1 && lines[0].includes(',')) {
    return lines[0]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return lines;
}

/**
 * Approve `condition_json`: `allowed_values` from steward text (e.g. CREATED / SHIPPED) or falls back to hints;
 * other `parameter_hints` keys (pattern, min_value, …) copied as-is. No rule `source_text`.
 */
function buildApproveConditionJson(
  rule: DataQualityRuleRow,
  allowedValuesInput: string | undefined
): Record<string, unknown> {
  const hints = getParameterHints(rule);
  if (!hints) return {};

  const out: Record<string, unknown> = {};
  const fromHints = hintAllowedValuesList(rule);
  const fromInput = parseAllowedValuesInput(allowedValuesInput);
  if (fromHints.length > 0 || fromInput.length > 0) {
    out.allowed_values = fromInput.length > 0 ? fromInput : fromHints;
  }

  for (const [k, v] of Object.entries(hints)) {
    if (k === 'allowed_values') continue;
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/** `action: edit` — same hint merge as approve, plus natural-language `source_text` inside `condition_json`. */
function buildEditConditionJson(
  rule: DataQualityRuleRow,
  allowedValuesText: string | undefined,
  sourceText: string
): Record<string, unknown> {
  const out = buildApproveConditionJson(rule, allowedValuesText);
  out.source_text = sourceText.trim().length > 0 ? sourceText.trim() : null;
  return out;
}

function statusBadgeClass(status: string | null | undefined): string {
  const s = (status ?? '').toLowerCase();
  if (
    s === 'active' ||
    s === 'activated' ||
    s === 'approved' ||
    s === 'accepted' ||
    s === 'published' ||
    s === 'enabled' ||
    s === 'resolved'
  ) {
    return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30';
  }
  if (s === 'rejected' || s === 'declined' || s === 'dismissed') {
    return 'bg-red-500/15 text-red-800 dark:text-red-300 border-red-500/30';
  }
  if (s === 'needs_review') return 'bg-amber-500/15 text-amber-900 dark:text-amber-200 border-amber-500/35';
  return 'bg-muted text-muted-foreground border-border';
}

/** Normalize status from API (snake_case or camelCase). */
function ruleReviewStatusLower(rule: DataQualityRuleRow): string {
  const r = rule as unknown as Record<string, unknown>;
  const raw = rule.rule_status ?? r.ruleStatus ?? r.status;
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

/**
 * Resume-after-rule-review requires every rule to be accepted or rejected.
 * Backends vary: `active`, `approved`, `accepted`, … vs `rejected` / `declined`.
 */
function isRuleReviewDecided(rule: DataQualityRuleRow): boolean {
  const s = ruleReviewStatusLower(rule);
  if (!s) return false;
  if (s === 'rejected' || s === 'declined' || s === 'dismissed') return true;
  if (
    s === 'active' ||
    s === 'activated' ||
    s === 'approved' ||
    s === 'approve' ||
    s === 'accepted' ||
    s === 'accept' ||
    s === 'published' ||
    s === 'enabled' ||
    s === 'resolved'
  ) {
    return true;
  }
  return false;
}

/** Prefer top-level `sql_preview`; fall back to nested plan preview from the API. */
function getRuleSqlPreview(rule: DataQualityRuleRow): DataQualitySqlPreview | null {
  const top = rule.sql_preview;
  if (top && typeof top === 'object' && !Array.isArray(top)) return top;
  const nested = rule.execution_plan?.sql_preview;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) return nested;
  return null;
}

function RuleSqlPreviewBlock({ preview }: { preview: DataQualitySqlPreview }) {
  const notes = Array.isArray(preview.notes)
    ? preview.notes.filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
    : [];
  const validationSql =
    typeof preview.validation_sql === 'string' && preview.validation_sql.trim()
      ? preview.validation_sql.trim()
      : null;
  const hasMeta =
    preview.status != null ||
    preview.source != null ||
    (preview.error != null && String(preview.error).length > 0);

  if (notes.length === 0 && !validationSql && !hasMeta) return null;

  return (
    <div className="space-y-2 rounded-md border border-border/40 bg-muted/20 px-2 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">SQL preview</p>
      {hasMeta && (
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
          {preview.status != null && preview.status !== '' && (
            <span>
              Status: <span className="font-medium text-foreground">{preview.status}</span>
            </span>
          )}
          {preview.source != null && preview.source !== '' && (
            <span>
              Source: <span className="font-medium text-foreground">{preview.source}</span>
            </span>
          )}
          {preview.error != null && String(preview.error).length > 0 && (
            <span className="text-destructive">Error: {String(preview.error)}</span>
          )}
        </div>
      )}
      {notes.length > 0 && (
        <ul className="list-disc list-inside space-y-1 text-[11px] text-muted-foreground leading-relaxed pl-0.5">
          {notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
      {validationSql && (
        <div>
          <p className="text-[10px] font-medium text-muted-foreground mb-1">Validation SQL</p>
          <pre className="max-h-36 overflow-auto rounded border border-border/50 bg-background/90 p-2 text-[10px] font-mono leading-relaxed text-foreground whitespace-pre-wrap break-words">
            {validationSql}
          </pre>
        </div>
      )}
    </div>
  );
}

export function DataQualityRulesReviewPanel({
  tenantId,
  domainId,
  agenticRunId,
  enabled,
  onResumeSuccess,
}: DataQualityRulesReviewPanelProps) {
  const { state: authState } = useAuth();
  const authUser = authState.authInfo?.user;

  const [rules, setRules] = useState<DataQualityRuleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionRuleId, setActionRuleId] = useState<string | null>(null);
  /** Per-rule review comment (maps to `review_notes` on approve/reject). */
  const [ruleComments, setRuleComments] = useState<Record<string, string>>({});
  /** Per-rule lines for `condition_json.allowed_values` (approve); seeded from `parameter_hints`. */
  const [ruleAllowedValuesText, setRuleAllowedValuesText] = useState<Record<string, string>>({});
  /** Draft natural-language rule text; submitted with `action: edit` inside `condition_json.source_text`. */
  const [ruleSourceTextDraft, setRuleSourceTextDraft] = useState<Record<string, string>>({});
  /** `false` = rule body expanded; missing/`true` = collapsed (default). */
  const [ruleCollapsed, setRuleCollapsed] = useState<Record<string, boolean>>({});
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);

  const toggleRuleCollapsed = useCallback((ruleId: string) => {
    setRuleCollapsed((prev) => ({
      ...prev,
      [ruleId]: prev[ruleId] === false ? true : false,
    }));
  }, []);

  const allRulesAcceptedOrRejected = useMemo(
    () => rules.length > 0 && rules.every(isRuleReviewDecided),
    [rules]
  );

  const handleResumeRun = useCallback(async () => {
    if (!tenantId?.trim() || !domainId?.trim() || !agenticRunId?.trim()) return;
    if (!allRulesAcceptedOrRejected) {
      toast.error('Approve or reject every rule before resuming the run.');
      return;
    }
    setResumeLoading(true);
    try {
      const data = await postResumeDataQualityRun({
        tenant_id: tenantId.trim(),
        domain_id: domainId.trim(),
        run_id: agenticRunId.trim(),
      });
      const status =
        typeof data?.status === 'string' && data.status.trim() ? data.status.trim() : null;
      const isRunQueued = isDataQualityResumeRunQueued(data);
      toast.success('Run resume requested');
      await onResumeSuccess?.({ status, isRunQueued });
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, 'Failed to resume run'));
    } finally {
      setResumeLoading(false);
    }
  }, [tenantId, domainId, agenticRunId, allRulesAcceptedOrRejected, onResumeSuccess]);

  const loadRules = useCallback(async () => {
    if (!tenantId?.trim() || !domainId?.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDataQualityRules({
        tenant_id: tenantId.trim(),
        domain_id: domainId.trim(),
        run_id: agenticRunId?.trim() || null,
      });
      setRules(Array.isArray(res.rules) ? res.rules : []);
    } catch (e: unknown) {
      const message = getDisplayErrorMessage(e, 'Failed to load data quality rules');
      setError(message);
      setRules([]);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [tenantId, domainId, agenticRunId]);

  useEffect(() => {
    if (!enabled) return;
    void loadRules();
  }, [enabled, loadRules]);

  useEffect(() => {
    setRuleComments((prev) => {
      const next = { ...prev };
      for (const r of rules) {
        if (next[r.rule_id] === undefined) {
          next[r.rule_id] = typeof r.review_notes === 'string' ? r.review_notes : '';
        }
      }
      for (const key of Object.keys(next)) {
        if (!rules.some((r) => r.rule_id === key)) delete next[key];
      }
      return next;
    });
  }, [rules]);

  useEffect(() => {
    setRuleAllowedValuesText((prev) => {
      const next = { ...prev };
      for (const r of rules) {
        const list = hintAllowedValuesList(r);
        if (list.length > 0 && next[r.rule_id] === undefined) {
          next[r.rule_id] = list.join('\n');
        }
      }
      for (const key of Object.keys(next)) {
        if (!rules.some((rule) => rule.rule_id === key)) delete next[key];
      }
      return next;
    });
  }, [rules]);

  useEffect(() => {
    setRuleSourceTextDraft((prev) => {
      const next = { ...prev };
      for (const r of rules) {
        if (next[r.rule_id] === undefined) {
          next[r.rule_id] = typeof r.source_text === 'string' ? r.source_text : '';
        }
      }
      for (const key of Object.keys(next)) {
        if (!rules.some((r) => r.rule_id === key)) delete next[key];
      }
      return next;
    });
  }, [rules]);

  const submitRuleReview = async (rule: DataQualityRuleRow, action: 'approve' | 'reject') => {
    const reviewNotes = (ruleComments[rule.rule_id] ?? '').trim();
    if (action === 'reject' && !reviewNotes) {
      toast.error('Add a review comment before rejecting (sent as review_notes).');
      return;
    }

    setActionRuleId(rule.rule_id);
    try {
      const conditionJson =
        action === 'approve'
          ? buildApproveConditionJson(rule, ruleAllowedValuesText[rule.rule_id])
          : undefined;

      /** Same POST /data-quality/rules/{id}/review for approve and reject; reject omits condition_json. */
      const payload: Parameters<typeof postDataQualityRuleReview>[1] = {
        tenant_id: tenantId.trim(),
        reviewed_by: buildReviewedBy(authUser),
        action,
        review_notes: reviewNotes.length > 0 ? reviewNotes : null,
      };
      if (action === 'approve' && conditionJson && Object.keys(conditionJson).length > 0) {
        payload.condition_json = conditionJson;
      }

      await postDataQualityRuleReview(rule.rule_id, payload);
      toast.success(action === 'approve' ? 'Rule approved' : 'Rule rejected');
      await loadRules();
      setRuleComments((prev) => {
        const next = { ...prev };
        delete next[rule.rule_id];
        return next;
      });
      setRuleAllowedValuesText((prev) => {
        const next = { ...prev };
        delete next[rule.rule_id];
        return next;
      });
    } catch (e: unknown) {
      toast.error(getDisplayErrorMessage(e, 'Review request failed'));
    } finally {
      setActionRuleId(null);
    }
  };

  const onApprove = (rule: DataQualityRuleRow) => void submitRuleReview(rule, 'approve');
  const onReject = (rule: DataQualityRuleRow) => void submitRuleReview(rule, 'reject');

  const submitRuleEdit = async (rule: DataQualityRuleRow) => {
    const reviewNotes = (ruleComments[rule.rule_id] ?? '').trim();
    const sourceDraft = ruleSourceTextDraft[rule.rule_id] ?? '';
    const conditionJson = buildEditConditionJson(rule, ruleAllowedValuesText[rule.rule_id], sourceDraft);

    setActionRuleId(rule.rule_id);
    try {
      await postDataQualityRuleReview(rule.rule_id, {
        tenant_id: tenantId.trim(),
        reviewed_by: buildReviewedBy(authUser),
        action: 'edit',
        review_notes: reviewNotes.length > 0 ? reviewNotes : null,
        condition_json: conditionJson,
      });
      toast.success('Rule edit saved');
      await loadRules();
      setRuleSourceTextDraft((prev) => {
        const next = { ...prev };
        delete next[rule.rule_id];
        return next;
      });
    } catch (e: unknown) {
      toast.error(getDisplayErrorMessage(e, 'Edit request failed'));
    } finally {
      setActionRuleId(null);
    }
  };

  if (!enabled) return null;

  return (
    <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 dark:bg-amber-950/20 px-3 py-3 space-y-3">
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-expanded={panelExpanded}
          aria-label={panelExpanded ? 'Collapse rule review panel' : 'Expand rule review panel'}
          onClick={() => setPanelExpanded((v) => !v)}
        >
          <ChevronDown
            className={cn('size-4 transition-transform duration-200', !panelExpanded && '-rotate-90')}
            aria-hidden
          />
        </button>
        <div className="min-w-0 flex-1 flex flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Rule review</p>
              {panelExpanded ? (
                <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                  Approve or reject rules; edit rule text in the expanded rule box (Save edit or ⌘↩ / Ctrl+Enter).
                  Use the chevron on each rule to show or hide details. Resume runs only after every rule is active or
                  rejected.
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                type="button"
                variant="default"
                size="sm"
                className="!h-8 gap-1 text-xs"
                disabled={resumeLoading || loading || !allRulesAcceptedOrRejected}
                title={
                  allRulesAcceptedOrRejected
                    ? undefined
                    : rules.length === 0
                      ? 'Load rules (Refresh) before resuming.'
                      : 'Every rule must be approved or rejected before resuming the run.'
                }
                onClick={() => void handleResumeRun()}
              >
                {resumeLoading ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Play className="size-3" />
                )}
                Resume
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="!h-8 shrink-0 gap-1 text-xs"
                disabled={loading}
                onClick={() => void loadRules()}
              >
                <RefreshCw className={cn('size-3', loading && 'animate-spin')} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      {panelExpanded &&
        (loading && rules.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
            <Loader2 className="size-4 animate-spin" />
            Loading rules…
          </div>
        ) : error && rules.length === 0 ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : rules.length === 0 ? (
          <p className="text-xs text-muted-foreground">No rules returned for this run.</p>
        ) : (
          <ul className="space-y-2 max-h-[min(420px,50vh)] overflow-y-auto pr-1">
            {rules.map((rule) => {
              const busy = actionRuleId === rule.rule_id;
              const tbl = rule.table_name ?? '—';
              const col = rule.column_name ?? '—';
              const showAllowedValuesEditor = hintAllowedValuesList(rule).length > 0;
              const collapsed = ruleCollapsed[rule.rule_id] !== false;
              return (
              <li
                key={rule.rule_id}
                className="rounded-md border border-border/60 bg-card/80 overflow-hidden"
              >
                <div className="flex items-start gap-1.5 p-2 border-b border-border/40 bg-muted/10">
                  <button
                    type="button"
                    className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-expanded={!collapsed}
                    aria-label={collapsed ? 'Expand rule' : 'Collapse rule'}
                    onClick={() => toggleRuleCollapsed(rule.rule_id)}
                  >
                    <ChevronDown
                      className={cn('size-4 transition-transform duration-200', collapsed && '-rotate-90')}
                      aria-hidden
                    />
                  </button>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5 gap-y-1">
                      <span
                        className={cn(
                          'text-[10px] font-medium px-1.5 py-0.5 rounded border',
                          statusBadgeClass(rule.rule_status)
                        )}
                      >
                        {rule.rule_status ?? 'unknown'}
                      </span>
                      {rule.severity && (
                        <span className="text-[10px] uppercase text-muted-foreground">{rule.severity}</span>
                      )}
                      <span className="text-[10px] font-mono text-muted-foreground">{rule.rule_type}</span>
                    </div>
                    <p className="text-xs font-medium leading-tight">
                      {tbl}.{col}
                    </p>
                  </div>
                </div>

                {!collapsed && (
                  <div className="space-y-2 p-2.5 pt-2">
                    <div>
                      <div className="flex flex-wrap items-end justify-between gap-2">
                        <label
                          className="text-[10px] font-medium text-muted-foreground"
                          htmlFor={`dq-rule-source-${rule.rule_id}`}
                        >
                          Rule text
                        </label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="!h-7 text-[10px] gap-1"
                          disabled={busy || loading}
                          onClick={() => void submitRuleEdit(rule)}
                        >
                          {busy ? <Loader2 className="size-3 animate-spin" /> : null}
                          Save edit
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground/90 mt-0.5 leading-snug">
                        Saves via review with <span className="font-mono">action: edit</span> —{' '}
                        <span className="font-mono">condition_json</span> includes allowed values / hints and{' '}
                        <span className="font-mono">source_text</span>. Use ⌘↩ or Ctrl+Enter in the box below.
                      </p>
                      <Textarea
                        id={`dq-rule-source-${rule.rule_id}`}
                        value={ruleSourceTextDraft[rule.rule_id] ?? ''}
                        onChange={(e) =>
                          setRuleSourceTextDraft((prev) => ({
                            ...prev,
                            [rule.rule_id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter' || (!e.metaKey && !e.ctrlKey)) return;
                          e.preventDefault();
                          void submitRuleEdit(rule);
                        }}
                        rows={3}
                        className="mt-1 text-xs min-h-[64px] resize-y"
                        placeholder="Natural language rule…"
                        disabled={busy || loading}
                      />
                    </div>
                    {(() => {
                      const sp = getRuleSqlPreview(rule);
                      if (!sp) return null;
                      return <RuleSqlPreviewBlock preview={sp} />;
                    })()}
                    {showAllowedValuesEditor ? (
                      <div>
                        <label
                          className="text-[10px] font-medium text-muted-foreground"
                          htmlFor={`dq-rule-allowed-${rule.rule_id}`}
                        >
                          Allowed values for approve (sent as condition_json.allowed_values)
                        </label>
                        <p className="text-[10px] text-muted-foreground/90 mt-0.5 leading-snug">
                          One per line (e.g. CREATED / SHIPPED / CANCELLED). Defaults from the rule; edit before
                          Approve.
                        </p>
                        <Textarea
                          id={`dq-rule-allowed-${rule.rule_id}`}
                          value={ruleAllowedValuesText[rule.rule_id] ?? ''}
                          onChange={(e) =>
                            setRuleAllowedValuesText((prev) => ({
                              ...prev,
                              [rule.rule_id]: e.target.value,
                            }))
                          }
                          rows={4}
                          className="mt-1 text-xs font-mono min-h-[72px] resize-y"
                          placeholder={'CREATED\nSHIPPED\nCANCELLED'}
                          disabled={busy || loading}
                        />
                      </div>
                    ) : null}
                    <div>
                      <label
                        className="text-[10px] font-medium text-muted-foreground"
                        htmlFor={`dq-rule-comment-${rule.rule_id}`}
                      >
                        Review comment
                      </label>
                      <Textarea
                        id={`dq-rule-comment-${rule.rule_id}`}
                        value={ruleComments[rule.rule_id] ?? ''}
                        onChange={(e) =>
                          setRuleComments((prev) => ({ ...prev, [rule.rule_id]: e.target.value }))
                        }
                        rows={2}
                        className="mt-1 text-xs min-h-[52px] resize-y"
                        placeholder="Sent as review_notes — required to reject (e.g. why the rule is out of scope)."
                        disabled={busy || loading}
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        className="!h-8 text-xs gap-1"
                        disabled={busy || loading}
                        onClick={() => void onApprove(rule)}
                      >
                        {busy ? <Loader2 className="size-3 animate-spin" /> : <ThumbsUp className="size-3" />}
                        Approve
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="!h-8 text-xs gap-1"
                        disabled={busy || loading}
                        onClick={() => void onReject(rule)}
                      >
                        <ThumbsDown className="size-3" />
                        Reject
                      </Button>
                    </div>
                  </div>
                )}
              </li>
              );
            })}
          </ul>
        ))}
    </div>
  );
}
