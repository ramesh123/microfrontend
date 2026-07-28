import { useEffect, useMemo, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import {
  fetchDataQualityRunDetail,
  fetchDataQualityArtifactJson,
  normalizeEvidenceResponseToRows,
  type DataQualityRunDetailResponse,
} from '@/controllers/API/dataQualityApi';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import CustomTableData from '@/components/ui/CustomTableData';

type Row = Record<string, unknown>;

function shouldFetchArtifactLink(artifactKey: string, rawUrl: string): boolean {
  const u = rawUrl.trim().toLowerCase();
  if (!u) return false;
  if (artifactKey === 'excel_report') return false;
  if (artifactKey === 'resume_after_rule_review') return false;
  if (u.includes('/excel')) return false;
  if (u.includes('resume-after-rule-review')) return false;
  return true;
}

function rowsFromArtifactPayload(data: unknown): Row[] {
  return normalizeEvidenceResponseToRows(data);
}

function buildColumns(rows: Row[], maxCols = 10) {
  if (rows.length === 0) return [];
  const keys = Object.keys(rows[0]!).slice(0, maxCols);
  return keys.map((key) => ({
    key,
    header: key.replace(/_/g, ' '),
    truncateData: true,
    truncateAt: 48,
  }));
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  const display =
    value === null || value === undefined || value === ''
      ? '—'
      : typeof value === 'number'
        ? String(value)
        : String(value);
  return (
    <div className="rounded-md border border-border/50 bg-muted/20 px-2.5 py-1.5">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{display}</p>
    </div>
  );
}

export interface DataQualityRunSummaryPanelProps {
  tenantId: string;
  domainId: string;
  agenticRunId: string;
  enabled?: boolean;
  className?: string;
}

export function DataQualityRunSummaryPanel({
  tenantId,
  domainId,
  agenticRunId,
  enabled = true,
  className,
}: DataQualityRunSummaryPanelProps) {
  const [detail, setDetail] = useState<DataQualityRunDetailResponse | null>(null);
  const [artifactPayloads, setArtifactPayloads] = useState<Record<string, unknown>>({});
  const [artifactErrors, setArtifactErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [artifactsLoading, setArtifactsLoading] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const tid = tenantId?.trim();
    const did = domainId?.trim();
    const rid = agenticRunId?.trim();
    if (!tid || !did || !rid) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setArtifactsLoading(true);
      setError(null);
      setDetail(null);
      setArtifactPayloads({});
      setArtifactErrors({});
      try {
        const run = await fetchDataQualityRunDetail(rid, { tenant_id: tid, domain_id: did });
        if (cancelled) return;
        setDetail(run);
        setLoading(false);

        const arts = run.artifacts;
        if (!arts || typeof arts !== 'object') {
          setArtifactsLoading(false);
          return;
        }

        const entries = Object.entries(arts as Record<string, string>).filter(([k, v]) =>
          typeof v === 'string' ? shouldFetchArtifactLink(k, v) : false
        );

        const nextPayloads: Record<string, unknown> = {};
        const nextErrors: Record<string, string> = {};

        await Promise.all(
          entries.map(async ([key, url]) => {
            try {
              const data = await fetchDataQualityArtifactJson(url);
              if (!cancelled) nextPayloads[key] = data;
            } catch (e: unknown) {
              const msg =
                (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
                (e as Error)?.message ??
                'Request failed';
              if (!cancelled) nextErrors[key] = msg;
            }
          })
        );

        if (!cancelled) {
          setArtifactPayloads(nextPayloads);
          setArtifactErrors(nextErrors);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const msg =
            (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
            (e as Error)?.message ??
            'Failed to load run summary';
          setError(msg);
          setLoading(false);
        }
      } finally {
        if (!cancelled) setArtifactsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, tenantId, domainId, agenticRunId, reloadTick]);

  const recommendedRows = useMemo(() => {
    const raw = detail?.recommended_actions;
    if (!Array.isArray(raw)) return [];
    return raw.filter((x): x is Row => x && typeof x === 'object' && !Array.isArray(x)) as Row[];
  }, [detail]);

  const artifactEntries = useMemo(() => {
    if (!detail?.artifacts || typeof detail.artifacts !== 'object') return [];
    return Object.entries(detail.artifacts as Record<string, string>).filter(([k, v]) =>
      typeof v === 'string' ? shouldFetchArtifactLink(k, v) : false
    );
  }, [detail]);

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Run summary</h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={loading}
          onClick={() => setReloadTick((n) => n + 1)}
        >
          Refresh
        </Button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
          <Loader2 className="size-4 animate-spin" />
          Loading run details…
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {!loading && detail && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">
              {String(detail.workflow_status ?? detail.status ?? '—')}
            </Badge>
            {detail.dashboard_title && (
              <span className="text-xs text-muted-foreground truncate max-w-[min(100%,28rem)]">
                {detail.dashboard_title}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            <Stat label="Trust score" value={detail.overall_trust_score} />
            <Stat label="Critical issues" value={detail.critical_issue_count} />
            <Stat label="Warnings" value={detail.warning_issue_count} />
            <Stat label="Dashboard charts" value={detail.dashboard_chart_count} />
            <Stat label="Active rules" value={detail.active_rule_count} />
            <Stat label="Duplicate candidates" value={detail.duplicate_candidate_count} />
            <Stat label="Remediation actions" value={detail.remediation_action_count} />
            <Stat label="Review queue" value={detail.review_queue_pending_count} />
          </div>

          {detail.summary && typeof detail.summary === 'object' && (
            <div className="rounded-md border border-border/40 bg-muted/10 px-3 py-2">
              <p className="text-[10px] font-medium text-muted-foreground mb-1">Persisted summary</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {Object.entries(detail.summary as Record<string, unknown>)
                  .filter(([k]) => !['dashboard_id', 'dashboard_title'].includes(k))
                  .slice(0, 12)
                  .map(([k, v]) => (
                    <div key={k} className="flex flex-col gap-0.5">
                      <span className="text-muted-foreground">{k.replace(/_/g, ' ')}</span>
                      <span className="font-medium tabular-nums">
                        {v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {detail.remediation_summary && typeof detail.remediation_summary === 'object' && (
            <div className="rounded-md border border-border/40 bg-muted/10 px-3 py-2 text-xs space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground">Remediation</p>
              <p>
                <span className="text-muted-foreground">Actions:</span>{' '}
                <span className="font-medium">
                  {String((detail.remediation_summary as { action_count?: unknown }).action_count ?? '—')}
                </span>
                {' · '}
                <span className="text-muted-foreground">Critical:</span>{' '}
                <span className="font-medium">
                  {String((detail.remediation_summary as { critical_action_count?: unknown }).critical_action_count ?? '—')}
                </span>
              </p>
            </div>
          )}

          {recommendedRows.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground">Recommended actions</p>
              <CustomTableData
                data={recommendedRows.slice(0, 25)}
                columns={buildColumns(recommendedRows, 8)}
                rowKey="action_key"
                scrollHeightClass="max-h-[220px]"
                HorizontalScroll
              />
            </div>
          )}

          {artifactEntries.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground flex items-center gap-2">
                Linked artifacts
                {artifactsLoading && <Loader2 className="size-3 animate-spin" />}
              </p>
              <Accordion type="multiple" className="border rounded-md divide-y">
                {artifactEntries.map(([key]) => {
                  const payload = artifactPayloads[key];
                  const err = artifactErrors[key];
                  const rows = payload !== undefined ? rowsFromArtifactPayload(payload) : [];
                  return (
                    <AccordionItem key={key} value={key} className="border-0">
                      <AccordionTrigger className="px-3 py-2 text-xs hover:no-underline">
                        <span className="font-medium capitalize">{key.replace(/_/g, ' ')}</span>
                        {err && (
                          <Badge variant="destructive" className="ml-2 text-[9px]">
                            Error
                          </Badge>
                        )}
                        {!err && rows.length > 0 && (
                          <span className="ml-2 text-muted-foreground font-normal">{rows.length} rows</span>
                        )}
                      </AccordionTrigger>
                      <AccordionContent className="px-3 pb-3">
                        {err && <p className="text-xs text-destructive">{err}</p>}
                        {!err && rows.length > 0 && (
                          <CustomTableData
                            data={rows.slice(0, 50)}
                            columns={buildColumns(rows, 10)}
                            rowKey="id"
                            scrollHeightClass="max-h-[200px]"
                            HorizontalScroll
                          />
                        )}
                        {!err && rows.length === 0 && payload !== undefined && (
                          <pre className="text-[10px] font-mono bg-muted/30 p-2 rounded border border-border/30 overflow-x-auto max-h-[180px] overflow-y-auto whitespace-pre-wrap break-words">
                            {JSON.stringify(payload, null, 2)}
                          </pre>
                        )}
                        {artifactsLoading && payload === undefined && !err && (
                          <p className="text-xs text-muted-foreground">Loading…</p>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>
          )}
        </>
      )}
    </div>
  );
}
