import { useMemo } from "react";

import { cn } from "@/lib/utils";

import "./reconciliationStatCards.css";

import { computeReconciliationStatusStats, type ReconciliationWorkflowItem } from "./reconciliationListStats";
import { RECON_STAT_CARD_SURFACE } from "./reconciliationStatCardStyles";
import { useReconciliationMatchTotals } from "./useReconciliationMatchTotals";

type ReconciliationWorkflowStatsCardsProps = {
  workflows: ReconciliationWorkflowItem[];
  listLoading?: boolean;
};

type StatCardConfig = {
  title: string;
  value: string | number;
  valueClassName?: string;
};

function BigNumberStatCard({ title, value, valueClassName }: StatCardConfig) {
  return (
    <div
      className={cn(
        RECON_STAT_CARD_SURFACE,
        "flex h-14 min-w-0 flex-col items-center justify-center px-2 py-1.5 text-center",
      )}
      title={title}
    >
      <span className="line-clamp-1 w-full text-[11px] font-medium leading-tight text-muted-foreground">
        {title}
      </span>
      <span className={cn("mt-0.5 text-lg font-bold tabular-nums leading-none sm:text-xl", valueClassName)}>
        {value}
      </span>
    </div>
  );
}

export function ReconciliationWorkflowStatsCards({
  workflows,
  listLoading = false,
}: ReconciliationWorkflowStatsCardsProps) {
  const statusStats = useMemo(() => computeReconciliationStatusStats(workflows), [workflows]);

  const { data: matchTotals, isLoading: matchLoading, isFetching: matchFetching } =
    useReconciliationMatchTotals(workflows);

  const matchLoadingState = listLoading || matchLoading || matchFetching;

  const primaryCards: StatCardConfig[] = [
    { title: "Total Recons", value: listLoading ? "…" : statusStats.total, valueClassName: "text-blue-600 dark:text-blue-400" },
    { title: "Pending", value: listLoading ? "…" : statusStats.pending, valueClassName: "text-amber-600 dark:text-amber-400" },
    { title: "Completed", value: listLoading ? "…" : statusStats.completed, valueClassName: "text-emerald-600 dark:text-emerald-400" },
    { title: "Failed", value: listLoading ? "…" : statusStats.failed, valueClassName: "text-destructive" },
    { title: "Matched", value: matchLoadingState ? "…" : (matchTotals?.matched ?? 0).toLocaleString(), valueClassName: "text-emerald-600 dark:text-emerald-400" },
    { title: "Unmatched", value: matchLoadingState ? "…" : (matchTotals?.unmatched ?? 0).toLocaleString(), valueClassName: "text-destructive" },
    {
      title: "Match Rate",
      value: matchLoadingState ? "…" : matchTotals?.matchRate != null ? `${matchTotals.matchRate}%` : "—",
      valueClassName: "text-violet-600 dark:text-violet-400",
    },
  ];

  return (
    <div className="mb-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
        {primaryCards.map((card) => (
          <BigNumberStatCard key={card.title} {...card} />
        ))}
      </div>
    </div>
  );
}
