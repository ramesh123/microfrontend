import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Loader2, MapPin, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
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
import {
  LIST_PAGE_CARD_CLASS,
  LIST_PAGE_CARD_HEADER_CLASS,
  LIST_PAGE_CARD_TITLE_CLASS,
  LIST_PAGE_TABLE_WRAPPER_CLASS,
} from "@/components/common/listPageTableStyles";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { deleteLocation, getLocationsList, type LocationRecord } from "@/controllers/API/locationsApi";
import { cn } from "@/lib/utils";

import { LocationFormDialog } from "./LocationFormDialog";
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';

const PAGINATION_STEPS = [10, 20, 50, 100];

export default function LocationsListPage() {
  const [rows, setRows] = useState<LocationRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LocationRecord | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const loadSeqRef = useRef(0);
  const paginationSyncedRef = useRef(false);

  const load = useCallback(async (nextPage = page, nextPageSize = pageSize) => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    try {
      const out = await getLocationsList({ skip: nextPage * nextPageSize, limit: nextPageSize });
      if (seq !== loadSeqRef.current) return;
      setRows(out.rows);
      setTotal(out.total);
    } catch (e) {
      if (seq !== loadSeqRef.current) return;
      toast.error(getDisplayErrorMessage(e, "Failed to load locations."));
      setRows([]);
      setTotal(0);
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePaginationChange = useCallback(({ currentPage, limit }: { currentPage: number; limit: number }) => {
    if (!paginationSyncedRef.current) {
      paginationSyncedRef.current = true;
      if (currentPage === page && limit === pageSize) return;
    }
    setPage((prev) => (prev === currentPage ? prev : currentPage));
    setPageSize((prev) => (prev === limit ? prev : limit));
  }, [page, pageSize]);

  const openView = useCallback((id: string) => {
    if (!id || id === "—") return;
    setViewId(id);
    setViewOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget?.id || deleteTarget.id === "—") return;
    setDeleteBusy(true);
    try {
      await deleteLocation(deleteTarget.id);
      toast.success("Location deleted.");
      setDeleteTarget(null);
      if (viewId === deleteTarget.id) {
        setViewOpen(false);
        setViewId(null);
      }
      await load();
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to delete location."));
    } finally {
      setDeleteBusy(false);
    }
  }, [deleteTarget, load, viewId]);

  const columns = useMemo<ColumnDef<LocationRecord>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        accessorKey: "name",
        size: 200,
        cell: ({ row }) => <span className="text-xs font-medium text-foreground">{row.original.name || "—"}</span>,
      },
      {
        id: "location_id",
        header: "Location id",
        accessorKey: "location_id",
        size: 160,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">{row.original.location_id || "—"}</span>
        ),
      },
      {
        id: "business_unit",
        header: "Business unit",
        accessorKey: "business_unit",
        size: 160,
        cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.business_unit || "—"}</span>,
      },
      {
        id: "description",
        header: "Description",
        accessorKey: "description",
        size: 280,
        enableSorting: false,
        cell: ({ row }) => (
          <span className="line-clamp-2 text-xs text-muted-foreground">{row.original.description || "—"}</span>
        ),
      },
      {
        id: "actions",
        header: () => (
          <div className="flex w-full justify-center px-1">
            <span className="text-xs">Actions</span>
          </div>
        ),
        size: 120,
        enableSorting: false,
        cell: ({ row }) => {
          const id = row.original.id;
          return (
            <div className="flex w-full justify-center gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      openView(id);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit location</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(row.original);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete location</TooltipContent>
              </Tooltip>
            </div>
          );
        },
      },
    ],
    [openView],
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-0 md:p-0">
        <Card className={LIST_PAGE_CARD_CLASS}>
          <CardHeader className={LIST_PAGE_CARD_HEADER_CLASS}>
            <div className="flex min-h-8 min-w-0 flex-nowrap items-center justify-between gap-2 overflow-hidden">
              <div className="flex shrink-0 items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-primary" />
                <h3 className={cn(LIST_PAGE_CARD_TITLE_CLASS, "leading-none")}>Locations</h3>
                <span className="text-xs leading-none text-muted-foreground">({total})</span>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1">
                <Button
                  type="button"
                  variant="primary"
                  size="icon"
                  className="h-8 w-8 shrink-0 !px-2"
                  onClick={() => setCreateOpen(true)}
                  title="Create location"
                >
                  <Plus className="!h-5 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="icon"
                  className="h-8 w-8 shrink-0 !px-2"
                  title="Refresh locations"
                  onClick={() => {
                    setPage(0);
                    setPageSize(10);
                    void load(0, 10);
                  }}
                  disabled={loading}
                >
                  <RefreshCw className={cn("!h-5 w-4", loading && "animate-spin")} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className={LIST_PAGE_TABLE_WRAPPER_CLASS}>
              <TableWithPagination
                data={rows}
                columns={columns}
                totalRows={total}
                pagination={{
                  steps: PAGINATION_STEPS,
                  currentPage: page,
                  pageSize,
                }}
                loading={loading}
                onChangePagination={handlePaginationChange}
                onRowClick={(row) => openView(row.id)}
                paginationSummary="range"
              />
            </div>
          </CardContent>
        </Card>

        <LocationFormDialog
          mode="create"
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={() => {
            toast.success("Location created.");
            setPage(0);
            void load();
          }}
        />

        <LocationFormDialog
          mode="edit"
          open={viewOpen}
          onOpenChange={setViewOpen}
          locationId={viewId}
          onUpdated={() => {
            toast.success("Location updated.");
            void load();
          }}
        />

        <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && !deleteBusy && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete location?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete
                {deleteTarget?.name && deleteTarget.name !== "—" ? (
                  <>
                    {" "}
                    <strong>{deleteTarget.name}</strong>
                  </>
                ) : (
                  " this location"
                )}
                . This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
              <Button type="button" variant="destructive" disabled={deleteBusy} onClick={() => void confirmDelete()}>
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
