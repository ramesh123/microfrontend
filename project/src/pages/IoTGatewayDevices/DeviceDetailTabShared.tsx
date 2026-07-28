import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Muted icon chip for + / refresh / search in device list & device detail toolbars. */
export const DEVICE_DETAIL_TOOLBAR_ICON_BTN =
  "h-8 w-8 shrink-0 rounded-sm bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground disabled:pointer-events-none disabled:opacity-50";

/** Slightly smaller chip for dense rows (e.g. table pager, alarm details). */
export const DEVICE_DETAIL_TOOLBAR_ICON_BTN_SM =
  "h-7 w-7 shrink-0 rounded-sm bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground disabled:pointer-events-none disabled:opacity-50";

/** Remove / trash on muted pill with destructive hover. */
export const DEVICE_DETAIL_DANGER_ICON_BTN =
  "h-8 w-8 shrink-0 rounded-md bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-50";

/** Themed header for IoT device create/edit dialogs (muted bar + border; matches `background` / `foreground` tokens, not solid primary). */
export const IOT_DEVICE_DIALOG_HEADER =
  "relative shrink-0 space-y-0.5 border-b border-border bg-muted/45 px-3 py-2 pr-10 text-left text-foreground dark:bg-muted/25";

/** Close control on themed device dialogs (sits `absolute right-2 top-2` on `DialogContent`). */
export const IOT_DEVICE_DIALOG_CLOSE =
  "text-muted-foreground hover:bg-muted hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-muted-foreground";

/** Remove / trash on muted pill (compact row, e.g. devices table). */
export const DEVICE_DETAIL_DANGER_ICON_BTN_SM =
  "h-7 w-7 shrink-0 rounded-sm bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-50";

export type AttributeRow = {
  key: string;
  value: string;
  lastUpdate: number;
};

export type LocalAlarmRule = {
  id: string;
  createdTime: number;
  alarmType: string;
  intervalLabel: string;
  severity: string;
  arguments: string[];
  triggerConditions: string[];
  clearConditions: string[];
};

export function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-72 overflow-auto rounded-md border border-border bg-muted/20 p-2.5 font-mono text-[11px] leading-relaxed">
      {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function UnavailableCard({ title, body }: { title: string; body: string }) {
  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}

export function TablePager({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  className,
}: {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  /** Merged onto the root footer row (e.g. drop border when wrapped in an outer shell). */
  className?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const start = totalItems === 0 ? 0 : safePage * pageSize + 1;
  const end = totalItems === 0 ? 0 : Math.min(totalItems, (safePage + 1) * pageSize);

  return (
    <div
      className={cn(
        "shrink-0 flex flex-wrap items-center justify-end gap-2 border-t border-border/60 px-3 py-2 text-xs text-muted-foreground",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span>Items per page:</span>
        <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
          <SelectTrigger className="h-8 w-[4.5rem] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="25">25</SelectItem>
            <SelectItem value="50">50</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <span className="min-w-[5.5rem] text-center">
        {start} - {end} of {totalItems}
      </span>
      <div className="flex items-center gap-1">
        <Button type="button" variant="ghost" size="icon" className={DEVICE_DETAIL_TOOLBAR_ICON_BTN_SM} onClick={() => onPageChange(0)} disabled={safePage === 0}>
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={DEVICE_DETAIL_TOOLBAR_ICON_BTN_SM}
          onClick={() => onPageChange(Math.max(0, safePage - 1))}
          disabled={safePage === 0}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={DEVICE_DETAIL_TOOLBAR_ICON_BTN_SM}
          onClick={() => onPageChange(Math.min(totalPages - 1, safePage + 1))}
          disabled={safePage >= totalPages - 1}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={DEVICE_DETAIL_TOOLBAR_ICON_BTN_SM}
          onClick={() => onPageChange(totalPages - 1)}
          disabled={safePage >= totalPages - 1}
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function ReadOnlyDetailsField({
  label,
  value,
  required = false,
  mono = false,
  multiline = false,
  className,
}: {
  label: string;
  value: string;
  required?: boolean;
  mono?: boolean;
  multiline?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>
      <div
        className={cn(
          "rounded-md border border-border/70 bg-background px-2.5 py-2 text-sm shadow-sm",
          multiline ? "min-h-[6.5rem] whitespace-pre-wrap" : "min-h-10",
          mono ? "break-all font-mono text-xs" : "leading-5",
        )}
      >
        {value.trim() ? value : "—"}
      </div>
    </div>
  );
}
