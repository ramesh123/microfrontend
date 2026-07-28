import { useMemo } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { RuleNodeTbelJsScriptTabs } from "./RuleNodeTbelJsScriptTabs";

/** Turn camelCase / snake_case keys into short titles (ThingsBoard-style labels). */
function humanizeFieldKey(key: string): string {
  const s = key
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();
  if (!s) return key;
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function setKey(
  base: Record<string, unknown>,
  key: string,
  value: unknown,
): Record<string, unknown> {
  return { ...base, [key]: value };
}

const SCRIPT_LANG_KEYS = ["scriptLang", "tbelScript", "jsScript"] as const;

function orderedConfigKeys(configuration: Record<string, unknown>): string[] {
  const keys = Object.keys(configuration);
  const front = SCRIPT_LANG_KEYS.filter((k) => keys.includes(k));
  const rest = keys.filter((k) => !front.includes(k as (typeof SCRIPT_LANG_KEYS)[number])).sort();
  return [...front, ...rest];
}

type RuleNodeConfigFormProps = {
  configuration: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  className?: string;
  /** Tighter layout for inline node configuration (ThingsBoard rule node panel). */
  variant?: "default" | "embedded";
  /** Hide keys from the generic editor (handled by typed form or TB internals). */
  stripConfigurationKeys?: Set<string>;
};

function isScriptBodyKey(key: string): boolean {
  return key === "script" || key.endsWith("Script");
}

/**
 * Generic editor for rule node `configuration` / `defaultConfiguration`
 * (ThingsBoard-style parameters: https://thingsboard.io/docs/user-guide/rule-engine-2-0/overview/).
 */
export function RuleNodeConfigForm({
  configuration,
  onChange,
  className,
  variant = "default",
  stripConfigurationKeys,
}: RuleNodeConfigFormProps) {
  const embedded = variant === "embedded";
  const keys = useMemo(() => {
    const ordered = orderedConfigKeys(configuration);
    if (!stripConfigurationKeys?.size) return ordered;
    return ordered.filter((k) => !stripConfigurationKeys.has(k));
  }, [configuration, stripConfigurationKeys]);
  const dualTbelJs = keys.includes("tbelScript") && keys.includes("jsScript");
  const dualScriptAnchorKey = dualTbelJs ? keys.find((k) => k === "tbelScript" || k === "jsScript") : null;
  if (keys.length === 0) {
    return (
      <p
        className={cn(
          embedded ? "text-[9px] leading-snug text-muted-foreground" : "text-[10px] leading-snug text-muted-foreground",
          className,
        )}
      >
        No parameters for this node type. Add keys via API or use a component that defines default configuration.
      </p>
    );
  }

  const rawLang = String(configuration.scriptLang ?? "TBEL").toLowerCase();
  const lang = rawLang === "javascript" || rawLang === "js" ? "JavaScript" : "TBEL";

  const renderField = (key: string, value: unknown) => {
    const id = `rule-node-cfg-${key}`;
    const labelText = humanizeFieldKey(key);

    if (key === "scriptLang") {
      if (dualTbelJs) return null;
      const isTbel = lang === "TBEL";
      return (
        <div key={key} className="space-y-1.5">
          <Label className={cn("text-muted-foreground", embedded ? "text-[9px]" : "text-[10px]")}>Language</Label>
          <div className="inline-flex rounded-md border border-border bg-muted/40 p-0.5">
            <Button
              type="button"
              variant={isTbel ? "default" : "ghost"}
              size="sm"
              className={cn("h-8 px-3 text-xs", isTbel ? "" : "text-muted-foreground")}
              onClick={() => onChange(setKey(configuration, "scriptLang", "TBEL"))}
            >
              TBEL
            </Button>
            <Button
              type="button"
              variant={!isTbel ? "default" : "ghost"}
              size="sm"
              className={cn("h-8 px-3 text-xs", !isTbel ? "" : "text-muted-foreground")}
              onClick={() => onChange(setKey(configuration, "scriptLang", "JavaScript"))}
            >
              JavaScript
            </Button>
          </div>
        </div>
      );
    }

    if (key === "tbelScript" || key === "jsScript") {
      if (dualTbelJs) {
        if (key !== dualScriptAnchorKey) return null;
        return (
          <RuleNodeTbelJsScriptTabs
            key="tbel-js-dual-generic"
            configuration={configuration}
            onChange={onChange}
            embedded={embedded}
            tbelRows={14}
            jsRows={8}
          />
        );
      }
      const showTbel = lang === "TBEL";
      const showThis = (key === "tbelScript" && showTbel) || (key === "jsScript" && !showTbel);
      if (!showThis) return null;
      return (
        <div key={key} className="space-y-1">
          <Label htmlFor={id} className={cn("text-muted-foreground", embedded ? "text-[9px]" : "text-[10px]")}>
            {key === "tbelScript" ? "Script (TBEL)" : "Script (JavaScript)"}
          </Label>
          <Textarea
            id={id}
            value={value == null ? "" : String(value)}
            onChange={(e) => onChange(setKey(configuration, key, e.target.value))}
            spellCheck={false}
            className={cn(
              "min-h-[200px] resize-y font-mono text-xs leading-relaxed",
              embedded ? "min-h-[160px] text-[11px]" : "",
            )}
          />
        </div>
      );
    }

    if (typeof value === "boolean") {
      return (
        <div
          key={key}
          className={cn(
            "flex items-center justify-between gap-2 rounded-md border bg-background px-2 py-1.5",
            embedded ? "border-neutral-200 py-1 dark:border-neutral-700" : "border-border/60",
          )}
        >
          <Label htmlFor={id} className={cn("cursor-pointer font-normal leading-tight", embedded ? "text-[10px]" : "text-[11px]")}>
            {labelText}
          </Label>
          <Switch
            id={id}
            checked={value}
            onCheckedChange={(checked) => onChange(setKey(configuration, key, checked))}
          />
        </div>
      );
    }
    if (typeof value === "number" && !Number.isNaN(value)) {
      return (
        <div key={key} className="space-y-0.5">
          <Label htmlFor={id} className={cn("text-muted-foreground", embedded ? "text-[9px]" : "text-[10px]")}>
            {labelText}
          </Label>
          <Input
            id={id}
            type="number"
            value={Number.isFinite(value) ? String(value) : ""}
            onChange={(e) => {
              const n = parseFloat(e.target.value);
              onChange(setKey(configuration, key, Number.isFinite(n) ? n : 0));
            }}
            className={cn("font-mono", embedded ? "h-7 text-[11px]" : "h-8 text-xs")}
          />
        </div>
      );
    }
    if (value !== null && typeof value === "object") {
      return (
        <div key={key} className="space-y-0.5">
          <Label htmlFor={id} className={cn("text-muted-foreground", embedded ? "text-[9px]" : "text-[10px]")}>
            {labelText} <span className="font-normal opacity-70">(JSON)</span>
          </Label>
          <Textarea
            id={id}
            key={`${key}-${JSON.stringify(value)}`}
            defaultValue={JSON.stringify(value, null, 2)}
            onBlur={(e) => {
              try {
                onChange(setKey(configuration, key, JSON.parse(e.target.value) as object));
              } catch {
                /* invalid JSON left in field until user fixes */
              }
            }}
            className={cn("font-mono", embedded ? "min-h-[56px] text-[11px]" : "min-h-[72px] text-xs")}
            spellCheck={false}
          />
        </div>
      );
    }
    if (typeof value === "string" && isScriptBodyKey(key)) {
      return (
        <div key={key} className="space-y-0.5">
          <Label htmlFor={id} className={cn("text-muted-foreground", embedded ? "text-[9px]" : "text-[10px]")}>
            {labelText}
          </Label>
          <Textarea
            id={id}
            value={String(value)}
            onChange={(e) => onChange(setKey(configuration, key, e.target.value))}
            spellCheck={false}
            className={cn(
              "min-h-[180px] resize-y font-mono text-xs leading-relaxed",
              embedded ? "min-h-[140px] text-[11px]" : "",
            )}
          />
        </div>
      );
    }
    return (
      <div key={key} className="space-y-0.5">
        <Label htmlFor={id} className={cn("text-muted-foreground", embedded ? "text-[9px]" : "text-[10px]")}>
          {labelText}
        </Label>
        <Input
          id={id}
          value={value == null ? "" : String(value)}
          onChange={(e) => onChange(setKey(configuration, key, e.target.value))}
          className={embedded ? "h-7 text-[11px]" : "h-8 text-xs"}
        />
      </div>
    );
  };

  return (
    <div className={cn("flex flex-col", embedded ? "gap-1.5" : "gap-2", className)}>
      {keys.map((key) => renderField(key, configuration[key]))}
    </div>
  );
}
