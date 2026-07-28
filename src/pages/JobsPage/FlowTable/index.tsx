import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Search, GitBranch, Dot, MoreVertical } from 'lucide-react';
import { FlowJob, JobsFilter } from '@/types/jobs';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatTimeAgo, getJobStatusColor, formatRelativeTime, formatJobStatusLabel } from '@/utils/formatters';
import { format } from 'date-fns';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { jobsApi, buildFlowJobsCreatedAtBetweenClause } from '@/controllers/API/jobsApi';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import { Button } from '@/components/ui/button';
import TableWithPagination from '@/common/tableWithPagination';
import { ColumnDef } from '@tanstack/react-table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';


interface FlowTableProps {
  filters: JobsFilter;
  onRowClick: (flow: FlowJob) => void;
  /** Incremented on full page reset — clears table search/sort/pagination locally. */
  filterResetSignal?: number;
}

// Helper component for tooltip with truncated text; optional onClick renders a link-style button only on the label
const TruncatedTextWithTooltip = ({
  text,
  className = "",
  maxLength = 20,
  cursorClassName = "cursor-default",
  onClick,
}: {
  text: string;
  className?: string;
  maxLength?: number;
  cursorClassName?: string;
  onClick?: () => void;
}) => {
  const isTruncated = text && text.length > maxLength;

  const content = onClick ? (
    <button
      type="button"
      className={cn(
        "block max-w-full truncate text-left text-primary hover:underline cursor-pointer",
        className,
      )}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {text}
    </button>
  ) : (
    <span className={cn(cursorClassName, className)}>{text}</span>
  );

  if (!isTruncated) {
    return content;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent>
        <p className="max-w-xs break-words">{text}</p>
      </TooltipContent>
    </Tooltip>
  );
};


// Define columns for TableWithPagination with responsive widths
const createColumns = (
  onRowClick: (flow: FlowJob) => void,
  onPrefectRunClick: (flow: FlowJob) => void,
): ColumnDef<FlowJob>[] => [
  {
    id: 'flow_name',
    header: 'Flow Name',
    accessorKey: 'flow_name',
    size: 200,
    minSize: 150,
    maxSize: 250,
    cell: ({ row }) => (
      <div className="flex min-w-0 select-text items-center gap-1 py-0.5">
        <GitBranch className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
  
        <div className="min-w-0 truncate leading-none">
          <TruncatedTextWithTooltip
            text={row.original.flow_name}
            className="text-xs font-medium leading-none"
            maxLength={15}
            onClick={() => onRowClick(row.original)}
          />
        </div>
      </div>
    ),
  },
  {
    id: 'flow_statement_date',
    header: 'Statement Date',
    accessorKey: 'flow_statement_date',
    size: 120,
    minSize: 100,
    maxSize: 150,
    cell: ({ row }) => {
      const raw = row.original.flow_statement_date;
  
      const display = raw
        ? (() => {
            const d = new Date(raw);
            return Number.isNaN(d.getTime())
              ? raw
              : format(d, 'MMM d, yyyy');
          })()
        : '—';
  
      return (
        <div className="py-0.5 leading-none">
          <TruncatedTextWithTooltip
            text={display}
            className="block min-w-0 truncate text-xs leading-none"
            maxLength={14}
          />
        </div>
      );
    },
  },
  {
    id: 'executed_by',
    header: 'Executed By',
    accessorKey: 'executed_by',
    size: 100,
    minSize: 80,
    maxSize: 120,
    cell: ({ row }) => (
      <div className="py-0.5 leading-none">
        <TruncatedTextWithTooltip
          text={row.original.executed_by || '—'}
          className="block min-w-0 truncate text-xs font-medium leading-none"
          maxLength={12}
        />
      </div>
    ),
  },
  {
    id: 'rollbacked_by',
    header: 'Rollbacked By',
    accessorKey: 'rollbacked_by',
    size: 100,
    minSize: 80,
    maxSize: 120,
    cell: ({ row }) => (
      <div className="py-0.5 leading-none">
        <TruncatedTextWithTooltip
          text={row.original.rollbacked_by || '—'}
          className="block min-w-0 truncate text-xs font-medium leading-none"
          maxLength={12}
        />
      </div>
    ),
  },
  {
    id: 'job_status',
    header: 'Status',
    accessorKey: 'job_status',
    size: 140,
    minSize: 120,
    maxSize: 180,
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className={cn(
          `
          h-5
          px-1.5
          py-0
          text-xs
          leading-none
          font-medium
          flex
          items-center
          justify-center
          whitespace-nowrap
          `,
          getJobStatusColor(row.original.job_status),
        )}
      >
        {formatJobStatusLabel(row.original.job_status)}
      </Badge>
    ),
  },
  {
    id: 'updated_at',
    header: 'Last Run',
    accessorKey: 'updated_at',
    size: 100,
    minSize: 80,
    maxSize: 120,
    cell: ({ row }) => (
      <div className="py-0.5 leading-none">
        <TruncatedTextWithTooltip 
          text={formatRelativeTime(row.original.updated_at || '')} 
          className="block min-w-0 truncate text-xs leading-none"
          maxLength={10}
        />
      </div>
    ),
  },
  {
    id: 'actions',
    header: '',
    size: 40,
    minSize: 40,
    maxSize: 50,
    cell: ({ row }) => (
      <div className="flex justify-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()} className="h-8 w-8">
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRowClick(row.original); }}>
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!row.original.flow_run_id}
              onClick={(e) => {
                e.stopPropagation();
                onPrefectRunClick(row.original);
              }}
            >
              Prefect run
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ),
  },
];

export const FlowTable: React.FC<FlowTableProps> = ({ filters, onRowClick, filterResetSignal = 0 }) => {
  const navigate = useNavigate();
  const handlePrefectRun = useCallback((flow: FlowJob) => {
    if (!flow.flow_run_id) return;
    navigate(`/jobs/prefectrun/${flow.flow_run_id}`);
  }, [navigate]);

  const [data, setData] = useState<FlowJob[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [sortedColumns, setSortedColumns] = useState<Record<string, "asc" | "desc">>({});

  const useClientPaging = useMemo(
    () => Boolean(buildFlowJobsCreatedAtBetweenClause(filters)),
    [
      filters.timeRange,
      filters.dateRange?.from?.getTime(),
      filters.dateRange?.to?.getTime(),
    ],
  );

  const tableRows = useMemo(() => {
    if (!useClientPaging) return data;
    const start = currentPage * pageSize;
    return data.slice(start, start + pageSize);
  }, [useClientPaging, data, currentPage, pageSize]);

  const lastFilterResetSignal = useRef(0);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const fetchFlowJobs = async (
    page: number = currentPage,
    limit: number = pageSize,
    sort?: Record<string, "asc" | "desc">,
    /** When set (e.g. refresh), used immediately instead of debounced state from the closure */
    explicitSearchText?: string,
  ) => {
    setIsLoading(true);
    try {
      const queryParts: string[] = [];
      const dateClause = buildFlowJobsCreatedAtBetweenClause(filters);
      if (dateClause) {
        queryParts.push(dateClause);
      }
      if (filters.status) {
        queryParts.push(`job_status='${filters.status.toUpperCase()}'`);
      }

      const searchText =
        explicitSearchText !== undefined
          ? explicitSearchText || filters.searchText
          : debouncedSearchTerm || filters.searchText;

      const sortObj =
        sort && Object.keys(sort).length > 0
          ? sort
          : ({ updated_at: 'desc' as const } as Record<string, 'desc' | 'asc'>);

      const response = await jobsApi.getFlowJobs({
        ...(useClientPaging ? {} : { skip: page, limit }),
        omitPagination: useClientPaging,
        search_text: searchText,
        q: queryParts.length ? queryParts.join(' AND ') : undefined,
        sort: sortObj,
      });

      setData(response.data);
      setTotalCount(response.total);
    } catch (error) {
      console.error('Error fetching flow jobs:', error);
      toast.error(getDisplayErrorMessage(error, 'Failed to fetch flow jobs.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (filterResetSignal === 0 || filterResetSignal === lastFilterResetSignal.current) return;
    lastFilterResetSignal.current = filterResetSignal;
    setSearchTerm('');
    setDebouncedSearchTerm('');
    setCurrentPage(0);
    setPageSize(10);
    setSortedColumns({});
    void fetchFlowJobs(0, 10, {}, '');
  }, [filterResetSignal]);

  useEffect(() => {
    setCurrentPage(0);
    fetchFlowJobs(0, pageSize);
  }, [pageSize, filters, debouncedSearchTerm]);

  useEffect(() => {
    fetchFlowJobs();
  }, []);

  // Handle pagination changes from TableWithPagination
  const handlePaginationChange = ({
    currentPage: newPage,
    limit: newLimit,
    sortedColumns: newSort,
  }: {
    currentPage: number;
    limit: number;
    sortedColumns?: Record<string, 'asc' | 'desc'>;
  }) => {
    if (useClientPaging) {
      const effectiveSort =
        newSort && Object.keys(newSort).length > 0 ? newSort : sortedColumns;
      const sortChanged =
        JSON.stringify(effectiveSort ?? {}) !== JSON.stringify(sortedColumns ?? {});

      if (sortChanged && effectiveSort && Object.keys(effectiveSort).length > 0) {
        setCurrentPage(0);
        setPageSize(newLimit);
        if (newSort && Object.keys(newSort).length > 0) {
          setSortedColumns(newSort);
        }
        void fetchFlowJobs(0, newLimit, effectiveSort);
        return;
      }

      setCurrentPage(newPage);
      setPageSize(newLimit);
      if (newSort && Object.keys(newSort).length > 0) {
        setSortedColumns(newSort);
      }
      return;
    }

    setCurrentPage(newPage);
    setPageSize(newLimit);
    if (newSort) {
      setSortedColumns(newSort);
    }
    void fetchFlowJobs(newPage, newLimit, newSort || sortedColumns);
  };

  const columns = useMemo(
    () => createColumns(onRowClick, handlePrefectRun),
    [onRowClick, handlePrefectRun],
  );

  return ( 
    <div className="w-full overflow-hidden">
      <Card className="border-border bg-card text-card-foreground rounded-lg border shadow-sm overflow-hidden p-1 gap-0">
        <CardHeader className="border-b border-border [.border-b]:pb-0 pb-0 px-2">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <h3 className="text-lg font-semibold text-card-foreground">{totalCount} Flows</h3>
              <div className="relative w-full sm:w-64 lg:w-auto lg:min-w-[16rem]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 pointer-events-none" />
                <Input
                    placeholder="Search flows..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-8 w-full border-border bg-background pl-10 pr-8 text-foreground placeholder:text-muted-foreground focus-visible:border-ring"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded p-0.5 text-white bg-destructive hover:text-white hover:bg-destructive"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                )}
              </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto jobs-table-wrapper">
            <style>{`
              .jobs-table-wrapper > div > div {
                max-height: 300px !important;
              }
            `}</style>
            <TableWithPagination
              data={tableRows}
              columns={columns}
              totalRows={totalCount}
              pagination={{
                steps: [10, 20, 50, 100],
                currentPage,
                pageSize,
              }}
              loading={isLoading}
              onChangePagination={handlePaginationChange}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
