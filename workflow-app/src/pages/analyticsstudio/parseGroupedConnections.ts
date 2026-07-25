import {
  ANALYTICS_STUDIO_CONNECTION_SOURCES,
  type AnalyticsStudioConnectionSource,
} from "@/controllers/API/connectionVaultApi";
import type { AnalyticsStudioConnection } from "./ConnectionSelectionTable";

export type GroupedAnalyticsStudioConnections = Record<
  AnalyticsStudioConnectionSource,
  AnalyticsStudioConnection[]
>;

const EMPTY_GROUPED_CONNECTIONS: GroupedAnalyticsStudioConnections = {
  databases: [],
  storage: [],
  notifications: [],
  ingestion: [],
};

function normalizeGroupType(value: unknown): AnalyticsStudioConnectionSource | null {
  const group = String(value ?? "")
    .trim()
    .toLowerCase();
  return ANALYTICS_STUDIO_CONNECTION_SOURCES.includes(group as AnalyticsStudioConnectionSource)
    ? (group as AnalyticsStudioConnectionSource)
    : null;
}

export function parseGroupedConnectionsResponse(
  data: unknown,
): GroupedAnalyticsStudioConnections {
  if (!data) return { ...EMPTY_GROUPED_CONNECTIONS };

  if (Array.isArray(data)) {
    const grouped: GroupedAnalyticsStudioConnections = {
      databases: [],
      storage: [],
      notifications: [],
      ingestion: [],
    };

    for (const item of data) {
      const connection = item as AnalyticsStudioConnection;
      const group = normalizeGroupType(connection?.group_type) ?? "databases";
      grouped[group].push(connection);
    }

    return grouped;
  }

  if (typeof data === "object") {
    const grouped: GroupedAnalyticsStudioConnections = {
      databases: [],
      storage: [],
      notifications: [],
      ingestion: [],
    };

    for (const source of ANALYTICS_STUDIO_CONNECTION_SOURCES) {
      const list = (data as Record<string, unknown>)[source];
      grouped[source] = Array.isArray(list) ? (list as AnalyticsStudioConnection[]) : [];
    }

    return grouped;
  }

  return { ...EMPTY_GROUPED_CONNECTIONS };
}
