import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import { ColumnDef } from "@tanstack/react-table";
import { Download, FileText, LayoutGrid, Pencil, Plus, RefreshCw, Search, Trash2, Upload, TrendingUp, Target, Cpu, AlertCircle, Type, HelpCircle } from "lucide-react";
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
  DialogDescription,
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
import {
  createWidgetType,
  deleteWidget,
  getWidgetType,
  listWidgetTypes,
  type WidgetTypeRecord,
} from "@/controllers/API/widgetsApi";
import { cn } from "@/lib/utils";

import { PAGINATION_STEPS, type WidgetTableRow, toWidgetTableRow } from "./tableModels";
import { widgetsLibraryTableCheckboxClass } from "./widgetsLibraryClasses";
import WidgetEditor from "./WidgetEditor";
import { WidgetDetailsPanel } from "./WidgetDetailsPanel";

const WIDGET_TYPE_FQN: Record<string, string> = {
  timeseries: "system.time_series_chart",
  latest: "system.cards.attributes_card",
  control: "system.gpio_widgets.basic_gpio_control",
  alarm: "system.alarm_widgets.alarms_table",
  static: "system.cards.html_card",
};

type WidgetsTableSectionProps = {
  onCreateNewWidget: () => void;
  onImportWidget: () => void;
};

export default function WidgetsTableSection({ onCreateNewWidget, onImportWidget }: WidgetsTableSectionProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [rows, setRows] = useState<WidgetTypeRecord[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const [totalRows, setTotalRows] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState<WidgetTableRow | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [widgetToExport, setWidgetToExport] = useState<WidgetTableRow | null>(null);
  const [embedResources, setEmbedResources] = useState(true);
  const [widgetTypeSelectionOpen, setWidgetTypeSelectionOpen] = useState(false);
  const [newWidgetType, setNewWidgetType] = useState("timeseries");
  const [creatingWidgetType, setCreatingWidgetType] = useState(false);
  
  const [detailsWidget, setDetailsWidget] = useState<WidgetTableRow | null>(null);
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(false);
  const dashboardAnchorRef = React.useRef<HTMLDivElement>(null);

  const loadWidgets = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listWidgetTypes({
        page: currentPage,
        page_size: pageSize,
        sort_property: "name",
        sort_order: "ASC",
        tenant_only: false,
        full_search: false,
        scada_first: false,
        deprecated_filter: "ALL",
        text_search: debouncedSearchTerm,
      });

      const data = response.data ?? [];
      setRows(data);
      setTotalRows(typeof response.totalElements === "number" ? response.totalElements : data.length);
    } catch (error) {
      console.error(error);
      toast.error(getDisplayErrorMessage(error, "Failed to load widget types."));
      setRows([]);
      setTotalRows(0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, debouncedSearchTerm]);

  useEffect(() => {
    void loadWidgets();
  }, [loadWidgets]);

  const tableRows = useMemo(() => rows.map((row) => toWidgetTableRow(row)), [rows]);

  const handleRefresh = useCallback(() => {
    void loadWidgets();
    toast.success("Widgets refreshed.");
  }, [loadWidgets]);

  const handleDelete = useCallback(
    async (widgetId: string, widgetTitle: string) => {
      try {
        await deleteWidget(widgetId);
        toast.success(`Widget "${widgetTitle}" deleted successfully.`);
        void loadWidgets();
      } catch (error) {
        console.error(error);
        toast.error(getDisplayErrorMessage(error, "Failed to delete widget."));
      }
    },
    [loadWidgets],
  );

  const handleOpenExportDialog = useCallback((widget: WidgetTableRow) => {
    setWidgetToExport(widget);
    setEmbedResources(true);
    setExportDialogOpen(true);
  }, []);

  const handleExport = useCallback(async () => {
    if (!widgetToExport) return;

    try {
      // Call API to get full widget data
      const widgetData = await getWidgetType(widgetToExport.id);

      // Create export data
      const exportData = {
        ...widgetData,
        embedResources,
        exportedAt: new Date().toISOString(),
      };

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${widgetToExport.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_widget.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Widget "${widgetToExport.title}" exported successfully.`);
      setExportDialogOpen(false);
      setWidgetToExport(null);
    } catch (error) {
      console.error(error);
      toast.error(getDisplayErrorMessage(error, "Failed to export widget."));
    }
  }, [widgetToExport, embedResources]);

  const handleOpenCreateDialog = useCallback(() => {
    setWidgetTypeSelectionOpen(true);
  }, []);

  const handleSelectWidgetType = useCallback(async (type: string) => {
    setNewWidgetType(type);
    setWidgetTypeSelectionOpen(false);

    const fqn = WIDGET_TYPE_FQN[type];
    if (!fqn) {
      toast.info(`Selected ${type} widget type. Widget editor will open here.`);
      return;
    }

    setCreatingWidgetType(true);
    try {
      const result = await createWidgetType({ fqn });
      setSelectedWidget(toWidgetTableRow(result));
      toast.success("Widget created successfully.");
    } catch (error) {
      console.error(error);
      toast.error(getDisplayErrorMessage(error, "Failed to create widget type."));
    } finally {
      setCreatingWidgetType(false);
    }
  }, []);

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

  const columns = useMemo<ColumnDef<WidgetTableRow>[]>(
    () => [
     
      {
        id: "title",
        header: "Title",
        accessorKey: "title",
        cell: ({ row }) => (
          <button
            type="button"
            className="cursor-pointer text-left text-xs font-medium text-foreground hover:text-primary hover:underline"
            onClick={() => setSelectedWidget(row.original)}
          >
            {row.original.title}
          </button>
        ),
        size: 240,
        enableSorting: false,
      },
      {
        id: "bundles",
        header: "Widgets bundles",
        accessorFn: (row) => row.bundles.join(", "),
        cell: ({ row }) =>
          row.original.bundles.length > 0 ? (
            <div className="flex max-w-[18rem] flex-wrap gap-1">
              {row.original.bundles.map((bundle) => (
                <Badge
                  key={`${row.original.id}-${bundle}`}
                  variant="secondary"
                  className="rounded-full px-2 py-0.5 text-xs font-normal"
                >
                  {bundle}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
        size: 250,
        enableSorting: false,
      },
      {
        id: "widgetType",
        header: "Widget type",
        accessorKey: "widgetType",
        cell: ({ row }) => (
          <button
            type="button"
            className="cursor-pointer text-left text-xs text-foreground hover:text-primary hover:underline"
            onClick={() => setSelectedWidget(row.original)}
          >
            {row.original.widgetType}
          </button>
        ),
        size: 180,
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
            onClick={() => setSelectedWidget(row.original)}
          >
            <Checkbox checked={row.original.system} disabled className={widgetsLibraryTableCheckboxClass} />
          </button>
        ),
        size: 90,
        enableSorting: false,
      },
      {
        id: "deprecated",
        header: () => <div className="flex w-full justify-center">Deprecated</div>,
        accessorKey: "deprecated",
        cell: ({ row }) => (
          <button
            type="button"
            className="flex w-full cursor-pointer justify-center"
            onClick={() => setSelectedWidget(row.original)}
          >
            <Checkbox checked={row.original.deprecated} disabled className={widgetsLibraryTableCheckboxClass} />
          </button>
        ),
        size: 110,
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
            onClick={() => setSelectedWidget(row.original)}
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
              title="Export widget"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setDetailsWidget(row.original);
                setDetailsPanelOpen(true);
              }}
              title="Edit widget"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => handleDelete(row.original.id, row.original.title)}
              title="Delete widget"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
        size: 140,
        enableSorting: false,
      },
    ],
    [handleDelete, handleOpenExportDialog],
  );

  if (selectedWidget) {
    return <WidgetEditor widget={selectedWidget} onClose={() => setSelectedWidget(null)} />;
  }

  return (
    <>
      <div ref={dashboardAnchorRef} />
      <Card className="overflow-hidden border border-border bg-card py-0">
        <div className="flex flex-col gap-2 border-b border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold text-foreground">Widgets</h2>
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
                placeholder="Search widgets"
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
                  title="Add widget"
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} className="w-72 rounded-xl p-2 shadow-lg">
                <DropdownMenuItem className="gap-4 rounded-lg px-3 py-3 text-base" onSelect={handleOpenCreateDialog}>
                  <FileText className="h-6 w-6 text-foreground" />
                  <span>Create new widget</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-4 rounded-lg px-3 py-3 text-base"
                  onSelect={onImportWidget}
                >
                  <Upload className="h-6 w-6 text-foreground" />
                  <span>Import widget</span>
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
              data={tableRows}
              columns={columns}
              totalRows={totalRows}
              pagination={paginationProps}
              loading={loading}
              onChangePagination={handlePaginationChange}
              onRowClick={(row) => setSelectedWidget(row)}
              paginationSummary="range"
            />
          </div>
        </CardContent>
      </Card>

      <Dialog open={widgetTypeSelectionOpen} onOpenChange={setWidgetTypeSelectionOpen}>
        <DialogContent className="sm:max-w-[780px] p-0 gap-0" onCloseAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 bg-primary px-6 py-4 text-primary-foreground rounded-t-lg">
            <DialogTitle className="text-lg font-normal text-primary-foreground">Select widget type</DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground hover:text-primary hover:text-primary-foreground rounded-full"
                title="Help"
              >
                <HelpCircle className="h-5 w-5" />
              </Button>
            </div>
          </DialogHeader>
          
          <div className="px-6 py-8 bg-background">
            <div className="grid grid-cols-5 gap-4">
              <button
                type="button"
                disabled={creatingWidgetType}
                onClick={() => void handleSelectWidgetType("timeseries")}
                className="flex flex-col items-center justify-center gap-4 rounded-lg bg-primary p-6 text-primary-foreground transition-all hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 aspect-[3/4]"
              >
                <TrendingUp className="h-12 w-12" strokeWidth={2} />
                <span className="text-sm font-normal">Time series</span>
              </button>

              <button
                type="button"
                disabled={creatingWidgetType}
                onClick={() => void handleSelectWidgetType("latest")}
                className="flex flex-col items-center justify-center gap-4 rounded-lg bg-primary p-6 text-primary-foreground transition-all hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 aspect-[3/4]"
              >
                <Target className="h-12 w-12" strokeWidth={2} />
                <span className="text-sm font-normal">Latest values</span>
              </button>

              <button
                type="button"
                disabled={creatingWidgetType}
                onClick={() => void handleSelectWidgetType("control")}
                className="flex flex-col items-center justify-center gap-4 rounded-lg bg-primary p-6 text-primary-foreground transition-all hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 aspect-[3/4]"
              >
                <Cpu className="h-12 w-12" strokeWidth={2} />
                <span className="text-sm font-normal">Control widget</span>
              </button>

              <button
                type="button"
                disabled={creatingWidgetType}
                onClick={() => void handleSelectWidgetType("alarm")}
                className="flex flex-col items-center justify-center gap-4 rounded-lg bg-primary p-6 text-primary-foreground transition-all hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 aspect-[3/4]"
              >
                <AlertCircle className="h-12 w-12" strokeWidth={2} />
                <span className="text-sm font-normal">Alarm widget</span>
              </button>

              <button
                type="button"
                disabled={creatingWidgetType}
                onClick={() => void handleSelectWidgetType("static")}
                className="flex flex-col items-center justify-center gap-4 rounded-lg bg-primary p-6 text-primary-foreground transition-all hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 aspect-[3/4] disabled:opacity-60"
              >
                <Type className="h-12 w-12" strokeWidth={2} />
                <span className="text-sm font-normal">Static widget</span>
              </button>
            </div>
          </div>

          <div className="flex justify-end bg-muted px-6 py-4 border-t border-border rounded-b-lg">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() => setWidgetTypeSelectionOpen(false)}
              className="text-foreground hover:bg-muted font-normal"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Export widget</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="embed-resources"
                checked={embedResources}
                onCheckedChange={(checked) => setEmbedResources(checked === true)}
              />
              <label
                htmlFor="embed-resources"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Embed widget images and resources
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

      <WidgetDetailsPanel
        widget={detailsWidget}
        open={detailsPanelOpen}
        onOpenChange={setDetailsPanelOpen}
        dashboardAnchorRef={dashboardAnchorRef}
        onEdit={(widget) => {
          setDetailsPanelOpen(false);
          setSelectedWidget(widget);
        }}
        onExport={handleOpenExportDialog}
        onDelete={handleDelete}
      />
    </>
  );
}
