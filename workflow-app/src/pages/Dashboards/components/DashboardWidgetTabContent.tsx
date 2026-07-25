import type { Chart } from '../types';
import type { DashboardChartViewMode } from './dashboardChartTableData';
import { TableChart } from '@/pages/charts/components/charts/table';

function readSqlCandidate(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

export function getDashboardChartSql(chart: Chart, rawResponse?: { sql?: string } | null): string {
  const params = chart.params ?? {};
  return (
    readSqlCandidate(params.sql) ||
    readSqlCandidate(params.query) ||
    readSqlCandidate(params.generated_sql) ||
    readSqlCandidate(rawResponse?.sql) ||
    readSqlCandidate((chart as { sql?: string }).sql)
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value?.trim()) return null;
  return (
    <div className="flex items-baseline gap-1 text-xs">
      <span className="shrink-0 text-muted-foreground">{label}:</span>
      <span className="min-w-0 truncate font-medium text-foreground" title={value}>
        {value}
      </span>
    </div>
  );
}

export function DashboardWidgetSqlTab({ sql }: { sql: string }) {
  const displaySql = sql.trim() || 'No SQL available for this chart.';
  return (
    <div className="h-full min-h-0 overflow-auto rounded-md border border-border/50 bg-muted/10 p-2">
      <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-foreground">
        {displaySql}
      </pre>
    </div>
  );
}

export function DashboardWidgetDetailsTab({ chart }: { chart: Chart }) {
  const viz = chart.visualization_name || chart.chart_type || 'Chart';
  const metrics = chart.params?.metrics ?? chart.params?.metric;
  const dimensions = chart.params?.dimensions ?? chart.params?.['X-axis'] ?? chart.params?.['x-axis'];
  const metricLabels = Array.isArray(metrics)
    ? metrics
        .map((m: { alias?: string; columns?: string; column?: string; name?: string } | string) =>
          typeof m === 'string' ? m : m.alias || m.columns || m.column || m.name,
        )
        .filter(Boolean)
        .join(', ')
    : '';
  const dimensionLabels = Array.isArray(dimensions)
    ? dimensions
        .map((d: { alias?: string; columns?: string; column?: string; name?: string } | string) =>
          typeof d === 'string' ? d : d.alias || d.columns || d.column || d.name,
        )
        .filter(Boolean)
        .join(', ')
    : typeof dimensions === 'string'
      ? dimensions
      : '';

  return (
    <div className="h-full min-h-0 overflow-auto rounded-md border border-border/50 bg-muted/10 p-2.5 space-y-2">
      <DetailRow label="Chart" value={chart.chart_name} />
      <DetailRow label="Visualization" value={viz} />
      <DetailRow label="Description" value={chart.description} />
      <DetailRow label="Table" value={chart.table_name} />
      <DetailRow label="Database" value={chart.database_name || chart.database} />
      <DetailRow label="Dimensions" value={dimensionLabels} />
      <DetailRow label="Metrics" value={metricLabels} />
      <DetailRow label="Statement date" value={chart.stmt_date} />
      {!chart.chart_name &&
      !chart.description &&
      !chart.table_name &&
      !metricLabels &&
      !dimensionLabels ? (
        <p className="text-xs text-muted-foreground">No additional details available for this chart.</p>
      ) : null}
    </div>
  );
}

export function getDashboardWidgetExpandTooltip(viewMode: DashboardChartViewMode): string {
  switch (viewMode) {
    case 'table':
      return 'Expand table';
    case 'sql':
      return 'Expand SQL';
    case 'details':
      return 'Expand details';
    default:
      return 'Expand chart';
  }
}

export function DashboardWidgetPanel({
  contentView,
  chartTitle,
  tableRows,
  chartSql,
  chart,
  chartPanel,
}: {
  contentView: DashboardChartViewMode;
  chartTitle: string;
  tableRows: Record<string, unknown>[];
  chartSql: string;
  chart: Chart;
  chartPanel: React.ReactNode;
}) {
  if (contentView === 'table') {
    return <DashboardWidgetTableTab rows={tableRows} chartTitle={chartTitle} />;
  }
  if (contentView === 'sql') {
    return <DashboardWidgetSqlTab sql={chartSql} />;
  }
  if (contentView === 'details') {
    return <DashboardWidgetDetailsTab chart={chart} />;
  }
  return <>{chartPanel}</>;
}

export function DashboardWidgetTableTab({
  rows,
  chartTitle,
}: {
  rows: Record<string, unknown>[];
  chartTitle?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No data available
      </div>
    );
  }
  return <TableChart data={rows} hideTitle compact chartName={chartTitle} />;
}
