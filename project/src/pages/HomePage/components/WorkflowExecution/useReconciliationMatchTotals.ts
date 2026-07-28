import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  fetchReconciliationMatchTotals,
  type ReconciliationWorkflowItem,
} from "./reconciliationListStats";

export function useReconciliationMatchTotals(workflows: ReconciliationWorkflowItem[], enabled = true) {
  const flowKey = useMemo(
    () =>
      workflows
        .map((w) => `${w.id ?? ""}:${w.flow_id ?? ""}:${w.statement_date ?? ""}:${w.status ?? ""}`)
        .join("|"),
    [workflows],
  );

  return useQuery({
    queryKey: ["reconciliation-list-match-totals", flowKey],
    queryFn: () => fetchReconciliationMatchTotals(workflows),
    enabled: enabled && workflows.length > 0 && workflows.some((w) => w.flow_id),
    staleTime: 1000 * 60 * 5,
  });
}
