// src/pages/DataSetPage/DatasetList/index.tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Layers2Icon, MoreHorizontal, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Dataset } from '@/types/dataset';
import { toast } from 'sonner';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import { ForwardedIconComponent } from '@/components/common/genericIconComponent';
import { format } from 'date-fns';
import { getAllDatasets, deleteDataset } from '@/controllers/API/datasetApi';
import { getMasterDataFiles } from '@/controllers/API/filesApi';
import { Skeleton } from '@/components/ui/skeleton';
// import EditDatasetDialog from '@/components/common/datasets/EditDatasetDialog';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useRbacStore } from '@/stores/useRBACStore';
import { cn } from '@/lib/utils';

// Component to handle icon rendering for datasets
function DatasetIcon({ dataset, iconFile }: { dataset: Dataset; iconFile?: any }) {
 const API_BASE_URL = '/user-uploads/';

  // Construct direct server path from file_name, unique_id and base path
  const fileName = iconFile?.file_name || dataset.node?.payload?.file_name || dataset.payload?.file_name;
  const uniqueId = iconFile?.value || iconFile?.unique_id || dataset.node?.payload?.icon_unique_id || dataset.payload?.icon_unique_id || dataset.node?.payload?.unique_id || dataset.payload?.unique_id;
  const imageUrl = 
    fileName && uniqueId 
      ? `${API_BASE_URL}${uniqueId}/${fileName}` 
      : null;
console.log(imageUrl, 'imageUrl');
  if (imageUrl) {
    return <img src={imageUrl} alt={fileName || "icon"} className="h-5 w-5 object-contain" />;
  }

  // Fallback to default icon
  return <ForwardedIconComponent name={dataset.type} className="h-5 w-5 text-muted-foreground" />;
}

const DatasetList = () => {
  const navigate = useNavigate();

  // State management
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [idsToDelete, setIdsToDelete] = useState<Set<number>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // RBAC permissions
  const { hasPermission, menu_items } = useRbacStore();
  const datasetConfig: any = menu_items.find(item => item.p_id === 'datasets');
  const permissionsMap: any = new Map(datasetConfig?.permissions.map((p: any) => [p.action, p]));
  const hasEditPermission = hasPermission(permissionsMap.get('view')?.action || '', datasetConfig?.p_id || '');
  const hasDeletePermission = hasPermission(permissionsMap.get('delete')?.action || '', datasetConfig?.p_id || '');

  // Debounce search term
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Helper to find icon file for a dataset
  const getIconFileForDataset = useCallback((dataset: Dataset) => {
    const uniqueId = dataset.node?.payload?.icon_unique_id || dataset.payload?.icon_unique_id || dataset.node?.payload?.unique_id || dataset.payload?.unique_id;
    const encryptedKey = dataset.node?.payload?.icon_encrypted_file_key || dataset.payload?.icon_encrypted_file_key || dataset.node?.payload?.encrypted_file_key || dataset.payload?.encrypted_file_key;

    return files.find((file: any) =>
      (uniqueId && (file.unique_id === uniqueId || file.value === uniqueId)) ||
      (encryptedKey && file.encrypted_file_key === encryptedKey)
    );
  }, [files]);

  // Fetch datasets and files
  const fetchDatasets = useCallback(async (searchText: string = debouncedSearchTerm) => {
    setIsLoading(true);
    setSelectedRows(new Set());
    try {
      // Fetch both datasets and files in parallel
      const [datasetsResponse, filesResponse] = await Promise.all([
        getAllDatasets({
          search_text: searchText,
          sort: { created_at: "desc" }, // Default sort: newest first
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
          file_category: "dataset_icon"
        }),
      ]);

      setDatasets(datasetsResponse?.data || []);
      setFiles(filesResponse?.data || []);
      setTotalCount(datasetsResponse?.total || datasetsResponse?.data?.length || 0);
    } catch (error) {
      toast.error(getDisplayErrorMessage(error, 'Failed to fetch datasets.'));
      setDatasets([]);
      setFiles([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearchTerm]);

  // Fetch on search term change
  useEffect(() => {
    void fetchDatasets(debouncedSearchTerm);
  }, [debouncedSearchTerm, fetchDatasets]);

  // Handle refresh — clear search and reload full list
  const handleRefresh = () => {
    setSearchTerm("");
    if (debouncedSearchTerm !== "") {
      setDebouncedSearchTerm("");
    } else {
      void fetchDatasets("");
    }
    toast.success("Datasets refreshed successfully");
  };

  // Handle select all
  const handleSelectAll = (checked: boolean | 'indeterminate') => {
    if (checked === true) {
      setSelectedRows(new Set(datasets.map(d => d.id)));
    } else {
      setSelectedRows(new Set());
    }
  };

  // Handle select row
  const handleSelectRow = (id: number) => {
    const newSelectedRows = new Set(selectedRows);
    if (newSelectedRows.has(id)) {
      newSelectedRows.delete(id);
    } else {
      newSelectedRows.add(id);
    }
    setSelectedRows(newSelectedRows);
  };

  // Step 1: Initiate the delete process by opening the dialog
  const initiateDelete = (ids: Set<number>) => {
    if (ids.size === 0) return;
    setIdsToDelete(ids);
    setShowDeleteDialog(true);
  };

  // Step 2: Handle the actual deletion after confirmation
  const handleConfirmDelete = async () => {
    if (idsToDelete.size === 0) return;
    const deletePromises = Array.from(idsToDelete).map(id => deleteDataset(id));
    try {
      await Promise.all(deletePromises);
      toast.success(`${idsToDelete.size} dataset(s) deleted successfully.`);
      fetchDatasets(); // Refresh list
    } catch (error) {
      toast.error(getDisplayErrorMessage(error, 'Failed to delete dataset(s).'));
    } finally {
      // Step 3: Close the dialog and reset state
      setShowDeleteDialog(false);
      setIdsToDelete(new Set());
    }
  };

  // Step 3: Handle cancellation
  const handleCancelDelete = () => {
    setShowDeleteDialog(false);
    setIdsToDelete(new Set());
  };


  // const handleEditSuccess = () => {
  //     setEditingDatasetId(null);
  //     fetchDatasets(searchTerm);
  // };

  const isAllSelected = datasets.length > 0 && selectedRows.size === datasets.length;
  const isIndeterminate = selectedRows.size > 0 && !isAllSelected;
  const hasSelectedRows = selectedRows.size > 0;
  const isDeleteDisabled = !hasSelectedRows || isLoading;

  const getDeleteDialogDescription = () => {
    if (idsToDelete.size === 1) {
      const singleDataset = datasets.find(d => d.id === Array.from(idsToDelete)[0]);
      return <>Are you sure you want to delete the dataset <strong>"{singleDataset?.name}"</strong>? This action cannot be undone.</>;
    }
    return `Are you sure you want to delete ${idsToDelete.size} selected datasets? This action cannot be undone.`;
  };

  return (
    <Card className="w-full h-full flex flex-col py-2">
      <CardHeader className="border-b px-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Layers2Icon className="h-4 w-4 text-primary" />
            <CardTitle className="text-[16px] font-semibold">Datasets</CardTitle>
            <span className="text-sm font-semibold text-muted-foreground">({totalCount})</span>

          </div>
          <div className="flex items-center space-x-2">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search datasets..."
                className="pl-9 !h-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                

                {/* 🗑 Delete */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className={cn("inline-flex", isDeleteDisabled && "cursor-not-allowed")}
                      tabIndex={isDeleteDisabled ? 0 : undefined}
                    >
                      <Button
                        variant="outline"
                        size="icon"
                        className={cn(
                          "h-8 w-8",
                          isDeleteDisabled && "pointer-events-none opacity-50"
                        )}
                        disabled={isDeleteDisabled}
                        aria-disabled={isDeleteDisabled}
                        onClick={() => {
                          if (hasSelectedRows) initiateDelete(selectedRows);
                        }}
                      >
                        <Trash2
                          className={cn(
                            "h-4 w-4",
                            hasSelectedRows ? "text-red-600" : "text-muted-foreground"
                          )}
                        />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {hasSelectedRows
                        ? `Delete ${selectedRows.size} selected`
                        : "Select datasets to delete"}
                    </p>
                  </TooltipContent>
                </Tooltip>
                {/*  Refresh */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="primary"
                      size="icon"
                      className="!px-2"
                      onClick={handleRefresh}
                      disabled={isLoading}
                    >
                      <RefreshCw className={`!h-5 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Refresh</p>
                  </TooltipContent>
                </Tooltip>

                {/* ➕ Create */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => navigate('/datasets/create')}
                      variant="default"
                      className="!h-7.5 px-3 flex items-center gap-1"
                    >
                      <Plus className="h-4 w-4" />
                      <span className="text-sm">Create</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Create Dataset</p>
                  </TooltipContent>
                </Tooltip>
             
              </TooltipProvider>
            </div>

          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-grow overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="w-[50px] px-4 h-8">
                <Checkbox
                  checked={isAllSelected ? true : isIndeterminate ? 'indeterminate' : false}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead className="h-8">Name</TableHead>
              <TableHead className="h-8">Type</TableHead>
              <TableHead className="h-8">Group</TableHead>
              <TableHead className="h-8">Last Modified</TableHead>
              <TableHead className="w-[50px] text-right pr-4 h-8">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="px-4 py-1"><Skeleton className="h-5 w-5" /></TableCell>
                  <TableCell className="py-1"><Skeleton className="h-7 w-24 rounded-md" /></TableCell>
                  <TableCell className="py-1"><Skeleton className="h-7 w-20 rounded-md" /></TableCell>
                  <TableCell className="py-1"><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell className="text-right pr-4 py-1"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : datasets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No datasets found. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              datasets.map((dataset) => (
                <TableRow key={dataset.id} data-state={selectedRows.has(dataset.id) && 'selected'}>
                  <TableCell className="h-10 px-4 py-1 text-xs">
                    <Checkbox checked={selectedRows.has(dataset.id)} onCheckedChange={() => handleSelectRow(dataset.id)} />
                  </TableCell>
                  <TableCell className="font-medium py-1 text-xs">{dataset.name}</TableCell>
                  <TableCell className="py-1 text-xs">
                    <div className="flex items-center gap-2">
                      <DatasetIcon dataset={dataset} iconFile={getIconFileForDataset(dataset)} />
                      <div className="flex flex-col">
                        <span className="capitalize text-xs">
                          {getIconFileForDataset(dataset)?.file_name || dataset.type}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-1  text-xs">
                    <Badge variant="outline">{dataset.group}</Badge>
                  </TableCell>
                  <TableCell className="text-foreground py-1 text-xs font-medium">{format(new Date(dataset.updated_at), 'dd MMM yyyy')}</TableCell>
                  <TableCell className="text-right px-4 py-1 text-xs">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Toggle menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/datasets/${dataset.id}/edit`)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                          {/* {permissionsMap?.get('view')?.action} */}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600 focus:text-red-600 focus:bg-red-100" onClick={() => initiateDelete(new Set([dataset.id]))}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                          {/* {permissionsMap?.get('delete')?.action} */}
                        </DropdownMenuItem>
                        {/* {
                            hasEditPermission && (

                            )
                          } */}
                        {/* {
                            hasDeletePermission && (
                            
                            )
                          } */}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
      {/* {editingDatasetId && (  
        <EditDatasetDialog 
          datasetId={editingDatasetId} 
          onClose={() => setEditingDatasetId(null)}
          onSuccess={handleEditSuccess}
        />
      )} */}

      <Dialog open={showDeleteDialog} onOpenChange={(open) => !open && handleCancelDelete()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              {getDeleteDialogDescription()}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end pt-2">
            <Button variant="outline" onClick={handleCancelDelete}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </Button>

          </DialogFooter>
        </DialogContent>
      </Dialog>


    </Card>
  );

};

export default DatasetList;
