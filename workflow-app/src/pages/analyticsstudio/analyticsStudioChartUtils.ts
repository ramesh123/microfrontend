import {
  getAnalyticsStudioDatabaseColumns,
} from '@/pages/Visualization/API/chartsApi';
import type { AnalyticsStudioChartInit } from '@/pages/charts/ChartFormulator/types';
import type { Source } from '@/pages/charts/components/DataFieldsSidebar';
import { resolveAnalyticsStudioConnectionType } from './connectionType';

export type AnalyticsStudioChartRecord = {
  id?: number | string;
  source_type?: string;
  chart_origin?: 'connection' | 'analytical_dataset';
  dataset_id?: number | string;
  connection_id?: number | string;
  connection_type?: string;
  database_name?: string;
  database?: string;
  schema_name?: string;
  table_name?: string;
  flow_id?: string;
  params?: {
    fetch_type?: 'table' | 'query';
    query?: string;
    source?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

function formatSourceName(schema: string, table: string, fileName?: string) {
  if (fileName?.trim()) return fileName.trim();
  return schema ? `${schema}.${table}` : table;
}

export function isAnalyticsStudioDatabaseChart(chart: AnalyticsStudioChartRecord): boolean {
  return chart.source_type === 'database';
}

export function resolveAnalyticsStudioDatabaseName(chart: AnalyticsStudioChartRecord): string {
  const direct = String(chart.database_name ?? chart.database ?? '').trim();
  if (direct) return direct;

  const flowId = String(chart.flow_id ?? '');
  if (!flowId.startsWith('database:')) return '';

  const parts = flowId.split(':');
  if (parts.length >= 6) {
    return parts[3]?.trim() ?? '';
  }

  const params = chart.params as Record<string, unknown> | undefined;
  const fromParams = String(params?.database_name ?? params?.database ?? '').trim();
  if (fromParams) return fromParams;

  return '';
}

export function resolveChartDatabaseName(
  chartInit: AnalyticsStudioChartInit,
  chart: AnalyticsStudioChartRecord,
): string | undefined {
  const direct =
    chartInit.databaseName?.trim() || resolveAnalyticsStudioDatabaseName(chart);
  if (direct) return direct;

  const metaValues = chartInit.sourceMetaByName
    ? Object.values(chartInit.sourceMetaByName)
    : [];
  const fromMeta = metaValues
    .map((entry) => entry?.databaseName?.trim())
    .find(Boolean);
  if (fromMeta) return fromMeta;

  return undefined;
}

export function resolveAnalyticsStudioFetchType(
  chart: AnalyticsStudioChartRecord,
): 'table' | 'query' {
  return chart.params?.fetch_type === 'query' ? 'query' : 'table';
}

export async function buildAnalyticsStudioChartInitFromChart(
  chart: AnalyticsStudioChartRecord,
  nodeIdHint?: string,
): Promise<AnalyticsStudioChartInit> {
  const connectionId = String(chart.connection_id ?? '').trim();
  const databaseName = resolveAnalyticsStudioDatabaseName(chart);
  const fetchType = resolveAnalyticsStudioFetchType(chart);
  const connectionType =
    String(chart.connection_type ?? '').trim() ||
    resolveAnalyticsStudioConnectionType(nodeIdHint ?? '');
  const flowId = String(chart.flow_id ?? '');

  if (!connectionId) {
    throw new Error('Chart is missing connection_id');
  }

  const resolvedDatabaseName = databaseName || '';

  if (fetchType === 'query') {
    const query = String(chart.params?.query ?? '').trim();
    if (!query) {
      throw new Error('Chart query is missing');
    }

    const response = await getAnalyticsStudioDatabaseColumns({
      flow_id: flowId,
      source_type: 'database',
      connection_id: connectionId,
      database_name: resolvedDatabaseName,
      params: {
        fetch_type: 'query',
        query,
      },
    });

    if (!response.status || !Array.isArray(response.data) || response.data.length === 0) {
      throw new Error('No columns returned for the query');
    }

    const formattedSources: Source[] = response.data.map((item, index) => ({
      name: item.file_name?.trim() || `Query Result ${index + 1}`,
      columns: Array.isArray(item.columns) ? item.columns : [],
    }));

    const desiredSource = chart.params?.source?.trim();
    const selectedSource =
      desiredSource && formattedSources.some((s) => s.name === desiredSource)
        ? desiredSource
        : formattedSources[0]?.name;

    return {
      flowId,
      sources: formattedSources,
      selectedSource,
      sourceType: 'database',
      fetchType: 'query',
      connectionId,
      databaseName: resolvedDatabaseName,
      connectionType,
      query,
    };
  }

  const schema = String(chart.schema_name ?? 'public').trim();
  const table = String(chart.table_name ?? chart.params?.source ?? '').trim();
  if (!table) {
    throw new Error('Chart table_name is missing');
  }

  const response = await getAnalyticsStudioDatabaseColumns({
    flow_id: flowId,
    source_type: 'database',
    connection_id: connectionId,
    database_name: resolvedDatabaseName,
    schema_name: schema,
    table_name: table,
    params: { fetch_type: 'table' },
  });

  if (!response.status || !Array.isArray(response.data) || response.data.length === 0) {
    throw new Error('No columns returned for the selected table');
  }

  const sourceMetaByName: AnalyticsStudioChartInit['sourceMetaByName'] = {};
  const formattedSources: Source[] = [];

  response.data.forEach((item, index) => {
    const name = formatSourceName(schema, table, item.file_name);
    const uniqueName =
      formattedSources.some((source) => source.name === name) && index > 0
        ? `${name} (${schema})`
        : name;

    formattedSources.push({
      name: uniqueName,
      columns: Array.isArray(item.columns) ? item.columns : [],
    });

    const meta = {
      schema,
      table,
      connectionId,
      databaseName: resolvedDatabaseName,
    };

    sourceMetaByName[uniqueName] = meta;
    if (table) {
      sourceMetaByName[table] = meta;
    }
    if (name !== uniqueName) {
      sourceMetaByName[name] = meta;
    }
  });

  const desiredSource = chart.params?.source?.trim();
  let selectedSource = formattedSources[0]?.name;
  if (desiredSource) {
    const matched = formattedSources.find(
      (source) =>
        source.name === desiredSource ||
        source.name.endsWith(`.${desiredSource}`) ||
        source.name === formatSourceName(schema, table, desiredSource),
    );
    if (matched) {
      selectedSource = matched.name;
    }
  }

  return {
    flowId,
    sources: formattedSources,
    selectedSource,
    sourceType: 'database',
    fetchType: 'table',
    connectionId,
    databaseName: resolvedDatabaseName,
    connectionType,
    sourceMetaByName,
  };
}
