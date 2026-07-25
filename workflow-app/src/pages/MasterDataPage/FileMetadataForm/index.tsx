import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import axios from "axios";
import { getExcelSheetNamesForUploadedFile } from "@/controllers/API/filesApi";
import { getDisplayErrorMessage } from "@/utils/exceptionHelper";
import { FormFieldConfig, SheetNameApiContext } from "../types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

/** Form/API options often use the two-char sequence backslash + "t"; JSON then shows `"\\t"`. Backend expects a real TAB (`"\t"`). */
function normalizeDelimiterForApi(raw: string | undefined | null): string {
  if (raw == null || raw === "") return "";
  const s = String(raw);
  if (s === "\\t") return "\t";
  return s;
}

/** Radix Select only shows a value that exactly matches an option.value. APIs often store a real TAB while options use literal "\\t". */
function buildComparablePayload(data: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === "delimiter") {
      out[key] = normalizeDelimiterForApi(value as string);
    } else {
      out[key] = value == null ? "" : String(value);
    }
  }
  return out;
}

function delimiterToSelectValue(
  stored: string | undefined | null,
  options: FormFieldConfig["options"] | undefined
): string {
  if (stored == null || stored === "") return "";
  const opts = options ?? [];
  const s = String(stored);
  if (opts.some((o) => String(o.value) === s)) return s;
  if (s === "\t") {
    const hit = opts.find((o) => String(o.value) === "\\t");
    if (hit) return String(hit.value);
  }
  if (s === "\\t") {
    const hit = opts.find((o) => String(o.value) === "\t");
    if (hit) return String(hit.value);
  }
  return s;
}

interface FileMetadataFormProps {
  formFieldsConfig: FormFieldConfig[];
  onSubmit: (formData: Record<string, any>) => void;
  onCancel: () => void;

  uploadedOriginalFile?: File;
  fileContextForSheetNameApi?: SheetNameApiContext;
  initialDataForEdit?: any; // Made more flexible to accept the full API response
}

export default function FileMetadataForm({
  formFieldsConfig,
  onSubmit,
  onCancel,
  uploadedOriginalFile,
  fileContextForSheetNameApi: fileContextFromUpload,
  initialDataForEdit,
}: FileMetadataFormProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sheetNameOptions, setSheetNameOptions] = useState<{ label: string; value: string }[]>([]);
  const [isLoadingSheetNames, setIsLoadingSheetNames] = useState(false);
  const [isFormInitialized, setIsFormInitialized] = useState(false);
  const isMountedRef = useRef(true);
  const formDataRef = useRef(formData);
  formDataRef.current = formData;
  const initialEditSnapshotRef = useRef<string | null>(null);
  const isEditMode = Boolean(initialDataForEdit);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const currentFileContext = useMemo((): SheetNameApiContext | undefined => {
    if (initialDataForEdit && initialDataForEdit.unique_id && initialDataForEdit.encrypted_file_key && initialDataForEdit.file_name) {
      return {
        unique_id: initialDataForEdit.unique_id,
        encrypted_file_key: initialDataForEdit.encrypted_file_key,
        file_name: initialDataForEdit.file_name,
      };
    }
    return fileContextFromUpload;
  }, [initialDataForEdit, fileContextFromUpload]);

  const currentFileContextRef = useRef(currentFileContext);
  currentFileContextRef.current = currentFileContext;

  // Initialize form data - COMPLETELY REWRITTEN
  useEffect(() => {

    if (!formFieldsConfig) {
      return;
    }

    if (formFieldsConfig.length === 0) {
      setIsFormInitialized(true);
      return;
    }

    const newFormData: Record<string, any> = {};
    const isEditModeLocal = !!initialDataForEdit;


    // Initialize each form field
    formFieldsConfig.forEach((field) => {
      let valueToSet: any = "";


      if (isEditModeLocal && initialDataForEdit) {
        // EDIT MODE - Map API response to form fields
        switch (field.name) {
          case "file_name":
            valueToSet = initialDataForEdit.file_name || "";
            break;
          case "display_name":
            valueToSet = initialDataForEdit.display_name || "";
            break;
          case "file_category":
            valueToSet = initialDataForEdit.file_category || "";
            break;
          case "file_type":
            valueToSet = initialDataForEdit.file_type || "";
            break;
          case "sheet_name":
            valueToSet = initialDataForEdit.sheet_name || "";
            break;
          case "delimiter":
            valueToSet = delimiterToSelectValue(
              initialDataForEdit.delimiter ?? "",
              field.options
            );
            break;
          case "comments":
            valueToSet = initialDataForEdit.comments || "";
            break;
          default:
            // Try to find the field directly in the API response
            valueToSet = initialDataForEdit[field.name] || "";
        }

      } else {
        // NEW UPLOAD MODE - Set default values
        if (field.name === "file_name") {
          valueToSet = currentFileContext?.file_name || uploadedOriginalFile?.name || "";
        } else if (field.name === "display_name") {
          valueToSet = uploadedOriginalFile?.name.split('.').slice(0, -1).join('.') || "";
        } else if (field.name === "file_type") {
          const fileExtension = uploadedOriginalFile?.name.split('.').pop()?.toLowerCase();
          if (fileExtension === 'xlsx' || fileExtension === 'xls') {
            valueToSet = "excel";
          } else if (fileExtension === 'csv') {
            valueToSet = "csv";
          } else if (fileExtension === 'txt') {
            valueToSet = "text";
          } else {
            valueToSet = field.options?.[0]?.value || "";
          }
        } else if (field.name === "file_category") {
          valueToSet = "master_data";
        } else if (field.type === "dropdown") {
          valueToSet = field.options?.[0]?.value || "";
        } else {
          valueToSet = "";
        }
      }
      newFormData[field.name] = valueToSet;
    });

    // Apply cascading logic for new uploads only
    if (!isEditModeLocal) {
      if (newFormData.file_type === "csv") {
        const delimiterField = formFieldsConfig.find(f => f.name === "delimiter");
        newFormData.delimiter = delimiterField?.options?.find(opt => opt.value === ",")?.value || "";
      } else if (newFormData.file_type === "text") {
        const delimiterField = formFieldsConfig.find(f => f.name === "delimiter");
        newFormData.delimiter = delimiterField?.options?.find(opt => opt.value === "|")?.value || "";
      }

      if (newFormData.file_type !== "excel") {
        newFormData.sheet_name = "";
      }

      if (newFormData.file_type !== "csv" && newFormData.file_type !== "text") {
        newFormData.delimiter = "";
      }
    }

    setFormData(newFormData);
    initialEditSnapshotRef.current = isEditModeLocal
      ? JSON.stringify(buildComparablePayload(newFormData))
      : null;
    setIsFormInitialized(true);
  }, [formFieldsConfig, uploadedOriginalFile, initialDataForEdit, currentFileContext, isEditMode]);

  const handleChange = useCallback((name: string, value: any) => {

    setFormData((prev) => {
      const newData = { ...prev, [name]: value };

      // Handle cascading changes when load_type is modified by the user
      if (name === "file_type") {
        newData.delimiter = "";
        newData.sheet_name = "";

        if (value === "csv") {
          const delimiterField = formFieldsConfig.find(f => f.name === "delimiter");
          newData.delimiter = delimiterField?.options?.find(opt => opt.value === ",")?.value || "";
        } else if (value === "text") {
          const delimiterField = formFieldsConfig.find(f => f.name === "delimiter");
          newData.delimiter = delimiterField?.options?.find(opt => opt.value === "|")?.value || "";
        }
      }

      return newData;
    });

    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[name];
      return newErrors;
    });
  }, [formFieldsConfig]);

  const shouldShowField = useCallback((field: FormFieldConfig): boolean => { //boolean //
    if (field.show === false) return false;
    if (!field.depends_key || !field.depends_value || field.depends_value.length === 0) {
      return true;
    }
    const dependencyValue = formData[field.depends_key];
    const shouldShow = field.depends_value.includes(String(dependencyValue));
    return shouldShow;
  }, [formData]);

  // Fetch sheet names - IMPROVED VERSION
  const fetchSheetNames = useCallback(async (signal: AbortSignal, category: string) => {
    const ctx = currentFileContextRef.current;
    if (!ctx || !category) {
      if (isMountedRef.current) {
        setSheetNameOptions([]);
        setIsLoadingSheetNames(false);
      }
      return;
    }

    if (isMountedRef.current) setIsLoadingSheetNames(true);

    try {
      const sheetNames = await getExcelSheetNamesForUploadedFile(
        {
          file_name: ctx.file_name,
          unique_id: ctx.unique_id,
          encrypted_file_key: ctx.encrypted_file_key,
          file_category: category,
        },
        { signal },
      );

      if (!isMountedRef.current) return;

      const fetchedSheets = sheetNames.map((sheet) => ({ label: sheet, value: sheet }));
      setSheetNameOptions(fetchedSheets);

      const isEditMode = !!initialDataForEdit;
      const fd = formDataRef.current;
      const currentSheetInForm = fd.sheet_name;

      if (!isEditMode) {
        if (fetchedSheets.length > 0) {
          if (!fd.sheet_name || !fetchedSheets.some((s) => s.value === fd.sheet_name)) {
            handleChange('sheet_name', fetchedSheets[0].value);
          }
        } else {
          if (fd.sheet_name) handleChange('sheet_name', '');
          toast.info("No sheets found in the Excel file for the selected category.");
        }
      } else {
        if (fetchedSheets.length === 0 && fd.file_type === 'excel') {
          toast.info("No sheets found for the selected category. If a sheet was previously saved, it might now be invalid.");
          if (currentSheetInForm) handleChange('sheet_name', '');
        } else if (
          currentSheetInForm &&
          fetchedSheets.length > 0 &&
          !fetchedSheets.some((s) => s.value === currentSheetInForm)
        ) {
          toast.warning(
            `Previously selected sheet "${currentSheetInForm}" is no longer available for the current settings. Please select a new one.`,
          );
        }
      }
    } catch (error) {
      if (!axios.isCancel(error) && isMountedRef.current) {
        console.error("[FileMetadataForm] Error fetching sheet names:", error);
        toast.error(getDisplayErrorMessage(error, "Failed to fetch sheet names."));
        setSheetNameOptions([]);
      }
    } finally {
      if (isMountedRef.current) setIsLoadingSheetNames(false);
    }

  }, [handleChange, initialDataForEdit]);

  // Effect to fetch sheet names when conditions are met.
  // Do not depend on sheet_name or a callback that depends on sheet_name — auto-selecting
  // a sheet would retrigger this effect and call /files/excel-actions repeatedly.
  useEffect(() => {
    if (!isFormInitialized) {
      return;
    }
    const abortController = new AbortController();
    const loadType = formData.file_type;
    const fileCategory = formData.file_category;


    if (loadType === 'excel' && fileCategory && currentFileContext?.unique_id) {
      fetchSheetNames(abortController.signal, fileCategory);
    } else {
      setSheetNameOptions([]);
      if (formData.sheet_name && (loadType !== 'excel' || !fileCategory)) {
        if (formData.sheet_name !== '') {
          handleChange('sheet_name', '');
        }
      }
    }

    return () => abortController.abort();
  }, [isFormInitialized, formData.file_type, formData.file_category, currentFileContext?.unique_id, fetchSheetNames, handleChange]);

  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {};
    formFieldsConfig.forEach((field) => {
      if (!shouldShowField(field)) return;
      if (field.required) {
        const value = formData[field.name];
        if (value === undefined || value === null || String(value).trim() === "") {
          newErrors[field.name] = `${field.displayName} is required.`;
        }
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formFieldsConfig, formData, shouldShowField]);

  const hasEditChanges = useMemo(() => {
    if (!isEditMode || !initialEditSnapshotRef.current) return false;
    const current = JSON.stringify(buildComparablePayload(formData));
    return current !== initialEditSnapshotRef.current;
  }, [formData, isEditMode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      const payload = {
        ...formData,
        delimiter: normalizeDelimiterForApi(formData.delimiter),
      };
      onSubmit(payload);
    } else {
      toast.error("Please fill in all required fields.");
    }
  };

  const isFieldDisabled = (field: FormFieldConfig): boolean => {
    if (field.name === "sheet_name" && isLoadingSheetNames) return true;
    return false;
  };

  // Debug render

  if (!isFormInitialized) {
    return (
      <div className="w-full max-w-2xl mx-auto flex items-center justify-center p-8">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Initializing form...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-3">
        {formFieldsConfig.map((field) => {
          const shouldShow = shouldShowField(field);
          if (!shouldShow) {
            return null;
          }

          const fieldError = errors[field.name];
          const isDisabled = isFieldDisabled(field);
          const fieldValue = formData[field.name] || "";


          return (
            <div key={field.name} className="space-y-1">
              <Label htmlFor={field.name} className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {field.displayName}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </Label>

              {field.type === "text" && (
                <Input
                  id={field.name}
                  name={field.name}
                  placeholder={field.placeholder}
                  value={fieldValue}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  disabled={isDisabled}
                  className={`w-full border ${fieldError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2  focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-700 dark:bg-gray-800 dark:text-gray-100`}
                />
              )}

              {field.type === "textArea" && (
                <Textarea
                  id={field.name}
                  name={field.name}
                  placeholder={field.placeholder}
                  value={fieldValue}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  rows={3}
                  disabled={isDisabled}
                  className={`w-full border ${fieldError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2  focus:border-transparent resize-vertical disabled:bg-gray-100 dark:disabled:bg-gray-700 dark:bg-gray-800 dark:text-gray-100`}
                />
              )}

              {field.type === "dropdown" && (
                <Select
                  name={field.name}
                  value={String(fieldValue)}
                  onValueChange={(value) => handleChange(field.name, value)}
                  disabled={isDisabled}
                >
                  <SelectTrigger id={field.name} className={`w-full border ${fieldError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} rounded-md disabled:bg-gray-100 dark:disabled:bg-gray-700 dark:bg-gray-800 dark:text-gray-100`}>
                    <SelectValue placeholder={field.placeholder || "Select an option"} />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-800">
                    {field.name === "sheet_name" ? (
                      isLoadingSheetNames ? (
                        <div className="flex items-center justify-center p-3">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Loading sheets...
                        </div>
                      ) : sheetNameOptions.length > 0 ? (
                        sheetNameOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value} className="dark:focus:bg-gray-700">
                            {option.label}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-3 text-sm text-gray-500 text-center">
                          {formData.load_type === 'excel' && formData.file_category ? "No sheets available" : (formData.load_type === 'excel' ? "Select File Category first" : "N/A for current Load Type")}
                        </div>
                      )
                    ) : (
                      field.options?.map((option) => (
                        <SelectItem key={option.value} value={String(option.value)} className="dark:focus:bg-gray-700">
                          {option.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}

              {fieldError && (
                <p className="text-xs text-red-600 mt-1">
                  {fieldError}
                </p>
              )}
              {field.info && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{field.info}</p>}
            </div>
          );
        })}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" className="!h-8 !px-2" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={
              isLoadingSheetNames || (isEditMode && !hasEditChanges)
                ? "disable"
                : "default"
            }
            disabled={isLoadingSheetNames || (isEditMode && !hasEditChanges)}
            className="min-w-[120px] !h-8 !px-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoadingSheetNames && formData.file_type === "excel" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : isEditMode ? (
              "Update"
            ) : (
              "Submit Metadata"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
