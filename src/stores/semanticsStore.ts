import { create } from 'zustand';

// --- Types ---

export interface SourceRow {
  id: string;
  connectionId: string;
  connectionName: string;
  database: string;
  schema: string;
  selectedTables: (string | number)[];
}

export interface DomainOption {
  domain_id: string;
  display_name: string;
}

export interface ContextFileUpload {
  file_id: string;
  file_name: string;
}

export interface ContextSourceState {
  id: string;
  connectionId: string;
  connectionName: string;
  database: string;
  schema: string;
  selectedTables: (string | number)[];
  sourceTitle: string;
  sourceType: string;
  rawText: string;
  files: ContextFileUpload[];
  contextId: string | null;
  extractionId: string | null;
  extractions: any | null;
  applied: boolean;
}

// Step 4: Entity Mapping cache
export interface EntityCandidate {
  table: string;
  column: string;
  mapped_entity_type: string;
  confidence: number;
  join_key: string;
  description: string;
  source?: string;
  connection_id: string;
  database: string;
  schema: string;
}

// Step 5: Hierarchy cache
export interface HierarchyLevel {
  id: string;
  name: string;
  description?: string;
}

export interface HierarchyGroup {
  name: string;
  description?: string;
  levels: HierarchyLevel[];
}

// Step 6: Dims & Facts cache
export interface FactItem {
  id: string;
  name: string;
  grain: string;
  time_column: string;
  measures: string[];
  dimensions: string[];
  confidence: number;
}

export interface DimensionItem {
  id: string;
  name: string;
  keys: string[];
  attributes: string[];
  confidence: number;
}

// Step 7: Metrics cache
export interface MetricItem {
  metric_id: string;
  metric_name: string;
  type: string;
  sql: string;
  grain: string;
  dimensions: string[];
  tables: string[];
  status: 'suggested' | 'draft' | 'certified';
  confidence?: number;
  description?: string;
  connection_id: string;
  database: string;
  schema: string;
}

// Step 8: Readiness review summary cache

export interface ReadinessScanColumn {
  name: string
  data_type: string
  null_frac: number
  distinct: number
  profile: {
    sample_values?: string[]
    max?: number
    min?: number
    mean?: number
  }
}

export interface ReadinessScanTable {
  table: string
  columns: ReadinessScanColumn[]
}

export interface ReadinessScanSchemaPayload {
  name: string
  limit: number
  cursor: string | null
  tables: ReadinessScanTable[]
  next_cursor: string | null
}

export interface ReadinessScanSummary {
  tables: number
  schema_payload?: ReadinessScanSchemaPayload | null
}

export interface ReadinessEntitySummary {
  entity_id: string
  description: string | null
  join_key: string | null
  examples?: string[] | null
  connection_id?: string
  database_name?: string
  schema_name?: string
  lifecycle_status: string
  source_type?: string
  source_run_id?: string | null
  artifact_key?: string
  version_no?: number
  is_current?: boolean
}

export interface ReadinessHierarchySummary {
  name: string
  levels: string[]
  description?: string | null
}

export interface ReadinessFactSummary {
  fact_id: string
  table_name: string
  grain: string | null
  time_column: string | null
  measures: string[]
  dimensions: string[]
  description?: string | null
  lifecycle_status: string
  tenant_id?: string
  domain_id?: string
  connection_id?: string
  database_name?: string
  schema_name?: string
  source_type?: string
  source_run_id?: string | null
  artifact_key?: string
  version_no?: number
  is_current?: boolean
  created_at?: string
  updated_at?: string
}

export interface ReadinessDimensionSummary {
  dimension_id: string
  name: string
  keys: string[]
  attributes: string[]
  description?: string | null
  lifecycle_status: string
  tenant_id?: string
  domain_id?: string
  connection_id?: string
  database_name?: string
  schema_name?: string
  source_type?: string
  source_run_id?: string | null
  artifact_key?: string
  version_no?: number
  is_current?: boolean
  created_at?: string
  updated_at?: string
}

export interface ReadinessMetricSummary {
  metric_id: string
  metric_name: string
  display_name?: string | null
  description?: string | null
  type: string | null
  sql: string | null
  grain?: string | null
  dimensions: string[] | null
  lifecycle_status: string
  domain_id?: string
  tenant_id?: string
  connection_id?: string
  database_name?: string
  schema_name?: string
  source_type?: string
  source_run_id?: string | null
  artifact_key?: string
  version_no?: number
  is_current?: boolean
  owner?: string | null
  dataset_id?: string | null
  source_model?: string | null
}

export interface ReadinessOntologySummary {
  entities: {
    entity_id: string
    description: string | null
    join_key?: string
    examples?: string[]
    lifecycle_status?: string
    source_type?: string
  }[]
  hierarchies: {
    name: string
    levels: string[]
    description?: string | null
  }[]
}

export interface ReadinessReviewSummaryData {
  scan: ReadinessScanSummary | null
  glossary?: any[]
  entities: ReadinessEntitySummary[]
  hierarchies: any[]
  facts: ReadinessFactSummary[]
  dimensions: ReadinessDimensionSummary[]
  metrics: ReadinessMetricSummary[]
  ontology: ReadinessOntologySummary | null
}

// Async job tracking
export interface PendingJob {
  stepName: string;
  jobId: string;
  jobType: string;
}

interface SemanticsState {
  // Unique tenant ID for this workflow session
  tenantId: string;

  // Tenant management
  isExistingTenant: boolean;
  isConfigView: boolean;
  tenantDisplayName: string;
  selectedDomain: DomainOption | null;
  setTenantId: (id: string) => void;
  setIsExistingTenant: (val: boolean) => void;
  setTenantDisplayName: (name: string) => void;
  setSelectedDomain: (domain: DomainOption | null) => void;
  loadExistingTenant: (tenantId: string, displayName: string) => void;

  // Async job tracking
  pendingJobs: PendingJob[];
  addPendingJob: (stepName: string, jobId: string, jobType: string) => void;
  removePendingJob: (jobId: string) => void;
  clearPendingJobs: () => void;

  // Step 1: Source rows (formerly step 2)
  sourceRows: SourceRow[];
  addSourceRow: () => void;
  removeSourceRow: (id: string) => void;
  updateSourceRow: (id: string, updates: Partial<SourceRow>) => void;
  setSourceRows: (rows: SourceRow[]) => void;

  // Step 1: Scan result
  scanResult: any;
  setScanResult: (result: any) => void;
  isScanLoading: boolean;
  setIsScanLoading: (loading: boolean) => void;

  // Step 2: Context (formerly step 3)
  contextSources: ContextSourceState[];
  initContextSources: () => void;
  addContextSource: () => void;
  removeContextSource: (id: string) => void;
  updateContextSource: (id: string, updates: Partial<ContextSourceState>) => void;

  // Step 3: Entity Mapping cache (formerly step 4)
  entityCandidates: EntityCandidate[];
  entityCandidatesLoaded: boolean;
  entityMappingId: string | null;
  setEntityCandidates: (candidates: EntityCandidate[]) => void;
  setEntityMappingId: (id: string | null) => void;
  updateEntityCandidate: (index: number, updates: Partial<EntityCandidate>) => void;
  removeEntityCandidate: (index: number) => void;

  // Step 4: Hierarchy cache (formerly step 5)
  hierarchies: HierarchyGroup[];
  hierarchiesLoaded: boolean;
  setHierarchies: (hierarchies: HierarchyGroup[]) => void;

  // Step 5: Dims & Facts cache (formerly step 6)
  facts: FactItem[];
  dimensions: DimensionItem[];
  dimsFactsLoaded: boolean;
  setFacts: (facts: FactItem[]) => void;
  addFact: (fact: FactItem) => void;
  updateFact: (factId: string, updates: Partial<FactItem>) => void;
  removeFact: (factId: string) => void;
  setDimensions: (dimensions: DimensionItem[]) => void;
  addDimension: (dimension: DimensionItem) => void;
  updateDimension: (dimId: string, updates: Partial<DimensionItem>) => void;
  removeDimension: (dimId: string) => void;
  setDimsFactsLoaded: (loaded: boolean) => void;

  // Step 6: Metrics cache (formerly step 7)
  metrics: MetricItem[];
  metricsLoaded: boolean;
  setMetrics: (metrics: MetricItem[]) => void;
  addMetric: (metric: MetricItem) => void;
  updateMetric: (metricId: string, updates: Partial<MetricItem>) => void;
  removeMetric: (metricId: string) => void;

  // Step 7: Readiness review summary cache (formerly step 8)
  readinessSummary: ReadinessReviewSummaryData | null;
  readinessSummaryLoaded: boolean;
  setReadinessSummary: (summary: ReadinessReviewSummaryData | null) => void;

  // Step invalidation: clears data for all steps after the given step number
  invalidateFromStep: (step: number) => void;

  // Reset
  resetStore: () => void;
}

// --- Helpers ---

let rowCounter = 0;
function createEmptyRow(): SourceRow {
  return {
    id: `row-${++rowCounter}`,
    connectionId: '',
    connectionName: '',
    database: '',
    schema: '',
    selectedTables: [],
  };
}

let ctxCounter = 0;
function createEmptyContextSource(): ContextSourceState {
  return {
    id: `ctx-${++ctxCounter}`,
    connectionId: '',
    connectionName: '',
    database: '',
    schema: '',
    selectedTables: [],
    sourceTitle: '',
    sourceType: 'business_context',
    rawText: '',
    files: [],
    contextId: null,
    extractionId: null,
    extractions: null,
    applied: false,
  };
}

function createContextSourceFromRow(row: SourceRow): ContextSourceState {
  return {
    id: `ctx-${++ctxCounter}`,
    connectionId: row.connectionId,
    connectionName: row.connectionName,
    database: row.database,
    schema: row.schema,
    selectedTables: [...row.selectedTables],
    sourceTitle: '',
    sourceType: 'business_context',
    rawText: '',
    files: [],
    contextId: null,
    extractionId: null,
    extractions: null,
    applied: false,
  };
}

// --- Store ---

export const useSemanticsStore = create<SemanticsState>((set, get) => ({
  // Unique tenant ID for this workflow session
  tenantId: crypto.randomUUID(),

  // Tenant management
  isExistingTenant: false,
  isConfigView: false,
  tenantDisplayName: '',
  selectedDomain: null,
  setTenantId: (id) => set({ tenantId: id }),
  setIsExistingTenant: (val) => set({ isExistingTenant: val }),
  setTenantDisplayName: (name) => set({ tenantDisplayName: name }),
  setSelectedDomain: (domain) => set({ selectedDomain: domain }),
  loadExistingTenant: (tenantId, displayName) =>
    set({
      tenantId,
      isExistingTenant: true,
      isConfigView: true,
      tenantDisplayName: displayName,
      selectedDomain: null,
      // Reset all step data — steps will re-fetch via GET for this tenant
      pendingJobs: [],
      sourceRows: [createEmptyRow()],
      scanResult: null,
      isScanLoading: false,
      contextSources: [],
      entityCandidates: [],
      entityCandidatesLoaded: false,
      entityMappingId: null,
      hierarchies: [],
      hierarchiesLoaded: false,
      facts: [],
      dimensions: [],
      dimsFactsLoaded: false,
      metrics: [],
      metricsLoaded: false,
      readinessSummary: null,
      readinessSummaryLoaded: false,
    }),

  // Async job tracking
  pendingJobs: [],
  addPendingJob: (stepName, jobId, jobType) =>
    set((state) => ({
      pendingJobs: [...state.pendingJobs, { stepName, jobId, jobType }],
    })),
  removePendingJob: (jobId) =>
    set((state) => ({
      pendingJobs: state.pendingJobs.filter((j) => j.jobId !== jobId),
    })),
  clearPendingJobs: () => set({ pendingJobs: [] }),

  // Step 1: Source rows (formerly step 2)
  sourceRows: [createEmptyRow()],

  addSourceRow: () =>
    set((state) => ({
      sourceRows: [...state.sourceRows, createEmptyRow()],
    })),

  removeSourceRow: (id) =>
    set((state) => {
      if (state.sourceRows.length <= 1) return state;
      return { sourceRows: state.sourceRows.filter((r) => r.id !== id) };
    }),

  updateSourceRow: (id, updates) =>
    set((state) => ({
      sourceRows: state.sourceRows.map((row) => {
        if (row.id !== id) return row;
        const newRow = { ...row, ...updates };
        // Cascading resets
        if ('connectionId' in updates && updates.connectionId !== row.connectionId) {
          newRow.database = '';
          newRow.schema = '';
          newRow.selectedTables = [];
        } else if ('database' in updates && updates.database !== row.database) {
          newRow.schema = '';
          newRow.selectedTables = [];
        } else if ('schema' in updates && updates.schema !== row.schema) {
          newRow.selectedTables = [];
        }
        return newRow;
      }),
    })),

  setSourceRows: (rows) => set({ sourceRows: rows }),

  // Scan result
  scanResult: null,
  setScanResult: (result) => set({ scanResult: result }),
  isScanLoading: false,
  setIsScanLoading: (loading) => set({ isScanLoading: loading }),

  // Step 3: Context
  contextSources: [],

  initContextSources: () => {
    const state = get();
    if (state.contextSources.length > 0) return; // Already initialized

    const sources = state.sourceRows.map((row) => createContextSourceFromRow(row));
    set({ contextSources: sources.length > 0 ? sources : [createEmptyContextSource()] });
  },

  addContextSource: () =>
    set((state) => ({
      contextSources: [...state.contextSources, createEmptyContextSource()],
    })),

  removeContextSource: (id) =>
    set((state) => {
      if (state.contextSources.length <= 1) return state;
      return { contextSources: state.contextSources.filter((s) => s.id !== id) };
    }),

  updateContextSource: (id, updates) =>
    set((state) => ({
      contextSources: state.contextSources.map((source) =>
        source.id === id ? { ...source, ...updates } : source
      ),
    })),

  // Step 3: Entity Mapping cache (formerly step 4)
  entityCandidates: [],
  entityCandidatesLoaded: false,
  entityMappingId: null,
  setEntityCandidates: (candidates) =>
    set({ entityCandidates: candidates, entityCandidatesLoaded: true }),
  setEntityMappingId: (id) => set({ entityMappingId: id }),
  updateEntityCandidate: (index, updates) =>
    set((state) => ({
      entityCandidates: state.entityCandidates.map((c, i) =>
        i === index ? { ...c, ...updates } : c
      ),
    })),
  removeEntityCandidate: (index) =>
    set((state) => ({
      entityCandidates: state.entityCandidates.filter((_, i) => i !== index),
    })),

  // Step 4: Hierarchy cache (formerly step 5)
  hierarchies: [],
  hierarchiesLoaded: false,
  setHierarchies: (hierarchies) =>
    set({ hierarchies, hierarchiesLoaded: true }),

  // Step 5: Dims & Facts cache (formerly step 6)
  facts: [],
  dimensions: [],
  dimsFactsLoaded: false,
  setFacts: (facts) => set({ facts }),
  addFact: (fact) =>
    set((state) => ({ facts: [...state.facts, fact] })),
  updateFact: (factId, updates) =>
    set((state) => ({
      facts: state.facts.map((f) => (f.id === factId ? { ...f, ...updates } : f)),
    })),
  removeFact: (factId) =>
    set((state) => ({
      facts: state.facts.filter((f) => f.id !== factId),
    })),
  setDimensions: (dimensions) => set({ dimensions }),
  addDimension: (dimension) =>
    set((state) => ({ dimensions: [...state.dimensions, dimension] })),
  updateDimension: (dimId, updates) =>
    set((state) => ({
      dimensions: state.dimensions.map((d) => (d.id === dimId ? { ...d, ...updates } : d)),
    })),
  removeDimension: (dimId) =>
    set((state) => ({
      dimensions: state.dimensions.filter((d) => d.id !== dimId),
    })),
  setDimsFactsLoaded: (loaded) => set({ dimsFactsLoaded: loaded }),

  // Step 6: Metrics cache (formerly step 7)
  metrics: [],
  metricsLoaded: false,
  setMetrics: (metrics) => set({ metrics, metricsLoaded: true }),
  addMetric: (metric) =>
    set((state) => ({ metrics: [...state.metrics, metric] })),
  updateMetric: (metricId, updates) =>
    set((state) => ({
      metrics: state.metrics.map((m) =>
        m.metric_id === metricId ? { ...m, ...updates } : m
      ),
    })),
  removeMetric: (metricId) =>
    set((state) => ({
      metrics: state.metrics.filter((m) => m.metric_id !== metricId),
    })),

  // Step 7: Readiness review summary cache (formerly step 8)
  readinessSummary: null,
  readinessSummaryLoaded: false,
  setReadinessSummary: (summary) =>
    set({ readinessSummary: summary, readinessSummaryLoaded: true }),

  // Step invalidation: clears data for all steps after the given step number.
  // When user navigates back to step N, call invalidateFromStep(N) to reset
  // all downstream step data so subsequent steps are refreshed.
  invalidateFromStep: (step) =>
    set(() => {
      const updates: Partial<SemanticsState> = {};

      if (step <= 1) {
        // Going back to step 1 (Domain) — clear step 2+ data
        updates.sourceRows = [createEmptyRow()];
        updates.scanResult = null;
        updates.isScanLoading = false;
        updates.contextSources = [];
        // Clear steps 4-7 cache
        updates.entityCandidates = [];
        updates.entityCandidatesLoaded = false;
        updates.entityMappingId = null;
        updates.hierarchies = [];
        updates.hierarchiesLoaded = false;
        updates.facts = [];
        updates.dimensions = [];
        updates.dimsFactsLoaded = false;
        updates.metrics = [];
        updates.metricsLoaded = false;
      } else if (step <= 2) {
        // Going back to step 2 (Schema) — clear step 3+ data
        updates.scanResult = null;
        updates.contextSources = [];
        // Clear steps 4-7 cache
        updates.entityCandidates = [];
        updates.entityCandidatesLoaded = false;
        updates.entityMappingId = null;
        updates.hierarchies = [];
        updates.hierarchiesLoaded = false;
        updates.facts = [];
        updates.dimensions = [];
        updates.dimsFactsLoaded = false;
        updates.metrics = [];
        updates.metricsLoaded = false;
      } else if (step <= 3) {
        // Going back to step 3 (Context) — clear step 4+ data
        updates.entityCandidates = [];
        updates.entityCandidatesLoaded = false;
        updates.entityMappingId = null;
        updates.hierarchies = [];
        updates.hierarchiesLoaded = false;
        updates.facts = [];
        updates.dimensions = [];
        updates.dimsFactsLoaded = false;
        updates.metrics = [];
        updates.metricsLoaded = false;
      } else if (step <= 4) {
        // Going back to step 4 (Entity Mapping) — clear step 5+ data
        updates.hierarchies = [];
        updates.hierarchiesLoaded = false;
        updates.facts = [];
        updates.dimensions = [];
        updates.dimsFactsLoaded = false;
        updates.metrics = [];
        updates.metricsLoaded = false;
      } else if (step <= 5) {
        // Going back to step 5 (Hierarchy) — clear step 6+ data
        updates.facts = [];
        updates.dimensions = [];
        updates.dimsFactsLoaded = false;
        updates.metrics = [];
        updates.metricsLoaded = false;
      } else if (step <= 6) {
        // Going back to step 6 (Dims & Facts) — clear step 7+ data
        updates.metrics = [];
        updates.metricsLoaded = false;
        updates.readinessSummary = null;
        updates.readinessSummaryLoaded = false;
      } else if (step <= 7) {
        // Going back to step 7 (Metrics) — clear step 8 data
        updates.readinessSummary = null;
        updates.readinessSummaryLoaded = false;
      }
      // Note: Going back to step 7 (Metrics) doesn't clear anything as it's the last cached step

      return updates;
    }),

  // Reset
  resetStore: () =>
    set({
      tenantId: crypto.randomUUID(),
      isExistingTenant: false,
      isConfigView: false,
      tenantDisplayName: '',
      selectedDomain: null,
      pendingJobs: [],
      sourceRows: [createEmptyRow()],
      scanResult: null,
      isScanLoading: false,
      contextSources: [],
      // Reset step 4-7 cache
      entityCandidates: [],
      entityCandidatesLoaded: false,
      entityMappingId: null,
      hierarchies: [],
      hierarchiesLoaded: false,
      facts: [],
      dimensions: [],
      dimsFactsLoaded: false,
      metrics: [],
      metricsLoaded: false,
      readinessSummary: null,
      readinessSummaryLoaded: false,
    }),
}));
