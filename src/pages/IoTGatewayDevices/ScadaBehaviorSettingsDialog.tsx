import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";

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

import {
  SCADA_BEHAVIOR_TYPE_OPTIONS,
  SCADA_VALUE_TYPE_OPTIONS,
  type ScadaBehaviorRow,
} from "./scadaSymbolMetadata";

export type ScadaBehaviorSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: ScadaBehaviorRow | null;
  isCreate?: boolean;
  onApply: (row: ScadaBehaviorRow) => void;
};

export function ScadaBehaviorSettingsDialog({
  open,
  onOpenChange,
  row,
  isCreate,
  onApply,
}: ScadaBehaviorSettingsDialogProps) {
  const [draft, setDraft] = useState<ScadaBehaviorRow | null>(null);
  const [editingDefault, setEditingDefault] = useState(false);

  useEffect(() => {
    if (open && row) {
      setDraft(
        isCreate
          ? { ...row, name: "", defaultSettingsLabel: undefined }
          : { ...row },
      );
      setEditingDefault(false);
    }
    if (!open) {
      setDraft(null);
      setEditingDefault(false);
    }
  }, [open, row, isCreate]);

  if (!draft) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md" />
      </Dialog>
    );
  }

  const patch = (p: Partial<ScadaBehaviorRow>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const isValue = draft.type === "value";
  const isBoolean = isValue && (draft.valueType ?? "STRING") === "BOOLEAN";
  const defaultLabel = String(draft.defaultSettingsLabel ?? "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(92vh,44rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3">
          <DialogTitle className="text-base font-semibold">
            {isCreate ? "Add behavior" : "Behavior settings"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="beh-id" className="text-sm text-muted-foreground">
              Id
            </Label>
            <Input
              id="beh-id"
              value={draft.id}
              onChange={(e) => patch({ id: e.target.value })}
              className="h-9 font-mono text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="beh-name" className="text-sm text-muted-foreground">
              Name
            </Label>
            <Input
              id="beh-name"
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder={isCreate ? undefined : "{i18n:scada.symbol.arrow-presence}"}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="beh-hint" className="text-sm text-muted-foreground">
              Hint
            </Label>
            <Input
              id="beh-hint"
              value={draft.hint ?? ""}
              onChange={(e) => patch({ hint: e.target.value })}
              placeholder="{i18n:scada.symbol.arrow-presence-hint}"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="beh-group" className="text-sm text-muted-foreground">
              Group title
            </Label>
            <Input
              id="beh-group"
              value={draft.group ?? ""}
              onChange={(e) => patch({ group: e.target.value })}
              placeholder="Set"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">Type</Label>
            <Select value={draft.type} onValueChange={(v) => patch({ type: v as ScadaBehaviorRow["type"] })}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCADA_BEHAVIOR_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isValue ? (
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Value type</Label>
              <Select
                value={draft.valueType ?? "STRING"}
                onValueChange={(v) => patch({ valueType: v })}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCADA_VALUE_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {isBoolean ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="beh-true" className="text-sm text-muted-foreground">
                  True label
                </Label>
                <Input
                  id="beh-true"
                  value={draft.trueLabel ?? ""}
                  onChange={(e) => patch({ trueLabel: e.target.value })}
                  placeholder="{i18n:scada.symbol.present}"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="beh-false" className="text-sm text-muted-foreground">
                  False label
                </Label>
                <Input
                  id="beh-false"
                  value={draft.falseLabel ?? ""}
                  onChange={(e) => patch({ falseLabel: e.target.value })}
                  placeholder="{i18n:scada.symbol.absent}"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="beh-state" className="text-sm text-muted-foreground">
                  State label
                </Label>
                <Input
                  id="beh-state"
                  value={draft.stateLabel ?? ""}
                  onChange={(e) => patch({ stateLabel: e.target.value })}
                  placeholder="{i18n:scada.symbol.arrow-present}"
                  className="h-9 text-sm"
                />
              </div>
            </>
          ) : null}

          {isValue ? (
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Default settings</Label>
              <div className="flex items-center gap-1">
                {editingDefault ? (
                  <Input
                    value={defaultLabel}
                    onChange={(e) => patch({ defaultSettingsLabel: e.target.value })}
                    className="h-9 flex-1 text-sm"
                    autoFocus
                    onBlur={() => setEditingDefault(false)}
                  />
                ) : (
                  <div className="flex h-9 flex-1 items-center rounded-md border border-input bg-background px-3 text-sm text-foreground">
                    {defaultLabel || <span className="text-muted-foreground">—</span>}
                  </div>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  title="Edit default settings label"
                  onClick={() => setEditingDefault(true)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
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
                name: draft.name.trim(),
                hint: draft.hint?.trim() || undefined,
                group: draft.group?.trim() || undefined,
                trueLabel: draft.trueLabel?.trim() || undefined,
                falseLabel: draft.falseLabel?.trim() || undefined,
                stateLabel: draft.stateLabel?.trim() || undefined,
                defaultSettingsLabel: draft.defaultSettingsLabel?.trim() || undefined,
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
