import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Logs from './logs'
import TaskRuns from './taskruns'
import FlowRunDetails from './details'
import Parameters from './parameters'
import { fetchFlowRunDetails } from './prefectapi'
import { getDisplayErrorMessage } from '@/utils/exceptionHelper'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ArrowLeft,
  ScrollText,
  ListTree,
  Info,
  Braces,
  Inbox,
  AlertCircle,
  Copy,
  Check,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import type { LucideIcon } from 'lucide-react'

type TabKey = 'Logs' | 'Task Runs' | 'Details' | 'Parameters'

const TABS: TabKey[] = ['Logs', 'Task Runs', 'Details', 'Parameters']

const TAB_ICONS: Partial<Record<TabKey, LucideIcon>> = {
  Logs: ScrollText,
  'Task Runs': ListTree,
  Details: Info,
  Parameters: Braces,
}

function ParametersLoading() {
  return (
    <div className="flex min-h-[12rem] w-full flex-col items-center justify-center gap-2 py-6">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
      <span className="text-sm text-muted-foreground">Loading parameters…</span>
    </div>
  )
}

function FlowRunIdChip({ id }: { id: string }) {
  const [copied, setCopied] = useState(false)
  const short = id.length > 20 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id

  const copy = () => {
    void navigator.clipboard.writeText(id).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="flex min-w-0 max-w-full items-center gap-1">
      <code
        className="truncate rounded border bg-muted/50 px-1.5 py-0.5 font-mono text-xs text-foreground"
        title={id}
      >
        {short}
      </code>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
        onClick={copy}
        aria-label="Copy flow run id"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  )
}

export default function Prefectrun({ flowRunId }: { flowRunId?: string }) {
  const params = useParams()
  const routeFlowRunId = (params as { flowRunId?: string }).flowRunId
  const effectiveFlowRunId = flowRunId ?? routeFlowRunId
  const navigate = useNavigate()
  const [active, setActive] = useState<TabKey>('Logs')
  const [levelFilter, setLevelFilter] = useState<string>('All')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('oldest')
  const [detailsData, setDetailsData] = useState<Record<string, unknown> | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)

  const tabValue = TABS.includes(active) ? active : 'Logs'

  useEffect(() => {
    let mounted = true
    async function load() {
      if (!effectiveFlowRunId || active !== 'Parameters') return
      setDetailsLoading(true)
      setDetailsError(null)
      try {
        const json = await fetchFlowRunDetails(effectiveFlowRunId)
        if (mounted) setDetailsData(json as Record<string, unknown>)
      } catch (err: unknown) {
        const message = getDisplayErrorMessage(err, 'Failed to load details')
        if (mounted) setDetailsError(message)
      } finally {
        if (mounted) setDetailsLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [effectiveFlowRunId, active])

  const emptyState = (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/25 bg-muted/15 px-4 py-10 text-center">
      <Inbox className="mb-2 h-6 w-6 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">No flow run in context</p>
      <p className="mt-1 max-w-md text-xs text-muted-foreground">
        Choose a job from the jobs table and open Prefect run, or return to jobs to pick a flow.
      </p>
      <Button variant="secondary" size="sm" className="mt-3 h-7 text-xs" onClick={() => navigate('/jobs')}>
        Go to jobs
      </Button>
    </div>
  )

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden px-0 py-0">
      <Tabs
        value={tabValue}
        onValueChange={(v) => setActive(v as TabKey)}
        className="flex min-h-0 flex-1 gap-0 flex-col"
      >
        {/* Fixed header */}
        <div className="shrink-0 space-y-2 border-b border-border pb-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => navigate(-1)}
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-bold text-foreground">Prefect flow run</h1>
            {effectiveFlowRunId ? (
              <FlowRunIdChip id={effectiveFlowRunId} />
            ) : (
              <span className="text-xs text-muted-foreground">Select a run to load logs</span>
            )}
          </div>

          <TabsList className="w-fit max-w-full">
            {TABS.map((tab) => {
              const Icon = TAB_ICONS[tab]
              return (
                <TabsTrigger key={tab} value={tab}>
                  {Icon ? <Icon /> : null}
                  {tab === 'Task Runs' ? 'Task runs' : tab}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </div>

        {/* Scrollable tab body */}
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pt-2">
          <TabsContent value="Logs" className="m-0 focus-visible:outline-none">
            {effectiveFlowRunId ? (
              <Card className="gap-0 overflow-hidden py-0">
                <div className="sticky top-0 z-10 flex flex-wrap items-center justify-end gap-2 border-b bg-card/95 px-3 py-2 backdrop-blur-sm supports-[backdrop-filter]:bg-card/80">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Level</span>
                    <Select value={levelFilter} onValueChange={(v) => setLevelFilter(v)}>
                      <SelectTrigger className="h-8 w-[min(100vw-6rem,200px)] text-sm">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All</SelectItem>
                        <SelectItem value="Critical only">Critical only</SelectItem>
                        <SelectItem value="Error and above">Error and above</SelectItem>
                        <SelectItem value="Warning and above">Warning and above</SelectItem>
                        <SelectItem value="Info and above">Info and above</SelectItem>
                        <SelectItem value="Debug and above">Debug and above</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Sort</span>
                    <Select
                      value={sortOrder}
                      onValueChange={(v) => setSortOrder(v as 'newest' | 'oldest')}
                    >
                      <SelectTrigger className="h-8 w-[min(100vw-6rem,200px)] text-sm">
                        <SelectValue placeholder="Order" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="oldest">Oldest → newest</SelectItem>
                        <SelectItem value="newest">Newest → oldest</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <CardContent className="p-3">
                  <Logs
                    flowRunId={effectiveFlowRunId}
                    levelFilter={levelFilter}
                    sortOrder={sortOrder}
                  />
                </CardContent>
              </Card>
            ) : (
              emptyState
            )}
          </TabsContent>

          <TabsContent value="Task Runs" className="m-0 focus-visible:outline-none">
            {effectiveFlowRunId ? <TaskRuns flowRunId={effectiveFlowRunId} /> : emptyState}
          </TabsContent>

          <TabsContent value="Details" className="m-0 focus-visible:outline-none">
            {effectiveFlowRunId ? (
              <Card className="gap-0 overflow-hidden py-0">
                <CardContent className="p-3">
                  <FlowRunDetails flowId={effectiveFlowRunId} />
                </CardContent>
              </Card>
            ) : (
              emptyState
            )}
          </TabsContent>

          <TabsContent value="Parameters" className="m-0 focus-visible:outline-none">
            {effectiveFlowRunId ? (
              detailsLoading ? (
                <ParametersLoading />
              ) : detailsError ? (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle className="text-sm">Could not load parameters</AlertTitle>
                  <AlertDescription className="text-xs">{detailsError}</AlertDescription>
                </Alert>
              ) : (
                <Parameters parameters={detailsData?.parameters} />
              )
            ) : (
              emptyState
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
