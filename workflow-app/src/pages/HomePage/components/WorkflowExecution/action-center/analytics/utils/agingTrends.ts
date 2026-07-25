import type { ReconciliationSummaryTrendRow } from '@/controllers/API/ReconcilationAPI';

export function sortTrendRowsByStatementDate(
  rows: ReconciliationSummaryTrendRow[],
): ReconciliationSummaryTrendRow[] {
  return [...rows]
}

export function toAmountTrendChartData(rows: ReconciliationSummaryTrendRow[]) {
  return sortTrendRowsByStatementDate(rows).map((row) => ({
    statement_date: row.statement_date,
    matched_amount: row.total_matched_amount,
    unmatched_amount: row.total_unmatched_amount,
    reversal_amount: row.total_reversal_amount,
  }));
}


export function toCountTrendChartData(rows: ReconciliationSummaryTrendRow[]) {
  return sortTrendRowsByStatementDate(rows).map((row) => ({
    statement_date: row.statement_date,
    matched_count: row.total_matched_count,
    unmatched_count: row.total_unmatched_count,
    reversal_count: row.total_reversal_count,
  }));
}
