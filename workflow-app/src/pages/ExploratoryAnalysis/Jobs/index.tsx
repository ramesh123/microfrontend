import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import TableWithPagination from '@/common/tableWithPagination'
import {
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  CircleDot,
  Timer,
  X,
  Search,
  ChevronLeft,
  MoreVertical,
  Trash2,
  Activity,
  ListTodo,
  ClipboardCheck,
} from 'lucide-react'
import {
  deleteExploratoryJob,
  fetchExploratoryJobDetail,
  fetchExploratoryJobs,
} from '@/controllers/API/exploratoryJobsApi'
import { useSemanticsStore } from '@/stores/semanticsStore'
import { getJobStatusColor } from '@/utils/formatters'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';

// --- Types ---

interface Job {
  job_id: string
  job_type: string
  status: string
  /** Workspace tenant id for this job — use in DELETE body (not the semantics UI store id). */
  tenant_id?: string | null
  tenant_name?: string | null
  domain_id?: string | null
  created_at: string
  updated_at: string
}

interface JobDetail {
  job_id: string
  job_type: string
  status: string
  progress_pct: number
  progress_stage: string
}

// --- Constants ---

const JOB_TYPE_LABELS: Record<string, string> = {
  scan_connection: 'Schema Scan',
  map: 'Entity Mapping',
  infer_models: 'Dims & Facts Inference',
  suggested_metrics: 'Metrics Suggestion',
  agentic_run: 'Agentic Run',
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'queued', label: 'Queued' },
  { value: 'running', label: 'Running' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'canceled', label: 'Canceled' },
]

const PAGINATION_STEPS = [10, 20, 50, 100]
const DEFAULT_PAGE_SIZE = 10

function SearchClearButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded p-0.5 text-white bg-destructive hover:text-white hover:bg-destructive"
      aria-label="Clear search"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  )
}

/** Read list total from common API shapes (including nested). */
function parseJobsListTotal(data: unknown): { total: number; known: boolean } {
  if (!data || typeof data !== 'object') return { total: 0, known: false }
  const d = data as Record<string, unknown>
  const nested =
    d.data && typeof d.data === 'object' ? (d.data as Record<string, unknown>) : null
  const fromResult =
    d.result && typeof d.result === 'object' ? (d.result as Record<string, unknown>) : null
  const candidates: unknown[] = [
    d.total,
    d.total_count,
    d.totalCount,
    d.count,
    (d.pagination as Record<string, unknown> | undefined)?.total,
    (d.meta as Record<string, unknown> | undefined)?.total,
    nested?.total,
    nested?.total_count,
    nested?.count,
    fromResult?.total,
    fromResult?.total_count,
    fromResult?.count,
  ]
  for (const raw of candidates) {
    if (raw === undefined || raw === null) continue
    if (typeof raw === 'string' && raw.trim() === '') continue
    const n = Number(raw)
    if (!Number.isNaN(n) && n >= 0) return { total: Math.floor(n), known: true }
  }
  return { total: 0, known: false }
}


function getStatusIcon(status: string) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="size-3.5 text-emerald-600" />
    case 'failed':
      return <XCircle className="size-3.5 text-red-500" />
    case 'running':
      return <Loader2 className="size-3.5 text-blue-600 animate-spin" />
    case 'queued':
      return <Timer className="size-3.5 text-orange-500" />
    case 'canceled':
      return <X className="size-3.5 text-gray-500" />
    default:
      return <CircleDot className="size-3.5 text-gray-400" />
  }
}

function formatTime(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

// --- Main Component ---

export default function SemanticJobs() {
  const { tenantId } = useSemanticsStore()

  const [jobs, setJobs] = useState<Job[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  // const [typeFilter, setTypeFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  /** 0-based page index (matches TableWithPagination / device profiles). */
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  /** `null` = API did not return a total field. */
  const [totalRecords, setTotalRecords] = useState<number | null>(null)
  const [jobsFetchPending, setJobsFetchPending] = useState(false)

  const totalKnown = totalRecords !== null
  const effectiveTotal = totalRecords ?? 0
  const totalPages = totalKnown ? Math.max(1, Math.ceil(effectiveTotal / pageSize)) : 1
  const tableTotalRows = totalKnown ? effectiveTotal : jobs.length

  // Detail panel
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [jobDetail, setJobDetail] = useState<JobDetail | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)

  const [jobPendingDelete, setJobPendingDelete] = useState<Job | null>(null)
  const [isDeletingJob, setIsDeletingJob] = useState(false)

  const tableScrollRef = useRef<HTMLDivElement>(null)
  const listPanelScrollRef = useRef<HTMLDivElement>(null)
  const scrollToTopAfterRefreshRef = useRef(false)

  const scrollJobsTableToTop = useCallback(() => {
    tableScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    listPanelScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [])

  const fetchJobs = useCallback(
    async (opts?: { silent?: boolean; offset?: number; pageSizeOverride?: number }) => {
      const silent = opts?.silent ?? false
      const size = opts?.pageSizeOverride ?? pageSize
      const computedOffset = opts?.offset ?? currentPage * size

      if (!silent) setJobsFetchPending(true)
      try {
        const params: Record<string, unknown> = {
          job_type: 'agentic_run',
          limit: size,
          offset: computedOffset,
        }

        if (statusFilter !== 'all') {
          params.status = statusFilter
        }

        const res = await fetchExploratoryJobs(params as Parameters<typeof fetchExploratoryJobs>[0])

        const list = (res?.jobs ?? []) as typeof jobs
        const { total: parsedTotal, known: parsedKnown } = parseJobsListTotal(res)
        setTotalRecords(parsedKnown ? parsedTotal : null)

        setJobs(list)

      } catch (err) {
        console.error('Failed to fetch jobs:', err)
        if (!silent) {
          toast.error(getDisplayErrorMessage(err, 'Failed to fetch jobs'))
        }
      } finally {
        if (!silent) setJobsFetchPending(false)
        setIsLoading(false)
        setIsRefreshing(false)
        if (scrollToTopAfterRefreshRef.current) {
          scrollToTopAfterRefreshRef.current = false
          requestAnimationFrame(() => {
            scrollJobsTableToTop()
          })
        }
      }
    },
    [statusFilter, currentPage, pageSize, scrollJobsTableToTop],
  )

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  const handleRefresh = useCallback(() => {
    scrollToTopAfterRefreshRef.current = true
    scrollJobsTableToTop()
    setSearchQuery('')
    setCurrentPage(0)
    setPageSize(DEFAULT_PAGE_SIZE)
    setIsRefreshing(true)
    if (statusFilter !== 'all') {
      setStatusFilter('all')
    } else {
      void fetchJobs({ offset: 0, pageSizeOverride: DEFAULT_PAGE_SIZE })
    }
  }, [statusFilter, fetchJobs, scrollJobsTableToTop])

  /** If total shrinks or page size changes, keep current page in range. */
  useEffect(() => {
    if (!totalKnown) return
    if (currentPage > totalPages - 1) setCurrentPage(Math.max(0, totalPages - 1))
  }, [totalKnown, totalPages, currentPage])

  // Auto-refresh every 10s when there are running/queued jobs
  useEffect(() => {
    const hasActive = jobs.some((j) => j.status === 'running' || j.status === 'queued')
    if (!hasActive) return

    const interval = setInterval(() => fetchJobs({ silent: true }), 10000)
    return () => clearInterval(interval)
  }, [jobs, fetchJobs])

  // Chevron-left / Escape: close detail panel when not typing in a field
  useEffect(() => {
    if (!selectedJobId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'Escape') return
      const t = e.target as HTMLElement | null
      if (t?.closest?.('input, textarea, select, [contenteditable=true]')) return
      e.preventDefault()
      setSelectedJobId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedJobId])

  // Fetch job detail
  useEffect(() => {
    if (!selectedJobId) {
      setJobDetail(null)
      return
    }

    let cancelled = false
    setIsDetailLoading(true)

    const fetchDetail = async () => {
      try {
        const detail = await fetchExploratoryJobDetail<JobDetail>(selectedJobId)
        if (!cancelled) setJobDetail(detail)
      } catch {
        if (!cancelled) setJobDetail(null)
      } finally {
        if (!cancelled) setIsDetailLoading(false)
      }
    }

    fetchDetail()

    // Poll detail if active
    const interval = setInterval(async () => {
      if (cancelled) return
      try {
        const detail = await fetchExploratoryJobDetail<JobDetail>(selectedJobId)
        if (!cancelled) setJobDetail(detail)
        if (detail?.status === 'completed' || detail?.status === 'failed' || detail?.status === 'canceled') {
          clearInterval(interval)
        }
      } catch {
        // ignore
      }
    }, 5000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [selectedJobId])

  /** DELETE /api/v2/jobs/{job_id} — query tenant_id (required); body may also include job_id, tenant_id */
  const deleteJobById = useCallback(
    async (job: Job) => {
      const tenantForDelete = (job.tenant_id?.trim() || tenantId || '').trim()
      if (!tenantForDelete) {
        toast.error('Missing tenant id for this job')
        return
      }
      setIsDeletingJob(true)
      try {
        await deleteExploratoryJob(job.job_id, tenantForDelete)
        toast.success('Job deleted')
        if (selectedJobId === job.job_id) setSelectedJobId(null)
        setJobPendingDelete(null)
        await fetchJobs({ silent: true })
      } catch (err) {
        console.error('Failed to delete job:', err)
        toast.error(getDisplayErrorMessage(err, 'Failed to delete job'))
      } finally {
        setIsDeletingJob(false)
      }
    },
    [tenantId, selectedJobId, fetchJobs],
  )

  // --- Client-side search filter ---
  const query = searchQuery.toLowerCase().trim()
  const filteredJobs = query
    ? jobs.filter(
      (j) =>
        j.job_id.toLowerCase().includes(query) ||
        j.job_type.toLowerCase().includes(query) ||
        (JOB_TYPE_LABELS[j.job_type] ?? '').toLowerCase().includes(query) ||
        j.status.toLowerCase().includes(query) ||
        (j.tenant_name ?? '').toLowerCase().includes(query) ||
        (j.domain_id ?? '').toLowerCase().includes(query),
    )
    : jobs

  // --- Stats ---
  const stats = {
    total: jobs.length,
    running: jobs.filter((j) => j.status === 'running').length,
    queued: jobs.filter((j) => j.status === 'queued').length,
    completed: jobs.filter((j) => j.status === 'completed').length,
    failed: jobs.filter((j) => j.status === 'failed').length,
  }

  const columns = useMemo<ColumnDef<Job>[]>(
    () => [
      {
        accessorKey: 'job_id',
        header: 'Job ID',
        size: 180,
        cell: ({ row }) => (
          <span
            className={cn(
              'block max-w-[140px] truncate text-xs font-medium',
            )}
            title={row.original.job_id}
          >
            {row.original.job_id}
          </span>
        ),
      },
      {
        accessorKey: 'tenant_name',
        header: 'Tenant',
        size: 160,
        cell: ({ row }) => (
          <button
            type="button"
            className="block max-w-[160px] truncate text-xs text-primary hover:underline"
            onClick={(e) => {
              e.stopPropagation()
              setSelectedJobId(
                row.original.job_id === selectedJobId ? null : row.original.job_id
              )
            }}
          >
            {row.original.tenant_name ?? '—'}
          </button>
        ),
      },
      {
        accessorKey: 'domain_id',
        header: 'Domain',
        size: 160,
        cell: ({ row }) => (
          <span
            className="block max-w-[160px] truncate text-xs"
            title={row.original.domain_id ?? undefined}
          >
            {row.original.domain_id ?? '—'}
          </span>
        ),
      },
      {
        accessorKey: 'job_type',
        header: 'Type',
        size: 180,
        cell: ({ row }) => (
          <span className="text-sm">
            {JOB_TYPE_LABELS[row.original.job_type] ?? row.original.job_type}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        size: 140,
        cell: ({ row }) => (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-sm border px-1.5 py-0 text-[11px] font-medium',
              getJobStatusColor(row.original.status),
            )}
          >
            {getStatusIcon(row.original.status)}
            {row.original.status}
          </span>
        ),
      },
      {
        accessorKey: 'updated_at',
        header: 'Updated',
        size: 160,
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">{formatTime(row.original.updated_at)}</span>
        ),
      },
      {
        id: 'actions',
        header: () => (
          <div className="flex w-full justify-center px-1">
            <span>Actions</span>
          </div>
        ),
        size: 72,
        cell: ({ row }) => (
          <div className="flex w-full justify-center" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="!h-7 !w-7 shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label="Job actions"
                >
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setJobPendingDelete(row.original)}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5 text-red-500" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [selectedJobId],
  )

  return (
    <div className="flex flex-col h-full min-h-0 bg-gradient-to-b from-muted/20 to-background">
      {/* Header */}
      <div className="sticky top-0 z-30 shrink-0 border-b overflow-hidden bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_0%_-20%,hsl(var(--primary)/0.12),transparent),radial-gradient(ellipse_60%_50%_at_100%_0%,hsl(280_60%_50%/0.06),transparent)]"
          aria-hidden
        />
        <div className="relative flex items-center justify-between gap-3 px-2 py-1">
          <div className="flex items-start gap-3 min-w-0">
            <div className="min-w-0">
              <div className='flex items-center gap-2'>
                <ClipboardCheck className='h-4 w-4 text-primary' />
                <h1 className="text-[16px] font-semibold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
                  Semantic Jobs
                </h1>
              </div>
            </div>
          </div>
          <Button
            variant="primary"
            size="icon"
            className="!px-2"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn('size-3.5', isRefreshing && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Filters + stats */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-2 py-1 border-b bg-muted/40 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setCurrentPage(0)
              setStatusFilter(v)
            }}
          >
            <SelectTrigger className="!h-8 w-[140px] text-xs shadow-sm bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative w-full max-w-[11rem] shrink-0 sm:max-w-[12rem]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search jobs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 rounded-sm bg-background pl-8 pr-8 text-sm"
            />
            {searchQuery ? <SearchClearButton onClick={() => setSearchQuery('')} /> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {totalKnown && (
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/[0.06] px-2.5 py-0.5 text-[11px] font-medium text-foreground/90 shadow-sm">
              {effectiveTotal.toLocaleString()} total
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/90 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground shadow-sm">
            <ListTodo className="size-3 text-foreground/70" />
            {stats.total} on page
          </span>
          {stats.running > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/25 bg-blue-500/8 px-2.5 py-0.5 text-[11px] font-medium text-blue-700 dark:text-blue-300">
              <Activity className="size-3" />
              {stats.running} running
            </span>
          )}
          {stats.queued > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/25 bg-orange-500/8 px-2.5 py-0.5 text-[11px] font-medium text-orange-700 dark:text-orange-300">
              <Timer className="size-3" />
              {stats.queued} queued
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/8 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="size-3" />
            {stats.completed} done
          </span>
          {stats.failed > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-500/25 bg-red-500/8 px-2.5 py-0.5 text-[11px] font-medium text-red-700 dark:text-red-300">
              <XCircle className="size-3" />
              {stats.failed} failed
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Table */}
        <div
          ref={listPanelScrollRef}
          className={cn(
            'flex-1 min-w-0 overflow-auto transition-[padding] duration-300 ease-out',
            selectedJobId && 'pr-0',
          )}
        >
          <div className="p-0 md:p-0">
            <Card className="gap-0 border-border/70 p-0 shadow-sm">
              <CardContent className="p-0">
                <div className="semantic-jobs-table [&_table]:text-xs [&_th]:h-8 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-xs [&_th]:font-semibold [&_th]:normal-case [&_th]:tracking-wider [&_td]:py-1.5 [&_th:first-child]:px-3 [&_td:first-child]:px-3">
                  <TableWithPagination
                    key={`${statusFilter}|${searchQuery}|${pageSize}|${currentPage}`}
                    scrollContainerRef={tableScrollRef}
                    data={filteredJobs}
                    columns={columns}
                    totalRows={tableTotalRows}
                    loading={isLoading || jobsFetchPending}
                    pagination={{ steps: PAGINATION_STEPS, currentPage, pageSize }}
                    paginationSummary="range"
                    // onRowClick={(job) =>
                    //   setSelectedJobId(job.job_id === selectedJobId ? null : job.job_id)
                    // }
                    onChangePagination={({ currentPage: nextPage, limit }) => {
                      setCurrentPage((prev) => (prev === nextPage ? prev : nextPage))
                      setPageSize((prev) => (prev === limit ? prev : limit))
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

        </div>


        {/* Detail panel — ChevronLeft closes (back to list); ← / Esc also close */}
        {selectedJobId && (
          <div
            className={cn(
              'w-[min(100vw-1rem,20rem)] sm:w-80 shrink-0 flex flex-col border-l border-border/80 bg-card shadow-[-8px_0_24px_-12px_rgba(0,0,0,0.12)]',
              'animate-in slide-in-from-right-4 fade-in duration-300',
            )}
          >
            <div className="flex items-center gap-1 px-2 py-2.5 border-b border-border/60 bg-gradient-to-r from-primary/[0.06] via-transparent to-violet-500/[0.04]">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="!h-8 !w-8 shrink-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-background/80"
                onClick={() => setSelectedJobId(null)}
                title="Back to list (←)"
                aria-label="Back to list"
              >
                <ChevronLeft className="size-5" />
              </Button>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground/90 flex-1 truncate">
                Job Details
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="!h-8 !w-8 shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
                onClick={() => setSelectedJobId(null)}
                title="Close"
                aria-label="Close panel"
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="flex-1 min-h-0 overflow-auto p-3.5">
              {isDetailLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="size-4 animate-spin text-primary" />
                </div>
              ) : jobDetail ? (
                <div className="space-y-3">
                  {/* ID */}
                  <div>
                    <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      Job ID
                    </div>
                    <div className="text-xs font-mono mt-0.5 break-all">{jobDetail.job_id}</div>
                  </div>

                  {/* Type */}
                  <div>
                    <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      Type
                    </div>
                    <div className="text-sm font-medium mt-0.5">
                      {JOB_TYPE_LABELS[jobDetail.job_type] ?? jobDetail.job_type}
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      Status
                    </div>
                    <div className="mt-0.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-1.5 py-0 rounded-sm border text-[11px] font-medium',
                          getJobStatusColor(jobDetail.status),
                        )}
                      >
                        {getStatusIcon(jobDetail.status)}
                        {jobDetail.status}
                      </span>
                    </div>
                  </div>

                  {/* Progress */}
                  {(jobDetail.status === 'running' || jobDetail.status === 'queued') && (
                    <div>
                      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                        Progress
                      </div>
                      <div className="mt-1">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-blue-500 transition-all duration-500"
                              style={{ width: `${Math.max(jobDetail.progress_pct ?? 0, 2)}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
                            {jobDetail.progress_pct ?? 0}%
                          </span>
                        </div>
                        {jobDetail.progress_stage && (
                          <p className="text-[11px] text-muted-foreground mt-1 truncate" title={jobDetail.progress_stage}>
                            {jobDetail.progress_stage}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground text-center py-4">
                  Unable to load job details
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <AlertDialog
        open={jobPendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !isDeletingJob) setJobPendingDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete job?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. The job
              {jobPendingDelete ? (
                <span className="font-mono font-medium"> {jobPendingDelete.job_id}</span>
              ) : null}{' '}
              will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingJob} className="!h-8">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 !h-8 text-foreground"
              disabled={isDeletingJob || !jobPendingDelete}
              onClick={(e) => {
                e.preventDefault()
                if (jobPendingDelete) void deleteJobById(jobPendingDelete)
              }}
            >
              {isDeletingJob ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5 inline" />
                  Deleting…
                </>
              ) : (
                'OK'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
