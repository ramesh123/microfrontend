import { useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";

import TableWithPagination from "@/common/tableWithPagination";
import ShadTooltip from "@/components/common/shadTooltipComponent";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  LIST_PAGE_CARD_CLASS,
  LIST_PAGE_TABLE_WRAPPER_CLASS,
} from "@/components/common/listPageTableStyles";

interface VirtualDbListTableProps {
  workflows: any[];
  totalRows: number;
  currentPage: number;
  pageSize: number;
  loading?: boolean;
  onPaginationChange: (page: number, limit: number) => void;
  onEdit: (workflow: any) => void;
  onDelete: (workflow: any) => void;
}

const titleCase = (s = "") =>
  s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

export function VirtualDbListTable({
  workflows,
  totalRows,
  currentPage,
  pageSize,
  loading = false,
  onPaginationChange,
  onEdit,
  onDelete,
}: VirtualDbListTableProps) {
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const columns: ColumnDef<any, unknown>[] = useMemo(
    () => [
      {
        id: "name",
        header: "Virtual DB",
        accessorKey: "name",
        size: 200,
        cell: ({ row }) => (
          <div className="flex min-w-[200px] items-center gap-2">
            <ShadTooltip content={row.original.name}>
              <span
                className="max-w-[240px] cursor-pointer truncate text-sm font-medium text-foreground hover:underline"
                onClick={() => onEdit(row.original)}
              >
                {titleCase(row.original.name) || "—"}
              </span>
            </ShadTooltip>
          </div>
        ),
      },
      {
        id: "description",
        header: "Description",
        accessorKey: "description",
        size: 200,
        cell: ({ row }) => (
          <span className="block max-w-[200px] truncate text-xs text-muted-foreground">
            {row.original.description || ""}
          </span>
        ),
      },
      {
        id: "business_process",
        header: "Business Process",
        accessorKey: "business_process",
        size: 160,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.business_process ? titleCase(row.original.business_process) : "—"}
          </span>
        ),
      },
      {
        id: "deployment_name",
        header: "Deployment",
        accessorKey: "deployment_name",
        size: 160,
        cell: ({ row }) => {
          const value = row.original.deployment_name ?? "—";
          return (
            <ShadTooltip content={value}>
              <Badge variant="secondary" className="max-w-[200px] cursor-default text-xs">
                <span className="truncate">{value}</span>
              </Badge>
            </ShadTooltip>
          );
        },
      },
      {
        id: "updated_at",
        header: "Updated",
        accessorKey: "updated_at",
        size: 120,
        cell: ({ row }) => {
          const d = row.original.updated_at ?? row.original.created_at;
          if (!d) return <span className="text-xs text-muted-foreground">—</span>;
          const date = new Date(d);
          return (
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {Number.isNaN(date.getTime()) ? "—" : format(date, "PP")}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: () => <div className="flex w-full justify-center">Actions</div>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            <ShadTooltip content="Edit">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(row.original);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </ShadTooltip>
            <ShadTooltip content="Delete">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
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
    [onEdit],
  );

  return (
    <div className="p-1 md:p-1">
      <Card className={LIST_PAGE_CARD_CLASS}>
        <CardContent className="p-0">
          <div className={LIST_PAGE_TABLE_WRAPPER_CLASS}>
            <TableWithPagination
              data={workflows}
              columns={columns}
              totalRows={totalRows}
              pagination={{
                steps: [10, 20, 50, 100],
                currentPage,
                pageSize,
              }}
              showSkipLimit
              scrollContainerClassName="max-h-[calc(100vh-280px)] overflow-auto"
              loading={loading}
              onChangePagination={({ currentPage: page, limit }) => {
                onPaginationChange(page, limit);
              }}
            />
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the Virtual DB{" "}
              <span className="font-semibold">&quot;{deleteTarget?.name}&quot;</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) onDelete(deleteTarget);
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
