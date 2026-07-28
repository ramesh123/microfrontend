import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { getDisplayErrorMessage } from '@/utils/exceptionHelper'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ChevronRight,
  Loader2,
  Building2,
  Factory,
  Package,
  MapPin,
  Users,
  Calendar,
  CreditCard,
  BarChart3,
  Search,
  Table2,
  Clock,
  Truck,
  Trash2,
} from 'lucide-react'
import { apiV2 } from '@/controllers/API/api'
import { useSemanticsStore, type EntityCandidate } from '@/stores/semanticsStore'
import { fetchEntityMappingAgents, fetchJobResult as fetchJobResultApi } from '@/controllers/API/semanticsApi'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import JobProcessingBanner from './JobProcessingBanner'

// --- Entity type definitions ---

const ENTITY_TYPES = [
  { value: 'facility', label: 'Facility', Icon: Building2 },
  { value: 'production_line', label: 'Production Line', Icon: Factory },
  { value: 'product', label: 'Product', Icon: Package },
  { value: 'region', label: 'Region', Icon: MapPin },
  { value: 'organizational_unit', label: 'Organizational Unit', Icon: Users },
  { value: 'customer', label: 'Customer', Icon: Users },
  { value: 'supplier', label: 'Supplier', Icon: Package },
  { value: 'time_period', label: 'Time Period', Icon: Calendar },
  { value: 'time', label: 'Time', Icon: Clock },
  { value: 'transaction', label: 'Transaction', Icon: CreditCard },
  { value: 'metric', label: 'Metric', Icon: BarChart3 },
  { value: 'asset', label: 'Asset', Icon: Truck },
]

function getEntityDisplay(entityId: string) {
  const match = ENTITY_TYPES.find((e) => e.value === entityId)
  return match ?? { value: entityId, label: entityId, Icon: Building2 }
}

// --- Dummy fallback data ---

const DUMMY_CANDIDATES: EntityCandidate[] = [
  {
    table: 'fact_production',
    column: 'plant_name',
    confidence: 0.7,
    mapped_entity_type: 'facility',
    join_key: 'plant_name',
    description: 'Physical manufacturing plant',
    connection_id: '',
    database: '',
    schema: '',
  },
  {
    table: 'fact_production',
    column: 'line_id',
    confidence: 0.85,
    mapped_entity_type: 'production_line',
    join_key: 'line_id',
    description: 'Production assembly line identifier',
    connection_id: '',
    database: '',
    schema: '',
  },
  {
    table: 'dim_product',
    column: 'product_name',
    confidence: 0.8,
    mapped_entity_type: 'product',
    join_key: 'product_id',
    description: 'Product being manufactured',
    connection_id: '',
    database: '',
    schema: '',
  },
  {
    table: 'dim_region',
    column: 'region_name',
    confidence: 0.75,
    mapped_entity_type: 'region',
    join_key: 'region_id',
    description: 'Geographic region',
    connection_id: '',
    database: '',
    schema: '',
  },
]

// --- Confidence bar ---

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-400'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground font-medium w-7">{pct}%</span>
    </div>
  )
}

// --- Main Component ---

export default function EntityMapping({ onNext }: { onNext?: () => void }) {
  const {
    sourceRows,
    tenantId,
    entityCandidates,
    entityCandidatesLoaded,
    entityMappingId,
    setEntityCandidates,
    setEntityMappingId,
    updateEntityCandidate,
    removeEntityCandidate,
    pendingJobs,
    addPendingJob,
    isConfigView,
  } = useSemanticsStore()

  const [isLoading, setIsLoading] = useState(!entityCandidatesLoaded)
  const [isApplying, setIsApplying] = useState(false)
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedTable, setExpandedTable] = useState<string | undefined>(undefined)
  const hasAutoExpanded = useRef(false)
  const isFetchingRef = useRef(false)

  // Auto-select all candidates when data loads
  useEffect(() => {
    if (entityCandidates.length > 0 && selectedIndices.size === 0) {
      setSelectedIndices(new Set(entityCandidates.map((_, i) => i)))
    }
  }, [entityCandidates.length])

  // Group candidates by table and apply search filter
  const { groupedCandidates, filteredCount, tableNames } = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()

    const filtered = entityCandidates.filter((candidate) => {
      if (!query) return true
      return (
        candidate.table.toLowerCase().includes(query) ||
        candidate.column.toLowerCase().includes(query) ||
        candidate.mapped_entity_type.toLowerCase().includes(query) ||
        getEntityDisplay(candidate.mapped_entity_type).label.toLowerCase().includes(query)
      )
    })

    const grouped: Record<string, { candidate: EntityCandidate; originalIndex: number }[]> = {}
    filtered.forEach((candidate) => {
      const originalIndex = entityCandidates.indexOf(candidate)
      if (!grouped[candidate.table]) {
        grouped[candidate.table] = []
      }
      grouped[candidate.table].push({ candidate, originalIndex })
    })

    return {
      groupedCandidates: grouped,
      filteredCount: filtered.length,
      tableNames: Object.keys(grouped).sort(),
    }
  }, [entityCandidates, searchQuery])

  // Auto-expand first table on initial load (only once)
  useEffect(() => {
    if (tableNames.length > 0 && !hasAutoExpanded.current) {
      setExpandedTable(tableNames[0])
      hasAutoExpanded.current = true
    }
  }, [tableNames])

  // POST /onboard/map/async to start mapping job (or GET in config view)
  const fetchCandidates = useCallback(async () => {
    if (entityCandidatesLoaded) {
      setIsLoading(false)
      return
    }
    if (isFetchingRef.current) return
    isFetchingRef.current = true

    setIsLoading(true)
    try {
      const allCandidates: EntityCandidate[] = []
      let asyncJobStarted = false

      // In config view, use GET /onboard/map/agents
      if (isConfigView) {
        try {
          const agentsRes = await fetchEntityMappingAgents(tenantId)
          if (agentsRes?.agents && Array.isArray(agentsRes.agents)) {
            for (const agent of agentsRes.agents) {
              if (agent.response_payload?.candidates) {
                for (const c of agent.response_payload.candidates) {
                  allCandidates.push({
                    table: c.table ?? agent.table_name ?? '',
                    column: c.column ?? '',
                    mapped_entity_type: c.mapped_entity_type ?? '',
                    confidence: c.confidence ?? 0,
                    join_key: c.column ?? '',
                    description: '',
                    source: 'llm',
                    connection_id: agent.connection_id ?? '',
                    database: agent.database_name ?? '',
                    schema: agent.schema_name ?? '',
                  })
                }
              }
            }
            if (agentsRes.agents.length > 0 && agentsRes.agents[0].mapping_id) {
              setEntityMappingId(agentsRes.agents[0].mapping_id)
            }
          }

          if (allCandidates.length > 0) {
            setEntityCandidates(allCandidates)
          } else {
            setEntityCandidates(DUMMY_CANDIDATES)
            toast.info('No candidates returned. Showing sample data.')
          }
          setIsLoading(false)
          isFetchingRef.current = false
          return
        } catch (err) {
          console.error('Failed to fetch entity mapping agents:', err)
          setEntityCandidates(DUMMY_CANDIDATES)
          toast.error(getDisplayErrorMessage(err, 'Failed to fetch entity mappings. Showing sample data.'))
          setIsLoading(false)
          isFetchingRef.current = false
          return
        }
      }

      // Normal wizard flow: POST to trigger mapping
      await Promise.all(
        sourceRows.map(async (row) => {
          if (
            !row.connectionId ||
            !row.database ||
            !row.schema ||
            row.selectedTables.length === 0
          )
            return

          const payload = {
            tenant_id: tenantId,
          }

          const res = await apiV2.post('/onboard/map/async?use_llm=true', payload)

          // 202 = async job accepted — wait for onComplete to call GET /jobs/{id}/result
          if (res.status === 202 && res.data?.job_id) {
            addPendingJob('entity_mapping', res.data.job_id, 'map')
            asyncJobStarted = true
            return
          }

          const data = res.data

          if (data?.mapping_id) {
            setEntityMappingId(data.mapping_id)
          }

          if (data?.candidates && Array.isArray(data.candidates)) {
            for (const c of data.candidates) {
              allCandidates.push({
                table: c.table ?? '',
                column: c.column ?? '',
                mapped_entity_type: c.mapped_entity_type ?? c.entity_id ?? '',
                confidence: c.confidence ?? 0,
                join_key: c.column ?? '',
                description: '',
                source: c.source ?? '',
                connection_id: row.connectionId,
                database: row.database,
                schema: row.schema,
              })
            }
          }

          if (
            data?.low_confidence_candidates &&
            Array.isArray(data.low_confidence_candidates)
          ) {
            for (const c of data.low_confidence_candidates) {
              allCandidates.push({
                table: c.table ?? '',
                column: c.column ?? '',
                mapped_entity_type: c.mapped_entity_type ?? c.entity_id ?? '',
                confidence: c.confidence ?? 0,
                join_key: c.column ?? '',
                description: '',
                source: c.source ?? '',
                connection_id: row.connectionId,
                database: row.database,
                schema: row.schema,
              })
            }
          }
        })
      )

      if (asyncJobStarted) {
        setIsLoading(false)
        isFetchingRef.current = false
        return
      }

      if (allCandidates.length > 0) {
        setEntityCandidates(allCandidates)
      } else {
        setEntityCandidates(DUMMY_CANDIDATES)
        toast.info('No candidates returned. Showing sample data.')
      }
    } catch (err) {
      console.error('Failed to fetch entity mappings:', err)
      setEntityCandidates(DUMMY_CANDIDATES)
      toast.error(getDisplayErrorMessage(err, 'Failed to fetch entity mappings. Showing sample data.'))
    } finally {
      setIsLoading(false)
      isFetchingRef.current = false
    }
  }, [sourceRows, tenantId, entityCandidatesLoaded, setEntityCandidates, setEntityMappingId, isConfigView])

  useEffect(() => {
    fetchCandidates()
  }, [fetchCandidates])

  // Fetch entity mapping result from completed job
  const fetchJobResult = useCallback(async (jobId: string) => {
    setIsLoading(true)
    try {
      const data = await fetchJobResultApi(jobId)
      const result = data?.result

      if (result?.mapping_id) {
        setEntityMappingId(result.mapping_id)
      }

      const allCandidates: EntityCandidate[] = []

      if (result?.candidates && Array.isArray(result.candidates)) {
        for (const c of result.candidates) {
          allCandidates.push({
            table: c.table ?? '',
            column: c.column ?? '',
            mapped_entity_type: c.mapped_entity_type ?? '',
            confidence: c.confidence ?? 0,
            join_key: c.column ?? '',
            description: '',
            source: c.source ?? '',
            connection_id: '',
            database: '',
            schema: '',
          })
        }
      }

      if (result?.low_confidence_candidates && Array.isArray(result.low_confidence_candidates)) {
        for (const c of result.low_confidence_candidates) {
          allCandidates.push({
            table: c.table ?? '',
            column: c.column ?? '',
            mapped_entity_type: c.mapped_entity_type ?? '',
            confidence: c.confidence ?? 0,
            join_key: c.column ?? '',
            description: '',
            source: c.source ?? '',
            connection_id: '',
            database: '',
            schema: '',
          })
        }
      }

      if (allCandidates.length > 0) {
        setEntityCandidates(allCandidates)
      } else {
        setEntityCandidates(DUMMY_CANDIDATES)
        toast.info('No entities returned. Showing sample data.')
      }
    } catch (err) {
      console.error('Failed to fetch job result:', err)
      setEntityCandidates(DUMMY_CANDIDATES)
      toast.error(getDisplayErrorMessage(err, 'Failed to load entities. Showing sample data.'))
    } finally {
      setIsLoading(false)
    }
  }, [setEntityCandidates, setEntityMappingId])

  // --- Selection handlers ---

  const toggleSelect = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIndices.size === entityCandidates.length) {
      setSelectedIndices(new Set())
    } else {
      setSelectedIndices(new Set(entityCandidates.map((_, i) => i)))
    }
  }

  // Toggle all within a specific table group
  const toggleTableSelectAll = (tableEntries: { originalIndex: number }[]) => { 
    const indices = tableEntries.map((e) => e.originalIndex)
    const allSelected = indices.every((i) => selectedIndices.has(i))

    setSelectedIndices((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        indices.forEach((i) => next.delete(i))
      } else {
        indices.forEach((i) => next.add(i))
      }
      return next
    })

  }

  // --- Inline entity type edit ---

  const handleEntityTypeChange = (originalIndex: number, newType: string) => {
    updateEntityCandidate(originalIndex, { mapped_entity_type: newType })
  }

  // --- Delete ---

  const deleteCandidate = (index: number) => {
    removeEntityCandidate(index)
    setSelectedIndices((prev) => {
      const next = new Set<number>()
      prev.forEach((i) => {
        if (i < index) next.add(i)
        else if (i > index) next.add(i - 1)
        // skip i === index (deleted)
      })
      return next
    })
    toast.success('Entity removed')
  }

  // --- Apply selected candidates and proceed ---

  const applyAndProceed = async () => {
    
    if (selectedIndices.size === 0) {
      toast.error('Please select at least one candidate to proceed.')
      return
    }

    const selectedCandidates = entityCandidates.filter((_, i) => selectedIndices.has(i))

    // If no mapping_id, skip apply and just proceed
    if (!entityMappingId) {
      toast.info('No mapping ID available. Proceeding without apply.')
      onNext?.()
      return
    }

    setIsApplying(true)
    try {
      const payload = {
        candidates: selectedCandidates.map((c) => ({
          table: c.table,
          column: c.column,
          mapped_entity_type: c.mapped_entity_type,
          confidence: c.confidence,
          source: c.source ?? 'llm',
        })),
        notes: 'Apply from entity mapping step',
        selection_mode: selectedIndices.size === entityCandidates.length ? 'all' : 'selected',
        status: 'draft',
        tenant_id: tenantId,
      }

      const res = await apiV2.post(`/onboard/map/${entityMappingId}/apply`, payload)

      if (res.data?.ok) {
        toast.success(
          `Applied ${res.data.applied_count ?? selectedCandidates.length} mappings successfully.`
        )
      } else {
        toast.success('Mappings applied.')
      }

      onNext?.()
    } catch (err) {
      console.error('Failed to apply mappings:', err)
      toast.error(getDisplayErrorMessage(err, 'Failed to apply mappings. Please try again.'))
    } finally {
      setIsApplying(false)
    }
  }

  // --- Check states ---

  const allSelected =
    entityCandidates.length > 0 && selectedIndices.size === entityCandidates.length
  const someSelected = selectedIndices.size > 0 && selectedIndices.size < entityCandidates.length

  // --- Render ---

  return (
    <div className="w-full flex flex-col items-center">
      {/* Header */}
      <div className="pt-3 pb-2 w-full px-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[16px] font-bold">Entity Mapping</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Refine how AI identifies and classifies your data entities.
            </p>
          </div>
          {!isLoading && entityCandidates.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {selectedIndices.size} of {entityCandidates.length} selected
              </span>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search table, column, entity..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="w-full px-4">
        {/* Show processing banner for pending async jobs */}
        {pendingJobs.some((j) => j.stepName === 'entity_mapping') && (
          <div className="mt-2 mb-2">
            {pendingJobs
              .filter((j) => j.stepName === 'entity_mapping')
              .map((j) => (
                <JobProcessingBanner
                  key={j.jobId}
                  jobId={j.jobId}
                  jobType={j.jobType}
                  label="Entity Mapping"
                  onComplete={() => fetchJobResult(j.jobId)}
                />
              ))}
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">
              Loading entity mapping results...
            </p>
          </div>
        ) : (
          <>
            <Card className="shadow-none border rounded-md !py-0 !gap-0 mt-2">
              <CardHeader className="!px-3 !py-2 flex flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all candidates"
                  />
                  <CardTitle className="text-sm font-semibold">
                    Detected Entity Candidates
                  </CardTitle>
                </div>
                <span className="text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  {filteredCount} / {entityCandidates.length} Entities
                </span>
              </CardHeader>
              <CardContent className="!px-0 !py-0">
                {tableNames.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Search className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">No entities match your search</p>
                    <p className="text-xs mt-1">Try a different search term</p>
                  </div>
                ) : (
                  <Accordion
                    type="single"
                    collapsible
                    value={expandedTable}
                    onValueChange={setExpandedTable}
                    className="w-full"
                  >
                    {tableNames.map((tableName) => {
                      const tableEntries = groupedCandidates[tableName]
                      const entityCount = tableEntries.length
                      const tableSelectedCount = tableEntries.filter((e) =>
                        selectedIndices.has(e.originalIndex)
                      ).length
                      const allTableSelected = tableSelectedCount === entityCount
                      const someTableSelected =
                        tableSelectedCount > 0 && tableSelectedCount < entityCount

                      return (
                        <AccordionItem
                          key={tableName}
                          value={tableName}
                          className="border-b last:border-b-0"
                        >
                          <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-muted/30">
                            <div className="flex items-center gap-2">
                              <div
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleTableSelectAll(tableEntries)
                                }}
                              >
                                <Checkbox
                                  checked={
                                    allTableSelected
                                      ? true
                                      : someTableSelected
                                        ? 'indeterminate'
                                        : false
                                  }
                                  aria-label={`Select all in ${tableName}`}
                                />
                              </div>
                              <div className="flex items-center justify-center w-7 h-7 rounded-md bg-blue-500/10">
                                <Table2 className="h-3.5 w-3.5 text-blue-600" />
                              </div>
                              <div className="text-left">
                                <span className=" text-sm font-medium">
                                  {tableName}
                                </span>
                                <span className="ml-2 text-[10px] font-normal text-muted-foreground">
                                  {tableSelectedCount}/{entityCount}{' '}
                                  {entityCount === 1 ? 'entity' : 'entities'} selected
                                </span>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-0 pb-0">
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-muted/30">
                                    <TableHead className="pl-4 w-10 text-[10px] uppercase tracking-wide font-semibold text-muted-foreground h-8">
                                      {/* Checkbox column */}
                                    </TableHead>
                                    <TableHead className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground h-8">
                                      Column
                                    </TableHead>
                                    <TableHead className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground h-8">
                                      Entity Type
                                    </TableHead>
                                    <TableHead className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground h-8">
                                      Source
                                    </TableHead>
                                    <TableHead className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground h-8">
                                      Confidence
                                    </TableHead>
                                    <TableHead className="text-right pr-4 text-[10px] uppercase tracking-wide font-semibold text-muted-foreground h-8">
                                      Action
                                    </TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {tableEntries.map(({ candidate, originalIndex }) => {
                                    const entityDisplay = getEntityDisplay(
                                      candidate.mapped_entity_type
                                    )
                                    const EntityIcon = entityDisplay.Icon
                                    const isSelected = selectedIndices.has(originalIndex)

                                    return (
                                      <TableRow
                                        key={`${candidate.table}-${candidate.column}-${originalIndex}`}
                                        className={cn(
                                          isSelected && 'bg-primary/[0.03]',
                                          'group'
                                        )}
                                      >
                                        <TableCell className="pl-4 py-2 w-10">
                                          <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={() => toggleSelect(originalIndex)}
                                            aria-label={`Select ${candidate.column}`}
                                          />
                                        </TableCell>
                                        <TableCell className=" text-xs py-2">
                                          {candidate.column}
                                        </TableCell>
                                        <TableCell className="py-2">
                                          <Select
                                            value={candidate.mapped_entity_type}
                                            onValueChange={(val) =>
                                              handleEntityTypeChange(originalIndex, val)
                                            }
                                          >
                                            <SelectTrigger className="h-7 w-44 text-xs border-transparent hover:border-border transition-colors">
                                              <div className="flex items-center gap-1.5">
                                                <SelectValue />
                                              </div>
                                            </SelectTrigger>
                                            <SelectContent>
                                              {ENTITY_TYPES.map((et) => (
                                                <SelectItem key={et.value} value={et.value}>
                                                  <div className="flex items-center gap-1.5">
                                                    <et.Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                                                    <span>{et.label}</span>
                                                  </div>
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </TableCell>
                                        <TableCell className="py-2">
                                          <span className="text-[11px] text-muted-foreground">
                                            {candidate.source || 'llm'}
                                          </span>
                                        </TableCell>
                                        <TableCell className="py-2">
                                          <ConfidenceBar value={candidate.confidence} />
                                        </TableCell>
                                        <TableCell className="text-right pr-4 py-2">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => deleteCandidate(originalIndex)}
                                          >
                                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    )
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      )
                    })}
                  </Accordion>
                )}
              </CardContent>
            </Card>

            {/* Proceed Button */}
            <div className="mt-4 mb-3 flex items-center justify-center gap-3">
              <Button
                onClick={applyAndProceed}
                disabled={isApplying || selectedIndices.size === 0}
                className="px-6 gap-1.5 text-sm !h-8"
              >
                {isApplying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Applying Mappings...
                  </>
                ) : (
                  <>
                    Apply & Proceed to Hierarchy
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
