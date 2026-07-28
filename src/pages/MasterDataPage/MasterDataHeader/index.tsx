import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ViewMode } from "../types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ForwardedIconComponent from "@/components/common/genericIconComponent";
import { Search, SquareChartGantt } from "lucide-react";
import {
  LIST_PAGE_CARD_TITLE_CLASS,
  SearchClearButton,
} from "@/components/common/listPageTableStyles";
import { cn } from "@/lib/utils";

interface MasterDataHeaderProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onUploadClick: () => void;
  onRefreshClick: () => void;
  onGlobalDownloadClick: () => void;
  onGlobalDeleteClick: () => void;
  canGlobalDownload: boolean;
  canGlobalDelete: boolean;
  isLoading?: boolean;
  restrictions: any;
}

export default function MasterDataHeader({
  viewMode,
  setViewMode,
  searchTerm,
  setSearchTerm,
  onUploadClick,
  onRefreshClick,
  onGlobalDownloadClick,
  onGlobalDeleteClick,
  canGlobalDownload,
  canGlobalDelete,
  isLoading = false,
  restrictions = {},
}: MasterDataHeaderProps) {
  return (
    <div className="mb-1 flex min-h-9 min-w-0 flex-nowrap items-center justify-between gap-2 overflow-hidden">
        <div className="flex shrink-0 items-center gap-2">
              <SquareChartGantt className="h-4 w-4 shrink-0 text-primary" />
              <h1 className={cn(LIST_PAGE_CARD_TITLE_CLASS, "leading-none")}>Master Data</h1>
            </div>
      <div className="flex min-w-0 flex-1 flex-nowrap items-center justify-end gap-2 overflow-hidden">
        <div className="relative w-full max-w-[11rem] shrink-0 sm:max-w-[12rem]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search files"
              className="h-8 rounded-lg bg-background pl-8 pr-8 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm ? <SearchClearButton onClick={() => setSearchTerm("")} /> : null}
        </div>
        <div className="relative top-0 flex h-fit shrink-0 rounded-lg border border-muted bg-muted">
          <div
            className={`absolute top-[1px] h-8 w-8 transform rounded-lg bg-background shadow-md transition-transform duration-300 ${
              viewMode === "list"
                ? "left-[2px] translate-x-0"
                : "left-[6px] translate-x-full"
            }`}
          ></div>
          {["list", "grid"].map((viewType) => (
            <Button
              key={viewType}
              unstyled
              size="icon"
              onClick={() => setViewMode(viewType as ViewMode)}
              title={viewType === "list" ? "List view" : "Grid view"}
              aria-label={viewType === "list" ? "List view" : "Grid view"}
              className={`group relative z-10 mx-[2px] my-[2px] flex-1 rounded-lg p-2 !h-8 ${
                viewMode === viewType
                  ? "text-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <ForwardedIconComponent
                name={viewType === "list" ? "Menu" : "LayoutGrid"}
                aria-hidden="false"
                className="relative bottom-[1px] h-4 w-4 group-hover:text-foreground"
              />
            </Button>
          ))}
        </div>

        <div className="flex shrink-0 flex-nowrap items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="primary"
                  size="icon"
                  onClick={onRefreshClick}
                  disabled={isLoading}
                  className="!px-2 h-8 w-8"
                  aria-label="Refresh files"
                >
                  <ForwardedIconComponent
                    name="RefreshCw"
                    aria-hidden="false"
                    className={cn("!h-5 w-4", isLoading && "animate-spin")}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Refresh files</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {/* {restrictions?.allowed_actions?.includes(
            "refresh-master-data-button"
          ) && (

          )} */}
          {/* {restrictions?.allowed_actions?.includes(
            "download-master-data-button"
          ) && (

          )} */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn("inline-flex", !canGlobalDownload && "cursor-not-allowed")}>
                  <Button
                    variant={canGlobalDownload ? "theme" : "primary"}
                    size="icon"
                    onClick={onGlobalDownloadClick}
                    disabled={!canGlobalDownload}
                    aria-label="Download selected files"
                    className={cn(
                      "h-8 w-8 shrink-0 rounded-sm",
                      !canGlobalDownload && "pointer-events-none opacity-50",
                    )}
                  >
                    <ForwardedIconComponent
                      name="Download"
                      aria-hidden="false"
                      className="h-4 w-4"
                    />
                  </Button>
                </span>
              </TooltipTrigger>

              <TooltipContent>
                <p>
                  {canGlobalDownload
                    ? "Download selected files"
                    : "Select files to download"}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {/* {restrictions?.allowed_actions?.includes(
            "delete-master-data-button"
          ) && (

          )} */}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn("inline-flex", !canGlobalDelete && "cursor-not-allowed")}>
                  <Button
                    variant={canGlobalDelete ? "ghost" : "primary"}
                    size="icon"
                    onClick={onGlobalDeleteClick}
                    disabled={!canGlobalDelete}
                    aria-label="Delete selected files"
                    className={cn(
                      "h-8 w-8 shrink-0 rounded-sm",
                      canGlobalDelete &&
                        "bg-destructive/10 text-destructive hover:bg-destructive/10 hover:text-destructive",
                      !canGlobalDelete && "pointer-events-none opacity-50",
                    )}
                  >
                    <ForwardedIconComponent
                      name="Trash"
                      aria-hidden="false"
                      className="h-4 w-4"
                    />
                  </Button>
                </span>
              </TooltipTrigger>

              <TooltipContent>
                <p>
                  {canGlobalDelete
                    ? "Delete selected files"
                    : "Select files to delete"}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button
            onClick={onUploadClick}
            variant="default"
            className="!h-8 !px-3 md:!pl-2.5"
            size="sm"
          >
              <ForwardedIconComponent
                name="Plus"
                aria-hidden="false"
                className="h-4 w-4"
              />
              <span className="hidden whitespace-nowrap font-semibold md:inline">
                Upload
              </span>
            </Button>
          {/* {restrictions?.allowed_actions?.includes(
            "upload-master-data-button"
          ) && (

          )} */}
        </div>
      </div>
    </div>
  );
}
