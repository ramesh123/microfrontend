"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  downloadMinioFileFromFlow,
  getMinioFilesForFlow,
  getStatementDates,
} from "@/controllers/API/ReconcilationAPI";
import { CalendarIcon, Download, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import ShadTooltip from "@/components/common/shadTooltipComponent";

/*
 * Workflow reports tab (getReportFiles, process cycle / execution / statement filters, report table) —
 * commented out per product request; Reports shows MinIO files only. Re-enable by restoring imports:
 *   getReportFiles, downloadReportFile from ReconcilationAPI
 *   Table, TableBody, TableCell, TableHead, TableHeader, TableRow from @/components/ui/table
 *   Tabs, TabsContent, TabsList, TabsTrigger from @/components/ui/tabs
 * and the previous ReportDownloaderPage state/effects/Tabs layout from version control.
 */

/** `workflow.statement_date` → `YYYY-MM-DD` for report / MinIO APIs. */
export function formatStatementDateFromWorkflow(workflow: unknown): string {
  if (!workflow || typeof workflow !== "object") return "";
  const w = workflow as { statement_date?: unknown };
  const raw = w.statement_date;
  if (raw == null || raw === "") return "";
  if (typeof raw === "string") {
    const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    const parsed = parseStatementDate(raw.trim());
    if (parsed) return formatDate(parsed);
    const t = Date.parse(raw);
    if (!Number.isNaN(t)) return formatDate(new Date(t));
    return "";
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return formatDate(new Date(raw));
  }
  return "";
}

function parseStatementDate(dateStr: string): Date | undefined {
  if (!dateStr) return undefined;
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return undefined;
  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function formatDate(date?: Date): string {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sortStatementDates(dates: Date[]): Date[] {
  return [...dates].sort((a, b) => a.getTime() - b.getTime());
}

function isSameStatementDate(left?: Date, right?: Date): boolean {
  if (!left || !right) return false;
  return formatDate(left) === formatDate(right);
}

function normalizeStatementDates(raw: unknown): Date[] {
  const unwrapped =
    raw && typeof raw === "object" && "data" in (raw as object) && (raw as { data: unknown }).data !== undefined
      ? (raw as { data: unknown }).data
      : raw;
  const items = Array.isArray(unwrapped) ? unwrapped : [];

  return items
    .map((item) => {
      if (typeof item === "string") return parseStatementDate(item.trim());
      if (item && typeof item === "object") {
        const value = String(
          (item as Record<string, unknown>).stmt_date ??
            (item as Record<string, unknown>).statement_date ??
            (item as Record<string, unknown>).date ??
            "",
        ).trim();
        return parseStatementDate(value);
      }
      return undefined;
    })
    .filter((date): date is Date => Boolean(date));
}

interface ReportDownloaderPageProps {
  workflowId: string;
  /** Loaded workflow; `statement_date` seeds the picker and selected value is sent as `stmt_date`. */
  workflow?: unknown;
}

/** Normalize various API shapes for `/flow-reports/get-minio-files` into rows with `file_path`. */
function normalizeMinioFiles(raw: unknown): { file_path: string; label: string }[] {
  const unwrap =
    raw && typeof raw === "object" && "data" in (raw as object) && (raw as { data: unknown }).data !== undefined
      ? (raw as { data: unknown }).data
      : raw;
  const arr = Array.isArray(unwrap)
    ? unwrap
    : unwrap && typeof unwrap === "object"
      ? ((unwrap as { files?: unknown[] }).files ??
          (unwrap as { file_list?: unknown[] }).file_list ??
          (unwrap as { items?: unknown[] }).items ??
          [])
      : [];
  const out: { file_path: string; label: string }[] = [];
  for (const item of arr) {
    if (typeof item === "string" && item.trim()) {
      const p = item.trim();
      out.push({ file_path: p, label: p.split(/[/\\]/).pop() || p });
      continue;
    }
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      const file_path = String(o.file_path ?? o.path ?? o.key ?? o.Key ?? "").trim();
      if (!file_path) continue;
      const label = String(
        o.file_name ?? o.name ?? o.display_name ?? file_path.split(/[/\\]/).pop() ?? file_path,
      );
      out.push({ file_path, label });
    }
  }
  return out;
}

function MinIOFlowReportsSection({
  flowId,
  workflow,
}: {
  flowId: string;
  workflow?: unknown;
}) {
  const workflowStmtDate = useMemo(() => formatStatementDateFromWorkflow(workflow), [workflow]);
  const [date, setDate] = useState<Date | undefined>(() => parseStatementDate(workflowStmtDate));
  const [hasUserSelectedDate, setHasUserSelectedDate] = useState(false);
  const stmtDate = useMemo(() => formatDate(date), [date]);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [loadingDates, setLoadingDates] = useState(false);
  const [datesInitialized, setDatesInitialized] = useState(false);
  const [files, setFiles] = useState<{ file_path: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);

  useEffect(() => {
    setHasUserSelectedDate(false);
    setDatesInitialized(false);
    setAvailableDates([]);
    setDate(parseStatementDate(workflowStmtDate));
  }, [flowId, workflowStmtDate]);

  const fetchStatementDates = useCallback(async () => {
    if (!flowId) {
      setAvailableDates([]);
      return;
    }

    setLoadingDates(true);
    try {
      const raw = await getStatementDates({ flow_id: flowId });
      const normalizedDates = sortStatementDates(normalizeStatementDates(raw));
      setAvailableDates(normalizedDates);

      const workflowDate = parseStatementDate(workflowStmtDate);
      const latestAvailableDate = normalizedDates[normalizedDates.length - 1];

      setDate((currentDate) => {
        if (
          hasUserSelectedDate &&
          currentDate &&
          normalizedDates.some((availableDate) => isSameStatementDate(availableDate, currentDate))
        ) {
          return currentDate;
        }

        if (
          workflowDate &&
          normalizedDates.some((availableDate) => isSameStatementDate(availableDate, workflowDate))
        ) {
          return workflowDate;
        }

        if (
          currentDate &&
          normalizedDates.some((availableDate) => isSameStatementDate(availableDate, currentDate))
        ) {
          return currentDate;
        }

        if (latestAvailableDate) return latestAvailableDate;
        return workflowDate ?? currentDate;
      });
    } catch {
      setAvailableDates([]);
    } finally {
      setLoadingDates(false);
      setDatesInitialized(true);
    }
  }, [flowId, hasUserSelectedDate, workflowStmtDate]);

  const loadFiles = useCallback(async () => {
    if (!flowId) return;
    const stmt_date = stmtDate.trim();
    if (!stmt_date) {
      setFiles([]);
      return;
    }

    setLoading(true);
    try {
      const raw = await getMinioFilesForFlow({ flow_id: flowId, stmt_date });
      setFiles(normalizeMinioFiles(raw));
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [flowId, stmtDate]);

  useEffect(() => {
    void fetchStatementDates();
  }, [fetchStatementDates]);

  useEffect(() => {
    if (!datesInitialized) return;
    void loadFiles();
  }, [loadFiles, datesInitialized]);

  const isDateDisabled = useCallback(
    (candidate: Date) => {
      if (availableDates.length === 0) return false;
      const candidateDate = formatDate(candidate);
      return !availableDates.some((availableDate) => formatDate(availableDate) === candidateDate);
    },
    [availableDates],
  );

  

  const onDownload = async (file_path: string) => {
    setDownloadingPath(file_path);
    try {
      await downloadMinioFileFromFlow({ file_path });
    } finally {
      setDownloadingPath(null);
    }
  };

  return (
    <Card className="gap-2 !border-none !p-0 !shadow-none">
      <CardHeader className="space-y-0 p-0">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <CardTitle className="text-lg">Reports</CardTitle>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 sm:flex-nowrap">
            <p className="m-0 text-xs text-muted-foreground">
              Statement date:{" "}
              <span className="font-medium text-foreground">
                {stmtDate.trim() ? stmtDate : "Select date"}
              </span>
            </p>
            <Popover>
              <ShadTooltip content={loadingDates ? "Loading available statement dates" : "Select statement date"}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="!h-7 !w-7 shrink-0"
                    disabled={loadingDates}
                  >
                    {loadingDates ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CalendarIcon className="h-4 w-4" />
                    )}
                  </Button>
                </PopoverTrigger>
              </ShadTooltip>
              <PopoverContent align="end" className="w-auto p-0">
                <style>{`
                  .report-calendar .rdp-day_selected,
                  .report-calendar .rdp-day[data-selected="true"] {
                    background: transparent !important;
                  }

                  .report-calendar .rdp-day_selected button,
                  .report-calendar .rdp-day[data-selected="true"] button,
                  .report-calendar button[data-selected-single="true"] {
                    background-color: #0370f1 !important;
                    color: white !important;
                    font-weight: 600 !important;
                    border-radius: 10px !important;
                    border: none !important;
                    box-shadow: none !important;
                  }

                  .report-calendar .rdp-day button:focus-visible {
                    outline: none !important;
                    box-shadow: none !important;
                  }
                `}</style>
                <Calendar
                  mode="single"
                  className="report-calendar"
                  selected={date}
                  fromYear={new Date().getFullYear() - 10}
                  toYear={new Date().getFullYear()}
                  captionLayout="dropdown"
                  onSelect={(selectedDate) => {
                    setHasUserSelectedDate(true);
                    setDate(selectedDate);
                  }}
                  disabled={isDateDisabled}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-0">
        <ul className="divide-y divide-border rounded-md border border-border bg-card">
          {!stmtDate.trim() ? (
            <li className="px-3 py-8 text-center text-sm text-muted-foreground">
              Select a statement date to load report files.
            </li>
          ) : (
            files.map((f) => (
              <li
                key={f.file_path}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
              >
                <span className="min-w-0 flex-1 break-all font-medium text-foreground" title={f.file_path}>
                  {f.label}
                </span>
                <ShadTooltip content="Download">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="!h-8 shrink-0 gap-1"
                    disabled={Boolean(downloadingPath)}
                    onClick={() => void onDownload(f.file_path)}
                  >
                    {downloadingPath === f.file_path ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Download
                  </Button>
                </ShadTooltip>
              </li>
            ))
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

const ReportDownloaderPage: React.FC<ReportDownloaderPageProps> = ({ workflowId, workflow }) => (
  <div className="mt-0 w-full space-y-3">
    {workflowId ? <MinIOFlowReportsSection flowId={workflowId} workflow={workflow} /> : null}
  </div>
);

export default ReportDownloaderPage;
