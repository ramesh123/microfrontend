import React, { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, Clock, Play, AlertCircle, Tag, Search, Loader2 } from 'lucide-react'

type TaskRun = any

interface Props {
  runs?: TaskRun[]
  flowRunId?: string
  className?: string
}

function formatTime(iso?: string) {
  if (!iso) return 'N/A'
  try {
    const d = new Date(iso)
    return d.toLocaleString()
  } catch {
    return iso
  }
}

function stateColor(stateType: string) {
  switch ((stateType || '').toUpperCase()) {
    case 'COMPLETED':
      return 'bg-green-50 text-green-800 border-green-200'
    case 'RUNNING':
    case 'SCHEDULED':
      return 'bg-blue-50 text-blue-800 border-blue-200'
    case 'FAILED':
    case 'CRITICAL':
      return 'bg-red-50 text-red-800 border-red-200'
    case 'PENDING':
      return 'bg-yellow-50 text-yellow-800 border-yellow-200'
    default:
      return 'bg-muted/10 text-muted-foreground border-muted-foreground/20'
  }
}

import { fetchFlowRunTaskRuns, PrefectTaskRun } from './prefectapi'
import { getDisplayErrorMessage } from '@/utils/exceptionHelper'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function TaskRuns({ runs = [], flowRunId, className = '' }: Props) {
  const [items, setItems] = useState<PrefectTaskRun[]>(Array.isArray(runs) ? runs : [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedStates, setSelectedStates] = useState<string[]>([])
  const [availableStates] = useState<string[]>([
    'LATE',
    'SCHEDULED',
    'RESUMING',
    'AWAITINGRETRY',
    'AWAITINGCONCURRENCYSLOT',
    'PENDING',
    'PAUSED',
    'SUSPENDED',
    'RUNNING',
    'RETRYING',
    'COMPLETED',
    'CACHED',
    'CANCELLED',
    'CANCELLING',
    'CRASHED',
    'FAILED',
    'TIMEDOUT',
  ])
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [tagFilter, setTagFilter] = useState('')
  const [sort, setSort] = useState('EXPECTED_START_TIME_DESC')
  const [taskRunsFilter, setTaskRunsFilter] = useState<any | undefined>(undefined)

  useEffect(() => {
    let mounted = true
    async function load() {
      if (!flowRunId) return
      setLoading(true)
      setError(null)
      try {
        const data = await fetchFlowRunTaskRuns(flowRunId, { limit: 200, offset: 0, sort, task_runs: taskRunsFilter })
        if (mounted) setItems(data)
      } catch (err: unknown) {
        if (mounted) setError(getDisplayErrorMessage(err, 'Failed to load task runs'))
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [flowRunId, sort, taskRunsFilter])

  // derive available tags from loaded items
  useEffect(() => {
    const tags = new Set<string>()
    items.forEach((it) => {
      (it.tags || []).forEach((t: string) => tags.add(t))
    })
    setAvailableTags(Array.from(tags).sort())
  }, [items])

  // apply client-side filters: search, states, tags
  const runsToRender = items.filter((r) => {
    // name filtering is handled server-side via taskRunsFilter.name.like_
    if (selectedStates.length > 0 && !selectedStates.includes((r.state_type || '').toUpperCase())) return false
    if (selectedTags.length > 0) {
      const rt = Array.isArray(r.tags) ? r.tags : []
      const has = selectedTags.every((t) => rt.includes(t))
      if (!has) return false
    }
    return true
  })

  // debounce search input and update server-side filter `name.like_` when typing stops
  useEffect(() => {
    const value = search.trim()
    const handle = setTimeout(() => {
      setTaskRunsFilter((prev: any) => {
        const copy = { ...(prev || {}) }
        if (value) {
          copy.name = { like_: value }
        } else {
          delete copy.name
        }
        return Object.keys(copy).length > 0 ? copy : undefined
      })
    }, 500)

    return () => clearTimeout(handle)
  }, [search])

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-end gap-3">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder={`Search by task name`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="!h-7 rounded-md w-64 pl-8 pr-8"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded p-0.5 text-white bg-destructive hover:text-white hover:bg-destructive"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <button className="!h-7 rounded-md border px-3 text-sm flex items-center gap- bg-transparent">
              {selectedStates.length === 0 ? 'All run states' : `${selectedStates.length} selected`}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-50 max-h-50 overflow-auto">
            <div className="space-y-1">
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedStates.length === availableStates.length}
                    onCheckedChange={(v) => {
                      if (v) {
                        // All run states: include subflow filter exists_: false
                        setSelectedStates([...availableStates])
                        setTaskRunsFilter({ subflow_runs: { exists_: false } })
                      } else {
                        setSelectedStates([])
                        // clear server-side filter
                        setTaskRunsFilter(undefined)
                      }
                    }}
                  />
                  <span className="text-sm">All run states</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedStates.length === availableStates.length - 1 && !selectedStates.includes('SCHEDULED')}
                    onCheckedChange={(v) => {
                      if (v) {
                        const sel = availableStates.filter((s) => s !== 'SCHEDULED')
                        setSelectedStates(sel)
                        // map to Title Case names for API
                        const mapTitle = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()
                        const apiStates = sel.map(mapTitle)
                        setTaskRunsFilter({ state: { name: { any_: apiStates } }, subflow_runs: { exists_: false } })
                      } else {
                        setSelectedStates([])
                        setTaskRunsFilter(undefined)
                      }
                    }}
                  />
                  <span className="text-sm">All except scheduled</span>
                </label>
              </div>

              <div className="pt-2 border-t -mx-4 px-4">
                <div className="flex flex-wrap gap-2">
                  {availableStates.map((st) => (
                    <label key={st} className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedStates.includes(st)}
                        onCheckedChange={(v) => {
                          if (v) setSelectedStates((s) => Array.from(new Set([...s, st])))
                          else setSelectedStates((s) => s.filter(x => x !== st))
                        }}
                      />
                      <Badge variant="outline" className="text-xs">
                        {st.charAt(0) + st.slice(1).toLowerCase()}
                      </Badge>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <button className="!h-7 rounded-md border px-3 text-sm flex items-center gap-2 bg-transparent">
              {selectedTags.length === 0 ? 'All tags' : `${selectedTags.length} selected`}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-60 max-h-64 overflow-auto">
            <div className="space-y-1">
              <Input
                placeholder="Search or create tag"
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === 'Tab') && tagFilter.trim()) {
                    e.preventDefault()
                    const t = tagFilter.trim()
                    if (!availableTags.includes(t)) setAvailableTags((a) => [t, ...a])
                    setSelectedTags((s) => {
                      const next = Array.from(new Set([t, ...s]))
                      // update server-side filter
                      setTaskRunsFilter((prev: any) => ({ ...(prev || {}), tags: { all_: next } }))
                      return next
                    })
                    setTagFilter('')
                  }
                }}
                className="w-full !h-7"
              />

              <div className="max-h-48 overflow-auto">
                {(availableTags.filter(t => t.toLowerCase().includes(tagFilter.toLowerCase()))).map((tg) => (
                  <label key={tg} className="flex items-center gap-2 py-1">
                    <Checkbox
                      checked={selectedTags.includes(tg)}
                      onCheckedChange={(v) => {
                        setSelectedTags((s) => {
                          let next: string[]
                          if (v) next = Array.from(new Set([...s, tg]))
                          else next = s.filter(x => x !== tg)
                          // update server-side filter
                          if (next.length > 0) {
                            setTaskRunsFilter((prev: any) => ({ ...(prev || {}), tags: { all_: next } }))
                          } else {
                            // remove tags key from filter
                            setTaskRunsFilter((prev: any) => {
                              if (!prev) return undefined
                              const copy = { ...prev }
                              delete copy.tags
                              // if copy empty, return undefined
                              return Object.keys(copy).length > 0 ? copy : undefined
                            })
                          }
                          return next
                        })
                      }}
                    />
                    <span className="text-sm">{tg}</span>
                  </label>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Select onValueChange={(v) => setSort(v)} defaultValue={sort}>
          <SelectTrigger className="!h-7 rounded-md w-43">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="EXPECTED_START_TIME_DESC">Newest to Oldest</SelectItem>
            <SelectItem value="EXPECTED_START_TIME_ASC">Oldest to Newest</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex min-h-[12rem] w-full flex-col items-center justify-center gap-2 py-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
          <span className="text-sm text-muted-foreground">Loading task runs…</span>
        </div>
      ) : (
        <>
      {error && <div className="text-sm text-red-600">{error}</div>}
      {runsToRender.map((r: TaskRun) => (
        <Card key={r.id} className="border p-2 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-md bg-card/60 flex items-center justify-center">
                {r.state_type === 'COMPLETED' ? (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                ) : r.state_type === 'FAILED' ? (
                  <AlertCircle className="h-6 w-6 text-red-600" />
                ) : (
                  <Play className="h-6 w-6 text-primary" />
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <h4 className="font-semibold text-sm truncate">{r.name}</h4>
                <div className={`text-xs px-2 py-0.5 rounded-md border ${stateColor(r.state_type)} ml-auto`}> {r.state_name || r.state_type} </div>
              </div>

              <div className="mt-2 text-xs text-muted-foreground grid grid-cols-3 gap-2">
                <div>
                  <div className="text-[11px]">Started</div>
                  <div className="font-medium">{formatTime(r.start_time)}</div>
                </div>
                <div>
                  <div className="text-[11px] ">Ended</div>
                  <div className="font-medium">{formatTime(r.end_time)}</div>
                </div>
                <div>
                  <div className="text-[11px]">Duration</div>
                  <div className="font-medium">{typeof r.total_run_time === 'number' ? `${r.total_run_time.toFixed(2)}s` : '—'}</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
                  {r.tags.map((t: string) => (
                    <span key={t} className="font-semibold text-sm truncate">
                      {t}
                    </span>
                  ))}
              <div className="text-xs text-muted-foreground">{formatTime(r.expected_start_time)}</div>
            </div>
          </div>
        </Card>
      ))}
        </>
      )}
    </div>
  )
}
