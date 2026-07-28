import React, { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { getChartPreviewIcon } from "@/pages/charts/components/ChartPreviewIcons";
import type { DashboardChartSpec } from "@/controllers/API/agenticApi";
import { dashboardChartSpecToChartDetail } from "./chartFetchUtils";
import type { ChartDetail } from "./chartTypes";
import { Am5MiniChart } from "./Am5MiniChart";
import { DashboardChartsTabs } from "./DashboardChartCards";
import { FetchedDashboardChartsByIds } from "./FetchedDashboardChartsByIds";
import { FetchedDashboardChartsByDashboardId } from "./FetchedDashboardChartsByDashboardId";
import { seriesPointsToAnomalyLineDetail } from "./anomalyChartUtils";

// --- Shared types & helpers ---

export interface AgentRendererProps {
  artifacts: Record<string, unknown>;
  /** When tenant/domain context exists, shows AI control on dashboard chart cards. */
  onCognitoChart?: (detail: ChartDetail) => void;
}

type AgentRendererComponent = React.FC<AgentRendererProps>;

function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-medium leading-none",
        className,
      )}
    >
      {children}
    </span>
  );
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5 text-xs">
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className="font-medium truncate">{value}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mt-2 mb-1">
      {children}
    </p>
  );
}

// --- 1. PlanningAgent ---

const PlanningAgentRenderer: AgentRendererComponent = ({ artifacts }) => {
  const steps = (artifacts.steps as string[]) ?? [];
  return (
    <div className="space-y-1">
      <StatRow label="Steps" value={steps.length} />
      <ol className="list-decimal list-inside space-y-0.5 text-xs pl-1">
        {steps.map((step, i) => (
          <li key={i} className="text-muted-foreground">
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
};

// --- 2. SchemaAgent ---

const SchemaAgentRenderer: AgentRendererComponent = ({ artifacts }) => {
  const tables = (artifacts.tables as number) ?? 0;
  const tableNames = (artifacts.table_names as string[]) ?? [];
  const tablesDetail =
    (artifacts.tables_detail as Array<{
      name: string;
      columns: Array<{ name: string; data_type: string }>;
    }>) ?? [];
  const show = tablesDetail.slice(0, 5);

  return (
    <div className="space-y-1.5">
      <StatRow label="Tables scanned" value={tables} />
      {show.map((t) => (
        <div key={t.name} className="border rounded-sm overflow-hidden">
          <div className="flex items-center justify-between bg-muted/30 px-2 py-1">
            <span className="text-xs font-medium">{t.name}</span>
            <span className="text-[10px] text-muted-foreground">
              {t.columns.length} cols
            </span>
          </div>
          <div className="px-2 py-1">
            <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0 text-[11px]">
              {t.columns.slice(0, 5).map((c) => (
                <React.Fragment key={c.name}>
                  <span className="truncate">{c.name}</span>
                  <span className="text-muted-foreground text-[10px]">
                    {c.data_type}
                  </span>
                </React.Fragment>
              ))}
            </div>
            {t.columns.length > 5 && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                +{t.columns.length - 5} more columns
              </p>
            )}
          </div>
        </div>
      ))}
      {tableNames.length > 5 && (
        <p className="text-[10px] text-muted-foreground">
          ...and {tableNames.length - 5} more tables
        </p>
      )}
    </div>
  );
};

// --- 3. ProfilingAgent ---

const ProfilingAgentRenderer: AgentRendererComponent = ({ artifacts }) => {
  const tables = (artifacts.tables as number) ?? 0;
  const rawProfiles = artifacts.profiles;
  const profiles = Array.isArray(rawProfiles) ? rawProfiles : [];

  return (
    <div className="space-y-2">
      <StatRow label="Tables profiled" value={tables} />
      {profiles.slice(0, 5).map((p, idx) => {
        if (!p || typeof p !== "object") return null;
        const name = (p as { name?: string }).name ?? `Table ${idx + 1}`;
        const rowCount = (p as { row_count?: number }).row_count ?? 0;
        const sampleValues = (p as { sample_values?: Record<string, string[]> }).sample_values ?? {};
        const timeColumns = (p as { time_columns?: string[] }).time_columns ?? [];
        const numericColumns = (p as { numeric_columns?: string[] }).numeric_columns ?? [];
        const categoricalColumns = (p as { categorical_columns?: string[] }).categorical_columns ?? [];
        const svKeys = Object.keys(sampleValues).slice(0, 5);
        const sampleVals = (key: string) => {
          const v = sampleValues[key];
          return Array.isArray(v) ? v : [];
        };
        return (
          <div key={name} className="border rounded-sm p-1.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">{name}</span>
              <Badge className="bg-muted/50">
                {Number(rowCount).toLocaleString()} rows
              </Badge>
            </div>
            {timeColumns.length > 0 && (
              <StatRow label="Time" value={timeColumns.join(", ")} />
            )}
            <StatRow
              label="Columns"
              value={`${numericColumns.length} numeric, ${categoricalColumns.length} categorical`}
            />
            {svKeys.length > 0 && (
              <>
                <SectionLabel>Sample Values</SectionLabel>
                <div className="space-y-0.5">
                  {svKeys.map((k) => (
                    <div
                      key={k}
                      className="flex items-baseline gap-1 text-[11px]"
                    >
                      <span className="text-muted-foreground shrink-0 font-medium">
                        {k}:
                      </span>
                      <div className="flex flex-wrap gap-0.5">
                        {sampleVals(k).slice(0, 5).map((v, i) => (
                          <Badge
                            key={i}
                            className="bg-primary/5 text-primary/80"
                          >
                            {String(v)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

// --- 4. ContextAgent ---

const ContextAgentRenderer: AgentRendererComponent = ({ artifacts }) => {
  const entities = (artifacts.entities as number) ?? 0;
  const sampleEntities = (artifacts.sample_entities as string[]) ?? [];
  const glossaryTerms =
    (artifacts.glossary_terms as Array<{ term: string }>) ?? [];

  return (
    <div className="space-y-1.5">
      <StatRow label="Entities discovered" value={entities} />
      <StatRow label="Glossary terms" value={glossaryTerms.length} />
      <SectionLabel>Sample Entities</SectionLabel>
      <div className="flex flex-wrap gap-1">
        {sampleEntities.slice(0, 10).map((e, i) => (
          <Badge key={i} className="bg-muted/50">
            {e}
          </Badge>
        ))}
      </div>
    </div>
  );
};

// --- 5. OntologyAgent ---

const OntologyAgentRenderer: AgentRendererComponent = ({ artifacts }) => {
  const concepts = (artifacts.concepts as number) ?? 0;
  const synonymEdges = (artifacts.synonym_edges as number) ?? 0;
  const conceptsDetail = (artifacts.concepts_detail as string[]) ?? [];
  const synonymDetail =
    (artifacts.synonym_edges_detail as Array<{
      term: string;
      synonym: string;
      confidence: number;
    }>) ?? [];

  return (
    <div className="space-y-1.5">
      <StatRow label="Concepts" value={concepts} />
      <StatRow label="Synonym edges" value={synonymEdges} />
      <SectionLabel>Top Concepts</SectionLabel>
      <div className="flex flex-wrap gap-1">
        {conceptsDetail.slice(0, 6).map((c, i) => (
          <Badge key={i} className="bg-muted/50">
            {c}
          </Badge>
        ))}
        {conceptsDetail.length > 6 && (
          <Badge className="text-muted-foreground">
            +{conceptsDetail.length - 6}
          </Badge>
        )}
      </div>
      {synonymDetail.length > 0 && (
        <>
          <SectionLabel>Synonym Edges</SectionLabel>
          <div className="space-y-0.5">
            {synonymDetail.slice(0, 3).map((s, i) => (
              <p key={i} className="text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">{s.term}</span>
                {" → "}
                <span className="font-medium text-foreground">{s.synonym}</span>
                <span className="ml-1 text-[10px]">
                  ({(s.confidence * 100).toFixed(0)}%)
                </span>
              </p>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// --- 6. GlossaryAgent ---

const GlossaryAgentRenderer: AgentRendererComponent = ({ artifacts }) => {
  const terms = (artifacts.terms as number) ?? 0;
  const termsDetail =
    (artifacts.terms_detail as Array<{
      term: string;
      synonyms: string[];
      definition: string | null;
    }>) ?? [];

  return (
    <div className="space-y-1.5">
      <StatRow label="Terms defined" value={terms} />
      <div className="space-y-1">
        {termsDetail.slice(0, 5).map((t, i) => (
          <div key={i} className="flex items-baseline gap-1.5 text-[11px]">
            <span className="font-medium shrink-0">{t.term}</span>
            {t.synonyms?.length > 0 && (
              <span className="text-muted-foreground">
                ({t.synonyms.join(", ")})
              </span>
            )}
            {t.definition && (
              <span className="text-muted-foreground truncate">
                &mdash; {t.definition}
              </span>
            )}
          </div>
        ))}
        {termsDetail.length > 5 && (
          <p className="text-[10px] text-muted-foreground">
            +{termsDetail.length - 5} more terms
          </p>
        )}
      </div>
    </div>
  );
};

// --- 7. JoinAgent ---

const JoinAgentRenderer: AgentRendererComponent = ({ artifacts }) => {
  const joins = (artifacts.joins as number) ?? 0;
  const joinEdges =
    (artifacts.join_edges_detail as Array<{
      left_table: string;
      right_table: string;
      left_key: string;
      right_key: string;
      confidence: number;
      relationship: string;
      coverage_check?: { status: string };
    }>) ?? [];

  return (
    <div className="space-y-1.5">
      <StatRow label="Join candidates" value={joins} />
      <div className="space-y-1">
        {joinEdges.slice(0, 5).map((j, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 text-[11px] flex-wrap"
          >
            <span className="font-medium">
              {j.left_table}.{j.left_key}
            </span>
            <span className="text-muted-foreground">→</span>
            <span className="font-medium">
              {j.right_table}.{j.right_key}
            </span>
            <Badge
              className={cn(
                j.confidence >= 0.7
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-amber-500/10 text-amber-600",
              )}
            >
              {(j.confidence * 100).toFixed(0)}%
            </Badge>
            <Badge className="bg-muted/50">{j.relationship}</Badge>
          </div>
        ))}
        {joinEdges.length > 5 && (
          <p className="text-[10px] text-muted-foreground">
            +{joinEdges.length - 5} more joins
          </p>
        )}
      </div>
    </div>
  );
};

// --- 8. MetricAgent ---

const MetricAgentRenderer: AgentRendererComponent = ({ artifacts }) => {
  const metrics = (artifacts.metrics as number) ?? 0;
  const defs =
    (artifacts.metric_defs_detail as Array<{
      metric_name: string;
      formula: string;
      base_table: string;
    }>) ?? [];

  return (
    <div className="space-y-1.5">
      <StatRow label="Metrics defined" value={metrics} />
      <div className="text-[11px]">
        <div className="grid grid-cols-[1fr_1fr_auto] gap-x-2 gap-y-0.5">
          <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase">
            Metric
          </span>
          <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase">
            Formula
          </span>
          <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase">
            Table
          </span>
          {defs.slice(0, 6).map((m, i) => (
            <React.Fragment key={i}>
              <span className="font-medium truncate">{m.metric_name}</span>
              <span className="text-muted-foreground truncate">
                {m.formula}
              </span>
              <span className="text-muted-foreground truncate">
                {m.base_table}
              </span>
            </React.Fragment>
          ))}
        </div>
        {defs.length > 6 && (
          <p className="text-[10px] text-muted-foreground mt-1">
            +{defs.length - 6} more metrics
          </p>
        )}
      </div>
    </div>
  );
};

// --- 9. SemanticModelAgent ---

const SemanticModelAgentRenderer: AgentRendererComponent = ({ artifacts }) => {
  const models = (artifacts.models as number) ?? 0;
  const classifications =
    (artifacts.model_classifications_detail as Array<{
      table: string;
      model_type: string;
      confidence: number;
      time_columns: number;
      numeric_columns: number;
      categorical_columns: number;
    }>) ?? [];

  return (
    <div className="space-y-1.5">
      <StatRow label="Models classified" value={models} />
      <div className="space-y-0.5">
        {classifications.map((c, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[11px]">
            <span className="font-medium flex-1 truncate">{c.table}</span>
            <Badge
              className={cn(
                c.model_type === "fact"
                  ? "bg-blue-500/10 text-blue-600"
                  : "bg-violet-500/10 text-violet-600",
              )}
            >
              {c.model_type}
            </Badge>
            <span className="text-muted-foreground text-[10px] w-8 text-right">
              {(c.confidence * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- 10. RollupPlannerAgent ---

const RollupPlannerAgentRenderer: AgentRendererComponent = ({ artifacts }) => {
  const rollups = (artifacts.rollups as number) ?? 0;
  const candidates =
    (artifacts.rollup_candidates as Array<{
      metric_name: string;
      dimensions: string[];
      time_grain: string;
    }>) ?? [];

  return (
    <div className="space-y-1.5">
      <StatRow label="Rollups" value={rollups} />
      <StatRow label="Candidates" value={candidates.length} />
      {candidates.length > 0 && (
        <div className="text-[11px] space-y-0.5">
          {candidates.slice(0, 5).map((r, i) => (
            <div key={i} className="flex items-center gap-1.5 flex-wrap">
              <span className="font-medium">{r.metric_name}</span>
              <Badge className="bg-muted/50">{r.time_grain}</Badge>
              <span className="text-muted-foreground text-[10px]">
                [{(r.dimensions ?? []).join(", ")}]
              </span>
            </div>
          ))}
          {candidates.length > 5 && (
            <p className="text-[10px] text-muted-foreground">
              +{candidates.length - 5} more
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// --- 11. ChartPlannerAgent ---

const ChartPlannerAgentRenderer: AgentRendererComponent = ({ artifacts }) => {
  const selected = (artifacts.selected as number) ?? 0;
  const candidatesCount = (artifacts.candidates as number) ?? 0;
  const chartPlan =
    (artifacts.chart_plan as Array<{
      type: string;
      table: string;
      metric: string;
      intent: string;
      time_column?: string;
      category_column?: string | null;
    }>) ?? [];

  return (
    <div className="space-y-1.5">
      <div className="flex gap-3">
        <StatRow label="Selected" value={selected} />
        <StatRow label="Candidates" value={candidatesCount} />
      </div>
      <div className="space-y-1">
        {chartPlan.map((c, i) => {
          const IconComp = getChartPreviewIcon(c.type);
          return (
            <div key={i} className="flex items-center gap-2 text-[11px]">
              {IconComp ? (
                <IconComp className="size-6 text-primary shrink-0" />
              ) : (
                <div className="size-6 rounded bg-muted/50 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Badge className="bg-primary/10 text-primary">{c.type}</Badge>
                  <Badge className="bg-muted/50">{c.intent}</Badge>
                </div>
                <p className="text-muted-foreground truncate mt-0.5">
                  {c.metric} on {c.table}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// --- HierarchyBootstrapAgent (domain / hierarchy IDs from raw_json) ---

const HierarchyBootstrapAgentRenderer: AgentRendererComponent = ({ artifacts }) => {
  const domain = typeof artifacts.domain_id === "string" ? artifacts.domain_id : "—";
  const tenant = typeof artifacts.tenant_id === "string" ? artifacts.tenant_id : "—";
  const ids = Array.isArray(artifacts.hierarchy_ids)
    ? (artifacts.hierarchy_ids as string[])
    : [];
  const persisted =
    typeof artifacts.persisted_count === "number" ? artifacts.persisted_count : null;
  const build =
    typeof artifacts.build_version === "string" ? artifacts.build_version : null;
  const list =
    ids.length > 0 ? ids.join(", ") : "—";

  return (
    <div className="space-y-1">
      {build != null && build !== "" && <StatRow label="Build" value={build} />}
      <StatRow label="Domain" value={domain} />
      <StatRow label="Tenant" value={tenant} />
      <StatRow label="Hierarchy IDs" value={list} />
      {persisted != null && <StatRow label="Persisted" value={persisted} />}
    </div>
  );
};

// --- 12. QualityGateAgent ---

const QualityGateAgentRenderer: AgentRendererComponent = ({ artifacts }) => {
  const threshold = (artifacts.threshold as number) ?? 0;
  const edgesChecked = (artifacts.edges_checked as number) ?? 0;
  const lowConfidence = (artifacts.low_confidence as number) ?? 0;
  const ratio = edgesChecked > 0 ? lowConfidence / edgesChecked : 0;

  return (
    <div className="space-y-1">
      <StatRow label="Threshold" value={`${(threshold * 100).toFixed(0)}%`} />
      <StatRow label="Edges checked" value={edgesChecked} />
      <div className="flex items-baseline gap-1.5 text-xs">
        <span className="text-muted-foreground shrink-0">Low confidence:</span>
        <span
          className={cn(
            "font-medium",
            ratio > 0.5 ? "text-amber-600" : "text-foreground",
          )}
        >
          {lowConfidence}
        </span>
        {ratio > 0.5 && (
          <span className="text-[10px] text-amber-500">
            ({(ratio * 100).toFixed(0)}% of edges)
          </span>
        )}
      </div>
    </div>
  );
};

// --- AnomalyDetectionAgent ---

type TopAnomalyEvidence = {
  series_points?: Array<{ value?: number; period?: string }>;
  actual?: number;
  period?: string;
  z_score?: number;
  baseline?: number;
};

type TopAnomalyItem = {
  candidate_type?: string;
  metric_name?: string;
  raw_signal_name?: string;
  time_column?: string;
  grain?: string;
  formula?: string;
  table_name?: string;
  evidence?: TopAnomalyEvidence;
};

const AnomalyDetectionAgentRenderer: AgentRendererComponent = ({ artifacts }) => {
  const dqAnomalyCount = typeof artifacts.anomaly_count === "number" ? artifacts.anomaly_count : null;
  const dqCriticalCount =
    typeof artifacts.critical_anomaly_count === "number" ? artifacts.critical_anomaly_count : null;
  const hasDqPersistedCounts = dqAnomalyCount != null || dqCriticalCount != null;

  const insights = (artifacts.anomaly_insights as string[]) ?? [];
  const summaryBlock = artifacts.summary as
    | { top_anomalies?: TopAnomalyItem[]; window?: number; candidate_count?: number }
    | undefined;
  const topAnomalies = summaryBlock?.top_anomalies ?? [];
  const queries =
    (artifacts.executed_queries as Array<{
      sql?: string;
      title?: string;
      query_id?: string;
      row_count?: number;
    }>) ?? [];

  return (
    <div className="space-y-3">
      {hasDqPersistedCounts && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {dqAnomalyCount != null && <StatRow label="Anomalies" value={dqAnomalyCount} />}
          {dqCriticalCount != null && <StatRow label="Critical" value={dqCriticalCount} />}
        </div>
      )}
      {insights.length > 0 && (
        <div>
          <SectionLabel>Anomaly insights</SectionLabel>
          <ul className="list-disc list-inside text-[11px] text-muted-foreground space-y-1 pl-0.5">
            {insights.map((t, i) => (
              <li key={i} className="leading-snug">
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}

      {topAnomalies.length > 0 && (
        <div>
          <SectionLabel>Top anomalies</SectionLabel>
          <div className="space-y-2">
            {topAnomalies.map((a, i) => {
              const isMetric = a.candidate_type === "metric";
              const isRaw = a.candidate_type === "raw_signal";
              const seriesTitle = isMetric
                ? `${a.metric_name ?? "—"} · ${a.time_column ?? "—"}`
                : isRaw
                  ? `${a.raw_signal_name ?? "—"} · ${a.time_column ?? "—"}`
                  : `${a.candidate_type ?? "unknown"}`;
              const points = a.evidence?.series_points ?? [];
              return (
                <div key={i} className="border rounded-sm p-2 space-y-1.5 bg-muted/10">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge
                      className={
                        isMetric
                          ? "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                          : isRaw
                            ? "bg-amber-500/15 text-amber-800 dark:text-amber-200"
                            : "bg-muted/50"
                      }
                    >
                      {isMetric ? "metric" : isRaw ? "raw_signal" : a.candidate_type ?? "—"}
                    </Badge>
                    <span className="text-[11px] font-medium leading-tight">{seriesTitle}</span>
                  </div>
                  {(a.formula || a.grain || a.table_name) && (
                    <div className="text-[10px] text-muted-foreground space-y-0.5">
                      {a.table_name && <StatRow label="Table" value={a.table_name} />}
                      {a.grain && <StatRow label="Grain" value={a.grain} />}
                      {a.formula && (
                        <p className="font-mono break-all opacity-90">{a.formula}</p>
                      )}
                    </div>
                  )}
                  {a.evidence && (
                    <div className="text-[10px] text-muted-foreground grid grid-cols-2 gap-x-2 gap-y-0.5">
                      {a.evidence.period != null && (
                        <StatRow label="Period" value={String(a.evidence.period)} />
                      )}
                      {a.evidence.actual != null && (
                        <StatRow label="Actual" value={String(a.evidence.actual)} />
                      )}
                      {a.evidence.z_score != null && typeof a.evidence.z_score === "number" && (
                        <StatRow label="Z-score" value={a.evidence.z_score.toFixed(2)} />
                      )}
                    </div>
                  )}
                  {points.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-medium text-muted-foreground">
                        Series — value vs {a.time_column ?? "period"} (line)
                      </p>
                      <div className="h-[200px] w-full min-w-0 rounded border border-border/40 bg-background/30 overflow-hidden">
                        <Am5MiniChart
                          detail={seriesPointsToAnomalyLineDetail(
                            points,
                            seriesTitle,
                            i,
                          )}
                          height="200px"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {queries.length > 0 && (
        <div>
          <SectionLabel>Evidence SQL</SectionLabel>
          <div className="space-y-2">
            {queries.map((q, i) => (
              <div key={q.query_id ?? i} className="rounded border border-border/40 overflow-hidden">
                {q.title && (
                  <div className="px-2 py-1 bg-muted/30 text-[10px] font-medium">
                    {q.title}
                  </div>
                )}
                {q.sql && (
                  <pre className="text-[10px] font-mono p-2 overflow-x-auto whitespace-pre-wrap break-all bg-muted/20 max-h-36">
                    {q.sql}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasDqPersistedCounts &&
        insights.length === 0 &&
        topAnomalies.length === 0 &&
        queries.length === 0 && (
        <p className="text-[11px] text-muted-foreground">No anomaly details in payload</p>
      )}
    </div>
  );
};

// --- AnomalyDashboardAgent ---

function chartDetailsFromArtifacts(artifacts: Record<string, unknown>): ChartDetail[] {
  const raw = artifacts.chart_details;
  if (!Array.isArray(raw)) return [];
  return raw.map((item) =>
    dashboardChartSpecToChartDetail(item as DashboardChartSpec),
  );
}

const AnomalyDashboardAgentRenderer: AgentRendererComponent = ({ artifacts, onCognitoChart }) => {
  const chartDetails = chartDetailsFromArtifacts(artifacts);
  const chartIds = (artifacts.chart_ids as string[]) ?? [];
  const chartTitles = (artifacts.chart_titles as string[]) ?? [];
  const chartCount = (artifacts.chart_count as number) ?? chartIds.length;
  const title = (artifacts.dashboard_title as string) ?? "";
  const invId = (artifacts.investigation_id as string) ?? "";
  const dashId = (artifacts.dashboard_id as string) ?? "";
  const views = (artifacts.views as number) ?? 0;

  if (chartDetails.length > 0) {
    const charts = (artifacts.charts as number) ?? chartDetails.length;
    return (
      <div className="space-y-2">
        {(title || dashId || invId) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {title && <StatRow label="Title" value={title} />}
            {dashId && <StatRow label="Dashboard" value={dashId} />}
            {invId && <StatRow label="Investigation" value={invId} />}
          </div>
        )}
        <DashboardChartsTabs
          chartsCount={charts}
          viewsCount={views}
          chartDetails={chartDetails}
          onCognitoClick={onCognitoChart}
        />
      </div>
    );
  }

  if (chartIds.length > 0) {
    return (
      <div className="space-y-2">
        {(title || dashId || invId) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {title && <StatRow label="Title" value={title} />}
            {dashId && <StatRow label="Dashboard" value={dashId} />}
            {invId && <StatRow label="Investigation" value={invId} />}
          </div>
        )}
        <FetchedDashboardChartsByIds
          chartIds={chartIds}
          chartTitles={chartTitles.length > 0 ? chartTitles : undefined}
          chartsCount={chartCount}
          viewsCount={views}
          onCognitoClick={onCognitoChart}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {title && <StatRow label="Title" value={title} />}
      {dashId && <StatRow label="Dashboard" value={dashId} />}
      {invId && <StatRow label="Investigation" value={invId} />}
      <StatRow label="Charts" value={chartCount} />
      <p className="text-[11px] text-muted-foreground">No chart ids in payload</p>
    </div>
  );
};

const DashboardAgentRenderer: AgentRendererComponent = ({ artifacts, onCognitoChart }) => {
  const charts =
    (typeof artifacts.charts === "number" ? artifacts.charts : null) ??
    (typeof artifacts.chart_count === "number" ? artifacts.chart_count : null) ??
    0;
  const views = (artifacts.views as number) ?? 0;
  const chartDetails = chartDetailsFromArtifacts(artifacts);
  const dashTitle =
    typeof artifacts.dashboard_title === "string" && artifacts.dashboard_title.trim()
      ? artifacts.dashboard_title.trim()
      : "";
  const dashId =
    typeof artifacts.dashboard_id === "string" && artifacts.dashboard_id.trim()
      ? artifacts.dashboard_id.trim()
      : "";

  if (chartDetails.length > 0) {
    return (
      <DashboardChartsTabs
        chartsCount={charts || chartDetails.length}
        viewsCount={views}
        chartDetails={chartDetails}
        onCognitoClick={onCognitoChart}
      />
    );
  }

  if (dashId) {
    return (
      <div className="space-y-2">
        {dashTitle ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <StatRow label="Title" value={dashTitle} />
            <StatRow label="Dashboard" value={<span className="font-mono text-[10px]">{dashId}</span>} />
          </div>
        ) : (
          <div className="text-xs">
            <StatRow label="Dashboard" value={<span className="font-mono text-[10px]">{dashId}</span>} />
          </div>
        )}
        <div className="flex gap-3 text-xs">
          {charts > 0 && <StatRow label="Charts" value={charts} />}
          {views > 0 && <StatRow label="Views" value={views} />}
        </div>
        <FetchedDashboardChartsByDashboardId
          dashboardId={dashId}
          chartsCount={charts > 0 ? charts : undefined}
          viewsCount={views}
          onCognitoClick={onCognitoChart}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        <StatRow label="Charts" value={charts} />
        <StatRow label="Views" value={views} />
      </div>
      <p className="text-[11px] text-muted-foreground">No chart details or dashboard id in payload</p>
    </div>
  );
};

// --- CorrelationAgent (raw_json: summary_text + metric / correlation counts) ---

const CorrelationAgentRenderer: AgentRendererComponent = ({ artifacts }) => {
  const summaryText = typeof artifacts.summary_text === 'string' ? artifacts.summary_text.trim() : '';
  const insightText = typeof artifacts.insight_text === 'string' ? artifacts.insight_text.trim() : '';
  const narrativeText = typeof artifacts.narrative_text === 'string' ? artifacts.narrative_text.trim() : '';
  const metricCount = typeof artifacts.metric_count === 'number' ? artifacts.metric_count : null;
  const anomalyCount = typeof artifacts.anomaly_count === 'number' ? artifacts.anomaly_count : null;
  const pairCount = typeof artifacts.correlation_pair_count === 'number' ? artifacts.correlation_pair_count : null;
  const threadCount = typeof artifacts.thread_count === 'number' ? artifacts.thread_count : null;
  const mode = typeof artifacts.analysis_mode === 'string' ? artifacts.analysis_mode : null;
  const runId = typeof artifacts.correlation_run_id === 'string' ? artifacts.correlation_run_id : null;
  const forecast = typeof artifacts.forecast_periods === 'number' ? artifacts.forecast_periods : null;

  const hasStats =
    metricCount != null ||
    pairCount != null ||
    anomalyCount != null ||
    threadCount != null ||
    mode != null ||
    runId != null ||
    forecast != null;

  return (
    <div className="space-y-2">
      {hasStats && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {metricCount != null && <StatRow label="Metrics" value={metricCount} />}
          {pairCount != null && <StatRow label="Correlation pairs" value={pairCount} />}
          {anomalyCount != null && <StatRow label="Anomalies" value={anomalyCount} />}
          {threadCount != null && <StatRow label="Threads" value={threadCount} />}
          {forecast != null && <StatRow label="Forecast periods" value={forecast} />}
          {mode && <StatRow label="Mode" value={mode} />}
          {runId && (
            <StatRow label="Correlation run" value={<span className="font-mono text-[10px]">{runId}</span>} />
          )}
        </div>
      )}
      {(insightText || narrativeText) && (
        <div className="space-y-2 text-[11px] leading-relaxed">
          {insightText && (
            <div>
              <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">
                Insight
              </p>
              <p className="text-black dark:text-foreground whitespace-pre-wrap">{insightText}</p>
            </div>
          )}
          {narrativeText && (
            <div>
              <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">
                Narrative
              </p>
              <p className="text-black dark:text-foreground whitespace-pre-wrap">{narrativeText}</p>
            </div>
          )}
        </div>
      )}
      {summaryText ? (
        <p className="text-[11px] text-muted-foreground whitespace-pre-wrap leading-relaxed">{summaryText}</p>
      ) : null}
      {!hasStats && !summaryText && !insightText && !narrativeText ? (
        <p className="text-[11px] text-muted-foreground">No correlation details in payload</p>
      ) : null}
    </div>
  );
};

// --- Data quality observability pipeline (domain `data_quality_observability`) ---

const DataQualityWorkflowRouterRenderer: AgentRendererComponent = ({ artifacts }) => {
  const kind = typeof artifacts.workflow_kind === "string" ? artifacts.workflow_kind : "—";
  const runId = typeof artifacts.quality_run_id === "string" ? artifacts.quality_run_id : null;
  return (
    <div className="space-y-1 text-xs">
      <StatRow label="Workflow" value={kind} />
      {runId && (
        <StatRow label="Quality run" value={<span className="font-mono text-[10px]">{runId}</span>} />
      )}
    </div>
  );
};

const DatasetStagePlannerAgentRenderer: AgentRendererComponent = ({ artifacts }) => {
  const stageCount = typeof artifacts.stage_count === "number" ? artifacts.stage_count : null;
  const joinN = typeof artifacts.join_stage_count === "number" ? artifacts.join_stage_count : null;
  const filterN = typeof artifacts.filter_stage_count === "number" ? artifacts.filter_stage_count : null;
  const edges = typeof artifacts.lineage_edge_count === "number" ? artifacts.lineage_edge_count : null;
  const rejected = typeof artifacts.rejected_row_count === "number" ? artifacts.rejected_row_count : null;
  const measured = typeof artifacts.measured_stage_count === "number" ? artifacts.measured_stage_count : null;
  const finalRows = typeof artifacts.final_dataset_row_count === "number" ? artifacts.final_dataset_row_count : null;
  const rawNames = artifacts.stage_names;
  const stageNames =
    Array.isArray(rawNames) && rawNames.every((x): x is string => typeof x === "string")
      ? (rawNames as string[]).filter((s) => s.trim().length > 0)
      : [];

  const hasStats =
    stageCount != null ||
    joinN != null ||
    filterN != null ||
    edges != null ||
    rejected != null ||
    measured != null ||
    finalRows != null;

  return (
    <div className="space-y-1.5 text-xs">
      {hasStats && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {stageCount != null && <StatRow label="Stages" value={stageCount} />}
          {joinN != null && <StatRow label="Join stages" value={joinN} />}
          {filterN != null && <StatRow label="Filter stages" value={filterN} />}
          {measured != null && <StatRow label="Measured stages" value={measured} />}
          {edges != null && <StatRow label="Lineage edges" value={edges} />}
          {rejected != null && <StatRow label="Rejected rows" value={rejected} />}
          {finalRows != null && <StatRow label="Final dataset rows" value={finalRows} />}
        </div>
      )}
      {stageNames.length > 0 && (
        <div>
          <SectionLabel>Stage names</SectionLabel>
          <ul className="list-disc list-inside text-[11px] text-muted-foreground max-h-40 overflow-y-auto pr-0.5 [scrollbar-gutter:stable]">
            {stageNames.slice(0, 20).map((n, i) => (
              <li key={`${i}-${n.slice(0, 64)}`} className="break-words">
                {n}
              </li>
            ))}
          </ul>
          {stageNames.length > 20 && (
            <p className="text-[10px] text-muted-foreground mt-0.5">+{stageNames.length - 20} more</p>
          )}
        </div>
      )}
      {!hasStats && stageNames.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">Multi-table data quality stage plan (schema and context).</p>
      ) : null}
    </div>
  );
};

const DataQualityProfilingAgentRenderer: AgentRendererComponent = ({ artifacts }) => {
  const persisted =
    artifacts.persisted != null && typeof artifacts.persisted === "object" && !Array.isArray(artifacts.persisted)
      ? (artifacts.persisted as Record<string, unknown>)
      : null;
  const pt = typeof artifacts.profiled_tables === "number" ? artifacts.profiled_tables : null;
  const pc = typeof artifacts.profiled_columns === "number" ? artifacts.profiled_columns : null;
  const trust = typeof artifacts.average_table_trust_score === "number" ? artifacts.average_table_trust_score : null;
  const lowTrust = typeof artifacts.low_trust_tables_count === "number" ? artifacts.low_trust_tables_count : null;
  const warnIssues = typeof artifacts.warning_issue_count === "number" ? artifacts.warning_issue_count : null;
  const critIssues = typeof artifacts.critical_issue_count === "number" ? artifacts.critical_issue_count : null;
  const dup = typeof artifacts.duplicate_candidate_count === "number" ? artifacts.duplicate_candidate_count : null;

  return (
    <div className="space-y-1.5 text-xs">
      {persisted && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {typeof persisted.tables === "number" && <StatRow label="Persisted tables" value={persisted.tables} />}
          {typeof persisted.columns === "number" && <StatRow label="Persisted columns" value={persisted.columns} />}
        </div>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {pt != null && <StatRow label="Tables profiled" value={pt} />}
        {pc != null && <StatRow label="Columns profiled" value={pc} />}
        {trust != null && <StatRow label="Avg trust score" value={trust.toFixed(2)} />}
        {lowTrust != null && <StatRow label="Low-trust tables" value={lowTrust} />}
        {warnIssues != null && <StatRow label="Warnings" value={warnIssues} />}
        {critIssues != null && <StatRow label="Critical" value={critIssues} />}
        {dup != null && <StatRow label="Duplicate candidates" value={dup} />}
      </div>
    </div>
  );
};

const DuplicateDetectionAgentRenderer: AgentRendererComponent = ({ artifacts }) => {
  const total = typeof artifacts.duplicate_candidate_count === "number" ? artifacts.duplicate_candidate_count : null;
  const exact = typeof artifacts.exact_duplicate_candidate_count === "number" ? artifacts.exact_duplicate_candidate_count : null;
  const fuzzy = typeof artifacts.fuzzy_duplicate_candidate_count === "number" ? artifacts.fuzzy_duplicate_candidate_count : null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {total != null && <StatRow label="Candidates" value={total} />}
      {exact != null && <StatRow label="Exact" value={exact} />}
      {fuzzy != null && <StatRow label="Fuzzy" value={fuzzy} />}
    </div>
  );
};

const FreshnessAndStabilityAgentRenderer: AgentRendererComponent = ({ artifacts }) => {
  const stale = typeof artifacts.stale_table_count === "number" ? artifacts.stale_table_count : null;
  const baseline = typeof artifacts.baseline_table_count === "number" ? artifacts.baseline_table_count : null;
  const stability = typeof artifacts.stability_issue_count === "number" ? artifacts.stability_issue_count : null;
  const noFreshCol = typeof artifacts.tables_without_freshness_column_count === "number" ? artifacts.tables_without_freshness_column_count : null;
  const baselineRun =
    typeof artifacts.baseline_quality_run_id === "string" && artifacts.baseline_quality_run_id.trim()
      ? artifacts.baseline_quality_run_id
      : null;
  return (
    <div className="space-y-1 text-xs">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {stale != null && <StatRow label="Stale tables" value={stale} />}
        {baseline != null && <StatRow label="Baseline tables" value={baseline} />}
        {stability != null && <StatRow label="Stability issues" value={stability} />}
        {noFreshCol != null && <StatRow label="Tables w/o freshness col" value={noFreshCol} />}
      </div>
      {baselineRun && <StatRow label="Baseline run" value={<span className="font-mono text-[10px]">{baselineRun}</span>} />}
    </div>
  );
};

const DataQualityRuleAgentRenderer: AgentRendererComponent = ({ artifacts }) => {
  const ruleCount = typeof artifacts.rule_count === "number" ? artifacts.rule_count : null;
  const active = typeof artifacts.active_rule_count === "number" ? artifacts.active_rule_count : null;
  const reviewPending = typeof artifacts.review_pending_count === "number" ? artifacts.review_pending_count : null;
  const needsReview = typeof artifacts.needs_review_rule_count === "number" ? artifacts.needs_review_rule_count : null;
  const unsupported = typeof artifacts.unsupported_rule_count === "number" ? artifacts.unsupported_rule_count : null;
  const rejected = typeof artifacts.rejected_rule_count === "number" ? artifacts.rejected_rule_count : null;
  const executed = typeof artifacts.rules_executed === "number" ? artifacts.rules_executed : null;
  const passed = typeof artifacts.passed_rules === "number" ? artifacts.passed_rules : null;
  const failed = typeof artifacts.failed_rules === "number" ? artifacts.failed_rules : null;
  const errors = typeof artifacts.error_rules === "number" ? artifacts.error_rules : null;
  const reviewRequired = artifacts.review_required === true;
  return (
    <div className="space-y-1 text-xs">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {ruleCount != null && <StatRow label="Rules" value={ruleCount} />}
        {active != null && <StatRow label="Active" value={active} />}
        {executed != null && <StatRow label="Executed" value={executed} />}
        {passed != null && <StatRow label="Passed" value={passed} />}
        {failed != null && <StatRow label="Failed" value={failed} />}
        {errors != null && <StatRow label="Errors" value={errors} />}
        {rejected != null && <StatRow label="Rejected" value={rejected} />}
        {reviewPending != null && <StatRow label="Review pending" value={reviewPending} />}
        {needsReview != null && <StatRow label="Needs review" value={needsReview} />}
        {unsupported != null && <StatRow label="Unsupported" value={unsupported} />}
      </div>
      {reviewRequired && (
        <p className="text-[11px] text-amber-700 dark:text-amber-500/90 mt-1">Rule interpretation review is required before validation runs.</p>
      )}
    </div>
  );
};

const DataQualityReviewGateRenderer: AgentRendererComponent = ({ artifacts }) => {
  const pending = typeof artifacts.review_queue_pending_count === "number" ? artifacts.review_queue_pending_count : null;
  return (
    <div className="text-xs space-y-1">
      {pending != null && <StatRow label="Items in review queue" value={pending} />}
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Resume the data quality run after you have reviewed ambiguous or unsupported rules.
      </p>
    </div>
  );
};

const DataEnrichmentOpportunityAgentRenderer: AgentRendererComponent = ({ artifacts }) => {
  const n = typeof artifacts.opportunity_count === "number" ? artifacts.opportunity_count : null;
  const raw = artifacts.target_table_names;
  const tables =
    Array.isArray(raw) && raw.every((x): x is string => typeof x === "string")
      ? (raw as string[])
      : [];
  return (
    <div className="space-y-1 text-xs">
      {n != null && <StatRow label="Opportunities" value={n} />}
      {tables.length > 0 && (
        <div>
          <SectionLabel>Tables</SectionLabel>
          <ul className="list-disc list-inside text-[11px] text-muted-foreground">
            {tables.slice(0, 8).map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          {tables.length > 8 && (
            <p className="text-[10px] text-muted-foreground mt-0.5">+{tables.length - 8} more</p>
          )}
        </div>
      )}
      {n == null && tables.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">Enrichment opportunities from quality artifacts.</p>
      ) : null}
    </div>
  );
};

const DataTrustScoringAgentRenderer: AgentRendererComponent = ({ artifacts }) => {
  const score = typeof artifacts.overall_trust_score === "number" ? artifacts.overall_trust_score : null;
  const tables = typeof artifacts.tables_scored === "number" ? artifacts.tables_scored : null;
  const issues = typeof artifacts.open_issue_count === "number" ? artifacts.open_issue_count : null;
  return (
    <div className="space-y-1 text-xs">
      {score != null && <StatRow label="Overall trust" value={score.toFixed(2)} />}
      {tables != null && <StatRow label="Tables scored" value={tables} />}
      {issues != null && <StatRow label="Open issues" value={issues} />}
      {score == null && tables == null && issues == null ? (
        <p className="text-[11px] text-muted-foreground">Data trust summary from quality signals.</p>
      ) : null}
    </div>
  );
};

const TrendAnalysisAgentRenderer: AgentRendererComponent = ({ artifacts }) => {
  const rows = typeof artifacts.trend_row_count === "number" ? artifacts.trend_row_count : null;
  const improved = typeof artifacts.improved_metric_count === "number" ? artifacts.improved_metric_count : null;
  const worsened = typeof artifacts.worsened_metric_count === "number" ? artifacts.worsened_metric_count : null;
  const baseline =
    typeof artifacts.baseline_run_id === "string" && artifacts.baseline_run_id.trim()
      ? artifacts.baseline_run_id.trim()
      : null;
  return (
    <div className="space-y-1 text-xs">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {rows != null && <StatRow label="Trend rows" value={rows} />}
        {improved != null && <StatRow label="Improved metrics" value={improved} />}
        {worsened != null && <StatRow label="Worsened metrics" value={worsened} />}
      </div>
      {baseline && (
        <StatRow label="Baseline run" value={<span className="font-mono text-[10px]">{baseline}</span>} />
      )}
      {rows == null && improved == null && worsened == null && !baseline ? (
        <p className="text-[11px] text-muted-foreground">Run-over-run trend snapshots and deltas.</p>
      ) : null}
    </div>
  );
};

const IssueRegisterAgentRenderer: AgentRendererComponent = ({ artifacts }) => {
  const total = typeof artifacts.issue_count === "number" ? artifacts.issue_count : null;
  const open = typeof artifacts.open_issue_count === "number" ? artifacts.open_issue_count : null;
  const overdue = typeof artifacts.overdue_issue_count === "number" ? artifacts.overdue_issue_count : null;
  return (
    <div className="space-y-1 text-xs">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {total != null && <StatRow label="Issues" value={total} />}
        {open != null && <StatRow label="Open" value={open} />}
        {overdue != null && <StatRow label="Overdue" value={overdue} />}
      </div>
      {total == null && open == null && overdue == null ? (
        <p className="text-[11px] text-muted-foreground">Issue register from quality and trend artifacts.</p>
      ) : null}
    </div>
  );
};


// --- Renderer Map ---

export const AGENT_RENDERER_MAP: Record<string, AgentRendererComponent> = {
  PlanningAgent: PlanningAgentRenderer,
  SchemaAgent: SchemaAgentRenderer,
  DataQualitySchemaAgent: SchemaAgentRenderer,
  ProfilingAgent: ProfilingAgentRenderer,
  DatasetStagePlannerAgent: DatasetStagePlannerAgentRenderer,
  DataQualityProfilingAgent: DataQualityProfilingAgentRenderer,
  DataQualityWorkflowRouter: DataQualityWorkflowRouterRenderer,
  DuplicateDetectionAgent: DuplicateDetectionAgentRenderer,
  FreshnessAndStabilityAgent: FreshnessAndStabilityAgentRenderer,
  DataQualityRuleAgent: DataQualityRuleAgentRenderer,
  DataQualityReviewGate: DataQualityReviewGateRenderer,
  DataEnrichmentOpportunityAgent: DataEnrichmentOpportunityAgentRenderer,
  DataTrustScoringAgent: DataTrustScoringAgentRenderer,
  TrendAnalysisAgent: TrendAnalysisAgentRenderer,
  IssueRegisterAgent: IssueRegisterAgentRenderer,
  DataQualityDashboardAgent: DashboardAgentRenderer,
  ContextAgent: ContextAgentRenderer,
  OntologyAgent: OntologyAgentRenderer,
  GlossaryAgent: GlossaryAgentRenderer,
  JoinAgent: JoinAgentRenderer,
  MetricAgent: MetricAgentRenderer,
  SemanticModelAgent: SemanticModelAgentRenderer,
  RollupPlannerAgent: RollupPlannerAgentRenderer,
  ChartPlannerAgent: ChartPlannerAgentRenderer,
  HierarchyBootstrapAgent: HierarchyBootstrapAgentRenderer,
  QualityGateAgent: QualityGateAgentRenderer,
  DashboardAgent: DashboardAgentRenderer,
  AnomalyDetectionAgent: AnomalyDetectionAgentRenderer,
  AnomalyDashboardAgent: AnomalyDashboardAgentRenderer,
  CorrelationAgent: CorrelationAgentRenderer,
  CorrelationDashboardAgent: AnomalyDashboardAgentRenderer,
};

/** Re-exports for pages that import dashboard chart pieces from this module. */
export type { ChartDetail, DashboardCardTab } from "./chartTypes";
export { Am5MiniChart } from "./Am5MiniChart";
export { ChartDataTable } from "./ChartDataTable";
export {
  DashboardSingleChartCard,
  DashboardChartExpandedModalContent,
  getExplorationChartHeadline,
} from "./DashboardChartCards";
export { CorrelationHeatmapScaleLegend } from "./am5MiniChartCorrelationHeatmap";
