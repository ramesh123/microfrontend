import type { AnalyticsStudioChartInit } from "@/pages/charts/ChartFormulator/types";
import type { AnalyticsStudioCreateChartState } from "../types";
import {
  resolveAnalyticsStudioDatabaseName,
  resolveChartDatabaseName,
  type AnalyticsStudioChartRecord,
} from "../analyticsStudioChartUtils";

export function buildRouteStateFromChartInit(
  chartInit: AnalyticsStudioChartInit,
  chart: AnalyticsStudioChartRecord,
): AnalyticsStudioCreateChartState {
  if (chartInit.sourceType === "virtual_db") {
    return {
      sourceType: "virtual_db",
      flowId: chartInit.flowId,
      connectionType: chartInit.connectionType,
      datasetId:
        chart.dataset_id != null && chart.dataset_id !== ""
          ? Number(chart.dataset_id)
          : undefined,
    };
  }

  const schema = String(chart.schema_name ?? "public").trim();
  const table = String(chart.table_name ?? chart.params?.source ?? "").trim();
  const tables =
    chartInit.fetchType === "query" || !table
      ? undefined
      : [{ schema, table }];

  return {
    sourceType: "database",
    datasetId:
      chart.dataset_id != null && chart.dataset_id !== ""
        ? Number(chart.dataset_id)
        : undefined,
    displayName:
      String(chart.connection_name ?? chart.connection_type ?? "").trim() || undefined,
    fetchType: chartInit.fetchType ?? "table",
    connectionId: chartInit.connectionId,
    databaseName: resolveChartDatabaseName(chartInit, chart),
    connectionType: chartInit.connectionType,
    flowId: chartInit.flowId,
    query: chartInit.query,
    tables,
  };
}
