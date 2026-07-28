import type { AnalyticsStudioChartInit, AnalyticsStudioSourceMeta } from "@/pages/charts/ChartFormulator/types";
import type { AnalyticsStudioCreateChartState } from "../types";
import type { ChartWizardSource } from "./types";

function buildSourceMetaByName(
  routeState: AnalyticsStudioCreateChartState,
  sources: ChartWizardSource[],
): Record<string, AnalyticsStudioSourceMeta> {
  const meta: Record<string, AnalyticsStudioSourceMeta> = {};
  if (routeState.sourceType !== "database" || routeState.fetchType === "query") {
    return meta;
  }

  const tables = routeState.tables ?? [];
  if (!routeState.connectionId || !routeState.databaseName) return meta;

  for (const source of sources) {
    const matchedTable = tables.find(({ schema, table }) => {
      const baseName = schema ? `${schema}.${table}` : table;
      return (
        source.name === baseName ||
        source.name.startsWith(`${baseName} `) ||
        source.name.includes(table)
      );
    });

    if (matchedTable) {
      meta[source.name] = {
        schema: matchedTable.schema,
        table: matchedTable.table,
        connectionId: routeState.connectionId,
        databaseName: routeState.databaseName,
      };
    }
  }

  return meta;
}

export function buildAnalyticsStudioInitFromRouteState(
  routeState: AnalyticsStudioCreateChartState,
  sources: ChartWizardSource[],
  selectedSourceName?: string,
): AnalyticsStudioChartInit {
  const wizardSources = sources.map((source) => ({
    name: source.name,
    columns: source.columns,
  }));

  if (routeState.sourceType === "virtual_db") {
    return {
      flowId: routeState.flowId ?? "",
      sources: wizardSources,
      selectedSource: selectedSourceName ?? sources[0]?.name,
      sourceType: "virtual_db",
    };
  }

  return {
    flowId: routeState.flowId ?? "",
    sources: wizardSources,
    selectedSource: selectedSourceName ?? sources[0]?.name,
    sourceType: "database",
    fetchType: routeState.fetchType ?? "table",
    connectionId: routeState.connectionId,
    databaseName: routeState.databaseName,
    connectionType: routeState.connectionType,
    query: routeState.query,
    sourceMetaByName: buildSourceMetaByName(routeState, sources),
  };
}
