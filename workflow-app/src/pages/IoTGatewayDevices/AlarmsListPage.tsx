import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { BellRing, MoreHorizontal, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

import TableWithPagination from "@/common/tableWithPagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeviceAlarmDetailsDialog } from "@/pages/IoTGatewayDevices/DeviceDetailDialogs";
import { getIotGatewayAlarms, entityIdFromTb } from "@/controllers/API/devicesApi";
import { cn } from "@/lib/utils";
import { getDisplayErrorMessage } from "@/utils/exceptionHelper";
import {
  LIST_PAGE_CARD_CLASS,
  LIST_PAGE_CARD_HEADER_CLASS,
  LIST_PAGE_CARD_TITLE_CLASS,
  LIST_PAGE_TABLE_WRAPPER_CLASS,
  SearchClearButton,
} from "@/components/common/listPageTableStyles";

type GenericRow = Record<string, unknown>;

type AlarmTableRow = {
  id: string;
  createdAt: string;
  createdSortKey: number;
  originator: string;
  type: string;
  severity: string;
  assignee: string;
  status: string;
  raw: GenericRow;
};

const PAGINATION_STEPS = [10, 20, 50, 100];

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return value == null ? "" : String(value);
}

function displayValue(...values: unknown[]): string {
  for (const value of values) {
    const text = stringValue(value).trim();
    if (text) return text;
  }
  return "—";
}

function pageRows(raw: unknown): GenericRow[] {
  if (Array.isArray(raw)) return raw as GenericRow[];
  if (!raw || typeof raw !== "object") return [];
  const o = raw as Record<string, unknown>;
  return (Array.isArray(o.data) ? o.data : Array.isArray(o.content) ? o.content : []) as GenericRow[];
}

function pageTotalItems(raw: unknown): number {
  if (Array.isArray(raw)) return raw.length;
  if (!raw || typeof raw !== "object") return 0;
  const o = raw as Record<string, unknown>;
  if (typeof o.totalElements === "number") return o.totalElements;
  if (typeof o.total_elements === "number") return o.total_elements;
  if (typeof o.total === "number") return o.total;
  return pageRows(raw).length;
}

function formatTs(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    try {
      return format(value, "yyyy-MM-dd HH:mm:ss");
    } catch {
      return String(value);
    }
  }
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return formatTs(numeric);
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return formatTs(parsed);
    return value;
  }
  return "—";
}

function asTimestamp(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  if (hours) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  if (minutes) parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  if (seconds || parts.length === 0) parts.push(`${seconds} second${seconds === 1 ? "" : "s"}`);
  return parts.join(" ");
}

function alarmOriginator(row: GenericRow): string {
  const originator = objectValue(row.originator);
  return displayValue(
    row.originatorName,
    row.originatorLabel,
    row.originatorEntityName,
    originator.name,
    originator.label,
    row.name,
    row.deviceName,
  );
}

function alarmSeverity(row: GenericRow): string {
  return stringValue(row.severity).trim() || "—";
}

function alarmAssignee(row: GenericRow): string {
  const assignee = objectValue(row.assignee);
  const value = displayValue(row.assigneeName, row.assigneeLabel, assignee.name, assignee.email);
  return value === "—" ? "Unassigned" : value;
}

function alarmStatus(row: GenericRow): string {
  const direct = stringValue(row.status ?? row.alarmStatus).trim();
  if (direct) return direct;
  const acknowledged = row.acknowledged ?? row.ack;
  const cleared = row.cleared ?? row.clear;
  if (typeof acknowledged === "boolean" || typeof cleared === "boolean") {
    return `${cleared ? "Cleared" : "Active"} ${acknowledged ? "Acknowledged" : "Unacknowledged"}`;
  }
  return "—";
}

function alarmStartTime(row: GenericRow): unknown {
  return row.startTs ?? row.startTime ?? row.createdTime ?? row.created_time;
}

function alarmDuration(row: GenericRow): string {
  const direct = row.duration ?? row.durationMs ?? row.duration_ms;
  if (typeof direct === "string" && direct.trim()) return direct;
  if (typeof direct === "number" && Number.isFinite(direct)) return formatDuration(direct);
  const start = asTimestamp(alarmStartTime(row));
  if (!start) return "—";
  const end =
    asTimestamp(row.endTs ?? row.endTime ?? row.clearedTime ?? row.clearTs ?? row.clear_time) || Date.now();
  return formatDuration(Math.max(0, end - start));
}

function alarmAdditionalInfo(row: GenericRow): unknown {
  return row.additionalInfo ?? row.additional_info ?? row.details ?? row.body ?? row;
}

function alarmId(row: GenericRow): string {
  return displayValue(entityIdFromTb(row.id), entityIdFromTb(row.alarmId), row.alarmId);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatOffset(date: Date): string {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  return `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
}

function toApiDateTime(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${formatOffset(date)}`;
}

function defaultRange(): { start: string; end: string } {
  const end = new Date();
  end.setHours(23, 59, 59, 0);
  const start = new Date();
  start.setDate(start.getDate() - 30);
  start.setHours(0, 0, 0, 0);
  return {
    start: toApiDateTime(start),
    end: toApiDateTime(end),
  };
}

function toAlarmTableRow(row: GenericRow, index: number): AlarmTableRow {
  const created = alarmStartTime(row);
  return {
    id: alarmId(row) || `${index}`,
    createdAt: formatTs(created),
    createdSortKey: asTimestamp(created),
    originator: alarmOriginator(row),
    type: stringValue(row.type ?? row.alarmType) || "—",
    severity: alarmSeverity(row),
    assignee: alarmAssignee(row),
    status: alarmStatus(row),
    raw: row,
  };
}

type AlarmStatusTab = "live" | "cleared";

export default function AlarmsListPage() {
  const [rows, setRows] = useState<GenericRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [selectedAlarm, setSelectedAlarm] = useState<GenericRow | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [textSearch, setTextSearch] = useState("");
  const [statusTab, setStatusTab] = useState<AlarmStatusTab>("live");

  useEffect(() => {
    const t = window.setTimeout(() => {
      setTextSearch(searchTerm.trim());
      setCurrentPage(0);
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchTerm]);

  const loadAlarms = useCallback(async (
    nextPage = currentPage,
    nextPageSize = pageSize,
    nextTextSearch = textSearch,
  ) => {
    setLoading(true);
    try {
      const range = defaultRange();
      const raw = await getIotGatewayAlarms({
        page_size: nextPageSize,
        page: nextPage,
        sort_property: "createdTime",
        sort_order: "DESC",
        status_list: statusTab === "live" ? "ACTIVE" : "CLEARED",
        start_time: range.start,
        end_time: range.end,
        text_search: nextTextSearch,
      });
      setRows(pageRows(raw));
      setTotalRows(pageTotalItems(raw));
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to load alarms."));
      setRows([]);
      setTotalRows(0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, textSearch, statusTab]);

  useEffect(() => {
    void loadAlarms();
  }, [loadAlarms]);

  const tableRows = useMemo(() => rows.map((row, index) => toAlarmTableRow(row, index)), [rows]);

  const columns = useMemo<ColumnDef<AlarmTableRow>[]>(
    () => [
      {
        accessorKey: "originator",
        header: "Originator",
        size: 240,
        cell: ({ row }) => (
          <span className="line-clamp-2 text-xs text-primary">{row.original.originator}</span>
        ),
      },
      {
        accessorKey: "type",
        header: "Type",
        size: 180,
        cell: ({ row }) => <span className="text-xs">{row.original.type}</span>,
      },
      {
        accessorKey: "severity",
        header: "Severity",
        size: 120,
        cell: ({ row }) => (
          <span
            className={cn(
              "text-xs font-medium",
              row.original.severity.toLowerCase() === "critical" && "text-destructive",
              row.original.severity.toLowerCase() === "major" && "text-orange-600",
              row.original.severity.toLowerCase() === "minor" && "text-amber-600",
              row.original.severity.toLowerCase() === "warning" && "text-yellow-600",
            )}
          >
            {row.original.severity}
          </span>
        ),
      },
      {
        accessorKey: "assignee",
        header: "Assignee",
        size: 160,
        cell: ({ row }) => <span className="text-xs">{row.original.assignee}</span>,
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 180,
        cell: ({ row }) => <span className="text-xs">{row.original.status}</span>,
      },
      {
        accessorKey: "createdAt",
        header: "Created time",
        size: 180,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs tabular-nums text-primary">{row.original.createdAt}</span>
        ),
      },
      {
        id: "details",
        header: () => (
          <div className="flex w-full justify-center px-1">
            <span className="text-xs">Details</span>
          </div>
        ),
        size: 84,
        cell: ({ row }) => (
          <div className="flex w-full justify-center">
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedAlarm(row.original.raw)} title="Alarm details">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <div className="p-1 md:p-1">
        <Card className={LIST_PAGE_CARD_CLASS}>
          <CardHeader className={LIST_PAGE_CARD_HEADER_CLASS}>
            <div className="flex min-h-8 min-w-0 flex-nowrap items-center justify-between gap-2 overflow-hidden">
              <div className="flex shrink-0 items-center gap-2">
                <BellRing className="h-4 w-4 shrink-0 text-primary" />
                <h3 className={cn(LIST_PAGE_CARD_TITLE_CLASS, "leading-none")}>Alarms</h3>
              </div>
              <div className="flex min-w-0 flex-1 flex-nowrap items-center justify-end gap-2 overflow-hidden">
                <Tabs
                  value={statusTab}
                  onValueChange={(v) => {
                    if (v === "live" || v === "cleared") {
                      setStatusTab(v);
                      setCurrentPage(0);
                    }
                  }}
                  className="w-auto shrink-0 gap-0"
                >
                  <TabsList className="h-8 gap-0.5 rounded-md p-0.5">
                    <TabsTrigger
                      value="live"
                      className="h-7 gap-1.5 px-2.5 text-xs data-[state=active]:shadow-sm"
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_1px_hsl(var(--background))]" aria-hidden />
                      Live
                    </TabsTrigger>
                    <TabsTrigger value="cleared" className="h-7 px-2.5 text-xs data-[state=active]:shadow-sm">
                      Cleared
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="relative w-full max-w-[11rem] shrink-0 sm:max-w-[12rem]">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search alarms"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-9 rounded-sm bg-background pl-8 pr-8 text-sm"
                  />
                  {searchTerm ? <SearchClearButton onClick={() => { setSearchTerm(""); setTextSearch(""); setCurrentPage(0); }} /> : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="primary"
                    size="icon"
                    className="h-8 w-8 shrink-0 !px-2"
                    onClick={() => {
                      setSearchTerm("");
                      setTextSearch("");
                      setCurrentPage(0);
                      setPageSize(10);
                      void loadAlarms(0, 10, "");
                    }}
                    disabled={loading}
                    title="Refresh alarms"
                  >
                    <RefreshCw className={cn("!h-5 w-4", loading && "animate-spin")} />
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className={LIST_PAGE_TABLE_WRAPPER_CLASS}>
              <TableWithPagination
                key={`${textSearch}|${pageSize}|${statusTab}`}
                data={tableRows}
                columns={columns}
                totalRows={totalRows}
                loading={loading}
                pagination={{ steps: PAGINATION_STEPS, currentPage, pageSize }}
                paginationSummary="range"
                onChangePagination={({ currentPage: nextPage, limit }) => {
                  setCurrentPage((prev) => (prev === nextPage ? prev : nextPage));
                  setPageSize((prev) => (prev === limit ? prev : limit));
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <DeviceAlarmDetailsDialog
        open={selectedAlarm != null}
        originator={selectedAlarm ? alarmOriginator(selectedAlarm) : "—"}
        severity={selectedAlarm ? alarmSeverity(selectedAlarm) : "—"}
        startTime={selectedAlarm ? formatTs(alarmStartTime(selectedAlarm)) : "—"}
        duration={selectedAlarm ? alarmDuration(selectedAlarm) : "—"}
        type={selectedAlarm ? stringValue(selectedAlarm.type ?? selectedAlarm.alarmType) || "—" : "—"}
        status={selectedAlarm ? alarmStatus(selectedAlarm) : "—"}
        assignee={selectedAlarm ? alarmAssignee(selectedAlarm) : "Unassigned"}
        alarmId={selectedAlarm ? alarmId(selectedAlarm) : "—"}
        additionalInfo={selectedAlarm ? alarmAdditionalInfo(selectedAlarm) : null}
        onOpenChange={(open) => !open && setSelectedAlarm(null)}
        showClearAlarm={statusTab === "live"}
        onAlarmCleared={() => void loadAlarms()}
      />
    </>
  );
}
