import React, { useCallback, useMemo } from "react";
import { Loader2, X } from "lucide-react";
import { AgGridReact } from "ag-grid-react";
import {
  ModuleRegistry,
  AllCommunityModule,
  themeQuartz,
  type ColDef,
  type GridReadyEvent,
} from "ag-grid-community";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { EVIDENCE_ROW_ID } from "./evidenceRowConstants";

ModuleRegistry.registerModules([AllCommunityModule]);

type AgenticEvidenceSheetProps = {
  open: boolean;
  /** When `false`, closing is ignored while `loading` is true. */
  onOpenChange: (open: boolean) => void;
  title: string;
  loading: boolean;
  rowData: Record<string, unknown>[];
  columnDefs: ColDef[];
  /** Optional id for `SheetTitle` (a11y). */
  titleId?: string;
};

export function AgenticEvidenceSheet({
  open,
  onOpenChange,
  title,
  loading,
  rowData,
  columnDefs,
  titleId = "agentic-evidence-sheet-title",
}: AgenticEvidenceSheetProps) {
  const onFirstDataRendered = useCallback((e: { api: GridReadyEvent["api"] }) => {
    try {
      e.api.autoSizeAllColumns(false);
    } catch {
      /* ignore */
    }
  }, []);

  const effectiveColumnDefs = useMemo((): ColDef[] => {
    if (columnDefs.length > 0) return columnDefs;
    const r0 = rowData[0];
    if (!r0) return [];
    return Object.keys(r0)
      .filter((field) => field !== EVIDENCE_ROW_ID)
      .map((field) => ({
        field,
        headerName: field.replace(/_/g, " "),
        sortable: true,
        filter: true,
        resizable: true,
        minWidth: 156,
        maxWidth: 300,
        valueFormatter: (p: { value: unknown }) => {
          const v = p.value;
          if (v == null) return "";
          if (typeof v === "object") return JSON.stringify(v);
          return String(v);
        },
      }));
  }, [columnDefs, rowData]);

  const showGrid = !loading && rowData.length > 0;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next && loading) return;
        onOpenChange(next);
      }}
    >
      <SheetContent
        side="right"
        hideClose
        className={cn(
          /* Do not add `relative` here — it overrides `fixed` from sheet.tsx via tailwind-merge and breaks the panel. */
          "z-[100] flex h-full w-[min(920px,calc(100vw-1rem))] max-w-none flex-col gap-0 border-l p-0 sm:w-[min(920px,96vw)]",
        )}
      >
        {/* Floating close: sits just outside the left edge of the right sheet (matches shadcn sheet pattern). */}
        <SheetClose asChild>
          <button
            type="button"
            disabled={loading}
            aria-label="Close evidence"
            className={cn(
              "absolute left-[-3.25rem] top-3 z-[110] flex size-11 shrink-0 items-center justify-center rounded-full border border-border/50 bg-background p-0 shadow-md",
              "text-foreground transition-colors hover:bg-muted/90 hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "disabled:pointer-events-none disabled:opacity-40 dark:bg-background",
            )}
          >
            <X className="size-4 shrink-0" strokeWidth={2} aria-hidden />
          </button>
        </SheetClose>

        <SheetHeader className="shrink-0 space-y-1 border-b border-border/60 bg-muted/25 px-4 py-3 text-left">
          <SheetTitle id={titleId} className="line-clamp-3 text-left text-base font-semibold leading-snug">
            {title || "Evidence"}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Tabular rows loaded for the selected evidence path.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden bg-muted/15 p-4">
          {loading ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/60 bg-background/60 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-8 animate-spin text-primary/80" aria-hidden />
              <span className="font-medium text-foreground/80">Loading evidence…</span>
            </div>
          ) : rowData.length === 0 ? (
            <p className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border/60 bg-background/60 p-8 text-center text-xs text-muted-foreground">
              No evidence rows.
            </p>
          ) : showGrid ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/50 bg-background shadow-sm">
              <div
                className={cn(
                  "ag-theme-quartz min-h-0 w-full flex-1 text-foreground",
                  "h-[min(560px,65dvh)] min-h-[240px]",
                )}
              >
                <AgGridReact
                  theme={themeQuartz}
                  rowHeight={30}
                  headerHeight={32}
                  rowData={rowData}
                  columnDefs={effectiveColumnDefs}
                  defaultColDef={{
                    sortable: true,
                    filter: true,
                    resizable: true,
                    tooltipValueGetter: (p) => {
                      const val = p.value;
                      if (val == null) return "";
                      if (typeof val === "object") return JSON.stringify(val);
                      return String(val);
                    },
                  }}
                  getRowId={(p) => String((p.data as Record<string, unknown>)[EVIDENCE_ROW_ID] ?? "")}
                  pagination
                  paginationPageSize={25}
                  paginationPageSizeSelector={[10, 25, 50, 100]}
                  onFirstDataRendered={onFirstDataRendered}
                />
              </div>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
