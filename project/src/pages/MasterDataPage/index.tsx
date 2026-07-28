import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react"; // Added useRef
import {
  createMasterDataFile,
  deleteMasterDataFiles,
  downloadMasterDataFile,
  fetchMasterDataUploadFormSchema,
  getMasterDataFileById,
  getMasterDataFiles,
  updateMasterDataFile,
} from "@/controllers/API/filesApi";
import {
  getDisplayErrorMessage,
  isApiResponseSuccess,
  resolveApiErrorMessage,
} from "@/utils/exceptionHelper";
import { normalizeMasterDataFilesData } from "@/controllers/API/filesApi";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import MasterDataHeader from "./MasterDataHeader";
import TableView from "./TableView";
import CardView from "./CardView";
import UploadDialog from "./UploadDialog";
import FileMetadataForm from "./FileMetadataForm";
import {
  FormFieldConfig,
  ApiFormField,
  FileType,
  ViewMode,
  FileAction,
  FileUploadApiResponse,
  SheetNameApiContext,
} from "./types";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/auth/authContext";
import ViewDataSheetContent from "./ViewDataSheet";
import { useMasterDataStore } from './constants'; // Adjust path if needed


const transformApiFormFieldToConfig = (
  apiField: ApiFormField
): FormFieldConfig => {
  let type: "text" | "dropdown" | "textArea" = "text";
  const apiType = String(apiField.type || "").toLowerCase();

  if (apiType === "textarea" || apiType === "text_area") {
    type = "textArea";
  } else if (
    apiType === "dropdown" ||
    apiType === "select" ||
    apiType === "selection"
  ) {
    type = "dropdown";
  } else {
    type = "text";
  }

  return {
    name: apiField.name,
    type,
    displayName: apiField.display_name,
    placeholder: apiField.placeholder || "",
    required: !!apiField.required,
    options: apiField.options || [],
    depends_key: apiField.depend_keys?.[0],
    depends_value: apiField.depends_values,
    info: apiField.info,
    show: apiField.show !== false,
    klass: apiField.klass,
    params: apiField.params,
  };
};

export default function MasterDataUploadPage() {
  const { state: authState } = useAuth();
  const restrictions: any =
    authState?.authInfo?.user?.permissions?.find(
      (data) => data?.menu_id === "master-data"
    ) || {};
  const subMenuRestrictions =
    restrictions?.sub_menu?.find(
      (data) => data?.sub_menu_id === "view-master-data-file-options"
    ) || {};

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [filesData, setFilesData] = useState<FileType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedFileIds, setSelectedFileIds] = useState<Set<number>>(
    new Set()
  );

  // const [isUploadDialogOpen, setIsUploadDialogOpen] = useState<boolean>(false);

  const [editingFile, setEditingFile] = useState<FileType | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false);
  const { isUploadDialogOpen, openUploadDialog, closeUploadDialog } = useMasterDataStore();

  const [editFormSchema, setEditFormSchema] = useState<
    FormFieldConfig[] | null
  >(null); // Memoized in useEffect

  const [viewingFile, setViewingFile] = useState<FileType | null>(null);
  const [isViewSheetOpen, setIsViewSheetOpen] = useState<boolean>(false);

  const [fileToDelete, setFileToDelete] = useState<FileType | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchFiles = useCallback(async () => {
    if (isMountedRef.current) setIsLoading(true);
    try {
      const response = await getMasterDataFiles();
      if (isMountedRef.current && Array.isArray(response.data)) {
        const sortedFiles = (response.data as FileType[]).sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
        setFilesData(sortedFiles);
      } else if (isMountedRef.current) {
        toast.error("Received invalid data format for files.");
        setFilesData([]);
      }
    } catch (error) {
      console.error("Error fetching files:", error);
      if (isMountedRef.current) {
        toast.error(getDisplayErrorMessage(error, "Failed to fetch files."));
        setFilesData([]);
      }
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  useEffect(() => {
    setCurrentPage(0);
  }, [searchTerm]);

  useEffect(() => {
    const fetchEditFormSchemaInternal = async () => {
      if (editFormSchema) return; // Already fetched
      try {
        const rawSchema = (await fetchMasterDataUploadFormSchema()) as ApiFormField[];
        if (isMountedRef.current) {
          const transformed = rawSchema.map(transformApiFormFieldToConfig);
          setEditFormSchema(transformed);
        }
      } catch (error) {
        if (isMountedRef.current) {
          toast.error(getDisplayErrorMessage(error, "Error fetching form schema for editing."));
        }
      }
    };
    fetchEditFormSchemaInternal();
  }, [editFormSchema,editingFile]);

  const filteredFiles = useMemo(() => {
    if (!searchTerm.trim()) return filesData;
    const searchLower = searchTerm.toLowerCase();
    return filesData.filter(
      (file) =>
        (file.file_name?.toLowerCase() || "").includes(searchLower) ||
        (file.display_name?.toLowerCase() || "").includes(searchLower)
    );
  }, [filesData, searchTerm]);

  const displayFiles = useMemo(() => {
    const start = currentPage * pageSize;
    return filteredFiles.slice(start, start + pageSize);
  }, [filteredFiles, currentPage, pageSize]);

  const allSelected =
    filteredFiles.length > 0 &&
    filteredFiles.every((file) => selectedFileIds.has(file.id));
  const someSelected =
    filteredFiles.some((file) => selectedFileIds.has(file.id)) && !allSelected;

  const handleSelectionChange = useCallback(
    (fileId: number, isSelected: boolean) => {
      setSelectedFileIds((prev) => {
        const newSelection = new Set(prev);
        if (isSelected) newSelection.add(fileId);
        else newSelection.delete(fileId);
        return newSelection;
      });
    },
    []
  );

  const handleSelectAll = useCallback(
    (isSelected: boolean) => {
      setSelectedFileIds(
        isSelected ? new Set(filteredFiles.map((file) => file.id)) : new Set()
      );
    },
    [filteredFiles]
  );

  const handleUploadProcessComplete = useCallback(
    async (data: {
      uploadResponse: FileUploadApiResponse;
      metadata: Record<string, any>;
    }) => {
      const { uploadResponse, metadata } = data;
      const payload = {
        file_name: uploadResponse.file_name,
        display_name: metadata.display_name,
        encrypted_file_key: uploadResponse.encrypted_file_key,
        unique_id: uploadResponse.unique_id,
        size: uploadResponse.size,
        sheet_name: metadata.sheet_name || "",
        delimiter: metadata.delimiter || "",
        file_type: metadata.file_type,
        file_category: metadata.file_category,
        comments: metadata.comments || "",
        created_by: "",
        updated_by: "",
      };

      try {
        await createMasterDataFile(payload);
        if (isMountedRef.current) {
          toast.success(`File "${payload.display_name}" created successfully!`);
          fetchFiles();
          closeUploadDialog();
        }
      } catch (error) {
        console.error("Error creating file:", error);
        if (isMountedRef.current) {
          toast.error(
            getDisplayErrorMessage(error, `Failed to create file "${payload.display_name}".`),
          );
        }
      }
    },
    [fetchFiles, closeUploadDialog]
  ); // fetchFiles is stable

  const handleUpdateSubmit = useCallback(
    async (formDataFromForm: Record<string, any>) => {
      if (!editingFile) {
        toast.error("No file selected for editing.");
        return;
      }

      console.log(
        "MasterDataUploadPage - Form data received:",
        formDataFromForm
      );

      const payload = {
        file_id: String(editingFile.id),
        file_name: formDataFromForm.file_name,
        display_name: formDataFromForm.display_name,
        encrypted_file_key: editingFile.encrypted_file_key,
        unique_id: editingFile.unique_id,
        size: editingFile.size,
        sheet_name: formDataFromForm.sheet_name || "",
        delimiter: formDataFromForm.delimiter || "",
        // Map load_type from form back to file_type for API
        file_type: formDataFromForm.file_type,
        file_category: formDataFromForm.file_category,
        comments: formDataFromForm.comments || "",
        created_by: editingFile.created_by,
        updated_by: "",
      };

      console.log("MasterDataUploadPage - Payload to send:", payload);

      try {
        await updateMasterDataFile(payload);
        if (isMountedRef.current) {
          toast.success(`File "${payload.display_name}" updated successfully!`);
          fetchFiles();
          setIsEditDialogOpen(false);
          setEditingFile(null);
        }
      } catch (error) {
        console.error("Error updating file:", error);
        if (isMountedRef.current) {
          toast.error(getDisplayErrorMessage(error, "Failed to update file."));
        }
      }
    },
    [editingFile, fetchFiles]
  );

  const handleDownloadFile = useCallback(async (file: FileType) => {
    if (!isMountedRef.current) return;
    toast.info(`Preparing download for ${file.file_name}...`);
    try {
      const fileUrl = await downloadMasterDataFile(file.id);
      if (!isMountedRef.current) return;
      const urlParams = new URLSearchParams(fileUrl.split("?")[1]);
      const filePath = urlParams.get("file_path");
      const downloadFileName = filePath?.split("/").pop() || file.file_name;
      const link = document.createElement("a");
      link.href = fileUrl;
      link.download = downloadFileName;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`File "${downloadFileName}" downloaded successfully.`);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (isMountedRef.current) {
        toast.error(getDisplayErrorMessage(error, "Failed to download file."));
      }
    }
  }, []);
  const handleDeleteFile = useCallback(async () => {
    if (!fileToDelete || !isMountedRef.current) return;
    try {
      // Body: { "unique_id": ["168"] } — key is unique_id; values are file id as strings
      await deleteMasterDataFiles([fileToDelete.id]);
      if (isMountedRef.current) {
        toast.success(
          `File "${fileToDelete.display_name || fileToDelete.file_name
          }" deleted successfully.`
        );
        fetchFiles();
        setSelectedFileIds((prev) => {
          const newSelection = new Set(prev);
          newSelection.delete(fileToDelete.id);
          return newSelection;
        });
      }
    } catch (error) {
      console.error("Error deleting file:", error);
      if (isMountedRef.current) {
        toast.error(getDisplayErrorMessage(error, "Failed to delete file."));
      }
    } finally {
      if (isMountedRef.current) {
        setIsDeleteDialogOpen(false);
        setFileToDelete(null);
      }
    }
  }, [fileToDelete, fetchFiles]);

  const handleFileAction = useCallback(
    async (actionType: FileAction, file: FileType) => {
      console.log(
        `Action: ${actionType}, File ID: ${file.id}, Unique ID: ${file.id}`
      );
      if (actionType === "delete") {
        setFileToDelete(file);
        setIsDeleteDialogOpen(true);
      } else if (actionType === "download") {
        handleDownloadFile(file);
      } else if (actionType === "view") {
        setViewingFile(file);
        setIsViewSheetOpen(true);
      } else if (actionType === "edit") {
        try {
          setEditFormSchema(null); // Clear schema to refetch with potential context of the file
          const fileDetails = await getMasterDataFileById<FileType>(file.id);
          if (isMountedRef.current && fileDetails) {
            setEditingFile(fileDetails);
            setIsEditDialogOpen(true);
          } else if (isMountedRef.current) {
            toast.error("Could not load file details for editing.");
          }
        } catch (error) {
          console.error("Error fetching file details for edit:", error);
          if (isMountedRef.current) {
            toast.error(getDisplayErrorMessage(error, "Failed to load file details for editing."));
          }
        }
      }
    },
    [handleDownloadFile]
  );

  const handleUploadClick = useCallback(() => openUploadDialog(), [openUploadDialog]);

  const handleRefreshClick = useCallback(() => {
    setSearchTerm("");
    setCurrentPage(0);
    setPageSize(10);
    fetchFiles();
    setSelectedFileIds(new Set());
    toast.info("File list refreshed.");
  }, [fetchFiles]);

  const handleGlobalDownloadClick = useCallback(async () => {
    if (selectedFileIds.size === 0) {
      toast.info("No files selected for download.");
      return;
    }
    toast.info(
      `Starting download for ${selectedFileIds.size} selected files...`
    );
    for (const id of selectedFileIds) {
      if (!isMountedRef.current) break; // Check if component unmounted during loop
      const fileToDownload = filesData.find((f) => f.id === id);
      if (fileToDownload) {
        await handleDownloadFile(fileToDownload);
      }
    }
  }, [selectedFileIds, filesData, handleDownloadFile]); // filesData changes, handleDownloadFile is stable

  const handleGlobalDeleteClick = useCallback(async () => {
    if (selectedFileIds.size === 0) {
      toast.info("No files selected for deletion.");
      return;
    }
    let successCount = 0;
    let errorCount = 0;
    toast.info(
      `Attempting to delete ${selectedFileIds.size} selected files...`
    );

    for (const id of selectedFileIds) {
      if (!isMountedRef.current) break;
      const file = filesData.find((f) => f.id === id);
      if (file) {
        try {
          await deleteMasterDataFiles([file.id]);
          successCount++;
        } catch (error) {
          console.error(`Error deleting file ${file.file_name}:`, error);
          errorCount++;
        }
      }
    }
    if (!isMountedRef.current) return;

    if (successCount > 0)
      toast.success(`${successCount} file(s) deleted successfully.`);
    if (errorCount > 0)
      toast.error(`${errorCount} file(s) could not be deleted.`);

    fetchFiles();
    setSelectedFileIds(new Set());
  }, [selectedFileIds, filesData, fetchFiles]);

  const initialEditFormData = useMemo(() => {
    if (!editingFile) return undefined;

    console.log("MasterDataUploadPage - editingFile from API:", editingFile);

    // Simply pass the entire API response - let the form handle mapping
    return editingFile;
  }, [editingFile]);

  const editFileContextForSheetApi = useMemo(():
    | SheetNameApiContext
    | undefined => {
    if (!editingFile) return undefined;
    return {
      unique_id: editingFile.unique_id,
      encrypted_file_key: editingFile.encrypted_file_key,
      file_name: editingFile.file_name,
    };
  }, [editingFile]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <Card className="flex h-full min-h-0 flex-col gap-0 border-border/70 p-0 shadow-sm">
        <div className="shrink-0 border-b border-border/60 px-2 py-1.5 [.border-b]:pb-1">
          <MasterDataHeader
            viewMode={viewMode}
            setViewMode={setViewMode}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            onUploadClick={handleUploadClick}
            onRefreshClick={handleRefreshClick}
            onGlobalDownloadClick={handleGlobalDownloadClick}
            onGlobalDeleteClick={handleGlobalDeleteClick}
            canGlobalDownload={selectedFileIds.size > 0}
            canGlobalDelete={selectedFileIds.size > 0}
            isLoading={isLoading}
            restrictions={restrictions}
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col p-2 md:p-2">
          {viewMode === "list" ? (
            <TableView
              files={displayFiles}
              totalRows={filteredFiles.length}
              currentPage={currentPage}
              pageSize={pageSize}
              loading={isLoading}
              onPaginationChange={(page, limit) => {
                setCurrentPage(page);
                setPageSize(limit);
              }}
              selectedFileIds={selectedFileIds}
              allSelected={allSelected}
              someSelected={someSelected}
              onSelectionChange={handleSelectionChange}
              onSelectAll={handleSelectAll}
              onAction={handleFileAction}
              subMenuRestrictions={subMenuRestrictions}
            />
          ) : isLoading ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm font-medium text-foreground">Loading master data…</p>
              <p className="text-xs text-muted-foreground">Fetching your files</p>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <CardView
                files={filteredFiles}
                selectedFileIds={selectedFileIds}
                onSelectionChange={handleSelectionChange}
                onAction={handleFileAction}
                subMenuRestrictions={subMenuRestrictions}
              />
            </div>
          )}
        </div>

        <UploadDialog
          isOpen={isUploadDialogOpen}
          onClose={closeUploadDialog}
          onUploadProcessComplete={handleUploadProcessComplete}
        />

        {/* Edit Dialog */}
        {editingFile && isEditDialogOpen && editFormSchema && (
          <Dialog
            open={isEditDialogOpen}
            onOpenChange={(open) => {
              if (!open) {
                setEditingFile(null);
                setIsEditDialogOpen(false);
              }
            }}
          >
            <DialogContent className="sm:max-w-md md:max-w-2xl lg:max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  Edit File Metadata:{" "}
                  {editingFile.display_name || editingFile.file_name}
                </DialogTitle>
                <DialogDescription>
                  Update the metadata for your file.
                </DialogDescription>
              </DialogHeader>
              <FileMetadataForm
                formFieldsConfig={editFormSchema} // This should be stable
                initialDataForEdit={initialEditFormData} // Memoized
                fileContextForSheetNameApi={editFileContextForSheetApi} // Memoized
                onSubmit={handleUpdateSubmit} // Callback
                onCancel={() => {
                  setIsEditDialogOpen(false);
                  setEditingFile(null);
                }}
              />
            </DialogContent>
          </Dialog>
        )}

        <Sheet open={isViewSheetOpen} onOpenChange={setIsViewSheetOpen}>
          <SheetContent className="w-full sm:max-w-[85%] p-0">
            <SheetHeader className="p-4 border-b">
              <SheetTitle>
                View File: {viewingFile?.display_name || viewingFile?.file_name}
              </SheetTitle>
              <SheetDescription>
                Displaying content for {viewingFile?.file_name}.
              </SheetDescription>
            </SheetHeader>
            <ViewDataSheetContent file={viewingFile} />
          </SheetContent>
        </Sheet>
        {fileToDelete && (
          <Dialog
            open={isDeleteDialogOpen}
            onOpenChange={(open) => {
              if (!open) {
                setFileToDelete(null);
                setIsDeleteDialogOpen(false);
              }
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Deletion</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete the file "
                  {fileToDelete.display_name || fileToDelete.file_name}"? This
                  action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:justify-end pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsDeleteDialogOpen(false);
                    setFileToDelete(null);
                  }}
                >
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDeleteFile}>
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </Card>
    </div>
  );
}
