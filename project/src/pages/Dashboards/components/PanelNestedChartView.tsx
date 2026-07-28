import { memo, useMemo, useRef, useEffect } from 'react';
import { LayoutDashboard, Loader2 } from 'lucide-react';
import { AmChart } from '@/pages/charts/components/AmChart';
import { getChartCustomizationFromChart } from '@/pages/charts/chartCustomizationsPayload';
import { PivotChart } from '@/pages/charts/components/charts/pivot';
import type { Chart } from '../types';
import {
  PANEL_EMBEDDED_CHART_FILL_CLASS,
  isDashboardBigNumberChart,
} from '../utils/dashboardWidgetTabs';

export interface PanelChartSnapshot {
  chart?: Chart;
  chartData?: any[];
  chartColumns?: string[];
  rawResponse?: any;
  isLoading?: boolean;
}

function buildChartVisualizationConfig(params: any) {
  if (params?.config) return params.config;

  const xAxis = params?.['X-axis'] ?? params?.['x-axis'] ?? params?.x_axis;
  const xName =
    Array.isArray(xAxis) && xAxis.length > 0
      ? typeof xAxis[0] === 'string'
        ? xAxis[0]
        : xAxis[0].columns || xAxis[0].name || xAxis[0].column
      : params?.dimensions?.[0]
        ? params.dimensions[0].columns || params.dimensions[0]
        : null;

  const yMetric = params?.metrics?.[0];
  const yName = yMetric ? yMetric.columns || yMetric : null;

  return {
    x: xName ? { name: xName } : null,
    y: yName ? { name: yName } : null,
    operator: yMetric?.operation || params?.operator || null,
    color: params?.color || null,
    column: params?.column || null,
    row: params?.row || null,
  };
}

function resolvePanelChartData(snapshot?: PanelChartSnapshot) {
  if (!snapshot) return [];
  if (snapshot.chartData && snapshot.chartData.length > 0) return snapshot.chartData;
  if (snapshot.rawResponse) {
    if (Array.isArray(snapshot.rawResponse)) return snapshot.rawResponse;
    if (Array.isArray(snapshot.rawResponse.data)) return snapshot.rawResponse.data;
  }
  return [];
}

export const PanelNestedChart = memo(function PanelNestedChart({
  snapshot,
}: {
  snapshot: PanelChartSnapshot;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    let rafId = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));
      });
    });
    observer.observe(el);
    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, []);

  const innerChart = snapshot.chart;
  if (!innerChart) {
    return (
      <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
        Chart unavailable
      </div>
    );
  }

  const vizName = (innerChart.visualization_name || innerChart.chart_type || '').toString().toLowerCase();
  const params = innerChart.params || {};
  const chartVisualizationConfig = useMemo(() => buildChartVisualizationConfig(params), [params]);
  const chartCustomizationOptions = useMemo(() => getChartCustomizationFromChart(innerChart), [innerChart]);
  const chartConfig = useMemo(
    () => ({
      name: innerChart.chart_name,
      uniqueId: innerChart.visualization_name || innerChart.chart_type,
      icon: null,
    }),
    [innerChart.chart_name, innerChart.visualization_name, innerChart.chart_type],
  );
  const resolvedChartData = useMemo(() => resolvePanelChartData(snapshot), [snapshot]);
  const rawResponse = snapshot.rawResponse;

  if (snapshot.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!rawResponse && resolvedChartData.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center p-2">
        <LayoutDashboard className="h-5 w-5 text-muted-foreground/40 mb-1" />
        <span className="text-[10px] text-muted-foreground">No chart data</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={
        isDashboardBigNumberChart(innerChart)
          ? 'h-full w-full min-h-0 min-w-0 overflow-hidden'
          : PANEL_EMBEDDED_CHART_FILL_CLASS
      }
    >
      {vizName.includes('pivot') ? (
        <PivotChart
          data={resolvedChartData}
          rawResponse={rawResponse}
          forceMock={false}
          mockResponse={undefined}
        />
      ) : (
        <AmChart
          chart={chartConfig}
          data={resolvedChartData}
          config={chartVisualizationConfig}
          showLegend={true}
          customizationOptions={chartCustomizationOptions}
          useSavedCustomizationOnly={true}
          rawResponse={rawResponse}
          chartParams={params}
        />
      )}
    </div>
  );
});
