import { updateChart } from "@/pages/Visualization/API/chartsApi";
import type { ChartFormParameter, CreateChartPayload } from "@/pages/Visualization/API/chartsApi";
import type { ChartCustomizationOptions } from "@/pages/charts/components/charts/pie";
import type { AnalyticsStudioChartInit } from "@/pages/charts/ChartFormulator/types";
import type { AnalyticsStudioCreateChartState } from "../types";
import type { AnalyticsStudioChartRecord } from "../analyticsStudioChartUtils";
import { applyAnalyticsStudioPayloadForSavedChart } from "../analyticsStudioChartPayload";
import { buildAnalyticsStudioInitFromRouteState } from "./buildAnalyticsStudioInitFromRouteState";
import { buildWizardSaveChartPayload, finalizeWizardChartPayload } from "./buildWizardChartPayload";
import type { ChartVisibility, ChartWizardSource } from "./types";

export interface UpdateWizardChartInput {
  chartId: string | number;
  chartRecord: AnalyticsStudioChartRecord;
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
  analyticsStudioInit?: AnalyticsStudioChartInit;
}

function resolveUpdatePayloadSource(
  chartRecord: AnalyticsStudioChartRecord,
  selectedSourceName?: string,
): string | null {
  const savedSource = String(chartRecord.params?.source ?? "").trim();
  if (savedSource) return savedSource;

  const tableName = String(chartRecord.table_name ?? "").trim();
  if (tableName) return tableName;

  const selected = String(selectedSourceName ?? "").trim();
  return selected || null;
}

function mergeAnalyticsStudioInit(
  routeState: AnalyticsStudioCreateChartState,
  sources: ChartWizardSource[],
  selectedSourceName: string | undefined,
  chartInit?: AnalyticsStudioChartInit,
): AnalyticsStudioChartInit {
  const routeInit = buildAnalyticsStudioInitFromRouteState(routeState, sources, selectedSourceName);
  if (!chartInit) return routeInit;

  return {
    ...routeInit,
    ...chartInit,
    sources: chartInit.sources.length > 0 ? chartInit.sources : routeInit.sources,
    sourceMetaByName: {
      ...(routeInit.sourceMetaByName ?? {}),
      ...(chartInit.sourceMetaByName ?? {}),
    },
  };
}

export async function updateWizardChart(input: UpdateWizardChartInput) {
  const analyticsStudioInit = mergeAnalyticsStudioInit(
    input.routeState,
    input.sources,
    input.selectedSourceName,
    input.analyticsStudioInit,
  );
  const sourceForPayload = resolveUpdatePayloadSource(input.chartRecord, input.selectedSourceName);

  const payload = buildWizardSaveChartPayload({
    flowId: input.routeState.flowId ?? analyticsStudioInit.flowId ?? "",
    formValues: input.formValues,
    chartFormData: input.chartFormData,
    selectedChart: {
      name: input.selectedChartName,
      uniqueId: input.selectedChartTypeId,
    },
    selectedSource: sourceForPayload,
    analyticsStudioInit,
    customizationOptions: input.customizationOptions,
    routeState: input.routeState,
    chartRecord: input.chartRecord,
    chartName: input.chartName,
    chartVisibility: input.chartVisibility ?? "personal",
    enableDrilldown: input.enableDrilldown,
    drilldownColumns: input.drilldownColumns,
  });

  if (!payload) {
    throw new Error("Unable to build chart payload");
  }

  const requestPayload = applyAnalyticsStudioPayloadForSavedChart(
    payload,
    input.chartRecord,
    sourceForPayload,
    analyticsStudioInit,
  );

  if (sourceForPayload) {
    requestPayload.params = {
      ...requestPayload.params,
      source: sourceForPayload,
    };
  }

  const finalizedPayload = finalizeWizardChartPayload(
    requestPayload as CreateChartPayload,
    input.routeState,
    input.chartRecord,
  );

  const previousUniqueId = String(
    input.chartRecord.unique_id ?? input.chartRecord.node_id ?? "",
  ).trim();

  return updateChart({
    chart_id: input.chartId,
    payload: {
      data: {
        ...finalizedPayload,
        id: input.chartId,
        ...(previousUniqueId ? { previous_unique_id: previousUniqueId } : {}),
      },
      actions: "update_chart",
      stmt_date: finalizedPayload.stmt_date || "",
    },
  });
}
