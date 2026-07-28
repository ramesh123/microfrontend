import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  Check,
  ChevronDown,
  CircleHelp,
  Clipboard,
  Clock,
  Copy,
  Download,
  FileText,
  ImagePlus,
  LayoutGrid,
  Link2,
  List,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Presentation,
  RefreshCw,
  Reply,
  Search,
  Share2,
  Trash2,
  Upload,
  UserPlus,
  ImageOff,
  X,
} from "lucide-react";
import { toast } from "sonner";

import TableWithPagination from "@/common/tableWithPagination";
import {
  type CustomerOption,
  createDashboard,
  deleteDashboard,
  entityIdFromTb,
  exportDashboardFile,
  getDashboard,
  getDashboardAuditLogs,
  getDashboardImagePreview,
  importDashboard,
  listDashboardImages,
  listDashboardCustomers,
  listAvailableCustomers,
  listDashboards,
  resolveDashboardIdFromPayload,
  type DashboardAssignment,
  type DashboardAuditLog,
  type DashboardGalleryImage,
  type DashboardSummary,
  updateDashboardPublicStatus,
} from "@/controllers/thingsboarddashbaordapis";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JsonBlock, TablePager } from "@/pages/IoTGatewayDevices/DeviceDetailTabShared";
import { cn } from "@/lib/utils";

type DashboardTableRow = {
  id: string;
  raw: DashboardSummary;
  title: string;
  createdDisplay: string;
  createdSortKey: number;
  assignedCustomersLabel: string;
  isPublic: boolean;
};
const PAGINATION_STEPS = [10, 20, 50, 100];

/** Row / header selection: clearer border on white table cells */
const DASHBOARD_TABLE_ROW_CHECKBOX_CLASS =
  "size-4 border-2 border-foreground/25 bg-background shadow-sm dark:border-foreground/40 dark:bg-muted/20";

/** Public column: read-only; keep full opacity so the box stays visible */
const DASHBOARD_TABLE_PUBLIC_CHECKBOX_CLASS =
  "size-[18px] border-2 border-foreground/25 bg-muted/40 shadow-sm disabled:cursor-default disabled:opacity-100 dark:border-foreground/35 dark:bg-muted/30";

function formatCreatedTime(createdTime: number | null | undefined): { display: string; sortKey: number } {
  if (typeof createdTime !== "number" || !Number.isFinite(createdTime)) {
    return { display: "—", sortKey: 0 };
  }
  try {
    return { display: format(createdTime, "yyyy-MM-dd HH:mm:ss"), sortKey: createdTime };
  } catch {
    return { display: String(createdTime), sortKey: createdTime };
  }
}

/**
 * Same tier labels as WorkflowExecution (`HomePage/components/WorkflowExecution`).
 * `createdTimeMs` is epoch milliseconds (ThingsBoard `createdTime`).
 */
function createdTimeAgoFromMs(createdTimeMs: number): string {
  if (typeof createdTimeMs !== "number" || !Number.isFinite(createdTimeMs) || createdTimeMs <= 0) {
    return "—";
  }
  const diffMs = Date.now() - createdTimeMs;
  if (diffMs < 0) return "Just now";

  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) {
    const remMonths = months % 12;
    return remMonths > 0 ? `${years}y ${remMonths}mo ago` : `${years}y ago`;
  }
  if (months > 0) {
    const remDays = days % 30;
    return remDays > 0 ? `${months}mo ${remDays}d ago` : `${months}mo ago`;
  }
  if (days > 0) {
    const remHours = hours % 24;
    return remHours > 0 ? `${days}d ${remHours}h ago` : `${days}d ago`;
  }
  if (hours > 0) {
    const remMinutes = minutes % 60;
    return remMinutes > 0 ? `${hours}h ${remMinutes}m ago` : `${hours}h ago`;
  }
  if (minutes > 0) {
    return `${minutes}m ago`;
  }
  return "Just now";
}

function formatGalleryBytes(bytes: number | null | undefined): string {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDashboardAuditTimestamp(createdTime: number | null | undefined): string {
  if (typeof createdTime !== "number" || !Number.isFinite(createdTime)) return "—";
  try {
    return format(new Date(createdTime), "yyyy-MM-dd HH:mm:ss");
  } catch {
    return "—";
  }
}

const DASHBOARD_AUDIT_ACTION_LABELS: Record<string, string> = {
  ASSIGNED_TO_CUSTOMER: "Added",
  UNASSIGNED_FROM_CUSTOMER: "Removed",
};

function dashboardAuditActionTypeLabel(actionType: string | null | undefined): string {
  const raw = typeof actionType === "string" ? actionType.trim() : "";
  if (!raw) return "—";
  const mapped = DASHBOARD_AUDIT_ACTION_LABELS[raw];
  if (mapped) return mapped;
  return raw
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

function dashboardAuditStatusDisplay(status: string | null | undefined): string {
  const raw = typeof status === "string" ? status.trim() : "";
  if (!raw) return "—";
  return raw.charAt(0) + raw.slice(1).toLowerCase();
}

const AUDIT_RELATIVE_OPTIONS = [
  { key: "yesterday", label: "Yesterday" },
  { key: "day_before_yesterday", label: "Day before yesterday" },
  { key: "this_day_last_week", label: "This day last week" },
  { key: "previous_week_sun_sat", label: "Previous week (Sun - Sat)" },
  { key: "previous_week_mon_sun", label: "Previous week (Mon - Sun)" },
  { key: "previous_month", label: "Previous month" },
  { key: "previous_quarter", label: "Previous quarter" },
  { key: "previous_half_year", label: "Previous half year" },
  { key: "previous_year", label: "Previous year" },
  { key: "current_hour", label: "Current hour" },
  { key: "current_day", label: "Current day" },
  { key: "current_day_so_far", label: "Current day so far" },
  { key: "current_week_sun_sat", label: "Current week (Sun - Sat)" },
  { key: "current_week_mon_sun", label: "Current week (Mon - Sun)" },
  { key: "current_week_so_far_sun_sat", label: "Current week so far (Sun - Sat)" },
  { key: "current_week_so_far_mon_sun", label: "Current week so far (Mon - Sun)" },
  { key: "current_month", label: "Current month" },
  { key: "current_month_so_far", label: "Current month so far" },
  { key: "current_quarter", label: "Current quarter" },
  { key: "current_quarter_so_far", label: "Current quarter so far" },
  { key: "current_half_year", label: "Current half year" },
  { key: "current_half_year_so_far", label: "Current half year so far" },
  { key: "current_year", label: "Current year" },
  { key: "current_year_so_far", label: "Current year so far" },
] as const;

type AuditRelativeWindowKey = (typeof AUDIT_RELATIVE_OPTIONS)[number]["key"];

type DashboardAuditTimeWindow =
  | { type: "all" }
  | { type: "last"; durationMs: number; label: string }
  | { type: "range"; startMs: number; endMs: number }
  | { type: "relative"; key: AuditRelativeWindowKey; label: string };

const DASHBOARD_AUDIT_DEFAULT_TIME_WINDOW: DashboardAuditTimeWindow = {
  type: "last",
  durationMs: 24 * 60 * 60 * 1000,
  label: "Last 1 day",
};

const AUDIT_LAST_PRESETS: { id: string; label: string; durationMs: number }[] = [
  { id: "30d", label: "30 days", durationMs: 30 * 24 * 60 * 60 * 1000 },
  { id: "7d", label: "7 days", durationMs: 7 * 24 * 60 * 60 * 1000 },
  { id: "1d", label: "1 day", durationMs: 24 * 60 * 60 * 1000 },
  { id: "12h", label: "12 hours", durationMs: 12 * 60 * 60 * 1000 },
  { id: "10h", label: "10 hours", durationMs: 10 * 60 * 60 * 1000 },
  { id: "5h", label: "5 hours", durationMs: 5 * 60 * 60 * 1000 },
  { id: "2h", label: "2 hours", durationMs: 2 * 60 * 60 * 1000 },
  { id: "1h", label: "1 hour", durationMs: 60 * 60 * 1000 },
  { id: "30m", label: "30 minutes", durationMs: 30 * 60 * 1000 },
  { id: "15m", label: "15 minutes", durationMs: 15 * 60 * 1000 },
  { id: "10m", label: "10 minutes", durationMs: 10 * 60 * 1000 },
  { id: "5m", label: "5 minutes", durationMs: 5 * 60 * 1000 },
  { id: "2m", label: "2 minutes", durationMs: 2 * 60 * 1000 },
  { id: "1m", label: "1 minute", durationMs: 60 * 1000 },
  { id: "30s", label: "30 seconds", durationMs: 30 * 1000 },
  { id: "15s", label: "15 seconds", durationMs: 15 * 1000 },
  { id: "10s", label: "10 seconds", durationMs: 10 * 1000 },
  { id: "5s", label: "5 seconds", durationMs: 5 * 1000 },
  { id: "1s", label: "1 second", durationMs: 1000 },
];

function startOfLocalDay(d: Date, addDays = 0): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + addDays, 0, 0, 0, 0);
}

function endOfLocalDay(d: Date, addDays = 0): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + addDays, 23, 59, 59, 999);
}

/** Calendar week containing `d`, starting Sunday 00:00. */
function startOfWeekSun(d: Date): Date {
  return startOfLocalDay(d, -d.getDay());
}

/** Calendar week containing `d`, starting Monday 00:00. */
function startOfWeekMon(d: Date): Date {
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return startOfLocalDay(d, offset);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function startOfQuarter(d: Date): Date {
  const q0 = Math.floor(d.getMonth() / 3) * 3;
  return new Date(d.getFullYear(), q0, 1, 0, 0, 0, 0);
}

function endOfQuarter(d: Date): Date {
  const s = startOfQuarter(d);
  return new Date(s.getFullYear(), s.getMonth() + 3, 0, 23, 59, 59, 999);
}

function startOfHalfYear(d: Date): Date {
  return d.getMonth() < 6
    ? new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0)
    : new Date(d.getFullYear(), 6, 1, 0, 0, 0, 0);
}

function endOfHalfYear(d: Date): Date {
  return d.getMonth() < 6
    ? new Date(d.getFullYear(), 6, 0, 23, 59, 59, 999)
    : new Date(d.getFullYear(), 12, 0, 23, 59, 59, 999);
}

function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
}

function endOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
}

function relativeAuditWindowBounds(key: AuditRelativeWindowKey, now = Date.now()): { start: number; end: number } {
  const d = new Date(now);

  switch (key) {
    case "yesterday":
      return { start: startOfLocalDay(d, -1).getTime(), end: endOfLocalDay(d, -1).getTime() };
    case "day_before_yesterday":
      return { start: startOfLocalDay(d, -2).getTime(), end: endOfLocalDay(d, -2).getTime() };
    case "this_day_last_week":
      return { start: startOfLocalDay(d, -7).getTime(), end: endOfLocalDay(d, -7).getTime() };
    case "previous_week_sun_sat": {
      const thisSun = startOfWeekSun(d);
      const prevSun = new Date(thisSun);
      prevSun.setDate(prevSun.getDate() - 7);
      return { start: prevSun.getTime(), end: endOfLocalDay(prevSun, 6).getTime() };
    }
    case "previous_week_mon_sun": {
      const thisMon = startOfWeekMon(d);
      const prevMon = new Date(thisMon);
      prevMon.setDate(prevMon.getDate() - 7);
      return { start: prevMon.getTime(), end: endOfLocalDay(prevMon, 6).getTime() };
    }
    case "previous_month": {
      const firstThis = startOfMonth(d);
      const lastPrev = new Date(firstThis.getTime() - 1);
      const y = lastPrev.getFullYear();
      const m = lastPrev.getMonth();
      return {
        start: new Date(y, m, 1, 0, 0, 0, 0).getTime(),
        end: new Date(y, m + 1, 0, 23, 59, 59, 999).getTime(),
      };
    }
    case "previous_quarter": {
      const curQ = startOfQuarter(d);
      const lastPrev = new Date(curQ.getTime() - 1);
      return { start: startOfQuarter(lastPrev).getTime(), end: endOfQuarter(lastPrev).getTime() };
    }
    case "previous_half_year": {
      const curH = startOfHalfYear(d);
      const lastPrev = new Date(curH.getTime() - 1);
      return { start: startOfHalfYear(lastPrev).getTime(), end: endOfHalfYear(lastPrev).getTime() };
    }
    case "previous_year":
      return {
        start: new Date(d.getFullYear() - 1, 0, 1, 0, 0, 0, 0).getTime(),
        end: new Date(d.getFullYear() - 1, 11, 31, 23, 59, 59, 999).getTime(),
      };
    case "current_hour":
      return {
        start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), 0, 0, 0).getTime(),
        end: now,
      };
    case "current_day":
      return { start: startOfLocalDay(d, 0).getTime(), end: endOfLocalDay(d, 0).getTime() };
    case "current_day_so_far":
      return { start: startOfLocalDay(d, 0).getTime(), end: now };
    case "current_week_sun_sat": {
      const s = startOfWeekSun(d);
      return { start: s.getTime(), end: endOfLocalDay(s, 6).getTime() };
    }
    case "current_week_mon_sun": {
      const s = startOfWeekMon(d);
      return { start: s.getTime(), end: endOfLocalDay(s, 6).getTime() };
    }
    case "current_week_so_far_sun_sat":
      return { start: startOfWeekSun(d).getTime(), end: now };
    case "current_week_so_far_mon_sun":
      return { start: startOfWeekMon(d).getTime(), end: now };
    case "current_month":
      return { start: startOfMonth(d).getTime(), end: endOfMonth(d).getTime() };
    case "current_month_so_far":
      return { start: startOfMonth(d).getTime(), end: now };
    case "current_quarter":
      return { start: startOfQuarter(d).getTime(), end: endOfQuarter(d).getTime() };
    case "current_quarter_so_far":
      return { start: startOfQuarter(d).getTime(), end: now };
    case "current_half_year":
      return { start: startOfHalfYear(d).getTime(), end: endOfHalfYear(d).getTime() };
    case "current_half_year_so_far":
      return { start: startOfHalfYear(d).getTime(), end: now };
    case "current_year":
      return { start: startOfYear(d).getTime(), end: endOfYear(d).getTime() };
    case "current_year_so_far":
      return { start: startOfYear(d).getTime(), end: now };
    default:
      return { start: startOfLocalDay(d, 0).getTime(), end: now };
  }
}

function auditWindowToQueryBounds(w: DashboardAuditTimeWindow, now = Date.now()): { start: number; end: number } {
  if (w.type === "all") return { start: 0, end: 0 };
  if (w.type === "last") {
    const dur = Math.max(1000, w.durationMs);
    return { start: now - dur, end: now };
  }
  if (w.type === "range") {
    const start = Math.min(w.startMs, w.endMs);
    const end = Math.max(w.startMs, w.endMs);
    return { start, end };
  }
  return relativeAuditWindowBounds(w.key, now);
}

function formatAuditTimeWindowTriggerLabel(w: DashboardAuditTimeWindow): string {
  if (w.type === "all") return "All time";
  if (w.type === "last") return w.label;
  if (w.type === "range") return "Custom range";
  return w.label;
}

function toDatetimeLocalValue(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(s: string): number {
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : Date.now();
}

function dhmsToMsTotal(days: number, hours: number, minutes: number, seconds: number): number {
  const dd = Math.max(0, Math.trunc(days));
  const hh = Math.max(0, Math.trunc(hours));
  const mm = Math.max(0, Math.min(59, Math.trunc(minutes)));
  const ss = Math.max(0, Math.min(59, Math.trunc(seconds)));
  return (((dd * 24 + hh) * 60 + mm) * 60 + ss) * 1000;
}

function msToDhms(ms: number): { days: number; hours: number; minutes: number; seconds: number } {
  let t = Math.max(0, Math.floor(ms / 1000));
  const seconds = t % 60;
  t = Math.floor(t / 60);
  const minutes = t % 60;
  t = Math.floor(t / 60);
  const hours = t % 24;
  const days = Math.floor(t / 24);
  return { days, hours, minutes, seconds };
}

function matchPresetIdForDuration(durationMs: number): string | null {
  const found = AUDIT_LAST_PRESETS.find((p) => Math.abs(p.durationMs - durationMs) < 2);
  return found?.id ?? null;
}

function galleryImagePublicHref(img: DashboardGalleryImage): string {
  const raw = (typeof img.link === "string" ? img.link : "").trim();
  return raw ? encodeApiResourcePath(raw) : "";
}

/**
 * Builds `image_url` for POST `/iot-dashboard/get-image-preview`: no leading slash,
 * path ends with `/preview`, each segment URI-encoded (matches `api/images/tenant/.../preview`).
 */
function galleryImagePreviewRequestUrl(image: DashboardGalleryImage): string {
  const raw = (typeof image.link === "string" ? image.link : "").trim();
  if (!raw) return "";
  let path = raw;
  if (/^https?:\/\//i.test(path)) {
    try {
      path = new URL(path).pathname;
    } catch {
      return "";
    }
  }
  path = path.replace(/^\/+/, "");
  if (!path.endsWith("/preview")) {
    path = `${path.replace(/\/+$/, "")}/preview`;
  }
  const segments = path.split("/").filter(Boolean);
  return segments
    .map((segment) => {
      try {
        return encodeURIComponent(decodeURIComponent(segment));
      } catch {
        return encodeURIComponent(segment);
      }
    })
    .join("/");
}

/** Encode each path segment so spaces and special chars work in URLs (e.g. tenant image filenames). */
function encodeApiResourcePath(path: string): string {
  const p = path.trim();
  if (!p) return "";
  if (p.startsWith("http://") || p.startsWith("https://")) return p;
  const segments = p.split("/").filter((segment) => segment !== "");
  return `/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`;
}

function toAbsoluteImageUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (typeof window === "undefined") return path;
  try {
    return new URL(path, window.location.origin).href;
  } catch {
    return path;
  }
}

function toSafeFileName(value: string): string {
  return value.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "") || "dashboard";
}

function downloadJsonFile(payload: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  downloadBlobFile(blob, fileName);
}

function downloadBlobFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function assignedCustomerTitles(assignments: DashboardAssignment[] | null | undefined): string {
  if (!Array.isArray(assignments) || assignments.length === 0) return "—";
  const titles = assignments
    .map((assignment) => (typeof assignment?.title === "string" ? assignment.title.trim() : ""))
    .filter(Boolean);
  return titles.length > 0 ? titles.join(", ") : "—";
}

function isDashboardPublic(dashboard: DashboardSummary): boolean {
  if (typeof dashboard.public === "boolean") return dashboard.public;
  return Array.isArray(dashboard.assignedCustomers)
    ? dashboard.assignedCustomers.some((assignment) => Boolean(assignment?.public))
    : false;
}

function toDashboardRow(dashboard: DashboardSummary): DashboardTableRow | null {
  const id = entityIdFromTb(dashboard.id);
  if (!id) return null;
  const created = formatCreatedTime(dashboard.createdTime);
  return {
    id,
    raw: dashboard,
    title:
      (typeof dashboard.title === "string" && dashboard.title.trim()) ||
      (typeof dashboard.name === "string" && dashboard.name.trim()) ||
      "Untitled dashboard",
    createdDisplay: created.display,
    createdSortKey: created.sortKey,
    assignedCustomersLabel: assignedCustomerTitles(dashboard.assignedCustomers),
    isPublic: isDashboardPublic(dashboard),
  };
}

/** Gallery thumbnails via POST `/iot-dashboard/get-image-preview` (auth on axios client). */
function GalleryImageThumb({
  image,
  frameClassName,
  imgClassName,
}: {
  image: DashboardGalleryImage;
  frameClassName?: string;
  imgClassName?: string;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const activeBlobRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (activeBlobRef.current) {
      URL.revokeObjectURL(activeBlobRef.current);
      activeBlobRef.current = null;
    }
    setBlobUrl(null);
    setPhase("loading");

    const imageUrl = galleryImagePreviewRequestUrl(image);
    if (!imageUrl) {
      setPhase("error");
      return () => {};
    }

    const run = async () => {
      try {
        const blob = await getDashboardImagePreview(imageUrl);
        if (cancelled) return;
        if (blob.size === 0 || (blob.type && !blob.type.startsWith("image/"))) {
          setPhase("error");
          return;
        }
        const objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        activeBlobRef.current = objectUrl;
        setBlobUrl(objectUrl);
        setPhase("ready");
      } catch {
        if (!cancelled) setPhase("error");
      }
    };

    void run();

    return () => {
      cancelled = true;
      const u = activeBlobRef.current;
      if (u) {
        URL.revokeObjectURL(u);
        activeBlobRef.current = null;
      }
    };
  }, [image.link]);

  return (
    <div className={cn("relative flex items-center justify-center overflow-hidden bg-muted", frameClassName)}>
      {phase === "ready" && blobUrl ? (
        <img src={blobUrl} alt="" className={cn("h-full w-full object-cover", imgClassName)} />
      ) : phase === "error" ? (
        <ImageOff className="h-5 w-5 shrink-0 text-muted-foreground/70" aria-hidden />
      ) : (
        <div className="h-full w-full animate-pulse bg-muted/80" />
      )}
    </div>
  );
}

export default function ThingsboardDashboardsListPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<DashboardTableRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [textSearch, setTextSearch] = useState("");
  const [sortProperty, setSortProperty] = useState<"title" | "createdTime">("title");
  const [sortOrder, setSortOrder] = useState<"ASC" | "DESC">("DESC");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createCustomerId, setCreateCustomerId] = useState("");
  const [createHideMobile, setCreateHideMobile] = useState(false);
  const [createMobileOrder, setCreateMobileOrder] = useState("");
  const [createImageLink, setCreateImageLink] = useState("");
  const [showImageLinkInput, setShowImageLinkInput] = useState(false);
  const [createAttempted, setCreateAttempted] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importSelectedFile, setImportSelectedFile] = useState<File | null>(null);
  const [importSubmitting, setImportSubmitting] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  const [imageGalleryOpen, setImageGalleryOpen] = useState(false);
  const [imageGalleryView, setImageGalleryView] = useState<"grid" | "list">("grid");
  const [imageGalleryIncludeSystem, setImageGalleryIncludeSystem] = useState(false);
  const [imageGalleryItems, setImageGalleryItems] = useState<DashboardGalleryImage[]>([]);
  const [imageGalleryLoading, setImageGalleryLoading] = useState(false);
  const [imageGalleryPage, setImageGalleryPage] = useState(0);
  const [imageGalleryHasNext, setImageGalleryHasNext] = useState(false);
  const [imageGallerySearch, setImageGallerySearch] = useState("");
  const [galleryUploadPopoverOpen, setGalleryUploadPopoverOpen] = useState(false);
  const galleryUploadInputRef = useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<DashboardTableRow | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteSubmitting, setBulkDeleteSubmitting] = useState(false);
  const [loadingDashboardId, setLoadingDashboardId] = useState<string | null>(null);
  const [updatingPublicDashboardId, setUpdatingPublicDashboardId] = useState<string | null>(null);
  const [exportTarget, setExportTarget] = useState<DashboardTableRow | null>(null);
  const [exportIncludeResources, setExportIncludeResources] = useState(false);
  const [exportSubmitting, setExportSubmitting] = useState(false);
  const [assignCustomersOpen, setAssignCustomersOpen] = useState(false);
  const [assignCustomersTarget, setAssignCustomersTarget] = useState<DashboardTableRow | null>(null);
  const [assignCustomersOptions, setAssignCustomersOptions] = useState<CustomerOption[]>([]);
  const [assignCustomersLoading, setAssignCustomersLoading] = useState(false);
  const [assignCustomerIds, setAssignCustomerIds] = useState<string[]>([]);
  const [assignCustomersPickerOpen, setAssignCustomersPickerOpen] = useState(false);

  const [detailsSheetRow, setDetailsSheetRow] = useState<DashboardTableRow | null>(null);
  const [detailsTab, setDetailsTab] = useState<"details" | "audit" | "version">("details");
  const [detailsTitle, setDetailsTitle] = useState("");
  const [detailsDescription, setDetailsDescription] = useState("");
  const [detailsHideMobile, setDetailsHideMobile] = useState(false);
  const [detailsMobileOrder, setDetailsMobileOrder] = useState("");
  const [detailsImageLink, setDetailsImageLink] = useState("");
  const [showDetailsImageLinkInput, setShowDetailsImageLinkInput] = useState(false);
  const [imageGalleryTarget, setImageGalleryTarget] = useState<"create" | "details">("create");

  const [auditLogs, setAuditLogs] = useState<DashboardAuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditPage, setAuditPage] = useState(0);
  const [auditPageSize, setAuditPageSize] = useState(10);
  const [auditTotalElements, setAuditTotalElements] = useState(0);
  const [auditWindow, setAuditWindow] = useState<DashboardAuditTimeWindow>(DASHBOARD_AUDIT_DEFAULT_TIME_WINDOW);
  const [auditTimePopoverOpen, setAuditTimePopoverOpen] = useState(false);
  const [auditDraftTab, setAuditDraftTab] = useState<"last" | "range" | "relative">("last");
  const [auditDraftLastId, setAuditDraftLastId] = useState<string>("1d");
  const [auditDraftCustom, setAuditDraftCustom] = useState({ days: 0, hours: 12, minutes: 0, seconds: 0 });
  const [auditDraftRangeStart, setAuditDraftRangeStart] = useState("");
  const [auditDraftRangeEnd, setAuditDraftRangeEnd] = useState("");
  const [auditDraftRelativeKey, setAuditDraftRelativeKey] = useState<AuditRelativeWindowKey>("current_day");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditDetailLog, setAuditDetailLog] = useState<DashboardAuditLog | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTextSearch(searchTerm.trim());
      setCurrentPage(0);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  const loadDashboards = useCallback(async () => {
    setLoading(true);
    try {
      const page = await listDashboards({
        page: currentPage,
        page_size: pageSize,
        text_search: textSearch,
        sort_property: sortProperty,
        sort_order: sortOrder,
      });
      const mappedRows = (page.data ?? [])
        .map((dashboard) => toDashboardRow(dashboard))
        .filter((dashboard): dashboard is DashboardTableRow => dashboard !== null);
      setRows(mappedRows);
      setTotalRows(typeof page.totalElements === "number" ? page.totalElements : mappedRows.length);
      setSelectedIds((previous) => {
        const next = new Set<string>();
        for (const id of previous) {
          if (mappedRows.some((row) => row.id === id)) {
            next.add(id);
          }
        }
        return next;
      });
    } catch (error) {
      console.error(error);
      toast.error(getDisplayErrorMessage(error, "Failed to load dashboards."));
      setRows([]);
      setTotalRows(0);
      setSelectedIds(new Set());
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, textSearch, sortProperty, sortOrder]);

  useEffect(() => {
    void loadDashboards();
  }, [loadDashboards]);

  const loadCustomers = useCallback(async () => {
    setCustomersLoading(true);
    try {
      const options = await listAvailableCustomers();
      setCustomers(options);
    } catch (error) {
      console.error(error);
      toast.error(getDisplayErrorMessage(error, "Failed to load customers."));
      setCustomers([]);
    } finally {
      setCustomersLoading(false);
    }
  }, []);

  const loadAssignableCustomers = useCallback(async () => {
    setAssignCustomersLoading(true);
    try {
      const options = await listDashboardCustomers("");
      setAssignCustomersOptions(options);
    } catch (error) {
      console.error(error);
      toast.error(getDisplayErrorMessage(error, "Failed to load customers."));
      setAssignCustomersOptions([]);
    } finally {
      setAssignCustomersLoading(false);
    }
  }, []);

  const openCreateDialog = useCallback(() => {
    setCreateTitle("");
    setCreateDescription("");
    setCreateCustomerId("");
    setCreateHideMobile(false);
    setCreateMobileOrder("");
    setCreateImageLink("");
    setShowImageLinkInput(false);
    setCreateAttempted(false);
    setCreateOpen(true);
    void loadCustomers();
  }, [loadCustomers]);

  const openAssignCustomersDialog = useCallback(
    (dashboard: DashboardTableRow) => {
      const nextIds = Array.from(
        new Set(
          (dashboard.raw.assignedCustomers ?? [])
            .map((assignment) => entityIdFromTb(assignment.customerId))
            .filter(Boolean),
        ),
      );

      setAssignCustomersTarget(dashboard);
      setAssignCustomerIds(nextIds);
      setAssignCustomersPickerOpen(false);
      setAssignCustomersOpen(true);
      void loadAssignableCustomers();
    },
    [loadAssignableCustomers],
  );

  useEffect(() => {
    if (!assignCustomersOpen || !assignCustomersTarget?.isPublic) return;
    const publicCustomer = assignCustomersOptions.find((customer) => customer.isPublic);
    if (!publicCustomer) return;
    setAssignCustomerIds((previous) =>
      previous.includes(publicCustomer.id) ? previous : [...previous, publicCustomer.id],
    );
  }, [assignCustomersOpen, assignCustomersOptions, assignCustomersTarget]);

  const submitCreate = useCallback(async () => {
    setCreateAttempted(true);
    if (!createTitle.trim()) return;
    setCreateSubmitting(true);
    const mobileOrderParsed = Number.parseInt(String(createMobileOrder).trim(), 10);
    const mobile_order = Number.isFinite(mobileOrderParsed) ? mobileOrderParsed : 0;

    const configuration: Record<string, unknown> = {};
    if (createDescription.trim()) {
      configuration.description = createDescription.trim();
    }
    if (createCustomerId) {
      configuration.customer_id = createCustomerId;
    }

    const titleTrimmed = createTitle.trim();
    try {
      const created = await createDashboard({
        title: titleTrimmed,
        image: createImageLink.trim(),
        mobile_hide: createHideMobile,
        mobile_order,
        configuration,
      });
      toast.success(`Created dashboard "${titleTrimmed}".`);
      setCreateOpen(false);
      setCreateTitle("");
      setCreateDescription("");
      setCreateCustomerId("");
      setCreateHideMobile(false);
      setCreateMobileOrder("");
      setCreateImageLink("");
      setShowImageLinkInput(false);
      setCreateAttempted(false);

      const newDashboardId = resolveDashboardIdFromPayload(created);
      if (newDashboardId) {
        try {
          const data = await getDashboard(newDashboardId);
          navigate(`/iot-gateway/dashboards/${encodeURIComponent(newDashboardId)}/editor`, {
            state: {
              dashboard: data,
              dashboardTitle: titleTrimmed,
            },
          });
        } catch {
          navigate(`/iot-gateway/dashboards/${encodeURIComponent(newDashboardId)}/editor`, {
            state: { dashboardTitle: titleTrimmed },
          });
        }
        return;
      }

      void loadDashboards();
    } catch (error) {
      toast.error(getDisplayErrorMessage(error, "Failed to create dashboard."));
    } finally {
      setCreateSubmitting(false);
    }
  }, [
    createTitle,
    createDescription,
    createCustomerId,
    createHideMobile,
    createMobileOrder,
    createImageLink,
    loadDashboards,
    navigate,
  ]);

  const handleImportFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setImportSelectedFile(file);
    event.target.value = "";
  }, []);

  const submitImportDashboard = useCallback(async () => {
    if (!importSelectedFile) {
      toast.error("Choose a file to import.");
      return;
    }
    setImportSubmitting(true);
    try {
      await importDashboard(importSelectedFile);
      toast.success("Dashboard imported.");
      setImportDialogOpen(false);
      setImportSelectedFile(null);
      void loadDashboards();
    } catch (error) {
      toast.error(getDisplayErrorMessage(error, "Import failed."));
    } finally {
      setImportSubmitting(false);
    }
  }, [importSelectedFile, loadDashboards]);

  const loadImageGallery = useCallback(
    async ({ page, append }: { page: number; append: boolean }) => {
      setImageGalleryLoading(true);
      try {
        const result = await listDashboardImages({
          page,
          page_size: 20,
          sort_property: "createdTime",
          sort_order: "DESC",
          image_sub_type: "IMAGE",
          include_system_images: imageGalleryIncludeSystem,
        });
        setImageGalleryHasNext(Boolean(result.hasNext));
        setImageGalleryItems((previous) => (append ? [...previous, ...(result.data ?? [])] : (result.data ?? [])));
        setImageGalleryPage(page);
      } catch (error) {
        toast.error(getDisplayErrorMessage(error, "Failed to load images."));
        if (!append) {
          setImageGalleryItems([]);
          setImageGalleryHasNext(false);
        }
      } finally {
        setImageGalleryLoading(false);
      }
    },
    [imageGalleryIncludeSystem],
  );

  const loadMoreGallery = useCallback(() => {
    void loadImageGallery({ page: imageGalleryPage + 1, append: true });
  }, [imageGalleryPage, loadImageGallery]);

  useEffect(() => {
    if (!imageGalleryOpen) return;
    void loadImageGallery({ page: 0, append: false });
  }, [imageGalleryOpen, imageGalleryIncludeSystem, loadImageGallery]);

  const filteredGalleryImages = useMemo(() => {
    const q = imageGallerySearch.trim().toLowerCase();
    if (!q) return imageGalleryItems;
    return imageGalleryItems.filter((img) => {
      const label = (img.title || img.fileName || "").toLowerCase();
      return label.includes(q);
    });
  }, [imageGalleryItems, imageGallerySearch]);

  const pickGalleryImage = useCallback((img: DashboardGalleryImage) => {
    const href = galleryImagePublicHref(img);
    if (!href) {
      toast.error("This image has no link.");
      return;
    }
    const url = toAbsoluteImageUrl(href);
    if (imageGalleryTarget === "details") {
      setDetailsImageLink(url);
    } else {
      setCreateImageLink(url);
    }
    setImageGalleryOpen(false);
    toast.success("Image selected for dashboard.");
  }, [imageGalleryTarget]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    try {
      await deleteDashboard(deleteTarget.id);
      toast.success(`Deleted "${deleteTarget.title}".`);
      setSelectedIds((previous) => {
        const next = new Set(previous);
        next.delete(deleteTarget.id);
        return next;
      });
      setDeleteTarget(null);
      setDetailsSheetRow((current) => (current?.id === deleteTarget.id ? null : current));
      void loadDashboards();
    } catch (error) {
      toast.error(getDisplayErrorMessage(error, "Delete failed."));
    } finally {
      setDeleteSubmitting(false);
    }
  }, [deleteTarget, loadDashboards]);

  const handlePaginationChange = useCallback(
    ({
      currentPage: page,
      limit,
      sortedColumns,
    }: {
      currentPage: number;
      limit: number;
      sortedColumns?: Record<string, "asc" | "desc">;
    }) => {
      setCurrentPage(page);
      setPageSize(limit);
      const [column, direction] = Object.entries(sortedColumns ?? {})[0] ?? [];
      if (column === "createdTime") {
        setSortProperty("createdTime");
        setSortOrder(direction === "desc" ? "DESC" : "ASC");
        return;
      }
      setSortProperty("title");
      setSortOrder(direction === "asc" ? "ASC" : "DESC");
    },
    [],
  );

  const handleRefresh = useCallback(() => {
    setSearchTerm("");     
  setTextSearch("");     
  setCurrentPage(0); 
    void loadDashboards();
    toast.success("Refreshed");
  }, [loadDashboards]);

  const toggleRow = useCallback((dashboardId: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(dashboardId)) next.delete(dashboardId);
      else next.add(dashboardId);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const allPageSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.id));
  const somePageSelected = rows.some((row) => selectedIds.has(row.id));

  const toggleSelectAllPage = useCallback(() => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      const shouldSelectAll = !(rows.length > 0 && rows.every((row) => previous.has(row.id)));
      for (const row of rows) {
        if (shouldSelectAll) next.add(row.id);
        else next.delete(row.id);
      }
      return next;
    });
  }, [rows]);

  const openExportDialog = useCallback((row: DashboardTableRow) => {
    setExportTarget(row);
    setExportIncludeResources(false);
  }, []);

  const confirmExportDashboard = useCallback(async () => {
    if (!exportTarget) return;
    setExportSubmitting(true);
    try {
      const { blob, filename } = await exportDashboardFile(exportTarget.id, exportIncludeResources);
      const fallbackName = `${toSafeFileName(exportTarget.title || exportTarget.id)}.json`;
      downloadBlobFile(blob, filename || fallbackName);
      toast.success("Export started.");
      setExportTarget(null);
      setExportIncludeResources(false);
    } catch (error) {
      toast.error(getDisplayErrorMessage(error, "Failed to export dashboard."));
    } finally {
      setExportSubmitting(false);
    }
  }, [exportIncludeResources, exportTarget]);

  const selectedAssignedCustomers = useMemo(
    () =>
      assignCustomerIds
        .map((id) => assignCustomersOptions.find((customer) => customer.id === id))
        .filter((customer): customer is CustomerOption => customer != null),
    [assignCustomerIds, assignCustomersOptions],
  );

  const toggleAssignedCustomer = useCallback((customerId: string) => {
    setAssignCustomerIds((previous) =>
      previous.includes(customerId)
        ? previous.filter((id) => id !== customerId)
        : [...previous, customerId],
    );
  }, []);

  const removeAssignedCustomer = useCallback((customerId: string) => {
    setAssignCustomerIds((previous) => previous.filter((id) => id !== customerId));
  }, []);

  const placeholderAction = useCallback((label: string) => {
    toast.info(`${label} is not wired yet.`);
  }, []);

  const handleDashboardTitleClick = useCallback(async (dashboard: DashboardTableRow) => {
    setLoadingDashboardId(dashboard.id);
    try {
      const data = await getDashboard(dashboard.id);
      navigate(`/iot-gateway/dashboards/${encodeURIComponent(dashboard.id)}/editor`, {
        state: {
          dashboard: data,
          dashboardTitle: dashboard.title,
        },
      });
    } catch (error) {
      toast.error(getDisplayErrorMessage(error, "Failed to load dashboard."));
    } finally {
      setLoadingDashboardId((current) => (current === dashboard.id ? null : current));
    }
  }, [navigate]);

  const handleMakeDashboardPublic = useCallback(async (dashboard: DashboardTableRow) => {
    if (dashboard.isPublic) {
      toast.info(`"${dashboard.title}" is already public.`);
      return;
    }

    setUpdatingPublicDashboardId(dashboard.id);
    try {
      await updateDashboardPublicStatus(dashboard.id, true);
      setRows((previous) =>
        previous.map((row) =>
          row.id === dashboard.id
            ? {
                ...row,
                isPublic: true,
                raw: {
                  ...row.raw,
                  public: true,
                },
              }
            : row,
        ),
      );
      toast.success(`"${dashboard.title}" is now public.`);
    } catch (error) {
      toast.error(getDisplayErrorMessage(error, "Failed to update dashboard visibility."));
    } finally {
      setUpdatingPublicDashboardId((current) => (current === dashboard.id ? null : current));
    }
  }, []);

  const handleMakeDashboardPrivate = useCallback(async (dashboard: DashboardTableRow) => {
    if (!dashboard.isPublic) {
      toast.info(`"${dashboard.title}" is already private.`);
      return;
    }

    setUpdatingPublicDashboardId(dashboard.id);
    try {
      await updateDashboardPublicStatus(dashboard.id, false);
      setRows((previous) =>
        previous.map((row) =>
          row.id === dashboard.id
            ? {
                ...row,
                isPublic: false,
                raw: {
                  ...row.raw,
                  public: false,
                },
              }
            : row,
        ),
      );
      toast.success(`"${dashboard.title}" is now private.`);
    } catch (error) {
      toast.error(getDisplayErrorMessage(error, "Failed to update dashboard visibility."));
    } finally {
      setUpdatingPublicDashboardId((current) => (current === dashboard.id ? null : current));
    }
  }, []);

  const selectedRows = useMemo(
    () => rows.filter((row) => selectedIds.has(row.id)),
    [rows, selectedIds],
  );

  const activeDetailRow = useMemo(() => {
    if (!detailsSheetRow) return null;
    return rows.find((row) => row.id === detailsSheetRow.id) ?? detailsSheetRow;
  }, [detailsSheetRow, rows]);

  const loadAuditLogs = useCallback(async () => {
    const id = activeDetailRow?.id ?? "";
    if (!id) return;
    setAuditLoading(true);
    try {
      const now = Date.now();
      const { start, end } = auditWindowToQueryBounds(auditWindow, now);
      const result = await getDashboardAuditLogs({
        dashboard_id: id,
        page_size: auditPageSize,
        page: auditPage,
        sort_property: "createdTime",
        sort_order: "DESC",
        start_time: start,
        end_time: end,
      });
      setAuditLogs(result.data ?? []);
      setAuditTotalElements(
        typeof result.totalElements === "number" ? result.totalElements : (result.data ?? []).length,
      );
    } catch (error) {
      toast.error(getDisplayErrorMessage(error, "Failed to load audit logs."));
      setAuditLogs([]);
      setAuditTotalElements(0);
    } finally {
      setAuditLoading(false);
    }
  }, [activeDetailRow?.id, auditPage, auditPageSize, auditWindow]);

  useEffect(() => {
    if (detailsTab !== "audit" || !activeDetailRow?.id) return;
    void loadAuditLogs();
  }, [detailsTab, activeDetailRow?.id, loadAuditLogs]);

  const filteredAuditLogs = useMemo(() => {
    const query = auditSearch.trim().toLowerCase();
    if (!query) return auditLogs;
    return auditLogs.filter((log) => {
      const haystack = [
        log.userName,
        log.actionType,
        log.actionStatus,
        log.entityName,
        typeof log.actionFailureDetails === "string" ? log.actionFailureDetails : "",
        JSON.stringify(log.actionData ?? {}),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [auditLogs, auditSearch]);

  const syncAuditDraftFromWindow = useCallback((w: DashboardAuditTimeWindow) => {
    const now = Date.now();
    if (w.type === "all") {
      setAuditDraftTab("last");
      setAuditDraftLastId("all_time");
      setAuditDraftRangeStart(toDatetimeLocalValue(now - 86400000));
      setAuditDraftRangeEnd(toDatetimeLocalValue(now));
      setAuditDraftRelativeKey("current_day");
      return;
    }
    if (w.type === "last") {
      setAuditDraftTab("last");
      const id = matchPresetIdForDuration(w.durationMs);
      setAuditDraftLastId(id ?? "custom");
      setAuditDraftCustom(id ? { days: 0, hours: 12, minutes: 0, seconds: 0 } : msToDhms(w.durationMs));
      setAuditDraftRangeStart(toDatetimeLocalValue(now - 86400000));
      setAuditDraftRangeEnd(toDatetimeLocalValue(now));
      setAuditDraftRelativeKey("current_day");
      return;
    }
    if (w.type === "range") {
      setAuditDraftTab("range");
      setAuditDraftRangeStart(toDatetimeLocalValue(w.startMs));
      setAuditDraftRangeEnd(toDatetimeLocalValue(w.endMs));
      setAuditDraftLastId("1d");
      setAuditDraftRelativeKey("current_day");
      return;
    }
    setAuditDraftTab("relative");
    setAuditDraftRelativeKey(w.key);
    setAuditDraftLastId("1d");
    setAuditDraftRangeStart(toDatetimeLocalValue(now - 86400000));
    setAuditDraftRangeEnd(toDatetimeLocalValue(now));
  }, []);

  const applyAuditTimeDraft = useCallback(() => {
    let next: DashboardAuditTimeWindow = DASHBOARD_AUDIT_DEFAULT_TIME_WINDOW;
    if (auditDraftTab === "last") {
      if (auditDraftLastId === "all_time") {
        next = { type: "all" };
      } else if (auditDraftLastId === "custom") {
        const ms = dhmsToMsTotal(
          auditDraftCustom.days,
          auditDraftCustom.hours,
          auditDraftCustom.minutes,
          auditDraftCustom.seconds,
        );
        next = { type: "last", durationMs: Math.max(1000, ms), label: "Custom" };
      } else {
        const preset = AUDIT_LAST_PRESETS.find((item) => item.id === auditDraftLastId);
        next = preset
          ? { type: "last", durationMs: preset.durationMs, label: preset.label }
          : DASHBOARD_AUDIT_DEFAULT_TIME_WINDOW;
      }
    } else if (auditDraftTab === "range") {
      const startMs = fromDatetimeLocalValue(auditDraftRangeStart);
      const endMs = fromDatetimeLocalValue(auditDraftRangeEnd);
      next = { type: "range", startMs: Math.min(startMs, endMs), endMs: Math.max(startMs, endMs) };
    } else {
      const rel = AUDIT_RELATIVE_OPTIONS.find((item) => item.key === auditDraftRelativeKey) ?? AUDIT_RELATIVE_OPTIONS[0];
      next = { type: "relative", key: rel.key, label: rel.label };
    }
    setAuditWindow(next);
    setAuditPage(0);
    setAuditTimePopoverOpen(false);
  }, [
    auditDraftCustom.days,
    auditDraftCustom.hours,
    auditDraftCustom.minutes,
    auditDraftCustom.seconds,
    auditDraftLastId,
    auditDraftRangeEnd,
    auditDraftRangeStart,
    auditDraftRelativeKey,
    auditDraftTab,
  ]);

  useEffect(() => {
    if (!detailsSheetRow) return;
    setDetailsTab("details");
    const raw = detailsSheetRow.raw;
    const titleFromRaw =
      (typeof raw.title === "string" && raw.title.trim()) ||
      (typeof raw.name === "string" && raw.name.trim()) ||
      detailsSheetRow.title;
    setDetailsTitle(titleFromRaw);
    setDetailsDescription(typeof raw.description === "string" ? raw.description : "");
    setDetailsHideMobile(Boolean(raw.mobileHide));
    const mo = raw.mobileOrder;
    setDetailsMobileOrder(mo != null && String(mo).trim() !== "" ? String(mo) : "");
    setDetailsImageLink(typeof raw.image === "string" ? raw.image : "");
    setShowDetailsImageLinkInput(false);
    setAuditPage(0);
    setAuditSearch("");
    setAuditLogs([]);
    setAuditTotalElements(0);
    setAuditDetailLog(null);
    setAuditWindow(DASHBOARD_AUDIT_DEFAULT_TIME_WINDOW);
    setAuditTimePopoverOpen(false);
  }, [detailsSheetRow]);

  const openDetailsSheet = useCallback((row: DashboardTableRow) => {
    setDetailsSheetRow(row);
  }, []);

  const selectedCountLabel = `${selectedIds.size} dashboard${selectedIds.size === 1 ? "" : "s"} selected`;

  const copySelectedDashboardIds = useCallback(async () => {
    if (selectedIds.size === 0) return;
    try {
      await navigator.clipboard.writeText(Array.from(selectedIds).join("\n"));
      toast.success(selectedIds.size === 1 ? "Dashboard id copied." : "Dashboard ids copied.");
    } catch {
      toast.error("Could not copy dashboard ids.");
    }
  }, [selectedIds]);

  const copyDetailsDashboardId = useCallback(async () => {
    if (!activeDetailRow) return;
    try {
      await navigator.clipboard.writeText(activeDetailRow.id);
      toast.success("Dashboard id copied.");
    } catch {
      toast.error("Could not copy dashboard id.");
    }
  }, [activeDetailRow]);

  const detailsPublicLink = useMemo(() => {
    if (!activeDetailRow?.isPublic) return "";
    return `${window.location.origin}/iot-gateway/dashboards/public/${encodeURIComponent(activeDetailRow.id)}`;
  }, [activeDetailRow]);

  const exportSelectedDashboards = useCallback(() => {
    if (selectedRows.length === 0) return;
    const payload = selectedRows.length === 1 ? selectedRows[0].raw : selectedRows.map((row) => row.raw);
    const fileName =
      selectedRows.length === 1
        ? `${toSafeFileName(selectedRows[0].title || selectedRows[0].id)}.json`
        : `dashboards-${selectedRows.length}.json`;
    downloadJsonFile(payload, fileName);
    toast.success(selectedRows.length === 1 ? "Export started." : "Selected dashboards exported.");
  }, [selectedRows]);

  const confirmBulkDelete = useCallback(async () => {
    if (selectedRows.length === 0) return;
    setBulkDeleteSubmitting(true);
    const deletedIds: string[] = [];
    let lastError: Error | null = null;

    try {
      for (const row of selectedRows) {
        try {
          await deleteDashboard(row.id);
          deletedIds.push(row.id);
        } catch (error) {
          lastError = error instanceof Error ? error : new Error("Delete failed.");
        }
      }

      if (deletedIds.length > 0) {
        toast.success(
          deletedIds.length === selectedRows.length
            ? `Deleted ${deletedIds.length} dashboard${deletedIds.length === 1 ? "" : "s"}.`
            : `Deleted ${deletedIds.length} of ${selectedRows.length} dashboards.`,
        );
      }

      if (deletedIds.length !== selectedRows.length) {
        toast.error(lastError?.message ?? "Some dashboards could not be deleted.");
      }

      setSelectedIds((previous) => {
        const next = new Set(previous);
        for (const id of deletedIds) {
          next.delete(id);
        }
        return next;
      });
      setBulkDeleteOpen(false);
      void loadDashboards();
    } finally {
      setBulkDeleteSubmitting(false);
    }
  }, [loadDashboards, selectedRows]);

  const paginationProps = useMemo(
    () => ({
      steps: PAGINATION_STEPS,
      currentPage,
      pageSize,
    }),
    [currentPage, pageSize],
  );

  const dashboardTableInitialSorting = useMemo(() => [{ id: "title", desc: true }], []);

  const titleError = createAttempted && !createTitle.trim();

  const columns = useMemo<ColumnDef<DashboardTableRow>[]>(
    () => [
      {
        id: "select",
        header: () => (
          <div className="flex justify-center px-1">
            <Checkbox
              checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
              onCheckedChange={() => toggleSelectAllPage()}
              aria-label="Select all on page"
              className={cn(
                DASHBOARD_TABLE_ROW_CHECKBOX_CLASS,
                (allPageSelected || somePageSelected) &&
                  "border-destructive data-[state=checked]:border-destructive data-[state=checked]:bg-destructive data-[state=checked]:text-white data-[state=indeterminate]:border-destructive data-[state=indeterminate]:bg-destructive data-[state=indeterminate]:text-white [&_[data-slot=checkbox-indicator]]:text-white",
              )}
            />
          </div>
        ),
        cell: ({ row }) => {
          const selected = selectedIds.has(row.original.id);
          return (
            <div className="flex justify-center px-1" onClick={(event) => event.stopPropagation()}>
              <Checkbox
                checked={selected}
                onCheckedChange={() => toggleRow(row.original.id)}
                aria-label={`Select ${row.original.title}`}
                className={cn(
                  DASHBOARD_TABLE_ROW_CHECKBOX_CLASS,
                  selected &&
                    "border-destructive data-[state=checked]:border-destructive data-[state=checked]:bg-destructive data-[state=checked]:text-white [&_[data-slot=checkbox-indicator]]:text-white",
                )}
              />
            </div>
          );
        },
        size: 48,
        enableSorting: false,
      },
      {
        id: "title",
        header: "Title",
        accessorKey: "title",
        cell: ({ row }) => {
          const isLoading = loadingDashboardId === row.original.id;
          return (
            <button
              type="button"
              className={cn(
                "line-clamp-2 text-left text-sm font-medium text-foreground transition-colors hover:text-primary hover:underline underline-offset-2",
                isLoading && "cursor-wait opacity-70",
              )}
              disabled={isLoading}
              onClick={(event) => {
                event.stopPropagation();
                void handleDashboardTitleClick(row.original);
              }}
            >
              {row.original.title}
            </button>
          );
        },
        size: 280,
        enableSorting: true,
      },
      {
        id: "assignedCustomersLabel",
        header: "Assigned to customers",
        accessorKey: "assignedCustomersLabel",
        cell: ({ row }) => (
          <span className="line-clamp-2 text-sm ">{row.original.assignedCustomersLabel}</span>
        ),
        size: 240,
        enableSorting: false,
      },
      {
        id: "public",
        header: () => (
          <div className="flex w-full justify-center px-1">
            <span>Public</span>
          </div>
        ),
        accessorKey: "isPublic",
        cell: ({ row }) => (
          <div className="flex justify-center py-0.5" onClick={(event) => event.stopPropagation()}>
            <Checkbox
              checked={row.original.isPublic}
              disabled
              className={cn(
                DASHBOARD_TABLE_PUBLIC_CHECKBOX_CLASS,
                "data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
              )}
            />
          </div>
        ),
        size: 88,
        enableSorting: false,
      },
          {
        id: "createdTime",
        header: "Created time",
        accessorFn: (row) => row.createdSortKey,
        cell: ({ row }) => {
          const absolute = row.original.createdDisplay;
          const relative = createdTimeAgoFromMs(row.original.createdSortKey);
          if (absolute === "—") {
            return <span className="text-xs text-primary">—</span>;
          }
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-default text-xs text-primary  ">
                  {relative}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs font-normal">{absolute}</p>
              </TooltipContent>
            </Tooltip>
          );
        },
        size: 170,
        enableSorting: true,
      },
      {
        id: "actions",
        header: () => <span className="block pr-1 text-right">Actions</span>,
        size: 220,
        enableSorting: false,
        cell: ({ row }) => {
          const dashboard = row.original;
          const isUpdatingPublic = updatingPublicDashboardId === dashboard.id;
          return (
            <div className="flex flex-wrap items-center justify-end gap-0.5 pr-0.5" onClick={(event) => event.stopPropagation()}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 shrink-0  hover:bg-muted hover:text-foreground !border-none"
                    onClick={() => openExportDialog(dashboard)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export dashboard</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={isUpdatingPublic}
                    className={cn(
                      "h-7 w-7 shrink-0 hover:bg-muted !border-none",
                      dashboard.isPublic
                        ? "text-primary hover:text-primary"
                        : "text-muted-foreground hover:text-foreground",
                      isUpdatingPublic && "cursor-wait opacity-70",
                    )}
                    onClick={() => void handleMakeDashboardPublic(dashboard)}
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{dashboard.isPublic ? "Dashboard is public" : "Make dashboard public"}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={isUpdatingPublic}
                    className={cn(
                      "h-7 w-7 shrink-0 hover:bg-muted !border-none",
                      dashboard.isPublic
                        ? "text-muted-foreground hover:text-foreground"
                        : "text-muted-foreground/50 hover:text-muted-foreground/50",
                      isUpdatingPublic && "cursor-wait opacity-70",
                    )}
                    onClick={() => void handleMakeDashboardPrivate(dashboard)}
                  >
                    <Reply className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{dashboard.isPublic ? "Make dashboard private" : "Dashboard is private"}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground !border-none"
                    onClick={() => openAssignCustomersDialog(dashboard)}
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Manage assigned customers</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:bg-primary/10 hover:text-primary !border-none"
                    onClick={() => openDetailsSheet(dashboard)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit dashboard</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive !border-none"
                    onClick={() => setDeleteTarget(dashboard)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete dashboard</TooltipContent>
              </Tooltip>
            </div>
          );
        },
      },
    ],
    [
      allPageSelected,
      somePageSelected,
      selectedIds,
      toggleSelectAllPage,
      toggleRow,
      openExportDialog,
      handleDashboardTitleClick,
      handleMakeDashboardPublic,
      handleMakeDashboardPrivate,
      openAssignCustomersDialog,
      openDetailsSheet,
      loadingDashboardId,
      updatingPublicDashboardId,
      placeholderAction,
    ],
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="w-full overflow-hidden p-0">
        <Card className="gap-0 overflow-hidden rounded-md border border-border/70 bg-card py-0 text-card-foreground shadow-sm">
          <CardHeader
            className={cn(
              "space-y-0 px-4 py-0 pt-1",
              selectedIds.size > 0
                ? "bg-primary text-primary-foreground"
                : "border-b border-border/70",
            )}
          >
            {selectedIds.size > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{selectedCountLabel}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs text-primary-foreground/85 hover:bg-primary-foreground/15 hover:text-primary-foreground"
                    onClick={clearSelection}
                  >
                    Clear
                  </Button>
                </div>
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
                        onClick={() => void copySelectedDashboardIds()}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy selected dashboard ids</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
                        onClick={exportSelectedDashboards}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Export selected dashboards</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
                        onClick={() => setBulkDeleteOpen(true)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete selected dashboards</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Presentation className="h-4 w-4 shrink-0 text-primary" />
                    <h3 className="text-base font-semibold leading-none text-foreground">Dashboards</h3>
                    <span className="text-xs leading-none text-muted-foreground">({totalRows})</span>
                  </div>
                  <div className="flex flex-1 flex-wrap items-center justify-end gap-1.5">
                    <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Search dashboards"
                        className="h-8 pl-8 text-sm"
                      />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-muted"
                          title="Dashboard actions"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 rounded-lg border border-primary/15 p-1.5 shadow-lg">
                        <DropdownMenuItem className="gap-2.5 py-2 text-sm font-medium" onClick={openCreateDialog}>
                          <FileText className="h-4 w-4 text-primary" />
                          <span>Create new dashboard</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="gap-2.5 py-2 text-sm font-medium"
                          onSelect={() => {
                            window.setTimeout(() => setImportDialogOpen(true), 0);
                          }}
                        >
                          <Upload className="h-4 w-4 text-primary" />
                          <span>Import dashboard</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-muted"
                      onClick={handleRefresh}
                      disabled={loading}
                      title="Refresh"
                    >
                      <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent className="p-1.5 pt-1.5">
            <TableWithPagination
              data={rows}
              columns={columns}
              totalRows={totalRows}
              pagination={paginationProps}
              loading={loading}
              onChangePagination={handlePaginationChange}
              paginationSummary="range"
              headerUppercase={false}
              scrollContainerClassName="min-h-[22rem] max-h-[calc(100vh-18rem)]"
              // getRowClassName={(row) => (selectedIds.has(row.id) ? "bg-primary/5" : undefined)}
              // initialSorting={dashboardTableInitialSorting}
            />
          </CardContent>
        </Card>

        <Dialog
          open={importDialogOpen}
          onOpenChange={(open) => {
            setImportDialogOpen(open);
            if (!open) {
              setImportSelectedFile(null);
              setImportSubmitting(false);
            }
          }}
        >
          <DialogContent
            className="max-w-md gap-0 overflow-hidden p-0 sm:max-w-lg"
            closeButtonClassName="right-4 top-4 text-foreground hover:bg-muted hover:text-foreground data-[state=open]:bg-transparent data-[state=open]:text-foreground"
          >
            <DialogHeader className="border-b border-border bg-background px-5 pb-4 pt-5 text-left">
              <DialogTitle className="text-lg font-semibold text-foreground">Import dashboard</DialogTitle>
              <DialogDescription className="text-left text-sm text-muted-foreground">
                Choose an exported dashboard file (JSON or ZIP), then import.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 bg-background px-5 py-5">
              <input
                ref={importFileInputRef}
                type="file"
                className="sr-only"
                accept=".json,.zip,application/json,application/zip"
                onChange={handleImportFileChange}
              />
              <div className="flex flex-col gap-3">
                <Label className="text-sm font-medium text-foreground">File</Label>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full justify-start gap-2 overflow-hidden border-border text-left font-normal"
                  onClick={() => importFileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {importSelectedFile ? importSelectedFile.name : "Choose file…"}
                  </span>
                </Button>
              </div>
            </div>
            <DialogFooter className="border-t border-border bg-background px-5 py-4 sm:justify-end sm:gap-2">
              <Button type="button" variant="outline" className="min-w-24" onClick={() => setImportDialogOpen(false)} disabled={importSubmitting}>
                Cancel
              </Button>
              <Button
                type="button"
                className="min-w-24"
                disabled={!importSelectedFile || importSubmitting}
                onClick={() => void submitImportDashboard()}
              >
                {importSubmitting ? "Importing…" : "Import"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) setCreateSubmitting(false);
          }}
        >
          <DialogContent
            className="max-h-[90vh] max-w-4xl gap-0 overflow-hidden p-0"
            closeButtonClassName="right-4 top-4 text-foreground hover:bg-muted hover:text-foreground data-[state=open]:bg-transparent data-[state=open]:text-foreground"
          >
            <DialogHeader className=" bg-background px-4 py-4 text-foreground">
              <div className="flex items-center justify-between pr-10">
                <DialogTitle className="text-xl font-semibold text-foreground">Add dashboard</DialogTitle>
              </div>
            </DialogHeader>

            <div className="space-y-4 overflow-y-auto bg-background px-5 py-0">
              {/* <div className="space-y-1.5 rounded-md border border-primary/15 bg-primary/5 p-4"> */}
                <Label htmlFor="dashboard-title" className={cn("text-sm font-medium", titleError && "text-destructive")}>
                  Title<span className="text-destructive">*</span>
                </Label>
                <Input
                  id="dashboard-title"
                  value={createTitle}
                  onChange={(event) => setCreateTitle(event.target.value)}
                  placeholder="Title"
                  className={cn("h-10 bg-background text-sm", titleError && "border-destructive focus-visible:ring-destructive/30")}
                />
                {titleError ? <p className="text-xs text-destructive">Title is required.</p> : null}
              {/* </div> */}

              {/* <div className="space-y-1.5 rounded-md border border-border/60 bg-muted/10 p-4"> */}
                <Label htmlFor="dashboard-description" className="text-sm font-medium">
                  Description
                </Label>
                <Textarea
                  id="dashboard-description"
                  value={createDescription}
                  onChange={(event) => setCreateDescription(event.target.value)}
                  placeholder="Description"
                  rows={4}
                  className="resize-none bg-background text-sm"
                />
              {/* </div> */}

              {/* <div className="space-y-1.5 rounded-md border border-border/60 bg-muted/10 p-4"> */}
                <Label className="text-sm font-medium">Assigned customers</Label>
                <Select value={createCustomerId || "__none__"} onValueChange={(value) => setCreateCustomerId(value === "__none__" ? "" : value)}>
                  <SelectTrigger className="h-10 bg-background text-sm" disabled={customersLoading}>
                    <SelectValue placeholder={customersLoading ? "Loading customers..." : "Select customer"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              {/* </div> */}

              <div className="rounded-lg border border-border/60 bg-card p-4">
                <h4 className="mb-4 text-base font-semibold text-foreground">Mobile application settings</h4>
                <div className="mb-4 flex items-center gap-3">
                  <Checkbox
                    id="hide-mobile-dashboard"
                    checked={createHideMobile}
                    onCheckedChange={(value) => setCreateHideMobile(value === true)}
                    className="size-4 border-2 border-foreground/25 bg-background shadow-sm dark:border-foreground/35"
                  />
                  <Label htmlFor="hide-mobile-dashboard" className="cursor-pointer text-sm font-normal text-foreground">
                    Hide dashboard in mobile application
                  </Label>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="mobile-order" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Dashboard order in mobile application
                  </Label>
                  <Input
                    id="mobile-order"
                    value={createMobileOrder}
                    onChange={(event) => setCreateMobileOrder(event.target.value)}
                    className="h-10 bg-muted/20 text-sm"
                  />
                </div>

                <div className="mt-5 space-y-2.5">
                  <Label className="text-sm font-medium">Dashboard image</Label>
                  <div className="grid gap-3 md:grid-cols-[180px_1fr_1fr]">
                    <div className="flex min-h-24 items-center justify-center rounded-md border border-dashed border-border bg-muted/20 px-4 py-5 text-center text-xs text-muted-foreground">
                      {createImageLink.trim() ? "Image link added" : "No image selected"}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-24 justify-center gap-2.5 border-primary/20 text-sm text-primary hover:bg-primary/5"
                      onClick={() => {
                        setImageGalleryTarget("create");
                        setImageGalleryOpen(true);
                      }}
                    >
                      <ImagePlus className="h-4 w-4" />
                      Browse from gallery
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-24 justify-center gap-2.5 border-primary/20 text-sm text-primary hover:bg-primary/5"
                      onClick={() => setShowImageLinkInput((previous) => !previous)}
                    >
                      <Link2 className="h-4 w-4" />
                      Set link
                    </Button>
                  </div>
                  {showImageLinkInput ? (
                    <Input
                      value={createImageLink}
                      onChange={(event) => setCreateImageLink(event.target.value)}
                      placeholder="Paste image URL"
                      className="h-10 bg-background text-sm"
                    />
                  ) : null}
                </div>
              </div>
            </div>

            <DialogFooter className="border-t px-5 py-3">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} className="!h-9" disabled={createSubmitting}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void submitCreate()}
                disabled={!createTitle.trim() || createSubmitting}
                className="!h-9"
              >
                {createSubmitting ? "Creating..." : "Add"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={imageGalleryOpen}
          onOpenChange={(open) => {
            setImageGalleryOpen(open);
            if (!open) {
              setImageGallerySearch("");
              setGalleryUploadPopoverOpen(false);
              setImageGalleryItems([]);
              setImageGalleryPage(0);
              setImageGalleryHasNext(false);
            }
          }}
        >
          <DialogContent
            className="flex max-h-[90vh] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
            closeButtonClassName="right-4 top-4 text-foreground hover:bg-muted hover:text-foreground data-[state=open]:bg-transparent data-[state=open]:text-foreground"
          >
            <DialogHeader className="shrink-0 space-y-0 border-b border-border bg-background px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
                <DialogTitle className="text-lg font-semibold text-foreground">Image gallery</DialogTitle>
                <div className="flex items-center gap-2">
                  <input
                    ref={galleryUploadInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      setGalleryUploadPopoverOpen(false);
                      if (file) toast.info("Image upload API is not wired yet.");
                    }}
                  />
                  <Popover open={galleryUploadPopoverOpen} onOpenChange={setGalleryUploadPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        className="!h-8 bg-primary px-4 text-primary-foreground hover:bg-primary/90"
                      >
                        Upload image
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="end"
                      sideOffset={8}
                      className="w-[min(32rem,calc(100vw-2rem))] gap-0 overflow-hidden rounded-lg border border-border p-0 shadow-lg sm:max-w-lg"
                    >
                      <div className="space-y-4 px-5 py-4">
                        <div className="space-y-1.5">
                          <p className="text-sm font-medium text-foreground">Upload image</p>
                          <p className="text-sm text-muted-foreground">Choose an image file from your device.</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 w-full justify-start gap-2 overflow-hidden border-border text-left font-normal"
                          onClick={() => galleryUploadInputRef.current?.click()}
                        >
                          <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate text-sm">Choose file…</span>
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <DialogDescription className="sr-only">Browse and select an image for the dashboard thumbnail.</DialogDescription>
            </DialogHeader>

            <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-muted/25 px-5 py-3 dark:bg-muted/15">
             
              <div className="relative min-w-0 w-full flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Filter by file name…"
                  value={imageGallerySearch}
                  onChange={(event) => setImageGallerySearch(event.target.value)}
                  className="h-9 pl-8 text-sm"
                  aria-label="Filter gallery images by file name"
                />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Switch
                  id="image-gallery-include-system"
                  checked={imageGalleryIncludeSystem}
                  onCheckedChange={(value) => setImageGalleryIncludeSystem(value === true)}
                  className="h-4 w-7 shrink-0 [&>span]:h-3 [&>span]:w-3 [&>span]:data-[state=checked]:translate-x-3"
                />
                <Label htmlFor="image-gallery-include-system" className="cursor-pointer text-sm font-normal text-foreground">
                  Include system images
                </Label>
              </div>
              <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
                <div className="flex items-center gap-0.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="!h-8 w-8 text-muted-foreground hover:text-foreground !border-none"
                        disabled={imageGalleryLoading}
                        onClick={() => void loadImageGallery({ page: 0, append: false })}
                      >
                        <RefreshCw className={cn("h-4 w-4", imageGalleryLoading && "animate-spin")} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Refresh</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="!h-8 w-8 text-muted-foreground hover:text-foreground !border-none"
                        onClick={() => toast.info("Import from file is not wired yet.")}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Import</TooltipContent>
                  </Tooltip>
                </div>
                <div className="inline-flex rounded-lg border border-border bg-background p-0.5">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className={cn(
                      "!h-8 w-8 rounded-md !border-none",
                      imageGalleryView === "list" ? "bg-primary/15 text-primary shadow-sm" : "text-muted-foreground",
                    )}
                    title="List view"
                    onClick={() => setImageGalleryView("list")}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className={cn(
                      "!h-8 w-8 rounded-md",
                      imageGalleryView === "grid" ? "bg-primary/15 text-primary shadow-sm" : "text-muted-foreground",
                    )}
                    title="Grid view"
                    onClick={() => setImageGalleryView("grid")}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-background px-5 py-4">
              {imageGalleryLoading && imageGalleryItems.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">Loading images…</p>
              ) : filteredGalleryImages.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">No images found.</p>
              ) : imageGalleryView === "grid" ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
                  {filteredGalleryImages.map((img, index) => {
                    const id = entityIdFromTb(img.id) || `gallery-${index}`;
                    const dw = img.descriptor?.width;
                    const dh = img.descriptor?.height;
                    const sz = img.descriptor?.size;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => pickGalleryImage(img)}
                        className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card text-left shadow-sm transition-all hover:border-primary/60 hover:shadow-md"
                      >
                        <GalleryImageThumb
                          image={img}
                          frameClassName="h-[15rem] w-full p-2 shrink-0 sm:h-25"
                          imgClassName="transition-transform group-hover:scale-[1.02]"
                        />
                        <div className="space-y-0.5 p-2">
                          <p className="line-clamp-2 text-xs font-medium leading-snug text-foreground">
                            {img.title || img.fileName || "Untitled"}
                          </p>
                          <p className="text-[10px] tabular-nums leading-tight text-muted-foreground">
                            {dw != null && dh != null ? `${dw}×${dh}` : "—"} · {formatGalleryBytes(sz)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {filteredGalleryImages.map((img, index) => {
                    const id = entityIdFromTb(img.id) || `gallery-${index}`;
                    const dw = img.descriptor?.width;
                    const dh = img.descriptor?.height;
                    const sz = img.descriptor?.size;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => pickGalleryImage(img)}
                        className="flex w-full items-center gap-2 rounded-lg border border-border bg-card p-1.5 text-left shadow-sm transition-all hover:border-primary/60 hover:shadow-md"
                      >
                        <GalleryImageThumb image={img} frameClassName="h-11 w-14 shrink-0 rounded-md" />
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="truncate text-xs font-medium text-foreground">{img.title || img.fileName || "Untitled"}</p>
                          <p className="text-[10px] tabular-nums text-muted-foreground">
                            {dw != null && dh != null ? `${dw}×${dh}` : "—"} · {formatGalleryBytes(sz)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {imageGalleryLoading && imageGalleryItems.length > 0 ? (
                <p className="pt-4 text-center text-xs text-muted-foreground">Updating…</p>
              ) : null}

              {imageGalleryHasNext && !imageGallerySearch.trim() ? (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 w-full"
                  disabled={imageGalleryLoading}
                  onClick={() => loadMoreGallery()}
                >
                  Load more
                </Button>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={assignCustomersOpen}
          onOpenChange={(open) => {
            setAssignCustomersOpen(open);
            if (!open) {
              setAssignCustomersTarget(null);
              setAssignCustomerIds([]);
              setAssignCustomersPickerOpen(false);
            }
          }}
        >
          <DialogContent
            className="max-w-2xl gap-0 overflow-hidden p-0"
            closeButtonClassName="right-4 top-4 text-foreground hover:bg-muted hover:text-foreground data-[state=open]:bg-transparent data-[state=open]:text-foreground"
          >
            <DialogHeader className="bg-background px-4 py-4 text-foreground">
              <div className="flex items-center justify-between pr-10">
                <DialogTitle className="text-lg font-semibold leading-none text-foreground">Manage assigned customers</DialogTitle>
              </div>
            </DialogHeader>

            <div className="border-t bg-background px-5 py-5">
              <div className="space-y-2">
                <Label htmlFor="assign-customers-field" className="text-sm font-medium text-muted-foreground">
                  Assigned customers
                </Label>

                <Popover open={assignCustomersPickerOpen} onOpenChange={setAssignCustomersPickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      id="assign-customers-field"
                      type="button"
                      className="flex min-h-14 w-full flex-wrap items-center gap-2 rounded-md border border-input bg-background px-3 py-3 text-left shadow-sm transition-colors hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      {selectedAssignedCustomers.map((customer) => (
                        <span
                          key={customer.id}
                          className="inline-flex max-w-[200px] items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-sm font-medium text-foreground"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <span className="truncate">{customer.title}</span>
                          <button
                            type="button"
                            className="shrink-0 rounded-full text-muted-foreground hover:text-foreground"
                            onClick={(event) => {
                              event.stopPropagation();
                              removeAssignedCustomer(customer.id);
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      ))}
                      <span className="min-w-0 flex-1 text-sm text-muted-foreground">
                        {assignCustomersLoading ? "Loading customers..." : "Entity list"}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0 sm:max-w-xl">
                    <Command>
                    <CommandInput placeholder="Search customers..." />
                    <CommandList>
                      <CommandEmpty>
                        {assignCustomersLoading ? "Loading customers..." : "No customers found."}
                      </CommandEmpty>
                      <CommandGroup>
                        {assignCustomersOptions.map((customer) => {
                          const selected = assignCustomerIds.includes(customer.id);
                          return (
                            <CommandItem
                              key={customer.id}
                              value={`${customer.title} ${customer.isPublic ? "public" : ""}`}
                              onSelect={() => toggleAssignedCustomer(customer.id)}
                            >
                              <Check className={cn("h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                              <span>{customer.title}</span>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              </div>
            </div>

            <DialogFooter className="border-t bg-background px-5 py-3 sm:justify-end sm:space-x-3">
              <Button
                type="button"
                variant="ghost"
                className="!h-8 min-w-28 px-6 hover:bg-muted"
                onClick={() => {
                  setAssignCustomersOpen(false);
                  setAssignCustomersTarget(null);
                  setAssignCustomerIds([]);
                  setAssignCustomersPickerOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button type="button" className="!h-8 min-w-28 px-6" disabled>
                Update
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={exportTarget != null}
          onOpenChange={(open) => {
            if (exportSubmitting) return;
            if (!open) {
              setExportTarget(null);
              setExportIncludeResources(false);
            }
          }}
        >
          <DialogContent
            className="max-w-lg gap-0 overflow-hidden p-0"
            closeButtonClassName="right-4 top-4 text-foreground hover:bg-muted hover:text-foreground data-[state=open]:bg-transparent data-[state=open]:text-foreground"
          >
            <DialogHeader className="bg-background px-4 py-4 text-foreground">
              <div className="flex items-center justify-between pr-10">
                <DialogTitle className="text-lg font-semibold leading-none text-foreground">Export dashboard</DialogTitle>
              </div>
            </DialogHeader>

            <div className="border-t bg-background px-5 py-5">
              <div className="flex min-h-14 items-center gap-5">
                <Switch
                  id="export-dashboard-include-resources"
                  checked={exportIncludeResources}
                  onCheckedChange={setExportIncludeResources}
                  className="h-4 w-7 shrink-0 [&>span]:h-3 [&>span]:w-3 [&>span]:data-[state=checked]:translate-x-3"
                />
                <Label
                  htmlFor="export-dashboard-include-resources"
                  className="cursor-pointer text-lg font-normal leading-relaxed text-foreground"
                >
                  Embed dashboard images and resources
                </Label>
              </div>
            </div>

            <DialogFooter className="border-t bg-background px-5 py-3 sm:justify-end sm:space-x-3">
              <Button
                type="button"
                variant="ghost"
                className="!h-8 min-w-28 px-6 hover:bg-muted"
                onClick={() => {
                  setExportTarget(null);
                  setExportIncludeResources(false);
                }}
                disabled={exportSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="!h-8 min-w-28 px-6 "
                onClick={() => void confirmExportDashboard()}
                disabled={exportSubmitting}
              >
                {exportSubmitting ? "Exporting..." : "Export"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Sheet
          open={detailsSheetRow != null}
          onOpenChange={(open) => {
            if (!open) setDetailsSheetRow(null);
          }}
        >
          <SheetContent
            side="right"
            className="flex h-full w-full min-w-0 max-w-full flex-col gap-0 border-l border-border/60 bg-white p-0 shadow-2xl dark:bg-background sm:max-w-[min(100vw-3rem,60rem)] sm:rounded-l-3xl sm:border-l"
          >
            {activeDetailRow ? (
              <Tabs
                value={detailsTab}
                onValueChange={(value) => setDetailsTab(value as "details" | "audit" | "version")}
                className="flex min-h-0 flex-1 flex-col gap-0"
              >
                <header className="shrink-0 border-b border-border/60 bg-white px-6 pb-2 pt-2 dark:bg-background">
                  <div className="flex items-start gap-3 pr-2">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-semibold leading-snug tracking-tight text-foreground">
                        {detailsTitle || activeDetailRow.title}
                      </h2>
                      <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                        <BarChart3 className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                        <span className="truncate">Dashboard details</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                            onClick={() => toast.info("Help is not linked yet.")}
                          >
                            <CircleHelp className="h-5 w-5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Help</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </header>

                <div className="shrink-0 bg-white px-6 pb-0 pt-1 dark:bg-background">
                  <TabsList className="mb-0 flex h-auto w-full flex-wrap items-end justify-start gap-x-8 rounded-none border-b border-[#e0e0e0] bg-transparent p-0 shadow-none sm:gap-x-10 dark:border-border">
                    <TabsTrigger
                      value="details"
                      className="mb-[-1px] rounded-none border-0 border-b-2 border-transparent bg-transparent px-0.5 py-2.5 text-sm font-medium text-muted-foreground shadow-none ring-offset-background transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-primary data-[state=active]:shadow-none"
                    >
                      Details
                    </TabsTrigger>
                    <TabsTrigger
                      value="audit"
                      className="mb-[-1px] rounded-none border-0 border-b-2 border-transparent bg-transparent px-0.5 py-2.5 text-sm font-medium text-muted-foreground shadow-none ring-offset-background transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-primary data-[state=active]:shadow-none"
                    >
                      Audit Logs
                    </TabsTrigger>
                    <TabsTrigger
                      value="version"
                      className="mb-[-1px] rounded-none border-0 border-b-2 border-transparent bg-transparent px-0.5 py-2.5 text-sm font-medium text-muted-foreground shadow-none ring-offset-background transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-primary data-[state=active]:shadow-none"
                    >
                      Version Control
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="details" className="m-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
                  <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/80 dark:bg-muted/20">
                    <div className="space-y-5 px-6 py-6">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          className="!h-8 rounded-full border-0 px-4 text-sm font-medium text-white shadow-none hover:bg-primary-700"
                          onClick={() => {
                            void handleDashboardTitleClick(activeDetailRow);
                            setDetailsSheetRow(null);
                          }}
                          disabled={loadingDashboardId === activeDetailRow.id}
                        >
                          Open dashboard
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="!h-8 rounded-full border border-border bg-white px-4 text-sm font-medium shadow-none hover:bg-muted/50 dark:bg-background"
                          onClick={() => openExportDialog(activeDetailRow)}
                        >
                          Export dashboard
                        </Button>
                        {activeDetailRow.isPublic ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="!h-8 rounded-full border border-border bg-white px-4 text-sm font-medium shadow-none hover:bg-muted/50 dark:bg-background"
                            disabled={updatingPublicDashboardId === activeDetailRow.id}
                            onClick={() => void handleMakeDashboardPrivate(activeDetailRow)}
                          >
                            Make dashboard private
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            className="!h-8 rounded-full border border-border bg-white px-4 text-sm font-medium shadow-none hover:bg-muted/50 dark:bg-background"
                            disabled={updatingPublicDashboardId === activeDetailRow.id}
                            onClick={() => void handleMakeDashboardPublic(activeDetailRow)}
                          >
                            Make dashboard public
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          className="!h-8 rounded-full border border-border bg-white px-4 text-sm font-medium shadow-none hover:bg-muted/50 dark:bg-background"
                          onClick={() => openAssignCustomersDialog(activeDetailRow)}
                        >
                          Manage assigned customers
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="!h-8 rounded-full border border-destructive/25 bg-white px-4 text-sm font-medium text-destructive shadow-none hover:bg-destructive/5 dark:bg-background"
                          onClick={() => setDeleteTarget(activeDetailRow)}
                        >
                          Delete dashboard
                        </Button>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="!h-8 w-full max-w-xs rounded-full border border-border bg-white px-4 text-sm font-medium shadow-none hover:bg-muted/50 sm:w-auto dark:bg-background"
                        onClick={() => void copyDetailsDashboardId()}
                      >
                        <Clipboard className="mr-2 h-4 w-4" />
                        Copy dashboard id
                      </Button>

                      <div className="space-y-2 pt-1">
                        <Label className="text-ms font-semibold ">Assigned to customers</Label>
                        <div className="min-h-11 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm leading-relaxed text-foreground shadow-sm dark:bg-background">
                          {activeDetailRow.assignedCustomersLabel}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-ms font-semibol ">Social sharing</Label>
                        <div className="flex flex-wrap gap-2">
                          {(
                            [
                              { label: "f", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(detailsPublicLink || window.location.href)}` },
                              { label: "𝕏", href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(detailsPublicLink || window.location.href)}` },
                              { label: "in", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(detailsPublicLink || window.location.href)}` },
                              { label: "r", href: `https://www.reddit.com/submit?url=${encodeURIComponent(detailsPublicLink || window.location.href)}` },
                            ] as const
                          ).map((item) => (
                            <a
                              key={item.label}
                              href={item.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-sm font-semibold text-muted-foreground transition-colors hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800 dark:bg-background"
                            >
                              {item.label}
                            </a>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-ms font-semibol">Public link</Label>
                        <div className="flex gap-2">
                          <Input
                            readOnly
                            value={detailsPublicLink || (activeDetailRow.isPublic ? "" : "Dashboard is private — enable public access to get a shareable link.")}
                            className="h-10 flex-1 rounded-xl border border-border bg-white text-sm shadow-sm focus-visible:ring-sky-200 dark:bg-background"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 shrink-0 rounded-xl border-border shadow-sm"
                            disabled={!detailsPublicLink}
                            onClick={async () => {
                              if (!detailsPublicLink) return;
                              try {
                                await navigator.clipboard.writeText(detailsPublicLink);
                                toast.success("Public link copied.");
                              } catch {
                                toast.error("Could not copy link.");
                              }
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="details-dashboard-title" className="text-sm font-normal">
                          Title<span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="details-dashboard-title"
                          value={detailsTitle}
                          onChange={(event) => setDetailsTitle(event.target.value)}
                          className="h-10 rounded-xl border border-border bg-white text-sm shadow-sm focus-visible:ring-sky-200 dark:bg-background"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="details-dashboard-description" className="text-sm font-medium text-foreground">
                          Description
                        </Label>
                        <Textarea
                          id="details-dashboard-description"
                          value={detailsDescription}
                          onChange={(event) => setDetailsDescription(event.target.value)}
                          rows={4}
                          className="resize-none rounded-xl border border-border bg-white text-sm shadow-sm focus-visible:ring-sky-200 dark:bg-background"
                        />
                      </div>

                      <div className="rounded-2xl border border-border bg-white p-5 shadow-sm dark:bg-background">
                        <h4 className="mb-4 text-sm font-semibold text-foreground">Mobile application settings</h4>
                        <div className="mb-4 flex items-center gap-3">
                          <Checkbox
                            id="details-hide-mobile"
                            checked={detailsHideMobile}
                            onCheckedChange={(checked) => setDetailsHideMobile(checked === true)}
                            className="h-4 w-4 shrink-0"
                          />
                          <Label htmlFor="details-hide-mobile" className="cursor-pointer text-sm font-normal text-foreground">
                            Hide dashboard in mobile application
                          </Label>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="details-mobile-order" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Dashboard order in mobile application
                          </Label>
                          <Input
                            id="details-mobile-order"
                            value={detailsMobileOrder}
                            onChange={(event) => setDetailsMobileOrder(event.target.value)}
                            className="h-10 rounded-xl border border-border bg-muted/20 text-sm shadow-sm dark:bg-background"
                          />
                        </div>
                        <div className="mt-5 space-y-2.5">
                          <Label className="text-sm font-medium text-foreground">Dashboard image</Label>
                          <div className="grid gap-3 md:grid-cols-[180px_1fr_1fr]">
                            <div className="flex min-h-24 items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-muted/20 px-4 py-5 text-center text-xs text-muted-foreground">
                              {detailsImageLink.trim() ? (
                                /^https?:\/\//i.test(detailsImageLink.trim()) ? (
                                  <img src={detailsImageLink.trim()} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  "Image link added"
                                )
                              ) : (
                                "No image selected"
                              )}
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              className="min-h-24 justify-center gap-2.5 border-primary/20 text-sm text-primary hover:bg-primary/5"
                              onClick={() => {
                                setImageGalleryTarget("details");
                                setImageGalleryOpen(true);
                              }}
                            >
                              <ImagePlus className="h-4 w-4" />
                              Browse from gallery
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="min-h-24 justify-center gap-2.5 border-primary/20 text-sm text-primary hover:bg-primary/5"
                              onClick={() => setShowDetailsImageLinkInput((previous) => !previous)}
                            >
                              <Link2 className="h-4 w-4" />
                              Set link
                            </Button>
                          </div>
                          {showDetailsImageLinkInput ? (
                            <Input
                              value={detailsImageLink}
                              onChange={(event) => setDetailsImageLink(event.target.value)}
                              placeholder="Paste image URL"
                              className="h-10 bg-background text-sm"
                            />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="audit" className="m-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
                  <div className="flex min-h-0 flex-1 flex-col bg-slate-50/80 dark:bg-muted/20">
                    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/60 bg-white px-4 py-3 dark:bg-background">
                      <Popover
                        open={auditTimePopoverOpen}
                        onOpenChange={(open) => {
                          setAuditTimePopoverOpen(open);
                          if (open) syncAuditDraftFromWindow(auditWindow);
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button type="button" variant="outline" size="sm" className="h-9 shrink-0 gap-2 font-normal">
                            <Clock className="h-4 w-4 shrink-0" aria-hidden />
                            {formatAuditTimeWindowTriggerLabel(auditWindow)}
                            <ChevronDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[min(22rem,calc(100vw-2rem))] gap-0 overflow-hidden rounded-lg border border-border p-0 shadow-lg"
                          align="start"
                        >
                          <div className="px-4 pb-2 pt-4">
                            <p className="text-sm font-semibold text-foreground">Time window</p>
                          </div>
                          <div className="px-4 pb-3">
                            <div className="inline-flex rounded-lg bg-muted/70 p-0.5 dark:bg-muted/50">
                              <button
                                type="button"
                                className={cn(
                                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                                  auditDraftTab === "last"
                                    ? "border border-primary bg-background text-primary shadow-sm"
                                    : "text-muted-foreground hover:text-foreground",
                                )}
                                onClick={() => setAuditDraftTab("last")}
                              >
                                Last
                              </button>
                              <button
                                type="button"
                                className={cn(
                                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                                  auditDraftTab === "range"
                                    ? "border border-primary bg-background text-primary shadow-sm"
                                    : "text-muted-foreground hover:text-foreground",
                                )}
                                onClick={() => {
                                  setAuditDraftTab("range");
                                  if (!auditDraftRangeStart || !auditDraftRangeEnd) {
                                    const now = Date.now();
                                    setAuditDraftRangeStart(toDatetimeLocalValue(now - 86400000));
                                    setAuditDraftRangeEnd(toDatetimeLocalValue(now));
                                  }
                                }}
                              >
                                Range
                              </button>
                              <button
                                type="button"
                                className={cn(
                                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                                  auditDraftTab === "relative"
                                    ? "border border-primary bg-background text-primary shadow-sm"
                                    : "text-muted-foreground hover:text-foreground",
                                )}
                                onClick={() => setAuditDraftTab("relative")}
                              >
                                Relative
                              </button>
                            </div>
                          </div>
                          <div className="border-t border-border/60 px-4 py-3">
                            {auditDraftTab === "last" ? (
                              <div className="space-y-3">
                                <Select value={auditDraftLastId} onValueChange={setAuditDraftLastId}>
                                  <SelectTrigger className="h-10 w-full">
                                    <SelectValue placeholder="Select interval" />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-72">
                                    <SelectItem value="all_time">All time</SelectItem>
                                    <SelectSeparator />
                                    {AUDIT_LAST_PRESETS.map((preset) => (
                                      <SelectItem key={preset.id} value={preset.id}>
                                        {preset.label}
                                      </SelectItem>
                                    ))}
                                    <SelectSeparator />
                                    <SelectItem value="custom">Custom</SelectItem>
                                  </SelectContent>
                                </Select>
                                {auditDraftLastId === "custom" ? (
                                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                    {(
                                      [
                                        { key: "days" as const, label: "Days" },
                                        { key: "hours" as const, label: "Hours" },
                                        { key: "minutes" as const, label: "Minutes" },
                                        { key: "seconds" as const, label: "Seconds" },
                                      ] as const
                                    ).map((field) => (
                                      <div key={field.key} className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">{field.label}</Label>
                                        <Input
                                          type="number"
                                          min={0}
                                          value={auditDraftCustom[field.key]}
                                          onChange={(event) => {
                                            const parsed = Number(event.target.value);
                                            setAuditDraftCustom((previous) => ({
                                              ...previous,
                                              [field.key]: Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0,
                                            }));
                                          }}
                                          className="h-9"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                            {auditDraftTab === "range" ? (
                              <div className="space-y-3">
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Start</Label>
                                  <Input
                                    type="datetime-local"
                                    value={auditDraftRangeStart}
                                    onChange={(event) => setAuditDraftRangeStart(event.target.value)}
                                    className="h-9"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">End</Label>
                                  <Input
                                    type="datetime-local"
                                    value={auditDraftRangeEnd}
                                    onChange={(event) => setAuditDraftRangeEnd(event.target.value)}
                                    className="h-9"
                                  />
                                </div>
                              </div>
                            ) : null}
                            {auditDraftTab === "relative" ? (
                              <Select
                                value={auditDraftRelativeKey}
                                onValueChange={(value) => setAuditDraftRelativeKey(value as AuditRelativeWindowKey)}
                              >
                                <SelectTrigger className="h-10 w-full">
                                  <SelectValue placeholder="Relative window" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[min(22rem,50vh)] overflow-y-auto">
                                  {AUDIT_RELATIVE_OPTIONS.map((option) => (
                                    <SelectItem key={option.key} value={option.key}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : null}
                          </div>
                          <div className="flex items-center justify-end gap-2 border-t border-border/60 bg-muted/5 px-4 py-3 dark:bg-muted/10">
                            <Button type="button" variant="ghost" size="sm" onClick={() => setAuditTimePopoverOpen(false)}>
                              Cancel
                            </Button>
                            <Button type="button" size="sm" className="min-w-20" onClick={applyAuditTimeDraft}>
                              Update
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                      <div className="flex items-center gap-2">

                      <Input
                        value={auditSearch}
                        onChange={(event) => setAuditSearch(event.target.value)}
                        placeholder="Search this page…"
                        className="!h-8 min-w-[10rem] max-w-md flex-1 text-sm"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="!h-8 w-9 shrink-0 text-muted-foreground hover:text-foreground !border-none"
                        disabled={!activeDetailRow || auditLoading}
                        onClick={() => void loadAuditLogs()}
                        aria-label="Refresh audit logs"
                      >
                        {auditLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      </Button>
                      </div>
                    </div>
                    <div className="min-h-0 flex-1 overflow-auto bg-white p-2 dark:bg-background">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="w-[11rem] min-w-[10rem] text-xs font-semibold tracking-wide text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                Timestamp
                                <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
                              </span>
                            </TableHead>
                            <TableHead className="min-w-[10rem] text-xs font-semibold tracking-wide text-muted-foreground">
                              User
                            </TableHead>
                            <TableHead className="min-w-[6rem] text-xs font-semibold tracking-wide text-muted-foreground">
                              Type
                            </TableHead>
                            <TableHead className="min-w-[5rem] text-xs font-semibold tracking-wide text-muted-foreground">
                              Status
                            </TableHead>
                            <TableHead className="w-[4rem] text-center text-xs font-semibold tracking-wide text-muted-foreground">
                              Details
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredAuditLogs.length === 0 ? (
                            <TableRow className="hover:bg-transparent">
                              <TableCell colSpan={5} className="h-36 text-center text-sm text-muted-foreground">
                                {auditLoading ? "Loading audit logs…" : "No audit logs found."}
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredAuditLogs.map((log, index) => {
                              const rowKey = entityIdFromTb(log.id) || `audit-${log.createdTime ?? index}-${index}`;
                              const statusLabel = dashboardAuditStatusDisplay(log.actionStatus);
                              const statusKey = statusLabel.toLowerCase();
                              return (
                                <TableRow key={rowKey} className="border-border/60">
                                  <TableCell className="whitespace-nowrap text-sm text-foreground">
                                    {formatDashboardAuditTimestamp(log.createdTime)}
                                  </TableCell>
                                  <TableCell className="text-sm text-foreground">{log.userName?.trim() || "—"}</TableCell>
                                  <TableCell className="text-sm text-foreground">
                                    {dashboardAuditActionTypeLabel(log.actionType)}
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    <span
                                      className={cn(
                                        statusKey === "success" && "font-medium text-emerald-600",
                                        statusKey.includes("fail") && "font-medium text-destructive",
                                      )}
                                    >
                                      {statusLabel}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                          aria-label="View audit details"
                                        >
                                          <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-48">
                                        <DropdownMenuItem onClick={() => setAuditDetailLog(log)}>View details</DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    <TablePager
                      page={auditPage}
                      pageSize={auditPageSize}
                      totalItems={auditTotalElements}
                      onPageChange={setAuditPage}
                      onPageSizeChange={(size) => {
                        setAuditPage(0);
                        setAuditPageSize(size);
                      }}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="version" className="m-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-slate-50/80 px-6 py-20 text-center text-sm text-muted-foreground dark:bg-muted/20">
                    Version control will appear here when the API is connected.
                  </div>
                </TabsContent>
              </Tabs>
            ) : null}
          </SheetContent>
        </Sheet>

        <Dialog open={auditDetailLog != null} onOpenChange={(open) => !open && setAuditDetailLog(null)}>
          <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Audit details</DialogTitle>
              <DialogDescription>
                {auditDetailLog ? formatDashboardAuditTimestamp(auditDetailLog.createdTime) : ""}
              </DialogDescription>
            </DialogHeader>
            {auditDetailLog ? (
              <div className="space-y-3 pt-1">
                <div className="text-sm">
                  <span className="font-medium text-foreground">User: </span>
                  <span className="text-muted-foreground">{auditDetailLog.userName?.trim() || "—"}</span>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-foreground">Type: </span>
                  <span className="text-muted-foreground">
                    {dashboardAuditActionTypeLabel(auditDetailLog.actionType)}
                    {auditDetailLog.actionType ? (
                      <span className="ml-1 font-mono text-xs opacity-80">({auditDetailLog.actionType})</span>
                    ) : null}
                  </span>
                </div>
                <JsonBlock
                  value={{
                    actionData: auditDetailLog.actionData ?? null,
                    actionFailureDetails: auditDetailLog.actionFailureDetails ?? "",
                  }}
                />
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteTarget != null} onOpenChange={(open) => !open && !deleteSubmitting && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete dashboard?</AlertDialogTitle>
              <AlertDialogDescription>
                This will delete &quot;{deleteTarget?.title ?? ""}&quot;. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteSubmitting}>Cancel</AlertDialogCancel>
              <Button type="button" variant="destructive" disabled={deleteSubmitting} onClick={() => void confirmDelete()}>
                {deleteSubmitting ? "Deleting..." : "Delete"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={bulkDeleteOpen} onOpenChange={(open) => !bulkDeleteSubmitting && setBulkDeleteOpen(open)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete selected dashboards?</AlertDialogTitle>
              <AlertDialogDescription>
                This will delete {selectedRows.length} selected dashboard{selectedRows.length === 1 ? "" : "s"}. This action cannot
                be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={bulkDeleteSubmitting}>Cancel</AlertDialogCancel>
              <Button type="button" variant="destructive" disabled={bulkDeleteSubmitting} onClick={() => void confirmBulkDelete()}>
                {bulkDeleteSubmitting ? "Deleting..." : "Delete selected"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
