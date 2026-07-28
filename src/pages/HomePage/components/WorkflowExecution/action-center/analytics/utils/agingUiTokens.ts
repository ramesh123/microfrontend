/** Shared visual tokens for the Aging analytics dashboard. */
export const AGING_METRIC_COLORS = {
  matched: '#059669',
  unmatched: '#e11d48',
  reversal: '#d97706',
  matchedRate: '#7c3aed',
  unmatchedRate: '#ea580c',
} as const;

export const agingCardSurface =
  'overflow-hidden rounded-xl border border-border/45 bg-card shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.04]';

export const agingCardHeader =
  'shrink-0 flex flex-row items-center gap-2.5 border-b border-border/35 bg-gradient-to-b from-muted/30 via-muted/10 to-transparent px-3.5 py-2.5 space-y-0';

export const agingCardTitle =
  'text-[13px] font-semibold leading-tight tracking-tight text-foreground';

export const agingCardSubtitle =
  'text-[10px] font-medium leading-tight text-foreground/70';

export const agingIconBadge =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/[0.07] text-primary ring-1 ring-primary/10';

export const agingKpiLabel =
  'text-[10px] font-medium uppercase tracking-[0.05em]';

export const agingKpiValue =
  'mt-1 text-base font-bold tabular-nums tracking-tight leading-none sm:text-medium';

export const agingDateLabel =
  'truncate text-[11px] font-medium text-foreground/85';

export const agingScaleLabel =
  'text-right text-[10px] font-medium tabular-nums text-foreground/60';

export const agingValueLabel =
  'text-[11px] font-semibold tabular-nums tracking-tight text-foreground';

export const agingEmptyState = 'text-xs font-medium text-muted-foreground/75';

export const agingSectionGap = 'gap-3';

/** Count + match-rate trend cards in the aging grid (shared height). */
export const AGING_TWIN_TREND_CHART_HEIGHT = 220;

/** Horizontal bar trend cards: show this many rows before scrolling. */
export const AGING_HORIZONTAL_TREND_MAX_VISIBLE_BARS = 4;

const AGING_HORIZONTAL_TREND_ROW_HEIGHT_PX = 30;
const AGING_HORIZONTAL_TREND_ROW_GAP_PX = 2;

export function agingHorizontalTrendScrollMaxHeight(
  maxVisibleBars: number = AGING_HORIZONTAL_TREND_MAX_VISIBLE_BARS,
): number {
  return (
    maxVisibleBars * AGING_HORIZONTAL_TREND_ROW_HEIGHT_PX +
    Math.max(0, maxVisibleBars - 1) * AGING_HORIZONTAL_TREND_ROW_GAP_PX
  );
}

export function agingBarGradient(color: string): string {
  return `linear-gradient(180deg, color-mix(in srgb, ${color} 62%, white) 0%, ${color} 50%, color-mix(in srgb, ${color} 82%, black) 100%)`;
}

export const agingBarTrack =
  'relative h-[22px] min-w-0 rounded-full bg-muted/35 shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-border/25 dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]';

export const agingTrendRow =
  'grid grid-cols-[minmax(6rem,auto)_minmax(0,1fr)] items-center gap-2.5 rounded-lg px-1 py-1 transition-colors hover:bg-muted/25';
