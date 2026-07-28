import { saveChart } from "@/pages/Visualization/API/chartsApi";
import type { ChartFormParameter } from "@/pages/Visualization/API/chartsApi";
import type { ChartCustomizationOptions } from "@/pages/charts/components/charts/pie";
import type { AnalyticsStudioCreateChartState } from "../types";
import { buildAnalyticsStudioInitFromRouteState } from "./buildAnalyticsStudioInitFromRouteState";
import { buildWizardSaveChartPayload } from "./buildWizardChartPayload";
import type { ChartVisibility, ChartWizardSource } from "./types";

export interface SaveWizardChartInput {
  routeState: AnalyticsStudioCreateChartState;
  sources: ChartWizardSource[];
  selectedSourceName?: string;
  selectedChartTypeId: string;
  selectedChartName: string;
  chartFormData: { parameters?: ChartFormParameter[]; name?: string; unique_id?: string };
  formValues: Record<string, unknown>;
  customizationOptions?: ChartCustomizationOptions | null;
  chartName: string;
  chartVisibility?: ChartVisibility;
  enableDrilldown?: boolean;
  drilldownColumns?: string[];
}

export async function saveWizardChart(input: SaveWizardChartInput) {
  const analyticsStudioInit = buildAnalyticsStudioInitFromRouteState(
    input.routeState,
    input.sources,
    input.selectedSourceName,
  );

  const payload = buildWizardSaveChartPayload({
    flowId: input.routeState.flowId ?? analyticsStudioInit.flowId ?? "",
    formValues: input.formValues,
    chartFormData: input.chartFormData,
    selectedChart: {
      name: input.selectedChartName,
      uniqueId: input.selectedChartTypeId,
    },
    selectedSource: input.selectedSourceName ?? null,
    analyticsStudioInit,
    customizationOptions: input.customizationOptions,
    routeState: input.routeState,
    chartName: input.chartName,
    chartVisibility: input.chartVisibility ?? "personal",
    enableDrilldown: input.enableDrilldown,
    drilldownColumns: input.drilldownColumns,
  });

  if (!payload) {
    throw new Error("Unable to build chart payload");
  }

  return saveChart(payload);
}
