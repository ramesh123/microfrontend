import api from '@/controllers/API/api';
import { executeApiRequestSilent } from '@/utils/exceptionHelper';

export type PrefectLog = {
  id: string
  created: string
  updated: string
  name: string
  level: number
  message: string
  timestamp: string
  flow_run_id: string
  task_run_id?: string | null
}
// Simple in-memory dedupe + short TTL cache to avoid duplicate network
// requests (useful in dev StrictMode double-mount scenarios).
const inflightRequests = new Map<string, Promise<any>>()
const responseCache = new Map<string, { ts: number; data: any }>()
const CACHE_TTL = 5000 // ms

function makeKey(name: string, args: any) {
  try {
    return name + '|' + JSON.stringify(args)
  } catch (e) {
    return name + '|' + String(args)
  }
}

async function dedupeFetch<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const cached = responseCache.get(key)
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data as T

  const inflight = inflightRequests.get(key)
  if (inflight) return inflight as Promise<T>

  const p = fn()
    .then((data) => {
      responseCache.set(key, { ts: Date.now(), data })
      inflightRequests.delete(key)
      return data
    })
    .catch((err) => {
      inflightRequests.delete(key)
      throw err
    })

  inflightRequests.set(key, p)
  return p
}

export async function fetchFlowRunLogs(
  flowRunId: string,
  limit = 200,
  offset = 0,
  ge = 0,
  sort: 'TIMESTAMP_ASC' | 'TIMESTAMP_DESC' = 'TIMESTAMP_ASC'
): Promise<PrefectLog[]> {
  const payload = {
    logs: {
      level: { ge_: ge },
      flow_run_id: { any_: [flowRunId] },
    },
    sort,
    offset,
    limit,
  }

  const key = makeKey('fetchFlowRunLogs', { flowRunId, limit, offset, ge, sort })
  return dedupeFetch<PrefectLog[]>(key, async () => {
    try {
      console.debug('[prefectapi] fetchFlowRunLogs payload:', payload)
      const json = await executeApiRequestSilent(
        () => api.post('/flow-runs/logs-filter', payload),
        'Failed to fetch flow run logs',
      )
      let data: PrefectLog[] = []
      if (Array.isArray(json)) {
        data = json as PrefectLog[]
      } else if (json && Array.isArray((json as any).data)) {
        data = (json as any).data as PrefectLog[]
      } else if (json && Array.isArray((json as any).results)) {
        data = (json as any).results as PrefectLog[]
      } else if (json && Array.isArray((json as any).logs)) {
        data = (json as any).logs as PrefectLog[]
      } else {
        // If payload envelope present but empty, attempt to coerce possible single-object shape
        const possible = (json && typeof json === 'object') ? (json as any) : null
        if (possible && possible.data && !Array.isArray(possible.data) && typeof possible.data === 'object') {
          // try to extract numeric-indexed entries
          const vals = Object.values(possible.data).filter((v: any) => v && typeof v === 'object')
          if (vals.length && Array.isArray(vals[0])) {
            data = vals[0] as PrefectLog[]
          }
        }
      }
      console.debug('[prefectapi] fetchFlowRunLogs response length:', data.length)
      return data
    } catch (err: any) {
      console.error('[prefectapi] fetchFlowRunLogs error:', err)
      throw err
    }
  })
}

export type PrefectTaskRun = {
  id: string
  name: string
  state_type?: string
  state_name?: string
  start_time?: string | null
  end_time?: string | null
  expected_start_time?: string | null
  total_run_time?: number | null
  tags?: string[]
}

export type FetchTaskRunsOptions = {
  limit?: number
  offset?: number
  sort?: string
  task_runs?: any
}

export async function fetchFlowRunTaskRuns(
  flowRunId: string,
  options: FetchTaskRunsOptions = {}
): Promise<PrefectTaskRun[]> {
  const { limit = 200, offset = 0, sort = 'EXPECTED_START_TIME_DESC', task_runs } = options

  const payload: any = {
    flow_runs: {
      id: { any_: [flowRunId] }
    },
    sort,
    limit,
    offset,
  }

  if (task_runs) payload.task_runs = task_runs

  const key = makeKey('fetchFlowRunTaskRuns', { flowRunId, options })
  return dedupeFetch<PrefectTaskRun[]>(key, async () => {
    try {
      console.debug('[prefectapi] fetchFlowRunTaskRuns payload:', payload)
      const json = await executeApiRequestSilent(
        () => api.post('/flow-runs/task-runs-filter', payload),
        'Failed to fetch task runs',
      )
      let data: PrefectTaskRun[] = []
      if (Array.isArray(json)) {
        data = json as PrefectTaskRun[]
      } else if (json && Array.isArray((json as any).data)) {
        data = (json as any).data as PrefectTaskRun[]
      } else if (json && Array.isArray((json as any).results)) {
        data = (json as any).results as PrefectTaskRun[]
      } else if (json && Array.isArray((json as any).items)) {
        data = (json as any).items as PrefectTaskRun[]
      } else if (json && Array.isArray((json as any).task_runs)) {
        data = (json as any).task_runs as PrefectTaskRun[]
      } else {
        const possible = (json && typeof json === 'object') ? (json as any) : null
        if (possible && possible.data && !Array.isArray(possible.data) && typeof possible.data === 'object') {
          const vals = Object.values(possible.data).filter((v: any) => v && typeof v === 'object')
          if (vals.length && Array.isArray(vals[0])) {
            data = vals[0] as PrefectTaskRun[]
          }
        }
      }
      console.debug('[prefectapi] fetchFlowRunTaskRuns response length:', data.length)
      return data
    } catch (err: any) {
      console.error('[prefectapi] fetchFlowRunTaskRuns error:', err)
      throw err
    }
  })
}

export type PrefectFlowRun = any

export async function fetchFlowRunsFilterById(
  flowRunId: string,
  sort: string = 'EXPECTED_START_TIME_DESC',
  limit = 200,
  offset = 0
): Promise<PrefectFlowRun[]> {
  const payload = {
    flow_runs: {
      id: { any_: [flowRunId] }
    },
    sort,
    limit,
    offset,
  }
  const key = makeKey('fetchFlowRunsFilterById', { flowRunId, sort, limit, offset })
  return dedupeFetch<PrefectFlowRun[]>(key, async () => {
    try {
      console.debug('[prefectapi] fetchFlowRunsFilterById payload:', payload)
      const json = await executeApiRequestSilent(
        () => api.post('/flow-runs/filter', payload),
        'Failed to fetch flow runs',
      )
      let data: PrefectFlowRun[] = []
      if (Array.isArray(json)) {
        data = json as PrefectFlowRun[]
      } else if (json && Array.isArray((json as any).data)) {
        data = (json as any).data as PrefectFlowRun[]
      } else if (json && Array.isArray((json as any).results)) {
        data = (json as any).results as PrefectFlowRun[]
      } else if (json && Array.isArray((json as any).flow_runs)) {
        data = (json as any).flow_runs as PrefectFlowRun[]
      } else {
        // fallback to returning whatever parsed value was present
        data = Array.isArray(json) ? json : (json && json.data && Array.isArray(json.data) ? json.data : (json && json.results && Array.isArray(json.results) ? json.results : []))
      }
      console.debug('[prefectapi] fetchFlowRunsFilterById response length:', Array.isArray(data) ? data.length : 0)
      return data
    } catch (err: any) {
      console.error('[prefectapi] fetchFlowRunsFilterById error:', err)
      throw err
    }
  })
}

export async function fetchFlowRunDetails(flowRunId: string): Promise<any> {
  const payload = { flow_id: flowRunId }
  const key = makeKey('fetchFlowRunDetails', { flowRunId })
  return dedupeFetch<any>(key, async () => {
    try {
      console.debug('[prefectapi] fetchFlowRunDetails payload:', payload)
      const json = await executeApiRequestSilent(
        () => api.post('/flow-runs/flow-runs-details', payload),
        'Failed to fetch flow run details',
      )

      // If the API wraps the actual flow run under an envelope (e.g. { status_code, data, error }),
      // prefer returning the inner `data` object so callers keep the previous shape.
      let out: any = json
      if (json && typeof json === 'object') {
        if (json.data !== undefined) out = json.data
        else if (json.result !== undefined) out = json.result
        else if (json.flow_run !== undefined) out = json.flow_run
      }

      console.debug('[prefectapi] fetchFlowRunDetails response:', out)
      return out
    } catch (err: any) {
      console.error('[prefectapi] fetchFlowRunDetails error:', err)
      throw err
    }
  })
}
