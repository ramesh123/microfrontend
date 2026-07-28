import {
  getDashboardChartForm,
  getDashboardCharts,
  getChartById,
  type ChartFormParameter,
} from "@/pages/Visualization/API/chartsApi";
import type { AnalyticsStudioChartInit } from "@/pages/charts/ChartFormulator/types";
import { ensureColumnsFromParams } from "@/pages/charts/ChartFormulator/utils";
import {
  getSavedChartCustomizations,
  resolveChartCustomizationsForApi,
} from "@/pages/charts/chartCustomizationsPayload";
import type { ChartCustomizationOptions } from "@/pages/charts/components/charts/pie";
import {
  buildAnalyticsStudioChartInitFromChart,
  isAnalyticsStudioDatabaseChart,
  type AnalyticsStudioChartRecord,
} from "../analyticsStudioChartUtils";
import { buildRouteStateFromChartInit } from "./buildRouteStateFromChartInit";
import { ensurePivotApplyParam } from "./chartFormUtils";
import {
  normalizeChartRecordForWizard,
  populateWizardFormFromChart,
} from "./populateWizardFormFromChart";
import type { ChartVisibility, ChartWizardSource } from "./types";

export interface EditChartWizardLoadedState {
  chartId: string;
  chartRecord: AnalyticsStudioChartRecord;
  chartInit: AnalyticsStudioChartInit;
  routeState: ReturnType<typeof buildRouteStateFromChartInit>;
  sources: ChartWizardSource[];
  selectedSourceName?: string;
  selectedChartTypeId: string;
  selectedChartName: string;
  chartFormData: {
    parameters?: ChartFormParameter[];
    name?: string;
    unique_id?: string;
  };
  formValues: Record<string, unknown>;
  customizationOptions: ChartCustomizationOptions | null;
  chartName: string;
  chartVisibility: ChartVisibility;
  enableDrilldown: boolean;
  drilldownColumns: string[];
  payloadSource?: string;
}

function extractDrilldownColumns(chart: AnalyticsStudioChartRecord): string[] {
  const levels = chart.params?.drilldown_levels;
  if (!Array.isArray(levels)) return [];

  return levels.flatMap((level: any) => {
    const cols = level?.drill_columns;
    if (!Array.isArray(cols)) return [];
    return cols
      .map((col: any) => (typeof col === "string" ? col : col?.column ?? ""))
      .filter(Boolean);
  });
}

function resolveSelectedSource(
  chart: AnalyticsStudioChartRecord,
  chartInit: AnalyticsStudioChartInit,
  sources: ChartWizardSource[],
): string | undefined {
  const desired = chart.params?.source?.trim();
  if (desired) {
    const exact = sources.find((source) => source.name === desired);
    if (exact) return exact.name;

    const matched = sources.find(
      (source) =>
        source.name === desired ||
        source.name.endsWith(`.${desired}`) ||
        source.name.split(".").pop() === desired,
    );
    if (matched) return matched.name;
  }

  return chartInit.selectedSource ?? sources[0]?.name;
}

function mergeReferencedColumns(
  sources: ChartWizardSource[],
  chart: AnalyticsStudioChartRecord,
): ChartWizardSource[] {
  if (sources.length === 0) return sources;

  const referenced = ensureColumnsFromParams(chart.params);
  if (referenced.size === 0) return sources;

  const nextSources = sources.map((source) => ({
    ...source,
    columns: [...source.columns],
  }));
  const first = nextSources[0];
  const existingCols = new Set(first.columns);
  referenced.forEach((column) => {
    if (column && !existingCols.has(column)) {
      first.columns.push(column);
      existingCols.add(column);
    }
  });

  return nextSources;
}

export async function loadEditChartWizardState(chartId: string): Promise<EditChartWizardLoadedState> {
  const chartResponse = normalizeChartRecordForWizard(
    (await getChartById(chartId)) as Record<string, unknown>,
  ) as AnalyticsStudioChartRecord;
  if (!isAnalyticsStudioDatabaseChart(chartResponse)) {
    throw new Error("This chart is not an Analytics Studio database chart");
  }

  const chartInit = await buildAnalyticsStudioChartInitFromChart(chartResponse);
  const routeState = buildRouteStateFromChartInit(chartInit, chartResponse);
  const sources = mergeReferencedColumns(
    chartInit.sources.map((source) => ({
      name: source.name,
      columns: [...source.columns],
    })),
    chartResponse,
  );
  const selectedSourceName = resolveSelectedSource(chartResponse, chartInit, sources);

  const visualizationName = String(
    chartResponse.visualization_name || chartResponse.chart_type || "",
  ).trim();
  if (!visualizationName) {
    throw new Error("Chart visualization type is missing");
  }

  const chartsResponse = await getDashboardCharts();
  if (!chartsResponse.status || !chartsResponse.data) {
    throw new Error("Failed to load chart types");
  }

  const allCharts = chartsResponse.data.flatMap((section) => section.components);
  const matchingChart = allCharts.find(
    (chart) =>
      String(chart.unique_id).toLowerCase() === visualizationName.toLowerCase() ||
      String(chart.key).toLowerCase() === visualizationName.toLowerCase(),
  );

  if (!matchingChart) {
    throw new Error(`Chart type "${visualizationName}" is not available`);
  }

  const formResponse = await getDashboardChartForm(matchingChart.unique_id);
  if (!formResponse.status || !formResponse.data) {
    throw new Error(formResponse.message || "Failed to load chart form");
  }

  const chartFormData = ensurePivotApplyParam(formResponse.data, visualizationName) as {
    parameters?: ChartFormParameter[];
    name?: string;
    unique_id?: string;
  };
  const formValues = populateWizardFormFromChart(chartResponse, chartFormData);

  const loadedCustomizations = getSavedChartCustomizations(chartResponse);
  let customizationOptions: ChartCustomizationOptions | null = null;
  if (loadedCustomizations) {
    const chartTypeHint = visualizationName.toLowerCase();
    customizationOptions = (resolveChartCustomizationsForApi(
      loadedCustomizations,
      null,
      chartTypeHint,
    ) ?? loadedCustomizations) as unknown as ChartCustomizationOptions;
  }

  const drilldownColumns = extractDrilldownColumns(chartResponse);
  const visibility = chartResponse.visibility;
  const chartVisibility: ChartVisibility =
    visibility === "team" || visibility === "public" ? visibility : "personal";
  const payloadSource =
    String(chartResponse.params?.source ?? chartResponse.table_name ?? "").trim() || undefined;

  return {
    chartId,
    chartRecord: chartResponse,
    chartInit,
    routeState,
    sources,
    selectedSourceName,
    selectedChartTypeId: matchingChart.unique_id,
    selectedChartName: matchingChart.name,
    chartFormData,
    formValues,
    customizationOptions,
    chartName: String(
      chartResponse.chart_name || chartResponse.chartname || chartResponse.name || "",
    ).trim(),
    chartVisibility,
    enableDrilldown: drilldownColumns.length > 0,
    drilldownColumns,
    payloadSource,
  };
}
