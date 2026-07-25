/** Pie, donut, and variable-radius (Nightingale) pie chart types. */
export function isPieDonutOrRadiusPieChart(vizName?: string): boolean {
  const v = (vizName || '').toString().toLowerCase().trim();
  if (!v) return false;
  if (isRadiusPieChart(v)) return true;
  if (v.includes('donut') || v.includes('doughnut')) return true;
  if (v.includes('pie')) return true;
  return v === 'pie' || v === 'donut' || v === 'doughnut';
}

export function isRadiusPieChart(vizName?: string): boolean {
  const v = (vizName || '').toString().toLowerCase().trim();
  return /radius[_\s-]*pie|rad_pie|radius_pie/.test(v);
}

export function isDonutChartType(vizName?: string): boolean {
  const v = (vizName || '').toString().toLowerCase().trim();
  if (!v || isRadiusPieChart(v)) return false;
  return v === 'donut chart' || v.includes('donut') || v.includes('doughnut');
}

function countPositivePieSlices(
  rows: Array<{ category: string; value: number; originalData?: any }>,
): number {
  return rows.filter((row) => Number.isFinite(Number(row.value)) && Number(row.value) > 0).length;
}

/** Pick the normalized pie dataset with the most non-zero slices. */
export function pickBestPieLikeChartRows(
  candidates: Array<Array<{ category: string; value: number; originalData: any }>>,
): Array<{ category: string; value: number; originalData: any }> {
  if (candidates.length === 0) return [];
  const ranked = [...candidates].sort((a, b) => {
    const positiveDiff = countPositivePieSlices(b) - countPositivePieSlices(a);
    if (positiveDiff !== 0) return positiveDiff;
    return b.length - a.length;
  });
  return ranked[0] ?? [];
}

/** Normalize createChart API payloads into a row array. */
export function extractDashboardChartResponseRows(resp: any): any[] {
  if (!resp) return [];
  if (Array.isArray(resp)) return resp;
  if (Array.isArray(resp.data)) return resp.data;
  if (resp.data && Array.isArray(resp.data.data)) return resp.data.data;
  if (resp.payload && Array.isArray(resp.payload.data)) return resp.payload.data;
  return [];
}

export function isCategoryValuePieRow(row: unknown): row is { category: string; value: number; originalData?: any } {
  return !!row && typeof row === 'object' && 'category' in row && 'value' in row;
}

/** Normalize API rows into `{ category, value, originalData }` for pie / donut / radius pie. */
export function normalizePieLikeChartRows(
  rows: any[],
  columns?: string[],
): Array<{ category: string; value: number; originalData: any }> {
  const dataRows = Array.isArray(rows) ? rows : [];
  if (dataRows.length === 0) return [];

  if (isCategoryValuePieRow(dataRows[0])) {
    return dataRows.map((item: any) => ({
      category: String(item.category ?? 'Unknown'),
      value: item.value === null || item.value === undefined ? 0 : Number(item.value) || 0,
      originalData: item.originalData ?? item,
    }));
  }

  const sample = dataRows.slice(0, 10);
  const keys = sample.length > 0 ? Object.keys(sample[0]) : (columns && columns.length > 0 ? columns : []);

  const hasAggregationPattern = (key: string) => {
    if (!key) return false;
    const upper = String(key).toUpperCase();
    return (
      /\((SUM|COUNT|AVG|MIN|MAX|STDDEV|VARIANCE)\)/i.test(upper) ||
      /^(SUM|COUNT|AVG|MIN|MAX|STDDEV|VARIANCE)\(/i.test(upper) ||
      /_(SUM|COUNT|AVG|MIN|MAX|STDDEV|VARIANCE)$/i.test(upper) ||
      /(SUM|COUNT|AVG|MIN|MAX|STDDEV|VARIANCE)$/i.test(upper) ||
      /\b(AMOUNT|TOTAL|VALUE|COUNT|SUM)\b/i.test(upper)
    );
  };

  const numericCounts: Record<string, number> = {};
  keys.forEach((k) => {
    numericCounts[k] = 0;
  });
  sample.forEach((row: any) => {
    keys.forEach((k) => {
      const val = row && row[k];
      if (val === null || val === undefined) return;
      if (typeof val === 'number') numericCounts[k] += 1;
      else if (!isNaN(Number(val))) numericCounts[k] += 1;
    });
  });

  let valueKey = keys.find((k) => hasAggregationPattern(k));
  if (!valueKey) {
    let bestKey = '';
    let bestCount = -1;
    keys.forEach((k) => {
      if ((numericCounts[k] || 0) > bestCount) {
        bestCount = numericCounts[k] || 0;
        bestKey = k;
      }
    });
    valueKey = bestKey || keys[1] || keys[0];
  }

  const categoryKeys = keys.filter((k) => k !== valueKey);

  return dataRows.map((item: any) => {
    const category =
      categoryKeys.length > 0
        ? categoryKeys
            .map((k) => String(item && item[k] !== undefined && item[k] !== null ? item[k] : ''))
            .join(', ')
            .trim() || 'Unknown'
        : item && item[valueKey] !== undefined && item[valueKey] !== null
          ? String(item[valueKey])
          : 'Item';

    const rawVal = item && item[valueKey];
    const value = rawVal === null || rawVal === undefined ? 0 : Number(rawVal) || 0;

    return { category, value, originalData: item };
  });
}
