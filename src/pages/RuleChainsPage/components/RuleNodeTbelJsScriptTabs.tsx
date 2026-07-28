import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import Editor from "@monaco-editor/react";
import type { Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { Maximize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useTheme } from "@/context/theme";

import { computeTbelStructuralMarkers, ensureTbelMonacoLanguage } from "../rule-node/monacoTbelSupport";
import { computeScriptSyntaxMarkers } from "../rule-node/scriptSyntaxMarkers";
import {
  clearRuleChainScriptErrorDecorations,
  syncRuleChainScriptErrorDecorations,
} from "../rule-node/ruleChainMonacoErrorDecorations";

function setKey(base: Record<string, unknown>, key: string, value: unknown): Record<string, unknown> {
  return { ...base, [key]: value };
}

function scriptLangTabValue(raw: unknown): "tbel" | "js" {
  const s = String(raw ?? "TBEL").toLowerCase();
  if (s === "javascript" || s === "js") return "js";
  return "tbel";
}

export type RuleNodeScriptTabKeys = {
  scriptLang: string;
  tbel: string;
  js: string;
};

export const DEFAULT_SCRIPT_TAB_KEYS: RuleNodeScriptTabKeys = {
  scriptLang: "scriptLang",
  tbel: "tbelScript",
  js: "jsScript",
};

/** `pill` = rounded segment; `theme` = shadcn muted tab list (e.g. script switch). */
export type RuleNodeScriptTabsVariant = "pill" | "theme";

export type RuleNodeTbelJsScriptTabsProps = {
  configuration: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  embedded: boolean;
  /** Map TBEL/JS/scriptLang JSON keys (e.g. alarm details use `alarmDetailsBuildTbel` / `alarmDetailsBuildJs`). */
  scriptKeys?: RuleNodeScriptTabKeys;
  tbelRows?: number;
  jsRows?: number;
  /** Read-only line above the JavaScript body (ThingsBoard-style function wrapper hint). */
  jsEditorHintLine?: string;
  /** Optional hint above TBEL body (e.g. script switch). */
  tbelEditorHintLine?: string;
  tabVariant?: RuleNodeScriptTabsVariant;
  /** `tabs` = TBEL/JS pill strip; `select` = single dropdown + one editor. */
  langControl?: "tabs" | "select";
  /** When true, TBEL and JavaScript use Monaco (syntax colours; TBEL gets structural markers, JS uses Monaco diagnostics). */
  monacoForJs?: boolean;
};

const tabTriggerPill = cn(
  "flex-1 rounded-full border border-transparent px-3 py-1.5 text-xs font-semibold tracking-wide transition-all",
  "text-muted-foreground hover:text-foreground",
  "data-[state=active]:border-transparent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm",
);

const themeTabTriggerActive = "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground";

const editorShell =
  "relative rounded-md border border-slate-200 bg-white shadow-sm dark:border-border dark:bg-card dark:shadow-none";

const editorHint =
  "border-b border-slate-100 bg-slate-50/90 px-3 py-2 font-mono text-[11px] leading-snug text-slate-700 dark:border-border/80 dark:bg-muted/40 dark:text-muted-foreground";

const fullscreenDialogClass =
  "!fixed !inset-0 !left-0 !top-0 !flex !h-dvh !max-h-dvh !w-screen !max-w-none !translate-x-0 !translate-y-0 gap-0 rounded-none border-0 p-0 shadow-none sm:!rounded-none";

function useMonacoTheme(): "vs-dark" | "light" {
  const { theme } = useTheme();
  return useMemo(() => {
    if (theme === "system") {
      return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "vs-dark"
        : "light";
    }
    if (theme === "dark" || theme.endsWith("-dark") || theme === "blue-dark-g") return "vs-dark";
    return "light";
  }, [theme]);
}

function FramedEditor({
  embedded,
  showHint,
  hint,
  onMaximize,
  children,
}: {
  embedded: boolean;
  showHint: boolean;
  hint?: string;
  onMaximize: () => void;
  children: ReactNode;
}) {
  return (
    <div className={editorShell}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-1 top-1 z-10 h-7 w-7 text-muted-foreground hover:bg-muted hover:text-foreground"
        title="Maximize editor (full screen)"
        onClick={onMaximize}
      >
        <Maximize2 className="h-3.5 w-3.5" aria-hidden />
      </Button>
      {showHint && hint?.trim() ? (
        <div className={cn(editorHint, embedded && "py-1.5 text-[10px]")} aria-hidden>
          {hint.trim()}
        </div>
      ) : null}
      {children}
    </div>
  );
}

function RuleScriptMonacoField({
  path,
  language,
  value,
  onChange,
  heightPx,
  embedded,
  fillContainer,
}: {
  path: string;
  language: "javascript" | "tbel";
  value: string;
  onChange: (v: string) => void;
  heightPx: number;
  embedded: boolean;
  fillContainer?: boolean;
}) {
  const monacoTheme = useMonacoTheme();
  const markerOwner = `rule-chain-${language}-${path.replace(/[^a-z0-9-_]/gi, "_")}`;
  const errorDecoIdsRef = useRef<string[]>([]);

  const beforeMount = useCallback(
    (monaco: Monaco) => {
      if (language === "tbel") {
        ensureTbelMonacoLanguage(monaco);
      } else {
        monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
          noSemanticValidation: true,
          noSuggestionDiagnostics: true,
          noSyntaxValidation: true,
        });
      }
    },
    [language],
  );

  const onMount = useCallback(
    (ed: editor.IStandaloneCodeEditor, monaco: Monaco) => {
      const model = ed.getModel();
      if (!model) return;
      errorDecoIdsRef.current = [];
      let timer: number | undefined;

      const applyTbelMarkers = () => {
        if (language !== "tbel") return;
        const src = model.getValue();
        const structural = computeTbelStructuralMarkers(src).map((m) => ({
          ...m,
          severity: monaco.MarkerSeverity.Error,
        }));
        const syntax = computeScriptSyntaxMarkers(src).map((m) => ({
          ...m,
          severity: monaco.MarkerSeverity.Error,
        }));
        const all = [...syntax, ...structural];
        monaco.editor.setModelMarkers(model, markerOwner, all);
        syncRuleChainScriptErrorDecorations(ed, monaco, errorDecoIdsRef, all);
      };

      const applyJsMarkers = () => {
        if (language !== "javascript") return;
        const markers = computeScriptSyntaxMarkers(model.getValue()).map((m) => ({
          ...m,
          severity: monaco.MarkerSeverity.Error,
        }));
        monaco.editor.setModelMarkers(model, markerOwner, markers);
        syncRuleChainScriptErrorDecorations(ed, monaco, errorDecoIdsRef, markers);
      };

      if (language === "tbel") {
        applyTbelMarkers();
        const sub = ed.onDidChangeModelContent(() => {
          if (timer != null) window.clearTimeout(timer);
          timer = window.setTimeout(applyTbelMarkers, 280);
        });
        ed.onDidDispose(() => {
          sub.dispose();
          if (timer != null) window.clearTimeout(timer);
          clearRuleChainScriptErrorDecorations(ed, errorDecoIdsRef);
          monaco.editor.setModelMarkers(model, markerOwner, []);
        });
        return;
      }

      applyJsMarkers();
      const subJs = ed.onDidChangeModelContent(() => {
        if (timer != null) window.clearTimeout(timer);
        timer = window.setTimeout(applyJsMarkers, 280);
      });
      ed.onDidDispose(() => {
        subJs.dispose();
        if (timer != null) window.clearTimeout(timer);
        clearRuleChainScriptErrorDecorations(ed, errorDecoIdsRef);
        monaco.editor.setModelMarkers(model, markerOwner, []);
      });
    },
    [language, markerOwner],
  );

  const editorOptions = useMemo(
    () => ({
      minimap: { enabled: false },
      glyphMargin: true,
      fontSize: embedded ? 12 : 13,
      wordWrap: "on" as const,
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      padding: { top: 8, bottom: 8 },
      lineNumbers: "on" as const,
      folding: true,
    }),
    [embedded],
  );

  const wrapClass = fillContainer ? "min-h-0 flex-1 flex flex-col overflow-hidden" : "min-h-0 w-full overflow-hidden";
  const innerStyle = fillContainer ? { flex: 1, minHeight: 0 } : { height: heightPx };

  return (
    <div className={cn(wrapClass, !fillContainer && embedded && "min-h-[120px]")} style={innerStyle}>
      <Editor
        path={path}
        language={language === "tbel" ? "tbel" : "javascript"}
        theme={monacoTheme}
        value={value}
        onChange={(v) => onChange(v ?? "")}
        beforeMount={beforeMount}
        onMount={onMount}
        height={fillContainer ? "100%" : heightPx}
        options={editorOptions}
      />
    </div>
  );
}

/**
 * TBEL / JavaScript editors with tab or select language control; maximize opens full-screen Monaco.
 */
export function RuleNodeTbelJsScriptTabs({
  configuration,
  onChange,
  embedded,
  scriptKeys = DEFAULT_SCRIPT_TAB_KEYS,
  tbelRows = 14,
  jsRows = 8,
  jsEditorHintLine,
  tbelEditorHintLine,
  tabVariant = "pill",
  langControl = "tabs",
  monacoForJs = true,
}: RuleNodeTbelJsScriptTabsProps) {
  const themeTabs = tabVariant === "theme";
  const { scriptLang: langKey, tbel: tbelKey, js: jsKey } = scriptKeys;
  const tab = useMemo(() => scriptLangTabValue(configuration[langKey]), [configuration, langKey]);
  const tbelVal = configuration[tbelKey] == null ? "" : String(configuration[tbelKey]);
  const jsVal = configuration[jsKey] == null ? "" : String(configuration[jsKey]);
  const [maxOpen, setMaxOpen] = useState(false);
  const [maxMode, setMaxMode] = useState<"tbel" | "js">("tbel");
  const monacoTheme = useMonacoTheme();

  const setLang = useCallback(
    (v: string) => {
      const nextLang = v === "js" ? "JS" : "TBEL";
      onChange(setKey(configuration, langKey, nextLang));
    },
    [configuration, onChange, langKey],
  );

  const patchTbel = useCallback(
    (v: string) => onChange(setKey(configuration, tbelKey, v)),
    [configuration, onChange, tbelKey],
  );

  const patchJs = useCallback(
    (v: string) => onChange(setKey(configuration, jsKey, v)),
    [configuration, onChange, jsKey],
  );

  const taCls = cn(
    "min-h-0 w-full resize-y border-0 bg-transparent px-3 py-2 font-mono text-xs leading-relaxed text-slate-900 shadow-none focus-visible:ring-0 dark:text-foreground",
    embedded ? "min-h-[120px] text-[11px]" : "min-h-[180px]",
  );

  const zoomTaCls =
    "min-h-0 w-full flex-1 resize-none border-0 bg-transparent px-4 py-3 font-mono text-sm leading-relaxed focus-visible:ring-1 focus-visible:ring-ring dark:text-foreground";

  const openMax = useCallback((mode: "tbel" | "js") => {
    setMaxMode(mode);
    setMaxOpen(true);
  }, []);

  const inlineJsHeight = embedded ? 160 : Math.max(200, jsRows * 18 + 24);
  const inlineTbelHeight = embedded ? 140 : Math.max(180, tbelRows * 16 + 24);

  const langSelect = (
    <div className="space-y-1">
      <Label className={cn("text-muted-foreground", embedded ? "text-[9px]" : "text-[10px]")}>Script language</Label>
      <Select value={tab} onValueChange={(v) => setLang(v === "js" ? "js" : "tbel")}>
        <SelectTrigger className={cn("w-full max-w-md", embedded ? "h-8 text-[11px]" : "h-9 text-xs")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="tbel" className="text-xs">
            TBEL
          </SelectItem>
          <SelectItem value="js" className="text-xs">
            JavaScript
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  const renderJsBody = (opts: { fullscreen: boolean }) => {
    const { fullscreen } = opts;
    if (monacoForJs && !fullscreen) {
      return (
        <RuleScriptMonacoField
          path={`${jsKey}-inline`}
          language="javascript"
          value={jsVal}
          onChange={patchJs}
          heightPx={inlineJsHeight}
          embedded={embedded}
        />
      );
    }
    if (monacoForJs && fullscreen) {
      return (
        <div className="min-h-0 flex-1 overflow-hidden">
          <Editor
            height="100%"
            path={`${jsKey}-fullscreen`}
            language="javascript"
            theme={monacoTheme}
            value={jsVal}
            onChange={(v) => patchJs(v ?? "")}
            beforeMount={(monaco) => {
              monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                noSemanticValidation: true,
                noSuggestionDiagnostics: true,
                noSyntaxValidation: true,
              });
            }}
            onMount={(ed, monaco) => {
              const model = ed.getModel();
              if (!model) return;
              const owner = `${jsKey}-fs-syntax`;
              const decoIdsRef = { current: [] as string[] };
              let timer: number | undefined;
              const run = () => {
                const markers = computeScriptSyntaxMarkers(model.getValue()).map((m) => ({
                  ...m,
                  severity: monaco.MarkerSeverity.Error,
                }));
                monaco.editor.setModelMarkers(model, owner, markers);
                syncRuleChainScriptErrorDecorations(ed, monaco, decoIdsRef, markers);
              };
              run();
              const sub = ed.onDidChangeModelContent(() => {
                if (timer != null) window.clearTimeout(timer);
                timer = window.setTimeout(run, 280);
              });
              ed.onDidDispose(() => {
                sub.dispose();
                if (timer != null) window.clearTimeout(timer);
                clearRuleChainScriptErrorDecorations(ed, decoIdsRef);
                monaco.editor.setModelMarkers(model, owner, []);
              });
            }}
            options={{
              minimap: { enabled: true },
              glyphMargin: true,
              fontSize: 14,
              wordWrap: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </div>
      );
    }
    return (
      <Textarea
        id={`tb-js-${jsKey}`}
        value={jsVal}
        onChange={(e) => patchJs(e.target.value)}
        rows={fullscreen ? 24 : jsRows}
        spellCheck={false}
        className={fullscreen ? zoomTaCls : taCls}
        aria-label="JavaScript script"
      />
    );
  };

  const renderTbelBody = (fullscreen: boolean) => {
    if (!monacoForJs) {
      return (
        <Textarea
          id={`tb-tbel-${tbelKey}`}
          value={tbelVal}
          onChange={(e) => patchTbel(e.target.value)}
          rows={fullscreen ? 24 : tbelRows}
          spellCheck={false}
          className={fullscreen ? zoomTaCls : taCls}
          aria-label="TBEL script"
        />
      );
    }
    if (fullscreen) {
      return (
        <RuleScriptMonacoField
          path={`${tbelKey}-fullscreen`}
          language="tbel"
          value={tbelVal}
          onChange={patchTbel}
          heightPx={0}
          embedded={embedded}
          fillContainer
        />
      );
    }
    return (
      <RuleScriptMonacoField
        path={`${tbelKey}-inline`}
        language="tbel"
        value={tbelVal}
        onChange={patchTbel}
        heightPx={inlineTbelHeight}
        embedded={embedded}
      />
    );
  };

  if (langControl === "select") {
    return (
      <div className="space-y-2">
        {langSelect}
        {tab === "tbel" ? (
          <FramedEditor
            embedded={embedded}
            showHint={Boolean(tbelEditorHintLine?.trim())}
            hint={tbelEditorHintLine}
            onMaximize={() => openMax("tbel")}
          >
            {renderTbelBody(false)}
          </FramedEditor>
        ) : (
          <FramedEditor
            embedded={embedded}
            showHint={Boolean(jsEditorHintLine?.trim())}
            hint={jsEditorHintLine}
            onMaximize={() => openMax("js")}
          >
            <div className="min-h-0" style={{ minHeight: inlineJsHeight }}>
              {renderJsBody({ fullscreen: false })}
            </div>
          </FramedEditor>
        )}

        <Dialog
          open={maxOpen}
          onOpenChange={(o) => {
            setMaxOpen(o);
          }}
        >
          <DialogContent
            className={cn(
              fullscreenDialogClass,
              "flex flex-col overflow-hidden bg-background",
              "data-[state=open]:slide-in-from-bottom-0 data-[state=closed]:slide-out-to-bottom-0",
            )}
          >
            <DialogHeader className="shrink-0 border-b border-border px-4 py-3 pr-14">
              <DialogTitle className="text-left text-base font-semibold">
                {maxMode === "tbel" ? "TBEL" : "JavaScript"} — full screen
              </DialogTitle>
            </DialogHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-4 pb-4 pt-2">
              {maxMode === "js" && jsEditorHintLine?.trim() ? (
                <div className="shrink-0 rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
                  {jsEditorHintLine.trim()}
                </div>
              ) : null}
              {maxMode === "tbel" && tbelEditorHintLine?.trim() ? (
                <div className="shrink-0 rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
                  {tbelEditorHintLine.trim()}
                </div>
              ) : null}
              {maxMode === "tbel" ? renderTbelBody(true) : renderJsBody({ fullscreen: true })}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Tabs value={tab} onValueChange={setLang}>
        <TabsList
          className={cn(
            themeTabs
              ? "grid h-9 w-full max-w-xl grid-cols-2 bg-muted p-[3px] text-muted-foreground"
              : "inline-flex h-auto w-full max-w-xl rounded-full bg-muted p-1",
            embedded && "max-w-md",
          )}
        >
          <TabsTrigger
            value="tbel"
            className={cn(
              themeTabs
                ? cn(embedded ? "text-[11px]" : "text-xs", themeTabTriggerActive)
                : cn(tabTriggerPill, embedded && "py-1 text-[11px]"),
            )}
          >
            TBEL
          </TabsTrigger>
          <TabsTrigger
            value="js"
            className={cn(
              themeTabs
                ? cn(embedded ? "text-[11px]" : "text-xs", themeTabTriggerActive)
                : cn(tabTriggerPill, embedded && "py-1 text-[11px]"),
            )}
          >
            JavaScript
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tbel" className="mt-1.5 outline-none">
          <FramedEditor
            embedded={embedded}
            showHint={Boolean(tbelEditorHintLine?.trim())}
            hint={tbelEditorHintLine}
            onMaximize={() => openMax("tbel")}
          >
            {renderTbelBody(false)}
          </FramedEditor>
        </TabsContent>
        <TabsContent value="js" className="mt-1.5 outline-none">
          <FramedEditor
            embedded={embedded}
            showHint={Boolean(jsEditorHintLine?.trim())}
            hint={jsEditorHintLine}
            onMaximize={() => openMax("js")}
          >
            {monacoForJs ? (
              <RuleScriptMonacoField
                path={`${jsKey}-inline`}
                language="javascript"
                value={jsVal}
                onChange={patchJs}
                heightPx={inlineJsHeight}
                embedded={embedded}
              />
            ) : (
              <Textarea
                id={`tb-js-${jsKey}`}
                value={jsVal}
                onChange={(e) => patchJs(e.target.value)}
                rows={jsRows}
                spellCheck={false}
                className={taCls}
                aria-label="JavaScript script"
              />
            )}
          </FramedEditor>
        </TabsContent>
      </Tabs>

      <Dialog
        open={maxOpen}
        onOpenChange={(o) => {
          setMaxOpen(o);
        }}
      >
        <DialogContent
          className={cn(
            fullscreenDialogClass,
            "flex flex-col overflow-hidden bg-background",
            "data-[state=open]:slide-in-from-bottom-0 data-[state=closed]:slide-out-to-bottom-0",
          )}
        >
          <DialogHeader className="shrink-0 border-b border-border px-4 py-3 pr-14">
            <DialogTitle className="text-left text-base font-semibold">
              {maxMode === "tbel" ? "TBEL" : "JavaScript"} — full screen
            </DialogTitle>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-4 pb-4 pt-2">
            {maxMode === "js" && jsEditorHintLine?.trim() ? (
              <div className="shrink-0 rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
                {jsEditorHintLine.trim()}
              </div>
            ) : null}
            {maxMode === "tbel" && tbelEditorHintLine?.trim() ? (
              <div className="shrink-0 rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
                {tbelEditorHintLine.trim()}
              </div>
            ) : null}
            {maxMode === "tbel" ? (
              renderTbelBody(true)
            ) : monacoForJs ? (
              <div className="min-h-0 flex-1 overflow-hidden">
                <Editor
                  height="100%"
                  path={`${jsKey}-fullscreen`}
                  language="javascript"
                  theme={monacoTheme}
                  value={jsVal}
                  onChange={(v) => patchJs(v ?? "")}
                  beforeMount={(monaco) => {
                    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                      noSemanticValidation: true,
                      noSuggestionDiagnostics: true,
                      noSyntaxValidation: true,
                    });
                  }}
                  onMount={(ed, monaco) => {
                    const model = ed.getModel();
                    if (!model) return;
                    const owner = `${jsKey}-fs-syntax`;
                    const decoIdsRef = { current: [] as string[] };
                    let timer: number | undefined;
                    const run = () => {
                      const markers = computeScriptSyntaxMarkers(model.getValue()).map((m) => ({
                        ...m,
                        severity: monaco.MarkerSeverity.Error,
                      }));
                      monaco.editor.setModelMarkers(model, owner, markers);
                      syncRuleChainScriptErrorDecorations(ed, monaco, decoIdsRef, markers);
                    };
                    run();
                    const sub = ed.onDidChangeModelContent(() => {
                      if (timer != null) window.clearTimeout(timer);
                      timer = window.setTimeout(run, 280);
                    });
                    ed.onDidDispose(() => {
                      sub.dispose();
                      if (timer != null) window.clearTimeout(timer);
                      clearRuleChainScriptErrorDecorations(ed, decoIdsRef);
                      monaco.editor.setModelMarkers(model, owner, []);
                    });
                  }}
                  options={{
                    minimap: { enabled: true },
                    glyphMargin: true,
                    fontSize: 14,
                    wordWrap: "on",
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                  }}
                />
              </div>
            ) : (
              <Textarea
                value={jsVal}
                onChange={(e) => patchJs(e.target.value)}
                spellCheck={false}
                className={zoomTaCls}
                aria-label="JavaScript script expanded"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
