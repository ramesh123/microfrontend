import { BookOpen, Database, Hash, Lightbulb, Table2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ChartDetail } from "./chartTypes";

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(n);
}

function humanizeChartType(raw: string): string {
  const s = raw.replace(/_/g, " ").trim();
  if (!s) return "Chart";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Rich “Insight” tab: key takeaway, narrative, optional stats + context chips.
 */
export function ChartDetailInfoTabContent({
  detail,
  compact,
}: {
  detail: ChartDetail;
  /** Tighter scroll region for inline dashboard cards */
  compact?: boolean;
}) {
  const scrollClass = compact
    ? "max-h-[min(260px,40vh)]"
    : "max-h-[min(68vh,720px)]";

  const insight = detail.insight_text?.trim();
  const narrative = detail.narrative_text?.trim();
  const legacySummary = detail.narrative?.summary?.trim();

  const stats = detail.stats;
  const rowCount =
    stats?.count ??
    (Array.isArray(detail.chart_data) ? detail.chart_data.length : undefined);

  const metaItems: { key: string; label: string; value: string; icon: typeof Database }[] = [];
  if (detail.metric_name?.trim()) {
    metaItems.push({
      key: "metric",
      label: "Metric",
      value: detail.metric_name.trim(),
      icon: Hash,
    });
  }
  if (detail.table?.trim()) {
    metaItems.push({
      key: "table",
      label: "Table",
      value: detail.table.trim(),
      icon: Database,
    });
  }
  if (detail.intent?.trim()) {
    metaItems.push({
      key: "intent",
      label: "Intent",
      value: detail.intent.trim(),
      icon: BookOpen,
    });
  }
  if (detail.category_column?.trim()) {
    metaItems.push({
      key: "category",
      label: "Category",
      value: detail.category_column.trim(),
      icon: Table2,
    });
  }

  const statEntries: { label: string; value: number }[] = [];
  if (stats) {
    if (typeof stats.count === "number") statEntries.push({ label: "Count", value: stats.count });
    if (typeof stats.total === "number") statEntries.push({ label: "Total", value: stats.total });
    if (typeof stats.avg === "number") statEntries.push({ label: "Avg", value: stats.avg });
    if (typeof stats.min === "number") statEntries.push({ label: "Min", value: stats.min });
    if (typeof stats.max === "number") statEntries.push({ label: "Max", value: stats.max });
  }

  const hasProse = !!(insight || narrative || legacySummary);
  const hasStatsTiles = statEntries.length > 0;
  const hasMeta = metaItems.length > 0;
  const hasSnapshot =
    !!(detail.chart_type || detail.title || rowCount !== undefined);

  const showEmptyFallback =
    !hasProse && !hasStatsTiles && !hasMeta && !hasSnapshot;

  return (
    <div
      className={cn(
        "space-y-3 overflow-y-auto pr-0.5",
        scrollClass,
        compact ? "text-[11px] leading-snug" : "text-xs leading-relaxed",
      )}
    >

      {hasStatsTiles ? (
        <div>
          <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
            Numbers
          </p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {statEntries.map(({ label, value }) => (
              <div
                key={label}
                className="rounded-md border border-border/45 bg-card/80 px-2 py-1.5 text-center shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] dark:shadow-none"
              >
                <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                  {label}
                </p>
                <p className="mt-0.5 tabular-nums text-sm font-semibold text-foreground">
                  {formatNumber(value)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {legacySummary && !narrative ? (
        <div className="rounded-lg border border-dashed border-border/60 bg-muted/15 px-2.5 py-2">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
            Summary
          </p>
          <p className="mt-1 text-[11px] text-foreground">{legacySummary}</p>
        </div>
      ) : null}

      {insight ? (
        <div className="relative overflow-hidden rounded-lg border border-primary/25 bg-primary/[0.06] p-3 shadow-sm ring-1 ring-primary/10 dark:bg-primary/10 dark:ring-primary/20">
          <div className="absolute -right-6 -top-6 size-20 rounded-full bg-primary/10 blur-2xl" aria-hidden />
          <div className="relative flex gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Lightbulb className="size-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-primary">
                Key insight
              </p>
              <p className="mt-1 text-[11px] font-medium text-foreground">{insight}</p>
            </div>
          </div>
        </div>
      ) : null}

      {narrative ? (
        <div className="rounded-lg border border-border/50 bg-card p-3 shadow-sm">
          <div className="flex gap-2">
            <BookOpen
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                Narrative
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[11px] text-foreground/95">
                {narrative}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {showEmptyFallback ? (
        <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 px-3 py-6 text-center">
          <p className="text-[11px] font-medium text-muted-foreground">
            No insight or narrative for this chart yet.
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground/80">
            Switch to the SQL tab to see the query, or explore the chart and table tabs.
          </p>
        </div>
      ) : null}
    </div>
  );
}
