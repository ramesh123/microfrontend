import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import { ColumnDef } from "@tanstack/react-table";
import { Download, ExternalLink, FileDown, FileText, HelpCircle, Package, Pencil, Plus, RefreshCw, Search, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import TableWithPagination from "@/common/tableWithPagination";
import { LIST_PAGE_TABLE_WRAPPER_CLASS } from "@/components/common/listPageTableStyles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { deleteWidget, listWidgetBundles, type WidgetBundleRecord } from "@/controllers/API/widgetsApi";
import {
  buildGetImageUrlCandidates,
  getIotWidgetsImageFromBundleRef,
  isRenderableTbWidgetImageRef,
} from "@/controllers/thingsboarddashbaordapis/index";
import { cn } from "@/lib/utils";

import BundleWidgetsListView from "./BundleWidgetsListView";
import {
  PAGINATION_STEPS,
  tbImageRefToFilename,
  type WidgetBundleTableRow,
  toWidgetBundleTableRow,
} from "./tableModels";
import {
  widgetsLibraryActionChipClass,
  widgetsLibrarySheetTabClass,

} from "./widgetsLibraryClasses";
import WidgetBundleDetailsPage from "./WidgetBundleDetailsPage";
import { WidgetsBundleDetailsSheet } from "./WidgetsBundleDetailsSheet";
import { exportWidgetBundle, widgetBundleExportErrorMessage } from "./widgetBundleExport";

type WidgetBundlesTableSectionProps = {
  onCreateNewBundle: () => void;
  onImportBundle: () => void;
};

async function blobToBundleImageDisplayUrl(blob: Blob, imageRef: string): Promise<string> {
  const contentType = blob.type || "";
  if (contentType.startsWith("image/")) {
    return URL.createObjectURL(blob);
  }

  const text = await blob.text();
  if (text.trim().startsWith("<svg")) {
    return URL.createObjectURL(new Blob([text], { type: "image/svg+xml;charset=utf-8" }));
  }
  if (text.startsWith("data:image")) return text;

  const candidates = buildGetImageUrlCandidates(imageRef);
  const imageUrl = candidates[0] ?? imageRef;
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(text.substring(0, 100))) {
    const ext = imageUrl.split(".").pop()?.toLowerCase() || "png";
    const mimeType =
      ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "svg" ? "image/svg+xml" : `image/${ext}`;
    return `data:${mimeType};base64,${text}`;
  }

  return "";
}

export default function WidgetBundlesTableSection({
  onCreateNewBundle,
  onImportBundle,
}: WidgetBundlesTableSectionProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [rows, setRows] = useState<WidgetBundleRecord[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(false);
  const [selectedBundle, setSelectedBundle] = useState<WidgetBundleTableRow | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const bundlesDashboardRef = useRef<HTMLDivElement>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [bundleToExport, setBundleToExport] = useState<WidgetBundleTableRow | null>(null);
  const [includeBundleWidgets, setIncludeBundleWidgets] = useState(true);
  const [viewingBundleWidgets, setViewingBundleWidgets] = useState<WidgetBundleTableRow | null>(null);
  const [bundleDetail, setBundleDetail] = useState<Record<string, unknown> | null>(null);
  const [viewingBundleDetail, setViewingBundleDetail] = useState(false);
  const [bundleImageSrc, setBundleImageSrc] = useState<string | null>(null);
  const loadBundles = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listWidgetBundles({
        page: currentPage,
        page_size: pageSize,
        sort_property: "title",
        sort_order: "ASC",
        tenant_only: false,
        full_search: false,
        scada_first: false,
      });

      const data = response.data ?? [];
      setRows(data);
      setTotalRows(typeof response.totalElements === "number" ? response.totalElements : data.length);
    } catch (error) {
      console.error(error);
      toast.error(getDisplayErrorMessage(error, "Failed to load widget bundles."));
      setRows([]);
      setTotalRows(0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize]);

  useEffect(() => {
    void loadBundles();
  }, [loadBundles]);

  const tableRows = useMemo(() => rows.map((row) => toWidgetBundleTableRow(row)), [rows]);
  const filteredTableRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return tableRows;

    return tableRows.filter((row) =>
      [row.title, row.alias, row.createdDisplay, String(row.widgetsCount), row.system ? "system" : ""]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [searchTerm, tableRows]);

  const bundleImageFilename = useMemo(
    () => tbImageRefToFilename(bundleDetail?.image as string | undefined),
    [bundleDetail?.image],
  );

  const handleRefresh = useCallback(() => {
    void loadBundles();
    toast.success("Widget bundles refreshed.");
  }, [loadBundles]);

  const handleDelete = useCallback(
    async (bundleId: string, bundleTitle: string) => {
      try {
        await deleteWidget(bundleId);
        toast.success(`Widget bundle "${bundleTitle}" deleted successfully.`);
        void loadBundles();
      } catch (error) {
        console.error(error);
        toast.error(getDisplayErrorMessage(error, "Failed to delete widget bundle."));
      }
    },
    [loadBundles],
  );

  const handleOpenExportDialog = useCallback((bundle: WidgetBundleTableRow) => {
    setBundleToExport(bundle);
    setIncludeBundleWidgets(true);
    setExportDialogOpen(true);
  }, []);

  const handleOpenBundleWidgets = useCallback((bundle: WidgetBundleTableRow) => {
    setViewingBundleWidgets(bundle);
  }, []);
//   const handleOpenEditSheet = useCallback(async (bundle: WidgetBundleTableRow) => {
//     setIsSheetOpen(true);
//     setSelectedBundle(bundle); // show something immediately while loading
  
//     try {
//       const response = await fetch("/api/iot-widgets/get-widget-bundle", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//        // ✅ Correct - plain string, same as BundleWidgetsListView
// body: JSON.stringify({
//   widget_bundle_id: bundle.id,
// }),
//       });
  
//       if (!response.ok) throw new Error("Failed to fetch bundle details");
  
//       const detail = await response.json();
//       // Merge the full detail into the selected bundle so the sheet shows complete data
//       setSelectedBundle((prev) =>
//         prev ? { ...prev, raw: { ...prev.raw, ...detail } } : prev,
//       );
//     } catch (error) {
//       console.error(error);
//       toast.error(getDisplayErrorMessage(error, "Failed to load bundle details."));
//     }
//   }, []);
useEffect(() => {
  let cancelled = false;
  let revokeUrl: string | null = null;

  setBundleImageSrc(null);

  const imageRef = bundleDetail?.image;
  if (typeof imageRef !== "string" || !isRenderableTbWidgetImageRef(imageRef)) return;

  void (async () => {
    try {
      const blob = await getIotWidgetsImageFromBundleRef(imageRef);
      if (cancelled || !blob) return;

      const displayUrl = await blobToBundleImageDisplayUrl(blob, imageRef);
      if (cancelled || !displayUrl) return;

      if (displayUrl.startsWith("blob:")) revokeUrl = displayUrl;
      setBundleImageSrc(displayUrl);
    } catch (error) {
      console.error("Failed to load bundle image", error);
    }
  })();

  return () => {
    cancelled = true;
    if (revokeUrl) URL.revokeObjectURL(revokeUrl);
  };
}, [bundleDetail?.image]);
const handleOpenEditSheet = useCallback(async (bundle: WidgetBundleTableRow) => {
  setSelectedBundle(bundle);
  setBundleDetail(null); // clear previous bundle's data
  setIsSheetOpen(true);

  try {
    const response = await fetch("/api/iot-widgets/get-widget-bundle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ widget_bundle_id: bundle.id }),
    });

    if (!response.ok) throw new Error("Failed to fetch bundle details");

    const detail = await response.json() as Record<string, unknown>;
    setBundleDetail(detail); // ✅ store the full detail
  } catch (error) {
    console.error(error);
    toast.error(getDisplayErrorMessage(error, "Failed to load bundle details."));
  }
}, []);

  const handleExportBundle = useCallback(
    async (bundle: WidgetBundleTableRow, includeWidgets: boolean) => {
      const fallbackTitle =
        (typeof bundleDetail?.title === "string" && bundleDetail.title.trim()) || bundle.title;
      const title = await exportWidgetBundle(bundle, { includeWidgets, fallbackTitle });
      toast.success(`Widget bundle "${title}" exported successfully.`);
    },
    [bundleDetail?.title],
  );

  const handleExport = useCallback(async () => {
    if (!bundleToExport) return;
    try {
      await handleExportBundle(bundleToExport, includeBundleWidgets);
      setExportDialogOpen(false);
      setBundleToExport(null);
    } catch (error) {
      console.error(error);
      toast.error(widgetBundleExportErrorMessage(error));
    }
  }, [bundleToExport, includeBundleWidgets, handleExportBundle]);

  const handlePaginationChange = useCallback(
    ({
      currentPage: page,
      limit,
    }: {
      currentPage: number;
      limit: number;
      sortedColumns?: Record<string, "asc" | "desc">;
    }) => {
      setCurrentPage(page);
      setPageSize(limit);
    },
    [],
  );

  const paginationProps = useMemo(
    () => ({
      steps: PAGINATION_STEPS,
      currentPage,
      pageSize,
    }),
    [currentPage, pageSize],
  );

  const exportBundleDialog = (
    <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
      <DialogContent className="z-[100] sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Export widgets bundle</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="include-bundle-widgets"
              checked={includeBundleWidgets}
              onCheckedChange={(checked) => setIncludeBundleWidgets(checked === true)}
            />
            <label
              htmlFor="include-bundle-widgets"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Include bundle widgets in exported data (otherwise only referenced widget FQNs will be exported)
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setExportDialogOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleExport}>
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const columns = useMemo<ColumnDef<WidgetBundleTableRow>[]>(
    () => [
     
      {
        id: "title",
        header: "Title",
        accessorKey: "title",
        cell: ({ row }) => (
          <button
            type="button"
            className="cursor-pointer text-left text-xs font-medium text-foreground hover:text-primary hover:underline"
            onClick={() => handleOpenBundleWidgets(row.original)}
          >
            {row.original.title}
          </button>
        ),
        size: 240,
        enableSorting: false,
      },
      {
        id: "alias",
        header: "Alias",
        accessorKey: "alias",
        cell: ({ row }) => (
          <button
            type="button"
            className="cursor-pointer text-left text-xs text-muted-foreground hover:text-primary hover:underline"
            onClick={() => handleOpenBundleWidgets(row.original)}
          >
            {row.original.alias}
          </button>
        ),
        size: 220,
        enableSorting: false,
      },
      {
        id: "widgetsCount",
        header: () => <div className="flex w-full justify-center">Widgets</div>,
        accessorKey: "widgetsCount",
        cell: ({ row }) => (
          <div className="flex justify-center text-xs font-medium">{row.original.widgetsCount}</div>
        ),
        size: 100,
        enableSorting: false,
      },
      {
        id: "system",
        header: () => <div className="flex w-full justify-center">System</div>,
        accessorKey: "system",
        cell: ({ row }) => (
          <button
            type="button"
            className="flex w-full cursor-pointer justify-center"
            onClick={() => handleOpenBundleWidgets(row.original)}
          >
            <Checkbox checked={row.original.system} disabled className="h-[18px] w-[18px]" />
          </button>
        ),
        size: 90,
        enableSorting: false,
      },
       {
        id: "createdTime",
        header: "Created time",
        accessorFn: (row) => row.createdSortKey,
        cell: ({ row }) => (
          <button
            type="button"
            className="cursor-pointer text-left text-xs tabular-nums text-primary hover:text-primary hover:underline"
            onClick={() => handleOpenBundleWidgets(row.original)}
          >
            {row.original.createdDisplay}
          </button>
        ),
        size: 170,
        enableSorting: false,
      },
      {
        id: "actions",
        header: () => <div className="flex w-full justify-center">Actions</div>,
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => handleOpenExportDialog(row.original)}
              title="Export bundle"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              // onClick={() => {
              //   setSelectedBundle(row.original);
              //   setIsSheetOpen(true);
              // }}
              onClick={() => handleOpenEditSheet(row.original)}
              title="Edit bundle"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => handleDelete(row.original.id, row.original.title)}
              title="Delete bundle"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
        size: 140,
        enableSorting: false,
      },
    ],
    // [handleDelete, handleOpenBundleWidgets, handleOpenExportDialog],
    [handleDelete, handleOpenBundleWidgets, handleOpenExportDialog, handleOpenEditSheet],
  );

  if (viewingBundleWidgets) {
    return (
      <>
        <BundleWidgetsListView
          bundle={viewingBundleWidgets}
          onBack={() => setViewingBundleWidgets(null)}
        />
        {exportBundleDialog}
      </>
    );
  }
  // if (viewingBundleDetail && selectedBundle) {
  //   return (
  //     <WidgetBundleDetailsPage
  //       bundle={selectedBundle}
  //       bundleDetail={bundleDetail}
  //       bundleImageSrc={bundleImageSrc}
  //       onBack={() => {
  //         setViewingBundleDetail(false);
  //         // sheet stays closed, table shows
  //       }}
  //     />
  //   );
  // }

  if (viewingBundleDetail && selectedBundle) {
    return (
      <>
        <WidgetBundleDetailsPage
          bundle={selectedBundle}
          bundleDetail={bundleDetail}
          bundleImageSrc={bundleImageSrc}
          onBack={() => {
            setViewingBundleDetail(false);
          }}
          onOpenWidgets={() => {
            setViewingBundleDetail(false);
            setViewingBundleWidgets(selectedBundle);
          }}
          onExport={() => {
            void handleExportBundle(selectedBundle, true).catch((error) => {
              console.error(error);
              toast.error(widgetBundleExportErrorMessage(error));
            });
          }}
        />
        {exportBundleDialog}
      </>
    );
  }
  return (
    <div ref={bundlesDashboardRef} className="w-full">
      <Card className="overflow-hidden border border-border bg-card py-0">
        <div className="flex flex-col gap-2 border-b border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold text-foreground">Widgets bundles</h2>
              <Badge variant="outline" className="rounded-full text-xs font-normal">
                {totalRows}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full min-w-0 sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search widget bundles"
                className="h-9 pl-9"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-foreground"
                  title="Add widgets bundle"
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} className="w-72 rounded-xl p-2 shadow-lg">
                <DropdownMenuItem
                  className="gap-4 rounded-lg px-3 py-3 text-base"
                  onSelect={onCreateNewBundle}
                >
                  <FileText className="h-6 w-6 text-foreground" />
                  <span>Create new widgets bundle</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-4 rounded-lg px-3 py-3 text-base" onSelect={onImportBundle}>
                  <Upload className="h-6 w-6 text-foreground" />
                  <span>Import widgets bundle</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              title="Refresh"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>

        <CardContent className="p-0">
          <div className={LIST_PAGE_TABLE_WRAPPER_CLASS}>
            <TableWithPagination
              data={filteredTableRows}
              columns={columns}
              totalRows={totalRows}
              pagination={paginationProps}
              loading={loading}
              onChangePagination={handlePaginationChange}
              paginationSummary="range"
            />
          </div>
        </CardContent>
      </Card>

      {/* <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-2xl">
          <SheetHeader className="border-b border-border bg-muted px-6 py-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <SheetTitle className="text-lg font-semibold text-foreground">
                  {selectedBundle?.title || "Widget Bundle"}
                </SheetTitle>
                <SheetDescription className="mt-0.5 text-xs text-muted-foreground">
                  Widgets bundle details
                </SheetDescription>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Help"
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => setIsSheetOpen(false)}
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </SheetHeader>

          <div className="space-y-4 px-6 py-4">
            <div className="border-b border-border pb-0.5">
              <button
                type="button"
                className={widgetsLibrarySheetTabClass}
              >
                Details
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                className={widgetsLibraryActionChipClass}
                onClick={() => toast.info("Open widgets bundle")}
              >
                <Package className="mr-1.5 h-3.5 w-3.5" />
                Open widgets bundle
              </Button>
              <Button
                type="button"
                size="sm"
                className={widgetsLibraryActionChipClass}
                onClick={() => toast.info("Open details page")}
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Open details page
              </Button>
              <Button
                type="button"
                size="sm"
                className={widgetsLibraryActionChipClass}
                onClick={() => toast.info("Export widgets bundle")}
              >
                <FileDown className="mr-1.5 h-3.5 w-3.5" />
                Export widgets bundle
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bundle-title" className="text-xs font-medium text-foreground">
                Title<span className="text-red-500">*</span>
              </Label>
              <Input
                id="bundle-title"
                value={selectedBundle?.title || ""}
                className="h-9 border-border bg-background text-sm focus-visible:ring-ring"
                readOnly
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Image preview</Label>
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted p-3">
                <div className="flex gap-3">
                  {selectedBundle?.raw.image ? (
                    <img
                      src={selectedBundle.raw.image as string}
                      alt="Bundle preview"
                      className="h-16 w-16 rounded border border-border object-contain"
                    />
                  ) : (
                    <div className="flex gap-2">
                      <div className="flex h-16 w-16 items-center justify-center rounded border border-border bg-orange-50">
                        <Package className="h-8 w-8 text-orange-400" />
                      </div>
                      <div className="flex h-16 w-16 items-center justify-center rounded border border-border bg-muted">
                        <Package className="h-8 w-8 text-muted-foreground" />
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-foreground">
                    "{selectedBundle?.title || "Bundle"}" system bundle image
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    200x160 · {String(selectedBundle?.raw.imageSize || "6.1")} KB
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="bundle-description" className="text-xs font-medium text-foreground">
                  Description
                </Label>
                <span className="text-xs text-muted-foreground">
                  {String(selectedBundle?.raw.description || "").length}/1024
                </span>
              </div>
              <Textarea
                id="bundle-description"
                value={(selectedBundle?.raw.description as string) || ""}
                className="min-h-[80px] resize-none border-border bg-background text-xs focus-visible:ring-ring"
                readOnly
              />
            </div>

            <div className={widgetsLibraryInfoBannerClass}>
              <div className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-secondary">
                <Package className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-xs font-medium text-foreground">
                {selectedBundle?.system ? "SCADA widgets bundle" : "Custom widgets bundle"}
              </span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bundle-order" className="text-xs font-medium text-foreground">
                Order
              </Label>
              <Input
                id="bundle-order"
                type="number"
                value={(selectedBundle?.raw.order as number) || 7000}
                className="h-9 border-border bg-background text-sm focus-visible:ring-ring"
                readOnly
              />
            </div>
          </div>
        </SheetContent>
      </Sheet> */}
<WidgetsBundleDetailsSheet
  open={isSheetOpen}
  onOpenChange={(open) => {
    setIsSheetOpen(open);
    if (!open) setBundleDetail(null);
  }}
  dashboardAnchorRef={bundlesDashboardRef}
>
    <SheetHeader className="shrink-0 border-b border-border bg-muted px-6 py-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <SheetTitle className="text-lg font-semibold text-foreground">
            {(bundleDetail?.title as string) ?? selectedBundle?.title ?? "Widget Bundle"}
          </SheetTitle>
          <SheetDescription className="mt-0.5 text-xs text-muted-foreground">
            Widgets bundle details
          </SheetDescription>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Help"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => setIsSheetOpen(false)}
            title="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </SheetHeader>

    <div className="shrink-0 border-b border-border px-6">
      <button type="button" className={widgetsLibrarySheetTabClass}>
        Details
      </button>
    </div>

    <div className="min-h-0 flex-1 overflow-y-auto">
    <div className="space-y-4 px-6 py-4">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className={widgetsLibraryActionChipClass}
          onClick={() => {
            if (!selectedBundle) return;
            setIsSheetOpen(false);
            handleOpenBundleWidgets(selectedBundle);
          }}
        >
          <Package className="mr-1.5 h-3.5 w-3.5" />
          Open widgets bundle
        </Button>
        {/* <Button type="button" size="sm" className={widgetsLibraryActionChipClass} onClick={() => toast.info("Open details page")}>
          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
          Open details page
        </Button> */}
        <Button
  type="button"
  size="sm"
  className={widgetsLibraryActionChipClass}
  onClick={() => {
    setIsSheetOpen(false);
    setViewingBundleDetail(true);
  }}
>
  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
  Open details page
</Button>
        {/* <Button type="button" size="sm" className={widgetsLibraryActionChipClass} onClick={() => toast.info("Export widgets bundle")}>
          <FileDown className="mr-1.5 h-3.5 w-3.5" />
          Export widgets bundle
        </Button> */}
        <Button
          type="button"
          size="sm"
          className={widgetsLibraryActionChipClass}
          onClick={() => {
            if (selectedBundle) handleOpenExportDialog(selectedBundle);
          }}
        >
          <FileDown className="mr-1.5 h-3.5 w-3.5" />
          Export widgets bundle
        </Button>
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="bundle-title" className="text-xs font-medium text-foreground">
          Title<span className="text-red-500">*</span>
        </Label>
        <Input
          id="bundle-title"
          value={(bundleDetail?.title as string) ?? selectedBundle?.title ?? ""}
          className="h-9 border-border bg-background text-sm focus-visible:ring-ring"
          readOnly
        />
      </div>

      {/* Image preview */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-foreground">Image preview</Label>
        <div className="flex items-center gap-4 rounded-lg border border-border p-3">
          <div className="flex h-[4.5rem] w-[7.5rem] shrink-0 items-center justify-center overflow-hidden rounded border border-border">
            {bundleImageSrc ? (
              <img
                src={bundleImageSrc}
                alt="Bundle preview"
                className="max-h-[4rem] max-w-full object-contain"
              />
            ) : bundleDetail?.image ? (
              <div className="h-10 w-16 animate-pulse rounded bg-muted-foreground/20" />
            ) : (
              <Package className="h-8 w-8 text-muted-foreground/40" />
            )}
          </div>
          {bundleImageFilename ? (
            <p className="text-sm font-medium text-foreground">{bundleImageFilename}</p>
          ) : (
            <p className="text-xs text-muted-foreground">No image available</p>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="bundle-description" className="text-xs font-medium text-foreground">
            Description
          </Label>
          <span className="text-xs text-muted-foreground">
            {((bundleDetail?.description as string) ?? "").length}/1024
          </span>
        </div>
        <Textarea
          id="bundle-description"
          value={(bundleDetail?.description as string) ?? ""}
          className="min-h-[80px] resize-none border-border bg-background text-xs focus-visible:ring-ring"
          readOnly
        />
      </div>

      {/* SCADA toggle */}
      <div className="flex items-center gap-3">
        <Switch checked={Boolean(bundleDetail?.scada)} disabled />
        <span className="text-sm text-foreground">SCADA widgets bundle</span>
      </div>

      {/* Order */}
      <div className="space-y-1.5">
        <Label htmlFor="bundle-order" className="text-xs font-medium text-foreground">
          Order
        </Label>
        <Input
          id="bundle-order"
          type="number"
          value={(bundleDetail?.order as number) ?? 0}
          className="h-9 border-border bg-background text-sm focus-visible:ring-ring"
          readOnly
        />
      </div>
    </div>
    </div>
</WidgetsBundleDetailsSheet>

      {exportBundleDialog}
    </div>
  );
}
