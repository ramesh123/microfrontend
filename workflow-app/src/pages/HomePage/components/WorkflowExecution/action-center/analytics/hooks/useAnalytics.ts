import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback, startTransition } from 'react';
import { toast } from 'sonner';
import { useNavigate, useLocation } from 'react-router';
import { getDashboards, getDashboardById, deleteDashboard } from '@/pages/Visualization/API/dashboardApi';
import { getStatementDates } from '@/controllers/API/ReconcilationAPI';
import { GRID_CELL_WIDTH, GRID_CELL_HEIGHT, DEFAULT_CONTAINER_WIDTH, DEFAULT_CONTAINER_HEIGHT, buildStaticBlockChartFromDashboard, getAnalyticsChartDataMapKey, isStaticLayoutContentChartId } from '@/pages/Dashboards/layoutConstants';
import { clampDashboardWidgetLayoutBox, getDashboardLayoutWidth, inferSavedGridCols } from '@/pages/Dashboards/utils/gridLayoutUtils';
import { CHART_GAP as DASHBOARD_CHART_GAP } from '@/pages/Dashboards/dashboardConstants';
import { getChartById, createChart, createChartStreaming } from '@/pages/Visualization/API/chartsApi';
import { isPieDonutOrRadiusPieChart, normalizePieLikeChartRows } from '@/pages/charts/chartVizTypes';
import {
  getChartRefreshIntervalSeconds,
  isAutoRefreshChart,
  isBigNumberVisualization,
  transformBigNumberChartData,
  type StreamChartDataSlice,
} from '@/pages/charts/components/charts/bigNumber';
import { buildDashboardCreateChartPayload } from '@/pages/Dashboards/utils/buildDashboardCreateChartPayload';
import { mergeDashboardWidgetChartMetadata } from '@/pages/Dashboards/utils/mergeDashboardWidgetChartMetadata';
import type { AnalyticsProps } from '../types';
import { getDashboardId, resolveDashboardDisplayTitle } from '../utils/dashboard';
import { downloadGridDataAsCsv } from '../utils/csvExport';
import { formatStatementDate, formatStatementDateDisplay } from '../utils/statementDate';

export function useAnalytics({
  flowId,
  workflowName,
  mode = 'workflow',
  dashboardId,
}: AnalyticsProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isAnalyticsStudio = mode === 'analytics-studio';
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [settingsActiveTab, setSettingsActiveTab] = useState('charts');
  const [dashboards, setDashboards] = useState<any[]>([]);
  const [isLoadingDashboards, setIsLoadingDashboards] = useState(false);
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(null);
  const [activeDashboard, setActiveDashboard] = useState<any | null>(null);
  const [isLoadingActiveDashboard, setIsLoadingActiveDashboard] = useState(false);
  /** Collapsed on enter; user toggles open/close via chevron only (not persisted). */
  const [isDashboardPickerExpanded, setIsDashboardPickerExpanded] = useState(false);
  const [deleteConfirmDashboardId, setDeleteConfirmDashboardId] = useState<string | null>(null);
  const [deletingDashboardId, setDeletingDashboardId] = useState<string | null>(null);
  const [chartDataMap, setChartDataMap] = useState<Record<number, any>>({});
  const handleStreamChartDataUpdate = useCallback((chartId: number, merged: StreamChartDataSlice) => {
    setChartDataMap((prev) => {
      const existing = prev[chartId];
      if (!existing) return prev;
      return {
        ...prev,
        [chartId]: {
          ...existing,
          chartData: merged.chartData ?? existing.chartData,
          chartColumns: merged.chartColumns ?? existing.chartColumns,
          rawResponse: merged.rawResponse ?? existing.rawResponse,
        },
      };
    });
  }, []);
  const [loadingCharts, setLoadingCharts] = useState<Set<number>>(new Set());
  const [chartDataRefreshKey, setChartDataRefreshKey] = useState(0);
  /** Drill mode: none = no interaction, drilldown = click to drill into saved charts. Stored in ref so dropdown changes don't re-render charts. */
  const drilldownModeRef = useRef<'none' | 'drilldown'>('none');
  /** Per-chart drilldown state: stack of { chartData, rawResponse, drillFilter } for Back and for accumulating filters; supports unlimited nested levels */
  const [chartDrilldownState, setChartDrilldownState] = useState<Record<number, {
    stack: Array<{ chartData: any[]; rawResponse?: any; drillFilter?: Array<{ column: string; value: any }> }>;
    currentChartData: any[];
    currentRawResponse?: any;
  }>>({});
  const [drilldownLoadingChartId, setDrilldownLoadingChartId] = useState<number | null>(null);
  const [isDataPreviewOpen, setIsDataPreviewOpen] = useState(false);
  const [previewChartId, setPreviewChartId] = useState<number | null>(null);
  /** Drill Through: when enabled, next slice click opens dialog and calls API with is_drill_through + drill_through_columns */
  const drillThroughModeRef = useRef(false);
  const drillThroughArmedChartIdRef = useRef<number | null>(null);
  const [isDrillThroughDialogOpen, setIsDrillThroughDialogOpen] = useState(false);
  const [drillThroughContext, setDrillThroughContext] = useState<{ chartId: number; field: string; value: any } | null>(null);
  const [drillThroughGridRows, setDrillThroughGridRows] = useState<any[]>([]);
  const [drillThroughColumnDefs, setDrillThroughColumnDefs] = useState<any[]>([]);
  const [isDrillThroughLoading, setIsDrillThroughLoading] = useState(false);
  const [drillThroughDialogWidth] = useState(1400);
  const [drillThroughDialogHeight] = useState(820);
  const [drilldownArmedChartId, setDrilldownArmedChartId] = useState<number | null>(null);
  const drilldownArmedChartIdRef = useRef<number | null>(null);
  const [drillThroughArmedChartId, setDrillThroughArmedChartId] = useState<number | null>(null);
  const [previewGridRowsState, setPreviewGridRowsState] = useState<any[] | null>(null);
  const [previewColumnDefsState, setPreviewColumnDefsState] = useState<any[] | null>(null);
  const lastInteractionRef = useRef<{ chartId: number; signature: string; valueKey: string; fieldGeneric: boolean; ts: number } | null>(null);

  // Statement date — auto-select latest from API on initial load
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [loadingDates, setLoadingDates] = useState(false);
  const hasUserSelectedDateRef = useRef(false);

  const stmtDateForApi = useMemo(() => formatStatementDate(date), [date]);

  const statementDateDisplay = useMemo(
    () => formatStatementDateDisplay(stmtDateForApi, loadingDates),
    [loadingDates, stmtDateForApi],
  );

  const fetchStatementDates = useCallback(async () => {
    if (!flowId) {
      setAvailableDates([]);
      return;
    }
    setLoadingDates(true);
    try {
      const response = await getStatementDates({ flow_id: flowId });
      const datesArray = Array.isArray(response) ? response : (response?.data || []);
      const dates = datesArray
        .map((item: { stmt_date?: string }) => {
          const dateStr = item.stmt_date;
          if (!dateStr) return null;
          const [year, month, day] = dateStr.split('-').map(Number);
          const dateObj = new Date(Date.UTC(year, month - 1, day));
          return !isNaN(dateObj.getTime()) ? dateObj : null;
        })
        .filter((d: Date | null): d is Date => d !== null)
        .sort((a, b) => a.getTime() - b.getTime());
      setAvailableDates(dates);
      setDate((currentDate) => {
        const latestDate = dates[dates.length - 1];
        if (!latestDate) return undefined;
        if (
          hasUserSelectedDateRef.current &&
          currentDate &&
          dates.some((d) => formatStatementDate(d) === formatStatementDate(currentDate))
        ) {
          return currentDate;
        }
        return latestDate;
      });
    } catch (error) {
      console.error('Failed to fetch statement dates:', error);
      setAvailableDates([]);
    } finally {
      setLoadingDates(false);
    }
  }, [flowId]);

  const isStatementDateDisabled = useCallback((candidate: Date) => {
    if (availableDates.length === 0) return false;
    const dateStr = formatStatementDate(candidate);
    return !availableDates.some((availableDate) => formatStatementDate(availableDate) === dateStr);
  }, [availableDates]);
  /** Ref updated inside setChartDrilldownState so multi-level drilldown always reads latest stack (avoids stale closure). */
  const chartDrilldownStateRef = useRef<typeof chartDrilldownState>(chartDrilldownState);
  chartDrilldownStateRef.current = chartDrilldownState;
  const handleChartDrilldownRef = useRef<((
    chartId: number,
    field: string,
    value: any,
    originalData?: any,
    eventDimensionFields?: string[],
    eventDrillFilters?: Array<{ column: string; value: any }>,
  ) => void) | null>(null);

  drilldownArmedChartIdRef.current = drilldownArmedChartId;

  const handleOpenDrilldown = useCallback(async (chartIdArg: number) => {
    const chartIdForDrilldown = chartIdArg;
    try {
      // eslint-disable-next-line no-console
      console.log('[Analytics Drill] open drilldown click', {
        chartIdForDrilldown,
        prevDrilldownMode: drilldownModeRef.current,
        prevDrillThroughMode: drillThroughModeRef.current,
        prevDrillThroughArmedChartId: drillThroughArmedChartIdRef.current,
      });
    } catch (e) { }
    // Toggle off when the same chart is already armed for drilldown.
    if (drilldownArmedChartIdRef.current === chartIdForDrilldown && drilldownModeRef.current === 'drilldown') {
      drilldownArmedChartIdRef.current = null;
      drilldownModeRef.current = 'none';
      drillThroughModeRef.current = false;
      drillThroughArmedChartIdRef.current = null;
      startTransition(() => {
        setDrillThroughArmedChartId(null);
        setDrilldownArmedChartId((prev) => (prev === chartIdForDrilldown ? null : prev));
      });
      return;
    }

    // Ensure drill-through does not intercept the first drilldown click.
    drillThroughModeRef.current = false;
    drillThroughArmedChartIdRef.current = null;
    setDrillThroughContext(null);
    drilldownArmedChartIdRef.current = chartIdForDrilldown;
    drilldownModeRef.current = 'drilldown';
    startTransition(() => {
      setDrillThroughArmedChartId(null);
      setDrilldownArmedChartId((prev) => (prev === chartIdForDrilldown ? prev : chartIdForDrilldown));
    });
    try {
      // eslint-disable-next-line no-console
      console.log('[Analytics Drill] drilldown armed', {
        chartIdForDrilldown,
        drilldownArmedChartId: drilldownArmedChartIdRef.current,
        drillThroughMode: drillThroughModeRef.current,
        drillThroughArmedChartId: drillThroughArmedChartIdRef.current,
      });
    } catch (e) { }
  }, []);

  const handleArmDrillThrough = useCallback((chartIdArg: number) => {
    // Toggle off when the same chart is already armed for drill-through.
    if (drillThroughArmedChartIdRef.current === chartIdArg && drillThroughModeRef.current) {
      drillThroughModeRef.current = false;
      drillThroughArmedChartIdRef.current = null;
      startTransition(() => {
        setDrillThroughArmedChartId((prev) => (prev === chartIdArg ? null : prev));
      });
      return;
    }

    drillThroughModeRef.current = true;
    drillThroughArmedChartIdRef.current = chartIdArg;
    drilldownModeRef.current = 'none';
    drilldownArmedChartIdRef.current = null;
    startTransition(() => {
      setDrilldownArmedChartId((prev) => (prev === null ? prev : null));
      setDrillThroughArmedChartId((prev) => (prev === chartIdArg ? prev : chartIdArg));
    });
  }, []);

  const computePreview = useCallback((infoIn: any) => {
    if (!infoIn) return { gridRows: [], columnDefs: [] };
    // Prefer raw API response data
    const rawData = infoIn?.rawResponse?.data;
    let rows: any[] = [];
    if (Array.isArray(rawData) && rawData.length > 0) {
      rows = rawData.map((r: any) => (r && typeof r === 'object' && 'originalData' in r ? r.originalData : r));
    } else if (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) {
      try {
        const rowDims = Array.isArray(infoIn?.rawResponse?.rows)
          ? infoIn.rawResponse.rows
          : (infoIn?.rawResponse?.rows && typeof infoIn.rawResponse.rows === 'object' ? Object.values(infoIn.rawResponse.rows) : []);
        const norm = (Object.keys(rawData).length === 1 && rawData[Object.keys(rawData)[0]] && typeof rawData[Object.keys(rawData)[0]] === 'object')
          ? rawData[Object.keys(rawData)[0]]
          : rawData;
        const rowIndexSource = (norm as any)[rowDims[0]] ?? (norm as any)[Object.keys(norm)[0]];
        if (!rowIndexSource || typeof rowIndexSource !== 'object') rows = [];
        else {
          const rowIndices = Object.keys(rowIndexSource).sort((a, b) => Number(a) - Number(b));
          const out: Record<string, any>[] = [];
          for (const idx of rowIndices) {
            const row: Record<string, any> = {};
            for (const dim of rowDims) row[String(dim)] = (norm as any)?.[String(dim)]?.[idx];
            const metricKeys = Object.keys(norm).filter((k) => !rowDims.includes(k));
            for (const key of metricKeys) row[key] = (norm as any)?.[key]?.[idx];
            out.push(row);
          }
          rows = out;
        }
      } catch (e) { rows = []; }
    } else {
      const chartRows = Array.isArray(infoIn?.chartData) ? infoIn.chartData : [];
      rows = chartRows.map((r: any) => (r && typeof r === 'object' && r.originalData != null ? r.originalData : r));
    }

    const gridRows = rows.map((row: any) => (row && typeof row === 'object' && !Array.isArray(row) ? row : { value: row }));

    const first = gridRows?.[0] || {};
    const keysFromRows = Object.keys(first).filter((k) => k !== 'originalData');
    const keysFromChartColumns = Array.isArray(infoIn?.chartColumns) ? (infoIn.chartColumns as any[]).map((c: any) => String(c)) : [];
    const keysFromRawColumns = Array.isArray(infoIn?.rawResponse?.columns) ? (infoIn.rawResponse.columns as any[]).map((c: any) => String(c)) : [];
    // Prefer current level raw response columns first.
    // chartColumns can be stale from base dashboard load and cause blank cells after drilldown.
    const keys = keysFromRawColumns.length > 0 ? keysFromRawColumns : keysFromRows.length > 0 ? keysFromRows : keysFromChartColumns;

    const columnDefs = keys.map((key) => ({ field: key, headerName: key, sortable: true, filter: true, resizable: true, valueFormatter: (params: any) => { const v = params?.value; if (v === null || v === undefined) return ''; return typeof v === 'number' ? v.toLocaleString() : String(v); }, cellStyle: typeof (first as any)[key] === 'number' ? { textAlign: 'right' } : { textAlign: 'left' } }));

    return { gridRows, columnDefs, rows };
  }, []);

  const handleOpenDataPreview = useCallback((chartIdArg: number) => {
    const cid = chartIdArg;
    // Compute preview data synchronously so AG Grid mounts with rows immediately
    const info = chartDrilldownState[cid] ? { ...chartDataMap[cid], chartData: chartDrilldownState[cid].currentChartData, rawResponse: chartDrilldownState[cid].currentRawResponse } : chartDataMap[cid];
    try {
      const { gridRows, columnDefs } = computePreview(info);
      setPreviewGridRowsState(gridRows);
      setPreviewColumnDefsState(columnDefs);
    } catch (e) {
      // ignore
      setPreviewGridRowsState([]);
      setPreviewColumnDefsState([]);
    }

    setPreviewChartId(cid);
    setIsDataPreviewOpen(true);
  }, [chartDataMap, chartDrilldownState, computePreview]);

  // Keep Data Preview in sync with current drilldown level response while dialog is open.
  useEffect(() => {
    if (!isDataPreviewOpen || !previewChartId) return;
    const info = chartDrilldownState[previewChartId]
      ? {
        ...chartDataMap[previewChartId],
        chartData: chartDrilldownState[previewChartId].currentChartData,
        rawResponse: chartDrilldownState[previewChartId].currentRawResponse,
      }
      : chartDataMap[previewChartId];
    try {
      const { gridRows, columnDefs } = computePreview(info);
      setPreviewGridRowsState(gridRows);
      setPreviewColumnDefsState(columnDefs);
    } catch (e) {
      setPreviewGridRowsState([]);
      setPreviewColumnDefsState([]);
    }
  }, [isDataPreviewOpen, previewChartId, chartDataMap, chartDrilldownState, computePreview]);

  const handlePreviewOpenChange = useCallback((open: boolean) => {
    setIsDataPreviewOpen(open);
    if (!open) {
      setPreviewChartId(null);
      setPreviewGridRowsState(null);
      setPreviewColumnDefsState(null);
    }
  }, []);

  // Grid layout configuration (same as CreateDashboard)
  // Container ref for measuring available width/height so we can render percentage-based layouts
  const containerRef = useRef<HTMLDivElement | null>(null);
  const containerWidthRef = useRef(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState<number>(DEFAULT_CONTAINER_HEIGHT);
  // Track last pointerdown inside chart container so we can disambiguate global events
  const lastPointerChartIdRef = useRef<number | null>(null);
  const lastPointerTsRef = useRef<number>(0);
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);

  // Fallback grid cell sizes (imported shared constants)
  const gridCellWidth = GRID_CELL_WIDTH;
  const gridCellHeight = GRID_CELL_HEIGHT;
  const CHART_GAP = DASHBOARD_CHART_GAP;
  const DEFAULT_CHART_HEIGHT = 400;

  const measureContainerSize = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;
    const surface = root.querySelector('[data-dashboard-canvas-surface]') as HTMLElement | null;
    const measureEl = surface ?? root;
    const nextWidth = getDashboardLayoutWidth(measureEl, undefined);
    const nextHeight = Math.max(100, measureEl.clientHeight || Math.round(measureEl.getBoundingClientRect().height));
    containerWidthRef.current = nextWidth;
    setContainerWidth((prev) => (Math.abs(prev - nextWidth) <= 1 ? prev : nextWidth));
    setContainerHeight((prev) => (Math.abs(prev - nextHeight) <= 1 ? prev : nextHeight));
  }, []);

  // Analytics Studio: pin to the dashboard opened from the list
  useEffect(() => {
    if (isAnalyticsStudio && dashboardId) {
      setSelectedDashboardId(dashboardId);
    }
  }, [isAnalyticsStudio, dashboardId]);

  // Workflow: open dashboard selected from Dashboards list (View action)
  useEffect(() => {
    if (isAnalyticsStudio) return;
    const fromList = (location.state as { selectedDashboardId?: string } | null)?.selectedDashboardId;
    if (fromList) {
      setSelectedDashboardId(fromList);
    }
  }, [isAnalyticsStudio, location.state]);

  // Default selection when dashboards load (preserve prior behavior: latest in list)
  useEffect(() => {
    if (isAnalyticsStudio) return;
    if (dashboards.length === 0) {
      setSelectedDashboardId(null);
      return;
    }
    if (selectedDashboardId && dashboards.some((d) => getDashboardId(d) === selectedDashboardId)) {
      return;
    }
    setSelectedDashboardId(getDashboardId(dashboards[dashboards.length - 1]));
  }, [dashboards, selectedDashboardId, isAnalyticsStudio]);

  // Resolve full dashboard for the selected id (list row or fetch by id)
  useEffect(() => {
    if (!selectedDashboardId) {
      setActiveDashboard(null);
      return;
    }

    const fromList = dashboards.find((d) => getDashboardId(d) === selectedDashboardId);
    if (fromList?.layout && Array.isArray(fromList.layout)) {
      setActiveDashboard(fromList);
      setIsLoadingActiveDashboard(false);
      return;
    }

    let cancelled = false;
    setIsLoadingActiveDashboard(true);
    if (fromList) {
      setActiveDashboard((prev) => {
        if (getDashboardId(prev) === selectedDashboardId && prev?.layout) {
          return { ...fromList, layout: prev.layout, charts: prev.charts, widgets: prev.widgets };
        }
        return fromList;
      });
    }
    getDashboardById(selectedDashboardId)
      .then((response) => {
        if (cancelled) return;
        const data = (response as { data?: unknown })?.data ?? response;
        setActiveDashboard(data);
      })
      .catch(() => {
        if (!cancelled) setActiveDashboard(fromList ?? null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingActiveDashboard(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDashboardId, dashboards]);

  const handleSelectDashboard = useCallback((dashboardId: string) => {
    if (dashboardId === selectedDashboardId) return;
    setSelectedDashboardId(dashboardId);
  }, [selectedDashboardId]);

  const toggleDashboardPicker = useCallback(() => {
    setIsDashboardPickerExpanded((prev) => !prev);
  }, []);

  const fetchDashboards = useCallback(async () => {
    if (isAnalyticsStudio) return;
    if (!flowId) {
      setDashboards([]);
      return;
    }

    setIsLoadingDashboards(true);
    try {
      const response = await getDashboards({
        skip: 0,
        limit: 100,
        q: `flow_id='${flowId}'`,
      });
      if (response && response.data) {
        setDashboards(response.data);
      } else if (Array.isArray(response)) {
        setDashboards(response);
      } else {
        setDashboards([]);
      }
    } catch (error) {
      console.error('Failed to fetch dashboards:', error);
      setDashboards([]);
    } finally {
      setIsLoadingDashboards(false);
    }
  }, [flowId, isAnalyticsStudio]);

  const handleConfirmDeleteDashboard = useCallback(async (dashboardId: string) => {
    setDeletingDashboardId(dashboardId);
    try {
      await deleteDashboard(dashboardId);
      toast.success('Dashboard deleted');
      setDeleteConfirmDashboardId(null);
      setDashboards((prev) => prev.filter((d) => getDashboardId(d) !== dashboardId));
      if (selectedDashboardId === dashboardId) {
        setSelectedDashboardId(null);
        setActiveDashboard(null);
        setChartDataMap({});
        setChartDrilldownState({});
        chartDrilldownStateRef.current = {};
      }
    } catch {
      // deleteDashboard already shows toast on failure
    } finally {
      setDeletingDashboardId(null);
    }
  }, [selectedDashboardId]);

  // Compute rendered layout - scale to live canvas width (responsive full-width)
  const computedLayout = useMemo(() => {
    if (!activeDashboard || !activeDashboard.layout || !Array.isArray(activeDashboard.layout)) {
      return { items: [] as any[], contentHeightRendered: 0, layoutWidth: containerWidth };
    }

    const liveContainerWidth = Math.max(containerWidthRef.current, containerWidth);
    const savedContainerWidth = Math.max(1, activeDashboard.container_width || liveContainerWidth || DEFAULT_CONTAINER_WIDTH);
    const savedContainerHeight = activeDashboard.container_height || containerHeight;
    const layoutWidth =
      liveContainerWidth > 0
        ? liveContainerWidth
        : Math.max(300, DEFAULT_CONTAINER_WIDTH - DASHBOARD_CHART_GAP * 2);

    // Use content height from save so layout matches creation mode
    const fromPixels = activeDashboard.layout.reduce((acc: number, it: any) => {
      const bottom = (it.y_px ?? 0) + (it.height_px ?? 0);
      return Math.max(acc, bottom);
    }, 0);
    const effectiveContentHeight = Math.max(savedContainerHeight, fromPixels, 1);

    const contentHeightRendered = Math.max(100, Math.round(effectiveContentHeight));

    const savedGridCols =
      typeof activeDashboard.grid_cols === 'number' && activeDashboard.grid_cols > 0
        ? activeDashboard.grid_cols
        : inferSavedGridCols(activeDashboard.layout);

    const gap = CHART_GAP;
    const charts = activeDashboard.charts || [];
    const items = activeDashboard.layout.map((layoutItem: any, index: number) => {
      const widgetId = layoutItem.i || `widget_${index + 1}`;
      const chartInfo = charts.find((c: any) => c.widget_i === layoutItem.i) || charts[index];

      let raw_x: number;
      let raw_y: number;
      let raw_w: number;
      let raw_h: number;

      if (typeof layoutItem.x_pct === 'number' && layoutItem.x_pct >= 0) {
        raw_x = Math.round(layoutItem.x_pct * layoutWidth);
      } else if (typeof layoutItem.x_px === 'number') {
        raw_x = Math.round((layoutItem.x_px / savedContainerWidth) * layoutWidth);
      } else {
        raw_x = Math.round((layoutItem.x || 0) * (layoutWidth / savedGridCols));
      }

      if (typeof layoutItem.y_pct === 'number' && layoutItem.y_pct >= 0) {
        raw_y = Math.round(layoutItem.y_pct * contentHeightRendered);
      } else if (typeof layoutItem.y_px === 'number') {
        raw_y = Math.round(layoutItem.y_px);
      } else {
        raw_y = Math.round((layoutItem.y || 0) * gridCellHeight);
      }

      if (typeof layoutItem.w_pct === 'number' && layoutItem.w_pct > 0) {
        raw_w = Math.round(layoutItem.w_pct * layoutWidth);
      } else if (typeof layoutItem.width_px === 'number') {
        raw_w = Math.round((layoutItem.width_px / savedContainerWidth) * layoutWidth);
      } else {
        raw_w = Math.round((layoutItem.w || 1) * (layoutWidth / savedGridCols));
      }

      if (typeof layoutItem.h_pct === 'number' && layoutItem.h_pct > 0) {
        raw_h = Math.round(layoutItem.h_pct * contentHeightRendered);
      } else if (typeof layoutItem.height_px === 'number') {
        raw_h = Math.round(layoutItem.height_px);
      } else {
        raw_h = Math.round((layoutItem.h || 1) * gridCellHeight);
      }

      // Preserve exact saved dimensions: only subtract gap and use a small floor to avoid zero height
      const x_px = Math.max(0, raw_x + Math.floor(gap / 2));
      const y_px = Math.max(0, raw_y + Math.floor(gap / 2));
      const width_px = Math.max(24, raw_w - gap);
      const height_px = Math.max(24, raw_h - gap);
      const clamped = clampDashboardWidgetLayoutBox(x_px, width_px, layoutWidth, gap);

      return {
        layoutItem,
        widgetId,
        x: clamped.x,
        y: y_px,
        width: clamped.width,
        height: height_px,
        originalIndex: index,
      };
    });

    const maxBottom = items.reduce((acc, it) => Math.max(acc, it.y + it.height), 0);
    const contentHeightFinal = Math.max(contentHeightRendered, maxBottom + gap, 100);

    return { items, contentHeightRendered: contentHeightFinal, layoutWidth };
  }, [
    activeDashboard,
    containerWidth,
    containerHeight,
    gridCellWidth,
    gridCellHeight,
    isDashboardPickerExpanded,
  ]);

  const computedLayoutItems = computedLayout.items;

  useEffect(() => {
    if (isAnalyticsStudio) return;
    hasUserSelectedDateRef.current = false;
    setDate(undefined);
    fetchStatementDates();
  }, [fetchStatementDates, isAnalyticsStudio]);

  // Fetch chart data — initial load uses latest statement date; refetch when user changes date.
  // Each chart commits independently so fast charts render without waiting for slower ones.
  useEffect(() => {
    let cancelled = false;
    const chartsStartedThisRun: number[] = [];

    const fetchChartData = () => {
      if (!isAnalyticsStudio && loadingDates) return;
      if (!activeDashboard || !activeDashboard.charts || activeDashboard.charts.length === 0) {
        return;
      }
      // Wait for latest statement date to be applied (avoid empty stmt_date on first load)
      if (!isAnalyticsStudio && !stmtDateForApi && availableDates.length > 0) {
        return;
      }

      const dashboardWidgets = activeDashboard.widgets || [];
      const chartEntries = activeDashboard.charts.map((chartEntry: any) => {
        const widgetId = chartEntry.widget_i || '';
        const widget = dashboardWidgets.find((w: any) => w.id === widgetId);
        const mapKey = getAnalyticsChartDataMapKey(chartEntry.chart_id, widgetId);
        return { chartEntry, widget, widgetId, mapKey };
      });

      const chartsToLoad = chartEntries.filter(({ mapKey }) => !loadingCharts.has(mapKey));

      if (chartsToLoad.length === 0) return;

      chartsStartedThisRun.push(...chartsToLoad.map(({ mapKey }) => mapKey));
      setLoadingCharts(prev => new Set([...prev, ...chartsToLoad.map(({ mapKey }) => mapKey)]));

      const commitChartResult = (mapKey: number, result: Record<string, unknown>) => {
        if (cancelled) return;
        setChartDataMap(prev => ({ ...prev, [mapKey]: result }));
        setLoadingCharts(prev => {
          const next = new Set(prev);
          next.delete(mapKey);
          return next;
        });
      };

      chartsToLoad.forEach(({ chartEntry, widget, widgetId, mapKey }) => {
        if (isStaticLayoutContentChartId(chartEntry.chart_id)) {
          const chartDetails = buildStaticBlockChartFromDashboard(chartEntry, widget);

          commitChartResult(mapKey, {
            chartId: mapKey,
            sourceChartId: chartEntry.chart_id,
            widgetId,
            isStaticBlock: true,
            chart: chartDetails,
            chartData: [],
            chartColumns: [],
          });
          return;
        }

        void (async () => {
          try {
            const chartId = chartEntry.chart_id;
            const fetchedChart = await getChartById(String(chartId));
            const chartDetails = mergeDashboardWidgetChartMetadata(fetchedChart as any, {
              widget,
              chartEntry,
            });
            if (cancelled) return;

            const chartPayload = isAnalyticsStudio
              ? buildDashboardCreateChartPayload(chartDetails as any, true)
              : buildChartPayload(chartDetails);

            const chartResponse = await createChart(chartPayload);
            if (cancelled) return;

            // Normalize chart response but preserve rawResponse for complex or already-formatted charts
            const resp: any = chartResponse as any;
            const cols = resp.columns || [];

            // Conditions: sunburst, multi-column, or already-hierarchical / amcharts-friendly data
            const isSunburst = (chartDetails.visualization_name || '').toString().toLowerCase() === 'sunburst';
            const isMultiColumn = Array.isArray(cols) && cols.length > 1;

            const visualizationName = (chartDetails.visualization_name || '').toString().toLowerCase();
            const isPieOrDonut = isPieDonutOrRadiusPieChart(visualizationName);

            // Heuristic: detect if response rows look like [dimension,metric] pairs
            const looksLikeDimensionMetric = Array.isArray(resp.data) && resp.data.length > 0 && (() => {
              const sample = resp.data.slice(0, 10);
              const keys = Object.keys(sample[0] || {});
              if (keys.length < 2) return false;

              const numericCounts: Record<string, number> = {};
              keys.forEach(k => numericCounts[k] = 0);
              sample.forEach((row: any) => {
                keys.forEach(k => {
                  const v = row[k];
                  if (v === null || v === undefined) return;
                  if (typeof v === 'number') numericCounts[k] += 1;
                  else if (!isNaN(Number(v))) numericCounts[k] += 1;
                });
              });

              const numericCols = keys.filter(k => numericCounts[k] >= Math.max(1, Math.floor(sample.length * 0.6)));
              return numericCols.length === 1;
            })();

            const isAlreadyHierarchical = Array.isArray(resp.data) && resp.data.some((r: any) => {
              if (!r || typeof r !== 'object') return false;
              if (r.children && Array.isArray(r.children)) return true;
              if (('category' in r) && ('value' in r) && (typeof r.value === 'number' || typeof r.value === 'string')) return true;
              return Object.values(r).some(v => v && typeof v === 'object' && !Array.isArray(v));
            });

            let chartDataFinal: any[] = [];

            if (isSunburst || isAlreadyHierarchical || (isMultiColumn && !looksLikeDimensionMetric && !isPieOrDonut)) {
              // Preserve original rows unmodified for these cases
              chartDataFinal = Array.isArray(resp.data) ? resp.data : [];
            } else if (isBigNumberVisualization(visualizationName)) {
              const paramsMetrics =
                chartDetails?.params?.metrics ??
                chartDetails?.params?.metric ??
                chartDetails?.params?.mtric;
              chartDataFinal = transformBigNumberChartData(
                Array.isArray(resp.data) ? resp.data : [],
                {
                  columns: cols,
                  x_axis: resp.x_axis ?? null,
                  metrics: Array.isArray(paramsMetrics) ? paramsMetrics : undefined,
                },
              );
            } else if (isPieOrDonut) {
              chartDataFinal = normalizePieLikeChartRows(
                Array.isArray(resp.data) ? resp.data : [],
                cols,
              );
            } else {
              // Simple single-metric charts: transform into {category, value, originalData}
              chartDataFinal = (Array.isArray(resp.data) ? resp.data : [])
                .map((item: any) => {
                  const keys = Object.keys(item || {});
                  const valueKey = keys.find(
                    (key) => key.includes('(') || typeof item[key] === 'number'
                  ) || keys.find((key) => typeof item[key] === 'number');
                  const dimensionKeys = keys.filter(
                    (key) => !key.includes('(') &&
                      key !== 'value' &&
                      typeof item[key] !== 'number' &&
                      item[key] !== null &&
                      item[key] !== undefined
                  );

                  let category: string;
                  if (dimensionKeys.length > 0) {
                    category = dimensionKeys
                      .map(key => String(item[key] || '').trim())
                      .filter(val => val !== '')
                      .join(', ');
                  } else if (valueKey) {
                    const baseName = valueKey.replace(/\(.*\)/, '').trim();
                    category = baseName || 'Value';
                  } else {
                    category = 'Item';
                  }

                  const value = valueKey ? Number(item[valueKey]) : NaN;

                  if (!valueKey || value === null || isNaN(value)) {
                    return null;
                  }

                  return {
                    category,
                    value,
                    originalData: item,
                  };
                })
                .filter((it: any) => it !== null);
            }

            const buildRaw = () => {
              if (!resp || !resp.data) return undefined;
              const isPivotResponse =
                Boolean(resp.rows) &&
                Boolean(resp.columns) &&
                typeof resp.data === 'object' &&
                !Array.isArray(resp.data);
              if (isPivotResponse) {
                return resp;
              }
              const out: any = {
                data: resp.data,
                columns: resp.columns || cols,
              };

              if (resp.x_axis) out.x_axis = resp.x_axis;

              // Prefer explicit dimensions from response
              if (resp.dimensions) {
                out.dimensions = resp.dimensions;
              } else {
                // Derive dimensions/hierarchy from chart params when server didn't include them
                const paramsDims = chartDetails?.params?.dimensions && Array.isArray(chartDetails.params.dimensions)
                  ? chartDetails.params.dimensions.map((d: any) => (typeof d === 'string' ? d : (d.columns || d)))
                  : undefined;

                if (paramsDims && paramsDims.length > 0) {
                  out.dimensions = paramsDims;
                } else if (chartDetails?.params?.hierarchy && Array.isArray(chartDetails.params.hierarchy)) {
                  out.dimensions = chartDetails.params.hierarchy.map((d: any) => (typeof d === 'string' ? d : (d.columns || d)));
                }
              }

              // Keep legacy 'hierarchy' key if present in response
              if (resp.hierarchy) out.hierarchy = resp.hierarchy;

              const paramsMetrics =
                chartDetails?.params?.metrics ??
                chartDetails?.params?.metric ??
                chartDetails?.params?.mtric;
              if (Array.isArray(paramsMetrics) && paramsMetrics.length > 0) {
                out.metrics = paramsMetrics;
              }

              return out;
            };

            commitChartResult(mapKey, {
              chartId: mapKey,
              sourceChartId: chartId,
              widgetId,
              chart: chartDetails,
              chartData: chartDataFinal,
              chartColumns: cols,
              rawResponse: buildRaw(),
            });
          } catch (error) {
            console.error(`Failed to load chart ${chartEntry.chart_id}:`, error);
            commitChartResult(mapKey, {
              chartId: mapKey,
              sourceChartId: chartEntry.chart_id,
              widgetId,
              chart: null,
              chartData: [],
              chartColumns: [],
            });
          }
        })();
      });
    };

    setChartDataMap({});
    setChartDrilldownState({});
    chartDrilldownStateRef.current = {};
    fetchChartData();

    return () => {
      cancelled = true;
      if (chartsStartedThisRun.length > 0) {
        setLoadingCharts(prev => {
          const next = new Set(prev);
          chartsStartedThisRun.forEach((id) => next.delete(id));
          return next;
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDashboard, flowId, stmtDateForApi, loadingDates, availableDates.length, chartDataRefreshKey]);

  const refreshCharts = useCallback(() => {
    if (!isAnalyticsStudio) {
      if (loadingDates) return;
      if (!stmtDateForApi && availableDates.length > 0) return;
    }
    if (!activeDashboard?.charts?.length) return;
    setChartDataRefreshKey((k) => k + 1);
  }, [activeDashboard, loadingDates, stmtDateForApi, availableDates.length, isAnalyticsStudio]);

  const isChartsRefreshing = loadingCharts.size > 0;

  const isDashboardViewLoading = isLoadingDashboards || isLoadingActiveDashboard;
  const chartCount = activeDashboard?.charts?.length ?? 0;
  const hasLoadedAnyChart = Object.keys(chartDataMap).length > 0;
  const isWaitingForStatementDate = !isAnalyticsStudio && loadingDates;
  const isWaitingForChartFetch =
    !isAnalyticsStudio &&
    chartCount > 0 &&
    !stmtDateForApi &&
    availableDates.length > 0 &&
    !loadingDates;
  const isChartsInitialLoading =
    chartCount > 0 &&
    !hasLoadedAnyChart &&
    (loadingCharts.size > 0 || isWaitingForStatementDate || isWaitingForChartFetch);
  const isDashboardCanvasLoading = isDashboardViewLoading || isChartsInitialLoading;

  const selectedDashboardFromList = useMemo(
    () => dashboards.find((dashboard) => getDashboardId(dashboard) === selectedDashboardId) ?? null,
    [dashboards, selectedDashboardId],
  );

  const displayDashboardTitle = useMemo(
    () =>
      resolveDashboardDisplayTitle(activeDashboard) ??
      resolveDashboardDisplayTitle(selectedDashboardFromList),
    [activeDashboard, selectedDashboardFromList],
  );

  const isDashboardTitleLoading =
    (isLoadingDashboards || isLoadingActiveDashboard) && !displayDashboardTitle;

  // Measure container size for responsive rendering
  useLayoutEffect(() => {
    measureContainerSize();
    const rafId = window.requestAnimationFrame(measureContainerSize);
    return () => window.cancelAnimationFrame(rafId);
  }, [measureContainerSize, isDashboardPickerExpanded, activeDashboard?.id, activeDashboard?.dashboard_id]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    measureContainerSize();
    const ro = new ResizeObserver(measureContainerSize);
    ro.observe(root);
    const surface = root.querySelector('[data-dashboard-canvas-surface]') as HTMLElement | null;
    if (surface && surface !== root) {
      ro.observe(surface);
    }
    const timeoutId = window.setTimeout(measureContainerSize, 320);
    const rafId = window.requestAnimationFrame(measureContainerSize);
    return () => {
      ro.disconnect();
      window.clearTimeout(timeoutId);
      window.cancelAnimationFrame(rafId);
    };
  }, [measureContainerSize, isDashboardPickerExpanded, activeDashboard?.id, activeDashboard?.dashboard_id, isDashboardCanvasLoading]);

  useEffect(() => {
    if (isAnalyticsStudio) return;
    void fetchDashboards();
  }, [fetchDashboards, isAnalyticsStudio]);

  // Capture pointerdown to know which chart container the user interacted with
  useEffect(() => {
    const handler = (ev: PointerEvent) => {
      try {
        const target = ev && (ev.target as HTMLElement);
        if (!target) return;
        let el: HTMLElement | null = target;
        while (el) {
          if (el.getAttribute && el.getAttribute('data-chart-id')) {
            const idStr = el.getAttribute('data-chart-id');
            const id = idStr ? Number(idStr) : NaN;
            if (!isNaN(id)) {
              lastPointerChartIdRef.current = id;
              lastPointerTsRef.current = Date.now();
              return;
            }
          }
          el = el.parentElement;
        }
      } catch (e) {
        // ignore
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', handler, true);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('pointerdown', handler, true);
      }
    };
  }, []);

  // Track mouse position as robust fallback to resolve chart under cursor
  useEffect(() => {
    const mv = (ev: MouseEvent) => {
      try {
        lastMousePosRef.current = { x: ev.clientX, y: ev.clientY };
      } catch (e) {
        // ignore
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', mv, true);
    }
    return () => {
      if (typeof window !== 'undefined') window.removeEventListener('mousemove', mv, true);
    };
  }, []);



  /** Resolve drilldown dimension column from chart params (X-axis, dimensions, or hierarchy for sunburst) */
  const getDrilldownColumn = useCallback((chartDetails: any): string | null => {
    if (!chartDetails?.params) return null;
    const p = chartDetails.params;
    const xAxis = p['X-axis'] ?? p['x-axis'] ?? p.x_axis ?? p.xAxis;
    if (Array.isArray(xAxis) && xAxis.length > 0) {
      const first = xAxis[0];
      if (first && typeof first === 'object') return (first.columns || first.column || first.name) || null;
      if (typeof first === 'string') return first;
    }
    if (typeof xAxis === 'string') return xAxis;
    const dims = p.dimensions;
    if (Array.isArray(dims) && dims.length > 0) {
      const d = dims[0];
      return (typeof d === 'string' ? d : (d?.columns ?? d?.column ?? d?.name)) || null;
    }
    // Sunburst: hierarchy first level
    const hierarchy = p.hierarchy;
    if (Array.isArray(hierarchy) && hierarchy.length > 0) {
      const h = hierarchy[0];
      return (typeof h === 'string' ? h : (h?.columns ?? h?.column ?? h?.name)) || null;
    }
    // Fallback: first metric (pie/donut/funnel sometimes use metric as slice dimension)
    const metrics = p.metrics;
    if (Array.isArray(metrics) && metrics.length > 0) {
      const m = metrics[0];
      return (typeof m === 'string' ? m : (m?.columns ?? m?.column ?? m?.name)) || null;
    }
    return null;
  }, []);

  /** Fallback: get drilldown column from payload params when getDrilldownColumn returns null */
  const getColumnFromPayload = useCallback((payload: any): string | null => {
    const params = payload?.params;
    if (!params) return null;
    const dim0 = params.dimensions?.[0];
    if (dim0 !== undefined && dim0 !== null) {
      const col = typeof dim0 === 'string' ? dim0 : (dim0.columns ?? dim0.column ?? dim0.name);
      if (col) return col;
    }
    const xAxis = params['X-axis'] ?? params['x-axis'];
    if (Array.isArray(xAxis) && xAxis.length > 0) {
      const first = xAxis[0];
      return (first && typeof first === 'object' ? (first.columns ?? first.column ?? first.name) : typeof first === 'string' ? first : null) ?? null;
    }
    if (typeof xAxis === 'string') return xAxis;
    const h0 = params.hierarchy?.[0];
    if (h0 !== undefined && h0 !== null) {
      const col = typeof h0 === 'string' ? h0 : (h0.columns ?? h0.column ?? h0.name);
      if (col) return col;
    }
    const m0 = params.metrics?.[0];
    if (m0) {
      const col = typeof m0 === 'string' ? m0 : (m0.columns ?? (m0 as any).name);
      if (col) return col;
    }
    return null;
  }, []);

  /** Build createChart payload from chart details (same shape as initial fetch) */
  const buildChartPayload = useCallback((chartDetails: any) => {
    if (isAnalyticsStudio) {
      return buildDashboardCreateChartPayload(chartDetails, true);
    }
    const normalizeXAxisInParams = (params: any) => {
      if (!params) return params;
      const p = { ...params };
      const rawX = p['X-axis'] || p['x-axis'] || p.x_axis || p.xAxis;
      if (rawX === undefined || rawX === null) return p;
      if (Array.isArray(rawX)) {
        p['X-axis'] = rawX.map((d: any) => {
          if (typeof d === 'string') return { columns: d };
          if (d && typeof d === 'object') return { columns: d.columns || d.column || d.name || '', alias: d.alias || d.name };
          return d;
        });
      } else if (typeof rawX === 'string') {
        p['X-axis'] = [{ columns: rawX, alias: rawX }];
      } else if (rawX && typeof rawX === 'object') {
        p['X-axis'] = [{ columns: rawX.columns || rawX.column || rawX.name || '', alias: rawX.alias || rawX.name }];
      }
      return p;
    };
    if ((chartDetails.visualization_name || '').toLowerCase() === 'sunburst') {
      const params: any = { ...(chartDetails.params || {}) };
      params.source = (chartDetails.params?.source) ? chartDetails.params.source : (chartDetails.visualization_name || chartDetails.chart_name || 'default');
      if (Array.isArray(params.hierarchy)) {
        params.dimensions = params.hierarchy.map((c: any) => (typeof c === 'string' ? { columns: c } : (c.columns ? { columns: c.columns } : c)));
        delete params.hierarchy;
      }
      return {
        flow_id: chartDetails.flow_id || flowId || '',
        stmt_date: stmtDateForApi,
        visualization_name: chartDetails.visualization_name || '',
        params: normalizeXAxisInParams(params),
      };
    }
    return {
      flow_id: chartDetails.flow_id || flowId || '',
      visualization_name: chartDetails.visualization_name || '',
      chart_name: chartDetails.chart_name || '',
      stmt_date: stmtDateForApi,
      params: normalizeXAxisInParams(chartDetails.params || { source: '' }),
    };
  }, [flowId, stmtDateForApi, isAnalyticsStudio]);

  /** Normalize createChart API response into chartData + rawResponse (same logic as initial fetch) */
  const normalizeChartResponse = useCallback((chartDetails: any, resp: any): { chartDataFinal: any[]; rawResponse: any } => {
    const cols = resp?.columns || [];
    const isPivotResponse =
      Boolean(resp?.rows) &&
      Boolean(resp?.columns) &&
      Boolean(resp?.data) &&
      typeof resp.data === 'object' &&
      !Array.isArray(resp.data);
    const isSunburst = (chartDetails.visualization_name || '').toString().toLowerCase() === 'sunburst';
    const isMultiColumn = Array.isArray(cols) && cols.length > 1;
    const visualizationName = (chartDetails.visualization_name || '').toString().toLowerCase();
    const isPieOrDonut = isPieDonutOrRadiusPieChart(visualizationName);
    const looksLikeDimensionMetric = Array.isArray(resp?.data) && resp.data.length > 0 && (() => {
      const sample = resp.data.slice(0, 10);
      const keys = Object.keys(sample[0] || {});
      if (keys.length < 2) return false;
      const numericCounts: Record<string, number> = {};
      keys.forEach(k => numericCounts[k] = 0);
      sample.forEach((row: any) => {
        keys.forEach(k => {
          const v = row[k];
          if (v === null || v === undefined) return;
          if (typeof v === 'number') numericCounts[k] += 1;
          else if (!isNaN(Number(v))) numericCounts[k] += 1;
        });
      });
      const numericCols = keys.filter(k => numericCounts[k] >= Math.max(1, Math.floor(sample.length * 0.6)));
      return numericCols.length === 1;
    })();
    const isAlreadyHierarchical = Array.isArray(resp?.data) && resp.data.some((r: any) => {
      if (!r || typeof r !== 'object') return false;
      if (r?.children && Array.isArray(r.children)) return true;
      if (('category' in r) && ('value' in r)) return true;
      return Object.values(r).some(v => v && typeof v === 'object' && !Array.isArray(v));
    });
    let chartDataFinal: any[] = [];
    if (isSunburst || isAlreadyHierarchical || (isMultiColumn && !looksLikeDimensionMetric && !isPieOrDonut)) {
      chartDataFinal = Array.isArray(resp?.data) ? resp.data : [];
    } else if (isBigNumberVisualization(visualizationName)) {
      const paramsMetrics =
        chartDetails?.params?.metrics ??
        chartDetails?.params?.metric ??
        chartDetails?.params?.mtric;
      chartDataFinal = transformBigNumberChartData(
        Array.isArray(resp?.data) ? resp.data : [],
        {
          columns: cols,
          x_axis: resp.x_axis ?? null,
          metrics: Array.isArray(paramsMetrics) ? paramsMetrics : undefined,
        },
      );
    } else if (isPieOrDonut) {
      chartDataFinal = normalizePieLikeChartRows(
        Array.isArray(resp?.data) ? resp.data : [],
        cols,
      );
    } else {
      chartDataFinal = (Array.isArray(resp?.data) ? resp.data : [])
        .map((item: any) => {
          const keys = Object.keys(item || {});
          const valueKey = keys.find((k) => k.includes('(') || typeof item[k] === 'number') || keys.find((k) => typeof item[k] === 'number');
          const dimensionKeys = keys.filter((k) => !k.includes('(') && k !== 'value' && typeof item[k] !== 'number' && item[k] != null);
          let category: string;
          if (dimensionKeys.length > 0) {
            category = dimensionKeys.map(key => String(item[key] || '').trim()).filter(val => val !== '').join(', ');
          } else if (valueKey) {
            category = valueKey.replace(/\(.*\)/, '').trim() || 'Value';
          } else {
            category = 'Item';
          }
          const value = valueKey ? Number(item[valueKey]) : NaN;
          if (!valueKey || value === null || isNaN(value)) return null;
          return { category, value, originalData: item };
        })
        .filter((it: any) => it !== null);
    }
    const buildRaw = () => {
      if (!resp?.data) return undefined;
      if (isPivotResponse) {
        return resp;
      }
      const out: any = { data: resp.data, columns: resp.columns || cols };
      if (resp.x_axis) out.x_axis = resp.x_axis;
      if (resp.dimensions) out.dimensions = resp.dimensions;
      else {
        const paramsDims = chartDetails?.params?.dimensions && Array.isArray(chartDetails.params.dimensions)
          ? chartDetails.params.dimensions.map((d: any) => (typeof d === 'string' ? d : (d.columns || d)))
          : undefined;
        if (paramsDims?.length) out.dimensions = paramsDims;
        else if (chartDetails?.params?.hierarchy && Array.isArray(chartDetails.params.hierarchy))
          out.dimensions = chartDetails.params.hierarchy.map((d: any) => (typeof d === 'string' ? d : (d.columns || d)));
      }
      if (resp.hierarchy) out.hierarchy = resp.hierarchy;
      const paramsMetrics = chartDetails?.params?.metrics ?? chartDetails?.params?.metric ?? chartDetails?.params?.mtric;
      if (Array.isArray(paramsMetrics) && paramsMetrics.length > 0) out.metrics = paramsMetrics;
      return out;
    };
    return { chartDataFinal, rawResponse: buildRaw() };
  }, []);

  const handleChartDrilldown = useCallback(async (
    chartId: number,
    field: string,
    value: any,
    originalData?: any,
    eventDimensionFields?: string[] | undefined,
    eventDrillFilters?: Array<{ column: string; value: any }> | undefined,
  ) => {
    try {
      // eslint-disable-next-line no-console
      console.log('handleChartDrilldown invoked', { chartId, field, value, drilldownMode: drilldownModeRef.current, eventDrillFilters });
    } catch (e) {
      // ignore
    }

    try {
      // eslint-disable-next-line no-console
      console.log('[Analytics Drill] handleChartDrilldown state check', {
        chartId,
        field,
        value,
        drilldownMode: drilldownModeRef.current,
        drillThroughMode: drillThroughModeRef.current,
        drillThroughArmedChartId: drillThroughArmedChartIdRef.current,
        drilldownArmedChartId: drilldownArmedChartIdRef.current,
      });
    } catch (e) { }

    // Drill Through: when enabled for a chart, it must take precedence over drilldown.
    if (drillThroughModeRef.current && drillThroughArmedChartIdRef.current === chartId) {
      try {
        // eslint-disable-next-line no-console
        console.log('[Analytics Drill] routed to drill-through branch', { chartId, field, value });
      } catch (e) { }
      drillThroughModeRef.current = false;
      drillThroughArmedChartIdRef.current = null;
      setDrillThroughArmedChartId((prev) => (prev === chartId ? null : prev));
      setIsDrillThroughDialogOpen(true);
      setIsDrillThroughLoading(true);
      setDrillThroughGridRows([]);
      setDrillThroughColumnDefs([]);

      let chartDetails = chartDataMap[chartId]?.chart;
      if (!chartDetails) {
        try {
          const fetched = await getChartById(String(chartId));
          chartDetails = fetched;
        } catch (_) { }
      }
      if (!chartDetails) {
        setIsDrillThroughLoading(false);
        return;
      }
      const basePayload = buildChartPayload(chartDetails);

      // Resolve actual drill-through column/value (avoid generic "category" payload).
      let drillThroughColumn: string | null = null;
      let drillThroughValue: any = value;
      const isNumericLike = (v: any) => {
        if (v === null || v === undefined || v === '') return false;
        if (typeof v === 'number') return !isNaN(v);
        return !isNaN(Number(v));
      };

      if (Array.isArray(eventDrillFilters) && eventDrillFilters.length > 0) {
        const candidates = eventDrillFilters.filter((f) => !!f?.column);
        const preferred = candidates.find((f) => !isNumericLike(f?.value)) ?? candidates[0];
        drillThroughColumn = preferred?.column ? String(preferred.column) : null;
        if (preferred && preferred.value !== undefined) drillThroughValue = preferred.value;
      }

      if (!drillThroughColumn && field && field !== 'category' && field !== 'value') {
        drillThroughColumn = String(field);
      }

      if (!drillThroughColumn) {
        const colFromPayload = getColumnFromPayload(basePayload);
        const colFromChart = getDrilldownColumn(chartDetails);
        drillThroughColumn = colFromPayload || colFromChart || null;
      }

      if (drillThroughColumn && originalData && typeof originalData === 'object') {
        const rowVal = (originalData as any)[drillThroughColumn];
        if (rowVal !== undefined && rowVal !== null && rowVal !== '') {
          drillThroughValue = rowVal;
        }
      }

      if (!drillThroughColumn) {
        setIsDrillThroughLoading(false);
        return;
      }

      const normalizeDrillThroughFilters = (filters: Array<{ column: string; value: any }>) => {
        const byColumn = new Map<string, { column: string; value: any }>();
        for (const f of filters || []) {
          if (!f || !f.column) continue;
          const col = String(f.column);
          const next = { column: col, value: f.value };
          const prev = byColumn.get(col);
          if (!prev) {
            byColumn.set(col, next);
            continue;
          }
          const prevNum = isNumericLike(prev.value);
          const nextNum = isNumericLike(next.value);
          if (!prevNum && nextNum) continue;
          if (prevNum && !nextNum) {
            byColumn.set(col, next);
            continue;
          }
          byColumn.set(col, next);
        }
        return Array.from(byColumn.values());
      };

      const existingDrillState = chartDrilldownStateRef.current[chartId] ?? chartDrilldownState[chartId];
      const levelPathFilters =
        existingDrillState?.stack?.length
          ? (existingDrillState.stack[existingDrillState.stack.length - 1]?.drillFilter ?? [])
          : [];
      let effectiveDrillThroughColumn = drillThroughColumn;
      let effectiveDrillThroughValue = drillThroughValue;

      // Prefer previous drill level's configured column for the clicked value so
      // drill-through sends the parent-level column (e.g. SOURCE_NAME) rather
      // than the next-level column (e.g. Item Consumed). Do not override when
      // explicit eventDrillFilters are provided.
      try {
        const savedDrillLevels = Array.isArray(chartDetails?.params?.drilldown_levels)
          ? chartDetails.params.drilldown_levels
          : [];
        const prevLevelIdx = (existingDrillState?.stack?.length ?? 0) - 1;
        if (!(Array.isArray(eventDrillFilters) && eventDrillFilters.length > 0) && prevLevelIdx >= 0 && Array.isArray(savedDrillLevels) && savedDrillLevels[prevLevelIdx]) {
          const prevLevelCols = savedDrillLevels[prevLevelIdx].drill_columns;
          const prevCol = prevLevelCols && prevLevelCols.length > 0
            ? (typeof prevLevelCols[0] === 'string' ? prevLevelCols[0] : (prevLevelCols[0]?.column ?? prevLevelCols[0]?.columns))
            : null;
          if (prevCol) {
            effectiveDrillThroughColumn = String(prevCol);
            // If originalData contains the parent-level column, prefer that value
            if (originalData && typeof originalData === 'object' && Object.prototype.hasOwnProperty.call(originalData, effectiveDrillThroughColumn)) {
              const rv = (originalData as any)[effectiveDrillThroughColumn];
              if (rv !== undefined && rv !== null && rv !== '') effectiveDrillThroughValue = rv;
            }
          }
        }
      } catch (e) { }

      // Match ChartFormulator behavior:
      // build drill-through context by merging previous path + current slice,
      // replacing same-column value with current clicked slice value.
      const eventFilters = normalizeDrillThroughFilters(Array.isArray(eventDrillFilters) ? eventDrillFilters : []);
      const currentSliceFilters = eventFilters.length > 0
        ? eventFilters
        : [{ column: String(effectiveDrillThroughColumn), value: effectiveDrillThroughValue }];

      // Instead of merging by column (which can overwrite previous path filters),
      // append previous path filters then the current slice filters so both are
      // sent to the drill-through endpoint in order (previous -> clicked).
      let drillThroughColumns = normalizeDrillThroughFilters([
        ...(Array.isArray(levelPathFilters) ? levelPathFilters : []),
        ...currentSliceFilters,
      ]);

      const vizName = String(chartDetails?.visualization_name ?? chartDetails?.chart_name ?? '').toLowerCase();
      const isXAxisChart = /bar|line|area/.test(vizName);
      // Keep both previous and clicked filters for drill-through even on x-axis charts
      // (ChartFormulator previously truncated to single-level; we need both).

      const sameColumnFilter = drillThroughColumns.find((f) => String(f.column) === String(effectiveDrillThroughColumn));
      if (sameColumnFilter && sameColumnFilter.value !== undefined) {
        effectiveDrillThroughValue = sameColumnFilter.value;
      } else if (drillThroughColumns.length > 0) {
        const preferred = drillThroughColumns.find((f) => !isNumericLike(f.value)) ?? drillThroughColumns[0];
        effectiveDrillThroughColumn = String(preferred.column);
        effectiveDrillThroughValue = preferred.value;
      }

      const drillThroughFilters = drillThroughColumns.length > 0
        ? drillThroughColumns
        : [{ column: String(effectiveDrillThroughColumn), value: effectiveDrillThroughValue }];

      setDrillThroughContext({ chartId, field: effectiveDrillThroughColumn, value: effectiveDrillThroughValue });

      // Build drilldown_levels for multi-level context (same as Creation Mode) when chart has drill stack.
      const savedDrillLevels = Array.isArray(chartDetails?.params?.drilldown_levels) ? chartDetails.params.drilldown_levels : [];
      const stackLen = existingDrillState?.stack?.length ?? 0;
      let drilldownLevelsForPayload: Array<{ drill_filters: Array<{ column: string; value: any }>; drill_columns: any[] }> =
        stackLen > 0 && savedDrillLevels.length > 0 && existingDrillState
          ? existingDrillState.stack.map((entry, idx) => ({
            drill_filters: entry.drillFilter ?? [],
            drill_columns: savedDrillLevels[idx]?.drill_columns ?? [],
          }))
          : [];
      if (isXAxisChart && drilldownLevelsForPayload.length > 1) {
        drilldownLevelsForPayload = [drilldownLevelsForPayload[0]];
      }

      const drillThroughPayload = {
        ...basePayload,
        params: {
          ...basePayload.params,
          is_drill_through: true,
          drill_through_columns: drillThroughFilters,
          ...(drillThroughFilters.length > 0 ? { drill_filters: drillThroughFilters } : {}),
          ...(drilldownLevelsForPayload.length > 0 ? { drilldown_levels: drilldownLevelsForPayload } : {}),
        },
      };

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

      (async () => {
        try {
          // Call transformation API (createChart) first - same endpoint with is_drill_through params
          const chartResponse = await createChart(drillThroughPayload);
          const resp = chartResponse as any;
          if (resp && (resp.status === true || resp.data !== undefined) && Array.isArray(resp.data)) {
            setGridFromData(resp.data);
          } else if (resp && resp.data !== undefined && !Array.isArray(resp.data)) {
            const arr = Array.isArray(resp.data.rows) ? resp.data.rows : (resp.data && Array.isArray(resp.data) ? resp.data : []);
            if (arr.length > 0) setGridFromData(arr);
          }
        } catch (err) {
          console.error('Drill through API failed', err);
          try {
            const response = await createChartStreaming(drillThroughPayload);
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
                  } catch (_) { }
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
                } catch (_) { }
              }
              setDrillThroughGridRows(rows);
              if (columnKeys.length > 0) {
                setDrillThroughColumnDefs(columnKeys.map((k) => ({
                  field: k,
                  headerName: k,
                  sortable: true,
                  filter: true,
                  resizable: true,
                  minWidth: 140,
                  tooltipField: k,
                  valueFormatter: (params: any) => {
                    const v = params?.value;
                    if (v === null || v === undefined) return '';
                    return typeof v === 'number' ? (v as number).toLocaleString() : String(v);
                  },
                })));
              }
            } else {
              const json = await response.json();
              if (json && Array.isArray(json.data)) setGridFromData(json.data);
            }
          } catch (_) { }
        } finally {
          setIsDrillThroughLoading(false);
        }
      })();
      return;
    }

    if (drilldownModeRef.current !== 'drilldown') {
      try {
        // eslint-disable-next-line no-console
        console.log('[Analytics Drill] blocked: mode is not drilldown', {
          chartId,
          mode: drilldownModeRef.current,
          drillThroughMode: drillThroughModeRef.current,
          drillThroughArmedChartId: drillThroughArmedChartIdRef.current,
        });
      } catch (e) { }
      return;
    }
    const armedChartId = drilldownArmedChartIdRef.current;
    if (armedChartId === null) {
      try {
        // eslint-disable-next-line no-console
        console.warn('[Analytics Drill] blocked: no armed chart', { chartId });
      } catch (e) { }
      return;
    }
    if (armedChartId !== chartId) {
      try {
        // eslint-disable-next-line no-console
        console.warn('[Analytics Drill] blocked: armed chart mismatch', { armedChartId, chartId });
      } catch (e) { }
      return;
    }
    // Deduplicate rapid duplicate events.
    // Bar/line/area can emit paired callbacks for one click (direct interaction + global event),
    // where one event uses generic field "category" and the other uses exact column name.
    // Treat these as the same interaction when value/time match.
    try {
      const normalizedEventFilters = Array.isArray(eventDrillFilters)
        ? eventDrillFilters.map((f) => ({ column: String(f?.column ?? ''), value: f?.value }))
        : [];
      const signature = `${String(field)}::${String(value)}::${JSON.stringify(normalizedEventFilters)}`;
      const last = lastInteractionRef.current;
      const now = Date.now();
      const isGenericField = field === 'category' || field === 'value';
      const sameValue = !!(last && last.valueKey === String(value));
      const genericPairDuplicate = !!(
        last &&
        last.chartId === chartId &&
        (now - last.ts) < 600 &&
        sameValue &&
        (last.fieldGeneric || isGenericField)
      );
      if (last && last.chartId === chartId && last.signature === signature && (now - last.ts) < 600) {
        // eslint-disable-next-line no-console
        console.log('handleChartDrilldown: ignoring duplicate interaction', { chartId, field, value, signature });
        return;
      }
      if (genericPairDuplicate) {
        // eslint-disable-next-line no-console
        console.log('handleChartDrilldown: ignoring paired generic/specific duplicate', { chartId, field, value, signature });
        return;
      }
      lastInteractionRef.current = { chartId, signature, valueKey: String(value), fieldGeneric: isGenericField, ts: now };
    } catch (e) { }
    const chartBaseInfo = chartDataMap[chartId];
    const currentDrillState = chartDrilldownState[chartId];
    const baseInfo = currentDrillState
      ? {
        ...(chartBaseInfo || {}),
        chartData: currentDrillState.currentChartData,
        rawResponse: currentDrillState.currentRawResponse,
        currentChartData: currentDrillState.currentChartData,
        currentRawResponse: currentDrillState.currentRawResponse,
      }
      : chartBaseInfo;
    if (!chartBaseInfo?.chart) {
      try { console.warn('Drilldown ignored: chart metadata missing', { chartId, hasBaseInfo: !!chartBaseInfo, hasDrillState: !!currentDrillState }); } catch (e) { }
      return;
    }
    const chartDetails = chartBaseInfo.chart;

    // Helper: determine whether a provided field name actually maps to a real column
    const isFieldValid = (f: string | undefined | null) => {
      if (!f) return false;
      try {
        const fname = String(f);
        // 1) check rawResponse columns
        const cols = baseInfo?.rawResponse?.columns ?? baseInfo?.chartColumns ?? [];
        if (Array.isArray(cols) && cols.some((c: any) => String(c) === fname)) return true;

        // 2) check chartDetails params: dimensions, X-axis, metrics
        const p = chartDetails?.params;
        if (p) {
          const dims = p.dimensions ?? p.hierarchy ?? p['X-axis'] ?? p['x-axis'] ?? p.x_axis ?? p.xAxis;
          if (Array.isArray(dims)) {
            for (const d of dims) {
              const col = typeof d === 'string' ? d : (d?.columns ?? d?.column ?? d?.name ?? d?.alias);
              if (col && String(col) === fname) return true;
            }
          } else if (typeof dims === 'string' && String(dims) === fname) return true;
          const mets = p.metrics;
          if (Array.isArray(mets)) {
            for (const m of mets) {
              const col = typeof m === 'string' ? m : (m?.columns ?? m?.column ?? m?.name ?? m?.alias);
              if (col && String(col) === fname) return true;
            }
          }
        }

        // 3) check sample originalData keys
        const sampleRow = (baseInfo.currentChartData && baseInfo.currentChartData[0]) || (baseInfo.chartData && baseInfo.chartData[0]);
        const original = sampleRow && (sampleRow.originalData ?? sampleRow);
        if (original && typeof original === 'object') {
          if (Object.prototype.hasOwnProperty.call(original, fname)) return true;
        }
      } catch (e) {
        // ignore
      }
      return false;
    };

    let column: string | null = null;
    // Only accept explicit field if it likely maps to a real column (avoid placeholders like 'dimensionText')
    if (field && field !== 'category' && field !== 'value' && isFieldValid(field)) {
      column = field;
    } else {
      column = null;
    }
    // Prefer event-provided dimension fields (some charts emit these explicitly)
    if (!column && (eventDimensionFields && Array.isArray(eventDimensionFields) && eventDimensionFields.length > 0)) {
      const cand = eventDimensionFields[0];
      if (isFieldValid(cand)) column = cand;
    }
    // If the event provided originalData, prefer to infer the column directly from it
    if (!column && originalData && typeof originalData === 'object') {
      try {
        const keys = Object.keys(originalData || {});
        // Prefer a key whose value exactly matches the provided value
        const matchKey = keys.find(k => String(originalData[k]) === String(value));
        if (matchKey) {
          column = matchKey;
        } else {
          const nonAgg = keys.find(k => !/\b(SUM|COUNT|AVG|MIN|MAX|STDDEV|VARIANCE)\b/i.test(String(k)) && isNaN(Number(originalData[k])));
          column = nonAgg || keys[0] || null;
        }
      } catch (e) {
        // ignore
      }
    }
    if (!column) {
      const basePayload = buildChartPayload(chartDetails);
      column = getColumnFromPayload(basePayload) || getDrilldownColumn(chartDetails);
    }
    // Final fallback: try to infer column from the actual chart data (originalData keys)
    if (!column) {
      try {
        const sampleRow = (baseInfo.currentChartData && baseInfo.currentChartData[0]) || (baseInfo.chartData && baseInfo.chartData[0]);
        const original = sampleRow && (sampleRow.originalData ?? sampleRow);
        if (original && typeof original === 'object') {
          const keys = Object.keys(original || {});
          // prefer first non-aggregated, non-numeric key
          const found = keys.find(k => !/\b(SUM|COUNT|AVG|MIN|MAX|STDDEV|VARIANCE)\b/i.test(String(k)) && isNaN(Number(original[k])));
          column = found || keys[0] || null;
        }
      } catch (e) {
        // swallow
      }
    }
    // Debug logging to help trace why drilldown may fail for pies/sunburst/funnels
    try {
      // eslint-disable-next-line no-console
      console.log('Drilldown attempt', { chartId, field, value, resolvedColumn: column, chartDetails, baseInfo });
    } catch (e) {
      // ignore
    }
    if (!column && baseInfo?.rawResponse?.columns?.length) {
      const cols = baseInfo.rawResponse.columns as string[];
      const nonAgg = cols.find((c: any) => typeof c === 'string' && !String(c).includes('('));
      column = nonAgg ?? (typeof cols[0] === 'string' ? cols[0] : null);
    }
    const hasEventDrillFilters = !!(eventDrillFilters && Array.isArray(eventDrillFilters) && eventDrillFilters.length > 0);
    if (!column && !hasEventDrillFilters) {
      try { console.warn('Drilldown ignored: could not resolve drilldown column', { chartId, field, value }); } catch (e) { }
      return;
    }
    const normalizeFilters = (filters: Array<{ column: string; value: any }>) => {
      // Preserve original order and keep distinct column+value pairs.
      const out: Array<{ column: string; value: any }> = [];
      const seen = new Set<string>();
      for (const f of filters || []) {
        if (!f || !f.column) continue;
        const col = String(f.column);
        const key = `${col}:::${String(f.value)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ column: col, value: f.value });
      }
      return out;
    };

    const basePayload = buildChartPayload(chartDetails);
    // Prefer event-provided drill filters so create_chart payload always reflects the clicked slice (no stale/previous-chart data).
    // Use actual column name from chart config (X-axis, dimensions, etc.), never the literal "category".
    let drillFilterColumn: string = (field && field !== 'category' && field !== 'value'
      ? field
      : (column || getColumnFromPayload(basePayload) || getDrilldownColumn(chartDetails) || '')) as string;
    // Bar/Line/Area drilldown: use X-axis column (e.g. SOURCE_NAME) not dimensions, since the clicked value maps to X-axis categories.
    const isBarChart = /\bbar\b/i.test(String(chartDetails?.visualization_name ?? '')) || /\bbar\b/i.test(String(chartDetails?.chart_name ?? ''));
    const isLineChart = /\bline\b/i.test(String(chartDetails?.visualization_name ?? '')) || /\bline\b/i.test(String(chartDetails?.chart_name ?? ''));
    const isAreaChart = /\barea\b/i.test(String(chartDetails?.visualization_name ?? '')) || /\barea\b/i.test(String(chartDetails?.chart_name ?? ''));
    const isXAxisChart = isBarChart || isLineChart || isAreaChart;
    let barXAxisColumn: string | null = null;
    if (isXAxisChart && !(eventDrillFilters && Array.isArray(eventDrillFilters) && eventDrillFilters.length > 0)) {
      const xAxis = chartDetails?.params?.['X-axis'] ?? chartDetails?.params?.['x-axis'];
      const xFirst = Array.isArray(xAxis) && xAxis.length > 0 ? xAxis[0] : xAxis;
      const xCol = xFirst && typeof xFirst === 'object' ? (xFirst.columns ?? xFirst.column ?? xFirst.name) : typeof xFirst === 'string' ? xFirst : null;
      if (xCol) {
        barXAxisColumn = String(xCol);
        drillFilterColumn = barXAxisColumn;
      }
    }
    let drillFilterValue: any = value;
    if (drillFilterColumn && originalData && typeof originalData === 'object') {
      const rowVal = (originalData as any)[drillFilterColumn];
      if (rowVal !== undefined && rowVal !== null && rowVal !== '') {
        drillFilterValue = rowVal;
      }
    }
    if (isXAxisChart && barXAxisColumn && originalData && typeof originalData === 'object') {
      const xVal = (originalData as any)[barXAxisColumn];
      if (xVal !== undefined && xVal !== null && xVal !== '') {
        drillFilterValue = xVal;
      }
    }
    const clickedFilter = { column: drillFilterColumn, value: drillFilterValue };

    // Build cumulative path level by level (same as Creation Mode): use full path from stack so each level adds one filter.
    const existing = chartDrilldownStateRef.current[chartId] ?? chartDrilldownState[chartId];
    const previousPath =
      existing?.stack?.length
        ? (existing.stack[existing.stack.length - 1]?.drillFilter ?? [])
        : [];

    // If the inferred clicked filter column duplicates an existing path column,
    // prefer the configured next drill column from chart params, otherwise try
    // eventDimensionFields, bar X-axis, then originalData keys.
    try {
      const prevCols = new Set((previousPath || []).map((f: any) => String(f.column)));
      if (clickedFilter && clickedFilter.column && prevCols.has(String(clickedFilter.column))) {
        let altCol: string | null = null;
        try {
          const savedDrillLevels = Array.isArray(chartDetails?.params?.drilldown_levels)
            ? chartDetails.params.drilldown_levels
            : [];
          const currentDepth = existing?.stack?.length ?? 0;
          const nextLevel = Array.isArray(savedDrillLevels) ? savedDrillLevels[currentDepth] : null;
          const nextDrillCol = nextLevel && Array.isArray(nextLevel.drill_columns) && nextLevel.drill_columns.length > 0
            ? (typeof nextLevel.drill_columns[0] === 'string' ? nextLevel.drill_columns[0] : (nextLevel.drill_columns[0]?.column ?? nextLevel.drill_columns[0]?.columns))
            : null;
          if (nextDrillCol && !prevCols.has(String(nextDrillCol))) altCol = String(nextDrillCol);
        } catch (e) { }

        if (!altCol && eventDimensionFields && Array.isArray(eventDimensionFields)) {
          for (const d of eventDimensionFields) {
            if (!d) continue;
            const ds = String(d);
            if (prevCols.has(ds)) continue;
            if (originalData && typeof originalData === 'object' && Object.prototype.hasOwnProperty.call(originalData, ds) && String((originalData as any)[ds]) === String(clickedFilter.value)) {
              altCol = ds; break;
            }
            if (isFieldValid(ds)) { altCol = ds; break; }
          }
        }
        if (!altCol && barXAxisColumn && !prevCols.has(barXAxisColumn)) altCol = barXAxisColumn;
        if (!altCol && originalData && typeof originalData === 'object') {
          try {
            for (const k of Object.keys(originalData || {})) {
              if (!k) continue;
              if (prevCols.has(String(k))) continue;
              if (String((originalData as any)[k]) === String(clickedFilter.value)) { altCol = String(k); break; }
            }
          } catch (e) { }
        }
        if (altCol) clickedFilter.column = altCol;
      }
    } catch (e) { }

    // Prefer sending the previous drill column name (configured in drilldown_levels)
    // for the clicked value when drilling to the next level. This ensures the
    // clicked value is associated with the column that produced the current slice
    // (e.g. SOURCE_NAME) rather than the next-level column (e.g. Item Consumed).
    try {
      const savedDrillLevels = Array.isArray(chartDetails?.params?.drilldown_levels)
        ? chartDetails.params.drilldown_levels
        : [];
      const currentDepth = existing?.stack?.length ?? 0;
      const prevLevel = currentDepth - 1;
      if (prevLevel >= 0 && Array.isArray(savedDrillLevels) && savedDrillLevels[prevLevel]) {
        const prevLevelCols = savedDrillLevels[prevLevel].drill_columns;
        if (Array.isArray(prevLevelCols) && prevLevelCols.length > 0) {
          const prevCol = typeof prevLevelCols[0] === 'string' ? prevLevelCols[0] : (prevLevelCols[0]?.column ?? prevLevelCols[0]?.columns);
          if (prevCol) {
            // Only override if we aren't using explicit eventDrillFilters
            if (!(eventDrillFilters && Array.isArray(eventDrillFilters) && eventDrillFilters.length > 0)) {
              clickedFilter.column = String(prevCol);
            }
          }
        }
      }
    } catch (e) { }

    const finalDrillFilters: Array<{ column: string; value: any }> =
      (eventDrillFilters && Array.isArray(eventDrillFilters) && eventDrillFilters.length > 0)
        ? normalizeFilters(eventDrillFilters)
        : normalizeFilters(drillFilterColumn ? [...previousPath, clickedFilter] : previousPath);

    // Debug: show resolved filters before sending payload
    try {
      // eslint-disable-next-line no-console
      console.log('Drilldown payload filters', { previousPath, clickedFilter, finalDrillFilters });
    } catch (e) { }

    const currentDepth = existing?.stack?.length ?? 0;
    const drillLevels = Array.isArray(chartDetails?.params?.drilldown_levels)
      ? chartDetails.params.drilldown_levels
      : [];
    const activeLevel = drillLevels[currentDepth];
    let levelDrillColumns = Array.isArray(activeLevel?.drill_columns)
      ? activeLevel.drill_columns
        .map((col: any) => {
          if (typeof col === 'string') return { column: col };
          const column = col?.column ?? col?.columns ?? col?.name;
          return column ? { column } : null;
        })
        .filter(Boolean)
      : [];

    // Bar/Line/Area: dynamically determine next drill column when not in saved drilldown_levels (same logic as Creation Mode).
    const filterColumnsSet = new Set(finalDrillFilters.map((f) => String(f.column)));
    if (isXAxisChart && levelDrillColumns.length === 0) {
      const cols = baseInfo?.currentRawResponse?.columns ?? baseInfo?.rawResponse?.columns ?? [];
      const toColName = (c: any) => (typeof c === 'string' ? c : (c?.column ?? c?.columns ?? c?.name) ? String(c?.column ?? c?.columns ?? c?.name) : null);
      const nextColName = Array.isArray(cols)
        ? (() => {
          const found = cols.find((c: any) => {
            const name = toColName(c);
            return name && !filterColumnsSet.has(name) && !name.includes('(');
          });
          return found != null ? toColName(found) : null;
        })()
        : null;
      if (nextColName) {
        levelDrillColumns = [{ column: nextColName }];
      } else {
        const fallbackCol = getDrilldownColumn(chartDetails) || getColumnFromPayload(basePayload);
        if (fallbackCol && !filterColumnsSet.has(fallbackCol)) {
          levelDrillColumns = [{ column: fallbackCol }];
        }
      }
    }

    if (levelDrillColumns.length === 0) {
      try {
        console.warn('[Analytics Drill] blocked: no drilldown columns available for the next level');
      } catch (e) { }
      return;
    }

    // Clean payload structure (Creation Mode): for bar/line/area use X-axis + dimensions only; never send drill_columns.
    const drillParams: Record<string, any> = {
      ...basePayload.params,
      is_drilldown: true,
      drill_filters: finalDrillFilters,
    };

    if (isXAxisChart) {
      if (levelDrillColumns.length > 0) {
        const drillCols = levelDrillColumns.map((c: any) => c?.column).filter((c: any) => !!c);
        drillParams['X-axis'] = [{ columns: String(drillCols[0]) }];
        drillParams.dimensions = (drillCols.slice(1) as string[]).map((col: string) => ({ columns: String(col) }));
      }
      delete drillParams.drill_columns;
    } else {
      if (levelDrillColumns.length > 0) {
        drillParams.drill_columns = levelDrillColumns;
      }
    }

    const drillPayload = {
      ...basePayload,
      params: drillParams,
    };
    setDrilldownLoadingChartId(chartId);
    try {
      const chartResponse = await createChart(drillPayload);
      const resp: any = chartResponse;
      const { chartDataFinal, rawResponse } = normalizeChartResponse(chartDetails, resp);
      setChartDrilldownState(prev => {
        const next = { ...prev };
        const existingState = next[chartId];
        const stack = existingState
          ? [...existingState.stack, { chartData: existingState.currentChartData, rawResponse: existingState.currentRawResponse, drillFilter: finalDrillFilters }]
          : [{ chartData: baseInfo.chartData ?? [], rawResponse: baseInfo.rawResponse, drillFilter: finalDrillFilters }];
        next[chartId] = { stack, currentChartData: chartDataFinal, currentRawResponse: rawResponse };
        chartDrilldownStateRef.current = next;
        return next;
      });
    } catch (err) {
      console.error('Drilldown failed for chart', chartId, err);
    } finally {
      setDrilldownLoadingChartId(null);
    }
  }, [chartDrilldownState, chartDataMap, getDrilldownColumn, getColumnFromPayload, buildChartPayload, normalizeChartResponse]);

  handleChartDrilldownRef.current = handleChartDrilldown;
  const stableChartDrilldown = useCallback((
    chartId: number,
    field: string,
    value: any,
    originalData?: any,
    eventDimensionFields?: string[],
    eventDrillFilters?: Array<{ column: string; value: any }>,
  ) => {
    handleChartDrilldownRef.current(chartId, field, value, originalData, eventDimensionFields, eventDrillFilters);
  }, []);

  // Listen for global pie/sunburst interaction events (dispatched by PieChart/FunnelChart/SunburstChart)
  useEffect(() => {
    const findChartIdForDetail = (detail: any): number | null => {
      try {
        if (!detail) return null;
        // Prefer recently-pointered chart if available (disambiguate multiple charts)
        try {
          const recent = lastPointerChartIdRef.current;
          const ts = lastPointerTsRef.current || 0;
          if (recent && Date.now() - ts < 1000 && (chartDataMap[recent] || chartDrilldownState[recent])) {
            return recent;
          }
        } catch (e) {
          // ignore
        }
        // Prefer matching by originalData when available
        const detailOrig = detail.originalData ?? null;
        const detailVal = detail.value ?? detail.category ?? null;

        const candidateIds = new Set<number>([
          ...Object.keys(chartDataMap || {}).map((k) => Number(k)).filter((n) => !isNaN(n)),
          ...Object.keys(chartDrilldownState || {}).map((k) => Number(k)).filter((n) => !isNaN(n)),
        ]);

        for (const id of candidateIds) {
          const info = chartDataMap[id];
          const drillInfo = chartDrilldownState[id];
          if (!info && !drillInfo) continue;
          const rows = drillInfo
            ? (Array.isArray(drillInfo.currentChartData) ? drillInfo.currentChartData : [])
            : (Array.isArray(info?.chartData) ? info.chartData : []);
          for (const r of rows) {
            try {
              const orig = r && (r.originalData ?? r);
              if (detailOrig && orig) {
                // deep-ish compare via JSON (best-effort)
                try {
                  if (JSON.stringify(orig) === JSON.stringify(detailOrig)) return id;
                } catch (e) {
                  // ignore stringify failures
                }
              }
              // Match by category or value fields
              if (r && r.category !== undefined && detailVal !== undefined && String(r.category) === String(detailVal)) return id;
              if (r && r.value !== undefined && detailVal !== undefined && String(r.value) === String(detailVal)) return id;
              // Match by any originalData field value (helps when value lives inside originalData)
              try {
                if (orig && detailVal !== undefined) {
                  const vals = Object.values(orig || {});
                  if (vals.some(v => String(v) === String(detailVal))) return id;
                }
              } catch (e) {
                // ignore
              }
            } catch (e) {
              // ignore row compare errors
            }
          }
        }
        // Fallback: use mouse position to find nearest chart container under cursor
        try {
          const mp = lastMousePosRef.current;
          if (mp && typeof document !== 'undefined' && document.elementsFromPoint) {
            const els = document.elementsFromPoint(mp.x, mp.y);
            for (const el of els) {
              try {
                const attr = (el as HTMLElement).getAttribute && (el as HTMLElement).getAttribute('data-chart-id');
                if (attr) {
                  const id = Number(attr);
                  if (!isNaN(id) && (chartDataMap[id] || chartDrilldownState[id])) return id;
                }
              } catch (e) { }
            }
          }
        } catch (e) {
          // ignore
        }
      } catch (e) {
        // ignore
      }
      return null;
    };

    const pieHandler = (ev: any) => {
      try {
        const detail = ev?.detail;
        // eslint-disable-next-line no-console
        console.log('Analytics: received pieSliceInteraction', detail);
        if (!detail) return;
        // Try to resolve chartId from event target DOM first (robust across remounts/compaction)
        let chartId: number | null = null;
        try {
          const tgt = ev && ev.target;
          let el = tgt && (tgt instanceof Element ? tgt as Element : (tgt && tgt.target ? tgt.target : null));
          while (el) {
            try {
              const attr = (el as HTMLElement).getAttribute && (el as HTMLElement).getAttribute('data-chart-id');
              if (attr) {
                const id = Number(attr);
                if (!isNaN(id) && (chartDataMap[id] || chartDrilldownState[id])) { chartId = id; break; }
              }
            } catch (e) { }
            // @ts-ignore
            el = el.parentElement;
          }
        } catch (e) { }
        // Fallback to detail-based resolution
        if (chartId === null) chartId = findChartIdForDetail(detail);
        // When Drill Through is enabled, use armed chart so slice click always triggers API
        if (chartId === null && drillThroughArmedChartIdRef.current !== null) chartId = drillThroughArmedChartIdRef.current;
        try {
          // eslint-disable-next-line no-console
          console.log('[Analytics Drill] pie interaction resolved', {
            chartId,
            field: detail.column || detail.field || 'category',
            value: detail.value,
            drilldownMode: drilldownModeRef.current,
            drillThroughMode: drillThroughModeRef.current,
            drillThroughArmedChartId: drillThroughArmedChartIdRef.current,
          });
        } catch (e) { }
        if (chartId === null) {
          // couldn't resolve chart; still log for debugging
          // eslint-disable-next-line no-console
          console.warn('Analytics: could not resolve chartId for pieSliceInteraction', detail);
          return;
        }
        const field = detail.column || detail.field || 'category';
        // forward any chart-emitted fields (originalData, dimension fields, drill filters)
        handleChartDrilldown(
          chartId,
          field,
          detail.value,
          detail.originalData ?? detail.payload ?? undefined,
          detail.dimensionFields ?? detail.dimension_fields ?? undefined,
          detail.drillFilters ?? detail.drill_filters ?? undefined,
        );
      } catch (e) {
        // ignore
      }
    };

    const sunHandler = (ev: any) => {
      try {
        const detail = ev?.detail;
        // eslint-disable-next-line no-console
        console.log('Analytics: received sunburstDrilldown', detail);
        if (!detail) return;
        // Sunburst detail may be { type: 'row'|'category', payload }
        let value: any = undefined;
        let originalData: any = undefined;
        let col: string | undefined = undefined;
        if (detail.type === 'row') {
          originalData = detail.payload;
          const keys = originalData ? Object.keys(originalData) : [];
          for (const k of keys) {
            if (k && k !== 'value' && k !== 'category' && typeof originalData[k] !== 'number') {
              value = originalData[k];
              col = k;
              break;
            }
          }
          if (value === undefined && keys.length > 0) {
            value = originalData[keys[0]];
            col = keys[0];
          }
        } else if (detail.type === 'category') {
          const payload = detail.payload;
          if (payload && typeof payload === 'object' && payload.column && payload.value !== undefined) {
            col = String(payload.column);
            value = payload.value;
            originalData = undefined;
          } else {
            value = detail.payload;
          }
        } else {
          // fallback if sunburst dispatches raw payload
          value = detail.payload ?? detail.value ?? detail.category;
          originalData = detail.payload ?? detail.originalData;
        }

        const searchDetail = { value, originalData, column: col };
        // Try DOM-target resolution first
        let chartId: number | null = null;
        try {
          const tgt = ev && ev.target;
          let el = tgt && (tgt instanceof Element ? tgt as Element : (tgt && tgt.target ? tgt.target : null));
          while (el) {
            try {
              const attr = (el as HTMLElement).getAttribute && (el as HTMLElement).getAttribute('data-chart-id');
              if (attr) {
                const id = Number(attr);
                if (!isNaN(id) && (chartDataMap[id] || chartDrilldownState[id])) { chartId = id; break; }
              }
            } catch (e) { }
            // @ts-ignore
            el = el.parentElement;
          }
        } catch (e) { }
        if (chartId === null) chartId = findChartIdForDetail(searchDetail);
        if (chartId === null && drillThroughArmedChartIdRef.current !== null) chartId = drillThroughArmedChartIdRef.current;
        try {
          // eslint-disable-next-line no-console
          console.log('[Analytics Drill] sunburst interaction resolved', {
            chartId,
            field: col || detail.column || 'category',
            value,
            drilldownMode: drilldownModeRef.current,
            drillThroughMode: drillThroughModeRef.current,
            drillThroughArmedChartId: drillThroughArmedChartIdRef.current,
          });
        } catch (e) { }
        if (chartId === null) {
          // eslint-disable-next-line no-console
          console.warn('Analytics: could not resolve chartId for sunburstDrilldown', searchDetail);
          return;
        }
        const field = col || detail.column || 'category';
        handleChartDrilldown(
          chartId,
          field,
          value,
          originalData ?? detail.originalData ?? undefined,
          detail.dimensionFields ?? detail.dimension_fields ?? undefined,
          detail.drillFilters ?? detail.drill_filters ?? undefined,
        );
      } catch (e) {
        // ignore
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('pieSliceInteraction', pieHandler as EventListener);
      window.addEventListener('sunburstDrilldown', sunHandler as EventListener);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('pieSliceInteraction', pieHandler as EventListener);
        window.removeEventListener('sunburstDrilldown', sunHandler as EventListener);
      }
    };
  }, [chartDataMap, chartDrilldownState, handleChartDrilldown]);

  const handleDrilldownBack = useCallback((chartId: number, popCount: number = 1) => {
    let resetDrilldownSelection = false;
    setChartDrilldownState(prev => {
      const next = { ...prev };
      const existing = next[chartId];
      if (!existing || existing.stack.length === 0) {
        resetDrilldownSelection = true;
        delete next[chartId];
        chartDrilldownStateRef.current = next;
        return next;
      }
      const toPop = Math.min(Math.max(1, popCount), existing.stack.length);
      if (toPop >= existing.stack.length) {
        resetDrilldownSelection = true;
        delete next[chartId];
        chartDrilldownStateRef.current = next;
        return next;
      }
      const rest = existing.stack.slice(0, -toPop);
      const target = existing.stack[existing.stack.length - toPop];
      if (rest.length === 0) {
        resetDrilldownSelection = true;
        delete next[chartId];
      } else {
        next[chartId] = { stack: rest, currentChartData: target.chartData, currentRawResponse: target.rawResponse };
      }
      chartDrilldownStateRef.current = next;
      return next;
    });
    // If user returned to the base chart, force a fresh drilldown setup next time.
    if (resetDrilldownSelection) {
      drilldownArmedChartIdRef.current = null;
      drilldownModeRef.current = 'none';
      setDrilldownArmedChartId((prev) => (prev === chartId ? null : prev));
    }
  }, []);

  const previewChartInfo = useMemo(() => {
    if (!previewChartId) return null;
    const base = chartDataMap[previewChartId];
    const drill = chartDrilldownState[previewChartId];
    if (!base && !drill) return null;
    if (!drill) return base;
    return {
      ...base,
      chartData: drill.currentChartData,
      rawResponse: drill.currentRawResponse,
    };
  }, [previewChartId, chartDataMap, chartDrilldownState]);

  const previewRows = useMemo(() => {
    const info = previewChartInfo;
    if (!info) return [] as any[];

    // Prefer raw API response data (array of row objects) for the table
    const rawData = info?.rawResponse?.data;
    if (Array.isArray(rawData) && rawData.length > 0) {
      return rawData.map((r: any) => (r && typeof r === 'object' && 'originalData' in r ? r.originalData : r));
    }

    if (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) {
      try {
        const rowDims = Array.isArray(info?.rawResponse?.rows)
          ? info.rawResponse.rows
          : (info?.rawResponse?.rows && typeof info.rawResponse.rows === 'object'
            ? Object.values(info.rawResponse.rows)
            : []);

        const norm = (Object.keys(rawData).length === 1 && rawData[Object.keys(rawData)[0]] && typeof rawData[Object.keys(rawData)[0]] === 'object')
          ? rawData[Object.keys(rawData)[0]]
          : rawData;

        const rowDimSet = new Set(rowDims as string[]);
        const metricKeys = Object.keys(norm).filter((k) => !rowDimSet.has(k));
        const firstDim = rowDims[0];
        const rowIndexSource = (norm as any)[firstDim] ?? (norm as any)[metricKeys[0]];
        if (!rowIndexSource || typeof rowIndexSource !== 'object') return [];
        const rowIndices = Object.keys(rowIndexSource).sort((a, b) => Number(a) - Number(b));
        const out: Record<string, any>[] = [];
        for (const idx of rowIndices) {
          const row: Record<string, any> = {};
          for (const dim of rowDims) row[String(dim)] = (norm as any)?.[String(dim)]?.[idx];
          for (const key of metricKeys) row[key] = (norm as any)?.[key]?.[idx];
          out.push(row);
        }
        return out;
      } catch (e) {
        return [];
      }
    }

    // Fallback: use chartData (e.g. transformed for viz); show underlying row via originalData
    const chartRows = Array.isArray(info?.chartData) ? info.chartData : [];
    return chartRows.map((r: any) => (r && typeof r === 'object' && r.originalData != null ? r.originalData : r));
  }, [previewChartInfo]);

  const previewGridRows = useMemo(() => {
    if (!Array.isArray(previewRows)) return [] as any[];
    return previewRows.map((row: any) => {
      if (row && typeof row === 'object' && !Array.isArray(row)) return row;
      return { value: row };
    });
  }, [previewRows]);

  const previewColumnDefs = useMemo(() => {
    const first = previewGridRows?.[0] || {};
    const keysFromRows = Object.keys(first).filter((k) => k !== 'originalData');
    const keysFromChartColumns = Array.isArray(previewChartInfo?.chartColumns)
      ? (previewChartInfo!.chartColumns as any[]).map((c: any) => String(c))
      : [];
    const keysFromRawColumns = Array.isArray(previewChartInfo?.rawResponse?.columns)
      ? (previewChartInfo!.rawResponse.columns as any[]).map((c: any) => String(c))
      : [];
    // Prefer current drill level raw response columns first.
    const keys =
      keysFromRawColumns.length > 0
        ? keysFromRawColumns
        : keysFromRows.length > 0
          ? keysFromRows
          : keysFromChartColumns;

    return keys.map((key) => ({
      field: key,
      headerName: key,
      sortable: true,
      filter: true,
      resizable: true,
      valueFormatter: (params: any) => {
        const v = params?.value;
        if (v === null || v === undefined) return '';
        return typeof v === 'number' ? v.toLocaleString() : String(v);
      },
      cellStyle: typeof (first as any)[key] === 'number' ? { textAlign: 'right' } : { textAlign: 'left' },
    }));
  }, [previewGridRows, previewChartInfo]);
  const effectivePreviewColumnDefs = previewColumnDefsState ?? previewColumnDefs;
  const effectivePreviewRows = previewGridRowsState ?? previewGridRows;

  const dataPreviewDialogWidth = useMemo(() => {
    const columnCount = effectivePreviewColumnDefs?.length ?? 0;
    const baseWidth = 220;
    const perColumnWidth = 180;
    const calculated = baseWidth + (columnCount * perColumnWidth);
    return Math.min(Math.max(calculated, 700), 1700);
  }, [effectivePreviewColumnDefs]);

  const dataPreviewDialogHeight = useMemo(() => {
    const rowCount = effectivePreviewRows?.length ?? 0;
    const headerAndChrome = 140;
    const rowHeight = 30;
    const paginationFooter = 56;
    const visibleRows = Math.min(Math.max(rowCount, 1), 10);
    const calculated = headerAndChrome + (visibleRows * rowHeight) + paginationFooter;
    return Math.min(Math.max(calculated, 300), 760);
  }, [effectivePreviewRows]);

  const fitPreviewGridColumns = useCallback((api: any) => {
    try {
      if (!api) return;
      const allCols = api.getColumns?.();
      if (!allCols || allCols.length === 0) return;
      api.sizeColumnsToFit();
    } catch (e) {
      // ignore
    }
  }, []);

  const handleDownloadDataPreview = useCallback(() => {
    const rows = (previewGridRowsState ?? previewGridRows) as Record<string, unknown>[];
    const columnDefs = previewColumnDefsState ?? previewColumnDefs;
    if (!rows.length) {
      toast.error('No data available to download');
      return;
    }
    const chartName = previewChartInfo?.chart?.chart_name ?? 'chart';
    const downloaded = downloadGridDataAsCsv(rows, columnDefs, `data_preview_${chartName}`);
    if (downloaded) toast.success('Data preview downloaded');
  }, [previewGridRowsState, previewGridRows, previewColumnDefsState, previewColumnDefs, previewChartInfo]);

  const handleDownloadDrillThrough = useCallback(() => {
    if (!drillThroughGridRows.length) {
      toast.error('No data available to download');
      return;
    }
    const suffix = drillThroughContext
      ? `${drillThroughContext.field}_${String(drillThroughContext.value)}`
      : 'data';
    const downloaded = downloadGridDataAsCsv(
      drillThroughGridRows as Record<string, unknown>[],
      drillThroughColumnDefs,
      `drill_through_${suffix}`,
    );
    if (downloaded) toast.success('Drill through data downloaded');
  }, [drillThroughGridRows, drillThroughColumnDefs, drillThroughContext]);

  const fitDrillThroughGridColumns = useCallback((api: any) => {
    try {
      if (!api) return;
      const allCols = api.getColumns?.();
      if (!allCols || allCols.length === 0) return;

      // Prevent unreadable compressed headers when the response has many columns.
      if (allCols.length <= 6) {
        api.sizeColumnsToFit();
        return;
      }

      if (typeof api.autoSizeAllColumns === 'function') {
        api.autoSizeAllColumns(false);
      }
    } catch (e) {
      // ignore
    }
  }, []);



  return {
    workflowName,
    flowId,
    isAnalyticsStudio,
    analyticsStudioDashboardId: dashboardId,
    isSettingsDialogOpen,
    setIsSettingsDialogOpen,
    settingsActiveTab,
    setSettingsActiveTab,
    dashboards,
    isLoadingDashboards,
    selectedDashboardId,
    activeDashboard,
    isLoadingActiveDashboard,
    isDashboardPickerExpanded,
    toggleDashboardPicker,
    deleteConfirmDashboardId,
    setDeleteConfirmDashboardId,
    deletingDashboardId,
    chartDataMap,
    handleStreamChartDataUpdate,
    loadingCharts,
    chartDrilldownState,
    drilldownLoadingChartId,
    isDataPreviewOpen,
    handlePreviewOpenChange,
    drillThroughModeRef,
    drillThroughArmedChartIdRef,
    drilldownModeRef,
    drilldownArmedChartIdRef,
    isDrillThroughDialogOpen,
    setIsDrillThroughDialogOpen,
    drillThroughContext,
    setDrillThroughContext,
    drillThroughGridRows,
    setDrillThroughGridRows,
    drillThroughColumnDefs,
    setDrillThroughColumnDefs,
    isDrillThroughLoading,
    drillThroughDialogWidth,
    drillThroughDialogHeight,
    previewGridRowsState,
    previewColumnDefsState,
    date,
    setDate,
    loadingDates,
    hasUserSelectedDateRef,
    isStatementDateDisabled,
    containerRef,
    containerWidth,
    computedLayout,
    computedLayoutItems,
    navigate,
    stmtDateForApi,
    statementDateDisplay,
    handleSelectDashboard,
    handleConfirmDeleteDashboard,
    handleDrilldownBack,
    stableChartDrilldown,
    handleOpenDrilldown,
    handleArmDrillThrough,
    handleOpenDataPreview,
    drilldownArmedChartId,
    drillThroughArmedChartId,
    previewChartInfo,
    previewGridRows,
    previewColumnDefs,
    effectivePreviewColumnDefs: previewColumnDefsState ?? previewColumnDefs,
    effectivePreviewRows: previewGridRowsState ?? previewGridRows,
    dataPreviewDialogWidth,
    dataPreviewDialogHeight,
    fitPreviewGridColumns,
    handleDownloadDataPreview,
    handleDownloadDrillThrough,
    fitDrillThroughGridColumns,
    setDrilldownArmedChartId,
    isDashboardViewLoading,
    isDashboardCanvasLoading,
    displayDashboardTitle,
    isDashboardTitleLoading,
    refreshCharts,
    isChartsRefreshing,
  };
}
