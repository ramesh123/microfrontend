import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Download, FileJson, Table as TableIcon, FileSpreadsheet, HandCoins } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useState, useRef, useMemo } from 'react';
import type { AgingChartClickParams } from '../hooks/useAgingReconciliationDetails';
import { downloadReconciliationSummaryDetails } from '@/controllers/API/ReconcilationAPI';
import { buildReconciliationDetailsPayload } from '../utils/agingReconciliationDetailsShared';

export type AgingDetailsSheetVariant = 'chart' | 'ageing';

interface AgingReconciliationDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  records: Record<string, unknown>[];
  columns: ColDef[];
  totalRows: number;
  sourceNames?: string[];
  selectedSourceName?: string | null;
  onSourceTabChange?: (name: string) => void;
  activeParams?: AgingChartClickParams | null;
  selectedTrendValue?: number | null;
  flowId?: string;
  /** Chart drill-through (default) vs ageing summary table drill-through */
  variant?: AgingDetailsSheetVariant;
  /** Statement date for ageing summary table drill-through info bar */
  ageingStatementDate?: string;
  /** Ageing bucket label for remarks-wise drill-through info bar */
  ageingBucket?: string;
  /** Remarks text for remarks-wise drill-through info bar */
  ageingRemarks?: string;
  /** Server-side search for ageing table drill-through */
  searchText?: string;
  onSearchTextChange?: (value: string) => void;
  /** Override download (ageing table uses local export) */
  onDownload?: (format: 'csv' | 'excel') => void;
}

export function AgingReconciliationDetailsSheet({
  open,
  onOpenChange,
  loading,
  records,
  columns,
  totalRows,
  sourceNames,
  selectedSourceName,
  onSourceTabChange,
  activeParams,
  selectedTrendValue,
  flowId,
  variant = 'chart',
  ageingStatementDate,
  ageingBucket,
  ageingRemarks,
  searchText,
  onSearchTextChange,
  onDownload,
}: AgingReconciliationDetailsSheetProps) {
  const [quickFilterText, setQuickFilterText] = useState('');
  const gridRef = useRef<AgGridReact>(null);
  const isAgeingVariant = variant === 'ageing';
  const isServerSearch = isAgeingVariant && onSearchTextChange != null;
  const effectiveSearchText = isServerSearch ? (searchText ?? '') : quickFilterText;

  const isDark =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark');
  const agGridTheme = isDark ? 'ag-theme-quartz-dark' : 'ag-theme-quartz';

  const handleDownload = async (format: 'csv' | 'excel') => {
    if (onDownload) {
      onDownload(format);
      return;
    }

    if (!flowId || !activeParams) return;

    const basePayload = buildReconciliationDetailsPayload({
      flowId,
      statementDate: activeParams.statementDate,
      sourceNames: selectedSourceName ? [selectedSourceName] : [],
      dataKey: activeParams.dataKey,
    });

    await downloadReconciliationSummaryDetails({
      ...basePayload,
      file_type: format,
      is_data: false,
    });
  };

  const effectiveDataKey = activeParams?.dataKey ?? '';
  const statementDate = activeParams?.statementDate ?? ageingStatementDate ?? '';

  const recordTypeLabel = useMemo(() => {
    if (!effectiveDataKey) return '';
    const key = effectiveDataKey.toLowerCase();
    if (key.includes('unmatch')) return 'Unmatched';
    if (key.includes('reversal')) return 'Reversal';
    return 'Matched';
  }, [effectiveDataKey]);

  const sheetTitle = isAgeingVariant
    ? 'Reconciliation Details'
    : `${recordTypeLabel || 'Reconciliation'} Records`;

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '—';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[90vw] max-w-[1400px] flex flex-col p-0">
        <div className="flex flex-col h-full">
          {/* Header Section 1: Title, Search, Download */}
          <div className="shrink-0 px-2 py-2 border-b ml-4 flex items-center justify-between">
            <div className="flex flex-col gap-1">
            <h2 className="text-lg font-bold">
              {sheetTitle}
            </h2>
            {!loading && totalRows > 0 && (
              <p className="text-xs text-muted-foreground">
                {totalRows.toLocaleString()} total record{totalRows !== 1 ? 's' : ''}
              </p>
            )}
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 !h-3.5 !w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  className="pl-9 !h-7"
                  value={effectiveSearchText}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    if (isServerSearch) {
                      onSearchTextChange?.(nextValue);
                    } else {
                      setQuickFilterText(nextValue);
                    }
                  }}
                />
                  {effectiveSearchText && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isServerSearch) {
                        onSearchTextChange?.('');
                      } else {
                        setQuickFilterText('');
                      }
                    }}
                    className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded p-0.5 text-white bg-destructive hover:text-white hover:bg-destructive"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                )}
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="!h-7 gap-2">
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-48 p-1">
                  <div className="flex flex-col">
                    <button
                      onClick={() => handleDownload('csv')}
                      className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted rounded-md transition-colors text-left"
                    >
                      <FileJson className="h-4 w-4 text-orange-500" />
                      Download as CSV
                    </button>
                    <button
                      onClick={() => handleDownload('excel')}
                      className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted rounded-md transition-colors text-left"
                    >
                      <FileSpreadsheet className="h-4 w-4 text-green-600" />
                      Download as Excel
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Info Section */}
          <div className="shrink-0 px-6 py-1 border-b bg-muted/30 flex items-center gap-6 text-sm">
            {isAgeingVariant ? (
              <>
                <div className="flex items-center gap-2">
                  <span>📄</span>
                  <span>{totalRows.toLocaleString()} records</span>
                </div>
                {ageingBucket ? (
                  <div className="flex items-center gap-2">
                    <span>⏳</span>
                    <span>{ageingBucket}</span>
                  </div>
                ) : null}
                {statementDate ? (
                  <div className="flex items-center gap-2">
                    <span>📅</span>
                    <span>{statementDate}</span>
                  </div>
                ) : null}
                {ageingRemarks ? (
                  <div className="flex min-w-0 items-center gap-2">
                    <span>💬</span>
                    <span className="truncate max-w-[480px]" title={ageingRemarks}>
                      {ageingRemarks}
                    </span>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span>📅</span>
                  <span>{statementDate}</span>
                </div>
                <div className="flex items-center gap-2">
                  {effectiveDataKey.toLowerCase().includes('unmatch') ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4 shrink-0 rounded bg-destructive p-0.5 text-white"
                      aria-hidden="true"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  ) : effectiveDataKey.toLowerCase().includes('reversal') ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4 shrink-0 rounded bg-yellow-600 p-0.5 text-white"
                      aria-hidden="true"
                    >
                      <path d="M3 2v6h6" />
                      <path d="M21 12A9 9 0 0 0 6 5.3L3 8" />
                      <path d="M21 22v-6h-6" />
                      <path d="M3 12a9 9 0 0 0 15 6.7L21 16" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4 shrink-0 rounded bg-green-600 p-0.5 text-white"
                      aria-hidden="true"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                  <span>{recordTypeLabel} Count: {totalRows.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span><HandCoins className="h-4 w-4" /></span>
                  <span>{formatCurrency(selectedTrendValue)}</span>
                </div>
              </>
            )}
          </div>

          {!isAgeingVariant && sourceNames && sourceNames.length > 0 && (
            <div className="px-4 py-1 border-b bg-muted/10 shrink-0">
              <Tabs
                value={selectedSourceName ?? undefined}
                onValueChange={onSourceTabChange}
                className="w-full"
              >
                <TabsList className="h-9 w-fit p-1 bg-muted/50">
                  {sourceNames.map((name) => (
                    <TabsTrigger
                      key={name}
                      value={name}
                      className="text-xs px-4 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                      {name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          )}

          <div
            className={cn('flex-1 px-6 py-2 overflow-hidden', agGridTheme)}
            style={{ height: '100%' }}
          >
            {loading && (
              <div className="flex h-full items-center justify-center text-muted-foreground text-sm gap-2">
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Loading records…</span>
              </div>
            )}

            {!loading && records.length === 0 && (
              <div className="flex h-full items-center justify-center text-muted-foreground text-sm flex-col gap-2">
                <TableIcon className="h-8 w-8 opacity-20" />
                <span>No records found.</span>
              </div>
            )}

            <div
              style={{
                height: '100%',
                width: '100%',
                visibility: loading || records.length === 0 ? 'hidden' : 'visible',
              }}
            >
              <AgGridReact
                ref={gridRef}
                rowData={records}
                columnDefs={columns}
                headerHeight={38}
                rowHeight={34}
                domLayout="normal"
                pagination
                paginationPageSize={20}
                paginationPageSizeSelector={[10, 20, 50, 100]}
                animateRows
                quickFilterText={isServerSearch ? undefined : quickFilterText}
                defaultColDef={{
                  sortable: true,
                  filter: true,
                  resizable: true,
                  flex: 1,
                  minWidth: 150,
                }}
              />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
