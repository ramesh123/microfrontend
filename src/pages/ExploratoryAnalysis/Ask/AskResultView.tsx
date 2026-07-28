import { useMemo } from 'react';
import { BarChart3, Loader2, Table2, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/context/theme';
import CustomTableData from '@/components/ui/CustomTableData';
import AskChart from './AskChart';
import type { AskQueryResponse, AskChartReadyResponse } from '@/controllers/API/askApi';

interface AskResultViewProps {
  queryData: AskQueryResponse | null;
  queryLoading: boolean;
  queryError: string | null;
  chartData: AskChartReadyResponse | null;
  chartLoading: boolean;
  showChart: boolean;
  onToggleView: () => void;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export default function AskResultView({  
  queryData,
  queryLoading,
  queryError,
  chartData,
  chartLoading,
  showChart,
  onToggleView,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: AskResultViewProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark' || theme === 'blue-dark' || theme === 'blue-dark-g' || theme === 'purple-dark' || theme === 'orange-dark';

  // Dynamic columns from response row keys
  const columns = useMemo(() => {
    if (!queryData?.rows?.length) return [];
    const keys = Object.keys(queryData.rows[0]);
    return keys.map((key) => ({
      key,
      header: key,
      sortable: true,
      filterable: true,
    }));
  }, [queryData]);

  // Client-side pagination
  const paginatedRows = useMemo(() => {
    if (!queryData?.rows) return [];
    const start = currentPage * pageSize;
    return queryData.rows.slice(start, start + pageSize);
  }, [queryData?.rows, currentPage, pageSize]);

  const totalRows = queryData?.rows?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  if (queryLoading) {
    return (
      <div className={cn(
        'flex items-center justify-center py-16 rounded-lg',
        isDark ? 'bg-white/5' : 'bg-slate-50'
      )}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className={cn('text-sm', isDark ? 'text-white/60' : 'text-muted-foreground')}>
            Analyzing your question...
          </span>
        </div>
      </div>
    );
  }

  if (queryError) {
    return (
      <div className={cn(
        'rounded-lg border px-4 py-8 text-center',
        isDark ? 'bg-red-900/10 border-red-800/30 text-red-400' : 'bg-red-50 border-red-200 text-red-600'
      )}>
        <p className="text-sm font-medium">Something went wrong</p>
        <p className="text-xs mt-1 opacity-80">{queryError}</p>
      </div>
    );
  }

  if (!queryData || !queryData.rows?.length) return null;

  return (
    <div className="ask-result-table">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {/* Chart toggle button */}
          {chartLoading ? (
            <span className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border cursor-not-allowed opacity-70',
              isDark ? 'bg-white/5 border-white/10 text-white/60' : 'bg-slate-100 border-slate-200 text-slate-500'
            )}>
              <BarChart3 className="h-3.5 w-3.5" />
              <Loader2 className="h-3 w-3 animate-spin" />
            </span>
          ) : chartData ? (
            <button
              onClick={onToggleView}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                showChart
                  ? isDark
                    ? 'bg-primary/20 border-primary/30 text-primary hover:bg-primary/30'
                    : 'bg-primary/10 border-primary/20 text-primary hover:bg-primary/20'
                  : isDark
                    ? 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              )}
            >
              {showChart ? (
                <>
                  <Table2 className="h-3.5 w-3.5" />
                  Table
                </>
              ) : (
                <>
                  <BarChart3 className="h-3.5 w-3.5" />
                  Chart
                </>
              )}
            </button>
          ) : null}
        </div>

        {/* Row count info */}
        {!showChart && (
          <span className={cn('text-xs', isDark ? 'text-white/40' : 'text-muted-foreground')}>
            {totalRows} row{totalRows !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Content: Table or Chart */}
      {showChart && chartData ? (
        <div className={cn(
          'rounded-lg border p-4',
          isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'
        )}>
          <AskChart
            chartType={chartData.chart_type}
            data={chartData.data}
          />
        </div>
      ) : (
        <>
          <div className={cn(
            'rounded-lg border overflow-hidden',
            isDark ? 'border-white/10' : 'border-slate-200'
          )}>
            <CustomTableData
              data={paginatedRows}
              columns={columns}
              scrollHeightClass="max-h-[420px]"
              showSpinnerFlag={false}
              roundDecimals={2}
            />
          </div>

          {/* Pagination controls */}
          {totalRows > pageSize && (
            <div className={cn(
              'flex items-center justify-between mt-3 px-1',
            )}>
              <span className={cn('text-xs', isDark ? 'text-white/50' : 'text-muted-foreground')}>
                Page {currentPage + 1} of {totalPages}
              </span>

              <div className="flex items-center gap-2">
                <select
                  value={pageSize}
                  onChange={(e) => onPageSizeChange(Number(e.target.value))}
                  className={cn(
                    'text-xs rounded-md border px-2 py-1 outline-none',
                    isDark
                      ? 'bg-white/5 border-white/10 text-white/80'
                      : 'bg-white border-slate-200 text-slate-700'
                  )}
                >
                  {[10, 25, 50, 100].map((s) => (
                    <option key={s} value={s}>{s} / page</option>
                  ))}
                </select>

                <div className="flex items-center gap-1">
                  <button
                    disabled={currentPage === 0}
                    onClick={() => onPageChange(currentPage - 1)}
                    className={cn(
                      'p-1 rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                      isDark
                        ? 'border-white/10 hover:bg-white/10 text-white/80'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    )}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    disabled={currentPage >= totalPages - 1}
                    onClick={() => onPageChange(currentPage + 1)}
                    className={cn(
                      'p-1 rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                      isDark
                        ? 'border-white/10 hover:bg-white/10 text-white/80'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    )}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
            </div>
          )}
        </>
      )}

      {/* Scoped styles for alternating row colors */}
      <style>{`
        .ask-result-table table tbody tr:nth-child(odd) {
          background-color: ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'};
        }
        .ask-result-table table tbody tr:nth-child(even) {
          background-color: transparent;
        }
        .ask-result-table table tbody tr:hover {
          background-color: ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'} !important;
        }
      `}</style>
    </div>
  );
}
