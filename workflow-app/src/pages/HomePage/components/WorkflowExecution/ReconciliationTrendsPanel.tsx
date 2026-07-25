import { useMemo } from "react";
import { ArrowUpRight, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import type { ReconciliationReconTrend, ReconciliationWorkflowItem } from "./reconciliationListStats";
import { useReconciliationMatchTotals } from "./useReconciliationMatchTotals";

type ReconciliationTrendsPanelProps = {
  workflows: ReconciliationWorkflowItem[];
  onSelectRecon: (workflow: ReconciliationWorkflowItem) => void;
  className?: string;
};

function formatStatementDate(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
  const parsed = iso ? new Date(`${iso}T00:00:00`) : new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" });
}

function statusLabel(status: string | undefined): string {
  const s = (status ?? "").trim().toUpperCase();
  if (!s) return "Pending";
  if (s === "RUNNING") return "Running";
  return s.charAt(0) + s.slice(1).toLowerCase();
}

function statusBadgeClass(status: string | undefined): string {
  const s = (status ?? "").trim().toUpperCase();
  if (s === "COMPLETED") return "border-emerald-500/30 text-emerald-700 dark:text-emerald-400";
  if (s === "FAILED") return "border-destructive/40 text-destructive";
  if (s === "RUNNING") return "border-blue-500/30 text-blue-700 dark:text-blue-400";
  return "border-amber-500/30 text-amber-700 dark:text-amber-400";
}

function ReconTrendCard({
  recon,
  workflow,
  onSelect,
}: {
  recon: ReconciliationReconTrend;
  workflow?: ReconciliationWorkflowItem;
  onSelect: () => void;
}) {
  const canNavigate = Boolean(workflow?.id ?? workflow?.flow_id);
  const stmtDate = formatStatementDate(workflow?.statement_date);
  const matchPct = recon.matchRate != null ? Math.min(100, Math.max(0, recon.matchRate)) : 0;

  return (
    <button
      type="button"
      disabled={!canNavigate}
      onClick={onSelect}
      className={cn(
        "group grid h-full w-full min-w-0 grid-rows-[auto_auto_auto_auto] gap-1.5 rounded-md border border-border/70 bg-transparent p-2.5 text-left",
        "transition-colors hover:border-primary/50",
        canNavigate && "cursor-pointer",
        !canNavigate && "cursor-not-allowed opacity-50",
      )}
    >
      <div className="flex min-w-0 items-center gap-1">
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold leading-snug text-foreground" title={recon.name}>
          {recon.name}
        </h3>
        <Badge
          variant="outline"
          className={cn("h-5 shrink-0 px-1.5 text-xs font-medium leading-none", statusBadgeClass(workflow?.status))}
        >
          {statusLabel(workflow?.status)}
        </Badge>
        {canNavigate ? (
          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-primary opacity-0 group-hover:opacity-100" aria-hidden />
        ) : null}
      </div>

      {stmtDate ? (
        <p className="truncate text-xs leading-tight text-muted-foreground" title={stmtDate}>
          {stmtDate}
        </p>
      ) : (
        <span className="h-0" aria-hidden />
      )}

      <div className="flex items-center gap-1.5">
        <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-border/50">
          <div
            className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400"
            style={{ width: `${matchPct}%` }}
          />
        </div>
        <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">
          {recon.matchRate != null ? `${recon.matchRate}%` : "—"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-0.5 text-center leading-tight">
        <div>
          <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Match</p>
          <p className="truncate text-[11px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {recon.matched.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Unmatch</p>
          <p className="truncate text-[11px] font-semibold tabular-nums text-destructive">
            {recon.unmatched.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Total</p>
          <p className="truncate text-[11px] font-semibold tabular-nums text-foreground">
            {recon.totalRecords.toLocaleString()}
          </p>
        </div>
      </div>
    </button>
  );
}

export function ReconciliationTrendsPanel({
  workflows,
  onSelectRecon,
  className,
}: ReconciliationTrendsPanelProps) {
  const { data: matchTotals, isLoading, isFetching } = useReconciliationMatchTotals(workflows, true);

  const workflowByFlowId = useMemo(() => {
    const map = new Map<string, ReconciliationWorkflowItem>();
    for (const workflow of workflows) {
      if (workflow.flow_id) {
        map.set(workflow.flow_id, workflow);
      }
    }
    return map;
  }, [workflows]);

  const reconTrends = matchTotals?.byRecon ?? [];
  const loading = isLoading || isFetching;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border/60 pb-1.5">
        <div>
          <p className="text-sm font-medium text-foreground">Reconciliation match trends</p>
          <p className="text-xs text-muted-foreground">Click a card to open analytics.</p>
        </div>
        {!loading && reconTrends.length > 0 && matchTotals ? (
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">{reconTrends.length}</span> recons
            </span>
            <span>
              Matched{" "}
              <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                {matchTotals.matched.toLocaleString()}
              </span>
            </span>
            <span>
              Unmatched{" "}
              <span className="font-semibold tabular-nums text-destructive">
                {matchTotals.unmatched.toLocaleString()}
              </span>
            </span>
            {matchTotals.matchRate != null ? (
              <span>
                Overall <span className="font-semibold text-foreground">{matchTotals.matchRate}%</span>
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading trends…
        </div>
      ) : reconTrends.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No trend data available.</p>
      ) : (
        <ScrollArea className="h-[min(42rem,72vh)] w-full">
          <div
            className="grid grid-cols-5 gap-2 p-1"
            style={{ gridAutoRows: "minmax(7.5rem, auto)" }}
          >
            {reconTrends.map((recon) => {
              const workflow = workflowByFlowId.get(recon.flowId);
              return (
                <ReconTrendCard
                  key={recon.flowId}
                  recon={recon}
                  workflow={workflow}
                  onSelect={() => {
                    if (workflow) onSelectRecon(workflow);
                  }}
                />
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
