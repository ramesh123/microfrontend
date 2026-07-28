import type { CreateChartPayload, UpdateChartPayload } from '@/pages/Visualization/API/chartsApi';
import type { AnalyticsStudioUniqueValuesPayload } from '@/pages/Visualization/API/chartsApi';
import type { AnalyticsStudioChartInit, AnalyticsStudioSourceMeta } from '@/pages/charts/ChartFormulator/types';
import {
  resolveAnalyticsStudioDatabaseName,
  resolveAnalyticsStudioFetchType,
  type AnalyticsStudioChartRecord,
} from './analyticsStudioChartUtils';

const UNIQUE_VALUES_LIMIT = 100_000;

function normalizeSourceKey(value?: string | null): string {
  return String(value ?? '').trim().toLowerCase();
}

function resolveAnalyticsStudioSourceMeta(
  init: AnalyticsStudioChartInit,
  selectedSource: string | null,
): AnalyticsStudioSourceMeta | undefined {
  const entries = Object.entries(init.sourceMetaByName ?? {});
  if (entries.length === 0) return undefined;

  if (selectedSource) {
    const direct = init.sourceMetaByName?.[selectedSource];
    if (direct) return direct;

    const normalizedSelected = normalizeSourceKey(selectedSource);
    const matched = entries.find(([name, meta]) => {
      const normalizedName = normalizeSourceKey(name);
      const normalizedTable = normalizeSourceKey(meta.table);
      return (
        normalizedName === normalizedSelected ||
        normalizedName.endsWith(`.${normalizedSelected}`) ||
        normalizedTable === normalizedSelected
      );
    });
    if (matched) return matched[1];
  }

  return entries[0]?.[1];
}

function databaseSourceBase(init: AnalyticsStudioChartInit) {
  return {
    source_type: 'database' as const,
    connection_type: init.connectionType ?? 'postgresql',
  };
}

function hasAnalyticsStudioTableSourceMeta(init: AnalyticsStudioChartInit): boolean {
  if (!init.sourceMetaByName) return false;
  return Object.values(init.sourceMetaByName).some(
    (meta) => !!meta?.schema?.trim() && !!meta?.table?.trim() && !!meta?.connectionId,
  );
}

export function isAnalyticsStudioDatabaseMode(init?: AnalyticsStudioChartInit): boolean {
  if (init?.sourceType !== 'database' || !init.connectionId) return false;
  if (init.fetchType === 'query') return !!init.query?.trim();
  return hasAnalyticsStudioTableSourceMeta(init);
}

export function canGenerateAnalyticsStudioChart(init?: AnalyticsStudioChartInit): boolean {
  if (!init) return false;
  if (init.sourceType === 'virtual_db') return !!init.flowId?.trim();
  return isAnalyticsStudioDatabaseMode(init);
}

export function buildAnalyticsStudioInitFromChartRecord(
  chart: AnalyticsStudioChartRecord,
  selectedSource?: string | null,
): AnalyticsStudioChartInit | null {
  if (chart.source_type !== 'database' || chart.connection_id == null || chart.connection_id === '') {
    return null;
  }

  const fetchType = resolveAnalyticsStudioFetchType(chart);
  const connectionId = String(chart.connection_id);
  const databaseName = resolveAnalyticsStudioDatabaseName(chart);
  const schema = String(chart.schema_name ?? 'public').trim();
  const table = String(chart.table_name ?? chart.params?.source ?? '').trim();
  const sourceMetaByName: Record<string, AnalyticsStudioSourceMeta> = {};

  if (fetchType === 'table' && table) {
    const meta: AnalyticsStudioSourceMeta = {
      schema,
      table,
      connectionId,
      databaseName,
    };
    sourceMetaByName[table] = meta;
    const savedSource = chart.params?.source ? String(chart.params.source) : '';
    if (savedSource) sourceMetaByName[savedSource] = meta;
    if (selectedSource) sourceMetaByName[selectedSource] = meta;
  }

  return {
    flowId: String(chart.flow_id ?? ''),
    sources: [],
    sourceType: 'database',
    fetchType,
    connectionId,
    databaseName,
    connectionType: String(chart.connection_type ?? 'postgresql'),
    query: chart.params?.query ? String(chart.params.query) : undefined,
    sourceMetaByName,
  };
}

export function applyAnalyticsStudioPayloadForSavedChart(
  payload: CreateChartPayload | UpdateChartPayload,
  chart: AnalyticsStudioChartRecord,
  selectedSource: string | null,
  init?: AnalyticsStudioChartInit | null,
): CreateChartPayload | UpdateChartPayload {
  const effectiveInit =
    init ??
    (chart.source_type === 'database'
      ? buildAnalyticsStudioInitFromChartRecord(chart, selectedSource)
      : null);
  if (!effectiveInit) return payload;
  return applyAnalyticsStudioChartPayload(payload, effectiveInit, selectedSource);
}

export function applyAnalyticsStudioChartPayload(
  payload: CreateChartPayload | UpdateChartPayload,
  init: AnalyticsStudioChartInit,
  selectedSource: string | null,
): CreateChartPayload | UpdateChartPayload {
  if (init.sourceType === 'virtual_db') {
    return {
      ...payload,
      flow_id: init.flowId || payload.flow_id || '',
      source_type: 'virtual_db',
      params: {
        ...payload.params,
      },
    } as unknown as CreateChartPayload | UpdateChartPayload;
  }

  if (init.sourceType !== 'database') return payload;

  const base = databaseSourceBase(init);

  if (init.fetchType === 'query' && init.query?.trim()) {
    return {
      ...payload,
      flow_id: payload.flow_id ?? '',
      ...base,
      connection_id: init.connectionId,
      database_name: init.databaseName,
      params: {
        ...payload.params,
        fetch_type: 'query',
        query: init.query.trim(),
      },
    } as unknown as CreateChartPayload | UpdateChartPayload;
  }

  const meta = resolveAnalyticsStudioSourceMeta(init, selectedSource);
  if (!meta) return payload;

  return {
    ...payload,
    flow_id: payload.flow_id ?? '',
    ...base,
    connection_id: meta.connectionId,
    database_name: meta.databaseName,
    schema_name: meta.schema,
    table_name: meta.table,
    params: {
      ...payload.params,
      fetch_type: 'table',
    },
  } as unknown as CreateChartPayload | UpdateChartPayload;
}

export function buildAnalyticsStudioUniqueValuesPayload(
  init: AnalyticsStudioChartInit,
  selectedSource: string | null,
  column: string,
): AnalyticsStudioUniqueValuesPayload | null {
  if (init.sourceType !== 'database' || !init.connectionId) return null;

  if (init.fetchType === 'query' && init.query?.trim()) {
    return {
      flow_id: init.flowId ?? '',
      source_type: 'database',
      connection_id: init.connectionId,
      database_name: init.databaseName,
      column,
      params: {
        fetch_type: 'query',
        query: init.query.trim(),
        limit: UNIQUE_VALUES_LIMIT,
      },
    };
  }

  const meta = resolveAnalyticsStudioSourceMeta(init, selectedSource);
  if (!meta) return null;

  return {
    flow_id: init.flowId ?? '',
    source_type: 'database',
    connection_id: meta.connectionId,
    database_name: meta.databaseName,
    schema_name: meta.schema,
    table_name: meta.table,
    column,
    params: {
      fetch_type: 'table',
      limit: UNIQUE_VALUES_LIMIT,
    },
  };
}
