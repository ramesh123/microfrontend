import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Sentinel: no preset chosen yet. */
const SOURCE_SELECT_NONE = "__tb_source_none__";
/** Sentinel: free-form JSON path under originator EntityFieldsData. */
const SOURCE_SELECT_CUSTOM = "__tb_source_custom__";

/**
 * ThingsBoard “Source field” dropdown values (JSON keys on originator EntityFieldsData).
 * Order matches ThingsBoard UI: user / device common fields, then profile & ids.
 */
export const TB_ORIGINATOR_SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: "createdTime", label: "Created time" },
  { value: "name", label: "Name" },
  { value: "firstName", label: "First name" },
  { value: "lastName", label: "Last name" },
  { value: "email", label: "Email" },
  { value: "title", label: "Title" },
  { value: "type", label: "Profile name" },
  { value: "label", label: "Label" },
  { value: "additionalInfo", label: "Additional info" },
  { value: "deviceProfileId", label: "Device profile id" },
  { value: "assetProfileId", label: "Asset profile id" },
  { value: "id", label: "Entity id" },
];

const PRESET_SOURCE_VALUES = new Set(TB_ORIGINATOR_SOURCE_OPTIONS.map((o) => o.value));

/** Source dropdown only (custom path input is rendered on a second grid row in the parent for alignment). */
function OriginatorSourceFieldSelect({
  value,
  embedded,
  onSourceChange,
}: {
  value: string;
  embedded: boolean;
  onSourceChange: (next: string) => void;
}) {
  const trimmed = value.trim();
  const isPreset = PRESET_SOURCE_VALUES.has(trimmed);
  const selectValue = isPreset ? trimmed : trimmed ? SOURCE_SELECT_CUSTOM : SOURCE_SELECT_NONE;

  return (
    <Select
      value={selectValue}
      onValueChange={(v) => {
        if (v === SOURCE_SELECT_NONE) onSourceChange("");
        else if (v === SOURCE_SELECT_CUSTOM) onSourceChange("");
        else onSourceChange(v);
      }}
    >
      <SelectTrigger
        aria-label="Source field"
        className={cn(
          "min-w-0 w-full max-w-full [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:flex-1 [&_[data-slot=select-value]]:truncate",
          embedded ? "h-7 text-[11px]" : "h-8 text-xs",
        )}
      >
        {selectValue === SOURCE_SELECT_NONE ? (
          <span className="block min-w-0 flex-1 truncate text-left text-muted-foreground">Source field</span>
        ) : selectValue === SOURCE_SELECT_CUSTOM ? (
          <span className="block min-w-0 flex-1 truncate text-left text-muted-foreground">Custom path…</span>
        ) : (
          <SelectValue placeholder="Source field" />
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={SOURCE_SELECT_NONE} className="text-xs text-muted-foreground">
          Source field
        </SelectItem>
        {TB_ORIGINATOR_SOURCE_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-xs">
            {o.label}
          </SelectItem>
        ))}
        <SelectItem value={SOURCE_SELECT_CUSTOM} className="text-xs">
          Custom path…
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

function originatorShowCustomPathInput(source: string): boolean {
  const trimmed = source.trim();
  const isPreset = PRESET_SOURCE_VALUES.has(trimmed);
  const selectValue = isPreset ? trimmed : trimmed ? SOURCE_SELECT_CUSTOM : SOURCE_SELECT_NONE;
  return !isPreset && (selectValue === SOURCE_SELECT_CUSTOM || Boolean(trimmed));
}

export function readOriginatorDataMapping(configuration: Record<string, unknown>): Record<string, string> {
  const fromObject = (o: unknown): Record<string, string> | null => {
    if (!o || typeof o !== "object" || Array.isArray(o)) return null;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      const ks = k.trim();
      if (!ks) continue;
      out[ks] = typeof v === "string" ? v : v == null ? "" : String(v);
    }
    return out;
  };
  const dm = fromObject(configuration.dataMapping);
  if (dm && Object.keys(dm).length > 0) return dm;
  return fromObject(configuration.fieldsMapping) ?? {};
}

function mappingRowsToObject(rows: { source: string; target: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) {
    const s = r.source.trim();
    const t = r.target.trim();
    if (!s) continue;
    out[s] = t;
  }
  return out;
}

function rowsFromMapping(m: Record<string, string>): { source: string; target: string }[] {
  return Object.entries(m).map(([source, target]) => ({ source, target }));
}

export function OriginatorFieldsMappingBlock({
  configuration,
  onChange,
  embedded,
  configFormSession,
}: {
  configuration: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  embedded: boolean;
  configFormSession: number;
}) {
  const mapping = useMemo(() => readOriginatorDataMapping(configuration), [configuration]);
  const [rows, setRows] = useState(() => rowsFromMapping(mapping));

  useEffect(() => {
    setRows(rowsFromMapping(readOriginatorDataMapping(configuration)));
    // Only re-load rows when the editor opens another node / restore; not on each configuration keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configFormSession]);

  const setMappingObject = useCallback(
    (nextMap: Record<string, string>) => {
      const next = { ...configuration, dataMapping: nextMap };
      delete (next as Record<string, unknown>).fieldsMapping;
      onChange(next);
    },
    [configuration, onChange],
  );

  const flushRows = useCallback(
    (nextRows: { source: string; target: string }[]) => {
      setRows(nextRows);
      setMappingObject(mappingRowsToObject(nextRows));
    },
    [setMappingObject],
  );

  const updateRow = useCallback(
    (index: number, patch: Partial<{ source: string; target: string }>) => {
      const nextRows = rows.map((x, i) => (i === index ? { ...x, ...patch } : x));
      flushRows(nextRows);
    },
    [rows, flushRows],
  );

  const addRow = useCallback(() => {
    const used = new Set(rows.map((x) => x.source.trim()).filter(Boolean));
    const preset =
      TB_ORIGINATOR_SOURCE_OPTIONS.find((p) => !used.has(p.value))?.value ??
      (rows.length === 0 ? "name" : "");
    flushRows([...rows, { source: preset || "name", target: "" }]);
  }, [rows, flushRows]);

  const removeRow = useCallback(
    (index: number) => {
      flushRows(rows.filter((_, i) => i !== index));
    },
    [rows, flushRows],
  );

  const labelCls = cn("text-muted-foreground", embedded ? "text-[9px]" : "text-[10px]");

  return (
    <div className="space-y-2">
      <div className="space-y-0.5">
        <Label className={labelCls}>Originator fields mapping</Label>
        <p className="text-[9px] leading-snug text-muted-foreground">
          Source field → target key. Target keys support templating:{" "}
          <code className="rounded bg-muted/80 px-0.5 font-mono text-[8px]">$[messageKey]</code> and{" "}
          <code className="rounded bg-muted/80 px-0.5 font-mono text-[8px]">{"${metadataKey}"}</code>.
        </p>
      </div>

      <div
        className={cn(
          "rounded-md border border-border bg-muted/20",
          embedded ? "p-1.5" : "p-2",
        )}
      >
        <div
          className={cn(
            "grid items-end gap-x-2 gap-y-1 border-b border-border/60 pb-2 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground",
            embedded ? "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2rem]" : "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.25rem]",
          )}
        >
          <span className="min-w-0">Source field</span>
          <span className="min-w-0">Target key</span>
          <span className="sr-only">Remove</span>
        </div>

        <div className={cn("flex flex-col gap-2", embedded ? "pt-1.5" : "pt-2")}>
          {rows.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No mappings yet — add one below.</p>
          ) : (
            rows.map((row, i) => {
              const showPath = originatorShowCustomPathInput(row.source);
              const rowGrid = embedded
                ? "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2rem]"
                : "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.25rem]";
              return (
                <div key={`originator-map-row-${i}`} className="flex min-w-0 flex-col gap-1">
                  <div className={cn("grid min-w-0 items-center gap-x-2", rowGrid)}>
                    <div className="min-w-0">
                      <OriginatorSourceFieldSelect
                        value={row.source}
                        embedded={embedded}
                        onSourceChange={(next) => updateRow(i, { source: next })}
                      />
                    </div>
                    <Input
                      aria-label={`Target key ${i + 1}`}
                      value={row.target}
                      onChange={(e) => updateRow(i, { target: e.target.value })}
                      placeholder="Target key"
                      className={cn(
                        "min-w-0 font-mono",
                        embedded ? "h-7 text-[11px]" : "h-8 text-xs",
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "shrink-0 text-muted-foreground hover:text-destructive",
                        embedded ? "h-7 w-7" : "h-8 w-8",
                      )}
                      aria-label="Remove mapping"
                      onClick={() => removeRow(i)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {showPath ? (
                    <div className={cn("grid min-w-0 items-center gap-x-2", rowGrid)}>
                      <Input
                        value={row.source}
                        onChange={(e) => updateRow(i, { source: e.target.value })}
                        placeholder="JSON path (e.g. additionalInfo.gatewayId)"
                        className={cn(
                          "min-w-0 font-mono",
                          embedded ? "h-7 text-[11px]" : "h-8 text-xs",
                        )}
                        aria-label={`Custom source field path ${i + 1}`}
                      />
                      <div className="col-span-2 min-h-0 min-w-0" aria-hidden />
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("mt-2 w-full gap-1", embedded ? "h-7 text-[10px]" : "h-8 text-xs")}
          onClick={addRow}
        >
          <Plus className="h-3.5 w-3.5" />
          Add mapping
        </Button>
      </div>
    </div>
  );
}

export function normalizeAttributeNameList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function AttributeNameChipsField({
  id,
  label,
  description,
  value,
  onChange,
  embedded,
}: {
  id: string;
  label: string;
  description?: string;
  value: unknown;
  onChange: (next: string[]) => void;
  embedded: boolean;
}) {
  const keys = useMemo(() => normalizeAttributeNameList(value), [value]);
  const [draft, setDraft] = useState("");
  const labelCls = cn("text-muted-foreground", embedded ? "text-[9px]" : "text-[10px]");

  const add = useCallback(() => {
    const t = draft.trim();
    if (!t || keys.includes(t)) return;
    onChange([...keys, t]);
    setDraft("");
  }, [draft, keys, onChange]);

  const remove = useCallback(
    (k: string) => {
      onChange(keys.filter((x) => x !== k));
    },
    [keys, onChange],
  );

  return (
    <div className="space-y-1.5">
      <Label htmlFor={`${id}-draft`} className={labelCls}>
        {label}
      </Label>
      {description ? <p className="text-[9px] leading-snug text-muted-foreground">{description}</p> : null}
      <div
        className={cn(
          "flex min-h-[2.5rem] flex-wrap items-center gap-1.5 rounded-md border border-input bg-muted/30 px-2 py-1.5",
          embedded && "min-h-9",
        )}
      >
        {keys.map((k) => (
          <Badge
            key={k}
            variant="secondary"
            className="h-6 max-w-full gap-1 truncate border border-border/80 bg-background pl-2 pr-0.5 font-mono text-xs font-normal"
            title={k}
          >
            <span className="truncate">{k}</span>
            <button
              type="button"
              className="rounded p-0.5 text-muted-foreground hover:bg-muted-foreground/15 hover:text-foreground"
              aria-label={`Remove ${k}`}
              onClick={() => remove(k)}
            >
              <X className="h-3 w-3 shrink-0" />
            </button>
          </Badge>
        ))}
        <Input
          id={`${id}-draft`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add attribute key"
          className={cn(
            "min-w-[8rem] flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0",
            embedded ? "h-6 text-[11px]" : "h-7 text-xs",
          )}
        />
        <Button type="button" variant="secondary" size="sm" className="h-6 shrink-0 px-2 text-[10px]" onClick={add}>
          Add
        </Button>
      </div>
    </div>
  );
}
