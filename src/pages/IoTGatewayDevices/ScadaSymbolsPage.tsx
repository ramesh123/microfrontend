import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import {
  Copy,
  Download,
  ExternalLink,
  FileJson,
  FileUp,
  LayoutGrid,
  List,
  Loader2,
  Maximize2,
  MoreVertical,
  Pencil,
  RefreshCw,
  Search,
  Shapes,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import TableWithPagination from "@/common/tableWithPagination";

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
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  deleteScadaSymbol,
  downloadScadaSymbolSvgBlob,
  exportScadaSymbolAsJsonBlob,
  getScadaImageBlob,
  getScadaSymbolsList,
  getSpecificScadaSymbolInfo,
  getSpecificScadaSymbolSvgText,
  importScadaSymbolFromJson,
  modifySpecificScadaSymbol,
  uploadScadaSymbolSvg,
  type ScadaSymbolListItem,
} from "@/controllers/API/scadaSymbolsApi";
import { cn } from "@/lib/utils";
import {
  LIST_PAGE_CARD_CLASS,
  LIST_PAGE_CARD_HEADER_CLASS,
  LIST_PAGE_CARD_TITLE_CLASS,
  LIST_PAGE_TABLE_WRAPPER_CLASS,
  SearchClearButton,
} from "@/components/common/listPageTableStyles";

import { ScadaSymbolAnalysisPanel } from "./ScadaSymbolAnalysisPanel";
import { ScadaSymbolEditorPanel } from "./ScadaSymbolEditorPanel";
import { analyzeScadaSvg, type ScadaSvgAnalysis } from "./scadaSymbolSvgAnalysis";
import { getScadaRowResolution, getScadaRowSizeLabel } from "./scadaListRowMeta";
import { TablePager } from "./DeviceDetailTabShared";
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatTs(ms: number | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  try {
    return format(ms, "yyyy-MM-dd HH:mm");
  } catch {
    return String(ms);
  }
}

/** Strip active content; keep structure (foreignObject, filters, tb:*) for SCADA previews. */
function sanitizeSvgForPreview(svg: string): string {
  let s = svg.trim();
  s = s.replace(/^\s*<\?xml[\s\S]*?\?>\s*/i, "");
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/\son[a-zA-Z]+\s*=\s*["'][^"']*["']/gi, "");
  s = s.replace(/\son[a-zA-Z]+\s*=\s*[^\s>]+\s*/gi, "");
  return s;
}

/**
 * Force the root <svg> to scale inside the card: large pixel width/height breaks <img> previews.
 */
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

const scadaPreviewMarkupCache = new Map<string, string | null>();
const scadaPreviewInFlight = new Map<string, Promise<string | null>>();

async function fetchScadaPreviewMarkup(imageName: string): Promise<string | null> {
  const key = imageName.trim();
  if (!key) return null;
  if (scadaPreviewMarkupCache.has(key)) return scadaPreviewMarkupCache.get(key) ?? null;

  const inflight = scadaPreviewInFlight.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    try {
      let raw = "";
      try {
        raw = await getSpecificScadaSymbolSvgText(key);
      } catch {
        const blob = await getScadaImageBlob(key);
        raw = await blob.text();
      }
      const t = raw.trim();
      if (t.startsWith("{")) throw new Error("json error body");
      if (!/<svg[\s>]/i.test(raw)) throw new Error("not svg");
      const markup = buildInlinePreviewMarkup(raw);
      scadaPreviewMarkupCache.set(key, markup);
      return markup;
    } catch {
      scadaPreviewMarkupCache.set(key, null);
      return null;
    } finally {
      scadaPreviewInFlight.delete(key);
    }
  })();

  scadaPreviewInFlight.set(key, promise);
  return promise;
}

function ScadaPreview({
  imageName,
  wrapperClassName,
  /** Merged onto the inline-SVG container (legacy name from <img> era). */
  imgClassName,
  /** List table cells: no per-cell spinner (parent shows table loading). */
  compactListCell = false,
}: {
  imageName: string;
  wrapperClassName?: string;
  imgClassName?: string;
  compactListCell?: boolean;
}) {
  const cached = scadaPreviewMarkupCache.get(imageName.trim());
  const [markup, setMarkup] = useState<string | null>(cached ?? null);
  const [loading, setLoading] = useState(cached === undefined);
  useEffect(() => {
    const key = imageName.trim();
    if (!key) {
      setMarkup(null);
      setLoading(false);
      return;
    }
    const hit = scadaPreviewMarkupCache.get(key);
    if (hit !== undefined) {
      setMarkup(hit);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setMarkup(null);
    void fetchScadaPreviewMarkup(key).then((next) => {
      if (!cancelled) {
        setMarkup(next);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [imageName]);

  if (loading) {
    if (compactListCell) {
      return <div className={cn("bg-muted/20", wrapperClassName ?? "h-10 w-10")} aria-hidden />;
    }
    return (
      <div className={cn("flex items-center justify-center bg-muted/30", wrapperClassName ?? "h-28 min-h-[7rem]")}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }
  if (!markup) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted/30 px-2 text-center text-xs text-muted-foreground",
          wrapperClassName ?? "h-28 min-h-[7rem]",
        )}
      >
        Preview unavailable
      </div>
    );
  }
  return (
    <div
      className={cn(
        "scada-symbol-preview-root flex items-center justify-center overflow-hidden bg-muted/20 p-2 [&_svg]:block [&_svg]:max-h-full [&_svg]:max-w-full [&_svg]:shrink-0",
        wrapperClassName ?? "h-28 min-h-[7rem]",
        imgClassName,
      )}
      // Trusted gateway SVG; sanitized (scripts / inline handlers removed).
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

function ScadaFullscreenPreview({
  open,
  onOpenChange,
  imageName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageName: string | null;
}) {
  const [zoom, setZoom] = useState([100]);
  useEffect(() => {
    if (open) setZoom([100]);
  }, [open, imageName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] max-w-4xl gap-3">
        <DialogHeader>
          <DialogTitle>Preview mode</DialogTitle>
          <DialogDescription>
            Gateway-rendered SVG preview. Full widget configuration and RPC preview are done in your dashboard environment after export.
          </DialogDescription>
        </DialogHeader>
        {imageName ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <span className="w-24 shrink-0 text-muted-foreground">Zoom</span>
              <Slider value={zoom} min={50} max={200} step={5} onValueChange={setZoom} className="flex-1" />
              <span className="w-12 tabular-nums text-muted-foreground">{zoom[0]}%</span>
            </div>
            <div className="flex min-h-[22rem] items-center justify-center overflow-auto rounded-lg border border-border bg-muted/15 p-4">
              <div style={{ transform: `scale(${zoom[0] / 100})`, transformOrigin: "center center" }}>
                <ScadaPreview imageName={imageName} wrapperClassName="h-72 w-72 md:h-96 md:w-96" imgClassName="h-full w-full" />
              </div>
            </div>
            <p className="font-mono text-xs text-muted-foreground">{imageName}</p>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default function ScadaSymbolsPage() {
  const [rows, setRows] = useState<ScadaSymbolListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [includeSystem, setIncludeSystem] = useState(false);
  const [symbolView, setSymbolView] = useState<"list" | "grid">("list");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(false);
  const [previewBatchLoading, setPreviewBatchLoading] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<"gateway" | "structure">("gateway");
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [detailInfo, setDetailInfo] = useState<Record<string, unknown> | null>(null);
  const [detailSvg, setDetailSvg] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editSvg, setEditSvg] = useState("");
  const [editBaselineSvg, setEditBaselineSvg] = useState("");
  const [editHydrateKey, setEditHydrateKey] = useState(0);
  const [editSaving, setEditSaving] = useState(false);
  const detailAnalysis: ScadaSvgAnalysis | null = useMemo(
    () => (detailSvg != null ? analyzeScadaSvg(detailSvg) : null),
    [detailSvg],
  );

  const [deleteKey, setDeleteKey] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewKey, setPreviewKey] = useState<string | null>(null);

  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState<string | null>(null);
  const [duplicateFilename, setDuplicateFilename] = useState("");
  const [duplicateBusy, setDuplicateBusy] = useState(false);

  const svgInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const appliedSearchBaseline = useRef<string | undefined>(undefined);
  const loadSeqRef = useRef(0);
  const paginationSyncedRef = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedSearch(searchInput.trim());
    }, 400);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (appliedSearchBaseline.current === undefined) {
      appliedSearchBaseline.current = appliedSearch;
      return;
    }
    if (appliedSearchBaseline.current !== appliedSearch) {
      appliedSearchBaseline.current = appliedSearch;
      setPage(0);
    }
  }, [appliedSearch]);

  const pageRowKeys = useMemo(() => rows.map((r) => r.resourceKey), [rows]);
  const allPageSelected = pageRowKeys.length > 0 && pageRowKeys.every((k) => selectedKeys.has(k));
  const somePageSelected = pageRowKeys.some((k) => selectedKeys.has(k));

  useEffect(() => {
    setSelectedKeys(new Set());
  }, [page, pageSize, appliedSearch, includeSystem]);

  const load = useCallback(async (
    nextPage = page,
    nextPageSize = pageSize,
    nextSearch = appliedSearch,
  ) => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    try {
      const out = await getScadaSymbolsList({
        page_size: nextPageSize,
        page: nextPage,
        sort_property: "createdTime",
        sort_order: "DESC",
        image_sub_type: "SCADA_SYMBOL",
        include_system_images: includeSystem,
        text_search: nextSearch,
      });
      if (seq !== loadSeqRef.current) return;
      setRows(out.rows);
      setTotal(out.totalElements);
    } catch (e) {
      if (seq !== loadSeqRef.current) return;
      toast.error(getDisplayErrorMessage(e, "Failed to load SCADA symbols."));
      setRows([]);
      setTotal(0);
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [page, pageSize, appliedSearch, includeSystem]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (symbolView !== "list" || loading || rows.length === 0) {
      setPreviewBatchLoading(false);
      return;
    }
    let cancelled = false;
    setPreviewBatchLoading(true);
    void Promise.all(rows.map((row) => fetchScadaPreviewMarkup(row.resourceKey))).finally(() => {
      if (!cancelled) setPreviewBatchLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [rows, symbolView, loading]);

  const openDetail = async (key: string) => {
    setDetailTab("gateway");
    setDetailKey(key);
    setDetailOpen(true);
    setDetailInfo(null);
    setDetailSvg(null);
    setDetailLoading(true);
    try {
      const [info, svg] = await Promise.all([getSpecificScadaSymbolInfo(key), getSpecificScadaSymbolSvgText(key)]);
      setDetailInfo(info);
      setDetailSvg(svg);
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to load symbol."));
    } finally {
      setDetailLoading(false);
    }
  };

  const openEdit = useCallback(async (key: string) => {
    setEditKey(key);
    setEditOpen(true);
    setEditSvg("");
    setEditBaselineSvg("");
    setEditSaving(true);
    try {
      const svg = await getSpecificScadaSymbolSvgText(key);
      setEditSvg(svg);
      setEditBaselineSvg(svg);
      setEditHydrateKey((k) => k + 1);
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to load SVG."));
      setEditOpen(false);
    } finally {
      setEditSaving(false);
    }
  }, []);

  const declineEditor = useCallback(() => {
    setEditSvg(editBaselineSvg);
    setEditHydrateKey((k) => k + 1);
  }, [editBaselineSvg]);

  const saveEdit = async () => {
    if (!editKey?.trim()) return;
    setEditSaving(true);
    try {
      await modifySpecificScadaSymbol(editKey.trim(), editSvg);
      toast.success("Symbol updated.");
      setEditOpen(false);
      await load();
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to save SVG."));
    } finally {
      setEditSaving(false);
    }
  };

  const onDownloadSvg = async (key: string) => {
    try {
      const blob = await downloadScadaSymbolSvgBlob(key);
      const safe = key.replace(/[^\w.-]+/g, "_") || "symbol.svg";
      triggerBlobDownload(blob, safe.endsWith(".svg") ? safe : `${safe}.svg`);
      toast.success("Download started.");
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Download failed."));
    }
  };

  const onExportJson = async (key: string) => {
    try {
      const blob = await exportScadaSymbolAsJsonBlob(key);
      const base = key.replace(/\.svg$/i, "") || "symbol";
      triggerBlobDownload(blob, `${base}.json`);
      toast.success("Export started.");
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Export failed."));
    }
  };

  const performDelete = async () => {
    if (!deleteKey?.trim()) return;
    setDeleteBusy(true);
    try {
      const raw = (await deleteScadaSymbol(deleteKey.trim())) as Record<string, unknown>;
      const ok = raw.success === true || raw.deleted != null;
      if (!ok && raw.error) {
        toast.error(String(raw.error));
        return;
      }
      toast.success("Symbol deleted.");
      setDeleteKey(null);
      await load();
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Delete failed."));
    } finally {
      setDeleteBusy(false);
    }
  };

  const onSvgFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const analysis = analyzeScadaSvg(text);
      if (!analysis.hasSvgRoot) {
        toast.error("File does not look like a valid SVG (missing <svg> root).");
        return;
      }
      if (analysis.warnings.length) {
        toast.message("SVG checks", { description: analysis.warnings.join(" · ") });
      }
      await uploadScadaSymbolSvg(file);
      toast.success("Symbol uploaded.");
      setPage(0);
      await load();
    } catch (err) {
      toast.error(getDisplayErrorMessage(err, "Upload failed."));
    }
  };

  const onJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      await importScadaSymbolFromJson(file);
      toast.success("Symbol imported.");
      setPage(0);
      await load();
    } catch (err) {
      toast.error(getDisplayErrorMessage(err, "Import failed."));
    }
  };

  const openDuplicate = (key: string) => {
    setDuplicateSource(key);
    const suggested = key.includes(".") ? `copy-of-${key}` : `copy-of-${key}.svg`;
    setDuplicateFilename(suggested);
    setDuplicateOpen(true);
  };

  const performDuplicate = async () => {
    const src = duplicateSource?.trim();
    let name = duplicateFilename.trim();
    if (!src) return;
    if (!name.toLowerCase().endsWith(".svg")) {
      toast.error("Filename must end with .svg");
      return;
    }
    setDuplicateBusy(true);
    try {
      const svg = await getSpecificScadaSymbolSvgText(src);
      const file = new File([svg], name, { type: "image/svg+xml" });
      await uploadScadaSymbolSvg(file);
      toast.success(`Uploaded copy as ${name}.`);
      setDuplicateOpen(false);
      setPage(0);
      await load();
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Duplicate upload failed."));
    } finally {
      setDuplicateBusy(false);
    }
  };

  const handlePaginationChange = useCallback(({ currentPage, limit }: { currentPage: number; limit: number }) => {
    if (!paginationSyncedRef.current) {
      paginationSyncedRef.current = true;
      if (currentPage === page && limit === pageSize) return;
    }
    setPage((prev) => (prev === currentPage ? prev : currentPage));
    setPageSize((prev) => (prev === limit ? prev : limit));
  }, [page, pageSize]);

  const toggleSelectAllPage = useCallback(() => {
    setSelectedKeys((prev) => {
      const allOn = pageRowKeys.length > 0 && pageRowKeys.every((k) => prev.has(k));
      const next = new Set(prev);
      if (allOn) pageRowKeys.forEach((k) => next.delete(k));
      else pageRowKeys.forEach((k) => next.add(k));
      return next;
    });
  }, [pageRowKeys]);

  const toggleRowKey = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const displayRows = useMemo(() => rows, [rows]);

  const scadaColumns = useMemo<ColumnDef<ScadaSymbolListItem>[]>(
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
                (allPageSelected || somePageSelected) &&
                "border-destructive data-[state=checked]:border-destructive data-[state=checked]:bg-destructive data-[state=checked]:text-white data-[state=indeterminate]:border-destructive data-[state=indeterminate]:bg-destructive data-[state=indeterminate]:text-white [&_[data-slot=checkbox-indicator]]:text-white",
              )}
            />
          </div>
        ),
        cell: ({ row }) => {
          const k = row.original.resourceKey;
          const isRowSelected = selectedKeys.has(k);
          return (
            <div className="flex justify-center px-1">
              <Checkbox
                checked={isRowSelected}
                onCheckedChange={() => toggleRowKey(k)}
                aria-label={`Select ${row.original.title}`}
                className={cn(
                  isRowSelected &&
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
        id: "name",
        header: "Name",
        accessorKey: "title",
        size: 300,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded border border-border bg-muted/20">
              <ScadaPreview imageName={row.original.resourceKey} wrapperClassName="h-10 w-10" compactListCell />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-medium text-foreground">{row.original.title || "—"}</span>
              <p className="truncate font-mono text-[11px] text-muted-foreground">{row.original.resourceKey}</p>
            </div>
          </div>
        ),
      },
      {
        id: "resolution",
        header: "Resolution",
        size: 120,
        enableSorting: false,
        accessorFn: (row) => getScadaRowResolution(row),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">{getScadaRowResolution(row.original)}</span>
        ),
      },
      {
        id: "size",
        header: "Size",
        size: 96,
        enableSorting: false,
        accessorFn: (row) => getScadaRowSizeLabel(row),
        cell: ({ row }) => <span className="text-xs text-muted-foreground">{getScadaRowSizeLabel(row.original)}</span>,
      },
      {
        id: "createdTime",
        header: "Created time",
        accessorFn: (row) => row.createdTime ?? 0,
        size: 168,
        cell: ({ row }) => (
          <span className="text-primary tabular-nums text-xs">{formatTs(row.original.createdTime)}</span>
        ),
      },
      {
        id: "actions",
        header: () => (
          <div className="flex w-full justify-center px-1">
            <span className="text-xs">Actions</span>
          </div>
        ),
        size: 220,
        enableSorting: false,
        cell: ({ row }) => {
          const k = row.original.resourceKey;
          return (
            <div className="flex items-center justify-center gap-0.5 px-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() => void onDownloadSvg(k)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Download SVG</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() => void onExportJson(k)}
                  >
                    <FileJson className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export JSON</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() => void openDetail(k)}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Details</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    onClick={() => void openEdit(k)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit symbol</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setDeleteKey(k)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            </div>
          );
        },
      },
    ],
    [
      allPageSelected,
      somePageSelected,
      selectedKeys,
      toggleSelectAllPage,
      toggleRowKey,
      openEdit,
      openDetail,
      onDownloadSvg,
      onExportJson,
    ],
  );

  const editRowTitle = useMemo(() => rows.find((r) => r.resourceKey === editKey)?.title, [rows, editKey]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-0 md:p-0">
        <Card className={LIST_PAGE_CARD_CLASS}>
          <CardHeader className={LIST_PAGE_CARD_HEADER_CLASS}>
            <div className="flex min-h-8 min-w-0 flex-nowrap items-center justify-between gap-2 overflow-hidden">
              <div className="flex shrink-0 items-center gap-2">
                <Shapes className="h-4 w-4 shrink-0 text-primary" />
                <h3 className={cn(LIST_PAGE_CARD_TITLE_CLASS, "leading-none")}>SCADA symbols</h3>
                <span className="text-xs leading-none text-muted-foreground">({total})</span>
              </div>
              <div className="flex min-w-0 flex-1 flex-nowrap items-center justify-end gap-2 overflow-hidden">
                <div className="relative min-w-[10rem] max-w-md flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search by name…"
                    className="h-9 rounded-sm bg-background pl-8 pr-8 text-sm"
                    aria-label="Search SCADA symbols"
                  />
                  {searchInput ? <SearchClearButton onClick={() => setSearchInput("")} /> : null}
                </div>
                <div className="flex items-center gap-2 rounded-md border border-border/70 bg-muted/20 px-2 py-1">
                  <Switch id="scada-include-system" checked={includeSystem} onCheckedChange={(v) => setIncludeSystem(Boolean(v))} />
                  <Label htmlFor="scada-include-system" className="cursor-pointer text-xs font-normal whitespace-nowrap">
                    Include system symbols
                  </Label>
                </div>
                <input ref={svgInputRef} type="file" accept=".svg,image/svg+xml" className="hidden" onChange={onSvgFile} />
                <Button type="button" variant="default" size="sm" className="h-9 shrink-0 gap-1.5 text-sm" onClick={() => svgInputRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                  <span className="hidden sm:inline">Upload</span>
                </Button>
                <input ref={jsonInputRef} type="file" accept=".json,application/json" className="hidden" onChange={onJsonFile} />
                <Button type="button" variant="outline" size="sm" className="h-9 shrink-0 gap-1.5 text-sm" onClick={() => jsonInputRef.current?.click()}>
                  <FileUp className="h-4 w-4" />
                  <span className="hidden sm:inline">Import JSON</span>
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="icon"
                  className="h-8 w-8 shrink-0 !px-2"
                  title="Refresh"
                  onClick={() => {
                    setSearchInput("");
                    setAppliedSearch("");
                    setPage(0);
                    setPageSize(10);
                    void load(0, 10, "");
                  }}
                  disabled={loading}
                >
                  <RefreshCw className={cn("!h-5 w-4", loading && "animate-spin")} />
                </Button>
                <ToggleGroup
                  type="single"
                  value={symbolView}
                  onValueChange={(v) => {
                    if (v === "list" || v === "grid") setSymbolView(v);
                  }}
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                >
                  <ToggleGroupItem
                    value="list"
                    aria-label="List view"
                    className="gap-1.5 px-2.5 data-[state=on]:border-primary data-[state=on]:text-primary"
                  >
                    <List className="h-4 w-4" />
                    <span className="hidden sm:inline">List</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="grid"
                    aria-label="Grid view"
                    className="gap-1.5 px-2.5 data-[state=on]:border-primary data-[state=on]:text-primary"
                  >
                    <LayoutGrid className="h-4 w-4" />
                    <span className="hidden sm:inline">Grid</span>
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>
          </CardHeader>
          <CardContent className="min-h-0 p-0">
            {symbolView === "list" ? (
              <div className={LIST_PAGE_TABLE_WRAPPER_CLASS}>
              <TableWithPagination
                key={`${appliedSearch}|${includeSystem}|list`}
                data={displayRows}
                columns={scadaColumns}
                totalRows={total}
                pagination={{
                  steps: [10, 20, 50, 100],
                  currentPage: page,
                  pageSize,
                }}
                loading={loading || previewBatchLoading}
                onChangePagination={handlePaginationChange}
                onRowClick={(row) => void openEdit(row.resourceKey)}
                paginationSummary="range"
              />
              </div>
            ) : loading && rows.length === 0 ? (
              <div className="flex justify-center py-16 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : rows.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-muted-foreground">
                No symbols found. Upload an SVG or import JSON.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 px-3 py-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {rows.map((row) => (
                    <Card
                      key={row.resourceKey}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          void openEdit(row.resourceKey);
                        }
                      }}
                      className="cursor-pointer overflow-hidden border-border/70 shadow-sm outline-none transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => void openEdit(row.resourceKey)}
                    >
                      <ScadaPreview imageName={row.resourceKey} />
                      <CardContent className="space-y-1 p-3 pt-2">
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground" title={row.title}>
                              {row.title}
                            </p>
                            <p className="truncate font-mono text-[11px] text-muted-foreground" title={row.resourceKey}>
                              {row.resourceKey}
                            </p>
                            <p className="text-[10px] text-muted-foreground">{formatTs(row.createdTime)}</p>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                aria-label="Actions"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem onSelect={() => void openDetail(row.resourceKey)}>Details & structure</DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => {
                                  setPreviewKey(row.resourceKey);
                                  setPreviewOpen(true);
                                }}
                              >
                                <Maximize2 className="mr-2 h-3.5 w-3.5" />
                                Fullscreen preview
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => void openEdit(row.resourceKey)}>
                                <Pencil className="mr-2 h-3.5 w-3.5" />
                                Edit symbol
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => openDuplicate(row.resourceKey)}>
                                <Copy className="mr-2 h-3.5 w-3.5" />
                                Duplicate as new file…
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => void onDownloadSvg(row.resourceKey)}>
                                <Download className="mr-2 h-3.5 w-3.5" />
                                Download SVG
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => void onExportJson(row.resourceKey)}>
                                <FileJson className="mr-2 h-3.5 w-3.5" />
                                Export JSON
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDeleteKey(row.resourceKey)}>
                                <Trash2 className="mr-2 h-3.5 w-3.5" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <TablePager page={page} pageSize={pageSize} totalItems={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
              </>
            )}
          </CardContent>
        </Card>

        <Dialog
          open={detailOpen}
          onOpenChange={(open) => {
            setDetailOpen(open);
            if (!open) setDetailTab("gateway");
          }}
        >
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Symbol details</DialogTitle>
              <DialogDescription>Gateway metadata and parsed SVG structure for this file.</DialogDescription>
            </DialogHeader>
            <Tabs value={detailTab} onValueChange={(v) => setDetailTab(v as "gateway" | "structure")} className="min-h-0">
              <TabsList className="h-auto min-h-8 flex-wrap gap-1">
                <TabsTrigger value="gateway" className="text-xs">
                  Gateway info
                </TabsTrigger>
                <TabsTrigger value="structure" className="text-xs">
                  Structure (SVG)
                </TabsTrigger>
              </TabsList>
              <TabsContent value="gateway" className="mt-2 max-h-[55vh] space-y-2 overflow-y-auto text-sm">
                {detailLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <div>
                      <span className="text-muted-foreground">resourceKey</span>
                      <p className="font-mono text-xs break-all">{detailKey}</p>
                    </div>
                    {detailInfo && Object.keys(detailInfo).length > 0 ? (
                      <pre className="max-h-64 overflow-auto rounded-md border border-border bg-muted/30 p-2 text-xs">
                        {JSON.stringify(detailInfo, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-muted-foreground">No gateway metadata returned.</p>
                    )}
                    {detailKey ? <ScadaPreview imageName={detailKey} /> : null}
                  </>
                )}
              </TabsContent>
              <TabsContent value="structure" className="mt-2 max-h-[55vh] overflow-y-auto">
                {detailLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <ScadaSymbolAnalysisPanel analysis={detailAnalysis} />
                )}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>

        <Sheet
          open={editOpen}
          onOpenChange={(open) => {
            setEditOpen(open);
          }}
        >
          <SheetContent
            side="right"
            className={cn(
              "gap-0 overflow-hidden border border-l border-border p-0 shadow-2xl focus:outline-none",
              "!inset-y-0 !right-0 !left-auto !h-full",
              "!w-[min(92vw,88rem)] !max-w-[92vw]",
              "rounded-l-xl",
            )}
          >
            <SheetHeader className="shrink-0 space-y-1 border-b border-border px-4 py-3 text-left">
              <SheetTitle>Edit symbol — {editKey}</SheetTitle>

            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {editSaving && !editSvg ? (
                <div className="flex flex-1 justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : editKey ? (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <ScadaSymbolEditorPanel
                    resourceKey={editKey}
                    svg={editSvg}
                    onSvgChange={setEditSvg}
                    hydrateKey={editHydrateKey}
                    listTitle={editRowTitle}
                    onDecline={declineEditor}
                    onApplied={() => toast.message("Applied", { description: "Metadata merged into the SVG buffer. Save to persist." })}
                    onPreview={() => {
                      setPreviewKey(editKey);
                      setPreviewOpen(true);
                    }}
                    saving={editSaving}
                  />
                </div>
              ) : null}
            </div>
            <SheetFooter className="mt-0 flex shrink-0 flex-col gap-2 border-t border-border bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <Button type="button" variant="outline" size="sm" onClick={() => editKey && void onExportJson(editKey)} disabled={!editKey}>
                <FileJson className="mr-2 h-4 w-4" />
                Export JSON
              </Button>
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                  Close
                </Button>
                <Button type="button" onClick={() => void saveEdit()} disabled={editSaving || !editKey}>
                  {editSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save
                </Button>
              </div>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <ScadaFullscreenPreview
          open={previewOpen}
          onOpenChange={(o) => {
            setPreviewOpen(o);
            if (!o) setPreviewKey(null);
          }}
          imageName={previewKey}
        />

        <Dialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Duplicate symbol</DialogTitle>
              <DialogDescription>
                Fetches SVG from <span className="font-mono">{duplicateSource}</span> and uploads it as a new file (same as re-upload with a new name).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="dup-name">New file name</Label>
              <Input
                id="dup-name"
                value={duplicateFilename}
                onChange={(e) => setDuplicateFilename(e.target.value)}
                placeholder="my-copy.svg"
                className="font-mono text-sm"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDuplicateOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void performDuplicate()} disabled={duplicateBusy || !duplicateFilename.trim()}>
                {duplicateBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Upload copy
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={Boolean(deleteKey)} onOpenChange={(open) => !open && setDeleteKey(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete symbol?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes <span className="font-mono font-medium">{deleteKey}</span>. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
              <Button type="button" variant="destructive" disabled={deleteBusy} onClick={() => void performDelete()}>
                {deleteBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
