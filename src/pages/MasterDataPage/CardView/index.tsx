import { JSX, useState } from "react";
import { FileType, FileAction } from "../types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  Edit,
  Eye,
  Download,
  Trash2,
  FileText,
} from "lucide-react";
import csvIconUrl from "@/assets/SVG/csv.svg";
import txtIconUrl from "@/assets/SVG/txt.svg";
import excelIconUrl from "@/assets/SVG/excel.svg";
import { formatDateTime } from "../TableView";
import { isMasterDataFileActionAllowed } from "../actionPermissions";
import { cn } from "@/lib/utils";

const iconMap: Record<string, string | JSX.Element> = {
  excel: excelIconUrl,
  csv: csvIconUrl,
  text: txtIconUrl,
  default: <FileText className="h-10 w-10 text-muted-foreground" />,
};

interface CardViewProps {
  files: FileType[];
  selectedFileIds: Set<number>;
  onSelectionChange: (fileId: number, isSelected: boolean) => void;
  onAction: (actionType: FileAction, file: FileType) => void;
  subMenuRestrictions: { allowed_actions?: string[] } | null | undefined;
}

export default function CardView({
  files,
  selectedFileIds,
  onSelectionChange,
  onAction,
  subMenuRestrictions,
}: CardViewProps) {
  const [hoveredCardId, setHoveredCardId] = useState<number | null>(null);

  const getFileIcon = (fileType: string) => {
    const type = fileType?.toLowerCase() || "default";
    const iconData = iconMap[type] || iconMap.default;
    if (typeof iconData === "string") {
      return <img src={iconData} alt={`${type} file`} className="h-10 w-10" />;
    }
    return iconData;
  };

  const showEdit = isMasterDataFileActionAllowed(subMenuRestrictions, "edit-uploaded-file");
  const showView = isMasterDataFileActionAllowed(subMenuRestrictions, "view-uploaded-file");
  const showDownload = isMasterDataFileActionAllowed(subMenuRestrictions, "download-uploaded-file");
  const showDelete = isMasterDataFileActionAllowed(subMenuRestrictions, "delete-uploaded-file");
  const hasAnyAction = showEdit || showView || showDownload || showDelete;

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
      {files.length === 0 ? (
        <div className="col-span-full py-8 text-center text-xs text-muted-foreground">
          No files found
        </div>
      ) : (
        files.map((file) => {
          const isHovered = hoveredCardId === file.id;
          const isSelected = selectedFileIds.has(file.id);

          return (
            <Card
              key={file.id}
              className={cn(
                "group relative gap-0 py-2 shadow-sm",
                isSelected && "ring-2 ring-primary/40",
              )}
              onMouseEnter={() => setHoveredCardId(file.id)}
              onMouseLeave={() => setHoveredCardId(null)}
            >
              <CardContent className="flex flex-col items-center p-2">
                <div className="absolute left-1.5 top-1.5 z-10">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => onSelectionChange(file.id, checked === true)}
                    aria-label={`Select ${file.display_name || file.file_name}`}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                {hasAnyAction ? (
                  <div
                    className={cn(
                      "absolute right-1 top-1 z-20 transition-opacity",
                      isHovered || isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                    )}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label="More options"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="z-[100] w-44">
                        {showEdit ? (
                          <DropdownMenuItem onClick={() => onAction("edit", file)}>
                            <Edit className="mr-2 h-3.5 w-3.5" />
                            Edit
                          </DropdownMenuItem>
                        ) : null}
                        {showView ? (
                          <DropdownMenuItem onClick={() => onAction("view", file)}>
                            <Eye className="mr-2 h-3.5 w-3.5" />
                            View
                          </DropdownMenuItem>
                        ) : null}
                        {showDownload ? (
                          <DropdownMenuItem onClick={() => onAction("download", file)}>
                            <Download className="mr-2 h-3.5 w-3.5" />
                            Download
                          </DropdownMenuItem>
                        ) : null}
                        {showDelete ? (
                          <DropdownMenuItem
                            onClick={() => onAction("delete", file)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            Delete
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ) : null}

                <div className="mb-2 mt-5 text-muted-foreground">{getFileIcon(file.file_type)}</div>

                <h3
                  className="mb-1 w-full truncate px-2 text-center text-xs font-medium"
                  title={file.display_name || file.file_name}
                >
                  {file.display_name || file.file_name}
                </h3>

                <div className="grid w-full grid-cols-2 gap-x-1 px-2 text-center text-[11px] text-muted-foreground">
                  <div className="flex flex-col items-center">
                    <span className="mb-0.5 font-medium">Modified</span>
                    <span className="truncate tabular-nums" title={file.updated_at}>
                      {formatDateTime(file.updated_at) || "N/A"}
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="mb-0.5 font-medium">Size</span>
                    <span className="truncate" title={file.size}>
                      {file.size || "—"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
