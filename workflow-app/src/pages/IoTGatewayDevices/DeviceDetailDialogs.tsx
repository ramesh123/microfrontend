import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";

import { Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { clearIotGatewayAlarm } from "@/controllers/API/devicesApi";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import {
  JsonBlock,
  ReadOnlyDetailsField,
  IOT_DEVICE_DIALOG_HEADER,
  IOT_DEVICE_DIALOG_CLOSE,
  DEVICE_DETAIL_DANGER_ICON_BTN,
} from "./DeviceDetailTabShared";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';

export type TelemetryInputType = "string" | "number" | "boolean";

type AttributeDialogProps = {
  open: boolean;
  attrKey: string;
  attrVal: string;
  onOpenChange: (open: boolean) => void;
  onAttrKeyChange: (value: string) => void;
  onAttrValChange: (value: string) => void;
  onDelete: () => void;
  onSave: () => void;
};

export function DeviceAttributeDialog({
  open,
  attrKey,
  attrVal,
  onOpenChange,
  onAttrKeyChange,
  onAttrValChange,
  onDelete,
  onSave,
}: AttributeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{attrKey.trim() ? "Edit attribute" : "Add attribute"}</DialogTitle>
          <DialogDescription>Save a key/value pair for the selected attribute scope.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Key</Label>
            <Input value={attrKey} onChange={(e) => onAttrKeyChange(e.target.value)} placeholder="serialNumber" />
          </div>
          <div className="space-y-1">
            <Label>Value</Label>
            <Input value={attrVal} onChange={(e) => onAttrValChange(e.target.value)} placeholder="ABC-123" />
          </div>
        </div>
        <DialogFooter>
          {attrKey.trim() ? (
            <Button type="button" variant="destructive" onClick={onDelete}>
              Delete
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={onSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type TelemetryDialogProps = {
  open: boolean;
  telemetryEntryKey: string;
  telemetryEntryType: TelemetryInputType;
  telemetryEntryValue: string;
  teleSaving: boolean;
  telemetryValuePlaceholder: string;
  onOpenChange: (open: boolean) => void;
  onTelemetryEntryKeyChange: (value: string) => void;
  onTelemetryEntryTypeChange: (value: TelemetryInputType) => void;
  onTelemetryEntryValueChange: (value: string) => void;
  onAdd: () => void;
  /** Clears the draft form (same as reopening the dialog). */
  onClearForm?: () => void;
};

export function DeviceTelemetryDialog({
  open,
  telemetryEntryKey,
  telemetryEntryType,
  telemetryEntryValue,
  teleSaving,
  telemetryValuePlaceholder,
  onOpenChange,
  onTelemetryEntryKeyChange,
  onTelemetryEntryTypeChange,
  onTelemetryEntryValueChange,
  onAdd,
  onClearForm,
}: TelemetryDialogProps) {
  const hasDraft = Boolean(telemetryEntryKey.trim() || telemetryEntryValue.trim());
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] gap-0 overflow-hidden p-0 sm:max-w-lg"
        closeButtonClassName={IOT_DEVICE_DIALOG_CLOSE}
      >
        <DialogHeader className={IOT_DEVICE_DIALOG_HEADER}>
          <DialogTitle className="text-base font-semibold leading-snug text-foreground">Add telemetry</DialogTitle>
          <DialogDescription className="text-sm leading-snug text-muted-foreground">
            Add a telemetry key/value pair for the latest device payload.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 bg-background p-3">
          <Input value={telemetryEntryKey} onChange={(e) => onTelemetryEntryKeyChange(e.target.value)} placeholder="Key*" className="h-9 text-sm" />
          <div className="grid gap-2 md:grid-cols-[10rem_minmax(0,1fr)]">
            <Select value={telemetryEntryType} onValueChange={(value) => onTelemetryEntryTypeChange(value as TelemetryInputType)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="string">String</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="boolean">Boolean</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={telemetryEntryValue}
              onChange={(e) => onTelemetryEntryValueChange(e.target.value)}
              placeholder={telemetryValuePlaceholder}
              className="h-9 text-sm"
            />
          </div>
        </div>
        <DialogFooter className="flex w-full flex-col gap-2 border-t border-border bg-background px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-h-8 items-center">
            {onClearForm && hasDraft ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={onClearForm}
              >
                <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                Clear
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={onAdd} disabled={teleSaving || !telemetryEntryKey.trim() || !telemetryEntryValue.trim()}>
              {teleSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type CalculatedFieldDialogProps = {
  open: boolean;
  cfName: string;
  cfArgumentNames: string[];
  cfExpr: string;
  cfOutputType: string;
  cfOutputKey: string;
  cfDecimals: string;
  cfUseLatestTs: boolean;
  cfStrategy: "DIRECT" | "RULE_CHAIN";
  cfBusy: boolean;
  hasArguments: boolean;
  onOpenChange: (open: boolean) => void;
  onNameChange: (value: string) => void;
  onAddArgument: () => void;
  onArgumentChange: (index: number, value: string) => void;
  onRemoveArgument: (index: number) => void;
  onExpressionChange: (value: string) => void;
  onOutputTypeChange: (value: string) => void;
  onOutputKeyChange: (value: string) => void;
  onDecimalsChange: (value: string) => void;
  onUseLatestTsChange: (value: boolean) => void;
  onStrategyChange: (value: "DIRECT" | "RULE_CHAIN") => void;
  onAdd: () => void;
  /** Resets the form to the same defaults as when opening the dialog. */
  onClearDraft?: () => void;
};

export function DeviceCalculatedFieldDialog({
  open,
  cfName,
  cfArgumentNames,
  cfExpr,
  cfOutputType,
  cfOutputKey,
  cfDecimals,
  cfUseLatestTs,
  cfStrategy,
  cfBusy,
  hasArguments,
  onOpenChange,
  onNameChange,
  onAddArgument,
  onArgumentChange,
  onRemoveArgument,
  onExpressionChange,
  onOutputTypeChange,
  onOutputKeyChange,
  onDecimalsChange,
  onUseLatestTsChange,
  onStrategyChange,
  onAdd,
  onClearDraft,
}: CalculatedFieldDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] gap-0 overflow-auto p-0 sm:max-w-4xl"
        closeButtonClassName={IOT_DEVICE_DIALOG_CLOSE}
      >
        <DialogHeader className={IOT_DEVICE_DIALOG_HEADER}>
          <DialogTitle className="text-base font-semibold leading-snug text-foreground">Calculated field</DialogTitle>
          <DialogDescription className="text-sm leading-snug text-muted-foreground">
            Configure a calculated field using the device telemetry inputs.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 bg-muted/15 p-3">
          <Card className="gap-0 border-border/70 py-0 shadow-sm">
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
              <CardTitle className="text-sm">General</CardTitle>
              <Badge variant="outline">Uses latest timestamp</Badge>
            </CardHeader>
            <CardContent className="grid gap-2 px-3 py-2 md:grid-cols-[minmax(0,1fr)_11rem]">
              <div className="space-y-1">
                <Label>
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input value={cfName} onChange={(e) => onNameChange(e.target.value)} placeholder="Average temperature" />
              </div>
              <div className="space-y-1">
                <Label>Interval</Label>
                <Button type="button" variant="outline" className="h-8 w-full justify-center rounded-full text-xs">
                  15 min
                </Button>
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Type</Label>
                <Select value="SIMPLE" onValueChange={() => undefined}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SIMPLE">Simple</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0 border-border/70 py-0 shadow-sm">
            <CardHeader className="border-b border-border/60 px-3 py-2">
              <CardTitle className="text-sm">Arguments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-3 py-2">
              <div className="space-y-2 rounded-md border border-border/60 p-2">
                {hasArguments ? (
                  <div className="space-y-1.5">
                    {cfArgumentNames.map((argument, index) => (
                      <div key={`cf-arg-${index}`} className="flex gap-1.5">
                        <Input value={argument} onChange={(e) => onArgumentChange(index, e.target.value)} placeholder={`Argument ${index + 1}`} />
                        <Button type="button" variant="ghost" size="icon" className={DEVICE_DETAIL_DANGER_ICON_BTN} onClick={() => onRemoveArgument(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-2 text-center text-sm text-destructive">At least one argument is required.</div>
                )}
                <Button type="button" variant="outline" size="sm" className="h-8" onClick={onAddArgument}>
                  Add argument
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0 border-border/70 py-0 shadow-sm">
            <CardHeader className="border-b border-border/60 px-3 py-2">
              <CardTitle className="text-sm">Expression</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 px-3 py-2">
              <Textarea value={cfExpr} onChange={(e) => onExpressionChange(e.target.value)} className="min-h-[4.5rem] font-mono text-xs" placeholder="(temperature - 32) / 1.8" />
              <p className="text-xs text-muted-foreground">Default expression demonstrates how to transform a temperature from Fahrenheit to Celsius.</p>
            </CardContent>
          </Card>

          <Card className="gap-0 border-border/70 py-0 shadow-sm">
            <CardHeader className="border-b border-border/60 px-3 py-2">
              <CardTitle className="text-sm">Output</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-3 py-2">
              <div className="space-y-1">
                <Label>Output type</Label>
                <Select value={cfOutputType} onValueChange={onOutputTypeChange}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TIME_SERIES">Time series</SelectItem>
                    <SelectItem value="ATTRIBUTE">Attribute</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <Input value={cfOutputKey} onChange={(e) => onOutputKeyChange(e.target.value)} placeholder="Time series key*" />
                <Input value={cfDecimals} onChange={(e) => onDecimalsChange(e.target.value)} placeholder="Decimals by default" />
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2.5 py-1.5">
                <div className="space-y-0.5">
                  <p className="text-sm">Use latest timestamp</p>
                </div>
                <Switch checked={cfUseLatestTs} onCheckedChange={onUseLatestTsChange} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 px-2.5 py-1.5">
                <Label className="text-sm">Strategy</Label>
                <div className="inline-flex rounded-full bg-muted p-0.5">
                  <button
                    type="button"
                    className={cfStrategy === "DIRECT" ? "rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground" : "rounded-full px-3 py-1 text-xs text-muted-foreground"}
                    onClick={() => onStrategyChange("DIRECT")}
                  >
                    Process right away
                  </button>
                  <button
                    type="button"
                    className={cfStrategy === "RULE_CHAIN" ? "rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground" : "rounded-full px-3 py-1 text-xs text-muted-foreground"}
                    onClick={() => onStrategyChange("RULE_CHAIN")}
                  >
                    Process via Rule Chains
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <DialogFooter className="flex w-full flex-col gap-2 border-t border-border bg-background px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-h-8 items-center">
            {onClearDraft ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={onClearDraft}
              >
                <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                Clear form
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={onAdd} disabled={cfBusy}>
              {cfBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type AlarmRuleDialogProps = {
  open: boolean;
  intervalLabel: string;
  alarmType: string;
  alarmArguments: string[];
  alarmTriggers: string[];
  alarmClears: string[];
  alarmSeverity: string;
  onOpenChange: (open: boolean) => void;
  onAlarmTypeChange: (value: string) => void;
  onAddArgument: () => void;
  onArgumentChange: (index: number, value: string) => void;
  onRemoveArgument: (index: number) => void;
  onAddTrigger: () => void;
  onTriggerChange: (index: number, value: string) => void;
  onRemoveTrigger: (index: number) => void;
  onAddClear: () => void;
  onClearChange: (index: number, value: string) => void;
  onRemoveClear: (index: number) => void;
  onSeverityChange: (value: string) => void;
  onAdd: () => void;
  onClearDraft?: () => void;
};

export function DeviceAlarmRuleDialog({
  open,
  intervalLabel,
  alarmType,
  alarmArguments,
  alarmTriggers,
  alarmClears,
  alarmSeverity,
  onOpenChange,
  onAlarmTypeChange,
  onAddArgument,
  onArgumentChange,
  onRemoveArgument,
  onAddTrigger,
  onTriggerChange,
  onRemoveTrigger,
  onAddClear,
  onClearChange,
  onRemoveClear,
  onSeverityChange,
  onAdd,
  onClearDraft,
}: AlarmRuleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] gap-0 overflow-auto p-0 sm:max-w-xl"
        closeButtonClassName={IOT_DEVICE_DIALOG_CLOSE}
      >
        <DialogHeader className={IOT_DEVICE_DIALOG_HEADER}>
          <DialogTitle className="text-base font-semibold leading-snug text-foreground">Alarm rule</DialogTitle>
          <DialogDescription className="text-sm leading-snug text-muted-foreground">
            Configure a device alarm rule layout matching the ThingsBoard flow.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 bg-muted/15 p-2.5">
          <Card className="gap-0 border-border/70 py-0 shadow-sm">
            <CardHeader className="flex min-h-9 flex-row items-center justify-between gap-2 border-b border-border/60 px-2.5 py-1.5">
              <CardTitle className="text-sm font-medium">General</CardTitle>
              <Button type="button" variant="outline" className="h-7 shrink-0 rounded-full px-2.5 text-xs">
                {intervalLabel}
              </Button>
            </CardHeader>
            <CardContent className="space-y-1.5 px-2.5 py-1.5">
              <Input value={alarmType} onChange={(e) => onAlarmTypeChange(e.target.value)} placeholder="Alarm Type*" />
              <p className="text-[11px] leading-snug text-muted-foreground">Alarm details are highlighted across the alarm rows once the rule is configured.</p>
            </CardContent>
          </Card>

          <Card className="gap-0 border-border/70 py-0 shadow-sm">
            <CardHeader className="flex min-h-9 flex-row items-center border-b border-border/60 px-2.5 py-1.5">
              <CardTitle className="text-sm font-medium">Arguments*</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 px-2.5 py-1.5">
              {alarmArguments.length === 0 ? (
                <div className="py-2 text-center text-sm text-destructive">At least one argument is required.</div>
              ) : (
                <div className="space-y-1.5">
                  {alarmArguments.map((argument, index) => (
                    <div key={`alarm-arg-${index}`} className="flex gap-1.5">
                      <Input value={argument} onChange={(e) => onArgumentChange(index, e.target.value)} placeholder={`Argument ${index + 1}`} />
                      <Button type="button" variant="ghost" size="icon" className={DEVICE_DETAIL_DANGER_ICON_BTN} onClick={() => onRemoveArgument(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onAddArgument}>
                Add argument
              </Button>
            </CardContent>
          </Card>

          <Card className="gap-0 border-border/70 py-0 shadow-sm">
            <CardHeader className="flex min-h-9 flex-row items-center border-b border-border/60 px-2.5 py-1.5">
              <CardTitle className="text-sm font-medium">Trigger conditions*</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 px-2.5 py-1.5">
              {alarmTriggers.length === 0 ? (
                <div className="py-2 text-center text-sm text-destructive">At least one trigger condition is required.</div>
              ) : (
                <div className="space-y-1.5">
                  {alarmTriggers.map((trigger, index) => (
                    <div key={`alarm-trigger-${index}`} className="flex gap-1.5">
                      <Input value={trigger} onChange={(e) => onTriggerChange(index, e.target.value)} placeholder={`Trigger condition ${index + 1}`} />
                      <Button type="button" variant="ghost" size="icon" className={DEVICE_DETAIL_DANGER_ICON_BTN} onClick={() => onRemoveTrigger(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onAddTrigger}>
                Add trigger condition
              </Button>
            </CardContent>
          </Card>

          <Card className="gap-0 border-border/70 py-0 shadow-sm">
            <CardHeader className="flex min-h-9 flex-row items-center border-b border-border/60 px-2.5 py-1.5">
              <CardTitle className="text-sm font-medium">Clear condition</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 px-2.5 py-1.5">
              {alarmClears.length === 0 ? (
                <div className="py-2 text-center text-sm text-muted-foreground">No clear condition configured.</div>
              ) : (
                <div className="space-y-1.5">
                  {alarmClears.map((condition, index) => (
                    <div key={`alarm-clear-${index}`} className="flex gap-1.5">
                      <Input value={condition} onChange={(e) => onClearChange(index, e.target.value)} placeholder={`Clear condition ${index + 1}`} />
                      <Button type="button" variant="ghost" size="icon" className={DEVICE_DETAIL_DANGER_ICON_BTN} onClick={() => onRemoveClear(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onAddClear}>
                Add clear condition
              </Button>
            </CardContent>
          </Card>

          <Card className="gap-0 border-border/70 py-0 shadow-sm">
            <CardHeader className="flex min-h-9 flex-row items-center border-b border-border/60 px-2.5 py-1.5">
              <CardTitle className="text-sm font-medium">Advanced settings</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-1.5 px-2.5 py-1.5 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Severity</Label>
                <Select value={alarmSeverity} onValueChange={onSeverityChange}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Critical">Critical</SelectItem>
                    <SelectItem value="Major">Major</SelectItem>
                    <SelectItem value="Minor">Minor</SelectItem>
                    <SelectItem value="Warning">Warning</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>
        <DialogFooter className="flex w-full flex-col gap-2 border-t border-border bg-background px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-h-8 items-center">
            {onClearDraft ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={onClearDraft}
              >
                <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                Clear form
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={onAdd}>
              Add
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type AlarmDetailsDialogProps = {
  open: boolean;
  originator: string;
  severity: string;
  startTime: string;
  duration: string;
  type: string;
  status: string;
  assignee: string;
  alarmId: string;
  additionalInfo: unknown;
  onOpenChange: (open: boolean) => void;
  /** When true, footer shows “Clear alarm” (IoT Gateway alarms list) instead of Close. */
  showClearAlarm?: boolean;
  /** Called after a successful clear; e.g. refresh the alarms table. */
  onAlarmCleared?: () => void | Promise<void>;
};

function normalizeJsonPayload(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return JSON.stringify(JSON.parse(trimmed), null, 2);
      } catch {
        return value;
      }
    }
    return value;
  }
  if (value == null) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function renderJsonValueToken(value: string): ReactNode {
  const hasComma = value.endsWith(",");
  const core = hasComma ? value.slice(0, -1) : value;
  const suffix = hasComma ? <span className="text-slate-500 dark:text-slate-500">,</span> : null;

  if (core === "{" || core === "}" || core === "[" || core === "]") {
    return (
      <>
        <span className="text-slate-600 dark:text-slate-400">{core}</span>
        {suffix}
      </>
    );
  }

  if (core.startsWith('"') && core.endsWith('"')) {
    return (
      <>
        <span className="text-emerald-700 dark:text-emerald-400">{core}</span>
        {suffix}
      </>
    );
  }

  if (/^-?\d+(\.\d+)?$/.test(core)) {
    return (
      <>
        <span className="text-amber-700 dark:text-amber-300">{core}</span>
        {suffix}
      </>
    );
  }

  if (core === "true" || core === "false") {
    return (
      <>
        <span className="text-violet-700 dark:text-violet-300">{core}</span>
        {suffix}
      </>
    );
  }

  if (core === "null") {
    return (
      <>
        <span className="text-rose-700 dark:text-rose-400">{core}</span>
        {suffix}
      </>
    );
  }

  return (
    <>
      <span className="text-slate-700 dark:text-slate-300">{core}</span>
      {suffix}
    </>
  );
}

function renderJsonLine(line: string): ReactNode {
  const indentMatch = line.match(/^\s*/);
  const indent = indentMatch?.[0] ?? "";
  const content = line.slice(indent.length);

  if (!content) return indent;

  const keyMatch = content.match(/^(".*?"):\s*(.*)$/);
  if (!keyMatch) {
    return (
      <>
        {indent}
        {renderJsonValueToken(content)}
      </>
    );
  }

  const [, key, rawValue] = keyMatch;

  return (
    <>
      {indent}
      <span className="text-sky-700 dark:text-sky-400">{key}</span>
      <span className="text-slate-500 dark:text-slate-400">: </span>
      {renderJsonValueToken(rawValue)}
    </>
  );
}

function ColorJsonBlock({ value }: { value: unknown }) {
  const formatted = normalizeJsonPayload(value);
  const lines = (formatted || "{}").split("\n");

  return (
    <div className="overflow-hidden rounded-md border border-primary/15 bg-primary/[0.06] shadow-sm dark:border-primary/25 dark:bg-primary/10">
      <div className="max-h-[18rem] overflow-auto font-mono text-xs">
        <div className="grid min-w-full grid-cols-[2.5rem_minmax(0,1fr)]">
          {lines.map((line, index) => (
            <div key={`${index}-${line}`} className="contents">
              <div className="select-none border-r border-border bg-muted/60 px-2 py-1 text-right text-[11px] text-muted-foreground dark:bg-muted/40">
                {index + 1}
              </div>
              <pre className="whitespace-pre-wrap break-all bg-background/50 px-3 py-1 text-foreground dark:bg-background/30">
                {renderJsonLine(line)}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DeviceAlarmDetailsDialog({
  open,
  originator,
  severity,
  startTime,
  duration,
  type,
  status,
  assignee,
  alarmId,
  additionalInfo,
  onOpenChange,
  showClearAlarm = false,
  onAlarmCleared,
}: AlarmDetailsDialogProps) {
  const [clearing, setClearing] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) setClearConfirmOpen(false);
  }, [open]);

  const performClearAlarm = useCallback(async () => {
    const id = alarmId.trim();
    if (!id || id === "—") {
      toast.error("Missing alarm id.");
      setClearConfirmOpen(false);
      return;
    }
    setClearing(true);
    try {
      await clearIotGatewayAlarm(id);
      toast.success("Alarm cleared.");
      setClearConfirmOpen(false);
      onOpenChange(false);
      await onAlarmCleared?.();
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to clear alarm."));
    } finally {
      setClearing(false);
    }
  }, [alarmId, onAlarmCleared, onOpenChange]);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          hideClose
          className="flex h-full w-[min(100vw,72rem)] min-w-0 max-w-[72rem] flex-col gap-0 overflow-hidden border-l p-0"
        >
          <SheetHeader className="relative shrink-0 gap-0.5 border-b border-primary/20 bg-primary p-0 px-3 py-2 text-primary-foreground">
            <SheetClose
              type="button"
              className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-sm text-primary-foreground opacity-90 ring-offset-background transition-opacity hover:bg-primary-foreground/15 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </SheetClose>
            <SheetTitle className="pr-9 text-sm font-semibold leading-tight text-primary-foreground">
              Alarm details
            </SheetTitle>
            <SheetDescription className="text-xs leading-snug text-primary-foreground/85">
              Review the selected alarm summary and its additional info payload.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-muted/20 p-3 dark:bg-muted/30">
            <div className="grid gap-3 md:grid-cols-2">
              <ReadOnlyDetailsField label="Originator" value={originator} />
              <ReadOnlyDetailsField label="Severity" value={severity} />
              <ReadOnlyDetailsField label="Start time" value={startTime} />
              <ReadOnlyDetailsField label="Duration" value={duration} />
              <ReadOnlyDetailsField label="Type" value={type} />
              <ReadOnlyDetailsField label="Status" value={status} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">Additional info</Label>
              <ColorJsonBlock value={additionalInfo} />
            </div>
            <div className="grid gap-3 md:grid-cols-1">
              <ReadOnlyDetailsField label="Assignee" value={assignee} />
            </div>
          </div>
          <SheetFooter className="shrink-0 flex-row justify-end gap-2 border-t border-border bg-background px-3 py-2.5">
            {showClearAlarm ? (
              <Button
                type="button"
                onClick={() => setClearConfirmOpen(true)}
                disabled={clearing || !alarmId.trim() || alarmId === "—"}
              >
                Clear alarm
              </Button>
            ) : (
              <Button type="button" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {showClearAlarm ? (
        <AlertDialog
          open={clearConfirmOpen}
          onOpenChange={(next) => {
            if (!clearing) setClearConfirmOpen(next);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear alarm?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to clear this alarm? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={clearing}>Cancel</AlertDialogCancel>
              <Button
                type="button"
                variant="destructive"
                onClick={() => void performClearAlarm()}
                disabled={clearing}
              >
                {clearing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Yes
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </>
  );
}

type EditDeviceDialogProps = {
  open: boolean;
  submitting: boolean;
  name: string;
  label: string;
  profileId: string;
  description: string;
  gateway: boolean;
  profiles: Array<{ id: string; name: string }>;
  onOpenChange: (open: boolean) => void;
  onNameChange: (value: string) => void;
  onLabelChange: (value: string) => void;
  onProfileChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onGatewayChange: (value: boolean) => void;
  onSave: () => void;
};

export function DeviceEditDialog({
  open,
  submitting,
  name,
  label,
  profileId,
  description,
  gateway,
  profiles,
  onOpenChange,
  onNameChange,
  onLabelChange,
  onProfileChange,
  onDescriptionChange,
  onGatewayChange,
  onSave,
}: EditDeviceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit device</DialogTitle>
          <DialogDescription>Update the core device metadata and profile.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-1">
          <div className="space-y-1">
            <Label>
              Name <span className="text-destructive">*</span>
            </Label>
            <Input value={name} onChange={(e) => onNameChange(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Label</Label>
            <Input value={label} onChange={(e) => onLabelChange(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>
              Device profile <span className="text-destructive">*</span>
            </Label>
            <Select value={profileId || "__none__"} onValueChange={(value) => onProfileChange(value === "__none__" ? "" : value)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select profile" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select profile…</SelectItem>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => onDescriptionChange(e.target.value)} rows={4} />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="edit-gateway" checked={gateway} onCheckedChange={(checked) => onGatewayChange(checked === true)} />
            <Label htmlFor="edit-gateway" className="cursor-pointer font-normal">
              Gateway device
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={onSave} disabled={submitting}>
            {submitting ? "Saving..." : "Apply changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type CredentialsDialogProps = {
  open: boolean;
  loading: boolean;
  credentialsLabel: string;
  credentialsJson: string;
  onOpenChange: (open: boolean) => void;
  onReload: () => void;
  onCopy: () => void;
  onJsonChange: (value: string) => void;
  onSave: () => void;
};

export function DeviceCredentialsDialog({
  open,
  loading,
  credentialsLabel,
  credentialsJson,
  onOpenChange,
  onReload,
  onCopy,
  onJsonChange,
  onSave,
}: CredentialsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage credentials</DialogTitle>
          <DialogDescription>
            Supported flows currently exposed by the gateway: access-token style payloads, MQTT basic payloads, and raw JSON editing.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{credentialsLabel}</Badge>
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={onReload} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Reload
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={onCopy}>
              Copy credentials
            </Button>
          </div>
          <Textarea
            value={credentialsJson}
            onChange={(e) => onJsonChange(e.target.value)}
            className="min-h-[22rem] font-mono text-xs"
            placeholder='{ "credentialsType": "ACCESS_TOKEN", "credentialsId": "..." }'
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" onClick={onSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ConnectivityDialogProps = {
  open: boolean;
  protocol: "MQTT" | "HTTP" | "COAP";
  operatingSystem: "linux" | "windows";
  command: string;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onProtocolChange: (value: "MQTT" | "HTTP" | "COAP") => void;
  onOperatingSystemChange: (value: "linux" | "windows") => void;
  onReloadCredentials: () => void;
  onCopyCommand: () => void;
};

export function DeviceConnectivityDialog({
  open,
  protocol,
  operatingSystem,
  command,
  loading,
  onOpenChange,
  onProtocolChange,
  onOperatingSystemChange,
  onReloadCredentials,
  onCopyCommand,
}: ConnectivityDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Check connectivity</DialogTitle>
          <DialogDescription>
            Pick a protocol and operating system, copy the generated command, and run it in a terminal to publish test telemetry.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-1 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Protocol</Label>
            <Select value={protocol} onValueChange={(value) => onProtocolChange(value as "MQTT" | "HTTP" | "COAP")}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MQTT">MQTT</SelectItem>
                <SelectItem value="HTTP">HTTP</SelectItem>
                <SelectItem value="COAP">CoAP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Operating system</Label>
            <Select value={operatingSystem} onValueChange={(value) => onOperatingSystemChange(value as "linux" | "windows")}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="linux">Linux / macOS</SelectItem>
                <SelectItem value="windows">Windows</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Generated command</Label>
          <Textarea readOnly value={command} className="min-h-[12rem] font-mono text-xs" />
          <p className="text-sm text-muted-foreground">
            If the device becomes active after running the command, telemetry has reached the platform successfully.
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onReloadCredentials} disabled={loading}>
            {loading ? "Loading..." : "Reload credentials"}
          </Button>
          <Button type="button" onClick={onCopyCommand}>
            Copy command
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type AssignDialogProps = {
  open: boolean;
  loading: boolean;
  selectedCustomer: string;
  customers: Array<{ id: string; title: string }>;
  onOpenChange: (open: boolean) => void;
  onCustomerChange: (value: string) => void;
  onAssign: () => void;
};

export function DeviceAssignDialog({
  open,
  loading,
  selectedCustomer,
  customers,
  onOpenChange,
  onCustomerChange,
  onAssign,
}: AssignDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign device to customer</DialogTitle>
          <DialogDescription>Select the customer that should own this device.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1">
            <Label>Customer</Label>
            <Select value={selectedCustomer || "__none__"} onValueChange={(value) => onCustomerChange(value === "__none__" ? "" : value)}>
              <SelectTrigger className="h-9" disabled={loading}>
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select customer…</SelectItem>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={loading} onClick={onAssign}>
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type DeleteDialogProps = {
  open: boolean;
  submitting: boolean;
  deviceTitle: string;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
};

export function DeviceDeleteDialog({
  open,
  submitting,
  deviceTitle,
  onOpenChange,
  onDelete,
}: DeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete device?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete <span className="font-medium text-foreground">{deviceTitle}</span>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={submitting} onClick={onDelete}>
            {submitting ? "Deleting..." : "Delete device"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
