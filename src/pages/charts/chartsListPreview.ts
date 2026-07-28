import { createChart, getChartById } from "@/pages/Visualization/API/chartsApi";
import { buildDashboardCreateChartPayload } from "@/pages/Dashboards/utils/buildDashboardCreateChartPayload";
import { parseWizardChartResponse } from "@/pages/analyticsstudio/createChart/parseWizardChartResponse";
import type { Chart } from "@/pages/Dashboards/types";

export interface ChartsListPreviewResult {
  chartDetails: Chart;
  chartData: Array<{ category: string; value: number; originalData: Record<string, unknown> }>;
  rawChartResponse: Record<string, unknown> | null;
  visualizationName: string;
}

export function resolveChartVisualizationName(chart: Record<string, unknown>): string {
  return String(
    chart.visualization_name ||
      chart.charttype ||
      chart.chart_type ||
      chart.chart_name ||
      chart.name ||
      "chart",
  )
    .trim()
    .toLowerCase();
}

export function isPivotVisualization(vizName: string): boolean {
  return vizName.includes("pivot");
}

export function isTableVisualization(vizName: string): boolean {
  return vizName.includes("table") && !isPivotVisualization(vizName);
}

export async function loadChartsListPreview(
  chartId: string,
  analyticsStudio?: boolean,
): Promise<ChartsListPreviewResult> {
  const chartDetails = (await getChartById(chartId)) as Chart;
  const payload = buildDashboardCreateChartPayload(chartDetails, analyticsStudio);
  const response = (await createChart(payload)) as unknown as Record<string, unknown>;
  const visualizationName = resolveChartVisualizationName(chartDetails as unknown as Record<string, unknown>);
  const parsed = parseWizardChartResponse(
    response,
    visualizationName,
    payload.params?.metrics,
  );

  return {
    chartDetails,
    chartData: parsed.chartData,
    rawChartResponse: parsed.rawChartResponse,
    visualizationName,
  };
}
