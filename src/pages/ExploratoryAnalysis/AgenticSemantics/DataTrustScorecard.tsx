import React, { useMemo } from "react";
import { AlertTriangle, CircleAlert, Columns3, Rows3 } from "lucide-react";
import type { ChartDetail } from "./chartTypes";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const SCORECARD_KEYS = new Set(["data_trust_scorecard"]);

/** Fields rendered as dimension / footer, not as score bars. */
const NON_BAR_FIELDS = new Set(["table_name", "row_count"]);

function isScorecardChartKey(detail: ChartDetail): boolean {
  const id = String(detail.chart_id ?? "").toLowerCase().trim();
  if (SCORECARD_KEYS.has(id)) return true;
  const ck = String(
    (detail.chart_payload as { chart_key?: unknown } | undefined)?.chart_key ?? "",
  )
    .toLowerCase()
    .trim();
  return SCORECARD_KEYS.has(ck);
}

export function chartDetailUsesDataTrustScorecard(detail: ChartDetail): boolean {
  if (!isScorecardChartKey(detail)) return false;
  const ct = String(detail.chart_type ?? "").toLowerCase();
  if (!ct.includes("horizontal_bar")) return false;
  const row = detail.chart_data?.[0] as Record<string, unknown> | undefined;
  return !!row && typeof row.table_name === "string" && typeof row.trust_score === "number";
}

function numOrUndef(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function formatCount(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

function formatScore(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}

type BarSpec = { field: string; label: string; value: number };

/** Vertical gloss layered on every fill so new scorecard bars get the same “shine” treatment. */
const BAR_SHINE_OVERLAY =
  "linear-gradient(180deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.1) 36%, rgba(0,0,0,0.06) 100%)";

type BarTheme = { baseGradient: string; trackColor: string };

function scorecardBarCategory(field: string, value: number): keyof typeof BAR_THEMES {
  const f = field.toLowerCase();
  if (f === "trust_score") return "trust";
  if (f.includes("completeness")) return "completeness";
  if (f.includes("validity")) return "validity";
  if (f.includes("referential")) return "referential";
  if (f.includes("freshness")) return "freshness";
  if (f.includes("duplicate")) return "duplicate";
  if (value >= 85) return "tier_high";
  if (value >= 60) return "tier_mid";
  return "tier_low";
}

/** Premium fills: 90deg body + lighter “shine” band mid-bar; tracks are soft tints of the same hue. */
const BAR_THEMES = {
  trust: {
    baseGradient:
      "linear-gradient(90deg, #4f46e5 0%, #7c3aed 38%, #a78bfa 52%, #6366f1 72%, #22d3ee 100%)",
    trackColor: "rgba(99, 102, 241, 0.14)",
  },
  completeness: {
    baseGradient:
      "linear-gradient(90deg, #047857 0%, #059669 32%, #34d399 50%, #10b981 70%, #065f46 100%)",
    trackColor: "rgba(16, 185, 129, 0.14)",
  },
  validity: {
    baseGradient:
      "linear-gradient(90deg, #b45309 0%, #d97706 30%, #fbbf24 48%, #f59e0b 68%, #92400e 100%)",
    trackColor: "rgba(245, 158, 11, 0.16)",
  },
  referential: {
    baseGradient:
      "linear-gradient(90deg, #0f766e 0%, #14b8a6 34%, #5eead4 50%, #2dd4bf 72%, #115e59 100%)",
    trackColor: "rgba(20, 184, 166, 0.14)",
  },
  freshness: {
    baseGradient:
      "linear-gradient(90deg, #0369a1 0%, #0284c7 30%, #38bdf8 50%, #0ea5e9 70%, #075985 100%)",
    trackColor: "rgba(14, 165, 233, 0.14)",
  },
  duplicate: {
    baseGradient:
      "linear-gradient(90deg, #9f1239 0%, #e11d48 28%, #fb7185 50%, #f43f5e 70%, #881337 100%)",
    trackColor: "rgba(244, 63, 94, 0.14)",
  },
  tier_high: {
    baseGradient:
      "linear-gradient(90deg, #166534 0%, #22c55e 35%, #86efac 52%, #4ade80 72%, #14532d 100%)",
    trackColor: "rgba(34, 197, 94, 0.14)",
  },
  tier_mid: {
    baseGradient:
      "linear-gradient(90deg, #a16207 0%, #eab308 32%, #fde047 50%, #facc15 70%, #713f12 100%)",
    trackColor: "rgba(234, 179, 8, 0.16)",
  },
  tier_low: {
    baseGradient:
      "linear-gradient(90deg, #9a3412 0%, #ea580c 30%, #fdba74 50%, #fb923c 72%, #7c2d12 100%)",
    trackColor: "rgba(249, 115, 22, 0.15)",
  },
} as const satisfies Record<string, BarTheme>;

function barFillStyle(field: string, value: number): React.CSSProperties {
  const key = scorecardBarCategory(field, value);
  const { baseGradient } = BAR_THEMES[key];
  return {
    backgroundImage: `${BAR_SHINE_OVERLAY}, ${baseGradient}`,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22)",
  };
}

function barTrackStyle(field: string, value: number): React.CSSProperties {
  const key = scorecardBarCategory(field, value);
  return { backgroundColor: BAR_THEMES[key].trackColor };
}

export function DataTrustScorecardPanel({
  detail,
  compact,
  onDrilldownCategory,
}: {
  detail: ChartDetail;
  compact?: boolean;
  onDrilldownCategory?: (label: string) => void;
}) {
  const row = (detail.chart_data ?? [])[0] as Record<string, unknown> | undefined;
  const payload = detail.chart_payload;
  const summary = (payload?.summary ?? {}) as Record<string, unknown>;

  const displayCols = useMemo(() => {
    const raw = payload?.display_columns;
    if (!Array.isArray(raw)) return [] as { field: string; label: string }[];
    const out: { field: string; label: string }[] = [];
    for (const c of raw) {
      if (!c || typeof (c as { field?: unknown }).field !== "string") continue;
      const field = String((c as { field: string }).field);
      const label =
        typeof (c as { label?: unknown }).label === "string" && (c as { label: string }).label.trim()
          ? (c as { label: string }).label.trim()
          : field.replace(/_/g, " ");
      out.push({ field, label });
    }
    return out;
  }, [payload]);

  const bars = useMemo((): BarSpec[] => {
    if (!row) return [];
    const specs: BarSpec[] = [];
    const seen = new Set<string>();
    const ordered = displayCols.length
      ? displayCols
      : Object.keys(row)
          .filter((k) => !NON_BAR_FIELDS.has(k) && typeof row[k] === "number")
          .map((field) => ({ field, label: field.replace(/_/g, " ") }));

    for (const { field, label } of ordered) {
      if (NON_BAR_FIELDS.has(field)) continue;
      const value = numOrUndef(row[field]);
      if (value == null) continue;
      specs.push({ field, label, value });
      seen.add(field);
    }
    if (specs.length === 0 && row) {
      for (const [field, raw] of Object.entries(row)) {
        if (NON_BAR_FIELDS.has(field) || seen.has(field)) continue;
        const value = numOrUndef(raw);
        if (value == null) continue;
        specs.push({ field, label: field.replace(/_/g, " "), value });
      }
    }
    const trustBar = specs.find((b) => b.field === "trust_score");
    const rest = specs.filter((b) => b.field !== "trust_score");
    return trustBar ? [...rest, { ...trustBar, label: "Overall Trust" }] : rest;
  }, [row, displayCols]);

  const tableName = row ? String(row.table_name ?? "") : "";
  const trustMain =
    numOrUndef(row?.trust_score) ??
    numOrUndef(summary.overall_trust_score) ??
    0;
  const rowCount = numOrUndef(row?.row_count);
  const columnCount =
    numOrUndef(row?.column_count) ??
    numOrUndef(row?.num_columns) ??
    numOrUndef(summary.column_count) ??
    numOrUndef(summary.num_columns);
  const warnings = numOrUndef(summary.warning_issue_count) ?? 0;
  const critical = numOrUndef(summary.critical_issue_count) ?? 0;
  const overallFromSummary = numOrUndef(summary.overall_trust_score);

  if (!row) {
    return (
      <p className="text-[11px] text-muted-foreground px-1.5 py-2">No scorecard row.</p>
    );
  }

  const pad = compact ? "p-1 gap-1" : "p-1.5 gap-1.5";
  const titleSm = compact ? "text-[10px]" : "text-xs";

  return (
    <div
      className={cn(
        "flex h-auto min-h-0 min-w-0 w-full flex-col overflow-visible text-foreground",
        pad,
      )}
    >

      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-col gap-1.5 lg:flex-row lg:items-stretch",
          compact ? "lg:gap-1.5" : "lg:gap-2",
        )}
      >
        <aside
          className={cn(
            "flex shrink-0 flex-col justify-between gap-1.5 rounded-lg border border-border/60 bg-background/35 dark:bg-background/25 lg:min-h-0 lg:self-stretch",
            compact ? "w-full p-2 lg:w-52 lg:max-w-none" : "w-full p-2.5 lg:w-60 lg:max-w-none",
          )}
        >
          <div className="space-y-0.5">
            <p className={cn("font-semibold leading-tight", compact ? "text-sm" : "text-base")}>{tableName}</p>
            <p
              className={cn(
                "bg-gradient-to-r from-indigo-700 via-violet-700 to-cyan-800 bg-clip-text font-semibold tabular-nums tracking-tight text-transparent dark:from-indigo-500 dark:via-violet-500 dark:to-cyan-600",
                compact ? "text-2xl" : "text-4xl",
              )}
            >
              {formatScore(trustMain)}
            </p>
            <p className={cn("text-muted-foreground leading-snug", compact ? "text-[10px]" : "text-xs")}>
              Overall trust score across completeness, validity, referential integrity, freshness, and
              duplicate risk.
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {rowCount != null ? (
              <Badge
                variant="outline"
                className={cn(
                  "gap-1 rounded-full border-border/60 font-medium tabular-nums text-foreground",
                  titleSm,
                )}
              >
                <Rows3 className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                {formatCount(rowCount)} Rows
              </Badge>
            ) : null}
            {columnCount != null ? (
              <Badge
                variant="outline"
                className={cn(
                  "gap-1 rounded-full border-border/60 font-medium tabular-nums text-foreground",
                  titleSm,
                )}
              >
                <Columns3 className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                {formatCount(columnCount)} Columns
              </Badge>
            ) : null}
            <Badge
              variant="outline"
              className={cn(
                "gap-1 rounded-full border-border/60 font-medium tabular-nums text-foreground",
                titleSm,
              )}
            >
              <CircleAlert className="size-3 shrink-0 text-muted-foreground" aria-hidden />
              {formatCount(critical)} Critical
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "gap-1 rounded-full border-border/60 font-medium tabular-nums text-foreground",
                titleSm,
              )}
            >
              <AlertTriangle className="size-3 shrink-0 text-muted-foreground" aria-hidden />
              {formatCount(warnings)} {warnings === 1 ? "Warning" : "Warnings"}
            </Badge>
          </div>
        </aside>

        <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", compact ? "gap-1" : "gap-1.5")}>
          {bars.map(({ field, label, value }) => {
            const widthPct = Math.min(100, Math.max(0, value));
            return (
              <div
                key={field}
                className={cn(
                  "grid min-w-0 items-center rounded-md border border-border/50 bg-background/40 py-1 dark:bg-background/30",
                  !compact && "py-1.5",
                  /** Shared column template: every bar track starts and ends on the same vertical lines. */
                  compact
                    ? "grid-cols-[9.5rem_minmax(0,1fr)_2.75rem] gap-x-0.5 px-1.5"
                    : "grid-cols-[12.5rem_minmax(0,1fr)_3.25rem] gap-x-0.5 px-1.5",
                )}
              >
                <span
                  className={cn(
                    "min-w-0 truncate text-left font-semibold text-foreground/90",
                    compact ? "text-[10px]" : "text-xs",
                  )}
                  title={label}
                >
                  {label}
                </span>
                <div
                  className={cn(
                    "min-h-0 min-w-0 w-full overflow-hidden rounded-full ring-1 ring-inset ring-black/[0.04] dark:ring-white/[0.06]",
                    compact ? "h-2" : "h-2.5",
                  )}
                  style={barTrackStyle(field, value)}
                >
                  <div
                    className="h-full rounded-full transition-[width] duration-500 ease-out"
                    style={{
                      width: `${widthPct}%`,
                      ...barFillStyle(field, value),
                    }}
                  />
                </div>
                <span
                  className={cn(
                    "min-w-0 justify-self-end text-right tabular-nums font-semibold text-foreground",
                    compact ? "text-[10px]" : "text-xs",
                  )}
                >
                  {formatScore(value)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
