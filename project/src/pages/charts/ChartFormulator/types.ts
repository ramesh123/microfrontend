import type { Field } from '../components/ChartConfigurator';
import type { Source } from '../components/DataFieldsSidebar';

export type Thread = {
  id: string;
  name: string;
  data: any[];
  columns: any[];
  fields: Field[];
};

export type AnalyticsStudioSourceMeta = {
  schema: string;
  table: string;
  connectionId: string;
  databaseName: string;
};

export type AnalyticsStudioChartInit = {
  sources: Source[];
  flowId: string;
  selectedSource?: string;
  sourceType?: 'database' | 'virtual_db';
  fetchType?: 'table' | 'query';
  connectionId?: string;
  databaseName?: string;
  connectionType?: string;
  query?: string;
  sourceMetaByName?: Record<string, AnalyticsStudioSourceMeta>;
};

export type ChartFormulatorProps = {
  upstreamNodes?: any[];
  analyticsStudioInit?: AnalyticsStudioChartInit;
  /** Render inside dashboard builder sheet instead of a dedicated route. */
  embedded?: boolean;
  embeddedChartId?: string | number;
  embeddedFlowId?: string;
  onEmbeddedClose?: () => void;
  /** Fired when chart is successfully updated while embedded in dashboard editor. */
  onEmbeddedChartUpdated?: () => void;
};

export function inferType(value: string): 'string' | 'number' | 'date' {
  if (value === null || value === undefined || value.trim() === '')
    return 'string';
  if (!isNaN(Number(value)) && value.trim() !== '') return 'number';
  if (!isNaN(Date.parse(value))) return 'date';
  return 'string';
}
