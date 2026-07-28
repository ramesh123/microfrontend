import { useCallback, useMemo } from "react";

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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import {
  getTbNodeFormSchema,
  schemaFieldKeys,
  stripKeysFromRuleNodeRemainder,
  type TbFieldDef,
  type TbNodeFormSchema,
} from "../ruleNodeTbFormRegistry";
import { TB_UI_NGX_RULE_NODE_ROOT } from "../rule-node/tbUiNgxAnchor";
import { AttributeNameChipsField, OriginatorFieldsMappingBlock } from "../rule-node/ruleNodeTbConfigFieldWidgets";
import { RuleNodeConfigForm } from "./RuleNodeConfigForm";
import { DEFAULT_SCRIPT_TAB_KEYS, RuleNodeTbelJsScriptTabs, type RuleNodeScriptTabKeys } from "./RuleNodeTbelJsScriptTabs";

function setKey(base: Record<string, unknown>, key: string, value: unknown): Record<string, unknown> {
  return { ...base, [key]: value };
}

function linesToText(arr: unknown): string {
  if (!Array.isArray(arr)) return "";
  return arr.map((x) => String(x)).join("\n");
}

function textToLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function readFieldValue(configuration: Record<string, unknown>, field: TbFieldDef): unknown {
  if (Object.prototype.hasOwnProperty.call(configuration, field.key)) {
    return configuration[field.key];
  }
  return field.defaultValue;
}

type TypedFieldsProps = {
  schema: TbNodeFormSchema;
  configuration: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  embedded: boolean;
  /** Bumped when the rule-node editor opens another node / restore snapshot — resets originator mapping UI. */
  configFormSession: number;
};

function RuleNodeTbTypedFields({ schema, configuration, onChange, embedded, configFormSession }: TypedFieldsProps) {
  const labelCls = cn("text-muted-foreground", embedded ? "text-[9px]" : "text-[10px]");
  const dualTbelJs = useMemo(
    () =>
      schema.fields.some((f) => f.key === "tbelScript") && schema.fields.some((f) => f.key === "jsScript"),
    [schema.fields],
  );
  const dualAlarmDetails = useMemo(
    () =>
      schema.fields.some((f) => f.key === "alarmDetailsBuildTbel") &&
      schema.fields.some((f) => f.key === "alarmDetailsBuildJs"),
    [schema.fields],
  );
  const alarmScriptKeys = useMemo<RuleNodeScriptTabKeys>(
    () => ({
      scriptLang: "scriptLang",
      tbel: "alarmDetailsBuildTbel",
      js: "alarmDetailsBuildJs",
    }),
    [],
  );
  const tbelRows = schema.fields.find((f) => f.key === "tbelScript")?.rows ?? 14;
  const jsRows = schema.fields.find((f) => f.key === "jsScript")?.rows ?? 8;
  const tbelRowsAlarm = schema.fields.find((f) => f.key === "alarmDetailsBuildTbel")?.rows ?? 10;
  const jsRowsAlarm = schema.fields.find((f) => f.key === "alarmDetailsBuildJs")?.rows ?? 16;
  const scriptSwitchThemeTabs = schema.title === "Script switch";

  const jsEditorHintLine = useMemo(() => {
    if (!dualTbelJs) return undefined;
    const t = schema.title;
    if (t === "TBEL filter") return "function Filter(msg, metadata, msgType) {";
    if (t === "Transform message (script)") return "function Transform(msg, metadata, msgType) {";
    if (t === "Script switch") return "function Switch(msg, metadata, msgType) {";
    return undefined;
  }, [dualTbelJs, schema.title]);

  const renderField = (field: TbFieldDef) => {
    const id = `tb-typed-${field.key}`;
    const raw = readFieldValue(configuration, field);

    const patch = (value: unknown) => onChange(setKey(configuration, field.key, value));

    if (dualAlarmDetails && field.key === "scriptLang") {
      return null;
    }
    if (dualAlarmDetails && field.key === "alarmDetailsBuildJs") {
      return (
        <RuleNodeTbelJsScriptTabs
          key="alarm-tbel-js"
          configuration={configuration}
          onChange={onChange}
          embedded={embedded}
          scriptKeys={alarmScriptKeys}
          tbelRows={tbelRowsAlarm}
          jsRows={jsRowsAlarm}
          monacoForJs
        />
      );
    }
    if (dualAlarmDetails && field.key === "alarmDetailsBuildTbel") {
      return null;
    }

    if (dualTbelJs && field.key === "scriptLang") {
      return null;
    }
    if (dualTbelJs && field.key === "tbelScript") {
      return (
        <RuleNodeTbelJsScriptTabs
          key="tbel-js-dual"
          configuration={configuration}
          onChange={onChange}
          embedded={embedded}
          scriptKeys={DEFAULT_SCRIPT_TAB_KEYS}
          tbelRows={tbelRows}
          jsRows={jsRows}
          jsEditorHintLine={jsEditorHintLine}
          tabVariant={scriptSwitchThemeTabs ? "theme" : "pill"}
          langControl={scriptSwitchThemeTabs ? "select" : "tabs"}
          monacoForJs
        />
      );
    }
    if (dualTbelJs && field.key === "jsScript") {
      return null;
    }

    if (field.kind === "originatorDataMapping") {
      return (
        <OriginatorFieldsMappingBlock
          key={field.key}
          configuration={configuration}
          onChange={onChange}
          embedded={embedded}
          configFormSession={configFormSession}
        />
      );
    }

    if (field.kind === "attributeNameList") {
      return (
        <AttributeNameChipsField
          key={field.key}
          id={id}
          label={field.label}
          description={field.description}
          value={raw}
          onChange={(arr) => patch(arr)}
          embedded={embedded}
        />
      );
    }

    if (field.kind === "bool") {
      const checked = Boolean(raw);
      return (
        <div
          key={field.key}
          className={cn(
            "flex items-center justify-between gap-2 rounded-md border bg-background px-2 py-1.5",
            embedded ? "border-neutral-200 py-1 dark:border-neutral-700" : "border-border/60",
          )}
        >
          <div className="min-w-0 space-y-0.5">
            <Label htmlFor={id} className={cn("cursor-pointer font-normal leading-tight", embedded ? "text-[10px]" : "text-[11px]")}>
              {field.label}
            </Label>
            {field.description ? (
              <p className="text-[9px] leading-snug text-muted-foreground">{field.description}</p>
            ) : null}
          </div>
          <Switch id={id} checked={checked} onCheckedChange={(v) => patch(v)} />
        </div>
      );
    }

    if (field.kind === "number") {
      let display = "";
      if (raw != null && raw !== "") {
        if (typeof raw === "number" && Number.isFinite(raw)) display = String(raw);
        else {
          const p = parseFloat(String(raw));
          if (Number.isFinite(p)) display = String(p);
        }
      }
      return (
        <div key={field.key} className="space-y-0.5">
          <Label htmlFor={id} className={labelCls}>
            {field.label}
          </Label>
          {field.description ? <p className="text-[9px] text-muted-foreground">{field.description}</p> : null}
          <Input
            id={id}
            type="number"
            value={display}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "") patch(0);
              else {
                const parsed = parseFloat(v);
                patch(Number.isFinite(parsed) ? parsed : 0);
              }
            }}
            className={cn("font-mono", embedded ? "h-7 text-[11px]" : "h-8 text-xs")}
          />
        </div>
      );
    }

    if (field.kind === "select" && field.options?.length) {
      const v = raw == null ? "" : String(raw);
      const allowed = new Set(field.options.map((o) => o.value));
      const sel = allowed.has(v) ? v : field.options[0]!.value;
      return (
        <div key={field.key} className="space-y-0.5">
          <Label htmlFor={id} className={labelCls}>
            {field.label}
          </Label>
          {field.description ? <p className="text-[9px] text-muted-foreground">{field.description}</p> : null}
          <Select value={sel} onValueChange={(next) => patch(next)}>
            <SelectTrigger id={id} className={embedded ? "h-7 text-[11px]" : "h-8 text-xs"}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (field.kind === "password") {
      return (
        <div key={field.key} className="space-y-0.5">
          <Label htmlFor={id} className={labelCls}>
            {field.label}
          </Label>
          {field.description ? <p className="text-[9px] text-muted-foreground">{field.description}</p> : null}
          <Input
            id={id}
            type="password"
            autoComplete="new-password"
            value={raw == null ? "" : String(raw)}
            onChange={(e) => patch(e.target.value)}
            className={embedded ? "h-7 text-[11px]" : "h-8 text-xs"}
          />
        </div>
      );
    }

    if (field.kind === "lines") {
      const text = linesToText(raw);
      return (
        <div key={field.key} className="space-y-0.5">
          <Label htmlFor={id} className={labelCls}>
            {field.label}
          </Label>
          {field.description ? <p className="text-[9px] text-muted-foreground">{field.description}</p> : null}
          <Textarea
            id={id}
            value={text}
            onChange={(e) => patch(textToLines(e.target.value))}
            rows={field.rows ?? 4}
            spellCheck={false}
            className={cn("font-mono text-xs", embedded ? "min-h-[72px] text-[11px]" : "min-h-[88px]")}
            placeholder="One entry per line"
          />
        </div>
      );
    }

    if (field.kind === "json") {
      const display = () => {
        if (raw == null || raw === "") return "{}";
        if (typeof raw === "object") {
          try {
            return JSON.stringify(raw, null, 2);
          } catch {
            return "{}";
          }
        }
        return String(raw);
      };
      return (
        <div key={field.key} className="space-y-0.5">
          <Label htmlFor={id} className={labelCls}>
            {field.label} <span className="font-normal opacity-70">(JSON)</span>
          </Label>
          {field.description ? <p className="text-[9px] text-muted-foreground">{field.description}</p> : null}
          <Textarea
            id={id}
            key={`${field.key}-${JSON.stringify(raw)}`}
            defaultValue={display()}
            onBlur={(e) => {
              try {
                patch(JSON.parse(e.target.value) as object);
              } catch {
                /* keep until valid */
              }
            }}
            rows={field.rows ?? 6}
            spellCheck={false}
            className={cn("font-mono text-xs", embedded ? "min-h-[100px] text-[11px]" : "min-h-[120px]")}
          />
        </div>
      );
    }

    if (field.kind === "textarea" || field.kind === "script") {
      return (
        <div key={field.key} className="space-y-0.5">
          <Label htmlFor={id} className={labelCls}>
            {field.label}
          </Label>
          {field.description ? <p className="text-[9px] text-muted-foreground">{field.description}</p> : null}
          <Textarea
            id={id}
            value={raw == null ? "" : String(raw)}
            onChange={(e) => patch(e.target.value)}
            rows={field.rows ?? (field.kind === "script" ? 12 : 3)}
            spellCheck={false}
            className={cn(
              "resize-y font-mono leading-relaxed",
              field.kind === "script" ? "min-h-[160px] text-xs" : "min-h-[72px] text-xs",
              embedded && "text-[11px]",
            )}
          />
        </div>
      );
    }

    /* text */
    return (
      <div key={field.key} className="space-y-0.5">
        <Label htmlFor={id} className={labelCls}>
          {field.label}
        </Label>
        {field.description ? <p className="text-[9px] text-muted-foreground">{field.description}</p> : null}
        <Input
          id={id}
          value={raw == null ? "" : String(raw)}
          onChange={(e) => patch(e.target.value)}
          placeholder={field.placeholder}
          className={embedded ? "h-7 text-[11px]" : "h-8 text-xs"}
        />
      </div>
    );
  };

  return (
    <div className={cn("flex flex-col", embedded ? "gap-1" : "gap-2")}>
      {!embedded ? <p className="text-xs font-medium text-foreground">{schema.title}</p> : null}
      {schema.fields.map((f) => renderField(f))}
    </div>
  );
}

export type RuleNodeUnifiedConfigFormProps = {
  clazz?: string;
  /** ThingsBoard `nodeDefinition.configDirective` when known (palette / descriptor). */
  configDirective?: string;
  configuration: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  className?: string;
  variant?: "default" | "embedded";
  /** When omitted, treated as stable `0` (embedded rule-chain sheet passes a session counter). */
  configFormSession?: number;
  /** Called after “Fill defaults” merges keys — parent can bump `configFormSession` to re-sync row widgets. */
  onFillDefaults?: () => void;
};

/**
 * ThingsBoard-style configuration: known `Tb*Node` types get explicit field groups;
 * remaining keys fall through to {@link RuleNodeConfigForm}. Unknown types use only the generic form.
 */
function TbUiNgxHint({ configDirective, embedded }: { configDirective?: string; embedded: boolean }) {
  if (embedded) return null;
  const dir = configDirective?.trim();
  if (!dir) return null;
  return (
    <div
      className={cn(
        "rounded-md border border-sky-200/60 bg-sky-50/80 px-2 py-1.5 dark:border-sky-900/50 dark:bg-sky-950/35",
        embedded && "py-1",
      )}
    >
      <p className="text-[9px] leading-snug text-muted-foreground">
        ThingsBoard ui-ngx directive{" "}
        <code className="rounded bg-muted/80 px-1 font-mono text-[8px] text-foreground">{dir}</code>
        {" · "}
        <a
          href={TB_UI_NGX_RULE_NODE_ROOT}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          rule-node sources
        </a>
      </p>
    </div>
  );
}

export function RuleNodeUnifiedConfigForm({
  clazz,
  configDirective,
  configuration,
  onChange,
  className,
  variant = "default",
  configFormSession = 0,
  onFillDefaults,
}: RuleNodeUnifiedConfigFormProps) {
  const embedded = variant === "embedded";
  const schema = useMemo(() => getTbNodeFormSchema(clazz), [clazz]);
  const omitKeys = useMemo(() => (schema ? schemaFieldKeys(schema) : new Set<string>()), [schema]);
  const stripRemainder = useMemo(() => stripKeysFromRuleNodeRemainder(clazz), [clazz]);

  const remainder = useMemo(() => {
    const next: Record<string, unknown> = {};
    for (const k of Object.keys(configuration)) {
      if (omitKeys.has(k) || stripRemainder.has(k)) continue;
      next[k] = configuration[k];
    }
    return next;
  }, [configuration, omitKeys, stripRemainder]);

  const mergeRemainder = useCallback(
    (nextRemainder: Record<string, unknown>) => {
      const merged: Record<string, unknown> = { ...configuration };
      for (const k of Object.keys(merged)) {
        if (omitKeys.has(k) || stripRemainder.has(k)) continue;
        delete merged[k];
      }
      for (const k of Object.keys(nextRemainder)) {
        merged[k] = nextRemainder[k];
      }
      onChange(merged);
    },
    [configuration, omitKeys, onChange, stripRemainder],
  );

  if (!schema) {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <TbUiNgxHint configDirective={configDirective} embedded={embedded} />
        <RuleNodeConfigForm
          configuration={configuration}
          onChange={onChange}
          variant={variant}
          stripConfigurationKeys={stripRemainder}
        />
      </div>
    );
  }

  const showRemainder = Object.keys(remainder).length > 0;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <TbUiNgxHint configDirective={configDirective} embedded={embedded} />
      <div
        className={cn(
          "rounded-md border border-border bg-background p-2.5",
          embedded ? "shadow-sm" : "bg-muted/10 p-3",
        )}
      >
        <RuleNodeTbTypedFields
          schema={schema}
          configuration={configuration}
          onChange={onChange}
          embedded={embedded}
          configFormSession={configFormSession}
        />
      </div>

      {showRemainder ? (
        <div
          className={cn(
            "rounded-md border border-border bg-background p-2.5",
            embedded ? "" : "border-dashed bg-muted/10 p-3",
          )}
        >
          <p className={cn("mb-1 font-medium text-foreground", embedded ? "text-xs" : "text-[10px] text-muted-foreground")}>
            {embedded ? "Additional properties" : "Other parameters"}
          </p>
          {!embedded ? (
            <p className="mb-1.5 text-[9px] leading-snug text-muted-foreground">
              Keys not covered by the typed layout (custom extensions or newer ThingsBoard fields).
            </p>
          ) : null}
          <RuleNodeConfigForm
            configuration={remainder}
            onChange={mergeRemainder}
            variant={variant}
            stripConfigurationKeys={stripRemainder}
          />
        </div>
      ) : null}

      {!embedded ? (
        <div className="flex flex-wrap gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-[10px]"
            onClick={() => {
              const next = { ...configuration };
              for (const f of schema.fields) {
                if (f.defaultValue !== undefined && !(f.key in configuration)) {
                  next[f.key] = f.defaultValue;
                }
              }
              onChange(next);
              onFillDefaults?.();
            }}
          >
            Fill defaults
          </Button>
        </div>
      ) : null}
    </div>
  );
}
