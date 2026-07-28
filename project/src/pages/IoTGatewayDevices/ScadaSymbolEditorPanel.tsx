import React, { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, Code2, Image as ImageIcon, Loader2, Pencil, Plus, Settings, Trash2, X, ZoomIn, ZoomOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useTheme } from "@/context/theme";

import { analyzeScadaSvg } from "./scadaSymbolSvgAnalysis";
import { ScadaSymbolConfigTable } from "./ScadaSymbolConfigTable";
import { ScadaBehaviorSettingsDialog } from "./ScadaBehaviorSettingsDialog";
import { ScadaPropertySettingsDialog } from "./ScadaPropertySettingsDialog";
import { ScadaTagFunctionEditorDialog } from "./ScadaTagFunctionEditorDialog";
import {
  buildTbMetadataPatch,
  collectSvgTagNames,
  collectTaggedElements,
  getTbTag,
  mergeTbMetadataIntoSvg,
  parseTbMetadata,
  readBehaviorRows,
  readPropertyRows,
  readTagRows,
  readWidgetSize,
  SCADA_BEHAVIOR_TYPE_OPTIONS,
  SCADA_PROPERTY_TYPE_OPTIONS,
  SCADA_TAG_CLICK_ACTION_TEMPLATE,
  SCADA_TAG_STATE_RENDER_TEMPLATE,
  updateTbTagAtIndex,
  type ScadaBehaviorRow,
  type ScadaPropertyRow,
  type ScadaTagRow,
} from "./scadaSymbolMetadata";

const XmlMonacoEditor = lazy(() => import("@monaco-editor/react"));

function sanitizeSvgForPreview(svg: string): string {
  let s = svg.trim();
  s = s.replace(/^\s*<\?xml[\s\S]*?\?>\s*/i, "");
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/\son[a-zA-Z]+\s*=\s*["'][^"']*["']/gi, "");
  s = s.replace(/\son[a-zA-Z]+\s*=\s*[^\s>]+\s*/gi, "");
  return s;
}

function normalizeSvgRootForPreview(svg: string): string {
  try {
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    const root = doc.documentElement;
    const parseErr = doc.querySelector("parsererror");
    if (parseErr || !root || root.tagName.toLowerCase() !== "svg") return svg;
    root.setAttribute("width", "100%");
    root.setAttribute("height", "100%");
    if (!root.getAttribute("preserveAspectRatio")) {
      root.setAttribute("preserveAspectRatio", "xMidYMid meet");
    }
    return new XMLSerializer().serializeToString(root);
  } catch {
    return svg;
  }
}

function buildInlinePreviewMarkup(svg: string): string {
  return normalizeSvgRootForPreview(sanitizeSvgForPreview(svg));
}

function newBehaviorRow(existing: ScadaBehaviorRow[]): ScadaBehaviorRow {
  let n = existing.length + 1;
  let id = `behavior${n}`;
  while (existing.some((r) => r.id === id)) {
    n += 1;
    id = `behavior${n}`;
  }
  return { id, name: "", type: "value", valueType: "STRING" };
}

function newPropertyRow(existing: ScadaPropertyRow[]): ScadaPropertyRow {
  let n = existing.length + 1;
  let id = `property${n}`;
  while (existing.some((r) => r.id === id)) {
    n += 1;
    id = `property${n}`;
  }
  return { id, name: "", type: "text", default: "" };
}

type TagFunctionEditorKind = "stateRender" | "clickAction";

type ConfigDialogTarget<T> = { index: number | null; row: T };

type TagFunctionEditorState = {
  kind: TagFunctionEditorKind;
  tag: string;
  draft: string;
};

export type ScadaSymbolEditorPanelProps = {
  resourceKey: string;
  /** Current SVG source (controlled). */
  svg: string;
  onSvgChange: (next: string) => void;
  /** Bumps when dialog opens or user declines — re-hydrate General form from `svg`. */
  hydrateKey: number;
  /** Title from library row for header fallback. */
  listTitle?: string;
  onDecline: () => void;
  /** After Apply merges metadata into the SVG string. */
  onApplied?: () => void;
  onPreview?: () => void;
  saving?: boolean;
};

export function ScadaSymbolEditorPanel({
  resourceKey,
  svg,
  onSvgChange,
  hydrateKey,
  listTitle,
  onDecline,
  onApplied,
  onPreview,
  saving,
}: ScadaSymbolEditorPanelProps) {
  const { theme } = useTheme();
  const monacoTheme = theme === "dark" || theme === "blue-dark-g" ? "vs-dark" : "light";
  const [leftMode, setLeftMode] = useState<"visual" | "xml">("visual");
  const [zoom, setZoom] = useState(100);
  const [rightTab, setRightTab] = useState<"general" | "tags" | "behavior" | "properties">("general");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [pillRects, setPillRects] = useState<{ idx: number; left: number; top: number; label: string }[]>([]);

  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [metaSearchTags, setMetaSearchTags] = useState("");
  const [metaCols, setMetaCols] = useState("3");
  const [metaRows, setMetaRows] = useState("4");
  const [metaStateRender, setMetaStateRender] = useState("function (ctx, svg) {\n  // …\n}");
  const [behaviorRows, setBehaviorRows] = useState<ScadaBehaviorRow[]>([]);
  const [propertyRows, setPropertyRows] = useState<ScadaPropertyRow[]>([]);
  const [tagRows, setTagRows] = useState<ScadaTagRow[]>([]);
  const [tagFuncEditor, setTagFuncEditor] = useState<TagFunctionEditorState | null>(null);
  const [propertyDialog, setPropertyDialog] = useState<ConfigDialogTarget<ScadaPropertyRow> | null>(null);
  const [behaviorDialog, setBehaviorDialog] = useState<ConfigDialogTarget<ScadaBehaviorRow> | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  const previewMarkup = useMemo(() => {
    try {
      return buildInlinePreviewMarkup(svg);
    } catch {
      return null;
    }
  }, [svg]);

  const taggedList = useMemo(() => {
    try {
      const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
      if (doc.querySelector("parsererror")) return [];
      const list = collectTaggedElements(doc);
      return list.map((el, idx) => ({
        idx,
        tag: getTbTag(el) ?? "",
        elName: el.tagName.toLowerCase(),
        idAttr: el.getAttribute("id"),
      }));
    } catch {
      return [];
    }
  }, [svg]);

  const analysis = useMemo(() => analyzeScadaSvg(svg), [svg]);

  const lastHydrateKeyRef = useRef<number | null>(null);
  useEffect(() => {
    if (lastHydrateKeyRef.current === hydrateKey) return;
    lastHydrateKeyRef.current = hydrateKey;
    const meta = parseTbMetadata(svg);
    setMetaTitle(String(meta.title ?? listTitle ?? resourceKey.replace(/\.svg$/i, "") ?? ""));
    setMetaDescription(String(meta.description ?? ""));
    const st = meta.searchTags;
    if (Array.isArray(st)) setMetaSearchTags(st.map(String).join(", "));
    else setMetaSearchTags(String(meta.searchTags ?? ""));
    const ws = readWidgetSize(meta);
    setMetaCols(String(ws.cols));
    setMetaRows(String(ws.rows));
    setMetaStateRender(
      typeof meta.stateRenderFunction === "string"
        ? meta.stateRenderFunction
        : "function (ctx, svg) {\n  // …\n}",
    );
    setBehaviorRows(readBehaviorRows(meta));
    setPropertyRows(readPropertyRows(meta));
    setTagRows(readTagRows(meta, collectSvgTagNames(svg)));
    setSelectedIdx(null);
    setTagFuncEditor(null);
  }, [hydrateKey, svg, listTitle, resourceKey]);

  const svgTagNames = useMemo(() => collectSvgTagNames(svg), [svg]);

  useEffect(() => {
    setTagRows((prev) => {
      const meta = parseTbMetadata(svg);
      const fromMeta = readTagRows(meta, svgTagNames);
      const prevByTag = new Map(prev.map((r) => [r.tag, r]));
      return fromMeta.map((row) => {
        const hit = prevByTag.get(row.tag);
        if (!hit) return row;
        return {
          ...row,
          stateRenderFunction: hit.stateRenderFunction || row.stateRenderFunction,
          clickActionFunction: hit.clickActionFunction || row.clickActionFunction,
        };
      });
    });
  }, [svg, svgTagNames]);

  const openTagFunctionEditor = useCallback((kind: TagFunctionEditorKind, tag: string) => {
    const row = tagRows.find((r) => r.tag === tag);
    const existing =
      kind === "stateRender" ? row?.stateRenderFunction?.trim() : row?.clickActionFunction?.trim();
    const template = kind === "stateRender" ? SCADA_TAG_STATE_RENDER_TEMPLATE : SCADA_TAG_CLICK_ACTION_TEMPLATE;
    setTagFuncEditor({
      kind,
      tag,
      draft: existing || template,
    });
  }, [tagRows]);

  const applyTagFunctionEditor = useCallback(() => {
    if (!tagFuncEditor) return;
    const { kind, tag, draft } = tagFuncEditor;
    setTagRows((rows) =>
      rows.map((row) => {
        if (row.tag !== tag) return row;
        if (kind === "stateRender") return { ...row, stateRenderFunction: draft };
        return { ...row, clickActionFunction: draft };
      }),
    );
    setTagFuncEditor(null);
  }, [tagFuncEditor]);

  const measurePills = useCallback(() => {
    const wrap = wrapRef.current;
    const host = hostRef.current;
    if (!wrap || !host || leftMode !== "visual" || !previewMarkup) {
      setPillRects([]);
      return;
    }
    const svgEl = host.querySelector("svg");
    if (!svgEl) {
      setPillRects([]);
      return;
    }
    const list = collectTaggedElements(svgEl);
    const pr = wrap.getBoundingClientRect();
    const next: { idx: number; left: number; top: number; label: string }[] = [];
    list.forEach((el, i) => {
      const tag = getTbTag(el);
      if (!tag) return;
      const r = el.getBoundingClientRect();
      next.push({
        idx: i,
        left: r.left - pr.left + wrap.scrollLeft,
        top: r.top - pr.top + wrap.scrollTop,
        label: `${el.tagName.toLowerCase()} · ${tag}`,
      });
    });
    setPillRects(next);
  }, [leftMode, previewMarkup, svg, zoom]);

  useLayoutEffect(() => {
    measurePills();
  }, [measurePills, previewMarkup, leftMode, zoom]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => measurePills());
    ro.observe(wrap);
    const onScroll = () => measurePills();
    wrap.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measurePills);
    return () => {
      ro.disconnect();
      wrap.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measurePills);
    };
  }, [measurePills]);

  const applyGeneralToSvg = useCallback(() => {
    const cols = Number.parseInt(metaCols, 10);
    const rows = Number.parseInt(metaRows, 10);
    const patch = buildTbMetadataPatch({
      title: metaTitle,
      description: metaDescription,
      searchTags: metaSearchTags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      widgetCols: Number.isFinite(cols) ? cols : 3,
      widgetRows: Number.isFinite(rows) ? rows : 4,
      stateRenderFunction: metaStateRender,
      behavior: behaviorRows.filter((r) => r.id.trim()),
      properties: propertyRows.filter((r) => r.id.trim()),
      tags: tagRows,
    });
    const next = mergeTbMetadataIntoSvg(svg, patch);
    onSvgChange(next);
    onApplied?.();
  }, [
    svg,
    metaTitle,
    metaDescription,
    metaSearchTags,
    metaCols,
    metaRows,
    metaStateRender,
    behaviorRows,
    propertyRows,
    tagRows,
    onSvgChange,
    onApplied,
  ]);

  const removeTagAt = useCallback(
    (idx: number) => {
      if (!window.confirm("Remove tb:tag from this element?")) return;
      onSvgChange(updateTbTagAtIndex(svg, idx, null));
      if (selectedIdx === idx) setSelectedIdx(null);
    },
    [svg, onSvgChange, selectedIdx],
  );

  const headerTitle = metaTitle.trim() || listTitle || resourceKey;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden md:flex-row">
      {/* Left — canvas / XML */}
      <div className="flex min-h-[14rem] flex-1 flex-col border-b border-border md:min-h-0 md:border-b-0 md:border-r md:border-border">
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/20 px-2 py-1.5">
          <div className="flex rounded-md border border-border bg-background p-0.5">
            <Button
              type="button"
              variant={leftMode === "visual" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => setLeftMode("visual")}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              SVG
            </Button>
            <Button
              type="button"
              variant={leftMode === "xml" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => setLeftMode("xml")}
            >
              <Code2 className="h-3.5 w-3.5" />
              XML
            </Button>
          </div>
          <div className="flex items-center gap-0.5">
            <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => setZoom((z) => Math.max(50, z - 10))}>
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="w-10 text-center text-xs tabular-nums text-muted-foreground">{zoom}%</span>
            <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => setZoom((z) => Math.min(200, z + 10))}>
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
          </div>
          {onPreview ? (
            <Button type="button" variant="outline" size="sm" className="ml-auto h-7 text-xs" onClick={onPreview}>
              Preview
            </Button>
          ) : null}
        </div>

        {leftMode === "xml" ? (
          <div
            className={cn(
              "relative min-h-[14rem] flex-1 overflow-hidden md:min-h-0",
              monacoTheme === "vs-dark" ? "bg-[#1e1e1e]" : "bg-muted/30",
            )}
          >
            <Suspense
              fallback={
                <div className="flex h-48 items-center justify-center bg-muted/20">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              }
            >
              <XmlMonacoEditor
                defaultLanguage="xml"
                language="xml"
                value={svg}
                theme={monacoTheme}
                onChange={(v) => onSvgChange(v ?? "")}
                loading={
                  <div className="flex h-48 items-center justify-center bg-muted/20">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                }
                height="100%"
                options={{
                  minimap: { enabled: false },
                  fontSize: 12,
                  wordWrap: "on",
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  padding: { top: 8 },
                  renderWhitespace: "selection",
                  folding: true,
                }}
              />
            </Suspense>
          </div>
        ) : (
          <div ref={wrapRef} className="relative min-h-[18rem] flex-1 overflow-auto bg-muted/15 p-3 md:min-h-0">
            <div
              className="relative mx-auto min-h-[12rem] w-full max-w-full origin-center transition-transform"
              style={{ transform: `scale(${zoom / 100})` }}
            >
              <div
                ref={hostRef}
                className={cn(
                  "scada-symbol-editor-canvas relative flex min-h-[10rem] items-center justify-center [&_svg]:block [&_svg]:max-h-[70vh] [&_svg]:max-w-full",
                  !previewMarkup && "text-xs text-muted-foreground",
                )}
              >
                {previewMarkup ? (
                  <div className="h-full w-full" dangerouslySetInnerHTML={{ __html: previewMarkup }} />
                ) : (
                  "Invalid or empty SVG"
                )}
              </div>
              {pillRects.map((p) => (
                <div
                  key={`${p.idx}-${p.label}`}
                  className={cn(
                    "absolute z-10 flex max-w-[min(100%,15rem)] items-center gap-0.5 rounded-full border border-border bg-background/95 py-0.5 pl-1.5 pr-0.5 text-[10px] shadow-sm backdrop-blur-sm",
                    selectedIdx === p.idx && "ring-2 ring-primary",
                  )}
                  style={{ left: p.left, top: p.top - 22 }}
                >
                  <button type="button" className="min-w-0 flex-1 truncate text-left font-mono hover:underline" onClick={() => setSelectedIdx(p.idx)}>
                    {p.label}
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    title="Edit tag"
                    onClick={() => {
                      setSelectedIdx(p.idx);
                      setRightTab("tags");
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    title="Behavior draft"
                    onClick={() => {
                      setSelectedIdx(p.idx);
                      setRightTab("behavior");
                    }}
                  >
                    <Settings className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                    title="Remove tag"
                    onClick={() => removeTagAt(p.idx)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right — symbol configuration */}
      <div className="flex w-full shrink-0 flex-col border-border md:w-[min(36rem,42%)] md:border-l">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/15 px-3 py-2">
          <h2 className="truncate text-sm font-semibold text-foreground" title={headerTitle}>
            {headerTitle}
          </h2>
          <div className="flex shrink-0 items-center gap-1">
            <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={onDecline}>
              <X className="h-3.5 w-3.5" />
              Decline
            </Button>
            <Button type="button" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => void applyGeneralToSvg()}>
              <Check className="h-3.5 w-3.5" />
              Apply
            </Button>
          </div>
        </div>

        <Tabs value={rightTab} onValueChange={(v) => setRightTab(v as typeof rightTab)} className="flex min-h-0 flex-1 flex-col">
          <TabsList className="h-auto shrink-0 flex-wrap justify-start gap-1 rounded-none border-b border-border bg-transparent px-2 pt-2">
            <TabsTrigger value="general" className="text-xs">
              General
            </TabsTrigger>
            <TabsTrigger value="tags" className="text-xs">
              Tags
            </TabsTrigger>
            <TabsTrigger value="behavior" className="text-xs">
              Behavior
            </TabsTrigger>
            <TabsTrigger value="properties" className="text-xs">
              Properties
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-0 flex-1 overflow-y-auto p-3 focus-visible:outline-none">
            <div className="space-y-3 text-sm">
              <div className="space-y-1">
                <Label htmlFor="scada-meta-title">Title</Label>
                <Input id="scada-meta-title" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="scada-meta-desc">Description</Label>
                <Textarea id="scada-meta-desc" value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} rows={3} className="text-sm" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="scada-meta-search">Search tags</Label>
                <Input
                  id="scada-meta-search"
                  value={metaSearchTags}
                  onChange={(e) => setMetaSearchTags(e.target.value)}
                  placeholder="comma, separated"
                  className="h-9"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Widget cols</Label>
                  <Input value={metaCols} onChange={(e) => setMetaCols(e.target.value)} className="h-9 font-mono text-xs" inputMode="numeric" />
                </div>
                <div className="space-y-1">
                  <Label>Widget rows</Label>
                  <Input value={metaRows} onChange={(e) => setMetaRows(e.target.value)} className="h-9 font-mono text-xs" inputMode="numeric" />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="scada-state-render">State render function</Label>
                <Textarea
                  id="scada-state-render"
                  value={metaStateRender}
                  onChange={(e) => setMetaStateRender(e.target.value)}
                  spellCheck={false}
                  className="min-h-[10rem] font-mono text-xs"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Apply writes <code className="rounded bg-muted px-1">tb:metadata</code> into the SVG. Tag-level scripts and dashboard RPC wiring
                are usually finished in your dashboard builder; this panel keeps metadata and tags in the file for the gateway.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="tags" className="mt-0 flex-1 overflow-y-auto p-3 focus-visible:outline-none">
            <div className="space-y-3 text-sm">
              <div className="overflow-hidden rounded-md border border-border">
                <div className="grid grid-cols-[minmax(5rem,0.8fr)_minmax(0,1.2fr)_minmax(0,1fr)] gap-2 border-b border-border bg-muted/30 px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <span>Tag</span>
                  <span>State render function</span>
                  <span>On click action</span>
                </div>
                <div className="max-h-[min(28rem,55vh)] overflow-y-auto">
                  {tagRows.length === 0 ? (
                    <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                      No tb:tag attributes in the SVG — add tags in XML first.
                    </p>
                  ) : (
                    tagRows.map((row) => (
                      <div
                        key={row.tag}
                        className="grid grid-cols-[minmax(5rem,0.8fr)_minmax(0,1.2fr)_minmax(0,1fr)] items-center gap-2 border-b border-border px-2 py-2 last:border-b-0"
                      >
                        <span className="inline-flex w-fit rounded-full border border-border bg-muted/50 px-2.5 py-0.5 font-mono text-xs text-foreground">
                          {row.tag}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-fit justify-start gap-1.5 px-2 text-xs text-primary hover:text-primary"
                          onClick={() => openTagFunctionEditor("stateRender", row.tag)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        {row.clickActionFunction.trim() ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-fit justify-start gap-1.5 px-2 text-xs text-primary hover:text-primary"
                            onClick={() => openTagFunctionEditor("clickAction", row.tag)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary hover:bg-primary/10 hover:text-primary"
                            title="Add on click action"
                            onClick={() => openTagFunctionEditor("clickAction", row.tag)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
              {analysis.warnings.length > 0 ? (
                <ul className="list-inside list-disc text-[11px] text-amber-800 dark:text-amber-200">
                  {analysis.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="behavior" className="mt-0 flex-1 overflow-y-auto p-3 focus-visible:outline-none">
            <ScadaSymbolConfigTable
              rows={behaviorRows}
              onChange={setBehaviorRows}
              typeOptions={SCADA_BEHAVIOR_TYPE_OPTIONS}
              addLabel="Add behavior"
              createRow={() => newBehaviorRow(behaviorRows)}
              idPlaceholder="arrow"
              namePlaceholder="{i18n:scada.symbol.arrow-presence}"
              onOpenSettings={(index, row) => setBehaviorDialog({ index, row })}
              onAdd={() => setBehaviorDialog({ index: null, row: newBehaviorRow(behaviorRows) })}
            />
          </TabsContent>

          <TabsContent value="properties" className="mt-0 flex-1 overflow-y-auto p-3 focus-visible:outline-none">
            <ScadaSymbolConfigTable
              rows={propertyRows}
              onChange={setPropertyRows}
              typeOptions={SCADA_PROPERTY_TYPE_OPTIONS}
              addLabel="Add property"
              createRow={() => newPropertyRow(propertyRows)}
              idPlaceholder="lineColor"
              namePlaceholder="{i18n:scada.symbol.line}"
              onOpenSettings={(index, row) => setPropertyDialog({ index, row })}
              onAdd={() => setPropertyDialog({ index: null, row: newPropertyRow(propertyRows) })}
            />
          </TabsContent>
        </Tabs>

        {saving ? (
          <div className="flex items-center gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Saving…
          </div>
        ) : null}
      </div>
      <ScadaBehaviorSettingsDialog
        open={behaviorDialog != null}
        onOpenChange={(open) => {
          if (!open) setBehaviorDialog(null);
        }}
        isCreate={behaviorDialog?.index == null}
        row={behaviorDialog?.row ?? null}
        onApply={(next) => {
          if (behaviorDialog?.index == null) {
            setBehaviorRows((rows) => [...rows, next]);
          } else if (behaviorDialog.index != null) {
            const idx = behaviorDialog.index;
            setBehaviorRows((rows) => rows.map((r, i) => (i === idx ? next : r)));
          }
          setBehaviorDialog(null);
        }}
      />
      <ScadaPropertySettingsDialog
        open={propertyDialog != null}
        onOpenChange={(open) => {
          if (!open) setPropertyDialog(null);
        }}
        isCreate={propertyDialog?.index == null}
        row={propertyDialog?.row ?? null}
        onApply={(next) => {
          if (propertyDialog?.index == null) {
            setPropertyRows((rows) => [...rows, next]);
          } else if (propertyDialog.index != null) {
            const idx = propertyDialog.index;
            setPropertyRows((rows) => rows.map((r, i) => (i === idx ? next : r)));
          }
          setPropertyDialog(null);
        }}
      />
      <ScadaTagFunctionEditorDialog
        open={tagFuncEditor != null}
        onOpenChange={(open) => {
          if (!open) setTagFuncEditor(null);
        }}
        title={tagFuncEditor?.kind === "clickAction" ? "On click action" : "State render function"}
        tagName={tagFuncEditor?.tag ?? ""}
        value={tagFuncEditor?.draft ?? ""}
        onChange={(draft) => {
          setTagFuncEditor((prev) => (prev ? { ...prev, draft } : prev));
        }}
        onApply={applyTagFunctionEditor}
      />
    </div>
  );
}
