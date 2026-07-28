import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChartNetwork,
  RefreshCw,
  Plus,
  Search,
  Download,
  Trash2,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router";

import TableWithPagination from "@/common/tableWithPagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  listRuleChains,
  getRuleChain,
  setRootRuleChain,
  createRuleChainGateway,
  deleteRuleChainGateway,
  type RuleChainSummary,
} from "@/controllers/API/ruleChainsApi";
import { cn } from "@/lib/utils";
import {
  LIST_PAGE_CARD_CLASS,
  LIST_PAGE_CARD_HEADER_CLASS,
  LIST_PAGE_CARD_TITLE_CLASS,
  LIST_PAGE_TABLE_WRAPPER_CLASS,
  SearchClearButton,
} from "@/components/common/listPageTableStyles";

import { getDisplayErrorMessage } from "@/utils/exceptionHelper";
import {
  IOT_GATEWAY_TITLE,
  iotGatewayFlow,
  iotGatewayFlows,
  thisIotGatewayFlow,
} from "./iotGatewayUiLabels";

export type RuleChainTableRow = {
  chainId: string;
  name: string;
  description: string;
  createdDisplay: string;
  createdSortKey: number;
  root: boolean;
  debugMode: boolean;
};

function pickDescription(r: RuleChainSummary): string {
  const fromAdd = r.additionalInfo?.description;
  const fromSnake = r.additional_info?.description;
  const extra =
    typeof fromAdd === "string"
      ? fromAdd
      : typeof fromSnake === "string"
        ? fromSnake
        : "";
  return (typeof r.description === "string" && r.description.trim() ? r.description : extra) || "";
}

function parseCreated(r: RuleChainSummary): { display: string; sortKey: number } {
  if (r.created_time) {
    const d = new Date(r.created_time);
    if (!Number.isNaN(d.getTime())) {
      return { display: format(d, "yyyy-MM-dd HH:mm:ss"), sortKey: d.getTime() };
    }
  }
  if (typeof r.createdTime === "number") {
    const d = new Date(r.createdTime);
    if (!Number.isNaN(d.getTime())) {
      return { display: format(d, "yyyy-MM-dd HH:mm:ss"), sortKey: r.createdTime };
    }
  }
  return { display: "—", sortKey: 0 };
}

function toRows(items: RuleChainSummary[]): RuleChainTableRow[] {
  return items.map((r) => {
    const { display, sortKey } = parseCreated(r);
    return {
      chainId: r.id?.id ?? "",
      name: r.name ?? "",
      description: pickDescription(r),
      createdDisplay: display,
      createdSortKey: sortKey,
      root: Boolean(r.root),
      debugMode: Boolean(r.debugMode ?? r.debug_mode),
    };
  });
}

const RuleChainsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<RuleChainTableRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createDebug, setCreateDebug] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState("");

  const [setRootTarget, setSetRootTarget] = useState<{ chainId: string; name: string } | null>(null);
  const [setRootSubmitting, setSetRootSubmitting] = useState(false);

  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteSubmitting, setBulkDeleteSubmitting] = useState(false);

  const loadChains = useCallback(async (page: number, size: number, searchText: string) => {
    setIsLoading(true);
    try {
      const res = await listRuleChains(page, size, searchText.trim());
      const data = res.data ?? [];
      setRows(toRows(data));
      setTotalRows(typeof res.totalElements === "number" ? res.totalElements : data.length);
    } catch (e) {
      console.error(e);
      toast.error(getDisplayErrorMessage(e, `Failed to load ${iotGatewayFlows}.`));
      setRows([]);
      setTotalRows(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadChains(currentPage, pageSize, searchTerm);
  }, [currentPage, pageSize, searchTerm, loadChains]);

  const handlePaginationChange = ({
    currentPage: page,
    limit,
  }: {
    currentPage: number;
    limit: number;
  }) => {
    setCurrentPage(page);
    setPageSize(limit);
  };

  const handleRefresh = () => {
    setSelectedIds(new Set());
    setSearchTerm(""); 
    setCurrentPage(0);
    setPageSize(10);
    void loadChains(0, 10, "");
    // void loadChains(currentPage, pageSize, searchTerm);
    toast.success("Refreshed");
  };

  const handleRowOpen = useCallback(
    (row: RuleChainTableRow) => {
      if (!row.chainId) return;
      navigate(`/iot-gateway/rulechains/${encodeURIComponent(row.chainId)}/editor`);
    },
    [navigate],
  );

  const confirmBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkDeleteSubmitting(true);
    try {
      await Promise.all(ids.map((id) => deleteRuleChainGateway(id)));
      toast.success(`Deleted ${ids.length} ${ids.length === 1 ? iotGatewayFlow : iotGatewayFlows}.`);
      setBulkDeleteOpen(false);
      setSelectedIds(new Set());
      void loadChains(currentPage, pageSize, searchTerm);
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Delete failed."));
    } finally {
      setBulkDeleteSubmitting(false);
    }
  }, [selectedIds, currentPage, pageSize, searchTerm, loadChains]);

  const displayRows = useMemo(() => rows, [rows]);

  const allPageSelected =
    displayRows.length > 0 && displayRows.every((r) => selectedIds.has(r.chainId));
  const somePageSelected = displayRows.some((r) => selectedIds.has(r.chainId));

  const toggleSelectAllPage = useCallback(() => {
    setSelectedIds((prev) => {
      const allSelected =
        displayRows.length > 0 && displayRows.every((r) => prev.has(r.chainId));
      const next = new Set(prev);
      if (allSelected) {
        displayRows.forEach((r) => next.delete(r.chainId));
      } else {
        displayRows.forEach((r) => next.add(r.chainId));
      }
      return next;
    });
  }, [displayRows]);

  const toggleRow = useCallback((chainId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(chainId)) next.delete(chainId);
      else next.add(chainId);
      return next;
    });
  }, []);

  const openCreate = () => {
    setCreateName("");
    setCreateDescription("");
    setCreateDebug(false);
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    const name = createName.trim();
    if (!name) {
      toast.error("Name is required.");
      return;
    }
    setCreateSubmitting(true);
    try {
      await createRuleChainGateway({
        name,
        debugMode: createDebug,
        description: createDescription.trim() || undefined,
      });
      toast.success(`${iotGatewayFlow} created.`);
      setCreateOpen(false);
      void loadChains(currentPage, pageSize, searchTerm);
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Create failed."));
    } finally {
      setCreateSubmitting(false);
    }
  };

  const exportRow = useCallback(async (chainId: string, name: string) => {
    try {
      const data = await getRuleChain(chainId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rule-chain-${name.replace(/\s+/g, "-") || chainId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export started.");
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Export failed."));
    }
  }, []);

  const confirmSetRoot = useCallback(async () => {
    if (!setRootTarget?.chainId) return;
    setSetRootSubmitting(true);
    try {
      await setRootRuleChain(setRootTarget.chainId);
      toast.success(`Root ${iotGatewayFlow} updated.`);
      setSetRootTarget(null);
      setSelectedIds(new Set());
      void loadChains(currentPage, pageSize, searchTerm);
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Could not set root."));
    } finally {
      setSetRootSubmitting(false);
    }
  }, [setRootTarget, currentPage, pageSize, searchTerm, loadChains]);

  const confirmDelete = useCallback(async () => {
    if (!deleteId) return;
    try {
      await deleteRuleChainGateway(deleteId);
      toast.success(`${iotGatewayFlow} deleted.`);
      setDeleteId(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteId);
        return next;
      });
      void loadChains(currentPage, pageSize, searchTerm);
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Delete failed."));
    }
  }, [deleteId, currentPage, pageSize, searchTerm, loadChains]);

  const columns = useMemo<ColumnDef<RuleChainTableRow>[]>(
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
          const isRowSelected = selectedIds.has(row.original.chainId);
          return (
            <div className="flex justify-center px-1">
              <Checkbox
                checked={isRowSelected}
                onCheckedChange={() => toggleRow(row.original.chainId)}
                aria-label={`Select ${row.original.name}`}
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
        accessorKey: "name",
        size: 180,
        cell: ({ row }) => (
          <span className="text-xs font-medium text-foreground">{row.original.name || "—"}</span>
        ),
      },
      {
        id: "description",
        header: "Description",
        accessorKey: "description",
        size: 220,
        cell: ({ row }) => (
          <span className="line-clamp-2 text-xs text-muted-foreground">{row.original.description || ""}</span>
        ),
      },
      {
        id: "createdTime",
        header: "Created time",
        accessorFn: (row) => row.createdSortKey,
        cell: ({ row }) => (
          <span className="text-primary tabular-nums text-xs">{row.original.createdDisplay}</span>
        ),
        size: 160,
      },
      {
        id: "root",
        header: () => (
          <div className="flex w-full justify-center px-1">
            <span>Root</span>
          </div>
        ),
        accessorKey: "root",
        size: 72,
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex w-full items-center justify-center py-0.5">
              <Checkbox
                checked={r.root}
                onCheckedChange={(v) => {
                  if (r.root) return;
                  if (v === true) {
                    setSetRootTarget({ chainId: r.chainId, name: r.name || thisIotGatewayFlow });
                  }
                }}
                aria-label={
                  r.root ? `This ${iotGatewayFlow} is the root` : `Set this ${iotGatewayFlow} as root`
                }
                className={cn(
                  "h-[18px] w-[18px] shrink-0 rounded-[4px] border-2 shadow-none transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-primary/40",
                  r.root
                    ? "cursor-default border-primary bg-primary text-white data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-white [&_[data-slot=checkbox-indicator]]:text-white"
                    : "border-muted-foreground/40 bg-background hover:border-primary/60 hover:bg-muted/40 data-[state=checked]:bg-primary data-[state=checked]:text-white [&_[data-slot=checkbox-indicator]]:text-white",
                )}
              />
            </div>
          );
        },
      },
      {
        id: "actions",
        header: () => <span className="text-right block pr-2">Actions</span>,
        size: 96,
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex items-center justify-end gap-0.5 pr-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() => void exportRow(r.chainId, r.name)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    onClick={() => {
                      setDeleteId(r.chainId);
                      setDeleteName(r.name);
                    }}
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
      selectedIds,
      toggleSelectAllPage,
      toggleRow,
      exportRow,
    ],
  );

  return (
    <TooltipProvider delayDuration={300}>
    <div className="w-full overflow-hidden p-0">
      <Card className={LIST_PAGE_CARD_CLASS}>
        <CardHeader className={LIST_PAGE_CARD_HEADER_CLASS}>
          <div className="flex min-h-8 min-w-0 flex-nowrap items-center justify-between gap-2 overflow-hidden">
            <div className="flex shrink-0 items-center gap-2">
              <ChartNetwork className="h-4 w-4 shrink-0 text-primary" />
              <h3 className={cn(LIST_PAGE_CARD_TITLE_CLASS, "leading-none")}>{IOT_GATEWAY_TITLE}</h3>
              <span className="text-xs leading-none text-muted-foreground">({totalRows})</span>
            </div>
            {selectedIds.size > 0 ? (
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-white hover:bg-destructive/90 hover:text-white"
                  title="Delete selected"
                  onClick={() => setBulkDeleteOpen(true)}
                  disabled={isLoading}
                >
                  <Trash2 className="h-4 w-4 text-white" />
                </Button>
              </div>
            ) : (
              <div className="flex min-w-0 flex-1 flex-nowrap items-center justify-end gap-2 overflow-hidden">
                <div className="relative w-full max-w-[11rem] shrink-0 sm:max-w-[12rem]">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={`Search ${iotGatewayFlows}`}
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(0);
                    }}
                    className="h-9 rounded-sm bg-background pl-8 pr-8 text-sm"
                  />
                  {searchTerm ? <SearchClearButton onClick={() => { setSearchTerm(""); setCurrentPage(0); }} /> : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="primary"
                    size="icon"
                    className="h-8 w-8 !px-2"
                    onClick={openCreate}
                    title={`Create ${iotGatewayFlow}`}
                  >
                    <Plus className="!h-5 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="icon"
                    className="h-8 w-8 !px-2"
                    onClick={handleRefresh}
                    disabled={isLoading}
                    title="Refresh"
                  >
                    <RefreshCw className={`!h-5 w-4 ${isLoading ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className={LIST_PAGE_TABLE_WRAPPER_CLASS}>
            <TableWithPagination
              data={displayRows}
              columns={columns}
              totalRows={totalRows}
              pagination={{
                steps: [10, 20, 50, 100],
                currentPage,
                pageSize,
              }}
              loading={isLoading}
              onChangePagination={handlePaginationChange}
              onRowClick={handleRowOpen}
              paginationSummary="range"
            />
          </div>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create {iotGatewayFlow}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="rc-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="rc-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder={`${IOT_GATEWAY_TITLE} name`}
                className="h-9"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rc-desc">Description</Label>
              <Textarea
                id="rc-desc"
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                placeholder="Optional description"
                rows={3}
                className="resize-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="rc-debug"
                checked={createDebug}
                onCheckedChange={(v) => setCreateDebug(v === true)}
              />
              <Label htmlFor="rc-debug" className="font-normal cursor-pointer">
                Debug mode
              </Label>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitCreate()} disabled={createSubmitting}>
              {createSubmitting ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(setRootTarget)}
        onOpenChange={(open) => {
          if (!open && !setRootSubmitting) setSetRootTarget(null);
        }}
      >
        <DialogContent
          className="sm:max-w-md"
          onPointerDownOutside={(e) => {
            if (setRootSubmitting) e.preventDefault();
          }}
        >
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-left text-base font-semibold leading-snug pr-6">
              Are you sure you want to make the {iotGatewayFlow} &apos;{setRootTarget?.name ?? ""}&apos; root?
            </DialogTitle>
            <DialogDescription className="text-left text-sm text-muted-foreground pt-3">
              After the confirmation this {iotGatewayFlow} will become root and will handle all incoming transport
              messages.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSetRootTarget(null)}
              disabled={setRootSubmitting}
            >
              No
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={() => void confirmSetRoot()}
              disabled={setRootSubmitting}
            >
              {setRootSubmitting ? "Please wait…" : "Yes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {iotGatewayFlow}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete
              {deleteName ? (
                <>
                  {" "}
                  <strong>{deleteName}</strong>
                </>
              ) : (
                ` ${thisIotGatewayFlow}`
              )}
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmDelete()}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => {
          if (!open && !bulkDeleteSubmitting) setBulkDeleteOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected {iotGatewayFlows}?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to permanently delete{" "}
              <strong>{selectedIds.size}</strong>{" "}
              {selectedIds.size === 1 ? iotGatewayFlow : iotGatewayFlows}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleteSubmitting}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={bulkDeleteSubmitting}
              onClick={() => void confirmBulkDelete()}
            >
              {bulkDeleteSubmitting ? "Deleting…" : "Delete all"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </TooltipProvider>
  );
};

export default RuleChainsListPage;
