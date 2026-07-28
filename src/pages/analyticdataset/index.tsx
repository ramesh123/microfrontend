import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Layers2Icon, MoreHorizontal, Pencil, Plus, RefreshCw, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ForwardedIconComponent } from "@/components/common/genericIconComponent";
import DatasetStepLoading from "@/components/common/datasets/DatasetStepLoading";
import { getAllDatasets } from "@/controllers/API/datasetApi";
import { getMasterDataFiles } from "@/controllers/API/filesApi";
import { getDisplayErrorMessage } from "@/utils/exceptionHelper";
import type { Dataset } from "@/types/dataset";
import { cn } from "@/lib/utils";

type DatasetIconFile = {
  file_name?: string;
  unique_id?: string;
  value?: string;
  encrypted_file_key?: string;
  label?: string;
  file_type?: string;
  sheet_name?: string;
};

function formatDatasetType(dataset: Dataset, iconFile?: DatasetIconFile) {
  const label = iconFile?.file_name || dataset.type;
  return label.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function DatasetIcon({
  dataset,
  iconFile,
  className,
}: {
  dataset: Dataset;
  iconFile?: DatasetIconFile;
  className?: string;
}) {
  const API_BASE_URL = "/user-uploads/";
  const fileName =
    (iconFile?.file_name as string | undefined) ||
    dataset.node?.payload?.file_name ||
    dataset.payload?.file_name;
  const uniqueId =
    (iconFile?.value as string | undefined) ||
    (iconFile?.unique_id as string | undefined) ||
    dataset.node?.payload?.icon_unique_id ||
    dataset.payload?.icon_unique_id ||
    dataset.node?.payload?.unique_id ||
    dataset.payload?.unique_id;
  const imageUrl = fileName && uniqueId ? `${API_BASE_URL}${uniqueId}/${fileName}` : null;

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={fileName || "icon"}
        className={cn("size-5 object-contain", className)}
      />
    );
  }

  return (
    <ForwardedIconComponent
      name={dataset.type}
      className={cn("size-5 text-muted-foreground", className)}
    />
  );
}

function DatasetCard({
  dataset,
  iconFile,
  embedded,
  selected,
  onEdit,
  onSelect,
}: {
  dataset: Dataset;
  iconFile?: DatasetIconFile;
  embedded?: boolean;
  selected?: boolean;
  onEdit?: () => void;
  onSelect?: () => void;
}) {
  const typeLabel = formatDatasetType(dataset, iconFile);
  const updatedLabel = format(new Date(dataset.updated_at), "dd MMM yyyy");

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!onSelect}
      className={cn(
        "group relative w-full rounded-lg border px-2.5 py-2.5 text-left transition-colors",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "border-border/60 bg-background",
        onSelect && !selected && "cursor-pointer hover:border-primary/40 hover:bg-muted/20",
        onSelect && selected && "cursor-pointer",
        !onSelect && "cursor-default",
      )}
      title={dataset.name}
    >
      {!embedded && onEdit ? (
        <div className="absolute right-1.5 top-1.5 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="size-7 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
                onClick={(event) => event.stopPropagation()}
              >
                <MoreHorizontal className="size-3.5" />
                <span className="sr-only">Dataset actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit();
                }}
              >
                <Pencil className="mr-2 size-4" />
                Edit
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}

      <div className="flex items-start gap-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/50 ring-1 ring-border/40">
          <DatasetIcon dataset={dataset} iconFile={iconFile} />
        </div>

        <div className="min-w-0 flex-1 pr-5">
          <p className="truncate text-sm font-semibold leading-5 text-foreground">{dataset.name}</p>
          <p className="mt-0.5 truncate text-xs leading-4 text-muted-foreground">{typeLabel}</p>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-1 border-t border-border/40 pt-2">
        <Badge variant="outline" className="max-w-[55%] truncate rounded-full px-2 py-0 text-[10px] font-medium">
          {dataset.group}
        </Badge>
        <span className="truncate text-xs text-muted-foreground">{updatedLabel}</span>
      </div>
    </button>
  );
}

export default function AnalyticalDatasetPage({
  embedded = false,
  compact = false,
  isViewOnly = false,
  selectedDatasetId,
  onCreateDataset,
  onDatasetSelect,
}: {
  embedded?: boolean;
  compact?: boolean;
  isViewOnly?: boolean;
  selectedDatasetId?: number;
  onCreateDataset?: () => void;
  onDatasetSelect?: (dataset: Dataset) => void;
}) {
  const navigate = useNavigate();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [files, setFiles] = useState<DatasetIconFile[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const getIconFileForDataset = useCallback(
    (dataset: Dataset): DatasetIconFile | undefined => {
      const uniqueId =
        dataset.node?.payload?.icon_unique_id ||
        dataset.payload?.icon_unique_id ||
        dataset.node?.payload?.unique_id ||
        dataset.payload?.unique_id;
      const encryptedKey =
        dataset.node?.payload?.icon_encrypted_file_key ||
        dataset.payload?.icon_encrypted_file_key ||
        dataset.node?.payload?.encrypted_file_key ||
        dataset.payload?.encrypted_file_key;

      return files.find(
        (file) =>
          (uniqueId && (file.unique_id === uniqueId || file.value === uniqueId)) ||
          (encryptedKey && file.encrypted_file_key === encryptedKey),
      );
    },
    [files],
  );

  const fetchDatasets = useCallback(
    async (searchText: string = debouncedSearchTerm) => {
      setIsLoading(true);
      try {
        const [datasetsResponse, filesResponse] = await Promise.all([
          getAllDatasets({
            search_text: searchText,
            sort: { created_at: "desc" },
          }),
          getMasterDataFiles({
            fields: JSON.stringify([
              "unique_id as value",
              "display_name as label",
              "file_name",
              "file_type",
              "encrypted_file_key",
              "sheet_name",
            ]),
            file_category: "dataset_icon",
          }),
        ]);

        setDatasets(datasetsResponse?.data || []);
        setFiles((filesResponse?.data || []) as DatasetIconFile[]);
        setTotalCount(datasetsResponse?.total || datasetsResponse?.data?.length || 0);
      } catch (error) {
        toast.error(getDisplayErrorMessage(error, "Failed to fetch datasets."));
        setDatasets([]);
        setFiles([]);
        setTotalCount(0);
      } finally {
        setIsLoading(false);
      }
    },
    [debouncedSearchTerm],
  );

  useEffect(() => {
    void fetchDatasets(debouncedSearchTerm);
  }, [debouncedSearchTerm, fetchDatasets]);

  const handleRefresh = () => {
    setSearchTerm("");
    if (debouncedSearchTerm !== "") {
      setDebouncedSearchTerm("");
    } else {
      void fetchDatasets("");
    }
    toast.success("Datasets refreshed successfully");
  };

  const handleCreateDataset = () => {
    if (onCreateDataset) {
      onCreateDataset();
      return;
    }
    navigate("/datasets/create");
  };

  return (
    <div className={cn("flex h-full min-h-0 flex-col", compact ? "py-0 pl-2 pr-0" : "p-3")}>
      <Card
        className={cn(
          "flex h-full min-h-0 flex-col gap-0 py-2",
          compact && "border-0 bg-transparent shadow-none",
        )}
      >
        <CardHeader className="border-b px-2 py-0 [.border-b]:pb-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Layers2Icon className="h-4 w-4 text-primary" />
              <CardTitle className="text-[16px] font-semibold">Analytical Datasets</CardTitle>
              <Badge variant="secondary" className="h-5 rounded-full px-2 text-[11px] font-semibold">
                {totalCount}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-56 sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search datasets..."
                  className="!h-8 pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="primary"
                size="icon"
                className="!h-8 !w-8 !px-2"
                onClick={handleRefresh}
                disabled={isLoading}
                title="Refresh datasets"
              >
                <RefreshCw className={cn("!h-5 !w-4", isLoading && "animate-spin")} />
              </Button>
              {!isViewOnly ? (
              <Button
                type="button"
                variant="default"
                className="!h-8 gap-1 px-3"
                onClick={handleCreateDataset}
              >
                <Plus className="h-4 w-4" />
                Create
              </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>

        <CardContent className="min-h-0 flex-1 overflow-y-auto rounded-lg bg-muted/100 p-2.5">
          {isLoading ? (
            <div className="flex min-h-[40vh] items-center justify-center py-12">
              <DatasetStepLoading message="Loading datasets..." size="lg" />
            </div>
          ) : datasets.length === 0 ? (
            <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/10 px-6 py-10 text-center">
              <p className="text-sm font-medium text-foreground">No datasets found</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {embedded
                  ? "No analytical datasets match your search."
                  : "Create one to get started."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {datasets.map((dataset) => (
                <DatasetCard
                  key={dataset.id}
                  dataset={dataset}
                  iconFile={getIconFileForDataset(dataset)}
                  embedded={embedded}
                  selected={selectedDatasetId != null && dataset.id === selectedDatasetId}
                  onSelect={embedded && onDatasetSelect ? () => onDatasetSelect(dataset) : undefined}
                  onEdit={
                    embedded ? undefined : () => navigate(`/datasets/${dataset.id}/edit`)
                  }
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
