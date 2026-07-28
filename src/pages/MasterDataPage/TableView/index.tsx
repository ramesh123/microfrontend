import { useMemo, JSX } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { FileType, FileAction } from "../types";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  MoreVertical,
  Edit,
  Eye,
  Download,
  Trash2,
  FileText,
} from "lucide-react";
import TableWithPagination from "@/common/tableWithPagination";
import { LIST_PAGE_TABLE_WRAPPER_CLASS } from "@/components/common/listPageTableStyles";
import { cn } from "@/lib/utils";
import { isMasterDataFileActionAllowed } from "../actionPermissions";

type FileIconType = string | JSX.Element;
interface FileIconsMapping {
  [key: string]: FileIconType;
}
const fileIcons: FileIconsMapping = {
  excel: "https://www.svgrepo.com/show/373589/excel.svg",
  csv: "https://www.svgrepo.com/show/375309/csv-document.svg",
  text: "https://www.svgrepo.com/show/375297/txt-document.svg",
  xls: "https://www.svgrepo.com/show/375311/excel-document.svg",
  default: <FileText className="h-5 w-5 text-gray-500" />,
};

export const formatDateTime = (isoDateString: string) => {
  if (!isoDateString) return "N/A";
  try {
    const date = new Date(isoDateString);
    const day = date.getDate().toString().padStart(2, "0");
    const month = date.toLocaleString("default", { month: "short" });
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return "Invalid Date";
  }
};

interface TableViewProps {
  files: FileType[];
  totalRows: number;
  currentPage: number;
  pageSize: number;
  loading?: boolean;
  onPaginationChange: (page: number, limit: number) => void;
  selectedFileIds: Set<number>;
  allSelected: boolean;
  someSelected: boolean;
  onSelectionChange: (fileId: number, isSelected: boolean) => void;
  onSelectAll: (isSelected: boolean) => void;
  onAction: (actionType: FileAction, file: FileType) => void;
  subMenuRestrictions: any;
}

export default function TableView({
  files,
  totalRows,
  currentPage,
  pageSize,
  loading = false,
  onPaginationChange,
  selectedFileIds,
  allSelected,
  someSelected,
  onSelectionChange,
  onSelectAll,
  onAction,
  subMenuRestrictions,
}: TableViewProps) {
  const showEdit = isMasterDataFileActionAllowed(subMenuRestrictions, "edit-uploaded-file");
  const showView = isMasterDataFileActionAllowed(subMenuRestrictions, "view-uploaded-file");
  const showDownload = isMasterDataFileActionAllowed(subMenuRestrictions, "download-uploaded-file");
  const showDelete = isMasterDataFileActionAllowed(subMenuRestrictions, "delete-uploaded-file");

  const renderFileTypeIcon = (fileType: string) => {
    const type = fileType?.toLowerCase() || "default";
    const iconSrc = fileIcons[type] || fileIcons.default;

    if (typeof iconSrc === "string") {
      return (
        <div className="flex items-center justify-center">
          <img
            src={iconSrc}
            alt={`${type} file`}
            className="h-5 w-5"
            title={type.toUpperCase()}
          />
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center" title={type.toUpperCase()}>
        {iconSrc as JSX.Element}
      </div>
    );
  };

  const columns: ColumnDef<FileType, unknown>[] = useMemo(
    () => [
      {
        id: "select",
        header: () => (
          <Checkbox
            checked={allSelected ? true : someSelected ? "indeterminate" : false}
            onCheckedChange={(checked) => onSelectAll(checked === true)}
            aria-label="Select all files"
          />
        ),
        size: 48,
        enableSorting: false,
        cell: ({ row }) => (
          <Checkbox
            checked={selectedFileIds.has(row.original.id)}
            onCheckedChange={(checked) =>
              onSelectionChange(row.original.id, checked === true)
            }
            aria-label={`Select ${row.original.file_name}`}
          />
        ),
      },
      {
        id: "file_name",
        header: "Name",
        accessorKey: "file_name",
        size: 180,
        cell: ({ row }) => (
          <span
            className="block max-w-[200px] truncate text-sm font-medium"
            title={row.original.file_name}
          >
            {row.original.file_name}
          </span>
        ),
      },
      {
        id: "display_name",
        header: "Display Name",
        accessorKey: "display_name",
        size: 180,
        cell: ({ row }) => (
          <span
            className="block max-w-[200px] truncate text-xs text-muted-foreground"
            title={row.original.display_name}
          >
            {row.original.display_name}
          </span>
        ),
      },
      {
        id: "file_type",
        header: () => <div className="w-full text-center">Type</div>,
        accessorKey: "file_type",
        size: 64,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-center">
            {renderFileTypeIcon(row.original.file_type)}
          </div>
        ),
      },
      {
        id: "size",
        header: "Size",
        accessorKey: "size",
        size: 100,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.original.size}</span>
        ),
      },
      {
        id: "updated_at",
        header: "Modified",
        accessorKey: "updated_at",
        size: 120,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDateTime(row.original.updated_at)}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <div className="w-full text-center">Actions</div>,
        enableSorting: false,
        size: 72,
        cell: ({ row }) => (
          <div className="flex justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="More options">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-[100] w-44">
                {showEdit ? (
                  <DropdownMenuItem onClick={() => onAction("edit", row.original)}>
                    <Edit className="mr-2 h-3.5 w-3.5" />
                    Edit
                  </DropdownMenuItem>
                ) : null}
                {showView ? (
                  <DropdownMenuItem onClick={() => onAction("view", row.original)}>
                    <Eye className="mr-2 h-3.5 w-3.5" />
                    View
                  </DropdownMenuItem>
                ) : null}
                {showDownload ? (
                  <DropdownMenuItem onClick={() => onAction("download", row.original)}>
                    <Download className="mr-2 h-3.5 w-3.5" />
                    Download
                  </DropdownMenuItem>
                ) : null}
                {showDelete ? (
                  <DropdownMenuItem
                    onClick={() => onAction("delete", row.original)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Delete
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [
      allSelected,
      someSelected,
      selectedFileIds,
      onSelectAll,
      onSelectionChange,
      onAction,
      showEdit,
      showView,
      showDownload,
      showDelete,
    ],
  );

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", LIST_PAGE_TABLE_WRAPPER_CLASS)}>
      <TableWithPagination
        data={files}
        columns={columns}
        totalRows={totalRows}
        pagination={{
          steps: [10, 20, 50, 100],
          currentPage,
          pageSize,
        }}
        showSkipLimit={true}
        scrollContainerClassName="!max-h-none min-h-0 flex-1 overflow-auto"
        loading={loading}
        onChangePagination={({ currentPage: page, limit }) => {
          onPaginationChange(page, limit);
        }}
      />
    </div>
  );
}
