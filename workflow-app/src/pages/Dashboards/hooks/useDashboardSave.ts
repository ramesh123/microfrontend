import { useState, useCallback } from 'react';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { createDashboard, updateDashboard } from '@/pages/Visualization/API/dashboardApi';
import { useAuth } from '@/context/auth/authContext';
import { useRbacStore } from '@/stores/useRBACStore';
import useFlowStore from '@/stores/flowStore';
import { DashboardChart } from '../types';
import { GRID_COLS, DEFAULT_CONTAINER_WIDTH, DEFAULT_CONTAINER_HEIGHT, isStaticLayoutContentChartId } from '../layoutConstants';
import { getDashboardCanvasAvailableWidth, pixelsToGridUnits, gridUnitsToPixels } from '../utils/gridLayoutUtils';
import { dashboardAppearanceToPayload, DEFAULT_DASHBOARD_APPEARANCE, type DashboardAppearance } from '../utils/dashboardAppearance';
import { isBigNumberVisualization } from '@/pages/charts/components/charts/bigNumber';

export function useDashboardSave(
  dashboardId: string | null,
  isEditMode: boolean,
  dashboardTitle: string,
  dashboardCharts: DashboardChart[],
  containerDimensions: { width: number; height: number },
  isSidebarExpanded?: boolean,
  canvasContainerWidth?: number,
  explicitFlowId?: string,
  analyticsStudio?: boolean,
  dashboardAppearance?: DashboardAppearance,
) {
  const navigate = useNavigate();
  const params = useParams<{ workflowname?: string }>();
  const currentWorkflow = useFlowStore((state) => state.currentWorkflow);
  const [isSaving, setIsSaving] = useState(false);
  const { state: authState } = useAuth();
  const { currentUser } = useRbacStore();

  const navigateToAnalytics = useCallback(() => {
    if (analyticsStudio) {
      navigate('/analytic-studio', { replace: true, state: { tab: 'dashboards' } });
      return;
    }
    const workflowName = params.workflowname || explicitFlowId;
    if (workflowName) {
      const workflow =
        currentWorkflow &&
        (String(currentWorkflow.id) === String(workflowName) ||
          String(currentWorkflow.flow_id) === String(workflowName) ||
          String(currentWorkflow.workflow_id) === String(workflowName))
          ? currentWorkflow
          : undefined;
      navigate(`/reconciliation/operations/${workflowName}?tab=analytics&view=recontab`, {
        state: workflow ? { workflow, viewMode: 'recontab' } : undefined,
        replace: true,
      });
      return;
    }
    navigate('/visualization/dashboards', { replace: true });
  }, [navigate, params.workflowname, explicitFlowId, currentWorkflow, analyticsStudio]);

  const handleCreateDashboard = async (
    overrideDimensions?: {
      width: number;
      height: number;
      containerWidth: number;
      /** Total content height (all rows) so layout percentages match creation mode */
      contentHeight?: number;
      /** Number of rows for display in view mode */
      rowCount?: number;
    },
    overrideCharts?: DashboardChart[]
  ) => {
    const chartsToUse = overrideCharts ?? dashboardCharts;
    console.log('handleCreateDashboard called', {
      dashboardTitle: dashboardTitle.trim(),
      dashboardChartsLength: chartsToUse.length,
      isSaving,
      hasOverride: !!overrideDimensions,
      hasChartsOverride: !!overrideCharts
    });

    if (!dashboardTitle.trim()) {
      console.log('Validation failed: No dashboard title');
      toast.error('Please enter a dashboard title');
      return;
    }

    if (chartsToUse.length === 0) {
      console.log('Validation failed: No charts added');
      toast.error('Please add at least one chart to the dashboard');
      return;
    }

    console.log('Validation passed, proceeding with API call...');

    setIsSaving(true);
    try {
      console.log('Starting dashboard creation...');

      // Get user information
      const userEmail = currentUser?.email || authState?.authInfo?.user?.email || '';
      const userName = currentUser?.name ||
        `${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`.trim() ||
        `${authState?.authInfo?.user?.first_name || ''} ${authState?.authInfo?.user?.last_name || ''}`.trim() ||
        '';
      // Get flow_id from flowStore.currentWorkflow (explicitFlowId), fallback to first chart if not available
      // Priority: flowStore.currentWorkflow.flow_id > firstChart.flow_id
      const firstChart = chartsToUse[0]?.chart;
      const flowId = explicitFlowId || firstChart?.flow_id || '';
      const workflowType = firstChart?.workflow_type || '';
      const executionId = firstChart?.execution_id || '';

      // Grid layout configuration (shared constants)
      const gridCols = GRID_COLS;
      
      // Use override dimensions when provided (measured at save time with sidebar collapsed)
      // Use contentHeight as container_height so layout percentages match creation mode (no overlapping in view)
      let containerWidth: number;
      let containerHeight: number;
      let rowCount: number | undefined;
      if (overrideDimensions) {
        containerWidth = Math.max(1, Math.round(overrideDimensions.containerWidth));
        const contentH = overrideDimensions.contentHeight != null && overrideDimensions.contentHeight > 0
          ? Math.max(1, Math.round(overrideDimensions.contentHeight))
          : undefined;
        containerHeight = contentH ?? Math.max(1, Math.round(overrideDimensions.height)) ?? DEFAULT_CONTAINER_HEIGHT;
        rowCount = overrideDimensions.rowCount;
      } else {
        containerWidth = canvasContainerWidth
          ? canvasContainerWidth
          : getDashboardCanvasAvailableWidth(containerDimensions.width);
        containerWidth = Math.max(1, Math.round(containerWidth));
        containerHeight = containerDimensions.height || DEFAULT_CONTAINER_HEIGHT;
      }

      // Convert pixel positions directly to grid coordinates - preserve exact visual layout
      // Don't repack - use actual positions as placed by the user (use overrideCharts when provided e.g. auto-collapse)
      const layout = chartsToUse.map((dc) => {
        const widgetId = dc.id;

        const grid = dc.gridLayout
          ? {
              x: Math.max(0, Math.min(gridCols - dc.gridLayout.w, dc.gridLayout.x)),
              y: Math.max(0, dc.gridLayout.y),
              w: Math.max(1, Math.min(gridCols, dc.gridLayout.w)),
              h: Math.max(1, dc.gridLayout.h),
            }
          : pixelsToGridUnits(
              Math.round(dc.position.x),
              Math.round(dc.position.y),
              Math.round(dc.size.width),
              Math.round(dc.size.height),
              containerWidth,
              gridCols,
            );

        const px = gridUnitsToPixels(grid.x, grid.y, grid.w, grid.h, containerWidth, gridCols);
        const x_px = px.x;
        const y_px = px.y;
        const width_px = px.width;
        const height_px = px.height;
        const x_clamped = grid.x;
        const y_grid = grid.y;
        const w_grid = grid.w;
        const h_grid = grid.h;

        // Percentage positions: use container_height (content height when provided) so y_pct is not clamped to 1
        const x_pct = Math.max(0, Math.min(1, x_px / containerWidth));
        const y_pct = Math.max(0, y_px / containerHeight);
        const w_pct = Math.max(0.01, Math.min(1, width_px / containerWidth));
        const h_pct = Math.max(0.01, height_px / containerHeight);

        return {
          i: widgetId,
          x: x_clamped,
          y: Math.max(0, y_grid),
          w: Math.max(1, Math.min(gridCols, w_grid)),
          h: Math.max(1, h_grid),
          x_px,
          y_px,
          width_px,
          height_px,
          x_pct,
          y_pct,
          w_pct,
          h_pct,
          static: false,
        };
      });

      const payload = {
        flow_id: analyticsStudio ? '' : flowId,
        ...(analyticsStudio ? { source_type: 'database' as const } : {}),
        id: null,
        dashboard_id: dashboardId,
        workflow_type: workflowType,
        execution_id: executionId,
        dashboard_title: dashboardTitle.trim(),
        charts: chartsToUse.map((dc) => {
          // Include chart_data when available so saved dashboards preserve pivot/table responses
          let chart_data: any = undefined;
          try {
            if ((dc as any).rawResponse) {
              chart_data = (dc as any).rawResponse;
            } else if (dc.chartData && Array.isArray(dc.chartData)) {
              // Prefer originalData when present (transformChartData preserves originalData)
              let rows = dc.chartData.map((r: any) => (r && r.originalData) ? r.originalData : r);
              const vizName = dc.chart.visualization_name || dc.chart.chart_type || '';
              if (isBigNumberVisualization(vizName)) {
                const seen = new Set<string>();
                rows = rows.filter((row: any) => {
                  const key = JSON.stringify(row);
                  if (seen.has(key)) return false;
                  seen.add(key);
                  return true;
                });
              }
              chart_data = rows;
            }
          } catch (e) {
            // ignore serialization issues
          }

          const drilldown_levels = (dc as any).chart?.params?.drilldown_levels;
          const visualizationName = dc.chart.visualization_name || dc.chart.chart_type || '';
          const isStaticBlock = isStaticLayoutContentChartId(dc.chartId);
          const chartParams = dc.chart.params || {};
          return {
            chart_id: dc.chartId,
            chart_name: dc.chart.chart_name || '',
            widget_i: dc.id,
            visualization_name: visualizationName,
            ...(isStaticBlock && Object.keys(chartParams).length > 0 ? { params: chartParams } : {}),
            ...(chart_data ? { chart_data } : {}),
            ...(Array.isArray(drilldown_levels) && drilldown_levels.length > 0 ? { drilldown_levels } : {}),
          };
        }),
        widgets: chartsToUse.map((dc) => ({
          id: dc.id,
          type: dc.chart.visualization_name || dc.chart.chart_type || 'chart',
          chart_id: dc.chartId,
          title: dc.chart.chart_name || '',
          params: dc.chart.params,
        })),
        layout: layout,
        dashboard_filter: [],
        tags: [],
        roles: [],
        created_by: userEmail,
        created_user: userName,
        changed_by: userEmail,
        // Save container dimensions and sidebar state for consistent rendering
        // container_height = content height so view mode can render without overlapping
        container_width: containerWidth,
        container_height: containerHeight,
        grid_cols: gridCols,
        saved_sidebar_expanded: overrideDimensions ? false : (isSidebarExpanded || false),
        ...(rowCount != null && rowCount >= 0 ? { row_count: rowCount } : {}),
        ...dashboardAppearanceToPayload(dashboardAppearance ?? DEFAULT_DASHBOARD_APPEARANCE),
      };

      let result;
      if (isEditMode && dashboardId) {
        console.log('Calling updateDashboard API...');
        result = await updateDashboard(dashboardId, payload);
        toast.success('Dashboard updated successfully');
      } else {
        console.log('Calling createDashboard API...');
        result = await createDashboard(payload);
        toast.success('Dashboard created successfully');
      }

      console.log('API Response:', result);

      navigateToAnalytics();
    } catch (error: any) {
      console.error('Failed to create dashboard:', error);
      console.error('Error details:', {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status,
      });
      toast.error(getDisplayErrorMessage(error, 'Failed to create dashboard'));
    } finally {
      setIsSaving(false);
    }
  };

  return {
    isSaving,
    handleCreateDashboard,
  };
}
