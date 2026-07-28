import { useEffect, useState } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import {
  SCADA_PROPERTY_TYPE_OPTIONS,
  type ScadaPropertyRow,
} from "./scadaSymbolMetadata";

export type ScadaPropertySettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: ScadaPropertyRow | null;
  /** True when adding a new property (vs editing existing). */
  isCreate?: boolean;
  onApply: (row: ScadaPropertyRow) => void;
};

function defaultValueToString(type: string, value: unknown): string {
  if (value == null) return "";
  if (type === "switch") return value === true || value === "true" ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function parseDefaultValue(type: string, raw: string): unknown {
  const t = raw.trim();
  if (type === "number") {
    const n = Number.parseFloat(t);
    return Number.isFinite(n) ? n : 0;
  }
  if (type === "switch") return t === "true";
  if (type === "color" || type === "text" || type === "textarea") return t;
  return t;
}

export function ScadaPropertySettingsDialog({
  open,
  onOpenChange,
  row,
  isCreate,
  onApply,
}: ScadaPropertySettingsDialogProps) {
  const [draft, setDraft] = useState<ScadaPropertyRow | null>(null);

  useEffect(() => {
    if (open && row) {
      setDraft(isCreate ? { ...row, name: "" } : { ...row });
    }
    if (!open) setDraft(null);
  }, [open, row, isCreate]);

  if (!draft) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md" />
      </Dialog>
    );
  }

  const defaultStr = defaultValueToString(draft.type, draft.default);
  const patch = (p: Partial<ScadaPropertyRow>) => setDraft((d) => (d ? { ...d, ...p } : d));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(92vh,44rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3">
          <DialogTitle className="text-base font-semibold">
            {isCreate ? "Add property" : "Property settings"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="prop-id" className="text-sm text-muted-foreground">
              Id
            </Label>
            <Input
              id="prop-id"
              value={draft.id}
              onChange={(e) => patch({ id: e.target.value })}
              className="h-9 font-mono text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prop-name" className="text-sm text-muted-foreground">
              Name
            </Label>
            <Input
              id="prop-name"
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder={isCreate ? undefined : "{i18n:scada.symbol.line}"}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prop-hint" className="text-sm text-muted-foreground">
              Hint
            </Label>
            <Input
              id="prop-hint"
              value={draft.hint ?? ""}
              onChange={(e) => patch({ hint: e.target.value })}
              placeholder="Set"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prop-group" className="text-sm text-muted-foreground">
              Group title
            </Label>
            <Input
              id="prop-group"
              value={draft.group ?? ""}
              onChange={(e) => patch({ group: e.target.value })}
              placeholder="Set"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">Type</Label>
            <Select value={draft.type} onValueChange={(v) => patch({ type: v })}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCADA_PROPERTY_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">Default value</Label>
            {draft.type === "color" ? (
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={/^#[0-9a-f]{6}$/i.test(defaultStr) ? defaultStr : "#000000"}
                  onChange={(e) => patch({ default: e.target.value })}
                  className="h-9 w-14 cursor-pointer rounded border border-input bg-transparent p-0.5"
                />
                <Input
                  value={defaultStr}
                  onChange={(e) => patch({ default: e.target.value })}
                  className="h-9 flex-1 font-mono text-sm"
                  placeholder="#000000"
                />
              </div>
            ) : draft.type === "switch" ? (
              <Switch
                checked={defaultStr === "true"}
                onCheckedChange={(checked) => patch({ default: checked })}
              />
            ) : (
              <Input
                value={defaultStr}
                onChange={(e) => patch({ default: parseDefaultValue(draft.type, e.target.value) })}
                className="h-9 text-sm"
                placeholder="Set"
              />
            )}
          </div>

          <div className="flex items-center justify-between gap-3 py-1">
            <Label htmlFor="prop-required" className="text-sm text-muted-foreground">
              Value required
            </Label>
            <Switch
              id="prop-required"
              checked={Boolean(draft.required)}
              onCheckedChange={(checked) => patch({ required: checked })}
            />
          </div>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="advanced" className="border-none">
              <AccordionTrigger className="py-2 text-sm font-normal text-muted-foreground hover:no-underline focus-visible:ring-0 focus-visible:ring-offset-0">
                Advanced UI settings
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-1 pt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="prop-row-class" className="text-xs text-muted-foreground">
                    Row class
                  </Label>
                  <Input
                    id="prop-row-class"
                    value={String(draft.rowClass ?? "")}
                    onChange={(e) => patch({ rowClass: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prop-field-class" className="text-xs text-muted-foreground">
                    Field class
                  </Label>
                  <Input
                    id="prop-field-class"
                    value={String(draft.fieldClass ?? "")}
                    onChange={(e) => patch({ fieldClass: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prop-condition" className="text-xs text-muted-foreground">
                    Condition
                  </Label>
                  <Input
                    id="prop-condition"
                    value={String(draft.condition ?? "")}
                    onChange={(e) => patch({ condition: e.target.value })}
                    className="h-8 font-mono text-xs"
                    placeholder="Optional expression"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border px-4 py-3 sm:justify-end">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!draft.id.trim()}
            onClick={() => {
              onApply({
                ...draft,
                id: draft.id.trim(),
                name: draft.name,
                hint: draft.hint?.trim() || undefined,
                group: draft.group?.trim() || undefined,
              });
              onOpenChange(false);
            }}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
