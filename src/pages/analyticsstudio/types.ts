import type { ChartCategoryId } from "./createChart/chartTypeCatalog";
import type { DatasetSemanticMappings } from "@/components/common/datasets/Steps/Step5ChartColumns/semanticMapping";

export interface AnalyticsStudioTableSelection {
  schema: string;
  table: string;
}

export type AnalyticsStudioFetchType = "table" | "query";

export interface AnalyticsStudioSelectedConnection {
  id: string | number;
  name: string;
  connection_type: string;
  group_type: string;
  database_name?: string;
  schema_name?: string;
}

export interface AnalyticsStudioCreateChartState {
  displayName?: string;
  icon?: string;
  nodeName?: string;
  sourceType: "database" | "virtual_db";
  groupType?: string;
  fetchType?: AnalyticsStudioFetchType;
  connectionId?: string;
  databaseName?: string;
  connectionType?: string;
  flowId?: string;
  contextText?: string;
  query?: string;
  tables?: AnalyticsStudioTableSelection[];
  /** Preserved when navigating back from the create-chart wizard. */
  selectedChartTypeId?: string;
  /** Selected from analytical dataset chart creation options. */
  chartCategory?: ChartCategoryId;
  /** Source analytical dataset id when creating a chart from saved dataset. */
  datasetId?: number;
  semanticMappings?: DatasetSemanticMappings;
}

export interface AnalyticsStudioLocationState {
  displayName?: string;
  icon?: string;
  name?: string;
  preSelectedConnectionId?: string;
  selectedConnection?: AnalyticsStudioSelectedConnection;
}

/** Merged router state when returning from the create-chart wizard to source selection. */
export type AnalyticsStudioSourcePageState = AnalyticsStudioLocationState &
  Partial<AnalyticsStudioCreateChartState>;

export function getRestoredCreateChartState(
  state: AnalyticsStudioSourcePageState,
): AnalyticsStudioCreateChartState | null {
  if (state.sourceType === "virtual_db" && state.flowId) {
    return {
      sourceType: "virtual_db",
      displayName: state.displayName,
      icon: state.icon,
      nodeName: state.nodeName ?? state.name,
      groupType: state.groupType,
      flowId: state.flowId,
      contextText: state.contextText,
    };
  }

  if (state.connectionId || state.databaseName || state.tables?.length || state.query) {
    return {
      sourceType: state.sourceType ?? "database",
      displayName: state.displayName,
      icon: state.icon,
      nodeName: state.nodeName ?? state.name,
      groupType: state.groupType,
      fetchType: state.fetchType,
      connectionId: state.connectionId,
      databaseName: state.databaseName,
      connectionType: state.connectionType,
      contextText: state.contextText,
      query: state.query,
      tables: state.tables,
      flowId: state.flowId,
    };
  }

  return null;
}

export function usesConnectionConfigureStep(
  routeState?: AnalyticsStudioCreateChartState | null,
): boolean {
  if (!routeState) return false;
  if (routeState.datasetId) return false;
  if (routeState.sourceType === "virtual_db") return false;
  return routeState.sourceType === "database" || !!routeState.connectionId;
}

export function buildConfigureSourceStateFromRouteState(
  routeState: AnalyticsStudioCreateChartState,
  selectedChartTypeId?: string,
): AnalyticsStudioSourcePageState {
  const connectionId = routeState.connectionId ? String(routeState.connectionId) : undefined;

  return {
    displayName: routeState.displayName,
    icon: routeState.icon,
    name: routeState.nodeName ?? routeState.connectionType,
    preSelectedConnectionId: connectionId,
    selectedConnection: connectionId
      ? {
          id: connectionId,
          name: routeState.displayName ?? routeState.connectionType ?? "Connection",
          connection_type: routeState.connectionType ?? "",
          group_type: routeState.groupType ?? "databases",
          database_name: routeState.databaseName,
        }
      : undefined,
    sourceType: routeState.sourceType ?? "database",
    connectionId,
    databaseName: routeState.databaseName,
    connectionType: routeState.connectionType,
    groupType: routeState.groupType,
    fetchType: routeState.fetchType,
    query: routeState.query,
    tables: routeState.tables,
    flowId: routeState.flowId,
    ...(selectedChartTypeId ? { selectedChartTypeId } : {}),
  };
}
