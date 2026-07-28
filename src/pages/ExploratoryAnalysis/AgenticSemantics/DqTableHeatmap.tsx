import React, { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { getDisplayErrorMessage } from "@/utils/exceptionHelper";
import type { ColDef } from "ag-grid-community";
import { Button } from "@/components/ui/button";
import type { ChartDetail } from "./chartTypes";
import {
  type ChartDataTableColumnSpec,
  evidencePathFromCell,
  isEvidenceColumnSpec,
} from "./ChartDataTable";
import { AgenticEvidenceSheet } from "./AgenticEvidenceSheet";
import { EVIDENCE_ROW_ID } from "./evidenceRowConstants";
import { fetchDataQualityEvidenceTable } from "@/controllers/API/dataQualityApi";
import { cn } from "@/lib/utils";

/** Column shape for table_heatmap `display_columns` (includes optional evidence flag). */
export type DqDisplayColumn = ChartDataTableColumnSpec;

const DEFAULT_HEAT_FIELDS = ["null_pct", "completeness_score"] as const;

function isBlankColumnField(field: string): boolean {
  const f = field.toLowerCase();
  return f === "blank_pct" || f === "blank_percentage" || (f.includes("blank") && f.includes("pct"));
}

function isNullPctHeatField(field: string): boolean {
  const f = field.toLowerCase();
  return f === "null_pct" || f === "null_percentage" || /(^|_)null_pct$/.test(f);
}

function isCompletenessHeatField(field: string): boolean {
  return field.toLowerCase().includes("completeness");
}

const HEAT_SHINE_OVERLAY =
  "linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.03) 46%, rgba(0,0,0,0.055) 100%)";

function heatHueSL(t: number): { h: number; s: number; l: number } {
  const clamped = Math.max(0, Math.min(1, t));
  return {
    h: 138 * (1 - clamped),
    s: 42 + clamped * 28,
    l: 92 - clamped * 48,
  };
}

function heatColorForRatio(t: number): string {
  const { h, s, l } = heatHueSL(t);
  return `hsl(${h} ${s}% ${l}%)`;
}

/** Higher value = better (green); heat scale is “badness” 0→1 so invert normalized position. */
function heatFieldHigherIsBetter(field: string): boolean {
  const f = field.toLowerCase();
  if (f.includes("completeness")) return true;
  if (f.includes("quality_score")) return true;
  if (f.includes("confidence") && !f.includes("interval")) return true;
  return false;
}

function heatCellStyle(t: number): React.CSSProperties {
  const { h, s, l } = heatHueSL(t);
  const lHi = Math.min(96, l + 6);
  const lLo = Math.max(26, l - 12);
  const s2 = Math.min(88, s + 10);
  const c1 = `hsl(${h} ${s}% ${lHi}%)`;
  const c2 = `hsl(${h} ${s}% ${l}%)`;
  const c3 = `hsl(${Math.max(0, h - 14)} ${s2}% ${lLo}%)`;
  const body = `linear-gradient(152deg, ${c1} 0%, ${c2} 44%, ${c3} 100%)`;
  return {
    backgroundImage: `${HEAT_SHINE_OVERLAY}, ${body}`,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
  };
}

/** Rose: higher null % → stronger opacity. Emerald: higher completeness → stronger opacity. */
function dualToneHeatCellStyle(
  field: string,
  n: number,
  r: { min: number; max: number },
): React.CSSProperties {
  const span = r.max - r.min;
  const t =
    span > 0
      ? Math.max(0, Math.min(1, (n - r.min) / span))
      : 0.5;
  const aMid = 0.14 + t * 0.78;
  const aHi = Math.min(0.94, aMid + 0.08);
  const aLo = Math.max(0.07, aMid * 0.72);

  if (isNullPctHeatField(field)) {
    const r0 = 185,
      g0 = 28,
      b0 = 58;
    const body = `linear-gradient(152deg, rgba(${r0},${g0},${b0},${aLo}) 0%, rgba(${r0},${g0},${b0},${aMid}) 46%, rgba(${Math.round(r0 * 0.82)},${Math.round(g0 * 0.85)},${Math.round(b0 * 0.88)},${aHi}) 100%)`;
    return {
      backgroundImage: `${HEAT_SHINE_OVERLAY}, ${body}`,
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
    };
  }
  if (isCompletenessHeatField(field)) {
    const r0 = 5,
      g0 = 122,
      b0 = 85;
    const body = `linear-gradient(152deg, rgba(${r0},${g0},${b0},${aLo}) 0%, rgba(${r0},${g0},${b0},${aMid}) 46%, rgba(${Math.round(r0 + 18)},${Math.round(g0 + 28)},${Math.round(b0 + 12)},${aHi}) 100%)`;
    return {
      backgroundImage: `${HEAT_SHINE_OVERLAY}, ${body}`,
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
    };
  }
  return heatCellStyle(0.5);
}

function formatHeatNumericDisplay(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(n);
}

/**
 * Missingness-style table: text columns as plain cells; configured numeric columns use a green→red heat scale.
 */
export function DqTableHeatmap({
  detail,
  compact,
  scrollHeightClass = "max-h-[min(260px,42vh)]",
  /** When true, do not stretch to fill a tall card (data-quality dashboards). */
  shrinkWrap = false,
}: {
  detail: ChartDetail;
  compact?: boolean;
  scrollHeightClass?: string;
  shrinkWrap?: boolean;
}) {
  const rows = detail.chart_data ?? [];
  const payload = detail.chart_payload as Record<string, unknown> | undefined;

  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceTitle, setEvidenceTitle] = useState("");
  const [evidenceRows, setEvidenceRows] = useState<Record<string, unknown>[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);

  const loadEvidence = useCallback(async (path: string, title: string) => {
    if (!path.trim()) {
      toast.error("No evidence path for this row.");
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

  const displayColumns = useMemo((): DqDisplayColumn[] => {
    const raw = payload?.display_columns;
    if (Array.isArray(raw)) {
      const out: DqDisplayColumn[] = [];
      for (const c of raw) {
        if (c == null || typeof (c as DqDisplayColumn).field !== "string") continue;
        const field = String((c as DqDisplayColumn).field);
        const label = (c as DqDisplayColumn).label;
        const evidence = (c as { evidence?: unknown }).evidence;
        out.push({
          field,
          ...(typeof label === "string" && label.trim() ? { label } : {}),
          ...(evidence === true ? { evidence: true } : {}),
        });
      }
      return out;
    }
    if (rows[0]) {
      return Object.keys(rows[0]).map((field) => ({ field, label: field }));
    }
    return [];
  }, [payload, rows]);

  const visibleDisplayColumns = useMemo(
    () => displayColumns.filter((c) => !isBlankColumnField(c.field)),
    [displayColumns],
  );

  const heatFields = useMemo(() => {
    const dropBlank = (list: string[]) => list.filter((f) => !isBlankColumnField(f));
    const fromPayload = payload?.heatmap_value_fields;
    if (Array.isArray(fromPayload) && fromPayload.length > 0) {
      return dropBlank(
        (fromPayload as unknown[]).filter((f): f is string => typeof f === "string" && f.length > 0),
      );
    }
    const r0 = rows[0] as Record<string, unknown> | undefined;
    if (!r0) return [] as string[];
    return dropBlank([...DEFAULT_HEAT_FIELDS.filter((f) => f in r0 && typeof r0[f] === "number")]);
  }, [payload, rows]);

  const ranges = useMemo(() => {
    const out: Record<string, { min: number; max: number }> = {};
    for (const f of heatFields) {
      const vals = rows
        .map((r) => Number((r as Record<string, unknown>)[f]))
        .filter((n) => Number.isFinite(n));
      if (vals.length === 0) continue;
      out[f] = { min: Math.min(...vals), max: Math.max(...vals) };
    }
    return out;
  }, [rows, heatFields]);

  const cellBg = (field: string, val: unknown): React.CSSProperties | undefined => {
    if (!heatFields.includes(field)) return undefined;
    const n = Number(val);
    if (!Number.isFinite(n)) return { background: "hsl(var(--muted))" };
    const r = ranges[field];
    if (!r || r.max <= r.min) {
      if (isNullPctHeatField(field) || isCompletenessHeatField(field)) {
        return dualToneHeatCellStyle(field, n, r ?? { min: n, max: n });
      }
      return heatCellStyle(0.5);
    }
    if (isNullPctHeatField(field) || isCompletenessHeatField(field)) {
      return dualToneHeatCellStyle(field, n, r);
    }
    const tRaw = (n - r.min) / (r.max - r.min);
    const t = heatFieldHigherIsBetter(field) ? 1 - tRaw : tRaw;
    return heatCellStyle(t);
  };

  const evidenceAgRowData = useMemo(
    () =>
      evidenceRows.map((r, i) => ({
        ...r,
        [EVIDENCE_ROW_ID]: `evidence-${i}`,
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

  if (!rows.length) {
    return (
      <p className="text-[11px] text-muted-foreground py-2 px-1.5">No rows for heatmap.</p>
    );
  }

  const globalMax = Math.max(
    0,
    ...heatFields.flatMap((f) => {
      const rr = ranges[f];
      if (!rr) return [0];
      return [Math.abs(rr.max), Math.abs(rr.min)];
    }),
  );

  /** Dense chip-style control — overrides `Button` size defaults for short heatmap rows. */
  const evidenceBtnClass = cn(
    "!h-6 !min-h-6 !py-0 !px-1.5 !text-[10px] !leading-none !font-semibold gap-0 rounded-sm shadow-none",
    compact && "!h-5 !min-h-5 !px-1 !text-[7px]",
  );

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-col gap-1",
        shrinkWrap ? "h-auto w-full" : "h-full flex-1",
      )}
    >
      <div
        className={cn(
          "min-h-0 min-w-0 overflow-x-auto overflow-y-auto rounded-md border border-border/50",
          shrinkWrap ? "" : "flex-1",
          scrollHeightClass,
          compact ? "text-[12px] leading-tight" : "text-[12px] leading-tight",
        )}
      >
        <table
          className="w-full border-collapse [&_td]:leading-tight [&_th]:leading-tight"
          style={{ tableLayout: "auto", minWidth: "max-content" }}
        >
          <thead className="sticky top-0 z-[1] bg-muted/90 backdrop-blur-sm">
            <tr className="border-b border-border/60">
              {visibleDisplayColumns.map((col) => (
                <th
                  key={col.field}
                  className="px-1 py-1 text-left font-semibold text-foreground whitespace-nowrap"
                >
                  {col.label ?? col.field}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 500).map((row, ri) => (
              <tr key={ri} className="border-b border-border/40 odd:bg-muted/15">
                {visibleDisplayColumns.map((col) => {
                  const v = (row as Record<string, unknown>)[col.field];
                  const evidenceCol = isEvidenceColumnSpec(col);
                  const headerLabel = col.label?.trim() ? col.label : col.field;
                  if (evidenceCol) {
                    const path = evidencePathFromCell(v);
                    const hasPath = path.length > 0;
                    return (
                      <td
                        key={col.field}
                        className={cn(
                          "px-1 py-1 align-middle font-semibold",
                          heatFields.includes(col.field) && "tabular-nums text-foreground",
                          !heatFields.includes(col.field) && "text-foreground/90",
                        )}
                      >
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          className={cn(
                            "w-full min-w-0 justify-center",
                            evidenceBtnClass,
                            !hasPath && "pointer-events-none opacity-40",
                          )}
                          disabled={!hasPath || evidenceLoading}
                          onClick={() => void loadEvidence(path, String(headerLabel))}
                        >
                          View Evidence
                        </Button>
                      </td>
                    );
                  }
                  const style = cellBg(col.field, v);
                  const isHeatNum = heatFields.includes(col.field) && typeof v === "number" && Number.isFinite(v);
                  const text =
                    v == null
                      ? "—"
                      : typeof v === "object"
                        ? JSON.stringify(v)
                        : isHeatNum
                          ? formatHeatNumericDisplay(v)
                          : String(v);
                  return (
                    <td
                      key={col.field}
                      className={cn(
                        "px-1 py-1 align-middle font-semibold tabular-nums",
                        heatFields.includes(col.field) && "text-foreground",
                        !heatFields.includes(col.field) && "text-foreground/90",
                      )}
                      style={style}
                      title={text}
                    >
                      <span
                        className={cn(
                          "break-all",
                          isHeatNum ? "line-clamp-1" : "line-clamp-2",
                        )}
                      >
                        {text}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {heatFields.length > 0 ? (
        <div className="shrink-0 space-y-1 rounded-md border border-border/40 bg-muted/20 px-1.5 py-1">
          <div className="grid gap-1 sm:grid-cols-2">
            {heatFields.some((f) => isNullPctHeatField(f)) ? (
              <div className="space-y-0.5">
                <p className="text-[9px] font-semibold text-foreground/80 leading-tight">Null %</p>
                <div
                  className="h-2 w-full overflow-hidden rounded-full border border-border/50 ring-1 ring-inset ring-black/[0.04] dark:ring-white/[0.06]"
                  style={{
                    backgroundImage: `${HEAT_SHINE_OVERLAY}, linear-gradient(to right, rgba(185,28,58,0.14), rgba(185,28,58,0.55), rgba(185,28,58,0.92))`,
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
                  }}
                />
                <div className="flex justify-between text-[9px] tabular-nums text-muted-foreground">
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>
            ) : null}
            {heatFields.some((f) => isCompletenessHeatField(f)) ? (
              <div className="space-y-0.5">
                <p className="text-[9px] font-semibold text-foreground/80 leading-tight">Completeness</p>
                <div
                  className="h-2 w-full overflow-hidden rounded-full border border-border/50 ring-1 ring-inset ring-black/[0.04] dark:ring-white/[0.06]"
                  style={{
                    backgroundImage: `${HEAT_SHINE_OVERLAY}, linear-gradient(to right, rgba(5,122,85,0.14), rgba(5,122,85,0.52), rgba(5,122,85,0.9))`,
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
                  }}
                />
                <div className="flex justify-between text-[9px] tabular-nums text-muted-foreground">
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>
            ) : null}
            {heatFields.some((f) => !isNullPctHeatField(f) && !isCompletenessHeatField(f)) ? (
              <div className="space-y-0.5 sm:col-span-2">
                <p className="text-[9px] font-semibold text-foreground/80 leading-tight">Other metrics</p>
                <div
                  className="h-2 w-full overflow-hidden rounded-full border border-border/50 ring-1 ring-inset ring-black/[0.04] dark:ring-white/[0.06]"
                  style={{
                    backgroundImage: `${HEAT_SHINE_OVERLAY}, linear-gradient(to right, ${heatColorForRatio(0)}, ${heatColorForRatio(0.33)}, ${heatColorForRatio(0.66)}, ${heatColorForRatio(1)})`,
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
                  }}
                />
                <div className="flex justify-between text-[9px] tabular-nums text-muted-foreground">
                  <span>Better</span>
                  <span>{globalMax > 0 ? `max ${globalMax.toFixed(1)}` : ""}</span>
                  <span>Worse</span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <AgenticEvidenceSheet
        open={evidenceOpen}
        onOpenChange={setEvidenceOpen}
        title={evidenceTitle || "Supporting rows"}
        loading={evidenceLoading}
        rowData={evidenceAgRowData}
        columnDefs={evidenceColumnDefs}
        titleId="dq-heatmap-evidence-sheet-title"
      />
    </div>
  );
}

export function chartDetailUsesDataTable(detail: ChartDetail): boolean {
  return String(detail.chart_type ?? "").toLowerCase() === "table";
}

export function chartDetailUsesTableHeatmap(detail: ChartDetail): boolean {
  return String(detail.chart_type ?? "").toLowerCase() === "table_heatmap";
}

export function chartPayloadDisplayColumns(detail: ChartDetail): ChartDataTableColumnSpec[] | undefined {
  const raw = detail.chart_payload?.display_columns;
  if (!Array.isArray(raw)) return undefined;
  const out: ChartDataTableColumnSpec[] = [];
  for (const c of raw) {
    if (c == null || typeof (c as ChartDataTableColumnSpec).field !== "string") continue;
    const field = String((c as ChartDataTableColumnSpec).field);
    const label = (c as ChartDataTableColumnSpec).label;
    const evidence = (c as { evidence?: unknown }).evidence;
    out.push({
      field,
      ...(typeof label === "string" && label.trim() ? { label } : {}),
      ...(evidence === true ? { evidence: true } : {}),
    });
  }
  return out.length ? out : undefined;
}
