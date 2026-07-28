import type { ChartDetail } from '@/pages/ExploratoryAnalysis/AgenticSemantics/chartTypes';

/** Chart titles hidden from data-quality dashboard display only (still on server). */
export const DATA_QUALITY_HIDDEN_CHART_TITLES = [
  'Executive Summary',
  'Publish Readiness',
  'Stage Waterfall',
  'Final Dataset Quality',
] as const;

/** Pinned display order for visible data-quality charts (others keep API order). */
export const DATA_QUALITY_PINNED_CHART_ORDER = [
  'Columns with Highest Missingness',
  'Data Trust Score by Table',
] as const;

const HIDDEN_TITLE_SET = new Set(
  DATA_QUALITY_HIDDEN_CHART_TITLES.map((t) => t.trim().toLowerCase()),
);

const PINNED_TITLE_ORDER = DATA_QUALITY_PINNED_CHART_ORDER.map((t) => t.trim().toLowerCase());

function chartDisplayLabel(detail: Pick<ChartDetail, 'title' | 'metric_name'>): string {
  return String(detail.title ?? detail.metric_name ?? '').trim().toLowerCase();
}

export function isDataQualityHiddenChart(detail: Pick<ChartDetail, 'title' | 'metric_name'>): boolean {
  const label = chartDisplayLabel(detail);
  return label !== '' && HIDDEN_TITLE_SET.has(label);
}

function sortDataQualityVisibleCharts(
  details: ChartDetail[],
  slotIds: string[],
): { details: ChartDetail[]; slotIds: string[] } {
  const pairs = details.map((detail, i) => ({
    detail,
    slotId: slotIds[i] ?? detail.chart_id,
    originalIndex: i,
  }));

  const pinnedRank = (detail: ChartDetail): number => {
    const idx = PINNED_TITLE_ORDER.indexOf(chartDisplayLabel(detail));
    return idx >= 0 ? idx : PINNED_TITLE_ORDER.length;
  };

  pairs.sort((a, b) => {
    const rankDiff = pinnedRank(a.detail) - pinnedRank(b.detail);
    if (rankDiff !== 0) return rankDiff;
    return a.originalIndex - b.originalIndex;
  });

  return {
    details: pairs.map((p) => p.detail),
    slotIds: pairs.map((p) => p.slotId),
  };
}

export function filterHiddenDataQualityCharts(
  details: ChartDetail[],
  slotIds: string[],
): { details: ChartDetail[]; slotIds: string[] } {
  const pairs = details
    .map((detail, i) => ({ detail, slotId: slotIds[i] ?? detail.chart_id }))
    .filter(({ detail }) => !isDataQualityHiddenChart(detail));
  return sortDataQualityVisibleCharts(
    pairs.map((p) => p.detail),
    pairs.map((p) => p.slotId),
  );
}
