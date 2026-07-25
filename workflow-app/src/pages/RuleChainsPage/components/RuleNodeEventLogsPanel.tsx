import { useCallback, useEffect, useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Clock3, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { type DateRange as DayPickerDateRange } from "react-day-picker";

import TableWithPagination from "@/common/tableWithPagination";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getRuleNodeEvents } from "@/controllers/API/ruleChainsApi";
import { cn } from "@/lib/utils";
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';

type EventRow = Record<string, unknown>;
type EventRange = { from: Date; to: Date };
type TimeWindowMode = "last" | "range" | "relative";
type LastPresetId = "15m" | "1h" | "6h" | "12h" | "1d" | "7d";
type RelativeUnit = "minutes" | "hours" | "days";
type PreviewState = { title: string; content: string } | null;
type NodeEventsEnvelope = {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  rows: EventRow[];
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
};
type EventLogTableRow = {
  id: string;
  eventTime: number;
  eventDate: string;
  eventTimeText: string;
  server: string;
  type: string;
  entityType: string;
  entityId: string;
  messageId: string;
  messageType: string;
  relationType: string;
  data: string;
  metadata: string;
  error: string;
};

const LAST_PRESETS: { id: LastPresetId; label: string; minutes: number }[] = [
  { id: "15m", label: "Last 15 minutes", minutes: 15 },
  { id: "1h", label: "Last hour", minutes: 60 },
  { id: "6h", label: "Last 6 hours", minutes: 6 * 60 },
  { id: "12h", label: "Last 12 hours", minutes: 12 * 60 },
  { id: "1d", label: "Last day", minutes: 24 * 60 },
  { id: "7d", label: "Last 7 days", minutes: 7 * 24 * 60 },
];
const PAGINATION_STEPS = [10, 20, 50, 100];

function defaultEventRange(): EventRange {
  const to = new Date();
  const from = new Date(to.getTime() - 15 * 60 * 1000);
  return { from, to };
}

function parseNodeEventsResponse(raw: unknown, ruleNodeId: string): NodeEventsEnvelope {
  const empty: NodeEventsEnvelope = {
    nodeId: ruleNodeId,
    nodeName: "",
    nodeType: "",
    rows: [],
    totalElements: 0,
    totalPages: 0,
    hasNext: false,
  };
  if (!raw || typeof raw !== "object") return empty;
  const root = raw as Record<string, unknown>;
  const nodes = Array.isArray(root.nodes) ? (root.nodes as Record<string, unknown>[]) : [];
  const currentNode =
    nodes.find((node) => stringValue(node.node_id ?? node.nodeId).trim() === ruleNodeId.trim()) ??
    nodes[0] ??
    null;

  if (!currentNode) return empty;

  const events = currentNode.events && typeof currentNode.events === "object"
    ? (currentNode.events as Record<string, unknown>)
    : {};
  const rows = Array.isArray(events.data)
    ? (events.data as EventRow[])
    : Array.isArray(events.content)
      ? (events.content as EventRow[])
      : [];
  const total = events.totalElements ?? events.total_elements ?? events.total ?? events.count;
  const totalPages = events.totalPages ?? events.total_pages;
  const hasNext = events.hasNext ?? events.has_next;

  return {
    nodeId: stringValue(currentNode.node_id ?? currentNode.nodeId) || ruleNodeId,
    nodeName: stringValue(currentNode.node_name ?? currentNode.nodeName),
    nodeType: stringValue(currentNode.node_type ?? currentNode.nodeType),
    rows,
    totalElements: typeof total === "number" && Number.isFinite(total) ? total : rows.length,
    totalPages: typeof totalPages === "number" && Number.isFinite(totalPages) ? totalPages : 0,
    hasNext: typeof hasNext === "boolean" ? hasNext : false,
  };
}

function eventRowTime(row: EventRow): number {
  const t = row.eventTime ?? row.createdTime ?? row.created_time ?? row.ts ?? row.timestamp;
  if (typeof t === "number" && Number.isFinite(t)) return t;
  if (typeof t === "string") {
    const n = Number(t);
    if (Number.isFinite(n)) return n;
    const parsed = Date.parse(t);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function stringValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return value != null ? String(value) : "";
}

function stringifyValue(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return value;
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return JSON.stringify(JSON.parse(trimmed), null, 2);
      } catch {
        return value;
      }
    }
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value == null) return "";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function entityTypeFromRef(ref: unknown): string {
  if (!ref || typeof ref !== "object") return "";
  const o = ref as Record<string, unknown>;
  return stringValue(o.entityType ?? o.entity_type ?? o.type);
}

function entityIdFromRef(ref: unknown): string {
  if (!ref || typeof ref !== "object") return "";
  const o = ref as Record<string, unknown>;
  return stringValue(o.id ?? o.entityId ?? o.entity_id);
}

function eventRowServer(row: EventRow): string {
  const body = row.body && typeof row.body === "object" ? (row.body as Record<string, unknown>) : {};
  return stringValue(body.server ?? row.server ?? row.serverName ?? row.server_name) || "—";
}

function eventRowEntityType(row: EventRow): string {
  const body = row.body && typeof row.body === "object" ? (row.body as Record<string, unknown>) : {};
  return (
    stringValue(body.entityType ?? body.entity_type) ||
    stringValue(row.entityType ?? row.entity_type) ||
    entityTypeFromRef(row.entityId ?? row.entity_id) ||
    "—"
  );
}

function eventRowEntityId(row: EventRow): string {
  const body = row.body && typeof row.body === "object" ? (row.body as Record<string, unknown>) : {};
  return (
    stringValue(body.entityId ?? body.entity_id) ||
    stringValue(row.entityIdStr ?? row.entity_id_str) ||
    entityIdFromRef(row.entityId ?? row.entity_id) ||
    "—"
  );
}

function eventRowMessageId(row: EventRow): string {
  const body = row.body && typeof row.body === "object" ? (row.body as Record<string, unknown>) : {};
  return stringValue(body.msgId ?? body.msg_id ?? row.messageId ?? row.message_id ?? row.msgId ?? row.msg_id) || "—";
}

function eventRowMessageType(row: EventRow): string {
  const body = row.body && typeof row.body === "object" ? (row.body as Record<string, unknown>) : {};
  return stringValue(body.msgType ?? body.msg_type ?? row.messageType ?? row.message_type ?? row.msgType ?? row.msg_type) || "—";
}

function eventRowRelation(row: EventRow): string {
  const body = row.body && typeof row.body === "object" ? (row.body as Record<string, unknown>) : {};
  const value = body.relationType ?? body.relation_type ?? row.relation ?? row.relationType ?? row.relation_type;
  if (Array.isArray(value)) return value.map((item) => stringValue(item)).filter(Boolean).join(", ") || "—";
  return stringValue(value) || "—";
}

function eventRowDirection(row: EventRow): string {
  const body = row.body && typeof row.body === "object" ? (row.body as Record<string, unknown>) : {};
  return stringValue(body.type ?? row.type ?? row.eventType ?? row.event_type) || "—";
}

function eventRowData(row: EventRow): string {
  const body = row.body && typeof row.body === "object" ? (row.body as Record<string, unknown>) : {};
  return stringifyValue(body.data) || "—";
}

function eventRowMetadata(row: EventRow): string {
  const body = row.body && typeof row.body === "object" ? (row.body as Record<string, unknown>) : {};
  return stringifyValue(body.metadata) || "—";
}

function eventRowError(row: EventRow): string {
  const body = row.body && typeof row.body === "object" ? (row.body as Record<string, unknown>) : {};
  return stringifyValue(body.error) || "—";
}

function formatTsParts(ms: number): { date: string; time: string } {
  if (!ms) return { date: "—", time: "" };
  try {
    return {
      date: format(ms, "yyyy-MM-dd"),
      time: format(ms, "HH:mm:ss.SSS"),
    };
  } catch {
    return { date: String(ms), time: "" };
  }
}

function toEventLogTableRow(row: EventRow, index: number): EventLogTableRow {
  const eventTime = eventRowTime(row);
  const { date, time } = formatTsParts(eventTime);
  const messageId = eventRowMessageId(row);
  return {
    id: `${eventTime || "event"}-${messageId || index}-${index}`,
    eventTime,
    eventDate: date,
    eventTimeText: time,
    server: eventRowServer(row),
    type: eventRowDirection(row),
    entityType: eventRowEntityType(row),
    entityId: eventRowEntityId(row),
    messageId,
    messageType: eventRowMessageType(row),
    relationType: eventRowRelation(row),
    data: eventRowData(row),
    metadata: eventRowMetadata(row),
    error: eventRowError(row),
  };
}

function CellText({
  value,
  mono = false,
  className,
}: {
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn("truncate text-[13px]", mono && "font-mono", className)}
      title={value && value !== "—" ? value : undefined}
    >
      {value || "—"}
    </div>
  );
}

function PreviewButton({
  label,
  value,
  onOpen,
}: {
  label: string;
  value: string;
  onOpen: (title: string, content: string) => void;
}) {
  if (!value || value === "—") {
    return <span className="text-[13px] text-muted-foreground">—</span>;
  }
  return (
    <Button
      type="button"
      variant="ghost"
      className="h-7 min-w-7 px-1.5 font-mono text-[13px] text-muted-foreground"
      onClick={(event) => {
        event.stopPropagation();
        onOpen(label, value);
      }}
      title={`View ${label.toLowerCase()}`}
    >
      ...
      <span className="sr-only">View {label}</span>
    </Button>
  );
}

function formatDateTimeLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function formatApiTimestamp(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absOffset = Math.abs(offsetMinutes);
  const offsetHours = String(Math.floor(absOffset / 60)).padStart(2, "0");
  const offsetMins = String(absOffset % 60).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}${sign}${offsetHours}:${offsetMins}`;
}

function rangeLabel(range: EventRange): string {
  const sameDay = range.from.toDateString() === range.to.toDateString();
  try {
    if (sameDay) {
      return `${range.from.toLocaleDateString()} ${range.from.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${range.to.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
    return `${range.from.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} - ${range.to.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    return "Selected range";
  }
}

function cloneRange(range: EventRange): EventRange {
  return {
    from: new Date(range.from),
    to: new Date(range.to),
  };
}

function rangeFromMinutes(minutes: number, now = new Date()): EventRange {
  const to = new Date(now);
  const from = new Date(now.getTime() - minutes * 60 * 1000);
  return { from, to };
}

function rangeFromPreset(id: LastPresetId, now = new Date()): EventRange {
  const preset = LAST_PRESETS.find((item) => item.id === id) ?? LAST_PRESETS[0];
  return rangeFromMinutes(preset.minutes, now);
}

function rangeFromRelative(value: number, unit: RelativeUnit, now = new Date()): EventRange {
  const safeValue = Math.max(1, Math.floor(value));
  const minutes =
    unit === "days" ? safeValue * 24 * 60 : unit === "hours" ? safeValue * 60 : safeValue;
  return rangeFromMinutes(minutes, now);
}

function relativeUnitLabel(value: number, unit: RelativeUnit): string {
  if (value === 1) {
    if (unit === "days") return "day";
    if (unit === "hours") return "hour";
    return "minute";
  }
  return unit;
}

function mergeDatePart(datePart: Date, timeSource: Date): Date {
  const next = new Date(datePart);
  next.setHours(timeSource.getHours(), timeSource.getMinutes(), 0, 0);
  return next;
}

function timeWindowLabel(
  mode: TimeWindowMode,
  range: EventRange,
  presetId: LastPresetId,
  relativeValue: number,
  relativeUnit: RelativeUnit,
): string {
  if (mode === "last") {
    return LAST_PRESETS.find((item) => item.id === presetId)?.label ?? "Last 15 minutes";
  }
  if (mode === "relative") {
    return `Last ${relativeValue} ${relativeUnitLabel(relativeValue, relativeUnit)}`;
  }
  return rangeLabel(range);
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

export type RuleNodeEventLogsPanelProps = {
  ruleChainId: string;
  ruleNodeId: string;
  /** Filled from chain detail when the gateway returns tenant id. */
  chainTenantId?: string;
  /** When set, replaces the interactive list (e.g. new node before first save). */
  disabledHint?: string | null;
  className?: string;
};

export function RuleNodeEventLogsPanel({
  ruleChainId,
  ruleNodeId,
  chainTenantId,
  disabledHint,
  className,
}: RuleNodeEventLogsPanelProps) {
  const [tenantOverride, setTenantOverride] = useState("");
  const effectiveTenant = (chainTenantId?.trim() || tenantOverride.trim()) || "";
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<EventRow[]>([]);
  const [nodeName, setNodeName] = useState("");
  const [nodeType, setNodeType] = useState("");
  const [totalElements, setTotalElements] = useState(0);
  const [preview, setPreview] = useState<PreviewState>(null);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<TimeWindowMode>("last");
  const [draftMode, setDraftMode] = useState<TimeWindowMode>("last");
  const [activeLastPreset, setActiveLastPreset] = useState<LastPresetId>("15m");
  const [draftLastPreset, setDraftLastPreset] = useState<LastPresetId>("15m");
  const [activeRelativeValue, setActiveRelativeValue] = useState(15);
  const [activeRelativeUnit, setActiveRelativeUnit] = useState<RelativeUnit>("minutes");
  const [draftRelativeValue, setDraftRelativeValue] = useState(15);
  const [draftRelativeUnit, setDraftRelativeUnit] = useState<RelativeUnit>("minutes");
  const [activeRange, setActiveRange] = useState<EventRange>(() => defaultEventRange());
  const [draftRange, setDraftRange] = useState<EventRange>(() => defaultEventRange());

  const load = useCallback(
    async (nextPage = page, nextPageSize = pageSize, nextRange = activeRange) => {
      if (disabledHint) return;
      const rid = ruleNodeId.trim();
      const cid = ruleChainId.trim();
      if (!rid || !cid) {
        toast.error("Missing rule node or chain id.");
        return;
      }
      if (!effectiveTenant) {
        toast.error("Tenant id is required for event logs.");
        return;
      }
      setPage(nextPage);
      setLoading(true);
      try {
        const raw = await getRuleNodeEvents({
          rule_chain_id: cid,
          tenant_id: effectiveTenant,
          node_id: rid,
          start_time: formatApiTimestamp(nextRange.from),
          end_time: formatApiTimestamp(nextRange.to),
          page: nextPage,
          page_size: nextPageSize,
          event_type: "DEBUG_RULE_NODE",
        });
        const parsed = parseNodeEventsResponse(raw, rid);
        setRows(parsed.rows);
        setNodeName(parsed.nodeName);
        setNodeType(parsed.nodeType);
        setTotalElements(parsed.totalElements);
      } catch (e) {
        toast.error(getDisplayErrorMessage(e, "Could not load event logs."));
        setRows([]);
        setNodeName("");
        setNodeType("");
        setTotalElements(0);
      } finally {
        setLoading(false);
      }
    },
    [activeRange, disabledHint, effectiveTenant, page, pageSize, ruleChainId, ruleNodeId],
  );

  useEffect(() => {
    if (disabledHint || !effectiveTenant || !ruleChainId.trim() || !ruleNodeId.trim()) return;
    if (!chainTenantId?.trim() && !looksLikeUuid(effectiveTenant)) return;
    void load(page, pageSize, activeRange);
  }, [activeRange, chainTenantId, disabledHint, effectiveTenant, load, page, pageSize, ruleChainId, ruleNodeId]);

  const syncDraftFromActive = useCallback(() => {
    setDraftMode(activeMode);
    setDraftLastPreset(activeLastPreset);
    setDraftRelativeValue(activeRelativeValue);
    setDraftRelativeUnit(activeRelativeUnit);
    setDraftRange(cloneRange(activeRange));
  }, [activeLastPreset, activeMode, activeRange, activeRelativeUnit, activeRelativeValue]);

  const applyTimeWindow = useCallback(() => {
    let nextRange: EventRange;

    if (draftMode === "last") {
      nextRange = rangeFromPreset(draftLastPreset);
    } else if (draftMode === "relative") {
      if (!Number.isFinite(draftRelativeValue) || draftRelativeValue <= 0) {
        toast.error("Relative time value must be greater than zero.");
        return;
      }
      nextRange = rangeFromRelative(draftRelativeValue, draftRelativeUnit);
    } else {
      if (draftRange.from.getTime() > draftRange.to.getTime()) {
        toast.error("From date must be before To date.");
        return;
      }
      nextRange = cloneRange(draftRange);
    }

    setActiveMode(draftMode);
    setActiveLastPreset(draftLastPreset);
    setActiveRelativeValue(Math.max(1, Math.floor(draftRelativeValue)));
    setActiveRelativeUnit(draftRelativeUnit);
    setActiveRange(nextRange);
    setPage(0);
    setRangeOpen(false);
  }, [draftLastPreset, draftMode, draftRange, draftRelativeUnit, draftRelativeValue]);

  const handlePaginationChange = useCallback(
    ({
      currentPage,
      limit,
    }: {
      currentPage: number;
      limit: number;
      sortedColumns?: Record<string, "asc" | "desc">;
    }) => {
      setPage((prev) => (prev === currentPage ? prev : currentPage));
      setPageSize((prev) => (prev === limit ? prev : limit));
    },
    [],
  );

  const openPreview = useCallback((title: string, content: string) => {
    setPreview({ title, content });
  }, []);

  const displayRows = useMemo(
    () =>
      [...rows]
        .sort((left, right) => eventRowTime(right) - eventRowTime(left))
        .map((row, index) => toEventLogTableRow(row, index)),
    [rows],
  );

  const columns = useMemo<ColumnDef<EventLogTableRow>[]>(
    () => [
      {
        accessorKey: "eventTime",
        header: "Event time",
        enableSorting: false,
        size: 128,
        cell: ({ row }) => (
          <div className="text-[13px] leading-5">
            <div>{row.original.eventDate}</div>
            <div>{row.original.eventTimeText || "—"}</div>
          </div>
        ),
      },
      {
        accessorKey: "server",
        header: "Server",
        enableSorting: false,
        size: 112,
        cell: ({ row }) => <CellText value={row.original.server} />,
      },
      {
        accessorKey: "type",
        header: "Type",
        enableSorting: false,
        size: 76,
        cell: ({ row }) => <CellText value={row.original.type} />,
      },
      {
        accessorKey: "entityType",
        header: "Entity type",
        enableSorting: false,
        size: 108,
        cell: ({ row }) => <CellText value={row.original.entityType} />,
      },
      {
        accessorKey: "entityId",
        header: "Entity Id",
        enableSorting: false,
        size: 132,
        cell: ({ row }) => <CellText value={row.original.entityId} mono />,
      },
      {
        accessorKey: "messageId",
        header: "Message Id",
        enableSorting: false,
        size: 132,
        cell: ({ row }) => <CellText value={row.original.messageId} mono />,
      },
      {
        accessorKey: "messageType",
        header: "Message Type",
        enableSorting: false,
        size: 132,
        cell: ({ row }) => <CellText value={row.original.messageType} />,
      },
      {
        accessorKey: "relationType",
        header: "Relation Type",
        enableSorting: false,
        size: 112,
        cell: ({ row }) => <CellText value={row.original.relationType} />,
      },
      {
        accessorKey: "data",
        header: "Data",
        enableSorting: false,
        size: 88,
        cell: ({ row }) => (
          <PreviewButton label="Data" value={row.original.data} onOpen={openPreview} />
        ),
      },
      {
        accessorKey: "metadata",
        header: "Metadata",
        enableSorting: false,
        size: 88,
        cell: ({ row }) => (
          <PreviewButton label="Metadata" value={row.original.metadata} onOpen={openPreview} />
        ),
      },
      {
        accessorKey: "error",
        header: "Error",
        enableSorting: false,
        size: 88,
        cell: ({ row }) => (
          <PreviewButton label="Error" value={row.original.error} onOpen={openPreview} />
        ),
      },
    ],
    [openPreview],
  );

  if (disabledHint) {
    return (
      <div className={cn("rounded-md border border-dashed border-border bg-muted/20 px-3 py-4 text-center", className)}>
        <p className="text-xs text-muted-foreground">{disabledHint}</p>
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden", className)}>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-background">
        {/* {(nodeName || nodeType) && (
          <div className="shrink-0 border-b border-border bg-muted/20 px-2.5 py-2">
            <p className="text-sm font-semibold text-foreground">{nodeName || "Selected node"}</p>
            {nodeType ? <p className="text-[11px] text-muted-foreground">{nodeType}</p> : null}
          </div>
        )} */}
        <div className="shrink-0 flex flex-wrap items-end gap-2 border-b border-border px-2.5 py-2.5">
          <div className="min-w-[9rem] space-y-1">
            <Label className="text-[10px] text-muted-foreground">Event type</Label>
            <div className="border-b border-border pb-1 text-sm font-medium text-foreground">Debug</div>
          </div>
          <div className="min-w-[15rem] space-y-1">
            <Label className="text-[10px] text-muted-foreground">Date range</Label>
            <Popover
              open={rangeOpen}
              onOpenChange={(open) => {
                setRangeOpen(open);
                if (open) syncDraftFromActive();
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8.5 min-w-[16rem] justify-start gap-2 px-2.5 text-left text-sm font-medium"
                >
                  <Clock3 className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate">
                    {timeWindowLabel(
                      activeMode,
                      activeRange,
                      activeLastPreset,
                      activeRelativeValue,
                      activeRelativeUnit,
                    )}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className={cn(
                  "max-w-[calc(100vw-2rem)] p-0",
                  draftMode === "range" ? "w-[46rem]" : "w-[34rem]",
                )}
              >
                <div className="space-y-3 p-3">
                  <div className="space-y-2">
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-foreground">Time window</p>
                    </div>
                    <div className="inline-flex rounded-full bg-muted p-1">
                      {(["last", "range", "relative"] as TimeWindowMode[]).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[11px] font-medium capitalize transition-colors",
                            draftMode === mode
                              ? "bg-background text-primary shadow-sm"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                          onClick={() => setDraftMode(mode)}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  {draftMode === "last" ? (
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {LAST_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          className={cn(
                            "rounded-md border px-2.5 py-2 text-left text-[13px] transition-colors",
                            draftLastPreset === preset.id
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-primary/40 hover:bg-muted/40",
                          )}
                          onClick={() => setDraftLastPreset(preset.id)}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {draftMode === "relative" ? (
                    <div className="grid gap-2.5 sm:grid-cols-[9rem_10rem]">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Value</Label>
                        <Input
                          type="number"
                          min={1}
                          value={String(draftRelativeValue)}
                          onChange={(e) => setDraftRelativeValue(Math.max(1, Number(e.target.value) || 1))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Unit</Label>
                        <Select
                          value={draftRelativeUnit}
                          onValueChange={(value) => setDraftRelativeUnit(value as RelativeUnit)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="minutes">Minutes</SelectItem>
                            <SelectItem value="hours">Hours</SelectItem>
                            <SelectItem value="days">Days</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="sm:col-span-2 text-[11px] text-muted-foreground">
                        Events will be loaded for the last {draftRelativeValue}{" "}
                        {relativeUnitLabel(draftRelativeValue, draftRelativeUnit)} from now.
                      </p>
                    </div>
                  ) : null}

                  {draftMode === "range" ? (
                    <div className="grid gap-3 lg:grid-cols-[15rem_1fr]">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">From</Label>
                          <Input
                            type="datetime-local"
                            value={formatDateTimeLocal(draftRange.from)}
                            onChange={(e) =>
                              setDraftRange((prev) => ({
                                ...prev,
                                from: e.target.value ? new Date(e.target.value) : prev.from,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">To</Label>
                          <Input
                            type="datetime-local"
                            value={formatDateTimeLocal(draftRange.to)}
                            onChange={(e) =>
                              setDraftRange((prev) => ({
                                ...prev,
                                to: e.target.value ? new Date(e.target.value) : prev.to,
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="rounded-md border border-border">
                        <Calendar
                          mode="range"
                          numberOfMonths={1}
                          selected={
                            {
                              from: draftRange.from,
                              to: draftRange.to,
                            } as DayPickerDateRange
                          }
                          defaultMonth={draftRange.from}
                          onSelect={(range) => {
                            if (!range?.from && !range?.to) return;
                            setDraftRange((prev) => ({
                              from: range?.from ? mergeDatePart(range.from, prev.from) : prev.from,
                              to: range?.to
                                ? mergeDatePart(range.to, prev.to)
                                : range?.from
                                  ? mergeDatePart(range.from, prev.to)
                                  : prev.to,
                            }));
                          }}
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className="flex justify-end gap-2 border-t border-border pt-2.5">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        syncDraftFromActive();
                        setRangeOpen(false);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="button" onClick={applyTimeWindow}>
                      Apply
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          {!chainTenantId?.trim() ? (
            <div className="min-w-[13rem] flex-1 space-y-1">
              <Label className="text-[10px] text-muted-foreground">Tenant id</Label>
              <Input
                value={tenantOverride}
                onChange={(e) => setTenantOverride(e.target.value)}
                className="h-8.5 font-mono text-[11px]"
                placeholder="ThingsBoard tenant UUID"
                spellCheck={false}
              />
            </div>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9"
              disabled={loading}
              onClick={() => void load()}
              title="Refresh"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <TableWithPagination
            key={`${ruleChainId}|${ruleNodeId}|${effectiveTenant}|${activeRange.from.getTime()}|${activeRange.to.getTime()}`}
            data={displayRows}
            columns={columns}
            totalRows={totalElements}
            scrollContainerClassName="min-h-0 flex-1 max-h-none"
            pagination={{
              steps: PAGINATION_STEPS,
              currentPage: page,
              pageSize,
            }}
            loading={loading}
            onChangePagination={handlePaginationChange}
            paginationSummary="range"
          />
        </div>
      </div>
      <Dialog open={preview != null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-h-[85vh] max-w-4xl">
          <DialogHeader>
            <DialogTitle>{preview?.title ?? "Details"}</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto rounded-md border border-border bg-muted/20 p-3">
            <pre className="whitespace-pre-wrap break-words font-mono text-xs text-foreground">
              {preview?.content ?? ""}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
