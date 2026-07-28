import { useState, useEffect, useRef } from "react"
import React from "react";
import {
  fetchMasterDataUploadFormSchema,
  uploadMasterDataFile,
} from "@/controllers/API/filesApi";
import { getDisplayErrorMessage } from "@/utils/exceptionHelper";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { UploadCloud, Loader2, X, Check, FileText } from "lucide-react";
import { motion } from "framer-motion";
import clsx from "clsx";
import type {
  FormFieldConfig,
  FileUploadApiResponse,
  ApiFormField,
} from "../types";
import FileMetadataForm from "../FileMetadataForm";

console.log("Enhanced UploadDialog component loaded - V2 with API changes");

interface UploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  // Passes structured data for the parent to make the /api/files/create-file call
  onUploadProcessComplete: (data: {
    uploadResponse: FileUploadApiResponse;
    metadata: Record<string, any>;
  }) => void;
}

const transformApiFormField = (apiField: ApiFormField): FormFieldConfig => {
  let type: "text" | "dropdown" | "textArea" = "text";
  const apiType = String(apiField.type || "").toLowerCase();
  
  if (apiType === "textarea" || apiType === "text_area") {
    type = "textArea";
  } else if (apiType === "dropdown" || apiType === "select" || apiType === "selection") {
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
    show: apiField.show !== false, // Default to true unless explicitly false
    klass: apiField.klass,
    params: apiField.params,
  };
};

export default function UploadDialog({
  isOpen,
  onClose,
  onUploadProcessComplete,
}: UploadDialogProps) {

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [fileUploadData, setFileUploadData] =
    useState<FileUploadApiResponse | null>(null); // Typed response
  const [dynamicFormSchema, setDynamicFormSchema] = useState<
    FormFieldConfig[] | null
  >(null);
  const [isFetchingFormSchema, setIsFetchingFormSchema] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const dialogMountedRef = useRef(true);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    dialogMountedRef.current = true;
    return () => {
      dialogMountedRef.current = false;
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      if (dialogMountedRef.current) {
        setSelectedFile(null);
        setIsDragging(false);
        setIsUploading(false);
        setUploadProgress(0);
        setUploadComplete(false);
        setErrorMessage(null);
        setFileUploadData(null); // Changed from fileUploadResponse
        setDynamicFormSchema(null);
        setIsFetchingFormSchema(false);
        setShowForm(false);
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }
  }, [isOpen]);

  const resetToFileUploadView = () => {
    if (dialogMountedRef.current) {
      // Keep selectedFile and fileUploadData if user just goes "back"
      // setSelectedFile(null); 
      // setFileUploadData(null);
      setDynamicFormSchema(null);
      setIsFetchingFormSchema(false);
      setShowForm(false);
      setErrorMessage(null);
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); if (!isDragging) setIsDragging(true);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleFileSelection = (file: File) => {
    const acceptedTypes = [".csv", ".xlsx", ".xls", ".txt", "text/plain", "text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
    const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();
    const isValidType = acceptedTypes.some(type => type.startsWith(".") ? fileExtension === type : file.type === type);

    if (!isValidType) {
      setErrorMessage("Invalid file type. Supports: Excel (xlsx, xls), CSV, Text (txt).");
      setSelectedFile(null); return;
    }
    setSelectedFile(file);
    setErrorMessage(null);
    setUploadComplete(false);
    setUploadProgress(0);
    setFileUploadData(null); // Reset previous upload data
    setShowForm(false); // Hide form if a new file is selected
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setErrorMessage(null);
    setUploadComplete(false);
    setUploadProgress(0);
    setFileUploadData(null);
    setShowForm(false); // Hide form
    setDynamicFormSchema(null); // Clear schema
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setErrorMessage("Please select a file first."); return;
    }
    setIsUploading(true); setErrorMessage(null); setUploadProgress(0); setUploadComplete(false);

    const formData = new FormData();
    formData.append("upload_file", selectedFile);

    progressIntervalRef.current = setInterval(() => {
      if (!dialogMountedRef.current) {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        return;
      }
      setUploadProgress(prev => Math.min(prev + 10, 90)); // Simulate up to 90%
    }, 200);

    try {
      const uploadData = await uploadMasterDataFile(formData, (progressEvent) => {
        if (progressEvent.total && dialogMountedRef.current) {
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
          }
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      });

      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      if (!dialogMountedRef.current) return;
      setUploadProgress(100);

      if (uploadData?.unique_id) {
        setFileUploadData(uploadData as FileUploadApiResponse);
        setUploadComplete(true);
        toast.success(uploadData.message || "File uploaded successfully!");
        
        // Switch to form view immediately so user sees the loading state of the form schema
        if (dialogMountedRef.current) setShowForm(true);
        
        await fetchFormSchema();
      } else {
        throw new Error(uploadData?.message || "Upload failed: Invalid server response.");
      }
    } catch (error) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (!dialogMountedRef.current) return;
      console.error("Upload error:", error);
      const message = getDisplayErrorMessage(error, "Upload failed. Please try again.");
      setErrorMessage(message); toast.error(message);
      setUploadComplete(false); setUploadProgress(0);
    } finally {
      if (dialogMountedRef.current) setIsUploading(false);
    }
  };

  const fetchFormSchema = async () => {
    if (!dialogMountedRef.current) return;
    setIsFetchingFormSchema(true); setErrorMessage(null);
    try {
      const rawSchema = (await fetchMasterDataUploadFormSchema()) as ApiFormField[];
      if (!dialogMountedRef.current) return;

      const transformedFields = rawSchema.map(transformApiFormField);
      setDynamicFormSchema(transformedFields);
    } catch (error) {
      if (!dialogMountedRef.current) return;
      console.error("Form schema error:", error);
      const fetchFormErrorMessage = getDisplayErrorMessage(
        error,
        "Failed to load form. Please try again.",
      );
      setErrorMessage(fetchFormErrorMessage); toast.error(fetchFormErrorMessage);
      setShowForm(false);
    } finally {
      if (dialogMountedRef.current) setIsFetchingFormSchema(false);
    }
  };

  const handleMetadataFormSubmit = (formDataFromForm: Record<string, any>) => {
    if (!fileUploadData || !selectedFile) {
      const errorMsg = "File upload data is missing. Please re-upload.";
      setErrorMessage(errorMsg); toast.error(errorMsg);
      setShowForm(false);
      return;
    }
    onUploadProcessComplete({
      uploadResponse: fileUploadData,
      metadata: formDataFromForm,
    });
    onClose();
  };

  const getDialogTitle = () => showForm ? "File Metadata" : "Upload File";
  const getDialogDescription = () => showForm ? "Enter metadata details for your file." : "Select and upload your file.";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="sm:max-w-md md:max-w-xl lg:max-w-2xl max-h-[90vh] overflow-y-auto p-4"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <DialogHeader className="pb-2">
          <DialogTitle>Master Data Upload: {getDialogTitle()}</DialogTitle>
          <DialogDescription>{getDialogDescription()}</DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-md my-2 text-sm">
            {errorMessage}
          </div>
        )}

        <div className="space-y-3 py-2 min-h-[300px]">
          {!showForm && (
            <div>
              {!selectedFile ? (
                // Dropzone UI
                <div
                  className="relative group border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-xl p-6 sm:p-10 text-center cursor-pointer hover:border-blue-500 transition-colors duration-300"
                  onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}
                  onClick={() => document.getElementById("file-input-upload-dialog")?.click()}
                >
                  <input id="file-input-upload-dialog" type="file" onChange={handleFileInputChange} className="sr-only" accept=".csv,.xlsx,.xls,.txt,text/plain,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
                  <div className="flex flex-col items-center justify-center gap-4">
                    <motion.div className="relative">
                      <motion.div animate={{ opacity: isDragging ? [0.5, 1, 0.5] : 1, scale: isDragging ? [0.95, 1.05, 0.95] : 1 }} transition={{ duration: 2, repeat: isDragging ? Infinity : 0, ease: "easeInOut" }} className="absolute -inset-4 bg-blue-400/10 rounded-full blur-md" style={{ display: isDragging ? "block" : "none" }} />
                      <UploadCloud className={clsx("w-16 h-16 md:w-20 md:h-20 drop-shadow-sm", isDragging ? "text-blue-500" : "text-zinc-700 dark:text-zinc-300 group-hover:text-blue-500 transition-colors duration-300")} />
                    </motion.div>
                    <div className="space-y-2">
                      <h3 className="text-xl md:text-2xl font-semibold text-zinc-800 dark:text-zinc-100">{isDragging ? "Drop file here" : "Upload your file"}</h3>
                      <p className="text-zinc-600 dark:text-zinc-300 md:text-lg max-w-md mx-auto">{isDragging ? <span className="font-medium text-blue-500">Release to upload</span> : <>Drag & drop file here, or <span className="text-blue-500 font-medium">browse</span></>}</p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">Supports: Excel, CSV, Text</p>
                    </div>
                  </div>
                </div>
              ) : (
                // Selected File UI
                <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center", uploadComplete ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600")}>
                        {uploadComplete ? <Check className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-medium text-zinc-800 dark:text-zinc-100 truncate max-w-xs" title={selectedFile.name}>{selectedFile.name}</p>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    {!isUploading && (
                      <button onClick={handleRemoveFile} className="text-zinc-500 hover:text-red-500 transition-colors"> <X className="w-5 h-5" /> </button>
                    )}
                  </div>
                  {(isUploading || uploadProgress > 0) && !uploadComplete && (
                    <div className="mb-4">
                      <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all duration-300 ease-out" style={{ width: `${uploadProgress}%` }} />
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 text-right">{uploadProgress.toFixed(0)}%</p>
                    </div>
                  )}
                  {!uploadComplete && !isUploading && (
                    <Button onClick={handleUpload} className="w-full">Upload File</Button>
                  )}
                  {isUploading && (
                    <Button className="w-full" disabled>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...
                    </Button>
                  )}
                  {uploadComplete && !isUploading && !isFetchingFormSchema && !showForm && ( // File uploaded, but form not ready/failed
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300 p-2 rounded text-sm text-center">
                      File uploaded. Error loading metadata form. Message: {errorMessage || "Unknown error."} <Button variant="link" onClick={fetchFormSchema}>Retry Load Form</Button>
                    </div>
                  )}
                </div>
              )}
              <div className="flex justify-end mt-3">
                <Button variant="outline" onClick={onClose} disabled={isUploading}>Cancel</Button>
              </div>
            </div>
          )}

          {showForm && (
            <div>
              {isFetchingFormSchema ? (
                <div className="flex flex-col items-center justify-center h-full py-8"><Loader2 className="h-8 w-8 animate-spin text-primary mb-2" /><p>Loading form details...</p></div>
              ) : dynamicFormSchema && dynamicFormSchema.length > 0 && fileUploadData && selectedFile ? (
                <FileMetadataForm
                  formFieldsConfig={dynamicFormSchema}
                  // Pass context for sheet name API if needed, and initial data
                  fileContextForSheetNameApi={{
                    unique_id: fileUploadData.unique_id,
                    encrypted_file_key: fileUploadData.encrypted_file_key,
                    file_name: fileUploadData.file_name,
                  }}
                  uploadedOriginalFile={selectedFile} // For initial load_type detection
                  onSubmit={handleMetadataFormSubmit}
                  onCancel={onClose} // Or resetToFileUploadView if preferred for "Cancel" on form
                />
              ) : (
                !errorMessage && (
                  <div className="text-center py-10 space-y-4">
                    <p className="text-muted-foreground">Form configuration could not be loaded or is empty.</p>
                    <Button variant="outline" onClick={fetchFormSchema}>Retry Load Form</Button>
                    <p className="text-xs text-zinc-400">Please check if the file was uploaded correctly.</p>
                  </div>
                )
              )}

              {!isFetchingFormSchema && dynamicFormSchema && ( // Always show "Back to Upload" if form is visible
                <div className="flex justify-start mt-3">
                  <Button variant="outline" onClick={resetToFileUploadView}>Back to Upload</Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
