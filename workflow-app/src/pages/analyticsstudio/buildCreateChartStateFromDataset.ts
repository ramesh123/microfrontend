import type { Dataset } from "@/types/dataset";
import type { AnalyticsStudioCreateChartState } from "./types";
import { resolveAnalyticsStudioConnectionType } from "./connectionType";
import {
  hasSemanticMappingData,
  normalizeSemanticMappings,
  type DatasetSemanticMappings,
} from "@/components/common/datasets/Steps/Step5ChartColumns/semanticMapping";

function readPayloadValue(payload: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const direct = payload[key];
    if (direct != null && String(direct).trim()) {
      return String(direct).trim();
    }
    const nested = payload.data;
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      const fromNested = (nested as Record<string, unknown>)[key];
      if (fromNested != null && String(fromNested).trim()) {
        return String(fromNested).trim();
      }
    }
  }
  return "";
}

function isDatabaseDataset(dataset: Dataset): boolean {
  const group = String(dataset.group ?? "").toLowerCase();
  const nodeId = String(dataset.node_id ?? "").toLowerCase();
  return (
    group === "databases" ||
    /postgres|mysql|mssql|oracle|snowflake|redshift|sql|database|sap|hana|bigquery|trino|clickhouse|duckdb|singlestore|cockroachdb/i.test(
      nodeId,
    )
  );
}

export function getCreateChartNodeIdFromDataset(dataset: Dataset): string {
  return dataset.node_id?.trim() || "virtual_db";
}

function readSemanticMappings(
  payload: Record<string, unknown>,
  properties: Array<{ name: string; display_name?: string; type?: string; isSelected?: boolean }>,
): DatasetSemanticMappings | undefined {
  const savedSemantic = payload.semantic_mappings;
  if (!hasSemanticMappingData(savedSemantic)) return undefined;
  return {
    columns: normalizeSemanticMappings(savedSemantic, properties),
  };
}

export function buildCreateChartStateFromDataset(
  dataset: Dataset,
): AnalyticsStudioCreateChartState | null {
  const payload = {
    ...(dataset.payload ?? {}),
    ...(dataset.node?.payload ?? {}),
  } as Record<string, unknown>;

  const properties = (
    (dataset.node?.payload?.properties as Array<{ name: string; display_name?: string; type?: string; isSelected?: boolean }>) ||
    (dataset.node?.properties as Array<{ name: string; display_name?: string; type?: string; isSelected?: boolean }>) ||
    (dataset.properties as Array<{ name: string; display_name?: string; type?: string; isSelected?: boolean }>) ||
    []
  );

  const semanticMappings = readSemanticMappings(payload, properties);

  const base = {
    displayName: dataset.display_name ?? dataset.name,
    icon: dataset.icon ?? dataset.type,
    nodeName: dataset.type,
    contextText: dataset.description,
    datasetId: dataset.id,
    ...(semanticMappings ? { semanticMappings } : {}),
  };

  if (isDatabaseDataset(dataset)) {
    const connectionId = readPayloadValue(payload, "connection", "connection_id");
    const databaseName = readPayloadValue(payload, "database", "database_name");
    if (!connectionId) return null;

    const fetchTypeRaw = readPayloadValue(payload, "fetch_type");
    const fetchType = fetchTypeRaw === "query" ? "query" : "table";
    const nodeId = getCreateChartNodeIdFromDataset(dataset);

    if (fetchType === "query") {
      const query = readPayloadValue(payload, "query");
      if (!query) return null;
      return {
        ...base,
        sourceType: "database",
        fetchType: "query",
        connectionId,
        databaseName,
        connectionType: resolveAnalyticsStudioConnectionType(nodeId, dataset.type),
        query,
        flowId: "",
      };
    }

    const schema = readPayloadValue(payload, "schema") || "public";
    const table = readPayloadValue(payload, "table");
    if (!table) return null;

    return {
      ...base,
      sourceType: "database",
      fetchType: "table",
      connectionId,
      databaseName,
      connectionType: resolveAnalyticsStudioConnectionType(nodeId, dataset.type),
      tables: [{ schema, table }],
      flowId: "",
    };
  }

  return {
    ...base,
    sourceType: "virtual_db",
    flowId: String(dataset.id),
    connectionType: getCreateChartNodeIdFromDataset(dataset),
  };
}
