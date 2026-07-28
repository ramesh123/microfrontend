import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Table2, Check, RotateCcw, IndianRupee } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import CustomTableData from '@/components/ui/CustomTableData';
import { formatNumber } from '@/utils/numberFormatters';
import { AgeingSummaryRow, getReconciliationSummaryDetails } from '@/controllers/API/ReconcilationAPI';
import { agingCardSurface, agingEmptyState } from '../utils/agingUiTokens';
import { AGING_CHART_EXPANDED_TABLE_VISIBLE_ROWS } from '../utils/agingAmChartScrollbar';
import { AgingAnalyticsCardHeader } from './AgingAnalyticsCardHeader';
import {
  AgingChartExpandDialog,
  useAgingChartExpand,
} from './AgingChartExpandShell';
import type { ColDef } from 'ag-grid-community';
import * as XLSX from 'xlsx';
import { AgingReconciliationDetailsSheet } from './AgingReconciliationDetailsSheet';

const TABLE_HEADER_PX = 38;
const TABLE_ROW_PX = 36;
const VISIBLE_TABLE_ROWS = 9;

const META_COLUMNS: Array<{ key: keyof AgeingSummaryRow; label: string; size: number }> = [
  { key: 'statement_date', label: 'Statement Date', size: 130 },
  { key: 'source_name', label: 'Source Name', size: 180 },
  { key: 'days_unmatched', label: 'Days Unmatched', size: 130 },
  { key: 'source_count', label: 'Source Count', size: 120 },
  { key: 'source_amount', label: 'Source Amount', size: 130 },
  { key: 'remarks', label: 'Remarks', size: 260 },
  // { key: 'remarks_count', label: 'Remarks Count', size: 120 },
];

function formatCellValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'string') return value;
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return formatNumber(num, { format: 'full', minValue: 0 });
}

/**
 * Build AgGrid ColDefs safely.
 *
 * Keys with dots (e.g. "settlements.additional_utr") or spaces
 * (e.g. "sap_data match") MUST NOT be used as `field` — AgGrid
 * interprets dots as nested-object paths and silently returns undefined.
 *
 * For those keys we use `valueGetter` with bracket notation instead,
 * which always reads the flat raw key correctly.
 */
function buildColDefs(record: Record<string, unknown>): ColDef[] {
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
      // Capture originalKey in closure for the valueGetter
      const key = originalKey;
      colDef.valueGetter = (params) => params.data?.[key] ?? null;
    } else {
      colDef.field = originalKey;
    }

    return colDef;
  });
}

/**
 * Normalise whatever getReconciliationSummaryDetails returns into
 * { records, count } so the rest of the component doesn't care about
 * how the API wrapper is configured.
 *
 * Handles three shapes:
 *   A) { status, count, data: [...] }   ← raw server envelope
 *   B) [...]                             ← wrapper already unwrapped to array
 *   C) { data: [...] } without count    ← partial wrapper
 */
function normaliseResponse(raw: unknown): {
  records: Record<string, unknown>[];
  count: number;
} {
  if (Array.isArray(raw)) {
    // Shape B
    return { records: raw as Record<string, unknown>[], count: raw.length };
  }

  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;

    if (Array.isArray(obj['data'])) {
      // Shape A or C
      const records = obj['data'] as Record<string, unknown>[];
      const count = typeof obj['count'] === 'number' ? obj['count'] : records.length;
      return { records, count };
    }
  }

  // Unknown / empty — return nothing so the empty state renders
  return { records: [], count: 0 };
}

interface AgingSummaryTableCardProps {
  rows: AgeingSummaryRow[];
  isLoading?: boolean;
  className?: string;
  defaultPageSize?: number;
  embedded?: boolean;
  visibleBodyRows?: number;
  onSourceCountClick?: (row: AgeingSummaryRow) => void;
}

export function AgingSummaryTableCard({
  rows,
  isLoading = false,
  className,
  defaultPageSize = 10,
  embedded = false,
  visibleBodyRows = VISIBLE_TABLE_ROWS,
  onSourceCountClick,
}: AgingSummaryTableCardProps) {
  const canExpand = !embedded && !isLoading && rows.length > 0;
  const { open, setOpen, expandButton } = useAgingChartExpand(!canExpand);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  // ── Details sheet state ──────────────────────────────────────────────────
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsData, setDetailsData] = useState<Record<string, unknown>[]>([]);
  const [detailsColumns, setDetailsColumns] = useState<ColDef[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [totalRows, setTotalRows] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [selectedRow, setSelectedRow] = useState<Record<string, unknown> | null>(null);

  /**
   * fetchIdRef: incremented on every new fetch.
   * Stale responses (from double-invocations in React StrictMode or
   * rapid re-clicks) are silently discarded when their ID no longer matches.
   */
  const fetchIdRef = useRef(0);

  // ── Fetch detail records ─────────────────────────────────────────────────
  const fetchDetails = useCallback(async (row: Record<string, unknown>, search: string = '') => {
    const thisFetchId = ++fetchIdRef.current;
    setDetailsLoading(true);

    try {
      const raw = await getReconciliationSummaryDetails({
        flow_id: String(row.flow_id ?? ''),
        flow_run_id: String(row.flow_run_id ?? ''),
        statement_date: String(row.statement_date ?? ''),
        source_name: String(row.source_name ?? ''),
        cycle_number: '',
        execution_number: '',
        remarks: String(row.remarks ?? ''),
        days_unmatched: String(row.days_unmatched ?? ''),
        sort: '',
        search_term: search,
      });

      // Discard if a newer fetch started while we were awaiting
      if (thisFetchId !== fetchIdRef.current) return;

      const { records, count } = normaliseResponse(raw);

      console.log('[AgingSummaryTable] normalised response →', { count, records });

      setDetailsColumns(records.length > 0 ? buildColDefs(records[0]) : []);
      setDetailsData(records);
      setTotalRows(count);
    } catch (error) {
      if (thisFetchId !== fetchIdRef.current) return;
      console.error('[AgingSummaryTable] fetchDetails error:', error);
      setDetailsData([]);
      setDetailsColumns([]);
      setTotalRows(0);
    } finally {
      if (thisFetchId === fetchIdRef.current) setDetailsLoading(false);
    }
  }, []);

  const handleDownload = useCallback((format: 'csv' | 'excel') => {
    if (!detailsData.length) return;

    const worksheet = XLSX.utils.json_to_sheet(detailsData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Details');

    const fileName = `ageing_summary_details`;

    if (format === 'csv') {
      XLSX.writeFile(workbook, `${fileName}.csv`, { bookType: 'csv' });
    } else {
      XLSX.writeFile(workbook, `${fileName}.xlsx`, { bookType: 'xlsx' });
    }
  }, [detailsData]);

  // ── Open sheet when source_count cell is clicked ─────────────────────────
  const handleSourceCountClick = useCallback(
    (row: Record<string, unknown>) => {
      // Clear stale data before opening so we never flash a previous result
      setDetailsData([]);
      setDetailsColumns([]);
      setTotalRows(0);
      setSelectedRow(row);
      setSearchText('');
      setDetailsOpen(true);
      fetchDetails(row, '');
    },
    [fetchDetails],
  );

  // ── Close sheet cleanup ──────────────────────────────────────────────────
  const handleSheetOpenChange = useCallback((nextOpen: boolean) => {
    setDetailsOpen(nextOpen);
    if (!nextOpen) {
      fetchIdRef.current++; // invalidate any in-flight fetch
      setDetailsData([]);
      setDetailsColumns([]);
      setTotalRows(0);
      setDetailsLoading(false);
      setSearchText('');
      setSelectedRow(null);
    }
  }, []);

  // ── Debounced search handler ──────────────────────────────────────────────
  const debouncedFetch = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (selectedRow) {
      if (debouncedFetch.current) clearTimeout(debouncedFetch.current);
      debouncedFetch.current = setTimeout(() => {
        fetchDetails(selectedRow, searchText);
      }, 300);
    }
    return () => {
      if (debouncedFetch.current) clearTimeout(debouncedFetch.current);
    };
  }, [searchText, selectedRow, fetchDetails]);

  // ── Summary table helpers ────────────────────────────────────────────────
  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const dateCmp = String(a.statement_date ?? '').localeCompare(
          String(b.statement_date ?? ''),
        );
        if (dateCmp !== 0) return dateCmp;
        return String(a.source_name ?? '').localeCompare(String(b.source_name ?? ''));
      }),
    [rows],
  );

  useEffect(() => {
    setCurrentPage(0);
  }, [rows]);

  const paginatedRows = useMemo(() => {
    const start = currentPage * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, currentPage, pageSize]);

  const tableRows = useMemo(
    () =>
      paginatedRows.map((row, index) => ({
        ...row,
        _rowKey: `${row.flow_run_id ?? ''}-${row.statement_date ?? ''}-${row.source_name ?? ''}-${row.days_unmatched ?? ''}-${index}-${String(row.remarks ?? '').slice(0, 40)}`,
      })) as Record<string, unknown>[],
    [paginatedRows],
  );

  const customTableColumns = useMemo(
    () =>
      META_COLUMNS.map((col) => ({
        key: String(col.key),
        header: col.label,
        colWidth: col.size,
        align: 'left' as 'left' | 'center' | 'right',
        sortable: true,
        TruncateData: false,
        renderCell: (row: Record<string, unknown>) => {
          if (String(col.key) === 'source_count') {
            return (
              <button
                type="button"
                onClick={() => handleSourceCountClick(row)}
                className="cursor-pointer text-primary hover:underline text-xs font-medium"
              >
                {formatCellValue(row[col.key as string])}
              </button>
            );
          }
          return (
            <span
              className={cn(
                'block max-w-full text-xs font-medium text-foreground/90',
                col.key === 'remarks'
                  ? 'whitespace-normal break-words'
                  : 'truncate whitespace-nowrap',
              )}
            >
              {formatCellValue(row[col.key as string])}
            </span>
          );
        },
      })),
    [handleSourceCountClick],
  );

  const title = 'Ageing summary';

  const handlePaginationChange = ({
    currentPage: nextPage,
    limit,
  }: {
    currentPage: number;
    limit: number;
  }) => {
    setCurrentPage(nextPage);
    setPageSize(limit);
  };

  const tableBodyScrollHeightPx = TABLE_HEADER_PX + visibleBodyRows * TABLE_ROW_PX;

  // ── Summary table JSX ────────────────────────────────────────────────────
  const tableContent = (
    <>
      {!isLoading && sortedRows.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-2 text-muted-foreground/70"
          style={{ height: tableBodyScrollHeightPx }}
        >
          <Table2 className="h-9 w-9 opacity-25" strokeWidth={1.5} />
          <p className="text-sm font-semibold tracking-tight text-foreground/80">No ageing data</p>
          <p className={agingEmptyState}>
            Try a wider date range or run reconciliation for this flow.
          </p>
        </div>
      ) : (
        <CustomTableData
          data={tableRows}
          columns={customTableColumns}
          rowKey="_rowKey"
          showSpinnerFlag={isLoading}
          scrollViewportMaxHeightPx={tableBodyScrollHeightPx}
          pagination={{
            steps: [5, 10, 20, 50],
            currentPage,
            pageSize,
            totalRows: sortedRows.length,
            loading: isLoading,
            onChange: handlePaginationChange,
          }}
          bodyCellClassName="h-9"
          emptyState={
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground/70">
              <Table2 className="h-9 w-9 opacity-25" strokeWidth={1.5} />
              <p className="text-sm font-semibold tracking-tight text-foreground/80">
                No ageing data
              </p>
              <p className={agingEmptyState}>
                Try a wider date range or run reconciliation for this flow.
              </p>
            </div>
          }
        />
      )}
    </>
  );

  if (embedded) {
    return <div className={cn('flex h-full flex-col', className)}>{tableContent}</div>;
  }

  return (
    <Card className={cn(agingCardSurface, 'flex h-full flex-col p-0', className)}>
      <AgingAnalyticsCardHeader
        icon={Table2}
        title={title}
        trailing={<div className="flex items-center gap-1">{expandButton}</div>}
      />
      <CardContent className="flex flex-col px-3 pb-3 pt-1">
        {tableContent}
      </CardContent>

      <AgingChartExpandDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        subtitle="Ageing summary by statement date, source, and remarks"
        contentHeight={
          TABLE_HEADER_PX + AGING_CHART_EXPANDED_TABLE_VISIBLE_ROWS * TABLE_ROW_PX + 56
        }
      >
        <AgingSummaryTableCard
          rows={rows}  
          isLoading={isLoading}
          defaultPageSize={defaultPageSize}
          embedded
          visibleBodyRows={AGING_CHART_EXPANDED_TABLE_VISIBLE_ROWS}
        />
      </AgingChartExpandDialog>

      <AgingReconciliationDetailsSheet
        open={detailsOpen}
        onOpenChange={handleSheetOpenChange}
        loading={detailsLoading}
        records={detailsData}
        columns={detailsColumns}
        totalRows={totalRows}
        variant="ageing"
        ageingStatementDate={String(selectedRow?.statement_date ?? '')}
        searchText={searchText}
        onSearchTextChange={setSearchText}
        onDownload={handleDownload}
      />
    </Card>
  );
}