import { useState, useEffect, useCallback, useRef } from 'react'
import { getDisplayErrorMessage } from '@/utils/exceptionHelper'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
import {
  Loader2,
  ChevronRight,
  BarChart3,
  Check,
  Pencil,
  Trash2,
  X,
  Clock,
  Tag,
  Sparkles,
  Award,
  FileCode2,
  Calculator,
  Plus,
} from 'lucide-react'
import { apiV2 } from '@/controllers/API/api'
import { useSemanticsStore, type MetricItem } from '@/stores/semanticsStore'
import { fetchMetricsApi, fetchTenantDomain, certifyMetric } from '@/controllers/API/semanticsApi'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import JobProcessingBanner from './JobProcessingBanner'

// --- Dropdown option constants ---

const ALLOWED_METRIC_TYPES = [
  { value: 'sum', label: 'SUM' },
  { value: 'average', label: 'AVERAGE' },
  { value: 'avg', label: 'AVG' },
  { value: 'min', label: 'MIN' },
  { value: 'max', label: 'MAX' },
  { value: 'count', label: 'COUNT' },
  { value: 'count_distinct', label: 'COUNT DISTINCT' },
  { value: 'ratio', label: 'RATIO' },
  { value: 'rate', label: 'RATE' },
  { value: 'derived', label: 'DERIVED' },
]

const GRAIN_OPTIONS = [
  { value: 'transaction', label: 'Transaction' },
  { value: 'hour', label: 'Hour' },
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
]

const STATUS_OPTIONS = [
  { value: 'suggested', label: 'Suggested' },
  { value: 'draft', label: 'Draft' },
  { value: 'certified', label: 'Certified' },
]

// --- Fallback dummy data ---

const DUMMY_METRICS: MetricItem[] = [
  {
    metric_id: 'manufacturing__output_tmt',
    metric_name: 'Actual Output (TMT)',
    type: 'sum',
    sql: "{{ ref('fact_production_daily') }}.output_tmt",
    grain: 'day',
    dimensions: ['plant_name', 'product_name', 'fiscal_year'],
    tables: ['fact_production_daily'],
    status: 'suggested',
    confidence: 0.9,
    description: 'Total production output in thousand metric tons',
    connection_id: '',
    database: '',
    schema: '',
  },
  {
    metric_id: 'manufacturing__avg_efficiency',
    metric_name: 'Avg Efficiency %',
    type: 'avg',
    sql: "{{ ref('fact_production_daily') }}.efficiency_pct",
    grain: 'day',
    dimensions: ['plant_name', 'product_name'],
    tables: ['fact_production_daily'],
    status: 'draft',
    confidence: 0.82,
    description: 'Average production efficiency percentage',
    connection_id: '',
    database: '',
    schema: '',
  },
  {
    metric_id: 'manufacturing__output_ytd',
    metric_name: 'Output YTD',
    type: 'sum',
    sql: "{{ ref('fact_production_daily') }}.output_ytd",
    grain: 'year',
    dimensions: ['plant_name', 'product_name'],
    tables: ['fact_production_daily'],
    status: 'certified',
    confidence: 0.85,
    description: 'Year-to-date cumulative output',
    connection_id: '',
    database: '',
    schema: '',
  },
  {
    metric_id: 'manufacturing__downtime_hrs',
    metric_name: 'Downtime Hours',
    type: 'sum',
    sql: "{{ ref('fact_production_daily') }}.downtime_hours",
    grain: 'day',
    dimensions: ['plant_name', 'line_id'],
    tables: ['fact_production_daily'],
    status: 'suggested',
    confidence: 0.78,
    description: 'Total downtime in hours',
    connection_id: '',
    database: '',
    schema: '',
  },
]

// --- Status badge ---

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    suggested: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: <Sparkles className="h-2.5 w-2.5" /> },
    draft: { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-600', icon: <Pencil className="h-2.5 w-2.5" /> },
    certified: { bg: 'bg-green-50 border-green-200', text: 'text-green-700', icon: <Award className="h-2.5 w-2.5" /> },
  }
  const c = config[status] ?? config.draft
  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border', c.bg, c.text)}>
      {c.icon}
      {status}
    </span>
  )
}

// --- Confidence bar ---

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  return (
    <div className="flex items-center gap-1">
      <div className="w-10 h-1 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full', pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-400')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground w-6">{pct}%</span>
    </div>
  )
}

// --- Metric card ---

interface MetricCardProps {
  metric: MetricItem
  isSelected: boolean
  onSelect: () => void
  onCertify: () => void
  onDelete: () => void
}

function MetricCard({ metric, isSelected, onSelect, onCertify, onDelete }: MetricCardProps) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        'group relative p-2 rounded-lg border cursor-pointer transition-all',
        isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/40 hover:bg-muted/30'
      )}
    >
      <div className="flex items-start gap-2">
        <div className={cn(
          'w-7 h-7 rounded-md flex items-center justify-center shrink-0',
          isSelected ? 'bg-primary/20' : 'bg-muted'
        )}>
          <BarChart3 className={cn('h-3.5 w-3.5', isSelected ? 'text-primary' : 'text-muted-foreground')} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-xs truncate">{metric.metric_name}</span>
            <StatusBadge status={metric.status} />
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-0.5">
              <FileCode2 className="h-2.5 w-2.5" />
              {metric.type}
            </span>
            <span className="flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />
              {metric.grain}
            </span>
            <span className="flex items-center gap-0.5">
              <Tag className="h-2.5 w-2.5" />
              {metric.dimensions.length}
            </span>
          </div>
          {metric.confidence !== undefined && (
            <div className="mt-1">
              <ConfidenceBar value={metric.confidence} />
            </div>
          )}
        </div>
      </div>

      {/* Quick actions on hover */}
      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
        {metric.status === 'certified' ? (
          <Award className="h-3.5 w-3.5 text-green-600 fill-green-600/20" />
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onCertify(); }}
            className="p-1 rounded hover:bg-green-100 text-slate-400 hover:text-green-600 transition-colors"
            title="Certify"
          >
            <Award className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1 rounded hover:bg-red-100 text-red-500"
          title="Delete"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

// --- Edit form ---

interface EditFormProps {
  metric: MetricItem
  onSave: (updates: Partial<MetricItem>) => void
  onCancel: () => void
  isSaving: boolean
}

function EditForm({ metric, onSave, onCancel, isSaving }: EditFormProps) {
  const [form, setForm] = useState({
    metric_name: metric.metric_name,
    description: metric.description ?? '',
    type: metric.type,
    sql: metric.sql,
    grain: metric.grain,
    status: metric.status,
  })

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase">Name</label>
          <Input
            value={form.metric_name}
            onChange={(e) => setForm({ ...form, metric_name: e.target.value })}
            className="h-7 text-xs"
          />
        </div>
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase">Status</label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as MetricItem['status'] })}>
            <SelectTrigger className="h-7 text-xs">
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
        </div>
      </div>

      <div>
        <label className="text-[10px] font-medium text-muted-foreground uppercase">Description</label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={2}
          className="text-xs min-h-[unset] resize-none"
          placeholder="Describe this metric..."
        />
      </div>

      <div>
        <label className="text-[10px] font-medium text-muted-foreground uppercase">SQL Expression</label>
        <Input
          value={form.sql}
          onChange={(e) => setForm({ ...form, sql: e.target.value })}
          className="h-7 text-xs font-mono"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase flex items-center gap-1">
            <Calculator className="h-2.5 w-2.5" />
            Metric Type
          </label>
          <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {ALLOWED_METRIC_TYPES.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            Grain
          </label>
          <Select value={form.grain} onValueChange={(v) => setForm({ ...form, grain: v })}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {GRAIN_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-1.5 pt-1">
        <Button
          size="sm"
          className="h-6 px-2 text-[10px]"
          onClick={() => onSave(form)}
          disabled={isSaving}
        >
          {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
          Save
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px]"
          onClick={onCancel}
          disabled={isSaving}
        >
          <X className="h-3 w-3 mr-1" />
          Cancel
        </Button>
      </div>
    </div>
  )
}

// --- Create Metric Dialog ---

function CreateMetricDialog({
  open,
  onOpenChange,
  onCreate,
  isSaving,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (metric: {
    metric_name: string
    type: string
    sql: string
    grain: string
    dimensions: string[]
    description: string
    status: string
  }) => void
  isSaving: boolean
}) {
  const [form, setForm] = useState({
    metric_name: '',
    type: 'sum',
    sql: '',
    grain: 'day',
    dimensions: '',
    description: '',
    status: 'draft' as MetricItem['status'],
  })

  const resetForm = () =>
    setForm({ metric_name: '', type: 'sum', sql: '', grain: 'day', dimensions: '', description: '', status: 'draft' })

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Create Metric
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase">Name</label>
              <Input
                value={form.metric_name}
                onChange={(e) => setForm({ ...form, metric_name: e.target.value })}
                className="h-7 text-xs"
                placeholder="e.g. total_output_tmt"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase">Status</label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as MetricItem['status'] })}>
                <SelectTrigger className="h-7 text-xs">
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
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase flex items-center gap-1">
                <Calculator className="h-2.5 w-2.5" />
                Metric Type
              </label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {ALLOWED_METRIC_TYPES.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" />
                Grain
              </label>
              <Select value={form.grain} onValueChange={(v) => setForm({ ...form, grain: v })}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {GRAIN_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase">SQL Expression</label>
            <Input
              value={form.sql}
              onChange={(e) => setForm({ ...form, sql: e.target.value })}
              className="h-7 text-xs font-mono"
              placeholder="e.g. {{ ref('fact_table') }}.column"
            />
          </div>

          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase">Dimensions (comma-separated)</label>
            <Input
              value={form.dimensions}
              onChange={(e) => setForm({ ...form, dimensions: e.target.value })}
              className="h-7 text-xs font-mono"
              placeholder="e.g. plant_id, product_id"
            />
          </div>

          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase">Description</label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="text-xs min-h-[unset] resize-none"
              placeholder="Describe this metric..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={!form.metric_name.trim() || isSaving}
            onClick={() => {
              onCreate({
                metric_name: form.metric_name.trim(),
                type: form.type,
                sql: form.sql.trim(),
                grain: form.grain,
                dimensions: form.dimensions
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
                description: form.description.trim(),
                status: form.status,
              })
              resetForm()
            }}
          >
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- Main Component ---

export default function Metrics({ onNext }: { onNext?: () => void }) {
  const {
    sourceRows,
    tenantId,
    metrics,
    metricsLoaded,
    setMetrics,
    addMetric,
    updateMetric,
    removeMetric,
    pendingJobs,
    addPendingJob,
    isConfigView,
  } = useSemanticsStore()

  const [domainId, setDomainId] = useState('')
  const [isLoading, setIsLoading] = useState(!metricsLoaded)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(
    metricsLoaded && metrics.length > 0 ? metrics[0].metric_id : null
  )
  const [isEditing, setIsEditing] = useState(false)
  const [showCreateMetric, setShowCreateMetric] = useState(false)
  const [certifyDialog, setCertifyDialog] = useState<{ metric: MetricItem } | null>(null)
  const [isCertifying, setIsCertifying] = useState(false)
  const isFetchingRef = useRef(false)

  const selectedMetric = metrics.find((m) => m.metric_id === selectedId)

  // Fetch tenant domain on mount
  useEffect(() => {
    const loadDomain = async () => {
      try {
        const domainRes = await fetchTenantDomain(tenantId)
        if (domainRes?.domain_id) {
          setDomainId(domainRes.domain_id)
        }
      } catch (error) {
        // Domain not set yet - that's OK
      }
    }
    loadDomain()
  }, [tenantId])

  // --- API fetch ---

  const fetchMetrics = useCallback(async () => {
    if (metricsLoaded) {
      setIsLoading(false)
      if (!selectedId && metrics.length > 0) {
        setSelectedId(metrics[0].metric_id)
      }
      return
    }
    if (isFetchingRef.current) return
    isFetchingRef.current = true

    setIsLoading(true)
    try {
      const allMetrics: MetricItem[] = []
      let asyncJobStarted = false

      // In config view, use GET /metrics directly
      if (isConfigView) {
        try {
          const data = await fetchMetricsApi(tenantId)

          if (data?.metrics && Array.isArray(data.metrics) && data.metrics.length > 0) {
            for (const m of data.metrics) {
              allMetrics.push({
                metric_id: m.metric_id ?? '',
                metric_name: m.metric_name ?? '',
                type: m.type ?? 'sum',
                sql: m.sql ?? '',
                grain: m.grain ?? 'day',
                dimensions: (m.dimensions ?? []) as string[],
                tables: (m.tables ?? []) as string[],
                status: (m.status ?? 'suggested') as MetricItem['status'],
                confidence: m.confidence,
                description: m.description,
                connection_id: m.connection_id ?? '',
                database: m.database ?? '',
                schema: m.schema ?? '',
              })
            }

            setMetrics(allMetrics)
            setSelectedId(allMetrics[0].metric_id)
          } else {
            setMetrics(DUMMY_METRICS)
            setSelectedId(DUMMY_METRICS[0].metric_id)
            toast.info('No metrics returned. Showing sample data.')
          }
          setIsLoading(false)
          isFetchingRef.current = false
          return
        } catch (err) {
          console.error('Failed to fetch metrics:', err)
          setMetrics(DUMMY_METRICS)
          setSelectedId(DUMMY_METRICS[0].metric_id)
          toast.error(getDisplayErrorMessage(err, 'Failed to fetch metrics. Showing sample data.'))
          setIsLoading(false)
          isFetchingRef.current = false
          return
        }
      }

      // Normal wizard flow: POST to suggest metrics
      await Promise.all(
        sourceRows.map(async (row) => {
          if (!row.connectionId || !row.database || !row.schema) return

          try {
            const suggestRes = await apiV2.post('/metrics/suggested/async?persist=true', {
              tenant_id: tenantId,
            })

            // 202 = async job accepted — wait for onComplete to call GET /metrics
            if (suggestRes.status === 202 && suggestRes.data?.job_id) {
              addPendingJob('metrics', suggestRes.data.job_id, 'suggested_metrics')
              asyncJobStarted = true
              return
            }
          } catch (suggestErr) {
            console.warn('Metrics suggestion call failed (non-blocking):', suggestErr)
          }

          // Only call GET /metrics if no async job was started (i.e. 200 response)
          if (!asyncJobStarted) {
            const data = await fetchMetricsApi(tenantId)

            if (data?.metrics && Array.isArray(data.metrics)) {
              for (const m of data.metrics) {
                allMetrics.push({
                  metric_id: m.metric_id ?? '',
                  metric_name: m.metric_name ?? '',
                  type: m.type ?? 'sum',
                  sql: m.sql ?? '',
                  grain: m.grain ?? 'day',
                  dimensions: (m.dimensions ?? []) as string[],
                  tables: (m.tables ?? []) as string[],
                  status: (m.status ?? 'suggested') as MetricItem['status'],
                  confidence: m.confidence,
                  description: m.description,
                  connection_id: row.connectionId,
                  database: row.database,
                  schema: row.schema,
                })
              }
            }
          }
        })
      )

      // If async job was started, don't set data yet — GET /metrics will be called on job completion
      if (asyncJobStarted) {
        setIsLoading(false)
        isFetchingRef.current = false
        return
      }

      if (allMetrics.length > 0) {
        setMetrics(allMetrics)
        setSelectedId(allMetrics[0].metric_id)
      } else {
        setMetrics(DUMMY_METRICS)
        setSelectedId(DUMMY_METRICS[0].metric_id)
        toast.info('No metrics returned. Showing sample data.')
      }
    } catch (err) {
      console.error('Failed to fetch metrics:', err)
      setMetrics(DUMMY_METRICS)
      setSelectedId(DUMMY_METRICS[0].metric_id)
      toast.error(getDisplayErrorMessage(err, 'Failed to fetch metrics. Showing sample data.'))
    } finally {
      setIsLoading(false)
      isFetchingRef.current = false
    }
  }, [sourceRows, tenantId, metricsLoaded, setMetrics, isConfigView])

  useEffect(() => {
    fetchMetrics()
  }, [fetchMetrics])

  // Fetch metrics from GET /metrics after async job completes (called once)
  const fetchMetricsData = useCallback(async () => {
    try {
      const data = await fetchMetricsApi(tenantId)

      if (data?.metrics && Array.isArray(data.metrics) && data.metrics.length > 0) {
        const allMetrics: MetricItem[] = data.metrics.map((m: any) => ({
          metric_id: m.metric_id ?? '',
          metric_name: m.metric_name ?? '',
          type: m.type ?? 'sum',
          sql: m.sql ?? '',
          grain: m.grain ?? 'day',
          dimensions: (m.dimensions ?? []) as string[],
          tables: (m.tables ?? []) as string[],
          status: (m.status ?? 'suggested') as MetricItem['status'],
          confidence: m.confidence,
          description: m.description,
          connection_id: m.connection_id ?? '',
          database: m.database ?? '',
          schema: m.schema ?? '',
        }))

        setMetrics(allMetrics)
        setSelectedId(allMetrics[0].metric_id)
      } else {
        setMetrics(DUMMY_METRICS)
        setSelectedId(DUMMY_METRICS[0].metric_id)
        toast.info('No metrics returned. Showing sample data.')
      }
    } catch (err) {
      console.error('Failed to fetch metrics data:', err)
      setMetrics(DUMMY_METRICS)
      setSelectedId(DUMMY_METRICS[0].metric_id)
      toast.error(getDisplayErrorMessage(err, 'Failed to load metrics. Showing sample data.'))
    } finally {
      setIsLoading(false)
    }
  }, [tenantId, setMetrics])

  // --- Handlers ---

  const handleSave = async (updates: Partial<MetricItem>) => {
    if (!selectedMetric) return

    setIsSaving(true)
    try {
      const params = new URLSearchParams({ tenant_id: tenantId })
      await apiV2.patch(`/metrics/${selectedMetric.metric_id}?${params.toString()}`, updates)

      updateMetric(selectedMetric.metric_id, updates)
      setIsEditing(false)
      toast.success('Metric updated')
    } catch (err) {
      console.error('Failed to update metric:', err)
      toast.error(getDisplayErrorMessage(err, 'Failed to update metric'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleInlineUpdate = async (metricId: string, updates: Partial<MetricItem>) => {
    setIsSaving(true)
    try {
      const params = new URLSearchParams({ tenant_id: tenantId })
      await apiV2.patch(`/metrics/${metricId}?${params.toString()}`, updates)

      updateMetric(metricId, updates)
      toast.success('Metric updated')
    } catch (err) {
      console.error('Failed to update metric:', err)
      toast.error(getDisplayErrorMessage(err, 'Failed to update metric'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleCertify = (metric: MetricItem) => {
    setCertifyDialog({ metric })
  }

  const confirmCertify = async () => {
    if (!certifyDialog) return

    setIsCertifying(true)
    try {
      await certifyMetric(tenantId, certifyDialog.metric.metric_id)

      updateMetric(certifyDialog.metric.metric_id, { status: 'certified' })
      toast.success('Metric certified successfully')
      setCertifyDialog(null)
    } catch (err) {
      console.error('Failed to certify metric:', err)
      toast.error(getDisplayErrorMessage(err, 'Failed to certify metric'))
    } finally {
      setIsCertifying(false)
    }
  }

  const handleDelete = async (metric: MetricItem) => {
    try {
      const params = new URLSearchParams({ tenant_id: tenantId })
      await apiV2.delete(`/metrics/${metric.metric_id}?${params.toString()}`)

      removeMetric(metric.metric_id)
      if (selectedId === metric.metric_id) {
        const remaining = metrics.filter((m) => m.metric_id !== metric.metric_id)
        setSelectedId(remaining[0]?.metric_id ?? null)
      }
      toast.success('Metric removed')
    } catch (err) {
      console.error('Failed to delete metric:', err)
      toast.error(getDisplayErrorMessage(err, 'Failed to delete metric'))
    }
  }

  const handleCreateMetric = async (payload: {
    metric_name: string
    type: string
    sql: string
    grain: string
    dimensions: string[]
    description: string
    status: string
  }) => {
    setIsSaving(true)
    try {
      const res = await apiV2.post('/metrics', {
        tenant_id: tenantId,
        domain_id: domainId,
        ...payload,
      })

      const created = res.data
      const newMetric: MetricItem = {
        metric_id: created?.metric_id ?? `metric_${Date.now()}`,
        metric_name: payload.metric_name,
        type: payload.type,
        sql: payload.sql,
        grain: payload.grain,
        dimensions: payload.dimensions,
        tables: [],
        status: payload.status as MetricItem['status'],
        confidence: 1.0,
        description: payload.description,
        connection_id: '',
        database: '',
        schema: '',
      }
      addMetric(newMetric)
      setSelectedId(newMetric.metric_id)
      setShowCreateMetric(false)
      toast.success('Metric created')
    } catch (err) {
      console.error('Failed to create metric:', err)
      toast.error(getDisplayErrorMessage(err, 'Failed to create metric'))
    } finally {
      setIsSaving(false)
    }
  }

  // --- Stats ---
  const stats = {
    total: metrics.length,
    certified: metrics.filter((m) => m.status === 'certified').length,
    suggested: metrics.filter((m) => m.status === 'suggested').length,
  }

  // --- Render ---

  if (isLoading) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-12 gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Loading metrics...</p>
      </div>
    )
  }

  return (
    <div className="w-full px-3 pb-3">
      {/* Header */}
      <div className="pt-2 pb-1.5 text-center">
        <h1 className="text-[16px] font-bold">Suggested Metrics</h1>
        <p className="text-[11px] text-muted-foreground">Review and certify AI-suggested metrics for your semantic layer</p>
      </div>

      {/* Show processing banner for pending async jobs */}
      {pendingJobs.some((j) => j.stepName === 'metrics') && (
        <div className="mb-2">
          {pendingJobs
            .filter((j) => j.stepName === 'metrics')
            .map((j) => (
              <JobProcessingBanner
                key={j.jobId}
                jobId={j.jobId}
                jobType={j.jobType}
                label="Metrics Suggestion"
                onComplete={() => fetchMetricsData()}
              />
            ))}
        </div>
      )}

      {/* Stats bar */}
      <div className="flex items-center justify-center gap-3 mb-2">
        <div className="flex items-center gap-1 text-[10px]">
          <div className="w-4 h-4 rounded bg-primary/10 flex items-center justify-center">
            <BarChart3 className="h-2.5 w-2.5 text-primary" />
          </div>
          <span className="font-medium">{stats.total}</span>
          <span className="text-muted-foreground">Total</span>
        </div>
        <div className="w-px h-3 bg-border" />
        <div className="flex items-center gap-1 text-[10px]">
          <div className="w-4 h-4 rounded bg-green-100 flex items-center justify-center">
            <Award className="h-2.5 w-2.5 text-green-600" />
          </div>
          <span className="font-medium">{stats.certified}</span>
          <span className="text-muted-foreground">Certified</span>
        </div>
        <div className="w-px h-3 bg-border" />
        <div className="flex items-center gap-1 text-[10px]">
          <div className="w-4 h-4 rounded bg-amber-100 flex items-center justify-center">
            <Sparkles className="h-2.5 w-2.5 text-amber-600" />
          </div>
          <span className="font-medium">{stats.suggested}</span>
          <span className="text-muted-foreground">Suggested</span>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-2">
        {/* Metrics list */}
        <div className="lg:col-span-2 rounded-lg border bg-card p-2">
          <div className="flex items-center justify-between mb-1.5">
            <h2 className="text-xs font-semibold">Available Metrics</h2>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[10px]"
              onClick={() => setShowCreateMetric(true)}
            >
              <Plus className="h-2.5 w-2.5 mr-0.5" />
              Add
            </Button>
          </div>
          <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
            {metrics.map((metric) => (
              <MetricCard
                key={metric.metric_id}
                metric={metric}
                isSelected={selectedId === metric.metric_id}
                onSelect={() => { setSelectedId(metric.metric_id); setIsEditing(false); }}
                onCertify={() => handleCertify(metric)}
                onDelete={() => handleDelete(metric)}
              />
            ))}
          </div>
        </div>

        {/* Details panel */}
        <div className="lg:col-span-3 rounded-lg border bg-card p-2">
          <div className="flex items-center justify-between mb-1.5">
            <h2 className="text-xs font-semibold">Metric Details</h2>
            {selectedMetric && !isEditing && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px]"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="h-2.5 w-2.5 mr-1" />
                Edit
              </Button>
            )}
          </div>

          {selectedMetric ? (
            isEditing ? (
              <EditForm
                metric={selectedMetric}
                onSave={handleSave}
                onCancel={() => setIsEditing(false)}
                isSaving={isSaving}
              />
            ) : (
              <div className="space-y-2">
                {/* Header */}
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <BarChart3 className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-sm">{selectedMetric.metric_name}</span>
                      <StatusBadge status={selectedMetric.status} />
                    </div>
                    {selectedMetric.description && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">{selectedMetric.description}</p>
                    )}
                  </div>
                </div>

                {/* SQL */}
                <div className="bg-slate-50 dark:bg-slate-900 rounded-md p-2">
                  <div className="text-[10px] font-medium text-muted-foreground uppercase mb-0.5">SQL Expression</div>
                  <code className="text-[11px] font-mono text-foreground break-all">{selectedMetric.sql}</code>
                </div>

                {/* Grid info with inline dropdowns for type & grain */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-muted/30 rounded-md p-1.5">
                    <div className="text-[10px] font-medium text-muted-foreground uppercase mb-0.5 flex items-center gap-0.5">
                      <Calculator className="h-2.5 w-2.5" />
                      Type
                    </div>
                    <Select
                      value={selectedMetric.type}
                      onValueChange={(v) => handleInlineUpdate(selectedMetric.metric_id, { type: v })}
                    >
                      <SelectTrigger className="h-6 w-full text-[11px] px-1.5 py-0 border-dashed font-medium uppercase">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {ALLOWED_METRIC_TYPES.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="bg-muted/30 rounded-md p-1.5">
                    <div className="text-[10px] font-medium text-muted-foreground uppercase mb-0.5 flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      Grain
                    </div>
                    <Select
                      value={selectedMetric.grain}
                      onValueChange={(v) => handleInlineUpdate(selectedMetric.metric_id, { grain: v })}
                    >
                      <SelectTrigger className="h-6 w-full text-[11px] px-1.5 py-0 border-dashed font-medium capitalize">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {GRAIN_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="bg-muted/30 rounded-md p-1.5">
                    <div className="text-[10px] font-medium text-muted-foreground uppercase">Confidence</div>
                    <div className="text-xs font-medium mt-1">
                      {selectedMetric.confidence ? `${Math.round(selectedMetric.confidence * 100)}%` : '\u2014'}
                    </div>
                  </div>
                </div>

                {/* Dimensions */}
                <div>
                  <div className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Dimensions</div>
                  <div className="flex flex-wrap gap-1">
                    {selectedMetric.dimensions.map((d) => (
                      <span key={d} className="px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 font-medium">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Tables */}
                <div>
                  <div className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Source Tables</div>
                  <div className="flex flex-wrap gap-1">
                    {selectedMetric.tables.map((t) => (
                      <span key={t} className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground font-mono">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                {selectedMetric.status !== 'certified' && (
                  <div className="pt-1">
                    <Button
                      size="sm"
                      className="h-7 px-3 text-xs bg-green-600 hover:bg-green-700"
                      onClick={() => handleCertify(selectedMetric)}
                      disabled={isSaving}
                    >
                      {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Award className="h-3 w-3 mr-1" />}
                      Certify Metric
                    </Button>
                  </div>
                )}
              </div>
            )
          ) : (
            <div className="text-center py-8 text-xs text-muted-foreground">
              Select a metric to view details
            </div>
          )}
        </div>
      </div>

      {/* Proceed button */}
      <div className="mt-3 flex justify-center">
        <Button onClick={() => onNext && onNext()} className="px-2 gap-1.5 text-xs !h-8">
          Proceed to Readiness
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Certification Confirmation Dialog */}
      <AlertDialog
        open={!!certifyDialog}
        onOpenChange={(open) => !open && setCertifyDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Award className="size-5 text-primary" />
              Certify Metric
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to certify{' '}
              <span className="font-semibold text-foreground">
                {certifyDialog?.metric.metric_name}
              </span>
              ?
              <br />
              <br />
              This will mark it as approved and ready for use in analytics.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCertifying}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCertify}
              disabled={isCertifying}
              className="bg-primary hover:bg-primary/90"
            >
              {isCertifying ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Certifying...
                </>
              ) : (
                <>
                  <Award className="size-4 mr-2" />
                  Certify
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Metric Dialog */}
      <CreateMetricDialog
        open={showCreateMetric}
        onOpenChange={setShowCreateMetric}
        onCreate={handleCreateMetric}
        isSaving={isSaving}
      />
    </div>
  )
}
