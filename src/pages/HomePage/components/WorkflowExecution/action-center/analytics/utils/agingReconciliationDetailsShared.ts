import type { ColDef } from 'ag-grid-community';
import type { GetReconciliationDetailsPayload } from '@/controllers/API/ReconcilationAPI';

export function reconciliationStatusFromDataKey(dataKey: string): string {
  if (dataKey.includes('unmatched')) return 'unmatched';
  if (dataKey.includes('reversal')) return 'reversal';
  return 'matched';
}

export function buildReconciliationDetailsPayload(params: {
  flowId: string;
  statementDate: string;
  sourceNames: string[];
  dataKey: string;
  flowRunId?: string;
}): GetReconciliationDetailsPayload {
  return {
    flow_id: params.flowId,
    flow_run_id: params.flowRunId ?? '',
    statement_date: params.statementDate,
    source_name: params.sourceNames,
    cycle_number: '',
    execution_number: '',
    reconciliation_status: [reconciliationStatusFromDataKey(params.dataKey)],
  };
}

export function buildColDefs(record: Record<string, unknown>): ColDef[] {
  return Object.keys(record).map((originalKey) => {
    const headerName = originalKey
      .split(/[_.\s]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    const colDef: ColDef = {
      headerName,
      sortable: true,
      filter: true,
      resizable: true,
      minWidth: 130,
    };

    if (originalKey.includes('.') || originalKey.includes(' ')) {
      const key = originalKey;
      colDef.valueGetter = (params) => params.data?.[key] ?? null;
    } else {
      colDef.field = originalKey;
    }

    return colDef;
  });
}

interface ReconciliationDetailGroup {
  source_name?: string;
  reconciliation_status?: string;
  count?: number;
  records?: Record<string, unknown>[];
}

function isReconciliationDetailGroup(item: unknown): item is ReconciliationDetailGroup {
  return (
    item != null &&
    typeof item === 'object' &&
    Array.isArray((item as ReconciliationDetailGroup).records)
  );
}

function flattenReconciliationDetailGroups(groups: unknown[]): {
  records: Record<string, unknown>[];
  count: number;
} {
  const records: Record<string, unknown>[] = [];
  let count = 0;

  for (const group of groups) {
    if (!isReconciliationDetailGroup(group)) continue;

    const groupRecords = group.records ?? [];
    count += typeof group.count === 'number' ? group.count : groupRecords.length;

    for (const record of groupRecords) {
      records.push({
        ...record,
        ...(group.source_name ? { source_name: group.source_name } : {}),
        ...(group.reconciliation_status
          ? { reconciliation_status: group.reconciliation_status }
          : {}),
      });
    }
  }

  return { records, count: count || records.length };
}

export function normaliseReconciliationDetailsResponse(raw: unknown): {
  records: Record<string, unknown>[];
  count: number;
} {
  if (Array.isArray(raw)) {
    if (raw.some(isReconciliationDetailGroup)) {
      return flattenReconciliationDetailGroups(raw);
    }
    return { records: raw as Record<string, unknown>[], count: raw.length };
  }

  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;

    if (Array.isArray(obj['data'])) {
      const data = obj['data'] as unknown[];
      if (data.some(isReconciliationDetailGroup)) {
        return flattenReconciliationDetailGroups(data);
      }
      const records = data as Record<string, unknown>[];
      const count = typeof obj['count'] === 'number' ? obj['count'] : records.length;
      return { records, count };
    }
  }

  return { records: [], count: 0 };
}
