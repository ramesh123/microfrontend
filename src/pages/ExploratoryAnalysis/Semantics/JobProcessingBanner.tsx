import { useEffect, useRef, useState } from 'react'
import { Loader2, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router'
import { apiV2 } from '@/controllers/API/api'
import { cn } from '@/lib/utils'

interface JobProcessingBannerProps {
  jobId: string
  jobType: string
  label?: string
  className?: string
  onComplete?: () => void
}

const JOB_TYPE_LABELS: Record<string, string> = {
  scan_connection: 'Schema Scan',
  map: 'Entity Mapping',
  infer_models: 'Dims & Facts Inference',
  suggested_metrics: 'Metrics Suggestion',
}

export default function JobProcessingBanner({
  jobId,
  jobType,
  label,
  className,
  onComplete,
}: JobProcessingBannerProps) {
  const navigate = useNavigate()
  const [status, setStatus] = useState<string>('queued')
  const [progressPct, setProgressPct] = useState<number>(0)
  const [progressStage, setProgressStage] = useState<string>('')

  // Stable ref for onComplete to avoid re-triggering the poll effect
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    if (!jobId) return

    let cancelled = false
    let completed = false

    const poll = async () => {
      try {
        const res = await apiV2.get(`/jobs/${jobId}`)
        if (cancelled) return
        const d = res.data
        setStatus(d.status ?? 'running')
        setProgressPct(d.progress_pct ?? 0)
        setProgressStage(d.progress_stage ?? '')

        if (d.status === 'completed') {
          if (!completed) {
            completed = true
            onCompleteRef.current?.()
          }
          return
        }
        if (d.status === 'failed' || d.status === 'canceled') return
      } catch {
        // Silently ignore polling errors
      }

      if (!cancelled) {
        setTimeout(poll, 4000)
      }
    }

    poll()
    return () => {
      cancelled = true
    }
  }, [jobId])

  const displayLabel = label || JOB_TYPE_LABELS[jobType] || jobType

  const isTerminal = status === 'completed' || status === 'failed' || status === 'canceled'

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-md border px-3 py-2',
        status === 'failed'
          ? 'border-red-500/20 bg-red-500/5'
          : status === 'completed'
            ? 'border-emerald-500/20 bg-emerald-500/5'
            : 'border-blue-500/20 bg-blue-500/5',
        className,
      )}
    >
      {!isTerminal && <Loader2 className="size-3.5 animate-spin text-blue-600 shrink-0" />}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-foreground truncate">
            {displayLabel}
          </span>
          <span
            className={cn(
              'text-[11px] font-medium px-1.5 py-0 rounded-sm border',
              status === 'running'
                ? 'bg-blue-500/10 text-blue-700 border-blue-500/20'
                : status === 'completed'
                  ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
                  : status === 'failed'
                    ? 'bg-red-500/10 text-red-700 border-red-500/20'
                    : 'bg-orange-500/10 text-orange-700 border-orange-500/20',
            )}
          >
            {status}
          </span>
        </div>

        {!isTerminal && (
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-500"
                style={{ width: `${Math.max(progressPct, 2)}%` }}
              />
            </div>
            <span className="text-[11px] text-muted-foreground tabular-nums font-mono shrink-0">
              {progressPct}%
            </span>
          </div>
        )}

        {progressStage && !isTerminal && (
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {progressStage}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => navigate('/exploratory-analysis/jobs')}
        className="flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80
                   transition-colors shrink-0"
      >
        View Jobs
        <ExternalLink className="size-3" />
      </button>
    </div>
  )
}
