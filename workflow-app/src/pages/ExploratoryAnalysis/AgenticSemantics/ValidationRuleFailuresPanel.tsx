import React, { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { getDisplayErrorMessage } from "@/utils/exceptionHelper";
import type { ColDef } from "ag-grid-community";
import type { ChartDetail } from "./chartTypes";
import { AgenticEvidenceSheet } from "./AgenticEvidenceSheet";
import { EVIDENCE_ROW_ID } from "./evidenceRowConstants";
import { fetchDataQualityEvidenceTable } from "@/controllers/API/dataQualityApi";
import { cn } from "@/lib/utils";
import { violationBarFillStyle, violationBarTrackStyle } from "./agenticBarShineThemes";

const CHART_KEY = "validation_rule_failures";

export function chartDetailUsesValidationRuleFailures(detail: ChartDetail): boolean {
  const ct = String(detail.chart_type ?? "").toLowerCase();
  if (!ct.includes("stacked_bar")) return false;
  const id = String(detail.chart_id ?? "").toLowerCase().trim();
  const pk = String(
    (detail.chart_payload as { chart_key?: unknown } | undefined)?.chart_key ?? "",
  )
    .toLowerCase()
    .trim();
  return id === CHART_KEY || pk === CHART_KEY;
}

function numOrZero(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function formatCount(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

function summaryText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Match dashboard-style summary chips (e.g. `rule_count: 12.00`). */
function summaryDisplayValue(v: unknown): string {
  if (v != null && typeof v === "object") return JSON.stringify(v);
  if (typeof v === "number" && Number.isFinite(v)) {
    return Number.isInteger(v) ? v.toFixed(2) : String(v);
  }
  if (typeof v === "boolean") return String(v);
  if (v == null) return "";
  return String(v);
}

function evidencePathFromRow(row: Record<string, unknown>): string {
  const raw = row.evidence_path;
  if (typeof raw === "string") return raw.trim();
  return "";
}

type RuleRow = {
  key: string;
  rule_type: string;
  column_name: string;
  violation_count: number;
  evidence_path: string;
};

export function ValidationRuleFailuresPanel({
  detail,
  compact,
}: {
  detail: ChartDetail;
  compact?: boolean;
}) {
  const rows = detail.chart_data ?? [];
  const payload = detail.chart_payload as Record<string, unknown> | undefined;
  const summary = (payload?.summary ?? {}) as Record<string, unknown>;
  const dataSource =
    typeof payload?.data_source === "string" ? payload.data_source.trim() : "";

  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceTitle, setEvidenceTitle] = useState("");
  const [evidenceRows, setEvidenceRows] = useState<Record<string, unknown>[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);

  const loadEvidence = useCallback(async (path: string, title: string) => {
    if (!path.trim()) {
      toast.error("No evidence path for this rule.");
      return;
    }
    setEvidenceTitle(title);
    setEvidenceOpen(true);
    setEvidenceRows([]);
    setEvidenceLoading(true);
    try {
      const loaded = await fetchDataQualityEvidenceTable(path);
      setEvidenceRows(loaded);
      if (!loaded.length) {
        toast.message("Evidence", { description: "No rows returned for this path." });
      }
    } catch (e: unknown) {
      toast.error(getDisplayErrorMessage(e, "Failed to load evidence"));
      setEvidenceOpen(false);
    } finally {
      setEvidenceLoading(false);
    }
  }, []);

  const ruleRows = useMemo((): RuleRow[] => {
    const out: RuleRow[] = [];
    let i = 0;
    for (const r of rows) {
      const row = r as Record<string, unknown>;
      const violation_count = numOrZero(row.violation_count);
      const rule_type = String(row.rule_type ?? "").trim() || "rule";
      const column_name = String(row.column_name ?? row.column_alias ?? "").trim() || "—";
      const rule_id = String(row.rule_id ?? i);
      out.push({
        key: rule_id || `row-${i}`,
        rule_type,
        column_name,
        violation_count,
        evidence_path: evidencePathFromRow(row),
      });
      i += 1;
    }
    return out.sort((a, b) => b.violation_count - a.violation_count);
  }, [rows]);

  const maxViolations = useMemo(
    () => Math.max(1, ...ruleRows.map((r) => r.violation_count)),
    [ruleRows],
  );

  const evidenceAgRowData = useMemo(
    () =>
      evidenceRows.map((r, idx) => ({
        ...r,
        [EVIDENCE_ROW_ID]: `evidence-${idx}`,
      })),
    [evidenceRows],
  );

  const evidenceColumnDefs = useMemo((): ColDef[] => {
    if (!evidenceRows.length) return [];
    return Object.keys(evidenceRows[0]).map((field) => ({
      field,
      headerName: field.replace(/_/g, " "),
      sortable: true,
      filter: true,
      resizable: true,
      minWidth: 156,
      maxWidth: 300,
      valueFormatter: (p) => {
        const v = p.value;
        if (v == null) return "";
        if (typeof v === "object") return JSON.stringify(v);
        return String(v);
      },
    }));
  }, [evidenceRows]);

  const metaLine = [String(detail.chart_type ?? "stacked_bar").toLowerCase(), dataSource]
    .filter(Boolean)
    .join(" | ");

  const pad = compact ? "p-1.5 gap-2" : "p-2 gap-3";

  if (!rows.length) {
    return (
      <p className="text-[11px] text-muted-foreground px-2 py-3">No validation rule rows.</p>
    );
  }

  return (
    <div
      className={cn(
        "flex h-auto min-h-0 min-w-0 w-full flex-col overflow-visible text-foreground",
        pad,
      )}
    >

      <div className={cn("flex min-h-0 w-full flex-col", compact ? "gap-1" : "gap-1.5")}>
        {ruleRows.map((r) => {
          const pct = Math.min(100, (r.violation_count / maxViolations) * 100);
          const label = `${r.rule_type} · ${r.column_name}`;
          const hasPath = r.evidence_path.length > 0;
          return (
            <div
              key={r.key}
              className={cn(
                "grid min-w-0 grid-cols-1 gap-x-3 gap-y-1 rounded-md border border-border/40 bg-muted/15 px-2 py-1.5 sm:grid-cols-[minmax(0,12.5rem)_minmax(0,1fr)] sm:items-center sm:py-1.5 sm:pl-2.5 sm:pr-2 dark:bg-background/20",
                compact && "gap-y-0.5 py-1 sm:py-1",
              )}
            >
              <button
                type="button"
                disabled={!hasPath || evidenceLoading}
                title={hasPath ? "View evidence rows" : "No evidence path"}
                onClick={() => void loadEvidence(r.evidence_path, label)}
                className={cn(
                  "min-w-0 truncate text-left text-xs font-semibold text-foreground/90 underline-offset-2 decoration-border/60 hover:text-primary hover:decoration-primary/40 hover:underline disabled:pointer-events-none disabled:text-muted-foreground disabled:no-underline",
                  compact && "text-[10px]",
                )}
              >
                {label}
              </button>
              <div className="flex min-w-0 items-center gap-2">
                <div
                  className={cn(
                    "min-w-0 flex-1 overflow-hidden rounded-full ring-1 ring-inset ring-black/[0.03] dark:ring-white/[0.05]",
                    compact ? "h-1.5" : "h-1.5 sm:h-2",
                  )}
                  style={violationBarTrackStyle(pct)}
                >
                  <div
                    className="h-full min-w-0 rounded-full transition-[width] duration-300 ease-out"
                    style={{
                      width: `${pct}%`,
                      ...violationBarFillStyle(pct),
                    }}
                  />
                </div>
                <span
                  className={cn(
                    "shrink-0 tabular-nums text-muted-foreground",
                    compact ? "w-11 text-right text-[10px] font-semibold" : "w-[3.25rem] text-right text-[11px] font-semibold text-foreground/90 sm:text-xs",
                  )}
                >
                  {formatCount(r.violation_count)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <AgenticEvidenceSheet
        open={evidenceOpen}
        onOpenChange={setEvidenceOpen}
        title={evidenceTitle || "Evidence"}
        loading={evidenceLoading}
        rowData={evidenceAgRowData}
        columnDefs={evidenceColumnDefs}
        titleId="vr-failures-evidence-sheet-title"
      />
    </div>
  );
}
