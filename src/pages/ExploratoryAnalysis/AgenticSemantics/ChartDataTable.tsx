import React, { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { getDisplayErrorMessage } from "@/utils/exceptionHelper";
import type { ColDef } from "ag-grid-community";
import { Button } from "@/components/ui/button";
import CustomTableData from "@/components/ui/CustomTableData";
import { fetchDataQualityEvidenceTable } from "@/controllers/API/dataQualityApi";
import { cn } from "@/lib/utils";
import { AgenticEvidenceSheet } from "./AgenticEvidenceSheet";
import { EVIDENCE_ROW_ID } from "./evidenceRowConstants";

export { EVIDENCE_ROW_ID };

const CHART_TABLE_ROW_KEY = "__chartRowKey";

export type ChartDataTableColumnSpec = {
  field: string;
  label?: string;
  /** When true, cell shows “View Evidence” and GETs the cell value as an `/api/v2/…` relative path. */
  evidence?: boolean;
};

type CustomColumn = {
  key: string;
  header: string;
  sortable?: boolean;
  truncateData?: boolean;
  renderCell?: (row: Record<string, unknown>) => React.ReactNode;
};

export function isEvidenceColumnSpec(c: ChartDataTableColumnSpec): boolean {
  if (c.evidence === true) return true;
  const f = c.field.toLowerCase();
  const lbl = (c.label ?? "").toLowerCase().trim();
  if (lbl === "evidence" || lbl === "evidence path") return true;
  if (/evidence/.test(f) && /path|url|href|link|uri|endpoint|^evidence$/.test(f)) return true;
  return false;
}

export function evidencePathFromCell(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    for (const k of ["path", "evidence_path", "url", "href", "endpoint"]) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return "";
}

function buildColumnsFromSpecs(
  displayColumns: ChartDataTableColumnSpec[],
  loadEvidence: (path: string, title: string) => void | Promise<void>,
  evidenceBusy: boolean,
): CustomColumn[] {
  return displayColumns.map((c) => {
    const header = c.label?.trim() ? c.label : c.field;
    const base: CustomColumn = {
      key: c.field,
      header: header ?? c.field,
      sortable: true,
      truncateData: true,
    };
    if (!isEvidenceColumnSpec(c)) return base;
    return {
      ...base,
      truncateData: false,
      renderCell: (row: Record<string, unknown>) => {
        const path = evidencePathFromCell(row[c.field]);
        const hasPath = path.length > 0;
        return (
          <Button
            type="button"
            variant="primary"
            size="xs"
            className={cn(
              "!h-6 !min-h-6 !py-0.5 !px-1.5 mt-1 mb-1 !text-[10px] !leading-none !font-semibold gap-0 rounded-sm shadow-none shrink-0",
              !hasPath && "pointer-events-none opacity-40",
            )}
            disabled={!hasPath || evidenceBusy}
            onClick={() => void loadEvidence(path, String(header))}
          >
            View Evidence
          </Button>
        );
      },
    };
  });
}

function inferColumnSpecsFromRow(row: Record<string, unknown>): ChartDataTableColumnSpec[] {
  return Object.keys(row).map((field) => ({ field, label: field }));
}

export function ChartDataTable({
  rows,
  scrollHeightClass = "max-h-[min(320px,50vh)]",
  /** When set (e.g. data-quality `display_columns`), column order and headers follow this spec. */
  displayColumns,
  /**
   * When true (e.g. data-quality dashboard cards), the table does not stretch with `h-full`/`flex-1`
   * so the card can shrink to the table’s natural height up to `scrollHeightClass`.
   */
  shrinkWrap = false,
  /**
   * When true, the grid scroll viewport stretches inside a flex parent with a fixed height.
   */
  scrollAreaFillsParent = false,
  /**
   * Max height (px) on the scroll viewport: table grows with row count until this cap, then scrolls.
   * (Data-quality table tab — cap matches chart pane from `useDqTableTabMinHeightStyle`.)
   */
  scrollViewportMaxHeightPx,
}: {
  rows: Array<Record<string, unknown>>;
  /** Taller scroll area when used inside expand modal */
  scrollHeightClass?: string;
  displayColumns?: ChartDataTableColumnSpec[];
  shrinkWrap?: boolean;
  scrollAreaFillsParent?: boolean;
  scrollViewportMaxHeightPx?: number;
}) {
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

  const { data, columns } = useMemo(() => {
    if (!rows.length) {
      return { data: [] as Record<string, unknown>[], columns: [] as CustomColumn[] };
    }
    const sliced = rows.slice(0, 500).map((r, i) => ({
      ...r,
      [CHART_TABLE_ROW_KEY]: i,
    }));
    const specs = displayColumns?.length
      ? displayColumns
      : rows[0]
        ? inferColumnSpecsFromRow(rows[0] as Record<string, unknown>)
        : [];
    const cols = buildColumnsFromSpecs(specs, loadEvidence, evidenceLoading);
    return { data: sliced, columns: cols };
  }, [rows, displayColumns, loadEvidence, evidenceLoading]);

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
      <p className="text-[11px] text-muted-foreground py-2">
        No table rows in payload
      </p>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-0 w-full min-w-0 flex-col",
        shrinkWrap ? "h-auto" : "h-full",
      )}
    >
      <div
        className={cn(
          "min-h-0 overflow-hidden rounded-md border border-border/50 text-xs [&_.text-sm]:text-xs",
          shrinkWrap ? "" : "flex min-h-0 flex-1 flex-col",
        )}
      >
        <CustomTableData
          data={data}
          columns={columns}
          rowKey={CHART_TABLE_ROW_KEY}
          scrollHeightClass={scrollHeightClass}
          scrollAreaFillsParent={scrollAreaFillsParent}
          scrollViewportMaxHeightPx={scrollViewportMaxHeightPx}
          emptyState={
            <div className="p-4 text-center text-xs text-muted-foreground">No data.</div>
          }
          truncateCharLimit={48}
          HorizontalScroll
          wrapLongCells
        />
      </div>

      <AgenticEvidenceSheet
        open={evidenceOpen}
        onOpenChange={setEvidenceOpen}
        title={evidenceTitle || "Supporting rows"}
        loading={evidenceLoading}
        rowData={evidenceAgRowData}
        columnDefs={evidenceColumnDefs}
        titleId="chart-evidence-sheet-title"
      />
    </div>
  );
}
