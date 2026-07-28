import { useCallback, useEffect, useMemo, useState } from "react";
import { type DateRange as DayPickerDateRange } from "react-day-picker";
import { Clock3, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardAction, CardContent, CardHeader } from "@/components/ui/card";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { TablePager, DEVICE_DETAIL_TOOLBAR_ICON_BTN } from "./DeviceDetailTabShared";

type EventRowView = {
  id: string;
  time: string;
  type: string;
  details: string;
};

type EventRange = { from: Date; to: Date };
type TimeWindowMode = "last" | "range" | "relative";
type LastPresetId = "15m" | "1h" | "6h" | "12h" | "1d" | "7d";
type RelativeUnit = "minutes" | "hours" | "days";

const LAST_PRESETS: { id: LastPresetId; label: string; minutes: number }[] = [
  { id: "15m", label: "Last 15 minutes", minutes: 15 },
  { id: "1h", label: "Last hour", minutes: 60 },
  { id: "6h", label: "Last 6 hours", minutes: 6 * 60 },
  { id: "12h", label: "Last 12 hours", minutes: 12 * 60 },
  { id: "1d", label: "Last day", minutes: 24 * 60 },
  { id: "7d", label: "Last 7 days", minutes: 7 * 24 * 60 },
];

type DeviceEventsTabProps = {
  eventType: "ERROR" | "LC_EVENT" | "STATS";
  eventStart: number;
  eventEnd: number;
  loading: boolean;
  rows: EventRowView[];
  totalItems: number;
  page: number;
  pageSize: number;
  onEventTypeChange: (value: "ERROR" | "LC_EVENT" | "STATS") => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onTimeRangeChange: (start: number, end: number) => void;
  onRefresh: () => void;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toDatetimeLocalValue(value: number): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): number {
  return new Date(value).getTime();
}

function formatDateTimeLocal(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

export function DeviceEventsTab({
  eventType,
  eventStart,
  eventEnd,
  loading,
  rows,
  totalItems,
  page,
  pageSize,
  onEventTypeChange,
  onPageChange,
  onPageSizeChange,
  onTimeRangeChange,
  onRefresh,
}: DeviceEventsTabProps) {
  const externalRange = useMemo<EventRange>(
    () => ({ from: new Date(eventStart), to: new Date(eventEnd) }),
    [eventEnd, eventStart],
  );
  const [rangeOpen, setRangeOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<TimeWindowMode>("range");
  const [draftMode, setDraftMode] = useState<TimeWindowMode>("range");
  const [activeLastPreset, setActiveLastPreset] = useState<LastPresetId>("15m");
  const [draftLastPreset, setDraftLastPreset] = useState<LastPresetId>("15m");
  const [activeRelativeValue, setActiveRelativeValue] = useState(15);
  const [activeRelativeUnit, setActiveRelativeUnit] = useState<RelativeUnit>("minutes");
  const [draftRelativeValue, setDraftRelativeValue] = useState(15);
  const [draftRelativeUnit, setDraftRelativeUnit] = useState<RelativeUnit>("minutes");
  const [activeRange, setActiveRange] = useState<EventRange>(() => cloneRange(externalRange));
  const [draftRange, setDraftRange] = useState<EventRange>(() => cloneRange(externalRange));

  useEffect(() => {
    if (!rangeOpen) {
      const nextRange = cloneRange(externalRange);
      setActiveRange(nextRange);
      setDraftRange(cloneRange(nextRange));
    }
  }, [externalRange, rangeOpen]);

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
      const nextStart = fromDatetimeLocalValue(formatDateTimeLocal(draftRange.from));
      const nextEnd = fromDatetimeLocalValue(formatDateTimeLocal(draftRange.to));
      if (!Number.isFinite(nextStart) || !Number.isFinite(nextEnd)) {
        toast.error("Please enter a valid time range.");
        return;
      }
      if (nextStart > nextEnd) {
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
    setDraftRange(cloneRange(nextRange));
    onTimeRangeChange(nextRange.from.getTime(), nextRange.to.getTime());
    setRangeOpen(false);
  }, [draftLastPreset, draftMode, draftRange, draftRelativeUnit, draftRelativeValue, onTimeRangeChange]);

  return (
    <TabsContent value="events" className="mt-1 p-0 data-[state=active]:flex data-[state=active]:h-full data-[state=active]:flex-col">
      <Card className="border-border/70 p-0 gap-0 flex h-full flex-col">
        <CardHeader className="gap-2 px-3 py-2">
          <div className="flex min-w-0 flex-wrap items-end gap-2">
            <div className="min-w-[9rem] space-y-1">
              <Label className="text-[10px] text-muted-foreground">Event type</Label>
              <Select value={eventType} onValueChange={(value) => onEventTypeChange(value as typeof eventType)}>
                <SelectTrigger className="h-9 w-[11rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ERROR">ERROR</SelectItem>
                  <SelectItem value="LC_EVENT">LC_EVENT</SelectItem>
                  <SelectItem value="STATS">STATS</SelectItem>
                </SelectContent>
              </Select>
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
                    className="h-9 min-w-[16rem] justify-start gap-2 px-2.5 text-left text-sm font-medium"
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
                      <p className="text-sm font-semibold text-foreground">Time window</p>
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
                        <p className="text-[11px] text-muted-foreground sm:col-span-2">
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
          </div>

          <CardAction>
            <Button type="button" variant="ghost" size="icon" className={DEVICE_DETAIL_TOOLBAR_ICON_BTN} onClick={onRefresh} disabled={loading} title="Refresh events">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="min-h-0 flex flex-1 flex-col p-0">
          <div className="min-h-0 flex-1 overflow-auto border-t border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-40 text-center text-sm text-muted-foreground">
                      {loading ? "Loading events..." : "No events found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap">{row.time}</TableCell>
                      <TableCell>{row.type}</TableCell>
                      <TableCell className="max-w-[42rem] break-all font-mono text-xs">{row.details}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <TablePager
            page={page}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </CardContent>
      </Card>
    </TabsContent>
  );
}
