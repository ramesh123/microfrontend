import api from "@/controllers/API/api";

export type ReconciliationWorkflowItem = {
  id?: number | string;
  name?: string;
  status?: string;
  flow_id?: string;
  statement_date?: string | null;
  deployment_name?: string;
  business_process?: string;
};

export type ReconciliationStatusStats = {
  total: number;
  completed: number;
  pending: number;
  failed: number;
  running: number;
};

export type ReconciliationMatchTotals = {
  matched: number;
  unmatched: number;
  matchRate: number | null;
  byRecon: ReconciliationReconTrend[];
};

export type ReconciliationReconTrend = {
  name: string;
  flowId: string;
  matched: number;
  unmatched: number;
  totalRecords: number;
  matchRate: number | null;
};

function normalizeStatus(status: unknown): string {
  return typeof status === "string" ? status.trim().toUpperCase() : "";
}

export function computeReconciliationStatusStats(
  workflows: ReconciliationWorkflowItem[],
): ReconciliationStatusStats {
  let completed = 0;
  let pending = 0;
  let failed = 0;
  let running = 0;

  for (const workflow of workflows) {
    const status = normalizeStatus(workflow.status);
    if (status === "COMPLETED") {
      completed += 1;
    } else if (status === "FAILED") {
      failed += 1;
    } else if (status === "RUNNING") {
      running += 1;
    } else {
      pending += 1;
    }
  }

  return {
    total: workflows.length,
    completed,
    pending: pending + running,
    failed,
    running,
  };
}

function statementDateForApi(value: string | null | undefined): string {
  if (!value || typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().split("T")[0] ?? "";
}

function readSummaryCardNumber(payload: Record<string, unknown>, key: string): number {
  const raw = payload[key];
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : 0;
}

export async function fetchReconciliationMatchTotals(
  workflows: ReconciliationWorkflowItem[],
): Promise<ReconciliationMatchTotals> {
  const withFlow = workflows.filter((w) => typeof w.flow_id === "string" && w.flow_id.trim());

  const settled = await Promise.allSettled(
    withFlow.map(async (workflow) => {
      const flowId = workflow.flow_id!.trim();
      const response = await api.post("/summary/get-summary-cards", {
        flow_id: flowId,
        stmt_date: statementDateForApi(workflow.statement_date),
      });
      const raw = response.data?.data ?? response.data;
      const cards =
        raw && typeof raw === "object" && "data" in (raw as object)
          ? ((raw as { data?: Record<string, unknown> }).data ?? {})
          : (raw as Record<string, unknown>) ?? {};

      const matched = readSummaryCardNumber(cards, "matched");
      const unmatched = readSummaryCardNumber(cards, "unmatched");
      const totalRecords = readSummaryCardNumber(cards, "total_records");
      const denom = matched + unmatched || totalRecords;
      const matchRate = denom > 0 ? Math.round((matched / denom) * 1000) / 10 : null;

      return {
        name: workflow.name?.trim() || flowId,
        flowId,
        matched,
        unmatched,
        totalRecords: totalRecords > 0 ? totalRecords : matched + unmatched,
        matchRate,
      } satisfies ReconciliationReconTrend;
    }),
  );

  const byRecon: ReconciliationReconTrend[] = [];
  let matched = 0;
  let unmatched = 0;

  for (const result of settled) {
    if (result.status !== "fulfilled" || !result.value) continue;
    byRecon.push(result.value);
    matched += result.value.matched;
    unmatched += result.value.unmatched;
  }

  byRecon.sort((a, b) => b.unmatched + b.matched - (a.unmatched + a.matched));

  const denom = matched + unmatched;
  const matchRate = denom > 0 ? Math.round((matched / denom) * 1000) / 10 : null;

  return { matched, unmatched, matchRate, byRecon };
}
