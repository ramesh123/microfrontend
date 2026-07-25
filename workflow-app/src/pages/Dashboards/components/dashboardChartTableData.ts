export type DashboardChartViewMode = 'chart' | 'table' | 'sql' | 'details';

export function getDashboardChartTableRows(
  chartData?: any[],
  rawResponse?: { data?: any[] } | any,
): Record<string, unknown>[] {
  if (rawResponse?.data && Array.isArray(rawResponse.data)) {
    return rawResponse.data;
  }
  if (!Array.isArray(chartData) || chartData.length === 0) return [];
  return chartData.map((row) => {
    if (row?.originalData && typeof row.originalData === 'object' && !Array.isArray(row.originalData)) {
      return row.originalData as Record<string, unknown>;
    }
    return row as Record<string, unknown>;
  });
}

export function dashboardChartHasTableData(
  chartData?: any[],
  rawResponse?: { data?: any[] } | any,
): boolean {
  return getDashboardChartTableRows(chartData, rawResponse).length > 0;
}
