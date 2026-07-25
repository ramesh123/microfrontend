import React, { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { fetchFlowRunLogs, PrefectLog } from './prefectapi'
import { getDisplayErrorMessage } from '@/utils/exceptionHelper'

type Props = {
  flowRunId?: string
  levelFilter?: string
  sortOrder?: 'newest' | 'oldest'
}

function LevelBadge({ level }: { level: number }) {
  if (level >= 40) return <span className="px-2 py-0.5 rounded-full text-xs bg-red-500 text-white">ERROR</span>
  if (level >= 30) return <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500 text-white">WARNING</span>
  if (level >= 20) return <span className="px-2 py-0.5 rounded-full text-xs bg-sky-600 text-white">INFO</span>
  return <span className="px-2 py-0.5 rounded-full text-xs bg-gray-600 text-white">DEBUG</span>
}

function labelForLevel(level: number) {
  if (level >= 40) return 'ERROR'
  if (level >= 30) return 'WARNING'
  if (level >= 20) return 'INFO'
  return 'DEBUG'
}

export default function Logs({ flowRunId, levelFilter = 'All', sortOrder = 'newest' }: Props) {
  const [logs, setLogs] = useState<PrefectLog[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!flowRunId) return
    let canceled = false
    setLoading(true)
    setError(null)

    // Determine numeric ge_ value from levelFilter
    const LOG_LEVELS: { label: string; value: number }[] = [
      { label: 'All', value: 0 },
      { label: 'Critical only', value: 50 },
      { label: 'Error and above', value: 40 },
      { label: 'Warning and above', value: 30 },
      { label: 'Info and above', value: 20 },
      { label: 'Debug and above', value: 10 },
    ]

    const levelObj = LOG_LEVELS.find((l) => l.label === levelFilter) || LOG_LEVELS[0]
    const geValue = levelObj.value

    const sortParam = sortOrder === 'newest' ? 'TIMESTAMP_DESC' : 'TIMESTAMP_ASC'

    fetchFlowRunLogs(flowRunId, 200, 0, geValue, sortParam)
      .then((res) => {
        if (canceled) return
        setLogs(res)
      })
      .catch((err) => {
        if (canceled) return
        setError(getDisplayErrorMessage(err, 'Failed to load logs'))
      })
      .finally(() => {
        if (canceled) return
        setLoading(false)
      })

    return () => {
      canceled = true
    }
  }, [flowRunId, levelFilter, sortOrder])

  if (!flowRunId) return <div className="text-sm text-gray-500">No flow run selected.</div>

  if (loading) {
    return (
      <div className="flex min-h-[12rem] w-full flex-col items-center justify-center gap-2 py-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
        <span className="text-sm text-muted-foreground">Loading logs…</span>
      </div>
    )
  }

  // filter and sort logs according to UI controls
  const levelThreshold = (f?: string) => {
    switch (f) {
      case 'Critical only':
        return 50
      case 'Error and above':
        return 40
      case 'Warning and above':
        return 30
      case 'Info and above':
        return 20
      case 'Debug and above':
        return 10
      default:
        return null
    }
  }

  const parseToMs = (ts?: string | number) => {
    if (ts === undefined || ts === null) return 0
    if (typeof ts === 'number') return ts
    const s = ts.trim()
    const hasTimezone = s.endsWith('Z') || s.includes('+') || s.match(/[+-]\d{2}:\d{2}$/)
    let iso = s
    if (s.includes('T') && !hasTimezone) iso = iso + 'Z'
    const d = new Date(iso)
    return isNaN(d.getTime()) ? 0 : d.getTime()
  }

  const threshold = levelThreshold(levelFilter)
  let filteredLogs = threshold ? logs.filter((l) => l.level >= (threshold as number)) : [...logs]

  filteredLogs.sort((a, b) => parseToMs(a.timestamp) - parseToMs(b.timestamp))
  if (sortOrder === 'newest') filteredLogs.reverse()

  // compute widest level label among returned logs so messages align
  const maxLabelLen = filteredLogs.reduce((max, l) => {
    const len = labelForLevel(l.level).length
    return Math.max(max, len)
  }, 0) || 7
  const firstcaps = (s: string) => {
    if (!s) return s
    return s.charAt(0).toUpperCase() + s.slice(1)
  }
  return (
    <div className="w-full space-y-2">
          {error && <div className="text-sm text-red-500">{error}</div>}

          {logs.length === 0 && !error && (
            <div className="text-sm text-center text-gray-500">No logs found for this flow run.</div>
          )}

          {filteredLogs.map((l) => (
            <div key={l.id} className="flex items-start gap-0 px-2 py-0 rounded-md">
              <div className="flex-shrink-0" style={{ minWidth: `${maxLabelLen + 2}ch` }}>
                <LevelBadge level={l.level} />
              </div>

              <div className="flex-1">
                <div className="flex items-start justify-between gap-4">
                  <div className="font-normal text-sm whitespace-pre-wrap flex-1">{firstcaps(l.message)}</div>
                  <div className="flex-shrink-0 text-xs text-right">
                    <div className="text-gray-500">{timeAgo(l.timestamp?.toString())}</div>
                    <div className="font-medium text-gray-700">{l.name}</div>
                    {/* {l.task_run_id && <div className="text-xs text-gray-500">{l.task_run_id}</div>} */}
                  </div>
                </div>
              </div>
            </div>
          ))}
    </div>
  )
}

// Helper: format timestamp as relative time like "2mo 15d ago".
// Accepts ISO strings (with or without timezone) or numeric epoch values.
function timeAgo(dateString?: string): string {
  if (!dateString) return 'N/A'
  try {
    // Parse ISO-like strings; if timezone missing, treat as UTC
    let iso = dateString.trim()
    const hasTimezone = iso.endsWith('Z') || iso.includes('+') || iso.match(/[+-]\d{2}:\d{2}$/)
    if (iso.includes('T') && !hasTimezone) iso = iso + 'Z'
    const utcDate = new Date(iso)
    if (isNaN(utcDate.getTime())) return 'N/A'

    // Convert UTC to IST (UTC +5:30) for consistency with WorkflowExecution
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
    const istTimestamp = utcDate.getTime() + IST_OFFSET_MS
    const nowIST = Date.now() + IST_OFFSET_MS
    const diffMs = nowIST - istTimestamp
    if (diffMs < 0) return 'Just now'

    const minutes = Math.floor(diffMs / (1000 * 60))
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    const months = Math.floor(days / 30)
    const years = Math.floor(days / 365)

    if (years > 0) {
      const remMonths = months % 12
      return remMonths > 0 ? `${years}y ${remMonths}mo ago` : `${years}y ago`
    }
    if (months > 0) {
      const remDays = days % 30
      return remDays > 0 ? `${months}mo ${remDays}d ago` : `${months}mo ago`
    }
    if (days > 0) {
      const remHours = hours % 24
      return remHours > 0 ? `${days}d ${remHours}h ago` : `${days}d ago`
    }
    if (hours > 0) {
      const remMinutes = minutes % 60
      return remMinutes > 0 ? `${hours}h ${remMinutes}m ago` : `${hours}h ago`
    }
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
  } catch (e) {
    return 'N/A'
  }
}
