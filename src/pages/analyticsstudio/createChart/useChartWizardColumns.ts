import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  getAnalyticsStudioDatabaseColumns,
  getColumns,
} from "@/pages/Visualization/API/chartsApi";
import { getDisplayErrorMessage } from "@/utils/exceptionHelper";
import { resolveAnalyticsStudioConnectionType } from "../connectionType";
import type { AnalyticsStudioCreateChartState } from "../types";
import type { ChartWizardSource } from "./types";

function formatSourceName(schema: string, table: string, fileName?: string) {
  if (fileName?.trim()) return fileName.trim();
  return schema ? `${schema}.${table}` : table;
}

function hasValidRouteState(routeState: AnalyticsStudioCreateChartState): boolean {
  if (routeState.sourceType === "virtual_db") {
    return !!routeState.flowId;
  }
  if (!routeState.connectionId || !routeState.databaseName) return false;
  if (routeState.fetchType === "query") {
    return !!routeState.query?.trim();
  }
  return (routeState.tables?.length ?? 0) > 0;
}

export function getRouteStateFetchKey(routeState: AnalyticsStudioCreateChartState): string {
  return JSON.stringify({
    sourceType: routeState.sourceType,
    flowId: routeState.flowId,
    connectionId: routeState.connectionId,
    databaseName: routeState.databaseName,
    fetchType: routeState.fetchType,
    query: routeState.query,
    tables: routeState.tables,
  });
}

export function useChartWizardColumns(
  nodeId: string,
  routeState: AnalyticsStudioCreateChartState,
) {
  const [sources, setSources] = useState<ChartWizardSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isValid = useMemo(() => hasValidRouteState(routeState), [routeState]);
  const routeStateKey = useMemo(() => getRouteStateFetchKey(routeState), [routeState]);

  useEffect(() => {
    if (!isValid) {
      setSources((prev) => (prev.length === 0 ? prev : []));
      setIsLoading((prev) => (prev ? false : prev));
      return;
    }

    const loadColumns = async () => {
      setIsLoading(true);
      setError(null);

      try {
        if (routeState.sourceType === "virtual_db" && routeState.flowId) {
          const response = await getColumns({
            flow_id: routeState.flowId,
            stmt_date: "",
            source: "",
          });

          if (!response.status) {
            throw new Error("Failed to load columns");
          }

          const responseData = response as unknown as {
            data?: Array<{ file_name?: string; name?: string; columns?: string[] }>;
          };
          const items = Array.isArray(responseData.data) ? responseData.data : [];

          setSources(
            items.map((item) => ({
              name: item.file_name ?? item.name ?? "Unknown",
              columns: Array.isArray(item.columns) ? item.columns : [],
            })),
          );
          return;
        }

        if (routeState.fetchType === "query" && routeState.query?.trim()) {
          const response = await getAnalyticsStudioDatabaseColumns({
            flow_id: routeState.flowId ?? "",
            source_type: "database",
            connection_id: routeState.connectionId!,
            database_name: routeState.databaseName!,
            params: {
              fetch_type: "query",
              query: routeState.query.trim(),
            },
          });

          if (!response.status || !Array.isArray(response.data) || response.data.length === 0) {
            throw new Error("No columns returned for the query");
          }

          setSources(
            response.data.map((item, index) => ({
              name: item.file_name?.trim() || `Query Result ${index + 1}`,
              columns: Array.isArray(item.columns) ? item.columns : [],
            })),
          );
          return;
        }

        const tables = routeState.tables ?? [];
        const responses = await Promise.all(
          tables.map(({ schema, table }) =>
            getAnalyticsStudioDatabaseColumns({
              flow_id: routeState.flowId ?? "",
              source_type: "database",
              connection_id: routeState.connectionId!,
              database_name: routeState.databaseName!,
              schema_name: schema,
              table_name: table,
              params: { fetch_type: "table" },
            }),
          ),
        );

        const formattedSources: ChartWizardSource[] = [];
        const seenNames = new Set<string>();

        responses.forEach((response, index) => {
          if (!response.status || !Array.isArray(response.data)) return;
          const { schema, table } = tables[index];

          response.data.forEach((item) => {
            const name = formatSourceName(schema, table, item.file_name);
            const uniqueName = seenNames.has(name) ? `${name} (${schema})` : name;
            seenNames.add(uniqueName);
            formattedSources.push({
              name: uniqueName,
              columns: Array.isArray(item.columns) ? item.columns : [],
            });
          });
        });

        if (formattedSources.length === 0) {
          throw new Error("No columns returned for the selected tables");
        }

        setSources(formattedSources);
      } catch (err) {
        const message = getDisplayErrorMessage(err, "Failed to load columns");
        setError(message);
        toast.error(message);
        setSources([]);
      } finally {
        setIsLoading(false);
      }
    };

    void loadColumns();
  }, [isValid, nodeId, routeStateKey]);

  const defaultSourceName = sources[0]?.name;
  const connectionLabel =
    routeState.displayName ||
    routeState.connectionType ||
    resolveAnalyticsStudioConnectionType(nodeId) ||
    "Data source";

  return {
    sources,
    isLoading,
    error,
    isValid,
    defaultSourceName,
    connectionLabel,
  };
}
