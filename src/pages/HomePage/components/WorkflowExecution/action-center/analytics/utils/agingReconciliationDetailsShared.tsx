import React from 'react';
import type { ColDef } from 'ag-grid-community';
import { Check, X, RotateCcw, IndianRupee } from 'lucide-react';

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

    // Add cell renderers for icons based on key
    const keyLower = originalKey.toLowerCase();
    if (keyLower.includes('match') && !keyLower.includes('unmatch')) {
      colDef.cellRenderer = (params: any) => (
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4 text-green-600" />
          <span>{params.value}</span>
        </div>
      );
    } else if (keyLower.includes('unmatch')) {
      colDef.cellRenderer = (params: any) => (
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-red-600" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          <span>{params.value}</span>
        </div>
      );
    } else if (keyLower.includes('revers')) {
      colDef.cellRenderer = (params: any) => (
        <div className="flex items-center gap-2">
          <RotateCcw className="h-4 w-4 text-amber-600" />
          <span>{params.value}</span>
        </div>
      );
    } else if (keyLower.includes('amount') || keyLower.includes('money')) {
      colDef.cellRenderer = (params: any) => (
        <div className="flex items-center gap-2">
          <IndianRupee className="h-4 w-4 text-blue-600" />
          <span>{params.value}</span>
        </div>
      );
    }

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
