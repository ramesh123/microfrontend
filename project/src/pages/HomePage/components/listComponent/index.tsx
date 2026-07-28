import { useMemo, useState } from "react";
import { toast } from "sonner";
import { rollbackWorkflowApi } from "@/controllers/API";
import {
  ApiRequestError,
  getDisplayErrorMessage,
  resolveApiErrorMessage,
} from "@/utils/exceptionHelper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getJobStatusColor, formatJobStatusLabel, formatTimeAgo } from "@/utils/formatters";
import { Lock, Play, RotateCcw, Download, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ShadTooltip from "@/components/common/shadTooltipComponent";
import { ExecuteWorkflowDialog, ExecuteParams } from "@/pages/FlowPage/components/PageComponent/ExecuteWorkflowDialog";
import AIimage from "@/assets/images/ai.png";
import TableWithPagination from "@/common/tableWithPagination";
import { ColumnDef } from "@tanstack/react-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LIST_PAGE_CARD_CLASS,
  LIST_PAGE_CARD_HEADER_CLASS,
  LIST_PAGE_CARD_TITLE_CLASS,
  LIST_PAGE_TABLE_WRAPPER_CLASS,
} from "@/components/common/listPageTableStyles";

const DEFAULT_PAGE_SIZE = 20;
const PAGINATION_STEPS = [10, 20, 50, 100];
type SortedColumns = Record<string, "asc" | "desc">;

const capitalizeLabel = (value?: string | null) => {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
};

interface WorkflowListTableProps {
  workflows: any[];
  totalRows?: number;
  currentPage?: number;
  pageSize?: number;
 onPaginationChange?: (
    page: number,
    limit: number,
    sortedColumns?: SortedColumns
  ) => void;  onDelete: (id: number) => void;
  onNavigate: (workflow: any) => void;
  onExport: (id: number) => void;
  onExecute: (workflow: any, params: ExecuteParams) => void;
  loading?: boolean;
}

export function WorkflowListTable({
  workflows,
  totalRows,
  currentPage: externalPage,
  pageSize: externalSize,
  onPaginationChange,
  onDelete,
  onNavigate,
  onExport,
  onExecute,
  loading = false,
}: WorkflowListTableProps) {
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [rollbackTarget, setRollbackTarget] = useState<any | null>(null);
  const [executeTarget, setExecuteTarget] = useState<any | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);

  // Fallback internal pagination state (client-side mode)
  const [internalPage, setInternalPage] = useState(0);
  const [internalSize, setInternalSize] = useState(DEFAULT_PAGE_SIZE);

  const currentPage = externalPage ?? internalPage;
  const pageSize = externalSize ?? internalSize;
  const actualTotal = totalRows ?? workflows.length;

 const handlePaginationChange = (
  page: number,
  limit: number,
  sortedColumns?: Record<string, "asc" | "desc">
) => {
  const pageSizeChanged = limit !== pageSize;
  const nextPage = pageSizeChanged ? 0 : page;

  if (onPaginationChange) {
    onPaginationChange(nextPage, limit, sortedColumns);
  } else {
    setInternalPage(nextPage);
    setInternalSize(limit);
  }
};

  const confirmRollback = async () => {
    if (!rollbackTarget) return;
    setIsRollingBack(true);
    try {
      const data = await rollbackWorkflowApi(String(rollbackTarget.id));
      const status = data?.status;
      const isSuccess =
        status === "success" ||
        status === "true" ||
        String(status).toLowerCase() === "ok" ||
        String(status) === "1";

      if (isSuccess) {
        toast.success(data.message || "Workflow rolled back successfully.");
      } else {
        toast.error(resolveApiErrorMessage(data, "Rollback failed."));
      }
    } catch (error: unknown) {
      console.error("Failed to rollback workflow:", error);
      if (!(error instanceof ApiRequestError)) {
        toast.error(getDisplayErrorMessage(error, "Failed to rollback workflow."));
      }
    } finally {
      setIsRollingBack(false);
      setRollbackTarget(null);
    }
  };

  const handleExecuteConfirm = (params: ExecuteParams) => {
    if (executeTarget) {
      onExecute(executeTarget, params);
      setExecuteTarget(null);
    }
  };

  // Only slice data locally if we are in client-side mode (totalRows is undefined)
  const displayWorkflows = useMemo(() => {
    if (totalRows !== undefined) return workflows;
    const start = currentPage * pageSize;
    return workflows.slice(start, start + pageSize);
  }, [workflows, currentPage, pageSize, totalRows]);

  const columns: ColumnDef<any, any>[] = useMemo(
    () => [
      {
        id: "workflow",
        header: "Workflow",
        accessorKey: "name",
        size: 220,
        enableSorting: true,
        cell: ({ row }) => {
          const isAI =
            row.original?.workflow_origin === "AI" ||
            String(row.original?.workflow_origin || "").toUpperCase() === "AI";

          return (
            <div className="inline-flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigate(row.original)}
                className="inline-flex max-w-[200px] items-center gap-1 truncate text-left text-sm font-medium hover:text-primary/80 hover:underline decoration-1 underline-offset-2"
              >
                <span className="truncate">{capitalizeLabel(row.original.name as string)}</span>
                {row.original.locked ? (
                  <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
                ) : null}
              </button>
              {isAI && (
                <ShadTooltip content="AI Generated">
                  <Badge
                    variant="outline"
                    className="shrink-0 gap-1 border-primary/50 px-1.5 py-0 text-[10px] font-medium text-primary"
                  >
                    <img
                      src={AIimage}
                      alt="AI"
                      className="h-3 w-3 object-contain"
                    />
                    AI
                  </Badge>
                </ShadTooltip>
              )}
            </div>
          );
        },
      },
      {
        id: "business_process",
        header: "Business Process",
        accessorKey: "business_process",
        size: 160,
        enableSorting: true,
        cell: ({ row }) => (
          <span className="block max-w-[160px] truncate text-xs font-weight-medium">
            {capitalizeLabel(row.original.business_process as string) || "-"}
          </span>
        ),
      },
      {
        id: "description",
        header: "Description",
        accessorKey: "description",
        size: 280,
        enableSorting: true,
        cell: ({ row }) => (
          <span
            className="block max-w-[280px] truncate text-xs"
            title={String(row.original.description ?? "")}
          >
            {row.original.description
              ? capitalizeLabel(row.original.description as string)
              : "No description provided."}
          </span>
        ),
      },
      {
        id: "statement_date",
        header: "Statement Date",
        accessorKey: "statement_date",
        size: 130,
        enableSorting: true,
        cell: ({ row }) => (
          <span className="text-xs tabular-nums whitespace-nowrap">
            {row.original.statement_date
              ? new Date(row.original.statement_date as string).toISOString().split("T")[0]
              : "-"}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorKey: "status",
        size: 120,
        enableSorting: true,
        cell: ({ row }) => {
          const status = row.original.status as string | undefined;
          if (!status?.trim()) {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          return (
            <Badge
              variant="outline"
              className={cn(
                "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium",
                getJobStatusColor(status),
              )}
            >
              <span>{formatJobStatusLabel(status)}</span>
            </Badge>
          );
        },
      },
      {
        id: "execution_time",
        header: "Execution Time",
        accessorKey: "updated_at",
        size: 140,
        enableSorting: true,
        cell: ({ row }) => (
          <span className="text-xs tabular-nums whitespace-nowrap">
            {formatTimeAgo(row.original.updated_at as string)}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <div className="flex w-full justify-center">Actions</div>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1 justify-center">
            <ShadTooltip content="Execute">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  setExecuteTarget(row.original);
                }}
              >
                <Play className="h-3.5 w-3.5" />
              </Button>
            </ShadTooltip>
            <ShadTooltip content="Rollback">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  setRollbackTarget(row.original);
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </ShadTooltip>
            <ShadTooltip content="Export">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  onExport(row.original.id);
                }}
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </ShadTooltip>
            <ShadTooltip content="Delete">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget(row.original);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </ShadTooltip>
          </div>
        ),
      },
    ],
    [onNavigate, onExport]
  );

  return (
    <div className="p-1 md:p-1">
      <Card className={LIST_PAGE_CARD_CLASS}>
       
        <CardContent className="p-0">
          <div className={LIST_PAGE_TABLE_WRAPPER_CLASS}>
            <TableWithPagination
              data={displayWorkflows}
              columns={columns}
              totalRows={actualTotal}
              loading={loading}
              pagination={{
                steps: PAGINATION_STEPS,
                currentPage,
                pageSize,
              }}
              paginationSummary="range"
              scrollContainerClassName="max-h-[calc(100vh-200px)] overflow-auto"
              onChangePagination={({
              currentPage: page,
              limit,
              sortedColumns,
              }) => {
              handlePaginationChange(
                page,
                limit,
                sortedColumns
              );
            }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the workflow{" "}
              <span className="font-semibold">"{deleteTarget?.name}"</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete(deleteTarget.id);
                setDeleteTarget(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rollback Dialog */}
      <AlertDialog
        open={!!rollbackTarget}
        onOpenChange={(open) => !open && setRollbackTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rollback Workflow</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to rollback{" "}
              <span className="font-semibold">"{rollbackTarget?.name}"</span>? This will
              revert it to its previous state.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRollingBack}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRollback} disabled={isRollingBack}>
              {isRollingBack ? "Rolling back..." : "Rollback"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Execute Dialog */}
      <ExecuteWorkflowDialog
        open={!!executeTarget}
        onOpenChange={(open) => !open && setExecuteTarget(null)}
        onExecute={handleExecuteConfirm}
      />
    </div>
  );
}