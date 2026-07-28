import React, { useState, useMemo, useEffect, useRef, useCallback, startTransition } from 'react';
import { Table2, Loader2, Type, Hash, CalendarDays, Search } from 'lucide-react';
import { DragEndEvent, DragStartEvent, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { useLocation, useSearchParams, useParams, useNavigate } from 'react-router-dom';
import {
  getColumns,
  getDashboardChartForm,
  createChart,
  createChartStreaming,
  CreateChartPayload,
  getChartById,
  getDashboardCharts,
  saveChart,
  updateChart,
  updateChartStreaming,
  UpdateChartPayload,
  getSavedChartIdFromResponse,
} from '@/pages/Visualization/API/chartsApi';
import { toast } from 'sonner';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, themeQuartz } from 'ag-grid-community';
import { useTheme } from '@/context/theme';
import useFlowStore from '@/stores/flowStore';
import { type Source } from './components/DataFieldsSidebar';
import { ChartDiagramIcon, ChartType, Config, Field } from './components/ChartConfigurator';
import { DrilldownFilter } from './components/DrilldownBreadcrumb';
import { SavedChart } from './components/DashboardView';
import { saveNodeDetailsApi } from '@/controllers/API';
import { ChartFormulatorHeader } from './components/ChartFormulatorHeader';
import {
  canShowDrilldownButtonInEditor,
  canShowDrillThroughButton,
} from './utils/chartActionVisibility';
import { ChartSelector } from './components/ChartSelector';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Thread, inferType, EMPTY_NODES, ChartFormulatorLayout } from './ChartFormulator/index';
import type { ChartFormulatorProps } from './ChartFormulator/types';
import {
  formatFieldName,
  extractColumnName,
  getNestedValue,
  resolveMetricNested,
  ensureColumnsFromParams,
  getUpstreamNodeFieldColumns,
  stripChartFormAuxKeysFromParams,
} from './ChartFormulator/utils';
import { extractCompleteJSON } from './ChartFormulator/streamingUtils';
import {
  attachCustomizationsToPayload,
  getChartCustomizationFromChart,
  getSavedChartCustomizations,
  resolveChartCustomizationsForApi,
} from './chartCustomizationsPayload';
import {
  applyAnalyticsStudioChartPayload,
  applyAnalyticsStudioPayloadForSavedChart,
  canGenerateAnalyticsStudioChart,
} from '@/pages/analyticsstudio/analyticsStudioChartPayload';
import {
  isBigNumberVisualization,
  transformBigNumberChartData,
} from './components/charts/bigNumber';

ModuleRegistry.registerModules([AllCommunityModule]);

/** Pie/donut/etc. do not use X-axis in params; skip persisted X-axis when regenerating from saved chart data. */
function visualizationShouldIncludeStoredXAxis(vizName: string | undefined): boolean {
  const v = (vizName || '').toLowerCase();
  if (
    v.includes('pie') ||
    v.includes('donut') ||
    v.includes('funnel') ||
    v.includes('gauge') ||
    v.includes('sunburst') ||
    v.includes('pivot') ||
    v.includes('heatmap') ||
    v.includes('treemap') ||
    v.includes('table') ||
    v.includes('big_number') ||
    v.includes('bignumber') ||
    v.includes('big_number_stream')
  ) {
    return false;
  }
  return true;
}

const inferFieldType = (columnName: string): 'string' | 'number' | 'date' => {
  const name = columnName.toLowerCase();

  // Date patterns
  const datePatterns = [
    'date', 'time', 'timestamp', 'created', 'updated', 'modified',
    'start', 'end', 'birth', 'join', 'expire', 'valid', 'since',
    'day', 'month', 'year', 'hour', 'minute', 'second'
  ];

  if (datePatterns.some(pattern => name.includes(pattern))) {
    return 'date';
  }

  // Number patterns
  const numberPatterns = [
    'count', 'sum', 'total', 'amount', 'price', 'cost', 'value',
    'quantity', 'qty', 'num', 'number', 'id', 'score', 'rate',
    'percent', 'percentage', 'ratio', 'avg', 'average', 'max', 'min',
    'netwr', 'txn', 'txns', 'amount', 'balance', 'revenue', 'profit',
    'loss', 'income', 'expense', 'fee', 'charge', 'discount'
  ];

  if (numberPatterns.some(pattern => name.includes(pattern))) {
    return 'number';
  }

  // Default to string
  return 'string';
};

/**
 * Map saved API metric entries to form metric rows and flat keys (`metrics_0_operation`, `metric_alias`, …).
 * Handles string metrics, `columns` / `column` / `name`, and common operation/alias field names.
 */
function expandSavedMetricsForForm(apiMetrics: any[], metricsKey: string) {
  const mappedMetrics = apiMetrics.map((m: any) => {
    let columnName = '';
    if (typeof m === 'string') {
      columnName = m;
    } else if (m && typeof m === 'object') {
      const raw = m.columns ?? m.column ?? m.name ?? m.field;
      columnName = raw != null && typeof raw !== 'object' ? String(raw) : '';
    }
    return {
      name: columnName,
      type: inferType(columnName || ''),
    };
  });

  const extraFormKeys: Record<string, any> = {};
  apiMetrics.forEach((metric: any, idx: number) => {
    const op = metric?.operation ?? metric?.aggregation ?? metric?.agg;
    const als = metric?.alias ?? metric?.column_alias;
    const prefixes = ['metric', 'metrics', 'mtric', metricsKey];
    const seen = new Set<string>();
    for (const prefix of prefixes) {
      if (!prefix || seen.has(prefix)) continue;
      seen.add(prefix);
      if (op !== undefined && op !== null && op !== '') {
        extraFormKeys[`${prefix}_${idx}_operation`] = op;
        if (idx === 0) {
          extraFormKeys[`${prefix}_operation`] = op;
        }
      }
      if (als !== undefined && als !== null && als !== '') {
        extraFormKeys[`${prefix}_${idx}_alias`] = als;
        if (idx === 0) {
          extraFormKeys[`${prefix}_alias`] = als;
        }
      }
    }
  });

  return { mappedMetrics, extraFormKeys };
}

/** Persist only chart config on the workflow node — not the full create/update payload — so sheet execute matches ChartSelector saves. */
/** Merge streamed API payload on interval refresh without replacing unrelated raw response fields. */
function mergeStreamRawResponseForSilentRefresh(prev: any, next: any): any {
  if (!next) return prev;
  if (!prev) return next;
  return {
    ...prev,
    ...next,
    ...(Array.isArray(next.data) ? { data: next.data } : {}),
    ...(next.x_axis != null ? { x_axis: next.x_axis } : {}),
    ...(next.xAxis != null ? { xAxis: next.xAxis } : {}),
    ...(next.columns != null ? { columns: next.columns } : {}),
  };
}

function toWorkflowNodeChartDataSnapshot(payload: CreateChartPayload | UpdateChartPayload) {
  const p = payload as CreateChartPayload & { node_id?: string; unique_id?: string; visualization_name?: string };
  return {
    params: stripChartFormAuxKeysFromParams({ ...(payload.params as object) }),
    flow_id: payload.flow_id,
    visualization_name: p.visualization_name,
    chart_name: p.chart_name,
    stmt_date: payload.stmt_date || '',
    ...(p.customization ? { customization: p.customization } : {}),
    ...(p.node_id ? { node_id: p.node_id, unique_id: p.unique_id ?? p.node_id } : {}),
  };
}

export type { Thread };

export function ChartFormulator({
  upstreamNodes = EMPTY_NODES,
  analyticsStudioInit,
  embedded = false,
  embeddedChartId,
  embeddedFlowId,
  onEmbeddedClose,
  onEmbeddedChartUpdated,
}: ChartFormulatorProps) {
  const { chartId, workflowname } = useParams<{ chartId?: string; workflowname?: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname.toLowerCase();
  const isWorkflowPath = embedded ? false : pathname.startsWith('/workflows');

  const editChartId =
    embedded && embeddedChartId != null
      ? String(embeddedChartId)
      : chartId || searchParams.get('edit');

  // View-only mode (when navigated with ?view=true)
  const isViewOnly = (searchParams.get('view') === 'true' || searchParams.get('mode') === 'view');

  const notifyEmbeddedChartUpdated = useCallback(() => {
    if (embedded) onEmbeddedChartUpdated?.();
  }, [embedded, onEmbeddedChartUpdated]);

  // Always start in formulator view to allow editing
  const [view, setView] = useState<'dashboard' | 'formulator'>('formulator');
  
  useEffect(() => {
    const restoreInteraction = () => {
      if (typeof document !== 'undefined') {
        document.documentElement.style.pointerEvents = 'auto';
        document.body.style.pointerEvents = 'auto';
        document.body.style.overflow = 'auto';
      }
    };
    
    restoreInteraction();
    const t = setTimeout(restoreInteraction, 100);
    return () => clearTimeout(t);
  }, []);

  
  const [flowId, setFlowId] = useState<string>("");
  const storeFlowId = useFlowStore((s) => s.currentWorkflow?.flow_id);
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [isLoadingColumns, setIsLoadingColumns] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [threadToDelete, setThreadToDelete] = useState<string | null>(null);
  const [selectedChart, setSelectedChart] = useState<ChartType | null>(null);
  const [chartConfig, setChartConfig] = useState<Config | null>(null);
  const [chartFormData, setChartFormData] = useState<any>(null);
  const [isLoadingForm, setIsLoadingForm] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [rawChartResponse, setRawChartResponse] = useState<any>(null); // Store full API response for bar charts
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [isLoadingEditChart, setIsLoadingEditChart] = useState(false);
  const [isSavingChart, setIsSavingChart] = useState(false);
  const [editChartData, setEditChartData] = useState<any>(null);
  const [isSaveChartNameDialogOpen, setIsSaveChartNameDialogOpen] = useState(false);
  const [chartNameToSave, setChartNameToSave] = useState('');
  /** When user clicks drilldown, we show column picker instead of calling API immediately */
  const [drilldownColumnDialogOpen, setDrilldownColumnDialogOpen] = useState(false);
  const [selectedDrillColumns, setSelectedDrillColumns] = useState<string[]>([]);
  /** Which sources are checked in the drilldown dialog (their columns are shown). Not hardcoded – from API. */
  const [drilldownSourcesChecked, setDrilldownSourcesChecked] = useState<string[]>([]);
  /** Search filter for drilldown column list */
  const [drilldownColumnSearch, setDrilldownColumnSearch] = useState('');
  const [pendingDrilldownContext, setPendingDrilldownContext] = useState<{
    basePayload: CreateChartPayload;
    drillFilters: Array<{ field: string; value: any }>;
    finalDrillFilters: Array<{ column: string; value: any }>;
    isSunburstViz: boolean;
  } | null>(null);
  const [showEditChartData, setShowEditChartData] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [editFormValues, setEditFormValues] = useState<Record<string, any> | undefined>(undefined);
  const hasAutoGeneratedRef = useRef(false); // Track if we've already auto-generated in edit mode
  const isGeneratingRef = useRef(false); // Track if chart generation is currently in progress
  const isPopulatingFormRef = useRef(false); // Track if form is being populated to prevent multiple calls
  const lastPopulatedChartIdRef = useRef<string | null>(null); // Track which chart ID we last populated
  const currentHierarchyRef = useRef<string[] | null>(null); // Store hierarchy from form for sunburst charts
  const initializedFromNodeRef = useRef<string | null>(null); // Track which node we've initialized from
  const pendingChartGenerationRef = useRef<{ flowId: string; stmtDate: string; visualizationName: string; params: any } | null>(null); // Track pending chart generation waiting for source
  /** Last payload sent to create/update chart – used for drilldown when form validation returns null (pie, donut, funnel, gauge, sunburst, etc.) */
  const lastChartPayloadRef = useRef<CreateChartPayload | UpdateChartPayload | null>(null);
  /** Accumulators for big-number stream interval refresh (value-only update). */
  const silentRefreshDataRef = useRef<any[] | null>(null);
  const silentRefreshRawRef = useRef<any | null>(null);

  // Ensure pivot forms include an `apply_metrics_on` parameter so the UI can render it in edit/view modes
  const ensurePivotApplyParam = (formData: any, visualizationName?: string) => {
    try {
      if (!formData || !formData.parameters) return formData;
      const viz = (visualizationName || formData.name || formData.unique_id || '').toString().toLowerCase();
      if (!viz.includes('pivot')) return formData;
      const has = formData.parameters.some((p: any) => (p.key || '').toLowerCase() === 'apply_metrics_on');
      if (has) return formData;
      const param = {
        name: 'apply_metrics_on',
        label: 'Apply metrics on',
        type: 'select',
        placeholder: '',
        key: 'apply_metrics_on',
        api: '',
        params: {},
        display_value: '',
        callback: false,
        validators: { required: false },
        options: ['columns', 'rows'],
      };
      return { ...formData, parameters: [...formData.parameters, param] };
    } catch (e) {
      return formData;
    }
  };

  // Streaming state for AG Grid
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasFirstDataRef = useRef<boolean>(false);
  const pendingChunksRef = useRef<any[]>([]);
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [streamedData, setStreamedData] = useState<any[]>([]);
  const currentWorkflow = useFlowStore((state) => state.currentWorkflow);
  const nodes = currentWorkflow?.data?.nodes;
  const edges = currentWorkflow?.data?.edges;
  const selectedNode = useMemo(() => nodes?.find((n: { selected?: boolean }) => n.selected), [nodes]);
  const upstreamNodes1 = useMemo(() => {
    if (!edges || !nodes || !selectedNode?.id) return [];
    const upstreamEdges = edges.filter((e: { target: string }) => e.target === selectedNode.id);
    const upstreamNodeIds = new Set(upstreamEdges.map((e: { source: string }) => e.source));
    return nodes.filter((n: { id: string }) => upstreamNodeIds.has(n.id));
  }, [edges, nodes, selectedNode?.id]);
  // Try multiple paths to get node_id - handle different node structures
  const nid = upstreamNodes1?.[0]?.data?.current_node_id || 
              upstreamNodes1?.[0]?.data?.node_id ||
              upstreamNodes1?.[0]?.data?.node?.node_id ||
              upstreamNodes1?.[0]?.data?.node?.current_node_id ||
              upstreamNodes1?.[0]?.id;

  /** Saved chart row id on the workflow Charts node (from save-node / save-chart). */
  const workflowPersistedChartId = useMemo(() => {
    if (!isWorkflowPath) return null;
    const raw = selectedNode?.data?.node?.payload?.chart_id;
    if (raw === undefined || raw === null) return null;
    const s = String(raw).trim();
    return s || null;
  }, [isWorkflowPath, selectedNode?.data?.node?.payload?.chart_id, selectedNode?.id]);

  /** Route `?edit=` / `:chartId`, or workflow node `chart_id` — drives update-chart vs create-chart and the primary form button. */
  const persistedChartIdForApi = useMemo(() => {
    const route = editChartId ? String(editChartId).trim() : '';
    if (route) return route;
    return workflowPersistedChartId;
  }, [editChartId, workflowPersistedChartId]);

  
  const { theme } = useTheme();
  const isDarkTheme = theme === 'dark' || theme === 'blue-dark-g';
  const agTheme = themeQuartz
    .withParams(
      {
        backgroundColor: isDarkTheme ? '#1a1a1a' : '#FAFAFA',
        foregroundColor: isDarkTheme ? '#ffffff' : '#361008CC',
        browserColorScheme: isDarkTheme ? 'dark' : 'light',
      },
      isDarkTheme ? 'dark' : 'light'
    );

  // Flatten pivot rawChartResponse to array of row objects for AG Grid (and view mode)
  const pivotFlattenedRows = useMemo(() => {
    const resp = rawChartResponse;
    if (!resp || !resp.data || typeof resp.data !== 'object' || Array.isArray(resp.data)) return null;
    const rows = Array.isArray(resp.rows) ? resp.rows : resp.rows && typeof resp.rows === 'object' ? Object.values(resp.rows) : [];
    if (rows.length === 0) return null;
    let norm: Record<string, any> = resp.data;
    if (Object.keys(norm).length === 1 && norm[Object.keys(norm)[0]] && typeof norm[Object.keys(norm)[0]] === 'object') {
      norm = norm[Object.keys(norm)[0]];
    }
    const rowDimSet = new Set(rows);
    const metricKeys = Object.keys(norm).filter((k) => !rowDimSet.has(k));
    if (metricKeys.length === 0) return null;
    const firstRowDim = rows[0];
    const rowIndexSource = norm[firstRowDim] ?? norm[metricKeys[0]];
    if (!rowIndexSource || typeof rowIndexSource !== 'object') return null;
    const rowIndices = Object.keys(rowIndexSource).sort((a, b) => Number(a) - Number(b));
    const out: Record<string, any>[] = [];
    for (const idx of rowIndices) {
      const row: Record<string, any> = {};
      for (const dim of rows) {
        const colData = norm[dim];
        row[dim] = colData && typeof colData === 'object' && idx in colData ? colData[idx] : '';
      }
      for (const colKey of metricKeys) {
        const colData = norm[colKey];
        row[colKey] = colData && typeof colData === 'object' && idx in colData ? colData[idx] : null;
      }
      out.push(row);
    }
    return out;
  }, [rawChartResponse]);

  // AG Grid: use pivot-flattened rows when we have pivot response; otherwise streamedData
  const effectiveGridData = useMemo(() => {
    if (pivotFlattenedRows && pivotFlattenedRows.length > 0) return pivotFlattenedRows;
    return streamedData;
  }, [pivotFlattenedRows, streamedData]);

  // Create AG Grid column definitions from effectiveGridData
  const agGridColumnDefs = useMemo(() => {
    if (effectiveGridData.length === 0) return [];

    const firstRow = effectiveGridData[0];
    const keys = Object.keys(firstRow);

    return keys.map((key) => ({
      colId: key,
      field: key,
      headerName: key,
      sortable: true,
      filter: true,
      resizable: true,
      width: 150,
      valueGetter: (params: any) => {
        try {
          return params?.data ? params.data[key] : undefined;
        } catch (e) {
          return undefined;
        }
      },
      valueFormatter: (params: any) => {
        const value = params.value;
        return typeof value === 'number'
          ? value.toLocaleString()
          : String(value ?? '');
      },
      cellStyle: typeof firstRow[key] === 'number'
        ? { textAlign: 'right' }
        : { textAlign: 'left' },
    }));
  }, [effectiveGridData]);


  
  // Effect to sync chartData with streamedData
  useEffect(() => {
    if (streamedData.length === 0) {
      setChartData([]);
      return; 
    }

    const rawResp = rawChartResponse;
    const respXAxis = (rawResp && (rawResp.x_axis || rawResp.xAxis)) || null;
    
    // Transform logic (duplicated for safety/independence from executeChartRequest)
    // Optimization: Memoize this if performance becomes an issue
    const transforming = () => {
        const vizHint =
          selectedChart?.uniqueId ||
          selectedChart?.name ||
          rawResp?.visualization_name ||
          '';
        const metrics =
          rawResp?.metrics ||
          (typeof window !== 'undefined'
            ? (window as any).__chartFormValues?.metrics ||
              (window as any).__chartFormValues?.metric ||
              (window as any).__chartFormValues?.mtric
            : undefined);

        if (isBigNumberVisualization(vizHint)) {
          return transformBigNumberChartData(streamedData, {
            columns: rawResp?.columns as string[] | undefined,
            x_axis: respXAxis,
            metrics: Array.isArray(metrics) ? metrics : metrics ? [metrics] : undefined,
          });
        }

        return streamedData
          .map((item: any, index: number) => {
            const keys = Object.keys(item);
            const isAggregatedColumn = (key: string) => key.includes('(') && key.includes(')');

            const aggregatedKey = keys.find((key) => {
              if (!isAggregatedColumn(key)) return false;
              const val = item[key];
              return typeof val === 'number' && !isNaN(val);
            });

            // Fallback to first numeric column (exclude respXAxis)
            let valueKey = aggregatedKey;
            if (!valueKey) {
              valueKey = keys.find((key) => {
                if (respXAxis && key === respXAxis) return false;
                const val = item[key];
                return typeof val === 'number' && !isNaN(val);
              });
            }

            // Determine category: use ALL dimension columns (including numeric IDs like p_status)
            // Dimension = non-aggregated columns; show all values, use "—" for null
            const apiColumns = (rawResp?.columns as string[] | undefined) || keys;
            const dimensionKeys = apiColumns.filter(
              (k) => !isAggregatedColumn(k) && k !== 'value' && k !== valueKey
            );
            let category: string;
            if (dimensionKeys.length > 0) {
              category = dimensionKeys
                .map((k) => {
                  const v = item[k];
                  return v === null || v === undefined ? '—' : String(v).trim();
                })
                .filter((v) => v !== '')
                .join(', ') || (respXAxis && item[respXAxis] != null ? String(item[respXAxis]) : `Item ${index + 1}`);
            } else if (respXAxis && item[respXAxis] !== undefined && item[respXAxis] !== null) {
              category = String(item[respXAxis]);
            } else if (valueKey) {
              category = valueKey.replace(/\(.*\)/, '').trim() || `Value ${index + 1}`;
            } else {
              category = `Item ${index + 1}`;
            }

            const value = valueKey ? Number(item[valueKey]) : NaN;
            if (!valueKey || isNaN(value)) return null;

            return {
              category,
              value,
              originalData: item,
            };
          })
          .filter((item: any) => item !== null);
    };
    
    startTransition(() => {
        setChartData(transforming());
    });
  }, [streamedData, rawChartResponse, selectedChart]);

  const agGridRowData = useMemo(() => {
    return effectiveGridData;
  }, [effectiveGridData]);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,  
      }
    })
  );
  const [drilldownFilters, setDrilldownFilters] = useState<DrilldownFilter[]>(
    []
  );
  /** Per-level drilldown config for save payload and breadcrumb: each level has drill_filters and drill_columns */
  const [drilldownLevels, setDrilldownLevels] = useState<Array<{ drill_filters: Array<{ column: string; value: any }>; drill_columns: Array<{ column: string }> }>>([]);
  /** Stack of { streamedData, rawChartResponse } for drilldown Back button (index i = data at level i) */
  const [drilldownStack, setDrilldownStack] = useState<Array<{ streamedData: any[]; rawChartResponse: any }>>([]);
  /** When true, left-click on a chart slice triggers drilldown API. Set by right-click context menu "Drilldown". Disabled after one drilldown completes so user must enable again. */
  const [drilldownModeEnabled, setDrilldownModeEnabled] = useState(false);
  /** When true, drillthrough is active and drilldown is disabled. User can enable drilldown again from context menu (which clears this). */
  const [drillthroughModeEnabled, setDrillthroughModeEnabled] = useState(false);
  /** Drill-through: dialog and grid state for slice detail data */
  const [isDrillThroughDialogOpen, setIsDrillThroughDialogOpen] = useState(false);
  const [drillThroughContext, setDrillThroughContext] = useState<{ field: string; value: any } | null>(null);
  const [drillThroughGridRows, setDrillThroughGridRows] = useState<any[]>([]);
  const [drillThroughColumnDefs, setDrillThroughColumnDefs] = useState<any[]>([]);
  const [isDrillThroughLoading, setIsDrillThroughLoading] = useState(false);
  /** Last request payload and response shown in drill-through dialog */
  const [drillThroughLastRequest, setDrillThroughLastRequest] = useState<any>(null);
  const [drillThroughLastResponse, setDrillThroughLastResponse] = useState<any>(null);
  const drillThroughLastSliceRef = useRef<{ key: string; ts: number } | null>(null);
  /** Set synchronously when user chooses "Drilldown" from context menu so the very next bar/slice click triggers drilldown before state updates. */
  const userJustChoseDrilldownRef = useRef(false);
  /** Set when user chose "Drilldown" so handleChartDrilldown does not return early due to drillthroughModeEnabled still being true (state not yet updated). */
  const drillthroughJustDisabledRef = useRef(false);
  /** Ignore the immediate non-context follow-up click event after context-menu drilldown to avoid mode-race duplicate handling. */
  const suppressNextNonContextDrillRef = useRef(false);
  const [savedCharts, setSavedCharts] = useState<SavedChart[]>([]);
  const [isSaveChartDialogOpen, setIsSaveChartDialogOpen] = useState(false);
  const [newChartName, setNewChartName] = useState('');
  const [dashboardCharts, setDashboardCharts] = useState<SavedChart[]>([]);
  const [maximizedChart, setMaximizedChart] = useState<SavedChart | null>(null);
  const [editingChartName, setEditingChartName] = useState('');
  const [isLegendVisible, setIsLegendVisible] = useState(false);
  const [customizationOptions, setCustomizationOptions] = useState<any>(null);

  const handleCustomizationChange = useCallback((options: any) => {
    setCustomizationOptions((prev: any) => {
      if (JSON.stringify(prev) === JSON.stringify(options)) {
        return prev;
      }
      
      if (typeof window !== 'undefined') {
        (window as any).__chartCustomizationOptions = options;
      }
      return options;
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent).detail;
      if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return;
      const hasRelevantKey =
        'iconPositionX' in detail ||
        'iconPositionY' in detail ||
        'iconSvg' in detail ||
        'iconSizePx' in detail;
      if (!hasRelevantKey) return;
      handleCustomizationChange(detail);
    };

    window.addEventListener('chartCustomizationChanged', handler);
    return () => window.removeEventListener('chartCustomizationChanged', handler);
  }, [handleCustomizationChange]);

  const handleSelectThread = (id: string) => {
    setActiveThreadId(id);
    setDrilldownFilters([]);
    setDrilldownLevels([]);
    setDrilldownStack([]);
    handleClearChart();
  };

  const handleInitiateDelete = (id: string) => {
    if (isViewOnly) return;
    setThreadToDelete(id);
  };

  const handleConfirmDelete = () => {
    if (isViewOnly) return;
    if (!threadToDelete) return;

    setThreads((prev) => prev.filter((thread) => thread.id !== threadToDelete));
    if (activeThreadId === threadToDelete) {
      setActiveThreadId(null);
      handleClearChart();
      setDrilldownFilters([]);
      setDrilldownLevels([]);
      setDrilldownStack([]);
    }

    setThreadToDelete(null);
  };

  const handleLoadColumns = useCallback(async (flowIdOverride?: string, stmtDateOverride?: string) => {
    if (analyticsStudioInit) return;

    const flowIdToUse = flowIdOverride || flowId.trim();
    if (!flowIdToUse) {
      toast.error('Please enter a Flow ID');
      return;
    }

    setIsLoadingColumns(true);
    try {
      const response = await getColumns({
        flow_id: flowIdToUse,
        stmt_date: stmtDateOverride || '',
        source: '',
      });

      if (response.status && Array.isArray((response as any).data)) {
        const formattedSources: Source[] = (response as any).data.map((item: any) => ({
          name: item.file_name ?? item.name ?? 'Unknown',
          columns: Array.isArray(item.columns) ? item.columns : [],
        }));

        setSources(formattedSources);

        // Auto-select first source if available
        if (formattedSources.length > 0 && !selectedSource) {
          setSelectedSource(formattedSources[0].name);
        }
      } else {
        toast.error('Failed to load columns');
      }
    } catch (error) {
      toast.error('Failed to load columns');
    } finally {
      setIsLoadingColumns(false);
    }
  }, [flowId, selectedSource, analyticsStudioInit]);

  const handleSourceChange = (sourceName: string) => {
    // Switch source without clearing currently selected chart/config
    setSelectedSource(sourceName);
    setDrilldownFilters([]);
    setDrilldownLevels([]);
    setDrilldownStack([]);
  };

  /** When in edit mode and user changes flow ID in header, navigate to create route so we leave edit mode. */
  const handleSwitchToCreateMode = useCallback(() => {
    if (workflowname) {
      navigate(`/reconciliation/operations/${workflowname}/charts/create`);
    }
  }, [navigate, workflowname]);

  // Reset initialization ref when node changes
  useEffect(() => {
    if (selectedNode?.id !== initializedFromNodeRef.current) {
      initializedFromNodeRef.current = null;
    }
  }, [selectedNode?.id]);

  useEffect(() => {
    if (!embedded || analyticsStudioInit) return;
    if (embeddedFlowId?.trim()) {
      setFlowId(embeddedFlowId.trim());
    }
  }, [embedded, embeddedFlowId, analyticsStudioInit]);

  // Auto-load columns when component mounts (only if flowId is set and not in edit mode)
  useEffect(() => {
    if (analyticsStudioInit) return;
    if (flowId && flowId.trim() && !editChartId && !isWorkflowPath) {
      handleLoadColumns();
    }
  }, []); // Only run on mount

  useEffect(() => {
    if (!analyticsStudioInit) return;
    setFlowId(analyticsStudioInit.flowId);
    setSources(analyticsStudioInit.sources);
    const nextSource =
      analyticsStudioInit.selectedSource ?? analyticsStudioInit.sources[0]?.name ?? null;
    if (nextSource) {
      setSelectedSource(nextSource);
    }
  }, [analyticsStudioInit]);

  // Abort pending requests and cleanup when entering edit mode
  useEffect(() => {
    if (editChartId) {
      // Abort any ongoing chart generation
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // Clear any pending timers
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
        updateTimerRef.current = null;
      }
      
      // Reset streaming state
      setIsStreaming(false);
      setIsLoadingChart(false);
      setStreamedData([]);
      pendingChunksRef.current = [];
      hasFirstDataRef.current = false;
      
      // Reset generation flags
      hasAutoGeneratedRef.current = false;
      isGeneratingRef.current = false;
      isPopulatingFormRef.current = false;
      lastPopulatedChartIdRef.current = null;

      if (typeof window !== 'undefined') {
        delete (window as any).__chartCustomizationOptions;
      }
      setCustomizationOptions(undefined);
    }
  }, [editChartId]);

  // Load chart data for editing
  useEffect(() => {
    const loadEditChart = async () => {
      if (!editChartId) return;

      setIsLoadingEditChart(true);
      if (typeof window !== 'undefined') {
        delete (window as any).__chartCustomizationOptions;
      }
      setCustomizationOptions(undefined);
      try {
        const chartResponse = await getChartById(editChartId);
        setEditChartData(chartResponse);

        const chartTypeHint =
          String(chartResponse.visualization_name || chartResponse.chart_type || '').toLowerCase();
        const loadedCustomizations =
          getChartCustomizationFromChart(chartResponse) ??
          getSavedChartCustomizations(chartResponse);
        const normalized = loadedCustomizations
          ? resolveChartCustomizationsForApi(loadedCustomizations, null, chartTypeHint, true) ??
            loadedCustomizations
          : undefined;
        if (normalized) {
          setCustomizationOptions(normalized);
          if (typeof window !== 'undefined') {
            (window as any).__chartCustomizationOptions = normalized;
          }
        }

        const isAnalyticsStudioEdit = !!analyticsStudioInit;

        // Load columns — Analytics Studio uses preloaded init; workflow charts use flow getColumns
        if (isAnalyticsStudioEdit) {
          setFlowId(analyticsStudioInit.flowId);
          const formattedSources = analyticsStudioInit.sources;
          const referenced = ensureColumnsFromParams(chartResponse.params);
          if (formattedSources.length > 0 && referenced.size > 0) {
            const first = formattedSources[0];
            const existingCols = new Set(first.columns);
            referenced.forEach((c) => {
              if (c && !existingCols.has(c)) {
                first.columns.push(c);
              }
            });
          }

          setSources(formattedSources);

          const desired = chartResponse.params?.source;
          if (desired) {
            const exists = formattedSources.some((s) => s.name === desired);
            const matched = formattedSources.find(
              (s) =>
                s.name === desired ||
                s.name.endsWith(`.${desired}`) ||
                s.name.split('.').pop() === desired,
            );
            setSelectedSource(
              exists ? desired : matched?.name ?? analyticsStudioInit.selectedSource ?? formattedSources[0]?.name ?? null,
            );
          } else if (formattedSources.length > 0) {
            setSelectedSource(analyticsStudioInit.selectedSource ?? formattedSources[0].name);
          }
        } else {
          if (chartResponse.flow_id) {
            setFlowId(chartResponse.flow_id);
          }

          const flowIdToUse = chartResponse.flow_id;
          const stmtDateToUse = chartResponse.stmt_date || '';
          if (flowIdToUse) {
            const columnsResponse = await getColumns({
              flow_id: flowIdToUse,
              stmt_date: stmtDateToUse,
              source: '',
            });

            if (columnsResponse.status && Array.isArray((columnsResponse as any).data)) {
              const formattedSources: Source[] = (columnsResponse as any).data.map((item: any) => ({
                name: item.file_name ?? item.name ?? 'Unknown',
                columns: Array.isArray(item.columns) ? item.columns : [],
              }));

              const referenced = ensureColumnsFromParams(chartResponse.params);
              if (formattedSources.length > 0 && referenced.size > 0) {
                const first = formattedSources[0];
                const existingCols = new Set(first.columns);
                referenced.forEach((c) => {
                  if (c && !existingCols.has(c)) {
                    first.columns.push(c);
                  }
                });
              }

              setSources(formattedSources);

              const desired = chartResponse.params?.source;
              if (desired) {
                const exists = formattedSources.some(s => s.name === desired);
                setSelectedSource(exists ? desired : formattedSources[0]?.name ?? null);
              } else if (formattedSources.length > 0) {
                setSelectedSource(formattedSources[0].name);
              }
            }
          }
        }

        // Find and select the chart type
        const visualizationName = chartResponse.visualization_name || chartResponse.chart_type;
        if (visualizationName) {
          // Fetch available charts to find the matching one
          try {
            const chartsResponse = await getDashboardCharts();
            if (chartsResponse.status && chartsResponse.data) {
              const allCharts = chartsResponse.data.flatMap(section => section.components);
              const matchingChart = allCharts.find(
                (c) =>
                  String(c.unique_id).toLowerCase() === String(visualizationName).toLowerCase() ||
                  String(c.key).toLowerCase() === String(visualizationName).toLowerCase()
              );

              if (matchingChart) {
                const Icon = getChartIcon(matchingChart.unique_id, matchingChart.key);
                const chartType: ChartType & { uniqueId: string } = {
                  name: matchingChart.name,
                  icon: Icon,
                  uniqueId: matchingChart.unique_id,
                };
                setSelectedChart(chartType);

                // Fetch chart form
                const formResponse = await getDashboardChartForm(matchingChart.unique_id);
                if (formResponse.status && formResponse.data) {
                  const formWithApply = ensurePivotApplyParam(formResponse.data, visualizationName as string);
                  setChartFormData(formWithApply);

                  // Populate form values from chart params
                  populateFormFromChartData(chartResponse, formWithApply);
                }
              }
            }

            // Restore saved drilldown levels (columns) so edit mode can show and send them
            const levels = chartResponse.params?.drilldown_levels;
            if (Array.isArray(levels) && levels.length > 0) {
              setDrilldownLevels(levels.map((lev: any) => ({
                drill_filters: Array.isArray(lev.drill_filters) ? lev.drill_filters : [],
                drill_columns: Array.isArray(lev.drill_columns) ? lev.drill_columns.map((c: any) => ({ column: typeof c === 'string' ? c : (c?.column ?? c) })) : [],
              })));
            }
          } catch (error) {
          }
        }
      } catch (error) {
        toast.error('Failed to load chart for editing');
      } finally {
        setIsLoadingEditChart(false);
      }
    };

    loadEditChart();
  }, [editChartId, analyticsStudioInit]);

  // Helper function to get chart icon — render the diagrammatic SVG used
  // by ChartConfigurator so icons match across the UI.
  const getChartIcon = (uniqueId: string, key: string) => {
    const typeStr = (uniqueId || key || '').toString();
    return (props: any) => <ChartDiagramIcon type={typeStr} {...props} />;
  };

  // Helper function to populate form from chart data
  const populateFormFromChartData = useCallback((chartData: any, formData: any) => {
    // Prevent multiple simultaneous calls or duplicate population for the same chart.
    // Only dedupe when we have a stable id (edit chart id or workflow mock id). Avoid
    // `undefined === undefined` skipping workflow hydration.
    const chartIdRaw = chartData.id ?? editChartId;
    const chartId =
      chartIdRaw !== undefined && chartIdRaw !== null && chartIdRaw !== ''
        ? String(chartIdRaw)
        : null;
    if (isPopulatingFormRef.current) {
      return;
    }
    if (chartId != null && lastPopulatedChartIdRef.current === chartId) {
      return;
    }
    
    if (!chartData.params || !formData.parameters) {
      return;
    }

    isPopulatingFormRef.current = true;
    lastPopulatedChartIdRef.current = chartId;
    
    try {
      const formValues: Record<string, any> = {};
      const params = chartData.params;

    // Find the metrics parameter key in the form (could be 'metric' or 'metrics')
    const metricsParam = formData.parameters.find((p: any) =>
      p.key === 'metrics' || p.key === 'metric' || p.key === 'mtric'
    );
    const metricsKey = metricsParam?.key || 'metrics';

    // Populate metrics - API always sends 'metrics' (plural), but form might expect 'metric' (singular)
    // Accept common metric keys from API: 'metrics', singular 'metric', and misspelling 'mtric'
    const apiMetrics = params.metrics || params.metric || params.mtric || [];

    if (Array.isArray(apiMetrics) && apiMetrics.length > 0) {
      const { mappedMetrics, extraFormKeys } = expandSavedMetricsForForm(apiMetrics, metricsKey);
      formValues[metricsKey] = mappedMetrics;
      Object.assign(formValues, extraFormKeys);
    } else {
    }

    // Populate x-axis - check for both 'X-axis' (capital) and 'x-axis' (lowercase) in params
    const xAxisValue = params['X-axis'] || params['x-axis'];
    if (xAxisValue) {
      // Check if x-axis parameter exists in form
      const xAxisParam = formData.parameters.find((p: any) => p.key === 'x-axis' || p.key === 'X-axis');
      if (xAxisParam) {
        // x-axis may be provided as an array of objects (canonical), a single object, or a string.
        let firstAxis: any = xAxisValue;
        if (Array.isArray(xAxisValue)) {
          firstAxis = xAxisValue.length > 0 ? xAxisValue[0] : null;
        }
        const colName = typeof firstAxis === 'string' ? firstAxis : (firstAxis && (firstAxis.columns || firstAxis.column || firstAxis.name));
        const alias = firstAxis && firstAxis.alias ? firstAxis.alias : undefined;
        const xAxisObj = {
          name: colName,
          alias: alias,
          type: inferType(colName),
        };
        formValues[xAxisParam.key] = xAxisObj;
      }
    }

    // Populate dimensions
    if (params.dimensions && Array.isArray(params.dimensions)) {
      formValues.dimensions = params.dimensions.map((d: any) => ({
        name: d.columns || d,
        type: inferType(d.columns || d),
      }));

      params.dimensions.forEach((dim: any, idx: number) => {
        if (dim.alias) {
          formValues[`dimensions_${idx}_alias`] = dim.alias;
        }
      });
    }

    // If this chart is a Sunburst (or the form expects a `hierarchy` param),
    // map incoming `params.dimensions` into the form `hierarchy` so the
    // ChartConfigurator shows the hierarchy dropzones in edit mode.
    const vizName = (chartData.visualization_name || chartData.visualizationName || '').toString().toLowerCase();
    const hierarchyParamForForm = formData.parameters.find((p: any) => p.key === 'hierarchy');
    if (params.dimensions && Array.isArray(params.dimensions) && (hierarchyParamForForm || vizName.includes('sunburst'))) {
      formValues.hierarchy = params.dimensions.map((d: any) => ({
        name: d.columns || d,
        type: inferType(d.columns || d),
      }));
      // also populate any per-dimension aliases into hierarchy_* if present
      params.dimensions.forEach((dim: any, idx: number) => {
        if (dim.alias) {
          formValues[`hierarchy_${idx}_alias`] = dim.alias;
        }
      });
    }

    // Populate group_by
    if (params.group_by && Array.isArray(params.group_by)) {
      formValues.group_by = params.group_by.map((g: any) => ({
        name: g.columns || g,
        type: inferType(g.columns || g),
      }));

      params.group_by.forEach((gb: any, idx: number) => {
        if (gb.aggregate) {
          formValues[`group_by_${idx}_aggregate`] = gb.aggregate;
        }
        if (gb.alias) {
          formValues[`group_by_${idx}_alias`] = gb.alias;
        }
      });
    }

    // Populate filters
    if (params.filters && Array.isArray(params.filters)) {
      formValues.filters = params.filters
        .filter((f: any) => f.columns) // Only include filters with columns defined
        .map((f: any) => ({
          name: f.columns,
          type: inferType(f.columns),
        }));

      params.filters.forEach((filter: any, idx: number) => {
        if (!filter.columns) return; // Skip if no columns
        if (filter.operator) {
          formValues[`filters_${idx}_operator`] = filter.operator;
        }
        if (filter.value) {
          formValues[`filters_${idx}_value`] = filter.value;
        }
      });
    }

    // Populate limit - check if limit parameter exists in form
    const limitParam = formData.parameters.find((p: any) => p.key === 'limit');
    if (limitParam && params.limit !== undefined && params.limit !== null) {
      formValues.limit = params.limit;
    }

    // Populate source if it exists in form
    const sourceParam = formData.parameters.find((p: any) => p.key === 'source');
    if (sourceParam && params.source) {
      formValues.source = params.source;
    }

    // Populate is_drilldown if it exists in form
    const drilldownParam = formData.parameters.find((p: any) =>
      p.key === 'is_drilldown' || p.key === 'drilldown'
    );
    if (drilldownParam && params.is_drilldown !== undefined) {
      formValues[drilldownParam.key] = params.is_drilldown;
    }

    // Populate hierarchy if it exists in form (for sunburst charts)
    const hierarchyParam = formData.parameters.find((p: any) => p.key === 'hierarchy');
    if (hierarchyParam && params.hierarchy && Array.isArray(params.hierarchy)) {
      formValues.hierarchy = params.hierarchy.map((h: any) => ({
        name: typeof h === 'string' ? h : (h.columns || h),
        type: inferType(typeof h === 'string' ? h : (h.columns || h)),
      }));
    }

    // Pivot: rows, columns, apply_metrics_on (for edit mode)
    const vizNameForPivot = (chartData.visualization_name || chartData.visualizationName || '').toString().toLowerCase();
    if (vizNameForPivot.includes('pivot')) {
      if (params.rows && Array.isArray(params.rows)) {
        formValues.rows = params.rows.map((r: any) => ({
          name: typeof r === 'string' ? r : (r.columns ?? r),
          type: inferType(typeof r === 'string' ? r : (r.columns ?? r)),
        }));
      }
      if (params.columns && Array.isArray(params.columns)) {
        formValues.columns = params.columns.map((c: any) => ({
          name: typeof c === 'string' ? c : (c.columns ?? c),
          type: inferType(typeof c === 'string' ? c : (c.columns ?? c)),
        }));
      }
      if (params.apply_metrics_on != null) {
        formValues.apply_metrics_on = params.apply_metrics_on;
      }
    }

      // Set form values in window object for ChartConfigurator to access
      if (typeof window !== 'undefined') {
        (window as any).__chartFormValues = formValues;
      }

      // Use startTransition to batch state updates and prevent UI blocking
      // This ensures the state update doesn't block the UI thread
      // React 18+ automatically batches, but startTransition marks it as non-urgent
      startTransition(() => {
        // Also set in state for ChartConfigurator to use as initialFormValues
        setEditFormValues(formValues);
      });
    } catch (error) {
      console.error('Error populating form from chart data:', error);
    } finally {
      // Reset flag after a brief delay to ensure state updates are processed
      setTimeout(() => {
        isPopulatingFormRef.current = false;
      }, 100);
    }
  }, [editChartId]);

  // Initialize from saved node payload when in workflow path (after populateFormFromChartData is defined)
  useEffect(() => {
    if (!isWorkflowPath || editChartId) return; // Skip if not in workflow or in edit mode
    
    const nodePayload = selectedNode?.data?.node?.payload;
    if (!nodePayload || !nodePayload.visualization_name) {
      initializedFromNodeRef.current = null; // Reset if no saved data
      return; // No saved data
    }
    
    // Check if we've already initialized from this node
    const nodeId = selectedNode?.id;
    if (!nodeId) return;
    
    // Prevent re-initialization if we've already loaded this node
    if (initializedFromNodeRef.current === nodeId) return;
    
    const initializeFromSavedData = async () => {
      initializedFromNodeRef.current = nodeId; // Mark as initialized
      try {
        // Get chart data - prefer chart_data.params, fallback to params
        let chartParams: any = nodePayload.chart_data?.params || nodePayload.params || {};
        // If params is a string (template), try to parse JSON, otherwise fallback to empty object
        if (typeof chartParams === 'string') {
          if (chartParams.includes('{{')) {
            chartParams = {};
          } else {
            try {
              chartParams = JSON.parse(chartParams);
            } catch {
              chartParams = {};
            }
          }
        }

        // Build a normalized formValues structure so ChartConfigurator can populate fields
        const normalizedFormValues: Record<string, any> = {};
        if (chartParams) {
          // metrics -> metric(s)
          // Accept multiple possible keys from saved params: 'metrics', singular 'metric', or misspelled 'mtric'
          const savedMetrics = Array.isArray(chartParams.metrics) ? chartParams.metrics :
            Array.isArray(chartParams.metric) ? chartParams.metric :
            Array.isArray(chartParams.mtric) ? chartParams.mtric : null;
          if (savedMetrics && savedMetrics.length > 0) {
            // Same shape as populateFormFromChartData: `{ name, type }[]` plus flat `*_operation` / `*_alias` keys
            const { mappedMetrics, extraFormKeys } = expandSavedMetricsForForm(savedMetrics, 'metrics');
            normalizedFormValues.metrics = mappedMetrics;
            normalizedFormValues.metric = mappedMetrics;
            Object.assign(normalizedFormValues, extraFormKeys);
          }

          // dimensions
          if (Array.isArray(chartParams.dimensions) && chartParams.dimensions.length > 0) {
            normalizedFormValues.dimensions = chartParams.dimensions.map((d: any) => (d && (d.columns || d.name)) ? (d.columns || d.name) : d);
          }

          // x-axis
          if (chartParams['X-axis'] || chartParams['x-axis']) {
            normalizedFormValues['x-axis'] = chartParams['X-axis'] || chartParams['x-axis'];
          }

          // filters
          if (Array.isArray(chartParams.filters) && chartParams.filters.length > 0) {
            normalizedFormValues.filters = chartParams.filters.map((f: any) => {
              if (typeof f === 'string') return f;
              return f.columns || f.name || f.field || f;
            });
          }

          if (chartParams.limit) normalizedFormValues.limit = chartParams.limit;
          if (chartParams.source) normalizedFormValues.source = chartParams.source;
          if (chartParams.is_drilldown !== undefined) normalizedFormValues.is_drilldown = chartParams.is_drilldown;
          if (chartParams.apply_metrics_on !== undefined && chartParams.apply_metrics_on !== null) {
            normalizedFormValues.apply_metrics_on = chartParams.apply_metrics_on;
          }
        }

        // Expose form values to the global window object (ChartConfigurator reads this)
        if (typeof window !== 'undefined') {
          try {
            (window as any).__chartFormValues = normalizedFormValues;
          } catch (e) {}
        }
        // Also set local state copy so effects that wait for editFormValues see them
        setEditFormValues(normalizedFormValues as any);
        const visualizationName = nodePayload.visualization_name;
        const savedFlowId = nodePayload.chart_data?.flow_id || selectedNode?.data?.flow_id || storeFlowId;
        const savedStmtDate = ''; // Always use empty stmt_date in workflow path
        
        // Set flow ID if available
        if (savedFlowId && savedFlowId !== flowId) {
          setFlowId(savedFlowId);
        }

        // NOTE: when initializing from a workflow node we avoid calling the
        // get-columns API (handleLoadColumns) because some environments
        // return errors for that endpoint. The form is populated from the
        // saved node payload (chartParams) and upstream fields are provided
        // by `UpstreamFieldsSidebar` so we do not fetch columns here.
        
        // Find and select the chart type
        if (visualizationName) {
          try {
            const chartsResponse = await getDashboardCharts();
            if (chartsResponse.status && chartsResponse.data) {
              const allCharts = chartsResponse.data.flatMap(section => section.components);
              const matchingChart = allCharts.find(
                (c) =>
                  String(c.unique_id).toLowerCase() === String(visualizationName).toLowerCase() ||
                  String(c.key).toLowerCase() === String(visualizationName).toLowerCase()
              );

              if (matchingChart) {
                const Icon = getChartIcon(matchingChart.unique_id, matchingChart.key);
                const chartType: ChartType & { uniqueId: string } = {
                  name: matchingChart.name,
                  icon: Icon,
                  uniqueId: matchingChart.unique_id,
                };
                setSelectedChart(chartType);

                // Fetch chart form
                const formResponse = await getDashboardChartForm(matchingChart.unique_id);
                if (formResponse.status && formResponse.data) {
                  const formWithApply = ensurePivotApplyParam(formResponse.data, visualizationName as string);
                  setChartFormData(formWithApply);

                  // Populate form values from saved params if present
                  if (chartParams && Object.keys(chartParams).length > 0) {
                    const mockChartData = {
                      id: `workflow-${nodeId}`,
                      params: chartParams,
                      flow_id: savedFlowId,
                      stmt_date: savedStmtDate,
                    };
                    populateFormFromChartData(mockChartData, formWithApply);
                  }
                }
              }
            }
          } catch (error) {
            console.error('Failed to load chart types for saved data:', error);
          }
        }
        
        // Set source if available in params
        if (chartParams.source && chartParams.source.trim() !== '') {
          setSelectedSource(chartParams.source);
        } else {
          // In workflow path, we don't need source (upstream nodes provide data)
          // Only try to load sources in non-workflow paths
          if (!isWorkflowPath && savedFlowId && sources.length === 0) {
            handleLoadColumns(savedFlowId, savedStmtDate).catch(err => {
            });
          } else if (isWorkflowPath) {
          }
        }

        // Auto-generate chart using saved node params after a delay to ensure
        // form values are synced and chart form is loaded
        if (chartParams && Object.keys(chartParams).length > 0 && !hasAutoGeneratedRef.current) {
          
          // Helper function to attempt chart generation
          // In workflow path: call API immediately without waiting for sources
          // In standalone path: retry logic for source availability
          const attemptChartGeneration = async (retryCount = 0, maxRetries = 10) => {
            try {
              const savedSource = chartParams.source && chartParams.source.trim() !== '' ? chartParams.source : null;
              let sourceToUse = savedSource;
              
              // WORKFLOW PATH: Use empty source immediately, no waiting
              if (isWorkflowPath) {
                sourceToUse = savedSource || '';
              } else {
                // STANDALONE PATH: Wait for sources to load
                if (!sourceToUse) {
                  // Try to trigger source loading on first attempt
                  if (retryCount === 0 && savedFlowId) {
                    await handleLoadColumns(savedFlowId, savedStmtDate).catch(() => {});
                    await new Promise(resolve => setTimeout(resolve, 300));
                  }
                  
                  // Check if sources are now available
                  const currentSources = sources.length > 0 ? sources : [];
                  const currentSelectedSource = selectedSource || (currentSources.length > 0 ? currentSources[0].name : null);
                  
                  // If still no source, retry or store pending
                  if (!currentSelectedSource && retryCount < maxRetries) {
                    setTimeout(() => attemptChartGeneration(retryCount + 1, maxRetries), 500);
                    return;
                  }
                  
                  sourceToUse = currentSelectedSource;
                  
                  if (sourceToUse && !selectedSource) {
                    setSelectedSource(sourceToUse);
                  }
                }
                
                // Store pending if no source in standalone path
                if (!sourceToUse && retryCount < maxRetries) {
                  pendingChartGenerationRef.current = {
                    flowId: savedFlowId,
                    stmtDate: savedStmtDate,
                    visualizationName: visualizationName,
                    params: chartParams
                  };
                  // Do not mark hasAutoGeneratedRef here; defer marking until actual generation
                  return;
                }
                
                sourceToUse = sourceToUse || savedSource || selectedSource || (sources.length > 0 ? sources[0].name : null);
              }
              
              // Update chartParams with the source we found
              const paramsWithSource = {
                ...chartParams,
                source: sourceToUse || chartParams.source || ''
              };
              
              const chartDataToUse: any = {
                flow_id: savedFlowId,
                stmt_date: savedStmtDate,
                visualization_name: visualizationName, // Include visualization_name for chart type detection
                params: paramsWithSource,
              };

              // Ensure node_id is included when possible (critical for workflow path without source)
              if (!chartDataToUse.node_id) {
                const savedNodeId = nodePayload.chart_data?.node_id;
                if (savedNodeId) {
                  chartDataToUse.node_id = savedNodeId;
                } else if (nodeId && savedFlowId) {
                  chartDataToUse.node_id = savedFlowId + '_' + nodeId;
                } else if (nid && savedFlowId) {
                  chartDataToUse.node_id = savedFlowId + '_' + nid;
                }
              }

              // In workflow path, source is optional (node_id provides data)
              // In non-workflow path, source is required
              const hasSource = chartDataToUse.params?.source && chartDataToUse.params.source.trim() !== '';
              const canGenerateChart = chartDataToUse.params && 
                Object.keys(chartDataToUse.params).length > 0 && 
                savedFlowId && 
                visualizationName && 
                (hasSource || (isWorkflowPath && chartDataToUse.node_id));
              
              if (canGenerateChart) {
                await generateChartFromEditData(chartDataToUse);
              } else {
                hasAutoGeneratedRef.current = false; // Reset if we can't generate
              }
            } catch (error) {
              hasAutoGeneratedRef.current = false; // Reset on error to allow retry
            }
          };
          
          // Use a longer delay to ensure everything is ready, then attempt generation
          setTimeout(() => attemptChartGeneration(), 1500);
        }
      } catch (error) {
        initializedFromNodeRef.current = null; // Reset on error to allow retry
      }
    };
    
    initializeFromSavedData();
  }, [isWorkflowPath, selectedNode?.id, selectedNode?.data?.node?.payload?.visualization_name, editChartId, storeFlowId, flowId, populateFormFromChartData, handleLoadColumns]);

  // Watch for sources to load and trigger pending chart generation (standalone path only)
  useEffect(() => {
    // Skip in workflow path - we don't wait for sources there
    if (isWorkflowPath) return;
    
    const pending = pendingChartGenerationRef.current;
    if (pending && sources.length > 0) {
      const sourceToUse = selectedSource || sources[0]?.name;
      if (sourceToUse && !hasAutoGeneratedRef.current) {
        // CRITICAL: set selectedSource if not already set
        if (!selectedSource && sources[0]?.name) {
          setSelectedSource(sources[0].name);
        }

        hasAutoGeneratedRef.current = true;
        pendingChartGenerationRef.current = null; // Clear pending

        const paramsWithSource = {
          ...pending.params,
          source: sourceToUse
        };

        const chartDataToUse: any = {
          flow_id: pending.flowId,
          stmt_date: pending.stmtDate,
          visualization_name: pending.visualizationName,
          params: paramsWithSource,
        };

        // Add node_id if available
        const nodeId = selectedNode?.id;
        let upstreamNodes: any[] = [];
        try {
          const w = useFlowStore.getState().currentWorkflow;
          if (w?.data?.nodes && w?.data?.edges) upstreamNodes = useFlowStore.getState().getUpstreamNodes(selectedNode?.id || '');
        } catch (_) {}
        const nid = upstreamNodes?.[0]?.data?.current_node_id || 
                    upstreamNodes?.[0]?.data?.node_id;
        if (!chartDataToUse.node_id) {
          const savedNodeId = selectedNode?.data?.node?.payload?.chart_data?.node_id;
          if (savedNodeId) {
            chartDataToUse.node_id = savedNodeId;
          } else if (nodeId && pending.flowId) {
            chartDataToUse.node_id = pending.flowId + '_' + nodeId;
          } else if (nid && pending.flowId) {
            chartDataToUse.node_id = pending.flowId + '_' + nid;
          }
        }

        generateChartFromEditData(chartDataToUse).catch(err => {
          hasAutoGeneratedRef.current = false;
        });
      }
    }
  }, [sources, selectedSource, selectedNode]);

  // Generate chart directly from edit chart data
  const generateChartFromEditData = async (chartData: any) => {
    if (!chartData || !chartData.params) return;

    if (typeof console !== 'undefined') {
      console.log('ChartFormulator: generateChartFromEditData invoked for chart', chartData?.id || chartData?.visualization_name);
    }

    // Use flow_id from chartData if state flowId is not set yet (for initialization)
    const effectiveFlowId = chartData.flow_id || flowId;
    const isAnalyticsStudioChart =
      analyticsStudioInit?.sourceType === 'database' || chartData.source_type === 'database';
    if (!effectiveFlowId && !isAnalyticsStudioChart) {
      return;
    }

    // Use visualization_name from chartData to get chart type if selectedChart is not set yet
    const effectiveVisualizationName = chartData.visualization_name;
    
    // If selectedChart is not set, we can still generate if we have visualization_name
    // The visualization_name is what's actually needed for the API call
    if (!selectedChart && !effectiveVisualizationName) {
    }
    
    // Create a minimal chart object if needed (for API call, we mainly need visualization_name)
    const effectiveSelectedChart = selectedChart || (effectiveVisualizationName ? {
      uniqueId: effectiveVisualizationName,
      name: effectiveVisualizationName,
    } : null);

    // Use source from params, or from sources array, or from selectedSource state
    // In workflow path, source can be empty (upstream nodes provide data via node_id)
    const sourceToUse = chartData.params?.source || sources[0]?.name || selectedSource || '';
    
    // Only require source in non-workflow path
    if (!isWorkflowPath && (!sourceToUse || sourceToUse.trim() === '')) {
      return;
    }
    
    // In workflow path, empty source is OK if we have node_id
    if (isWorkflowPath && (!sourceToUse || sourceToUse.trim() === '')) {
      // Using upstream nodes for data via node_id
    }

    setIsLoadingChart(true);
    try {
      // View-only: always create API. Workflow path: always create here (preview / rehydrate from
      // node payload) — never auto-call update_chart; user persists via ChartSelector "Update Chart".
      // Standalone route edit (`?edit=` / :chartId`): use update when a persisted id exists.
      const isEditMode =
        !isWorkflowPath && !!persistedChartIdForApi && !isViewOnly;
      
      // In workflow path, empty source is allowed (upstream nodes provide data via node_id)
      // Only require source in non-workflow path
      if (!isWorkflowPath && (!sourceToUse || sourceToUse.trim() === '')) {
        setIsLoadingChart(false);
        return;
      }
      
      const payload: CreateChartPayload | UpdateChartPayload = {
        flow_id: effectiveFlowId,
        visualization_name: effectiveVisualizationName || effectiveSelectedChart?.uniqueId || effectiveSelectedChart?.name?.toLowerCase().replace(/\s+/g, '_') || '',
        stmt_date: isWorkflowPath ? '' : (chartData.stmt_date || ''),
        params: {
          source: sourceToUse,
          limit: (chartData.params?.limit !== undefined && chartData.params?.limit !== null && chartData.params?.limit !== '') ? Number(chartData.params.limit) : undefined,
          is_drilldown: chartData.params?.is_drilldown || false,
        },
      };
      
      // chart_id will be added outside the payload during API call

      // If we're on a workflow path, include the upstream node id so the backend
      // can resolve node-specific data. Use any-cast because CreateChartPayload
      // may not include node_id in its type definition.
      // Prefer node_id from chartData if available (for saved charts), otherwise build it
      if (isWorkflowPath) {
        if (chartData.node_id) {
          (payload as any).node_id = chartData.node_id;
          (payload as any).unique_id = chartData.node_id;
        } else if (nid) {
          (payload as any).node_id = payload.flow_id + '_' + nid;
          (payload as any).unique_id = payload.flow_id + '_' + nid;
        }
      }

      // Add metrics if present (accept metrics, metric, or misspelled 'mtric')
      const srcMetrics = chartData.params?.metrics || chartData.params?.metric || chartData.params?.mtric;
      if (srcMetrics && Array.isArray(srcMetrics)) {
        payload.params.metrics = srcMetrics.map((m: any) => ({
          columns: m.columns,
          operation: m.operation || 'COUNT',
          ...(m.alias && { alias: m.alias }),
        }));
      }

      // Add dimensions if present
      if (chartData.params?.dimensions && Array.isArray(chartData.params.dimensions)) {
        payload.params.dimensions = chartData.params.dimensions.map((d: any) => ({
          columns: typeof d === 'string' ? d : d.columns,
          ...(typeof d === 'object' && d.alias && { alias: d.alias }),
        }));
      }

      // Add X-axis only for visualizations that use it (saved pie/bar mismatches or stale keys)
      if (
        visualizationShouldIncludeStoredXAxis(effectiveVisualizationName) &&
        chartData.params?.['X-axis'] !== undefined &&
        chartData.params['X-axis'] !== null &&
        chartData.params['X-axis'] !== ''
      ) {
        const rawXAxis = chartData.params['X-axis'];
        const normalizeEntry = (entry: any) => {
          if (!entry) return null;
          if (typeof entry === 'string') return { columns: entry };
          if (typeof entry === 'object') {
            // support both { columns } and { name } and alias
            const col = entry.columns ?? entry.name ?? entry.field ?? null;
            if (!col) return null;
            return {
              columns: col,
              ...(entry.alias && { alias: entry.alias }),
            };
          }
          return null;
        };

        if (Array.isArray(rawXAxis)) {
          const arr = rawXAxis.map(normalizeEntry).filter(Boolean);
          if (arr.length > 0) payload.params['X-axis'] = arr;
        } else {
          const item = normalizeEntry(rawXAxis);
          if (item) payload.params['X-axis'] = [item];
        }
      }

      // Add filters if present (ensure it's always an array, even if empty)
      if (chartData.params?.filters && Array.isArray(chartData.params.filters)) {
        payload.params.filters = chartData.params.filters
          .filter((f: any) => f && f.columns) // Only include filters with columns defined
          .map((f: any) => ({
            columns: typeof f === 'string' ? f : f.columns,
            operator: typeof f === 'object' ? f.operator : '=',
            value: typeof f === 'object' ? f.value : f,
          }));
      } else {
        payload.params.filters = [];
      }

      // Pivot: rows, columns, apply_metrics_on (for edit/view mode)
      const isPivotChartEdit = (effectiveVisualizationName || '').toString().toLowerCase().includes('pivot');
      if (isPivotChartEdit && chartData.params) {
        if (Array.isArray(chartData.params.rows)) {
          (payload.params as any).rows = chartData.params.rows.map((r: any) => (typeof r === 'string' ? r : r?.columns ?? r));
        }
        if (Array.isArray(chartData.params.columns)) {
          (payload.params as any).columns = chartData.params.columns.map((c: any) => (typeof c === 'string' ? c : c?.columns ?? c));
        }
        if (chartData.params.apply_metrics_on != null) {
          (payload.params as any).apply_metrics_on = chartData.params.apply_metrics_on;
        }
      }

      // Sunburst: hierarchy (levels) from params – send as array of column name strings
      if ((effectiveVisualizationName || '').toString().toLowerCase().includes('sunburst') && chartData.params?.hierarchy) {
        const h = chartData.params.hierarchy;
        const hierarchyArr = Array.isArray(h) ? h : (h ? [h] : []);
        const hierarchyColumnNames = hierarchyArr.map((x: any) => (typeof x === 'string' ? x : x?.columns ?? x)).filter(Boolean);
        (payload.params as any).hierarchy = hierarchyColumnNames;
        currentHierarchyRef.current = hierarchyColumnNames.length > 0 ? hierarchyColumnNames : null;
      }

      // Send payload with proper structure for update vs create
      const action = isEditMode ? 'update_chart' : 'create_chart';
      attachCustomizationsToPayload(
        payload,
        customizationOptions,
        getSavedChartCustomizations(chartData),
        effectiveVisualizationName,
      );
      payload.params = stripChartFormAuxKeysFromParams(payload.params as any) as typeof payload.params;

      const sourceForPayload = selectedSource || sourceToUse || null;
      const requestPayload = applyAnalyticsStudioPayloadForSavedChart(
        payload,
        chartData,
        sourceForPayload,
        analyticsStudioInit,
      );

      lastChartPayloadRef.current = requestPayload;

      const previousUniqueIdFromEdit = isEditMode
        ? String(
            chartData?.unique_id ??
              chartData?.node_id ??
              (payload as any).unique_id ??
              (payload as any).node_id ??
              '',
          ).trim()
        : '';

      const response = isEditMode 
        ? await updateChart({
            chart_id: persistedChartIdForApi,
            payload: {
              data: {
                ...requestPayload,
                id: persistedChartIdForApi,
                ...(previousUniqueIdFromEdit ? { previous_unique_id: previousUniqueIdFromEdit } : {}),
              },
              actions: action,
              stmt_date: requestPayload.stmt_date || ''
            }
          } as any)
        : await createChart(requestPayload as any);
        if (response.status && response.data) {
        const resp = response as any;
        // Save chart payload data to node for execute button
        if (isWorkflowPath) {
          let selectedNode: { id: string; data?: any } | undefined;
          try {
            const w = useFlowStore.getState().currentWorkflow;
            if (w?.data?.nodes) selectedNode = useFlowStore.getState().getSelectedNode();
          } catch (_) {}
          if (selectedNode && selectedNode.data?.node?.payload) {
            const nodePayload = selectedNode.data.node.payload;
            nodePayload.chart_data = toWorkflowNodeChartDataSnapshot(payload);
            nodePayload.visualization_name = payload.visualization_name || (selectedChart?.uniqueId || selectedChart?.name?.toLowerCase().replace(/\s+/g, '_')) || nodePayload.visualization_name || '';
            nodePayload.chart_name = payload.chart_name || selectedChart?.name || nodePayload.chart_name || '';
            nodePayload.chart_stmt_date = chartData.stmt_date || '';
            useFlowStore.getState().updateNodeData(selectedNode.id, selectedNode.data);
          }
        }

        // Pivot response: rows, columns, data (object) – set rawChartResponse and flatten for grid
        const isPivotResponse = resp.rows && resp.columns && resp.data && typeof resp.data === 'object' && !Array.isArray(resp.data);
        if (isPivotResponse) {
          setRawChartResponse(resp);
          const rows = Array.isArray(resp.rows) ? resp.rows : Object.values(resp.rows || {});
          let norm: Record<string, any> = resp.data;
          if (Object.keys(norm).length === 1 && norm[Object.keys(norm)[0]] && typeof norm[Object.keys(norm)[0]] === 'object') {
            norm = norm[Object.keys(norm)[0]];
          }
          const rowDimSet = new Set(rows);
          const metricKeys = Object.keys(norm).filter((k: string) => !rowDimSet.has(k));
          const firstRowDim = rows[0];
          const rowIndexSource = norm[firstRowDim] ?? (metricKeys[0] ? norm[metricKeys[0]] : null);
          const rowIndices = rowIndexSource && typeof rowIndexSource === 'object' ? Object.keys(rowIndexSource).sort((a, b) => Number(a) - Number(b)) : [];
          const flattened: Record<string, any>[] = [];
          for (const idx of rowIndices) {
            const row: Record<string, any> = {};
            for (const dim of rows) {
              const colData = norm[dim];
              row[dim] = colData && typeof colData === 'object' && idx in colData ? colData[idx] : '';
            }
            for (const colKey of metricKeys) {
              const colData = norm[colKey];
              row[colKey] = colData && typeof colData === 'object' && idx in colData ? colData[idx] : null;
            }
            flattened.push(row);
          }
          setStreamedData(flattened.length > 0 ? flattened : [resp]);
          setChartData([]);
          toast.success(isEditMode ? 'Chart updated successfully' : 'Chart loaded successfully');
          return;
        }

        // Sunburst/other: set rawChartResponse so hierarchy/dimensions are passed to chart
        if (resp.columns || resp.dimensions || resp.hierarchy) {
          setRawChartResponse(resp);
        }

        // Transform API response data to format expected by AmChart (array data)
        const respXAxis = resp.x_axis || resp.xAxis || null;
        const responseData = Array.isArray(resp.data) ? resp.data : [];
        const vizHint =
          selectedChart?.uniqueId ||
          selectedChart?.name ||
          resp?.visualization_name ||
          '';
        const responseMetrics = resp.metrics || payload?.params?.metrics;

        const transformedData = isBigNumberVisualization(vizHint)
          ? transformBigNumberChartData(responseData, {
              columns: resp?.columns as string[] | undefined,
              x_axis: respXAxis,
              metrics: Array.isArray(responseMetrics) ? responseMetrics : undefined,
            })
          : responseData
          .map((item: any, index: number) => {
            const keys = Object.keys(item);

            const isAggregatedColumn = (key: string) => key.includes('(') && key.includes(')');

            // 1) Prefer aggregated columns like "AMOUNT(SUM)"
            const aggregatedKey = keys.find((key) => {
              if (!isAggregatedColumn(key)) return false;
              const val = item[key];
              return typeof val === 'number' && !isNaN(val);
            });

            // 2) Fallback: first numeric column (exclude x_axis if provided)
            let valueKey = aggregatedKey;
            if (!valueKey) {
              valueKey = keys.find((key) => {
                if (respXAxis && key === respXAxis) return false;
                const val = item[key];
                return typeof val === 'number' && !isNaN(val);
              });
            }

            if (!valueKey && index === 0) {
              console.warn('ChartFormulator: No aggregated or numeric value column found. Available keys:', keys, 'Item:', item);
            }

            // Determine category: use ALL dimension columns (including numeric IDs like p_status)
            // Dimension = non-aggregated columns; show all values, use "—" for null
            const apiColumns = (resp?.columns as string[] | undefined) || keys;
            const dimensionKeys = apiColumns.filter(
              (k) => !isAggregatedColumn(k) && k !== 'value' && k !== valueKey
            );
            let category: string;
            if (dimensionKeys.length > 0) {
              category = dimensionKeys
                .map((k) => {
                  const v = item[k];
                  return v === null || v === undefined ? '—' : String(v).trim();
                })
                .filter((v) => v !== '')
                .join(', ') || (respXAxis && item[respXAxis] != null ? String(item[respXAxis]) : `Item ${index + 1}`);
            } else if (respXAxis && item[respXAxis] !== undefined && item[respXAxis] !== null) {
              category = String(item[respXAxis]);
            } else if (valueKey) {
              const baseName = valueKey.replace(/\(.*\)/, '').trim();
              category = baseName || `Value ${index + 1}`;
            } else {
              category = `Item ${index + 1}`;
            }

            const value = valueKey ? Number(item[valueKey]) : NaN;

            // Keep zeros; only drop NaN / non-numeric entries
            if (!valueKey || value === null || isNaN(value)) {
              return null;
            }

            return {
              category,
              value,
              originalData: item,
            };
          })
          .filter((item: any) => item !== null); // Filter out null items
        setChartData(transformedData);
        toast.success(isEditMode ? 'Chart updated successfully' : 'Chart loaded successfully');
      }
    } catch (error) {
      toast.error('Failed to generate chart');
    } finally {
      setIsLoadingChart(false);
    }
  };

  const handleSelectChart = async (chart: ChartType & { uniqueId: string }) => {
    // Clear previous chart data and form
    setChartData([]);
    setChartConfig({
      x: null,
      y: null,
      operator: null,
      color: null,
      column: null,
      row: null,
    });
    setChartFormData(null);

    // When switching chart selector in creation mode (not edit, not view-only),
    // suppress any automatic generation and clear streamed/raw responses so
    // the canvas remains empty until the user explicitly generates.
    if (!persistedChartIdForApi && !isViewOnly) {
      try {
        hasAutoGeneratedRef.current = true; // prevent auto-gen effects
      } catch (e) {
        /* ignore */
      }
      setRawChartResponse(null);
      setStreamedData([]);
      pendingChunksRef.current = [];
      hasFirstDataRef.current = false;
      setChartData([]);
      setDrilldownStack([]);
      setDrilldownModeEnabled(false);
      setDrillthroughModeEnabled(false);
      setShowEditChartData(false);
      setCopiedJson(false);
      setEditFormValues(undefined);
    }

    // Set the new selected chart
    setSelectedChart(chart);

    // Fetch chart form configuration
    if (chart.uniqueId) {
      setIsLoadingForm(true);
      try {
        const formResponse = await getDashboardChartForm(chart.uniqueId);
        if (formResponse.status && formResponse.data) {
          const formWithApply = ensurePivotApplyParam(formResponse.data, chart.uniqueId);
          setChartFormData(formWithApply);
        } else {
          toast.error('Failed to load chart form');
        }
      } catch (error) {
        toast.error('Failed to load chart form');
      } finally {
        setIsLoadingForm(false);
      }
    }
  };

  const handleClearChart = () => {
    setSelectedChart(null);
    setChartConfig(null);
    setDrilldownLevels([]);
    setDrilldownStack([]);
    setDrilldownModeEnabled(false);
    setDrillthroughModeEnabled(false);
  };

  const handleNavigateDrilldown = (index: number) => {
    if (index < 0 || index > drilldownStack.length) return;
    if (index === drilldownStack.length) return; // already at current level
    const levelData = drilldownStack[index];
    if (!levelData) return;
    setStreamedData(levelData.streamedData ?? []);
    setRawChartResponse(levelData.rawChartResponse ?? null);
    setDrilldownStack((prev) => prev.slice(0, index));
    setDrilldownLevels((prev) => prev.slice(0, index));
    if (index === 0) {
      setDrilldownFilters([]);
    } else {
      setDrilldownFilters(
        drilldownLevels
          .slice(0, index)
          .flatMap((l) => l.drill_filters)
          .map((f) => ({ field: f.column, value: f.value }))
      );
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (isViewOnly) return;
    setActiveId(event.active.id as string);
    // Store the active drag payload so DragOverlay and other UI can access the
    // real field object (avoids brittle id parsing when node ids contain "-")
    if (typeof window !== 'undefined') {
      try {
        (window as any).___dndActiveField = event.active.data?.current?.field || event.active.data?.current;
      } catch (e) {
        (window as any).___dndActiveField = undefined;
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (isViewOnly) return;
    setActiveId(null);
    // Clear transient payload saved on drag start
    if (typeof window !== 'undefined') {
      try {
        (window as any).___dndActiveField = undefined;
      } catch (e) {}
    }
    const { active, over } = event;

    if (over) {
      
    }

    if (!over) {
      return; 
    }
    

    if (
      over.id === 'dashboard-drop-zone' &&
      active.data.current?.type === 'chart'
    ) {
      const chartId = active.id.toString();
      const chartToAdd = savedCharts.find((c) => c.id === chartId);
      if (chartToAdd && !dashboardCharts.find((c) => c.id === chartId)) {
        setDashboardCharts((prev) => [...prev, chartToAdd]);
      }
      return;
    }

    // Handle drag and drop for dynamic form (chartFormData)
    if (chartFormData?.parameters && active.data.current?.type === 'field') {
      const fieldData = active.data.current.field as any;

      // Robust field extraction that works for both DataFieldsSidebar and UpstreamFieldsSidebar
      let fieldName: string;
      let fieldType: string;

      if (typeof fieldData === 'string') {
        fieldName = fieldData;
        fieldType = 'string';
      } else if (fieldData && typeof fieldData === 'object') {
        // Try multiple properties to extract the name (handles both upstream and data fields)
        fieldName = fieldData.name || fieldData.field || fieldData.columns || String(fieldData);
        fieldType = fieldData.type || 'string';
      } else {
        // Fallback
        fieldName = typeof fieldData === 'string' ? fieldData : (fieldData?.name || String(fieldData));
        fieldType = 'string';
      }

      const field: Field = {
        name: fieldName,
        type: fieldType
      };
      const dropZoneId = over.id.toString();
      const params = chartFormData.parameters as Array<{ key: string; type?: string; label?: string }>;

      // Normalize ids for matching
      const normalizedId = dropZoneId.toLowerCase();
      const baseKey = dropZoneId.replace(/_\d+$/, '');
      const normalizedBase = baseKey.toLowerCase();

      // 1) exact key match
      let targetKey: string | null = params.find(p => p.key === dropZoneId)?.key || null;

      // 2) base key match (strip trailing index)
      if (!targetKey) {
        targetKey = params.find(p => p.key === baseKey)?.key || null;
      }

      // 3) match by label containing the drop id/base id (handles differently-named params)
      if (!targetKey) {
        const byLabel = params.find(p => (p.label || '').toLowerCase().includes(normalizedId) || (p.label || '').toLowerCase().includes(normalizedBase));
        if (byLabel?.key) targetKey = byLabel.key;
      }

      // 4) preferred well-known keys
      if (!targetKey) {
        const preferred = ['dimensions', 'metrics', 'filters', 'x-axis'];
        const found = preferred.find(k => params.some(p => p.key.toLowerCase() === k));
        if (found) targetKey = params.find(p => p.key.toLowerCase() === found)!.key;
      }

      // 5) fall back to the first multi-drop parameter
      if (!targetKey) {
        const multi = params.find(p => String(p.type).includes('drag_and_drop_or_select_multiple'));
        if (multi?.key) targetKey = multi.key;
      }

      if (targetKey) {
        // Prevent assigning the same column to both X-axis and dimensions
        try {
          const existingValues = (window as any).__chartFormValues || {};
          const droppedColumnName = extractColumnName(fieldData);
          const isTargetXAxis = (targetKey || '').toLowerCase().includes('x-axis') || (targetKey || '').toLowerCase() === 'xaxis' || (targetKey || '').toLowerCase() === 'x';
          const isTargetDimensions = (targetKey || '').toLowerCase().includes('dimension') || (targetKey || '').toLowerCase() === 'dimensions';

          const normDropped = (droppedColumnName || '').toString().toLowerCase();

          const dims = existingValues.dimensions || existingValues['dimensions'] || existingValues['dimension'] || [];
          const dimsArr = Array.isArray(dims) ? dims : (dims ? [dims] : []);
          const dimsNormalized = dimsArr.map((d: any) => ('' + extractColumnName(d || '')).toLowerCase());

          const xAxisVal = existingValues['x-axis'] || existingValues['X-axis'] || existingValues.x || null;
          const xAxisName = extractColumnName(Array.isArray(xAxisVal) ? xAxisVal[0] : xAxisVal);

          if (isTargetXAxis && normDropped && dimsNormalized.includes(normDropped)) {
            toast.info('This column is already used as a dimension. X-axis and dimensions must be different.');
            return;
          }

          if (isTargetDimensions && normDropped && xAxisName && ('' + xAxisName).toLowerCase() === normDropped) {
            toast.info('This column is already used as the X-axis. X-axis and dimensions must be different.');
            return;
          }
        } catch (e) {
          // ignore and fallthrough
        }

        if (typeof window !== 'undefined' && (window as any).__chartFormUpdate) {
          (window as any).__chartFormUpdate(targetKey, field);
          return;
        }
      } else {
      }
    }

    if (chartConfig && view === 'formulator') {
      const zone = over.id as keyof Config;
      if (active.data.current?.type === 'field') {
        const field = active.data.current.field as Field;
        if (Object.keys(chartConfig).includes(zone)) {
          setChartConfig((prev) => ({ ...prev!, [zone]: field }));
        }
      } else if (active.data.current?.type === 'operator') {
        const operator = active.data.current.operator as string;
        if (zone === 'operator') {
          setChartConfig((prev) => ({ ...prev!, operator: operator }));
        }
      }
    }
  };

  const handleRemoveChartFromDashboard = (chartId: string) => {
    if (isViewOnly) return;
    setDashboardCharts((prev) => prev.filter((c) => c.id !== chartId));
  };

  const handleInitiateSaveChart = () => {
    if (isViewOnly) return;
    if (canRenderChart) {
      setNewChartName(selectedChart?.name || 'New Chart');
      setIsSaveChartDialogOpen(true);
    }
  };

  const handleConfirmSaveChart = () => {
    if (isViewOnly) return;
    if (
      !newChartName ||
      !selectedChart ||
      !chartConfig ||
      !activeThreadId
    ) {
      return;
    }

    const newSavedChart: SavedChart = {
      id: `chart-${Date.now()}`,
      name: newChartName,
      chartType: selectedChart,
      config: chartConfig,
      threadId: activeThreadId,
      filters: drilldownFilters,
      modified: new Date(),
      creator: 'VC',
      creatorAvatar: `https://i.pravatar.cc/150?u=${Date.now()}`,
    };

    setSavedCharts((prev) => [newSavedChart, ...prev]);
    setIsSaveChartDialogOpen(false);
    setNewChartName('');
    setView('dashboard');
  };

  const handleMaximizeChart = (chart: SavedChart) => {
    setMaximizedChart(chart);
    setEditingChartName(chart.name);
    setIsLegendVisible(false);
  };

  const handleCloseMaximize = () => {
    setMaximizedChart(null);
  };

  const handleUpdateChartName = () => {
    if (!maximizedChart || !editingChartName) return;

    const updatedChart = { ...maximizedChart, name: editingChartName };

    setSavedCharts((prev) =>
      prev.map((c) => (c.id === updatedChart.id ? updatedChart : c))
    );
    setDashboardCharts((prev) =>
      prev.map((c) => (c.id === updatedChart.id ? updatedChart : c))
    );

    handleCloseMaximize();
  };

  const handleDeleteSavedChart = (chartId: string) => {
    if (isViewOnly) return;
    setSavedCharts((prev) => prev.filter((c) => c.id !== chartId));
    setDashboardCharts((prev) => prev.filter((c) => c.id !== chartId));
  };

  // Get fields aggregated from all sources to support multi-source dragging
  const currentFields = useMemo(() => {
    const fields: { name: string; type: 'string' | 'number' | 'date' }[] = [];
    for (const s of sources) {
      for (const col of s.columns) {
        fields.push({ name: col, type: inferFieldType(col) });
      }
    }
    // Include upstream node columns so upstream drags can be resolved by name
    for (const n of upstreamNodes || []) {
      const cols = getUpstreamNodeFieldColumns(n);
      for (const col of cols) {
        // avoid duplicates
        if (!fields.find((f) => f.name === col)) {
          fields.push({ name: col, type: inferFieldType(col) });
        }
      }
    }
    return fields;
  }, [sources, upstreamNodes]);

  /** Columns available from previous/upstream nodes (workflow path drilldown picker source). */
  const workflowDrilldownColumns = useMemo(() => {
    const seen = new Set<string>();
    const cols: string[] = [];
    for (const n of upstreamNodes || []) {
      const nodeCols = getUpstreamNodeFieldColumns(n);
      for (const col of nodeCols) {
        const name = String(col || '').trim();
        if (!name || seen.has(name)) continue;
        seen.add(name);
        cols.push(name);
      }
    }
    return cols;
  }, [upstreamNodes]);

  /** Drilldown source list shown in dialog. In workflow path, use previous node columns. */
  const drilldownDialogSources = useMemo(() => {
    if (isWorkflowPath) {
      return workflowDrilldownColumns.length > 0
        ? [{ name: 'Previous node', columns: workflowDrilldownColumns }]
        : [];
    }
    return sources;
  }, [isWorkflowPath, workflowDrilldownColumns, sources]);

  const filteredData = useMemo(() => {
    // For now, return empty array as we don't have actual data
    // This can be enhanced later when we have data API
    return [];
  }, [drilldownFilters]);

  const canRenderChart =
    selectedChart &&
    selectedSource &&
    chartConfig &&
    chartConfig.x &&
    chartConfig.operator;

  const maximizedChartThread = maximizedChart
    ? threads.find((t) => t.id === maximizedChart.threadId)
    : null;

  const maximizedChartFilteredData = useMemo(() => {
    if (!maximizedChart || !maximizedChartThread) return [];

    return maximizedChart.filters.reduce((data, filter) => {
      return data.filter((row) => row[filter.field] === filter.value);
    }, maximizedChartThread.data);
  }, [maximizedChart, maximizedChartThread]);

  const getActiveDraggable = () => {
    if (!activeId) return null;

    // Find the field being dragged
    if (activeId.toString().startsWith('field-')) {
      // Prefer using payload if provided by DraggableItem
      const payloadField = (typeof window !== 'undefined' && (window as any).___dndActiveField) ? (window as any).___dndActiveField : undefined;
      const idRest = activeId.toString().slice('field-'.length);
      // idRest format can be either "source-field" or "nodeId-field" where nodeId may contain '-'.
      // Use the last segment as the column name to be robust to hyphenated node ids.
      const parts = idRest.split('-');
      const fieldName = parts.length > 1 ? parts[parts.length - 1] : idRest;
      const field = payloadField || currentFields.find((f) => f.name === fieldName);
      if (field) {
        // Get field type icon component
        const FieldIcon = ({ type }: { type: string }) => {
          switch (type) {
            case 'string':
              return <Type className="h-4 w-4 text-muted-foreground" />;
            case 'number':
              return <Hash className="h-4 w-4 text-muted-foreground" />;
            case 'date':
              return <CalendarDays className="h-4 w-4 text-muted-foreground" />;
            default:
              return <Type className="h-4 w-4 text-muted-foreground" />;
          }
        };

        return (
          <div className="flex items-center gap-2 rounded-md border border-primary bg-background p-2 shadow-lg">
            <FieldIcon type={field.type} />
            <span className="text-sm font-medium">{formatFieldName(field.name)}</span>
          </div>
        );
      }
    }

    // Find the operator being dragged
    if (activeId.toString().startsWith('operator-')) {
      const operator = activeId.toString().replace('operator-', '');
      return (
        <div className="rounded-md border border-primary bg-secondary px-2 py-1 shadow-lg">
          <span className="text-sm font-medium">{operator}</span>
        </div>
      );
    }

    return null;
  };

  // Helper function to build chart payload
  const buildChartPayload = useCallback((useUpdateApi: boolean = false): CreateChartPayload | UpdateChartPayload => {
    const effectiveFlowId = isWorkflowPath ? (storeFlowId ?? flowId) : flowId;
    const payload: CreateChartPayload | UpdateChartPayload = {
      flow_id: effectiveFlowId,
      stmt_date: isWorkflowPath ? '' : (editChartData?.stmt_date || ''),
      // For updates prefer the previously saved chart name (from editChartData) so we don't overwrite
      // the original saved name when the user selects a different chart type in the selector.
      chart_name: useUpdateApi ? (editChartData?.chart_name || selectedChart?.name) : (selectedChart?.name || 'Untitled Chart'),
      visualization_name: selectedChart?.uniqueId || selectedChart?.name.toLowerCase().replace(/\s+/g, '_') || '',
      params: {
        source: selectedSource || "",
        limit: undefined,
        is_drilldown: false,
      },
    };

    // Do not embed chart_id inside the nested payload here.
    // The update APIs expect `chart_id` at the top level with a wrapped `payload`.

    // Include upstream node id when generating charts from a workflow context
    if (isWorkflowPath && nid) {
      (payload as any).node_id = effectiveFlowId + '_' + nid;
      // Also include `unique_id` for workflow payloads (mirror node_id)
      (payload as any).unique_id = effectiveFlowId + '_' + nid;
    }

    return payload;
  }, [isWorkflowPath, storeFlowId, flowId, editChartData, selectedChart, selectedSource, persistedChartIdForApi, nid]);

  // Helper function to validate form and build full payload
  const validateAndBuildPayload = useCallback((useUpdateApi: boolean = false, overrideFormValues?: any) => {
    // Get form values from override or ChartConfigurator
    const formValues = overrideFormValues || (window as any).__chartFormValues || {};

    // Get form parameters to check which fields are actually present
    // Use chartFormData for params source of truth if available, falling back to window
    const formParams = chartFormData?.parameters || (window as any).__chartFormParams || [];

    // Track validation errors
    const errors = new Set<string>();
    let errorMessage = '';

    const chartType = selectedChart.uniqueId?.toLowerCase() || selectedChart.name.toLowerCase();
    const isPivotChart = chartType.includes('pivot') || selectedChart.uniqueId === 'pivot_table';
    const formHasXAxisField = formParams.some(
      (p: any) => p.key === 'x-axis' || p.key === 'X-axis'
    );
    const formHasDimensionsField = formParams.some((p: any) => p.key === 'dimensions');

    // 1. For pivot chart: require rows, columns, metrics. Otherwise require dimensions OR x-axis
    if (isPivotChart) {
      const hasRows = formValues.rows && (
        (Array.isArray(formValues.rows) && formValues.rows.length > 0) ||
        (!Array.isArray(formValues.rows) && formValues.rows)
      );
      const hasColumns = formValues.columns && (
        (Array.isArray(formValues.columns) && formValues.columns.length > 0) ||
        (!Array.isArray(formValues.columns) && formValues.columns)
      );
      if (!hasRows) {
        errors.add('rows');
        errorMessage = errorMessage ? `${errorMessage} and Rows is required` : 'Rows is required';
      }
      if (!hasColumns) {
        errors.add('columns');
        errorMessage = errorMessage ? `${errorMessage} and Columns is required` : 'Columns is required';
      }
    } else {
      const hasDimensionsParam = formParams.some((p: any) => p.key === 'dimensions' || p.key === 'x-axis');
      if (hasDimensionsParam) {
        const hasDimensions = formValues.dimensions && (
          (Array.isArray(formValues.dimensions) && formValues.dimensions.length > 0) ||
          (!Array.isArray(formValues.dimensions) && formValues.dimensions)
        );
        const hasXAxis = formValues['x-axis'] && (
          (Array.isArray(formValues['x-axis']) && formValues['x-axis'].length > 0) ||
          (!Array.isArray(formValues['x-axis']) && formValues['x-axis'])
        );

        if (!hasDimensions && !hasXAxis) {
          const dimensionsParam = formParams.find((p: any) => p.key === 'dimensions' || p.key === 'x-axis');
          const fieldName = dimensionsParam?.label || dimensionsParam?.key || 'Dimensions or X-axis';
          errors.add(dimensionsParam?.key || 'dimensions');
          errorMessage = `${fieldName} is required`;
        }
      }
    }

    // 2. Check for metric OR metrics (depending on chart type)
    const hasMetric = formValues.metric && (
      (Array.isArray(formValues.metric) && formValues.metric.length > 0) ||
      (!Array.isArray(formValues.metric) && formValues.metric)
    );
    const hasMetrics = formValues.metrics && (
      (Array.isArray(formValues.metrics) && formValues.metrics.length > 0) ||
      (!Array.isArray(formValues.metrics) && formValues.metrics)
    );
    const hasMtric = formValues.mtric && (
      (Array.isArray(formValues.mtric) && formValues.mtric.length > 0) ||
      (!Array.isArray(formValues.mtric) && formValues.mtric)
    );

    if (!hasMetric && !hasMetrics && !hasMtric) {
      // Find which field name is used in the form
      const formParams = (window as any).__chartFormParams || [];
      const metricParam = formParams.find((p: any) => p.key === 'metric' || p.key === 'metrics' || p.key === 'mtric');
      const fieldName = metricParam?.label || metricParam?.key || 'Metric or Metrics';
      errors.add(metricParam?.key || 'metrics');
      if (errorMessage) {
        errorMessage += ` and ${fieldName} is required`;
      } else {
        errorMessage = `${fieldName} is required`;
      }
    }

    if (errors.size > 0) {
      // Set validation errors in ChartConfigurator
      if (typeof window !== 'undefined' && (window as any).__setValidationErrors) {
        (window as any).__setValidationErrors(errors);
      }
      toast.error(errorMessage);
      return null;
    }

    // Build base payload
    const payload = buildChartPayload(useUpdateApi);

    // Prevent duplicate column usage: X-axis vs Dimensions (only when both fields exist for this chart type)
    try {
      if (formHasXAxisField && formHasDimensionsField) {
        const xAxisValueRaw = formValues['x-axis'] || formValues['X-axis'] || null;
        const xAxisCol = Array.isArray(xAxisValueRaw) ? xAxisValueRaw[0] : xAxisValueRaw;
        const xAxisName = extractColumnName(xAxisCol);
        const dimValue = formValues.dimensions || null;
        const dimArr = Array.isArray(dimValue) ? dimValue : (dimValue ? [dimValue] : []);
        const dimNames = dimArr.map((d: any) => ('' + extractColumnName(d)).toLowerCase()).filter(Boolean);
        if (xAxisName && dimNames.includes(('' + xAxisName).toLowerCase())) {
          toast.error('X-axis and Dimensions cannot use the same column. Please choose different columns.');
          return null;
        }
      }
    } catch (e) {
      // ignore
    }

    const isBarChart = chartType.includes('bar') || chartType.includes('column');
    const isLineChart = chartType.includes('line');
    const isAreaChart = chartType.includes('area');
    const isSunburstChart = chartType.includes('sunburst');

    // Pivot table: rows, columns, metrics, apply_metrics_on, filters
    if (isPivotChart) {
      const rowsValue = formValues.rows;
      const rowsArr = Array.isArray(rowsValue) ? rowsValue : (rowsValue ? [rowsValue] : []);
      (payload.params as any).rows = rowsArr.map((col: any) => extractColumnName(col)).filter(Boolean) as string[];
      const columnsValue = formValues.columns;
      const columnsArr = Array.isArray(columnsValue) ? columnsValue : (columnsValue ? [columnsValue] : []);
      (payload.params as any).columns = columnsArr.map((col: any) => extractColumnName(col)).filter(Boolean) as string[];
      (payload.params as any).apply_metrics_on = formValues.apply_metrics_on || 'columns';
      (payload.params as any).is_drilldown = false;
      if (formValues.filters && Array.isArray(formValues.filters) && formValues.filters.length > 0) {
        (payload.params as any).filters = formValues.filters.map((col: any, idx: number) => {
          const colName = extractColumnName(col);
          if (!colName) return null;
          const operator = getNestedValue(formValues, 'filters', 'operator', idx) || '=';
          const value = getNestedValue(formValues, 'filters', 'value', idx);
          return { columns: colName, operator, value };
        }).filter((f: any) => f && f.columns && f.value !== undefined);
      } else {
        (payload.params as any).filters = [];
      }
    }

    // Build metrics - from "metric", "metrics", or "mtric" (same resolution as save-chart)
    if (formValues.metric || formValues.metrics || formValues.mtric) {
      const metricValue = formValues.metric || formValues.metrics || formValues.mtric;
      const metricColumns = Array.isArray(metricValue) ? metricValue : (metricValue ? [metricValue] : []);
      payload.params.metrics = metricColumns.map((col: any, idx: number) => {
        const colName = extractColumnName(col);
        if (!colName) return null;

        const operation =
          (resolveMetricNested(formValues, formParams, 'operation', idx, col) as string) || '';
        const alias = resolveMetricNested(formValues, formParams, 'alias', idx, col) as string | null;

          return {
            columns: colName,
            operation: operation,
            ...(alias && { alias, name: alias }),
          };
        }).filter((m: any) => m && m.columns);
      }

      // Build X-axis only when this chart's form actually has an X-axis field (avoids stale values after switching chart type)
      const xAxisFromForm = formValues['x-axis'] ?? formValues['X-axis'];
      if (!isPivotChart && formHasXAxisField && xAxisFromForm) {
        const xAxisValue = xAxisFromForm;
        const xAxisCol = Array.isArray(xAxisValue) ? xAxisValue[0] : xAxisValue;
        const xAxisColName = extractColumnName(xAxisCol);
        const alias =
          getNestedValue(formValues, 'x-axis', 'alias') ||
          getNestedValue(formValues, 'x-axis', 'label') ||
          getNestedValue(formValues, 'X-axis', 'alias') ||
          getNestedValue(formValues, 'X-axis', 'label');
        if (xAxisColName) {
          const xObj: any = { columns: xAxisColName };
          if (alias) xObj.alias = alias;
          payload.params['X-axis'] = [xObj];
        }
      }

      // Build dimensions - only if dimensions field is explicitly set (skip for pivot)
      if (!isPivotChart && formHasDimensionsField && formValues.dimensions) {
        const dimValue = formValues.dimensions;
        const dimColumns = Array.isArray(dimValue) ? dimValue : (dimValue ? [dimValue] : []);
        payload.params.dimensions = dimColumns.map((col: any, idx: number) => {
          const colName = extractColumnName(col);
          if (!colName) return null;
          const alias = getNestedValue(formValues, 'dimensions', 'alias', idx);
          return {
            columns: colName,
            ...(alias && { alias }),
          };
        }).filter((d: any) => d && d.columns);
      }

    // Build hierarchy - for sunburst charts only (skip for pivot)
      if (!isPivotChart && isSunburstChart && formValues.hierarchy) {
        const hierarchyValue = formValues.hierarchy;
        const hierarchyColumns = Array.isArray(hierarchyValue) ? hierarchyValue : (hierarchyValue ? [hierarchyValue] : []);
        const hierarchyColumnNames = hierarchyColumns
          .map((col: any) => extractColumnName(col))
          .filter((h: any) => h) as string[];
        currentHierarchyRef.current = hierarchyColumnNames.length > 0 ? hierarchyColumnNames : null;
        (payload.params as any).dimensions = hierarchyColumns
          .map((col: any) => {
            const colName = extractColumnName(col);
            return colName ? { columns: colName } : null;
          })
          .filter((h: any) => h);
      } else if (!isPivotChart) {
        currentHierarchyRef.current = null;
      }

      // For bar, line, and area charts, ensure metrics are set (no group_by fallback for dimensions)
      if (isBarChart || isLineChart || isAreaChart) {
        if (!payload.params.metrics || payload.params.metrics.length === 0) {
        }
      }

      // Ensure dimensions are unique (case-insensitive)
      if (payload.params.dimensions && Array.isArray(payload.params.dimensions)) {
        const seen = new Set<string>();
        payload.params.dimensions = payload.params.dimensions.filter((d: any) => {
          const key = String(d.columns || '').toLowerCase();
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }

      // Remove any group_by remnants entirely
      delete (payload.params as any).group_by;

      // Build filters - from "filters" drop area
      if (formValues.filters) {
        const filterValue = formValues.filters;
        const filterColumns = Array.isArray(filterValue) ? filterValue : (filterValue ? [filterValue] : []);
        payload.params.filters = filterColumns.map((col: any, idx: number) => {
          const colName = extractColumnName(col);
          if (!colName) return null;

          const operator = getNestedValue(formValues, 'filters', 'operator', idx) || '=';
          const value = getNestedValue(formValues, 'filters', 'value', idx);
          return {
            columns: colName,
            operator: operator,
            value: value,
          };
        }).filter((f: any) => f && f.columns && f.value);
      }

    if (formValues.limit != null && formValues.limit !== '') {
      payload.params.limit = Number(formValues.limit);
    } else {
      payload.params.limit = undefined;
    }

    if (drilldownLevels.length > 0) {
      (payload.params as any).drilldown_levels = drilldownLevels;
    }

    const chartTypeHint =
      selectedChart?.uniqueId?.toLowerCase() || selectedChart?.name?.toLowerCase() || '';
    attachCustomizationsToPayload(
      payload,
      customizationOptions,
      getSavedChartCustomizations(editChartData),
      chartTypeHint,
    );

    payload.params = stripChartFormAuxKeysFromParams(payload.params as any) as typeof payload.params;

    if (analyticsStudioInit) {
      return applyAnalyticsStudioChartPayload(payload, analyticsStudioInit, selectedSource);
    }

    return payload;
  }, [buildChartPayload, chartFormData, selectedChart, drilldownLevels, customizationOptions, editChartData, analyticsStudioInit, selectedSource]);

  // Shared function to execute chart generation/update with streaming
  const applySilentStreamRefresh = useCallback(() => {
    if (typeof window !== 'undefined') {
      (window as any).__chartStreamSilentRefresh = true;
    }
    if (silentRefreshDataRef.current?.length) {
      startTransition(() => {
        setStreamedData(silentRefreshDataRef.current!);
      });
    }
    if (silentRefreshRawRef.current) {
      setRawChartResponse((prev) =>
        mergeStreamRawResponseForSilentRefresh(prev, silentRefreshRawRef.current),
      );
    }
    silentRefreshDataRef.current = null;
    silentRefreshRawRef.current = null;
  }, []);

  const executeChartRequest = useCallback(async (
    payload: CreateChartPayload | UpdateChartPayload,
    useUpdateApi: boolean = false,
    requestOptions?: { silent?: boolean },
  ) => {
    const isSilent = !!requestOptions?.silent;

    const ingestStreamChunk = (chunks: any[]) => {
      if (!chunks.length) return;
      if (isSilent) {
        silentRefreshDataRef.current = silentRefreshDataRef.current
          ? [...silentRefreshDataRef.current, ...chunks]
          : [...chunks];
        return;
      }
      if (!hasFirstDataRef.current) {
        hasFirstDataRef.current = true;
        setStreamedData(chunks);
        setIsLoadingChart(false);
        return;
      }
      pendingChunksRef.current.push(...chunks);
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
      updateTimerRef.current = setTimeout(() => {
        if (pendingChunksRef.current.length > 0) {
          const chunksToAdd = [...pendingChunksRef.current];
          pendingChunksRef.current = [];
          setStreamedData((prevData) => [...prevData, ...chunksToAdd]);
        }
        updateTimerRef.current = null;
      }, 100);
    };

    const captureRawResponse = (nextRaw: any) => {
      if (!nextRaw) return;
      if (isSilent) {
        silentRefreshRawRef.current = nextRaw;
      }
    };

    try {
      const effectivePayload: CreateChartPayload | UpdateChartPayload = {
        ...(payload as object),
        params: stripChartFormAuxKeysFromParams((payload as any).params) as CreateChartPayload['params'],
      } as CreateChartPayload | UpdateChartPayload;

      if (isSilent) {
        isGeneratingRef.current = true;
        silentRefreshDataRef.current = null;
        silentRefreshRawRef.current = null;
      } else {
        // Cancel any ongoing request
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        abortControllerRef.current = new AbortController();

        setIsStreaming(true);
        setStreamedData([]);
        hasFirstDataRef.current = false;
        pendingChunksRef.current = [];

        if (updateTimerRef.current) {
          clearTimeout(updateTimerRef.current);
          updateTimerRef.current = null;
        }
      }

      if (!abortControllerRef.current) {
        abortControllerRef.current = new AbortController();
      }
      const signal = abortControllerRef.current.signal;

      // Save chart payload data to node for execute button
      if (isWorkflowPath) {
        let selectedNode: { id: string; data?: any } | undefined;
        try {
          const w = useFlowStore.getState().currentWorkflow;
          if (w?.data?.nodes) selectedNode = useFlowStore.getState().getSelectedNode();
        } catch (_) {}
        if (selectedNode && selectedNode.data?.node?.payload) {
          // Store the chart data payload in node payload along with stmt_date
          // Also persist visualization_name and chart_name so reopening the node
          // can restore the selected visualization and display its name.
          const nodePayload = selectedNode.data.node.payload;
          nodePayload.chart_data = toWorkflowNodeChartDataSnapshot(effectivePayload);
          nodePayload.visualization_name = (effectivePayload as any).visualization_name || (selectedChart?.uniqueId || selectedChart?.name?.toLowerCase().replace(/\s+/g, '_')) || nodePayload.visualization_name || '';
          nodePayload.chart_name = (effectivePayload as any).chart_name || selectedChart?.name || nodePayload.chart_name || '';
          nodePayload.chart_stmt_date = effectivePayload.stmt_date || ''; // Store stmt_date separately
          useFlowStore.getState().updateNodeData(selectedNode.id, selectedNode.data);
        }
      }

    // Fetch with streaming using API function
    // Use update chart API if useUpdateApi is true, otherwise use create chart API
    const action = useUpdateApi ? 'update_chart' : 'create_chart';

    // For update streaming, wrap the payload so `chart_id` is top-level
    // and the nested payload matches the { data: { ... }, actions, stmt_date } shape.
    let previousUniqueIdForStreamUpdate = '';
    if (useUpdateApi && persistedChartIdForApi) {
      try {
        const n = useFlowStore.getState().getSelectedNode();
        const np = n?.data?.node?.payload;
        previousUniqueIdForStreamUpdate = String(np?.unique_id ?? np?.node_id ?? '').trim();
      } catch {
        previousUniqueIdForStreamUpdate = '';
      }
      if (!previousUniqueIdForStreamUpdate) {
        previousUniqueIdForStreamUpdate = String(
          editChartData?.unique_id ?? editChartData?.node_id ?? '',
        ).trim();
      }
      if (!previousUniqueIdForStreamUpdate) {
        previousUniqueIdForStreamUpdate = String(
          (effectivePayload as any).unique_id ?? (effectivePayload as any).node_id ?? '',
        ).trim();
      }
    }

    const streamPayload = useUpdateApi && persistedChartIdForApi
      ? {
          chart_id: persistedChartIdForApi,
          payload: {
            data: {
              ...effectivePayload,
              id: persistedChartIdForApi,
              ...(previousUniqueIdForStreamUpdate
                ? { previous_unique_id: previousUniqueIdForStreamUpdate }
                : {}),
            },
            actions: action,
            stmt_date: effectivePayload.stmt_date || '',
          },
        }
      : effectivePayload;

    if (typeof console !== 'undefined') {
      console.log('ChartFormulator: executeChartRequest', { action, streamPayload });
    }

    if (typeof console !== 'undefined') {
      console.log('ChartFormulator: starting streaming API call', useUpdateApi ? 'updateChartStreaming' : 'createChartStreaming');
    }
    lastChartPayloadRef.current = effectivePayload;
    let streamResponse: any = null;
    try {
      streamResponse = useUpdateApi
        ? await updateChartStreaming(streamPayload as any, signal)
        : await createChartStreaming(effectivePayload as any, signal);
    } catch (err) {
      // Network / fetch-level failure
      // eslint-disable-next-line no-console
      console.error('ChartFormulator: streaming request failed', err);
      throw err;
    }

    try {
      // Log status with console.log to ensure visible output even when debug filtered
      // eslint-disable-next-line no-console
      console.log('ChartFormulator: streamResponse status', { ok: streamResponse?.ok, status: streamResponse?.status, redirected: streamResponse?.redirected });
      if (!streamResponse || !streamResponse.ok) {
        // Try to read error body for more context (best-effort)
        try {
          const text = streamResponse && typeof streamResponse.text === 'function' ? await streamResponse.text() : String(streamResponse);
          // eslint-disable-next-line no-console
          console.error('ChartFormulator: streaming API returned non-ok status', streamResponse?.status, text && text.substring ? text.substring(0, 10000) : text);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('ChartFormulator: failed to read streaming error body', e);
        }
        throw new Error(`HTTP error! status: ${streamResponse?.status ?? 'no-response'}`);
      }
    } catch (e) {
      throw e;
    }

      if (!streamResponse.body) {
        throw new Error('Streaming not available');
      }

      const reader = streamResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let rawResponseData: any = null;

      // Helper: permissive pivot-like detection. Accept `rows`/`columns` as arrays OR objects keyed by index.
      const isPivotLike = (it: any) => {
        if (!it || typeof it !== 'object') return false;
        const hasDataObject = it.data && typeof it.data === 'object' && !Array.isArray(it.data);
        if (!hasDataObject) return false;
        const rowsOk = Array.isArray(it.rows) || (it.rows && typeof it.rows === 'object');
        const colsOk = Array.isArray(it.columns) || (it.columns && typeof it.columns === 'object');
        return (rowsOk && colsOk) && (it.apply_metrics_on != null || it.metrics != null);
      };

      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          // Process any remaining buffer
          if (buffer.trim()) {
            const { parsed } = extractCompleteJSON(buffer);
            for (const item of parsed) {
              let dataToAdd: any[] = [];

              // API error payload: { detail: { status: false, status_code: 400, message: "..." } }
              if (item && typeof item === 'object' && item.detail && (item.detail.status === false || (item.detail.status_code && item.detail.status_code >= 400)) && item.detail.message) {
                const msg = String(item.detail.message || '');
                if (!isSilent) {
                  toast.error(msg);
                  setStreamedData([]);
                  setIsLoadingChart(false);
                  setIsStreaming(false);
                }
                isGeneratingRef.current = false;
                return;
              }

              if (Array.isArray(item)) {
                dataToAdd = item;
              } else if (item && typeof item === 'object') {
                // Store raw response if it contains x_axis and columns (or columns for sunburst)
                if ((item.x_axis && item.columns && Array.isArray(item.data)) ||
                    (item.columns && Array.isArray(item.data))) {
                  rawResponseData = {
                    ...(item.x_axis && { x_axis: item.x_axis }),
                    data: item.data,
                    columns: item.columns,
                    ...(item.dimensions && { dimensions: item.dimensions }),
                    ...(item.hierarchy && { hierarchy: item.hierarchy }),
                    ...(currentHierarchyRef.current && !item.dimensions && !item.hierarchy && !item.drilldown_applied && {
                      dimensions: currentHierarchyRef.current.map((col: string) => ({ columns: col })),
                    }),
                    ...(item.drilldown_applied != null && { drilldown_applied: item.drilldown_applied }),
                    ...(item.unique_id != null && { unique_id: item.unique_id }),
                  };
                  captureRawResponse(rawResponseData);
                }
                // Store pivot table raw response: rows, columns, data (object), apply_metrics_on, metrics, schema
                const isPivotResponse = isPivotLike(item);
                if (isPivotResponse) {
                  rawResponseData = {
                    rows: item.rows,
                    columns: item.columns,
                    data: item.data,
                    apply_metrics_on: item.apply_metrics_on,
                    metrics: item.metrics,
                    schema: item.schema,
                    ...(item.drilldown_applied != null && { drilldown_applied: item.drilldown_applied }),
                    ...(item.unique_id != null && { unique_id: item.unique_id }),
                  };
                  captureRawResponse(rawResponseData);
                  dataToAdd = [item];
                }

                if (dataToAdd.length === 0) {
                  if (Array.isArray(item.data)) {
                    dataToAdd = item.data;
                  } else if (Array.isArray(item.payload)) {
                    dataToAdd = item.payload;
                  } else if (Array.isArray(item.result)) {
                    dataToAdd = item.result;
                  } else if (!isPivotResponse && Array.isArray(item.rows)) {
                    dataToAdd = item.rows;
                  } else if (!isPivotResponse) {
                    dataToAdd = [item];
                  }
                }
              }

              ingestStreamChunk(dataToAdd);
            }
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Extract complete JSON objects from buffer
        const { parsed, remaining } = extractCompleteJSON(buffer);
        buffer = remaining;

        // Process parsed JSON objects
        for (const item of parsed) {
          try {
            let dataToAdd: any[] = [];

            // API error payload: { detail: { status: false, status_code: 400, message: "..." } }
            if (item && typeof item === 'object' && item.detail && (item.detail.status === false || (item.detail.status_code && item.detail.status_code >= 400)) && item.detail.message) {
              const msg = String(item.detail.message || '');
              if (!isSilent) {
                toast.error(msg);
                setStreamedData([]);
                setIsLoadingChart(false);
                setIsStreaming(false);
              }
              isGeneratingRef.current = false;
              return;
            }

            if (Array.isArray(item)) {
              dataToAdd = item;
            } else if (item && typeof item === 'object') {
              // Store raw response if it contains x_axis and columns (or dimensions for sunburst)
              if ((item.x_axis && item.columns && Array.isArray(item.data)) || 
                  (item.columns && Array.isArray(item.data))) {
                rawResponseData = {
                  ...(item.x_axis && { x_axis: item.x_axis }),
                  data: item.data,
                  columns: item.columns,
                  ...(item.dimensions && { dimensions: item.dimensions }),
                  ...(item.hierarchy && { hierarchy: item.hierarchy }),
                  // For drilldown responses, do not inject parent hierarchy – use dimensions from response or infer from data
                  ...(currentHierarchyRef.current && !item.dimensions && !item.hierarchy && !item.drilldown_applied && {
                    dimensions: currentHierarchyRef.current.map((col: string) => ({ columns: col }))
                  }),
                  ...(item.drilldown_applied != null && { drilldown_applied: item.drilldown_applied }),
                  ...(item.unique_id != null && { unique_id: item.unique_id }),
                };
                captureRawResponse(rawResponseData);
              }
              const isPivotResp = isPivotLike(item);
              if (isPivotResp) {
                rawResponseData = {
                  rows: item.rows,
                  columns: item.columns,
                  data: item.data,
                  apply_metrics_on: item.apply_metrics_on,
                  metrics: item.metrics,
                  schema: item.schema,
                  ...(item.drilldown_applied != null && { drilldown_applied: item.drilldown_applied }),
                  ...(item.unique_id != null && { unique_id: item.unique_id }),
                };
                captureRawResponse(rawResponseData);
                dataToAdd = [item];
              } else if (dataToAdd.length === 0) {
                if (Array.isArray(item.data)) {
                  dataToAdd = item.data;
                } else if (Array.isArray(item.payload)) {
                  dataToAdd = item.payload;
                } else if (Array.isArray(item.result)) {
                  dataToAdd = item.result;
                } else if (Array.isArray(item.rows)) {
                  dataToAdd = item.rows;
                } else {
                  dataToAdd = [item];
                }
              }
            }

            ingestStreamChunk(dataToAdd);
          } catch (error) {
            console.error("Error processing parsed item:", error);
          }
        }
      }

      if (isSilent) {
        if (pendingChunksRef.current.length > 0) {
          silentRefreshDataRef.current = silentRefreshDataRef.current
            ? [...silentRefreshDataRef.current, ...pendingChunksRef.current]
            : [...pendingChunksRef.current];
          pendingChunksRef.current = [];
        }
        if (updateTimerRef.current) {
          clearTimeout(updateTimerRef.current);
          updateTimerRef.current = null;
        }
        if (!silentRefreshRawRef.current && rawResponseData) {
          captureRawResponse(rawResponseData);
        }
        applySilentStreamRefresh();
        isGeneratingRef.current = false;
        return;
      }

      // Process any remaining pending chunks before finishing
      if (pendingChunksRef.current.length > 0) {
        const chunksToAdd = [...pendingChunksRef.current];
        pendingChunksRef.current = [];
        setStreamedData((prevData) => [...prevData, ...chunksToAdd]);
      }

      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
        updateTimerRef.current = null;
      }

      // Set raw response if we captured it
      if (rawResponseData) {
        // Log the raw response to aid debugging in the browser console
        try {
          // eslint-disable-next-line no-console
          console.log('ChartFormulator: rawChartResponse received', rawResponseData);
          try {
            const json = JSON.stringify(rawResponseData, null, 2);
            // eslint-disable-next-line no-console
            console.log('ChartFormulator: rawChartResponse JSON', json.substring(0, 100000));
          } catch (_) {}
          // Explicit log when pivot response is received so table will display
          const isPivot = rawResponseData?.rows && rawResponseData?.columns && rawResponseData?.data && typeof rawResponseData.data === 'object';
          if (isPivot) {
            // eslint-disable-next-line no-console
            console.log('ChartFormulator: pivot response received — will display in table', { rows: rawResponseData.rows, columns: rawResponseData.columns, metrics: rawResponseData.metrics });
          }
        } catch (_) {}
        setRawChartResponse(rawResponseData);
      }


    setIsStreaming(false);
    isGeneratingRef.current = false;
    if (!isSilent) {
      if (useUpdateApi && persistedChartIdForApi && effectivePayload.customization) {
        try {
          await updateChart({
            chart_id: persistedChartIdForApi,
            payload: {
              data: {
                ...effectivePayload,
                id: persistedChartIdForApi,
                customization: effectivePayload.customization,
                params: effectivePayload.params,
              },
              actions: 'update_chart',
              stmt_date: effectivePayload.stmt_date || '',
            },
          } as any);
        } catch (persistError) {
          console.warn('Failed to persist chart customization after update:', persistError);
        }
      }
      toast.success(useUpdateApi ? 'Chart updated successfully' : 'Chart generated successfully');
      if (useUpdateApi) notifyEmbeddedChartUpdated();
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      if (!isSilent) {
        setIsLoadingChart(false);
        setIsStreaming(false);
      }
      isGeneratingRef.current = false;
      return;
    }
    if (isSilent) {
      isGeneratingRef.current = false;
      return;
    }
    toast.error(err.message || (useUpdateApi ? 'Failed to update chart' : 'Failed to generate chart'));
    setStreamedData([]);
    setIsLoadingChart(false);
    setIsStreaming(false);
    isGeneratingRef.current = false;
  } finally {
    if (!isSilent) {
      setIsStreaming(false);
      if (!hasFirstDataRef.current) {
        setIsLoadingChart(false);
      }
    }
  }
  }, [isWorkflowPath, nid, persistedChartIdForApi, editChartData, applySilentStreamRefresh]);

  /** Big Number Stream interval refresh runs on saved dashboards (Analytics / CreateDashboard), not while authoring in the formulator. */

  /** Resolve drilldown column for any chart type (bar, line, area, pie, donut, sunburst, gauge, funnel) */
  const getDrilldownColumn = useCallback((): string | null => {
    // 1) API response x_axis (bar, line, area)
    const xAxis = rawChartResponse?.x_axis ?? rawChartResponse?.xAxis;
    if (xAxis && typeof xAxis === 'string') return xAxis;
    // 2) Form x-axis (bar, line, area)
    const formValues = (window as any).__chartFormValues;
    if (formValues?.['x-axis']) {
      const xv = formValues['x-axis'];
      const col = typeof xv === 'string' ? xv : (xv?.name ?? xv?.columns);
      if (col) return col;
    }
    // 3) Form first dimension (pie, donut, funnel, sunburst, gauge)
    if (formValues?.dimensions && Array.isArray(formValues.dimensions) && formValues.dimensions.length > 0) {
      const d = formValues.dimensions[0];
      const col = typeof d === 'string' ? d : (d?.name ?? d?.columns);
      if (col) return col;
    }
    // 4) Form metric (pie/gauge sometimes use metric as slice label)
    if (formValues?.metric) {
      const m = formValues.metric;
      const col = typeof m === 'string' ? m : (Array.isArray(m) && m[0] ? (typeof m[0] === 'string' ? m[0] : (m[0]?.name ?? m[0]?.columns)) : (m?.name ?? m?.columns));
      if (col) return col;
    }
    if (formValues?.metrics && Array.isArray(formValues.metrics) && formValues.metrics.length > 0) {
      const m = formValues.metrics[0];
      const col = typeof m === 'string' ? m : (m?.name ?? m?.columns);
      if (col) return col;
    }
    // 5) Form hierarchy first level (sunburst)
    if (formValues?.hierarchy && Array.isArray(formValues.hierarchy) && formValues.hierarchy.length > 0) {
      const h = formValues.hierarchy[0];
      const col = typeof h === 'string' ? h : (h?.name ?? h?.columns);
      if (col) return col;
    }
    // 6) Response columns: prefer first non-aggregate column (category), else first column
    const cols = rawChartResponse?.columns;
    if (Array.isArray(cols) && cols.length > 0) {
      const nonAggregate = cols.find((c: any) => typeof c === 'string' && !c.includes('('));
      if (nonAggregate) return nonAggregate;
      if (typeof cols[0] === 'string') return cols[0];
    }
    return null;
  }, [rawChartResponse]);

  /** Get drilldown column from payload params (fallback when getDrilldownColumn returns null) */
  const getColumnFromPayload = useCallback((payload: CreateChartPayload | UpdateChartPayload): string | null => {
    const params = payload?.params as Record<string, any> | undefined;
    if (!params) return null;
    const dim0 = params.dimensions?.[0];
    if (dim0 !== undefined && dim0 !== null) {
      const col = typeof dim0 === 'string' ? dim0 : (dim0.columns ?? dim0.name);
      if (col) return col;
    }
    const xAxis = params['X-axis'] ?? params['x-axis'];
    if (xAxis) {
      if (typeof xAxis === 'string') return xAxis;
      if (Array.isArray(xAxis) && xAxis.length > 0) {
        const first = xAxis[0];
        const col = typeof first === 'string' ? first : (first?.columns ?? first?.name);
        if (col) return col;
      }
    }
    const metric0 = params.metrics?.[0];
    if (metric0) {
      const col = typeof metric0 === 'string' ? metric0 : (metric0.columns ?? (metric0 as any).name);
      if (col) return col;
    }
    return null;
  }, []);

  /** Execute create_chart API with is_drilldown and drill_filters for all chart types (first-level drilldown) */
  const lastDrillRef = useRef<{ key: string; ts: number } | null>(null);
  const handleChartDrilldown = useCallback(async (
    field: string,
    value: any,
    originalData?: any,
    eventDimensionFields?: string[],
    eventDrillFilters?: Array<{ column: string; value: any }>,
    options?: { fromContextMenu?: boolean },
  ) => {
    const fromContextMenu = !!options?.fromContextMenu;
    if (isViewOnly) {
      // eslint-disable-next-line no-console
      console.log('[ChartFormulator Drill] blocked: view-only mode', { field, value });
      return;
    }
    if (!fromContextMenu && suppressNextNonContextDrillRef.current) {
      suppressNextNonContextDrillRef.current = false;
      // eslint-disable-next-line no-console
      console.log('[ChartFormulator Drill] skipped follow-up non-context interaction', { field, value });
      return;
    }
    // When drillthrough is enabled, drilldown is disabled (unless user just chose Drilldown and state hasn't updated yet)
    const justSwitchedToDrilldown = drillthroughJustDisabledRef.current;
    if (justSwitchedToDrilldown) drillthroughJustDisabledRef.current = false;
    if (drillthroughModeEnabled && !justSwitchedToDrilldown && !drilldownModeEnabled) {
      // eslint-disable-next-line no-console
      console.log('[ChartFormulator Drill] blocked: drill-through mode still active', {
        field,
        value,
        drillthroughModeEnabled,
        drilldownModeEnabled,
        justSwitchedToDrilldown,
        fromContextMenu,
      });
      return;
    }
    // In Create/Edit mode: only run when user enabled drilldown via right-click "Drilldown", or when invoked from that context menu (or just switched from drill through)
    if (!fromContextMenu && !drilldownModeEnabled && !justSwitchedToDrilldown) {
      // eslint-disable-next-line no-console
      console.log('[ChartFormulator Drill] blocked: drilldown mode not enabled', {
        field,
        value,
        drilldownModeEnabled,
        justSwitchedToDrilldown,
      });
      return;
    }
    if (fromContextMenu) {
      setDrillthroughModeEnabled(false);
      setDrilldownModeEnabled(true);
    }
    try {
      const key = `${String(field)}::${String(value)}`;
      const now = Date.now();
      if (lastDrillRef.current && lastDrillRef.current.key === key && (now - lastDrillRef.current.ts) < 600) {
        console.log('ChartFormulator: suppressed duplicate handleChartDrilldown', { field, value });
        return;
      }
      lastDrillRef.current = { key, ts: now };
    } catch (e) {
      // ignore dedupe errors
    }
    console.log('ChartFormulator: handleChartDrilldown called', { field, value, eventDrillFilters });
    // Build payload: use validated form payload, or last successful payload (pie/donut/funnel/gauge/sunburst often fail validation from __chartFormValues)
    let basePayload = validateAndBuildPayload(false);
    if (!basePayload) basePayload = lastChartPayloadRef.current;
    if (!basePayload) return;
    // Resolve column: use field when it's a column name (e.g. Line/Area pass categoryField), else getDrilldownColumn or payload params
    let resolvedColumn: string | null = (field !== 'category' && field !== 'value') ? field : getDrilldownColumn();
    const vizName = (basePayload?.visualization_name ?? '').toString().toLowerCase();
    const isBarOrGroupedBar = vizName === 'bar' || vizName === 'grouped_bar' || vizName === 'grouped-bar';
    const isLineChart = vizName === 'line';
    const isAreaChart = vizName === 'area';
    const isXAxisChart = isBarOrGroupedBar || isLineChart || isAreaChart;
    // For bar, line, and area: always drill by the X-axis/dimension column (same payload and x-axis behavior)
    if (isXAxisChart) {
      resolvedColumn = getDrilldownColumn() || getColumnFromPayload(basePayload);
    }
    // If the chart sent explicit drillFilters (e.g. FunnelChart with multiple dimensions), use them so we send all dimension columns.
    let extraFiltersFromOriginal: Array<{ field: string; value: any }> = [];
    if (!isXAxisChart && Array.isArray(eventDrillFilters) && eventDrillFilters.length > 0) {
      extraFiltersFromOriginal = eventDrillFilters.map((f) => ({ field: f.column, value: f.value }));
      if (!resolvedColumn && extraFiltersFromOriginal.length > 0) {
        resolvedColumn = extraFiltersFromOriginal[0].field;
      }
      console.log('ChartFormulator: using eventDrillFilters for drilldown', { extraFiltersFromOriginal });
    } else if (!isXAxisChart && originalData && typeof originalData === 'object') {
      // If originalData is provided, try to extract all matching dimension keys
      // from it so we can send multiple drill filters (one per matching column).
      try {
        const candidateKeys = Object.keys(originalData || {}).filter(k => !!k && k !== 'value' && k !== 'category');
        const matching = candidateKeys.filter(k => currentFields.some((f) => f.name === k));
        if (matching.length > 0) {
          // Prepare additional filters for all matches
          extraFiltersFromOriginal = matching.map((k) => ({ field: k, value: originalData[k] }));
          // If we don't already have a resolvedColumn, use the first matching key
          if (!resolvedColumn) {
            resolvedColumn = matching[0];
          }
          console.log('ChartFormulator: derived extraFiltersFromOriginal from originalData', { resolvedColumn, extraFiltersFromOriginal });
        }
      } catch (e) {
        // ignore
      }
    }
    if (!resolvedColumn) resolvedColumn = getColumnFromPayload(basePayload);
    const respDataLen = rawChartResponse && Array.isArray(rawChartResponse.data) ? rawChartResponse.data.length : 0;
    // Allow API drilldown when we have a resolved column AND either chart/streamed/response data exists,
    // or the payload explicitly contains dimensions/hierarchy (sunburst case) so backend can generate drilldown
    const payloadHasDimensions = !!(basePayload && (basePayload as any).params && Array.isArray((basePayload as any).params.dimensions) && (basePayload as any).params.dimensions.length > 0);
    const canUseApiDrilldown = !!resolvedColumn && (chartData.length > 0 || streamedData.length > 0 || respDataLen > 0 || payloadHasDimensions);
    console.log('ChartFormulator: drilldown check', { resolvedColumn, chartDataLen: chartData.length, streamedDataLen: streamedData.length, respDataLen, canUseApiDrilldown });

    // Normalize drill value: sometimes the chart dispatches the column name as the
    // value (e.g. value === 'p_status') — prefer the actual dimension value
    // from `originalData` when available. For bar/grouped bar, always prefer
    // `originalData[resolvedColumn]` when present.
    let drillValue = value;
    try {
      if (originalData && resolvedColumn) {
        if (isXAxisChart || String(drillValue) === String(resolvedColumn) || drillValue === 'category' || drillValue === 'value') {
          const candidate = originalData[resolvedColumn];
          if (candidate !== undefined) {
            drillValue = candidate;
            console.log('ChartFormulator: normalized drillValue from originalData', { resolvedColumn, drillValue });
          }
        }
      }
    } catch (e) {
      // ignore normalization errors
    }

    if (canUseApiDrilldown) {
      // Build drill filters: prefer filters from originalData when available.
      // Ensure we don't keep multiple filters for the same column — replace
      // any existing filter for the clicked/resolved column with the new value.
      let drillFilters = [...drilldownFilters];
      if (eventDimensionFields && Array.isArray(eventDimensionFields) && eventDimensionFields.length > 0) {
        // Remove any previously-applied filters that belong to the
        // current chart's declared dimension set. When a user clicks a
        // slice we want to replace the filter for that dimension rather
        // than keep a stale value from a prior click at the same level.
        drillFilters = drillFilters.filter((df) => !eventDimensionFields.includes(df.field));
      }
      if (isXAxisChart && resolvedColumn) {
        drillFilters = drillFilters.filter((df) => df.field !== resolvedColumn);
        drillFilters.push({ field: resolvedColumn, value: drillValue });
      } else if (extraFiltersFromOriginal.length > 0) {
        // For each extra filter, replace any existing filter for that field
        extraFiltersFromOriginal.forEach((f) => {
          drillFilters = drillFilters.filter((df) => df.field !== f.field);
          drillFilters.push({ field: f.field, value: f.value });
        });
      } else if (resolvedColumn) {
        // Replace any existing filter for resolvedColumn so we don't send duplicates
        drillFilters = drillFilters.filter((df) => df.field !== resolvedColumn);
        drillFilters.push({ field: resolvedColumn, value: drillValue });
      }

      // Final dedupe: keep only the last filter for each field
      const seen = new Map<string, any>();
      for (const f of drillFilters) {
        seen.set(String(f.field), f.value);
      }
      drillFilters = Array.from(seen.entries()).map(([field, value]) => ({ field, value }));

      setDrilldownFilters(drillFilters);

      // For sunburst visuals, backend may expect `chart_name` to be omitted (use visualization_name only).
      // Keep full drill filter chain for multi-level drilldown.
      const isSunburstViz = (basePayload && (basePayload.visualization_name || '')).toString().toLowerCase().includes('sunburst');
      const drillFiltersForPayload = drillFilters.map((f) => ({ column: f.field, value: f.value }));
      const finalDrillFilters = drillFiltersForPayload;

      // Don't call API immediately: show column picker so user can select drill_columns
      setPendingDrilldownContext({
        basePayload,
        drillFilters,
        finalDrillFilters,
        isSunburstViz,
      });
      setSelectedDrillColumns([]);
      setDrilldownColumnDialogOpen(true);
      return;
    }

    setDrilldownFilters((prev) => [...prev, { field, value }]);
    if (!selectedSource || !chartConfig || !chartConfig.x) {
      // When drilldown mode is enabled, don't clear the chart so user can try another slice or use context menu again
      if (!drilldownModeEnabled) {
        handleClearChart();
      }
      return;
    }
    const currentFieldIndex = currentFields.findIndex((f) => f.name === chartConfig.x?.name);
    let nextCategoricalField: Field | null = null;
    if (currentFieldIndex !== -1) {
      for (let i = currentFieldIndex + 1; i < currentFields.length; i++) {
        const potentialField = currentFields[i];
        if (potentialField.type === 'string') {
          nextCategoricalField = potentialField;
          break;
        }
      }
    }
    if (nextCategoricalField) {
      setChartConfig((prev) => ({ ...prev!, x: nextCategoricalField }));
    } else {
      // When drilldown mode is enabled, don't clear the chart so user can try another slice
      if (!drilldownModeEnabled) {
        handleClearChart();
      }
    }
  }, [isViewOnly, drillthroughModeEnabled, drilldownModeEnabled, getDrilldownColumn, chartData.length, drilldownFilters, drilldownLevels, validateAndBuildPayload, executeChartRequest, streamedData, selectedSource, chartConfig, currentFields]);

  const chartUniqueId = String((selectedChart as { uniqueId?: string } | null)?.uniqueId ?? '').toLowerCase();

  const isDrilldownSupported = useMemo(
    () => canShowDrilldownButtonInEditor(chartUniqueId),
    [chartUniqueId],
  );

  const isDrillThroughSupported = useMemo(
    () => canShowDrillThroughButton(chartUniqueId),
    [chartUniqueId],
  );

  /** Arm or disarm drilldown from chart preview toolbar (create/update chart). */
  const handleArmDrilldown = useCallback(() => {
    if (isViewOnly || !isDrilldownSupported) return;
    if (drilldownModeEnabled) {
      setDrilldownModeEnabled(false);
      userJustChoseDrilldownRef.current = false;
      drillthroughJustDisabledRef.current = false;
      return;
    }
    setDrillthroughModeEnabled(false);
    userJustChoseDrilldownRef.current = true;
    drillthroughJustDisabledRef.current = true;
    suppressNextNonContextDrillRef.current = false;
    setDrilldownModeEnabled(true);
  }, [isViewOnly, isDrilldownSupported, drilldownModeEnabled]);

  /** Arm or disarm drill-through from chart preview toolbar (create/update chart). */
  const handleArmDrillThrough = useCallback(() => {
    if (isViewOnly || !isDrillThroughSupported) return;
    if (drillthroughModeEnabled) {
      setDrillthroughModeEnabled(false);
      return;
    }
    setDrillthroughModeEnabled(true);
    setDrilldownModeEnabled(false);
    userJustChoseDrilldownRef.current = false;
    drillthroughJustDisabledRef.current = false;
  }, [isViewOnly, isDrillThroughSupported, drillthroughModeEnabled]);

  /** Build drill-through payload and open dialog; call API with is_drill_through + drill_through_columns; show response in AG Grid (supports streaming). */
  const handleChartDrillThrough = useCallback(async (
    field: string,
    value: any,
    originalData?: any,
    eventDimensionFields?: string[],
    eventDrillFilters?: Array<{ column: string; value: any }>,
  ) => {
    if (isViewOnly || !drillthroughModeEnabled) return;

    let basePayload = validateAndBuildPayload(false) ?? lastChartPayloadRef.current;
    if (!basePayload) {
      toast.error('Chart configuration is missing. Generate the chart first.');
      return;
    }

    let resolvedColumn: string | null = (field !== 'category' && field !== 'value') ? field : getDrilldownColumn();
    if (!resolvedColumn) resolvedColumn = getColumnFromPayload(basePayload);
    if (Array.isArray(eventDrillFilters) && eventDrillFilters.length > 0 && !resolvedColumn) {
      resolvedColumn = eventDrillFilters[0].column;
    }
    if (!resolvedColumn) {
      toast.error('Could not determine slice column for drill-through.');
      return;
    }

    let drillValue = value;
    if (originalData && resolvedColumn) {
      if (String(drillValue) === String(resolvedColumn) || drillValue === 'category' || drillValue === 'value') {
        const candidate = originalData[resolvedColumn];
        if (candidate !== undefined) drillValue = candidate;
      }
    }

    // Previous drill levels: flatten from drilldownLevels or use drilldownFilters
    const drillFiltersForPayload: Array<{ column: string; value: any }> =
      drilldownLevels.length > 0
        ? drilldownLevels.flatMap((level) => level.drill_filters ?? [])
        : drilldownFilters.length > 0
          ? drilldownFilters.map((f) => ({ column: f.field, value: f.value }))
          : (basePayload.params as any)?.drill_filters ?? [];
    const lastLevel = drilldownLevels.length > 0 ? drilldownLevels[drilldownLevels.length - 1] : null;
    const drillColumnsForPayload = lastLevel?.drill_columns ?? (basePayload.params as any)?.drill_columns ?? [];

    // Do not skip when click is "already in path" – for drill-through we want to fetch underlying rows for the current slice.
    // Resolve current clicked slice filter robustly:
    // 1) Prefer explicit event drill filters from chart event (most accurate)
    // 2) Else, when click field is generic ("category"/"value"), infer from selected drill_columns at current level
    // 3) Fallback to resolvedColumn + drillValue
    const previousFilterColumns = new Set(drillFiltersForPayload.map((f) => String(f.column)));
    const firstNextDrillColumn =
      drillColumnsForPayload.find((c: any) => c?.column && !previousFilterColumns.has(String(c.column)))?.column
      ?? drillColumnsForPayload[0]?.column;

    const originalDataNextColumn = (() => {
      if (!originalData || typeof originalData !== 'object') return undefined;
      const keys = Object.keys(originalData as Record<string, any>);
      return keys.find((k) =>
        !!k &&
        k !== 'value' &&
        k !== 'category' &&
        !k.includes('(') &&
        !previousFilterColumns.has(String(k))
      );
    })();

    const responseNextColumn = (() => {
      const cols = rawChartResponse?.columns;
      if (!Array.isArray(cols)) return undefined;
      return cols.find((c: any) =>
        typeof c === 'string' &&
        c &&
        !c.includes('(') &&
        !previousFilterColumns.has(String(c))
      ) as string | undefined;
    })();

    const eventFilters = Array.isArray(eventDrillFilters) ? eventDrillFilters : [];
    const hasEventFilterForNewColumn = eventFilters.some((f) => !previousFilterColumns.has(String(f.column)));

    const inferredCurrentColumn =
      ((field === 'category' || field === 'value')
        ? (hasEventFilterForNewColumn
            ? String(eventFilters[0]?.column)
            : (firstNextDrillColumn ?? originalDataNextColumn ?? responseNextColumn ?? resolvedColumn))
        : (resolvedColumn ?? String(eventFilters[0]?.column ?? '')))
      || resolvedColumn;

    let normalizedCurrentValue = drillValue;
    if (originalData && inferredCurrentColumn) {
      const directCandidate = (originalData as any)[inferredCurrentColumn];
      if (directCandidate !== undefined) {
        normalizedCurrentValue = directCandidate;
      } else if (
        String(normalizedCurrentValue) === String(inferredCurrentColumn) ||
        normalizedCurrentValue === 'category' ||
        normalizedCurrentValue === 'value'
      ) {
        const fallbackCandidate = (originalData as any)[resolvedColumn as string];
        if (fallbackCandidate !== undefined) normalizedCurrentValue = fallbackCandidate;
      }
    }

    const currentSliceFilters: Array<{ column: string; value: any }> =
      eventFilters.length > 0 && hasEventFilterForNewColumn
        ? eventFilters
        : [{ column: inferredCurrentColumn as string, value: normalizedCurrentValue }];

    // Build drill_through_columns with per-column replacement (current slice overrides previous value for same column).
    // Keep the full drill path so previous drill filters and the current slice are both included.
    const mergedByColumn = new Map<string, any>();
    for (const f of drillFiltersForPayload) mergedByColumn.set(String(f.column), f.value);
    for (const f of currentSliceFilters) mergedByColumn.set(String(f.column), f.value);
    const drillThroughColumns: Array<{ column: string; value: any }> = Array.from(mergedByColumn.entries()).map(([column, value]) => ({ column, value }));
    const vizName = (basePayload.visualization_name || '').toString().toLowerCase();
    const isXAxisChart = /bar|line|area/.test(vizName);

    const isCurrentSliceInPayload = !!inferredCurrentColumn && drillThroughColumns.some(
      (c) => String(c.column) === String(inferredCurrentColumn) && String(c.value) === String(normalizedCurrentValue)
    );
    try {
      // eslint-disable-next-line no-console
      console.info('[ChartFormulator DrillThrough] current slice payload check', {
        field,
        value,
        resolvedColumn,
        inferredCurrentColumn,
        normalizedCurrentValue,
        eventDrillFilters,
        previousDrillFilters: drillFiltersForPayload,
        currentSliceFilters,
        drillThroughColumns,
        isCurrentSliceInPayload,
      });
      if (!isCurrentSliceInPayload) {
        // eslint-disable-next-line no-console
        console.warn('[ChartFormulator DrillThrough] current slice NOT included in payload', {
          inferredCurrentColumn,
          normalizedCurrentValue,
          drillThroughColumns,
        });
      }
    } catch (e) {
      // ignore debug log failures
    }

    // Final dedupe key based on resolved payload context.
    const dedupeKey = drillThroughColumns.map((c) => `${String(c.column)}=${String(c.value)}`).join('|');
    const now = Date.now();
    if (
      drillThroughLastSliceRef.current &&
      drillThroughLastSliceRef.current.key === dedupeKey &&
      (now - drillThroughLastSliceRef.current.ts) < 600
    ) {
      try {
        // eslint-disable-next-line no-console
        console.info('[ChartFormulator DrillThrough] duplicate slice suppressed', { dedupeKey, inferredCurrentColumn, normalizedCurrentValue });
      } catch (e) {}
      return;
    }
    drillThroughLastSliceRef.current = { key: dedupeKey, ts: now };

    const hasDrillLevels = drilldownLevels.length > 0 || drilldownFilters.length > 0;

    // Include full drill path for backend: drilldown_levels (previous levels) + drill_through_columns (previous filters + current slice)
    // For x-axis charts (bar, line, area), send only one level.
    let drilldownLevelsForPayload =
      drilldownLevels.length > 0
        ? drilldownLevels
        : drillFiltersForPayload.length > 0
          ? [{ drill_filters: drillFiltersForPayload, drill_columns: drillColumnsForPayload }]
          : [];
    if (isXAxisChart && drilldownLevelsForPayload.length > 1) {
      drilldownLevelsForPayload = [drilldownLevelsForPayload[0]];
    }

    const baseParams = (basePayload.params || {}) as Record<string, unknown>;
    // For drill-through, always include the full drill path in drill_filters
    // (previous drilldown levels + current slice). Do not collapse by column.
    let drillFiltersFullPath: Array<{ column: string; value: any }> = [
      ...drillFiltersForPayload,
      ...currentSliceFilters,
    ];
    // If nothing resolved, fallback to the current slice only.
    if (drillFiltersFullPath.length === 0 && resolvedColumn) {
      drillFiltersFullPath = [{ column: resolvedColumn, value: drillValue }];
    }
    // For x-axis charts, keep only the first filter to match backend expectations.
    if (isXAxisChart && drillFiltersFullPath.length > 1) {
      drillFiltersFullPath = [drillFiltersFullPath[0]];
    }
    const drillThroughPayload: CreateChartPayload = {
      ...basePayload,
      params: {
        ...basePayload.params,
        source: (baseParams.source as string) ?? selectedSource ?? '',
        is_drilldown: hasDrillLevels,
        ...(drilldownLevelsForPayload.length > 0 && { drilldown_levels: drilldownLevelsForPayload }),
        is_drill_through: true,
        drill_through_columns: drillThroughColumns,
        drill_filters: drillFiltersFullPath,
        drill_columns: drillColumnsForPayload.length > 0 ? drillColumnsForPayload : [],
      },
    };
    try {
      // eslint-disable-next-line no-console
      console.info('[ChartFormulator DrillThrough] final request params', {
        drill_through_columns: (drillThroughPayload as any)?.params?.drill_through_columns,
        drill_filters: (drillThroughPayload as any)?.params?.drill_filters,
        drill_columns: (drillThroughPayload as any)?.params?.drill_columns,
      });
    } catch (e) {}

    setDrillThroughContext({ field: inferredCurrentColumn as string, value: normalizedCurrentValue });
    setDrillThroughLastRequest(drillThroughPayload);
    setDrillThroughLastResponse(null);
    setIsDrillThroughDialogOpen(true);
    setIsDrillThroughLoading(true);
    setDrillThroughGridRows([]);
    setDrillThroughColumnDefs([]);

    const setGridFromData = (data: any[]) => {
      setDrillThroughGridRows(data);
      if (data.length > 0) {
        const keys = Object.keys(data[0] || {});
        setDrillThroughColumnDefs(keys.map((k) => ({
          field: k,
          headerName: k,
          sortable: true,
          filter: true,
          resizable: true,
          valueFormatter: (params: any) => {
            const v = params?.value;
            if (v === null || v === undefined) return '';
            return typeof v === 'number' ? (v as number).toLocaleString() : String(v);
          },
        })));
      }
    };

    try {
      const chartResponse = await createChart(drillThroughPayload as any);
      const resp = chartResponse as any;
      setDrillThroughLastResponse(resp ?? null);
      if (resp && (resp.status === true || resp.data !== undefined) && Array.isArray(resp.data)) {
        setGridFromData(resp.data);
      } else if (resp && resp.data !== undefined && !Array.isArray(resp.data)) {
        const arr = Array.isArray(resp.data.rows) ? resp.data.rows : (resp.data && Array.isArray(resp.data) ? resp.data : []);
        if (arr.length > 0) setGridFromData(arr);
      }
    } catch (err) {
      setDrillThroughLastResponse(err instanceof Error ? { error: err.message } : { error: String(err) });
      try {
        const controller = new AbortController();
        const response = await createChartStreaming(drillThroughPayload as any, controller.signal);
        if (response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          const rows: any[] = [];
          let columnKeys: string[] = [];
          while (true) {
            const { value: chunk, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(chunk, { stream: true });
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() || '';
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              try {
                const item = JSON.parse(trimmed);
                if (item && (item.status === true || item.data !== undefined) && Array.isArray(item.data)) {
                  rows.push(...item.data);
                  if (item.data.length > 0 && columnKeys.length === 0) columnKeys = Object.keys(item.data[0] || {});
                }
              } catch (_) {}
            }
            if (rows.length > 0) setDrillThroughGridRows([...rows]);
          }
          if (buffer.trim()) {
            try {
              const obj = JSON.parse(buffer);
              if (obj && Array.isArray(obj.data)) {
                rows.push(...obj.data);
                if (obj.data.length > 0 && columnKeys.length === 0) columnKeys = Object.keys(obj.data[0] || {});
              }
            } catch (_) {}
          }
          setDrillThroughGridRows(rows);
          setDrillThroughLastResponse({ status: true, data: rows });
          if (columnKeys.length > 0) {
            setDrillThroughColumnDefs(columnKeys.map((k) => ({
              field: k,
              headerName: k,
              sortable: true,
              filter: true,
              resizable: true,
              valueFormatter: (params: any) => {
                const v = params?.value;
                if (v === null || v === undefined) return '';
                return typeof v === 'number' ? (v as number).toLocaleString() : String(v);
              },
            })));
          }
        } else {
          const json = await response.json();
          setDrillThroughLastResponse(json ?? null);
          if (json && Array.isArray(json.data)) setGridFromData(json.data);
        }
      } catch (streamErr) {
        setDrillThroughLastResponse(streamErr instanceof Error ? { error: streamErr.message } : { error: String(streamErr) });
      }
    } finally {
      setIsDrillThroughLoading(false);
    }
  }, [drillthroughModeEnabled, drilldownFilters, drilldownLevels, validateAndBuildPayload, getDrilldownColumn, getColumnFromPayload, selectedSource, rawChartResponse]);

  /** Fetch pivot drilldown data for expandable rows. Returns raw pivot response for nested PivotChart. */
  const fetchPivotDrilldown = useCallback(
    async (params: { dimension: string; value: string }): Promise<any> => {
      const basePayload = validateAndBuildPayload(false) ?? lastChartPayloadRef.current;
      if (!basePayload) return null;
      const drillPayload = {
        ...basePayload,
        params: {
          ...(basePayload as any).params,
          is_drilldown: true,
          drill_filters: [{ column: params.dimension, value: params.value }],
        },
      };
      try {
        const res = await createChart(drillPayload as any);
        if (!res || (res as any).status === false) return null;
        const raw = res as any;
        if (raw.rows && raw.columns && raw.data && typeof raw.data === 'object') {
          return raw;
        }
        if (raw.data && typeof raw.data === 'object' && raw.data.rows && raw.data.columns) {
          return raw.data;
        }
        return null;
      } catch {
        return null;
      }
    },
    [validateAndBuildPayload]
  );

  /** Update drilldown columns from configurator (reorder/delete/add). Persists as a single level so all saved columns are editable in one list. */
  const handleBaseDrilldownColumnsChange = useCallback((columns: Array<{ column: string }>) => {
    setDrilldownLevels(columns.length ? [{ drill_filters: [], drill_columns: columns }] : []);
  }, []);

  /** When user confirms drilldown column selection: build payload with drill_columns and call API */
  const handleConfirmDrilldownColumns = useCallback(async () => {
    if (!pendingDrilldownContext || selectedDrillColumns.length === 0) {
      toast.error('Select at least one column for drilldown');
      return;
    }
    const { basePayload, finalDrillFilters, isSunburstViz } = pendingDrilldownContext;
    const drill_columns = selectedDrillColumns.map((column) => ({ column }));
    setDrilldownLevels((prev) => [...prev, { drill_filters: finalDrillFilters, drill_columns }]);
    const vizName = (basePayload?.visualization_name ?? '').toString().toLowerCase();
    const isBarOrGroupedBar = vizName === 'bar' || vizName === 'grouped_bar' || vizName === 'grouped-bar';
    const isLineChart = vizName === 'line';
    const isAreaChart = vizName === 'area';
    const isXAxisChart = isBarOrGroupedBar || isLineChart || isAreaChart;
    // For bar, line, and area drilldown: send drill column(s) in X-axis so x-axis changes (same payload as bar); other charts use drill_columns
    const params: Record<string, unknown> = {
      ...basePayload.params,
      is_drilldown: true,
      drill_filters: finalDrillFilters,
      ...(isXAxisChart
        ? (() => {
            const xAxisCols = selectedDrillColumns.slice(0, 1).map((column) => ({ columns: column }));
            const dimensionCols = selectedDrillColumns.slice(1).map((column) => ({ columns: column }));
            const xAxisParams: Record<string, unknown> = { 'X-axis': xAxisCols };
            if (dimensionCols.length > 0) xAxisParams.dimensions = dimensionCols;
            return xAxisParams;
          })()
        : { drill_columns }),
    };
    const payload: CreateChartPayload = {
      ...(isSunburstViz ? (() => {
        const copy: any = { ...basePayload };
        if (copy.chart_name) delete copy.chart_name;
        return copy;
      })() : { ...basePayload }),
      params,
    };
    setDrilldownStack((prev) => [...prev, { streamedData: [...streamedData], rawChartResponse: rawChartResponse ?? null }]);
    setDrilldownColumnDialogOpen(false);
    setPendingDrilldownContext(null);
    setSelectedDrillColumns([]);
    setIsLoadingChart(true);
    await executeChartRequest(payload, false);
  }, [pendingDrilldownContext, selectedDrillColumns, streamedData, rawChartResponse, executeChartRequest]);

  /** Expose drilldown levels to window so ChartSelector save payload can include them */
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__chartDrilldownLevels = drilldownLevels;
    }
  }, [drilldownLevels]);

  /** Load columns when drilldown dialog opens with a valid slice (pendingDrilldownContext) and we don't have any columns yet. */
  useEffect(() => {
    if (
      analyticsStudioInit ||
      isWorkflowPath ||
      !drilldownColumnDialogOpen ||
      pendingDrilldownContext == null ||
      currentFields.length > 0 ||
      !flowId.trim()
    ) {
      return;
    }
    handleLoadColumns();
  }, [
    analyticsStudioInit,
    isWorkflowPath,
    drilldownColumnDialogOpen,
    pendingDrilldownContext,
    flowId,
    currentFields.length,
    handleLoadColumns,
  ]);

  /** When drilldown dialog opens, show all sources by default (all checkboxes checked). Sources come from API dynamically. */
  const prevDrilldownOpenRef = useRef(false);
  useEffect(() => {
    const justOpened = drilldownColumnDialogOpen && !prevDrilldownOpenRef.current;
    if (justOpened && drilldownDialogSources.length > 0) {
      setDrilldownSourcesChecked(drilldownDialogSources.map((s) => s.name));
    }
    if (!drilldownColumnDialogOpen) {
      setDrilldownSourcesChecked([]);
    }
    prevDrilldownOpenRef.current = drilldownColumnDialogOpen;
  }, [drilldownColumnDialogOpen, drilldownDialogSources]);

  // Listen for pie slice interactions dispatched from PieChart fallback so drilldown/drill-through works
  useEffect(() => {
    const lastPieRef: { current?: { field: string; value: any; ts: number } } = { current: undefined };
    const handler = (ev: any) => {
      try {
        const detail = ev?.detail;
        console.log('ChartFormulator: received pieSliceInteraction', detail);
        if (!detail) return;
        const value = detail.value;
        const originalData = detail.originalData;
        if (value === undefined || value === null) return;

        // Normalize/resolve a canonical field name so dedupe works even when
        // one event supplies `column` and the other supplies only `field`/`category`
        let field = detail.column || detail.field || 'category';
        try {
          if ((!detail.column || field === 'category') && originalData && typeof originalData === 'object') {
            const candidateKeys = Object.keys(originalData || {}).filter(k => !!k && k !== 'value' && k !== 'category');
            const matching = candidateKeys.filter(k => currentFields.some((f) => f.name === k));
            if (matching.length > 0) {
              field = matching[0];
              console.log('ChartFormulator: normalized pie field from originalData', { field, matching });
            }
          }
        } catch (e) {
          // ignore normalization failures and fall back to provided field
          console.warn('ChartFormulator: failed to normalize pie field', e);
        }

        // Deduplicate rapid duplicate events (series click + pointer capture)
        const now = Date.now();
        const last = lastPieRef.current;
        if (last && last.field === field && String(last.value) === String(value) && (now - last.ts) < 600) {
          console.log('ChartFormulator: ignoring duplicate pieSliceInteraction', { field, value });
          return;
        }
        lastPieRef.current = { field, value, ts: now };
        const eventDimensionFields = Array.isArray(detail.dimensionFields) ? detail.dimensionFields : undefined;
        const eventDrillFilters = Array.isArray(detail.drillFilters) ? detail.drillFilters : undefined;
        if (userJustChoseDrilldownRef.current) {
          userJustChoseDrilldownRef.current = false;
          handleChartDrilldown(field, value, originalData, eventDimensionFields, eventDrillFilters);
          return;
        }
        if (drilldownModeEnabled) {
          handleChartDrilldown(field, value, originalData, eventDimensionFields, eventDrillFilters);
          return;
        }
        // When drill-through is active, route to drill-through only when drilldown is not active.
        if (drillthroughModeEnabled) {
          handleChartDrillThrough(field, value, originalData, eventDimensionFields, eventDrillFilters);
          return;
        }
      } catch (e) {
        console.log('ChartFormulator: pieSliceInteraction handler error', e);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('pieSliceInteraction', handler as EventListener);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('pieSliceInteraction', handler as EventListener);
      }
    };
  }, [handleChartDrilldown, handleChartDrillThrough, drilldownModeEnabled, drillthroughModeEnabled]);

  // Listen for sunburst interactions dispatched from SunburstChart (drilldown or drill-through)
  useEffect(() => {
    const lastSunRef: { current?: { field: string; value: any; ts: number } } = { current: undefined };
    const handler = (ev: any) => {
      try {
        const detail = ev?.detail;
        // eslint-disable-next-line no-console
        console.info('ChartFormulator: received sunburstDrilldown event', { detail });
        // detail from SunburstChart is { type: 'row'|'category', payload: any }
        if (!detail) return;

        let value: any = undefined;
        let originalData: any = undefined;
        let extractedField: string | undefined = undefined;
        if (detail.type === 'row') {
          originalData = detail.payload;
          // try to pick a sensible value from originalData (prefer a non-aggregated non-empty field)
          const keys = originalData ? Object.keys(originalData) : [];
          value = undefined;
          for (const k of keys) {
            if (k && k !== 'value' && k !== 'category' && typeof originalData[k] !== 'number') {
              value = originalData[k];
              break;
            }
          }
          if (value === undefined && keys.length > 0) value = originalData[keys[0]];
        } else if (detail.type === 'category') {
          const payload = detail.payload;
          // Accept explicit { column, value } payloads from SunburstChart
          if (payload && typeof payload === 'object' && payload.column && payload.value !== undefined) {
            extractedField = String(payload.column);
            value = payload.value;
          } else {
            value = detail.payload;
          }
        }

        if (value === undefined || value === null) return;

        // Normalize field similar to pie handler
        let field = 'category';
        try {
          if (extractedField) {
            field = extractedField;
          } else if (originalData && typeof originalData === 'object') {
            const candidateKeys = Object.keys(originalData || {}).filter((k) => !!k && k !== 'value' && k !== 'category');
            const matching = candidateKeys.filter((k) => currentFields.some((f) => f.name === k));
            if (matching.length > 0) {
              field = matching[0];
            }
          }
        } catch (e) {
          // ignore
        }

        // Deduplicate rapid duplicate events
        const now = Date.now();
        const last = lastSunRef.current;
        if (last && last.field === field && String(last.value) === String(value) && (now - last.ts) < 600) {
          return;
        }
        lastSunRef.current = { field, value, ts: now };
        const eventDimensionFields = Array.isArray(detail.dimensionFields) ? detail.dimensionFields : undefined;
        // If both modes are true, prefer drilldown to avoid first-click blocking after mode switch.
        if (drilldownModeEnabled) {
          handleChartDrilldown(field, value, originalData, eventDimensionFields);
          return;
        }
        if (drillthroughModeEnabled) {
          handleChartDrillThrough(field, value, originalData, eventDimensionFields);
          return;
        }
      } catch (e) {
        // ignore
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('sunburstDrilldown', handler as EventListener);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('sunburstDrilldown', handler as EventListener);
      }
    };
  }, [handleChartDrilldown, handleChartDrillThrough, currentFields, drilldownModeEnabled, drillthroughModeEnabled]);

  const handleDrilldownBack = useCallback(() => {
    if (drilldownStack.length === 0) return;
    const prev = drilldownStack[drilldownStack.length - 1];
    const newLevels = drilldownLevels.slice(0, -1);
    setDrilldownStack((s) => s.slice(0, -1));
    setDrilldownLevels(newLevels);
    setDrilldownFilters(newLevels.flatMap((l) => l.drill_filters).map((f) => ({ field: f.column, value: f.value })));
    setStreamedData(prev.streamedData ?? []);
    setRawChartResponse(prev.rawChartResponse ?? null);
    setDrilldownModeEnabled(false);
    setDrillthroughModeEnabled(false);
  }, [drilldownStack, drilldownLevels]);

  /** Route generic chart click interactions based on current mode. */
  const handleChartInteraction = useCallback((
    field: string,
    value: any,
    originalData?: any,
    eventDimensionFields?: string[],
    eventDrillFilters?: Array<{ column: string; value: any }>,
  ) => {
    if (userJustChoseDrilldownRef.current) {
      userJustChoseDrilldownRef.current = false;
      handleChartDrilldown(field, value, originalData, eventDimensionFields, eventDrillFilters);
      return;
    }
    if (drilldownModeEnabled) {
      handleChartDrilldown(field, value, originalData, eventDimensionFields, eventDrillFilters);
      return;
    }
    if (drillthroughModeEnabled) {
      handleChartDrillThrough(field, value, originalData, eventDimensionFields, eventDrillFilters);
    }
  }, [handleChartDrilldown, handleChartDrillThrough, drilldownModeEnabled, drillthroughModeEnabled]);

  // Handle create chart - always uses create API
  const handleGenerateChart = useCallback(async (opts?: { allowInView?: boolean }) => {
    // allowInView: when true, permit generation even if `isViewOnly` is set
    if (isViewOnly && !opts?.allowInView) {
      if (typeof console !== 'undefined') {
        console.log('ChartFormulator: handleGenerateChart blocked by view-only (allowInView not set)');
      }
      return;
    }
    // Prevent concurrent executions using ref (avoids dependency issues)
    if (isGeneratingRef.current) {
      return;
    }

    if (typeof console !== 'undefined') {
      console.log('ChartFormulator: handleGenerateChart called', { isViewOnly, allowInView: opts?.allowInView, persistedChartIdForApi, selectedChart: selectedChart?.uniqueId, selectedSource, flowId });
    }

    // Mark that generation is in progress and record that an explicit/manual
    // generation occurred so scheduled auto-generate effects won't also run.
    isGeneratingRef.current = true;
    hasAutoGeneratedRef.current = true;
    const effectiveFlowId = isWorkflowPath ? (storeFlowId ?? flowId) : flowId;
    const canGenerate = analyticsStudioInit
      ? canGenerateAnalyticsStudioChart(analyticsStudioInit)
      : !!(effectiveFlowId && String(effectiveFlowId).trim());
    if (!canGenerate) {
      toast.error(analyticsStudioInit ? 'Chart source is not configured' : 'Please enter a Flow ID');
      isGeneratingRef.current = false;
      return;
    }

    // On fresh Create Chart click, reset drilldown/drill-through context only when NOT in edit mode.
    // In edit mode we keep drilldown levels so Create Chart sends the saved drilldown columns.
    if (!persistedChartIdForApi) {
      setDrilldownFilters([]);
      setDrilldownLevels([]);
      setDrilldownStack([]);
      setPendingDrilldownContext(null);
      setSelectedDrillColumns([]);
      setDrilldownColumnDialogOpen(false);
      setDrilldownModeEnabled(false);
      setDrillthroughModeEnabled(false);
    }

    const payload = validateAndBuildPayload(false);
    if (!payload) {
      isGeneratingRef.current = false;
      return;
    }

    // Strip drilldown fields from create payload only when not in edit mode.
    // In edit mode we send drilldown_levels so the create API uses previous drilldown columns.
    if ((payload as any).params) {
      (payload as any).params.is_drilldown = false;
      if (!persistedChartIdForApi) {
        delete (payload as any).params.drilldown_levels;
        delete (payload as any).params.drill_filters;
        delete (payload as any).params.drill_columns;
      }
      delete (payload as any).params.is_drill_through;
      delete (payload as any).params.drill_through_columns;
    }

    setIsLoadingChart(true);
    await executeChartRequest(payload, false);
  }, [isWorkflowPath, storeFlowId, flowId, persistedChartIdForApi, validateAndBuildPayload, executeChartRequest, isViewOnly, analyticsStudioInit]);

  // Handle update chart - uses update API
  const handleUpdateChart = useCallback(async (overrideFormValues?: any) => {
    if (isViewOnly) return;
    // Prevent concurrent executions using ref (avoids dependency issues)
    if (isGeneratingRef.current) {
      return;
    }

    if (!persistedChartIdForApi) {
      toast.error('Chart ID is required for update');
      return;
    }

    isGeneratingRef.current = true;
    const effectiveFlowId = isWorkflowPath ? (storeFlowId ?? flowId) : flowId;
    const canGenerate = analyticsStudioInit
      ? canGenerateAnalyticsStudioChart(analyticsStudioInit)
      : !!(effectiveFlowId && String(effectiveFlowId).trim());
    if (!canGenerate) {
      // toast.error(analyticsStudioInit ? 'Chart source is not configured' : 'Please enter a Flow ID');
      isGeneratingRef.current = false;
      return;
    }

    const payload = validateAndBuildPayload(true, overrideFormValues);
    if (!payload) {
      isGeneratingRef.current = false;
      return;
    }

    setIsLoadingChart(true);
    await executeChartRequest(payload, true);
  }, [isWorkflowPath, storeFlowId, flowId, persistedChartIdForApi, validateAndBuildPayload, executeChartRequest, isViewOnly, analyticsStudioInit]);

  // Expose handleGenerateChart to window for auto-generation in edit mode
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Wrap to allow generation when invoked externally (e.g., from dev tools)
      (window as any).__handleGenerateChart = (opts?: any) => {
        if (typeof console !== 'undefined') {
          console.log('ChartFormulator: window.__handleGenerateChart invoked', { opts, isViewOnly });
        }
        // Always allow generation for external callers
        return handleGenerateChart({ allowInView: true } as any);
      };
    }
    return () => {
      if (typeof window !== 'undefined') {
        try {
          delete (window as any).__handleGenerateChart;
        } catch (e) {
          (window as any).__handleGenerateChart = undefined;
        }
      }
    };
  }, [handleGenerateChart]);

  // Auto-generate chart in edit mode once form is populated
  useEffect(() => {
    // Only auto-generate if:
    // 1. We're in edit mode (editChartId exists)
    // 2. Chart form data is loaded
    // 3. Form values have been populated (editFormValues is set)
    // 4. Flow ID is set
    // 5. Selected chart is set
    // 6. Selected source is set
    // 7. We haven't already auto-generated for this edit session
    // 8. We're not currently loading or generating
    if (
      editChartId &&
      chartFormData &&
      editFormValues &&
      Object.keys(editFormValues).length > 0 &&
      flowId &&
      flowId.trim() &&
      selectedChart &&
      selectedSource &&
      !hasAutoGeneratedRef.current &&
      !isLoadingEditChart &&
      !isGeneratingRef.current &&
      !isPopulatingFormRef.current
    ) {
      // Generate chart immediately using loaded edit values
      if (
        hasAutoGeneratedRef.current ||
        isLoadingEditChart ||
        isGeneratingRef.current ||
        isPopulatingFormRef.current
      ) {
        return;
      }
      
      hasAutoGeneratedRef.current = true;
      // Call the create-chart flow initially in edit mode so the previous
      // data is rendered using the create API (streaming create endpoint).
      // The form values were populated into window.__chartFormValues by
      // the populate/initialize logic, so `handleGenerateChart` will use
      // those values to build and execute the create request.
      handleGenerateChart();
    }
  }, [
    editChartId,
    chartFormData,
    editFormValues,
    flowId,
    selectedChart,
    selectedSource,
    isLoadingEditChart,
    handleGenerateChart,
    handleUpdateChart,
  ]);

  // Edit-mode retry: in production, form/flowId may be ready after the layout's one-shot call.
  // Retry until we can build a payload and call create/update chart API (same behavior as localhost).
  const editModeRetryAttemptsRef = useRef(0);
  useEffect(() => {
    if (!editChartId || isViewOnly || hasAutoGeneratedRef.current || !editChartData) return;
    if (isLoadingEditChart || isGeneratingRef.current || isPopulatingFormRef.current) return;

    editModeRetryAttemptsRef.current = 0;
    const maxAttempts = 12;
    const intervalMs = 450;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const tryEditModeGenerate = () => {
      if (hasAutoGeneratedRef.current || isGeneratingRef.current) return;

      const payload = validateAndBuildPayload(true);
      if (payload) {
        hasAutoGeneratedRef.current = true;
        handleUpdateChart();
        return;
      }

      editModeRetryAttemptsRef.current += 1;
      if (editModeRetryAttemptsRef.current < maxAttempts) {
        timeoutId = setTimeout(tryEditModeGenerate, intervalMs);
      }
    };

    const initialTimer = setTimeout(tryEditModeGenerate, 300);
    return () => {
      clearTimeout(initialTimer);
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, [
    editChartId,
    editChartData,
    isLoadingEditChart,
    isViewOnly,
    validateAndBuildPayload,
    handleUpdateChart,
  ]);

  // Auto-generate chart when entering view-only mode if form values are present
  useEffect(() => {
    if (!isViewOnly) return;
    if (typeof console !== 'undefined') console.log('ChartFormulator: view-only effect triggered', { isGenerating: isGeneratingRef.current, hasAutoGenerated: hasAutoGeneratedRef.current, chartFormDataPresent: !!chartFormData, editChartDataPresent: !!editChartData });
    // Avoid duplicate/parallel generation
    if (isGeneratingRef.current || hasAutoGeneratedRef.current) return;

    // If we have loaded edit chart data, prefer generating from that source
    if (editChartId && editChartData) {
      if (typeof console !== 'undefined') console.log('ChartFormulator: view-only will generate from editChartData');
      hasAutoGeneratedRef.current = true;
      generateChartFromEditData(editChartData);
      return;
    }

    if (!chartFormData) {
      if (typeof console !== 'undefined') console.log('ChartFormulator: view-only skipped - no chartFormData yet');
      return;
    }

    const formValues = (window as any).__chartFormValues || {};
    if (!formValues || Object.keys(formValues).length === 0) {
      if (typeof console !== 'undefined') console.log('ChartFormulator: view-only skipped - no form values yet');
      return;
    }

    // Try to build payload; if it fails, still attempt generation once as a fallback
    const payload = validateAndBuildPayload(false);
    if (!payload) {
      if (typeof console !== 'undefined') console.log('ChartFormulator: validateAndBuildPayload returned null in view-only; attempting generation fallback');
      hasAutoGeneratedRef.current = true;
      // Attempt generation - this will run validation again but may succeed if transient state changed
      handleGenerateChart({ allowInView: true });
      return;
    }

    hasAutoGeneratedRef.current = true;
    // allow generation in view-only mode
    handleGenerateChart({ allowInView: true });
  }, [isViewOnly, chartFormData, validateAndBuildPayload, handleGenerateChart]);

  // Retry effect: attempt generation a few times after entering view-only
  const viewAutoGenAttemptsRef = useRef(0);
  useEffect(() => {
    if (!isViewOnly || hasAutoGeneratedRef.current) return;

    viewAutoGenAttemptsRef.current = 0;
    const maxAttempts = 8;
    const interval = 400; // ms
    let timer: NodeJS.Timeout | null = null;

    const tryGenerate = async () => {
      if (isGeneratingRef.current || hasAutoGeneratedRef.current) return;

      // If editChartData becomes available, use it
      if (editChartId && editChartData) {
        if (typeof console !== 'undefined') console.log('ChartFormulator: retry effect - generating from editChartData');
        hasAutoGeneratedRef.current = true;
        await generateChartFromEditData(editChartData);
        return;
      }

      const payload = validateAndBuildPayload(false);
      if (payload) {
        if (typeof console !== 'undefined') console.log('ChartFormulator: retry effect - payload ready, calling handleGenerateChart');
        hasAutoGeneratedRef.current = true;
        await handleGenerateChart({ allowInView: true });
        return;
      }

      viewAutoGenAttemptsRef.current += 1;
      if (viewAutoGenAttemptsRef.current >= maxAttempts) {
        if (typeof console !== 'undefined') console.log('ChartFormulator: retry effect - max attempts reached');
        return;
      }
      timer = setTimeout(tryGenerate, interval);
    };

    // Start shortly after mount to give ChartConfigurator time to populate window values
    timer = setTimeout(tryGenerate, 200);
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isViewOnly, chartFormData, validateAndBuildPayload, handleGenerateChart]);

  // Auto-generate chart in create mode when form values are ready (including workflow path)
  useEffect(() => {
    // Skip if in edit mode or if we're still loading/generating
    if (editChartId || isLoadingChart || isGeneratingRef.current || isPopulatingFormRef.current || isLoadingEditChart) {
      return;
    }

    // Get current form values
    const formValues = (window as any).__chartFormValues || {};
    
    // Check if we have the minimum required fields to generate a chart
    const hasMetricOrMetrics = formValues.metric || formValues.metrics;
    const hasDimensionsOrXAxis = formValues.dimensions || formValues['x-axis'];
    
    // In workflow path, we might not have selectedSource set yet, but we can use source from form values
    const effectiveSource = selectedSource || formValues.source;
    
    // Only auto-generate if:
    // 1. Not in edit mode
    // 2. Chart form data is loaded (form configuration fetched)
    // 3. Flow ID is set
    // 4. Selected chart is set
    // 5. Source is available (either selectedSource or from form values)
    // 6. Form has required fields (metrics and dimensions/x-axis)
    // 7. We haven't already auto-generated (check ref)
    if (
      chartFormData &&
      flowId &&
      flowId.trim() &&
      selectedChart &&
      effectiveSource &&
      hasMetricOrMetrics &&
      hasDimensionsOrXAxis &&
      !hasAutoGeneratedRef.current
    ) {
      // Mark as generating to prevent duplicate calls
      hasAutoGeneratedRef.current = true;
      
      // Small delay to ensure form is fully ready
      const timer = setTimeout(() => {
        // Double-check conditions before generating
        const currentFormValues = (window as any).__chartFormValues || {};
        const hasMetrics = currentFormValues.metric || currentFormValues.metrics;
        const hasDims = currentFormValues.dimensions || currentFormValues['x-axis'];
        
        if (!isGeneratingRef.current && !isLoadingChart && hasMetrics && hasDims && selectedChart && flowId) {
          handleGenerateChart();
        } else {
          // Reset if we can't generate now
          hasAutoGeneratedRef.current = false;
        }
      }, 1200); // Increased delay for workflow path to ensure everything is ready
      
      return () => clearTimeout(timer);
    }
  }, [
    editChartId,
    chartFormData,
    flowId,
    selectedChart,
    selectedSource,
    isLoadingChart,
    isLoadingEditChart,
    handleGenerateChart,
  ]);

  const handleSaveChart = () => {
    if (isViewOnly) return;
    const hasFlowOrAnalyticsSource =
      !!flowId?.trim() || canGenerateAnalyticsStudioChart(analyticsStudioInit);
    if (!chartFormData || !selectedSource || !hasFlowOrAnalyticsSource || !selectedChart) {
      toast.error('Please configure the chart before saving');
      return;
    }

    // Open dialog to get chart name
    setChartNameToSave(selectedChart.name || '');
    setIsSaveChartNameDialogOpen(true);
  };

  const handleConfirmSaveChartWithName = async () => {
    if (isViewOnly) return;
    if (!chartNameToSave.trim()) {
      toast.error('Please enter a chart name');
      return;
    }

    if (!chartFormData || !selectedSource || (!flowId?.trim() && !canGenerateAnalyticsStudioChart(analyticsStudioInit)) || !selectedChart) {
      toast.error('Please configure the chart before saving');
      return;
    }

    // Get form values from ChartConfigurator
    const formValues = (window as any).__chartFormValues || {};

    // Get form parameters to check which fields are actually present
    const formParams = chartFormData?.parameters || (window as any).__chartFormParams || [];
    const saveFormHasXAxisField = formParams.some((p: any) => p.key === 'x-axis' || p.key === 'X-axis');
    const saveFormHasDimensionsField = formParams.some((p: any) => p.key === 'dimensions');

    // Track validation errors
    const errors = new Set<string>();
    let errorMessage = '';

    // 1. Pivot: require rows and columns; others: dimensions OR x-axis when present in form
    const chartTypeForSave = selectedChart?.uniqueId?.toLowerCase() || selectedChart?.name?.toLowerCase() || '';
    const isPivotForSave = chartTypeForSave.includes('pivot');
    if (isPivotForSave) {
      const hasRows = formValues.rows && (
        (Array.isArray(formValues.rows) && formValues.rows.length > 0) ||
        (!Array.isArray(formValues.rows) && formValues.rows)
      );
      const hasColumns = formValues.columns && (
        (Array.isArray(formValues.columns) && formValues.columns.length > 0) ||
        (!Array.isArray(formValues.columns) && formValues.columns)
      );
      if (!hasRows || !hasColumns) {
        if (!hasRows) errors.add('rows');
        if (!hasColumns) errors.add('columns');
        errorMessage = 'Rows and Columns are required for pivot table';
      }
    } else {
      const hasDimensionsParam = formParams.some((p: any) => p.key === 'dimensions' || p.key === 'x-axis' || p.key === 'X-axis');
      if (hasDimensionsParam) {
        const hasDimensions = formValues.dimensions && (
          (Array.isArray(formValues.dimensions) && formValues.dimensions.length > 0) ||
          (!Array.isArray(formValues.dimensions) && formValues.dimensions)
        );
        const xAxisAny = formValues['x-axis'] ?? formValues['X-axis'];
        const hasXAxis = xAxisAny && (
          (Array.isArray(xAxisAny) && xAxisAny.length > 0) ||
          (!Array.isArray(xAxisAny) && xAxisAny)
        );
        if (!hasDimensions && !hasXAxis) {
          const dimensionsParam = formParams.find((p: any) => p.key === 'dimensions' || p.key === 'x-axis' || p.key === 'X-axis');
          const fieldName = dimensionsParam?.label || dimensionsParam?.key || 'Dimensions or X-axis';
          errors.add(dimensionsParam?.key || 'dimensions');
          errorMessage = `${fieldName} is required`;
        }
      }
    }

    // 2. Check for metric OR metrics (depending on chart type)
    const hasMetric = formValues.metric && (
      (Array.isArray(formValues.metric) && formValues.metric.length > 0) ||
      (!Array.isArray(formValues.metric) && formValues.metric)
    );
    const hasMetrics = formValues.metrics && (
      (Array.isArray(formValues.metrics) && formValues.metrics.length > 0) ||
      (!Array.isArray(formValues.metrics) && formValues.metrics)
    );
    const hasMtric = formValues.mtric && (
      (Array.isArray(formValues.mtric) && formValues.mtric.length > 0) ||
      (!Array.isArray(formValues.mtric) && formValues.mtric)
    );

    if (!hasMetric && !hasMetrics && !hasMtric) {
      // Find which field name is used in the form
      const metricParam = formParams.find((p: any) => p.key === 'metric' || p.key === 'metrics' || p.key === 'mtric');
      const fieldName = metricParam?.label || metricParam?.key || 'Metric or Metrics';
      errors.add(metricParam?.key || 'metrics');
      if (errorMessage) {
        errorMessage += ` and ${fieldName} is required`;
      } else {
        errorMessage = `${fieldName} is required`;
      }
    }

    if (errors.size > 0) {
      // Set validation errors in ChartConfigurator
      if (typeof window !== 'undefined' && (window as any).__setValidationErrors) {
        (window as any).__setValidationErrors(errors);
      }
      toast.error(errorMessage);
      setIsSaveChartNameDialogOpen(false);
      return;
    }

    // Prevent saving when X-axis and dimensions reference the same column (only when both exist on this chart type)
    try {
      if (saveFormHasXAxisField && saveFormHasDimensionsField) {
        const xAxisValueRaw = formValues['x-axis'] || formValues['X-axis'] || null;
        const xAxisCol = Array.isArray(xAxisValueRaw) ? xAxisValueRaw[0] : xAxisValueRaw;
        const xAxisName = extractColumnName(xAxisCol);
        const dimValue = formValues.dimensions || null;
        const dimArr = Array.isArray(dimValue) ? dimValue : (dimValue ? [dimValue] : []);
        const dimNames = dimArr.map((d: any) => ('' + extractColumnName(d)).toLowerCase()).filter(Boolean);
        if (xAxisName && dimNames.includes(('' + xAxisName).toLowerCase())) {
          toast.error('Cannot save chart: X-axis and dimensions use the same column. Choose different columns.');
          setIsSaveChartNameDialogOpen(false);
          return;
        }
      }
    } catch (e) {
      // ignore
    }

    setIsSavingChart(true);
    setIsSaveChartNameDialogOpen(false);
    try {
      // Build payload from form values (same as create-chart)
      const effectiveFlowId = isWorkflowPath ? (storeFlowId ?? flowId) : flowId;
      const payload: CreateChartPayload = {
        flow_id: effectiveFlowId,
        visualization_name: selectedChart.uniqueId || selectedChart.name.toLowerCase().replace(/\s+/g, '_'),
        chart_name: chartNameToSave.trim(),
        params: {
          source: selectedSource,
          limit: undefined,
          is_drilldown: false,
        },
      };

      // Include upstream node id when saving charts from a workflow context
      if (isWorkflowPath && nid) {
        (payload as any).node_id = effectiveFlowId + '_' + nid;
        (payload as any).unique_id = effectiveFlowId + '_' + nid;
      }

      const chartType = selectedChart.uniqueId?.toLowerCase() || selectedChart.name.toLowerCase();
      const isBarChart = chartType.includes('bar') || chartType.includes('column');
      const isLineChart = chartType.includes('line');
      const isAreaChart = chartType.includes('area');
      const isSunburstChart = chartType.includes('sunburst');

      // Build metrics — same resolver as generate chart (not workflow-specific)
      if (formValues.metric || formValues.metrics || formValues.mtric) {
        const metricValue = formValues.metric || formValues.metrics || formValues.mtric;
        const metricColumns = Array.isArray(metricValue) ? metricValue : (metricValue ? [metricValue] : []);
        payload.params.metrics = metricColumns.map((col: any, idx: number) => {
          const colName = extractColumnName(col);
          if (!colName) return null;

          let operation = (resolveMetricNested(formValues, formParams, 'operation', idx, col) as string) || '';
          if (!operation) operation = 'COUNT';

          const alias = resolveMetricNested(formValues, formParams, 'alias', idx, col) as string | null;

          return {
            columns: colName,
            operation,
            ...(alias && { alias, name: alias }),
          };
        }).filter((m: any) => m && m.columns);
      }

      // Build X-axis only if this visualization's form includes an X-axis field
      const xAxisAny = formValues['x-axis'] ?? formValues['X-axis'];
      if (saveFormHasXAxisField && xAxisAny) {
        const xAxisValue = xAxisAny;
        // Extract the first column object/name from x-axis (can be string, object or array)
        const xAxisCol = Array.isArray(xAxisValue) ? xAxisValue[0] : xAxisValue;
        const xAxisColName = extractColumnName(xAxisCol);
        const alias = getNestedValue(formValues, 'x-axis', 'alias')
          || getNestedValue(formValues, 'x-axis', 'label')
          || getNestedValue(formValues, 'X-axis', 'alias')
          || getNestedValue(formValues, 'X-axis', 'label');
        if (xAxisColName) {
          const xObj: any = { columns: xAxisColName };
          if (alias) xObj.alias = alias;
          payload.params['X-axis'] = [xObj];
        }
      }

      // Build dimensions - only if this chart's form has a dimensions field
      if (saveFormHasDimensionsField && formValues.dimensions) {
        const dimValue = formValues.dimensions;
        const dimColumns = Array.isArray(dimValue) ? dimValue : (dimValue ? [dimValue] : []);
        payload.params.dimensions = dimColumns.map((col: any, idx: number) => {
          const colName = extractColumnName(col);
          if (!colName) return null;

          const alias = getNestedValue(formValues, 'dimensions', 'alias', idx);
          return {
            columns: colName,
            ...(alias && { alias }),
          };
        }).filter((d: any) => d && d.columns);
      }

      // Build hierarchy - for sunburst charts, hierarchy defines the multi-level structure
      if (isSunburstChart && formValues.hierarchy) {
        const hierarchyValue = formValues.hierarchy;
        const hierarchyColumns = Array.isArray(hierarchyValue) ? hierarchyValue : (hierarchyValue ? [hierarchyValue] : []);
        const hierarchyColumnNames = hierarchyColumns
          .map((col: any) => extractColumnName(col))
          .filter((h: any) => h) as string[];
        currentHierarchyRef.current = hierarchyColumnNames.length > 0 ? hierarchyColumnNames : null;
        (payload.params as any).hierarchy = hierarchyColumnNames;
      } else {
        currentHierarchyRef.current = null;
      }

      // Pivot: rows, columns, apply_metrics_on, filters (for save chart)
      const isPivotChartSave = chartType.includes('pivot');
      if (isPivotChartSave) {
        const rowsValue = formValues.rows;
        const rowsArr = Array.isArray(rowsValue) ? rowsValue : (rowsValue ? [rowsValue] : []);
        (payload.params as any).rows = rowsArr.map((col: any) => extractColumnName(col)).filter(Boolean) as string[];
        const columnsValue = formValues.columns;
        const columnsArr = Array.isArray(columnsValue) ? columnsValue : (columnsValue ? [columnsValue] : []);
        (payload.params as any).columns = columnsArr.map((col: any) => extractColumnName(col)).filter(Boolean) as string[];
        (payload.params as any).apply_metrics_on = formValues.apply_metrics_on || 'columns';
        if (formValues.filters && Array.isArray(formValues.filters) && formValues.filters.length > 0) {
          (payload.params as any).filters = formValues.filters.map((col: any, idx: number) => {
            const colName = extractColumnName(col);
            if (!colName) return null;
            const operator = getNestedValue(formValues, 'filters', 'operator', idx) || '=';
            const value = getNestedValue(formValues, 'filters', 'value', idx);
            return { columns: colName, operator, value };
          }).filter((f: any) => f && f.columns && f.value !== undefined);
        } else {
          (payload.params as any).filters = [];
        }
      }

      // For bar, line, and area charts, ensure metrics are set (no group_by fallback for dimensions)
      if (isBarChart || isLineChart || isAreaChart) {
        if (!payload.params.metrics || payload.params.metrics.length === 0) {
        }
      }

      // Ensure dimensions are unique (case-insensitive)
      if (payload.params.dimensions && Array.isArray(payload.params.dimensions)) {
        const seen2 = new Set<string>();
        payload.params.dimensions = payload.params.dimensions.filter((d: any) => {
          const key = String(d.columns || '').toLowerCase();
          if (!key || seen2.has(key)) return false;
          seen2.add(key);
          return true;
        });
      }

      // Remove any group_by remnants entirely
      delete (payload.params as any).group_by;

      // Ignore aggregate and any group_by-related structures entirely for all charts

      // Build filters - from "filters" drop area
      if (formValues.filters) {
        const filterValue = formValues.filters;
        const filterColumns = Array.isArray(filterValue) ? filterValue : (filterValue ? [filterValue] : []);
        payload.params.filters = filterColumns.map((col: any, idx: number) => {
          const colName = extractColumnName(col);
          if (!colName) return null;

          const operator = getNestedValue(formValues, 'filters', 'operator', idx) || '=';
          const value = getNestedValue(formValues, 'filters', 'value', idx);
          return {
            columns: colName,
            operator: operator,
            value: value,
          };
        }).filter((f: any) => f && f.columns && f.value);
      }

      if (formValues.limit != null && formValues.limit !== '') {
        payload.params.limit = Number(formValues.limit);
      } else {
        payload.params.limit = undefined;
      }

      // Save payload: only persist drill_columns per level (do not save drill_filters)
      if (drilldownLevels.length > 0) {
        payload.params.drilldown_levels = drilldownLevels.map((level) => ({
          drill_filters: [],
          drill_columns: level.drill_columns,
        }));
      }

      payload.chart_name = chartNameToSave.trim();

      const isEditModeLocal = !!persistedChartIdForApi;

      const saveChartTypeHint =
        selectedChart?.uniqueId?.toLowerCase() || selectedChart?.name?.toLowerCase() || '';
      attachCustomizationsToPayload(
        payload,
        customizationOptions,
        getSavedChartCustomizations(editChartData),
        saveChartTypeHint,
      );

      payload.params = stripChartFormAuxKeysFromParams(payload.params as any) as typeof payload.params;

      const payloadToSave = analyticsStudioInit
        ? applyAnalyticsStudioChartPayload(payload, analyticsStudioInit, selectedSource)
        : payload;

      // Save chart and, if in a workflow node, also persist node payload
      const selectedNodeLocal = selectedNode;
      const saveEndpointConfig = selectedNodeLocal?.data?.node?.save_node;
      const nodePayloadForPrevious = selectedNodeLocal?.data?.node?.payload || {};
      const prevChartDataAny = nodePayloadForPrevious.chart_data as Record<string, any> | undefined;
      const previousUniqueIdForUpdate = isEditModeLocal
        ? String(
            nodePayloadForPrevious.unique_id ??
              nodePayloadForPrevious.node_id ??
              prevChartDataAny?.unique_id ??
              prevChartDataAny?.node_id ??
              (payload as any).unique_id ??
              (payload as any).node_id ??
              '',
          ).trim()
        : '';

      if (isWorkflowPath && saveEndpointConfig?.module && saveEndpointConfig?.klass && selectedNodeLocal) {
        const nodePayload = selectedNodeLocal.data.node.payload || {};
        const chartParams = payloadToSave.params || nodePayload.params || {};

        const chartApiCall = isEditModeLocal
          ? updateChart({
              chart_id: persistedChartIdForApi,
              payload: {
                data: {
                  ...payloadToSave,
                  id: persistedChartIdForApi,
                  ...(previousUniqueIdForUpdate ? { previous_unique_id: previousUniqueIdForUpdate } : {}),
                },
                actions: 'update_chart',
                stmt_date: payloadToSave.stmt_date || '',
              },
            } as any)
          : saveChart(payloadToSave);

        const chartResponse = await chartApiCall;

        const resolvedChartId =
          getSavedChartIdFromResponse(chartResponse) ??
          (isEditModeLocal ? persistedChartIdForApi : undefined);

        if (!chartResponse?.status || resolvedChartId == null) {
          toast.error(chartResponse?.message || 'Failed to save chart (missing id)');
          return;
        }

        const { chart_name: _omitChartName, chart_id: _omitChartId, ...restNodePayload } = nodePayload;

        const updatedNodeData = {
          ...selectedNodeLocal.data,
          node: {
            ...selectedNodeLocal.data.node,
            payload: {
              ...restNodePayload,
              chart_name: payload.chart_name,
              chart_id: resolvedChartId,
              key: 'on-submit',
              params: chartParams,
              actions: isEditModeLocal ? 'update_chart' : 'create_chart',
              is_pandas: nodePayload?.is_pandas || false,
              is_polars: nodePayload?.is_polars || false,
              visualization_name: payload.visualization_name,
              chart_data: { params: chartParams, flow_id: payload.flow_id },
            },
          },
        };

        const savePayload = {
          ...updatedNodeData,
          current_node_id: selectedNodeLocal.id,
          flow_id: payload.flow_id,
        };

        const nodeResponse = await saveNodeDetailsApi(saveEndpointConfig, savePayload);

        if (nodeResponse) {
          try {
            useFlowStore.getState().updateNodeData(selectedNodeLocal.id, nodeResponse);
          } catch (e) {
            console.warn('Failed to update flow store with node response', e);
          }
        }

        toast.success(chartResponse.message || 'Chart saved successfully');
        setChartNameToSave('');
        if (isEditModeLocal) notifyEmbeddedChartUpdated();
      } else {
        // Fallback: just save the chart
        const response = isEditModeLocal
          ? await updateChart({
              chart_id: persistedChartIdForApi,
              payload: {
                data: {
                  ...payloadToSave,
                  id: persistedChartIdForApi,
                  ...(previousUniqueIdForUpdate ? { previous_unique_id: previousUniqueIdForUpdate } : {}),
                },
                actions: 'update_chart',
                stmt_date: payloadToSave.stmt_date || '',
              },
            } as any)
          : await saveChart(payloadToSave);

        if (response.status) {
          toast.success(response.message || 'Chart saved successfully');
          setChartNameToSave(''); // Reset chart name
          if (isEditModeLocal) notifyEmbeddedChartUpdated();
        } else {
          toast.error(response.message || 'Failed to save chart');
        }
      }
    } catch (error) {
      toast.error('Failed to save chart');
    } finally {
      setIsSavingChart(false);
    }
  };

  const layoutProps = {
    isViewOnly,
    sensors,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    activeId,
    getActiveDraggable,
    view,
    setView,
    savedCharts,
    threads,
    dashboardCharts,
    onRemoveChartFromDashboard: handleRemoveChartFromDashboard,
    onMaximizeChart: handleMaximizeChart,
    onDeleteSavedChart: handleDeleteSavedChart,
    isWorkflowPath,
    pathname,
    flowId,
    setFlowId,
    onLoadColumns: handleLoadColumns,
    onSaveChart: handleSaveChart,
    isLoadingColumns,
    isSavingChart,
    editChartId,
    workflowPersistedChartId,
    analyticsStudioInit,
    upstreamNodes,
    sources,
    selectedSource,
    onSourceChange: handleSourceChange,
    drilldownFilters,
    drilldownLevels,
    onBaseDrilldownColumnsChange: handleBaseDrilldownColumnsChange,
    onNavigateDrilldown: handleNavigateDrilldown,
    selectedChart,
    chartFormData,
    chartConfig,
    setChartConfig,
    onClearChart: handleClearChart,
    onUpdateChart: handleUpdateChart,
    onGenerateChart: handleGenerateChart,
    onSelectChart: handleSelectChart,
    onChartDrilldown: handleChartInteraction,
    isLoadingForm,
    isLoadingChart,
    editFormValues,
    customizationOptions,
    onCustomizationChange: handleCustomizationChange,
    editChartData,
    showEditChartData,
    setShowEditChartData,
    chartNameToSave,
    setChartNameToSave,
    copiedJson,
    setCopiedJson,
    chartData,
    rawChartResponse,
    agTheme,
    agGridRowData,
    agGridColumnDefs,
    isStreaming,
    streamedData,
    currentFields,
    currentFieldsForDrag: currentFields,
    threadToDelete,
    setThreadToDelete,
    onConfirmDeleteThread: handleConfirmDelete,
    isSaveChartNameDialogOpen,
    setIsSaveChartNameDialogOpen,
    onConfirmSaveChartWithName: handleConfirmSaveChartWithName,
    maximizedChart,
    maximizedChartThread,
    editingChartName,
    setEditingChartName,
    maximizedChartFilteredData,
    isLegendVisible,
    setIsLegendVisible,
    onCloseMaximize: handleCloseMaximize,
    onUpdateChartName: handleUpdateChartName,
    canDrilldownBack: drilldownStack.length > 0,
    onDrilldownBack: handleDrilldownBack,
    onPivotRowExpand: fetchPivotDrilldown,
    onSwitchToCreateMode: embedded ? undefined : handleSwitchToCreateMode,
    embedded,
    onEmbeddedClose,
    onEmbeddedChartUpdated,
    isDrilldownSupported,
    isDrillThroughSupported,
    isDrilldownArmed: drilldownModeEnabled,
    isDrillThroughArmed: drillthroughModeEnabled,
    onArmDrilldown: handleArmDrilldown,
    onArmDrillThrough: handleArmDrillThrough,
  };

  return (
    <>
      <ChartFormulatorLayout {...layoutProps} />
      <Dialog open={drilldownColumnDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setDrilldownColumnDialogOpen(false);
          setPendingDrilldownContext(null);
          setSelectedDrillColumns([]);
          setDrilldownColumnSearch('');
        }
      }}>
        <DialogContent className="z-[1300] max-w-md max-h-[90vh] flex flex-col gap-3">
          <DialogHeader className="flex-shrink-0 space-y-1">
            <DialogTitle className='text-base'>Select drilldown columns</DialogTitle>
            <DialogDescription className='text-muted-foreground text-xs'>
              Choose which sources to include, then pick one or more columns. Columns from checked sources will be sent as drill_columns.
            </DialogDescription>
          </DialogHeader>
          {currentFields.length === 0 && isLoadingColumns ? (
            <div className="flex items-center justify-center py-8 min-h-[200px] rounded-md border bg-muted/30">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading sources and columns...</span>
            </div>
          ) : drilldownDialogSources.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              {isWorkflowPath
                ? 'No previous node columns available for drilldown.'
                : 'No sources available. Enter a Flow ID and load columns first.'}
            </p>
          ) : (
            <>
              <div className="flex-shrink-0">
                <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-md border bg-muted/30 p-2 max-h-[120px] overflow-y-auto">
                  {drilldownDialogSources.map((source) => (
                    <label
                      key={source.name}
                      className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-muted/60 transition-colors"
                    >
                      <Checkbox
                        checked={drilldownSourcesChecked.includes(source.name)}
                        onCheckedChange={(checked) => {
                          setDrilldownSourcesChecked((prev) =>
                            checked ? [...prev, source.name] : prev.filter((s) => s !== source.name)
                          );
                        }}
                      />
                      <span className="text-xs select-none">{source.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1 flex-1 min-h-0">
                <p className="text-xs font-medium text-muted-foreground">Columns from checked sources</p>
                <div className="relative flex-shrink-0">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    type="text"
                    placeholder="Search columns..."
                    value={drilldownColumnSearch}
                    onChange={(e) => setDrilldownColumnSearch(e.target.value)}
                    className="pl-8 !h-8 text-xs"
                  />
                </div>
                <div
                  className="w-full rounded-md border bg-muted/30 overflow-y-auto overflow-x-hidden overscroll-contain flex-1 min-h-0"
                  style={{ height: '220px', minHeight: '220px' }}
                >
                  <div className="p-2 flex flex-col gap-0.5">
                    {(() => {
                      const checkedSourceSet = new Set(drilldownSourcesChecked);
                      const columnsFromChecked = drilldownDialogSources
                        .filter((s) => checkedSourceSet.has(s.name))
                        .flatMap((s) => (s.columns ?? []).map((col) => ({ column: col, source: s.name })));
                      const seen = new Set<string>();
                      const deduped = columnsFromChecked.filter(({ column }) => {
                        if (seen.has(column)) return false;
                        seen.add(column);
                        return true;
                      });
                      const searchLower = drilldownColumnSearch.trim().toLowerCase();
                      const filtered = searchLower
                        ? deduped.filter(({ column }) => column.toLowerCase().includes(searchLower))
                        : deduped;
                      if (deduped.length === 0) {
                        return (
                          <p className="text-sm text-muted-foreground py-4 px-2">
                            Check at least one source above to see columns.
                          </p>
                        );
                      }
                      if (filtered.length === 0) {
                        return (
                          <p className="text-sm text-muted-foreground py-4 px-2">
                            No columns match &quot;{drilldownColumnSearch.trim()}&quot;.
                          </p>
                        );
                      }
                      return filtered.map(({ column: columnName }) => (
                        <label
                          key={columnName}
                          className="flex items-center gap-2 cursor-pointer rounded-md px-2 py-0 hover:bg-muted/60 transition-colors"
                        >
                          <Checkbox
                            checked={selectedDrillColumns.includes(columnName)}
                            onCheckedChange={(checked) => {
                              setSelectedDrillColumns((prev) =>
                                checked ? [...prev, columnName] : prev.filter((c) => c !== columnName)
                              );
                            }}
                          />
                          <span className="text-sm select-none">{columnName}</span>
                        </label>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            </>
          )}
          <DialogFooter className="flex-shrink-0 border-t pt-4 mt-1">
            <Button
              variant="outline"
              onClick={() => {
                setDrilldownColumnDialogOpen(false);
                setPendingDrilldownContext(null);
                setSelectedDrillColumns([]);
                setDrilldownColumnSearch('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDrilldownColumns}
              disabled={selectedDrillColumns.length === 0}
            >
              Apply drilldown
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Drill Through: raw rows for selected slice — AG Grid with streaming support */}
      <Dialog open={isDrillThroughDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsDrillThroughDialogOpen(false);
          setDrillThroughContext(null);
          setDrillThroughGridRows([]);
          setDrillThroughColumnDefs([]);
          setDrillThroughLastRequest(null);
          setDrillThroughLastResponse(null);
        }
      }}>
        <DialogContent
          className="z-[1300] flex flex-col"
          style={{
            width: 'min(96vw, 900px)',
            minWidth: '560px',
            maxWidth: '96vw',
            height: 'min(88vh, 560px)',
            minHeight: '300px',
          }}
        >
          <DialogHeader>
            <DialogTitle className="font-bold">
              Drill Through
              {drillThroughContext ? ` — ${drillThroughContext.field}: ${String(drillThroughContext.value)}` : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 w-full flex flex-col gap-2">
            {isDrillThroughLoading ? (
              <div className="h-full flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                Loading...
              </div>
            ) : drillThroughColumnDefs.length === 0 && drillThroughGridRows.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                No data returned for this slice
              </div>
            ) : (
              <div className="h-full w-full ag-theme-quartz bg-background text-foreground flex-1 min-h-0" style={{ minHeight: '240px' }}>
                <AgGridReact
                  theme={themeQuartz}
                  rowHeight={30}
                  headerHeight={30}
                  rowData={drillThroughGridRows}
                  columnDefs={drillThroughColumnDefs}
                  defaultColDef={{ sortable: true, filter: true, resizable: true }}
                  pagination={true}
                  paginationPageSize={20}
                  paginationPageSizeSelector={[10, 20, 50, 100]}
                />
              </div>
            )}
            
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

