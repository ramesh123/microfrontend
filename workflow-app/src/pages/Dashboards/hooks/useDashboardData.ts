import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { getDisplayErrorMessage, resolveApiErrorMessage } from '@/utils/exceptionHelper';
import { getCharts, deleteChart, getChartById } from '@/pages/Visualization/API/chartsApi';
import { getDashboardById } from '@/pages/Visualization/API/dashboardApi';
import { createChart } from '@/pages/Visualization/API/chartsApi';
import { Chart, DashboardChart } from '../types';
import {
  transformDashboardChartRows,
  extractDashboardChartResponseRows,
  isPieDonutOrRadiusPieChart,
  buildDashboardChartRawResponse,
} from '../utils/dashboardUtils';
import { buildDashboardCreateChartPayload } from '../utils/buildDashboardCreateChartPayload';
import { CHART_GAP, DEFAULT_CHART_HEIGHT } from '../dashboardConstants';
import { DEFAULT_CONTAINER_WIDTH, DEFAULT_CONTAINER_HEIGHT, isStaticLayoutContentChartId, buildStaticBlockChartFromDashboard } from '../layoutConstants';
import { STATIC_LAYOUT_ITEMS, STATIC_CONTENT_ITEMS } from '../staticDashboardBlocks';
import { resolveLayoutItemToPixels, restoreDashboardChartLayoutFromSavedItem, inferSavedGridCols } from '../utils/gridLayoutUtils';
import { parseDashboardAppearance, type DashboardAppearance } from '../utils/dashboardAppearance';
import { mergeDashboardWidgetChartMetadata } from '../utils/mergeDashboardWidgetChartMetadata';

export function useDashboardData(
  dashboardId: string | null,
  isEditMode: boolean,
  flowId?: string,
  analyticsStudio?: boolean,
) {
  const [charts, setCharts] = useState<Chart[]>([]);
  const [dashboardCharts, setDashboardCharts] = useState<DashboardChart[]>([]);
  const [rawDashboardData, setRawDashboardData] = useState<any | null>(null);
  const [dashboardTitle, setDashboardTitle] = useState('');
  const [isLoadingCharts, setIsLoadingCharts] = useState(false);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [dashboardAppearance, setDashboardAppearance] = useState<DashboardAppearance>(() =>
    parseDashboardAppearance(null),
  );

  // Fetch charts on mount
  const fetchCharts = useCallback(async () => {
    setIsLoadingCharts(true);
    try {
      const response = await getCharts({
        skip: 0,
        limit: 100,
        analyticsStudio,
        ...(flowId && !analyticsStudio ? { q: `flow_id='${flowId}'` } : {}),
      });
      if (response && response.data) {
        setCharts(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch charts:', error);
      toast.error(getDisplayErrorMessage(error, 'Failed to load charts'));
    } finally {
      setIsLoadingCharts(false);
    }
  }, [flowId, analyticsStudio]);

  useEffect(() => {
    fetchCharts();
  }, [fetchCharts]);

  /** Remove a chart from the backend and drop it from the sidebar and any widgets on the canvas. */
  const removeChartFromLibrary = useCallback(async (chartId: number) => {
    try {
      const res = await deleteChart({ chart_id: chartId });
      if (res && res.status === false) {
        toast.error(resolveApiErrorMessage(res, 'Failed to delete chart'));
        return;
      }
      setCharts((prev) => prev.filter((c) => c.id !== chartId));
      setDashboardCharts((prev) => prev.filter((dc) => dc.chartId !== chartId));
      toast.success(res?.message || 'Chart deleted');
    } catch {
      // deleteChart already showed toast on failure
    }
  }, []);

  // Load dashboard data if in edit mode (after charts are loaded)
  useEffect(() => {
    if (isEditMode && dashboardId) {
      console.log('Edit mode detected:', { isEditMode, dashboardId, chartsLength: charts.length });
      // Load dashboard data - it will handle chart matching even if charts aren't fully loaded
      if (charts.length > 0) {
        loadDashboardData(dashboardId);
      } else {
        // If charts aren't loaded yet, wait a bit and try again
        const timer = setTimeout(() => {
          if (charts.length > 0) {
            loadDashboardData(dashboardId);
          }
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [isEditMode, dashboardId, charts.length]);

  const loadDashboardData = async (id: string) => {
    if (isLoadingDashboard) {
      console.log('Dashboard data is already loading, skipping...');
      return; // Prevent multiple loads
    }

    console.log('Loading dashboard data for ID:', id);
    setIsLoadingDashboard(true);
    try {
      const response = await getDashboardById(id);
      console.log('Dashboard API response:', response);
      const dashboardData = response?.data || response;
      console.log('Dashboard data:', dashboardData);

      if (dashboardData) {
        // Set dashboard title
        setDashboardTitle(dashboardData.dashboard_title || dashboardData.title || dashboardData.name || '');
        setDashboardAppearance(parseDashboardAppearance(dashboardData));

        // Load charts from dashboard
        if (dashboardData.charts && Array.isArray(dashboardData.charts) && dashboardData.charts.length > 0) {
          const loadedCharts: DashboardChart[] = [];

          const savedContainerWidth = Math.max(1, dashboardData.container_width || DEFAULT_CONTAINER_WIDTH);
          const savedContainerHeight = Math.max(1, dashboardData.container_height || DEFAULT_CONTAINER_HEIGHT);
          const savedGridCols =
            typeof dashboardData.grid_cols === 'number' && dashboardData.grid_cols > 0
              ? dashboardData.grid_cols
              : inferSavedGridCols(dashboardData.layout);

          // Process charts sequentially to load their data
          console.log('Processing charts:', dashboardData.charts.length, 'charts found');
          for (let i = 0; i < dashboardData.charts.length; i++) {
            const chartData = dashboardData.charts[i];
            console.log(`Processing chart ${i + 1}:`, chartData);
            const layoutItem =
              dashboardData.layout?.find((l: any) => chartData.widget_i && l.i === chartData.widget_i) ||
              dashboardData.layout?.find((l: any) => l.i === `widget_${i + 1}`) ||
              dashboardData.layout?.[i];

            const widget =
              dashboardData.widgets?.find(
                (w: any) => chartData.widget_i && (w.id === chartData.widget_i || w.i === chartData.widget_i),
              ) ||
              dashboardData.widgets?.find((w: any) => w.i === `widget_${i + 1}`) ||
              dashboardData.widgets?.[i];
            console.log(`Widget ${i + 1}:`, widget);

            let gridLayout: DashboardChart['gridLayout'];
            let position: { x: number; y: number };
            let size: { width: number; height: number };

            const restored = restoreDashboardChartLayoutFromSavedItem(
              layoutItem,
              savedContainerWidth,
              undefined,
              savedGridCols,
            );

            if (restored) {
              gridLayout = restored.gridLayout;
              position = restored.position;
              size = restored.size;
            } else {
              const fallback = resolveLayoutItemToPixels(
                layoutItem,
                savedContainerWidth,
                savedContainerHeight,
                {
                  x: (i % 3) * 520,
                  y: Math.floor(i / 3) * 420,
                  width: 500,
                  height: DEFAULT_CHART_HEIGHT,
                },
                undefined,
                savedGridCols,
              );
              gridLayout = undefined;
              position = { x: fallback.x, y: fallback.y };
              size = { width: fallback.width, height: fallback.height };
            }

            // Find the chart in the charts list or static layout/content lists
            const chart = charts.find(c => c.id === chartData.chart_id) ||
                          STATIC_LAYOUT_ITEMS.find(c => c.id === chartData.chart_id) ||
                          STATIC_CONTENT_ITEMS.find(c => c.id === chartData.chart_id);
            console.log(`Chart found for ID ${chartData.chart_id}:`, chart ? 'Yes' : 'No');

            if (chart) {
              const dashboardChartId = chartData.widget_i || `dashboard-chart-${Date.now()}-${i}`;

              // Check if widget or chart entry has saved chart_data
              const savedChartData = widget?.chart_data ;
              console.log(`Chart ${i + 1} saved data:`, savedChartData);
              let transformedData: any[] = [];
              let chartColumns: string[] = [];
              // let rawResponse: any = undefined;
              let isLoading = false;

              const vizName = chart.visualization_name || chart.chart_type || '';
              const isStaticItem = isStaticLayoutContentChartId(chart.id);
              const isPieLikeChart = isPieDonutOrRadiusPieChart(vizName);
              const chartParams = chart.params || {};
              const chartMetrics = chartParams.metrics ?? chartParams.metric ?? chartParams.mtric;
              const toChartRows = (rows: any[], columns?: string[]) =>
                transformDashboardChartRows(rows, vizName, {
                  columns,
                  metrics: Array.isArray(chartMetrics) ? chartMetrics : undefined,
                });

              if (isStaticItem) {
                isLoading = false;
              } else if (!isPieLikeChart && savedChartData && Array.isArray(savedChartData) && savedChartData.length > 0) {
                // Use saved chart data if available
                console.log(`Using saved array data for chart ${i + 1}`);
                transformedData = toChartRows(savedChartData);
                isLoading = false;
              } else if (!isPieLikeChart && savedChartData && typeof savedChartData === 'object' && savedChartData.data) {
                // Handle case where chart_data is an object with data property
                console.log(`Using saved object data for chart ${i + 1}`);
                transformedData = toChartRows(savedChartData.data, savedChartData.columns);
                chartColumns = savedChartData.columns || [];
                isLoading = false;
              } else {
                // Pie-like charts always refetch so slices match the chart editor (saved chart_data is often stale/aggregated).
                console.log(`Fetching chart data for chart ${i + 1}${isPieLikeChart ? ' (pie refresh)' : ''}`);
                isLoading = true;
              }

              // Merge saved drilldown_levels and widget params (panel items, styling, etc.)
              const savedDrilldownLevels = widget?.drilldown_levels ?? chartData?.drilldown_levels;
              const staticBlockChart = isStaticItem
                ? buildStaticBlockChartFromDashboard(
                    {
                      chart_id: chartData.chart_id,
                      chart_name: chartData.chart_name,
                      visualization_name: chartData.visualization_name,
                      params: chartData.params,
                    },
                    widget,
                  )
                : null;
              const mergedParams = {
                ...(chart.params || {}),
                ...(chartData?.params || {}),
                ...(widget?.params || {}),
                ...(Array.isArray(savedDrilldownLevels) && savedDrilldownLevels.length > 0
                  ? { drilldown_levels: savedDrilldownLevels }
                  : {}),
              };
              const chartWithParams = staticBlockChart
                ? { ...staticBlockChart, params: { ...(staticBlockChart.params || {}), ...mergedParams } }
                : {
                    ...chart,
                    chart_name: chartData.chart_name || chart.chart_name,
                    visualization_name:
                      chartData.visualization_name || chart.visualization_name || chart.chart_type || '',
                    params: mergedParams,
                  };

              // Create dashboard chart entry
              const dashboardChart: DashboardChart = {
                id: dashboardChartId,
                chartId: chart.id,
                chart: chartWithParams,
                gridLayout,
                position,
                size,
                chartData: transformedData.length > 0 ? transformedData : undefined,
                chartColumns: chartColumns.length > 0 ? chartColumns : undefined,
                // rawResponse,
                isLoading: isLoading,
              };

              loadedCharts.push(dashboardChart);

              // If no saved data, load chart data asynchronously (skip for static blocks)
              if (isLoading && !isStaticItem) {
                console.log(`Fetching chart data for chart ${i + 1} (ID: ${chart.id})`);
                (async () => {
                  try {
                    let chartForFetch = chartWithParams;
                    try {
                      const fullChart = await getChartById(String(chart.id));
                      if (fullChart) {
                        chartForFetch = mergeDashboardWidgetChartMetadata(
                          {
                            ...chartWithParams,
                            ...fullChart,
                            customization: fullChart.customization ?? chartWithParams.customization,
                          },
                          { widget, chartEntry: chartData },
                        );
                      }
                    } catch {
                      // continue with merged widget chart metadata
                    }

                    const chartPayload = buildDashboardCreateChartPayload(chartForFetch, analyticsStudio);

                    console.log(`Chart payload for ${i + 1}:`, chartPayload);
                    const chartResponse = await createChart(chartPayload);
                    console.log(`Chart response for ${i + 1}:`, chartResponse);
                    const resp: any = chartResponse;

                    // Detect pivot-like responses (rows, columns, data as object) and flatten them
                    const isPivotResponse = resp && resp.rows && resp.columns && resp.data && typeof resp.data === 'object' && !Array.isArray(resp.data);

                    if (isPivotResponse) {
                      const rows = Array.isArray(resp.rows) ? resp.rows : (resp.rows && typeof resp.rows === 'object' ? Object.values(resp.rows) : []);
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
                        const rowObj: Record<string, any> = {};
                        for (const dim of rows) {
                          const colData = norm[dim];
                          rowObj[dim] = colData && typeof colData === 'object' && idx in colData ? colData[idx] : '';
                        }
                        for (const colKey of metricKeys) {
                          const colData = norm[colKey];
                          rowObj[colKey] = colData && typeof colData === 'object' && idx in colData ? colData[idx] : null;
                        }
                        flattened.push(rowObj);
                      }

                      // Update the chart with flattened pivot data and preserve rawResponse
                      setDashboardCharts(prev =>
                        prev.map(dc =>
                          dc.id === dashboardChartId
                            ? {
                              ...dc,
                              chartData: flattened.length > 0 ? flattened : [],
                              chartColumns: resp.columns,
                              rawResponse: resp,
                              isLoading: false
                            }
                            : dc
                        )
                      );
                    } else {
                      const vizName = chartForFetch.visualization_name || chartForFetch.chart_type || chart.visualization_name || chart.chart_type || '';
                      const chartMetrics = chartForFetch.params?.metrics ?? chartForFetch.params?.metric ?? chartForFetch.params?.mtric;
                      const rawRows = extractDashboardChartResponseRows(resp);
                      const fetchedTransformedData = transformDashboardChartRows(rawRows, vizName, {
                        columns: resp.columns,
                        metrics: Array.isArray(chartMetrics) ? chartMetrics : undefined,
                        x_axis: resp.x_axis ?? null,
                      });

                      setDashboardCharts(prev =>
                        prev.map(dc =>
                          dc.id === dashboardChartId
                            ? {
                              ...dc,
                              chart: {
                                ...dc.chart,
                                ...(chartForFetch.customization
                                  ? { customization: chartForFetch.customization }
                                  : {}),
                                params: {
                                  ...(dc.chart.params || {}),
                                  ...(chartForFetch.params || {}),
                                },
                              },
                              chartData: fetchedTransformedData,
                              chartColumns: resp.columns,
                              rawResponse: buildDashboardChartRawResponse(
                                resp,
                                chartForFetch.params || {},
                                rawRows,
                                chartMetrics,
                              ),
                              isLoading: false
                            }
                            : dc
                        )
                      );
                    }
                  } catch (error) {
                    console.error('Error loading chart data:', error);
                    setDashboardCharts(prev =>
                      prev.map(dc =>
                        dc.id === dashboardChartId
                          ? { ...dc, isLoading: false }
                          : dc
                      )
                    );
                  }
                })();
              }
            } else {
              console.warn(`Chart with ID ${chartData.chart_id} not found in charts list`);
            }
          }

          console.log('Loaded charts:', loadedCharts.length);
          // Expose raw dashboard API response for edit-mode inspection
          try { setRawDashboardData(dashboardData); } catch (e) { /* ignore */ }
          // Set charts immediately (they'll load data in background if needed)
          setDashboardCharts(loadedCharts);
        } else {
          console.log('No charts found in dashboard data');
        }
      } else {
        console.log('No dashboard data received');
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast.error(getDisplayErrorMessage(error, 'Failed to load dashboard data'));
    } finally {
      setIsLoadingDashboard(false);
    }
  };

  /** Update a single chart in the sidebar library after an inline edit (no full list refetch). */
  const updateChartInLibrary = useCallback((updatedChart: Chart) => {
    setCharts((prev) =>
      prev.map((chart) => (chart.id === updatedChart.id ? { ...chart, ...updatedChart } : chart)),
    );
  }, []);

  return {
    charts,
    dashboardCharts,
    setDashboardCharts,
    rawDashboardData,
    dashboardTitle,
    setDashboardTitle,
    isLoadingCharts,
    isLoadingDashboard,
    refetchCharts: fetchCharts,
    updateChartInLibrary,
    removeChartFromLibrary,
    dashboardAppearance,
    setDashboardAppearance,
  };
}

