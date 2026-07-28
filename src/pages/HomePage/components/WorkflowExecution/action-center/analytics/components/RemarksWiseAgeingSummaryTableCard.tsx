import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import CustomTableData from '@/components/ui/CustomTableData';
import { formatNumber } from '@/utils/numberFormatters';
import {
  getRemarksWiseAgeingSummaryDetails,
  type RemarksWiseAgeingSummaryRow,
} from '@/controllers/API/ReconcilationAPI';
import { agingCardSurface, agingEmptyState } from '../utils/agingUiTokens';
import { AGING_CHART_EXPANDED_TABLE_VISIBLE_ROWS } from '../utils/agingAmChartScrollbar';
import { AgingAnalyticsCardHeader } from './AgingAnalyticsCardHeader';
import { AgingReconciliationDetailsSheet } from './AgingReconciliationDetailsSheet';
import {
  AgingChartExpandDialog,
  useAgingChartExpand,
} from './AgingChartExpandShell';
import type { ColDef } from 'ag-grid-community';
import * as XLSX from 'xlsx';

const TABLE_HEADER_PX = 38;
const TABLE_ROW_PX = 36;
const VISIBLE_TABLE_ROWS = 9;

const BUCKET_COLUMNS: Array<{ key: keyof RemarksWiseAgeingSummaryRow; label: string }> = [
  { key: '0 Days', label: '0 Days' },
  { key: '1 Day', label: '1 Day' },
  { key: '2-7 Days', label: '2–7 Days' },
  { key: '8-15 Days', label: '8–15 Days' },
  { key: '16-30 Days', label: '16–30 Days' },
  { key: '>30 Days', label: '>30 Days' },
];

function formatCountValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return formatNumber(num, { format: 'full', minValue: 0 });
}

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

    if (originalKey.includes('.') || originalKey.includes(' ')) {
      const key = originalKey;
      colDef.valueGetter = (params) => params.data?.[key] ?? null;
    } else {
      colDef.field = originalKey;
    }

    return colDef;
  });
}

function normaliseRemarksWiseDetailsResponse(raw: unknown): {
  records: Record<string, unknown>[];
  count: number;
} {
  if (Array.isArray(raw)) {
    let totalCount = 0;
    const records: Record<string, unknown>[] = [];

    for (const group of raw) {
      if (!group || typeof group !== 'object') continue;
      const item = group as Record<string, unknown>;
      const groupCount = typeof item.count === 'number' ? item.count : 0;
      totalCount += groupCount;
      if (Array.isArray(item.records)) {
        records.push(...(item.records as Record<string, unknown>[]));
      }
    }

    return { records, count: totalCount || records.length };
  }

  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.data)) {
      return normaliseRemarksWiseDetailsResponse(obj.data);
    }
  }

  return { records: [], count: 0 };
}

interface RemarksWiseAgeingSummaryTableCardProps {
  rows: RemarksWiseAgeingSummaryRow[];
  isLoading?: boolean;
  className?: string;
  defaultPageSize?: number;
  embedded?: boolean;
  visibleBodyRows?: number;
}

const TITLE = 'Remarks-wise Ageing Summary Trends';
const SUBTITLE = 'Summary of unmatched records grouped by remarks and ageing buckets.';

export function RemarksWiseAgeingSummaryTableCard({
  rows,
  isLoading = false,
  className,
  defaultPageSize = 10,
  embedded = false,
  visibleBodyRows = VISIBLE_TABLE_ROWS,
}: RemarksWiseAgeingSummaryTableCardProps) {
  const canExpand = !embedded && !isLoading && rows.length > 0;
  const { open, setOpen, expandButton } = useAgingChartExpand(!canExpand);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsData, setDetailsData] = useState<Record<string, unknown>[]>([]);
  const [detailsColumns, setDetailsColumns] = useState<ColDef[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [totalRows, setTotalRows] = useState(0);
  const [selectedBucket, setSelectedBucket] = useState('');
  const [selectedRemarks, setSelectedRemarks] = useState('');
  const fetchIdRef = useRef(0);

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) =>
        String(a.remarks ?? '').localeCompare(String(b.remarks ?? '')),
      ),
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
        _rowKey: `${row.flow_run_id ?? ''}-${row.source_name ?? ''}-${index}-${String(row.remarks ?? '').slice(0, 40)}`,
      })) as Record<string, unknown>[],
    [paginatedRows],
  );

  const fetchDetails = useCallback(
    async (row: Record<string, unknown>, bucketKey: string) => {
      const count = Number(row[bucketKey]);
      if (!count || count <= 0) return;

      const thisFetchId = ++fetchIdRef.current;
      setDetailsLoading(true);
      setSelectedBucket(bucketKey);
      setSelectedRemarks(String(row.remarks ?? ''));

      try {
        const sourceName = String(row.source_name ?? '').trim();
        const raw = await getRemarksWiseAgeingSummaryDetails({
          flow_id: String(row.flow_id ?? ''),
          flow_run_id: String(row.flow_run_id ?? ''),
          statement_date: '',
          source_name: sourceName ? [sourceName] : [],
          cycle_number: '',
          execution_number: '',
          remarks: String(row.remarks ?? ''),
          reconciliation_status: ['unmatched'],
          ageing_bucket: bucketKey,
          limit: 50,
          offset: 0,
          page: 1,
          sort: 'desc',
        });

        if (thisFetchId !== fetchIdRef.current) return;

        const { records, count: total } = normaliseRemarksWiseDetailsResponse(raw);
        setDetailsColumns(records.length > 0 ? buildColDefs(records[0]) : []);
        setDetailsData(records);
        setTotalRows(total);
      } catch (error) {
        if (thisFetchId !== fetchIdRef.current) return;
        console.error('[RemarksWiseAgeingSummaryTable] fetchDetails error:', error);
        setDetailsData([]);
        setDetailsColumns([]);
        setTotalRows(0);
      } finally {
        if (thisFetchId === fetchIdRef.current) setDetailsLoading(false);
      }
    },
    [],
  );

  const handleBucketCountClick = useCallback(
    (row: Record<string, unknown>, bucketKey: string) => {
      setDetailsData([]);
      setDetailsColumns([]);
      setTotalRows(0);
      setDetailsOpen(true);
      void fetchDetails(row, bucketKey);
    },
    [fetchDetails],
  );

  const handleSheetOpenChange = useCallback((nextOpen: boolean) => {
    setDetailsOpen(nextOpen);
    if (!nextOpen) {
      fetchIdRef.current++;
      setDetailsData([]);
      setDetailsColumns([]);
      setTotalRows(0);
      setDetailsLoading(false);
      setSelectedBucket('');
      setSelectedRemarks('');
    }
  }, []);

  const handleDownload = useCallback(
    (format: 'csv' | 'excel') => {
      if (!detailsData.length) return;

      const worksheet = XLSX.utils.json_to_sheet(detailsData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Details');

      const fileName = 'remarks_wise_ageing_details';

      if (format === 'csv') {
        XLSX.writeFile(workbook, `${fileName}.csv`, { bookType: 'csv' });
      } else {
        XLSX.writeFile(workbook, `${fileName}.xlsx`);
      }
    },
    [detailsData],
  );

  const customTableColumns = useMemo(
    () => [
      {
        key: 'remarks',
        header: 'Remarks',
        colWidth: 360,
        align: 'left' as const,
        sortable: true,
        TruncateData: false,
        renderCell: (row: Record<string, unknown>) => (
          <span className="block max-w-full whitespace-normal break-words text-xs font-medium text-foreground/90">
            {String(row.remarks ?? '—')}
          </span>
        ),
      },
      ...BUCKET_COLUMNS.map((col) => ({
        key: String(col.key),
        header: col.label,
        colWidth: 90,
        align: 'left' as const,
        sortable: true,
        TruncateData: false,
        renderCell: (row: Record<string, unknown>) => {
          const count = Number(row[col.key as string]);
          const formatted = formatCountValue(row[col.key as string]);

          if (count > 0) {
            return (
              <button
                type="button"
                onClick={() => handleBucketCountClick(row, String(col.key))}
                className="cursor-pointer text-xs font-medium text-primary hover:underline"
              >
                {formatted}
              </button>
            );
          }

          return (
            <span className="block max-w-full truncate whitespace-nowrap text-xs font-medium text-foreground/90">
              {formatted}
            </span>
          );
        },
      })),
    ],
    [handleBucketCountClick],
  );

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

  const tableContent = (
    <>
      {!isLoading && sortedRows.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-2 text-muted-foreground/70"
          style={{ height: tableBodyScrollHeightPx }}
        >
          <FileText className="h-9 w-9 opacity-25" strokeWidth={1.5} />
          <p className="text-sm font-semibold tracking-tight text-foreground/80">
            No remarks-wise ageing data
          </p>
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
          lastColumnHeaderPadding={false}
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
              <FileText className="h-9 w-9 opacity-25" strokeWidth={1.5} />
              <p className="text-sm font-semibold tracking-tight text-foreground/80">
                No remarks-wise ageing data
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
        icon={FileText}
        title={TITLE}
        subtitle={SUBTITLE}
        trailing={<div className="flex items-center gap-1">{expandButton}</div>}
      />
      <CardContent className="flex flex-col px-3 pb-3 pt-1">{tableContent}</CardContent>

      <AgingChartExpandDialog
        open={open}
        onOpenChange={setOpen}
        title={TITLE}
        subtitle={SUBTITLE}
        contentHeight={
          TABLE_HEADER_PX + AGING_CHART_EXPANDED_TABLE_VISIBLE_ROWS * TABLE_ROW_PX + 56
        }
      >
        <RemarksWiseAgeingSummaryTableCard
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
        ageingBucket={selectedBucket}
        ageingRemarks={selectedRemarks}
        onDownload={handleDownload}
      />
    </Card>
  );
}
